'use strict';

const crypto = require('crypto');
const session = require('express-session');

// ---- Session store backed by the app's SQLite database ----
// Keeps logins across restarts and avoids express-session's leaky MemoryStore.
// The `sessions` table is created in db.js.
class SqliteStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    this.cleanup();
    this.timer = setInterval(() => this.cleanup(), 15 * 60 * 1000);
    this.timer.unref();
  }

  expiryOf(sess) {
    const exp = sess && sess.cookie && sess.cookie.expires;
    return exp ? new Date(exp).getTime() : Date.now() + 8 * 60 * 60 * 1000;
  }

  cleanup() {
    this.db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
  }

  get(sid, cb) {
    try {
      const row = this.db
        .prepare('SELECT sess FROM sessions WHERE sid = ? AND expires >= ?')
        .get(sid, Date.now());
      cb(null, row ? JSON.parse(row.sess) : null);
    } catch (err) {
      cb(err);
    }
  }

  set(sid, sess, cb) {
    try {
      this.db
        .prepare(
          `INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?)
           ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires`
        )
        .run(sid, JSON.stringify(sess), this.expiryOf(sess));
      if (cb) cb(null);
    } catch (err) {
      if (cb) cb(err);
    }
  }

  touch(sid, sess, cb) {
    try {
      this.db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?').run(this.expiryOf(sess), sid);
      if (cb) cb(null);
    } catch (err) {
      if (cb) cb(err);
    }
  }

  destroy(sid, cb) {
    try {
      this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      if (cb) cb(null);
    } catch (err) {
      if (cb) cb(err);
    }
  }
}

// ---- Basic security headers (the app serves no scripts of its own) ----
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'none'; frame-ancestors 'none'; form-action 'self'"
  );
  next();
}

// ---- Form fields must be plain strings (blocks ?a[]=1 style surprises) ----
function stringBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      const v = req.body[key];
      if (typeof v !== 'string') req.body[key] = Array.isArray(v) ? String(v[0] ?? '') : String(v ?? '');
    }
  }
  next();
}

// ---- CSRF: per-session token required on every POST ----
function csrf(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  const token = req.session.csrf;
  res.locals.csrfToken = token;
  res.locals.csrfField = '<input type="hidden" name="_csrf" value="' + token + '">';

  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

  const sent = String((req.body && req.body._csrf) || '');
  const ok =
    sent.length === token.length && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(token));
  if (!ok) {
    return res.status(403).render('error', {
      title: 'Užklausa atmesta',
      message: 'Pasibaigė formos galiojimas. Grįžkite atgal, perkraukite puslapį ir bandykite dar kartą.',
    });
  }
  next();
}

// ---- Small in-memory rate limiter (per IP + bucket) ----
function rateLimit({ name, max, windowMs, message }) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, rec] of hits) if (rec.reset < now) hits.delete(key);
  }, windowMs);
  timer.unref();

  return function limiter(req, res, next) {
    if (process.env.SP_DISABLE_RATE_LIMIT === '1') return next();
    const key = name + ':' + req.ip;
    const now = Date.now();
    let rec = hits.get(key);
    if (!rec || rec.reset < now) {
      rec = { count: 0, reset: now + windowMs };
      hits.set(key, rec);
    }
    rec.count++;
    if (rec.count > max) {
      res.setHeader('Retry-After', Math.ceil((rec.reset - now) / 1000));
      return res.status(429).render('error', { title: 'Per daug bandymų', message });
    }
    next();
  };
}

module.exports = { SqliteStore, securityHeaders, stringBody, csrf, rateLimit };
