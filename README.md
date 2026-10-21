# 🛡️ Saugos pilotas

Darbuotojų saugos ir sveikatos (DSS) **e. mokymų ir instruktavimo platforma** įmonėms.
Priskirkite darbuotojams saugos instrukcijas, patikrinkite žinias testais ir išduokite
pažymėjimus su galiojimo terminu — viskas vienoje vietoje.

Tai savarankiškas, originalus produktas (ne susijęs su jokia kita paslauga).

## Funkcionalumas

**Darbuotojui**
- Asmeninė aplinka su priskirtais kursais ir jų būsena
- Saugos instrukcijų skaitymas ir patvirtinimas „susipažinau"
- Automatiškai vertinami žinių testai su pakartojimais
- Pažymėjimai su unikaliu kodu ir galiojimo terminu

**Administratoriui (įmonei)**
- Kursų kūrimas ir redagavimas (instrukcijos tekstas + testo klausimai)
- Darbuotojų valdymas (pridėjimas, prisijungimo kodas savarankiškai registracijai)
- Kursų priskyrimas pavieniui arba visiems vienu mygtuku
- Stebėsenos skydelis: išlaikymai, laukiantys, paskutinė veikla

**Vieša**
- Pažymėjimo tikrinimas pagal kodą (`/tikrinti`)

## Technologijos

- **Node.js + Express** (serveris, maršrutai)
- **EJS** (serverio pusės šablonai)
- **better-sqlite3** (vietinė SQLite duomenų bazė)
- **express-session + bcryptjs** (sesijos ir slaptažodžių maiša)
- Jokių išorinių priklausomybių front-end'e — grynas HTML/CSS

## Paleidimas

```bash
npm install          # priklausomybės
npm run seed         # (nebūtina) įkelti pavyzdinius duomenis
npm start            # paleisti http://localhost:3000
```

Kūrimo režimas su automatiniu perkrovimu: `npm run dev`.
Perkurti pavyzdinius duomenis nuo nulio: `npm run reset`.

## Pavyzdiniai prisijungimai (po `npm run seed`)

| Rolė           | El. paštas            | Slaptažodis |
|----------------|-----------------------|-------------|
| Administratorius | `admin@pavyzdys.lt` | `admin123`  |
| Darbuotojas      | `jonas@pavyzdys.lt` | `demo123`   |

Įmonės prisijungimo kodas (savarankiškai registracijai): `pavyzdys-demo`

## Projekto struktūra

```
src/
  server.js          # Express aplikacija ir maršrutų prijungimas
  db.js              # SQLite schema ir migracija
  domain.js          # dalyko logika (priskyrimai, testų vertinimas, pažymėjimai)
  util.js            # instrukcijų teksto atvaizdavimas, datų formatas
  middleware/auth.js # sesijos, prieigos apsauga
  routes/            # pages, auth, courses, admin
views/               # EJS šablonai (+ partials, admin)
public/css/          # stiliai
scripts/seed.js      # pavyzdiniai duomenys
```

## Aplinkos kintamieji

| Kintamasis       | Numatyta                        | Paskirtis                    |
|------------------|---------------------------------|------------------------------|
| `PORT`           | `3000`                          | Serverio prievadas           |
| `SESSION_SECRET` | dev reikšmė                     | Sesijos pasirašymo raktas    |
| `SP_DB_PATH`     | `data/saugos-pilotas.db`        | SQLite failo kelias          |

> Produkcijoje būtinai nustatykite stiprų `SESSION_SECRET` ir naudokite HTTPS.
