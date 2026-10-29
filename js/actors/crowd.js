// js/actors/crowd.js
// The people of the street. Nobody is created "out of nowhere" when the crowd gets angry:
//
//   * pedestrians stroll along the footpaths, some stand and chat in little groups (the gossip)
//   * every shop has a shopkeeper at his door
//   * traffic constables stand near the zebra crossings
//
// When you squeeze a shop, the people who SAW it become "informed": they stop, stare, point at
// you and tell the people around them. When the town's anger reaches 100, the mob is simply
// those informed people (plus robbed shopkeepers and whoever is nearest). They run at you from where
// they were standing. When they catch you they form a ring around you and beat you.
// A vehicle that hits a mob member (or a policeman) knocks him down.
import * as THREE from 'three';
import { CONFIG, footX } from '../config.js';
import { allShops } from '../world/chunks.js';
import { Pile } from '../util/pile.js';
import { makeFigure } from './figure.js';
import { animateFigure, setMode, faceToward } from './pose.js';
import { vehicleAt, hitVehicle } from './vehicles.js';
import { bubble } from '../ui/bubbles.js';
import { whistleSound, crowdSound } from '../fx/audio.js';
import { LINES } from '../fx/lines.js';

const WIN_FRONT = 88;        // people live from this far in front of the player (hidden in the fog)...
const WIN_BACK = 14;         // ...to this far behind (just behind the camera)
const PER_SIDE = 9;          // walkers per footpath
const KEEPER_FRONT = 78, KEEPER_BACK = 20;
const COP_CHUNKS = 5;        // police posts within this many chunks of the player
const RING_R = 1.3;          // radius of the circle that beats you

let scene = null;
let actors = [];
let uid = 0;
let events = [];
let mobBeating = false;
let manageT = 0, syncT = 0, chatT = 3, gossipEnabled = true;
const keeperOf = new Map();      // shop -> keeper
const copAt = new Map();         // chunk number -> constable

const rnd = (a, b) => a + Math.random() * (b - a);
const pickOf = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sgn = (x) => (x < 0 ? -1 : 1);

// ---------- what people say ----------
// the sentences themselves live in fx/lines.js (so you can edit them in one place)
const CHAT = LINES.chat, SHOP_CALL = LINES.shop, SEEN = LINES.seen, GOSSIP = LINES.gossip, VICTIM = LINES.victim;
const MOB = LINES.mob, BEAT = LINES.beat, CALM = LINES.calm, COP = LINES.cop, RUNOVER = LINES.runover;

function say(a, lines, kind = 'say', ttl = 2.4) { bubble(a.fig, pickOf(lines), kind, ttl, 2.45 * (a.fig.scale.y || 1)); }

// ---------- looks ----------
const SHIRTS = [0xe0e0e0, 0x6b8f71, 0xb59a6a, 0xa94442, 0x2f6fb0, 0xc0c0c0, 0x8d6bb5, 0xd9a441];
const PANTS = [0x333344, 0x555555, 0x2a2a2a, 0x4a3a2a];
const SAREE = [0xe58aa8, 0x3a6fc4, 0xc8102e, 0x2f8f4e, 0xf2c500, 0x7a2a8c, 0xd9671a];
const LUNGI = [0x7a8a5a, 0x5a6a8a, 0x8a5a5a, 0x6a5a8a];

function pedLook() {
  const r = Math.random();
  if (r < 0.2) { const c = pickOf(SAREE); return { robe: c, shirt: c, scale: 0.95 }; }                                  // woman in a saree
  if (r < 0.38) return { robe: 0xece8dc, shirt: 0xece8dc, cap: 0xf4f1ea, hairColor: 0xdddddd, scale: 0.98 };            // elderly man, white kurta and cap
  if (r < 0.52) return { robe: pickOf(LUNGI), shirt: pickOf(SHIRTS) };                                                 // lungi
  return { shirt: pickOf(SHIRTS), pants: pickOf(PANTS), scale: rnd(0.94, 1.04) };
}

function keeperLook() {
  const r = Math.random();
  if (r < 0.35) return { robe: pickOf(LUNGI), shirt: 0xf4f1ea, cap: Math.random() < 0.4 ? 0xf4f1ea : undefined };
  return { shirt: pickOf(SHIRTS), pants: pickOf(PANTS), cap: Math.random() < 0.25 ? 0xf4f1ea : undefined };
}

// red "!" above the head of somebody who knows what you did
const markGeo = (() => {
  const P = new Pile();
  P.box(0, 0.22, 0, 0.12, 0.34, 0.12, 0xe8201a);
  P.box(0, -0.06, 0, 0.12, 0.12, 0.12, 0xe8201a);
  return P.geometry();
})();
const markMat = new THREE.MeshBasicMaterial({ vertexColors: true });
const stickGeo = new THREE.BoxGeometry(0.07, 1.0, 0.07);
const stickMat = new THREE.MeshLambertMaterial({ color: 0x8d5f3b });

// ---------- actors ----------
function makeActor(kind, look) {
  const fig = makeFigure(look, Math.random() * 1000);
  // what the voice of this person sounds like (see fx/voice.js)
  fig.userData.voice = kind === 'cop' ? 'cop' : (look && look.robe && SAREE.includes(look.robe) ? 'woman' : (look && look.hairColor ? 'elder' : 'man'));
  scene.add(fig);
  const mark = new THREE.Mesh(markGeo, markMat);
  mark.scale.setScalar(1.8);
  mark.position.y = 2.5;
  mark.visible = false;
  fig.add(mark);
  const a = {
    id: ++uid, kind, fig, mark, state: 'walk', timer: rnd(2, 8), side: 1, dir: 1, speed: 1.4, laneX: footX(5.6),
    informed: 0, gossipT: 0, mob: false, stick: null, shop: null, home: null, target: null,
    downFor: 0, afterDown: 'return', slide: 0, slot: 0, chatT: rnd(4, 12), dead: false,
  };
  actors.push(a);
  return a;
}

function removeActor(a) {
  a.dead = true;
  scene.remove(a.fig);
  if (a.shop && keeperOf.get(a.shop) === a) keeperOf.delete(a.shop);
}

function place(a, x, z, ry = 0) {
  a.fig.position.set(x, 0, z);
  a.fig.rotation.set(0, ry, 0);
}

function addStick(a) {
  if (a.stick || Math.random() > 0.65 || !a.fig.userData.parts.elbowR) return;
  a.stick = new THREE.Mesh(stickGeo, stickMat);
  a.stick.position.set(0, -0.4, 0.06);
  a.stick.rotation.x = -0.5;
  a.fig.userData.parts.elbowR.add(a.stick);
}
function dropStick(a) {
  if (a.stick && a.stick.parent) a.stick.parent.remove(a.stick);
  a.stick = null;
}

function spawnWalker(side, dir, z) {
  const a = makeActor('ped', pedLook());
  a.side = side; a.dir = dir;
  a.speed = rnd(1.0, 1.8);
  a.laneX = side * footX(dir > 0 ? 5.4 : 5.85) + rnd(-0.1, 0.1);
  place(a, a.laneX, z, dir > 0 ? 0 : Math.PI);
  a.state = 'walk';
  return a;
}

function spawnChatGroup(side, z) {
  const n = Math.random() < 0.5 ? 2 : 3;
  const cx = side * footX(rnd(5.5, 5.9)), cz = z;
  for (let k = 0; k < n; k++) {
    const ang = (k / n) * Math.PI * 2 + Math.random();
    const a = makeActor('ped', pedLook());
    a.side = side;
    a.laneX = cx;
    place(a, cx + Math.cos(ang) * 0.5, cz + Math.sin(ang) * 0.5);
    faceToward(a.fig, cx, cz);
    a.state = 'chat';
    a.timer = 1e9;
  }
}

function spawnKeeper(shop, pz) {
  const a = makeActor('keeper', keeperLook());
  a.shop = shop; a.side = shop.side;
  a.home = { x: shop.side * footX(6.25), z: shop.z + rnd(-1.0, 1.0), ry: -shop.side * Math.PI / 2 };
  place(a, a.home.x, a.home.z, a.home.ry);
  a.state = 'stand';
  keeperOf.set(shop, a);
  return a;
}

function spawnCop(chunk) {
  const zc = chunk * CONFIG.chunkLen + CONFIG.chunkLen / 2;
  const side = (((chunk / 4) % 2) + 2) % 2 === 0 ? 1 : -1;
  const a = makeActor('cop', { shirt: 0x1a2a4a, pants: 0x111111, cap: 0x1a2a4a });
  a.chunk = chunk; a.side = side;
  a.home = { x: side * footX(5.6), z: zc - 4.5, ry: -side * Math.PI / 2 };
  place(a, a.home.x, a.home.z, a.home.ry);
  a.state = 'post';
  a.timer = rnd(2, 6);
  a.speed = CONFIG.copSpeed;
  copAt.set(chunk, a);
  return a;
}

// ---------- set-up ----------
export function initCrowd(sc) { scene = sc; }

export function resetCrowd(pz = 0) {
  for (const a of actors) { scene.remove(a.fig); }
  actors = [];
  keeperOf.clear();
  copAt.clear();
  events.length = 0;
  mobBeating = false;
  chatT = 3;

  for (const side of [-1, 1]) {
    for (let k = 0; k < PER_SIDE; k++) spawnWalker(side, Math.random() < 0.5 ? 1 : -1, pz - 84 + (k + Math.random()) * ((84 + 6) / PER_SIDE));
    for (let k = 0; k < 2; k++) spawnChatGroup(side, pz - 60 + k * 30 + rnd(-6, 6));
  }
  syncPlaces(pz);
}

// shopkeepers and constables belong to the places that exist right now
function syncPlaces(pz) {
  const shops = allShops();
  const live = new Set(shops);

  for (const a of actors) {
    if (a.kind !== 'keeper' || !a.shop) continue;
    const far = a.shop.z > pz + KEEPER_BACK + 8 || a.shop.z < pz - KEEPER_FRONT - 8;
    if (!live.has(a.shop) || far) {
      if (a.mob || ['react', 'chase', 'ring', 'beat', 'tumble', 'down'].includes(a.state)) {   // in the middle of the action: becomes an ordinary person
        keeperOf.delete(a.shop); a.shop = null; a.kind = 'ped'; a.side = sgn(a.fig.position.x);
      } else removeActor(a);
    }
  }
  for (const h of shops) {
    if (keeperOf.has(h)) continue;
    if (h.z > pz + KEEPER_BACK || h.z < pz - KEEPER_FRONT) continue;
    spawnKeeper(h, pz);
  }

  const c0 = Math.floor(pz / CONFIG.chunkLen);
  for (let c = c0 - COP_CHUNKS; c <= c0 + COP_CHUNKS; c++) {
    if (((c % 4) + 4) % 4 === 0 && !copAt.has(c)) spawnCop(c);
  }
  for (const [c, a] of copAt) {
    if (Math.abs(c - c0) > COP_CHUNKS + 2 && a.state === 'post') { removeActor(a); copAt.delete(c); }
  }
}

// keep the footpaths populated
function manage(pz) {
  for (const side of [-1, 1]) {
    const mine = actors.filter(a => !a.dead && a.kind === 'ped' && !a.mob && a.side === side);
    const walkers = mine.filter(a => a.state === 'walk' || a.state === 'stand' || a.state === 'watch').length;
    const chatters = mine.filter(a => a.state === 'chat').length;
    const zs = pz - WIN_FRONT + 3;
    const free = !actors.some(a => !a.dead && Math.abs(a.fig.position.z - zs) < 1.6 && sgn(a.fig.position.x) === side);
    if (!free) continue;
    if (chatters < 5 && Math.random() < 0.12) spawnChatGroup(side, zs - 2);
    else if (walkers < PER_SIDE) spawnWalker(side, Math.random() < 0.5 ? 1 : -1, zs);
  }
}

// ---------- reacting to what the player does ----------
// The player took money (sev 0-3) at `shop`. Whoever is close enough saw it.
export function witness(x, z, sev, shop) {
  const R = 8 + sev * 3.5;
  let told = 0;
  const seen = [];
  for (const a of actors) {
    if (a.dead || a.kind === 'cop' || a.mob || !a.fig.visible || a.state === 'down' || a.state === 'tumble') continue;
    const d = Math.hypot(a.fig.position.x - x, a.fig.position.z - z);
    if (d < R) {
      a.informed = Math.max(a.informed, 22 + sev * 6);
      told++;
      if (d < R * 0.75 && a.kind === 'ped') seen.push({ a, d });
    }
  }
  const k = shop ? keeperOf.get(shop) : null;
  if (k && k.shop && k.shop.open) {
    k.state = 'victim'; k.timer = 2.4 + sev * 0.5;
    say(k, VICTIM, 'say', 2.4);
  }
  seen.sort((p, q) => p.d - q.d);
  seen.slice(0, 2).forEach(({ a }, i) => {
    a.state = 'watch'; a.timer = rnd(4, 8);
    if (i === 0) say(a, SEEN, 'angry', 2.6);
  });
  return told;
}

export function informedCount() {
  let n = 0;
  for (const a of actors) if (!a.dead && a.informed > 0 && a.kind !== 'cop') n++;
  return n;
}

// ---------- the mob ----------
export function mobMembers() { return actors.filter(a => !a.dead && a.mob); }

function joinMob(a) {
  a.mob = true; a.state = 'react'; a.timer = rnd(0.05, 0.7);
  a.speed = CONFIG.mobSpeed * rnd(0.85, 1.1);
  a.informed = 0;
  addStick(a);
}

// Turns the angriest people near the player into the mob. Returns how many there are.
export function formMob(P, want = 8) {
  const cand = [];
  for (const a of actors) {
    if (a.dead || a.kind === 'cop' || a.mob || ['down', 'tumble', 'return'].includes(a.state)) continue;
    if (a.kind === 'keeper' && (!a.shop || !a.shop.open || a.shop.down > 0)) continue;
    const d = Math.hypot(a.fig.position.x - P.x, a.fig.position.z - P.z);
    if (d > 48) continue;
    // the informed and the robbed shopkeepers come first, then whoever is nearest
    const rank = (a.informed > 0 ? 0 : 1) - (a.kind === 'keeper' && a.shop && a.shop.sq > 0 ? 0.5 : 0);
    cand.push({ a, score: rank * 30 + d });
  }
  cand.sort((p, q) => p.score - q.score);
  cand.slice(0, want).forEach(({ a }) => joinMob(a));
  const members = mobMembers();
  members.slice(0, 2).forEach(a => say(a, MOB, 'angry', 2.2));
  if (members[0]) crowdSound(1, members[0].fig.position.x, members[0].fig.position.z);
  return members.length;
}

function release(a, line) {
  a.mob = false; a.informed = 0;
  dropStick(a);
  a.state = 'return';
  a.speed = 2.4;
  if (a.kind === 'cop' || (a.kind === 'keeper' && a.shop)) a.target = { x: a.home.x, z: a.home.z };    // back to the post / the shop door
  else {
    a.side = sgn(a.fig.position.x || a.side);                                                          // everybody else: back onto the footpath
    a.target = { x: a.side * footX(5.65), z: a.fig.position.z };
  }
  if (line) say(a, CALM, 'say', 2.2);
}

// the mob gives up (time ran out)
export function releaseMob() {
  const m = mobMembers();
  m.forEach((a, i) => release(a, i === 0));
  mobBeating = false;
  return m.length;
}

// somebody falls down for `sec` seconds (hit by a vehicle, knocked out by a henchman)
export function knockDown(a, sec, slideZ = 0) {
  if (a.state === 'tumble' || a.state === 'down') return;
  a.afterDown = a.state === 'cop-chase' ? 'cop-chase' : 'return';
  a.mob = false; a.informed = 0;
  dropStick(a);
  a.state = 'tumble'; a.timer = 0.55; a.downFor = sec; a.slide = slideZ;
}

// The player is caught: the nearest members run into a circle around him, the rest stand and shout.
export function startBeating(P) {
  mobBeating = true;
  const m = mobMembers().filter(a => a.state === 'chase' || a.state === 'react')
    .sort((p, q) => Math.hypot(p.fig.position.x - P.x, p.fig.position.z - P.z) - Math.hypot(q.fig.position.x - P.x, q.fig.position.z - P.z));
  const ring = m.slice(0, 8);
  // The camera stands behind you (+Z). Nobody takes a place on that side, so the beating is not hidden behind the backs of the crowd.
  const OPEN = 0.75;                                       // half-width (radians) of the free sector towards the camera
  const arc = Math.PI * 2 - 2 * OPEN, n = ring.length;
  ring.forEach((a, i) => {
    a.state = 'ring';
    a.slot = Math.PI / 2 + OPEN + (n > 1 ? (i / (n - 1)) * arc : arc / 2) + (Math.random() - 0.5) * 0.12;
  });
  m.slice(0, 2).forEach(a => say(a, BEAT, 'angry', 1.8));
  return ring.length;
}

export function endBeating() {
  mobBeating = false;
  const m = mobMembers();
  m.forEach((a, i) => release(a, i === 0));
}

export function isBeating() { return mobBeating; }

// ---------- police ----------
export function alertCop(P) {
  let best = null, bd = 140;
  for (const a of copAt.values()) {
    if (a.dead || a.state !== 'post') continue;
    // prefer a constable you can see (in front of you) over one behind the camera
    const d = Math.hypot(a.fig.position.x - P.x, a.fig.position.z - P.z) + (a.fig.position.z > P.z + 4 ? 30 : 0);
    if (d < bd) { bd = d; best = a; }
  }
  if (!best) return null;
  best.state = 'cop-chase';
  best.speed = CONFIG.copSpeed;
  best.giveUp = Math.max(40, Math.hypot(best.fig.position.x - P.x, best.fig.position.z - P.z) + 22);   // he stops looking when you are this far away
  whistleSound(1, best.fig.position.x, best.fig.position.z);
  say(best, COP, 'angry', 2.6);
  return best;
}

export function copChasing() {
  for (const a of copAt.values()) {
    if (a.dead) continue;
    // a constable who was knocked down by a vehicle is still after you once he gets up
    if (a.state === 'cop-chase' || ((a.state === 'tumble' || a.state === 'down') && a.afterDown === 'cop-chase')) return a;
  }
  return null;
}

// the policeman is bribed (or lost you) and walks back to his post
export function dismissCop() {
  for (const a of copAt.values()) {
    if (a.state === 'cop-chase' || ((a.state === 'tumble' || a.state === 'down') && a.afterDown === 'cop-chase')) { a.afterDown = 'return'; a.state = 'return'; a.target = { x: a.home.x, z: a.home.z }; a.speed = 4.5; }
  }
}

// ---------- every frame ----------
function walkToward(a, tx, tz, sp, dt) {
  const p = a.fig.position;
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  if (d < 0.05) return 0;
  const step = Math.min(d, sp * dt);
  p.x += (dx / d) * step;
  p.z += (dz / d) * step;
  a.fig.rotation.y = Math.atan2(dx, dz);
  return d - step;
}

export function updateCrowd(dt, time, P, flags = {}) {
  events.length = 0;
  const on = !!flags.on;
  const canCatch = !!flags.canCatch;

  manageT -= dt; syncT -= dt;
  if (manageT <= 0) { manageT = 0.4; manage(P.z); }
  if (syncT <= 0) { syncT = 0.5; syncPlaces(P.z); }

  // gossip: informed people tell the people next to them
  if (on) {
    for (const a of actors) {
      if (a.dead || a.informed <= 0) continue;
      a.informed -= dt;
      a.gossipT -= dt;
      if (a.gossipT <= 0 && !a.mob) {
        a.gossipT = rnd(3, 6);
        for (const b of actors) {
          if (b === a || b.dead || b.informed > 0 || b.kind === 'cop' || b.mob || !b.fig.visible) continue;
          if (Math.hypot(b.fig.position.x - a.fig.position.x, b.fig.position.z - a.fig.position.z) < 5 && Math.random() < 0.6) {
            b.informed = 16;
            if (Math.random() < 0.5) say(a, GOSSIP, 'say', 2.4);
            break;
          }
        }
      }
    }
  }

  // idle chatter on the street
  chatT -= dt;
  if (chatT <= 0) {
    chatT = rnd(3.5, 7);
    const near = actors.filter(a => !a.dead && !a.mob && (a.state === 'chat' || (a.kind === 'keeper' && a.state === 'stand')) &&
      a.fig.position.z < P.z + 2 && a.fig.position.z > P.z - 48);
    if (near.length) {
      const a = pickOf(near);
      say(a, a.kind === 'keeper' ? SHOP_CALL : CHAT, 'say', 3);
    }
  }

  for (const a of actors) {
    if (a.dead) continue;
    stepActor(a, dt, time, P, on, canCatch);

    // the red "!" shows who knows
    const showMark = (a.informed > 0 || a.mob) && a.state !== 'down' && a.state !== 'tumble' && a.kind !== 'cop';
    a.mark.visible = showMark;
    if (showMark) a.mark.position.y = 2.5 + Math.sin(time * 6 + a.id) * 0.07;
  }

  // people who walked out of the world
  for (const a of actors) {
    if (a.dead || a.mob || a.kind !== 'ped') continue;
    if (['ring', 'beat', 'tumble', 'down', 'return', 'react', 'chase'].includes(a.state)) continue;
    const z = a.fig.position.z;
    if (z > P.z + WIN_BACK + 14 || z < P.z - WIN_FRONT - 14) removeActor(a);
  }
  actors = actors.filter(a => !a.dead);
  return events;
}

function stepActor(a, dt, time, P, on, canCatch) {
  const fig = a.fig, pos = fig.position;
  const dP = Math.hypot(P.x - pos.x, P.z - pos.z);
  let anim = 0;
  fig.visible = !(a.kind === 'keeper' && a.shop && !a.shop.open);

  switch (a.state) {
    case 'walk': {
      pos.z += a.dir * a.speed * dt;
      pos.x += (a.laneX - pos.x) * Math.min(1, dt * 3);
      fig.rotation.y = a.dir > 0 ? 0 : Math.PI;
      setMode(fig, 'walk'); anim = a.speed;
      a.timer -= dt;
      if (a.timer <= 0) { a.timer = rnd(2, 5); a.state = 'stand'; a.talking = Math.random() < 0.5; }
      if (on && a.informed > 0 && dP < 13) { a.state = 'watch'; a.timer = rnd(4, 8); }
      break;
    }
    case 'stand': {
      setMode(fig, a.kind === 'keeper' ? 'idle' : (a.talking ? 'talk' : 'idle'));
      if (a.kind === 'keeper') {
        if (a.shop && a.shop.down > 0) { a.state = 'hurt'; break; }
        if (on && a.informed > 0 && dP < 10) { faceToward(fig, P.x, P.z); setMode(fig, 'point'); }
      } else {
        a.timer -= dt;
        if (a.timer <= 0) { a.state = 'walk'; a.timer = rnd(3, 9); }
        if (on && a.informed > 0 && dP < 13) { a.state = 'watch'; a.timer = rnd(4, 8); }
      }
      break;
    }
    case 'chat': {
      setMode(fig, 'talk');
      if (on && a.informed > 0 && dP < 13) { a.state = 'watch'; a.timer = rnd(4, 8); }
      break;
    }
    case 'watch': {                                   // stares at you and points
      faceToward(fig, P.x, P.z);
      a.shoutT = (a.shoutT || 0) - dt;
      if (a.shoutT <= 0) { a.shoutT = rnd(1.5, 3.5); a.shouting = !a.shouting; }
      setMode(fig, a.shouting ? 'shout' : 'point');
      a.timer -= dt;
      if (a.informed <= 0 || dP > 17 || !on) { a.state = 'walk'; a.timer = rnd(3, 8); }
      break;
    }
    case 'victim': {                                  // the shopkeeper you just squeezed
      setMode(fig, 'shout');
      faceToward(fig, P.x, P.z);
      a.timer -= dt;
      if (a.timer <= 0) a.state = 'stand';
      break;
    }
    case 'hurt': {                                    // lying in front of his shop until the shop recovers
      setMode(fig, 'down');
      if (!a.shop || a.shop.down <= 0) a.state = 'stand';
      break;
    }
    case 'react': {                                   // a moment of shock, then the chase
      setMode(fig, 'shout');
      faceToward(fig, P.x, P.z);
      a.timer -= dt;
      if (a.timer <= 0) a.state = 'chase';
      break;
    }
    case 'chase': {
      if (dP > (mobBeating ? 2.8 : 1.0)) {
        walkToward(a, P.x, P.z, a.speed, dt);
        setMode(fig, 'chase'); anim = a.speed;
      } else {
        faceToward(fig, P.x, P.z);
        setMode(fig, mobBeating ? 'shout' : 'grab');
        if (!mobBeating && canCatch) events.push({ t: 'caught', actor: a });
      }
      runOverCheck(a);
      break;
    }
    case 'ring': {
      const tx = P.x + Math.cos(a.slot) * RING_R, tz = P.z + Math.sin(a.slot) * RING_R;
      const left = walkToward(a, tx, tz, 9, dt);
      if (left > 0.1) { setMode(fig, 'run'); anim = 9; }
      else a.state = 'beat';
      break;
    }
    case 'beat': {
      pos.x = P.x + Math.cos(a.slot) * RING_R;
      pos.z = P.z + Math.sin(a.slot) * RING_R;
      faceToward(fig, P.x, P.z);
      setMode(fig, 'beat');
      break;
    }
    case 'cop-chase': {
      if (dP < 1.3 && canCatch) { events.push({ t: 'arrest', actor: a }); setMode(fig, 'grab'); faceToward(fig, P.x, P.z); break; }
      if (dP > (a.giveUp || 40)) {                    // lost you
        a.state = 'return'; a.target = { x: a.home.x, z: a.home.z }; a.speed = 4.5;
        events.push({ t: 'cop-gave-up', actor: a });
        break;
      }
      walkToward(a, P.x, P.z, CONFIG.copSpeed, dt);
      setMode(fig, 'cop'); anim = CONFIG.copSpeed;
      runOverCheck(a);
      break;
    }
    case 'post': {                                    // constable at the zebra crossing: directs traffic, blows the whistle
      a.timer -= dt;
      const directing = a.timer > 0;
      setMode(fig, directing ? 'point' : 'idle');
      if (a.timer < -4) {
        a.timer = rnd(2, 4);
        if (dP < 60) whistleSound(1, fig.position.x, fig.position.z);
      }
      break;
    }
    case 'tumble': {
      setMode(fig, 'tumble');
      pos.z += a.slide * dt;
      a.slide *= Math.pow(0.05, dt);
      a.timer -= dt;
      if (a.timer <= 0) { a.state = 'down'; a.timer = a.downFor; }
      break;
    }
    case 'down': {
      setMode(fig, 'down');
      a.timer -= dt;
      if (a.timer <= 0) {
        if (a.afterDown === 'cop-chase') { a.state = 'cop-chase'; }
        else release(a, false);
      }
      break;
    }
    case 'return': {
      const t = a.target || { x: pos.x, z: pos.z };
      const left = walkToward(a, t.x, t.z, a.speed, dt);
      if (left > 0.1) { setMode(fig, 'walk'); anim = a.speed; }
      else if (a.kind === 'keeper' && a.shop) { a.state = 'stand'; fig.rotation.y = a.home.ry; }
      else if (a.kind === 'cop') { a.state = 'post'; a.timer = rnd(1, 3); fig.rotation.y = a.home.ry; }
      else { a.state = 'walk'; a.dir = Math.random() < 0.5 ? 1 : -1; a.laneX = a.side * footX(a.dir > 0 ? 5.4 : 5.85); a.speed = rnd(1.0, 1.8); a.timer = rnd(3, 8); }
      break;
    }
    default:
      setMode(fig, 'idle');
  }

  animateFigure(fig, dt, time, anim);
}

// a vehicle hits somebody who is running through the road
function runOverCheck(a) {
  const p = a.fig.position;
  const v = vehicleAt(p.x, p.z, 0.3, 1.5);
  if (!v) return;
  hitVehicle(v);
  knockDown(a, a.kind === 'cop' ? 3 : 3.8, v.dir * v.v * 0.6);
  say(a, RUNOVER, 'say', 1.8);
  events.push({ t: 'runover', actor: a, vehicle: v });
}

export function allActors() { return actors.filter(a => !a.dead); }
export function crowdStats() {
  const live = actors.filter(a => !a.dead);
  return {
    total: live.length,
    peds: live.filter(a => a.kind === 'ped').length,
    keepers: live.filter(a => a.kind === 'keeper').length,
    cops: live.filter(a => a.kind === 'cop').length,
    informed: live.filter(a => a.informed > 0).length,
    mob: live.filter(a => a.mob).length,
  };
}
