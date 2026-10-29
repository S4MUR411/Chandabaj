export const $ = (s) => document.querySelector(s);
export const $$ = (s) => document.querySelectorAll(s);

export function throttle(fn, hz) {
  let last = 0;
  return (...args) => {
    const now = performance.now();
    if (now - last < 1000 / hz) return;
    last = now;
    fn(...args);
  };
}