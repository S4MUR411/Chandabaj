// js/input.js
// All the ways to play, in one place: keyboard + mouse, game controller, touch screen.
// The game (main.js) only asks this module a few simple things:
//
//   input.moveX, input.moveZ   where do you want to go? -1..1 (moveZ > 0 = towards the camera, < 0 = down the street)
//   input.mag                  how hard (0..1). A keyboard is always 1, a stick or a thumb can be gentle.
//   input.sprint               run (Shift, controller stick click / shoulder, thumb pushed all the way)
//   onAction(down, cancelled)  the "chada" button went down / up. Hold it to be tougher. cancelled = true when the
//                              window lost focus (so nothing is paid out by accident)
//   onPress(name)              one-shot buttons: jump, bribe, hire, pause, mute, voice, ask0 .. ask3
//
// KEYBOARD + MOUSE (like most PC games)          CONTROLLER (standard layout)         TOUCH SCREEN
//   W A S D / arrows   walk                        left stick / D-pad  walk            left half: drag = walk (stick appears under your thumb)
//   Shift              run                         L3 / LB / LT        run             drag to the edge = run
//   Space              jump                        A                   jump            big round button = chada (hold = tougher)
//   E or left click    chada (hold = tougher)      X or RT             chada           small buttons: jump, chai-pani, mastan, pause
//   F                  chai-pani (pay the police)  B                   chai-pani
//   Q                  hire a mastan               Y                   hire a mastan
//   Esc / P            pause                       Start               pause
//   M mute, V voices
//   1 2 3 4 and B, H still work as shortcuts (direct choice of how tough, old keys)

export const input = {
  moveX: 0, moveZ: 0, mag: 0, sprint: false,
  device: 'keys',               // the last thing you used: 'keys' | 'mouse' | 'pad' | 'touch' (decides which key names the hints show)
  actionHeld: false,
};

let H = { onAction() {}, onPress() {} };

// ---------- which key does what (by physical key, so it also works on AZERTY and other layouts) ----------
const MOVE = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
const ACTION_KEYS = new Set(['KeyE', 'Enter', 'NumpadEnter']);
const PRESS = {
  Space: 'jump', KeyF: 'bribe', KeyB: 'bribe', KeyQ: 'hire', KeyH: 'hire',
  Escape: 'pause', KeyP: 'pause', KeyM: 'mute', KeyV: 'voice',
  Digit1: 'ask0', Digit2: 'ask1', Digit3: 'ask2', Digit4: 'ask3', Numpad1: 'ask0', Numpad2: 'ask1', Numpad3: 'ask2', Numpad4: 'ask3',
};

const kb = { up: false, down: false, left: false, right: false, shift: false };
const actionSrc = new Set();           // who is holding the chada button right now: 'key', 'mouse', 'pad', 'touch'
const pad = { x: 0, y: 0, sprint: false, prev: {} };
const touch = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
let touchEl = null, padEl = null, stickEl = null;

// a source disappeared (controller unplugged ...): drop its hold WITHOUT paying anything
function dropSource(src) {
  if (!actionSrc.delete(src)) return;
  input.actionHeld = actionSrc.size > 0;
  if (!input.actionHeld) H.onAction(false, true);
}

function setAction(src, down) {
  const before = actionSrc.size > 0;
  if (down) actionSrc.add(src); else actionSrc.delete(src);
  const after = actionSrc.size > 0;
  input.actionHeld = after;
  if (!before && after) H.onAction(true, false);
  else if (before && !after) H.onAction(false, false);
}

// let go of everything (window lost focus, tab hidden, game paused): nothing may stay "pressed"
export function releaseAll() {
  kb.up = kb.down = kb.left = kb.right = kb.shift = false;
  const had = actionSrc.size > 0;
  actionSrc.clear(); input.actionHeld = false;
  endStick();
  if (had) H.onAction(false, true);
}

// ---------- keyboard ----------
function codeOf(e) {
  if (e.code) return e.code;
  const k = (e.key || '').toLowerCase();                          // virtual keyboards without a code
  if (k.length === 1 && k >= 'a' && k <= 'z') return 'Key' + k.toUpperCase();
  if (k >= '1' && k <= '4') return 'Digit' + k;
  return { ' ': 'Space', escape: 'Escape', enter: 'Enter', arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight', shift: 'ShiftLeft' }[k] || '';
}

function onKeyDown(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;                  // keep browser shortcuts (Ctrl+R ...) working
  const c = codeOf(e);
  if (MOVE[c]) { kb[MOVE[c]] = true; input.device = 'keys'; e.preventDefault(); return; }
  if (c === 'ShiftLeft' || c === 'ShiftRight') { kb.shift = true; return; }
  if (ACTION_KEYS.has(c)) {
    if (!e.repeat) { input.device = 'keys'; setAction('key', true); }
    e.preventDefault(); return;
  }
  if (PRESS[c]) {
    if (!e.repeat) { input.device = 'keys'; H.onPress(PRESS[c]); }
    if (c === 'Space') e.preventDefault();
  }
}
function onKeyUp(e) {
  const c = codeOf(e);
  if (MOVE[c]) kb[MOVE[c]] = false;
  else if (c === 'ShiftLeft' || c === 'ShiftRight') kb.shift = false;
  else if (ACTION_KEYS.has(c)) setAction('key', false);
}

// ---------- mouse (left button = chada) and touch ----------
const onUi = (t) => !!(t && t.closest && t.closest('button, a, input, select, textarea, .ov'));

function onPointerDown(e) {
  if (e.pointerType === 'touch') { onTouchDown(e); return; }
  if (e.button !== 0 || onUi(e.target)) return;
  input.device = 'mouse';
  setAction('mouse', true);
}
function onPointerUp(e) {
  if (e.pointerType === 'touch') { onTouchUp(e); return; }
  if (e.button === 0) setAction('mouse', false);
}

// -- touch: the left half of the screen is a floating stick, the buttons on the right are real buttons
const STICK_R = 58;
function onTouchDown(e) {
  input.device = 'touch';
  if (e.target && e.target.closest && e.target.closest('[data-btn]')) return;       // buttons handle themselves
  if (touch.id !== null || e.clientX > innerWidth * 0.55) return;
  touch.id = e.pointerId; touch.ox = e.clientX; touch.oy = e.clientY; touch.x = touch.y = 0;
  if (padEl) { padEl.style.left = (e.clientX - 66) + 'px'; padEl.style.top = (e.clientY - 66) + 'px'; padEl.style.bottom = 'auto'; padEl.classList.add('on'); }
  if (stickEl) stickEl.style.transform = 'translate(0px, 0px)';
}
function onPointerMove(e) {
  if (e.pointerType !== 'touch' || e.pointerId !== touch.id) return;
  let dx = (e.clientX - touch.ox) / STICK_R, dy = (e.clientY - touch.oy) / STICK_R;
  const m = Math.hypot(dx, dy);
  if (m > 1) { dx /= m; dy /= m; }
  touch.x = dx; touch.y = dy;
  if (stickEl) stickEl.style.transform = `translate(${(dx * STICK_R * 0.8).toFixed(1)}px, ${(dy * STICK_R * 0.8).toFixed(1)}px)`;
}
function onTouchUp(e) { if (e.pointerId === touch.id) endStick(); }
function endStick() {
  touch.id = null; touch.x = touch.y = 0;
  if (padEl) { padEl.classList.remove('on'); padEl.style.left = ''; padEl.style.top = ''; padEl.style.bottom = ''; }
  if (stickEl) stickEl.style.transform = 'translate(0px, 0px)';
}
export function showTouch(on) { if (touchEl) touchEl.hidden = !on; }

function wireButtons() {
  for (const b of document.querySelectorAll('[data-btn]')) {
    const name = b.dataset.btn;
    const down = (e) => {
      e.preventDefault(); e.stopPropagation();
      input.device = 'touch'; b.classList.add('down');
      if (name === 'action') setAction('touch', true); else H.onPress(name);
    };
    const up = () => { b.classList.remove('down'); if (name === 'action') setAction('touch', false); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
  }
}

// ---------- game controller ----------
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
function pollPad() {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  let g = null;
  for (const p of list) if (p && p.connected) { g = p; break; }
  if (!g) { pad.x = pad.y = 0; pad.sprint = false; dropSource('pad'); pad.prev = {}; return; }
  const b = (i) => !!(g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > 0.5));
  let x = g.axes[0] || 0, y = g.axes[1] || 0;
  const m = Math.hypot(x, y), DEAD = 0.2;
  if (m < DEAD) { x = y = 0; } else { const s = Math.min(1, (m - DEAD) / (1 - DEAD)) / m; x *= s; y *= s; }
  if (b(BTN.LEFT)) x = -1; if (b(BTN.RIGHT)) x = 1; if (b(BTN.UP)) y = -1; if (b(BTN.DOWN)) y = 1;
  pad.x = x; pad.y = y;
  pad.sprint = b(BTN.L3) || b(BTN.LB) || b(BTN.LT);
  const now = { jump: b(BTN.A), bribe: b(BTN.B), hire: b(BTN.Y), pause: b(BTN.START), mute: b(BTN.BACK), act: b(BTN.X) || b(BTN.RT) };
  for (const k of ['jump', 'bribe', 'hire', 'pause', 'mute']) if (now[k] && !pad.prev[k]) { input.device = 'pad'; H.onPress(k); }
  if (now.act !== !!pad.prev.act) { if (now.act) input.device = 'pad'; setAction('pad', now.act); }
  if (x || y || pad.sprint) input.device = 'pad';
  pad.prev = now;
}

// ---------- once per frame: merge everything into one movement vector ----------
export function updateInput() {
  pollPad();
  let kx = (kb.right ? 1 : 0) - (kb.left ? 1 : 0), kz = (kb.down ? 1 : 0) - (kb.up ? 1 : 0);
  const km = Math.hypot(kx, kz);
  if (km > 1) { kx /= km; kz /= km; }
  const tm = Math.hypot(touch.x, touch.y), DEAD = 0.14;
  const tx = tm < DEAD ? 0 : touch.x, tz = tm < DEAD ? 0 : touch.y;
  // the strongest source wins
  const cand = [{ x: kx, z: kz }, { x: pad.x, z: pad.y }, { x: tx, z: tz }];
  let best = cand[0];
  for (const c of cand) if (Math.hypot(c.x, c.z) > Math.hypot(best.x, best.z)) best = c;
  const bm = Math.hypot(best.x, best.z);
  input.moveX = best.x; input.moveZ = best.z; input.mag = Math.min(1, bm);
  input.sprint = kb.shift || pad.sprint || tm > 0.9;
  if (tm >= DEAD) input.device = 'touch';
}

// ---------- the key names to show in hints ("E", "X", "the big button") ----------
const HINTS = {
  keys:  { action: 'E', bribe: 'F', hire: 'Q', jump: 'Space', sprint: 'Shift', pause: 'Esc' },
  mouse: { action: 'ক্লিক', bribe: 'F', hire: 'Q', jump: 'Space', sprint: 'Shift', pause: 'Esc' },
  pad:   { action: 'X', bribe: 'B', hire: 'Y', jump: 'A', sprint: 'L3', pause: 'Start' },
  touch: { action: 'ডানের বড় বাটন', bribe: '“চা-পানি” বাটন', hire: '“মাস্তান” বাটন', jump: '“লাফ” বাটন', sprint: 'স্টিক পুরো টেনে', pause: '⏸' },
};
export const keyHint = (name) => (HINTS[input.device] || HINTS.keys)[name];

// ---------- start ----------
export function initInput(handlers) {
  H = { ...H, ...handlers };
  touchEl = document.getElementById('touch'); padEl = document.getElementById('pad'); stickEl = document.getElementById('stick');
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  addEventListener('pointerdown', onPointerDown);
  addEventListener('pointermove', onPointerMove);
  addEventListener('pointerup', onPointerUp);
  addEventListener('pointercancel', onPointerUp);
  addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  addEventListener('contextmenu', (e) => { if (!onUi(e.target)) e.preventDefault(); });        // right click must not open a menu in the middle of a fight
  wireButtons();
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) { input.device = 'touch'; }
}
