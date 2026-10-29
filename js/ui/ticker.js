let track = null;
let tag = null;

export function showTicker() {
  const el = document.getElementById('ticker');
  if (!el) return;
  el.hidden = false;
  track = el.querySelector('.track');
  tag = el.querySelector('.tag');
}

export function say(text, kind = 'news') {
  if (!track || !tag) {
    showTicker();
    if (!track || !tag) return;
  }

  const el = document.createElement('span');
  el.className = 'item ' + kind;
  el.textContent = text;
  track.appendChild(el);

  const w = el.offsetWidth || 200;
  const dur = 8000 + w * 8;

  const anim = el.animate(
    [
      { transform: 'translateY(-50%) translateX(0px)' },
      { transform: `translateY(-50%) translateX(-${window.innerWidth + w}px)` },
    ],
    { duration: dur, easing: 'linear' }
  );
  anim.onfinish = () => el.remove();

  if (kind === 'breaking') {
    tag.textContent = 'ব্রেকিং';
    tag.className = 'tag breaking';
  } else if (kind === 'latest') {
    tag.textContent = 'সর্বশেষ';
    tag.className = 'tag latest';
  } else {
    tag.textContent = 'খবর';
    tag.className = 'tag';
  }
}