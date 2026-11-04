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
  POST_R: 10, GOAL_FRAC: 0.50, ELIM_GOAL_GROW: 0.25, FINAL_GOAL_FRAC: 0.54, NET_DEPTH: 50, NET_DEPTH_RECT: 34,
  KEEPER_INSET: 28, KEEPER_LEN_FRAC: 0.30, KEEPER_THICK: 14, KEEPER_SPEED: 320, KEEPER_GAIN: 3, KEEPER_READ: 0.3,
  PLAYER_R: 24, PLAYER_SPEED: 260,
  ROT_SPEED_DEG: 0, ROT_GROWTH: 1.12,
  GOAL_GROW: false,   // false: goals never widen (no growth after eliminations or in overtime)
  OT_AT: 45, OT_RAMP: 10, OT_MULT: 1.6,
  ELIM_SLOW_GAME: 0.18, ELIM_FREEZE: 1.0, WIN_SLOW_GAME: 0.24, TS_SLOW: 0.3,
  FINAL_SLOWMO_GAME: 0.375, FINAL_SLOWMO_TS: 0.25, FINAL_SLOWMO_DIST: 120,
  FINAL_W: 820, FINAL_H: 1030, FINAL_GOALS: 2,   // final duel: first to FINAL_GOALS goals wins (narrower, longer pitch)
  FINAL_DY: 30,   // the longer final pitch sits this much below the arena centre so it clears the scoreboard
  /* final duel: 2 players per team, one is the captain. A captain touch that sends the ball toward the rival goal
     (within CAPTAIN_AIM_DEG of the goal centre) makes it CAPTAIN_SHOT_MULT × faster until it hits anything else. */
  CAPTAIN_SHOT_MULT: 2, CAPTAIN_AIM_DEG: 55,
  PU_R: 26, PU_LIFE: 8, PU_MIN: 6, PU_MAX: 10, PU_MAX_COUNT: 2, PU_WALL_MARGIN: 80,
  DEFAULT_LIVES: 1, DEFAULT_SPEED_MULT: 1.0,
  /* every match is a group match of exactly GROUP_SIZE clubs; the league size must be a multiple of it so all groups are equal */
  GROUP_SIZE: 6,
  POINTS: [4, 3, 2, 1, 0, 0, 0, 0, 0, 0], SEASON_LENGTH: 17,
  STORAGE_KEY: 'arenaLeague_v1',
  /* before the match: today's group matches (results / fixtures) → match. After it: one animated league table (held until the video ends) */
  INTRO_DURATION: 3.4,
  END_DURATION: 7.0,
  FORM_COUNT: 3,       // league table: each club's last N match places (1ST 2ND …), shown in the rightmost column
  RELEGATE_COUNT: 3,   // at the end of a season the last N teams leave the league and N clubs of the pool come in
  /* promotion playoff: after the group matches of the season the pool clubs play a single-leg knockout (see League.cupShape);
     champion, runner-up and the third-place winner go up. It needs exactly CUP_SIZE clubs in the pool and RELEGATE_COUNT 3;
     with any other pool the first RELEGATE_COUNT clubs of the pool queue come in instead. */
  CUP_SIZE: 12,
  HARD_TIME_LIMIT: 300,
  /* the public site's live league (07_live.js), a league that never stops. Istanbul time (UTC+3 all year).
     bands: from each `from` until the next band, one group match every `every` minutes (a day = 308 matches).
     The first match is at `start` + the first band's time. gap: seconds between a match that ran over and the next one.
     Changing start / bands / gap / salt starts a NEW live league: all browsers drop their saved state.
     Changing the simulation (results, scoring, balance) does NOT: the league is frozen as it stands and the new rules play on from there (tools/live-base.js). */
  LIVE: {
    start: '2026-11-04T00:36',   // 'YYYY-MM-DD' (that day at the first band's time) or 'YYYY-MM-DDTHH:MM'
    bands: [{ from: '05:00', every: 5 }, { from: '09:00', every: 10 }, { from: '19:00', every: 3 }],
    utcOffset: 3, gap: 10, salt: 'satisfying-lig-live-1', keepChampions: 50,
  },
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
/* the pool of clubs outside the league: after the group matches they play the promotion playoff and its top 3 take the
   place of the league's last RELEGATE_COUNT teams, who join the pool (the pool order only matters for the fallback queue) */
const RESERVE_TEAMS = [
  { name: 'Napoli',        code: 'NAP', c1: '#12A0D7', c2: '#FFFFFF' },
  { name: 'Roma',          code: 'ROM', c1: '#8E1F2F', c2: '#F0BC42' },
  { name: 'Atalanta',      code: 'ATA', c1: '#1E71B8', c2: '#111111' },
  { name: 'Tottenham',     code: 'TOT', c1: '#FFFFFF', c2: '#132257' },
  { name: 'Aston Villa',   code: 'AVL', c1: '#670E36', c2: '#95BFE5' },
  { name: 'Benfica',       code: 'BEN', c1: '#E30613', c2: '#FFFFFF' },
  { name: 'Porto',         code: 'POR', c1: '#003893', c2: '#FFFFFF' },
  { name: 'Ajax',          code: 'AJX', c1: '#D2122E', c2: '#FFFFFF' },
  { name: 'Sevilla',       code: 'SEV', c1: '#FFFFFF', c2: '#D40000' },
  { name: 'Marseille',     code: 'MAR', c1: '#2FAEE0', c2: '#FFFFFF' },
  { name: 'Sporting CP',   code: 'SCP', c1: '#00804A', c2: '#FFFFFF' },
  { name: 'Trabzonspor',   code: 'TRB', c1: '#7B1E3A', c2: '#00A3E0' },
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
};
/* no obstacles on the pitch: the old 'bumpers' theme is gone (a saved 'bumpers' choice falls back to Classic) */
const THEME_IDS = ['classic', 'snow', 'rain', 'night'];

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
const easeInOutCubic = (t) => { t = clamp01(t); if (t < 0.5) return 4 * t * t * t; const u = 2 - 2 * t; return 1 - u * u * u / 2; };   // no Math.pow: used by the simulation (see DM)
const easeOutBack = (t, s = 1.70158) => { t = clamp01(t); const c3 = s + 1; return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
const easeOutElastic = (t) => { t = clamp01(t); if (t === 0 || t === 1) return t; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1; };
/* spring pop: grows past 1, settles back (used for "grow then shrink" text) */
const springPop = (t) => { t = Math.max(0, t); return 1 + Math.exp(-6 * t) * Math.sin(t * 18) * 0.35 - Math.exp(-14 * t) * 1; };

/* =====================================================================
   DM — deterministic math for the simulation. The live league (07_live.js) lets every visitor's browser compute the
   same matches from the same seeds, so the physics must give bit-identical results in Chrome, Safari and Firefox.
   Math.sin / cos / atan2 / hypot / exp / pow are NOT guaranteed to be identical across engines (only + − × ÷ and
   Math.sqrt are exactly specified by IEEE 754), so the simulation uses these versions built from those operations
   (fdlibm kernels; accuracy ~1e-16, checked by tools/live-check.js).
   ===================================================================== */
const DM = (() => {
  const INV_PIO2 = 6.36619772367581382433e-01, P1 = 1.57079632673412561417e+00, P2 = 6.07710050650619224932e-11, P3 = 2.02226624879595063154e-21;
  const S1 = -1.66666666666666324348e-01, S2 = 8.33333333332248946124e-03, S3 = -1.98412698298579493134e-04,
    S4 = 2.75573137070700676789e-06, S5 = -2.50507602534068634195e-08, S6 = 1.58969099521155010221e-10;
  const C1 = 4.16666666666666019037e-02, C2 = -1.38888888888741095749e-03, C3 = 2.48015872894767294178e-05,
    C4 = -2.75573143513906633035e-07, C5 = 2.08757232129817482790e-09, C6 = -1.13596475577881948265e-11;
  const ksin = (x) => { const z = x * x; return x + x * z * (S1 + z * (S2 + z * (S3 + z * (S4 + z * (S5 + z * S6))))); };
  const kcos = (x) => { const z = x * x; return 1 - 0.5 * z + z * z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6))))); };
  /* x = n·π/2 + r, |r| ≤ π/4 (Cody–Waite, 3-part π/2; plenty for the angles of a match) */
  const reduce = (x) => { const n = Math.round(x * INV_PIO2); return [n & 3, ((x - n * P1) - n * P2) - n * P3]; };
  function sin(x) { const [q, r] = reduce(x); return q === 0 ? ksin(r) : q === 1 ? kcos(r) : q === 2 ? -ksin(r) : -kcos(r); }
  function cos(x) { const [q, r] = reduce(x); return q === 0 ? kcos(r) : q === 1 ? -ksin(r) : q === 2 ? -kcos(r) : ksin(r); }
  const ATH = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
  const ATL = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
  const AT = [3.33333333333329318027e-01, -1.99999999998764832476e-01, 1.42857142725034663711e-01, -1.11111104054623557880e-01,
    9.09088713343650656196e-02, -7.69187620504482999495e-02, 6.66107313738753120669e-02, -5.83357013379057348645e-02,
    4.97687799461593236017e-02, -3.65315727442169155270e-02, 1.62858201153657823623e-02];
  function atan(x) {
    const neg = x < 0; let ax = neg ? -x : x, id = -1;
    if (ax !== ax) return x;
    if (ax > 1e17) return neg ? -ATH[3] : ATH[3];
    if (ax >= 0.4375) {
      if (ax < 1.1875) { if (ax < 0.6875) { id = 0; ax = (2 * ax - 1) / (2 + ax); } else { id = 1; ax = (ax - 1) / (ax + 1); } }
      else if (ax < 2.4375) { id = 2; ax = (ax - 1.5) / (1 + 1.5 * ax); }
      else { id = 3; ax = -1 / ax; }
    }
    const z = ax * ax, w = z * z;
    const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
    const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
    const r = id < 0 ? ax - ax * (s1 + s2) : ATH[id] - ((ax * (s1 + s2) - ATL[id]) - ax);
    return neg ? -r : r;
  }
  const PI = 3.14159265358979311600e+00, PIO2 = 1.57079632679489655800e+00;
  function atan2(y, x) {
    if (x === 0) return y > 0 ? PIO2 : y < 0 ? -PIO2 : 0;
    const a = atan(y / x);
    if (x > 0) return a;
    return y >= 0 ? a + PI : a - PI;
  }
  const hypot = (x, y) => Math.sqrt(x * x + y * y);
  const LN2H = 6.93147180369123816490e-01, LN2L = 1.90821492927058770002e-10, INV_LN2 = 1.44269504088896338700e+00;
  function exp(x) {
    if (x !== x) return x;
    if (x > 709) return Infinity;
    if (x < -745) return 0;
    const k = Math.round(x * INV_LN2), r = (x - k * LN2H) - k * LN2L;
    let term = 1, sum = 1;                         // Taylor series: |r| ≤ ln2/2, 20 terms ≫ double precision
    for (let i = 1; i <= 20; i++) { term = term * r / i; sum += term; }
    let p = 1, b = k < 0 ? 0.5 : 2;                 // 2^k by exact multiplications of powers of two
    for (let e = k < 0 ? -k : k; e > 0; e >>= 1) { if (e & 1) p *= b; b *= b; }
    return sum * p;
  }
  return { sin, cos, atan, atan2, hypot, exp };
})();

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
   SEASON FIXTURE (used by LEAGUE)
   The whole season's group plan is built once, when the season starts, and is not changed until it ends.
   Every week the clubs are split into equal groups of `size` (the league size is a multiple of it), so every
   club plays exactly once a week and the same number of matches in the season.
   Goal: every pair of clubs shares a group as equally often as possible. Cost = Σ (meetings of a pair)²;
   with a fixed total number of meetings this is lowest when the meetings are spread evenly.
   Seeded: a greedy week-by-week start, then simulated annealing with swaps inside a week
   (two clubs from different groups of the same week trade places, so every week stays a valid split).
   fixed: weeks already decided (e.g. played before a migration) — kept as they are and only counted.
   ===================================================================== */
function planSeason(ids, weeks, size, rng, fixed = []) {
  if (!ids.length || ids.length % size !== 0) throw new Error(`Takım sayısı (${ids.length}) ${size}'nın katı olmalı.`);
  /* several independent seeded runs (4, or up to 10 while pairs still differ by more than 2 meetings);
     keep the one whose pair meetings are spread the narrowest */
  let best = null, bestKey = Infinity;
  for (let r = 0; r < 10 && (r < 4 || bestKey >= 3e9); r++) {
    const plan = planSeasonRun(ids, weeks, size, rng, fixed), st = fixtureMeetings(ids, fixed.concat(plan));
    const key = (st.max - st.min) * 1e9 + st.sq;
    if (key < bestKey) { bestKey = key; best = plan; }
  }
  return best;
}
function planSeasonRun(ids, weeks, size, rng, fixed) {
  const n = ids.length, K = n / size;
  const C = new Int32Array(n * n), idx = new Map(ids.map((id, i) => [id, i]));
  const meet = (members, d) => {
    for (let x = 0; x < members.length; x++) for (let y = x + 1; y < members.length; y++) {
      const a = members[x], b = members[y]; C[a * n + b] += d; C[b * n + a] += d;
    }
  };
  for (const wk of fixed) for (const grp of wk) meet(grp.map(id => idx.get(id)).filter(i => i !== undefined), 1);
  const free = Math.max(0, weeks - fixed.length);
  const W = [];                                   // W[w][club] = group index of the club in free week w
  const members = (g, gi) => { const m = []; for (let i = 0; i < n; i++) if (g[i] === gi) m.push(i); return m; };
  /* cost change if clubs a (group A) and b (group B) trade places in a week with assignment g */
  const delta = (g, a, b) => {
    const A = g[a], B = g[b];
    let d = 0;
    for (let x = 0; x < n; x++) {
      if (x === a || x === b) continue;
      if (g[x] === A) d += 2 * (C[b * n + x] - C[a * n + x]) + 2;        // (c+1)² - c² and (c-1)² - c²
      else if (g[x] === B) d += 2 * (C[a * n + x] - C[b * n + x]) + 2;
    }
    return d;
  };
  const swap = (g, a, b) => {
    const A = g[a], B = g[b];
    for (let x = 0; x < n; x++) {
      if (x === a || x === b) continue;
      if (g[x] === A) { C[a * n + x]--; C[x * n + a]--; C[b * n + x]++; C[x * n + b]++; }
      else if (g[x] === B) { C[b * n + x]--; C[x * n + b]--; C[a * n + x]++; C[x * n + a]++; }
    }
    g[a] = B; g[b] = A;
  };
  /* greedy start: each week a random split, improved by swaps against the meetings so far */
  for (let w = 0; w < free; w++) {
    const perm = rng.shuffle([...Array(n).keys()]), g = new Int32Array(n);
    perm.forEach((club, p) => { g[club] = Math.floor(p / size); });
    for (let gi = 0; gi < K; gi++) meet(members(g, gi), 1);
    let improved = true;
    while (improved) {
      improved = false;
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
        if (g[a] !== g[b] && delta(g, a, b) < 0) { swap(g, a, b); improved = true; }
      }
    }
    W.push(g);
  }
  /* annealing over the whole season (cooling from T0 to T1), then a last greedy pass */
  if (free > 0 && K > 1) {
    const iters = 25000 * free, T0 = 2, LN_T1_T0 = -2.99573227355399099344;   // T1 = 0.1, ln(T1 / T0) = ln 0.05
    for (let it = 0; it < iters; it++) {
      const g = W[Math.floor(rng.next() * free)];
      const a = Math.floor(rng.next() * n), b = Math.floor(rng.next() * n);
      if (g[a] === g[b]) continue;
      const d = delta(g, a, b), T = T0 * DM.exp(LN_T1_T0 * it / iters);   // = T0·(T1/T0)^(it/iters), deterministic (see DM)
      if (d <= 0 || rng.next() < DM.exp(-d / T)) swap(g, a, b);
    }
    for (const g of W) for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (g[a] !== g[b] && delta(g, a, b) < 0) swap(g, a, b);
  }
  return W.map(g => Array.from({ length: K }, (_, gi) => members(g, gi).map(i => ids[i])));
}
/* how many times each pair has shared a group in a list of weeks (stats for the panel and tests) */
function fixtureMeetings(ids, weekList) {
  const M = new Map(), key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  for (const wk of weekList) for (const grp of wk) for (let i = 0; i < grp.length; i++) for (let j = i + 1; j < grp.length; j++) {
    const k = key(grp[i], grp[j]); M.set(k, (M.get(k) || 0) + 1);
  }
  let min = Infinity, max = 0, sq = 0;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const c = M.get(key(ids[i], ids[j])) || 0; if (c < min) min = c; if (c > max) max = c; sq += c * c;
  }
  return { min: isFinite(min) ? min : 0, max, sq };
}
