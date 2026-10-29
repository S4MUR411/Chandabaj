// js/util/pile.js
// Collects many little boxes / wheels / flat patches into ONE geometry with vertex colours,
// so a whole rickshaw, a whole bus or a whole chunk of rubbish is a single draw call.
import * as THREE from 'three';

// the six faces of a box: outward direction + four corners
const FACES = [
  [[1, 0, 0],  [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]]],
  [[-1, 0, 0], [[-1, -1, 1], [-1, -1, -1], [-1, 1, -1], [-1, 1, 1]]],
  [[0, 1, 0],  [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]]],
  [[0, -1, 0], [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1]]],
  [[0, 0, 1],  [[-1, -1, 1], [-1, 1, 1], [1, 1, 1], [1, -1, 1]]],
  [[0, 0, -1], [[1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, -1]]],
];

function rotate(v, rx, ry, rz) {
  let [x, y, z] = v;
  if (rz) { const c = Math.cos(rz), s = Math.sin(rz); [x, y] = [x * c - y * s, x * s + y * c]; }
  if (rx) { const c = Math.cos(rx), s = Math.sin(rx); [y, z] = [y * c - z * s, y * s + z * c]; }
  if (ry) { const c = Math.cos(ry), s = Math.sin(ry); [x, z] = [x * c + z * s, -x * s + z * c]; }
  return [x, y, z];
}

export class Pile {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.top = 0; this.k = 1; }

  // one triangle, wound so that it faces the same way as the normal n
  tri(a, b, c, n, color) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) { const t = b; b = c; c = t; }
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(color.r, color.g, color.b);
    }
  }

  // centre, size, colour; ry = turn around, rx/rz = tilt.
  // Pieces are made bigger by this.k (used for rubbish: seen from far away, real-size rubbish would be invisible).
  box(cx, cy, cz, sx, sy, sz, hex, ry = 0, rx = 0, rz = 0) {
    const k = this.k;
    cy = this.top + (cy - this.top) * k; sx *= k; sy *= k; sz *= k;
    const c = new THREE.Color(hex);
    for (const [n0, corners] of FACES) {
      const n = rotate(n0, rx, ry, rz);
      const v = corners.map(q => {
        const p = rotate([q[0] * sx / 2, q[1] * sy / 2, q[2] * sz / 2], rx, ry, rz);
        return [p[0] + cx, p[1] + cy, p[2] + cz];
      });
      this.tri(v[0], v[1], v[2], n, c);
      this.tri(v[0], v[2], v[3], n, c);
    }
  }

  // a wheel: round, axis along X
  wheel(cx, cy, cz, r, width, hex, segs = 10) {
    const c = new THREE.Color(hex);
    const ring = [];
    for (let i = 0; i < segs; i++) { const a = (i / segs) * Math.PI * 2; ring.push([Math.cos(a), Math.sin(a)]); }
    const hw = width / 2;
    for (let i = 0; i < segs; i++) {
      const p = ring[i], q = ring[(i + 1) % segs];
      const m = [0, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const l = Math.hypot(m[1], m[2]) || 1;
      const n = [0, m[1] / l, m[2] / l];
      const A = [cx - hw, cy + p[0] * r, cz + p[1] * r], B = [cx - hw, cy + q[0] * r, cz + q[1] * r];
      const C = [cx + hw, cy + q[0] * r, cz + q[1] * r], D = [cx + hw, cy + p[0] * r, cz + p[1] * r];
      this.tri(A, B, C, n, c); this.tri(A, C, D, n, c);
      this.tri([cx + hw, cy, cz], D, C, [1, 0, 0], c);
      this.tri([cx - hw, cy, cz], A, B, [-1, 0, 0], c);
    }
  }

  // a flat patch lying on the ground (puddle, pothole): ellipse with radii rx, rz at height y
  patch(cx, y, cz, rx, rz, hex, turn = 0, segs = 14) {
    const c = new THREE.Color(hex);
    const ct = Math.cos(turn), st = Math.sin(turn);
    const pt = (a) => {
      const px = Math.cos(a) * rx, pz = Math.sin(a) * rz;
      return [cx + px * ct - pz * st, y, cz + px * st + pz * ct];
    };
    for (let i = 0; i < segs; i++) {
      this.tri([cx, y, cz], pt((i / segs) * Math.PI * 2), pt(((i + 1) / segs) * Math.PI * 2), [0, 1, 0], c);
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    return g;
  }
}
