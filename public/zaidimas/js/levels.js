// Lygiai: šešios statybvietės / statybos etapai. Kiekvienas lygis – scena + tikrintinos vietos.
// Skaitinės ribos (1,3 m; 1 m aptvaras su 0,15 m papėde; 1 m tiltelis; 75°; IP44; 8 m/s; 85 dB(A) ir kt.)
// paimtos iš DSS įgūdžio žinyno „ribos-ir-dazniausios-klaidos“. Teisės aktų numeriai sąmoningai necituojami.
import * as THREE from 'three';

const PI = Math.PI;

function dust(c, x, y, z, n = 140, spread = 1.2, color = 0xd8d2c4) {
  const g = new THREE.BufferGeometry(), a = new Float32Array(n * 3), s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = Math.random();
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.1, transparent: true, opacity: 0.28, depthWrite: false }));
  p.position.set(x, y, z); p.frustumCulled = false; c.scene.add(p);
  c.anim(t => {
    for (let i = 0; i < n; i++) {
      const k = (t * 0.25 + s[i]) % 1, ang = s[i] * 40 + t * 0.3;
      a[i * 3] = Math.cos(ang) * k * spread; a[i * 3 + 1] = k * 1.8 + Math.sin(i) * 0.2; a[i * 3 + 2] = Math.sin(ang) * k * spread;
    }
    g.attributes.position.needsUpdate = true;
  });
}
function fire(c, x, y, z, s = 1) {
  const fl = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.14 * s, 0.6 * s, 7), c.M.fire);
    m.position.set(x + (i % 2 - 0.5) * 0.14 * s, y + 0.3 * s, z + ((i >> 1) - 0.5) * 0.14 * s); c.scene.add(m); fl.push(m);
  }
  const l = c.lamp(x, y + 0.5, z, 6 * s, 7, 0xff8830);
  c.anim(t => { fl.forEach((m, i) => { m.scale.y = 0.75 + Math.sin(t * 13 + i * 2.1) * 0.3; m.rotation.y = t * 3 + i; }); l.intensity = 6 * s + Math.sin(t * 17) * 2; });
}
function falling(c, mesh, x, yTop, z, H, period = 2.4, phase = 0) {
  c.scene.add(mesh);
  c.anim(t => { const k = ((t + phase) % period) / period, f = Math.min(1, k * 2.2); mesh.position.set(x, yTop - f * f * H, z); mesh.rotation.set(t * 3, t * 2, 0); mesh.visible = f < 1; });
}
// Aplinka aplink statybvietę: tvora, vagonėliai
function perimeter(c, x0, z0, x1, z1, gaps = {}) {
  const { P } = c, seg = (a, b, x, z, ry) => { if (b - a > 0.5) c.add(P.fence(b - a), x, 0, z, ry); };
  const cut = (a, b, g) => g ? [[a, g[0]], [g[1], b]] : [[a, b]];
  cut(x0, x1, gaps.n).forEach(([a, b]) => seg(a, b, a, z0, 0));
  cut(x0, x1, gaps.s).forEach(([a, b]) => seg(a, b, a, z1, 0));
  seg(z0, z1, x0, z1, PI / 2); seg(z0, z1, x1, z1, PI / 2);
}
const W = (o = {}) => o; // tik skaitomumui

export const LEVELS = [
/* ================= 1. PAMATAI IR IŠKASOS ================= */
{
  id: 'pamatai', title: 'Pamatų duobė ir iškasos', site: 'Daugiabutis „Šilo terasos“, Vilnius', short: 'Žemės darbai, pamatų plokštė, inžinerinių tinklų tranšėja.',
  brief: 'Statybos pradžia: iškasta 3,2 m gylio pamatų duobė, betonuojama pamatų plokštė, šalia klojami inžineriniai tinklai. Rangovas prašo neplaninės DSS patikros prieš atvežant bokštinį kraną.',
  weather: 'Giedra, +14 °C, vėjas 3 m/s. Gruntas po nakties lietaus drėgnas.', weatherShort: '+14 °C · vėjas 3 m/s',
  time: 480, floorY: 0, bounds: [-28.6, -22.6, 28.6, 22.6], spawn: [-20, 19.5, 0], center: [0, -1], sun: [38, 140], range: 12, menuR: 36, menuH: 12, menuLook: 0, landHole: [-33, -27, 33, 27],
  build(c) {
    const { M, P } = c, B = P.B;
    c.add(P.slabWithHoles(-34, -28, 34, 28, [[-12, -9, 12, 7], [16, -16, 18, 16]], M.dirt, 0, 0.3));
    // duobė
    c.add(B(24.6, 3.4, 0.3, M.dirtDark, 0, -3.4, -9.15)); c.add(B(24.6, 3.4, 0.3, M.dirtDark, 0, -3.4, 7.15));
    c.add(B(0.3, 3.4, 16.6, M.dirtDark, -12.15, -3.4, -1)); c.add(B(0.3, 3.4, 16.6, M.dirtDark, 12.15, -3.4, -1));
    c.add(B(24, 0.2, 16, M.gravel, 0, -3.4, -1)); c.add(B(14, 0.35, 9, M.concreteNew, 4, -3.2, -3));
    c.add(B(14.2, 0.4, 0.05, M.formwork, 4, -3.2, 1.55)); c.add(B(0.05, 0.4, 9, M.formwork, -3.05, -3.2, -3));
    for (let i = 0; i < 12; i++) c.add(P.T([-11.5, -3.14, -8 + i * 1.1], [-3.3, -3.14, -8 + i * 1.1], 0.012, M.rust, 5));
    for (let i = 0; i < 10; i++) c.add(P.T([-11.3 + i * 0.85, -3.12, -8.4], [-11.3 + i * 0.85, -3.12, 4], 0.012, M.rust, 5));
    c.wall(-12.3, -9.3, 12.3, 7.3);
    // tranšėja
    c.add(B(0.2, 2.2, 32, M.dirtDark, 15.9, -2.2, 0)); c.add(B(0.2, 2.2, 32, M.dirtDark, 18.1, -2.2, 0)); c.add(B(2, 0.2, 32, M.gravel, 17, -2.4, 0));
    c.add(P.T([17.3, -1.95, -16], [17.3, -1.95, 16], 0.16, M.orange, 12));
    c.wall(15.7, -16.3, 18.3, -6); c.wall(15.7, -4.6, 18.3, 16.3);
    // tilteliai
    c.add(B(3.4, 0.08, 1.4, M.wood, 17, 0, -5.3)); c.add(P.guardrail(3.4), 15.3, 0.08, -6); c.add(P.guardrail(3.4), 15.3, 0.08, -4.64);
    const plank = B(3.2, 0.05, 0.3, M.woodOld, 17, 0, 6); plank.rotation.y = 0.06; c.add(plank);
    // duobės aptvarai (pietų, vakarų, rytų pusės); šiaurėje – tik juosta
    c.add(P.guardrail(25), -12.5, 0, 7.5); c.add(P.guardrail(17), -12.5, 0, 7.5, PI / 2); c.add(P.guardrail(17), 12.5, 0, 7.5, PI / 2);
    for (let x = -12; x <= 12; x += 6) c.add(P.T([x, 0, -9.6], [x, 1, -9.6], 0.015, M.rust, 6));
    const tape = B(24, 0.07, 0.004, M.tape, 0, 0.82, -9.6); tape.castShadow = false; c.add(tape);
    // kopėčios į duobę (tvarkingos)
    c.add(P.leanLadder(4.6, 72), -9, -3.2, 5.58, PI);
    c.add(P.rebar(6, 2, 0.25, 1.0, false), -6.6, -3.2, 5.6);
    c.add(P.rebar(12, 1, 0.3, 1.0, true), 3, -2.85, 1.2);
    // žmonės
    c.add(P.worker({ helmet: null, pose: 'kneel', vest: true }), -5, -3.2, 2.5, 2.2);
    c.add(P.worker({ helmet: 0xf2c200, pose: 'work' }), 4.5, -2.85, -1.5, -0.6);
    c.add(P.worker({ helmet: 0xffffff, pose: 'stand' }), 7, -2.85, -4, 1.2);
    c.add(P.worker({ helmet: 0x2f6fd0, vestMat: M.hivisOrange }), -16, 0, 16.5, 2.6);
    c.add(P.worker({ helmet: 0xf2c200, pose: 'kneel' }), 17, -2.2, 9, PI / 2);
    // gruntas ir medžiagos prie tranšėjos krašto
    c.solid(P.heap(2.3, 1.7, M.dirt, 4), 14.2, 0, 12.6); c.solid(P.stack(1.1, 1.1, 0.8, M.block), 15.0, 0, 15.6, 0.3);
    c.solid(P.heap(4.5, 2.6, M.dirt, 9), -22, 0, -4); c.solid(P.heap(3, 1.8, M.dirtDark, 2), -21, 0, 3);
    // ekskavatorius
    const ex = c.add(P.excavator(), -2, 0, -16.5, -PI / 2); c.wall(-4.2, -18.3, 0.2, -14.7);
    c.anim(t => { ex.userData.upper.rotation.y = Math.sin(t * 0.35) * 0.9; });
    c.add(P.worker({ helmet: 0xf2c200, pose: 'work' }), -6.2, 0, -19.6, 0.4);
    c.solid(P.heap(2.4, 1.5, M.dirt, 6), -10, 0, -18);
    // tvora, vartai, buitinės patalpos
    perimeter(c, -29, -23, 29, 23, { n: [4, 7.6], s: [-22, -18] });
    const fallen = B(3.4, 0.03, 1.9, M.mesh, 5.8, 0.05, -21.8); fallen.rotation.z = 0.05; c.add(fallen);
    c.add(P.fence(2), -22, 0, 23, 1.2); c.add(P.fence(2), -18, 0, 23, PI - 1.2);
    c.add(P.board([{ t: 'UAB „STATYBOS RITMAS“', size: 38 }, { t: 'Daugiabutis gyv. namas', size: 30, bold: false }, { t: 'Statybos vadovas · DSS koordinatorius', size: 24, bold: false }, { t: 'Pagalbos tel. 112', size: 34, color: '#c8201c' }], 1.6, 1.0), -16.6, 1.5, 22.9, PI);
    c.add(P.sign('P080', 'Pašaliniams draudžiama', 0.5), -15.4, 1.5, 22.9, PI); c.add(P.sign('M014', 'Būtinas šalmas', 0.5), -14.8, 1.5, 22.9, PI); c.add(P.sign('M015', 'Ryški apranga', 0.5), -14.2, 1.5, 22.9, PI);
    c.solid(P.cabin(M.cabin), 24, 0, -15, -PI / 2); c.solid(P.cabin(M.cabinBlue), 24, 0, -8.5, -PI / 2); c.solid(P.toilet(), 25.5, 0, -2, -PI / 2);
    const cr = c.add(P.towerCrane(34, 30), 24, 0, 17); cr.userData.top.rotation.y = 2.2; c.wall(22, 15, 26, 19);
    c.solid(P.stack(1.1, 0.9, 0.8, M.wood), -8, 0, 13); c.solid(P.stack(1.1, 0.6, 0.8, M.formwork), -6, 0, 13.4, 0.2);
    c.add(P.puddle(3, 1.8), -12, 0, 16); c.add(P.puddle(1.6, 2.4), 8, 0, 14);
    for (let i = 0; i < 5; i++) c.add(P.tree(5 + (i % 3)), -32 + i * 14, 0, -29 - (i % 2) * 3);

    c.item('Pamatų duobės šiaurinis kraštas', [0, 0.6, -9.5], [24, 1.3, 0.7], {
      h: 3, code: 'W008', see: '3,2 m gylio duobės kraštas pažymėtas tik signaline juosta ant armatūros strypų. Kitos trys pusės aptvertos.',
      ok: 'Kritimo į gylį pavojus: kraštas neaptvertas, signalinė juosta nėra aptvaras',
      bad: ['Signalinė juosta per žemai – ji turi kabėti 1,5 m aukštyje', 'Trūksta tik ženklo „Pašaliniams draudžiama“ – juostos pakanka'],
      why: 'Kai galima nukristi iš 1,3 m ar didesnio aukščio (ar į tokį gylį), darbo vieta turi būti aptverta: aptvaras ne žemesnis kaip 1 m, su porankiu, viduriniu ilginiu ir 0,15 m papėdės lenta. Juosta tik įspėja – žmogaus ji nesulaiko.' });
    c.item('Lenta per tranšėją', [17, 0.3, 6], [3.2, 0.8, 1.2], {
      h: 2, code: 'W008', see: 'Per 2,2 m gylio tranšėją permesta viena ~0,3 m pločio lenta be turėklų. Purvini pėdsakai rodo, kad ja vaikštoma.',
      ok: 'Netinkamas perėjimas: tiltelis turi būti ne siauresnis kaip 1 m ir su aptvarais',
      bad: ['Lenta per plona – užtektų ją pakeisti 50 mm storio lenta', 'Perėjimui per tranšėją reikalingi tik apraišai, turėklai nebūtini'],
      why: 'Perėjimo tilteliai per iškasas turi būti ne siauresni kaip 1 m ir aptverti iš abiejų pusių. Viena lenta – tipinė kritimo į iškasą priežastis.' });
    c.item('Grunto sankasa prie tranšėjos', [14.4, 0.9, 13.4], [3.6, 1.9, 5.6], {
      h: 2, code: 'W035', see: 'Iškastas gruntas ir blokelių paletė sukrauti prie pat tranšėjos krašto. Tranšėjoje dirbama.',
      ok: 'Gruntas ir medžiagos sukrauti ant iškasos krašto – šlaito griūties ir daiktų kritimo pavojus',
      bad: ['Grunto krūva per aukšta – ji negali viršyti 1,2 m', 'Grunto krūva turi būti uždengta plėvele nuo dulkėjimo'],
      why: 'Papildoma apkrova ant iškasos krašto didina šlaito nuošliaužos tikimybę, o riedantys grumstai ir medžiagos krenta ant žemiau dirbančių žmonių. Gruntas ir medžiagos sandėliuojami už griūties prizmės ribų – atstumą nustato darbų technologijos projektas.' });
    c.item('Darbuotojas tranšėjoje', [17, -1.2, 9], [1.8, 2.1, 2.2], {
      h: 3, code: 'W008', see: 'Tranšėjos gylis 2,2 m, sienos vertikalios, nesutvirtintos; gruntas šlapias. Arti nėra kopėčių išlipti.',
      ok: 'Dirbama nesutvirtintoje iškasoje vertikaliomis sienomis, nėra saugaus išlipimo',
      bad: ['Darbuotojas tranšėjoje privalo dirbti su apraišais', 'Tranšėjoje trūksta tik laikino apšvietimo'],
      why: 'Grunto griūtis – viena dažniausių mirtinų nelaimių žemės darbuose. Iškasos sienos turi būti sutvirtintos arba suformuoti šlaitai pagal gruntą ir gylį (nustato projektas), o žmonėms įrengtas saugus įlipimas ir išlipimas.' });
    c.item('Darbuotojas prie ekskavatoriaus', [-6.2, 0.9, -19.6], [1.1, 1.9, 1.1], {
      h: 3, code: 'W014', see: 'Darbuotojas stovi nugara į dirbantį ekskavatorių, strėlės sukimosi spindulyje. Pavojinga zona nepažymėta, signalininko nėra.',
      ok: 'Žmogus veikiančio ekskavatoriaus pavojingoje zonoje, zona nepažymėta',
      bad: ['Darbuotojas be klausos apsaugos – tai vienintelis trūkumas', 'Ekskavatorius negali dirbti arčiau kaip 20 m nuo bet kurio žmogaus'],
      why: 'Mechanizmo veikimo (strėlės sukimosi) zonoje žmonių neturi būti. Zona pažymima ir aptveriama, o jei žmogus privalo dirbti greta – darbus koordinuoja signalininkas, mašinistas turi jį matyti.' });
    c.item('Armatūrininkas duobėje', [-5, -2.6, 2.7], [1.3, 1.6, 1.6], {
      h: 2, code: 'M014', see: 'Darbuotojas riša armatūrą duobės dugne be šalmo. Virš jo – duobės kraštas, kur juda žmonės ir technika.',
      ok: 'Dirba be apsauginio šalmo zonoje, kur gali kristi daiktai',
      bad: ['Dirba be apraišų', 'Dirba be respiratoriaus'],
      why: 'Statybvietėje privalomas apsauginis šalmas su smakro dirželiu, ryškiaspalvė apranga ir avalynė, atspari pado pradūrimui bei daiktų užkritimui – nebent rizikos vertinimas konkrečiam darbui nustato kitaip.' });
    c.item('Armatūros išleidimai prie kopėčių', [-6.6, -2.6, 5.6], [1.9, 1.4, 1], {
      h: 2, code: 'W022', see: 'Vertikalūs armatūros strypai kyšo ~1 m, galai neuždengti. Visai šalia – kopėčios į duobę.',
      ok: 'Neuždengti armatūros galai – persismeigimo pavojus nukritus ar suklupus',
      bad: ['Armatūra surūdijusi – ją reikia nuvalyti prieš betonuojant', 'Strypai per ilgi – juos reikia nupjauti iki 0,5 m'],
      why: 'Kyšantys armatūros galai uždengiami apsauginiais gaubteliais arba užlenkiami, ypač prie praėjimų, kopėčių ir po aukščiau esančiomis darbo vietomis.' });
    c.item('Išvirtusi tvoros sekcija', [5.8, 1, -22.6], [3.6, 2, 1.4], {
      h: 1, code: 'P080', see: 'Viena tvoros sekcija guli ant žemės. Už tvoros – pėsčiųjų takas.',
      ok: 'Statybvietė neuždara: pro tarpą gali patekti pašaliniai asmenys',
      bad: ['Tvora per žema – ji turi būti ne žemesnė kaip 3 m', 'Tvoroje trūksta tik atšvaitų'],
      why: 'Statybvietė turi būti aptverta ir paženklinta, kad į ją nepatektų pašaliniai (ypač vaikai). Tvoros būklė tikrinama kasdien, o po vėjo – iš karto.' });
    c.item('Kopėčios į duobę', [-9, -1, 6.3], [1, 4.6, 1.5], {
      see: 'Kopėčios pritvirtintos, pastatytos ~72° kampu, viršus iškilęs daugiau kaip 1 m virš duobės krašto.',
      bad: ['Kopėčios per stačios – kampas turi būti ne didesnis kaip 45°', 'Į duobę galima patekti tik laiptais, kopėčios draudžiamos', 'Kopėčių viršus negali kyšoti virš krašto'],
      why: 'Pristatomų kopėčių nuolydis – ne didesnis kaip 75°, viršus turi būti iškilęs ne mažiau kaip 1 m virš užlipimo lygio, kopėčios pritvirtintos. Čia viskas tvarkoje.' });
    c.item('Duobės aptvaras (pietų pusė)', [9, 0.6, 7.5], [5, 1.3, 0.4], {
      see: 'Aptvaras ~1,1 m aukščio: porankis, vidurinis ilginis ir papėdės lenta.',
      bad: ['Aptvaras per žemas – jis turi būti ne žemesnis kaip 1,5 m', 'Aptvaras turi būti ištisinis skydas, o ne iš lentų', 'Papėdės lenta nereikalinga ir trukdo'],
      why: 'Aptvaras ne žemesnis kaip 1 m, su porankiu, viduriniu ilginiu ir 0,15 m papėdės lenta – atitinka.' });
    c.item('Tiltelis per tranšėją', [17, 0.6, -5.3], [3.2, 1.3, 1.7], {
      see: 'Tiltelis ~1,4 m pločio, su aptvarais iš abiejų pusių.',
      bad: ['Tiltelis per siauras – jis turi būti ne siauresnis kaip 2 m', 'Tiltelis turi būti metalinis', 'Trūksta apsauginio tinklo po tilteliu'],
      why: 'Tiltelis ne siauresnis kaip 1 m ir aptvertas – reikalavimas įvykdytas.' });
    c.item('Darbuotojas prie vartų', [-16, 0.9, 16.5], [1, 1.9, 1], {
      see: 'Šalmas, ryškiaspalvė liemenė, darbo avalynė. Stovi saugioje zonoje, reguliuoja transporto įvažiavimą.',
      bad: ['Liemenė turi būti geltona, oranžinė draudžiama', 'Be apraišų statybvietėje būti negalima', 'Trūksta klausos apsaugos priemonių'],
      why: 'Pagrindinės statybvietės AAP – šalmas, ryškiaspalvė apranga, apsauginė avalynė – naudojamos. Papildomų priemonių reikia tik ten, kur tai nustato rizikos vertinimas.' });
  },
},

/* ================= 2. MONOLITINIS KARKASAS ================= */
{
  id: 'karkasas', title: 'Monolitinis karkasas, 4 aukštas', site: 'Daugiabutis „Šilo terasos“, Vilnius', short: 'Perdangos kraštai, angos, kranas, armatūra.',
  brief: 'Karkasas pakilo iki ketvirto aukšto. Ant 9 m aukštyje esančios perdangos montuojami klojiniai ir armatūra, kranas kelia medžiagas. Kritimas iš aukščio čia – pagrindinė rizika.',
  weather: 'Debesuota su pragiedruliais, +11 °C, vėjas 6 m/s.', weatherShort: '+11 °C · vėjas 6 m/s · aukštis 9 m',
  time: 480, floorY: 9, bounds: [-12.15, -6.15, 12.15, 6.15], spawn: [-9, -3.5, -PI / 2], center: [0, 0], sun: [42, 215], range: 10, menuR: 30, menuH: 7, menuLook: 0, cityR: 150,
  build(c) {
    const { M, P } = c, B = P.B, Y = 9;
    c.add(B(80, 0.2, 70, M.dirt, 0, -0.1, 0));
    c.add(P.frame(4, 2, 6, 3, 3, { top: false }), -12, 0, -6);
    c.add(P.slabWithHoles(-12.3, -6.3, 12.3, 6.3, [[3, -1.2, 5, 0.8], [-4.6, 2.2, -3, 3.8]], M.concrete, Y, 0.25));
    // užbetonuota kitos perdangos dalis vakaruose + statramsčiai
    c.add(B(6.6, 0.25, 12.6, M.concrete, -9, Y + 2.75, 0));
    [[-12, -6], [-12, 0], [-12, 6], [-6, -6], [-6, 6]].forEach(([x, z]) => c.solid(B(0.4, 2.75, 0.4, M.concrete), x, Y, z));
    for (let x = -11; x <= -7; x += 2) for (let z = -4.5; z <= 4.5; z += 3) c.add(P.T([x, Y, z], [x, Y + 2.75, z], 0.03, M.red, 8));
    // kolonų klojiniai ir armatūra
    c.solid(B(0.5, 2.6, 0.5, M.formwork), 12, Y, -6); c.solid(B(0.5, 2.6, 0.5, M.formwork), 12, Y, 6); c.solid(B(0.5, 2.6, 0.5, M.formwork), 6, Y, -6);
    c.add(P.rebar(3, 3, 0.14, 1.1, false), 0, Y, 0); c.wall(-0.3, -0.3, 0.3, 0.3);
    c.add(P.rebar(3, 3, 0.14, 1.1, true), 6, Y, 0); c.wall(5.7, -0.3, 6.3, 0.3);
    c.add(P.rebar(3, 3, 0.14, 1.1, true), 0, Y, -6); c.add(P.rebar(3, 3, 0.14, 1.1, true), 0, Y, 6); c.add(P.rebar(3, 3, 0.14, 1.1, true), 6, Y, 6); c.add(P.rebar(3, 3, 0.14, 1.1, true), 12, Y, 0);
    // aptvarai
    c.add(P.guardrail(24.4), -12.2, Y, -6.2);                                  // šiaurė – pilnas
    c.add(P.guardrail(12.4, { mid: false, toe: false }), 12.2, Y, 6.2, PI / 2); // rytai – tik porankis
    c.add(P.guardrail(14.2), -12.2, Y, 6.2); c.add(P.guardrail(4.2), 8, Y, 6.2); // pietuose tarpas x∈[2,8]
    c.add(P.guardrail(12.4), -12.2, Y, 6.2, PI / 2);
    // angos
    c.add(B(2, 3, 0.2, M.concrete, 4, Y - 3.25, -1.3)); c.add(B(2.2, 0.2, 2.2, M.concreteDark, 4, Y - 9, -0.2));
    c.wall(2.9, -1.3, 5.1, 0.9);
    const cover = B(2, 0.04, 2, M.plywood, -3.8, Y, 3); c.add(cover);
    c.add(P.board([{ t: 'ANGA!', size: 120, color: '#c8201c' }, { t: 'NENUIMTI', size: 70 }], 1.2, 0.8, '#f9d500').rotateX(-PI / 2), -3.8, Y + 0.05, 3);
    // kopėčios į viršutinę perdangą (per trumpos)
    c.add(P.leanLadder(3.16, 72), -4.7, Y, 0.6, PI / 2); c.wall(-5.9, 0.3, -4.5, 0.9);
    // medžiagos
    c.solid(P.stack(1.15, 1.45, 0.85, M.block), -8.4, Y, 5.55, 0.04);
    c.solid(P.stack(1.1, 0.9, 0.8, M.block), -2.5, Y, -3); c.solid(P.stack(1.1, 0.5, 0.8, M.plywood), 9, Y, -4.5, 0.4);
    for (let i = 0; i < 9; i++) c.add(P.T([-3 + i * 0.07, Y + 0.03 + (i % 3) * 0.03, -5.2], [3, Y + 0.03 + (i % 3) * 0.03, -5.2 + i * 0.05], 0.012, M.rust, 5));
    // žmonės
    c.add(P.worker({ helmet: 0xf2c200, harness: true, pose: 'kneel' }), 5, Y, 5.4, PI * 0.9);
    c.add(P.cable([[5.2, Y + 0.6, 5.2], [5.6, Y + 0.05, 4.6], [6.1, Y + 0.03, 4.9], [5.8, Y + 0.03, 4.3]], 0.012, M.cableBlack));
    c.add(P.worker({ helmet: 0xf2c200, harness: true, pose: 'work' }), 10.6, Y, 3.6, PI / 2);
    c.add(B(0.12, 1.2, 0.12, M.yellow, 9.3, Y, 3.6)); c.add(P.cable([[10.55, Y + 1.4, 3.6], [10, Y + 0.8, 3.7], [9.36, Y + 1.1, 3.6]], 0.012, M.cableOrange));
    c.add(P.board([{ t: 'INKARAVIMO', size: 70 }, { t: 'TAŠKAS', size: 70 }], 0.34, 0.2, '#f9d500'), 9.3, Y + 0.9, 3.67);
    c.add(P.worker({ helmet: 0xffffff, pose: 'work' }), 8.2, Y, -2.6, 0.5); c.add(P.worker({ helmet: 0xf2c200, pose: 'kneel' }), 9.3, Y, -1.6, -2);
    // kranas su kroviniu virš žmonių
    const cr = c.add(P.towerCrane(26, 36), -22, 0, -18); const ang = Math.atan2(15.5, 30.5); cr.userData.top.rotation.y = -ang;
    cr.userData.trolley.position.x = Math.hypot(30.5, 15.5);
    const load = P.G(P.T([0, 0.9, 0], [0, -13.2, 0], 0.02, M.black, 5), B(2.6, 0.5, 1.2, M.plywood, 0, -14.1, 0), B(2.4, 0.3, 1, M.rust, 0, -13.6, 0));
    cr.userData.trolley.add(load); c.anim(t => { load.rotation.z = Math.sin(t * 0.8) * 0.035; load.rotation.x = Math.sin(t * 0.6) * 0.03; });
    // aplinka apačioje
    perimeter(c, -30, -26, 30, 24); c.add(P.cabin(M.cabin), 20, 0, 14); c.add(P.cabin(M.cabinBlue), 20, 2.75, 14);
    for (let i = 0; i < 6; i++) c.add(P.stack(1.1, 0.8, 0.8, i % 2 ? M.block : M.wood), -24 + i * 2.2, 0, 16);
    for (let i = 0; i < 6; i++) c.add(P.tree(6), -36 + i * 13, 0, 34);

    c.item('Perdangos kraštas (pietų pusė)', [5, Y + 0.6, 6.2], [6, 1.3, 0.5], {
      h: 3, code: 'W008', see: '6 m ilgio perdangos krašto ruožas be jokio aptvaro. Iki žemės – 9 m. Šalia dirba žmogus.',
      ok: 'Perdangos kraštas neaptvertas – kritimo iš aukščio pavojus',
      bad: ['Aptvaro nereikia, jei darbuotojai turi šalmus', 'Pakanka nubrėžti geltoną liniją 1 m nuo krašto'],
      why: 'Nuo 1,3 m aukščio darbo vietos ir praėjimai aptveriami. Pirmenybė – kolektyvinėms priemonėms (aptvarai, tinklai); apraišai naudojami tik tada, kai kolektyvinių priemonių įrengti neįmanoma.' });
    c.item('Anga perdangoje', [4, Y + 0.2, -0.2], [2.2, 0.6, 2.2], {
      h: 3, code: 'W008', see: '2 × 2 m šachtos anga perdangoje – atvira, neaptverta, nepažymėta.',
      ok: 'Neuždengta ir neaptverta anga perdangoje',
      bad: ['Anga turi būti apšviesta raudona lempa – to pakanka', 'Angą reikia pažymėti signaline juosta ant grindų'],
      why: 'Angos perdangose uždengiamos tvirtais, pritvirtintais (nenustumiamais) ir paženklintais dangčiais arba aptveriamos aptvarais. Atviros angos – dažna mirtinų kritimų priežastis.' });
    c.item('Rytinio krašto aptvaras', [12.2, Y + 0.6, 0], [0.5, 1.3, 8], {
      h: 2, code: 'W035', see: 'Aptvarą sudaro tik viršutinis porankis. Nėra vidurinio ilginio ir papėdės lentos.',
      ok: 'Nepilnas aptvaras: trūksta vidurinio ilginio ir 0,15 m papėdės lentos',
      bad: ['Porankis medinis, o privalo būti metalinis', 'Aptvaras per aukštas – porankis turi būti 0,8 m aukštyje'],
      why: 'Aptvarą sudaro porankis (ne žemiau kaip 1 m), vidurinis ilginis ir 0,15 m papėdės lenta. Be vidurinio ilginio žmogus gali praslysti po porankiu, be papėdės – nuo krašto krenta įrankiai ir medžiagos.' });
    c.item('Krano keliamas krovinys', [8.5, Y + 3.6, -2.5], [3, 1.6, 1.8], {
      h: 3, code: 'W015', see: 'Klojinių skydai kabo ant krano kablio tiesiai virš dviejų dirbančių žmonių. Zona nepažymėta.',
      ok: 'Krovinys keliamas ir laikomas virš žmonių',
      bad: ['Krovinys per žemai – jis turi kabėti bent 7 m virš perdangos', 'Kelti leidžiama, jei žmonės apačioje dėvi šalmus'],
      why: 'Po keliamu kroviniu ir jo judėjimo zonoje žmonių būti negali. Kėlimo zona pažymima, darbus koordinuoja stropuotojas / signalininkas. Šalmas nuo krintančio krovinio neapsaugo.' });
    c.item('Kopėčios į viršutinę perdangą', [-5.2, Y + 1.5, 0.6], [1.6, 3.1, 0.9], {
      h: 2, code: 'W008', see: 'Kopėčių viršus baigiasi lygiai su viršutinės perdangos kraštu. Kopėčios nepririštos, stovi ant lygaus betono.',
      ok: 'Kopėčios neiškilusios 1 m virš užlipimo lygio ir nepritvirtintos',
      bad: ['Aliuminio kopėčios statybvietėje draudžiamos', 'Kopėčios per nuožulnios – jos turi stovėti 85° kampu'],
      why: 'Pristatomų kopėčių viršus turi būti ne mažiau kaip 1 m virš užlipimo lygio (kad būtų už ko laikytis nulipant), kopėčios pritvirtinamos, nuolydis – ne didesnis kaip 75°.' });
    c.item('Darbuotojas prie neaptverto krašto', [5, Y + 0.7, 5.3], [1.2, 1.5, 1.4], {
      h: 3, code: 'M018', see: 'Darbuotojas su apraišais klūpo prie pat neaptverto krašto. Lynas su karabinu guli susuktas ant perdangos – niekur neprisegtas.',
      ok: 'Apraišai užsidėti, bet neprisegti prie inkaravimo taško',
      bad: ['Apraišų spalva netinkama – jie turi būti ryškiaspalviai', 'Klūpant būtini antkeliai – tai vienintelis trūkumas'],
      why: 'Apraišai saugo tik prisegti prie tinkamo inkaravimo taško. Kai apraišai yra pagrindinė apsauga nuo kritimo aukščiau kaip 5 m, darbuotojas turi turėti aukštalipio kvalifikaciją, o darbams vadovauja aukštalipių darbų vadovas.' });
    c.item('Blokelių paletė prie krašto', [-8.4, Y + 0.9, 5.5], [1.5, 1.8, 1.2], {
      h: 2, code: 'W035', see: 'Paletė pastatyta prie pat perdangos krašto, krūva aukštesnė už aptvarą, viršutinė eilė neparišta.',
      ok: 'Medžiagos sukrautos prie perdangos krašto aukščiau aptvaro – gali nukristi',
      bad: ['Paletė per sunki – ant perdangos galima laikyti tik tuščias paletes', 'Blokeliai turi būti laikomi tik pirmame aukšte'],
      why: 'Medžiagos prie perdangos kraštų ir angų nesandėliuojamos; jos kraunamos toliau nuo krašto, stabiliai, neviršijant perdangos leistinos apkrovos. Įprasta rietuvės aukščio riba – 1,2 m, jei gamintojas nenurodo kitaip.' });
    c.item('Kolonos armatūra (centre)', [0, Y + 0.6, 0], [0.8, 1.3, 0.8], {
      h: 1, code: 'W022', see: 'Kolonos armatūros išleidimai ~1,1 m, galai atviri. Pro šalį eina pagrindinis praėjimas.',
      ok: 'Neuždengti armatūros galai prie praėjimo',
      bad: ['Armatūra turi būti nudažyta ryškia spalva', 'Strypus reikia aptverti 2 m aukščio tvora'],
      why: 'Kyšantys armatūros galai uždengiami apsauginiais gaubteliais – kaip ant kitų šios perdangos kolonų.' });
    c.item('Uždengta anga', [-3.8, Y + 0.25, 3], [2, 0.6, 2], {
      see: 'Anga uždengta faneros skydu, skydas prisuktas prie perdangos ir paženklintas „ANGA! NENUIMTI“.',
      bad: ['Dangtis turi būti permatomas, kad matytųsi anga', 'Uždengtą angą dar būtina aptverti 2 m tvora', 'Užrašas turi būti tik anglų kalba'],
      why: 'Tvirtas, pritvirtintas ir paženklintas dangtis – tinkamas angos apsaugos būdas.' });
    c.item('Šiaurinio krašto aptvaras', [2, Y + 0.6, -6.2], [8, 1.3, 0.4], {
      see: 'Porankis ~1,1 m aukštyje, vidurinis ilginis, papėdės lenta. Stovai įtvirtinti į perdangą.',
      bad: ['Trūksta apsauginio tinklo – be jo aptvaras negalioja', 'Aptvaras turi būti 2 m aukščio', 'Stovai per reti – jie turi būti kas 0,5 m'],
      why: 'Pilnas aptvaras su porankiu, viduriniu ilginiu ir papėdės lenta – atitinka.' });
    c.item('Kolonos armatūra su gaubteliais', [6, Y + 0.6, 0], [0.8, 1.3, 0.8], {
      see: 'Visi armatūros galai uždengti oranžiniais apsauginiais gaubteliais.',
      bad: ['Gaubteliai turi būti raudoni', 'Gaubtelių nepakanka – strypus būtina užlenkti', 'Armatūra per aukšta'],
      why: 'Armatūros galai apsaugoti – pažeidimo nėra.' });
    c.item('Darbuotojas su apraišais (rytų pusė)', [10.6, Y + 0.9, 3.6], [1, 1.9, 1], {
      see: 'Apraišai užsegti, lynas prisegtas prie paženklinto inkaravimo taško. Šalmas, liemenė.',
      bad: ['Vienu metu privalo būti prisegti du lynai prie dviejų taškų', 'Dirbti su apraišais galima tik dviese susirišus', 'Lynas turi būti ne trumpesnis kaip 5 m'],
      why: 'Darbuotojas prisisegęs prie tam skirto inkaravimo taško – tinkama asmeninė apsauga nuo kritimo ten, kur aptvaras dar nepilnas (aptvarą vis tiek reikia sutvarkyti – žr. rytinį kraštą).' });
  },
},

/* ================= 3. FASADAS IR PASTOLIAI ================= */
{
  id: 'pastoliai', title: 'Fasadas ir pastoliai', site: 'Daugiabutis „Šilo terasos“, Vilnius', short: 'Pastolių turėklai, paklotai, atramos, mobilus bokštelis.',
  brief: 'Karkasas baigtas, šiltinamas ir tinkuojamas fasadas. Pastolius vakar perstatė kita brigada. Apžiūrėkite juos nuo žemės – aukštesniems aukštams naudokite priartinimą (Z arba dešinys pelės klavišas).',
  weather: 'Vėjuota: +9 °C, vėjas 10 m/s, gūsiai stiprėja.', weatherShort: '+9 °C · vėjas 10 m/s',
  time: 540, floorY: 0, bounds: [-23, 1.55, 23, 21], spawn: [-18, 14, -0.5], center: [0, 4], sun: [40, 20], range: 17, menuR: 30, menuH: 7, menuLook: 6, menuArc: [PI / 2, 0.8],
  build(c) {
    const { M, P } = c, B = P.B, X0 = -15, L = 2.5;
    c.add(B(70, 0.2, 50, M.gravel, 0, -0.2, 6));
    c.add(P.facade(16, 5, 2.5, 2.8, M.block, { doorBay: 7 }), -20, 0, 0);
    c.add(B(40, 14, 10, M.concrete, 0, 0, -5.45)); c.add(B(40.6, 0.3, 11, M.concreteDark, 0, 14, -5.2));
    // šiltinimo plokštės ant dalies fasado
    c.add(B(15, 8.4, 0.12, M.wool, -12.5, 5.6, 0.06)); c.add(B(10, 5.6, 0.12, M.plaster, 15, 0, 0.06));
    const key = (b, l) => b + ',' + l;
    c.add(P.scaffold({ bays: 12, levels: 6, L, noRail: new Set([key(7, 3)]), noToe: new Set([key(3, 2)]), noDeck: new Set([key(9, 5)]), badBase: new Set([9, 10]), openEnd: true, net: [[0, 3, 3, 6]] }), X0, 0, 0);
    c.wall(X0 - 0.2, 0, X0 + 12 * L + 0.2, 1.4);
    const bx = b => X0 + (b + 0.5) * L;
    // žmonės ant pastolių
    c.add(P.worker({ helmet: 0xf2c200, pose: 'work' }), bx(7), 6.02, 0.72, PI);
    c.add(P.worker({ helmet: 0xffffff, pose: 'work' }), bx(2), 4.02, 0.72, PI);
    c.add(P.worker({ helmet: 0xf2c200, pose: 'stand' }), bx(1) - 0.4, 8.02, 0.75, 0.2);
    // plytos ant pakloto be papėdės lentos
    for (let i = 0; i < 5; i++) c.add(B(0.25, 0.065 * (1 + (i % 3)), 0.12, M.brick, bx(3) - 0.6 + i * 0.3, 4.02, 1.08));
    c.add(B(0.5, 0.3, 0.3, M.grey, bx(3) + 0.9, 4.02, 1.0));
    // šiukšlės mėtomos žemyn
    c.add(P.debris(26, 3, 5), bx(1), 0, 3.4);
    falling(c, B(0.3, 0.12, 0.2, M.gypsum), bx(1) - 0.2, 8.6, 2.2, 8.4, 2.6); falling(c, B(0.2, 0.2, 0.2, M.brick), bx(1) + 0.4, 8.6, 2.6, 8.4, 2.6, 1.1);
    // įėjimas be stogelio + praeivis
    const civ = c.add(P.worker({ helmet: null, vest: false, top: M.red }), -1.25, 0, 3);
    c.anim(t => { const k = (t * 0.12) % 1; civ.position.z = 2 + k * 9; civ.position.x = -1.25 - k * 3; civ.userData.body.rotation.z = Math.sin(t * 6) * 0.03; });
    // pastolių žyma (tvarkinga)
    c.add(P.board([{ t: 'PASTOLIAI PATIKRINTI', size: 44, color: '#fff' }, { t: 'Naudoti leidžiama', size: 40, color: '#fff' }, { t: 'Patikra: 2026-11-12', size: 30, color: '#fff', bold: false }, { t: 'Apkrovos klasė 3 · atsakingas: darbų vadovas', size: 22, color: '#fff', bold: false }], 0.7, 0.45, '#12924a'), X0 + 0.5, 1.5, 1.26);
    // mobilus bokštelis + vėjo matuoklis
    c.add(P.mobileTower(4, { rails: false, locked: false }), 18.2, 0, 1.3); c.wall(16.8, 0.4, 19.6, 2.2);
    c.add(P.worker({ helmet: 0xf2c200, pose: 'work' }), 18.2, 4.05, 1.1, PI);
    c.add(P.T([21, 0, 5], [21, 3, 5], 0.03, M.metal)); c.add(P.board([{ t: 'VĖJAS', size: 50, color: '#9fe8a0' }, { t: '10 m/s', size: 110, color: '#ffd24a' }], 0.7, 0.45, '#111'), 21, 1.6, 5.04, -0.5);
    const cups = c.add(P.G(P.B(0.5, 0.03, 0.03, M.black), P.B(0.03, 0.03, 0.5, M.black)), 21, 3, 5); c.anim((t) => { cups.rotation.y = t * 9; });
    // aplinka
    perimeter(c, -24, -1, 24, 22, { s: [-22, -18.4] });
    c.add(P.sign('P080', 'Pašaliniams draudžiama', 0.5), -17.9, 1.5, 21.9, PI); c.add(P.sign('W035', 'Krintantys daiktai', 0.5), -17.3, 1.5, 21.9, PI);
    c.solid(P.cabin(M.cabin), 14, 0, 18.5, PI); c.solid(P.stack(1.15, 1.2, 0.85, M.wool), 6, 0, 12); c.solid(P.stack(1.15, 1.2, 0.85, M.wool), 7.6, 0, 12.2, 0.1); c.solid(P.stack(1.1, 0.7, 0.8, M.eps), 5, 0, 14.2, 1.2);
    c.add(P.puddle(2.6, 1.6), -6, 0, 10); c.add(P.tree(7), -30, 0, 16); c.add(P.tree(6), 31, 0, 12); c.add(P.tree(7), 28, 0, 26);

    c.item('Pastolių 3 aukštas (darbuotojas be turėklų)', [bx(7), 6.9, 0.8], [2.5, 2, 1.1], {
      h: 3, code: 'W008', see: 'Paklotas 6 m aukštyje. Šioje sekcijoje nėra nei porankio, nei vidurinio ilginio, nei papėdės lentos. Ant pakloto dirba žmogus.',
      ok: 'Pastolių paklotas be apsauginių turėklų – kritimo iš aukščio pavojus',
      bad: ['Darbuotojas ant pastolių privalo dėvėti gelbėjimo liemenę', 'Pastolių paklotas per aukštai – virš 4 m dirbti nuo pastolių draudžiama'],
      why: 'Nuo 1,3 m aukščio pastolių paklotai aptveriami: porankis, vidurinis ilginis, papėdės lenta. Nuimtus elementus privaloma grąžinti prieš leidžiant dirbti; pastoliai po perstatymo priimami iš naujo.' });
    c.item('Pastolių 2 aukštas (plytos ant krašto)', [bx(3), 4.4, 0.85], [2.5, 1.1, 1.1], {
      h: 2, code: 'W035', see: 'Turėklai yra, bet papėdės lentos šioje sekcijoje nėra. Ant pakloto krašto sudėtos plytos ir kibiras.',
      ok: 'Nėra papėdės lentos – medžiagos gali nukristi nuo pakloto',
      bad: ['Ant pastolių apskritai draudžiama laikyti bet kokias medžiagas', 'Plytos turi būti sudėtos į maišus – papėdės lenta neprivaloma'],
      why: '0,15 m papėdės lenta neleidžia medžiagoms ir įrankiams nuslysti nuo pakloto. Krintantys daiktai – pagrindinis pavojus žmonėms po pastoliais.' });
    c.item('Pastolių stovų atramos (dešinėje)', [X0 + 9.5 * L, 0.2, 1.25], [3.2, 0.5, 0.6], {
      h: 3, code: 'M002', see: 'Du pastolių stovai remiasi į plytų ir lentgalių krūveles. Atraminių padų ir paskirstomųjų lentų nėra.',
      ok: 'Stovai atremti į atsitiktines medžiagas – pastoliai gali nusėsti ar virsti',
      bad: ['Stovai turi būti įbetonuoti į pamatą', 'Po stovais trūksta tik guminių kilimėlių nuo triukšmo'],
      why: 'Pastolių stovai statomi ant atraminių padų (reguliuojamų atramų) ir paskirstomųjų lentų ant sutankinto, lygaus pagrindo – pagal gamintojo instrukciją. Plytos ir lentgaliai trupa ir slysta.' });
    c.item('Pastolių 5 aukšto paklotas', [bx(9), 10.1, 0.8], [2.5, 0.9, 1.1], {
      h: 2, code: 'W008', see: 'Šioje sekcijoje paklota tik pusė pakloto pločio – tarp skydo ir išorinių turėklų žioji tarpas.',
      ok: 'Nepilnas paklotas – tarpas, pro kurį galima įkristi',
      bad: ['Paklotas turi būti metalinis, mediniai skydai draudžiami', 'Paklotas turi būti nudažytas neslidžiais dažais'],
      why: 'Paklotas turi dengti visą pastolių plotį, skydai – sudėti sandariai ir užfiksuoti, kad nepasislinktų ir neapsiverstų.' });
    c.item('Nebaigta montuoti pastolių sekcija', [bx(11), 2.6, 0.85], [2.5, 5, 1.1], {
      h: 2, code: 'P025', see: 'Paskutinė sekcija sumontuota tik iš dalies: nėra paklotų ir turėklų. Patekti į ją galima laisvai, jokio draudžiamojo ženklo nėra.',
      ok: 'Nebaigti pastoliai nepaženklinti ir neatitverti – jais gali pradėti naudotis',
      bad: ['Nebaigtus pastolius būtina uždengti tentu', 'Pastolius leidžiama montuoti tik naktį, kai nėra žmonių'],
      why: 'Montuojami, ardomi ar nebaigti pastoliai paženklinami draudžiamuoju ženklu (P025 „Nesinaudoti nebaigtais montuoti pastoliais“), o patekimas į juos fiziškai užtveriamas.' });
    c.item('Mobilus bokštelis', [18.2, 2.6, 1.3], [2.8, 5.8, 1.8], {
      h: 3, code: 'W008', see: 'Darbuotojas dirba ant 4 m aukščio mobilaus bokštelio. Platforma be turėklų, ratukų stabdžiai neužfiksuoti, išorinių atramų nėra.',
      ok: 'Bokštelis be turėklų ir neužfiksuotais ratukais',
      bad: ['Ant mobilaus bokštelio vienu metu privalo dirbti bent du žmonės', 'Bokštelis turi būti pririštas virve prie šalia stovinčio automobilio'],
      why: 'Mobilaus bokštelio platforma aptveriama kaip ir kiti pastoliai, ratukai prieš lipant užfiksuojami, naudojamos gamintojo numatytos atramos. Perstumti bokštelį su ant jo esančiu žmogumi draudžiama.' });
    c.item('Vėjo matuoklis', [21, 1.7, 5], [0.9, 0.8, 0.5], {
      h: 2, see: 'Vėjo greitis – 10 m/s. Ant stacionarių pastolių ir ant mobilaus bokštelio dirbama.',
      ok: 'Vėjas viršija 8 m/s – darbai nuo mobilaus bokštelio turi būti nutraukti',
      bad: ['Esant 10 m/s vėjui draudžiami visi darbai statybvietėje', 'Vėjo greitis neturi reikšmės, jei darbuotojai dėvi šalmus su dirželiais'],
      why: 'Darbai nuo mobilių (kilnojamųjų) pastolių nutraukiami vėjui pasiekus 8 m/s; nuo stacionarių pastolių – 13,8 m/s (6 balai). 10 m/s – stacionariems dar leistina, mobiliam bokšteliui jau ne.' });
    c.item('Įėjimas į pastatą po pastoliais', [-1.25, 1.3, 1.7], [2.2, 2.6, 0.9], {
      h: 2, code: 'W035', see: 'Pro šias duris vaikšto žmonės. Virš įėjimo – penki pastolių aukštai, kuriuose dirbama. Apsauginio stogelio nėra.',
      ok: 'Praėjimas po pastoliais be apsauginio stogelio nuo krintančių daiktų',
      bad: ['Durys po pastoliais turi būti visada užrakintos', 'Trūksta tik kilimėlio batams nusivalyti'],
      why: 'Įėjimai ir praėjimai po pastoliais bei kitomis darbo vietomis aukštyje apsaugomi stogeliais (uždangomis) arba pavojaus zona aptveriama ir vaikščioti joje draudžiama.' });
    c.item('Statybinių atliekų krūva', [bx(1), 0.7, 3.2], [3.4, 1.6, 3.4], {
      h: 2, code: 'W035', see: 'Nuo ketvirto pastolių aukšto laužas metamas tiesiai žemyn. Kritimo zona neaptverta, šiukšlių šachtos (rankovės) nėra.',
      ok: 'Atliekos metamos iš aukščio į neaptvertą zoną',
      bad: ['Atliekas mesti galima, tik reikia prieš tai garsiai šūktelėti', 'Atliekų krūva turi būti ne arčiau kaip 1 m nuo pastolių'],
      why: 'Mėtyti medžiagas ir atliekas nuo pastolių draudžiama. Jos nuleidžiamos uždarais latakais (šiukšlių rankovėmis), konteineriais ar keltuvu, o pavojaus zona apačioje aptveriama.' });
    c.item('Pastolių patikros žyma', [X0 + 0.5, 1.5, 1.3], [0.9, 0.7, 0.4], {
      see: 'Žalia žyma: „Pastoliai patikrinti. Naudoti leidžiama“, vakarykštė patikros data, apkrovos klasė, atsakingas asmuo.',
      bad: ['Žyma turi būti raudona', 'Patikros data negali būti naujesnė nei mėnesio senumo', 'Žyma privalo kabėti kiekviename aukšte'],
      why: 'Pastoliai tikrinami prieš pradedant naudoti, periodiškai, po perstatymo ir po stipraus vėjo; patikros rezultatas įforminamas ir pažymimas. Pati žyma tvarkinga – tačiau ji neatleidžia nuo pareigos pastebėti po patikros atsiradusius trūkumus.' });
    c.item('Pastolių stovų atramos (kairėje)', [X0 + 2.5 * L, 0.2, 1.25], [3.2, 0.5, 0.6], {
      see: 'Stovai su atraminiais padais ant paskirstomųjų lentų, pagrindas lygus ir sutankintas.',
      bad: ['Medinės lentos po padais draudžiamos', 'Stovai turi būti įkasti bent 0,5 m į gruntą', 'Padai per maži – jie turi būti 1 × 1 m'],
      why: 'Atraminiai padai ant paskirstomųjų lentų – teisingas stovų atrėmimas.' });
    c.item('Tinkuotojas 2 aukšte', [bx(2), 4.9, 0.8], [2.2, 1.9, 1.1], {
      see: 'Paklotas pilnas, yra porankis, vidurinis ilginis ir papėdės lenta. Darbuotojas su šalmu ir liemene.',
      bad: ['Ant aptvertų pastolių vis tiek privalomi apraišai', 'Trūksta antro porankio 1,5 m aukštyje', 'Dirbti veidu į sieną ant pastolių draudžiama'],
      why: 'Kai paklotas aptvertas kolektyvinėmis priemonėmis, apraišų nereikia. Darbo vieta tvarkinga.' });
    c.item('Ženklai prie vartų', [-17.6, 1.5, 21.7], [1.3, 0.8, 0.5], {
      see: 'Prie įėjimo: P080 „Pašaliniams įeiti draudžiama“ ir W035 „Krintantys daiktai“. Tvora ištisinė.',
      bad: ['Įspėjamasis ženklas turi būti mėlynas apskritimas', 'Ženklai turi kabėti ne žemiau kaip 3 m', 'Vietoje ženklų pakanka užrašo ant kartono'],
      why: 'Ženklų forma ir spalva atitinka grupes: draudžiamasis – raudonas apvadas su įžambia juosta, įspėjamasis – geltonas trikampis. Registracijos kodai nurodyti.' });
  },
},

/* ================= 4. VIDAUS APDAILA ================= */
{
  id: 'apdaila', sky: 'morning', title: 'Vidaus apdaila, 2 aukštas', site: 'Daugiabutis „Šilo terasos“, Vilnius', short: 'Elektra, dulkės, evakuacija, dujų balionai.',
  brief: 'Viduje – apdailos darbai: pjaunamos vagos instaliacijai, glaistoma, montuojamos pertvaros. Pastate drėgna, apšvietimas laikinas. Žibintuvėlis įjungiamas klavišu F.',
  weather: 'Patalpose +8 °C, drėgna, vietomis ant grindų stovi vanduo.', weatherShort: 'Patalpos · +8 °C · drėgna',
  time: 540, floorY: 0, bounds: [-11.75, -6.75, 11.75, 6.75], spawn: [10.6, 0, PI / 2], center: [0, 0], sun: [24, 195], range: 7, interior: true, exposure: 0.8, skyGain: 1.3, menuR: 30, menuH: 12, menuLook: 0,
  build(c) {
    const { M, P } = c, B = P.B, H = 2.8;
    c.add(B(60, 0.2, 50, M.gravel, 0, -3.2, 0)); c.add(B(25, 3, 15, M.concrete, 0, -3, 0));
    c.add(B(24.8, 0.02, 14.8, M.concrete, 0, 0, 0)); c.add(B(24.8, 0.25, 14.8, M.concrete, 0, H, 0)); c.add(B(24.8, 2.8, 14.8, M.block, 0, H + 0.25, 0));
    // išorinės sienos su langais
    c.add(P.facade(8, 1, 3, H, M.block, { glass: false, th: 0.3 }), -12, 0, -7); const sf = c.add(P.facade(8, 1, 3, H, M.block, { glass: false, th: 0.3 }), 12, 0, 7, PI);
    [sf].forEach(o => o.traverse(m => m.isMesh && (m.castShadow = true)));
    c.solid(B(0.3, H, 14.6, M.block), -12.15, 0, 0, 0, false); c.solid(B(0.3, H, 6, M.block), 12.15, 0, -4.2, 0, false); c.solid(B(0.3, H, 6, M.block), 12.15, 0, 4.2, 0, false);
    c.add(B(0.3, 0.9, 2.4, M.block, 12.15, 0, 0)); c.add(B(0.3, 0.5, 2.4, M.block, 12.15, 2.3, 0));
    // pertvaros: wallX – išilgai X ties z, su durų tarpais
    const wallX = (x0, x1, z, doors, mat = M.gypsum) => {
      let a = x0; doors.concat([x1 + 1]).forEach(d => { const b = Math.min(d - 0.6, x1); if (b - a > 0.05) c.solid(B(b - a, H, 0.12, mat), (a + b) / 2, 0, z); a = d + 0.6; });
      doors.forEach(d => c.add(B(1.2, H - 2.1, 0.12, mat, d, 2.1, z)));
    };
    wallX(-12, 12, -1.2, [-8, 0, 8]); wallX(-12, 9, 1.2, [-8, 0, 6.5]);
    [-4, 4].forEach(x => { c.solid(B(0.12, H, 5.7, M.gypsum), x, 0, -4.1); c.solid(B(0.12, H, 5.7, M.gypsum), x, 0, 4.1); });
    // lifto šachta (rytų-pietų kampas): x∈[9,12], z∈[1.2,4.2]
    c.solid(B(3, H, 0.2, M.concrete), 10.5, 0, 4.3); c.add(B(0.2, H, 0.9, M.concrete, 9, 0, 3.85)); c.add(B(0.2, H, 0.5, M.concrete, 9, 0, 1.45)); c.add(B(0.2, 0.6, 1.8, M.concrete, 9, 2.2, 2.6));
    c.add(B(2.8, 0.1, 3, M.black, 10.5, -3, 2.7)); c.wall(8.9, 1.2, 12, 4.4); c.add(B(1.7, 0.06, 0.003, M.tape, 9.02, 1.0, 2.55).rotateY(PI / 2));
    // laiptinės anga su aptvaru (S3 vakarinė dalis)
    c.add(B(2.4, 0.03, 1.6, M.black, 6.5, 0.0, 5.6)); c.add(P.guardrail(2.6), 5.2, 0, 4.7); c.add(P.guardrail(1.8), 5.2, 0, 6.5, PI / 2); c.add(P.guardrail(1.8), 7.8, 0, 6.5, PI / 2);
    c.wall(5.1, 4.6, 7.9, 6.75);
    // apšvietimas
    [[-8, -4], [0, -4.4], [8, -4], [-8, 4.2], [0, 4.4], [-5, 0], [5, 0]].forEach(([x, z], i) => { c.add(P.lampStand(1.9), x + 1.6, 0, z + (z ? 1.6 * Math.sign(z) : 0.8), i); c.lamp(x + 1.6, 2.1, z + (z ? 1.6 * Math.sign(z) : 0.8), 14, 11); });
    // 1. Kabelis baloje (koridorius)
    c.add(P.puddle(2.2, 1.5), 3, 0, 0.1);
    c.add(P.cable([[11, 0.02, -0.9], [7, 0.02, -0.5], [4, 0.02, 0.2], [2.4, 0.02, 0.1], [0.5, 0.02, -0.6], [0, 0.02, -1.6], [-0.2, 0.02, -3.6]], 0.014, M.cableOrange));
    c.add(P.C(0.016, 0.16, M.copper, 3.2, 0, 0.14, 6).rotateZ(PI / 2).translateX(0.03));
    // 2. Buitinis ilgintuvas (N2)
    c.add(B(0.34, 0.05, 0.07, M.white, -0.3, 0.01, -4)); c.add(P.puddle(1.5, 1.1), -0.6, 0, -4.3);
    c.add(P.board([{ t: 'IP20', size: 150 }, { t: '10 A · tik patalpoms', size: 44, bold: false }], 0.3, 0.16).rotateX(-PI / 2), -0.3, 0.065, -3.75);
    c.add(B(0.3, 0.25, 0.2, M.blue, 0.4, 0, -4.2)); c.add(P.cable([[-0.15, 0.03, -4], [0.1, 0.03, -4.4], [0.4, 0.12, -4.2]], 0.008, M.cableBlack));
    c.add(P.stack(1.1, 0.6, 0.8, M.plaster), 2.4, 0, -5.4);
    // 3. Sausas pjovimas (N1)
    c.add(P.worker({ helmet: 0xf2c200, pose: 'work' }), -8.6, 0, -5.9, PI); c.add(B(0.3, 0.12, 0.12, M.green, -8.6, 1.15, -6.45)); c.add(B(1.6, 0.04, 0.02, M.concreteDark, -8.6, 1.2, -6.99));
    dust(c, -8.6, 0.9, -6.3, 160, 1.5); c.add(P.heap(0.6, 0.12, M.plaster, 3), -8.6, 0, -6.4);
    // 4. Užkrautas evakuacijos išėjimas (vakarų galas)
    c.add(B(0.05, 2.1, 1.1, M.metalDark, -11.98, 0, 0)); c.add(P.sign('E001', 'Evakuacinis išėjimas', 0.4), -11.95, 2.45, 0, PI / 2);
    for (let i = 0; i < 6; i++) { const g = B(0.014, 2.4, 1.2, M.gypsum, -11.2 + i * 0.03, 0, 0.05); g.rotation.z = -0.16; c.add(g); }
    c.solid(P.stack(1.15, 1.0, 0.85, M.plaster), -10.2, 0, -0.35); c.solid(P.stack(1.15, 0.5, 0.85, M.wood), -10.3, 0, 0.6, 0.1); c.wall(-11.8, -1.2, -11, 1.2);
    // 5. Dujų balionai prie šildytuvo (S1)
    const cy1 = P.gasCylinder(M.red); cy1.rotation.z = PI / 2; c.add(cy1, -8.6, 0.12, 5.2); const cy2 = P.gasCylinder(M.red); cy2.rotation.z = PI / 2; cy2.rotation.y = 0.3; c.add(cy2, -8.4, 0.12, 5.6);
    c.add(B(0.5, 0.45, 0.35, M.metalDark, -7.6, 0, 5.0)); const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.32), new THREE.MeshBasicMaterial({ color: 0xff5a1a })); glow.position.set(-7.86, 0.24, 5.0); glow.rotation.y = -PI / 2; c.scene.add(glow);
    c.lamp(-8.1, 0.4, 5.1, 5, 5, 0xff6a2a); c.add(P.gasCylinder(M.red, 0.6), -7.6, 0, 5.5);
    // 6. Šlifuoklis nuo skėčiamų kopėčių (S2)
    c.add(P.stepladder(1.8), 0.6, 0, 5.4, PI / 2); c.add(P.worker({ helmet: 0xffffff, pose: 'work', vest: false, top: M.workDark }), 0.6, 1.05, 5.5, 0); c.add(B(0.3, 0.1, 0.1, M.blue, 0.6, 2.2, 6.1));
    dust(c, 0.6, 2.0, 6.3, 60, 0.6, 0xffc070);
    // 8. Gesintuvo vieta be gesintuvo (koridorius prie N3)
    c.add(P.sign('F001', 'Gesintuvas', 0.36), 5.6, 1.7, -1.13); c.add(B(0.12, 0.04, 0.06, M.metalDark, 5.6, 0.9, -1.11));
    // tvarkingos vietos: skydas (N3), dulkių nusiurbimas (N3), gesintuvas (prie S2), vaistinėlė
    c.add(B(0.5, 0.7, 0.22, M.yellow, 10.2, 0.7, -6.5)); c.add(P.T([10.05, 0, -6.5], [10.05, 0.7, -6.5], 0.02, M.metalDark)); c.add(P.T([10.35, 0, -6.5], [10.35, 0.7, -6.5], 0.02, M.metalDark));
    c.add(P.board([{ t: 'STATYBVIETĖS SKYDAS', size: 40 }, { t: 'IP44 · srovės nuotėkio relė 30 mA', size: 30, bold: false }, { t: 'Patikra: 2026-11', size: 30, bold: false }], 0.44, 0.22), 10.2, 1.1, -6.38);
    c.add(P.worker({ helmet: 0xf2c200, pose: 'work', mask: true, glasses: true, ears: true }), 6.2, 0, -5.9, PI); c.add(B(0.3, 0.12, 0.12, M.green, 6.2, 1.15, -6.45));
    c.add(P.C(0.2, 0.5, M.blue, 7.2, 0, -5.4, 14)); c.add(P.cable([[7.2, 0.5, -5.4], [6.9, 0.9, -5.9], [6.35, 1.15, -6.4]], 0.025, M.black));
    c.add(P.board([{ t: 'M klasė', size: 110 }], 0.24, 0.12), 7.2, 0.3, -5.19);
    c.add(P.extinguisher(), -1.4, 0.5, 1.08); c.add(P.sign('F001', 'Gesintuvas', 0.36), -1.4, 1.75, 1.13, PI);
    c.add(B(0.4, 0.3, 0.12, M.green, 2.2, 1.3, 1.1)); c.add(P.sign('E003', 'Pirmoji pagalba', 0.36), 2.2, 2.0, 1.13, PI);
    c.add(P.debris(10, 2, 8, [M.gypsum, M.woodOld]), 9.6, 0, -3.4); c.add(P.stack(1.1, 0.9, 0.8, M.gypsum), -6, 0, 3);

    c.item('Kabelis baloje', [3, 0.15, 0.1], [2.4, 0.4, 1.6], {
      h: 3, code: 'W012', see: 'Ilgintuvo kabelis guli vandens baloje. Vienoje vietoje izoliacija nutrinta iki gyslų. Kabelis – su įtampa.',
      ok: 'Pažeistos izoliacijos kabelis su įtampa vandenyje – elektros smūgio pavojus',
      bad: ['Kabelis oranžinis, o statybvietėje leidžiami tik juodi', 'Kabelis per ilgas – ilgintuvai negali viršyti 5 m'],
      why: 'Pažeistą kabelį būtina nedelsiant atjungti ir pakeisti. Kabeliai tiesiami taip, kad nebūtų mechaniškai pažeidžiami ir negulėtų vandenyje: virš praėjimų – ne žemiau kaip 2,5 m arba apsaugoti. Grandinė turi būti apsaugota srovės nuotėkio rele.' });
    c.item('Ilgintuvas ant grindų', [-0.3, 0.15, -4.05], [1.2, 0.4, 1], {
      h: 2, code: 'W012', see: 'Baltas buitinis ilgintuvas su žyma IP20 guli ant šlapių grindų, į jį įjungtas skiedinio maišytuvas.',
      ok: 'Buitinis IP20 ilgintuvas drėgnoje statybvietėje – apsaugos laipsnis per žemas',
      bad: ['Į vieną ilgintuvą negalima jungti daugiau kaip vieno prietaiso', 'Ilgintuvas turi būti ne trumpesnis kaip 25 m'],
      why: 'Statybvietėje ilgintuvų ir kabelių apsaugos laipsnis – ne žemesnis kaip IP44, t. y. abu IP kodo skaitmenys ne mažesni kaip 4. IP20 neapsaugotas nei nuo dulkių, nei nuo vandens.' });
    c.item('Vagų pjovimas sienoje', [-8.6, 1.1, -6.1], [1.6, 2.2, 1.6], {
      h: 3, code: 'M017', see: 'Betoninė siena pjaunama sausai kampiniu šlifuokliu. Nusiurbimo nėra, patalpa pilna dulkių, darbuotojas be respiratoriaus ir akinių.',
      ok: 'Sausas betono pjovimas be nusiurbimo ir kvėpavimo takų apsaugos – kvarco dulkės',
      bad: ['Pjauti betoną patalpose leidžiama tik atidarius langus – to pakanka', 'Trūksta tik įspėjamojo ženklo „Dulkės“'],
      why: 'Pjaunant betoną ir mūrą susidaro įkvepiamos kristalinio silicio dioksido (kvarco) dulkės – kancerogenas. Reikia drėgnojo būdo arba nusiurbimo prie šaltinio (M arba H klasės siurblys) ir, kai nustato rizikos vertinimas, FFP3 respiratoriaus. ISO 7010 neturi registruoto įspėjamojo ženklo dulkėms – naudojami įpareigojamieji M017, M004.' });
    c.item('Koridoriaus galas (išėjimas)', [-10.9, 1.2, 0], [1.8, 2.4, 2.2], {
      h: 3, code: 'E001', see: 'Durys su žaliu evakuacinio išėjimo ženklu užstatytos gipso kartono lakštais ir paletėmis.',
      ok: 'Užkrautas evakuacijos kelias ir išėjimas',
      bad: ['Evakuacinio išėjimo ženklas turi būti raudonas', 'Gipso kartoną galima laikyti tik gulsčią – tai vienintelis trūkumas'],
      why: 'Evakuacijos keliai ir išėjimai visą laiką turi būti laisvi, paženklinti ir apšviesti. Gaisro atveju užkrautas išėjimas kainuoja gyvybes.' });
    c.item('Dujų balionai prie šildytuvo', [-8.3, 0.4, 5.3], [2, 0.9, 1.4], {
      h: 3, code: 'W021', see: 'Du propano balionai guli ant grindų be apsauginių gaubtų, už pusės metro – įkaitęs dujinis šildytuvas.',
      ok: 'Suslėgtų dujų balionai paguldyti ir laikomi prie šilumos šaltinio – sprogimo pavojus',
      bad: ['Balionai turi būti mėlyni, raudoni draudžiami', 'Balionus patalpoje galima laikyti tik uždengus brezentu'],
      why: 'Dujų balionai laikomi stačiai, pritvirtinti nuo nuvirtimo, su apsauginiais gaubtais, atokiai nuo šilumos šaltinių ir atviros ugnies; atsarginiai balionai – ne darbo vietoje. Konkrečius atstumus nustato gaisrinės saugos reikalavimai ir gamintojo instrukcija.' });
    c.item('Darbuotojas ant skėčiamų kopėčių', [0.6, 1.5, 5.6], [1.3, 2.6, 1.5], {
      h: 2, code: 'W008', see: 'Darbuotojas stovi ant skėčiamų kopėčių viršaus ir kampiniu šlifuokliu pjauna metalinį profilį palubėje.',
      ok: 'Nuo kopėčių dirbama mechaniniu įrankiu',
      bad: ['Skėčiamos kopėčios turi būti medinės', 'Ant skėčiamų kopėčių visada privalu dirbti dviese ant vienų kopėčių'],
      why: 'Nuo pristatomų ir skėčiamų kopėčių draudžiama dirbti mechaniniais įrankiais. Tokiam darbui naudojamos paaukštinimo priemonės su aptverta platforma – pastoliai, bokšteliai. Kopėčios – tik trumpiems, lengviems darbams.' });
    c.item('Lifto šachtos anga', [9, 1.1, 2.6], [0.5, 2.2, 1.9], {
      h: 3, code: 'W008', see: 'Lifto šachtos durų anga atvira. Skersai ištempta tik signalinė juosta. Šachtos gylis – per du aukštus.',
      ok: 'Lifto šachtos anga neužtverta – kritimo į šachtą pavojus',
      bad: ['Šachtoje turi degti raudona lempa – to pakanka', 'Juosta turi būti geltonai juoda, o ne raudonai balta'],
      why: 'Šachtų angos užtveriamos tvirtais aptvarais (ne žemesniais kaip 1 m, su viduriniu ilginiu ir papėdės lenta) arba uždaromos skydais. Juosta – ne aptvaras.' });
    c.item('Gesintuvo vieta', [5.6, 1.3, -1.05], [0.6, 1.4, 0.3], {
      h: 1, code: 'F001', see: 'Ženklas „Gesintuvas“ ir tuščias laikiklis. Gesintuvo nėra.',
      ok: 'Pažymėtoje vietoje nėra gesintuvo',
      bad: ['Gesintuvo ženklas turi būti žalias', 'Gesintuvai statybvietėje laikomi tik vadovo kabinete'],
      why: 'Pirminės gaisro gesinimo priemonės turi būti paženklintose, lengvai pasiekiamose vietose ir tvarkingos. Darbuotojai instruktažo metu supažindinami, kur jos yra.' });
    c.item('Statybvietės elektros skydas', [10.2, 0.9, -6.4], [0.8, 1.6, 0.5], {
      see: 'Skydas uždarytas, IP44, su srovės nuotėkio rele 30 mA ir patikros žyma.',
      bad: ['Skydas turi stovėti lauke, patalpose draudžiamas', 'IP44 per mažai – būtina IP68', 'Skydas privalo būti medinėje dėžėje'],
      why: 'Uždaras, ne žemesnio kaip IP44 laipsnio skydas su nuotėkio rele ir periodine patikra – tinkamas laikinas elektros tiekimas.' });
    c.item('Šlifavimas su nusiurbimu', [6.4, 1.1, -5.9], [2.2, 2.2, 1.6], {
      see: 'Šlifuoklis prijungtas prie M klasės dulkių siurblio. Darbuotojas su respiratoriumi, akiniais ir ausinėmis.',
      bad: ['Siurblys turi būti L klasės – M klasė draudžiama', 'Su nusiurbimu respiratorius draudžiamas', 'Šlifuoti leidžiama tik lauke'],
      why: 'Nusiurbimas prie šaltinio M (arba H) klasės siurbliu ir tinkamos AAP – teisingas būdas valdyti kvarco dulkes. Palyginkite su vagų pjovimu kitame kambaryje.' });
    c.item('Gesintuvas koridoriuje', [-1.4, 1.2, 1.05], [0.6, 1.7, 0.3], {
      see: 'Gesintuvas pakabintas, paženklintas ženklu F001, su galiojančia patikros žyma.',
      bad: ['Gesintuvas turi stovėti ant grindų', 'Gesintuvas turi būti užrakintas spintoje', 'Vienam aukštui gesintuvų nereikia'],
      why: 'Paženklintas, pasiekiamas ir patikrintas gesintuvas – tvarkoje.' });
    c.item('Laiptinės anga', [6.5, 0.6, 5.3], [2.8, 1.3, 1.6], {
      see: 'Anga aptverta iš visų pusių: porankis, vidurinis ilginis, papėdės lenta.',
      bad: ['Aptvaras turi būti ne žemesnis kaip 2 m', 'Angą būtina dar ir uždengti tinklu', 'Aptvarui trūksta durelių su spyna'],
      why: 'Pilnas aptvaras aplink angą – atitinka. Palyginkite su lifto šachta.' });
  },
},

/* ================= 5. STOGO DARBAI ================= */
{
  id: 'stogas', sky: 'morning', title: 'Plokščio stogo darbai', site: 'Daugiabutis „Šilo terasos“, Vilnius', short: 'Stogo kraštai, stoglangiai, ugnies darbai, vėjas.',
  brief: 'Paskutinis etapas viršuje: ant 15 m aukščio plokščio stogo klojama šilumos izoliacija ir prilydomoji danga. Naktį šalo, pučia stiprus vėjas.',
  weather: 'Giedra, −1 °C, vėjas 11 m/s. Ryte ant dangos – šerkšnas.', weatherShort: '−1 °C · vėjas 11 m/s · aukštis 15 m',
  time: 480, floorY: 15.4, bounds: [-13.6, -8.6, 13.6, 8.6], spawn: [-11.3, -4.5, -PI / 2], center: [0, 0], sun: [22, 150], range: 10, menuR: 32, menuH: 8, menuLook: 0, cityR: 150, rayleigh: 1.1,
  build(c) {
    const { M, P } = c, B = P.B, Y = 15.4;
    c.add(B(90, 0.2, 80, M.asphalt, 0, -0.1, 0));
    c.add(B(28, 15.1, 0.4, M.plaster, 0, 0, -8.8)); c.add(B(28, 15.1, 0.4, M.plaster, 0, 0, 8.8)); c.add(B(0.4, 15.1, 17.2, M.plaster, -13.8, 0, 0)); c.add(B(0.4, 15.1, 17.2, M.plaster, 13.8, 0, 0));
    const holes = [[-3, -1, -1, 1], [4, -5, 6, -3], [-12.6, 5.6, -11.4, 6.8]];
    c.add(P.slabWithHoles(-14, -9, 14, 9, holes, M.bitumen, Y, 0.3)); c.add(B(27, 0.2, 17, M.concrete, 0, Y - 3, 0));
    // parapetas 0,3 m
    c.add(B(28.4, 0.3, 0.3, M.concrete, 0, Y, -8.95)); c.add(B(28.4, 0.3, 0.3, M.concrete, 0, Y, 8.95)); c.add(B(0.3, 0.3, 18, M.concrete, -13.95, Y, 0)); c.add(B(0.3, 0.3, 18, M.concrete, 13.95, Y, 0));
    // laikini aptvarai: šiaurė, vakarai, pietūs. Rytų kraštas – be aptvaro
    c.add(P.guardrail(27.6, { wood: false }), -13.8, Y, -8.75); c.add(P.guardrail(27.6, { wood: false }), -13.8, Y, 8.75); c.add(P.guardrail(17.5, { wood: false }), -13.8, Y, 8.75, PI / 2);
    // šiltinimo plokštės jau paklotos dalyje stogo
    c.add(B(9, 0.12, 12, M.eps, 8.5, Y, 0));
    // stoglangiai
    const film = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6, 6, 6), M.film); film.rotation.x = -PI / 2; film.position.set(-2, Y + 0.04, 0); c.scene.add(film);
    c.anim(t => { const p = film.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(t * 5 + p.getX(i) * 3 + p.getY(i) * 2) * 0.03); p.needsUpdate = true; });
    [[-3.2, -1.2], [-0.8, 1.1], [-3.1, 1.2], [-0.9, -1.1]].forEach(([x, z]) => c.add(B(0.25, 0.065, 0.12, M.brick, x, Y + 0.04, z)));
    c.wall(-3, -1, -1, 1);
    c.add(B(2.4, 0.05, 2.4, M.plywood, 5, Y + 0.12, -4)); c.add(P.board([{ t: 'ANGA!', size: 120, color: '#c8201c' }, { t: 'NEVAIKŠČIOTI', size: 60 }], 1.4, 0.9, '#f9d500').rotateX(-PI / 2), 5, Y + 0.18, -4);
    [[3.9, -5.1], [6.1, -5.1], [3.9, -2.9], [6.1, -2.9]].forEach(([x, z]) => c.add(P.C(0.02, 0.03, M.metalDark, x, Y + 0.17, z, 6)));
    // atviras liukas (išlipimas ant stogo)
    const lid = B(1.3, 0.05, 1.3, M.metal); lid.position.set(-12, Y + 0.6, 7.3); lid.rotation.x = -1.2; c.scene.add(lid); c.add(P.ladder(3, 0.4), -12, Y - 3, 6.75);
    c.wall(-12.7, 5.5, -11.3, 6.9);
    // ledas
    c.add(P.puddle(3.2, 2.2, M.ice), -9.5, Y, 1.5); c.add(P.puddle(1.8, 2.6, M.ice), -7.6, Y, 3.4);
    // ugnies darbai (pažeidimas): degiklis prie ritinių, balionas, skiediklis
    for (let i = 0; i < 5; i++) c.add(P.C(0.11, 1, M.bitumen, -7.6 + i * 0.26, Y, -5.6 - (i % 2) * 0.24, 12));
    const gc = P.gasCylinder(M.red); gc.rotation.z = PI / 2; c.add(gc, -6.2, Y + 0.12, -6.2);
    c.add(B(0.25, 0.32, 0.18, M.blue, -8.2, Y, -6.3)); c.add(B(0.25, 0.32, 0.18, M.blue, -8.5, Y, -6.2));
    c.add(P.T([-6.9, Y + 0.05, -5.0], [-6.5, Y + 0.25, -5.3], 0.025, M.metalDark)); fire(c, -6.95, Y + 0.02, -4.95, 0.6);
    c.add(P.cable([[-6.5, Y + 0.25, -5.3], [-6, Y + 0.03, -5.6], [-5.6, Y + 0.12, -6.2]], 0.01, M.cableOrange));
    // ugnies darbų postas (tvarkingas)
    c.add(P.gasCylinder(M.red), 1.5, Y, 6.6); c.add(B(0.3, 0.9, 0.05, M.metalDark, 1.5, Y, 6.78)); c.add(P.T([1.35, Y + 0.7, 6.6], [1.65, Y + 0.7, 6.6], 0.02, M.black, 6));
    c.add(P.extinguisher(), 2.3, Y, 6.5); c.add(P.extinguisher(), 2.55, Y, 6.5); c.add(P.sign('F001', 'Gesintuvas', 0.3), 2.4, Y + 0.9, 6.9, PI); c.add(P.sign('P003', 'Atvira ugnis draudžiama', 0.3), 0.6, Y + 0.9, 6.9, PI);
    // nepritvirtintos plokštės vėjyje
    const loose = [];
    for (let i = 0; i < 5; i++) { const s = B(1.2, 0.08, 0.6, M.eps, 3 + (i % 2) * 0.2, Y + 0.02 + i * 0.085, -7.7); loose.push(s); c.add(s); }
    const fly = B(1.2, 0.08, 0.6, M.eps); c.scene.add(fly);
    c.anim(t => { loose.forEach((s, i) => { s.rotation.x = Math.sin(t * 4 + i) * 0.03 * i; s.rotation.y = Math.sin(t * 1.3 + i) * 0.04 * i; }); const k = (t * 0.14) % 1; fly.position.set(4 + k * 26, Y + 0.6 + Math.sin(k * 3.14) * 3 - k * 6, -7.9 - k * 9); fly.rotation.set(t * 2, t * 1.4, t); });
    // surištos medžiagos (tvarkinga)
    c.solid(P.stack(1.15, 0.9, 0.85, M.eps), 0.5, Y, 3.4); c.add(B(1.2, 0.93, 0.04, M.black, 0.5, Y + 0.13, 3.1)); c.add(B(1.2, 0.93, 0.04, M.black, 0.5, Y + 0.13, 3.7)); c.add(B(1.19, 0.03, 0.9, M.black, 0.5, Y + 1.05, 3.4));
    // žmonės rytų pakraštyje
    c.add(P.worker({ helmet: 0xf2c200, pose: 'kneel' }), 12.9, Y + 0.12, -4.5, PI / 2);
    c.add(P.worker({ helmet: 0xffffff, harness: true, pose: 'work' }), 12.6, Y + 0.12, 3.2, PI / 2);
    c.add(P.C(0.05, 1.4, M.metal, 9.4, Y + 0.12, 3.4, 8)); c.add(P.C(0.09, 0.08, M.metal, 9.4, Y + 1.5, 3.4, 8));
    c.add(P.cable([[12.55, Y + 1.5, 3.2], [11.2, Y + 0.5, 3.3], [9.45, Y + 1.0, 3.4]], 0.012, M.cableOrange));
    // tvarkingas darbuotojas, prisisegęs prie inkaravimo linijos
    c.add(B(0.12, 1.1, 0.12, M.yellow, 9, Y + 0.12, -6.5)); c.add(B(0.12, 1.1, 0.12, M.yellow, 13, Y + 0.12, -7.6)); c.add(P.T([9, Y + 1.2, -6.5], [13, Y + 1.2, -7.6], 0.01, M.metal, 5));
    c.add(P.board([{ t: 'INKARAVIMO', size: 70 }, { t: 'LINIJA', size: 70 }], 0.34, 0.2, '#f9d500'), 9, Y + 0.9, -6.43);
    c.add(P.worker({ helmet: 0x2f6fd0, harness: true, pose: 'kneel' }), 11.6, Y + 0.12, -6.3, PI / 2); c.add(P.cable([[11.55, Y + 0.95, -6.3], [11.4, Y + 1.0, -6.9], [11.3, Y + 1.2, -7.13]], 0.012, M.cableOrange));
    // ventiliacijos stovai, aplinka
    [[-5, 5], [6.5, 6.5], [-10, -6]].forEach(([x, z]) => { c.solid(B(0.8, 0.9, 0.8, M.metal), x, Y, z); c.add(B(1, 0.06, 1, M.metalDark, x, Y + 0.95, z)); });
    c.add(P.towerCrane(30, 30), -24, 0, 16).userData.top.rotation.y = 0.5;
    for (let i = 0; i < 7; i++) c.add(P.tree(7), -40 + i * 13, 0, 24 + (i % 2) * 6);

    c.item('Rytinis stogo kraštas', [13.8, Y + 0.6, -0.6], [0.6, 1.3, 5], {
      h: 3, code: 'W008', see: 'Parapetas tik 0,3 m aukščio, laikino aptvaro šioje pusėje nėra. Iki žemės – 15 m. Prie krašto dirbama.',
      ok: 'Stogo kraštas neaptvertas – 0,3 m parapetas nuo kritimo nesaugo',
      bad: ['Parapetas pakankamas, jei darbuotojai avi neslidžią avalynę', 'Reikia tik nudažyti parapetą ryškia spalva'],
      why: 'Aptvaras turi būti ne žemesnis kaip 1 m, su viduriniu ilginiu ir papėdės lenta. Žemas parapetas kritimo nesulaiko. Pirmiausia įrengiamos kolektyvinės priemonės (laikini kraštų aptvarai, tinklai), apraišai – tik kai jų įrengti neįmanoma.' });
    c.item('Stoglangio anga po plėvele', [-2, Y + 0.2, 0], [2.4, 0.5, 2.4], {
      h: 3, code: 'W008', see: 'Stoglangio anga 2 × 2 m uždengta tik polietileno plėvele, prispausta plytomis. Po ja – 3 m iki perdangos.',
      ok: 'Anga uždengta tik plėvele – ji žmogaus neišlaikys',
      bad: ['Plėvelė turi būti juoda, kad būtų matoma ant sniego', 'Plytos per lengvos – plėvelę reikia prispausti blokeliais'],
      why: 'Angos uždengiamos tvirtais, apkrovą išlaikančiais, pritvirtintais ir paženklintais dangčiais arba aptveriamos. Plėvelė angą tik paslepia – tai dar pavojingiau nei atvira anga.' });
    c.item('Darbuotojas su apraišais prie ventiliacijos stovo', [11.2, Y + 0.9, 3.3], [3.8, 1.8, 1], {
      h: 2, code: 'M018', see: 'Apraišų lynas užkabintas už plono skardinio ventiliacijos stovo. Lynas ilgas – darbuotojas laisvai pasiekia kraštą.',
      ok: 'Apraišai prisegti prie netinkamo taško – ventiliacijos stovas nėra inkaravimo taškas',
      bad: ['Lynas turi būti raudonas', 'Apraišus ant stogo galima naudoti tik lyjant'],
      why: 'Inkaravimo taškas turi būti tam skirtas ir išlaikyti kritimo apkrovą; lyno ilgis parenkamas taip, kad kritimas būtų sustabdytas arba kraštas apskritai nepasiekiamas. Atsitiktinės konstrukcijos (stovai, vamzdžiai, turėklai) tam netinka.' });
    c.item('Darbuotojas prie rytinio krašto', [12.9, Y + 0.8, -4.5], [1.2, 1.5, 1.4], {
      h: 3, code: 'W008', see: 'Darbuotojas klūpo prie pat neaptverto krašto. Apraišų nėra, apsauginio tinklo nėra.',
      ok: 'Dirbama prie neaptverto krašto be jokios apsaugos nuo kritimo',
      bad: ['Darbuotojas privalo dirbti stovėdamas, klūpėti prie krašto draudžiama', 'Trūksta tik antkelių'],
      why: 'Darbuotojas turi teisę atsisakyti dirbti, kai darbo vieta nesaugi – toks atsisakymas nėra darbo pareigų pažeidimas. Darbus čia reikia stabdyti, kol bus įrengtas aptvaras arba suorganizuotas darbas su apraišais.' });
    c.item('Prilydymo darbų vieta', [-7.2, Y + 0.5, -5.7], [3.4, 1.2, 2], {
      h: 3, code: 'W021', see: 'Uždegtas dujinis degiklis paliktas ant dangos prie bituminių ritinių ir skiediklio bakelių. Balionas paguldytas. Gesintuvo šalia nėra, žmonių – irgi.',
      ok: 'Ugnies darbai prie degių medžiagų, be gesintuvo ir be priežiūros',
      bad: ['Degiklį galima palikti degantį, jei jis padėtas ant plytų', 'Prilydyti dangą leidžiama tik esant minusinei temperatūrai'],
      why: 'Ugnies darbų vietoje turi būti gesinimo priemonės, degios medžiagos patrauktos, balionas pastatytas stačiai ir atokiai nuo liepsnos, degiklis nepaliekamas be priežiūros. Ugnies darbų tvarką (leidimus, priežiūrą po darbų) nustato gaisrinės saugos reikalavimai ir įmonės tvarka.' });
    c.item('Šiltinimo plokščių krūva', [3.1, Y + 0.35, -7.7], [1.6, 0.8, 1], {
      h: 2, code: 'W035', see: 'Lengvos polistireno plokštės sukrautos prie šiaurinio krašto ir niekuo neprispaustos. Vėjas jas kilnoja – viena ką tik nuskrido nuo stogo.',
      ok: 'Nepritvirtintos lengvos medžiagos stipriame vėjyje – nupučiamos nuo stogo',
      bad: ['Polistireną ant stogo galima laikyti tik naktį', 'Plokštės turi būti sukrautos stačios, ne gulsčios'],
      why: 'Medžiagos ant stogo sandėliuojamos atokiau nuo kraštų ir pritvirtinamos (surišamos, prispaudžiamos), kad jų nenupūstų vėjas. Stiprėjant vėjui darbai su didelio ploto lengvais elementais stabdomi.' });
    c.item('Apledėjęs takas', [-8.7, Y + 0.15, 2.3], [4.6, 0.4, 4.2], {
      h: 2, code: 'W011', see: 'Pagrindinis takas nuo liuko į darbo zoną padengtas ledu. Nepabarstyta, kito kelio nėra.',
      ok: 'Slidus, apledėjęs praėjimas aukštyje',
      bad: ['Ledą būtina nutirpdyti dujiniu degikliu', 'Ant ledo vaikščioti galima, jei laikomasi už turėklų'],
      why: 'Praėjimai ir darbo vietos turi būti nuvalyti nuo sniego ir ledo, pabarstyti. Esant apledėjimui, šerkšnui ar stipriam vėjui darbai ant stogo nepradedami, kol sąlygos netaps saugios.' });
    c.item('Išlipimo ant stogo liukas', [-12, Y + 0.4, 6.2], [1.4, 0.9, 1.4], {
      h: 2, code: 'W008', see: 'Liukas paliktas atviras, anga neaptverta. Ji yra visai šalia tako, žemyn – 3 m kopėčios.',
      ok: 'Atvira neaptverta liuko anga prie praėjimo',
      bad: ['Liukas turi atsidaryti į vidų, ne į išorę', 'Liuko dangtis turi būti permatomas'],
      why: 'Kai liuku nesinaudojama, jis uždaromas, o atidarytas – aptveriamas. Atvira anga prie praėjimo yra kritimo iš aukščio pavojus.' });
    c.item('Laikinas aptvaras (šiaurės pusė)', [-2, Y + 0.6, -8.7], [8, 1.3, 0.4], {
      see: 'Metalinis laikinas kraštų aptvaras: porankis ~1,1 m, vidurinis ilginis, papėdės juosta. Stovai pritvirtinti prie parapeto.',
      bad: ['Ant stogo aptvaras turi būti ne žemesnis kaip 2 m', 'Metaliniai aptvarai ant stogo draudžiami dėl žaibo', 'Aptvaras reikalingas tik šlaitiniams stogams'],
      why: 'Laikinas kraštų aptvaras su visais trimis elementais – tinkama kolektyvinė apsauga.' });
    c.item('Uždengtas stoglangis', [5, Y + 0.3, -4], [2.4, 0.5, 2.4], {
      see: 'Anga uždengta storu faneros skydu, skydas prisuktas ir paženklintas „ANGA! NEVAIKŠČIOTI“.',
      bad: ['Skydas turi būti nuimamas be įrankių', 'Dangtis turi būti skaidrus', 'Užrašas ant dangčio draudžiamas'],
      why: 'Tvirtas, pritvirtintas ir paženklintas dangtis – tvarkoje. Palyginkite su anga po plėvele.' });
    c.item('Surišta medžiagų paletė', [0.5, Y + 0.6, 3.4], [1.5, 1.3, 1.2], {
      see: 'Paletė stogo viduryje, toli nuo kraštų, apjuosta tvirtinimo juostomis.',
      bad: ['Paletes ant stogo laikyti draudžiama', 'Paletė turi stovėti prie pat parapeto', 'Juostos turi būti nuimtos, kad nesikauptų drėgmė'],
      why: 'Medžiagos surištos ir sandėliuojamos atokiau nuo krašto – atitinka.' });
    c.item('Ugnies darbų postas', [1.8, Y + 0.7, 6.6], [2.6, 1.5, 0.8], {
      see: 'Balionas pastatytas stačiai ir pritvirtintas, šalia du gesintuvai su ženklu F001, degių medžiagų aplink nėra.',
      bad: ['Balionas turi gulėti, kad nenuvirstų', 'Gesintuvai ant stogo užšąla, todėl jų nereikia', 'Balioną reikia laikyti prie pat degiklio'],
      why: 'Stačias pritvirtintas balionas ir gesinimo priemonės ugnies darbų vietoje – tvarkoje.' });
    c.item('Darbuotojas prie inkaravimo linijos', [11.6, Y + 0.8, -6.5], [1.4, 1.5, 1.6], {
      see: 'Apraišai užsegti, trumpas lynas prisegtas prie paženklintos inkaravimo linijos, šalmas su dirželiu.',
      bad: ['Prie inkaravimo linijos gali būti prisegęs tik darbų vadovas', 'Lynas per trumpas – jis turi siekti žemę', 'Su apraišais šalmas nebereikalingas'],
      why: 'Prisegimas prie tam skirtos inkaravimo linijos trumpu lynu – tinkama asmeninė apsauga. Dirbant aukščiau kaip 5 m su apraišais kaip pagrindine priemone, reikalinga aukštalipio kvalifikacija.' });
  },
},

/* ================= 6. RENOVACIJA ================= */
{
  id: 'renovacija', sky: 'overcast', title: 'Seno daugiabučio renovacija', site: 'Penkiaaukštis Žaliakalnyje, Kaunas', short: 'Asbestas, gyventojai statybvietėje, triukšmas, gaisras.',
  brief: 'Kitas objektas: 1974 m. statybos daugiabutis renovuojamas neiškeldinus gyventojų. Šiltinamas fasadas, ardomi balkonai, griaunamas ūkinis pastatas su šiferio stogu. Čia rizika kyla ne tik darbuotojams.',
  weather: 'Apniukę, +6 °C, vėjas 4 m/s.', weatherShort: '+6 °C · vėjas 4 m/s',
  time: 540, floorY: 0, bounds: [-23.6, 1.2, 23.6, 22.6], spawn: [19, 19, 0.75], center: [0, 6], sun: [30, 100], range: 13, turbidity: 12, exposure: 0.74, skyGain: 1.25, menuR: 30, menuH: 7, menuLook: 5, menuArc: [PI / 2, 0.8],
  build(c) {
    const { M, P } = c, B = P.B, FH = 2.7;
    c.add(B(80, 0.2, 60, M.gravel, 0, -0.2, 8)); c.add(B(48, 0.02, 4, M.asphalt, 0, 0, 14));
    c.add(P.facade(14, 5, 2.5, FH, M.brickSilicate, { doorBay: 4 }), -17.5, 0, 0);
    c.add(B(35, 13.5, 10, M.plasterOld, 0, 0, -5.45)); c.add(B(35.6, 0.3, 11, M.concreteDark, 0, 13.5, -5.2));
    c.add(B(1.4, 2.2, 0.05, M.black, 8.75 + 0, 0, 0.01)); // antra laiptinė (11 sekcija) – durys ant fasado
    c.add(B(10, 8.1, 0.14, M.eps, -12.5, 0, 0.07)); c.add(B(7.5, 5.4, 0.14, M.wool, 13.75, 0, 0.07));
    // balkonai
    const balc = (bay, f, rail) => { const x = -17.5 + (bay + 0.5) * 2.5, y = f * FH; c.add(B(2.2, 0.14, 1.0, M.concreteDark, x, y - 0.14, 0.5)); if (rail) { c.add(B(2.2, 1, 0.04, M.sheet, x, y, 0.98)); c.add(B(0.04, 1, 1, M.sheet, x - 1.08, y, 0.5)); c.add(B(0.04, 1, 1, M.sheet, x + 1.08, y, 0.5)); } return x; };
    [[1, 1], [1, 2], [1, 3], [1, 4], [7, 1], [7, 2], [7, 4], [12, 1], [12, 2], [12, 3], [12, 4]].forEach(([b, f]) => balc(b, f, true));
    const bxD = balc(7, 3, false);
    // 6. ardomas balkonas
    c.add(P.worker({ helmet: 0xf2c200, pose: 'work' }), bxD, 3 * FH, 0.45, 0); c.add(P.debris(14, 2.2, 12, [M.concrete, M.concreteDark, M.sheet]), bxD, 0, 2.2);
    falling(c, B(0.3, 0.14, 0.24, M.concrete), bxD + 0.3, 3 * FH, 1.4, 3 * FH, 2.2); falling(c, B(0.16, 0.1, 0.2, M.concreteDark), bxD - 0.4, 3 * FH, 1.7, 3 * FH, 2.2, 0.9);
    // ūkinis pastatas su šiferio stogu (vakaruose)
    c.solid(B(6, 2.5, 5, M.brick), -20, 0, 10); const roof = B(6.6, 0.06, 3.2, M.slate, -20, 2.75, 8.9); roof.rotation.x = -0.25; c.add(roof);
    for (let i = 0; i < 3; i++) c.add(P.T([-22.8 + i * 2.8, 2.5, 7.6], [-22.8 + i * 2.8, 2.95, 12.4], 0.05, M.woodOld, 5));
    // 1. asbestinio šiferio krūva
    for (let i = 0; i < 9; i++) { const s = B(1.1 - (i % 3) * 0.25, 0.03, 0.7 - (i % 2) * 0.2, M.slate, -14.4 + Math.sin(i * 2.4) * 0.9, 0.04 + i * 0.05, 9.6 + Math.cos(i * 1.7) * 0.9); s.rotation.set(Math.sin(i) * 0.25, i * 0.9, Math.cos(i) * 0.2); c.add(s); }
    c.add(P.worker({ helmet: 0xf2c200, pose: 'work' }), -15.6, 0, 8.6, 0.9); dust(c, -14.4, 0.3, 9.6, 70, 1.2, 0xc8c8c0);
    // 7. kopėčios ant palečių (prie ūkinio pastato rytinės sienos)
    c.add(P.pallet(), -16.5, 0, 11.6, PI / 2); c.add(P.pallet(), -16.5, 0.144, 11.6, PI / 2 + 0.15); c.add(B(0.25, 0.065, 0.12, M.brick, -16.75, 0.29, 11.38)); c.add(B(0.25, 0.065, 0.12, M.brick, -16.75, 0.29, 11.82));
    c.add(P.leanLadder(3.0, 86), -16.78, 0.35, 11.6, PI / 2); c.wall(-17, 11, -15.7, 12.2);
    // tvarkingos kopėčios (prie ūkinio pastato pietinės sienos)
    c.add(P.leanLadder(3.9, 72), -21, 0, 13.72, 0); c.add(B(0.5, 0.04, 0.04, M.cableBlack, -21, 2.52, 12.52)); c.wall(-21.5, 12.5, -20.5, 13.9);
    // 2. gyventojų takas per darbo zoną (laiptinė, 4 sekcija)
    const xDoor = -17.5 + 4.5 * 2.5; c.add(B(1.6, 0.03, 12, M.concreteNew, xDoor, 0, 7.4));
    const res1 = c.add(P.worker({ helmet: null, vest: false, top: M.red }), xDoor, 0, 6), res2 = c.add(P.worker({ helmet: null, vest: false, top: M.green }), xDoor + 0.5, 0, 8); res2.scale.setScalar(0.62);
    c.anim(t => { const k = (t * 0.05) % 1; res1.position.z = 13 - k * 11; res2.position.z = 13.8 - k * 11; res1.rotation.y = res2.rotation.y = PI; res1.visible = res2.visible = k < 0.97; });
    c.add(P.stack(1.15, 1.2, 0.85, M.eps), xDoor + 1.9, 0, 4); c.add(P.stack(1.15, 1.0, 0.85, M.wool), xDoor - 2, 0, 5.4, 0.3);
    // 3. užkrautas antros laiptinės išėjimas (x≈8.75)
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c.add(B(1.2, 0.58, 0.6, j % 2 ? M.wool : M.eps, 7.6 + i * 1.22, j * 0.6, 0.75 + (i % 2) * 0.1)); c.wall(7, 1.2, 11, 1.4);
    c.add(P.sign('E001', 'Evakuacinis išėjimas', 0.36), 8.75, 2.6, 0.03);
    // 4. polistirenas prie pastato + deginama statinė
    for (let i = 0; i < 4; i++) c.add(B(1.2, 2.2 - (i % 2) * 0.6, 0.55, M.eps, 13 + i * 1.25, 0, 0.6));
    c.solid(P.C(0.3, 0.85, M.rust, 0, 0, 0, 14), 15.2, 0, 2.3); fire(c, 15.2, 0.75, 2.3, 1.1); c.add(P.debris(8, 1.4, 4, [M.woodOld, M.eps]), 16.4, 0, 3);
    c.add(P.worker({ helmet: 0xffffff, pose: 'stand' }), 14.3, 0, 3.1, 0.9);
    // 5. kabelis per pravažiavimą
    c.add(P.cable([[23, 0.02, 9], [19, 0.03, 12], [14, 0.03, 13.6], [11, 0.03, 15.2], [8, 0.02, 17], [6, 0.4, 19.4]], 0.02, M.cableBlack));
    c.add(B(0.6, 0.9, 0.3, M.yellow, 6, 0, 19.6)); c.add(P.board([{ t: '400 V', size: 130, color: '#111' }], 0.4, 0.2, '#f9d500'), 6, 0.6, 19.44, PI);
    const van = c.add(P.G(B(1.9, 1.5, 4.6, M.white, 0, 0.35, 0), B(1.85, 0.7, 1.4, M.glassDark, 0, 1.15, 1.61), ...[[-0.9, 1.5], [0.9, 1.5], [-0.9, -1.5], [0.9, -1.5]].map(([x, z]) => P.C(0.34, 0.25, M.rubber, x, 0.2, z, 14).rotateZ(PI / 2))), -6, 0, 14, PI / 2);
    c.anim(t => { const k = (t * 0.03) % 1; van.position.x = -30 + k * 60; });
    // tvarkingai pakabintas kabelis (rytuose)
    c.add(P.T([21, 0, 16], [21, 5, 16], 0.05, M.woodOld)); c.add(P.T([21, 0, 21.5], [21, 5, 21.5], 0.05, M.woodOld)); c.add(P.cable([[21, 4.9, 16], [21, 4.6, 18.7], [21, 4.9, 21.5]], 0.02, M.cableBlack));
    c.add(P.board([{ t: 'Kabelis 4,7 m', size: 60 }], 0.5, 0.18, '#f9d500'), 21.06, 1.6, 16, PI / 2); c.wall(20.8, 15.8, 21.2, 16.2);
    // 8. pjovimas be klausos apsaugos
    c.add(B(1.6, 0.5, 0.5, M.concrete, -4, 0, 18)); c.add(P.worker({ helmet: 0xf2c200, pose: 'kneel' }), -4, 0, 19, PI); c.add(B(0.5, 0.3, 0.25, M.orange, -4, 0.5, 18.2));
    c.add(P.board([{ t: 'LwA 112 dB', size: 90 }], 0.3, 0.12), -3.4, 0.25, 18.27); dust(c, -4, 0.6, 18, 110, 1.4);
    c.add(P.worker({ helmet: 0xffffff, pose: 'stand' }), -2.2, 0, 19.4, -1.9);
    // tvarkingas pjovimas (šlapias, su AAP)
    c.add(B(1.6, 0.5, 0.5, M.concrete, 13, 0, 19)); c.add(P.worker({ helmet: 0xf2c200, pose: 'kneel', mask: true, glasses: true, ears: true }), 13, 0, 20, PI); c.add(B(0.5, 0.3, 0.25, M.orange, 13, 0.5, 19.2));
    c.add(P.C(0.2, 0.45, M.blue, 14.2, 0, 19.3, 12)); c.add(P.cable([[14.2, 0.45, 19.3], [13.7, 0.5, 19.1], [13.2, 0.65, 19.15]], 0.012, M.blue)); c.add(P.puddle(2, 1.4), 13, 0, 18.4);
    // tvarkingas degių medžiagų sandėliavimas
    c.add(P.fence(4), 0, 0, 20.2); c.add(P.fence(2.4), 0, 0, 22.6, PI / 2); c.add(P.fence(2.4), 4, 0, 22.6, PI / 2);
    c.add(P.stack(1.15, 1.2, 0.85, M.eps), 1, 0, 21.5); c.add(P.stack(1.15, 1.2, 0.85, M.eps), 2.6, 0, 21.5); c.add(P.extinguisher(), 3.6, 0, 20.5); c.add(P.sign('P003', 'Atvira ugnis draudžiama', 0.4), 2, 1.5, 20.16, PI); c.wall(-0.1, 20, 4.1, 22.6);
    perimeter(c, -24.5, -1, 24.5, 23, { s: [xDoor - 1.2, xDoor + 1.2] });
    c.add(P.tree(8), -8, 0, 21); c.add(P.tree(7), 9.5, 0, 9); c.wall(-8.3, 20.7, -7.7, 21.3); c.wall(9.2, 8.7, 9.8, 9.3);
    c.add(B(1.6, 1.0, 1.0, M.green, -10.5, 0, 20.8)); c.add(B(2.4, 0.45, 0.5, M.woodOld, 10, 0, 10.5));

    c.item('Šiferio lakštų krūva', [-14.6, 0.7, 9.4], [3.2, 1.7, 3], {
      h: 3, code: 'M017', see: 'Nuo ūkinio pastato nuimti asbestcementinio šiferio lakštai laužomi ir metami į atvirą krūvą. Dulka. Darbuotojas be kvėpavimo takų apsaugos, už 10 m – gyventojų takas.',
      ok: 'Asbesto turinčios medžiagos ardomos laužant, be apsaugos ir be specialios tvarkos',
      bad: ['Šiferį galima laužyti, jei krūva paskui uždengiama plėvele', 'Trūksta tik įspėjamojo ženklo „Dulkės“'],
      why: 'Iki 2005 m. statytuose pastatuose galimas asbestas. Jį įtarus darbai nutraukiami. Asbesto turinčias medžiagas šalinti gali tik tam kompetenciją turintys darbuotojai pagal darbų planą, pranešus VDI: lakštai nuimami nelaužant, drėkinami, pakuojami sandariai ir ženklinami, naudojamos kvėpavimo takų AAP. ISO 7010 atskiro įspėjamojo ženklo asbestui neturi – naudojamas M017.' });
    c.item('Gyventojų takas į laiptinę', [xDoor, 1.2, 4.6], [2, 2.4, 5], {
      h: 3, code: 'P080', see: 'Gyventojai, tarp jų ir vaikas, į laiptinę eina tiesiai per darbo zoną. Takas neatitvertas, virš įėjimo dirbama, apsauginio stogelio nėra, tvoroje palikta spraga.',
      ok: 'Gyventojų praėjimas neatskirtas nuo darbo zonos ir neapsaugotas nuo krintančių daiktų',
      bad: ['Gyventojams reikia išduoti šalmus – tada takas saugus', 'Darbo metu gyventojams apskritai draudžiama išeiti iš namų'],
      why: 'Renovuojant gyvenamą pastatą trečiųjų asmenų keliai atskiriami nuo darbo zonų tvoromis, o įėjimai apsaugomi stogeliais (tuneliais). Tai turi būti išspręsta statybvietės saugos plane dar prieš darbų pradžią.' });
    c.item('Antros laiptinės durys', [8.8, 1.2, 1], [4, 2.4, 1.2], {
      h: 3, code: 'E001', see: 'Laiptinės išėjimas užkrautas šiltinimo medžiagų pakuotėmis iki pat durų viršaus. Pastate gyvena žmonės.',
      ok: 'Užkrautas gyvenamo pastato evakuacinis išėjimas',
      bad: ['Medžiagas prie durų galima laikyti iki 1,2 m aukščio', 'Pakuotes reikia tik uždengti nedegiu audiniu'],
      why: 'Evakuacijos keliai ir išėjimai, taip pat privažiavimai gaisrinėms mašinoms turi būti laisvi visą laiką – ypač kai pastatas renovuojamas su gyventojais ir prie fasado tvirtinamos degios medžiagos.' });
    c.item('Deginama statinė prie polistireno', [14.9, 1.1, 1.8], [4.6, 2.2, 3], {
      h: 3, code: 'P003', see: 'Statinėje deginamos statybinės atliekos. Už poros metrų – prie sienos sustatytos polistireninio putplasčio plokštės. Darbuotojas šildosi rankas.',
      ok: 'Atvira ugnis prie degių medžiagų; atliekos deginamos statybvietėje',
      bad: ['Statinė turi būti uždengta grotelėmis – tada deginti galima', 'Polistirenas nedega, pavojaus nėra'],
      why: 'Statybvietėje deginti atliekas draudžiama. Degios medžiagos sandėliuojamos atskirai, atokiai nuo pastato ir ugnies šaltinių, vieta paženklinama P003 „Atvira ugnis ir rūkymas draudžiami“ ir aprūpinama gesintuvais.' });
    c.item('Kabelis per pravažiavimą', [12.5, 0.2, 14.4], [6, 0.5, 2.6], {
      h: 2, code: 'W012', see: 'Laikinas 400 V kabelis nutiestas tiesiai ant asfalto per pravažiavimą. Per jį važinėja transportas, izoliacija vietomis sutraiškyta.',
      ok: 'Kabelis per pravažiavimą neapsaugotas nuo mechaninių pažeidimų',
      bad: ['Kabelis turi būti nudažytas geltonai, kad vairuotojai matytų', 'Per kabelį galima važiuoti ne greičiau kaip 5 km/h'],
      why: 'Laikini kabeliai virš pravažiavimų kabinami ne žemiau kaip 4,5 m (virš praėjimų – 2,5 m) arba klojami apsaugoti nuo mechaninių pažeidimų (kabelių tilteliuose, vamzdžiuose).' });
    c.item('Ardomas balkonas', [bxD, 3 * FH + 0.6, 1], [2.6, 2.6, 2.4], {
      h: 3, code: 'W008', see: 'Balkono turėklai jau nupjauti. Darbuotojas ant plokštės krašto dirba be apraišų, nuolaužos krenta žemyn. Zona apačioje neaptverta.',
      ok: 'Darbas aukštyje be apsaugos nuo kritimo, pavojaus zona apačioje neaptverta',
      bad: ['Balkonus ardyti leidžiama tik iš vidaus, pro langą', 'Trūksta tik tinklo nuo paukščių'],
      why: 'Aukščiau kaip 1,3 m dirbama nuo aptvertų pastolių ar keltuvo; jei tai neįmanoma – su apraišais, prisegtais prie inkaravimo taško. Griovimo darbų pavojaus zona apačioje aptveriama ir paženklinama (W035).' });
    c.item('Kopėčios ant palečių', [-16.3, 1.6, 11.6], [1.3, 3.3, 1.3], {
      h: 2, code: 'W008', see: 'Per trumpos kopėčios pastatytos ant dviejų palečių ir plytų, beveik stačiai (~86°). Viršus nepririštas ir nesiekia stogo krašto.',
      ok: 'Kopėčios ant nestabilaus pagrindo, per stačios ir per trumpos',
      bad: ['Kopėčios turi būti medinės ir ne ilgesnės kaip 2 m', 'Paletes po kopėčiomis reikia tik sukalti vinimis'],
      why: 'Kopėčios statomos ant tvirto, lygaus pagrindo, ne didesniu kaip 75° kampu, viršus – ne mažiau kaip 1 m virš užlipimo lygio, pritvirtintas. „Paaukštinimas“ paletėmis ir plytomis – tipinė kritimo priežastis.' });
    c.item('Bortelių pjovimas', [-4, 0.8, 18.6], [2.4, 1.6, 2.2], {
      h: 2, code: 'M003', see: 'Betonas pjaunamas benzininiu pjaustytuvu (lentelėje – 112 dB). Pjaunama sausai, darbuotojas be klausos, akių ir kvėpavimo takų apsaugos. Greta stovi kitas žmogus.',
      ok: 'Triukšmas viršija 85 dB(A), o klausos ir kitos AAP nenaudojamos; pjaunama sausai',
      bad: ['Pjaustytuvu galima dirbti tik po 18 val., kai gyventojai namie', 'Pakanka įprastų akinių nuo saulės'],
      why: 'Kai triukšmo ekspozicija siekia 85 dB(A), klausos AAP naudoti privaloma (nuo 80 dB(A) – jos turi būti pasiūlytos). Sausas pjovimas dar ir skleidžia kvarco dulkes – reikia drėkinimo arba nusiurbimo. ISO 7010 įspėjamojo ženklo triukšmui neturi; naudojamas įpareigojamasis M003.' });
    c.item('Kopėčios prie ūkinio pastato', [-21, 1.9, 13.2], [1, 3.8, 1.4], {
      see: 'Kopėčios ant tvirto pagrindo, ~72° kampu, viršus iškilęs virš stogo krašto daugiau kaip 1 m ir pririštas.',
      bad: ['Kopėčios turi stovėti visiškai stačiai', 'Kopėčių negalima rišti – jos turi likti laisvos', 'Kopėčios per ilgos – viršus negali kyšoti virš stogo'],
      why: 'Kampas ne didesnis kaip 75°, 1 m virš užlipimo lygio, pritvirtinta – atitinka. Palyginkite su kopėčiomis ant palečių.' });
    c.item('Pakabintas kabelis', [21, 2.4, 18.7], [0.7, 4.8, 6], {
      see: 'Laikinas kabelis pakabintas ant atramų 4,7 m aukštyje virš įvažiavimo.',
      bad: ['Kabelis turi kabėti ne žemiau kaip 10 m', 'Kabelius kabinti draudžiama – tik kloti ant žemės', 'Atramos turi būti metalinės ir įžemintos'],
      why: 'Virš pravažiavimų – ne žemiau kaip 4,5 m. 4,7 m atitinka.' });
    c.item('Šlapias pjovimas', [13, 0.8, 19.6], [2.6, 1.6, 2.2], {
      see: 'Pjaunama tiekiant vandenį. Darbuotojas su ausinėmis, akiniais, respiratoriumi ir šalmu; pašalinių šalia nėra.',
      bad: ['Pjaunant šlapiai ausinių nereikia', 'Vandenį naudoti draudžiama dėl elektros', 'Pjauti galima tik rankiniu pjūklu'],
      why: 'Drėgnasis būdas mažina dulkes, o AAP parinktos pagal rizikas – tvarkoje.' });
    c.item('Degių medžiagų aikštelė', [2, 1, 21.2], [4.2, 2, 2.4], {
      see: 'Polistirenas laikomas aptvertoje aikštelėje atokiai nuo pastato, su ženklu P003 ir gesintuvu.',
      bad: ['Polistireną privaloma laikyti pastato rūsyje', 'Ženklas P003 turi būti geltonas trikampis', 'Gesintuvas prie degių medžiagų draudžiamas'],
      why: 'Atskira, paženklinta ir gesintuvu aprūpinta sandėliavimo vieta – atitinka.' });
  },
},
];
