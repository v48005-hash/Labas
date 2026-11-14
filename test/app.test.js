'use strict';

// End-to-end tests: boots the real app against a throwaway SQLite file.
const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'saugos-pilotas-'));
process.env.SP_DB_PATH = path.join(tmp, 'test.db');
process.env.SP_DISABLE_RATE_LIMIT = '1';

const db = require('../src/db');
const { seed } = require('../scripts/seed');
const app = require('../src/server');

let server;
let base;

test.before(async () => {
  seed({ reset: true });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = 'http://127.0.0.1:' + server.address().port;
});

test.after(() => {
  server.close();
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

// Minimal browser: keeps cookies, never follows redirects, fills in the CSRF token.
function client() {
  const jar = new Map();
  async function request(method, url, form) {
    const headers = {};
    if (jar.size) headers.cookie = [...jar].map(([k, v]) => k + '=' + v).join('; ');
    let body;
    if (form) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(form).toString();
    }
    const res = await fetch(base + url, { method, headers, body, redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      const value = pair.slice(i + 1);
      if (value) jar.set(pair.slice(0, i), value);
      else jar.delete(pair.slice(0, i));
    }
    return { status: res.status, location: res.headers.get('location'), text: await res.text() };
  }
  const get = (url) => request('GET', url);
  async function token(page) {
    const m = (await get(page)).text.match(/name="_csrf" value="([0-9a-f]+)"/);
    assert.ok(m, 'CSRF laukas nerastas puslapyje ' + page);
    return m[1];
  }
  // POST with a token read from `page` (any page of the same session that renders a form).
  async function post(url, form = {}, page = '/prisijungti') {
    return request('POST', url, { _csrf: await token(page), ...form });
  }
  async function login(email, password) {
    const res = await post('/prisijungti', { email, password });
    assert.equal(res.status, 302, 'prisijungimas turi nukreipti');
    return res;
  }
  return { get, post, login, raw: request };
}

const correctAnswers = (courseId) =>
  Object.fromEntries(
    db
      .prepare('SELECT id, correct_index FROM questions WHERE course_id = ?')
      .all(courseId)
      .map((q) => ['q_' + q.id, String(q.correct_index)])
  );
const wrongAnswers = (courseId) =>
  Object.fromEntries(
    Object.entries(correctAnswers(courseId)).map(([k, v]) => [k, v === '0' ? '1' : '0'])
  );
const userId = (email) => db.prepare('SELECT id FROM users WHERE email = ?').get(email).id;
const enrollment = (email, courseId) =>
  db
    .prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
    .get(userId(email), courseId);

test('vieši puslapiai atsidaro ir turi saugos antraštes', async () => {
  const c = client();
  for (const url of ['/', '/prisijungti', '/registruotis', '/tikrinti', '/static/css/styles.css']) {
    assert.equal((await c.get(url)).status, 200, url);
  }
  assert.equal((await c.get('/nera-tokio')).status, 404);
  const res = await fetch(base + '/');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('neprisijungęs nukreipiamas į prisijungimą', async () => {
  const c = client();
  for (const url of ['/aplinka', '/pazymejimai', '/profilis', '/kursas/1', '/admin', '/admin/kursai']) {
    const res = await c.get(url);
    assert.equal(res.status, 302, url);
    assert.equal(res.location, '/prisijungti', url);
  }
});

test('POST be CSRF žetono atmetamas', async () => {
  const c = client();
  const res = await c.raw('POST', '/prisijungti', { email: 'admin@pavyzdys.lt', password: 'admin123' });
  assert.equal(res.status, 403);
  const bad = await c.raw('POST', '/prisijungti', { _csrf: 'x', email: 'a@b.lt', password: 'x' });
  assert.equal(bad.status, 403);
});

test('neteisingas slaptažodis neprileidžia', async () => {
  const c = client();
  const res = await c.post('/prisijungti', { email: 'jonas@pavyzdys.lt', password: 'blogas' });
  assert.equal(res.status, 401);
  assert.equal((await c.get('/aplinka')).status, 302);
});

test('prisijungus sesijos ID pakeičiamas', async () => {
  const first = await fetch(base + '/prisijungti');
  const sidBefore = first.headers.getSetCookie()[0].split(';')[0];
  const m = (await first.text()).match(/name="_csrf" value="([0-9a-f]+)"/);
  const res = await fetch(base + '/prisijungti', {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie: sidBefore, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ _csrf: m[1], email: 'jonas@pavyzdys.lt', password: 'demo1234' }),
  });
  assert.equal(res.status, 302);
  const sidAfter = res.headers.getSetCookie()[0].split(';')[0];
  assert.notEqual(sidAfter, sidBefore);
});

test('darbuotojas: instrukcija → testas → pažymėjimas → viešas tikrinimas', async () => {
  const c = client();
  await c.login('ruta@pavyzdys.lt', 'demo1234');

  const dash = await c.get('/aplinka');
  assert.equal(dash.status, 200);
  assert.match(dash.text, /Priešgaisrinė sauga/);

  // Testas neatsidaro, kol nepatvirtinta „susipažinau".
  const early = await c.get('/kursas/2/testas');
  assert.equal(early.status, 302);
  assert.equal(early.location, '/kursas/2');

  const read = await c.post('/kursas/2/perskaityta', {}, '/kursas/2');
  assert.equal(read.location, '/kursas/2/testas');
  assert.equal(enrollment('ruta@pavyzdys.lt', 2).status, 'in_progress');

  // Neišlaikytas bandymas.
  const fail = await c.post('/kursas/2/testas', wrongAnswers(2), '/kursas/2/testas');
  assert.match(fail.text, /Testas neišlaikytas/);
  assert.equal(enrollment('ruta@pavyzdys.lt', 2).status, 'failed');

  // Išlaikytas bandymas → pažymėjimas.
  const pass = await c.post('/kursas/2/testas', correctAnswers(2), '/kursas/2/testas');
  assert.match(pass.text, /Testas išlaikytas/);
  const code = pass.text.match(/SP-[0-9A-F]{10}/)[0];
  const en = enrollment('ruta@pavyzdys.lt', 2);
  assert.equal(en.status, 'passed');
  assert.equal(en.attempts, 2);
  assert.equal(en.best_score, 100);

  assert.match((await c.get('/pazymejimai')).text, new RegExp(code));
  const anon = client();
  assert.match((await anon.get('/tikrinti?kodas=' + code.toLowerCase())).text, /Galiojantis pažymėjimas/);
  assert.match((await anon.get('/tikrinti?kodas=SP-NERA')).text, /Pažymėjimas nerastas/);

  // Pakartotinis neišlaikymas nepanaikina galiojančio išlaikymo ir nekuria naujo pažymėjimo.
  await c.post('/kursas/2/testas', wrongAnswers(2), '/kursas/2/testas');
  assert.equal(enrollment('ruta@pavyzdys.lt', 2).status, 'passed');
  await c.post('/kursas/2/testas', correctAnswers(2), '/kursas/2/testas');
  const certs = db
    .prepare('SELECT COUNT(*) n FROM certificates WHERE enrollment_id = ?')
    .get(en.id).n;
  assert.equal(certs, 1);
});

test('pasibaigus galiojimui kursą reikia perlaikyti ir išduodamas naujas pažymėjimas', async () => {
  const c = client();
  await c.login('jonas@pavyzdys.lt', 'demo1234');
  const en = enrollment('jonas@pavyzdys.lt', 1);
  assert.equal(en.status, 'passed');
  db.prepare("UPDATE enrollments SET expires_at = '2020-01-01T00:00:00.000Z' WHERE id = ?").run(en.id);
  db.prepare("UPDATE certificates SET expires_at = '2020-01-01T00:00:00.000Z' WHERE enrollment_id = ?").run(en.id);

  assert.match((await c.get('/aplinka')).text, /Baigėsi galiojimas/);
  const pass = await c.post('/kursas/1/testas', correctAnswers(1), '/kursas/1/testas');
  assert.match(pass.text, /Išduotas pažymėjimas/);
  const after = enrollment('jonas@pavyzdys.lt', 1);
  assert.ok(new Date(after.expires_at) > new Date());
  assert.equal(db.prepare('SELECT COUNT(*) n FROM certificates WHERE enrollment_id = ?').get(en.id).n, 2);
});

test('darbuotojas nemato nepriskirto kurso ir administravimo', async () => {
  const admin = client();
  await admin.login('admin@pavyzdys.lt', 'admin123');
  const created = await admin.post(
    '/admin/kursai',
    { title: 'Nepriskirtas kursas', content: '## Tekstas', pass_score: '70', valid_months: '6', is_published: 'on' },
    '/admin/kursai/naujas'
  );
  assert.equal(created.status, 302);
  const id = created.location.split('/').pop();

  const c = client();
  await c.login('petras@pavyzdys.lt', 'demo1234');
  assert.equal((await c.get('/kursas/' + id)).status, 403);
  assert.doesNotMatch((await c.get('/aplinka')).text, /Nepriskirtas kursas/);
  assert.equal((await c.get('/admin')).status, 403);
  assert.equal((await c.post('/admin/kursai', { title: 'X', content: 'Y' }, '/aplinka')).status, 403);
});

test('administratorius: klausimai, darbuotojai, priskyrimai', async () => {
  const admin = client();
  await admin.login('admin@pavyzdys.lt', 'admin123');
  for (const url of ['/admin', '/admin/kursai', '/admin/kursai/naujas', '/admin/kursai/1', '/admin/darbuotojai', '/admin/priskyrimai', '/profilis']) {
    assert.equal((await admin.get(url)).status, 200, url);
  }

  const course = await admin.post(
    '/admin/kursai',
    { title: 'Darbas aukštyje', content: 'Tekstas', pass_score: '500', valid_months: '0' },
    '/admin/kursai/naujas'
  );
  const id = Number(course.location.split('/').pop());
  const row = db.prepare('SELECT * FROM courses WHERE id = ?').get(id);
  assert.equal(row.pass_score, 100);
  assert.equal(row.valid_months, 1);
  assert.equal(row.is_published, 0);

  // Teisingas atsakymas pažymėtas 3-ioje eilutėje, 1-oji tuščia → indeksas turi pasislinkti.
  await admin.post(
    `/admin/kursai/${id}/klausimas`,
    { text: 'Klausimas?', opt0: '', opt1: 'Ne', opt2: 'Taip', opt3: '', correct_index: '2' },
    `/admin/kursai/${id}`
  );
  const q = db.prepare('SELECT * FROM questions WHERE course_id = ?').get(id);
  assert.deepEqual(JSON.parse(q.options_json), ['Ne', 'Taip']);
  assert.equal(q.correct_index, 1);

  // Tuščias „teisingas" variantas atmetamas.
  await admin.post(
    `/admin/kursai/${id}/klausimas`,
    { text: 'Kitas?', opt0: 'A', opt1: 'B', opt2: '', opt3: '', correct_index: '3' },
    `/admin/kursai/${id}`
  );
  assert.equal(db.prepare('SELECT COUNT(*) n FROM questions WHERE course_id = ?').get(id).n, 1);

  // Naujas darbuotojas su sugeneruotu slaptažodžiu gali prisijungti.
  const added = await admin.post(
    '/admin/darbuotojai',
    { full_name: 'Ona Onaitė', email: ' Ona@Pavyzdys.LT ', position: 'Valytoja' },
    '/admin/darbuotojai'
  );
  const pw = added.text.match(/ona@pavyzdys\.lt<\/strong> \/ <strong>([^<]+)</)[1];
  const ona = client();
  await ona.login('ona@pavyzdys.lt', pw);

  // Priskyrimas ir atšaukimas.
  const uid = userId('ona@pavyzdys.lt');
  await admin.post('/admin/priskyrimai', { user_id: uid, course_id: 3 }, '/admin/priskyrimai');
  assert.ok(enrollment('ona@pavyzdys.lt', 3));
  await admin.post('/admin/priskyrimai/salinti', { user_id: uid, course_id: 3 }, '/admin/priskyrimai');
  assert.equal(enrollment('ona@pavyzdys.lt', 3), undefined);
  await admin.post('/admin/priskyrimai/visiems', { course_id: 3 }, '/admin/priskyrimai');
  assert.ok(enrollment('ona@pavyzdys.lt', 3));

  // Priskyrimo su pažymėjimu atšaukti negalima.
  await admin.post('/admin/priskyrimai/salinti', { user_id: userId('ruta@pavyzdys.lt'), course_id: 2 }, '/admin/priskyrimai');
  assert.ok(enrollment('ruta@pavyzdys.lt', 2));
});

test('įmonės atskirtos: kitos įmonės administratorius nemato svetimų duomenų', async () => {
  const other = client();
  const reg = await other.post(
    '/registruotis',
    { full_name: 'Kita Vadovė', email: 'vadove@kita.lt', password: 'slaptas12', password2: 'slaptas12', company_name: 'UAB Kita' },
    '/registruotis'
  );
  assert.equal(reg.location, '/admin');
  assert.equal((await other.get('/admin/kursai/1')).status, 302);
  assert.doesNotMatch((await other.get('/admin/darbuotojai')).text, /Jonas Jonaitis/);
  await other.post('/admin/priskyrimai', { user_id: userId('jonas@pavyzdys.lt'), course_id: 3 }, '/admin');
  await other.post('/admin/klausimas/1/trinti', {}, '/admin');
  assert.ok(db.prepare('SELECT 1 FROM questions WHERE id = 1').get());
  const before = db.prepare('SELECT title FROM courses WHERE id = 1').get().title;
  await other.post('/admin/kursai', { id: '1', title: 'Nulaužta', content: 'x' }, '/admin');
  assert.equal(db.prepare('SELECT title FROM courses WHERE id = 1').get().title, before);
});

test('registracija: klaidos ir prisijungimas pagal įmonės kodą', async () => {
  const c = client();
  const base_ = { full_name: 'Naujas Žmogus', email: 'naujas@pavyzdys.lt', password: 'slaptas12', password2: 'slaptas12' };
  assert.equal((await c.post('/registruotis', { ...base_ }, '/registruotis')).status, 400);
  assert.equal((await c.post('/registruotis', { ...base_, join_code: 'nera-tokio' }, '/registruotis')).status, 400);
  assert.equal((await c.post('/registruotis', { ...base_, password: 'trumpas', password2: 'trumpas', join_code: 'pavyzdys-demo' }, '/registruotis')).status, 400);
  assert.equal((await c.post('/registruotis', { ...base_, email: 'jonas@pavyzdys.lt', join_code: 'pavyzdys-demo' }, '/registruotis')).status, 400);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM users WHERE email = 'naujas@pavyzdys.lt'").get().n, 0);

  const ok = await c.post('/registruotis', { ...base_, join_code: 'PAVYZDYS-demo' }, '/registruotis');
  assert.equal(ok.location, '/aplinka');
  const row = db.prepare("SELECT role FROM users WHERE email = 'naujas@pavyzdys.lt'").get();
  assert.equal(row.role, 'employee');
  assert.match((await c.get('/aplinka')).text, /nepriskirtas nė vienas kursas/);
});

test('slaptažodžio keitimas ir atsijungimas', async () => {
  const c = client();
  await c.login('petras@pavyzdys.lt', 'demo1234');
  const bad = await c.post('/profilis/slaptazodis', { current: 'blogas', password: 'naujas1234', password2: 'naujas1234' }, '/profilis');
  assert.equal(bad.status, 400);
  const ok = await c.post('/profilis/slaptazodis', { current: 'demo1234', password: 'naujas1234', password2: 'naujas1234' }, '/profilis');
  assert.equal(ok.location, '/profilis');

  await c.post('/atsijungti', {}, '/profilis');
  assert.equal((await c.get('/aplinka')).status, 302);
  const again = client();
  assert.equal((await again.post('/prisijungti', { email: 'petras@pavyzdys.lt', password: 'demo1234' })).status, 401);
  await again.login('petras@pavyzdys.lt', 'naujas1234');
});

test('kiekviena POST forma turi tvarkingą žymą ir CSRF lauką', async () => {
  const admin = client();
  await admin.login('admin@pavyzdys.lt', 'admin123');
  const emp = client();
  await emp.login('ruta@pavyzdys.lt', 'demo1234');
  const pages = [
    [client(), ['/prisijungti', '/registruotis']],
    [admin, ['/admin/kursai/1', '/admin/kursai/naujas', '/admin/darbuotojai', '/admin/priskyrimai', '/profilis']],
    [emp, ['/aplinka', '/kursas/1', '/kursas/2/testas']],
  ];
  for (const [c, urls] of pages) {
    for (const url of urls) {
      const { status, text } = await c.get(url);
      assert.equal(status, 200, url);
      const forms = text.match(/<form method="post"/g) || [];
      const good = text.match(/<form method="post" action="[^"<>]+"[^<>]*><input type="hidden" name="_csrf" value="[0-9a-f]+">/g) || [];
      assert.ok(forms.length > 0, url + ': nėra formų');
      assert.equal(good.length, forms.length, url + ': sugadinta formos žyma');
    }
  }
});

test('instrukcijos tekstas atvaizduojamas saugiai', () => {
  const { renderText } = require('../src/util');
  const html = renderText('## Antraštė\n\n- vienas\n- **du**\n\n<script>alert(1)</script>');
  assert.match(html, /<h3>Antraštė<\/h3>/);
  assert.match(html, /<li><strong>du<\/strong><\/li>/);
  assert.doesNotMatch(html, /<script>/);
});
