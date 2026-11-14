'use strict';

const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { flash, requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../security');

const MIN_PASSWORD = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const authLimiter = rateLimit({
  name: 'auth',
  max: 20,
  windowMs: 15 * 60 * 1000,
  message: 'Per daug bandymų. Palaukite keliolika minučių ir bandykite dar kartą.',
});

function slugCode(name) {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);
  for (;;) {
    const code = (base || 'imone') + '-' + crypto.randomBytes(3).toString('hex');
    if (!db.prepare('SELECT 1 FROM companies WHERE code = ?').get(code)) return code;
  }
}

// Start a fresh session for the user (prevents session fixation).
function signIn(req, userId, done) {
  const pendingFlash = req.session.flash;
  req.session.regenerate((err) => {
    if (err) return done(err);
    req.session.userId = userId;
    if (pendingFlash) req.session.flash = pendingFlash;
    req.session.save(done);
  });
}

function home(user) {
  return user.role === 'admin' ? '/admin' : '/aplinka';
}

// ---- Register ----
router.get('/registruotis', (req, res) => {
  if (req.user) return res.redirect(home(req.user));
  res.render('register', { title: 'Registracija', form: {}, error: null });
});

router.post('/registruotis', authLimiter, (req, res, next) => {
  const full_name = (req.body.full_name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const position = (req.body.position || '').trim();
  const company_name = (req.body.company_name || '').trim();
  const join_code = (req.body.join_code || '').trim().toLowerCase();
  const { password = '', password2 = '' } = req.body;
  const form = { company_name, full_name, email, position, join_code };

  const err = (msg) =>
    res.status(400).render('register', { title: 'Registracija', form, error: msg });

  if (!full_name || !email || !password) return err('Užpildykite privalomus laukus.');
  if (!EMAIL_RE.test(email)) return err('Neteisingas el. pašto adresas.');
  if (password.length < MIN_PASSWORD) return err(`Slaptažodis turi būti bent ${MIN_PASSWORD} simbolių.`);
  if (password !== password2) return err('Slaptažodžiai nesutampa.');
  if (company_name && join_code) {
    return err('Užpildykite tik vieną: įmonės pavadinimą (naujai įmonei) arba prisijungimo kodą.');
  }
  if (!company_name && !join_code) {
    return err('Nurodykite įmonės pavadinimą (naujai įmonei) arba prisijungimo kodą.');
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return err('Vartotojas su tokiu el. paštu jau egzistuoja.');
  }

  let company = null;
  if (join_code) {
    company = db.prepare('SELECT id FROM companies WHERE code = ?').get(join_code);
    if (!company) return err('Įmonės kodas neteisingas.');
  }

  const role = company ? 'employee' : 'admin';
  const hash = bcrypt.hashSync(password, 10);

  // Company + first user are created together or not at all.
  const userId = db.transaction(() => {
    const companyId = company
      ? company.id
      : db
          .prepare('INSERT INTO companies (name, code) VALUES (?, ?)')
          .run(company_name, slugCode(company_name)).lastInsertRowid;
    return db
      .prepare(
        'INSERT INTO users (company_id, email, password_hash, full_name, position, role) VALUES (?,?,?,?,?,?)'
      )
      .run(companyId, email, hash, full_name, position, role).lastInsertRowid;
  })();

  flash(
    req,
    'success',
    role === 'admin'
      ? 'Įmonė sukurta. Jūs esate administratorius.'
      : 'Registracija sėkminga. Sveiki atvykę!'
  );
  signIn(req, userId, (e) => (e ? next(e) : res.redirect(home({ role }))));
});

// ---- Login ----
router.get('/prisijungti', (req, res) => {
  if (req.user) return res.redirect(home(req.user));
  res.render('login', { title: 'Prisijungimas', error: null, email: '' });
});

router.post('/prisijungti', authLimiter, (req, res, next) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(req.body.password || '', user.password_hash)) {
    return res.status(401).render('login', {
      title: 'Prisijungimas',
      error: 'Neteisingas el. paštas arba slaptažodis.',
      email,
    });
  }
  signIn(req, user.id, (e) => (e ? next(e) : res.redirect(home(user))));
});

// ---- Logout ----
router.post('/atsijungti', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sp.sid');
    res.redirect('/');
  });
});

// ---- Profile / password change ----
router.get('/profilis', requireAuth, (req, res) => {
  res.render('profile', { title: 'Mano profilis', error: null });
});

router.post('/profilis/slaptazodis', requireAuth, authLimiter, (req, res) => {
  const { current = '', password = '', password2 = '' } = req.body;
  const err = (msg) => res.status(400).render('profile', { title: 'Mano profilis', error: msg });

  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current, row.password_hash)) return err('Dabartinis slaptažodis neteisingas.');
  if (password.length < MIN_PASSWORD) return err(`Naujas slaptažodis turi būti bent ${MIN_PASSWORD} simbolių.`);
  if (password !== password2) return err('Nauji slaptažodžiai nesutampa.');

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    bcrypt.hashSync(password, 10),
    req.user.id
  );
  flash(req, 'success', 'Slaptažodis pakeistas.');
  res.redirect('/profilis');
});

module.exports = router;
