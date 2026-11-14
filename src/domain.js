'use strict';

const crypto = require('crypto');
const db = require('./db');

function getEnrollment(userId, courseId) {
  return db
    .prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
    .get(userId, courseId);
}

// Ensure an enrollment row exists for (user, course); returns it. Used when an admin assigns.
function ensureEnrollment(userId, courseId) {
  db.prepare(
    "INSERT OR IGNORE INTO enrollments (user_id, course_id, status) VALUES (?, ?, 'assigned')"
  ).run(userId, courseId);
  return getEnrollment(userId, courseId);
}

function isExpired(en) {
  return Boolean(en && en.expires_at && new Date(en.expires_at) < new Date());
}

// Stored status plus the derived 'expired' state (passed, but validity ran out).
function effectiveStatus(en) {
  if (!en || !en.status) return null;
  if (en.status === 'passed' && isExpired(en)) return 'expired';
  return en.status;
}

function markRead(enrollment) {
  if (enrollment.read_done) return;
  const status = enrollment.status === 'assigned' ? 'in_progress' : enrollment.status;
  db.prepare('UPDATE enrollments SET read_done = 1, status = ? WHERE id = ?').run(
    status,
    enrollment.id
  );
}

function generateCertCode() {
  for (;;) {
    const code = 'SP-' + crypto.randomBytes(5).toString('hex').toUpperCase();
    if (!db.prepare('SELECT 1 FROM certificates WHERE code = ?').get(code)) return code;
  }
}

function addMonths(date, months) {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function latestCertificate(enrollmentId) {
  return db
    .prepare('SELECT * FROM certificates WHERE enrollment_id = ? ORDER BY issued_at DESC, id DESC LIMIT 1')
    .get(enrollmentId);
}

// Grade a submitted test. answers = { 'q_<id>': chosenIndex }
const gradeAttempt = db.transaction((enrollment, course, answers) => {
  const questions = db
    .prepare('SELECT * FROM questions WHERE course_id = ? ORDER BY sort_order, id')
    .all(course.id);

  if (questions.length === 0) {
    return { error: 'Šis kursas dar neturi testo klausimų.' };
  }

  let correct = 0;
  const review = [];
  for (const q of questions) {
    const raw = answers['q_' + q.id];
    const chosen = /^\d+$/.test(String(raw ?? '')) ? Number(raw) : -1;
    const isCorrect = chosen === q.correct_index;
    if (isCorrect) correct++;
    review.push({ question: q, options: JSON.parse(q.options_json), chosen, isCorrect });
  }
  const score = Math.round((correct / questions.length) * 100);
  const passed = score >= course.pass_score;

  const stillValid = effectiveStatus(enrollment) === 'passed';
  const attempts = enrollment.attempts + 1;
  const best = Math.max(enrollment.best_score || 0, score);
  const now = new Date();

  if (stillValid) {
    // A valid pass is never downgraded or re-issued by another attempt.
    db.prepare('UPDATE enrollments SET best_score = ?, attempts = ? WHERE id = ?').run(
      best,
      attempts,
      enrollment.id
    );
  } else if (passed) {
    const expires = addMonths(now, course.valid_months).toISOString();
    db.prepare(
      `UPDATE enrollments
          SET status = 'passed', best_score = ?, attempts = ?, read_done = 1,
              completed_at = ?, expires_at = ?
        WHERE id = ?`
    ).run(best, attempts, now.toISOString(), expires, enrollment.id);
    db.prepare(
      'INSERT INTO certificates (enrollment_id, code, issued_at, expires_at) VALUES (?, ?, ?, ?)'
    ).run(enrollment.id, generateCertCode(), now.toISOString(), expires);
  } else {
    db.prepare(
      "UPDATE enrollments SET status = 'failed', best_score = ?, attempts = ? WHERE id = ?"
    ).run(best, attempts, enrollment.id);
  }

  const certificate = passed || stillValid ? latestCertificate(enrollment.id) : null;
  return { score, passed, correct, total: questions.length, review, certificate, stillValid };
});

// Courses assigned to a user, with their effective status.
function userDashboard(user) {
  const rows = db
    .prepare(
      `SELECT c.id, c.title, c.category, c.summary, c.pass_score,
              e.status, e.best_score, e.read_done, e.expires_at, e.completed_at
         FROM enrollments e
         JOIN courses c ON c.id = e.course_id
        WHERE e.user_id = ? AND c.company_id = ? AND c.is_published = 1
        ORDER BY c.category, c.title`
    )
    .all(user.id, user.company_id)
    .map((r) => ({ ...r, status: effectiveStatus(r) }));

  const passed = rows.filter((r) => r.status === 'passed').length;
  return { rows, stats: { total: rows.length, passed, pending: rows.length - passed } };
}

module.exports = {
  getEnrollment,
  ensureEnrollment,
  effectiveStatus,
  isExpired,
  markRead,
  gradeAttempt,
  latestCertificate,
  userDashboard,
  generateCertCode,
  addMonths,
};
