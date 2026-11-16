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

## 🎮 Žaidimas „DSS patikra“

3D pirmojo asmens žaidimas naršyklėje: žaidėjas – DSS specialistas, tikrinantis statomą daugiabutį.
Reikia apeiti objektą, apžiūrėti įtartinas vietas ir kiekvienai parinkti teisingą vertinimą
(ne viskas, kas atrodo įtartinai, yra pažeidimas). Pabaigoje surašomas patikrinimo aktas su paaiškinimais.

| Lygis | Objektas | Temos |
|---|---|---|
| 1 | Pamatų duobė ir iškasos | aptvarai, tilteliai, iškasų sienos, technikos zona |
| 2 | Monolitinis karkasas, 4 aukštas | perdangos kraštai, angos, kranas, armatūra |
| 3 | Fasadas ir pastoliai | turėklai, paklotai, atramos, mobilus bokštelis, vėjas |
| 4 | Vidaus apdaila | elektra (IP44), kvarco dulkės, evakuacija, dujų balionai |
| 5 | Plokščio stogo darbai | stogo kraštai, stoglangiai, ugnies darbai, ledas |
| 6 | Seno daugiabučio renovacija (Kaunas) | asbestas, gyventojai statybvietėje, triukšmas |

- Adresas: `/zaidimas` (arba tiesiog atidarykite `public/zaidimas/` per bet kurį statinį serverį,
  pvz. `npx serve public/zaidimas` – žaidimui serverio logikos nereikia).
- Vienas failas dalijimuisi: `dss-patikra.html` (žaidimas, three.js ir stiliai viename faile) – nusiųskite kolegoms,
  jie atsidaro dukart spustelėję, be serverio ir interneto. Perkurti: `npm i -D esbuild && node scripts/build-zaidimas.js`.
- Valdymas: `W A S D` – judėti, pelė – dairytis, `E` – tikrinti, `Z` – priartinti, `F` – žibintuvėlis,
  `Tab` – užrašai, `Enter` – baigti patikrą. Telefone – jutiklinė svirtis ir mygtukai.
- Grafika: three.js (įdėta į `public/zaidimas/vendor`), visos tekstūros procedūrinės, be išorinių failų.
- Turinys: `public/zaidimas/js/levels.js`. Skaitinės ribos (1,3 m, 1 m aptvaras su 0,15 m papėde,
  75°, IP44, 8 m/s, 85 dB(A) ir kt.) – iš DSS žinyno; teisės aktų numeriai žaidime necituojami.
  Tai mokomoji priemonė, ne teisinė konsultacija.

## Technologijos

- **Node.js + Express** (serveris, maršrutai)
- **EJS** (serverio pusės šablonai)
- **better-sqlite3** (vietinė SQLite duomenų bazė)
- **express-session + bcryptjs** (sesijos ir slaptažodžių maiša)
- Platformos front-end'e jokių išorinių priklausomybių — grynas HTML/CSS (žaidimas naudoja three.js)

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
public/zaidimas/     # 3D žaidimas „DSS patikra“ (index.html, js/, vendor/three)
scripts/seed.js      # pavyzdiniai duomenys
```

## Aplinkos kintamieji

| Kintamasis       | Numatyta                        | Paskirtis                    |
|------------------|---------------------------------|------------------------------|
| `PORT`           | `3000`                          | Serverio prievadas           |
| `SESSION_SECRET` | dev reikšmė                     | Sesijos pasirašymo raktas    |
| `SP_DB_PATH`     | `data/saugos-pilotas.db`        | SQLite failo kelias          |

> Produkcijoje būtinai nustatykite stiprų `SESSION_SECRET` ir naudokite HTTPS.
