// js/fx/voice.js
// Everything that is SAID in the game is also SPOKEN, from the place where the speaker stands.
//
// Three ways to give a line a voice (the best one that is available is used):
//   1. A RECORDING you added   - audio/voice/<name>.mp3, listed in RECORDED in lines.js. Real funny voices!
//   2. A real Bengali VOICE    - the "speech" built into your phone / computer (if it has Bengali).
//   3. BABBLE                  - a made-up voice that "talks" with the rhythm of the sentence (always works).
// Press  V  in the game to switch:  voices off  ->  babble  ->  real speech.
//
// How near the speaker is decides how loud it is (and left / right), just like the engines.
import { audioContext, audioBus, placeOf, spatialNode, releaseLater, noiseBuffer } from './audio.js';
import { RECORDED, lineKey } from './lines.js';

// what kind of person speaks: pitch (Hz) of the voice, how the mouth shape is stretched, how fast, pitch for real speech
export const PROFILE = {
  man:    { f0: 108, formant: 1.0,  rate: 1.0,  tts: 0.9 },
  woman:  { f0: 205, formant: 1.17, rate: 1.05, tts: 1.3 },
  elder:  { f0: 92,  formant: 0.95, rate: 0.85, tts: 0.7, wobble: 12 },
  cop:    { f0: 118, formant: 1.0,  rate: 1.0,  tts: 0.85, rough: true },
  driver: { f0: 100, formant: 0.98, rate: 1.12, tts: 0.8, rough: true },
  player: { f0: 112, formant: 1.0,  rate: 1.0,  tts: 0.95 },
};

// mouth shapes (the two main resonances, in Hz): a, o, i, u, e, ae
const VOWELS = [[800, 1250], [550, 900], [320, 2250], [340, 820], [520, 1900], [700, 1750]];

export const MODES = ['off', 'babble', 'speech'];
let mode = 1;                       // changed to 2 as soon as a Bengali voice is found
let modeChosen = false;
let playerRef = null;
const active = [];                  // voices that are sounding right now: { end, prio }
let lastStart = 0;
const recordings = new Map();       // key -> AudioBuffer | null
let ttsBusyUntil = 0;
let lastSpoken = null;              // for the test page and for tests

export const voiceMode = () => MODES[mode];
export const lastVoiceInfo = () => lastSpoken;
export function setPlayerRef(p) { playerRef = p; }
export function setVoiceMode(m) { mode = Math.max(0, Math.min(2, m)); modeChosen = true; if (mode !== 2) stopSpeech(); return MODES[mode]; }
export function cycleVoiceMode() { return setVoiceMode((mode + 1) % 3); }

// ---------- real speech (built into the device) ----------
function synth() { return typeof window !== 'undefined' && window.speechSynthesis && window.SpeechSynthesisUtterance ? window.speechSynthesis : null; }
export function bengaliVoice() {
  const s = synth(); if (!s) return null;
  const vs = s.getVoices ? s.getVoices() : [];
  return vs.find(v => /^bn/i.test(v.lang)) || vs.find(v => /bangla|bengali/i.test(v.name)) || null;
}
function stopSpeech() { const s = synth(); if (s) { try { s.cancel(); } catch {} } ttsBusyUntil = 0; }

export function initVoice() {
  // voices of the device arrive a moment after the page loads
  const s = synth();
  if (s && s.addEventListener) s.addEventListener('voiceschanged', pickDefaultMode);
  pickDefaultMode();
  // load the recordings that were listed in RECORDED (nothing happens when the list is empty)
  const c = audioContext();
  if (c) for (const key of RECORDED) loadRecording(c, key);
}
function pickDefaultMode() { if (!modeChosen && bengaliVoice()) mode = 2; }

function loadRecording(c, key) {
  if (recordings.has(key)) return;
  recordings.set(key, null);
  fetch('audio/voice/' + key + '.mp3').then(r => (r.ok ? r.arrayBuffer() : null)).then(b => (b ? c.decodeAudioData(b) : null))
    .then(buf => { if (buf) recordings.set(key, buf); }).catch(() => {});
}

// ---------- babble: a made-up voice that follows the rhythm of a sentence ----------
// Builds the sound into `out` and returns how many seconds it lasts. `t0` = start time.
export function babbleInto(c, out, text, type = 'man', kind = 'say', t0 = c.currentTime, vol = 0.6) {
  const P = PROFILE[type] || PROFILE.man;
  const angry = kind === 'angry';
  const clauses = (String(text).match(/[^!?।…,.]+[!?।…,.]*/g) || [String(text)]).map(s => s.trim()).filter(Boolean);
  const sd = (angry ? 0.12 : 0.15) / P.rate;                 // one syllable
  let base = P.f0 * (angry ? 1.12 : 1) * (0.95 + Math.random() * 0.1);

  // the instruments: a buzzing source and two resonances that shape the vowels
  const o = c.createOscillator(); o.type = 'sawtooth';
  const o2 = P.rough ? c.createOscillator() : null; if (o2) o2.type = 'sawtooth';
  const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 5;
  const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 7;
  const g1 = c.createGain(); g1.gain.value = 1;
  const g2 = c.createGain(); g2.gain.value = 0.7;
  const env = c.createGain(); env.gain.value = 0.0001;
  o.connect(f1); o.connect(f2);
  if (o2) { o2.connect(f1); o2.connect(f2); }
  f1.connect(g1); f2.connect(g2); g1.connect(env); g2.connect(env);
  env.connect(out);
  const srcs = [o]; if (o2) srcs.push(o2);
  if (P.wobble) {                                              // an old voice trembles
    const lfo = c.createOscillator(); lfo.frequency.value = 5.5;
    const d = c.createGain(); d.gain.value = P.wobble;
    lfo.connect(d); d.connect(o.detune); srcs.push(lfo);
  }
  // consonants: tiny hisses at the start of syllables
  const cons = c.createBufferSource(); cons.buffer = noiseBuffer(c);
  const cf = c.createBiquadFilter(); cf.type = 'highpass'; cf.frequency.value = 2800;
  const cg = c.createGain(); cg.gain.value = 0.0001;
  cons.connect(cf); cf.connect(cg); cg.connect(out);

  o.frequency.setValueAtTime(base, t0);
  if (o2) o2.frequency.setValueAtTime(base * 1.018, t0);
  let t = t0;
  for (const cl of clauses) {
    const end = cl.slice(-1);
    const nChars = Array.from(cl).filter(ch => /[ঀ-৿]/.test(ch)).length || cl.length;
    const n = Math.max(1, Math.min(10, Math.round(nChars / 2.4)));
    for (let i = 0; i < n; i++) {
      const last = i === n - 1;
      const vw = VOWELS[Math.floor(Math.random() * VOWELS.length)];
      let p = base * (1 + (Math.random() - 0.5) * 0.14) * (1 - 0.015 * i);          // the pitch wanders and sinks slowly
      if (last && end === '?') p *= 1.3;                                         // a question goes up
      if (last && (end === '…' || end === '।')) p *= 0.85;                       // a sigh goes down
      if (last && end === '!') p *= 1.08;
      o.frequency.linearRampToValueAtTime(p, t + sd * 0.3);
      if (o2) o2.frequency.linearRampToValueAtTime(p * 1.018, t + sd * 0.3);
      f1.frequency.setTargetAtTime(vw[0] * P.formant, t, 0.018);
      f2.frequency.setTargetAtTime(vw[1] * P.formant, t, 0.018);
      const peak = vol * (last && end === '!' ? 1.25 : (i === 0 ? 1.1 : 0.9));
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(peak, t + 0.022);
      env.gain.linearRampToValueAtTime(peak * 0.65, t + sd * 0.7);
      env.gain.linearRampToValueAtTime(0.0001, t + sd * 0.97);
      if (Math.random() < 0.65) {                                                // a "t", "k" or "sh"
        cg.gain.setValueAtTime(vol * 0.5, t);
        cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      }
      t += sd;
    }
    base *= 0.97;
    t += /[!?।…,.]$/.test(cl) ? sd * 0.8 : 0.02;                                   // a short pause between parts of the sentence
  }
  const total = t - t0 + 0.05;
  for (const s of srcs) { s.start(t0); s.stop(t0 + total + 0.05); }
  cons.start(t0, Math.random() * 1.5); cons.stop(t0 + total + 0.05);
  return total;
}

// ---------- speaking ----------
function typeOf(target) {
  if (target === playerRef) return 'player';
  if (target && target.userData && target.userData.voice) return target.userData.voice;
  return 'driver';                                   // vehicles
}

// Called for every speech bubble. text = the sentence, target = who says it (figure / vehicle / player)
export function speak(text, target, kind = 'say', retry = false) {
  if (mode === 0) return false;
  const c = audioContext();
  if (!c || c.state !== 'running') return false;
  const pos = target && (target.position || target);
  if (!pos) return false;
  const type = typeOf(target);
  const isPlayer = target === playerRef;
  const prio = isPlayer ? 3 : (kind === 'angry' ? 2 : 1);
  const p = placeOf(pos.x, pos.z);
  if (!isPlayer && p.gain < 0.09) return false;                    // too far away to be heard

  const nowT = c.currentTime;
  for (let i = active.length - 1; i >= 0; i--) if (active[i].end < nowT) active.splice(i, 1);
  if (!retry && nowT - lastStart < 0.18 && prio < 3) {               // no two lines at the very same moment: the second one follows a moment later
    setTimeout(() => speak(text, target, kind, true), 260);
    return false;
  }
  if (active.length >= 4 && prio <= Math.min(...active.map(a => a.prio))) return false;

  const key = lineKey(text);
  const level = Math.min(1, p.gain * 1.8 + (isPlayer ? 0.3 : 0));
  const P = PROFILE[type] || PROFILE.man;
  let how = null, dur = 1;

  // 1) a recording
  const rec = key && RECORDED.includes(key) ? recordings.get(key) : null;
  if (rec) {
    const src = c.createBufferSource(); src.buffer = rec;
    const node = spatialNode(c, audioBus('voice'), p, isPlayer ? 1.2 : 1.0);
    src.connect(node); src.start();
    dur = rec.duration; releaseLater(node, dur + 0.2); how = 'recording';
  }
  // 2) real speech from the device (near speakers only; one at a time)
  else if (mode === 2 && synth() && bengaliVoice() && p.d < 22 && (nowT * 1000 > ttsBusyUntil || prio > 1)) {
    const s = synth();
    if (nowT * 1000 <= ttsBusyUntil) s.cancel();
    const u = new window.SpeechSynthesisUtterance(text);
    const v = bengaliVoice();
    u.voice = v; u.lang = v.lang;
    u.rate = (kind === 'angry' ? 1.2 : 1.05) * P.rate;
    u.pitch = Math.max(0.1, Math.min(2, P.tts * (kind === 'angry' ? 1.1 : 1)));
    u.volume = Math.max(0.12, Math.min(1, level));
    dur = Math.max(1, text.length * 0.075);
    ttsBusyUntil = performance.now() + dur * 1000;
    u.onend = () => { ttsBusyUntil = 0; };
    u.onerror = () => { ttsBusyUntil = 0; };
    s.speak(u);
    how = 'speech';
  }
  // 3) babble
  else {
    const node = spatialNode(c, audioBus('voice'), p, isPlayer ? 1.25 : 1.0);
    dur = babbleInto(c, node, text, type, kind, c.currentTime, 0.6);
    releaseLater(node, dur + 0.3); how = 'babble';
  }
  lastStart = nowT;
  active.push({ end: nowT + dur, prio });
  lastSpoken = { text, how, type, level: +level.toFixed(2), pan: +p.pan.toFixed(2), d: +p.d.toFixed(1) };
  return true;
}

// a bit of background chatter that is not a real sentence (used by the bazaar, see ambience.js)
export function murmurAt(x, z, type = 'man', vol = 0.6) {
  if (mode === 0) return false;
  const c = audioContext(); if (!c || c.state !== 'running') return false;
  const p = placeOf(x, z);
  if (p.gain * vol < 0.03) return false;
  const node = spatialNode(c, audioBus('ambience'), p, vol);
  const words = 2 + Math.floor(Math.random() * 6);
  const text = 'আ'.repeat(words * 2) + (Math.random() < 0.25 ? '?' : '।');
  const dur = babbleInto(c, node, text, type, 'say', c.currentTime, 0.3);
  releaseLater(node, dur + 0.3);
  return true;
}
