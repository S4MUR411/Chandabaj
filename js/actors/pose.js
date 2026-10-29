// js/actors/pose.js
// Body language for the figures made by figure.js.
// A figure faces +Z when its rotation.y is 0.  Leaning forward is a POSITIVE tilt around X.
const TAU = Math.PI * 2;
const wrap = (a) => a - TAU * Math.round(a / TAU);   // any angle -> -PI..PI

const MODES = {
  // moving
  walk:   { stride: 0.55, armSwing: 0.55, lean: 0,    bob: 0.04, arms: 'swing' },
  run:    { stride: 0.75, armSwing: 0.85, lean: 0.15, bob: 0.08, arms: 'swing' },
  chase:  { stride: 0.70, armSwing: 0,    lean: 0.25, bob: 0.09, arms: 'flail' },
  cop:    { stride: 0.40, armSwing: 0.40, lean: 0,    bob: 0.03, arms: 'swing' },
  // standing
  idle:   { arms: 'none' },
  talk:   { lean: 0.04, arms: 'talk' },                 // chatting with somebody
  point:  { lean: 0.08, arms: 'point' },                // pointing at you and shaking a fist
  shout:  { lean: -0.08, bob: 0.03, arms: 'shout' },    // both arms up, yelling
  grab:   { lean: 0.35, arms: 'reach' },
  // fighting
  beat:   { lean: 0.5, arms: 'beat', legs: 'kick' },    // punching and kicking somebody on the ground
  // on the floor
  tumble: { spin: true, arms: 'flail' },                // thrown through the air
  down:   { lie: Math.PI / 2, lift: 0.27, arms: 'none' },
  // on a vehicle
  sit:    { arms: 'sit', legs: 'sit' },                 // passenger
  pedal:  { lean: 0.18, arms: 'bars', legs: 'pedal' },  // rickshaw puller
  cling:  { arms: 'cling', legs: 'bent' },              // hanging on the bus door
};

// Head, hair, cap and shoulders sit on top of the torso, so they move when the torso leans.
function applyLean(parts, lean) {
  const c = Math.cos(lean), s = Math.sin(lean);
  if (parts.torso) parts.torso.rotation.x = lean;
  const ride = (p, y0) => { if (p) p.position.set(p.position.x, 1.15 + (y0 - 1.15) * c, (y0 - 1.15) * s); };
  ride(parts.head, 1.78);
  ride(parts.hair, 1.80);
  ride(parts.cap, 1.93);
  ride(parts.armL, 1.55);
  ride(parts.armR, 1.55);
}

function setArms(parts, lx, rx, lz, rz, le, re) {
  if (parts.armL) { parts.armL.rotation.x = lx; parts.armL.rotation.z = lz; }
  if (parts.armR) { parts.armR.rotation.x = rx; parts.armR.rotation.z = rz; }
  if (parts.elbowL) parts.elbowL.rotation.x = le;
  if (parts.elbowR) parts.elbowR.rotation.x = re;
}

function setLegs(parts, lx, rx, lk, rk) {
  if (parts.legL) parts.legL.rotation.x = lx;
  if (parts.legR) parts.legR.rotation.x = rx;
  if (parts.kneeL) parts.kneeL.rotation.x = lk;
  if (parts.kneeR) parts.kneeR.rotation.x = rk;
}

export function animateFigure(fig, dt, time, speed = 0) {
  const parts = fig.userData.parts;
  if (!parts) return;
  const pose = fig.userData.pose || (fig.userData.pose = { phase: 0, mode: 'walk' });
  if (pose.off === undefined) { pose.off = Math.random() * 6.28; pose.lift = 0; }   // so a crowd does not move in lock-step
  const m = MODES[pose.mode] || MODES.walk;

  const stride = m.stride || 0;
  const t = time + pose.off;
  if (m.legs === 'pedal') pose.phase += dt * (3 + speed * 2.4);        // pedals turn with the rickshaw's speed
  else pose.phase += dt * (stride > 0 ? 6 + speed * 0.6 : 0);
  const s = Math.sin(pose.phase);

  // ---- legs
  if (m.legs === 'kick') {
    const k = Math.sin(t * 9);
    setLegs(parts, 0.1 - Math.max(0, -k) * 1.1, 0.1 - Math.max(0, k) * 1.1, 0.15 + Math.max(0, -k) * 0.5, 0.15 + Math.max(0, k) * 0.5);
  } else if (m.legs === 'sit') {
    setLegs(parts, -1.5, -1.5, 1.5, 1.5);
  } else if (m.legs === 'pedal') {
    const c = Math.cos(pose.phase);
    setLegs(parts, -0.95 + s * 0.5, -0.95 - s * 0.5, 1.0 + c * 0.5, 1.0 - c * 0.5);
  } else if (m.legs === 'bent') {
    setLegs(parts, -0.2, -0.2, 0.4, 0.4);
  } else {
    setLegs(parts, s * stride, -s * stride, Math.max(0, -s) * stride * 0.55, Math.max(0, s) * stride * 0.55);
  }

  // ---- arms (rotation.x: -PI/2 = pointing forward, -PI = straight up; elbow.x negative bends the forearm forward)
  switch (m.arms) {
    case 'flail':
      setArms(parts, Math.sin(time * 12) * 0.9, -Math.sin(time * 12) * 0.9, 0.4, -0.4, 0, 0); break;
    case 'reach':
      setArms(parts, -1.5, -1.5, 0, 0, 0, 0); break;
    case 'swing':
      setArms(parts, -s * m.armSwing, s * m.armSwing, 0, 0, 0, 0); break;
    case 'talk':
      setArms(parts, -0.3 + Math.sin(t * 3) * 0.2, -0.9 + Math.sin(t * 4.3) * 0.5, 0.1, -0.2, -0.5, -0.9); break;
    case 'point':
      setArms(parts, -2.7 + Math.sin(t * 13) * 0.35, -1.55, 0.2, 0, -0.4, -0.1); break;
    case 'shout':
      setArms(parts, -2.8 + Math.sin(t * 11) * 0.4, -2.8 + Math.sin(t * 11 + 1.5) * 0.4, 0.3, -0.3, -0.3, -0.3); break;
    case 'beat':
      setArms(parts, -2.2 + Math.sin(t * 13) * 1.1, -2.2 - Math.sin(t * 13) * 1.1, 0.1, -0.1, -0.8, -0.8); break;
    case 'sit':
      setArms(parts, -0.55, -0.55, 0, 0, -1.0, -1.0); break;
    case 'bars':
      setArms(parts, -1.25, -1.25, 0, 0, -0.4, -0.4); break;
    case 'cling':
      setArms(parts, -2.9, -2.9, 0, 0, -0.15, -0.15); break;
    default:
      setArms(parts, 0, 0, 0, 0, 0, 0);
  }

  applyLean(parts, m.lean || 0);
  if (parts.head) parts.head.rotation.y = Math.sin(stride > 0 ? pose.phase * 0.3 : t * 0.8) * 0.12;

  // ---- body: bobbing, lying down, tumbling
  const k = Math.min(1, dt * 12);
  pose.lift += ((m.lift || 0) - pose.lift) * k;
  fig.position.y = (fig.userData.baseY || 0) + Math.abs(s) * (m.bob || 0) + pose.lift;

  if (m.spin) {
    fig.rotation.x += dt * 8;
    fig.rotation.z += dt * 3;
  } else {
    fig.rotation.x = wrap(fig.rotation.x) * (1 - k);                       // get back upright...
    fig.rotation.z = wrap(fig.rotation.z);
    fig.rotation.z += ((m.lie || 0) - fig.rotation.z) * k;                  // ...or fall flat
  }
}

export function setMode(fig, mode) {
  if (!fig.userData.pose) fig.userData.pose = { phase: 0, mode };
  if (fig.userData.pose.mode !== mode) fig.userData.pose.mode = mode;
}

// turn a figure on the spot to look at a point on the ground
export function faceToward(fig, x, z) {
  fig.rotation.y = Math.atan2(x - fig.position.x, z - fig.position.z);
}
