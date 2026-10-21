'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { ensureEnrollment } = require('../domain');

router.use(requireAdmin);

// ---- Admin overview ----
router.get('/', (req, res) => {
  const cid = req.user.company_id;
  const counts = {
    employees: db.prepare("SELECT COUNT(*) n FROM users WHERE company_id = ? AND role = 'employee'").get(cid).n,
    courses: db.prepare('SELECT COUNT(*) n FROM courses WHERE company_id = ?').get(cid).n,
    passed: db
      .prepare(
        `SELECT COUNT(*) n FROM enrollments e
           JOIN users u ON u.id = e.user_id
          WHERE u.company_id = ? AND e.status = 'passed'`
      )
      .get(cid).n,
    pending: db
      .prepare(
        `SELECT COUNT(*) n FROM enrollments e
           JOIN users u ON u.id = e.user_id
          WHERE u.company_id = ? AND e.status != 'passed'`
      )
      .get(cid).n,
  };

  const recent = db
    .prepare(
      `SELECT u.full_name, c.title, e.status, e.best_score, e.completed_at
         FROM enrollments e
         JOIN users u ON u.id = e.user_id
         JOIN courses c ON c.id = e.course_id
        WHERE u.company_id = ?
        ORDER BY COALESCE(e.completed_at, e.assigned_at) DESC
        LIMIT 10`
    )
    .all(cid);

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
  const course = db
    .prepare('SELECT * FROM courses WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.company_id);
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
  const data = {
    title: (title || '').trim(),
    category: (category || 'Bendra').trim() || 'Bendra',
    summary: (summary || '').trim(),
    content: content || '',
    pass_score: Math.min(100, Math.max(0, parseInt(pass_score, 10) || 80)),
    valid_months: Math.max(1, parseInt(valid_months, 10) || 12),
    is_published: is_published ? 1 : 0,
  };
  if (!data.title) return res.redirect('/admin/kursai/naujas');

  if (id) {
    db.prepare(
      `UPDATE courses SET title=@title, category=@category, summary=@summary, content=@content,
         pass_score=@pass_score, valid_months=@valid_months, is_published=@is_published
       WHERE id=@id AND company_id=@cid`
    ).run({ ...data, id: Number(id), cid: req.user.company_id });
    return res.redirect('/admin/kursai/' + id);
  }
  const info = db
    .prepare(
      `INSERT INTO courses (company_id, title, category, summary, content, pass_score, valid_months, is_published)
       VALUES (@cid, @title, @category, @summary, @content, @pass_score, @valid_months, @is_published)`
    )
    .run({ ...data, cid: req.user.company_id });
  res.redirect('/admin/kursai/' + info.lastInsertRowid);
});

// ---- Add a question ----
router.post('/kursai/:id/klausimas', (req, res) => {
  const course = db
    .prepare('SELECT id FROM courses WHERE id = ? AND company_id = ?')
    .get(req.params.id, req.user.company_id);
  if (!course) return res.redirect('/admin/kursai');

  const text = (req.body.text || '').trim();
  const options = [req.body.opt0, req.body.opt1, req.body.opt2, req.body.opt3]
    .map((o) => (o || '').trim())
    .filter((o) => o.length > 0);
  const correct = parseInt(req.body.correct_index, 10) || 0;

  if (text && options.length >= 2 && correct < options.length) {
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
  if (q) {
    db.prepare('DELETE FROM questions WHERE id = ?').run(q.id);
    return res.redirect('/admin/kursai/' + q.course_id);
  }
  res.redirect('/admin/kursai');
});

// ---- Employees ----
router.get('/darbuotojai', (req, res) => {
  const employees = db
    .prepare(
      `SELECT u.id, u.full_name, u.email, u.position, u.role,
              (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id AND e.status='passed') AS passed,
              (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) AS assigned
         FROM users u WHERE u.company_id = ? ORDER BY u.full_name`
    )
    .all(req.user.company_id);
  res.render('admin/employees', { title: 'Darbuotojai', employees, error: null, created: null });
});

router.post('/darbuotojai', (req, res) => {
  const { full_name, email, position, password } = req.body;
  const render = (extra) =>
    res.render('admin/employees', {
      title: 'Darbuotojai',
      employees: db
        .prepare(
          `SELECT u.id, u.full_name, u.email, u.position, u.role,
                  (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id AND e.status='passed') AS passed,
                  (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) AS assigned
             FROM users u WHERE u.company_id = ? ORDER BY u.full_name`
        )
        .all(req.user.company_id),
      error: null,
      created: null,
      ...extra,
    });

  if (!full_name || !email) return render({ error: 'Nurodykite vardą ir el. paštą.' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (exists) return render({ error: 'Toks el. paštas jau naudojamas.' });

  const pw = (password && password.trim()) || Math.random().toString(36).slice(2, 10);
  const hash = bcrypt.hashSync(pw, 10);
  db.prepare(
    "INSERT INTO users (company_id, email, password_hash, full_name, position, role) VALUES (?,?,?,?,?,'employee')"
  ).run(req.user.company_id, email.toLowerCase(), hash, full_name.trim(), (position || '').trim());

  return render({ created: { email: email.toLowerCase(), password: pw } });
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
      `SELECT e.user_id, e.course_id, e.status, e.best_score
         FROM enrollments e JOIN users u ON u.id = e.user_id
        WHERE u.company_id = ?`
    )
    .all(cid);
  const map = {};
  for (const m of matrix) map[m.user_id + ':' + m.course_id] = m;
  res.render('admin/assignments', { title: 'Priskyrimai', employees, courses, map });
});

router.post('/priskyrimai', (req, res) => {
  const cid = req.user.company_id;
  const userId = Number(req.body.user_id);
  const courseId = Number(req.body.course_id);
  const user = db.prepare('SELECT id FROM users WHERE id = ? AND company_id = ?').get(userId, cid);
  const course = db.prepare('SELECT id FROM courses WHERE id = ? AND company_id = ?').get(courseId, cid);
  if (user && course) ensureEnrollment(userId, courseId);
  res.redirect('/admin/priskyrimai');
});

// Assign a course to all employees at once
router.post('/priskyrimai/visiems', (req, res) => {
  const cid = req.user.company_id;
  const courseId = Number(req.body.course_id);
  const course = db.prepare('SELECT id FROM courses WHERE id = ? AND company_id = ?').get(courseId, cid);
  if (course) {
    const employees = db
      .prepare("SELECT id FROM users WHERE company_id = ? AND role='employee'")
      .all(cid);
    const tx = db.transaction((list) => {
      for (const emp of list) ensureEnrollment(emp.id, courseId);
    });
    tx(employees);
  }
  res.redirect('/admin/priskyrimai');
});

module.exports = router;
