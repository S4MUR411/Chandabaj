// js/world/shops.js
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { mulberry32, pick, range, pickInt } from '../rng.js';
import { billboardMaterial, PARTIES } from './posters.js';

const NAMES = [
  'আদর্শ মুদি', 'রহিম টেলিকম', 'ভাই ভাই হোটেল', 'নিউ ফার্মেসী',
  'সততা সুইটস', 'তাজা ফল ভান্ডার', 'বিসমিল্লাহ চা স্টল',
  'শাপলা টেইলার্স', 'আলো জুয়েলার্স', 'সোনালী ইলেকট্রনিক্স',
  'পলাশ বুক স্টোর', 'নূর ফার্নিচার', 'মেঘনা মাছ ঘর', 'দোলা বিউটি পার্লার',
  'রূপসী কসমেটিকস', 'হাজী মোবাইল সার্ভিসিং', 'আল-মদিনা ফার্নিচার',
  'মায়ের দোয়া স্টোর', 'ভাই ভাই ট্রেডার্স', 'মদিনা টেলিকম',
  'নিউ মডেল টেইলার্স', 'লাকী ফটোকপি', 'জননী জেনারেল স্টোর',
  'শাপলা সুইটস', 'সোনার বাংলা হোটেল', 'ঢাকা অপটিক্যাল',
  'নূর ইলেকট্রনিক্স', 'আদর্শ লাইব্রেরি', 'তাজ বিরিয়ানি হাউস',
  'নিউ ফ্যাশন হাউস', 'রহমান টায়ার হাউস', 'মুক্তা জুয়েলার্স',
  'গ্রামীণ চা স্টল', 'সততা ডেন্টাল কেয়ার', 'দেশ বাংলা ট্রাভেলস',
];
const AWNING_COLORS = [0xc8102e, 0x1d4e9e, 0xf2c500, 0x0b6e4f, 0xd9671a];
const BODY_COLORS = [0xd9b99b, 0xcfd6c4, 0xe3c9a0, 0xc9b7d6, 0xd9a5a0, 0xe8d5b0];

// Shop fronts stand on the outer edge of the footpath: road half-width + footpath width.
const FRONT = CONFIG.roadWidth / 2 + CONFIG.footWidth;
// Width (along the street) of the shop front itself: sign, glass, shelf, shutter.
const SW = 4.6;

const matCache = new Map();
const mat = (c) => { let m = matCache.get(c); if (!m) { m = new THREE.MeshLambertMaterial({ color: c }); matCache.set(c, m); } return m; };

// ---------- sign boards ----------
const SIGN_BG = ['#0d6b46', '#7a1d1d', '#1d3a7a', '#6b4a0d', '#4a0d6b', '#0d5a7a'];
const SIGN_W = 512, SIGN_H = 128;
const signCache = new Map();

function drawSign(canvas, name, bg) {
  const g = canvas.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, SIGN_W, SIGN_H);
  g.strokeStyle = '#f4f1ea'; g.lineWidth = 8; g.strokeRect(6, 6, SIGN_W - 12, SIGN_H - 12);
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = '800 56px "Anek Bangla", "Noto Sans Bengali", sans-serif';
  g.fillText(name, SIGN_W / 2, 84, SIGN_W - 40);
}

function signMaterial(name, colorIdx) {
  // chunk numbers are negative when walking "up" the street; keep the colour index 0..5
  const bgIdx = ((colorIdx % 6) + 6) % 6;
  const key = name + '|' + bgIdx;
  let m = signCache.get(key);
  if (m) return m;

  const c = document.createElement('canvas');
  c.width = SIGN_W; c.height = SIGN_H;
  drawSign(c, name, SIGN_BG[bgIdx]);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  m = new THREE.MeshBasicMaterial({ map: tex });
  signCache.set(key, m);

  // The web font usually arrives after the first draw: draw again once it is loaded.
  if (document.fonts && document.fonts.load) {
    document.fonts.load('800 56px "Anek Bangla"', name)
      .then(() => { drawSign(c, name, SIGN_BG[bgIdx]); tex.needsUpdate = true; })
      .catch(() => {});
  }
  return m;
}

// ---------- hanging sign: sticks out over the footpath, so it faces the camera and can be read ----------
const BLADE_W = 256, BLADE_H = 128;
const bladeCache = new Map();

// split a shop name into at most two lines of about equal length
function twoLines(name) {
  const words = name.split(' ');
  if (words.length < 2) return [name];
  let best = 1, diff = 1e9;
  for (let k = 1; k < words.length; k++) {
    const d = Math.abs(words.slice(0, k).join(' ').length - words.slice(k).join(' ').length);
    if (d < diff) { diff = d; best = k; }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

function drawBlade(canvas, name, bg) {
  const g = canvas.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, BLADE_W, BLADE_H);
  g.strokeStyle = '#f4f1ea'; g.lineWidth = 6; g.strokeRect(5, 5, BLADE_W - 10, BLADE_H - 10);
  g.fillStyle = '#fff'; g.textAlign = 'center';
  const lines = twoLines(name);
  if (lines.length === 1) {
    g.font = '800 50px "Anek Bangla", "Noto Sans Bengali", sans-serif';
    g.fillText(lines[0], BLADE_W / 2, 80, BLADE_W - 24);
  } else {
    g.font = '800 44px "Anek Bangla", "Noto Sans Bengali", sans-serif';
    g.fillText(lines[0], BLADE_W / 2, 56, BLADE_W - 24);
    g.fillText(lines[1], BLADE_W / 2, 106, BLADE_W - 24);
  }
}

function bladeMaterial(name, colorIdx) {
  const bgIdx = ((colorIdx % 6) + 6) % 6;
  const key = name + '|' + bgIdx;
  let m = bladeCache.get(key);
  if (m) return m;
  const c = document.createElement('canvas');
  c.width = BLADE_W; c.height = BLADE_H;
  drawBlade(c, name, SIGN_BG[bgIdx]);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  m = new THREE.MeshBasicMaterial({ map: tex });
  bladeCache.set(key, m);
  if (document.fonts && document.fonts.load) {
    document.fonts.load('800 44px "Anek Bangla"', name)
      .then(() => { drawBlade(c, name, SIGN_BG[bgIdx]); tex.needsUpdate = true; })
      .catch(() => {});
  }
  return m;
}
const BLADE_GEO = new THREE.PlaneGeometry(1.8, 0.95);
const BOARD_GEO = new THREE.PlaneGeometry(5, 2.5);

// ---------- the shutter that comes down when a shop is closed ----------
let shutterMat = null;
function shutterMaterial() {
  if (shutterMat) return shutterMat;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#7d8085'; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = '#5d6065'; g.lineWidth = 4;
  for (let y = 12; y < 256; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  g.textAlign = 'center';
  g.font = '800 130px "Anek Bangla", "Noto Sans Bengali", sans-serif';
  g.lineWidth = 12; g.strokeStyle = '#fff'; g.strokeText('বন্ধ', 256, 170);
  g.fillStyle = '#c8102e'; g.fillText('বন্ধ', 256, 170);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  shutterMat = new THREE.MeshBasicMaterial({ map: tex });
  return shutterMat;
}

// ---------- building pieces ----------
// Windows for the upper floors, on the face that looks at the road.
function addUpperWindows(group, side, width, height, zOff, len) {
  const n = Math.max(1, Math.floor((len - 1) / 2));
  for (let f = 0; 4.4 + f * 1.5 + 0.4 < height - 0.2; f++) {
    for (let w = 0; w < n; w++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.85), mat(0x222222));
      win.position.set(-side * (width / 2 + 0.01), 4.4 + f * 1.5, zOff + (w - (n - 1) / 2) * 2);
      group.add(win);
    }
  }
}

// A plain neighbouring building (door + windows) so the street has no gaps.
function addFlank(group, side, width, zOff, len, rng, bandDrop) {
  const h = 3.6 + pickInt(rng, 0, 3) * 1.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, h, len), mat(pick(rng, BODY_COLORS)));
  body.position.set(0, h / 2, zOff);
  body.receiveShadow = true;
  group.add(body);

  const band = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, 0.3, len + 0.2), mat(0x7d6a56));
  band.position.set(0, h + 0.15 - bandDrop, zOff);   // tiny height difference: touching roofs must not flicker
  group.add(band);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 1.2), mat(0x5a3d26));
  door.position.set(-side * (width / 2 + 0.03), 1.1, zOff);
  group.add(door);

  addUpperWindows(group, side, width, h, zOff, len);
}

export function buildShop(side, zc, chunkIdx, rng) {
  const group = new THREE.Group();

  const depth = range(rng, 6, 9);            // length along the street
  const width = 8 + range(rng, 0, 2);        // how far the building reaches back from the street
  const height = 3.6 + pickInt(rng, 0, 3) * 1.2;
  const awnColor = pick(rng, AWNING_COLORS);
  const name = pick(rng, NAMES);             // ONE name, used for the sign and for the game

  // The building starts exactly at the edge of the footpath and goes outwards.
  group.position.set(side * (FRONT + width / 2), 0, zc);
  const faceX = -side * (width / 2);         // front face, relative to the group

  // main body
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat(pick(rng, BODY_COLORS)));
  body.position.y = height / 2;
  body.castShadow = true; body.receiveShadow = true;
  group.add(body);

  // roof band
  const roofBand = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, 0.3, depth + 0.2), mat(0x7d6a56));
  roofBand.position.y = height + 0.15;
  group.add(roofBand);

  // neighbours on both sides fill the rest of the chunk
  const flank = (CONFIG.chunkLen - depth) / 2;
  if (flank > 0.5) {
    addFlank(group, side, width, -(depth / 2 + flank / 2), flank, rng, 0.01);
    addFlank(group, side, width, +(depth / 2 + flank / 2), flank, rng, 0.02);
  }

  // glass front under the sign
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.6, SW), mat(0x2b3a44));
  glass.position.set(faceX - side * 0.025, 1.05, 0);
  group.add(glass);

  // sign board (faces the road)
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(SW, SW / 4), signMaterial(name, chunkIdx + (side > 0 ? 3 : 0)));
  sign.position.set(faceX - side * 0.03, 3.0, 0);
  sign.rotation.y = -side * Math.PI / 2;
  group.add(sign);

  // small awning over the shopfront (kept short so it never hides the player)
  const awn = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, SW + 0.4), mat(awnColor));
  awn.position.set(faceX - side * 0.2, 2.25, 0);
  awn.rotation.z = side * 0.3;
  group.add(awn);

  // hanging sign at the end of the shop front: an arm out over the footpath, the sign hangs from it.
  // It is turned towards the camera (the main sign board faces across the street and is seen at a slant).
  {
    const bx = faceX - side * 1.05, bz = SW / 2 + 0.35;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 0.06), mat(0x333333));
    arm.position.set(bx, 3.62, bz);
    group.add(arm);
    for (const dx of [-0.75, 0.75]) {
      const chain = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.02), mat(0x333333));
      chain.position.set(bx + dx, 3.5, bz);
      group.add(chain);
    }
    const bm = bladeMaterial(name, chunkIdx + (side > 0 ? 3 : 0));
    const front = new THREE.Mesh(BLADE_GEO, bm);
    front.position.set(bx, 3.0, bz + 0.02);
    const back = new THREE.Mesh(BLADE_GEO, bm);
    back.position.set(bx, 3.0, bz - 0.02);
    back.rotation.y = Math.PI;
    group.add(front, back);
  }

  // some shops have a big election board standing on the roof (its own random numbers, so the shop itself does not change)
  {
    const r2 = mulberry32(0xb111 ^ (chunkIdx * 7 + (side > 0 ? 1 : 0)));
    if (r2() < 0.35) {
      const party = pickInt(r2, 0, PARTIES.length - 1), k = pickInt(r2, 0, 1);
      const bx = -side * (width / 2 - 2.9), bz = range(r2, -(depth / 2 - 2.8), depth / 2 - 2.8);
      const by = height + 0.3;
      for (const dx of [-2, 2]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 0.14), mat(0x555555));
        post.position.set(bx + dx, by + 0.5, bz);
        group.add(post);
      }
      const frame = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.7, 0.1), mat(0x333333));
      frame.position.set(bx, by + 1.0 + 1.25, bz - 0.06);
      group.add(frame);
      const board = new THREE.Mesh(BOARD_GEO, billboardMaterial(party, k));
      board.position.set(bx, by + 1.0 + 1.25, bz);
      group.add(board);
    }
  }

  // upper-floor windows
  addUpperWindows(group, side, width, height, 0, depth);

  // stock: a shelf with goods against the front wall (hidden when the shop is closed)
  const stock = new THREE.Group();
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, SW), mat(0x8a6a44));
  shelf.position.set(faceX - side * 0.2, 0.45, 0);
  stock.add(shelf);
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.28, 0.28),
      mat(pick(rng, [0xd9472b, 0xf2c500, 0x2f8f4e, 0x3a6fc4, 0xeeeeee]))
    );
    g.position.set(faceX - side * 0.2, 1.04, -SW / 2 + 0.5 + i * (SW - 1) / 4 + range(rng, -0.1, 0.1));   // spread out, never overlapping
    stock.add(g);
  }
  group.add(stock);

  // shutter (shown when the shop is closed)
  const shutter = new THREE.Mesh(new THREE.PlaneGeometry(SW, 2.3), shutterMaterial());
  shutter.position.set(faceX - side * 0.07, 1.15, 0);
  shutter.rotation.y = -side * Math.PI / 2;
  shutter.visible = false;
  group.add(shutter);

  // `open` is a property: whoever sets shop.open = false / true also changes how the shop looks
  return {
    group,
    x: side * (FRONT - 0.4),
    z: zc,
    side,
    name,
    base: range(rng, 120, 300),
    sq: 0,
    cool: 0,
    down: 0,
    _open: true,
    get open() { return this._open; },
    set open(v) {
      this._open = !!v;
      shutter.visible = !this._open;
      stock.visible = this._open;
    },
  };
}
