'use strict';

// Seeds a demo company, an admin, employees and sample safety courses.
// Usage:
//   node scripts/seed.js          -> add demo data if the DB is empty
//   node scripts/seed.js --reset  -> wipe all data first, then seed

const bcrypt = require('bcryptjs');
const db = require('../src/db');

function wipe() {
  db.exec(`
    DELETE FROM certificates;
    DELETE FROM enrollments;
    DELETE FROM questions;
    DELETE FROM courses;
    DELETE FROM users;
    DELETE FROM companies;
    DELETE FROM sqlite_sequence;
    DELETE FROM sessions;
  `);
}

// Returns false (and changes nothing) when data already exists and reset is not requested.
function seed({ reset = false } = {}) {
  if (reset) wipe();
  if (db.prepare('SELECT COUNT(*) n FROM companies').get().n > 0) return false;

  const hash = (p) => bcrypt.hashSync(p, 10);

  const company = db
    .prepare('INSERT INTO companies (name, code) VALUES (?, ?)')
    .run('UAB „Pavyzdys"', 'pavyzdys-demo');
  const companyId = company.lastInsertRowid;

  // Admin
  db.prepare(
    "INSERT INTO users (company_id, email, password_hash, full_name, position, role) VALUES (?,?,?,?,?,'admin')"
  ).run(companyId, 'admin@pavyzdys.lt', hash('admin123'), 'Admina Administratorė', 'DSS specialistė');

  // Employees
  const employees = [
    ['jonas@pavyzdys.lt', 'Jonas Jonaitis', 'Sandėlininkas'],
    ['ruta@pavyzdys.lt', 'Rūta Rūtaitė', 'Operatorė'],
    ['petras@pavyzdys.lt', 'Petras Petraitis', 'Vairuotojas'],
  ];
  const empIds = employees.map(([email, name, pos]) =>
    db
      .prepare(
        "INSERT INTO users (company_id, email, password_hash, full_name, position, role) VALUES (?,?,?,?,?,'employee')"
      )
      .run(companyId, email, hash('demo1234'), name, pos).lastInsertRowid
  );

  // --- Courses (original sample content) ---
  function addCourse(c) {
    const info = db
      .prepare(
        `INSERT INTO courses (company_id, title, category, summary, content, pass_score, valid_months)
         VALUES (@cid, @title, @category, @summary, @content, @pass, @valid)`
      )
      // Template literals below are indented with the code; strip that from the stored text.
      .run({ cid: companyId, ...c, content: c.content.replace(/^[ \t]+/gm, '') });
    const courseId = info.lastInsertRowid;
    c.questions.forEach((q, i) => {
      db.prepare(
        'INSERT INTO questions (course_id, text, options_json, correct_index, sort_order) VALUES (?,?,?,?,?)'
      ).run(courseId, q.text, JSON.stringify(q.options), q.correct, i + 1);
    });
    return courseId;
  }

  const c1 = addCourse({
    title: 'Įvadinis darbuotojų saugos ir sveikatos instruktavimas',
    category: 'Privaloma',
    summary: 'Bendri saugos reikalavimai, pradedant dirbti įmonėje.',
    pass: 80,
    valid: 12,
    content: `## Tikslas
  Šis instruktavimas supažindina su pagrindinėmis darbuotojų saugos ir sveikatos (DSS) taisyklėmis, kurių privalo laikytis kiekvienas darbuotojas.

  ## Pagrindinės darbuotojo pareigos
  - Laikytis saugos instrukcijų ir darbo tvarkos taisyklių.
  - Naudoti išduotas asmenines apsaugos priemones (AAP).
  - Nedelsiant pranešti vadovui apie pastebėtus pavojus ar įvykusius incidentus.
  - Nedirbti su įranga, kurios naudoti nemokoma arba kuri sugedusi.

  ## Darbo vietos tvarka
  Tvarkinga darbo vieta mažina nelaimingų atsitikimų riziką. Praėjimai turi būti laisvi, išsiliejusios medžiagos – nedelsiant pašalintos.

  ## Veiksmai avarijos atveju
  - Išlikite ramūs ir informuokite aplinkinius.
  - Žinokite artimiausią evakuacijos išėjimą ir susirinkimo vietą.
  - Skubios pagalbos telefonas Lietuvoje – **112**.`,
    questions: [
      {
        text: 'Ką darbuotojas privalo daryti pastebėjęs pavojų darbo vietoje?',
        options: ['Nieko, tai ne jo reikalas', 'Nedelsiant pranešti vadovui', 'Palaukti savaitę', 'Pašalinti pavojų savarankiškai bet kokiomis priemonėmis'],
        correct: 1,
      },
      {
        text: 'Koks bendrasis pagalbos telefono numeris Lietuvoje?',
        options: ['101', '112', '911', '08'],
        correct: 1,
      },
      {
        text: 'Ar galima dirbti su sugedusia įranga?',
        options: ['Taip, jei skubu', 'Taip, jei niekas nemato', 'Ne, apie gedimą reikia pranešti', 'Tik naktinėje pamainoje'],
        correct: 2,
      },
      {
        text: 'Kodėl svarbi tvarkinga darbo vieta?',
        options: ['Dėl gražesnio vaizdo', 'Ji mažina nelaimingų atsitikimų riziką', 'Tai neturi reikšmės', 'Kad patiktų klientams'],
        correct: 1,
      },
      {
        text: 'Kas yra AAP?',
        options: ['Asmeninės apsaugos priemonės', 'Automatinė apsaugos programa', 'Administracinis aktų protokolas', 'Avarinės pagalbos punktas'],
        correct: 0,
      },
    ],
  });

  const c2 = addCourse({
    title: 'Priešgaisrinė sauga darbo vietoje',
    category: 'Sauga',
    summary: 'Gaisro prevencija, gesintuvai ir evakuacija.',
    pass: 80,
    valid: 12,
    content: `## Gaisro prevencija
  Dauguma gaisrų kyla dėl neatsargumo. Laikykitės šių taisyklių:
  - Nerūkykite tam neskirtose vietose.
  - Neperkraukite elektros lizdų.
  - Degias medžiagas laikykite tik tam skirtose vietose.

  ## Gesintuvo naudojimas
  Prisiminkite principą **PATL**:
  - **P** – patraukite apsauginį kaištį.
  - **A** – atsukite antgalį į liepsnos pagrindą.
  - **T** – truktelėkite rankeną.
  - **L** – liekite šluojančiais judesiais.

  ## Evakuacija
  - Išgirdę signalą, nedelsdami palikite patalpas nurodytais keliais.
  - Nesinaudokite liftu.
  - Susirinkite paskirtoje saugioje vietoje ir laukite nurodymų.`,
    questions: [
      {
        text: 'Kokia dažniausia gaisrų priežastis?',
        options: ['Žaibas', 'Žmonių neatsargumas', 'Drėgmė', 'Per žema temperatūra'],
        correct: 1,
      },
      {
        text: 'Į kurią liepsnos vietą reikia nukreipti gesintuvą?',
        options: ['Į liepsnos viršų', 'Į dūmus', 'Į liepsnos pagrindą', 'Į lubas'],
        correct: 2,
      },
      {
        text: 'Ar galima evakuuojantis naudotis liftu?',
        options: ['Taip, tai greičiau', 'Ne, liftu naudotis negalima', 'Tik iki 3 aukšto', 'Taip, jei nėra dūmų'],
        correct: 1,
      },
      {
        text: 'Ką reiškia raidė „P" principe PATL?',
        options: ['Pašaukite pagalbą', 'Patraukite apsauginį kaištį', 'Palaukite', 'Pabėkite'],
        correct: 1,
      },
    ],
  });

  const c3 = addCourse({
    title: 'Saugus krovinių kėlimas ir nešimas',
    category: 'Ergonomika',
    summary: 'Teisinga kėlimo technika ir nugaros apsauga.',
    pass: 75,
    valid: 24,
    content: `## Kodėl tai svarbu
  Netaisyklingas sunkių daiktų kėlimas – viena dažniausių nugaros traumų priežasčių.

  ## Taisyklingo kėlimo technika
  - Prieikite arti krovinio, kojas pastatykite pečių plotyje.
  - Lenkitės per kelius, ne per juosmenį.
  - Laikykite nugarą tiesią, krovinį – arti kūno.
  - Kelkite kojų raumenimis, tolygiai.
  - Nesisukite su kroviniu rankose – pasukite visą kūną kojomis.

  ## Kai krovinys per sunkus
  - Paprašykite kolegos pagalbos.
  - Naudokite pagalbines priemones (vežimėlį, keltuvą).
  - Skaidykite krovinį į mažesnes dalis, jei įmanoma.`,
    questions: [
      {
        text: 'Kaip reikia lenktis keliant krovinį?',
        options: ['Per juosmenį', 'Per kelius, laikant nugarą tiesią', 'Visai nesilenkti', 'Pasilenkus į šoną'],
        correct: 1,
      },
      {
        text: 'Ką daryti, jei krovinys per sunkus pakelti vienam?',
        options: ['Vis tiek kelti greitai', 'Paprašyti pagalbos arba naudoti priemones', 'Palikti ir nueiti', 'Mesti krovinį'],
        correct: 1,
      },
      {
        text: 'Kaip teisingai pasukti su kroviniu rankose?',
        options: ['Sukant tik liemenį', 'Pasukant visą kūną kojomis', 'Greitai pasukant nugarą', 'Negalima niekada suktis'],
        correct: 1,
      },
    ],
  });

  // Assign all courses to all employees; make one certificate for realism
  const { ensureEnrollment, getEnrollment, gradeAttempt } = require('../src/domain');
  for (const uid of empIds) {
    ensureEnrollment(uid, c1);
    ensureEnrollment(uid, c2);
    ensureEnrollment(uid, c3);
  }

  // Let the first employee pass course 1 (builds a certificate + activity)
  const course1 = db.prepare('SELECT * FROM courses WHERE id = ?').get(c1);
  const q1 = db.prepare('SELECT id, correct_index FROM questions WHERE course_id = ?').all(c1);
  const answers = {};
  for (const q of q1) answers['q_' + q.id] = q.correct_index;
  gradeAttempt(getEnrollment(empIds[0], c1), course1, answers);
  return true;
}

module.exports = { seed, wipe };

if (require.main === module) {
  const reset = process.argv.includes('--reset');
  if (!seed({ reset })) {
    console.log('Duomenų bazėje jau yra įrašų. Naudokite --reset, jei norite perkurti.');
    process.exit(0);
  }
  if (reset) console.log('• Duomenys išvalyti.');
  console.log('✓ Pavyzdiniai duomenys sukurti.');
  console.log('');
  console.log('  Administratorius:  admin@pavyzdys.lt / admin123');
  console.log('  Darbuotojas:       jonas@pavyzdys.lt / demo1234');
  console.log('  Įmonės kodas:      pavyzdys-demo');
  console.log('');
}
