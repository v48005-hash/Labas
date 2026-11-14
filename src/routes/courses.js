'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getEnrollment, effectiveStatus, markRead, gradeAttempt } = require('../domain');

// Resolve the course and the user's assignment; renders an error and returns null if missing.
function loadAssigned(req, res) {
  const course = db
    .prepare('SELECT * FROM courses WHERE id = ? AND company_id = ? AND is_published = 1')
    .get(req.params.id, req.user.company_id);
  if (!course) {
    res.status(404).render('error', { title: 'Nerasta', message: 'Kursas nerastas.' });
    return null;
  }
  const enrollment = getEnrollment(req.user.id, course.id);
  if (!enrollment) {
    res.status(403).render('error', {
      title: 'Kursas nepriskirtas',
      message: 'Šis kursas jums nepriskirtas. Kreipkitės į įmonės administratorių.',
    });
    return null;
  }
  return { course, enrollment };
}

// View a course (instruction text)
router.get('/kursas/:id', requireAuth, (req, res) => {
  const ctx = loadAssigned(req, res);
  if (!ctx) return;
  const questionCount = db
    .prepare('SELECT COUNT(*) AS n FROM questions WHERE course_id = ?')
    .get(ctx.course.id).n;

  res.render('course', {
    title: ctx.course.title,
    course: ctx.course,
    enrollment: ctx.enrollment,
    status: effectiveStatus(ctx.enrollment),
    questionCount,
  });
});

// Mark instruction as read
router.post('/kursas/:id/perskaityta', requireAuth, (req, res) => {
  const ctx = loadAssigned(req, res);
  if (!ctx) return;
  markRead(ctx.enrollment);
  res.redirect('/kursas/' + ctx.course.id + '/testas');
});

// Take the test
router.get('/kursas/:id/testas', requireAuth, (req, res) => {
  const ctx = loadAssigned(req, res);
  if (!ctx) return;
  // The instruction must be confirmed as read before the test opens.
  if (!ctx.enrollment.read_done) return res.redirect('/kursas/' + ctx.course.id);

  const questions = db
    .prepare('SELECT id, text, options_json FROM questions WHERE course_id = ? ORDER BY sort_order, id')
    .all(ctx.course.id)
    .map((q) => ({ id: q.id, text: q.text, options: JSON.parse(q.options_json) }));

  if (questions.length === 0) {
    return res.render('error', {
      title: 'Testo nėra',
      message: 'Šis kursas dar neturi testo klausimų. Kreipkitės į administratorių.',
    });
  }

  res.render('test', { title: 'Testas: ' + ctx.course.title, course: ctx.course, questions });
});

// Submit the test
router.post('/kursas/:id/testas', requireAuth, (req, res) => {
  const ctx = loadAssigned(req, res);
  if (!ctx) return;
  if (!ctx.enrollment.read_done) return res.redirect('/kursas/' + ctx.course.id);

  const result = gradeAttempt(ctx.enrollment, ctx.course, req.body);
  if (result.error) {
    return res.render('error', { title: 'Klaida', message: result.error });
  }
  res.render('result', { title: 'Testo rezultatas', course: ctx.course, result });
});

module.exports = router;
