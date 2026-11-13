// Procedūrinės PBR medžiagos – visos tekstūros generuojamos naršyklėje, be išorinių failų.
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Kartojamas (tileable) fraktalinis triukšmas
function fbm(size, seed, oct = 5, base = 4) {
  const out = new Float32Array(size * size);
  let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const n = base << o, r = rng(seed + o * 131), g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = r();
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * n, y0 = Math.floor(fy), ty = fy - y0, y1 = (y0 + 1) % n, sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * n, x0 = Math.floor(fx), tx = fx - x0, x1 = (x0 + 1) % n, sx = tx * tx * (3 - 2 * tx);
        const a = g[y0 * n + x0], b = g[y0 * n + x1], c = g[y1 * n + x0], d = g[y1 * n + x1];
        out[y * size + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
      }
    }
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

function canvasTex(cv, srgb = true) {
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// pix(x, y, i) -> [r, g, b, aukštis 0..1]
function build(size, pix, nStrength = 2) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(size, size);
  const H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, p = pix(x, y, i);
    img.data[i * 4] = p[0]; img.data[i * 4 + 1] = p[1]; img.data[i * 4 + 2] = p[2]; img.data[i * 4 + 3] = 255;
    H[i] = p[3];
  }
  ctx.putImageData(img, 0, 0);
  const nc = document.createElement('canvas'); nc.width = nc.height = size;
  const nx = nc.getContext('2d'), nimg = nx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const l = H[y * size + ((x - 1 + size) % size)], r = H[y * size + ((x + 1) % size)];
    const u = H[((y - 1 + size) % size) * size + x], d = H[((y + 1) % size) * size + x];
    let vx = (l - r) * nStrength, vy = (d - u) * nStrength, vz = 1;
    const len = Math.hypot(vx, vy, vz); vx /= len; vy /= len; vz /= len;
    nimg.data[i * 4] = (vx * 0.5 + 0.5) * 255; nimg.data[i * 4 + 1] = (vy * 0.5 + 0.5) * 255;
    nimg.data[i * 4 + 2] = (vz * 0.5 + 0.5) * 255; nimg.data[i * 4 + 3] = 255;
  }
  nx.putImageData(nimg, 0, 0);
  return { map: canvasTex(cv), normalMap: canvasTex(nc, false) };
}

const mix = (a, b, t) => a + (b - a) * t;
const S = 512;

function std(tex, { texSize = 2, ...o } = {}) {
  const m = new THREE.MeshStandardMaterial({ map: tex.map, normalMap: tex.normalMap, roughness: 0.9, metalness: 0, ...o });
  m.userData.texSize = texSize;
  return m;
}
function flat(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o }); }

export function makeMaterials() {
  const M = {};
  const n1 = fbm(S, 11), n2 = fbm(S, 23, 6, 8), n3 = fbm(S, 37, 4, 2), n4 = fbm(S, 51, 6, 16);
  const r = rng(7);
  const specks = new Float32Array(S * S);
  for (let k = 0; k < 2600; k++) specks[(r() * S * S) | 0] = r();

  // Betonas su klojinių siūlėmis ir poromis
  let t = build(S, (x, y, i) => {
    let h = n1[i] * 0.5 + n2[i] * 0.5;
    let c = 128 + h * 62 + (n3[i] - 0.5) * 34;
    const seam = (x % 256 < 2) || (y % 128 < 2);
    if (seam) { c -= 26; h -= 0.25; }
    if (specks[i] > 0.55) { c -= 45 * specks[i]; h -= 0.5; }
    return [c, c * 0.985, c * 0.95, h];
  }, 2.2);
  M.concrete = std(t, { roughness: 0.93, texSize: 2.4 });
  M.concreteDark = std(t, { roughness: 0.95, color: 0x9a9a98, texSize: 2.4 });
  M.concreteNew = std(t, { roughness: 0.6, color: 0xb8bcc0, texSize: 3 });

  // Gruntas
  t = build(S, (x, y, i) => {
    const h = n2[i] * 0.6 + n4[i] * 0.4, m = n3[i];
    let rr = mix(92, 138, h) + m * 22, gg = mix(70, 108, h) + m * 16, bb = mix(48, 74, h) + m * 8;
    if (specks[i] > 0.4) { const s = 60 * specks[i]; rr += s; gg += s; bb += s; }
    return [rr, gg, bb, h + specks[i] * 0.6];
  }, 3.5);
  M.dirt = std(t, { roughness: 1, texSize: 3 });
  M.dirtDark = std(t, { roughness: 1, color: 0x9a8c7c, texSize: 3 });

  // Žvyras / skalda
  t = build(S, (x, y, i) => {
    const h = n4[i], c = 105 + h * 85 + (n1[i] - 0.5) * 30;
    return [c, c * 0.97, c * 0.92, h];
  }, 4);
  M.gravel = std(t, { roughness: 1, texSize: 2 });

  // Asfaltas
  t = build(S, (x, y, i) => {
    const h = n4[i], c = 46 + h * 34 + (n3[i] - 0.5) * 16 + specks[i] * 50;
    return [c, c, c * 1.03, h];
  }, 2);
  M.asphalt = std(t, { roughness: 0.95, texSize: 3 });

  // Mediena (lentos)
  const wood = (base, seamEvery) => build(S, (x, y, i) => {
    const gi = ((y * 6) % S) * S + ((x >> 3) % S);
    const g = n2[gi] * 0.7 + n4[i] * 0.3;
    let h = g;
    const plank = (y / seamEvery) | 0, pv = ((plank * 73) % 11) / 11 - 0.5;
    let k = 0.72 + g * 0.42 + pv * 0.16;
    if (y % seamEvery < 2) { k *= 0.45; h -= 0.6; }
    return [base[0] * k, base[1] * k, base[2] * k, h];
  }, 2.6);
  M.wood = std(wood([188, 148, 96], 64), { roughness: 0.85, texSize: 1.2 });
  M.woodOld = std(wood([140, 118, 92], 64), { roughness: 0.95, texSize: 1.2 });
  M.plywood = std(wood([214, 172, 96], 256), { roughness: 0.7, texSize: 2.5 });
  M.formwork = std(wood([196, 96, 44], 256), { roughness: 0.6, texSize: 2.5 });

  // Plytų mūras
  const brick = (cr, cg, cb) => build(S, (x, y, i) => {
    const bh = 32, bw = 128, row = (y / bh) | 0, xo = (x + (row % 2) * 64) % S;
    const mortar = (y % bh < 4) || (xo % bw < 4);
    if (mortar) { const c = 150 + n4[i] * 40; return [c, c * 0.98, c * 0.93, 0.15]; }
    const id = row * 7 + ((xo / bw) | 0) * 13, v = ((id * 97) % 17) / 17 - 0.5;
    const k = 0.8 + n4[i] * 0.3 + v * 0.28;
    return [cr * k, cg * k, cb * k, 0.7 + n4[i] * 0.3];
  }, 3);
  M.brick = std(brick(168, 84, 62), { roughness: 0.92, texSize: 1.6 });
  M.brickSilicate = std(brick(206, 204, 196), { roughness: 0.92, texSize: 1.6 });
  M.block = std(brick(150, 152, 150), { roughness: 0.95, texSize: 2.4 });

  // Tinkas / gipso kartonas
  t = build(S, (x, y, i) => { const h = n4[i] * 0.6 + n2[i] * 0.4, c = 214 + h * 30; return [c, c, c * 0.98, h]; }, 1.2);
  M.plaster = std(t, { roughness: 0.95, texSize: 2 });
  M.plasterOld = std(t, { roughness: 0.95, color: 0xcbbf9e, texSize: 2 });
  M.gypsum = std(t, { roughness: 0.9, color: 0xdcdcd4, texSize: 2 });

  // Cinkuotas plienas
  t = build(S, (x, y, i) => { const h = n4[i], c = 165 + h * 50 + (n1[i] - 0.5) * 30; return [c, c * 1.01, c * 1.03, h]; }, 0.8);
  M.metal = std(t, { roughness: 0.42, metalness: 0.85, texSize: 1 });
  M.metalDark = std(t, { roughness: 0.5, metalness: 0.8, color: 0x5d6168, texSize: 1 });
  // Rūdys / armatūra
  t = build(S, (x, y, i) => {
    const h = n2[i] * 0.5 + n4[i] * 0.5;
    return [mix(96, 170, h), mix(52, 88, h), mix(34, 44, h), h + ((x % 16) < 3 ? 0.5 : 0)];
  }, 3);
  M.rust = std(t, { roughness: 0.85, metalness: 0.35, texSize: 0.5 });

  // Banguoti lakštai (šiferis / skarda)
  const corr = build(S, (x, y, i) => {
    const w = Math.sin((x / S) * Math.PI * 2 * 12) * 0.5 + 0.5, c = 128 + n2[i] * 46 + w * 22 - n3[i] * 20;
    return [c, c * 1.0, c * 0.97, w];
  }, 6);
  M.slate = std(corr, { roughness: 0.95, texSize: 1.4 });
  M.sheet = std(corr, { roughness: 0.45, metalness: 0.7, color: 0x9fb4c8, texSize: 1.4 });
  M.cabin = std(corr, { roughness: 0.55, metalness: 0.3, color: 0xe9e4d6, texSize: 1.6 });
  M.cabinBlue = std(corr, { roughness: 0.55, metalness: 0.3, color: 0x3e6da8, texSize: 1.6 });

  // Šiltinimo medžiagos, bitumas
  t = build(S, (x, y, i) => { const h = n4[i], c = 200 + h * 40; return [c, c * 0.88, c * 0.42, h]; }, 3);
  M.wool = std(t, { roughness: 1, texSize: 1 });
  M.eps = std(build(S, (x, y, i) => { const c = 228 + n4[i] * 26; return [c, c, c, n4[i]]; }, 1.5), { roughness: 0.9, texSize: 1 });
  M.bitumen = std(build(S, (x, y, i) => { const c = 34 + n4[i] * 30 + specks[i] * 60; return [c, c, c * 1.05, n4[i]]; }, 2.5), { roughness: 0.8, texSize: 2 });

  // Vienspalvės
  M.yellow = flat(0xf2b100, { roughness: 0.45, metalness: 0.2 });
  M.orange = flat(0xf26a1b, { roughness: 0.6 });
  M.red = flat(0xc8201c, { roughness: 0.4, metalness: 0.2 });
  M.blue = flat(0x1f5fae, { roughness: 0.5 });
  M.green = flat(0x1f8a4c, { roughness: 0.6 });
  M.white = flat(0xf0f0ec, { roughness: 0.6 });
  M.black = flat(0x16181a, { roughness: 0.75 });
  M.rubber = flat(0x1b1b1d, { roughness: 0.95 });
  M.grey = flat(0x7c8087, { roughness: 0.7 });
  M.skin = flat(0xd9a583, { roughness: 0.75 });
  M.hair = flat(0x3a2a1e, { roughness: 0.9 });
  M.jeans = flat(0x2f3e55, { roughness: 0.95 });
  M.workDark = flat(0x3b3f45, { roughness: 0.95 });
  M.workBlue = flat(0x274a78, { roughness: 0.95 });
  M.hivis = flat(0xd8f000, { roughness: 0.85, emissive: 0x2a3000 });
  M.hivisOrange = flat(0xff6a00, { roughness: 0.85, emissive: 0x331400 });
  M.reflect = flat(0xd0d4d8, { roughness: 0.3, metalness: 0.6 });
  M.glass = new THREE.MeshStandardMaterial({ color: 0x8fb0c4, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.55 });
  M.glassDark = flat(0x1c2a36, { roughness: 0.08, metalness: 0.9 });
  M.water = new THREE.MeshStandardMaterial({ color: 0x2c2a24, roughness: 0.03, metalness: 0.6, transparent: true, opacity: 0.8 });
  M.ice = new THREE.MeshStandardMaterial({ color: 0xcfe4ee, roughness: 0.06, metalness: 0.3, transparent: true, opacity: 0.75 });
  M.film = new THREE.MeshStandardMaterial({ color: 0xdfe9f2, roughness: 0.15, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  M.cableOrange = flat(0xff7a1a, { roughness: 0.6 });
  M.cableBlack = flat(0x101010, { roughness: 0.6 });
  M.copper = flat(0xc87533, { roughness: 0.3, metalness: 1 });
  M.fire = new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.85 });
  M.lamp = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });

  // Tinklinė tvora (alfa)
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
    c.strokeStyle = '#c9ced4'; c.lineWidth = 3;
    for (let k = 0; k <= 128; k += 16) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k, 128); c.stroke(); }
    for (let k = 0; k <= 128; k += 32) { c.beginPath(); c.moveTo(0, k); c.lineTo(128, k); c.stroke(); }
    const tx = canvasTex(cv);
    M.mesh = new THREE.MeshStandardMaterial({ map: tx, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.7, roughness: 0.4 });
    M.mesh.userData.texSize = 0.5;
  }
  // Apsauginis pastolių tinklas
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
    c.fillStyle = 'rgba(40,150,90,0.55)'; c.fillRect(0, 0, 64, 64);
    c.clearRect(4, 4, 10, 10); c.clearRect(36, 4, 10, 10); c.clearRect(20, 36, 10, 10); c.clearRect(52, 36, 10, 10);
    const tx = canvasTex(cv);
    M.net = new THREE.MeshStandardMaterial({ map: tx, transparent: true, side: THREE.DoubleSide, roughness: 1, depthWrite: false });
    M.net.userData.texSize = 0.25;
  }
  // Santvara (krano strėlė / bokštas)
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
    c.strokeStyle = '#f2b100'; c.lineWidth = 12; c.strokeRect(0, 0, 128, 128);
    c.lineWidth = 8; c.beginPath(); c.moveTo(0, 0); c.lineTo(128, 128); c.moveTo(128, 0); c.lineTo(0, 128); c.stroke();
    const tx = canvasTex(cv);
    M.lattice = new THREE.MeshStandardMaterial({ map: tx, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.3, roughness: 0.5 });
    M.lattice.userData.texSize = 1.6;
  }
  // Signalinė juosta
  {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 16; const c = cv.getContext('2d');
    c.fillStyle = '#f4f4f4'; c.fillRect(0, 0, 64, 16); c.fillStyle = '#d1201c';
    for (let k = -16; k < 64; k += 32) { c.beginPath(); c.moveTo(k, 16); c.lineTo(k + 16, 0); c.lineTo(k + 32, 0); c.lineTo(k + 16, 16); c.fill(); }
    M.tape = new THREE.MeshStandardMaterial({ map: canvasTex(cv), side: THREE.DoubleSide, roughness: 0.6 });
    M.tape.userData.texSize = 0.3;
  }
  // Miesto pastatų langai
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d');
    c.fillStyle = '#b9b4aa'; c.fillRect(0, 0, 256, 256);
    const rr = rng(99);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      c.fillStyle = rr() > 0.8 ? '#e9d9a0' : (rr() > 0.5 ? '#3b4c5c' : '#56697a');
      c.fillRect(x * 32 + 7, y * 32 + 8, 18, 17);
    }
    const tx = canvasTex(cv);
    M.city = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.8 });
    M.city.userData.texSize = 24;
  }
  return M;
}

// Teksto lentelė / ženklas kaip tekstūra
export function textTexture(draw, w = 256, h = 256) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
