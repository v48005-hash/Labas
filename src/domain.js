'use strict';

const crypto = require('crypto');
const db = require('./db');

// Ensure an enrollment row exists for (user, course); returns it.
function ensureEnrollment(userId, courseId) {
  let en = db
    .prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
    .get(userId, courseId);
  if (!en) {
    db.prepare('INSERT INTO enrollments (user_id, course_id, status) VALUES (?, ?, ?)').run(
      userId,
      courseId,
      'assigned'
    );
    en = db
      .prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
      .get(userId, courseId);
  }
  return en;
}

function markRead(userId, courseId) {
  const en = ensureEnrollment(userId, courseId);
  if (!en.read_done) {
    const status = en.status === 'assigned' ? 'in_progress' : en.status;
    db.prepare('UPDATE enrollments SET read_done = 1, status = ? WHERE id = ?').run(status, en.id);
  }
}

function generateCertCode() {
  return 'SP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function addMonths(date, months) {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

// Grade a submitted test. answers = { questionId: chosenIndex }
function gradeAttempt(user, course, answers) {
  const questions = db
    .prepare('SELECT * FROM questions WHERE course_id = ? ORDER BY sort_order, id')
    .all(course.id);

  if (questions.length === 0) {
    return { error: 'Šis kursas dar neturi testo klausimų.' };
  }

  let correct = 0;
  const review = [];
  for (const q of questions) {
    const chosen = Number(answers['q_' + q.id]);
    const isCorrect = chosen === q.correct_index;
    if (isCorrect) correct++;
    review.push({ question: q, chosen, isCorrect });
  }
  const score = Math.round((correct / questions.length) * 100);
  const passed = score >= course.pass_score;

  const en = ensureEnrollment(user.id, course.id);
  const attempts = en.attempts + 1;
  const now = new Date();

  if (passed) {
    const expires = addMonths(now, course.valid_months);
    db.prepare(
      `UPDATE enrollments
         SET status = 'passed', best_score = MAX(COALESCE(best_score,0), ?),
             attempts = ?, read_done = 1, completed_at = ?, expires_at = ?
       WHERE id = ?`
    ).run(score, attempts, now.toISOString(), expires.toISOString(), en.id);

    // Issue certificate if none yet
    const existing = db
      .prepare('SELECT * FROM certificates WHERE enrollment_id = ?')
      .get(en.id);
    if (!existing) {
      db.prepare(
        'INSERT INTO certificates (enrollment_id, code, expires_at) VALUES (?, ?, ?)'
      ).run(en.id, generateCertCode(), expires.toISOString());
    }
  } else {
    db.prepare(
      `UPDATE enrollments
         SET status = 'failed', best_score = MAX(COALESCE(best_score,0), ?), attempts = ?
       WHERE id = ?`
    ).run(score, attempts, en.id);
  }

  return { score, passed, correct, total: questions.length, review };
}

// Build a progress summary for a user's dashboard.
function userDashboard(user) {
  const rows = db
    .prepare(
      `SELECT c.id, c.title, c.category, c.summary, c.pass_score,
              e.status, e.best_score, e.read_done, e.expires_at, e.completed_at
         FROM courses c
         LEFT JOIN enrollments e ON e.course_id = c.id AND e.user_id = @uid
        WHERE c.company_id = @cid AND c.is_published = 1
        ORDER BY c.category, c.title`
    )
    .all({ uid: user.id, cid: user.company_id });

  const stats = {
    total: rows.length,
    passed: rows.filter((r) => r.status === 'passed').length,
    pending: rows.filter((r) => r.status !== 'passed').length,
  };
  return { rows, stats };
}

module.exports = {
  ensureEnrollment,
  markRead,
  gradeAttempt,
  userDashboard,
  generateCertCode,
  addMonths,
};
