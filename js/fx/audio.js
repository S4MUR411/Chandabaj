// js/fx/audio.js
// The sound system: ONE AudioContext, four volume channels, and sounds that have a PLACE in the street.
//
//  * The "ears" are at the camera. A sound that comes from a vehicle or a person is placed with
//    placeOf(x, z): it gets quieter with distance, pans left/right, and is muffled when it is behind you.
//  * Engines that follow the vehicles live in engines.js, the bazaar in ambience.js, voices in voice.js.
//  * Short effects (horns, bells, thuds ...) are in this file. Give them x, z to place them in the street.
//
// Volumes: change the numbers in VOLUME to make a whole kind of sound louder or quieter (0 = silent, 1 = normal).
export const VOLUME = {
  master: 0.7,
  sfx: 1.0,         // horns, bells, thuds, cash
  engines: 0.9,     // the engines of the vehicles
  ambience: 0.7,    // crowd murmur, shop sounds, crows
  voice: 0.9,       // all spoken lines
};

let ctx = null;
let master = null;
let comp = null;
const bus = {};
let muted = false;
const L = { x: 0, z: 0 };            // the listener (camera) position
const noiseCache = new WeakMap();

// `custom` is only used by the tests (an OfflineAudioContext that renders the sound into numbers instead of the speakers)
export function initAudio(custom) {
  if (custom) ctx = null;
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
  try { ctx = custom || new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  master = ctx.createGain();
  master.gain.value = muted ? 0 : VOLUME.master;
  comp = ctx.createDynamicsCompressor();          // keeps a busy street from clipping
  comp.threshold.value = -16; comp.knee.value = 20; comp.ratio.value = 5; comp.attack.value = 0.005; comp.release.value = 0.25;
  comp.connect(master);
  master.connect(ctx.destination);
  for (const name of ['sfx', 'engines', 'ambience', 'voice']) {
    bus[name] = ctx.createGain();
    bus[name].gain.value = VOLUME[name];
    bus[name].connect(comp);
  }
  return ctx;
}

export const audioContext = () => ctx;
export const audioBus = (name) => bus[name];
export function setListener(x, z) { L.x = x; L.z = z; }
export const listener = () => L;
export function setBusVolume(name, v) { VOLUME[name] = v; const t = name === 'master' ? master : bus[name]; if (t && ctx) t.gain.setTargetAtTime(muted && name === 'master' ? 0 : v, ctx.currentTime, 0.03); }
export function toggleMute() {
  muted = !muted;
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : VOLUME.master, ctx.currentTime, 0.03);
  return muted;
}
export const isMuted = () => muted;
export function suspendAudio(on) { if (!ctx) return; (on ? ctx.suspend() : ctx.resume()).catch(() => {}); }

// two seconds of white noise, made once per context
export function noiseBuffer(c) {
  let b = noiseCache.get(c);
  if (!b) {
    b = c.createBuffer(1, Math.floor(c.sampleRate * 2), c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(c, b);
  }
  return b;
}

// ---------- placing a sound in the street ----------
// d = distance, gain = loudness (1 close, 0.1 far), pan = -1 (left) .. +1 (right), cutoff = muffling (Hz), behind = 1 straight behind the camera
export function placeOf(x, z, from = L) {
  const dx = x - from.x, dz = z - from.z;
  const d = Math.hypot(dx, dz);
  const gain = 1 / Math.pow(1 + d / 7, 1.25);
  const lateral = d > 0.001 ? dx / d : 0;
  const pan = Math.max(-1, Math.min(1, lateral * Math.min(1, d / 2.5) * 1.15));
  const behind = d > 0.001 ? Math.max(0, dz / d) : 0;
  const cutoff = Math.max(600, (16000 / (1 + d / 22)) * (1 - 0.8 * behind));
  return { d, gain, pan, cutoff, behind };
}

// gain -> lowpass -> stereo pan -> dest, for a one-shot sound. Returns the input node.
export function spatialNode(c, dest, p, level = 1) {
  const g = c.createGain(); g.gain.value = p.gain * level;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = p.cutoff; f.Q.value = 0.5;
  g.connect(f);
  if (c.createStereoPanner) {
    const s = c.createStereoPanner(); s.pan.value = p.pan;
    f.connect(s); s.connect(dest);
  } else f.connect(dest);
  return g;
}

// disconnect a one-shot chain after it has finished, so nothing piles up
export function releaseLater(node, seconds) { setTimeout(() => { try { node.disconnect(); } catch {} }, seconds * 1000 + 100); }

// ---------- building blocks for short effects ----------
let target = null;                  // where the next effect is sent (set by placed())
const dest = () => target || bus.sfx;

// Plays everything that `fn` makes at the place (x, z) of the street. Without x it simply plays (no place).
export function placed(x, z, vol, fn, tail = 1.2) {
  if (!ctx) return;
  if (x === undefined) { fn(); return; }
  const p = placeOf(x, z);
  if (p.gain * vol < 0.012) return;                  // too far to be heard
  const node = spatialNode(ctx, bus.sfx, p);
  target = node;
  try { fn(); } finally { target = null; }
  releaseLater(node, tail);
}

// one tone that fades out; `delay` in seconds
export function tone(freq, dur, type = 'sine', vol = 0.15, delay = 0, slideTo = 0) {
  if (!ctx || vol <= 0.001) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(dest());
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

// a burst of filtered noise (click, splash, scuffle)
export function noise(dur, cutoff, vol = 0.15, delay = 0, type = 'lowpass') {
  if (!ctx || vol <= 0.001) return;
  const t0 = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  s.connect(f).connect(g).connect(dest());
  s.start(t0, Math.random() * 1.5);
  s.stop(t0 + dur + 0.02);
}

// a note with a soft attack and release (horns): several oscillators together
function chord(freqs, dur, vol, type, cutoff, attack = 0.03, release = 0.12, delay = 0) {
  if (!ctx || vol <= 0.001) return;
  const t0 = ctx.currentTime + delay;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.setValueAtTime(vol, t0 + dur - release);
  g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
  f.connect(g); g.connect(dest());
  for (const fr of freqs) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = fr;
    o.connect(f); o.start(t0); o.stop(t0 + dur + 0.02);
  }
}

// a bell: three partials that do not fit together (that is what makes it sound like metal)
export function ring(f, dur, vol, delay = 0) {
  tone(f, dur, 'sine', vol, delay);
  tone(f * 2.76, dur * 0.55, 'sine', vol * 0.5, delay);
  tone(f * 5.4, dur * 0.3, 'sine', vol * 0.22, delay);
}

// ---------- effects without a place (they happen to YOU) ----------
export function cashSound() {                      // cash drawer: click, then a bright "ka-ching"
  noise(0.03, 3500, 0.06, 0, 'highpass');
  ring(1760, 0.5, 0.08, 0.03);
  ring(2349, 0.4, 0.05, 0.1);
}

export function thudSound(vol = 1, x, z) {
  placed(x, z, vol, () => {
    tone(120, 0.22, 'sine', 0.6 * vol, 0, 42);
    noise(0.12, 700, 0.32 * vol);
    noise(0.03, 2500, 0.12 * vol, 0, 'highpass');
  });
}

export function sirenSound() {
  tone(700, 0.5, 'sawtooth', 0.07);
  tone(900, 0.5, 'sawtooth', 0.07, 0.25);
}

export function bribeSound() {                     // a few notes sliding into a pocket
  noise(0.05, 4000, 0.05, 0, 'highpass');
  tone(520, 0.1, 'triangle', 0.1);
  tone(780, 0.12, 'triangle', 0.09, 0.08);
  tone(1040, 0.14, 'triangle', 0.07, 0.16);
}

// surface: 'foot' (paving), 'road' (asphalt) or 'puddle'
export function stepSound(surface = 'foot') {
  if (surface === 'puddle') { noise(0.12, 1800, 0.1); return; }
  if (surface === 'road') { noise(0.06, 500, 0.1); tone(70, 0.07, 'sine', 0.1, 0, 40); return; }
  tone(190, 0.05, 'triangle', 0.07, 0, 110);
  noise(0.03, 2200, 0.04, 0, 'highpass');
}

// ---------- effects that come from somewhere ----------
export function bellSound(vol = 1, x, z) {         // rickshaw bell: ting-ting
  placed(x, z, vol, () => { ring(2100, 0.45, 0.19 * vol); ring(2100, 0.45, 0.19 * vol, 0.17); });
}

export function hornSound(kind = 'cng', vol = 1, x, z) {
  placed(x, z, vol, () => {
    if (kind === 'bus') chord([196, 247, 294], 0.62, 0.28 * vol, 'sawtooth', 1700, 0.04, 0.15);       // deep air horn
    else {                                                                                            // CNG: two nasal beeps
      chord([700, 716], 0.13, 0.28 * vol, 'square', 2600, 0.01, 0.03);
      chord([700, 716], 0.13, 0.28 * vol, 'square', 2600, 0.01, 0.03, 0.19);          // the second beep, 0.19 s later
    }
  }, 0.8);
}

export function whistleSound(vol = 1, x, z) {      // traffic constable
  placed(x, z, vol, () => {
    tone(2500, 0.18, 'sine', 0.2 * vol, 0, 2900);
    tone(2900, 0.22, 'sine', 0.2 * vol, 0.2, 2500);
  });
}

export function splashSound(vol = 1, x, z) {
  placed(x, z, vol, () => {
    noise(0.3, 1400, 0.3 * vol);
    for (let i = 0; i < 3; i++) noise(0.05, 3500, 0.1 * vol, 0.05 + Math.random() * 0.25, 'highpass');
  });
}

export function crashSound(vol = 1, x, z) {         // vehicle hits somebody
  placed(x, z, vol, () => {
    noise(0.25, 900, 0.6 * vol);
    tone(75, 0.25, 'square', 0.5 * vol, 0, 40);
    noise(0.04, 3000, 0.2 * vol, 0, 'highpass');
  });
}

export function hissSound(vol = 1, x, z) {          // air brakes of a bus: "pshhhh"
  placed(x, z, vol, () => {
    noise(0.55, 5000, 0.2 * vol, 0, 'highpass');
    noise(0.35, 1800, 0.1 * vol, 0.05, 'bandpass');
  });
}

export function crowdSound(vol = 1, x, z) {         // an angry rumble when a crowd turns on you
  placed(x, z, vol, () => {
    noise(0.5, 900, 0.15 * vol);
    tone(150, 0.5, 'sawtooth', 0.06 * vol, 0, 120);
  });
}

// ---------- controls feedback ----------
// The little sound you get while HOLDING the chada button: it climbs a step each time you reach a harder level.
// stage 0 = soft ask, 1 = demand, 2 = beat, 3 = vandalise
export function chargeSound(stage = 0) {
  const f = [440, 554, 659, 831][Math.max(0, Math.min(3, stage))];
  tone(f, 0.12, 'triangle', 0.09);
  if (stage >= 2) tone(f * 0.5, 0.18, 'sawtooth', 0.05);
  if (stage >= 3) noise(0.08, 1500, 0.06);
}

export function jumpSound() {                      // a short "hup": a quick upward chirp and a puff of air
  tone(260, 0.12, 'sine', 0.09, 0, 480);
  noise(0.06, 1800, 0.035, 0, 'highpass');
}
