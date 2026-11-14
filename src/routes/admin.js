'use strict';

const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAdmin, flash } = require('../middleware/auth');
const { ensureEnrollment, effectiveStatus } = require('../domain');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// "Passed and still valid" — expired passes count as pending again.
const VALID_PASS = "e.status = 'passed' AND (e.expires_at IS NULL OR e.expires_at > @now)";

router.use(requireAdmin);

function listEmployees(companyId) {
  return db
    .prepare(
      `SELECT u.id, u.full_name, u.email, u.position, u.role,
              (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id AND ${VALID_PASS}) AS passed,
              (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) AS assigned
         FROM users u WHERE u.company_id = @cid ORDER BY u.full_name`
    )
    .all({ cid: companyId, now: new Date().toISOString() });
}

function ownCourse(req, id) {
  return db
    .prepare('SELECT * FROM courses WHERE id = ? AND company_id = ?')
    .get(id, req.user.company_id);
}

// ---- Admin overview ----
router.get('/', (req, res) => {
  const p = { cid: req.user.company_id, now: new Date().toISOString() };
  const counts = {
    employees: db
      .prepare("SELECT COUNT(*) n FROM users WHERE company_id = @cid AND role = 'employee'")
      .get(p).n,
    courses: db.prepare('SELECT COUNT(*) n FROM courses WHERE company_id = @cid').get(p).n,
    passed: db
      .prepare(
        `SELECT COUNT(*) n FROM enrollments e JOIN users u ON u.id = e.user_id
          WHERE u.company_id = @cid AND ${VALID_PASS}`
      )
      .get(p).n,
    pending: db
      .prepare(
        `SELECT COUNT(*) n FROM enrollments e JOIN users u ON u.id = e.user_id
          WHERE u.company_id = @cid AND NOT (${VALID_PASS})`
      )
      .get(p).n,
  };

  const recent = db
    .prepare(
      `SELECT u.full_name, c.title, e.status, e.best_score, e.completed_at, e.expires_at
         FROM enrollments e
         JOIN users u ON u.id = e.user_id
         JOIN courses c ON c.id = e.course_id
        WHERE u.company_id = @cid
        ORDER BY COALESCE(e.completed_at, e.assigned_at) DESC, e.id DESC
        LIMIT 10`
    )
    .all(p)
    .map((r) => ({ ...r, status: effectiveStatus(r) }));

  res.render('admin/overview', { title: 'Administravimas', counts, recent });
});

// ---- Courses list ----
router.get('/kursai', (req, res) => {
  const courses = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM questions q WHERE q.course_id = c.id) AS q_count,
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS enrolled
         FROM courses c WHERE c.company_id = ? ORDER BY c.category, c.title`
    )
    .all(req.user.company_id);
  res.render('admin/courses', { title: 'Kursai', courses });
});

// ---- New / edit course form ----
router.get('/kursai/naujas', (req, res) => {
  res.render('admin/course-form', { title: 'Naujas kursas', course: null, questions: [] });
});

router.get('/kursai/:id', (req, res) => {
  const course = ownCourse(req, req.params.id);
  if (!course) return res.redirect('/admin/kursai');
  const questions = db
    .prepare('SELECT * FROM questions WHERE course_id = ? ORDER BY sort_order, id')
    .all(course.id)
    .map((q) => ({ ...q, options: JSON.parse(q.options_json) }));
  res.render('admin/course-form', { title: 'Redaguoti kursą', course, questions });
});

// ---- Create / update course ----
router.post('/kursai', (req, res) => {
  const { id, title, category, summary, content, pass_score, valid_months, is_published } = req.body;
  const clamp = (v, lo, hi, dflt) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
  };
  const data = {
    title: (title || '').trim().slice(0, 200),
    category: (category || '').trim().slice(0, 60) || 'Bendra',
    summary: (summary || '').trim().slice(0, 300),
    content: (content || '').trim(),
    pass_score: clamp(pass_score, 1, 100, 80),
    valid_months: clamp(valid_months, 1, 120, 12),
    is_published: is_published ? 1 : 0,
  };

  if (!data.title || !data.content) {
    flash(req, 'error', 'Kurso pavadinimas ir instrukcijos tekstas yra privalomi.');
    return res.redirect(id ? '/admin/kursai/' + encodeURIComponent(id) : '/admin/kursai/naujas');
  }

  if (id) {
    const course = ownCourse(req, id);
    if (!course) return res.redirect('/admin/kursai');
    db.prepare(
      `UPDATE courses SET title=@title, category=@category, summary=@summary, content=@content,
         pass_score=@pass_score, valid_months=@valid_months, is_published=@is_published
       WHERE id=@id`
    ).run({ ...data, id: course.id });
    flash(req, 'success', 'Kursas išsaugotas.');
    return res.redirect('/admin/kursai/' + course.id);
  }

  const info = db
    .prepare(
      `INSERT INTO courses (company_id, title, category, summary, content, pass_score, valid_months, is_published)
       VALUES (@cid, @title, @category, @summary, @content, @pass_score, @valid_months, @is_published)`
    )
    .run({ ...data, cid: req.user.company_id });
  flash(req, 'success', 'Kursas sukurtas. Dabar pridėkite testo klausimų.');
  res.redirect('/admin/kursai/' + info.lastInsertRowid);
});

// ---- Add a question ----
router.post('/kursai/:id/klausimas', (req, res) => {
  const course = ownCourse(req, req.params.id);
  if (!course) return res.redirect('/admin/kursai');

  const text = (req.body.text || '').trim();
  const raw = [0, 1, 2, 3].map((i) => (req.body['opt' + i] || '').trim());
  const picked = parseInt(req.body.correct_index, 10);
  const options = raw.filter((o) => o.length > 0);
  // The chosen radio refers to the form row; map it to its position among the filled options.
  const correct =
    Number.isInteger(picked) && raw[picked] ? raw.slice(0, picked).filter(Boolean).length : -1;

  if (!text || options.length < 2) {
    flash(req, 'error', 'Įveskite klausimą ir bent du atsakymų variantus.');
  } else if (correct < 0) {
    flash(req, 'error', 'Teisingu pažymėtas atsakymas negali būti tuščias.');
  } else {
    const maxOrder = db
      .prepare('SELECT COALESCE(MAX(sort_order),0) m FROM questions WHERE course_id = ?')
      .get(course.id).m;
    db.prepare(
      'INSERT INTO questions (course_id, text, options_json, correct_index, sort_order) VALUES (?,?,?,?,?)'
    ).run(course.id, text, JSON.stringify(options), correct, maxOrder + 1);
  }
  res.redirect('/admin/kursai/' + course.id);
});

router.post('/klausimas/:qid/trinti', (req, res) => {
  const q = db
    .prepare(
      `SELECT q.id, q.course_id FROM questions q
         JOIN courses c ON c.id = q.course_id
        WHERE q.id = ? AND c.company_id = ?`
    )
    .get(req.params.qid, req.user.company_id);
  if (!q) return res.redirect('/admin/kursai');
  db.prepare('DELETE FROM questions WHERE id = ?').run(q.id);
  res.redirect('/admin/kursai/' + q.course_id);
});

// ---- Employees ----
router.get('/darbuotojai', (req, res) => {
  res.render('admin/employees', {
    title: 'Darbuotojai',
    employees: listEmployees(req.user.company_id),
    error: null,
    created: null,
  });
});

router.post('/darbuotojai', (req, res) => {
  const full_name = (req.body.full_name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const position = (req.body.position || '').trim();
  const password = (req.body.password || '').trim();

  const render = (status, extra) =>
    res.status(status).render('admin/employees', {
      title: 'Darbuotojai',
      employees: listEmployees(req.user.company_id),
      error: null,
      created: null,
      ...extra,
    });

  if (!full_name || !EMAIL_RE.test(email)) {
    return render(400, { error: 'Nurodykite vardą ir teisingą el. paštą.' });
  }
  if (password && password.length < 8) {
    return render(400, { error: 'Slaptažodis turi būti bent 8 simbolių (arba palikite tuščią).' });
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return render(400, { error: 'Toks el. paštas jau naudojamas.' });
  }

  const pw = password || crypto.randomBytes(9).toString('base64url');
  db.prepare(
    "INSERT INTO users (company_id, email, password_hash, full_name, position, role) VALUES (?,?,?,?,?,'employee')"
  ).run(req.user.company_id, email, bcrypt.hashSync(pw, 10), full_name, position);

  render(200, { created: { email, password: pw } });
});

// ---- Assignments ----
router.get('/priskyrimai', (req, res) => {
  const cid = req.user.company_id;
  const employees = db
    .prepare("SELECT id, full_name, position FROM users WHERE company_id = ? AND role='employee' ORDER BY full_name")
    .all(cid);
  const courses = db
    .prepare('SELECT id, title, category FROM courses WHERE company_id = ? AND is_published = 1 ORDER BY title')
    .all(cid);
  const matrix = db
    .prepare(
      `SELECT e.user_id, e.course_id, e.status, e.best_score, e.expires_at
         FROM enrollments e JOIN users u ON u.id = e.user_id
        WHERE u.company_id = ?`
    )
    .all(cid);
  const map = {};
  for (const m of matrix) map[m.user_id + ':' + m.course_id] = { ...m, status: effectiveStatus(m) };
  res.render('admin/assignments', { title: 'Priskyrimai', employees, courses, map });
});

// Both ids must belong to the admin's company; returns null otherwise.
function ownPair(req) {
  const cid = req.user.company_id;
  const user = db
    .prepare("SELECT id FROM users WHERE id = ? AND company_id = ? AND role = 'employee'")
    .get(Number(req.body.user_id), cid);
  const course = db
    .prepare('SELECT id FROM courses WHERE id = ? AND company_id = ?')
    .get(Number(req.body.course_id), cid);
  return user && course ? { userId: user.id, courseId: course.id } : null;
}

router.post('/priskyrimai', (req, res) => {
  const pair = ownPair(req);
  if (pair) ensureEnrollment(pair.userId, pair.courseId);
  res.redirect('/admin/priskyrimai');
});

// Withdraw an assignment that has not produced a certificate yet.
router.post('/priskyrimai/salinti', (req, res) => {
  const pair = ownPair(req);
  if (pair) {
    const info = db
      .prepare(
        `DELETE FROM enrollments
          WHERE user_id = ? AND course_id = ?
            AND NOT EXISTS (SELECT 1 FROM certificates c WHERE c.enrollment_id = enrollments.id)`
      )
      .run(pair.userId, pair.courseId);
    if (info.changes === 0) {
      flash(req, 'error', 'Priskyrimo pašalinti negalima – darbuotojui jau išduotas pažymėjimas.');
    }
  }
  res.redirect('/admin/priskyrimai');
});

// Assign a course to all employees at once
router.post('/priskyrimai/visiems', (req, res) => {
  const course = ownCourse(req, Number(req.body.course_id));
  if (course) {
    const employees = db
      .prepare("SELECT id FROM users WHERE company_id = ? AND role='employee'")
      .all(req.user.company_id);
    db.transaction((list) => {
      for (const emp of list) ensureEnrollment(emp.id, course.id);
    })(employees);
    flash(req, 'success', `Kursas „${course.title}“ priskirtas visiems darbuotojams (${employees.length}).`);
  }
  res.redirect('/admin/priskyrimai');
});

module.exports = router;
