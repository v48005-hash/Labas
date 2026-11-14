'use strict';

const db = require('../db');

// Attach current user (if any) to req/res for every request.
function loadUser(req, res, next) {
  res.locals.currentUser = null;
  res.locals.currentCompany = null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;

  const uid = req.session.userId;
  if (uid) {
    const user = db
      .prepare('SELECT id, company_id, email, full_name, position, role FROM users WHERE id = ?')
      .get(uid);
    if (user) {
      req.user = user;
      res.locals.currentUser = user;
      if (user.company_id) {
        res.locals.currentCompany = db
          .prepare('SELECT id, name, code FROM companies WHERE id = ?')
          .get(user.company_id);
      }
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    req.session.flash = { type: 'error', text: 'Prisijunkite, kad tęstumėte.' };
    return res.redirect('/prisijungti');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.redirect('/prisijungti');
  if (req.user.role !== 'admin') {
    return res.status(403).render('error', {
      title: 'Prieiga uždrausta',
      message: 'Šis puslapis skirtas tik administratoriams.',
    });
  }
  next();
}

function flash(req, type, text) {
  req.session.flash = { type, text };
}

module.exports = { loadUser, requireAuth, requireAdmin, flash };
