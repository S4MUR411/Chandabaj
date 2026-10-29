// js/util/fontdraw.js
// Canvas text is drawn before the web font ("Anek Bangla") has arrived. Call this after the
// first draw: it draws again once the font is ready, and tells the texture to update.
export function afterFont(sampleText, redraw) {
  if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
    document.fonts.load('800 40px "Anek Bangla"', sampleText).then(redraw).catch(() => {});
  }
}

export const FONT = '"Anek Bangla", "Noto Sans Bengali", sans-serif';

// brightness 0..1 of a #rrggbb number: used to pick black or white text on a coloured board
export function luma(hex) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export const css = (hex) => '#' + hex.toString(16).padStart(6, '0');
