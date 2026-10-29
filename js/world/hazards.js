// js/world/hazards.js
// Where the puddles and potholes are. The layout is fixed by the chunk number, so the
// picture (litter.js) and the game rules (main.js, vehicles.js) always agree.
import { CONFIG, GEO } from '../config.js';
import { mulberry32, range, pickInt } from '../rng.js';

const cache = new Map();

export function chunkHazards(i) {
  let h = cache.get(i);
  if (h) return h;

  const rng = mulberry32(0x70b01e ^ i);
  const C = CONFIG.chunkLen;
  const zc = i * C + C / 2;
  const lim = C / 2 - 1.6;
  const puddles = [];
  const potholes = [];

  const nPud = pickInt(rng, 2, 4);
  for (let k = 0; k < nPud; k++) {
    const nearKerb = rng() < 0.7;
    const x = nearKerb ? (rng() < 0.5 ? -1 : 1) * range(rng, GEO.half * 0.55, GEO.half - 0.5) : range(rng, -GEO.half * 0.45, GEO.half * 0.45);
    puddles.push({ x, z: zc + range(rng, -lim, lim), rx: range(rng, 0.9, 1.7), rz: range(rng, 0.7, 1.2), turn: range(rng, 0, Math.PI) });
  }

  const nHole = pickInt(rng, 1, 4);
  for (let k = 0; k < nHole; k++) {
    const hole = { x: range(rng, -(GEO.half - 0.6), GEO.half - 0.6), z: zc + range(rng, -lim, lim), r: range(rng, 0.45, 0.8) };
    // keep holes out of the puddles so both stay readable
    if (puddles.some(p => Math.hypot(p.x - hole.x, p.z - hole.z) < p.rx + hole.r + 0.3)) continue;
    potholes.push(hole);
  }

  h = { puddles, potholes };
  cache.set(i, h);
  return h;
}

const chunkOf = (z) => Math.floor(z / CONFIG.chunkLen);

// is the circle (x, z, r) inside a puddle / pothole of the chunk it stands in (or a neighbour)?
export function puddleAt(x, z, r = 0) {
  const i = chunkOf(z);
  for (let k = i - 1; k <= i + 1; k++) {
    for (const p of chunkHazards(k).puddles) {
      // the puddle is an ellipse turned by p.turn: turn the point back before measuring
      const ox = x - p.x, oz = z - p.z, c = Math.cos(p.turn), s = Math.sin(p.turn);
      const dx = (ox * c + oz * s) / (p.rx + r), dz = (-ox * s + oz * c) / (p.rz + r);
      if (dx * dx + dz * dz < 1) return p;
    }
  }
  return null;
}

export function potholeAt(x, z, r = 0) {
  const i = chunkOf(z);
  for (let k = i - 1; k <= i + 1; k++) {
    for (const p of chunkHazards(k).potholes) {
      if (Math.hypot(x - p.x, z - p.z) < p.r + r) return p;
    }
  }
  return null;
}
