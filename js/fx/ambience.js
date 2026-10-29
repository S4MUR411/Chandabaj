// js/fx/ambience.js
// The sound of the bazaar around you. Nothing here is a loop that plays the same thing for ever:
//  * a soft "wash" of crowd noise that gets stronger when many people are near (and rumbles when a mob is near),
//  * a low hum of traffic that depends on how many vehicles are moving close to you,
//  * chatter ("murmurs") that comes from the REAL pedestrians and shopkeepers around you, from where they stand,
//  * sounds of the shops, chosen by the name on the sign: frying and clattering in hotels and sweet shops,
//    spoons in tea stalls, tinny music in mobile / electronics shops, sewing machines at tailors ...
//  * crows (কাক) that call from the rooftops now and then.
import { audioContext, audioBus, listener, noiseBuffer, placed, tone, noise, ring } from './audio.js';
import { murmurAt } from './voice.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const pickOf = (a) => a[Math.floor(Math.random() * a.length)];

// which sounds a shop makes, by words in its name. First match wins.
export const SHOP_SOUNDS = [
  { words: ['টেলিকম', 'মোবাইল', 'ইলেকট্রনিক্স'], sound: 'music', every: [7, 14], vol: 0.9 },
  { words: ['হোটেল', 'বিরিয়ানি', 'সুইটস', 'মিষ্টি', 'জিলাপি'], sound: 'frying', every: [3, 7], vol: 1.0 },
  { words: ['চা '], sound: 'tea', every: [3, 8], vol: 1.0 },
  { words: ['টেইলার্স'], sound: 'sewing', every: [8, 16], vol: 0.8 },
  { words: ['মাছ'], sound: 'chop', every: [3, 8], vol: 1.0 },
  { words: ['টায়ার'], sound: 'compressor', every: [8, 18], vol: 0.9 },
];
export function soundOfShop(name) {
  const n = name + ' ';
  return SHOP_SOUNDS.find(s => s.words.some(w => n.includes(w))) || null;
}

// ---------- the sounds of the shops (each is one short event) ----------
const MELODIES = [             // semitones above 440 Hz, pairs of [note, beats]
  [[0, 1], [2, 1], [4, 1], [7, 2], [4, 1], [2, 1], [0, 2], [-3, 2]],
  [[7, 1], [7, 1], [9, 1], [7, 1], [4, 2], [2, 1], [4, 1], [0, 3]],
  [[4, 1], [2, 1], [0, 1], [2, 1], [4, 1], [4, 1], [4, 2], [2, 1], [2, 1], [2, 2]],
];
const SHOP_SOUND = {
  music() {                    // a phone speaker playing a tune
    const m = pickOf(MELODIES);
    let t = 0;
    for (const [semi, beats] of m) {
      const f = 440 * Math.pow(2, semi / 12);
      tone(f, beats * 0.17, 'square', 0.05, t);
      tone(f * 2, beats * 0.17, 'square', 0.018, t);
      t += beats * 0.19;
    }
    return t + 0.3;
  },
  frying() {                   // oil crackles, now and then the clang of a spatula
    noise(1.1, 6500, 0.09, 0, 'highpass');
    for (let i = 0; i < 12; i++) noise(0.02, 4500, 0.1, rnd(0, 1.1), 'highpass');
    if (Math.random() < 0.6) { ring(1250, 0.3, 0.1, 0.4 + rnd(0, 0.4)); ring(980, 0.3, 0.08, 0.9); }
    return 1.6;
  },
  tea() {                      // a spoon in a glass
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) ring(2500 + rnd(-200, 200), 0.22, 0.1, i * rnd(0.12, 0.2));
    return 1.2;
  },
  sewing() {                   // a sewing machine: a fast tick-tick-tick
    for (let i = 0; i < 18; i++) noise(0.018, 3200, 0.07, i * 0.055, 'bandpass');
    tone(150, 1.0, 'square', 0.016, 0);
    return 1.4;
  },
  chop() {                     // a cleaver on a board, then a splash of water
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) { noise(0.05, 1000, 0.2, i * 0.22); tone(190, 0.07, 'triangle', 0.16, i * 0.22, 100); }
    noise(0.3, 1800, 0.12, n * 0.22);
    return n * 0.22 + 0.6;
  },
  compressor() {               // an air hose at the tyre shop
    noise(0.6, 5500, 0.12, 0, 'highpass');
    tone(62, 0.7, 'sawtooth', 0.07, 0, 55);
    return 1.0;
  },
};

export const playShopSound = (name) => SHOP_SOUND[name]();      // (used by sound-test.html)

// ---------- crows ----------
function caw(d) {
  tone(520, 0.2, 'sawtooth', 0.1, d, 310);
  tone(1040, 0.2, 'square', 0.024, d, 620);
  noise(0.18, 1400, 0.04, d, 'bandpass');
}
function crowCalls() {
  const n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) caw(i * rnd(0.3, 0.45));
  return n * 0.5 + 0.4;
}

// ---------- the permanent beds (crowd wash + traffic hum) ----------
let bed = null;
function ensureBed(c) {
  if (bed && bed.c === c) return;
  const out = audioBus('ambience');
  const noiseSrc = (loopFrom) => { const n = c.createBufferSource(); n.buffer = noiseBuffer(c); n.loop = true; n.loopStart = loopFrom; n.loopEnd = 2; n.start(0, loopFrom); return n; };
  // crowd wash: two bands of noise, each slowly swelling and fading at its own pace
  const crowd = c.createGain(); crowd.gain.value = 0; crowd.connect(out);
  const bands = [];
  for (const [hz, q, vol, lf] of [[420, 0.8, 0.9, 0.23], [1100, 1.0, 0.55, 0.31], [2400, 1.2, 0.2, 0.41]]) {
    const n = noiseSrc(Math.random()), f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = hz; f.Q.value = q;
    const swell = c.createGain(); swell.gain.value = vol * 0.65;
    const lfo = c.createOscillator(); lfo.frequency.value = lf; const depth = c.createGain(); depth.gain.value = vol * 0.35;
    lfo.connect(depth); depth.connect(swell.gain); lfo.start();
    n.connect(f); f.connect(swell); swell.connect(crowd);
    bands.push(f);
  }
  // traffic hum: low rumble
  const traffic = c.createGain(); traffic.gain.value = 0; traffic.connect(out);
  const tn = noiseSrc(Math.random()), tl = c.createBiquadFilter(); tl.type = 'lowpass'; tl.frequency.value = 240; tl.Q.value = 0.7;
  const tl2 = c.createOscillator(); tl2.type = 'sawtooth'; tl2.frequency.value = 47; const tg = c.createGain(); tg.gain.value = 0.25;
  tn.connect(tl); tl.connect(traffic); tl2.connect(tg); tg.connect(tl); tl2.start();
  bed = { c, crowd, traffic };
}

// ---------- the update (call every frame) ----------
let acc = 0, murmurT = 1, crowT = rnd(5, 10);
export let ambienceStats = { people: 0, moving: 0, crowd: 0, traffic: 0, shopEvents: 0, murmurs: 0 };
const shopT = new WeakMap();         // shop -> seconds until it makes its next sound

// world = { vehicles, people (crowd actors), shops, mob (true while a mob is after you) }
export function updateAmbience(dt, getWorld) {
  const c = audioContext();
  if (!c || c.state !== 'running') return;
  ensureBed(c);
  acc += dt;
  if (acc < 0.25) return;
  const step = acc; acc = 0;
  const world = getWorld();
  const L = listener();
  const dist = (x, z) => Math.hypot(x - L.x, z - L.z);

  // how busy is it around you?
  const near = [];
  for (const a of world.people) { if (a.dead) continue; const d = dist(a.fig.position.x, a.fig.position.z); if (d < 26) near.push(a); }
  let moving = 0;
  for (const v of world.vehicles) if (v.v > 1 && dist(v.x, v.z) < 45) moving++;

  const mobBoost = world.mob ? 1 : 0;
  const crowdLevel = Math.min(0.1, 0.012 + near.length * 0.0055 + mobBoost * 0.03);
  const trafficLevel = Math.min(0.07, 0.008 + moving * 0.006);
  bed.crowd.gain.setTargetAtTime(crowdLevel, c.currentTime, 0.6);
  bed.traffic.gain.setTargetAtTime(trafficLevel, c.currentTime, 0.6);

  // chatter from people nearby
  murmurT -= step * (0.7 + near.length * 0.1);
  let murmurs = 0;
  if (murmurT <= 0 && near.length) {
    const a = pickOf(near);
    if (murmurAt(a.fig.position.x, a.fig.position.z, a.fig.userData.voice || 'man', a.kind === 'keeper' ? 0.9 : 0.7)) murmurs = 1;
    murmurT = rnd(0.5, 1.5);
  }

  // shops that are close
  let events = 0;
  for (const s of world.shops) {
    if (!s.open) continue;
    const kind = soundOfShop(s.name);
    if (!kind) continue;
    const d = dist(s.x, s.z);
    if (d > 24) continue;
    let t = shopT.get(s);
    if (t === undefined) t = rnd(0.3, kind.every[1]);
    t -= step;
    if (t <= 0) {
      let tail = 1.5;
      placed(s.x, s.z, kind.vol, () => { tail = SHOP_SOUND[kind.sound](); }, 4);
      t = rnd(...kind.every);
      events++;
    }
    shopT.set(s, t);
  }

  // crows
  crowT -= step;
  if (crowT <= 0) {
    const side = Math.random() < 0.5 ? -1 : 1;
    placed(L.x + side * rnd(14, 28), L.z - rnd(8, 30), 1, () => { crowCalls(); }, 3);
    crowT = rnd(9, 20);
    events++;
  }
  ambienceStats = { people: near.length, moving, crowd: crowdLevel, traffic: trafficLevel, shopEvents: ambienceStats.shopEvents + events, murmurs: ambienceStats.murmurs + murmurs };
}

export function resetAmbience() { crowT = rnd(4, 9); murmurT = 1; }
