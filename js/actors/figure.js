// js/actors/figure.js
// A person built from simple shapes. Options:
//   skin, shirt, pants  - colours
//   robe   - colour of a long garment (lungi, saree, long kurta) that hides the legs
//   cap    - colour of a small round cap
//   hairColor, scale
import * as THREE from 'three';

const pickRand = (rng, arr) => arr[Math.floor(rng() * arr.length)];

const SKINS  = [0xc58c63, 0xa8744f, 0xd9a67c, 0xb8895f, 0x8a5a3b];
const SHIRTS = [0xe0e0e0, 0x6b8f71, 0xb59a6a, 0xa94442, 0x2f6fb0, 0xc0c0c0];
const PANTS  = [0x333344, 0x555555, 0x2a2a2a];

const GEO = {
  torso:    new THREE.CylinderGeometry(0.24, 0.30, 0.9, 10),
  head:     new THREE.SphereGeometry(0.16, 12, 10),
  hair:     new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
  upperArm: new THREE.CylinderGeometry(0.07, 0.08, 0.4, 6),
  foreArm:  new THREE.CylinderGeometry(0.05, 0.06, 0.38, 6),
  thigh:    new THREE.CylinderGeometry(0.09, 0.10, 0.4, 6),
  shin:     new THREE.CylinderGeometry(0.07, 0.08, 0.38, 6),
  foot:     new THREE.BoxGeometry(0.12, 0.08, 0.24),
  robe:     new THREE.CylinderGeometry(0.3, 0.42, 0.85, 10),
  cap:      new THREE.CylinderGeometry(0.12, 0.15, 0.1, 10),
};

const MAT = new Map();
const mat = (c) => { let m = MAT.get(c); if (!m) { m = new THREE.MeshLambertMaterial({ color: c }); MAT.set(c, m); } return m; };

export function makeFigure(opts = {}, rngSeed = Math.random()) {
  const rng = (() => { let s = rngSeed; return () => { s = Math.sin(s * 10000) * 10000; return s - Math.floor(s); }; })();

  const skin  = opts.skin  ?? pickRand(rng, SKINS);
  const shirt = opts.shirt ?? pickRand(rng, SHIRTS);
  const pants = opts.pants ?? pickRand(rng, PANTS);

  const g = new THREE.Group();
  const parts = {};

  parts.torso = new THREE.Mesh(GEO.torso, mat(shirt));
  parts.torso.position.y = 1.15;
  parts.torso.castShadow = true;
  g.add(parts.torso);

  parts.head = new THREE.Mesh(GEO.head, mat(skin));
  parts.head.position.y = 1.78;
  parts.head.castShadow = true;
  g.add(parts.head);

  parts.hair = new THREE.Mesh(GEO.hair, mat(opts.hairColor ?? 0x111111));
  parts.hair.position.y = 1.80;
  g.add(parts.hair);

  if (opts.cap != null) {
    parts.cap = new THREE.Mesh(GEO.cap, mat(opts.cap));
    parts.cap.position.y = 1.93;
    g.add(parts.cap);
  }

  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.28, 1.55, 0);
    const upper = new THREE.Mesh(GEO.upperArm, mat(shirt));
    upper.position.y = -0.2;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.4;
    const fore = new THREE.Mesh(GEO.foreArm, mat(skin));
    fore.position.y = -0.19;
    elbow.add(fore);
    shoulder.add(elbow);
    g.add(shoulder);
    parts[side < 0 ? 'armL' : 'armR'] = shoulder;
    parts[side < 0 ? 'elbowL' : 'elbowR'] = elbow;
  }

  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.11, 0.72, 0);
    const thigh = new THREE.Mesh(GEO.thigh, mat(pants));
    thigh.position.y = -0.2;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.4;
    const shin = new THREE.Mesh(GEO.shin, mat(pants));
    shin.position.y = -0.19;
    knee.add(shin);
    const foot = new THREE.Mesh(GEO.foot, mat(0x222222));
    foot.position.set(0, -0.38, 0.06);
    knee.add(foot);
    hip.add(knee);
    g.add(hip);
    parts[side < 0 ? 'legL' : 'legR'] = hip;
    parts[side < 0 ? 'kneeL' : 'kneeR'] = knee;
  }

  if (opts.robe != null) {                     // lungi / saree / long kurta: hides the legs
    const robe = new THREE.Mesh(GEO.robe, mat(opts.robe));
    robe.position.y = 0.5;
    g.add(robe);
    parts.robe = robe;
  }

  if (opts.scale) g.scale.setScalar(opts.scale);
  g.userData.parts = parts;
  g.userData.pose = { phase: 0, mode: 'walk' };
  return g;
}
