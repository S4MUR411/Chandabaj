// js/main.js
import * as THREE from 'three';
import { CONFIG, GEO, footX } from './config.js';
import { ensureChunks, allShops, initChunks } from './world/chunks.js';
import { initSky, updateSky } from './world/sky.js';
import { potholeAt, puddleAt } from './world/hazards.js';
import { makeFigure } from './actors/figure.js';
import { animateFigure, setMode } from './actors/pose.js';
import { initTraffic, resetTraffic, updateTraffic, vehicleAt, hitVehicle, getThreat, allVehicles } from './actors/vehicles.js';
import {
  initCrowd, resetCrowd, updateCrowd, witness, informedCount, formMob, mobMembers, releaseMob,
  knockDown, startBeating, endBeating, alertCop, copChasing, dismissCop, allActors,
} from './actors/crowd.js';
import {
  initAudio, cashSound, thudSound, sirenSound, bribeSound, stepSound, splashSound,
  setListener, toggleMute, isMuted, suspendAudio, chargeSound, jumpSound,
} from './fx/audio.js';
import { initInput, updateInput, input, keyHint, releaseAll, showTouch } from './input.js';
import { updateEngines, resetEngines } from './fx/engines.js';
import { updateAmbience, resetAmbience } from './fx/ambience.js';
import { initVoice, speak, setPlayerRef, cycleVoiceMode, voiceMode } from './fx/voice.js';
import { IMPACT, pickLine } from './fx/lines.js';
import { initBubbles, updateBubbles, bubble, clearBubbles, onSpeak } from './ui/bubbles.js';
import { say, showTicker } from './ui/ticker.js';
import { bn, tk } from './util/bengali.js';
import { $ } from './util/dom.js';

// --- Scene Setup ---
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb0c8e0);
scene.fog = new THREE.Fog(0xb0c8e0, 30, 100);

const camera = new THREE.PerspectiveCamera(CONFIG.cam.fov, innerWidth / innerHeight, 0.1, 200);
const hemi = new THREE.HemisphereLight(0xfff4dc, 0x8a7a5e, 1.1);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffe0a8, 0.9);
sun.position.set(-8, 18, 6);
sun.castShadow = true;
scene.add(sun);

initChunks(scene);
initSky(scene);
initTraffic(scene);
initCrowd(scene);
initBubbles(camera);

const START_X = footX(5.6);   // you start on the footpath, out of the traffic
const MAX_X = GEO.front - 0.4;   // you cannot walk into the shop fronts
const player = makeFigure({ shirt: 0x1b1b1b, pants: 0x222222, skin: 0xc58c63 });
player.position.set(START_X, 0, 0);
player.rotation.y = Math.PI;
scene.add(player);

const blobShadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.35, 16),
  new THREE.MeshBasicMaterial({ color: 0x000, transparent: true, opacity: 0.3, depthWrite: false })
);
blobShadow.rotation.x = -Math.PI / 2;
blobShadow.position.y = 0.01;
scene.add(blobShadow);

// --- State ---
const S = {
  on: false, cash: 0, anger: 0, heat: 0, time: 100,
  town: 1, stam: 1, stun: 0, immune: 0, closed: 0, beaten: 0,
  hp: CONFIG.maxHp, beat: 0, fall: 0, slow: 0, knockTo: null, hpZeroT: 0, cause: '',
  beatings: 0, vehicleHits: 0, holeTrips: 0, inHole: false, inPuddle: false,
  mobActive: false, mobTimer: 0, copActive: false, henchmen: 0, air: false,
};
let henchmanObjs = [];
let paused = false;
let time = 0;
let last = performance.now();
let stepTimer = 0;
let beatSayT = 0;
const J = { on: false, t: 0, h: 0 };         // the jump in progress
let lastPuddleSay = -99;
let beatT = 0;
let shake = 0;
let quiet = 0;             // short pause between "run over" jokes, so they do not repeat every frame

// --- Input (all devices are in js/input.js) ---
let jumpBuf = 0;                     // a Space press is remembered for a moment, so a jump pressed a hair too early still happens
function onPress(name) {
  if (!S.on) return;
  if (name === 'mute') toast(toggleMute() ? '🔇 সব আওয়াজ বন্ধ (M চাপলে আবার চালু)' : '🔊 আওয়াজ চালু');
  else if (name === 'voice') {
    const m = cycleVoiceMode();
    toast(m === 'off' ? '🗣️ কণ্ঠ বন্ধ — শুধু লেখা' : m === 'babble' ? '🗣️ গুনগুন কণ্ঠ (মজার বকবক)' : '🗣️ বাংলা কণ্ঠ (ফোনে থাকলে)');
  } else if (name === 'pause') togglePause();
  else if (!paused) {
    if (name === 'bribe') bribe();
    else if (name === 'hire') hireHenchman();
    else if (name === 'jump') jumpBuf = 0.18;
    else if (name.startsWith('ask')) act(+name.slice(3));         // the old 1-4 keys: choose the level directly
  }
}
// the chada button went down / up (E, left click, X, the big touch button)
function onAction(down, cancelled) {
  if (down) grabStart();
  else if (grab.active) { if (cancelled) cancelGrab(); else grabRelease(); }
}
initInput({ onPress, onAction });

// the camera follows you sideways, but stays on the road (a lamp pole or a hanging sign must never pass through the lens)
function camX(x) { return Math.max(-GEO.half + 0.8, Math.min(GEO.half - 0.8, x * 0.92)); }
let camSpeed = 0;

// The low chase camera: close behind the player, a little above his head, looking down the street (see CONFIG.cam).
const camPos = new THREE.Vector3(camX(START_X), CONFIG.cam.up, CONFIG.cam.back);
const camLook = new THREE.Vector3(START_X, CONFIG.cam.lookY, -CONFIG.cam.lookAhead);

// --- Helpers ---
function near() {
  let best = null, bd = CONFIG.nearRadius + 2.5;
  for (const h of allShops()) {
    if (!h.open) continue;
    const d = Math.hypot(h.x - player.position.x, h.z - player.position.z);
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}

const funToasts = [
  "“টাকা দিবি নাকি দোকান ভাঙবো?”",
  "বসের সালাম নিবি!",
  "উন্নয়নের চাঁদা ক্যাশ করে নিলেন ভাই!",
  "দোকানদার ভয়ে ক্যাশবাক্স খুলে দিল!",
  "“এই বাজারে থাকতে হলে সালামি মাস্ট!”"
];
const pickOf = (arr) => arr[Math.floor(Math.random() * arr.length)];

function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.remove('s');
  void el.offsetWidth;
  el.classList.add('s');
}

// red flash on the screen (hit, beating) and brown splash (mud)
function flash(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
}

function togglePause() {
  paused = !paused;
  if (paused) cancelGrab();
  $('#pauseBadge').hidden = !paused;
  audioPause(paused);
}

// While the game is paused (or the newspaper is shown) the street is silent. Engines fade out first, then the sound is frozen.
function audioPause(on) {
  if (on) { resetEngines(); setTimeout(() => { if (paused) suspendAudio(true); }, 350); }
  else suspendAudio(false);
}
// a hidden browser tab must not keep droning
document.addEventListener('visibilitychange', () => { if (document.hidden) suspendAudio(true); else if (!paused) suspendAudio(false); });
// every speech bubble is also spoken (see fx/voice.js)
onSpeak(speak);

// --- Health ---
// `cause` says what hurt you last, for the newspaper if you end up in hospital
function hurt(n, cause) {
  S.hp = Math.max(0, S.hp - n);
  S.cause = cause;
  flash('hurt');
}

// --- Henchmen System ---
function hireHenchman() {
  const cost = 500;
  if (S.cash < cost) {
    toast('পকেটে ৫০০ টাকা নাই, মাস্তান পুষবেন কেমনে?');
    return;
  }
  S.cash -= cost;
  S.henchmen++;
  toast('দল ভারী হলো! +১ মাস্তান ছোকরা যোগ দিল');
  say(`ব্রেকিং: আন্ডারওয়ার্ল্ডে গুঞ্জন — ‘ভাই’-এর বহরে যুক্ত হলো নতুন ক্যাডার!`, 'breaking');

  const h = makeFigure({ shirt: 0x334455, pants: 0x111111, skin: 0xc58c63 });
  h.position.set(
    player.position.x + (Math.random() - 0.5) * 3,
    0,
    player.position.z + 3 + Math.random() * 2
  );
  scene.add(h);
  henchmanObjs.push(h);
}

// --- Extortion Logic ---
const AM = [0.5, 1, 1.6, 2.6];
const AA = [25, 40, 60, 100];
const AH = [20, 35, 55, 100];
const AC = [5, 8, 11, 0];

const humorousQuotes = [
  "“ভাইজান, বাকিতে একটু ছাড় দেন না!” — দোকানদার কেঁদে ফেলল।",
  "“চাঁদা না দিলে পুলিশ ডাকবো!” — দোকানদারের হুমকি হাওয়ায় মিলিয়ে গেল।",
  "“আজকের চা-নাস্তার খরচ উঠে গেল!”",
  "“আপনেরে দেখলেই বুকের ভেতর কাঁপন ধরে ভাই!”"
];

const coolToast = (h) => toast(h.sq > 2 ? '“ভাই আজ তো তিনবার দিলাম, আর রক্ত নাই!”' : '“আজ তো দিলামই!”');

// k = how tough (0 soft ask, 1 demand, 2 beat, 3 vandalise); shop = the one you were charging (default: the nearest)
function act(k, shop) {
  if (S.stun > 0) return;
  const h = shop || near();
  if (!h) {
    toast('আশেপাশে কোনো শিকার বা দোকান নেই!');
    return;
  }
  if (h.cool > 0) {
    coolToast(h);
    return;
  }

  const pay = Math.round(h.base * AM[k] * Math.max(0.3, 1 - h.sq * 0.28) * Math.max(0.35, S.town));
  h.sq++;
  h.cool = AC[k];
  S.cash += pay;

  bubble(player, pickLine('demand' + k), 'say', 2.0, 2.5);        // what you say to the shopkeeper

  // the people on the street see it: they will tell each other, and they are the ones who form the mob later
  const told = witness(h.x, h.z, k, h);
  const crowdFactor = told >= 5 ? 1.25 : told <= 1 ? 0.6 : 1;      // a quiet corner is safer than a crowded one

  S.anger = Math.min(100, S.anger + AA[k] * crowdFactor);
  S.heat = Math.min(100, S.heat + AH[k]);
  S.town = Math.max(0.35, S.town - (k >= 2 ? 0.04 : 0));

  if (k >= 2) { h.down = 4; S.beaten++; }
  if (k === 3) { h.open = false; S.closed++; }

  toast('+' + tk(pay) + ' | ' + pickOf(humorousQuotes));
  cashSound();
  say(`বাজার আপডেট: ${h.name}-এ চাঁদা আদায় ${tk(pay)}`, 'latest');

  if (S.anger >= 100 && !S.mobActive) startMob();
  if (S.heat >= 100 && !S.copActive) callCop();
}

// --- The chada button: tap = a soft ask; hold = tougher and tougher (demand, beat, vandalise); let go to do it ---
const STAGES = ['নরম চাঁদা', 'দাবি', 'মার', 'ভাঙচুর'];
const grab = { active: false, t: 0, stage: 0, shop: null };
const stageOf = (t) => (t >= CONFIG.grab.t3 ? 3 : t >= CONFIG.grab.t2 ? 2 : t >= CONFIG.grab.t1 ? 1 : 0);

function grabStart() {
  if (!S.on || paused || S.stun > 0 || S.beat > 0) return;
  const h = near();
  if (!h) { toast('আশেপাশে কোনো শিকার বা দোকান নেই!'); return; }
  if (h.cool > 0) { coolToast(h); return; }
  grab.active = true; grab.t = 0; grab.stage = 0; grab.shop = h;
}
function cancelGrab() { grab.active = false; grab.shop = null; }
function grabRelease() { const h = grab.shop, k = grab.stage; cancelGrab(); act(k, h); }

// every frame while the button is held: count the time, step up a level, drop it if the shop is no longer in reach
function updateGrab(dt) {
  if (!grab.active) return;
  const h = grab.shop;
  if (S.stun > 0 || S.beat > 0 || !h.open || h.cool > 0 || near() !== h) { cancelGrab(); return; }
  grab.t += dt;
  const st = stageOf(grab.t);
  if (st > grab.stage) { grab.stage = st; chargeSound(st); shake = Math.max(shake, 0.05 * st); }
}

function bribe() {
  if (S.heat < 50) { toast('এখনো চা-পানির দরকার নেই'); return; }
  const cost = Math.max(CONFIG.bribeMin, Math.round(S.cash * 0.25 / 50) * 50);
  if (S.cash < cost) { toast('থানার দারোগাকে খাওয়ানোর মতো টাকা নেই!'); return; }

  S.cash -= cost;
  S.heat = 30;
  S.copActive = false;
  const cop = copChasing();
  if (cop) bubble(cop.fig, pickLine('bribe'), 'say', 2.6, 2.45);
  dismissCop();                                    // the constable walks back to his post
  bribeSound();

  toast('−' + tk(cost) + '  চা-পানি দিয়ে লাইনঘাট ক্লিয়ার!');
  say(`ব্রেকিং: থানার সাথে গোপন সমঝোতা সফল! ফাইল ক্লোজ।`, 'breaking');
}

// --- Threats ---
// The mob is made of the people who were already standing on the street (see crowd.js).
function startMob() {
  if (S.mobActive) return;
  const n = formMob(player.position, 8);
  if (n < 2) {
    S.anger = 55;
    toast('রাস্তা ফাঁকা — কেউ সাহস পেল না!');
    return;
  }
  S.mobActive = true;
  S.mobTimer = CONFIG.mobLifeSec;
  S.anger = 100;
  toast('⚠️ জনতা খেপে লাল! তেড়ে আসছে!');
  say('ব্রেকিং: অতিষ্ঠ বাজারবাসীর গণধোলাই অভিযান শুরু!', 'breaking');
}

function callCop() {
  if (S.copActive) return;
  S.heat = 100;
  if (!alertCop(player.position)) { S.heat = 80; return; }   // nobody around (should not happen)
  S.copActive = true;
  toast('🚨 পুলিশ হাজির! B চেপে চা-পানি দিন!');
  say('ব্রেকিং: ট্রাফিক সার্জেন্টের নজরে পড়েছেন চাঁদাবাজ — ধাওয়া শুরু!', 'breaking');
  sirenSound();
}

function endMob(message) {
  S.mobActive = false;
  S.mobTimer = 0;
  S.anger = 50;
  toast(message);
}

// The crowd caught you: everybody piles in.
function beginBeating() {
  const n = startBeating(player.position);
  S.beat = CONFIG.beatSec;
  S.stun = CONFIG.beatSec;
  S.immune = CONFIG.beatSec + 2.5;
  S.fall = 0.4;
  S.beatings++;
  beatT = 0;
  shake = 0.35;
  const loss = Math.round(S.cash * CONFIG.beatLoss);
  S.cash -= loss;
  hurt(CONFIG.beatHp, 'beat');
  toast('গণধোলাই! ' + bn(n) + ' জন মিলে পিটাচ্ছে — −' + tk(loss));
  bubble(player, pickLine('beaten'), 'say', 2.6, 2.5);
  beatSayT = 1.8;
  say('ব্রেকিং: হাতেনাতে ধরা পড়ে গণধোলাইয়ের শিকার চাঁদাবাজ!', 'breaking');
  thudSound();
}

const POW = IMPACT;               // the comic words (the list is in fx/lines.js)

// A moving vehicle hits you.
function hitByVehicle(v) {
  const H = CONFIG.hit[v.type];
  const loss = Math.round(S.cash * H.loss);
  S.cash -= loss;
  hurt(H.hp, 'vehicle:' + v.type);
  S.vehicleHits++;
  S.stun = Math.max(S.stun, H.stun);
  S.immune = S.stun + 2.0;
  S.fall = 0.5;
  shake = 0.3;
  // thrown out of the vehicle's way, towards the nearer side
  const dir = player.position.x >= v.x ? 1 : -1;
  S.knockTo = Math.max(-MAX_X, Math.min(MAX_X, v.x + dir * (v.hw + 0.9)));
  hitVehicle(v);
  bubble(player, pickOf(POW), 'pow', 0.9, 1.8);
  bubble(player, pickLine('hurt_' + v.type), 'say', 2.4, 2.5);
  const name = { rickshaw: 'রিকশা', cng: 'সিএনজি', bus: 'বাস' }[v.type];
  toast(name + 'র ধাক্কা! −' + tk(loss));
  say(`ব্রেকিং: ${name}র ধাক্কায় আহত চাঁদাবাজ — চালক বলছেন, “হর্ন তো দিছিলাম!”`, 'breaking');
}

// --- Game Over (Newspaper) ---
function endGame(kind) {
  S.on = false;
  paused = true;
  audioPause(true);
  $('#pauseBadge').hidden = true;
  clearBubbles();

  const arrested = kind === 'arrested';
  const hospital = kind === 'hospital';
  const cut = Math.round(S.cash * 0.3);
  const net = arrested || hospital ? 0 : S.cash - cut;
  const ok = S.cash >= CONFIG.quota && !arrested && !hospital;

  let head, quote1, quote2;
  if (arrested) {
    head = "“আমি তো শুধু ডাব খাইতে আসছিলাম” — হাতেনাতে ধরা মহা চাঁদাবাজ!";
    quote1 = Math.random() < 0.5 ? "“তোর নেতার নাম ক, নাইলে মাইর সোজা করব।”" : '“' + pickLine('arrest') + '”';
    quote2 = "ডিবি ইন্সপেক্টর";
  } else if (hospital) {
    if (S.cause === 'beat') {
      head = "গণধোলাইয়ে ‘ভাই’ হাসপাতালে — জনতার হাতে ধরাশায়ী চাঁদাবাজ!";
      quote1 = "“আর কোনোদিন চাঁদা তুলবে না — ডাক্তার বলছে, আঙুলও নাড়াতে পারবে না।”";
      quote2 = "জনৈক পথচারী";
    } else if (S.cause.startsWith('vehicle')) {
      head = "রাস্তা পার হতে গিয়ে গাড়ির ধাক্কা — হাসপাতালে চাঁদাবাজ!";
      quote1 = "“আমি তো সমানে হর্ন দিছিলাম, উনি শুনেনই নাই!”";
      quote2 = "পরিবহন চালক";
    } else {
      head = "গর্তে পড়ে হাসপাতালে ‘ভাই’ — সড়ক বিভাগ নীরব!";
      quote1 = "“গর্ত? কোথায় গর্ত? ওটা উন্নয়নের বিশেষ ঢেউ!”";
      quote2 = "সড়ক বিভাগের মুখপাত্র";
    }
  } else if (S.closed >= 3) {
    head = `বাজারে ${bn(S.closed)}টি দোকান বন্ধ, ‘ভাই’-এর পকেট ভারী; এখন চায়ের সাথে সিগারেট ফ্রি!`;
    quote1 = "“ব্যবসা তো দূর, এখন প্রাণ বাঁচানো দায়।”";
    quote2 = "ক্ষতিগ্রস্ত মুদি দোকানদার";
  } else {
    head = `“বিনা পরিশ্রমে কোটিপতি”: ${tk(S.cash)} তুলে রাজকীয় কায়দায় ঘরে ফিরলেন ‘ভাই’`;
    quote1 = "“আমরা কারো পেটে লাথি মারি না, শুধু অংশীদার হই।”";
    quote2 = "‘ভাই’-এর মুখপাত্র";
  }

  const tail = hospital
    ? 'চিকিৎসার খরচে সব টাকাই গেল। বস্ খোঁজ নিতে এসে দেখে গেছেন, কিন্তু বিল দেননি।'
    : ok ? 'বস্ বেজায় খুশি, আগামীতে পদোন্নতি কনফার্ম!' : 'বস্ আজ বেজায় নারাজ, সাবধানে থেকেন।';

  const paper = $('#paper');
  paper.innerHTML = `
    <div class="np">
      <div class="m">দৈনিক বাজার বার্তা</div>
      <div class="d"><span>বাজারপাড়া, শনিবার</span><span>মূল্য: মাত্র ১০ টাকা</span></div>
      <h2>${head}</h2>
      <div class="big">${arrested ? 'সর্বস্ব বাজেয়াপ্ত' : hospital ? 'হাসপাতালে ভর্তি' : tk(net) + ' পকেটে'}</div>
      <p class="st">মোট চাঁদা তুলেছিলেন ${tk(S.cash)}। বসের চাঁদা ${tk(arrested || hospital ? S.cash : cut)}। পোষা মাস্তান ছিল ${bn(S.henchmen)} জন। মার খেয়েছেন ${bn(S.beaten)} জন। জনতার হাতে পিটুনি খেয়েছেন ${bn(S.beatings)} বার, গাড়ির ধাক্কা খেয়েছেন ${bn(S.vehicleHits)} বার। ${tail}</p>
      <q>${quote1}</q><b>${quote2}</b>
      <div style="text-align:center"><button id="again" style="margin-top:20px">আবার মাঠে নামুন</button></div>
    </div>
  `;
  paper.hidden = false;
  $('#hud').hidden = true;
  $('#again').onclick = begin;
}

// --- Start / Reset ---
function begin() {
  Object.assign(S, {
    on: true, cash: 0, anger: 0, heat: 0, time: CONFIG.roundSec, town: 1, stam: 1, stun: 0, immune: 2.5, closed: 0, beaten: 0,
    hp: CONFIG.maxHp, beat: 0, fall: 0, slow: 0, knockTo: null, hpZeroT: 0, cause: '',
    beatings: 0, vehicleHits: 0, holeTrips: 0, inHole: false, inPuddle: false,
    mobActive: false, mobTimer: 0, copActive: false, henchmen: 0, air: false,
  });
  stepTimer = 0; beatT = 0; shake = 0; beatSayT = 0; lastPuddleSay = -99; quiet = 0;
  cancelGrab(); jumpBuf = 0; J.on = false; J.h = 0; player.userData.baseY = 0;
  player.position.set(START_X, 0, 0);
  player.rotation.set(0, Math.PI, 0);

  for (const h of henchmanObjs) scene.remove(h);
  henchmanObjs = [];
  clearBubbles();

  ensureChunks(0);
  // new round = fresh shops (chunks that stay loaded would otherwise keep last round's state)
  for (const h of allShops()) { h.open = true; h.sq = 0; h.cool = 0; h.down = 0; }
  resetTraffic(0);
  resetCrowd(0);
  initAudio();
  suspendAudio(false);
  initVoice();
  setPlayerRef(player);
  resetEngines();
  resetAmbience();
  showTicker();
  say('বাজার পুরোদমে চালু — মাঠে নেমেছে চাঁদাবাজ বাহিনী', 'breaking');

  $('#start').hidden = true;
  $('#paper').hidden = true;
  $('#pauseBadge').hidden = true;
  $('#hud').hidden = false;
  paused = false;
}

$('#go').addEventListener('click', begin);

// --- Main Loop ---
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  updateInput();                                       // keyboard, mouse, controller and touch -> one set of numbers (also while paused: Start un-pauses)
  if (paused) { renderer.render(scene, camera); return; }
  time += dt;
  quiet = Math.max(0, quiet - dt);

  const pp = player.position;
  setListener(pp.x, pp.z + 3);                       // the "ears" of the game: at you

  // ---- the street lives on its own, also behind the start screen
  const trafficEvents = updateTraffic(dt, time, pp);
  const canCatch = S.on && S.immune <= 0 && S.beat <= 0;
  const crowdEvents = updateCrowd(dt, time, pp, { on: S.on, canCatch });

  // ---- sound that follows the street: engines of the vehicles near you, the bazaar around you
  updateEngines(allVehicles(), dt);
  updateAmbience(dt, () => ({ vehicles: allVehicles(), people: allActors(), shops: allShops(), mob: S.mobActive }));

  let animSpeed = 0;

  if (S.on) {
    S.time -= dt;
    if (S.time <= 0) { endGame('time'); return; }

    // Shops recover from being squeezed, so they can pay again later
    for (const h of allShops()) {
      if (h.cool > 0) h.cool = Math.max(0, h.cool - dt);
      if (h.down > 0) h.down = Math.max(0, h.down - dt);
    }

    // timers that always count down
    if (S.stun > 0) S.stun = Math.max(0, S.stun - dt);
    if (S.immune > 0) S.immune = Math.max(0, S.immune - dt);
    if (S.fall > 0) S.fall = Math.max(0, S.fall - dt);
    if (S.slow > 0) S.slow = Math.max(0, S.slow - dt);
    shake = Math.max(0, shake - dt * 0.6);

    S.anger = Math.max(0, S.anger - dt * (S.mobActive ? 1.0 : 0.1));
    S.heat = Math.max(0, S.heat - dt * 0.1);
    if (S.stun <= 0 && S.hp > 0) S.hp = Math.min(CONFIG.maxHp, S.hp + CONFIG.hpRegen * dt);

    if (S.anger >= 100 && !S.mobActive) startMob();
    if (S.heat >= 100 && !S.copActive) callCop();

    // ---- being thrown aside by a vehicle
    if (S.knockTo !== null) {
      const dx = S.knockTo - pp.x;
      if (Math.abs(dx) < 0.05) S.knockTo = null;
      else pp.x += Math.sign(dx) * Math.min(Math.abs(dx), 9 * dt);
    }

    // ---- the chada button (hold = tougher)
    updateGrab(dt);

    // ---- movement (a stick or a thumb can walk gently, a keyboard always at full speed)
    const dx = input.moveX, dz = input.moveZ;
    const mv = S.stun <= 0 && input.mag > 0.05;
    const run = !!(mv && input.sprint && S.stam > 0.02);

    if (mv) {
      const l = Math.hypot(dx, dz) || 1;
      const push = Math.max(0.4, input.mag);
      const sp = (run ? CONFIG.runSp : CONFIG.walkSp) * push * (S.slow > 0 ? 0.65 : 1) * (S.inPuddle ? 0.8 : 1);
      pp.x = Math.max(-MAX_X, Math.min(MAX_X, pp.x + (dx / l) * sp * dt));
      pp.z += (dz / l) * sp * dt;
      player.rotation.y = Math.atan2(dx, dz);
      animSpeed = sp;

      // Footsteps in time with the walking animation (one per leg swing)
      stepTimer += dt;
      if (stepTimer > Math.PI / (6 + sp * 0.6)) {
        if (!S.air) stepSound(S.inPuddle ? 'puddle' : (Math.abs(pp.x) < GEO.half ? 'road' : 'foot'));
        stepTimer = 0;
      }
    } else if (grab.active) {                                         // standing and asking: face the shop
      player.rotation.y = Math.atan2(grab.shop.x - pp.x, grab.shop.z - pp.z);
    }

    // ---- jump (Space / A / the jump button): a hop that clears potholes and puddles
    jumpBuf = Math.max(0, jumpBuf - dt);
    if (jumpBuf > 0 && !J.on && S.stun <= 0 && S.beat <= 0 && S.fall <= 0 && S.stam > CONFIG.jump.stamina) {
      J.on = true; J.t = 0; jumpBuf = 0;
      S.stam -= CONFIG.jump.stamina;
      jumpSound();
    }
    if (J.on) {
      J.t += dt;
      const u = J.t / CONFIG.jump.time;
      if (u >= 1 || S.stun > 0 || S.beat > 0) {
        J.on = false; J.h = 0;
        stepSound(Math.abs(pp.x) < GEO.half ? 'road' : 'foot');          // landing
      } else J.h = CONFIG.jump.height * 4 * u * (1 - u);
    }
    player.userData.baseY = J.h;                // pose.js adds this to the walking bob, so the hop shows on screen
    S.air = J.on && J.h > 0.12;

    S.stam = run ? Math.max(0, S.stam - dt * 0.3) : Math.min(1, S.stam + dt * 0.18);

    ensureChunks(pp.z);
    if (S.beat > 0 || (S.stun > 0 && S.fall <= 0)) setMode(player, 'down');
    else if (S.fall > 0) setMode(player, 'tumble');
    else if (grab.active && !mv) setMode(player, grab.stage >= 1 ? 'point' : 'talk');
    else setMode(player, mv ? (run ? 'run' : 'walk') : 'idle');

    // ---- puddles slow you down, potholes trip you
    const inPuddle = !S.air && !!puddleAt(pp.x, pp.z, 0.1);
    if (inPuddle && !S.inPuddle) {
      splashSound(0.5);
      if (time - lastPuddleSay > 8) { lastPuddleSay = time; bubble(player, pickLine('puddle'), 'say', 2.0, 2.5); }
    }
    S.inPuddle = inPuddle;

    const hole = S.air ? null : potholeAt(pp.x, pp.z, 0.2);
    if (hole && !S.inHole && S.stun <= 0 && S.immune <= 0 && S.beat <= 0) {
      S.inHole = true;
      S.holeTrips++;
      hurt(CONFIG.potholeHp, 'pothole');
      S.stun = CONFIG.potholeStun;
      S.immune = CONFIG.potholeStun + 0.8;
      toast('গর্তে পা পড়ল! উফ!');
      bubble(player, 'উফ!', 'pow', 0.9, 1.8);
      bubble(player, pickLine('pothole'), 'say', 2.4, 2.5);
      thudSound(0.6);
    } else if (!hole) S.inHole = false;

    // ---- vehicles
    if (S.stun <= 0 && S.immune <= 0) {
      const v = vehicleAt(pp.x, pp.z, 0.32, 1.2);
      if (v) hitByVehicle(v);
    }
    for (const e of trafficEvents) {
      if (e.t === 'honk' && e.threat && e.v.v > 1.5 && Math.abs(e.v.z - pp.z) < 30) {
        bubble(e.v.group, pickLine(e.v.type), 'say', 1.8, 3.6);
      }
      if (e.t === 'splash') splashSound(0.8, e.x, e.z);
      if (e.t === 'splash' && S.immune <= 0 && S.slow <= 0 && Math.hypot(e.x - pp.x, e.z - pp.z) < 3.4) {
        S.slow = 2.2;
        flash('mud');
        toast('কাদা ছিটকে পড়ল গায়ে!');
        bubble(player, pickLine('mud'), 'say', 2.2, 2.5);
      }
    }

    // ---- henchmen follow the boss
    for (let i = 0; i < henchmanObjs.length; i++) {
      const hm = henchmanObjs[i];
      const targetX = pp.x + Math.sin(i * 1.5) * 1.5;
      const targetZ = pp.z + 2 + (i * 0.8);

      const hdx = targetX - hm.position.x;
      const hdz = targetZ - hm.position.z;
      const hd = Math.hypot(hdx, hdz);

      if (hd > 0.2) {
        const hsp = Math.min(hd * 5, CONFIG.runSp);
        hm.position.x += (hdx / hd) * hsp * dt;
        hm.position.z += (hdz / hd) * hsp * dt;
        hm.rotation.y = Math.atan2(hdx, hdz);
        setMode(hm, 'walk');
        animateFigure(hm, dt, time, hsp);
      } else {
        setMode(hm, 'idle');
        animateFigure(hm, dt, time, 0);
      }
    }

    // ---- what the crowd and the police did this frame
    let caughtHandled = false;
    for (const e of crowdEvents) {
      if (e.t === 'caught' && !caughtHandled && S.mobActive && canCatch) {
        caughtHandled = true;
        if (henchmanObjs.length > 0) {
          // a henchman takes the beating instead of you and knocks the man down
          scene.remove(henchmanObjs.pop());
          S.henchmen--;
          knockDown(e.actor, 3.2);
          S.immune = Math.max(S.immune, 0.8);
          toast('আপনার মাস্তান ছোকরা জনতাকে রুখে দিল!');
          bubble(e.actor.fig, 'ধাম!', 'pow', 0.9, 2.2);
          thudSound();
        } else {
          beginBeating();
        }
      } else if (e.t === 'arrest' && canCatch) {
        endGame('arrested');
        return;
      } else if (e.t === 'cop-gave-up') {
        S.copActive = false;
        S.heat = 60;
        toast('পুলিশ আর খুঁজে পেল না — হাঁপ ছাড়লেন!');
      } else if (e.t === 'runover' && quiet <= 0) {
        quiet = 2.5;
        const who = e.actor.kind === 'cop' ? 'পুলিশ সদস্য' : 'জনতার একজন';
        const veh = { rickshaw: 'রিকশা', cng: 'সিএনজি', bus: 'বাস' }[e.vehicle.type];
        toast(`${veh}র ধাক্কায় ${who} ধরাশায়ী!`);
      }
    }

    // ---- the beating
    if (S.beat > 0) {
      S.beat = Math.max(0, S.beat - dt);
      beatT -= dt;
      shake = Math.max(shake, 0.2);
      if (beatT <= 0) {
        beatT = 0.3;
        thudSound(0.7);
        bubble(player, pickOf(POW), 'pow', 0.8, 1.7 + Math.random() * 0.4);
      }
      beatSayT -= dt;
      if (beatSayT <= 0) { beatSayT = 1.8; bubble(player, pickLine('beaten'), 'say', 2.2, 2.5); }
      if (S.beat === 0) {
        endBeating();
        endMob(S.hp > 0 ? 'জনতার গা-ঝাল মিটল… উঠে দাঁড়ান!' : 'জনতা সরে গেল…');
        S.anger = 25;
      }
    } else if (S.mobActive) {
      // The mob ends when time runs out OR when no one is left
      S.mobTimer -= dt;
      if (mobMembers().length === 0) {
        endMob('মাস্তানরা পুরো জনতাকে হটিয়ে দিল!');
      } else if (S.mobTimer <= 0) {
        releaseMob();
        endMob('জনতা ঠান্ডা হলো… আপাতত রক্ষা!');
      }
    }

    // ---- no health left: hospital (after the fall has been seen)
    if (S.hp <= 0 && S.beat <= 0) {
      S.hpZeroT += dt;
      if (S.hpZeroT > 1.2) { endGame('hospital'); return; }
    }
  } else {
    setMode(player, 'idle');
  }

  blobShadow.position.x = pp.x;
  blobShadow.position.z = pp.z;
  blobShadow.scale.setScalar(Math.max(0.5, 1 - J.h * 0.6));     // the shadow shrinks while you are in the air

  animateFigure(player, dt, time, animSpeed);

  // chase camera: the further you go (running), the further back and higher it sits, like in the reference game
  const portrait = innerHeight > innerWidth;                  // a phone held upright needs more room
  const C = CONFIG.cam, CP = portrait ? { ...C, ...C.portrait } : C;
  camSpeed += ((animSpeed || 0) - camSpeed) * Math.min(1, dt * 3);
  camPos.x += (camX(pp.x) - camPos.x) * Math.min(1, dt * 6);
  camPos.y += (CP.up + camSpeed * 0.04 - camPos.y) * Math.min(1, dt * 5);
  camPos.z += (pp.z + CP.back + camSpeed * 0.08 - camPos.z) * Math.min(1, dt * 8);
  camLook.x += (Math.max(-GEO.half - 1, Math.min(GEO.half + 1, pp.x)) - camLook.x) * Math.min(1, dt * 8);
  camLook.y = CONFIG.cam.lookY;
  camLook.z += (pp.z - CP.lookAhead - camLook.z) * Math.min(1, dt * 9);
  if (Math.abs(camera.fov - CP.fov) > 0.05) { camera.fov = CP.fov; camera.updateProjectionMatrix(); }
  camera.position.copy(camPos);
  if (shake > 0) {                                    // the screen shakes when you are hit
    camera.position.x += Math.sin(time * 61) * shake * 0.35;
    camera.position.y += Math.sin(time * 47) * shake * 0.25;
  }
  camera.lookAt(camLook);

  updateSky(dt, time, camera, pp);
  updateGrabUi(time);
  updateHud(dt);
  renderer.render(scene, camera);
  updateBubbles(dt);
}

// --- The prompt: a bouncing arrow over the shop you can squeeze + a key cap at the bottom with a ring that fills while you hold ---
const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.0001, 0.75, 4), new THREE.MeshBasicMaterial({ color: 0xffd21a }));
marker.visible = false;
scene.add(marker);
const gEl = document.getElementById('grab'), gRing = document.getElementById('grabRing'), gKey = document.getElementById('grabKey');
const gLbl = document.getElementById('grabLbl'), gSub = document.getElementById('grabSub'), gBig = document.querySelector('[data-btn="action"]');
const gPips = gEl ? [...gEl.querySelectorAll('.pips u')] : [];
const RING = 119.4;                                                           // length of the ring line (2 * PI * 19)
const setTxt = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };

function updateGrabUi(time) {
  const h = (S.on && !paused && S.beat <= 0 && S.stun <= 0) ? near() : null;
  const cooling = !!h && h.cool > 0;
  marker.visible = !!h && !cooling;
  if (marker.visible) {
    marker.position.set(h.x, 4.3 + Math.sin(time * 5) * 0.18, h.z);
    marker.scale.setScalar(1 + (grab.active ? grab.stage * 0.25 : 0));
  }
  if (gBig) gBig.classList.toggle('ready', marker.visible);
  if (!gEl) return;
  gEl.hidden = !h;
  if (!h) return;
  gEl.classList.toggle('cool', cooling);
  gEl.dataset.stage = grab.active ? String(grab.stage) : '-1';
  const prog = grab.active ? Math.min(1, grab.t / CONFIG.grab.t3) : 0;
  gRing.style.strokeDashoffset = (RING * (1 - prog)).toFixed(1);
  setTxt(gKey, input.device === 'touch' ? '👆' : keyHint('action').slice(0, 5));
  if (cooling) { setTxt(gLbl, 'এইমাত্র দিয়েছে (' + bn(Math.ceil(h.cool)) + ')'); setTxt(gSub, h.name); }
  else if (grab.active) { setTxt(gLbl, STAGES[grab.stage] + (grab.stage >= 2 ? '!' : '')); setTxt(gSub, grab.stage === 3 ? 'ছাড়ুন — সব ভাঙবে!' : 'ছেড়ে দিন, নইলে ধরে রাখুন আরও কড়া করতে'); }
  else { setTxt(gLbl, 'চাঁদা চাও'); setTxt(gSub, h.name + ' · ধরে রাখলে আরও কড়া'); }
  gPips.forEach((u, i) => u.classList.toggle('on', grab.active && i <= grab.stage));
}

// --- HUD ---
let hudAcc = 0;
const projV = new THREE.Vector3();

function updateWarning() {
  const w = document.getElementById('warn');
  if (!w) return;
  const t = S.on ? getThreat() : null;
  if (t && t.behind && S.stun <= 0) {
    // put the warning on the screen at the lane the vehicle is coming along
    projV.set(t.v.x, 0, player.position.z - 5).project(camera);      // the lane's place on the screen, a little ahead of you
    const px = Math.max(8, Math.min(92, (projV.x * 0.5 + 0.5) * 100));
    w.style.left = px + '%';
    w.textContent = '▼ ' + ({ rickshaw: 'রিকশা', cng: 'সিএনজি', bus: 'বাস' }[t.v.type]) + ' আসছে!';
    w.hidden = false;
  } else w.hidden = true;
}

function updateHud(dt) {
  updateWarning();
  hudAcc += dt;
  if (hudAcc < 1 / CONFIG.hudHz) return;
  hudAcc = 0;
  showTouch(S.on && input.device === 'touch');

  $('#cash').textContent = tk(S.cash);
  $('#time').textContent = bn(Math.max(0, Math.ceil(S.time)));
  $('#ang').style.width = Math.min(100, S.anger) + '%';
  $('#heat').style.width = Math.min(100, S.heat) + '%';
  $('#stam').style.width = S.stam * 100 + '%';
  if ($('#hp')) $('#hp').style.width = (S.hp / CONFIG.maxHp) * 100 + '%';

  if ($('#angV')) $('#angV').textContent = bn(S.anger) + '%';
  if ($('#heatV')) $('#heatV').textContent = bn(S.heat) + '%';
  if ($('#stamV')) $('#stamV').textContent = bn(S.stam * 100) + '%';
  if ($('#hpV')) $('#hpV').textContent = bn(S.hp) + '%';

  let p = '';
  if (S.on) {
    const h = near();
    const seen = informedCount();
    if (S.beat > 0) p = "😵 গণধোলাই চলছে…";
    else if (S.copActive) p = `🚨 পুলিশ আসছে! ${keyHint('bribe')} চেপে চা-পানি দিন!`;
    else if (S.mobActive) p = `⚠️ জনতা তেড়ে আসছে! ${keyHint('sprint')} চেপে পালান — ${keyHint('jump')} চেপে গর্ত টপকান!`;
    else if (h) p = '';                                            // the key cap above (#grab) already says what to do
    else if (seen > 0) p = `👀 ${bn(seen)} জন আপনাকে চিনে ফেলেছে — জনরোষ বাড়ছে`;
    else p = `💡 টিপস: ৳৫০০ খরচ করে ${keyHint('hire')} চেপে মাস্তান পুষুন!`;
  }

  if ($('#prompt').dataset.p !== p) {
    $('#prompt').dataset.p = p;
    $('#prompt').textContent = p;
  }
}

// --- Resize ---
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// --- Boot ---
ensureChunks(0);
resetTraffic(0);
resetCrowd(0);
requestAnimationFrame(loop);
