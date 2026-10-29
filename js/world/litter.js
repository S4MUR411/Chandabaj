// js/world/litter.js
// Rubbish on the road and the footpath: plastic bags, bottles, paper, wrappers,
// peels, coconut husks, cardboard, sacks, heaps and an overflowing green dustbin.
// Also the puddles and potholes of the road (their places come from hazards.js, which the game rules use too).
// Everything of one chunk is merged into ONE mesh (one draw call).
import * as THREE from 'three';
import { CONFIG, GEO, footX } from '../config.js';
import { mulberry32, range, pick, pickInt } from '../rng.js';
import { Pile } from '../util/pile.js';
import { chunkHazards } from './hazards.js';

const ROAD_TOP = 0.0;
const FOOT_TOP = 0.02;

const BAG_COLORS   = [0xf2f2f2, 0x3a6fc4, 0xe58aa8, 0x1c1c1c, 0xf2c500, 0x7fbf7f, 0xd9472b];
const WRAPPERS     = [0xd9472b, 0xf2c500, 0x2f8f4e, 0x3a6fc4, 0xe58aa8, 0xeeeeee];
const BOTTLES      = [0x9fd0e0, 0x7ab86a, 0xc9e3ee, 0xd98a3a];
const HEAP_COLORS  = [0x1c1c1c, 0xe8e4d8, 0x3a6fc4, 0xd9472b, 0xf2c500, 0x6b8f71, 0xb08a5a, 0x8d5f3b, 0xe58aa8];

// ---------- single pieces of rubbish ----------
const turn = (rng) => rng() * Math.PI * 2;

function bag(P, rng, x, z, top) {
  P.top = top; P.k = 1.3;
  const col = pick(rng, BAG_COLORS), ry = turn(rng);
  P.box(x, top + 0.03, z, range(rng, 0.25, 0.4), 0.06, range(rng, 0.22, 0.35), col, ry);
  P.box(x + range(rng, -0.05, 0.05), top + 0.1, z + range(rng, -0.05, 0.05), 0.17, 0.12, 0.15, col, ry + 0.5, 0, 0.25);
}
function bottle(P, rng, x, z, top) {
  P.top = top; P.k = 1.3;
  P.box(x, top + 0.045, z, 0.09, 0.09, 0.3, pick(rng, BOTTLES), turn(rng));
}
function paper(P, rng, x, z, top) {
  P.top = top; P.k = 1.3;
  P.box(x, top + 0.006, z, range(rng, 0.25, 0.4), 0.008, range(rng, 0.18, 0.28), pick(rng, [0xeeeadc, 0xdad2b4, 0xf4f1ea]), turn(rng));
}
function wrapper(P, rng, x, z, top) {
  P.top = top; P.k = 1.3;
  P.box(x, top + 0.008, z, 0.14, 0.012, 0.1, pick(rng, WRAPPERS), turn(rng));
}
function peel(P, rng, x, z, top) {
  P.top = top; P.k = 1.3;
  P.box(x, top + 0.02, z, 0.16, 0.035, 0.05, pick(rng, [0xe6d24a, 0xc9b53a, 0x6b4a2a]), turn(rng));
}
function cardboard(P, rng, x, z, top) {
  P.top = top; P.k = 1.2;
  P.box(x, top + 0.12, z, range(rng, 0.3, 0.5), 0.24, range(rng, 0.25, 0.4), 0xb08a5a, turn(rng), range(rng, -0.08, 0.08), range(rng, -0.08, 0.08));
}
function husk(P, rng, x, z, top) {          // green coconut husk
  P.top = top; P.k = 1.2;
  P.box(x, top + 0.1, z, 0.3, 0.2, 0.22, 0x7f9a4f, turn(rng), 0.2, 0.15);
}
function sack(P, rng, x, z, top) {
  P.top = top; P.k = 1.15;
  P.box(x, top + 0.16, z, 0.5, 0.32, 0.75, pick(rng, [0xe8e4d8, 0xcdb98a]), turn(rng), 0, range(rng, -0.1, 0.1));
}

function scatter(P, rng, x, z, top) {
  const r = rng();
  if (r < 0.28) bag(P, rng, x, z, top);
  else if (r < 0.42) bottle(P, rng, x, z, top);
  else if (r < 0.62) paper(P, rng, x, z, top);
  else if (r < 0.76) wrapper(P, rng, x, z, top);
  else if (r < 0.84) peel(P, rng, x, z, top);
  else if (r < 0.91) cardboard(P, rng, x, z, top);
  else if (r < 0.96) husk(P, rng, x, z, top);
  else sack(P, rng, x, z, top);
}

// a heap of mixed rubbish
function heap(P, rng, x, z, top) {
  P.top = top; P.k = 1.2;
  for (let k = 0; k < 2; k++) {
    P.box(x + range(rng, -0.3, 0.3), top + 0.2, z + range(rng, -0.3, 0.3), range(rng, 0.45, 0.6), 0.4, range(rng, 0.4, 0.55),
      0x1c1c1c, turn(rng), range(rng, -0.2, 0.2), range(rng, -0.2, 0.2));
  }
  const n = pickInt(rng, 9, 14);
  for (let k = 0; k < n; k++) {
    const s = range(rng, 0.15, 0.4);
    const r = range(rng, 0, 0.55), a = turn(rng);
    P.box(x + Math.cos(a) * r, top + s / 2 + Math.max(0, 0.55 - r) * 0.7 * rng(), z + Math.sin(a) * r,
      s, s * range(rng, 0.4, 1), s * range(rng, 0.6, 1.2), pick(rng, HEAP_COLORS), turn(rng), range(rng, -0.4, 0.4), range(rng, -0.4, 0.4));
  }
}

// green city dustbin, overflowing
function dustbin(P, rng, x, z, top) {
  P.top = top; P.k = 1.0;
  const ry = range(rng, -0.25, 0.25);
  P.box(x, top + 0.45, z, 0.7, 0.9, 0.55, 0x2f7d4a, ry);
  P.box(x, top + 0.93, z, 0.74, 0.06, 0.6, 0x24633a, ry);
  const n = pickInt(rng, 5, 8);
  for (let k = 0; k < n; k++) {
    const s = range(rng, 0.15, 0.35);
    P.box(x + range(rng, -0.3, 0.3), top + 0.96 + s / 2 + rng() * 0.15, z + range(rng, -0.22, 0.22), s, s * range(rng, 0.5, 1), s,
      pick(rng, HEAP_COLORS), turn(rng), range(rng, -0.4, 0.4), range(rng, -0.4, 0.4));
  }
  // spilled below
  for (let k = 0; k < 4; k++) scatter(P, rng, x + range(rng, -0.5, 0.5), z + range(rng, -0.7, 0.7), top);
}


// ---------- puddles and potholes ----------
const MUD       = 0x6f6a55;   // muddy water
const SHINE     = 0xa9bcc2;   // the sky in the water
const HOLE_RIM  = 0x8a8170;   // broken edge, pale gravel showing
const HOLE_DARK = 0x16130e;
const ASPHALT   = [0x2a2a2c, 0x3a3a3c, 0x4a4a4d];

function puddle(P, rng, p) {
  P.top = 0; P.k = 1;
  P.patch(p.x, 0.022, p.z, p.rx * 1.12, p.rz * 1.12, 0x4d4a3c, p.turn, 16);             // wet dark edge
  P.patch(p.x, 0.027, p.z, p.rx, p.rz, MUD, p.turn, 16);
  P.patch(p.x - 0.12, 0.031, p.z - 0.1, p.rx * 0.55, p.rz * 0.5, SHINE, p.turn, 12);   // reflection
}

function pothole(P, rng, h) {
  P.top = 0; P.k = 1;
  const t = turn(rng);
  P.patch(h.x, 0.012, h.z, h.r * 1.3, h.r * 1.15, HOLE_RIM, t, 12);
  P.patch(h.x + 0.04, 0.019, h.z + 0.03, h.r * 0.95, h.r * 0.82, HOLE_DARK, t + 0.4, 12);
  const n = pickInt(rng, 3, 5);                       // lumps of broken asphalt lying around it
  for (let k = 0; k < n; k++) {
    const a = turn(rng), d = h.r * range(rng, 1.15, 1.7), s = range(rng, 0.1, 0.2);
    P.box(h.x + Math.cos(a) * d, s * 0.4, h.z + Math.sin(a) * d, s, s * 0.6, s * range(rng, 0.7, 1.2), pick(rng, ASPHALT), turn(rng), range(rng, -0.2, 0.2), range(rng, -0.2, 0.2));
  }
}

// does a spot lie on a puddle or a pothole? (used to keep the rubbish out of them)
function onHazard(hz, x, z) {
  for (const p of hz.puddles) {
    const ox = x - p.x, oz = z - p.z, c = Math.cos(p.turn), s = Math.sin(p.turn);
    const dx = (ox * c + oz * s) / (p.rx + 0.3), dz = (-ox * s + oz * c) / (p.rz + 0.3);
    if (dx * dx + dz * dz < 1) return true;
  }
  return hz.potholes.some(h => Math.hypot(x - h.x, z - h.z) < h.r + 0.4);
}

const litterMat = new THREE.MeshLambertMaterial({ vertexColors: true });

export function buildLitter(zc, i) {
  const rng = mulberry32(0x11773 ^ i);
  const P = new Pile();
  const C = CONFIG.chunkLen;
  const zmin = zc - C / 2 + 0.4, zmax = zc + C / 2 - 0.4;

  for (const side of [-1, 1]) {
    // footpath: scattered rubbish
    const n = pickInt(rng, 7, 12);
    for (let k = 0; k < n; k++) scatter(P, rng, side * footX(range(rng, 5.3, 6.1)), range(rng, zmin, zmax), FOOT_TOP);

    // heaps and bins stand between the shops (not in front of the shop and not at the lamp post)
    if (rng() < 0.6) {
      const z = zc + (rng() < 0.5 ? -1 : 1) * (rng() < 0.5 ? range(rng, 4.4, 6.0) : range(rng, 7.8, 9.0));
      heap(P, rng, side * footX(range(rng, 5.5, 5.9)), z, FOOT_TOP);
    }
    if (rng() < 0.35) dustbin(P, rng, side * footX(5.65), zc + (rng() < 0.5 ? -1 : 1) * range(rng, 2.8, 4.0), FOOT_TOP);
  }

  // road: mostly along the kerbs
  const hz = chunkHazards(i);
  const m = pickInt(rng, 16, 26);
  for (let k = 0; k < m; k++) {
    const x = (rng() < 0.5 ? -1 : 1) * range(rng, GEO.half * 0.4, GEO.half - 0.2), z = range(rng, zmin, zmax);
    scatter(onHazard(hz, x, z) ? new Pile() : P, rng, x, z, ROAD_TOP);   // on a puddle or hole: made, but thrown away
  }
  if (rng() < 0.3) {                          // something bigger dropped in the lane
    const x = (rng() < 0.5 ? -1 : 1) * range(rng, 0.6, GEO.half * 0.7), z = range(rng, zmin, zmax);
    const f = rng() < 0.5 ? sack : cardboard;
    f(onHazard(hz, x, z) ? new Pile() : P, rng, x, z, ROAD_TOP);
  }

  const dec = mulberry32(0xd17c ^ i);
  for (const p of hz.puddles) puddle(P, dec, p);
  for (const h of hz.potholes) pothole(P, dec, h);

  return new THREE.Mesh(P.geometry(), litterMat);
}
