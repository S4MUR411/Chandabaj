// js/actors/vehicles.js
// Street traffic: cycle rickshaws, CNG auto-rickshaws and buses.
//
//  * Six lanes, driving on the left like in Bangladesh. Seen from the camera the left half of
//    the road goes AWAY from you (towards -Z), the right half comes AT you (towards +Z).
//    Each side has a slow lane next to the kerb (rickshaws), a mixed one and a fast one near the middle (buses).
//  * Vehicles keep their distance to the one in front, honk, bump over potholes and splash through puddles.
//  * The body of every vehicle is ONE merged mesh (see util/pile.js), so traffic is cheap to draw.
//
// What the rest of the game uses:
//   initTraffic(scene)  resetTraffic(z)  updateTraffic(dt, time, player)  -> list of events
//   vehicleAt(x, z, r)  hitVehicle(v)  getThreat()  allVehicles()
import * as THREE from 'three';
import { Pile } from '../util/pile.js';
import { afterFont, FONT, luma, css } from '../util/fontdraw.js';
import { makeFigure } from './figure.js';
import { animateFigure, setMode } from './pose.js';
import { bellSound, hornSound, crashSound } from '../fx/audio.js';
import { LINES } from '../fx/lines.js';
import { potholeAt, puddleAt } from '../world/hazards.js';
import { GEO } from '../config.js';

const AHEAD = 90;         // how far in front of the player (-Z) traffic is created: far out in the fog
const KEEP_AHEAD = 140;   // ...and removed again
const BEHIND = 42;        // how far behind the player (+Z) traffic is kept

// x = middle of the lane, dir = +1 drives towards +Z (at the camera), -1 drives away from it.
// The six lane positions come from the road width (config.js). From the left kerb: slow, mixed, fast | fast, mixed, slow.
const KINDS = ['slow', 'mid', 'fast', 'fast', 'mid', 'slow'];
const LANES = GEO.lanes.map((x, i) => ({ dir: i < 3 ? -1 : +1, x, kind: KINDS[i] }));

// what each kind of lane carries, and how much room the vehicles leave between them (metres)
const KIND = {
  slow: { gap: [16, 34], space: [12, 28], pick: (r) => (r < 0.72 ? 'rickshaw' : 'cng') },
  mid:  { gap: [22, 42], space: [16, 34], pick: (r) => (r < 0.12 ? 'rickshaw' : r < 0.68 ? 'cng' : 'bus') },
  fast: { gap: [26, 50], space: [20, 42], pick: (r) => (r < 0.45 ? 'cng' : 'bus') },
};
const gapFor = (lane) => rnd(...KIND[lane.kind].gap);
const spaceFor = (lane) => rnd(...KIND[lane.kind].space);

// hl / hw = half length / half width of the hit box
const TYPES = {
  rickshaw: { hl: 1.3, hw: 0.62, vmin: 2.4, vmax: 3.4 },
  cng:      { hl: 1.35, hw: 0.78, vmin: 4.6, vmax: 6.4 },
  bus:      { hl: 4.2, hw: 1.3, vmin: 5.0, vmax: 7.0 },
};

// what the drivers shout (the sentences are in fx/lines.js)
export const SHOUTS = { rickshaw: LINES.rickshaw, cng: LINES.cng, bus: LINES.bus };

let sceneRef = null;
const lanes = LANES.map(l => ({ ...l, list: [], gap: 20 }));
const events = [];
let threat = null;
let lastAmbient = 0;

const rnd = (a, b) => a + Math.random() * (b - a);
const pickOf = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------- vehicle bodies (merged geometry, cached per colour variant) ----------
const vehMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const geoCache = new Map();
const cached = (key, build) => { let g = geoCache.get(key); if (!g) { g = build(); geoCache.set(key, g); } return g; };

const RICK = [
  { body: 0xd9472b, hood: 0xf2c500, flap: 0xc8102e },
  { body: 0x1d4e9e, hood: 0xe8e4d8, flap: 0x3a6fc4 },
  { body: 0x0b6e4f, hood: 0xe58aa8, flap: 0xf2c500 },
  { body: 0xd9671a, hood: 0x2f8f4e, flap: 0xf2c500 },
  { body: 0x7a2a8c, hood: 0xf2c500, flap: 0xe58aa8 },
  { body: 0xc8102e, hood: 0x3a6fc4, flap: 0xeeeeee },
];
const CNG = [0x1e8f4e, 0x1e8f4e, 0x2d9a5a, 0xd6a417];
const BUS = [
  { a: 0xb3262b, b: 0xf2e8c4, c: 0xf2c500 },
  { a: 0x1d4e9e, b: 0xe8e4d8, c: 0xf2c500 },
  { a: 0x2f8f4e, b: 0xf2e8c4, c: 0xc8102e },
  { a: 0xd9671a, b: 0xe8e4d8, c: 0x1d4e9e },
  { a: 0xf2c500, b: 0xe8e4d8, c: 0xc8102e },
];
const BUS_NAMES = ['ভাই ভাই পরিবহন', 'সোনার তরী', 'জনতা এক্সপ্রেস', 'বাংলার মুখ', 'লাকী সার্ভিস', 'ঝড় এক্সপ্রেস', 'মায়ের দোয়া', 'দুরন্ত পরিবহন'];
const BUS_ROUTES = ['মিরপুর – গুলিস্তান', 'উত্তরা – মতিঝিল', 'যাত্রাবাড়ী – গাবতলী', 'ফার্মগেট – সদরঘাট'];

function contactShadow(P, w, l) { P.patch(0, 0.016, 0, w, l, 0x0e0e0e, 0, 16); }

function rickshawGeo(v) {
  return cached('r' + v, () => {
    const P = new Pile(), c = RICK[v];
    const dark = 0x222222, steel = 0x707070;
    contactShadow(P, 0.8, 1.7);
    P.wheel(-0.5, 0.33, -0.55, 0.33, 0.06, 0x1a1a1a);
    P.wheel(0.5, 0.33, -0.55, 0.33, 0.06, 0x1a1a1a);
    P.wheel(0, 0.33, 1.05, 0.33, 0.06, 0x1a1a1a);
    P.box(0, 0.33, -0.55, 1.0, 0.05, 0.05, steel);                  // rear axle
    P.box(0, 0.55, 0.2, 0.08, 0.08, 2.0, dark);                      // frame
    P.box(0, 0.8, 0.55, 0.05, 0.05, 1.0, steel, 0, 0.3);             // slanted bar
    P.box(0, 0.7, 1.03, 0.05, 0.75, 0.05, steel);                    // front fork
    P.box(0, 1.1, 0.95, 0.6, 0.05, 0.05, dark);                      // handlebar
    P.box(0, 0.98, 0.42, 0.2, 0.06, 0.3, dark);                      // saddle
    P.box(0, 0.62, -0.5, 0.95, 0.28, 0.8, c.body);                   // passenger seat
    P.box(0, 0.95, -0.9, 0.95, 0.55, 0.08, c.body);                  // back rest
    P.box(-0.5, 0.74, -0.55, 0.1, 0.05, 0.72, c.body);               // mudguards
    P.box(0.5, 0.74, -0.55, 0.1, 0.05, 0.72, c.body);
    P.box(0, 1.88, -0.5, 1.1, 0.06, 1.1, c.hood, 0, -0.12);          // hood
    P.box(-0.55, 1.6, -0.5, 0.05, 0.5, 0.95, c.flap);                // hood sides
    P.box(0.55, 1.6, -0.5, 0.05, 0.5, 0.95, c.flap);
    for (const sx of [-0.5, 0.5]) for (const z of [-0.05, -0.92]) P.box(sx, 1.3, z, 0.04, 1.1, 0.04, dark);   // hood struts
    return P.geometry();
  });
}

function cngGeo(v) {
  return cached('c' + v, () => {
    const P = new Pile(), body = CNG[v];
    const dark = 0x222222;
    contactShadow(P, 0.95, 1.7);
    P.wheel(-0.62, 0.3, -0.7, 0.3, 0.14, 0x1a1a1a);
    P.wheel(0.62, 0.3, -0.7, 0.3, 0.14, 0x1a1a1a);
    P.wheel(0, 0.3, 1.0, 0.3, 0.14, 0x1a1a1a);
    P.box(0, 0.65, -0.35, 1.25, 0.5, 1.7, body);                     // body
    P.box(0, 0.62, 0.85, 0.8, 0.55, 0.62, body);                     // nose
    P.box(0, 0.95, -0.85, 1.27, 0.08, 0.8, 0xf2c500);                // yellow stripe on the engine cover
    P.box(0, 1.85, -0.2, 1.4, 0.07, 2.1, dark);                      // roof
    for (const sx of [-0.62, 0.62]) for (const z of [-1.1, 0.5]) P.box(sx, 1.35, z, 0.05, 1.0, 0.05, dark);    // pillars
    P.box(0, 1.5, 0.6, 1.15, 0.6, 0.04, 0x9fc7d9);                  // windscreen
    P.box(-0.62, 1.05, -0.3, 0.04, 0.12, 1.5, dark);                // side rails of the cage
    P.box(0.62, 1.05, -0.3, 0.04, 0.12, 1.5, dark);
    P.box(0, 0.8, 1.17, 0.22, 0.14, 0.06, 0xfff2b0);                // headlight
    P.box(0, 0.55, -1.22, 0.4, 0.16, 0.04, 0xf2c500);               // number plate
    return P.geometry();
  });
}

function busGeo(v, rack) {
  return cached('b' + v + (rack ? 'r' : ''), () => {
    const P = new Pile(), c = BUS[v];
    const glass = 0x2a3a46, dark = 0x1c1c1c;
    contactShadow(P, 1.4, 4.6);
    for (const z of [2.6, -2.4, -3.3]) {                                // front axle + twin rear axle
      P.wheel(-1.1, 0.5, z, 0.5, 0.3, 0x151515);
      P.wheel(1.1, 0.5, z, 0.5, 0.3, 0x151515);
    }
    P.box(0, 1.05, 0, 2.4, 1.0, 8.4, c.a);                             // lower body
    P.box(0, 2.1, 0, 2.36, 1.1, 8.3, c.b);                             // upper body
    P.box(0, 1.6, 0, 2.43, 0.1, 8.42, c.c);                            // painted stripe
    P.box(0, 2.1, -0.1, 2.43, 0.6, 7.5, glass);                        // side windows
    P.box(0, 2.18, 4.16, 2.0, 0.78, 0.06, glass);                      // windscreen
    P.box(0, 2.18, -4.16, 1.9, 0.6, 0.06, glass);                      // rear window
    P.box(0, 2.7, 0, 2.3, 0.12, 8.2, 0xd8d8d4);                        // roof
    P.box(0, 0.62, 4.25, 2.4, 0.22, 0.22, dark);                       // bumpers
    P.box(0, 0.62, -4.25, 2.4, 0.22, 0.22, dark);
    P.box(-0.8, 0.98, 4.2, 0.34, 0.2, 0.06, 0xfff2b0);                 // headlights
    P.box(0.8, 0.98, 4.2, 0.34, 0.2, 0.06, 0xfff2b0);
    P.box(-0.85, 0.98, -4.2, 0.3, 0.2, 0.06, 0xc8102e);                // tail lights
    P.box(0.85, 0.98, -4.2, 0.3, 0.2, 0.06, 0xc8102e);
    P.box(0, 2.7, 4.17, 1.2, 0.24, 0.05, 0xf4f1ea);                    // destination board
    if (rack) {                                                         // luggage on the roof
      P.box(-0.3, 3.0, -1.2, 1.7, 0.45, 2.2, 0x8d5f3b);
      P.box(0.4, 3.05, 1.6, 1.3, 0.55, 1.4, 0xcdb98a, 0.3);
      P.box(0, 3.0, 0.2, 0.5, 0.3, 0.6, 0x3a6fc4, 0.6);
    }
    return P.geometry();
  });
}

// ---------- painted panels (canvas textures, cached) ----------
const texCache = new Map();
function panelMaterial(key, w, h, draw) {
  let m = texCache.get(key);
  if (m) return m;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  m = new THREE.MeshLambertMaterial({ map: tex });
  texCache.set(key, m);
  afterFont(key, () => { draw(c.getContext('2d'), w, h); tex.needsUpdate = true; });
  return m;
}

function busPanel(variant, nameIdx, routeIdx) {
  const c = BUS[variant], name = BUS_NAMES[nameIdx], route = BUS_ROUTES[routeIdx];
  return panelMaterial('bus|' + variant + '|' + nameIdx + '|' + routeIdx, 768, 128, (g, w, h) => {
    g.fillStyle = css(c.a); g.fillRect(0, 0, w, h);
    g.fillStyle = css(c.c); g.fillRect(0, 6, w, 5); g.fillRect(0, h - 11, w, 5);
    g.textAlign = 'center';
    const ink = luma(c.a) > 0.6 ? '#1a1a1a' : '#ffffff';
    g.fillStyle = ink;
    g.font = '800 58px ' + FONT; g.fillText(name, w / 2, 70, w - 40);
    g.font = '500 30px ' + FONT; g.fillStyle = css(c.c); g.fillText(route, w / 2, 108, w - 40);
  });
}

// the painted back of a rickshaw seat: five little designs
function rickArt(design) {
  return panelMaterial('art|' + design, 128, 64, (g, w, h) => {
    const sky = ['#f2c500', '#e58aa8', '#3a6fc4', '#2f8f4e', '#d9472b'][design];
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff55';
    if (design === 0) { g.beginPath(); g.arc(64, 40, 22, Math.PI, 0); g.fill(); g.fillStyle = '#d9472b'; g.fillRect(0, 48, w, 16); }
    if (design === 1) { for (let i = 0; i < 6; i++) { g.fillStyle = ['#fff', '#d9472b', '#f2c500'][i % 3]; g.beginPath(); g.arc(14 + i * 20, 32 + (i % 2) * 8, 9, 0, 7); g.fill(); } }
    if (design === 2) { g.fillStyle = '#1c1c1c'; for (let i = 0; i < 8; i++) g.fillRect(i * 17, 0, 6, h); }
    if (design === 3) { g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 44, 20, Math.PI, 0); g.fill(); g.fillRect(44, 44, 40, 20); g.fillRect(22, 18, 6, 46); g.fillRect(100, 18, 6, 46); }
    if (design === 4) { g.fillStyle = '#f2c500'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(12 + i * 26, 20 + (i % 2) * 20, 7, 0, 7); g.fill(); } g.fillStyle = '#1c1c1c'; g.fillRect(0, 54, w, 10); }
    g.strokeStyle = '#1c1c1c'; g.lineWidth = 5; g.strokeRect(2, 2, w - 4, h - 4);
  });
}

// ---------- building one vehicle ----------
const BUS_PANEL_GEO = new THREE.PlaneGeometry(6.2, 0.93);
const ART_GEO = new THREE.PlaneGeometry(0.92, 0.48);
const RIDER_COLORS = [0xe0e0e0, 0x6b8f71, 0xb59a6a, 0xa94442, 0x2f6fb0, 0xc0c0c0, 0xe58aa8, 0xf2c500];

function addRider(group, mode, x, y, z, scale, opts) {
  const f = makeFigure(opts || {}, Math.random() * 1000);
  f.position.set(x, y, z);
  f.scale.setScalar(scale);
  f.userData.baseY = y;
  setMode(f, mode);
  group.add(f);
  return f;
}

function build(type) {
  const g = new THREE.Group();
  const riders = [];
  let variant = 0;
  if (type === 'rickshaw') {
    variant = Math.floor(Math.random() * RICK.length);
    g.add(new THREE.Mesh(rickshawGeo(variant), vehMat));
    const art = new THREE.Mesh(ART_GEO, rickArt(Math.floor(Math.random() * 5)));
    art.position.set(0, 0.95, -0.955);
    art.rotation.y = Math.PI;                                       // faces backwards
    g.add(art);
    riders.push(addRider(g, 'pedal', 0, 0.32, 0.4, 0.95, { shirt: pickOf(RIDER_COLORS), pants: 0x555555 }));
    if (Math.random() < 0.5) riders.push(addRider(g, 'sit', 0, 0.18, -0.55, 0.8, { shirt: pickOf(RIDER_COLORS), robe: Math.random() < 0.4 ? pickOf([0xe58aa8, 0x6b8f71, 0xc8102e, 0x3a6fc4]) : undefined }));
  } else if (type === 'cng') {
    variant = Math.floor(Math.random() * CNG.length);
    g.add(new THREE.Mesh(cngGeo(variant), vehMat));
    riders.push(addRider(g, 'sit', 0, 0.1, 0.38, 0.82, { shirt: 0x6b7a8f, pants: 0x333344 }));
    if (Math.random() < 0.45) riders.push(addRider(g, 'sit', 0.05, 0.1, -0.7, 0.82, { shirt: pickOf(RIDER_COLORS) }));
  } else {
    variant = Math.floor(Math.random() * BUS.length);
    const rack = Math.random() < 0.5;
    g.add(new THREE.Mesh(busGeo(variant, rack), vehMat));
    const panel = busPanel(variant, Math.floor(Math.random() * BUS_NAMES.length), Math.floor(Math.random() * BUS_ROUTES.length));
    const right = new THREE.Mesh(BUS_PANEL_GEO, panel);
    right.position.set(1.215, 1.07, -0.3); right.rotation.y = Math.PI / 2;
    const left = new THREE.Mesh(BUS_PANEL_GEO, panel);
    left.position.set(-1.215, 1.07, -0.3); left.rotation.y = -Math.PI / 2;
    g.add(right, left);
    if (Math.random() < 0.55) {                                      // people hanging on at the door
      riders.push(addRider(g, 'cling', 1.35, 0.45, -3.4, 0.85, { shirt: pickOf(RIDER_COLORS) }));
      riders.push(addRider(g, 'cling', 1.35, 0.45, -2.5, 0.85, { shirt: pickOf(RIDER_COLORS) }));
    }
  }
  return { group: g, riders };
}

// ---------- the traffic ----------
function makeVehicle(laneIdx, z, speedFactor = 1) {
  const lane = lanes[laneIdx];
  const type = KIND[lane.kind].pick(Math.random());
  const T = TYPES[type];
  const { group, riders } = build(type);
  const vd = rnd(T.vmin, T.vmax);
  const veh = {
    type, lane: laneIdx, dir: lane.dir, hl: T.hl, hw: T.hw,
    baseX: lane.x + rnd(-0.15, 0.15), x: lane.x, z, vd, v: vd * speedFactor,
    group, riders, halt: 0, honkT: rnd(0.5, 4), alertT: 0, jolt: 0, inHole: false, inPuddle: false,
    phase: rnd(0, 6.28), weave: type === 'cng' ? rnd(0.1, 0.3) : 0.05,
  };
  veh.x = veh.baseX;
  group.rotation.y = lane.dir > 0 ? 0 : Math.PI;
  group.position.set(veh.x, 0, z);
  sceneRef.add(group);
  lane.list.push(veh);
  return veh;
}

function removeVehicle(lane, veh) {
  sceneRef.remove(veh.group);
  lane.list = lane.list.filter(v => v !== veh);
}

export function initTraffic(scene) { sceneRef = scene; }

export function resetTraffic(pz = 0) {
  for (const lane of lanes) {
    for (const v of lane.list) sceneRef.remove(v.group);
    lane.list = [];
    lane.gap = gapFor(lane);
  }
  threat = null;
  // fill the street straight away, so it is busy from the first second
  lanes.forEach((lane, idx) => {
    let z = pz - 85 + rnd(0, 10);
    while (z < pz + 28) {
      const v = makeVehicle(idx, z);
      z += v.hl * 2 + spaceFor(lane);
    }
  });
}

function nearestInLane(lane, z) {
  let best = 1e9;
  for (const v of lane.list) best = Math.min(best, Math.abs(v.z - z) - v.hl);
  return best;
}

function honk(veh, pp, dist, isThreat) {
  const vol = isThreat ? 1 : Math.max(0.15, 1 - dist / 45);
  if (veh.type === 'rickshaw') bellSound(vol, veh.x, veh.z); else hornSound(veh.type, vol, veh.x, veh.z);
  events.push({ t: 'honk', v: veh, threat: isThreat });
}

export function updateTraffic(dt, time, pp) {
  events.length = 0;
  threat = null;

  // 1) new vehicles: appear far away in the fog (or, for the lanes that drive away, now and then behind the camera)
  lanes.forEach((lane, idx) => {
    const behindEdge = lane.dir < 0 && Math.random() < dt * 0.2;   // now and then: a vehicle that overtakes from behind
    const zs = behindEdge ? pp.z + BEHIND - 6 : pp.z - AHEAD;
    if (nearestInLane(lane, zs) > lane.gap + 3) {
      makeVehicle(idx, zs);
      lane.gap = gapFor(lane);
    }
  });

  // 2) move
  for (const lane of lanes) {
    lane.list.sort((a, b) => a.z - b.z);
    const L = lane.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const v = L[i];
      const lead = lane.dir > 0 ? L[i + 1] : L[i - 1];

      // follow the vehicle in front
      let target = v.vd;
      if (lead) {
        const gap = lane.dir > 0 ? (lead.z - lead.hl) - (v.z + v.hl) : (v.z - v.hl) - (lead.z + lead.hl);
        const safe = 1.6 + v.v * 0.8;
        if (gap < safe) target = Math.min(target, Math.max(0, lead.v + (gap - 1.2) * 1.6));
      }
      if (v.halt > 0) { v.halt -= dt; target = 0; }
      if (v.inHole) target *= 0.6;

      v.v += Math.max(-14 * dt, Math.min(4 * dt, target - v.v));
      if (v.v < 0) v.v = 0;
      v.z += lane.dir * v.v * dt;
      v.x = v.baseX + Math.sin(time * 0.9 + v.phase) * v.weave;

      // potholes shake the vehicle, puddles splash
      const hole = potholeAt(v.x, v.z, 0.1);
      if (hole && !v.inHole) { v.inHole = true; v.jolt = 0.45; v.v *= 0.6; }
      else if (!hole && v.inHole) v.inHole = false;
      if (puddleAt(v.x, v.z, 0.2)) {
        if (!v.inPuddle && v.v > 2.5) events.push({ t: 'splash', x: v.x, z: v.z, v });
        v.inPuddle = true;
      } else v.inPuddle = false;

      // the picture
      v.jolt = Math.max(0, v.jolt - dt);
      const jig = v.jolt > 0 ? Math.abs(Math.sin(v.jolt * 40)) * 0.1 * (v.jolt / 0.45) : 0;
      v.group.position.set(v.x, jig, v.z);
      v.group.rotation.z = v.type === 'rickshaw' ? Math.sin(time * 4 + v.phase) * 0.025 * Math.min(1, v.v / 2) : jig * 0.4;
      for (const r of v.riders) animateFigure(r, dt, time, v.v);

      // threat to the player and honking
      const ahead = (pp.z - v.z) * v.dir;                           // > 0: the player is in front of the vehicle
      const dPlayer = Math.hypot(pp.x - v.x, pp.z - v.z);
      v.honkT -= dt;
      v.alertT -= dt;
      if (v.v > 1.5 && ahead > 0 && ahead < 14 + v.v * 0.9 && Math.abs(pp.x - v.x) < v.hw + 1.0) {
        if (!threat || ahead < threat.dist) threat = { v, dist: ahead, behind: v.z - pp.z > 3, x: v.x };
        if (v.alertT <= 0) { honk(v, pp, dPlayer, true); v.alertT = 2.4; v.honkT = Math.max(v.honkT, 2); }   // warns at once
      } else if (v.honkT <= 0 && dPlayer < 45 && time - lastAmbient > 0.9 && Math.random() < dt * 0.35) {
        honk(v, pp, dPlayer, false); v.honkT = rnd(4, 9); lastAmbient = time;
      }

      // gone
      if (v.z > pp.z + BEHIND + 10 || v.z < pp.z - KEEP_AHEAD) removeVehicle(lane, v);
    }
  }
  return events;
}

// first moving vehicle that touches a circle on the ground, or null
export function vehicleAt(x, z, r = 0.3, minSpeed = 1.0) {
  for (const lane of lanes) {
    for (const v of lane.list) {
      if (v.v < minSpeed) continue;
      if (Math.abs(x - v.x) < v.hw + r && Math.abs(z - v.z) < v.hl + r) return v;
    }
  }
  return null;
}

// the vehicle has hit somebody: it brakes hard and honks
export function hitVehicle(v) {
  v.halt = 0.9;
  v.v *= 0.25;
  v.honkT = 1.5;
  crashSound(0.8, v.x, v.z);
  if (v.type === 'rickshaw') bellSound(1, v.x, v.z); else hornSound(v.type, 1, v.x, v.z);
}

export function getThreat() { return threat; }

export function allVehicles() {
  const out = [];
  for (const l of lanes) for (const v of l.list) out.push(v);
  return out;
}
