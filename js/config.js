export const CONFIG = {
  roundSec: 100,
  quota: 2500,
  walkSp: 5,
  runSp: 8,
  nearRadius: 3.6,
  baseMin: 120,
  baseMax: 300,
  mobSpeed: 5.3,
  copSpeed: 5.7,
  mobLifeSec: 12,
  bribeMin: 200,
  hudHz: 10,

  // world
  chunkLen: 20,        // metres per chunk (along Z)
  viewChunks: 6,       // ±6 chunks (120 m) are built; fog hides everything beyond 100 m anyway
  roadWidth: 20,       // total road width: three lanes each way (it was 10 m before)
  footWidth: 2,        // per-side footpath
  shopsPerChunk: 2,    // one per side

  // health: 100 = fine, 0 = taken to hospital
  maxHp: 100,
  hpRegen: 0.3,        // per second
  beatSec: 4.0,        // how long the crowd beats you
  beatHp: 35,          // health lost in one beating
  beatLoss: 0.4,       // share of your cash lost in one beating

  // what a moving vehicle does to you
  hit: {
    rickshaw: { hp: 12, loss: 0.08, stun: 1.0 },
    cng:      { hp: 20, loss: 0.15, stun: 1.4 },
    bus:      { hp: 32, loss: 0.25, stun: 2.0 },
  },
  // the chada button (E / click / X): how long you hold it for each level (seconds). Tap = soft ask.
  grab: { t1: 0.45, t2: 1.0, t3: 1.6 },
  // Space: a hop that clears potholes and puddles
  jump: { time: 0.62, height: 0.75, stamina: 0.06 },
  potholeHp: 4,        // tripping in a pothole
  potholeStun: 0.8,
};

// The low "chase" camera behind the player (the angle of the reference game: close, low, wide lens).
// back / up = metres behind and above the player, lookAhead = how far in front of the player it looks, lookY = height it looks at.
CONFIG.cam = { fov: 64, back: 6.5, up: 3.2, lookAhead: 7, lookY: 1.2, portrait: { fov: 66, back: 10, up: 5.2, lookAhead: 12 } };

// ---------- street geometry, derived from the road width so that everything moves together ----------
// The footpath items were first placed for a 10 m road (kerb at x = 5). SHIFT is how far they move out now.
export const GEO = {
  half: CONFIG.roadWidth / 2,                        // kerb: edge of the road
  front: CONFIG.roadWidth / 2 + CONFIG.footWidth,    // shop fronts
  shift: CONFIG.roadWidth / 2 - 5,
  // lane centres from the left kerb to the right one. Left-hand traffic: the left half drives AWAY from the camera (-Z).
  // outer lanes are slow (rickshaws), the middle ones mixed, the inner ones fast (buses).
  lanes: [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map(k => k * CONFIG.roadWidth / 6),   // 20 m road -> x = -8.3, -5, -1.7, 1.7, 5, 8.3
};
// a footpath position that was written for the old narrow road (x = 5.0 ... 7.0), moved out to the new footpath
export const footX = (x) => x + GEO.shift;

