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
const helmetMat = {};
export function worker(o = {}) {
  const { helmet = 0xf5f5f0, vest = true, harness = false, pose = 'stand', top = M.workBlue, mask = false, ears = false, glasses = false, vestMat = M.hivis } = o;
  const g = G(), body = G();
  const seed = (worker.n = (worker.n || 0) + 1);
  const skin = [M.skin, M.skin2, M.skin3][seed % 3], pants = seed % 2 ? M.workDark : M.jeans;
  // galūnė tarp dviejų sąnarių (kapsulė) + sąnario rutuliukas
  const limb = (a, b, r, mat, to = g) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va), len = d.length();
    const m = sh(new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len), 5, 12), mat));
    m.position.copy(va).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(_up, d.normalize()); to.add(m); return m;
  };
  const boot = (x, y, z, ry = 0) => {
    const b = G(B(0.105, 0.035, 0.29, M.rubber, 0, 0, 0.045), B(0.1, 0.1, 0.27, M.boot, 0, 0.03, 0.04), B(0.095, 0.11, 0.13, M.boot, 0, 0.1, -0.02));
    b.position.set(x, y, z); b.rotation.y = ry; g.add(b);
  };
  let hipY = 0.93, lean = 0;
  if (pose === 'kneel' || pose === 'sit') {
    // kairys kelis ant žemės, dešinė koja priekyje
    hipY = 0.5; lean = 0.38;
    limb([-0.1, hipY, 0], [-0.1, 0.09, 0.16], 0.082, pants); limb([-0.1, 0.09, 0.16], [-0.1, 0.07, -0.3], 0.066, pants);
    const bt = G(B(0.1, 0.27, 0.1, M.boot, 0, 0, 0)); bt.position.set(-0.1, 0.02, -0.36); bt.rotation.x = -1.2; g.add(bt);
    limb([0.1, hipY, 0], [0.11, 0.5, 0.36], 0.082, pants); limb([0.11, 0.5, 0.36], [0.11, 0.12, 0.32], 0.066, pants); boot(0.11, 0, 0.32);
  } else {
    const st = pose === 'work' ? 0.1 : 0.03;   // darbo pozoje kojos kiek pražergtos
    limb([-0.095, hipY, 0], [-0.1 - st, 0.5, 0.03], 0.082, pants); limb([-0.1 - st, 0.5, 0.03], [-0.11 - st * 1.5, 0.12, 0], 0.066, pants); boot(-0.11 - st * 1.5, 0, 0, 0.12);
    limb([0.095, hipY, 0], [0.1 + st, 0.5, 0.05], 0.082, pants); limb([0.1 + st, 0.5, 0.05], [0.11 + st * 1.5, 0.12, pose === 'work' ? 0.1 : 0], 0.066, pants); boot(0.11 + st * 1.5, 0, pose === 'work' ? 0.1 : 0, -0.12);
    if (pose === 'work') lean = 0.26;
  }
  const hips = sh(new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), pants)); hips.scale.set(1.08, 0.72, 0.78); hips.position.y = hipY - 0.02; g.add(hips);
  g.add(B(0.37, 0.035, 0.27, M.black, 0, hipY + 0.05, 0));
  // liemuo: sukimosi kūnas (juosmuo → krūtinė → pečiai → kaklas)
  const prof = [[0.001, 0], [0.15, 0.01], [0.158, 0.14], [0.178, 0.3], [0.186, 0.4], [0.165, 0.49], [0.09, 0.535], [0.055, 0.56], [0.001, 0.56]].map(p => new THREE.Vector2(p[0], p[1]));
  const torso = sh(new THREE.Mesh(new THREE.LatheGeometry(prof, 18), top)); torso.scale.set(1.12, 1, 0.7); torso.position.y = 0.04; body.add(torso);
  if (vest) {
    const vp = [[0.001, 0], [0.162, 0.0], [0.17, 0.14], [0.19, 0.3], [0.197, 0.4], [0.176, 0.485], [0.1, 0.52]].map(p => new THREE.Vector2(p[0], p[1]));
    const v = sh(new THREE.Mesh(new THREE.LatheGeometry(vp, 18), vestMat)); v.scale.set(1.12, 1, 0.72); v.position.y = 0.05; body.add(v);
    [0.14, 0.27].forEach(y => { const b = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.198, 0.19, 0.05, 18, 1, true), M.reflect)); b.scale.set(1.13, 1, 0.73); b.position.y = y + 0.05; body.add(b); });
    [-0.09, 0.09].forEach(x => { body.add(B(0.045, 0.2, 0.012, M.reflect, x, 0.33, 0.128), B(0.045, 0.2, 0.012, M.reflect, x, 0.33, -0.14)); });
  }
  if (harness) {
    [-0.1, 0.1].forEach(x => body.add(B(0.045, 0.5, 0.3, M.black, x, 0.04, 0)));
    body.add(B(0.46, 0.045, 0.3, M.black, 0, 0.1, 0), B(0.46, 0.045, 0.3, M.red, 0, 0.42, 0), C(0.035, 0.02, M.metal, 0, 0.46, -0.16, 10));
    [-0.1, 0.1].forEach(x => g.add(B(0.2, 0.04, 0.2, M.black, x, hipY - 0.26, 0)));
  }
  // rankos
  const sY = 0.5, arms = pose === 'work' ? [[0.23, 0.33, 0.16], [0.15, 0.36, 0.4]] : pose === 'kneel' || pose === 'sit' ? [[0.23, 0.26, 0.14], [0.16, 0.08, 0.34]] : [[0.25, 0.22, -0.02], [0.245, -0.03, 0.05]];
  [-1, 1].forEach(sx => {
    const sh0 = [sx * 0.215, sY, 0], el = [sx * arms[0][0], arms[0][1], arms[0][2]], wr = [sx * arms[1][0], arms[1][1], arms[1][2]];
    const ball = sh(new THREE.Mesh(new THREE.SphereGeometry(0.072, 10, 8), vest ? vestMat : top)); ball.position.set(...sh0); body.add(ball);
    limb(sh0, el, 0.052, top, body); limb(el, wr, 0.044, top, body);
    const hand = sh(new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), M.glove)); hand.scale.set(0.8, 1.15, 1); hand.position.set(wr[0], wr[1] - (pose === 'stand' ? 0.05 : 0), wr[2] + (pose === 'stand' ? 0 : 0.05)); body.add(hand);
  });
  // galva
  const head = G(), hd = sh(new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 14), skin)); hd.scale.set(0.94, 1.18, 1.02); head.add(hd);
  const jaw = sh(new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), skin)); jaw.scale.set(0.95, 0.8, 0.95); jaw.position.set(0, -0.06, 0.02); head.add(jaw);
  const nose = sh(new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.04, 6), skin)); nose.position.set(0, -0.01, 0.105); nose.rotation.x = 1.2; head.add(nose);
  [-0.034, 0.034].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 6, 6), M.black); e.position.set(x, 0.02, 0.092); head.add(e); const br = B(0.03, 0.007, 0.01, M.hair, x, 0.038, 0.094); br.castShadow = false; head.add(br); });
  [-0.097, 0.097].forEach(x => { const e = sh(new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), skin)); e.scale.set(0.5, 1, 0.8); e.position.set(x, 0, 0); head.add(e); });
  head.add(B(0.036, 0.006, 0.006, M.lip, 0, -0.058, 0.086));
  const hair = sh(new THREE.Mesh(new THREE.SphereGeometry(0.104, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M.hair)); hair.scale.set(0.96, 1.15, 1.04); hair.position.set(0, 0.008, -0.012); head.add(hair);
  if (helmet !== null) {
    const hm = helmetMat[helmet] || (helmetMat[helmet] = new THREE.MeshStandardMaterial({ color: helmet, roughness: 0.32 }));
    const dome = sh(new THREE.Mesh(new THREE.SphereGeometry(0.122, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), hm)); dome.scale.set(0.98, 1.0, 1.1); dome.position.y = 0.045; head.add(dome);
    const rim = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.132, 0.016, 20), hm)); rim.scale.z = 1.1; rim.position.y = 0.045; head.add(rim);
    const peak = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.105, 0.012, 14, 1, false, -0.9, 1.8), hm)); peak.position.set(0, 0.043, 0.075); head.add(peak);
    const ridge = sh(new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.008, 5, 16, Math.PI), hm)); ridge.rotation.y = Math.PI / 2; ridge.scale.set(1.1, 1, 1); ridge.position.y = 0.05; head.add(ridge);
    head.add(B(0.006, 0.12, 0.012, M.black, -0.094, -0.09, 0.02), B(0.006, 0.12, 0.012, M.black, 0.094, -0.09, 0.02));
  }
  if (mask) { const mk = sh(new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), M.white)); mk.scale.set(1, 0.85, 0.75); mk.position.set(0, -0.045, 0.075); head.add(mk); }
  if (glasses) head.add(B(0.17, 0.036, 0.02, M.glass, 0, 0.002, 0.095));
  if (ears) { [-0.105, 0.105].forEach(x => { const c = C(0.04, 0.035, M.orange, 0, 0, 0, 10); c.rotation.z = Math.PI / 2; c.position.set(x + (x > 0 ? 0.018 : -0.018) * 0 + (x > 0 ? 0.017 : -0.017), 0, 0); head.add(c); }); }
  head.position.set(0, 0.72, 0.012); body.add(head);
  body.add(C(0.048, 0.1, skin, 0, 0.56, 0, 10));
  body.position.y = hipY; body.rotation.x = lean;
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

// Sija tarp dviejų taškų (stačiakampio skerspjūvio)
export function beam(a, b, w, h, mat) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va), len = d.length();
  const m = sh(new THREE.Mesh(new THREE.BoxGeometry(w, len, h), mat));
  m.position.copy(va).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(_up, d.normalize()); return m;
}
// Hidraulinis cilindras: korpusas + chromuotas kotas
function hydraulic(a, b, r = 0.07) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), mid = va.clone().lerp(vb, 0.55).toArray();
  return G(T(a, mid, r, M.metalDark, 10), T(mid, b, r * 0.55, M.chrome, 8));
}
// Ekskavatorius. userData.upper – sukamoji dalis
export function excavator() {
  const g = G();
  [-1.15, 1.15].forEach(x => {
    g.add(B(0.55, 0.42, 2.9, M.rubber, x, 0.14, 0));
    [-1.45, 1.45].forEach(z => { const c = C(0.35, 0.55, M.rubber, 0, 0, 0, 18); c.rotation.z = Math.PI / 2; c.position.set(x + 0.275, 0.35, z); g.add(c); const hub = C(0.2, 0.57, M.yellow, 0, 0, 0, 12); hub.rotation.z = Math.PI / 2; hub.position.set(x + 0.285, 0.35, z); g.add(hub); });
    for (let k = -2; k <= 2; k++) { const w = C(0.13, 0.57, M.metalDark, 0, 0, 0, 10); w.rotation.z = Math.PI / 2; w.position.set(x + 0.285, 0.16, k * 0.5); g.add(w); }
    for (let k = -8; k <= 8; k++) g.add(B(0.57, 0.03, 0.09, M.metalDark, x, 0.685, k * 0.18), B(0.57, 0.03, 0.09, M.metalDark, x, 0, k * 0.18));
    g.add(B(0.5, 0.2, 2.9, M.metalDark, x, 0.28, 0));
  });
  g.add(B(1.9, 0.35, 1.9, M.metalDark, 0, 0.3, 0), C(0.75, 0.2, M.metalDark, 0, 0.62, 0, 20));
  const up = G();
  up.add(B(2.5, 0.16, 3.6, M.metalDark, 0, 0, 0.7));                                  // platforma
  up.add(B(1.25, 1.05, 2.5, M.yellow, 0.6, 0.16, 1.1), B(1.2, 0.95, 1.5, M.yellow, -0.62, 0.16, 1.55));  // variklio gaubtas
  const cw = C(1.25, 1.0, M.yellow, 0, 0.16, 2.2, 20); cw.scale.set(1, 1, 0.42); up.add(cw);           // atsvaras
  up.add(B(0.9, 0.5, 0.02, M.black, 0.6, 0.5, 2.36), C(0.06, 0.7, M.metalDark, 0.95, 1.2, 1.6, 8));        // grotelės, išmetimo vamzdis
  for (let k = 0; k < 6; k++) up.add(B(0.02, 0.6, 0.06, M.black, 1.235, 0.4, 0.5 + k * 0.2));
  // kabina: rėmas + stiklai
  const cx = -0.72, cz = -0.35, cwid = 1.0, cd = 1.5, ch = 1.55, cy = 0.16;
  up.add(B(cwid, 0.5, cd, M.yellow, cx, cy, cz), B(cwid + 0.06, 0.07, cd + 0.06, M.yellow, cx, cy + ch, cz));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => up.add(B(0.07, ch, 0.07, M.yellow, cx + a * (cwid / 2 - 0.035), cy, cz + b * (cd / 2 - 0.035))));
  up.add(B(cwid - 0.1, ch - 0.55, 0.02, M.glass, cx, cy + 0.52, cz - cd / 2 + 0.03), B(cwid - 0.1, ch - 0.55, 0.02, M.glass, cx, cy + 0.52, cz + cd / 2 - 0.03));
  up.add(B(0.02, ch - 0.55, cd - 0.1, M.glass, cx - cwid / 2 + 0.03, cy + 0.52, cz), B(0.02, ch - 0.55, cd - 0.1, M.glass, cx + cwid / 2 - 0.03, cy + 0.52, cz));
  up.add(B(0.45, 0.5, 0.45, M.black, cx, cy + 0.3, cz + 0.2), B(0.45, 0.55, 0.1, M.black, cx, cy + 0.6, cz + 0.42));   // sėdynė
  // strėlė, rankena, kaušas
  const p0 = [0.35, 0.9, -0.9], p1 = [0.35, 3.9, -3.1], p2 = [0.35, 3.3, -4.6], p3 = [0.35, 1.25, -5.9];
  up.add(B(0.5, 0.75, 0.6, M.yellow, 0.35, 0.16, -0.9));
  up.add(beam(p0, p1, 0.36, 0.5, M.yellow), beam(p1, p2, 0.34, 0.44, M.yellow), beam([0.35, 3.75, -4.1], p3, 0.28, 0.36, M.yellow));
  up.add(hydraulic([0.12, 0.6, -1.5], [0.12, 2.5, -2.3]), hydraulic([0.58, 0.6, -1.5], [0.58, 2.5, -2.3]), hydraulic([0.35, 4.15, -2.9], [0.35, 4.05, -4.2], 0.06), hydraulic([0.35, 3.5, -4.75], [0.35, 1.9, -5.45], 0.055));
  const bk = G(); const shell = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.95, 14, 1, true, 0.2, 3.6), M.metalDark)); shell.material.side = THREE.DoubleSide; shell.rotation.z = Math.PI / 2; bk.add(shell);
  [-0.47, 0.47].forEach(x => { const sd = sh(new THREE.Mesh(new THREE.CircleGeometry(0.5, 14, 0.2, 3.6), M.metalDark)); sd.rotation.y = Math.PI / 2; sd.position.x = x; bk.add(sd); });
  for (let k = -2; k <= 2; k++) { const t = B(0.09, 0.24, 0.05, M.chrome, k * 0.2, 0, 0); t.position.set(k * 0.2, -0.5, 0.2); t.rotation.x = -0.9; bk.add(t); }
  bk.position.set(0.35, 0.95, -6.15); bk.rotation.x = -0.5; up.add(bk);
  up.add(B(0.6, 0.1, 0.02, M.black, -0.62, 0.75, 2.31));
  up.position.y = 0.82; g.add(up); g.userData.upper = up;
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
  const roofM = M.concreteDark;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.1, r = radius * (0.75 + R() * 0.75), w = 16 + R() * 26, floors = 4 + Math.floor(R() * R() * 16), h = floors * 3, d = 12 + R() * 6;
    const mat = M.cityList[Math.floor(R() * M.cityList.length)];
    const b = G(B(w, h, d, mat), B(w + 0.4, 0.5, d + 0.4, roofM, 0, h, 0), B(3 + R() * 3, 2.4, 3, roofM, (R() - 0.5) * w * 0.5, h + 0.5, 0));
    b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); b.rotation.y = Math.floor(R() * 4) * Math.PI / 2 + (R() - 0.5) * 0.3;
    b.traverse(m => { m.castShadow = false; }); g.add(b);
  }
  // medžių juosta aplink
  for (let i = 0; i < 26; i++) { const a = R() * Math.PI * 2, r = 62 + R() * 50, t = tree(6 + R() * 5, 1 + i); t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); t.traverse(m => { m.castShadow = false; }); g.add(t); }
  return g;
}
export function tree(h = 6, seed = 1) {
  let s = (seed * 7919 + Math.round(h * 100)) % 2147483647 || 1; const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const g = G(C(0.2 * h / 6, h * 0.5, M.bark, 0, 0, 0, 9, 0.11 * h / 6));
  for (let k = 0; k < 4; k++) { const a = R() * 6.28, y0 = h * (0.36 + R() * 0.12); g.add(T([0, y0, 0], [Math.cos(a) * h * 0.2, y0 + h * 0.18, Math.sin(a) * h * 0.2], 0.045 * h / 6, M.bark, 6)); }
  for (let k = 0; k < 13; k++) {
    const a = R() * 6.28, rr = Math.sqrt(R()) * h * 0.26, y = h * (0.52 + R() * 0.36), sz = h * (0.13 + R() * 0.09);
    const geo = new THREE.IcosahedronGeometry(sz, 2), p = geo.attributes.position;
    for (let v = 0; v < p.count; v++) { const q = 0.82 + ((Math.sin(p.getX(v) * 12.9 + p.getY(v) * 78.2 + p.getZ(v) * 37.7 + k) * 43758.5) % 1 + 1) % 1 * 0.36; p.setXYZ(v, p.getX(v) * q, p.getY(v) * q * 0.85, p.getZ(v) * q); }
    const nn = geo.attributes.normal; for (let v = 0; v < p.count; v++) { const l = Math.hypot(p.getX(v), p.getY(v), p.getZ(v)) || 1; nn.setXYZ(v, p.getX(v) / l, p.getY(v) / l + 0.25, p.getZ(v) / l); }
    const m = sh(new THREE.Mesh(geo, M.leaves[k % M.leaves.length])); m.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr); g.add(m);
  }
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
