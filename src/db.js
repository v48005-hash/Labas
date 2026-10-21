'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.SP_DB_PATH || path.join(DATA_DIR, 'saugos-pilotas.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      code       TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id    INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name     TEXT NOT NULL,
      position      TEXT,
      role          TEXT NOT NULL DEFAULT 'employee', -- employee | admin
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS courses (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id   INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      title        TEXT NOT NULL,
      category     TEXT NOT NULL DEFAULT 'Bendra',
      summary      TEXT,
      content      TEXT NOT NULL,            -- instruktažo tekstas (markdown-lite)
      pass_score   INTEGER NOT NULL DEFAULT 80, -- proc.
      valid_months INTEGER NOT NULL DEFAULT 12, -- galiojimo laikas
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS questions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id     INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      text          TEXT NOT NULL,
      options_json  TEXT NOT NULL,           -- JSON masyvas atsakymų
      correct_index INTEGER NOT NULL,
      sort_order    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id    INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      status       TEXT NOT NULL DEFAULT 'assigned', -- assigned | in_progress | passed | failed
      best_score   INTEGER,
      attempts     INTEGER NOT NULL DEFAULT 0,
      read_done    INTEGER NOT NULL DEFAULT 0,
      assigned_at  TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      expires_at   TEXT,
      UNIQUE (user_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
      code          TEXT UNIQUE NOT NULL,
      issued_at     TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at    TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
    CREATE INDEX IF NOT EXISTS idx_courses_company ON courses(company_id);
    CREATE INDEX IF NOT EXISTS idx_enroll_user ON enrollments(user_id);
    CREATE INDEX IF NOT EXISTS idx_enroll_course ON enrollments(course_id);
    CREATE INDEX IF NOT EXISTS idx_questions_course ON questions(course_id);
  `);
}

migrate();

module.exports = db;
