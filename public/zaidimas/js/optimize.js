// Scenos optimizavimas: nejudantys objektai sujungiami į kelias dešimtis didelių tinklų
// (pagal medžiagą ir erdvės langelį), kad vaizdo plokštei per kadrą tektų ne ~1000, o ~100 piešimo kvietimų.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js';

const KEEP = ['position', 'normal', 'uv'];

function effectivelyVisible(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

// Kurie tinklai juda? Paleidžiame animacijas keliais laiko momentais ir žiūrime, kas pasikeitė.
function findDynamic(scene, meshes, anims) {
  const snap = meshes.map(m => ({ mat: m.matrixWorld.clone(), vis: effectivelyVisible(m), ver: m.geometry.attributes.position.version }));
  const dyn = new Set();
  for (const t of [0.37, 1.91, 3.73, 6.11]) {
    for (const a of anims) a(t, 0.016);
    scene.updateMatrixWorld(true);
    meshes.forEach((m, i) => {
      const s = snap[i];
      if (!m.matrixWorld.equals(s.mat) || effectivelyVisible(m) !== s.vis || m.geometry.attributes.position.version !== s.ver) dyn.add(m);
    });
  }
  return dyn;
}

export function freezeStatic(scene, W, { cell = 24, farCell = 140, nearR = 70 } = {}) {
  scene.updateMatrixWorld(true);
  const meshes = [];
  scene.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
    if (o.userData.item || o.userData.keep) return;
    const mat = o.material;
    if (!mat || Array.isArray(mat) || mat.visible === false) return;
    if (!o.geometry.attributes.normal || !o.geometry.attributes.uv) return;
    meshes.push(o);
  });
  const dyn = findDynamic(scene, meshes, W.anims);
  const groups = new Map(), center = W.center || [0, 0];
  const sphere = new THREE.Sphere();
  for (const m of meshes) {
    if (dyn.has(m) || !effectivelyVisible(m)) continue;
    const g = m.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    sphere.copy(g.boundingSphere).applyMatrix4(m.matrixWorld);
    const c = sphere.center, far = Math.hypot(c.x - center[0], c.z - center[1]) > nearR || sphere.radius > cell * 2;
    const cs = far ? farCell : cell;
    const key = [m.material.uuid, m.castShadow ? 1 : 0, m.receiveShadow ? 1 : 0, g.index ? 1 : 0, far ? 'f' : 'n', Math.floor(c.x / cs), Math.floor(c.z / cs)].join('|');
    let grp = groups.get(key);
    if (!grp) groups.set(key, grp = { material: m.material, cast: m.castShadow, recv: m.receiveShadow, list: [] });
    grp.list.push(m);
  }
  let before = 0, after = 0;
  const occluders = new Set(W.occluders);
  for (const grp of groups.values()) {
    before += grp.list.length;
    if (grp.list.length < 2) { after++; continue; }
    const geos = grp.list.map(m => {
      const src = m.geometry, g = new THREE.BufferGeometry();
      for (const k of KEEP) g.setAttribute(k, src.attributes[k].clone());
      if (src.index) g.setIndex(src.index.clone());
      g.applyMatrix4(m.matrixWorld);
      return g;
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach(g => g.dispose());
    if (!merged) { after += grp.list.length; continue; }
    const mesh = new THREE.Mesh(merged, grp.material);
    mesh.castShadow = grp.cast; mesh.receiveShadow = grp.recv; mesh.matrixAutoUpdate = false;
    scene.add(mesh); after++;
    for (const m of grp.list) {
      m.parent.remove(m);
      // užstojantys objektai lieka tik spindulio patikrai (ne scenoje) – jų geometrija dar reikalinga
      if (!occluders.has(m)) m.geometry.dispose();
    }
  }
  // tušti tėviniai mazgai daugiau nebeatnaujinami
  scene.traverse(o => { if (!o.isMesh && !o.isLight && !o.isCamera && o !== scene && !o.children.length) o.matrixAutoUpdate = false; });
  return { before, after, dynamic: dyn.size };
}
