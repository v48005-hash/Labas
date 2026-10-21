'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { userDashboard } = require('../domain');

// Landing
router.get('/', (req, res) => {
  if (req.user) return res.redirect('/aplinka');
  res.render('landing', { title: 'Darbuotojų saugos e. mokymai' });
});

// Employee dashboard
router.get('/aplinka', requireAuth, (req, res) => {
  if (req.user.role === 'admin') return res.redirect('/admin');
  const { rows, stats } = userDashboard(req.user);
  res.render('dashboard', { title: 'Mano mokymai', rows, stats });
});

// My certificates
router.get('/pazymejimai', requireAuth, (req, res) => {
  const certs = db
    .prepare(
      `SELECT cert.code, cert.issued_at, cert.expires_at, c.title, c.category
         FROM certificates cert
         JOIN enrollments e ON e.id = cert.enrollment_id
         JOIN courses c ON c.id = e.course_id
        WHERE e.user_id = ?
        ORDER BY cert.issued_at DESC`
    )
    .all(req.user.id);
  res.render('certificates', { title: 'Mano pažymėjimai', certs });
});

// Public certificate verification
router.get('/tikrinti', (req, res) => {
  const code = (req.query.kodas || '').trim();
  let result = null;
  if (code) {
    result = db
      .prepare(
        `SELECT cert.code, cert.issued_at, cert.expires_at,
                c.title, u.full_name, co.name AS company
           FROM certificates cert
           JOIN enrollments e ON e.id = cert.enrollment_id
           JOIN courses c ON c.id = e.course_id
           JOIN users u ON u.id = e.user_id
           LEFT JOIN companies co ON co.id = u.company_id
          WHERE cert.code = ?`
      )
      .get(code);
  }
  res.render('verify', { title: 'Pažymėjimo tikrinimas', code, result });
});

module.exports = router;
