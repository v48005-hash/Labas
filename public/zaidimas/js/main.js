// DSS patikra – žaidimo variklis: scena, judėjimas, apžiūra, vertinimas, ataskaita.
import * as THREE from 'three';
import { Sky } from '../vendor/Sky.js';
import { makeMaterials, applyPhotoTextures, loadSkies, SKY_META } from './textures.js';
import { EffectComposer } from '../vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from '../vendor/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from '../vendor/jsm/postprocessing/OutputPass.js';
import * as P from './props.js';
import { freezeStatic } from './optimize.js';
import { LEVELS } from './levels.js';

const $ = id => document.getElementById(id);
const el = { hud: $('hud'), menu: $('menu'), brief: $('brief'), inspect: $('inspect'), pause: $('pause'), report: $('report'), loading: $('loading'), notes: $('notes') };
const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');

const SAVE_KEY = 'dss-patikra-v1';
const save = (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; } })();
save.best = save.best || {};
// Grafikos lygis: 0 – taupi, 1 – vidutinė (numatyta kompiuteryje), 2 – aukšta (su aplinkos šešėliavimu)
if (save.gfx === undefined) save.gfx = isTouch ? 0 : 1;
delete save.quality;
const GFX = [
  { name: 'taupi', pr: 0.75, shadow: 1024, shadowEvery: 6, lampEvery: 3, soft: false },
  { name: 'vidutinė', pr: 1, shadow: 2048, shadowEvery: 2, lampEvery: 2, soft: false },
  { name: 'aukšta', pr: 1.5, shadow: 2048, shadowEvery: 1, lampEvery: 1, soft: true },
];
const gfx = () => GFX[save.gfx] || GFX[1];
if (save.sound === undefined) save.sound = 1;
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* privatus režimas */ } };

// ---------- Renderer ----------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.type = THREE.PCFShadowMap;
const camera = new THREE.PerspectiveCamera(70, 1, 0.08, 900);
camera.rotation.order = 'YXZ';
const pmrem = new THREE.PMREMGenerator(renderer);
const M = makeMaterials();
P.setMaterials(M);

let SKIES = {}, envCache = {};
// Aukštos kokybės režimas: aplinkos šešėliavimas (GTAO) + MSAA per efektų grandinę
let composer = null, renderPass = null, aoPass = null;
let dynScale = 1;   // automatinis raiškos mažinimas, kai kadrų per mažai
function applyQuality() {
  const pr = Math.max(0.5, Math.min(devicePixelRatio || 1, gfx().pr) * dynScale);
  renderer.setPixelRatio(pr);
  renderer.shadowMap.enabled = true;
  // minkšti šešėliai (PCFSoft) gerokai brangesni – tik aukštoje kokybėje
  const st = gfx().soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  if (renderer.shadowMap.type !== st) { renderer.shadowMap.type = st; if (W) scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  if (composer) { composer.dispose(); composer = null; }
  if (W && W.sun) {
    const sm = gfx().shadow;
    if (W.sun.shadow.mapSize.x !== sm) { W.sun.shadow.mapSize.set(sm, sm); if (W.sun.shadow.map) { W.sun.shadow.map.dispose(); W.sun.shadow.map = null; } }
    W.sun.shadow.needsUpdate = true;
  }
  if (save.gfx === 2 && !/[?&]beao/.test(location.search)) {
    try {
      const w = Math.round(innerWidth * pr), h = Math.round(innerHeight * pr);
      const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
      composer = new EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(w, h);
      renderPass = new RenderPass(scene, camera);
      aoPass = new GTAOPass(scene, camera, w, h);
      aoPass.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 12, screenSpaceRadius: false });
      aoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 8 });
      aoPass.blendIntensity = 0.9;
      composer.addPass(renderPass); composer.addPass(aoPass); composer.addPass(new OutputPass());
    } catch (e) { console.warn('Efektų grandinė neįjungta:', e); composer = null; }
  }
}
addEventListener('resize', applyQuality);

// ---------- Būsena ----------
let scene = new THREE.Scene();
let L = null;            // aktyvus lygio aprašas
let W = null;            // pasaulio duomenys: colliders, occluders, items, anims
let mode = 'menu';       // menu | brief | play | inspect | pause | report
let run = null;          // einamos patikros rezultatai
const player = { x: 0, z: 0, yaw: 0, pitch: 0 };
const keys = {};
let zoom = false, target = null, flashlight = null;
const ray = new THREE.Raycaster();

function disposeScene(s) {
  s.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.userData.ownTex && o.material) { o.material.map && o.material.map.dispose(); o.material.dispose(); }
  });
  if (s.environment && s.userData.ownEnv) s.environment.dispose();
}

function buildLevel(idx) {
  disposeScene(scene);
  if (W) W.occluders.forEach(m => m.geometry.dispose());
  scene = new THREE.Scene();
  L = LEVELS[idx];
  W = { colliders: [], occluders: [], proxies: [], items: [], anims: [], idx };
  // Dangus – fotografinė panorama; saulės kryptis paimama iš jos. Atsarginis variantas – procedūrinis dangus.
  const skyName = L.sky || 'day', meta = SKY_META[skyName], skyTex = SKIES[skyName];
  let sunDir;
  if (skyTex) {
    const az = (meta.u - 0.5) * Math.PI * 2, el = THREE.MathUtils.degToRad(meta.elev);
    sunDir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    scene.background = skyTex; scene.backgroundIntensity = L.skyGain ?? 1.5;
    envCache[skyName] = envCache[skyName] || pmrem.fromEquirectangular(skyTex).texture;
    scene.environment = envCache[skyName];
    scene.environmentIntensity = L.interior ? 0.4 : 1.15;
  } else {
    sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - L.sun[0]), THREE.MathUtils.degToRad(L.sun[1]));
    const sky = new Sky(); sky.scale.setScalar(4000);
    const u = sky.material.uniforms;
    u.turbidity.value = 6; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.8;
    u.sunPosition.value.copy(sunDir);
    const envScene = new THREE.Scene(); envScene.add(sky);
    scene.environment = pmrem.fromScene(envScene, 0, 1, 5000).texture; scene.userData.ownEnv = true;
    scene.environmentIntensity = L.interior ? 0.22 : 0.55;
    scene.add(sky);
  }
  const fogCol = new THREE.Color(skyTex ? meta.horizon : (L.fog || 0xb9c6d2));
  scene.fog = new THREE.Fog(fogCol, 80, L.fogFar || 520);
  renderer.toneMappingExposure = L.exposure ?? 0.64;

  const sun = new THREE.DirectionalLight(skyTex ? meta.sunColor : 0xfff1dc, L.sunPower ?? (skyTex ? meta.sun : 3.2));
  const c = L.center || [0, 0];
  sun.position.set(c[0], L.floorY, c[1]).addScaledVector(sunDir, 120);
  sun.target.position.set(c[0], L.floorY, c[1]);
  sun.castShadow = true;
  const sm = gfx().shadow; sun.shadow.mapSize.set(sm, sm);
  // šešėliai perskaičiuojami ne kiekvieną kadrą (žr. tick)
  sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = true; W.sun = sun;
  const sc = sun.shadow.camera, R = L.shadowR || 46;
  sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 10; sc.far = 260;
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xbcd4ee, 0x6b5f52, L.interior ? 0.3 : (skyTex ? meta.hemi : 0.75)));

  // Tolimas reljefas ir miestas
  const landMat = M.grass;
  const land = P.slabWithHoles(-800, -800, 800, 800, L.landHole ? [L.landHole] : [], landMat, -0.06, 0.1);
  land.traverse(m => { m.castShadow = false; }); scene.add(land);
  scene.add(P.city(L.cityR || 170, 48, idx + 3));

  // Žibintuvėlis – tik patalpose. Lauke jo šviesa nereikalinga, o kiekvienas šaltinis brangina kiekvieną pikselį.
  // Patalpose jis lieka scenoje net išjungtas (intensyvumas 0), kad įjungiant nebūtų perkompiliuojamos medžiagos.
  if (flashlight) camera.remove(flashlight, flashlight.target);
  flashlight = new THREE.SpotLight(0xfff4dd, 0, 26, 0.5, 0.5, 1.2);
  flashlight.position.set(0.2, -0.15, 0); flashlight.target.position.set(0, 0, -4);
  if (L.interior) camera.add(flashlight, flashlight.target);
  scene.add(camera);

  const ctx = {
    M, P, THREE, scene,
    // Be koordinačių – objektas lieka ten, kur sukurtas
    add(o, x, y = 0, z = 0, ry) { if (x !== undefined) o.position.set(x, y, z); if (ry !== undefined) o.rotation.y = ry; scene.add(o); return o; },
    wall(x0, z0, x1, z1) { W.colliders.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]); },
    // Kietas objektas: pridedamas, užstoja žvilgsnį ir kelią
    solid(o, x, y = 0, z = 0, ry, collide = true) {
      ctx.add(o, x, y, z, ry); o.updateMatrixWorld(true);
      o.traverse(m => m.isMesh && W.occluders.push(m));
      if (collide) { const b = new THREE.Box3().setFromObject(o); ctx.wall(b.min.x, b.min.z, b.max.x, b.max.z); }
      return o;
    },
    item(name, pos, size, def) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ visible: false }));
      m.position.set(...pos); scene.add(m);
      const it = { name, pos, size, ...def, hazard: !!def.h, state: null, proxy: m };
      m.userData.item = it; W.proxies.push(m); W.items.push(it);
      return it;
    },
    anim(fn) { W.anims.push(fn); },
    // kiekvienas taškinis šaltinis brangina kiekvieną pikselį – žemesnėje kokybėje dedama tik dalis (stipresnių)
    lamp(x, y, z, power = 30, dist = 14, color = 0xffe9c0) {
      const every = gfx().lampEvery, l = new THREE.PointLight(color, power * (1 + (every - 1) * 0.7), dist, 1.6); l.position.set(x, y, z);
      if (((W.lamps = (W.lamps || 0) + 1) - 1) % every === 0) scene.add(l);
      return l;
    },
  };
  L.build(ctx);
  W.center = L.center;
  const t0 = performance.now(), st = freezeStatic(scene, W);
  W.stats = { ...st, ms: Math.round(performance.now() - t0) };
  W.rayTargets = W.proxies.concat(W.occluders);
  // nematomas žymeklis po žeme – kad pirmoji apžiūros žyma nesukeltų kompiliavimo trūkčiojimo
  const warm = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true, map: M.dirt.map }));
  warm.position.set(0, -50, 0); warm.scale.setScalar(0.01); scene.add(warm);
  scene.updateMatrixWorld(true);
  player.x = L.spawn[0]; player.z = L.spawn[1]; player.yaw = L.spawn[2] || 0; player.pitch = 0;
  setLight(false);
}

// ---------- Judėjimas ----------
function blocked(x, z) {
  const r = 0.32, b = L.bounds;
  if (x < b[0] + r || x > b[2] - r || z < b[1] + r || z > b[3] - r) return true;
  for (const c of W.colliders) if (x > c[0] - r && x < c[2] + r && z > c[1] - r && z < c[3] + r) return true;
  return false;
}
const stick = { x: 0, y: 0 };
function movePlayer(dt) {
  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - stick.y;
  let s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + stick.x;
  if (keys.ArrowLeft) player.yaw += dt * 1.8; if (keys.ArrowRight) player.yaw -= dt * 1.8;
  const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
  const sp = (keys.ShiftLeft || keys.ShiftRight ? 5.6 : 3.1) * dt;
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  const dx = (-sin * f + cos * s) * sp, dz = (-cos * f - sin * s) * sp;
  if (!blocked(player.x + dx, player.z)) player.x += dx;
  if (!blocked(player.x, player.z + dz)) player.z += dz;
  return len > 0.1 ? sp / dt : 0;
}

let bob = 0;
function updateCamera(dt, speed) {
  bob += speed * dt * 2.1;
  const by = speed ? Math.sin(bob) * 0.028 : 0;
  camera.position.set(player.x, L.floorY + 1.7 + by, player.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
  const fov = zoom ? 20 : 70;
  if (Math.abs(camera.fov - fov) > 0.1) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 12); camera.updateProjectionMatrix(); }
}

function look(dx, dy) {
  const k = (zoom ? 0.0007 : 0.0022);
  player.yaw -= dx * k; player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - dy * k));
}

// ---------- Apžiūra ----------
function findTarget() {
  ray.setFromCamera({ x: 0, y: 0 }, camera);
  ray.far = (L.range || 9) * (zoom ? 3 : 1);
  const hits = ray.intersectObjects(W.rayTargets, false);
  const h = hits[0];
  target = h && h.object.userData.item && !h.object.userData.item.state ? h.object.userData.item : null;
  $('crosshair').classList.toggle('on', !!target);
  const p = $('prompt');
  if (target) { p.innerHTML = isTouch ? `Tikrinti: ${target.name}` : `<kbd>E</kbd> Tikrinti: ${target.name}`; p.classList.remove('hidden'); }
  else p.classList.add('hidden');
}

const NONE = 'Pažeidimų nėra – atitinka reikalavimus';
const SEV = { 3: 'Kritinis', 2: 'Reikšmingas', 1: 'Nedidelis' };
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; }

function openInspect(it) {
  if (!it) return;
  setMode('inspect');
  const correct = it.hazard ? it.ok : NONE;
  const opts = shuffle([...(it.hazard ? [it.ok, ...it.bad.slice(0, 2)] : it.bad.slice(0, 3))]);
  opts.push(NONE);
  const box = $('inspectBox');
  box.innerHTML = `<div class="eyebrow">Apžiūrimas objektas</div><h2>${it.name}</h2>
    <p>${it.see || 'Įvertinkite, ką matote.'}</p><h3>Jūsų vertinimas</h3>
    <div id="opts"></div><div id="verdict"></div>`;
  const wrap = box.querySelector('#opts');
  opts.forEach(o => {
    const b = document.createElement('button'); b.className = 'opt'; b.textContent = o;
    b.onclick = () => answer(it, o === correct, b, correct);
    wrap.appendChild(b);
  });
}

function answer(it, right, btn, correct) {
  document.querySelectorAll('#opts .opt').forEach(b => { b.disabled = true; if (b.textContent === correct) b.classList.add('right'); });
  if (!right) btn.classList.add('wrong');
  const pts = right ? (it.hazard ? it.h * 100 : 50) : -75;
  it.state = right ? 'ok' : 'wrong'; it.pts = pts;
  run.score += pts;
  if (it.hazard && right) run.found++;
  beep(right);
  addMarker(it, right);
  const tags = (it.hazard ? `<span class="tag s${it.h}">${SEV[it.h]} pažeidimas</span>` : '<span class="tag" style="background:#1f8a4c">Atitinka</span>') + (it.code ? `<span class="tag iso">ISO 7010 ${it.code}</span>` : '');
  $('verdict').innerHTML = `<div class="verdict ${right ? '' : 'bad'}"><b>${right ? 'Teisingai' : 'Neteisingai'} (${pts > 0 ? '+' : ''}${pts} tšk.)</b><br>${tags}<br>${it.why}</div>
    <div class="row"><button class="btn primary" id="btnCont">Tęsti patikrą</button></div>`;
  $('btnCont').onclick = () => { setMode('play'); lockPointer(); };
  updateHud();
}

function addMarker(it, right) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 96; const c = cv.getContext('2d');
  c.beginPath(); c.arc(48, 48, 42, 0, 7); c.fillStyle = right ? (it.hazard ? '#d1201c' : '#1f9d55') : '#555'; c.fill(); c.lineWidth = 6; c.strokeStyle = '#fff'; c.stroke();
  c.fillStyle = '#fff'; c.font = 'bold 60px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(right ? (it.hazard ? '!' : '✓') : '?', 48, 52);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }));
  sp.userData.ownTex = true; sp.material.map.colorSpace = THREE.SRGBColorSpace;
  sp.position.set(it.pos[0], it.pos[1] + it.size[1] / 2 + 0.3, it.pos[2]); sp.scale.setScalar(0.45); sp.renderOrder = 99;
  sp.material.sizeAttenuation = true; scene.add(sp);
}

// ---------- HUD / ekranai ----------
function fmt(t) { t = Math.max(0, Math.ceil(t)); return String((t / 60) | 0).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }
function updateHud() {
  const tot = W.items.filter(i => i.hazard).length;
  $('hudFound').textContent = `${run.found}/${tot}`; $('hudScore').textContent = run.score;
  const t = $('hudTime'); t.textContent = fmt(run.time); t.classList.toggle('low', run.time < 60);
}
let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 2600); }

let stillFrames = 0;
function setMode(m) {
  mode = m; stillFrames = 0;
  el.menu.classList.toggle('hidden', m !== 'menu');
  el.brief.classList.toggle('hidden', m !== 'brief');
  el.inspect.classList.toggle('hidden', m !== 'inspect');
  el.pause.classList.toggle('hidden', m !== 'pause');
  el.report.classList.toggle('hidden', m !== 'report');
  el.hud.classList.toggle('hidden', !(m === 'play' || m === 'inspect' || m === 'pause'));
  if (m !== 'play') { el.notes.classList.add('hidden'); if (document.pointerLockElement) document.exitPointerLock(); zoom = false; }
  for (const k in keys) keys[k] = false;
  // kad Enter / tarpas „nepaspaustų“ ką tik uždaryto lango mygtuko
  if (m === 'play' && document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
}
function lockPointer() { if (!isTouch && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); p && p.catch && p.catch(() => {}); } catch { /* */ } } }

function stars(n) { return '★'.repeat(n) + '☆'.repeat(3 - n); }
function unlocked(i) { return i === 0 || (save.best[LEVELS[i - 1].id] && save.best[LEVELS[i - 1].id].stars > 0) || /[?&]atrakinti/.test(location.search); }

function renderMenu() {
  const box = $('levels'); box.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const b = document.createElement('button'), best = save.best[lv.id], open = unlocked(i);
    b.className = 'lvl' + (open ? '' : ' locked');
    b.innerHTML = `<div class="n">${i + 1} lygis · ${lv.site}</div><div class="t">${lv.title}</div><div class="s">${lv.short}</div>
      <div class="st">${open ? (best ? stars(best.stars) + `<small>${best.score} tšk.</small>` : '☆☆☆<small>nepatikrinta</small>') : '🔒 <small>išlaikykite ankstesnį lygį</small>'}</div>`;
    if (open) b.onclick = () => showBrief(i);
    box.appendChild(b);
  });
}

// Šešėliavimo programos sukompiliuojamos iš anksto (kol rodomas užkrovimo ekranas), kad žaidžiant nestrigtų
async function precompile() {
  try { await (renderer.compileAsync ? renderer.compileAsync(scene, camera) : renderer.compile(scene, camera)); } catch { /* nebūtina */ }
}
function withLoading(fn) {
  el.loading.classList.remove('hidden');
  setTimeout(async () => { fn(); await precompile(); el.loading.classList.add('hidden'); }, 40);
}

function showBrief(i) {
  withLoading(() => {
    if (!W || W.idx !== i || run) buildLevel(i);
    run = null;
    const lv = LEVELS[i], nh = W.items.filter(x => x.hazard).length;
    $('briefBox').innerHTML = `<div class="eyebrow">${i + 1} lygis · ${lv.site}</div><h2>${lv.title}</h2>
      <p>${lv.brief}</p>
      <h3>Užduotis</h3>
      <ul class="tight"><li>Apeikite objektą ir apžiūrėkite įtartinas vietas (<b>${nh}</b> pažeidimai).</li>
      <li>Kiekvienai vietai parinkite teisingą vertinimą. Ne viskas, kas atrodo įtartinai, yra pažeidimas.</li>
      <li>Teisingai įvertintas pažeidimas: +100…300 tšk. pagal pavojingumą; tvarkinga vieta: +50; klaida: −75.</li>
      <li>Laikas: ${fmt(lv.time)}. Baigę spauskite <b>Enter</b> (arba „Baigti“) – bus surašytas patikrinimo aktas.</li></ul>
      <h3>Sąlygos objekte</h3><p>${lv.weather}</p>
      <h3>Valdymas</h3><p>${isTouch ? 'Kairėje – judėjimo svirtis, dešinėje ekrano pusėje braukite, kad apsidairytumėte. „Tikrinti“ – apžiūrėti objektą taikiklyje, 🔍 – priartinti.' : 'W A S D – judėti, pelė – dairytis, E arba kairys pelės klavišas – tikrinti, Z arba dešinys – priartinti (žiūronai), F – žibintuvėlis, Esc – pauzė.'}</p>
      <div class="row"><button class="btn primary" id="btnGo">Pradėti patikrą</button><button class="btn ghost" id="btnBack">Atgal</button></div>`;
    $('btnGo').onclick = () => startRun();
    $('btnBack').onclick = () => { setMode('menu'); renderMenu(); };
    setMode('brief');
  });
}

function startRun() {
  run = { score: 0, found: 0, time: L.time, t0: performance.now() };
  $('hudSite').innerHTML = `<b>${L.title}</b><br>${L.site}`;
  $('hudWeather').textContent = L.weatherShort || '';
  if (L.interior) setLight(true);
  lookFrom = performance.now() + 300;
  setMode('play'); updateHud(); lockPointer(); startAmbient();
  toast('Patikra pradėta. Raskite pažeidimus!');
}

function finishRun(timeout) {
  const hz = W.items.filter(i => i.hazard), max = hz.reduce((s, i) => s + i.h * 100, 0);
  const allFound = hz.every(i => i.state === 'ok');
  const bonus = allFound ? Math.round(run.time) : 0;
  run.score += bonus;
  const pct = Math.max(0, run.score) / max, st = pct >= 0.9 ? 3 : pct >= 0.72 ? 2 : pct >= 0.5 ? 1 : 0;
  const prev = save.best[L.id];
  if (!prev || run.score > prev.score) save.best[L.id] = { score: run.score, stars: Math.max(st, prev ? prev.stars : 0) };
  else if (st > prev.stars) prev.stars = st;
  persist();
  const row = (cls, ic, it, note) => `<tr><td class="${cls}">${ic}</td><td><b>${it.name}</b> ${it.hazard ? `<span class="tag s${it.h}">${SEV[it.h]}</span>` : ''}${it.code ? `<span class="tag iso">${it.code}</span>` : ''}<br>
      ${note ? `<i>${note}</i><br>` : ''}${it.hazard ? `<b>Pažeidimas:</b> ${it.ok}. ` : ''}${it.why}</td></tr>`;
  const ok = hz.filter(i => i.state === 'ok'), miss = hz.filter(i => !i.state), wrong = W.items.filter(i => i.state === 'wrong');
  const decoyOk = W.items.filter(i => !i.hazard && i.state === 'ok').length;
  const critMiss = miss.filter(i => i.h === 3).length;
  const verdict = st === 0 ? 'Patikra neišlaikyta – per daug pavojų liko nepastebėta arba įvertinta klaidingai.' :
    critMiss ? `Patikra įskaityta, tačiau liko ${critMiss} nepastebėtas kritinis pažeidimas – tikroje statybvietėje tai galėjo baigtis sunkiu nelaimingu atsitikimu.` :
      (miss.length ? 'Gera patikra. Keli pažeidimai liko nepastebėti – peržiūrėkite juos žemiau.' : 'Puiku – visi pažeidimai rasti ir įvertinti teisingai.');
  const next = W.idx + 1 < LEVELS.length && unlocked(W.idx + 1);
  $('reportBox').innerHTML = `<div class="eyebrow">Patikrinimo aktas · ${L.site}</div><h2>${L.title}</h2>
    <div class="stars">${stars(st)}</div>
    <div class="kpis"><div><span>Taškai</span><b class="big">${run.score}</b></div><div><span>Rasta pažeidimų</span><b class="big">${ok.length}/${hz.length}</b></div>
    <div><span>Klaidingi vertinimai</span><b class="big">${wrong.length}</b></div><div><span>Teisingai pripažinta tvarkingais</span><b class="big">${decoyOk}</b></div>
    <div><span>Laiko premija</span><b class="big">+${bonus}</b></div></div>
    <p>${timeout ? '<b>Baigėsi laikas.</b> ' : ''}${verdict}</p>
    ${miss.length ? `<h3>Nepastebėti pažeidimai</h3><table class="rep">${miss.map(i => row('c-miss', '○', i)).join('')}</table>` : ''}
    ${wrong.length ? `<h3>Klaidingai įvertinta</h3><table class="rep">${wrong.map(i => row('c-bad', '✖', i, i.hazard ? 'Pažeidimas įvardytas netiksliai.' : 'Ši vieta atitiko reikalavimus.')).join('')}</table>` : ''}
    ${ok.length ? `<h3>Teisingai nustatyti pažeidimai</h3><table class="rep">${ok.map(i => row('c-ok', '✔', i)).join('')}</table>` : ''}
    <div class="row">${next ? '<button class="btn primary" id="btnNext">Kitas objektas</button>' : ''}<button class="btn ${next ? '' : 'primary'}" id="btnRetry">Kartoti patikrą</button><button class="btn ghost" id="btnMenu">Į meniu</button></div>`;
  const idx = W.idx;
  if (next) $('btnNext').onclick = () => showBrief(idx + 1);
  $('btnRetry').onclick = () => showBrief(idx);
  $('btnMenu').onclick = () => { setMode('menu'); renderMenu(); };
  setMode('report'); stopAmbient();
}

function toggleNotes() {
  const n = el.notes; if (!n.classList.contains('hidden')) { n.classList.add('hidden'); return; }
  const done = W.items.filter(i => i.state);
  n.innerHTML = `<div class="eyebrow">Patikros užrašai</div>` + (done.length ? done.map(i => `<div class="n"><span class="${i.state === 'ok' ? (i.hazard ? 'c-bad' : 'c-ok') : 'c-miss'}">${i.state === 'ok' ? (i.hazard ? '⚠' : '✔') : '✖'}</span> ${i.name}${i.state === 'ok' && i.hazard ? ' – ' + i.ok : ''}</div>`).join('') : '<p>Dar nieko neapžiūrėjote.</p>');
  n.classList.remove('hidden');
}
function setLight(on) { flashlight.userData.on = on; flashlight.intensity = on ? 60 : 0; }
function toggleLight() { if (!L.interior) { toast('Žibintuvėlis reikalingas tik patalpose'); return; } setLight(!flashlight.userData.on); }

// ---------- Garsas ----------
let actx = null, amb = null;
function audio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* */ } } return actx; }
function beep(good) {
  if (!save.sound || !audio()) return;
  const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
  o.type = good ? 'sine' : 'square'; o.frequency.setValueAtTime(good ? 660 : 180, t); if (good) o.frequency.setValueAtTime(990, t + 0.09);
  g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.32);
}
function startAmbient() {
  stopAmbient(); if (!save.sound || !audio()) return;
  const len = actx.sampleRate * 3, buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
  let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = L.interior ? 260 : 700;
  const g = actx.createGain(); g.gain.value = L.interior ? 0.1 : 0.22;
  src.connect(f).connect(g).connect(actx.destination); src.start(); amb = src;
}
function stopAmbient() { if (amb) { try { amb.stop(); } catch { /* */ } amb = null; } }

// ---------- Įvestis ----------
addEventListener('keydown', e => {
  if (mode === 'play') {
    keys[e.code] = true;
    if (e.code === 'KeyE') openInspect(target);
    else if (e.code === 'KeyZ') zoom = true;
    else if (e.code === 'KeyF') toggleLight();
    else if (e.code === 'Tab') { e.preventDefault(); toggleNotes(); }
    else if (e.code === 'Enter') { e.preventDefault(); setMode('pause'); $('btnFinish').focus(); }
    else if (e.code === 'Escape' || e.code === 'KeyP') setMode('pause');
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  } else if (mode === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) { setMode('play'); lockPointer(); }
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'KeyZ') zoom = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
canvas.addEventListener('mousedown', e => {
  if (mode !== 'play' || isTouch) return;
  if (document.pointerLockElement !== canvas) { lockPointer(); if (e.button === 0) return; }
  if (e.button === 0) openInspect(target); else if (e.button === 2) zoom = true;
});
addEventListener('mouseup', e => { if (e.button === 2) zoom = false; });
addEventListener('contextmenu', e => e.preventDefault());
// Saugikliai: pirmas judesys po pelės „užrakinimo“ kai kuriose naršyklėse būna netikras šuolis
let lookFrom = 0;
document.addEventListener('pointerlockchange', () => { lookFrom = performance.now() + 150; });
addEventListener('mousemove', e => {
  if (mode !== 'play' || performance.now() < lookFrom) return;
  if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
  if (document.pointerLockElement === canvas || (e.buttons & 1 && e.target === canvas)) look(e.movementX, e.movementY);
});
let lockLostAt = 0;
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && mode === 'play' && !isTouch) { lockLostAt = performance.now(); setMode('pause'); }
});

// Lietimas
if (isTouch) {
  const st = $('stick'), kn = $('knob'); let sid = null, lid = null, lx = 0, ly = 0;
  const setKnob = (x, y) => { kn.style.left = 35 + x * 40 + 'px'; kn.style.top = 35 + y * 40 + 'px'; stick.x = x; stick.y = y; };
  st.addEventListener('touchstart', e => { sid = e.changedTouches[0].identifier; e.preventDefault(); }, { passive: false });
  addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === sid) { const r = st.getBoundingClientRect(); let x = (t.clientX - r.left - 60) / 50, y = (t.clientY - r.top - 60) / 50; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } setKnob(x, y); }
      else if (t.identifier === lid && mode === 'play') { look((t.clientX - lx) * 2.2, (t.clientY - ly) * 2.2); lx = t.clientX; ly = t.clientY; }
    }
  }, { passive: false });
  addEventListener('touchend', e => { for (const t of e.changedTouches) { if (t.identifier === sid) { sid = null; setKnob(0, 0); } if (t.identifier === lid) lid = null; } });
  canvas.addEventListener('touchstart', e => { const t = e.changedTouches[0]; lid = t.identifier; lx = t.clientX; ly = t.clientY; audio(); }, { passive: true });
  const tap = (id, fn) => $(id).addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); if (mode === 'play') fn(); }, { passive: false });
  tap('tInspect', () => openInspect(target)); tap('tZoom', () => { zoom = !zoom; }); tap('tLight', toggleLight); tap('tNotes', toggleNotes);
  tap('tEnd', () => setMode('pause'));
}

$('btnResume').onclick = () => { setMode('play'); lockPointer(); };
$('btnFinish').onclick = () => finishRun(false);
$('btnQuit').onclick = () => { run = null; stopAmbient(); setMode('menu'); renderMenu(); };
const qLabel = () => { $('btnQuality').textContent = 'Grafika: ' + gfx().name; $('btnSound').textContent = 'Garsas: ' + (save.sound ? 'įjungtas' : 'išjungtas'); };
$('btnQuality').onclick = () => { save.gfx = (save.gfx + 1) % GFX.length; dynScale = 1; persist(); applyQuality(); qLabel(); };
$('btnSound').onclick = () => { save.sound = save.sound ? 0 : 1; persist(); qLabel(); save.sound ? startAmbient() : stopAmbient(); };
qLabel();
if (location.pathname.startsWith('/static/')) $('homeLink').classList.remove('hidden');
// Patvirtinimas be confirm() – jis neveikia įterptuose (sandbox) rėmeliuose
let resetArmed = 0;
$('resetProgress').onclick = e => {
  e.preventDefault(); const a = e.currentTarget;
  if (Date.now() - resetArmed < 4000) { save.best = {}; persist(); renderMenu(); a.textContent = 'Pažanga ištrinta'; resetArmed = 0; }
  else { resetArmed = Date.now(); a.textContent = 'Tikrai ištrinti? Spauskite dar kartą'; }
};

// ---------- Ciklas ----------
const clock = new THREE.Clock();
let menuAng = 0, frame = 0;
function tick() {
  requestAnimationFrame(tick);
  const rawDt = clock.getDelta(), dt = Math.min(rawDt, 0.05), t = clock.elapsedTime;
  if (!W) return;
  for (const a of W.anims) a(t, dt);
  if (mode === 'play') {
    const sp = movePlayer(dt); updateCamera(dt, sp);
    if (frame++ % 3 === 0) findTarget();
    run.time -= dt;
    if ((frame & 15) === 0) updateHud();
    if (run.time <= 0) finishRun(true);
  } else if (mode === 'menu' || mode === 'brief') {
    menuAng += dt * 0.05;
    const c = L.center || [0, 0], r = L.menuR || 34, ma = L.menuArc ? L.menuArc[0] + Math.sin(menuAng * 2) * L.menuArc[1] : menuAng;
    camera.position.set(c[0] + Math.cos(ma) * r, L.floorY + (L.menuH || 9), c[1] + Math.sin(ma) * r);
    camera.lookAt(c[0], L.floorY + (L.menuLook ?? 3), c[1]);
    if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
  }
  // kai scena uždengta langu (apžiūra, pauzė, aktas), ji nebeperpiešiama – taupoma baterija ir vaizdo plokštė
  if ((mode === 'inspect' || mode === 'pause' || mode === 'report') && ++stillFrames > 2) return;
  if (W.sun && frame % gfx().shadowEvery === 0) W.sun.shadow.needsUpdate = true;
  if (mode !== 'play') frame++;
  if (composer) { renderPass.scene = aoPass.scene = scene; composer.render(dt); } else renderer.render(scene, camera);
  if (mode === 'play') adapt(rawDt);
}

// Automatinis prisitaikymas: jei kadrų mažiau nei ~40 per sekundę, mažinama raiška, o vėliau ir grafikos lygis
const perf = { t: 0, n: 0, good: 0 }, NO_ADAPT = /[?&]noadapt/.test(location.search);
function adapt(dt) {
  if (document.hidden || dt > 0.5 || NO_ADAPT) return;
  perf.t += dt; perf.n++;
  if (perf.t < 1.5) return;
  const avg = perf.t / perf.n; perf.t = 0; perf.n = 0;
  if (avg > 1 / 40) {
    perf.good = 0;
    if (composer) { save.gfx = 1; persist(); applyQuality(); qLabel(); toast('Grafika sumažinta, kad žaidimas nestrigtų'); return; }
    if (dynScale > 0.55) { dynScale = Math.max(0.55, dynScale * 0.82); applyQuality(); return; }
    if (save.gfx > 0) { save.gfx--; dynScale = 1; persist(); applyQuality(); qLabel(); toast('Grafika sumažinta, kad žaidimas nestrigtų'); }
  } else if (avg < 1 / 55 && dynScale < 1 && ++perf.good >= 3) { perf.good = 0; dynScale = Math.min(1, dynScale * 1.12); applyQuality(); }
}

// Pradžia: meniu fone – paskutinis atrakintas objektas
let startIdx = 0; LEVELS.forEach((_, i) => { if (unlocked(i)) startIdx = i; });
if (/[?&]atrakinti/.test(location.search)) startIdx = 2;
(async () => {
  el.loading.classList.remove('hidden');
  applyQuality();
  [SKIES] = await Promise.all([loadSkies(), applyPhotoTextures(M)]);
  buildLevel(Math.min(startIdx, LEVELS.length - 1));
  await precompile();
  renderMenu(); setMode('menu'); el.loading.classList.add('hidden'); tick();
})();

// Testavimo sąsaja
window.__dss = {
  get state() { return { mode, level: W.idx, run, items: W.items.map(i => ({ name: i.name, hazard: i.hazard, state: i.state, pos: i.pos })) }; },
  start(i) { buildLevel(i); startRun(); },
  tp(x, z, yaw = 0, pitch = 0) { player.x = x; player.z = z; player.yaw = yaw; player.pitch = pitch; },
  lookAt(i, dist = 5, ang = 0) {
    const it = W.items[i], x = it.pos[0] + Math.sin(ang) * dist, z = it.pos[2] + Math.cos(ang) * dist;
    player.x = x; player.z = z; const dy = it.pos[1] - (L.floorY + 1.7);
    player.yaw = Math.atan2(x - it.pos[0], z - it.pos[2]); player.pitch = Math.atan2(dy, dist);
  },
  get scene() { return scene; }, stats: () => ({ ...W.stats, gfx: save.gfx, dynScale, pr: renderer.getPixelRatio() }), zoom(v) { zoom = v; }, finish() { finishRun(false); }, info: () => renderer.info.render, blocked,
};
