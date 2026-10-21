'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { ensureEnrollment, markRead, gradeAttempt } = require('../domain');

function getCourseForUser(user, courseId) {
  return db
    .prepare(
      'SELECT * FROM courses WHERE id = ? AND company_id = ? AND is_published = 1'
    )
    .get(courseId, user.company_id);
}

// View a course (instruction text)
router.get('/kursas/:id', requireAuth, (req, res) => {
  const course = getCourseForUser(req.user, req.params.id);
  if (!course) return res.status(404).render('error', { title: 'Nerasta', message: 'Kursas nerastas.' });

  const enrollment = ensureEnrollment(req.user.id, course.id);
  const questionCount = db
    .prepare('SELECT COUNT(*) AS n FROM questions WHERE course_id = ?')
    .get(course.id).n;

  res.render('course', { title: course.title, course, enrollment, questionCount });
});

// Mark instruction as read
router.post('/kursas/:id/perskaityta', requireAuth, (req, res) => {
  const course = getCourseForUser(req.user, req.params.id);
  if (!course) return res.redirect('/aplinka');
  markRead(req.user.id, course.id);
  res.redirect('/kursas/' + course.id + '/testas');
});

// Take the test
router.get('/kursas/:id/testas', requireAuth, (req, res) => {
  const course = getCourseForUser(req.user, req.params.id);
  if (!course) return res.status(404).render('error', { title: 'Nerasta', message: 'Kursas nerastas.' });

  const questions = db
    .prepare('SELECT id, text, options_json FROM questions WHERE course_id = ? ORDER BY sort_order, id')
    .all(course.id)
    .map((q) => ({ id: q.id, text: q.text, options: JSON.parse(q.options_json) }));

  if (questions.length === 0) {
    return res.render('error', {
      title: 'Testo nėra',
      message: 'Šis kursas dar neturi testo klausimų. Kreipkitės į administratorių.',
    });
  }

  res.render('test', { title: 'Testas: ' + course.title, course, questions });
});

// Submit the test
router.post('/kursas/:id/testas', requireAuth, (req, res) => {
  const course = getCourseForUser(req.user, req.params.id);
  if (!course) return res.redirect('/aplinka');

  const result = gradeAttempt(req.user, course, req.body);
  if (result.error) {
    return res.render('error', { title: 'Klaida', message: result.error });
  }

  let cert = null;
  if (result.passed) {
    cert = db
      .prepare(
        `SELECT cert.code, cert.expires_at FROM certificates cert
           JOIN enrollments e ON e.id = cert.enrollment_id
          WHERE e.user_id = ? AND e.course_id = ?`
      )
      .get(req.user.id, course.id);
  }

  res.render('result', { title: 'Testo rezultatas', course, result, cert });
});

module.exports = router;
