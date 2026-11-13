// Statybvietės objektų konstruktoriai. Visi grąžina THREE.Object3D, kurio pradžia – ant grindų.
import * as THREE from 'three';
import { textTexture } from './textures.js';

let M;
export function setMaterials(m) { M = m; }

const sh = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m; };
const G = (...kids) => { const g = new THREE.Group(); kids.forEach(k => k && g.add(k)); return g; };
export { G };

// Dėžė: (x,z) – centras, y – apačia. UV pagal metrus, kad tekstūros nesitemptų.
export function B(w, h, d, mat, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const ts = mat.userData && mat.userData.texSize;
  if (ts) {
    const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0] / ts, uv.getY(i) * dims[f][1] / ts);
    }
  }
  g.translate(0, h / 2, 0);
  const m = sh(new THREE.Mesh(g, mat));
  m.position.set(x, y, z);
  return m;
}
export function C(r, h, mat, x = 0, y = 0, z = 0, seg = 12, rTop = r) {
  const g = new THREE.CylinderGeometry(rTop, r, h, seg); g.translate(0, h / 2, 0);
  const m = sh(new THREE.Mesh(g, mat));
  m.position.set(x, y, z);
  return m;
}
const _up = new THREE.Vector3(0, 1, 0);
// Vamzdis tarp dviejų taškų
export function T(a, b, r, mat, seg = 8) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va), len = d.length();
  const m = sh(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat));
  m.position.copy(va).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(_up, d.normalize());
  return m;
}
export function at(o, x = 0, y = 0, z = 0, ry = 0) { o.position.set(x, y, z); o.rotation.y = ry; return o; }

// Stačiakampis su angomis (gruntui ir perdangoms). holes: [[x0,z0,x1,z1],...]
export function slabWithHoles(x0, z0, x1, z1, holes, mat, yTop, th = 0.25) {
  const xs = [x0, x1], zs = [z0, z1];
  holes.forEach(h => { xs.push(h[0], h[2]); zs.push(h[1], h[3]); });
  const u = a => [...new Set(a)].sort((p, q) => p - q);
  const X = u(xs), Z = u(zs), g = G();
  for (let i = 0; i < X.length - 1; i++) for (let j = 0; j < Z.length - 1; j++) {
    const cx = (X[i] + X[i + 1]) / 2, cz = (Z[j] + Z[j + 1]) / 2;
    if (holes.some(h => cx > h[0] && cx < h[2] && cz > h[1] && cz < h[3])) continue;
    g.add(B(X[i + 1] - X[i], th, Z[j + 1] - Z[j], mat, cx, yTop - th, cz));
  }
  return g;
}

// Aptvaras išilgai +X: porankis ~1,1 m, vidurinis ilginis, papėdės lenta 0,15 m
export function guardrail(len, o = {}) {
  const { top = true, mid = true, toe = true, h = 1.1, wood = true } = o;
  const g = G(), n = Math.max(1, Math.round(len / 2));
  for (let i = 0; i <= n; i++) g.add(B(0.05, h + 0.05, 0.05, M.metal, (i / n) * len, 0, 0));
  const rm = wood ? M.wood : M.metal;
  if (top) g.add(B(len, 0.12, 0.03, rm, len / 2, h - 0.12, 0.04));
  if (mid) g.add(B(len, 0.12, 0.03, rm, len / 2, h / 2 - 0.06, 0.04));
  if (toe) g.add(B(len, 0.15, 0.03, rm, len / 2, 0, 0.04));
  return g;
}

// Tinklinė statybvietės tvora išilgai +X
export function fence(len, h = 2) {
  const g = G(), n = Math.max(1, Math.round(len / 3.5)), w = len / n;
  for (let i = 0; i < n; i++) {
    const x = i * w + w / 2;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, h - 0.3), M.mesh);
    const uv = p.geometry.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w * 2, uv.getY(k) * h * 2);
    p.position.set(x, h / 2 + 0.1, 0); p.castShadow = true; g.add(p);
    g.add(T([x - w / 2 + 0.05, 0.1, 0], [x - w / 2 + 0.05, h, 0], 0.02, M.metal, 6));
    g.add(T([x + w / 2 - 0.05, 0.1, 0], [x + w / 2 - 0.05, h, 0], 0.02, M.metal, 6));
    g.add(T([x - w / 2, h, 0], [x + w / 2, h, 0], 0.02, M.metal, 6));
    g.add(B(0.6, 0.14, 0.24, M.concreteDark, i * w, 0, 0));
  }
  g.add(B(0.6, 0.14, 0.24, M.concreteDark, len, 0, 0));
  return g;
}

// Darbuotojas. o: helmet(spalva|null), vest, harness, pose: stand|work|kneel|sit, top, mask, ears, glasses
export function worker(o = {}) {
  const { helmet = 0xf5f5f0, vest = true, harness = false, pose = 'stand', top = M.workBlue, mask = false, ears = false, glasses = false, vestMat = M.hivis } = o;
  const g = G(), body = G();
  const cap = (r, l, mat) => sh(new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 10), mat));
  const legL = cap(0.075, 0.72, M.workDark), legR = cap(0.075, 0.72, M.workDark);
  const bootL = B(0.11, 0.1, 0.27, M.black, -0.1, 0, 0.04), bootR = B(0.11, 0.1, 0.27, M.black, 0.1, 0, 0.04);
  let hipY = 0.92;
  if (pose === 'sit') {
    hipY = 0.12;
    legL.rotation.x = legR.rotation.x = Math.PI / 2; legL.position.set(-0.1, hipY, 0.4); legR.position.set(0.1, hipY, 0.4);
    bootL.position.set(-0.1, hipY - 0.05, 0.85); bootR.position.set(0.1, hipY - 0.05, 0.85);
  } else if (pose === 'kneel') {
    // šlaunys stačios, blauzdos ant žemės atgal
    hipY = 0.5;
    legL.rotation.x = legR.rotation.x = Math.PI / 2; legL.scale.y = legR.scale.y = 0.55; legL.position.set(-0.1, 0.08, -0.22); legR.position.set(0.1, 0.08, -0.22);
    g.add(B(0.14, 0.42, 0.15, M.workDark, -0.1, 0.06, 0), B(0.14, 0.42, 0.15, M.workDark, 0.1, 0.06, 0));
    bootL.position.set(-0.1, 0, -0.52); bootR.position.set(0.1, 0, -0.52);
  } else { legL.position.set(-0.1, 0.5, 0); legR.position.set(0.1, 0.5, 0); }
  g.add(legL, legR, bootL, bootR);
  const torso = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.3, 4, 12), vest ? vestMat : top));
  torso.scale.set(1.15, 1, 0.75); torso.position.y = 0.33; body.add(torso);
  if (vest) { body.add(B(0.41, 0.045, 0.27, M.reflect, 0, 0.2, 0), B(0.41, 0.045, 0.27, M.reflect, 0, 0.36, 0)); }
  if (harness) {
    const s1 = B(0.05, 0.62, 0.29, M.black, -0.09, 0.02, 0), s2 = B(0.05, 0.62, 0.29, M.black, 0.09, 0.02, 0);
    body.add(s1, s2, B(0.43, 0.05, 0.29, M.black, 0, 0.1, 0), B(0.43, 0.05, 0.29, M.red, 0, 0.44, 0));
    body.add(C(0.035, 0.02, M.metal, 0, 0.5, -0.15, 10));
  }
  const armL = cap(0.055, 0.5, top), armR = cap(0.055, 0.5, top);
  const ang = pose === 'work' || pose === 'kneel' ? -1.15 : (pose === 'sit' ? -0.5 : 0.06);
  [armL, armR].forEach((a, i) => {
    const sx = i ? 0.26 : -0.26;
    a.position.set(sx, 0.56 - Math.cos(ang) * 0.3, -Math.sin(ang) * -0.3 * -1);
    a.position.z = Math.sin(-ang) * 0.3; a.rotation.x = ang;
    body.add(a);
    const hand = sh(new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), M.skin));
    hand.position.set(sx, 0.56 - Math.cos(ang) * 0.62, Math.sin(-ang) * 0.62); body.add(hand);
  });
  const head = sh(new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 12), M.skin)); head.scale.y = 1.15; head.position.y = 0.76; body.add(head);
  body.add(C(0.05, 0.08, M.skin, 0, 0.6, 0, 8));
  if (helmet !== null) {
    const hm = new THREE.MeshStandardMaterial({ color: helmet, roughness: 0.35 });
    const dome = sh(new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), hm)); dome.position.y = 0.79; body.add(dome);
    const brim = C(0.135, 0.015, hm, 0, 0.785, 0.03, 14); brim.scale.z = 1.25; body.add(brim);
  } else {
    const hr = sh(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.hair)); hr.position.y = 0.785; body.add(hr);
  }
  if (mask) body.add(B(0.1, 0.07, 0.05, M.white, 0, 0.69, 0.09));
  if (glasses) body.add(B(0.17, 0.035, 0.03, M.glass, 0, 0.775, 0.1));
  if (ears) body.add(B(0.25, 0.08, 0.08, M.orange, 0, 0.74, 0));
  body.position.y = hipY; if (pose === 'work') body.rotation.x = 0.25; if (pose === 'kneel') body.rotation.x = 0.35;
  g.add(body); g.userData.body = body;
  return g;
}

export function ladder(len, w = 0.45, mat = M.metal) {
  const g = G(T([-w / 2, 0, 0], [-w / 2, len, 0], 0.025, mat), T([w / 2, 0, 0], [w / 2, len, 0], 0.025, mat));
  for (let y = 0.28; y < len - 0.05; y += 0.28) g.add(T([-w / 2, y, 0], [w / 2, y, 0], 0.016, mat, 6));
  return g;
}
// Pristatytos kopėčios: apačia (0,0,0), remiasi į sieną -Z kryptimi; angleDeg – kampas su horizontu
export function leanLadder(len, angleDeg = 72) {
  const l = ladder(len); l.rotation.x = -(90 - angleDeg) * Math.PI / 180; return G(l);
}
export function stepladder(h = 1.8) {
  const a = ladder(h, 0.5), b = ladder(h, 0.5); a.rotation.x = -0.28; b.rotation.x = 0.28;
  a.position.z = 0.26; b.position.z = -0.26 - 0; a.position.y = 0;
  const g = G(a, b, B(0.5, 0.04, 0.3, M.metal, 0, h * 0.96 - 0.04, 0));
  a.position.z = h * 0.27; b.position.z = -h * 0.27;
  return g;
}

export function pallet() {
  const g = G();
  for (let i = 0; i < 5; i++) g.add(B(1.2, 0.022, 0.1, M.woodOld, 0, 0.122, -0.35 + i * 0.175));
  for (let i = 0; i < 3; i++) g.add(B(0.1, 0.1, 0.8, M.woodOld, -0.55 + i * 0.55, 0.022, 0));
  return g;
}
export function stack(w, h, d, mat) { return G(pallet(), B(w, h, d, mat, 0, 0.144, 0)); }

// Armatūros išleidimai. caps – ar uždėti apsauginiai gaubteliai
export function rebar(nx, nz, sp, h, caps) {
  const g = G();
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = (i - (nx - 1) / 2) * sp, z = (j - (nz - 1) / 2) * sp;
    g.add(C(0.011, h, M.rust, x, 0, z, 6));
    if (caps) g.add(C(0.035, 0.06, M.orange, x, h - 0.02, z, 8));
  }
  return g;
}

export function cable(pts, r = 0.012, mat = M.cableOrange) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  const m = sh(new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 10, r, 6), mat));
  return m;
}
export function puddle(w, d, mat = M.water) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.5, 28), mat);
  m.rotation.x = -Math.PI / 2; m.scale.set(w, d, 1); m.position.y = 0.012; m.receiveShadow = true;
  return m;
}
export function gasCylinder(mat = M.red, h = 1.1) {
  return G(C(0.11, h, mat, 0, 0, 0, 14), C(0.045, 0.1, M.metalDark, 0, h, 0, 8), C(0.06, 0.03, M.copper, 0, h + 0.1, 0, 8));
}
export function extinguisher() {
  return G(C(0.07, 0.42, M.red, 0, 0, 0, 12), C(0.03, 0.08, M.black, 0, 0.42, 0, 8), B(0.12, 0.03, 0.03, M.black, 0.04, 0.5, 0), B(0.1, 0.12, 0.005, M.white, 0, 0.18, 0.07));
}

// Lentelė su tekstu. lines: [tekstas | {t, size, color, bold}]
export function board(lines, w = 0.6, h = 0.4, bg = '#ffffff', fg = '#111111') {
  const px = 512, py = Math.round(512 * h / w);
  const tex = textTexture((c) => {
    c.fillStyle = bg; c.fillRect(0, 0, px, py);
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 6; c.strokeRect(3, 3, px - 6, py - 6);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const L = lines.map(l => typeof l === 'string' ? { t: l } : l), tot = L.reduce((s, l) => s + (l.size || 44) * 1.25, 0);
    let y = (py - tot) / 2;
    L.forEach(l => {
      const s = l.size || 44; c.font = `${l.bold === false ? '' : 'bold '}${s}px Arial, sans-serif`; c.fillStyle = l.color || fg;
      c.fillText(l.t, px / 2, y + s * 0.62, px - 24); y += s * 1.25;
    });
  }, px, py);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
  const back = B(w, h, 0.012, M.metal, 0, -h / 2, -0.008); back.castShadow = true;
  return G(m, back);
}

// ISO 7010 stiliaus ženklas (forma + spalva + kodas + užrašas). Simbolis supaprastintas.
export function sign(code, caption, size = 0.5) {
  const type = code[0];
  const tex = textTexture((c, w, h) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.4, R = w * 0.33;
    c.lineJoin = 'round';
    if (type === 'W') {
      c.beginPath(); c.moveTo(cx, cy - R); c.lineTo(cx + R * 1.05, cy + R * 0.82); c.lineTo(cx - R * 1.05, cy + R * 0.82); c.closePath();
      c.fillStyle = '#f9d500'; c.fill(); c.lineWidth = 14; c.strokeStyle = '#111'; c.stroke();
      c.fillStyle = '#111'; c.fillRect(cx - 9, cy - R * 0.35, 18, R * 0.62); c.beginPath(); c.arc(cx, cy + R * 0.55, 12, 0, 7); c.fill();
    } else if (type === 'M') {
      c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fillStyle = '#0a5cb8'; c.fill();
      c.fillStyle = '#fff'; c.fillRect(cx - 9, cy - R * 0.55, 18, R * 0.7); c.beginPath(); c.arc(cx, cy + R * 0.45, 12, 0, 7); c.fill();
    } else if (type === 'P') {
      c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 20; c.strokeStyle = '#d1201c'; c.stroke();
      c.beginPath(); c.moveTo(cx - R * 0.7, cy - R * 0.7); c.lineTo(cx + R * 0.7, cy + R * 0.7); c.stroke();
    } else {
      c.fillStyle = type === 'E' ? '#12924a' : '#d1201c'; c.fillRect(cx - R, cy - R, R * 2, R * 2);
      c.fillStyle = '#fff'; c.font = 'bold 120px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(type === 'E' ? '➜' : '▲', cx, cy);
    }
    c.fillStyle = '#111'; c.textAlign = 'center'; c.font = 'bold 40px Arial'; c.fillText(code, cx, h * 0.79);
    c.font = 'bold 34px Arial'; c.fillText(caption, cx, h * 0.92, w - 16);
  }, 384, 480);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 1.25), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
  return G(m, B(size, size * 1.25, 0.01, M.metal, 0, -size * 0.625, -0.007));
}

export function cabin(mat = M.cabin, len = 6) {
  const g = G(B(len, 2.6, 2.4, mat, 0, 0.15, 0), B(len + 0.1, 0.08, 2.5, M.metalDark, 0, 2.75, 0));
  g.add(B(0.9, 2, 0.04, M.metalDark, -len / 2 + 1, 0.2, 1.21), B(1.2, 0.8, 0.04, M.glassDark, 0.6, 1.3, 1.21));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(s => g.add(B(0.3, 0.15, 0.3, M.concreteDark, s[0] * (len / 2 - 0.3), 0, s[1] * 1)));
  return g;
}
export function toilet() { return G(B(1.1, 2.2, 1.1, M.blue, 0, 0.05, 0), B(1.2, 0.1, 1.2, M.white, 0, 2.25, 0), B(0.7, 1.8, 0.03, M.white, 0, 0.15, 0.56)); }

export function heap(r, h, mat = M.dirt, seed = 1) {
  const geo = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), p = geo.attributes.position;
  let s = seed * 9301;
  for (let i = 0; i < p.count; i++) { s = (s * 16807) % 2147483647; const k = 0.82 + (s / 2147483647) * 0.36; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
  geo.computeVertexNormals();
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * 2, uv.getY(i) * r);
  const m = sh(new THREE.Mesh(geo, mat)); m.scale.set(r, h, r); return m;
}
export function debris(n, spread, seed = 3, mats) {
  const g = G(); let s = seed * 7919; const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  mats = mats || [M.brick, M.concrete, M.woodOld, M.gypsum];
  for (let i = 0; i < n; i++) {
    const b = B(0.15 + R() * 0.5, 0.05 + R() * 0.18, 0.1 + R() * 0.35, mats[(R() * mats.length) | 0], (R() - 0.5) * spread, R() * 0.25, (R() - 0.5) * spread);
    b.rotation.set(R() * 0.6, R() * 3, R() * 0.6); g.add(b);
  }
  return g;
}

// Ekskavatorius. userData.upper – sukamoji dalis
export function excavator() {
  const g = G(B(0.6, 0.7, 3.6, M.rubber, -1.1, 0, 0), B(0.6, 0.7, 3.6, M.rubber, 1.1, 0, 0), B(1.8, 0.4, 2.2, M.metalDark, 0, 0.3, 0));
  const up = G(B(2.5, 1.1, 3.2, M.yellow, 0, 0, 0.5), B(2.4, 0.9, 1.1, M.metalDark, 0, 0.05, 1.9));
  up.add(B(1, 1.3, 1.3, M.yellow, -0.7, 1.1, -0.4), B(1.02, 0.8, 1.1, M.glassDark, -0.7, 1.45, -0.42));
  const boom = B(0.35, 0.45, 4.6, M.yellow, 0.45, 0, 0); boom.position.set(0.45, 2.6, -2.4); boom.rotation.x = 0.62; up.add(boom);
  const stick = B(0.28, 0.35, 3.2, M.yellow); stick.position.set(0.45, 2.75, -5.2); stick.rotation.x = -0.95; up.add(stick);
  const bucket = B(0.9, 0.7, 0.8, M.metalDark); bucket.position.set(0.45, 1.2, -6.1); bucket.rotation.x = 0.4; up.add(bucket);
  up.add(T([0.45, 1.3, -0.9], [0.45, 2.9, -2.9], 0.07, M.metal));
  up.position.y = 0.75; g.add(up); g.userData.upper = up;
  return g;
}

// Bokštinis kranas. userData.trolley – krovinio grupė, userData.jib – strėlė
export function towerCrane(h = 40, jibLen = 34) {
  const g = G(B(4, 0.8, 4, M.concrete, 0, 0, 0));
  const mast = B(1.6, h, 1.6, M.lattice, 0, 0.8, 0); g.add(mast);
  const top = G(B(1.6, 1.4, 1.6, M.yellow, 0, 0, 0), B(1.5, 1.6, 1.4, M.white, 1.4, -0.6, 0));
  const jib = B(jibLen, 1.2, 1.2, M.lattice, jibLen / 2, 1.2, 0), cj = B(11, 1, 1.2, M.lattice, -5.5, 1.2, 0);
  top.add(jib, cj, B(3, 1.6, 1.6, M.concreteDark, -9.5, -0.4, 0), B(0.5, 6, 0.5, M.yellow, 0, 1.4, 0));
  top.add(T([0, 7.4, 0], [jibLen * 0.7, 2.4, 0], 0.04, M.metalDark), T([0, 7.4, 0], [-9, 2.2, 0], 0.04, M.metalDark));
  top.position.y = h + 0.8; g.add(top);
  const trolley = G(B(1.4, 0.3, 1, M.metalDark, 0, 0.9, 0)); top.add(trolley);
  g.userData.top = top; g.userData.trolley = trolley;
  return g;
}

// Fasadas išilgai +X su langų angomis (XY plokštumoje, storis į -Z)
export function facade(bays, floors, bw, fh, mat, o = {}) {
  const { th = 0.4, ww = 1.5, wh = 1.5, sill = 0.9, glass = true, doorBay = -1 } = o;
  const g = G();
  for (let f = 0; f < floors; f++) for (let b = 0; b < bays; b++) {
    const x0 = b * bw, y0 = f * fh, cx = x0 + bw / 2, door = f === 0 && b === doorBay;
    const s = door ? 0 : sill, hh = door ? 2.2 : wh, w2 = door ? 1.4 : ww;
    g.add(B((bw - w2) / 2, fh, th, mat, x0 + (bw - w2) / 4, y0, -th / 2), B((bw - w2) / 2, fh, th, mat, x0 + bw - (bw - w2) / 4, y0, -th / 2));
    if (s > 0) g.add(B(w2, s, th, mat, cx, y0, -th / 2));
    g.add(B(w2, fh - s - hh, th, mat, cx, y0 + s + hh, -th / 2));
    if (door) g.add(B(w2, hh, 0.05, M.black, cx, y0, -th + 0.05));
    else if (glass) g.add(B(w2, hh, 0.04, M.glassDark, cx, y0 + s, -th + 0.1), B(w2 + 0.1, 0.05, 0.14, M.metal, cx, y0 + s - 0.05, 0.03));
  }
  return g;
}

// Gelžbetoninis karkasas: perdangos + kolonos
export function frame(nx, nz, bay, floors, fh, o = {}) {
  const g = G(), W = nx * bay, D = nz * bay, { slabTh = 0.25, top = true } = o;
  for (let f = 0; f <= floors; f++) {
    if (f > 0 && (f < floors || top)) g.add(B(W + 0.6, slabTh, D + 0.6, M.concrete, W / 2, f * fh - slabTh, D / 2));
    if (f < floors) for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) g.add(B(0.4, fh - slabTh, 0.4, M.concrete, i * bay, f * fh, j * bay));
  }
  return g;
}

// Tolimas miesto fonas
export function city(radius = 170, n = 46, seed = 5) {
  const g = G(); let s = seed * 104729; const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.1, r = radius * (0.7 + R() * 0.7), w = 14 + R() * 22, h = 10 + R() * R() * 60, d = 12 + R() * 18;
    const b = B(w, h, d, M.city, Math.cos(a) * r, 0, Math.sin(a) * r); b.rotation.y = R() * 3; b.castShadow = false; g.add(b);
  }
  return g;
}
export function tree(h = 6) {
  const g = G(C(0.16, h * 0.5, M.woodOld, 0, 0, 0, 8, 0.1));
  const leaf = new THREE.MeshStandardMaterial({ color: 0x3f6b2c, roughness: 1 });
  [[0, 0.62, 0, 1], [0.5, 0.5, 0.3, 0.7], [-0.5, 0.55, -0.2, 0.75], [0.1, 0.8, -0.3, 0.7]].forEach(p => {
    const m = sh(new THREE.Mesh(new THREE.IcosahedronGeometry(h * 0.26 * p[3], 1), leaf)); m.position.set(p[0] * h * 0.3, h * p[1], p[2] * h * 0.3); g.add(m);
  });
  return g;
}

/* Pastoliai išilgai +X, prie fasado (fasadas ties z=0, pastoliai z∈[0.3, 0.3+w]).
   Defektai: noRail / noToe / noDeck – Set iš "bay,level" (level nuo 1); badBase – Set iš stovų indeksų;
   openEnd – paskutinė sekcija nebaigta montuoti (be paklotų ir turėklų). */
export function scaffold(o) {
  const { bays, levels, L = 2.5, w = 0.9, lift = 2, noRail = new Set(), noToe = new Set(), noDeck = new Set(), badBase = new Set(), openEnd = false, net = [] } = o;
  const g = G(), z0 = 0.3, z1 = z0 + w, H = levels * lift + 1.1, r = 0.024;
  for (let i = 0; i <= bays; i++) {
    const x = i * L, short = openEnd && i === bays;
    const hh = short ? lift * 2 + 0.5 : H;
    [z0, z1].forEach(z => {
      g.add(T([x, 0.08, z], [x, hh, z], r, M.metal));
      if (badBase.has(i) && z === z1) { g.add(B(0.25, 0.065, 0.12, M.brick, x, 0, z), B(0.2, 0.05, 0.14, M.woodOld, x + 0.02, 0.065, z)); }
      else g.add(B(0.5, 0.045, 0.24, M.wood, x, 0, z), B(0.15, 0.012, 0.15, M.metalDark, x, 0.045, z), C(0.03, 0.06, M.metalDark, x, 0.05, z, 8));
    });
    for (let l = 1; l <= levels; l++) { if (short && l > 2) break; g.add(T([x, l * lift - 0.08, z0], [x, l * lift - 0.08, z1], r, M.metal)); }
    if (i % 2 === 0 && !short) for (let l = 1; l <= levels; l += 2) g.add(T([x, l * lift - 0.3, z0 - 0.02], [x, l * lift - 0.3, -0.05], 0.02, M.red, 6));
  }
  for (let b = 0; b < bays; b++) {
    const x0 = b * L, x1 = x0 + L, unfinished = openEnd && b === bays - 1;
    for (let l = 1; l <= levels; l++) {
      const y = l * lift, k = b + ',' + l;
      if (unfinished && l > 2) break;
      g.add(T([x0, y - 0.08, z1], [x1, y - 0.08, z1], r, M.metal), T([x0, y - 0.08, z0], [x1, y - 0.08, z0], r, M.metal));
      if (unfinished) continue;
      if (!noDeck.has(k)) g.add(B(L - 0.04, 0.045, w - 0.06, M.wood, x0 + L / 2, y - 0.03, (z0 + z1) / 2));
      else g.add(B(L - 0.04, 0.045, (w - 0.06) * 0.42, M.wood, x0 + L / 2, y - 0.03, z0 + w * 0.24));
      if (!noRail.has(k)) g.add(T([x0, y + 1.0, z1], [x1, y + 1.0, z1], r, M.metal), T([x0, y + 0.5, z1], [x1, y + 0.5, z1], r, M.metal));
      if (!noToe.has(k) && !noRail.has(k)) g.add(B(L - 0.06, 0.15, 0.025, M.wood, x0 + L / 2, y + 0.015, z1 - 0.03));
    }
    if (b % 2 === 1 && !unfinished) for (let l = 0; l < levels; l++) g.add(T([x0, l * lift + 0.15, z1 + 0.03], [x1, (l + 1) * lift - 0.15, z1 + 0.03], 0.02, M.metal, 6));
  }
  // vidinės kopėčios 0-je sekcijoje
  for (let l = 0; l < levels; l++) { const ld = ladder(lift + 0.9, 0.4); ld.rotation.z = -0.28; ld.position.set(0.45 + (l % 2) * 0.9, l * lift, (z0 + z1) / 2); g.add(ld); }
  net.forEach(([b0, b1, l0, l1]) => {
    const wN = (b1 - b0) * L, hN = (l1 - l0) * lift, p = new THREE.Mesh(new THREE.PlaneGeometry(wN, hN), M.net);
    const uv = p.geometry.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * wN * 4, uv.getY(k) * hN * 4);
    p.position.set(b0 * L + wN / 2, l0 * lift + hN / 2, z1 + 0.06); g.add(p);
  });
  return g;
}

// Mobilus bokštelis. locked – ar ratukų stabdžiai užfiksuoti; rails – ar yra turėklai
export function mobileTower(h = 4, o = {}) {
  const { rails = true } = o, g = G(), a = 0.7, b = 1.2;
  [[-b, -a], [b, -a], [-b, a], [b, a]].forEach(([x, z]) => {
    g.add(T([x, 0.18, z], [x, h + (rails ? 1.1 : 0.1), z], 0.024, M.metal), C(0.09, 0.05, M.rubber, x, 0.02, z, 12).rotateZ(Math.PI / 2));
    g.add(B(0.05, 0.06, 0.12, o.locked === false ? M.metalDark : M.red, x, 0.2, z + 0.08));
  });
  for (let y = 0.5; y <= h; y += 0.5) { g.add(T([-b, y, -a], [-b, y, a], 0.018, M.metal, 6), T([b, y, -a], [b, y, a], 0.018, M.metal, 6)); }
  g.add(B(2 * b, 0.05, 2 * a, M.wood, 0, h, 0), T([-b, 0.5, a], [b, h - 0.4, a], 0.018, M.metal, 6), T([-b, 0.5, -a], [b, h - 0.4, -a], 0.018, M.metal, 6));
  if (rails) [[-a], [a]].forEach(([z]) => g.add(T([-b, h + 1.05, z], [b, h + 1.05, z], 0.022, M.metal), T([-b, h + 0.55, z], [b, h + 0.55, z], 0.022, M.metal), B(2 * b, 0.15, 0.02, M.wood, 0, h + 0.05, z)));
  return g;
}
export function lampStand(h = 2) {
  const g = G(T([0, 0, 0], [0, h, 0], 0.02, M.metalDark), B(0.5, 0.03, 0.5, M.metalDark), B(0.34, 0.24, 0.08, M.yellow, 0, h, 0));
  const l = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.18), M.lamp); l.position.set(0, h + 0.12, 0.045); g.add(l);
  return g;
}
