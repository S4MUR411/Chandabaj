// js/util/fontdraw.js
// Canvas text is drawn before the web font ("Anek Bangla") has arrived. Call this after the
// first draw: it draws again once the font is ready, and tells the texture to update.
// The font comes in parts (Bengali letters, Latin letters) and in two weights; a part is only
// downloaded when text that needs it is asked for. So we always ask for BENGALI text in both
// weights, whatever `sampleText` is (it used to be a cache key like "poster|0|1", which only
// loaded the Latin part, so the Bengali text could stay in the fallback font).
const BN_SAMPLE = 'চাঁদাবাজ উন্নয়ন ০১২৩৪৫৬৭৮৯';
let fontReady = null;
function loadFont() {
  if (!fontReady) {
    fontReady = Promise.all([
      document.fonts.load('800 40px "Anek Bangla"', BN_SAMPLE),
      document.fonts.load('500 40px "Anek Bangla"', BN_SAMPLE),
      document.fonts.load('800 40px "Anek Bangla"', 'Aa'),
    ]).catch(() => {});
  }
  return fontReady;
}

export function afterFont(sampleText, redraw) {
  if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) return;
  const again = () => { try { redraw(); } catch (e) { /* a picture must never stop the game */ } };
  loadFont().then(again);
  if (document.fonts.ready) document.fonts.ready.then(again).catch(() => {});   // and once more when every font has settled
}

export const FONT = '"Anek Bangla", "Noto Sans Bengali", sans-serif';

// brightness 0..1 of a #rrggbb number: used to pick black or white text on a coloured board
export function luma(hex) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export const css = (hex) => '#' + hex.toString(16).padStart(6, '0');
