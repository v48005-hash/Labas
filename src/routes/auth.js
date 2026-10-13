'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { flash } = require('../middleware/auth');

function slugCode(name) {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);
  return (base || 'imone') + '-' + Math.random().toString(36).slice(2, 6);
}

// ---- Register ----
router.get('/registruotis', (req, res) => {
  if (req.user) return res.redirect('/aplinka');
  res.render('register', { title: 'Registracija', form: {}, error: null });
});

router.post('/registruotis', (req, res) => {
  const { company_name, full_name, email, position, password, password2, join_code } = req.body;
  const form = { company_name, full_name, email, position, join_code };

  const err = (msg) => res.render('register', { title: 'Registracija', form, error: msg });

  if (!full_name || !email || !password) return err('Užpildykite privalomus laukus.');
  if (password.length < 6) return err('Slaptažodis turi būti bent 6 simbolių.');
  if (password !== password2) return err('Slaptažodžiai nesutampa.');

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return err('Vartotojas su tokiu el. paštu jau egzistuoja.');

  let companyId;
  let role = 'employee';

  if (join_code && join_code.trim()) {
    const company = db.prepare('SELECT id FROM companies WHERE code = ?').get(join_code.trim());
    if (!company) return err('Įmonės kodas neteisingas.');
    companyId = company.id;
  } else if (company_name && company_name.trim()) {
    // Creating a new company => first user becomes admin
    const code = slugCode(company_name.trim());
    const info = db
      .prepare('INSERT INTO companies (name, code) VALUES (?, ?)')
      .run(company_name.trim(), code);
    companyId = info.lastInsertRowid;
    role = 'admin';
  } else {
    return err('Nurodykite įmonės pavadinimą (naujai įmonei) arba prisijungimo kodą.');
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      'INSERT INTO users (company_id, email, password_hash, full_name, position, role) VALUES (?,?,?,?,?,?)'
    )
    .run(companyId, email.toLowerCase(), hash, full_name.trim(), (position || '').trim(), role);

  req.session.userId = info.lastInsertRowid;
  flash(req, 'success', role === 'admin'
    ? 'Įmonė sukurta. Jūs esate administratorius.'
    : 'Registracija sėkminga. Sveiki atvykę!');
  res.redirect(role === 'admin' ? '/admin' : '/aplinka');
});

// ---- Login ----
router.get('/prisijungti', (req, res) => {
  if (req.user) return res.redirect('/aplinka');
  res.render('login', { title: 'Prisijungimas', error: null, email: '' });
});

router.post('/prisijungti', (req, res) => {
  const { email, password } = req.body;
  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get((email || '').toLowerCase());
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.render('login', {
      title: 'Prisijungimas',
      error: 'Neteisingas el. paštas arba slaptažodis.',
      email: email || '',
    });
  }
  req.session.userId = user.id;
  res.redirect(user.role === 'admin' ? '/admin' : '/aplinka');
});

// ---- Logout ----
router.post('/atsijungti', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
