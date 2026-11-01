/* =====================================================================
   CONFIG
   ===================================================================== */
const CONFIG = {
  W: 1080, H: 1920, CX: 510, CY: 975,
  R0: 450,
  /* arena is a fixed (non-rotating) polygon stretched vertically so its corners sit ARENA_HALF_H above/below centre */
  ARENA_HALF_H: 465,
  STEP_HZ: 240,
  /* Tuned with the balance test. Single-ball mode: MAX_BALLS 1 (set >1 to bring back the ball schedule). */
  /* ball starts at BALL_SPEED and gets WALL_ACCEL faster on every wall/post bounce, up to BALL_MAX_MULT × */
  BALL_R: 16, BALL_SPEED: 600, WALL_ACCEL: 0.10, BALL_MAX_MULT: 2.4, MAX_BALLS: 1, BALL_ADD_EVERY: 3, GOAL_RESPAWN: 1.1,
  POST_R: 10, GOAL_FRAC: 0.50, ELIM_GOAL_GROW: 0.25, FINAL_GOAL_FRAC: 0.61, DERBY_GOAL_FRAC: 0.50, NET_DEPTH: 50, NET_DEPTH_RECT: 34,
  KEEPER_INSET: 28, KEEPER_LEN_FRAC: 0.30, KEEPER_THICK: 14, KEEPER_SPEED: 320, KEEPER_GAIN: 3, KEEPER_READ: 0.3,
  PLAYER_R: 24, PLAYER_SPEED: 260,
  ROT_SPEED_DEG: 0, ROT_GROWTH: 1.12,
  GOAL_GROW: false,   // false: goals never widen (no growth after eliminations, in overtime or derby golden goal)
  OT_AT: 45, OT_RAMP: 10, OT_MULT: 1.6,
  ELIM_SLOW_GAME: 0.18, ELIM_FREEZE: 1.0, WIN_SLOW_GAME: 0.24, TS_SLOW: 0.3,
  FINAL_SLOWMO_GAME: 0.375, FINAL_SLOWMO_TS: 0.25, FINAL_SLOWMO_DIST: 120,
  FINAL_W: 860, FINAL_H: 930, FINAL_GOALS: 2,   // final duel: first to FINAL_GOALS goals wins
  DERBY_W: 720, DERBY_H: 880, DERBY_TIME: 30,
  PU_R: 26, PU_LIFE: 8, PU_MIN: 6, PU_MAX: 10, PU_MAX_COUNT: 2, PU_WALL_MARGIN: 80,
  BUMPER_R: 30,
  DEFAULT_LIVES: 1, DEFAULT_TEAM_COUNT: 6, DEFAULT_SPEED_MULT: 1.0,
  POINTS: [10, 7, 5, 4, 3, 2, 1, 0, 0, 0], DERBY_WIN_POINTS: 5, SEASON_LENGTH: 30,
  STORAGE_KEY: 'arenaLeague_v1',
  END_DURATION: 6.0,
  HARD_TIME_LIMIT: 300,
};
const DT = 1 / CONFIG.STEP_HZ;

/* Dünyanın önde gelen 18 kulübü (sadece ad + kulüp renkleri; logo/arma kullanılmaz) */
const DEFAULT_TEAMS = [
  { name: 'Real Madrid',        code: 'RMA', c1: '#FFFFFF', c2: '#FEBE10' },
  { name: 'Barcelona',          code: 'BAR', c1: '#A50044', c2: '#004D98' },
  { name: 'Atlético Madrid',    code: 'ATM', c1: '#CB3524', c2: '#272E61' },
  { name: 'Manchester City',    code: 'MCI', c1: '#6CABDD', c2: '#1C2C5B' },
  { name: 'Liverpool',          code: 'LIV', c1: '#C8102E', c2: '#00B2A9' },
  { name: 'Arsenal',            code: 'ARS', c1: '#EF0107', c2: '#FFFFFF' },
  { name: 'Chelsea',            code: 'CHE', c1: '#034694', c2: '#FFFFFF' },
  { name: 'Manchester United',  code: 'MUN', c1: '#DA291C', c2: '#FBE122' },
  { name: 'Bayern München',     code: 'BAY', c1: '#DC052D', c2: '#0066B2' },
  { name: 'Borussia Dortmund',  code: 'BVB', c1: '#FDE100', c2: '#000000' },
  { name: 'Bayer Leverkusen',   code: 'B04', c1: '#E32221', c2: '#000000' },
  { name: 'Paris Saint-Germain',code: 'PSG', c1: '#004170', c2: '#DA291C' },
  { name: 'Inter',              code: 'INT', c1: '#0068A8', c2: '#000000' },
  { name: 'AC Milan',           code: 'MIL', c1: '#FB090B', c2: '#000000' },
  { name: 'Juventus',           code: 'JUV', c1: '#111111', c2: '#FFFFFF' },
  { name: 'Fenerbahçe',         code: 'FEN', c1: '#FFED00', c2: '#002D72' },
  { name: 'Beşiktaş',           code: 'BJK', c1: '#111111', c2: '#FFFFFF' },
  { name: 'Galatasaray',        code: 'GAL', c1: '#A90432', c2: '#FDB912' },
];
/* uppercase for names and 3-letter codes: Turkish rules (i → İ) only for Turkish-looking names, so
   "Beşiktaş" → "BEŞİKTAŞ" but "Manchester United" → "MANCHESTER UNITED" */
const upTR = (s) => { s = String(s); return /[çğışöüÇĞİŞÖÜ]/.test(s) ? s.toLocaleUpperCase('tr-TR') : s.toUpperCase(); };
const CODE_STRIP = /[^A-Z0-9ÇĞİÖŞÜ]/g;

/* Power-up definitions (logic lives in Game.applyPowerup) */
const POWERUP_DEFS = [
  { id: 'giant', icon: '🧤', name: 'Giant Keeper', kind: 'pos', dur: 6, w: 22 },
  { id: 'wall',  icon: '🧱', name: 'Goal Wall',    kind: 'pos', dur: 4, w: 15 },
  { id: 'small', icon: '🔍', name: 'Small Goal',   kind: 'pos', dur: 6, w: 18 },
  { id: 'big',   icon: '🎯', name: 'Big Goal',     kind: 'neg', dur: 6, w: 18 },
  { id: 'speed', icon: '⚡', name: 'Speed Up',     kind: 'gen', dur: 4, w: 15 },
  { id: 'split', icon: '➕', name: 'Split Ball',   kind: 'gen', dur: 0, w: 9 },
  { id: 'life',  icon: '❤️', name: 'Extra Life',   kind: 'pos', dur: 0, w: 3 },
];

/* Theme gameplay definitions (visual palettes are in THEMES section) */
const THEME_DEFS = {
  classic: { id: 'classic', icon: '⚽', name: 'Classic', speed: 1.0, dev: 4 },
  snow:    { id: 'snow',    icon: '❄️', name: 'Snow',    speed: 1.1, dev: 2 },
  rain:    { id: 'rain',    icon: '🌧️', name: 'Rain',    speed: 0.85, dev: 4 },
  night:   { id: 'night',   icon: '🌙', name: 'Night',   speed: 1.0, dev: 4 },
  bumpers: { id: 'bumpers', icon: '🔴', name: 'Bumpers', speed: 1.0, dev: 4, bumpers: true },
};
const THEME_IDS = ['classic', 'snow', 'rain', 'night', 'bumpers'];

/* =====================================================================
   RNG  (mulberry32 — seed based, deterministic)
   ===================================================================== */
class RNG {
  constructor(seed) { this.reseed(seed); }
  reseed(seed) { this.s = (seed >>> 0) || 0x9E3779B9; }
  next() {
    let a = (this.s = (this.s + 0x6D2B79F5) | 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  weighted(list, wKey = 'w') {
    let tot = 0; for (const x of list) tot += x[wKey];
    let r = this.next() * tot;
    for (const x of list) { r -= x[wKey]; if (r < 0) return x; }
    return list[list.length - 1];
  }
}

/* =====================================================================
   MATH / VECTOR
   ===================================================================== */
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => clamp(v, 0, 1);
const easeOutCubic = (t) => 1 - Math.pow(1 - clamp01(t), 3);
const easeInOutCubic = (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeOutBack = (t, s = 1.70158) => { t = clamp01(t); const c3 = s + 1; return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
const easeOutElastic = (t) => { t = clamp01(t); if (t === 0 || t === 1) return t; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1; };
/* spring pop: grows past 1, settles back (used for "grow then shrink" text) */
const springPop = (t) => { t = Math.max(0, t); return 1 + Math.exp(-6 * t) * Math.sin(t * 18) * 0.35 - Math.exp(-14 * t) * 1; };

/* closest point on segment — result in _qx/_qy (avoids allocation in hot loop) */
let _qx = 0, _qy = 0;
function closestOnSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 > 1e-9 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  _qx = ax + dx * t; _qy = ay + dy * t;
  return t;
}
function hexToRgb(h) {
  h = String(h || '#ffffff').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(h, a) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }
function shade(h, k) { /* k<0 darker, k>0 lighter */
  const [r, g, b] = hexToRgb(h);
  const f = (c) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function luminance(h) { const [r, g, b] = hexToRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }

/* =====================================================================
   FAIR WEEKLY GROUPS (used by LEAGUE)
   Splits the clubs into groups so that pairs who have shared a group the fewest times are put together.
   cooc(a,b) = how many times a and b have already been in the same arena match.
   Seeded multi-start local search (swap moves); the cost of a pair grows with the square of its
   meeting count, so the season converges to every pair meeting (almost) equally often.
   ===================================================================== */
function groupSizes(n, groupSize) {
  const k = Math.max(1, Math.ceil(n / groupSize)), base = Math.floor(n / k), extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}
function planGroups(ids, sizes, cooc, rng, restarts = 60) {
  const n = ids.length;
  const W = [];
  for (let i = 0; i < n; i++) { W.push(new Float64Array(n)); }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const c = cooc(ids[i], ids[j]);
    W[i][j] = W[j][i] = (c + 1) * (c + 1) - c * c;          // marginal cost of meeting once more = 2c+1
  }
  let best = null, bestCost = Infinity;
  for (let r = 0; r < restarts; r++) {
    const perm = rng.shuffle([...Array(n).keys()]);
    const grp = new Int32Array(n);
    let p = 0; sizes.forEach((sz, gi) => { for (let k = 0; k < sz; k++) grp[perm[p++]] = gi; });
    const tie = (i, j) => ((i * 7919 + j * 104729 + r * 31) % 97) * 1e-6;  // deterministic tie-break
    let improved = true;
    while (improved) {
      improved = false;
      for (let a = 0; a < n && !improved; a++) for (let b = a + 1; b < n && !improved; b++) {
        if (grp[a] === grp[b]) continue;
        let d = 0;
        for (let x = 0; x < n; x++) {
          if (x === a || x === b) continue;
          if (grp[x] === grp[a]) d += W[b][x] - W[a][x];
          else if (grp[x] === grp[b]) d += W[a][x] - W[b][x];
        }
        if (d < -1e-9) { const t = grp[a]; grp[a] = grp[b]; grp[b] = t; improved = true; }
      }
    }
    let cost = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (grp[i] === grp[j]) cost += W[i][j] + tie(i, j);
    if (cost < bestCost) { bestCost = cost; best = Array.from(grp); }
  }
  const groups = sizes.map(() => []);
  best.forEach((gi, i) => groups[gi].push(ids[i]));
  return groups;
}
