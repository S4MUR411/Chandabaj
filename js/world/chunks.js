// js/world/chunks.js
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { mulberry32 } from '../rng.js';
import { buildShop } from './shops.js';
import { buildStreetSegment, buildLamp } from './props.js';

const chunks = new Map();
let sceneRef = null;

export function initChunks(scene) { sceneRef = scene; }

export function ensureChunks(playerZ) {
  if (!sceneRef) return;
  const C = CONFIG.chunkLen;
  const V = CONFIG.viewChunks;
  const center = Math.floor(playerZ / C);
  const first = center - V;
  const last  = center + V;
  const want = new Set();

  for (let i = first; i <= last; i++) {
    want.add(i);
    if (!chunks.has(i)) chunks.set(i, buildChunk(i));
  }
  for (const [k, c] of chunks) {
    if (!want.has(k)) {
      sceneRef.remove(c.group);
      c.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      chunks.delete(k);
    }
  }
}

function buildChunk(i) {
  const rng = mulberry32(0x9e3779b1 ^ i);
  const group = new THREE.Group();
  const C = CONFIG.chunkLen;
  const zc = i * C + C / 2;

  group.add(buildStreetSegment(zc));
  group.add(buildLamp(i % 2 === 0 ? -1 : 1, zc));

  const shops = [];
  for (const side of [-1, 1]) {
    const shop = buildShop(side, zc, i, rng);
    group.add(shop.group);
    shops.push(shop);
  }

  sceneRef.add(group);
  return { group, shops };
}

export function allShops() {
  const out = [];
  for (const c of chunks.values()) for (const s of c.shops) out.push(s);
  return out;
}