// js/fx/engines.js
// The engines of the traffic. Every bus, CNG and rickshaw near you has its OWN sound that moves with it:
//  * it gets louder when it comes closer and quieter when it goes away,
//  * it is heard from the left or the right, where the vehicle really is,
//  * it is muffled when it is behind you,
//  * it changes pitch when it drives past (the "neeeeeow" of a passing vehicle, called the Doppler effect),
//  * a faster vehicle has a higher, busier engine; a stopped one only idles.
// To save the computer's work only the loudest few vehicles of each kind get a real voice (see SPEC).
import { audioContext, audioBus, placeOf, listener, noiseBuffer, hissSound } from './audio.js';

// loud = how loud this kind is,  range = how far away it can still be heard (metres),  voices = how many can sound at once
export const SPEC = {
  bus:      { loud: 0.09, range: 75, voices: 3 },
  cng:      { loud: 0.115, range: 52, voices: 4 },
  rickshaw: { loud: 0.3, range: 26, voices: 3 },
};

const C_SOUND = 70;          // "speed of sound" for the pitch change. The real one (343 m/s) would hardly be noticed at 6 m/s, so it is exaggerated.

// ---------- one engine voice ----------
// Builds the sound machine for one kind of vehicle. `set()` is called every frame to move it.
export function makeVoice(c, dest, type) {
  const mix = c.createGain(); mix.gain.value = 1;
  const shape = c.createBiquadFilter(); shape.type = 'lowpass'; shape.Q.value = 0.7;       // the "character" of the engine
  const am = c.createGain();                                                                // chugging (the engine's beat)
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5; lp.frequency.value = 3000;   // distance / behind-you muffling
  const out = c.createGain(); out.gain.value = 0;                                           // loudness
  mix.connect(shape); shape.connect(am); am.connect(lp); lp.connect(out);
  let pan = null;
  if (c.createStereoPanner) { pan = c.createStereoPanner(); out.connect(pan); pan.connect(dest); } else out.connect(dest);

  const oscs = [];           // [oscillator, base Hz, extra Hz per m/s of speed]
  const srcs = [];
  const osc = (kind, base, per, vol, detune = 1) => {
    const o = c.createOscillator(); o.type = kind; o.frequency.value = base * detune;
    const g = c.createGain(); g.gain.value = vol;
    o.connect(g); g.connect(mix); srcs.push(o);
    oscs.push([o, base * detune, per * detune]);
  };
  const hiss = (hz, q, kindFilter, vol) => {                       // looped noise through a filter
    const n = c.createBufferSource(); n.buffer = noiseBuffer(c); n.loop = true;
    n.loopStart = Math.random() * 1.5; n.loopEnd = 2;
    const f = c.createBiquadFilter(); f.type = kindFilter; f.frequency.value = hz; f.Q.value = q;
    const g = c.createGain(); g.gain.value = vol;
    n.connect(f); f.connect(g); g.connect(mix); srcs.push(n);
  };

  // the beat: a slow oscillator that makes the engine "put-put"
  const lfo = c.createOscillator();
  const lfoDepth = c.createGain();
  lfo.connect(lfoDepth); lfoDepth.connect(am.gain);
  srcs.push(lfo);

  let lfoBase, lfoPer, shapeBase, shapePer;
  if (type === 'bus') {                    // big diesel: deep, rough, slow
    osc('sawtooth', 52, 3.6, 0.5);
    osc('sawtooth', 52, 3.6, 0.4, 1.013);              // slightly out of tune: the rough "brrr"
    osc('square', 26, 1.8, 0.28);                        // the deep part
    hiss(190, 0.8, 'bandpass', 0.7);                     // exhaust
    lfo.type = 'triangle'; lfoBase = 8.5; lfoPer = 1.3;
    am.gain.value = 0.72; lfoDepth.gain.value = 0.28;
    shapeBase = 520; shapePer = 70;
  } else if (type === 'cng') {             // small two-stroke engine: buzzy "put-put-put"
    osc('sawtooth', 88, 11, 0.45);
    osc('square', 176, 20, 0.2, 1.007);
    hiss(1100, 1.1, 'bandpass', 0.35);
    lfo.type = 'triangle'; lfoBase = 12; lfoPer = 2.4;
    am.gain.value = 0.55; lfoDepth.gain.value = 0.45;
    shapeBase = 1500; shapePer = 140;
  } else {                                 // rickshaw: a rattling chain and tyre hum
    hiss(2800, 3, 'bandpass', 0.55);                     // chain
    hiss(240, 0.7, 'lowpass', 0.5);                      // tyres on the road
    lfo.type = 'square'; lfoBase = 1.8; lfoPer = 0.7;
    am.gain.value = 0.62; lfoDepth.gain.value = 0.35;
    shapeBase = 4200; shapePer = 0;
  }
  lfo.frequency.value = lfoBase;
  shape.frequency.value = shapeBase;
  for (const s of srcs) s.start();

  return {
    type,
    // speed in m/s, level 0..1, pan -1..1, cutoff Hz, dop = pitch factor (1 = unchanged)
    set({ speed, level, pan: pp, cutoff, dop = 1, fast = false }) {
      const t = c.currentTime, k = fast ? 0.02 : 0.09;
      for (const [o, base, per] of oscs) o.frequency.setTargetAtTime((base + per * speed) * dop, t, k);
      lfo.frequency.setTargetAtTime((lfoBase + lfoPer * speed) * (1 + (dop - 1) * 0.5), t, k);
      shape.frequency.setTargetAtTime(shapeBase + shapePer * speed, t, 0.2);
      lp.frequency.setTargetAtTime(Math.max(300, cutoff), t, k);
      out.gain.setTargetAtTime(level, t, fast ? 0.01 : 0.07);
      if (pan) pan.pan.setTargetAtTime(pp, t, k);
    },
    stop() { for (const s of srcs) { try { s.stop(); } catch {} } try { out.disconnect(); } catch {} },
    nodes: { out, lp, shape, am },
  };
}

// ---------- the manager: gives the voices to the vehicles near you ----------
const pools = {};          // type -> list of { voice, veh, idleSince }
let sinceAssign = 1;
let prevL = null;
let stats = { active: 0, byType: { bus: 0, cng: 0, rickshaw: 0 } };

function ensurePools(c) {
  if (pools.__ctx === c) return;
  for (const k of Object.keys(pools)) delete pools[k];
  pools.__ctx = c;
  const dest = audioBus('engines');
  for (const [type, s] of Object.entries(SPEC)) {
    pools[type] = [];
    for (let i = 0; i < s.voices; i++) pools[type].push({ voice: makeVoice(c, dest, type), veh: null, idleSince: -9, prevV: 0 });
  }
}

export function engineStats() { return stats; }

export function updateEngines(vehicles, dt) {
  const c = audioContext();
  if (!c || c.state !== 'running') return;
  ensurePools(c);
  const now = c.currentTime;
  const alive = new Set(vehicles);
  const L = listener();
  const lv = prevL && dt > 0 ? { x: (L.x - prevL.x) / dt, z: (L.z - prevL.z) / dt } : { x: 0, z: 0 };
  prevL = { x: L.x, z: L.z };

  // 1) every 0.25 s: decide which vehicles get a voice
  sinceAssign += dt;
  if (sinceAssign > 0.25) {
    sinceAssign = 0;
    for (const type of Object.keys(SPEC)) {
      const pool = pools[type], spec = SPEC[type];
      const cand = [];
      for (const v of vehicles) {
        if (v.type !== type) continue;
        const p = placeOf(v.x, v.z);
        if (p.d > spec.range) continue;
        cand.push({ v, score: p.gain * (1 + 0.5 * (v.voiceSlot ? 1 : 0)) });     // a vehicle that already has a voice is a little favoured (no flipping)
      }
      cand.sort((a, b) => b.score - a.score);
      const winners = new Set(cand.slice(0, pool.length).map(o => o.v));
      for (const slot of pool) {                                    // free voices whose vehicle lost or left
        if (slot.veh && !winners.has(slot.veh)) { slot.veh.voiceSlot = null; slot.veh = null; slot.idleSince = now; slot.voice.set({ speed: 0, level: 0, pan: 0, cutoff: 800 }); }
      }
      for (const w of winners) {
        if (w.voiceSlot) continue;
        const slot = pool.find(s => !s.veh && now - s.idleSince > 0.3);
        if (slot) { slot.veh = w; w.voiceSlot = slot; slot.prevV = w.v; slot.fresh = true; }
      }
    }
  }

  // 2) every frame: move the voices with their vehicles
  let active = 0;
  const by = { bus: 0, cng: 0, rickshaw: 0 };
  for (const type of Object.keys(SPEC)) {
    const spec = SPEC[type];
    for (const slot of pools[type]) {
      const v = slot.veh;
      if (!v) continue;
      if (!alive.has(v) || v.voiceSlot !== slot) { v.voiceSlot = null; slot.veh = null; slot.idleSince = now; slot.voice.set({ speed: 0, level: 0, pan: 0, cutoff: 800 }); continue; }   // vehicle was removed from the street
      const p = placeOf(v.x, v.z);
      if (p.d > spec.range * 1.15) { v.voiceSlot = null; slot.veh = null; slot.idleSince = now; slot.voice.set({ speed: 0, level: 0, pan: 0, cutoff: 800 }); continue; }
      // pitch change: speed of the vehicle towards / away from the listener
      let dop = 1;
      if (p.d > 0.8) {
        const rx = (v.x - L.x) / p.d, rz = (v.z - L.z) / p.d;
        const vrel = (0 - lv.x) * rx + (v.dir * v.v - lv.z) * rz;       // vehicle velocity (0, dir*v) minus listener velocity, along the line between them
        dop = Math.max(0.86, Math.min(1.16, C_SOUND / (C_SOUND + vrel)));
      }
      const idleFactor = 0.5 + 0.5 * Math.min(1, v.v / 5);
      const fade = Math.min(1, (spec.range * 1.15 - p.d) / (spec.range * 0.3));    // fades out at the edge of its range
      slot.voice.set({
        speed: v.v, level: p.gain * spec.loud * idleFactor * Math.max(0, fade),
        pan: p.pan, cutoff: p.cutoff, dop, fast: slot.fresh,
      });
      slot.fresh = false;
      // air brakes: a big hiss when a bus is stopped suddenly
      const decel = (slot.prevV - v.v) / Math.max(dt, 0.001);
      if (type === 'bus' && decel > 9 && slot.prevV > 2.5 && now - (slot.hissAt || -9) > 2) { hissSound(0.7, v.x, v.z); slot.hissAt = now; }
      slot.prevV = v.v;
      active++; by[type]++;
    }
  }
  stats = { active, byType: by };
}

// silence everything (used when a new game starts)
export function resetEngines() {
  for (const k of Object.keys(pools)) {
    if (k === '__ctx') continue;
    for (const slot of pools[k]) { if (slot.veh) slot.veh.voiceSlot = null; slot.veh = null; slot.voice.set({ speed: 0, level: 0, pan: 0, cutoff: 800 }); }
  }
}
