'use strict';

const path = require('path');
const express = require('express');
const session = require('express-session');

const db = require('./db');
const { loadUser } = require('./middleware/auth');
const { renderText, formatDate } = require('./util');
const { SqliteStore, securityHeaders, stringBody, csrf } = require('./security');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

const DEV_SECRET = 'saugos-pilotas-dev-secret-change-me';
const sessionSecret = process.env.SESSION_SECRET || DEV_SECRET;
if (isProd && sessionSecret === DEV_SECRET) {
  throw new Error('Produkcijoje privaloma nustatyti SESSION_SECRET aplinkos kintamąjį.');
}

app.disable('x-powered-by');
// Behind a hosting proxy (Render, Railway, Codespaces...) so req.ip and secure cookies work.
if (isProd) app.set('trust proxy', 1);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(securityHeaders);

// Static assets
app.use('/static', express.static(path.join(__dirname, '..', 'public')));

// Body parsing
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use(stringBody);

// Sessions
app.use(
  session({
    name: 'sp.sid',
    secret: sessionSecret,
    store: new SqliteStore(db),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: 1000 * 60 * 60 * 8 },
  })
);

// Make a few globals available to all views (before csrf, which may render an error page)
app.use((req, res, next) => {
  res.locals.appName = 'Saugos pilotas';
  res.locals.year = new Date().getFullYear();
  res.locals.path = req.path;
  res.locals.renderText = renderText;
  res.locals.formatDate = formatDate;
  next();
});

app.use(loadUser);
app.use(csrf);

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
  if (res.headersSent) return next(err);
  res.status(500).render('error', {
    title: 'Sistemos klaida',
    message: 'Įvyko netikėta klaida. Bandykite dar kartą vėliau.',
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Saugos pilotas veikia: http://localhost:${PORT}`);
  });
}

module.exports = app;
