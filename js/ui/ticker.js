// js/ui/ticker.js
// The news ticker at the bottom of the screen. Headlines enter from the RIGHT edge and scroll to the left,
// one after another with a gap between them (they never sit on top of each other).
// When many headlines arrive at once they wait in line; if the line gets too long, ordinary
// "latest" items are skipped so the ticker does not fall minutes behind the game.

const SPEED = 110;        // pixels per second
const GAP = 60;           // empty space between two headlines (pixels)
const MAX_WAIT = 12;      // seconds: a "latest" item that would have to wait longer than this is dropped

let track = null;
let tag = null;
let freeAt = 0;           // performance.now() (ms) when the next headline may start entering

export function showTicker() {
  const el = document.getElementById('ticker');
  if (!el) return;
  el.hidden = false;
  track = el.querySelector('.track');
  tag = el.querySelector('.tag');
}

function setTag(kind) {
  if (!tag) return;
  if (kind === 'breaking') { tag.textContent = 'ব্রেকিং'; tag.className = 'tag breaking'; }
  else if (kind === 'latest') { tag.textContent = 'সর্বশেষ'; tag.className = 'tag latest'; }
  else { tag.textContent = 'খবর'; tag.className = 'tag'; }
}

export function say(text, kind = 'news') {
  if (!track || !tag) {
    showTicker();
    if (!track || !tag) return;
  }

  const now = performance.now();
  const wait = Math.max(0, freeAt - now) / 1000;
  if (wait > MAX_WAIT && kind !== 'breaking') return;     // too much news at once: skip the small stuff

  const el = document.createElement('span');
  el.className = 'item ' + kind;
  el.textContent = text;
  el.style.visibility = 'hidden';                          // measured first, shown when its turn comes
  track.appendChild(el);

  const trackW = track.clientWidth || window.innerWidth;
  const w = el.offsetWidth || 200;
  const delay = wait * 1000;
  const dur = ((trackW + w) / SPEED) * 1000;

  // the next headline may start when this one's tail is GAP pixels inside the right edge
  freeAt = now + delay + ((w + GAP) / SPEED) * 1000;

  const anim = el.animate(
    [
      { transform: `translateY(-50%) translateX(${trackW}px)`, visibility: 'visible' },
      { transform: `translateY(-50%) translateX(${-w}px)`, visibility: 'visible' },
    ],
    { duration: dur, delay, easing: 'linear', fill: 'both' }
  );
  anim.onfinish = () => el.remove();
  setTimeout(() => setTag(kind), delay);                   // the red/blue tag changes when the headline appears
}

// a new round: throw away whatever is still scrolling or waiting
export function clearTicker() {
  if (track) track.textContent = '';
  freeAt = 0;
}
