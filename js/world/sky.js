// js/world/sky.js
// A hazy Dhaka sky: colour gradient, a pale hot sun, drifting clouds,
// a flock of far-away birds, a few crows flying low over the street and some paper kites.
import * as THREE from 'three';
import { Pile } from '../util/pile.js';
import { CONFIG, GEO } from '../config.js';

const HORIZON = 0xcdd6dc;   // haze colour. The fog uses the same colour, so far things melt into the sky.
const MID     = 0xa7c3dc;
const ZENITH  = 0x6a9fd2;
const DOME_R  = 180;        // camera "far" is 200, so the dome must stay inside that
const RAD     = Math.PI / 180;

let root = null;            // everything in the far sky; it follows the camera
const clouds = [];
const flock = [];
const crows = [];
let flockAz = -60 * RAD;

// a point on the sky: azimuth (0 = straight ahead, + = right), elevation above the horizon, distance
function polar(az, el, r) {
  return [r * Math.cos(el) * Math.sin(az), r * Math.sin(el), -r * Math.cos(el) * Math.cos(az)];
}

// give every vertex of a geometry a colour that depends on where the vertex is
function paint(geo, fn) {
  const p = geo.attributes.position;
  const cols = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const c = fn(p.getX(i), p.getY(i), p.getZ(i));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return geo;
}

function glowTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [t, col] of stops) gr.addColorStop(t, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- birds ----------
function makeBird(scale, color, fog) {
  const m = new THREE.MeshBasicMaterial({ color, fog });
  const g = new THREE.Group();
  const part = (w, h, d, x, y, z, parent) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    (parent || g).add(mesh);
    return mesh;
  };
  part(0.18, 0.16, 0.5, 0, 0, 0);          // body
  part(0.13, 0.13, 0.15, 0, 0.05, 0.3);    // head
  part(0.04, 0.04, 0.1, 0, 0.03, 0.42);    // beak
  part(0.14, 0.03, 0.32, 0, 0, -0.4);      // tail
  const wings = [];
  for (const s of [-1, 1]) {               // each wing turns around its own shoulder
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.09, 0.04, 0.02);
    part(0.55, 0.03, 0.28, s * 0.28, 0, 0, pivot);
    g.add(pivot);
    wings.push(pivot);
  }
  g.scale.set(scale, scale, scale);
  g.userData.wings = wings;
  return g;
}

function flap(bird, angle) {
  const w = bird.userData.wings;
  w[0].rotation.z = -angle;
  w[1].rotation.z = angle;
}

function respawnCrow(c, pz, first) {
  const side = Math.random() < 0.5 ? -1 : 1;
  c.x = first ? (Math.random() * 2 - 1) * (GEO.half + 6) : side * (GEO.half + 7);
  c.z = pz - 6 - Math.random() * 70;
  c.vx = (first ? (Math.random() < 0.5 ? -1 : 1) : -side) * (3 + Math.random() * 3);
  c.vz = (Math.random() * 2 - 1) * 2;
  c.alt = 5 + Math.random() * 4;
}


// ---------- kites ----------
// Paper kites hang in the sky ahead of the player, with a long wavy tail and a thin string going down to some roof.
// They live in world space (not in the far sky) so that walking towards them feels real; fog is off so they stay visible.
const KITE_N = 6;
const CAM_Y = CONFIG.cam.up;                  // the camera is low now: kites are placed from this height
const TAIL_N = 14;
const KITE_COLORS = [0xe8332a, 0xf2c500, 0x2f8f4e, 0x3a6fc4, 0xe58aa8, 0xffffff, 0xff8a1f, 0x7a2a8c, 0x18a5a7];
const kites = [];
const FRONT = [0, 0, 1];

function makeKite(scene, slot) {
  const pick = () => KITE_COLORS[Math.floor(Math.random() * KITE_COLORS.length)];
  const a = pick();
  let b = pick(); if (b === a) b = 0xffffff;
  const style = Math.floor(Math.random() * 3);          // 0 = two halves, 1 = four quarters, 2 = diagonal stripe
  let c = pick(), d = pick();

  const top = [0, 1.7, 0], bot = [0, -1.9, 0], lft = [-1.4, 0.3, 0], rgt = [1.4, 0.3, 0], mid = [0, 0.3, 0];
  const P = new Pile();
  const col = (h) => new THREE.Color(h);
  if (style === 0) {
    P.tri(top, lft, bot, FRONT, col(a)); P.tri(top, rgt, bot, FRONT, col(b));
  } else if (style === 1) {
    P.tri(top, lft, mid, FRONT, col(a)); P.tri(top, rgt, mid, FRONT, col(b));
    P.tri(bot, lft, mid, FRONT, col(c)); P.tri(bot, rgt, mid, FRONT, col(d));
  } else {
    P.tri(top, lft, mid, FRONT, col(a)); P.tri(top, rgt, mid, FRONT, col(a));
    P.tri(bot, lft, mid, FRONT, col(b)); P.tri(bot, rgt, mid, FRONT, col(b));
  }
  // the two bamboo sticks
  const wood = col(0x3b2a1a);
  const bar = (x0, y0, x1, y1) => {
    P.tri([x0, y0, 0.05], [x1, y0, 0.05], [x1, y1, 0.05], FRONT, wood);
    P.tri([x0, y0, 0.05], [x1, y1, 0.05], [x0, y1, 0.05], FRONT, wood);
  };
  bar(-0.05, -1.9, 0.05, 1.7);
  bar(-1.4, 0.25, 1.4, 0.35);

  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
  const body = new THREE.Mesh(P.geometry(), mat);
  body.frustumCulled = false;

  // tail: a ribbon whose points are moved every frame; its colours never change
  const tailPos = new Float32Array(TAIL_N * 6 * 3);
  const tailCol = new Float32Array(TAIL_N * 6 * 3);
  for (let j = 0; j < TAIL_N; j++) {
    const cc = col(j % 2 ? 0xffffff : a);
    for (let v = 0; v < 6; v++) { tailCol[(j * 6 + v) * 3] = cc.r; tailCol[(j * 6 + v) * 3 + 1] = cc.g; tailCol[(j * 6 + v) * 3 + 2] = cc.b; }
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(tailPos, 3));
  tg.setAttribute('color', new THREE.BufferAttribute(tailCol, 3));
  const tail = new THREE.Mesh(tg, mat);
  tail.frustumCulled = false;

  const group = new THREE.Group();
  group.add(body);
  group.add(tail);
  group.visible = false;
  scene.add(group);

  // the string (three points so that it sags a little)
  const sg = new THREE.BufferGeometry();
  const sPos = new Float32Array(9);
  sg.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const string = new THREE.Line(sg, new THREE.LineBasicMaterial({ color: 0xf0f0f0, transparent: true, opacity: 0.55, fog: false }));
  string.frustumCulled = false;
  string.visible = false;
  scene.add(string);

  return { group, tail, tailPos, tg, string, sg, sPos, slot, alive: false, age: 0, kx: 0, kz: 0, ky: 0, base: 1, ph: Math.random() * 6 };
}

function spawnKite(k, camX, camZ, first) {
  const dist = first ? 55 + Math.random() * 55 : 90 + Math.random() * 25;
  const el = (5 + Math.random() * 10) * RAD;
  // the slots spread the kites over the width of the sky so they do not pile up
  k.kx = camX + ((k.slot + 0.5) / KITE_N - 0.5) * 150 + (Math.random() - 0.5) * 14;
  k.kz = camZ - dist;
  k.ky = CAM_Y + dist * Math.tan(el);
  k.base = 1.0 + Math.random() * 0.6;
  k.age = first ? 5 : 0;
  k.alive = true;
  k.group.visible = true;
  k.string.visible = true;
}

function updateKite(k, dt, time, camX, camZ) {
  let dist = camZ - k.kz;
  // a kite that has climbed out of the top of the picture (or was left far behind, e.g. after a restart) is replaced by a new one far ahead
  if (!k.alive || dist < 26 || dist > 135 || Math.atan2(k.ky - CAM_Y, dist) > 21 * RAD) { spawnKite(k, camX, camZ, false); dist = camZ - k.kz; }
  k.age += dt;

  // fade in when it appears far away; shrink away if it gets very close
  const fade = Math.min(1, k.age / 1.2) * Math.max(0, Math.min(1, (dist - 26) / 8));
  const x = k.kx + Math.sin(time * 0.45 + k.ph) * 3.5;
  const y = k.ky + Math.sin(time * 0.8 + k.ph * 2) * 0.7;
  const g = k.group;
  g.position.set(x, y, k.kz);
  g.rotation.z = Math.sin(time * 1.1 + k.ph) * 0.22;       // sways side to side
  g.rotation.x = 0.2 + Math.sin(time * 0.9 + k.ph) * 0.08;
  g.scale.setScalar(Math.max(0.001, k.base * fade * 1.2));

  // tail ribbon in the kite's own space: it trails below the kite and waves
  const P = k.tailPos;
  let px = 0, py = -1.9, w = 0.1;
  for (let j = 0; j < TAIL_N; j++) {
    const nx = Math.sin(time * 3.4 - (j + 1) * 0.75 + k.ph) * (0.06 + 0.07 * (j + 1)), ny = py - 0.34;
    const q = j * 18;
    P[q] = px - w; P[q + 1] = py; P[q + 2] = 0.03;
    P[q + 3] = px + w; P[q + 4] = py; P[q + 5] = 0.03;
    P[q + 6] = nx + w; P[q + 7] = ny; P[q + 8] = 0.03;
    P[q + 9] = px - w; P[q + 10] = py; P[q + 11] = 0.03;
    P[q + 12] = nx + w; P[q + 13] = ny; P[q + 14] = 0.03;
    P[q + 15] = nx - w; P[q + 16] = ny; P[q + 17] = 0.03;
    px = nx; py = ny;
  }
  k.tg.attributes.position.needsUpdate = true;

  // string: from the kite's lower end down and back to a roof near the player
  const S = k.sPos, s = g.scale.x;
  S[0] = x; S[1] = y - 1.9 * s; S[2] = k.kz;
  S[6] = x + (camX - x) * 0.25; S[7] = 7; S[8] = k.kz + 26;
  S[3] = (S[0] + S[6]) / 2; S[4] = (S[1] + S[7]) / 2 - 1.2; S[5] = (S[2] + S[8]) / 2;
  k.sg.attributes.position.needsUpdate = true;
  k.string.visible = fade > 0.05;
}

// ---------- set-up ----------
export function initSky(scene) {
  if (root) return;

  // fog and background take the haze colour so the horizon is seamless
  scene.background.set(HORIZON);
  if (scene.fog) scene.fog.color.set(HORIZON);

  root = new THREE.Group();
  scene.add(root);

  // sky dome: haze at the horizon, blue higher up
  const dome = new THREE.Mesh(
    paint(new THREE.SphereGeometry(DOME_R, 24, 12), (x, y) => {
      const e = Math.max(0, y / DOME_R);
      const c = new THREE.Color(HORIZON);
      return e < 0.25
        ? c.lerp(new THREE.Color(MID), e / 0.25)
        : new THREE.Color(MID).lerp(new THREE.Color(ZENITH), (e - 0.25) / 0.75);
    }),
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  root.add(dome);

  // sun: soft glow + pale disc, low in the haze
  const sunDir = polar(22 * RAD, 4 * RAD, 170);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture([[0, 'rgba(255,244,200,0.95)'], [0.2, 'rgba(255,238,180,0.55)'], [0.55, 'rgba(255,230,170,0.16)'], [1, 'rgba(255,230,170,0)']]),
    transparent: true, depthWrite: false, fog: false,
  }));
  glow.position.set(...sunDir);
  glow.scale.set(60, 60, 1);
  glow.userData.sky = 'glow';
  root.add(glow);
  const disc = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture([[0, 'rgba(255,253,240,1)'], [0.66, 'rgba(255,247,212,1)'], [0.76, 'rgba(255,246,208,0)'], [1, 'rgba(255,246,208,0)']]),
    transparent: true, depthWrite: false, fog: false,
  }));
  disc.position.set(...sunDir);
  disc.scale.set(12, 12, 1);
  disc.userData.sky = 'sun';
  root.add(disc);

  // clouds: a few flattened blobs, lighter on top
  const puff = paint(new THREE.SphereGeometry(1, 8, 6), (x, y) =>
    new THREE.Color(0xffffff).lerp(new THREE.Color(0xaab8cc), (1 - y) * 0.45));
  const cloudMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  for (let k = 0; k < 12; k++) {
    const cloud = new THREE.Group();
    const n = 4 + Math.floor(Math.random() * 3);
    for (let j = 0; j < n; j++) {
      const r = 6 + Math.random() * 4;
      const b = new THREE.Mesh(puff, cloudMat);
      b.scale.set(r, r * 0.55, r * 0.8);
      b.position.set((j - (n - 1) / 2) * 6.5, Math.random() * 3, (Math.random() - 0.5) * 4);
      cloud.add(b);
    }
    const c = { g: cloud, az: (-75 + k * 12.5 + Math.random() * 6) * RAD, el: (2 + Math.random() * 11) * RAD, speed: (0.15 + Math.random() * 0.35) * RAD };
    cloud.position.set(...polar(c.az, c.el, 150));
    root.add(cloud);
    clouds.push(c);
  }

  // far flock (V formation) high in the sky
  for (let j = 0; j < 7; j++) {
    const b = makeBird(7, 0x2a2a2e, false);
    root.add(b);
    flock.push({ g: b, row: Math.ceil(j / 2), side: j === 0 ? 0 : (j % 2 ? 1 : -1), phase: Math.random() * 6 });
  }

  // crows and pigeons flying low over the street
  const palette = [0x1b1b1b, 0x1b1b1b, 0x1b1b1b, 0x1b1b1b, 0x1b1b1b, 0x8b8f99, 0x8b8f99];
  for (const col of palette) {
    const b = makeBird(1.6, col, true);
    scene.add(b);
    const c = { g: b, x: 0, z: 0, vx: 0, vz: 0, alt: 8, phase: Math.random() * 6 };
    respawnCrow(c, 0, true);
    crows.push(c);
  }

  // paper kites
  for (let k = 0; k < KITE_N; k++) kites.push(makeKite(scene, k));
}

// ---------- every frame ----------
export function updateSky(dt, time, camera, playerPos) {
  if (!root) return;
  root.position.copy(camera.position);          // the sky is always the same distance away

  for (const c of clouds) {
    c.az += c.speed * dt;
    if (c.az > 80 * RAD) c.az = -80 * RAD;
    c.g.position.set(...polar(c.az, c.el, 150));
  }

  // far flock drifts slowly to the right
  flockAz += 0.7 * RAD * dt;
  if (flockAz > 80 * RAD) flockAz = -80 * RAD;
  const tx = Math.cos(flockAz), tz = Math.sin(flockAz);     // direction of flight
  const lead = polar(flockAz, 8 * RAD, 110);
  for (const f of flock) {
    const back = f.row * 11, up = f.side * f.row * 4.5;
    f.g.position.set(lead[0] - tx * back, lead[1] + up, lead[2] - tz * back);
    f.g.rotation.y = Math.PI / 2 - flockAz;
    flap(f.g, 0.6 * Math.sin(time * 4 + f.phase));
  }

  // crows: cross the street at 6-10 m, flap, glide, then come back from the sides
  for (const c of crows) {
    c.x += c.vx * dt;
    c.z += c.vz * dt;
    if (Math.abs(c.x) > GEO.half + 8 || c.z > playerPos.z + 4 || c.z < playerPos.z - 90) respawnCrow(c, playerPos.z, false);
    c.g.position.set(c.x, c.alt + Math.sin(time * 2 + c.phase) * 0.3, c.z);
    c.g.rotation.y = Math.atan2(c.vx, c.vz);
    const glide = 0.5 + 0.5 * Math.sin(time * 0.7 + c.phase * 3);
    flap(c.g, (0.15 + 0.85 * glide) * 0.9 * Math.sin(time * 14 + c.phase));
  }

  // kites are placed from the camera's position (the camera follows 6-7 m behind the player)
  const camZ = playerPos.z + CONFIG.cam.back;
  for (const k of kites) {
    if (!k.alive) spawnKite(k, playerPos.x, camZ, true);
    updateKite(k, dt, time, playerPos.x, camZ);
  }
}
