// js/world/props.js
import * as THREE from 'three';
import { CONFIG, GEO } from '../config.js';
import { mulberry32, range, pick, pickInt } from '../rng.js';
import { buildLitter } from './litter.js';
import { Pile } from '../util/pile.js';
import { posterMaterial, bannerMaterial, PARTIES } from './posters.js';

const matCache = new Map();
const mat = (c) => { let m = matCache.get(c); if (!m) { m = new THREE.MeshLambertMaterial({ color: c }); matCache.set(c, m); } return m; };

// ---------- surface textures (made once, shared by every chunk) ----------
function makeTexture(w, h, repeatX, repeatY, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let roadMat = null, footMat = null, paintMat = null;
const paintMaterial = () => paintMat || (paintMat = new THREE.MeshLambertMaterial({ vertexColors: true }));
function surfaces() {
  if (roadMat) return;
  const RW = CONFIG.roadWidth, FW = CONFIG.footWidth, C = CONFIG.chunkLen;

  // asphalt: dark grey with small specks, one texture = 4 m x 4 m
  roadMat = new THREE.MeshLambertMaterial({
    map: makeTexture(128, 128, RW / 4, C / 4, (g, w, h) => {
      g.fillStyle = '#555555'; g.fillRect(0, 0, w, h);
      const r = mulberry32(7);
      for (let i = 0; i < 420; i++) {
        const v = 70 + Math.floor(r() * 40);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
      }
    }),
  });

  // paving: 1 m x 1 m slabs with joints (also gives a feeling of speed while walking)
  footMat = new THREE.MeshLambertMaterial({
    map: makeTexture(64, 64, FW / 1, C / 1, (g, w, h) => {
      g.fillStyle = '#c4b497'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#a39373'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
    }),
  });
}

// ---------- street, ground and skyline for one 20 m chunk ----------
export function buildStreetSegment(zc) {
  surfaces();
  const g = new THREE.Group();
  const C = CONFIG.chunkLen;
  const RW = CONFIG.roadWidth;
  const FW = CONFIG.footWidth;
  const i = Math.floor(zc / C);
  const edge = RW / 2 + FW;                       // where the shop fronts start (x = 7)

  // road surface (top is y = 0)
  const road = new THREE.Mesh(new THREE.BoxGeometry(RW, 0.1, C), roadMat);
  road.position.set(0, -0.05, zc);
  road.receiveShadow = true;
  g.add(road);

  // lane marks and zebra crossing: all the white and yellow paint of the chunk is ONE mesh (one draw call)
  const paint = new Pile();
  for (const x of [-0.14, 0.14]) paint.box(x, 0.01, zc, 0.1, 0.02, C, 0xf2c500);            // double yellow line in the middle
  for (const x of [-RW / 3, -RW / 6, RW / 6, RW / 3]) {                                       // white dashes between the lanes
    for (let z = -C / 2; z < C / 2; z += 4) paint.box(x, 0.01, zc + z + 1, 0.12, 0.02, 2, 0xe8e8e8);
  }
  if (((i % 4) + 4) % 4 === 0) {                                                              // zebra crossing every 4th chunk, over the whole road
    const nStripes = Math.floor((RW - 0.6) / 1.2);
    for (let k = 0; k < nStripes; k++) paint.box((k - (nStripes - 1) / 2) * 1.2, 0.012, zc - 7, 0.7, 0.02, 3, 0xe8e8e8);
  }
  g.add(new THREE.Mesh(paint.geometry(), paintMaterial()));

  for (const side of [-1, 1]) {
    // footpath: top is only 2 cm above the road, so the player's feet are not buried in it
    const fp = new THREE.Mesh(new THREE.BoxGeometry(FW, 0.1, C), footMat);
    fp.position.set(side * (RW / 2 + FW / 2), -0.03, zc);
    fp.receiveShadow = true;
    g.add(fp);

    // kerb stone along the road edge
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, C), mat(0xd9d2c0));
    kerb.position.set(side * (RW / 2 + 0.06), 0.02, zc);
    g.add(kerb);

    // ground behind the shops (so the street does not float in the sky)
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(100, 0.1, C),
      mat(((i % 2) + 2) % 2 === 0 ? 0x9a8d73 : 0x93866c)
    );
    ground.position.set(side * (edge + 50), -0.06, zc);
    ground.receiveShadow = true;
    g.add(ground);
  }

  addSkyline(g, zc, i);
  g.add(buildLitter(zc, i));
  g.add(buildDecor(zc, i));
  return g;
}

// Simple tall blocks far behind the shops, so the horizon is a town and not an empty sky.
const SKYLINE_COLORS = [0xb8a58c, 0xa9b3ba, 0xc2a79b, 0x9fae9a, 0xbfb5a3, 0xaaa39a];
function addSkyline(g, zc, i) {
  const rng = mulberry32(0x51ed27 ^ i);
  const C = CONFIG.chunkLen;
  for (const side of [-1, 1]) {
    const n = pickInt(rng, 2, 3);
    for (let k = 0; k < n; k++) {
      const w = range(rng, 8, 14);
      const d = range(rng, 7, 12);
      const h = range(rng, 8, 18);            // a town behind the shops
      const startX = GEO.front + range(rng, 17, 29);   // shop buildings end about 10 m behind the shop fronts
      const z = zc - C / 2 + (k + 0.5) * (C / n) + range(rng, -1.5, 1.5);
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(pick(rng, SKYLINE_COLORS)));
      b.position.set(side * (startX + w / 2), h / 2, z);
      g.add(b);
    }
  }
}

// ---------- electric / lamp poles and the cable tangle between them ----------
const POLE_H = 6.5;
// where the cables are fixed: [sideways offset, height] on two cross-arms
const ATTACH = [[-0.5, 6.1], [0.5, 6.1], [-0.5, 5.75], [0.5, 5.75]];
const poleX = (side) => side * (CONFIG.roadWidth / 2 + 0.4);

let wireMat = null;
function wireMaterial() {
  if (!wireMat) wireMat = new THREE.MeshBasicMaterial({ color: 0x151515, side: THREE.DoubleSide });
  return wireMat;
}

function quad(pos, a, b, c, d) {
  pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
}

// a thin cable piece p -> q, made of one flat and one upright strip so it is visible from every side
function ribbon(pos, p, q, w) {
  const dx = q[0] - p[0], dz = q[2] - p[2];
  let sx = dz, sz = -dx;
  const l = Math.hypot(sx, sz) || 1;
  sx = sx / l * w / 2; sz = sz / l * w / 2;
  quad(pos, [p[0] - sx, p[1], p[2] - sz], [p[0] + sx, p[1], p[2] + sz], [q[0] + sx, q[1], q[2] + sz], [q[0] - sx, q[1], q[2] - sz]);
  quad(pos, [p[0], p[1] - w / 2, p[2]], [p[0], p[1] + w / 2, p[2]], [q[0], q[1] + w / 2, q[2]], [q[0], q[1] - w / 2, q[2]]);
}

// a cable from A to B that sags in the middle
function cable(pos, A, B, sag, segs) {
  let prev = null;
  for (let k = 0; k <= segs; k++) {
    const t = k / segs;
    const p = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t - sag * 4 * t * (1 - t), A[2] + (B[2] - A[2]) * t];
    if (prev) ribbon(pos, prev, p, 0.055);
    prev = p;
  }
}

// a loose coil of spare cable hanging from the pole
function coil(pos, cx, cy, cz, rx, ry) {
  let prev = null;
  for (let k = 0; k <= 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    const p = [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, cz];
    if (prev) ribbon(pos, prev, p, 0.055);
    prev = p;
  }
}

export function buildLamp(side, zc) {
  const g = new THREE.Group();
  const C = CONFIG.chunkLen;
  const rng = mulberry32(0x3a91 ^ Math.floor(zc / C));
  const x = poleX(side);
  const z = zc + 7;                                // between two shops, not in front of a shop sign

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, POLE_H, 6), mat(0x8a8a86));
  pole.position.set(x, POLE_H / 2, z);
  g.add(pole);

  for (const y of [6.1, 5.75]) {                   // two cross-arms that carry the cables
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 0.07), mat(0x444444));
    arm.position.set(x, y, z);
    g.add(arm);
  }

  const lampArm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.08), mat(0x444444));
  lampArm.position.set(x - side * 0.7, 6.4, z);
  g.add(lampArm);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffd060, emissiveIntensity: 1 })
  );
  bulb.position.set(x - side * 1.35, 6.35, z);
  bulb.userData.isLamp = true;
  g.add(bulb);

  // cables to the next pole (other side of the street, one chunk on) and the one after (same side)
  const pos = [];
  const nx = poleX(-side);
  for (const [ox, y] of ATTACH) {
    cable(pos, [x + ox, y, z], [nx + ox, y, z + C], range(rng, 0.5, 1.1), 12);
    cable(pos, [x + ox, y, z], [x + ox, y, z + 2 * C], range(rng, 1.2, 2.2), 16);
  }
  if (rng() < 0.65) {                              // coil of spare cable
    const cx = x + range(rng, -0.2, 0.2);
    coil(pos, cx, 5.0, z + 0.05, 0.45, 0.7);
    cable(pos, [x + 0.3, 5.75, z], [cx, 5.7, z + 0.05], 0.05, 3);
  }
  if (rng() < 0.45) {                              // loose end hanging down
    cable(pos, [x - 0.3, 5.75, z + 0.05], [x - 0.2, 3.7, z + 0.2], 0.05, 4);
  }
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.add(new THREE.Mesh(wireGeo, wireMaterial()));

  // election posters tied to the pole (facing the camera). Taken last, so the cables above do not change.
  if (rng() < 0.75) {
    const party = pickInt(rng, 0, PARTIES.length - 1), look = pickInt(rng, 0, 3);
    const poster = new THREE.Mesh(POSTER_GEO, posterMaterial(party, look));
    poster.position.set(x, 2.55, z + 0.15);
    g.add(poster);
    if (rng() < 0.4) {                               // a second one above, from another party
      const p2 = new THREE.Mesh(POSTER_GEO, posterMaterial(party + 1, look + 1));
      p2.position.set(x, 3.85, z + 0.15);
      g.add(p2);
    }
  }

  return g;
}

const POSTER_GEO = new THREE.PlaneGeometry(0.8, 1.2);

// ---------- rally decorations across the road ----------
// Every few chunks two bamboo poles stand at the kerbs and carry a cloth banner or a string of paper flags.
const BAMBOO = 0xa68a45;
const FLAG_COLORS = [0xd9472b, 0xf2c500, 0x2f8f4e, 0xeeeeee, 0x3a6fc4, 0xe58aa8];
const BANNER_W = Math.min(14, CONFIG.roadWidth - 4);
const BANNER_GEO = new THREE.PlaneGeometry(BANNER_W, BANNER_W / 6.4);      // the picture is 1024 x 160
let flagMat = null;

function flagMaterial() {
  if (!flagMat) flagMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  return flagMat;
}

// a string with little triangle flags hanging from it
function festoon(z, rng) {
  const P = new Pile();
  const x0 = -(GEO.half + 0.1), x1 = GEO.half + 0.1, top = 6.5, sag = range(rng, 0.9, 1.5);
  const yAt = (x) => { const t = (x - x0) / (x1 - x0); return top - sag * 4 * t * (1 - t); };
  const n = 44;
  for (let k = 0; k < n; k++) {
    const xa = x0 + (x1 - x0) * (k / n), xb = x0 + (x1 - x0) * ((k + 1) / n);
    const xm = (xa + xb) / 2, c = new THREE.Color(FLAG_COLORS[k % FLAG_COLORS.length]);
    // the string
    P.tri([xa, yAt(xa), z], [xb, yAt(xb), z], [xb, yAt(xb) - 0.04, z], [0, 0, 1], new THREE.Color(0x222222));
    P.tri([xa, yAt(xa), z], [xb, yAt(xb) - 0.04, z], [xa, yAt(xa) - 0.04, z], [0, 0, 1], new THREE.Color(0x222222));
    // the flag
    P.tri([xa + 0.03, yAt(xa), z + 0.01], [xb - 0.03, yAt(xb), z + 0.01], [xm, yAt(xm) - 0.55, z + 0.01], [0, 0, 1], c);
  }
  return new THREE.Mesh(P.geometry(), flagMaterial());
}

function buildDecor(zc, i) {
  const g = new THREE.Group();
  const rng = mulberry32(0x7e57 ^ i);
  const r = rng();
  if (r > 0.5) return g;                                   // most chunks have none
  const z = zc - 3.4 + range(rng, -0.8, 0.8);

  for (const side of [-1, 1]) {                            // the two bamboo poles
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 7.0, 5), mat(BAMBOO));
    pole.position.set(side * (GEO.half + 0.3), 3.5, z);
    pole.rotation.z = side * 0.025;
    g.add(pole);
  }
  if (r < 0.28) {
    const party = pickInt(rng, 0, PARTIES.length - 1), k = pickInt(rng, 0, 1);
    const banner = new THREE.Mesh(BANNER_GEO, bannerMaterial(party, k));
    const bh = BANNER_W / 6.4, by = 5.4;
    banner.position.set(0, by, z);
    g.add(banner);
    for (const side of [-1, 1]) {                           // ropes from the pole tops to the upper banner corners
      const x0 = side * (GEO.half + 0.25), y0 = 6.85, x1 = side * BANNER_W / 2, y1 = by + bh / 2;
      const len = Math.hypot(x1 - x0, y1 - y0);
      const rope = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.03), mat(0x222222));
      rope.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
      rope.rotation.z = Math.atan2(y1 - y0, x1 - x0);
      g.add(rope);
    }
  } else {
    g.add(festoon(z, rng));
  }
  return g;
}

// called by the day/night system to brighten lamps
export function setLampIntensity(scene, isNight) {
  scene.traverse(o => {
    if (o.userData.isLamp) {
      o.material.emissiveIntensity = isNight ? 2 : 0.1;
    }
  });
}
