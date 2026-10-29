// js/ui/bubbles.js
// Speech bubbles above people and vehicles ("ওই যে চাঁদাবাজ!"), and comic impact words ("ধুম!").
// They are normal HTML elements that follow a 3D object on the screen, so the text stays sharp.
import * as THREE from 'three';

const MAX_SAY = 5;     // at most this many speech bubbles at once, so the screen stays readable
const MAX_POW = 4;

let box = null;
let cam = null;
let items = [];
let speakFn = null;
const V = new THREE.Vector3();

export function initBubbles(camera) {
  cam = camera;
  box = document.getElementById('bubbles');
  if (!box) {
    box = document.createElement('div');
    box.id = 'bubbles';
    document.body.appendChild(box);
  }
}

function drop(it) {
  if (it.el.parentNode) it.el.parentNode.removeChild(it.el);
  items = items.filter(x => x !== it);
}

// The voice system (fx/voice.js) listens here: every speech bubble is also SPOKEN, from where the speaker stands.
export function onSpeak(fn) { speakFn = fn; }

// target: anything with a .position (a figure, a vehicle group) or a plain {x,y,z}
// kind: 'say' (white), 'angry' (red), 'pow' (big yellow impact word)
export function bubble(target, text, kind = 'say', ttl = 2.4, height = 2.4) {
  if (!box || !target) return null;
  const group = kind === 'pow' ? 'pow' : 'say';
  const same = items.filter(i => i.group === group);
  if (same.length >= (group === 'pow' ? MAX_POW : MAX_SAY)) drop(same[0]);   // the oldest makes room
  if (items.some(i => i.target === target && i.group === group)) drop(items.find(i => i.target === target && i.group === group));

  const el = document.createElement('div');
  el.className = 'bub ' + kind;
  el.textContent = text;
  el.style.display = 'none';
  box.appendChild(el);
  const it = { el, target, group, t: 0, ttl, height };
  items.push(it);
  if (speakFn && kind !== 'pow') { try { speakFn(text, target, kind); } catch (e) { /* a sound problem must never stop the game */ } }
  return it;
}

export function updateBubbles(dt) {
  if (!box || !cam) return;
  const w = window.innerWidth, h = window.innerHeight;
  for (const it of items.slice()) {
    it.t += dt;
    if (it.t > it.ttl) { drop(it); continue; }
    const p = it.target.position || it.target;
    V.set(p.x, (p.y || 0) + it.height, p.z).project(cam);
    const onScreen = V.z < 1 && V.x > -1.05 && V.x < 1.05 && V.y > -1.05 && V.y < 1.05;
    if (!onScreen) { it.el.style.display = 'none'; continue; }
    const rise = it.group === 'pow' ? -(it.t / it.ttl) * 30 : 0;
    it.el.style.display = '';
    it.el.style.transform = `translate(${((V.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-V.y * 0.5 + 0.5) * h + rise).toFixed(1)}px) translate(-50%, -100%)`;
    it.el.style.opacity = it.t > it.ttl - 0.3 ? String(Math.max(0, (it.ttl - it.t) / 0.3)) : '1';
  }
}

export function clearBubbles() {
  for (const it of items.slice()) drop(it);
}

export function bubbleCount() { return items.length; }
