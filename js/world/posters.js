// js/world/posters.js
// Election posters, rally banners and rooftop billboards.
// The parties and the leaders are made up. Posters are painted on canvases once and shared.
import * as THREE from 'three';
import { afterFont, FONT, css } from '../util/fontdraw.js';

export const PARTIES = [
  { name: 'উন্নয়ন ফ্রন্ট', color: 0x1f7a46, accent: 0xf2c500, leader: 'চেয়ারম্যান কালু মিয়া', slogans: ['উন্নয়নের মহাসড়কে আমরা', 'রাস্তা হবে, খাল হবে — একদিন!'] },
  { name: 'জনতা জোট', color: 0xb3262b, accent: 0xffffff, leader: 'মেম্বার সাহেব', slogans: ['গর্তমুক্ত সড়ক — প্রতিশ্রুতি!', 'জনগণের পাশে, ছবির কোণে'] },
  { name: 'সবার দল', color: 0x1d4e9e, accent: 0xf2c500, leader: 'জননেতা হাজী সাহেব', slogans: ['আপনার ভোট, আমার ভবিষ্যৎ', 'সবুজ ঢাকা, পরিচ্ছন্ন ঢাকা (আগামী নির্বাচনে)'] },
  { name: 'নতুন বাংলা পার্টি', color: 0x7a2a8c, accent: 0xf2c500, leader: 'নেতা চাঁদ মিয়া', slogans: ['চাঁদা নয়, অনুদান!', 'জ্যাম নয়, জ্যামিতি — নতুন পরিকল্পনা'] },
];

const SKINS = ['#c58c63', '#a8744f', '#d9a67c', '#b8895f'];
const cache = new Map();

function material(key, w, h, draw, doubleSide = false) {
  let m = cache.get(key);
  if (m) return m;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  m = new THREE.MeshBasicMaterial({ map: tex, side: doubleSide ? THREE.DoubleSide : THREE.FrontSide });
  cache.set(key, m);
  afterFont(key, () => { draw(c.getContext('2d'), w, h); tex.needsUpdate = true; });
  return m;
}

// a cartoon face, the same for every leader except hair, glasses and cap
function face(g, cx, cy, r, look, bg) {
  g.fillStyle = SKINS[look % SKINS.length];
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#16120e';
  g.beginPath(); g.arc(cx, cy - r * 0.15, r * 1.03, Math.PI, 0); g.fill();                    // hair
  g.fillStyle = SKINS[look % SKINS.length];
  g.beginPath(); g.arc(cx, cy - r * 0.05, r * 0.88, Math.PI * 1.08, Math.PI * 1.92); g.lineTo(cx, cy - r * 0.3); g.fill();   // forehead
  g.fillStyle = '#fff';
  g.beginPath(); g.ellipse(cx - r * 0.35, cy - r * 0.1, r * 0.17, r * 0.12, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(cx + r * 0.35, cy - r * 0.1, r * 0.17, r * 0.12, 0, 0, 7); g.fill();
  g.fillStyle = '#16120e';
  g.beginPath(); g.arc(cx - r * 0.33, cy - r * 0.1, r * 0.07, 0, 7); g.fill();
  g.beginPath(); g.arc(cx + r * 0.37, cy - r * 0.1, r * 0.07, 0, 7); g.fill();
  if (look % 2 === 0) {                                                                       // glasses
    g.strokeStyle = '#16120e'; g.lineWidth = Math.max(2, r * 0.05);
    g.strokeRect(cx - r * 0.58, cy - r * 0.27, r * 0.45, r * 0.3);
    g.strokeRect(cx + r * 0.13, cy - r * 0.27, r * 0.45, r * 0.3);
  }
  g.fillStyle = '#16120e';                                                                    // moustache
  g.beginPath(); g.ellipse(cx, cy + r * 0.32, r * 0.42, r * 0.11, 0, 0, 7); g.fill();
  g.strokeStyle = '#7a2a1a'; g.lineWidth = Math.max(2, r * 0.06);                             // smile
  g.beginPath(); g.arc(cx, cy + r * 0.38, r * 0.3, 0.2, Math.PI - 0.2); g.stroke();
  if (look % 3 === 0) {                                                                       // white cap
    g.fillStyle = '#f4f1ea';
    g.beginPath(); g.ellipse(cx, cy - r * 0.82, r * 0.6, r * 0.22, 0, 0, 7); g.fill();
  }
}

// a vertical poster, 256 x 384
export function posterMaterial(party, look) {
  const P = PARTIES[((party % PARTIES.length) + PARTIES.length) % PARTIES.length];
  return material('poster|' + party + '|' + look, 256, 384, (g, w, h) => {
    g.fillStyle = css(P.color); g.fillRect(0, 0, w, h);
    g.fillStyle = css(P.accent); g.fillRect(0, 0, w, 40); g.fillRect(0, h - 70, w, 70);
    g.fillStyle = css(P.color); g.textAlign = 'center';
    g.font = '800 30px ' + FONT; g.fillText(P.name, w / 2, 30, w - 20);
    face(g, w / 2, 160, 78, look, P.color);
    g.fillStyle = '#fff'; g.font = '800 26px ' + FONT; g.fillText(P.leader, w / 2, 280, w - 16);
    g.fillStyle = css(P.color); g.font = '800 22px ' + FONT; g.fillText(P.slogans[look % P.slogans.length], w / 2, h - 28, w - 16);
    g.strokeStyle = css(P.accent); g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
  });
}

// a long cloth banner, 1024 x 160
export function bannerMaterial(party, k) {
  const P = PARTIES[((party % PARTIES.length) + PARTIES.length) % PARTIES.length];
  return material('banner|' + party + '|' + k, 1024, 160, (g, w, h) => {
    g.fillStyle = css(P.color); g.fillRect(0, 0, w, h);
    g.fillStyle = css(P.accent); g.fillRect(0, 0, w, 12); g.fillRect(0, h - 12, w, 12);
    face(g, 84, 82, 52, party + k, P.color);
    face(g, w - 84, 82, 52, party + k + 1, P.color);
    g.textAlign = 'center'; g.fillStyle = '#fff';
    g.font = '800 62px ' + FONT; g.fillText(P.slogans[k % P.slogans.length], w / 2, 82, w - 280);
    g.fillStyle = css(P.accent); g.font = '800 34px ' + FONT; g.fillText(P.name + ' · ' + P.leader, w / 2, 130, w - 280);
  }, true);
}

// a big rooftop board, 512 x 256
export function billboardMaterial(party, k) {
  const P = PARTIES[((party % PARTIES.length) + PARTIES.length) % PARTIES.length];
  return material('board|' + party + '|' + k, 512, 256, (g, w, h) => {
    g.fillStyle = css(P.color); g.fillRect(0, 0, w, h);
    g.fillStyle = css(P.accent); g.fillRect(0, h - 56, w, 56);
    face(g, 100, 118, 80, party + k, P.color);
    g.textAlign = 'left'; g.fillStyle = '#fff';
    g.font = '800 42px ' + FONT; g.fillText(P.slogans[k % P.slogans.length], 200, 90, w - 215);
    g.font = '800 30px ' + FONT; g.fillStyle = css(P.accent); g.fillText(P.leader, 200, 150, w - 215);
    g.textAlign = 'center'; g.fillStyle = css(P.color); g.font = '800 32px ' + FONT; g.fillText(P.name, w / 2, h - 16, w - 20);
    g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  });
}
