'use strict';

const path = require('path');
const express = require('express');
const session = require('express-session');

const { loadUser } = require('./middleware/auth');
const { renderText, formatDate } = require('./util');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Static assets
app.use('/static', express.static(path.join(__dirname, '..', 'public')));

// Body parsing
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'saugos-pilotas-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 },
  })
);

app.use(loadUser);

// Make a few globals available to all views
app.use((req, res, next) => {
  res.locals.appName = 'Saugos pilotas';
  res.locals.year = new Date().getFullYear();
  res.locals.path = req.path;
  res.locals.renderText = renderText;
  res.locals.formatDate = formatDate;
  next();
});

// Routes
app.use('/', require('./routes/pages'));
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/courses'));
app.use('/admin', require('./routes/admin'));

// 404
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Puslapis nerastas',
    message: 'Tokio puslapio nėra. Patikrinkite adresą arba grįžkite į pradžią.',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    title: 'Sistemos klaida',
    message: 'Įvyko netikėta klaida. Bandykite dar kartą vėliau.',
  });
});

app.listen(PORT, () => {
  console.log(`Saugos pilotas veikia: http://localhost:${PORT}`);
});

module.exports = app;
