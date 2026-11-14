/* =====================================================================
   LEAGUE  (persistent table in localStorage, JSON import/export)
   ===================================================================== */
/* promotion playoff: the 12 pool clubs are drawn into slots s0..s11 when the season's league matches are over; s0–s3 get a
   bye. Single leg, played in this order (one match at a time). 'w<key>' / 'l<key>' = winner / loser of that match.
   Champion, runner-up and the third-place match's winner go up. */
const CUP_SHAPE = [
  { k: 'R1-1', r: 0, a: 's4', b: 's5' }, { k: 'R1-2', r: 0, a: 's6', b: 's7' }, { k: 'R1-3', r: 0, a: 's8', b: 's9' }, { k: 'R1-4', r: 0, a: 's10', b: 's11' },
  { k: 'QF-1', r: 1, a: 's0', b: 'wR1-1' }, { k: 'QF-2', r: 1, a: 's1', b: 'wR1-2' }, { k: 'QF-3', r: 1, a: 's2', b: 'wR1-3' }, { k: 'QF-4', r: 1, a: 's3', b: 'wR1-4' },
  { k: 'SF-1', r: 2, a: 'wQF-1', b: 'wQF-2' }, { k: 'SF-2', r: 2, a: 'wQF-3', b: 'wQF-4' },
  { k: '3RD', r: 3, a: 'lSF-1', b: 'lSF-2' }, { k: 'FIN', r: 3, a: 'wSF-1', b: 'wSF-2' },
];
/* the live league's promotion (07_live.js): the pool clubs play their own league (the promotion league, alongside the league,
   see Live.promoNew). Its top PO_DIRECT clubs go up directly; the next four (3rd–6th) play this single-leg knockout in the
   season's last slots for the last place: 3rd v 6th, 4th v 5th (the better placed club at home), then the final, whose winner
   goes up. The draw is the table's top PO_SIZE (s0, s1: the clubs that went up directly). Round numbers are CUP_SHAPE's
   (2 = semi-finals, 3 = final), so the names and the screens are the same. */
const PO_DIRECT = 2, PO_SIZE = 6;
const PO_SHAPE = [
  { k: 'SF-1', r: 2, a: 's2', b: 's5' }, { k: 'SF-2', r: 2, a: 's3', b: 's4' }, { k: 'FIN', r: 3, a: 'wSF-1', b: 'wSF-2' },
];
/* the promotion league's first format (a season begun with it ends with it, and the archive keeps such seasons): no direct
   places, the top 4 play 1st v 4th, 2nd v 3rd, the third-place match and the final; champion, runner-up and third go up */
const PO_OLD_SIZE = 4;
const PO_OLD = [
  { k: 'SF-1', r: 2, a: 's0', b: 's3' }, { k: 'SF-2', r: 2, a: 's1', b: 's2' },
  { k: '3RD', r: 3, a: 'lSF-1', b: 'lSF-2' }, { k: 'FIN', r: 3, a: 'wSF-1', b: 'wSF-2' },
];
/* the bracket a draw belongs to: 6 clubs = the promotion league's (2 direct + 4 in the playoff), up to 4 = its first format,
   else the old 12-club playoff */
const cupShape = (c) => { const n = c && Array.isArray(c.draw) ? c.draw.length : 0; return n === PO_SIZE ? PO_SHAPE : n <= PO_OLD_SIZE ? PO_OLD : CUP_SHAPE; };
/* the clubs of a draw that went up without playing (the promotion league's top PO_DIRECT) */
const cupDirect = (c) => (cupShape(c) === PO_SHAPE ? c.draw.slice(0, PO_DIRECT) : []);
const CUP_ROUNDS = ['FIRST ROUND', 'QUARTER-FINALS', 'SEMI-FINALS', 'FINAL'];
const CUP_ROUNDS_TR = ['1. tur', 'Çeyrek final', 'Yarı final', 'Final'];
/* a match's name: [video (English), panel (Turkish)] */
const cupName = (k) => {
  if (k === 'FIN') return ['FINAL', 'Final'];
  if (k === '3RD') return ['THIRD PLACE', '3.lük maçı'];
  const n = k.slice(-1);
  return k[0] === 'R' ? ['FIRST ROUND ' + n, '1. tur ' + n + '. maç'] : k[0] === 'Q' ? ['QUARTER-FINAL ' + n, 'Çeyrek final ' + n] : ['SEMI-FINAL ' + n, 'Yarı final ' + n];
};

/* ---- the league's data format (League.data; the studio's export file and the live league's saved states use the same).
   Changing it: add a migration to League.normalize so older saves still open. ---- */
/** @typedef {{ id: string, name: string, code: string, c1: string, c2: string }} Club  a club: 3-letter code, two colours (#rrggbb) */
/** @typedef {{ played: number, pts: number, w: number, d: number, l: number, gf: number, ga: number }} TableRow */
/** @typedef {{ id: string, code: string, score: number, saves: number }} SideResult */
/**
 * @typedef {Object} HistoryEntry  a played league match of the running season
 * @property {number} matchNo
 * @property {number} week
 * @property {number} weekMatch
 * @property {'match'} mode
 * @property {number} seed      the match's seed: seed + clubs + theme replay it exactly (same rules)
 * @property {string} theme
 * @property {string} date      kick-off (ISO)
 * @property {string[]} teams   [home, away] club ids
 * @property {string|null} winner
 * @property {number} duration
 * @property {SideResult[]} result  [home, away]
 */
/** @typedef {{ winner: string, loser: string, sw: number, sl: number, seed: number, theme: string, duration: number, date: string, pw?: number, pl?: number, gg?: number }} CupResult  sw / sl: goals of the winner / loser; pw / pl: penalties; gg: golden goal */
/** @typedef {{ season: number, draw: string[], res: Object<string, CupResult> }} CupState  the promotion playoff: the draw (pool club ids) and the results by match key (CUP_SHAPE) */
/** @typedef {{ season: number, key: string, size: number, created: string, weeks: string[][][] }} SeasonPlan  weeks[w][m] = [home, away] */
/**
 * @typedef {Object} PromoState  the live league's promotion league of the season: the pool clubs' own league, played alongside the
 * league (one promotion match in most of the league's slots, see Live.promoNew), then its top 2 go up and 3rd–6th play the playoff (League.cup)
 * @property {number} season
 * @property {number} per       matches a week (pool clubs / 2)
 * @property {number} N         the league's matches this season = the season's slots
 * @property {number} po        playoff matches (PO_SHAPE, in the season's last po slots; 0 = the top clubs go up without a playoff)
 * @property {number} [direct]  clubs that go up directly, the next four play the playoff (absent: the first format, PO_OLD)
 * @property {number} n         promotion league matches (plan.length × per)
 * @property {string[][][]} plan  plan[w][m] = [home, away] (a double round robin, or as much of it as fits)
 * @property {Object<string, TableRow>} table
 * @property {HistoryEntry[]} history
 * @property {string[]} tieOrder
 */
/**
 * @typedef {Object} LeagueData
 * @property {number} version
 * @property {number} teamsVersion
 * @property {Club[]} teams          the clubs in the league
 * @property {Club[]} reserve        the pool (promotion playoff clubs)
 * @property {Object<string, TableRow>} table   by club id
 * @property {number} week
 * @property {number} weekMatch
 * @property {number} matchNo
 * @property {number} season
 * @property {number} seasonLength
 * @property {number[]} points       [win, draw, loss]
 * @property {SeasonPlan|null} seasonPlan
 * @property {string[]|null} tieOrder
 * @property {CupState|null} cup     the promotion playoff (the old 12-club one, or the promotion league's: see cupShape)
 * @property {PromoState|null} [promo]  live league: this season's promotion league (null: a season of the old format)
 * @property {HistoryEntry[]} history
 * @property {{ id: string, name: string, season: number, pts: number }[]} champions
 * @property {Object<string, any>} settings
 * @property {number} [liveCount]       live league: matches played
 * @property {number} [liveSeasonStart]
 * @property {number} [liveLastEnd]     live league: when the last match ended (ms)
 * @property {Object[]} [seasons]       live league: the finished seasons' archive (Geçmiş)
 * @property {any} [weekPlan]          a field of older saves (deleted on load)
 */
const League = {
  /** @type {LeagueData} */
  data: null, storageOK: true,
  fresh() {
    return {
      version: 1, teamsVersion: 3,
      teams: DEFAULT_TEAMS.map((t, i) => ({ id: 't' + (i + 1), name: t.name, code: t.code, c1: t.c1, c2: t.c2 })),
      reserve: RESERVE_TEAMS.map((t, i) => ({ id: 't' + (DEFAULT_TEAMS.length + i + 1), name: t.name, code: t.code, c1: t.c1, c2: t.c2 })),
      table: {}, week: 1, weekMatch: 1, matchNo: 1, season: 1, seasonLength: CONFIG.SEASON_LENGTH,
      points: CONFIG.POINTS.slice(), seasonPlan: null, tieOrder: null, cup: null, promo: null,
      history: [], champions: [], settings: {},
    };
  },
  defaultSettings() {
    return { theme: 'auto', speedMult: CONFIG.DEFAULT_SPEED_MULT,
      simSpeed: 1, volume: 0.8, muted: false, testMatch: false, sv: 2 };
  },
  normalize(d) {
    const f = this.fresh();
    if (!d || typeof d !== 'object' || !Array.isArray(d.teams) || d.teams.length < 2) { f.settings = this.defaultSettings(); return f; }
    const out = Object.assign(f, d);
    const used = new Set();
    const clean = (arr) => arr.filter(t => t && t.name).map((t, i) => {
      let id = String(t.id || ('t' + (i + 1)));
      while (used.has(id)) id += '_';
      used.add(id);
      return { id, name: String(t.name).slice(0, 40), code: upTR(t.code || t.name).replace(CODE_STRIP, '').slice(0, 3).padEnd(3, 'X'),
        c1: validColor(t.c1, '#888888'), c2: validColor(t.c2, '#ffffff') };
    });
    out.teams = clean(d.teams);
    /* reserve queue (clubs that can join after a season); older leagues get the default queue minus the clubs already in */
    if (Array.isArray(d.reserve)) out.reserve = clean(d.reserve);
    else {
      const have = new Set(out.teams.map(t => t.name));
      out.reserve = clean(RESERVE_TEAMS.filter(t => !have.has(t.name)).map((t, i) => ({ ...t, id: 't' + (DEFAULT_TEAMS.length + i + 1) })));
    }
    out.table = (d.table && typeof d.table === 'object') ? d.table : {};
    for (const id of Object.keys(out.table)) {
      const r = out.table[id] || {};
      out.table[id] = { played: +r.played || 0, pts: +r.pts || 0, w: +(r.w !== undefined ? r.w : r.wins) || 0, d: +r.d || 0, l: +r.l || 0, gf: +r.gf || 0, ga: +r.ga || 0 };
    }
    out.week = Math.max(1, +d.week || 1); out.weekMatch = Math.max(1, +d.weekMatch || 1); out.matchNo = Math.max(1, +d.matchNo || 1);
    delete out.day;
    delete out.derbyWinPoints;               // the derby mode was removed: every match is a 1v1 league match
    out.season = Math.max(1, +d.season || 1);
    out.seasonPlan = this.validPlanShape(d.seasonPlan) ? d.seasonPlan : null;
    out.tieOrder = Array.isArray(d.tieOrder) ? d.tieOrder.map(String) : null;
    out.cup = d.cup && typeof d.cup === 'object' && Array.isArray(d.cup.draw) && d.cup.res && typeof d.cup.res === 'object'
      ? { season: Math.max(1, +d.cup.season || 1), draw: d.cup.draw.map(String), res: d.cup.res } : null;
    const p = d.promo;
    out.promo = p && typeof p === 'object' && Array.isArray(p.plan) && Array.isArray(p.history) && Array.isArray(p.tieOrder) && p.table && typeof p.table === 'object' ? p : null;
    out.seasonLength = Math.max(1, +d.seasonLength || CONFIG.SEASON_LENGTH);
    /* win / draw / loss points (older leagues scored finishing places: they get the default) */
    out.points = Array.isArray(d.points) && d.points.length === 3 ? d.points.map(x => +x || 0) : CONFIG.POINTS.slice();
    out.teamsVersion = 3;
    out.history = Array.isArray(d.history) ? d.history : [];
    out.champions = Array.isArray(d.champions) ? d.champions : [];
    out.settings = Object.assign(this.defaultSettings(), d.settings || {});
    delete out.settings.seed;                 // the seed is chosen per match and never stored ahead of it
    /* removed options: match mode (derby / season final), manual team pick, team count per match (always 2), and the old
       6-team arena's lives and power-ups */
    for (const k of ['mode', 'selMode', 'manual', 'teamCount', 'lives', 'powerups']) delete out.settings[k];
    out.settings.sv = 2;
    if (out.settings.theme !== 'auto' && !THEME_DEFS[out.settings.theme]) out.settings.theme = 'auto';   // removed themes (bumpers)
    return out;
  },
  load() {
    let d = null;
    try {
      const s = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (s) d = JSON.parse(s);
      localStorage.setItem('__arena_probe', '1'); localStorage.removeItem('__arena_probe');
    } catch (e) { this.storageOK = false; }
    this.data = this.normalize(d);
    /* teams v3 = top European clubs + Turkey's big three: a saved league built on older default teams starts a fresh season */
    if (d && d.teamsVersion !== 3) {
      const f = this.fresh();
      Object.assign(this.data, { teams: f.teams, reserve: f.reserve, table: {}, week: 1, weekMatch: 1, matchNo: 1, history: [], champions: [], teamsVersion: 3, seasonPlan: null });
      delete this.data.weekPlan;
      this.migrated = true;
    }
  },
  save() {
    if (Live.on) return;                       // the live league is never stored as the studio league (07_live.js keeps its own cache)
    try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.data)); this.storageOK = true; }
    catch (e) { this.storageOK = false; }
    UI.storageWarn(!this.storageOK);
  },
  /* a match's result for a club: 'W' / 'D' / 'L' (null if it did not play in it) */
  resultOf(h, id) {
    const r = Array.isArray(h.result) ? h.result : [], me = r.find(x => x.id === id), op = r.find(x => x.id !== id);
    if (!me || !op) return null;
    return me.score > op.score ? 'W' : me.score < op.score ? 'L' : 'D';
  },
  /* a club's results in its last n matches of this season (oldest first, newest last), e.g. ['W', 'D', 'L'] */
  formOf(id, history = this.data.history, n = CONFIG.FORM_COUNT) {
    const out = [];
    for (let i = history.length - 1; i >= 0 && out.length < n; i--) {
      const r = this.resultOf(history[i], id);
      if (r) out.unshift(r);
    }
    return out;
  },
  rowOf(table, id) { return table[id] || { played: 0, pts: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }; },
  /* the season's tie-break draw: a random order of the clubs, drawn once when the season starts and stored with the league
     (so it is the same on every screen and in the repo files). It only decides a tie that nothing else separates. */
  tieOrderFor() {
    const d = this.data, ids = d.teams.map(t => t.id);
    const have = Array.isArray(d.tieOrder) ? d.tieOrder.filter(id => ids.includes(id)) : [];
    if (Array.isArray(d.tieOrder) && d.tieOrder.length === ids.length && have.length === ids.length && new Set(have).size === ids.length) return d.tieOrder;
    const rng = new RNG(pickSeed('tie', d.season || 1));
    d.tieOrder = have.concat(rng.shuffle(ids.filter(id => !have.includes(id))));
    return d.tieOrder;
  },
  /* table order: points → goal difference → goals scored → head to head (points, then goal difference, in the matches between
     the tied clubs this season) → the season's draw */
  ranking(table = this.data.table, history = this.data.history) { return this.rankOf(this.data.teams, table, history, this.tieOrderFor()); },
  /* the promotion league's table (the pool clubs; live league only — without a promotion league: an empty table in the pool's order) */
  promoRanking(table, history) {
    const d = this.data, p = this.promoOn() ? d.promo : null;
    return this.rankOf(d.reserve, table || (p ? p.table : {}), history || (p ? p.history : []), p ? p.tieOrder : d.reserve.map(t => t.id));
  },
  rankOf(teams, table, history, draw) {
    const pos = (id) => draw.indexOf(id);
    const list = teams.map(t => ({ t, r: this.rowOf(table, t.id) }));
    const key = (x) => `${x.r.pts}|${x.r.gf - x.r.ga}|${x.r.gf}`;
    const groups = new Map();
    for (const x of list) { const k = key(x); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); }
    const h2h = new Map();                        // id → [points, goal difference] against the clubs it is tied with
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      const ids = new Set(g.map(x => x.t.id));
      for (const id of ids) h2h.set(id, [0, 0]);
      for (const h of history) {
        const r = Array.isArray(h.result) ? h.result : [];
        if (r.length !== 2 || !ids.has(r[0].id) || !ids.has(r[1].id)) continue;
        for (const [me, op] of [[r[0], r[1]], [r[1], r[0]]]) {
          const v = h2h.get(me.id), pts = this.data.points;
          v[0] += me.score > op.score ? pts[0] : me.score === op.score ? pts[1] : pts[2];
          v[1] += me.score - op.score;
        }
      }
    }
    return list.sort((a, b) => {
      if (b.r.pts !== a.r.pts) return b.r.pts - a.r.pts;
      const gd = (b.r.gf - b.r.ga) - (a.r.gf - a.r.ga);
      if (gd) return gd;
      if (b.r.gf !== a.r.gf) return b.r.gf - a.r.gf;
      const ha = h2h.get(a.t.id) || [0, 0], hb = h2h.get(b.t.id) || [0, 0];
      return hb[0] - ha[0] || hb[1] - ha[1] || pos(a.t.id) - pos(b.t.id);
    });
  },
  /* league points of one club in a finished match (res = Game.getResult()) */
  pointsFor(res, tm) {
    const op = res.teams.find(x => x.id !== tm.id), p = this.data.points;
    if (!op) return 0;
    return tm.score > op.score ? p[0] : tm.score === op.score ? p[1] : p[2];
  },
  /* every week every club plays one 1v1 match, so the league needs an even number of clubs */
  validTeamCount(n) { return n >= 2 && n % 2 === 0; },
  /* the season has begun once a match was played or a week/match was passed: from then on the fixture,
     the team list and the season length are fixed until the season ends */
  seasonStarted() { const d = this.data; return d.history.length > 0 || d.week > 1 || d.weekMatch > 1; },
  validPlanShape(p) {
    return !!(p && typeof p === 'object' && Array.isArray(p.weeks) && p.weeks.every(w => Array.isArray(w) && w.every(g => Array.isArray(g) && g.length === 2)));
  },
  /* ---------- promotion: the old 12-club playoff (CUP_SHAPE) or the live league's promotion league + its playoff (PO_SHAPE / PO_OLD) ---------- */
  /* this season has a promotion league (live league; a season begun under the old format finishes without one) */
  promoOn() { const d = this.data, p = d.promo; return !!(p && p.season === (d.season || 1)); },
  /* this season's promotion league: the clubs that go up directly (0: none — no playoff, or the first format) and the clubs in
     the playoff's draw (the direct ones included) */
  poDirect() { const p = this.data.promo; return this.promoOn() && p.po ? (p.direct || 0) : 0; },
  poSize() { return this.poDirect() ? PO_SIZE : PO_OLD_SIZE; },
  poShape() { return this.poDirect() ? PO_SHAPE : PO_OLD; },
  /* the promotion league's matches are all played */
  promoLeagueOver() { const p = this.data.promo; return this.promoOn() && p.history.length >= p.n; },
  /* the promotion league and its playoff are over: who goes up is settled */
  promoOver() { return this.promoLeagueOver() && (!this.cupOn() || this.cupDone()); },
  /* promotion matches played this season (league + playoff), in playing order */
  promoDone() { const p = this.data.promo, c = this.cup(); return this.promoOn() ? p.history.length + (c ? Object.keys(c.res).length : 0) : 0; },
  /* the season slot (0 = the season's first) of promotion match i: the league matches spread evenly over the slots before the
     playoff, the playoff in the season's last po slots — so both leagues end with the same slot */
  promoSlot(i) {
    const p = this.data.promo, S = p.N - p.po;
    return i < p.n ? Math.floor(i * S / p.n) : S + (i - p.n);
  },
  /* the promotion match planned for season slot j (its index), or -1 */
  promoIndexAt(j) {
    const p = this.data.promo, S = p.N - p.po;
    if (!this.promoOn() || j < 0) return -1;
    if (j >= S) return j - S < p.po ? p.n + (j - S) : -1;
    const i = Math.floor((j * p.n + S - 1) / S);                // the smallest i with i·S/n ≥ j (integers: exact)
    return i < p.n && Math.floor(i * S / p.n) === j ? i : -1;
  },
  /* a playoff is played: the old one only with a full pool (CONFIG.CUP_SIZE clubs) and 3 promotion places (otherwise the old pool
     queue is used); the promotion league's one when its season has playoff slots */
  cupOn() {
    const d = this.data;
    if (this.promoOn()) return d.promo.po > 0;
    return d.reserve.length === CONFIG.CUP_SIZE && CONFIG.RELEGATE_COUNT === 3 && d.teams.length >= 5;
  },
  /* all league matches of the season are played */
  mainOver() { const d = this.data; return d.week > d.seasonLength; },
  /* the old format: the league matches are over and the playoff is on (or about to start) — played after them, one match per slot */
  cupPhase() { return !this.promoOn() && this.cupOn() && this.mainOver() && !this.cupDone(); },
  /* the season is over (champion, relegation and promotion can be settled): the league matches, and the playoff (old format) or the
     promotion league with its playoff, are all finished */
  seasonOver() { return this.mainOver() && (this.promoOn() ? this.promoOver() : (!this.cupOn() || this.cupDone())); },
  /* this season's bracket: its draw and the results so far. The old playoff: a random order of the pool, drawn from the season's
     seed when the league matches are over; the promotion league's: its top poSize() in table order, when its matches are over.
     build: draw it now if it is due and not drawn yet. Null before that. */
  cup(build) {
    const d = this.data, season = d.season || 1;
    if (!this.cupOn()) return null;
    const ids = d.reserve.map(t => t.id), c = d.cup, po = this.promoOn();
    if (c && c.season === season && c.draw.length === (po ? this.poSize() : ids.length) && c.draw.every(id => ids.includes(id))) return c;
    if (!build || !(po ? this.promoLeagueOver() : this.mainOver())) return null;
    d.cup = { season, draw: po ? this.promoRanking().slice(0, this.poSize()).map(x => x.t.id) : new RNG(pickSeed('cupdraw', season)).shuffle(ids), res: {} };
    this.save();
    return d.cup;
  },
  cupDone() { const c = this.cup(); return !!(c && cupShape(c).every(m => c.res[m.k])); },
  poolTeam(id) { return this.data.reserve.find(t => t.id === id) || null; },
  /* the playoff matches in playing order with their clubs (ids; null = not decided yet) and result */
  cupMatches() { return this.cupMatchesOf(this.cup()); },
  /* ...of any bracket { draw, res } (also a finished season's, see Live.archiveSeason). def: the match's CUP_SHAPE / PO_SHAPE entry */
  cupMatchesOf(c) {
    if (!c) return [];
    const ref = (s) => {
      if (s[0] === 's') return c.draw[+s.slice(1)] || null;
      const r = c.res[s.slice(1)];
      return r ? (s[0] === 'w' ? r.winner : r.loser) : null;
    };
    return cupShape(c).map((m, i) => ({ k: m.k, r: m.r, i, def: m, a: ref(m.a), b: ref(m.b), res: c.res[m.k] || null }));
  },
  cupNext() { return this.cupMatches().find(m => !m.res) || null; },
  /* champion, runner-up, third place — the clubs that go up (null until the playoff is over) */
  cupTop3() {
    const c = this.cup();
    if (!this.cupDone()) return null;
    const dir = cupDirect(c);                               // the promotion league's top 2, then the playoff's winner
    return (dir.length ? dir.concat(c.res['FIN'].winner) : [c.res['FIN'].winner, c.res['FIN'].loser, c.res['3RD'].winner]).map(id => this.poolTeam(id)).filter(Boolean);
  },
  /* a finished playoff match into the bracket (same entry as a league match: League.record) */
  recordCup(s, res, winnerId) {
    const c = this.cup();
    if (!c || !s.cup) return false;
    const W = res.teams.find(t => t.id === winnerId), L = res.teams.find(t => t.id !== winnerId);
    c.res[s.cup] = { winner: W.id, loser: L.id, sw: W.score, sl: L.score, seed: s.seed, theme: res.theme, duration: res.duration,
      date: s.date || new Date().toISOString() };
    if (res.pens) { c.res[s.cup].pw = W.pen; c.res[s.cup].pl = L.pen; }       // decided on penalties
    else if (res.golden) c.res[s.cup].gg = 1;                                    // decided by a golden goal
    this.save();
    return false;
  },
  /* end of season: the table leader is the champion; the last RELEGATE_COUNT teams go out and the playoff's top 3 come in
     (promotion league without a playoff: its top clubs; old pool without a playoff: the first clubs of the pool queue).
     pending: the playoff (or the promotion league) is not over, nobody moves yet. */
  seasonChange() {
    const d = this.data, rk = this.ranking();
    const k = Math.max(0, Math.min(CONFIG.RELEGATE_COUNT, d.reserve.length, rk.length - 2));
    const pending = (this.promoOn() && !this.promoLeagueOver()) || (this.cupOn() && !this.cupDone());
    const inn = pending ? [] : this.cupOn() ? this.cupTop3().slice(0, k) : this.promoOn() ? this.promoRanking().slice(0, k).map(x => x.t) : d.reserve.slice(0, k);
    return { champion: rk[0].t, pts: rk[0].r.pts, out: rk.slice(rk.length - k).map(x => x.t), in: inn, pending };
  },
  /* archive the finished season (returned, for the season file) and start the next one with the new team list */
  endSeason() {
    const d = this.data, ch = this.seasonChange(), season = d.season || 1;
    const out = ch.pending ? [] : ch.out;                   // an unfinished playoff moves nobody
    const brief = (t) => ({ id: t.id, name: t.name, code: t.code });
    const cup = this.cup(), p = this.promoOn() ? d.promo : null;
    const archive = { season, endedAt: new Date().toISOString(),
      champion: { id: ch.champion.id, name: ch.champion.name, season, pts: ch.pts },
      relegated: out.map(brief), promoted: ch.in.map(brief),
      table: this.ranking().map((x, i) => ({ rank: i + 1, id: x.t.id, name: x.t.name, code: x.t.code, ...x.r })),
      points: d.points.slice(),
      history: d.history, cup: cup ? JSON.parse(JSON.stringify(cup)) : null,
      promo: p ? { table: this.promoRanking().map((x, i) => ({ rank: i + 1, id: x.t.id, name: x.t.name, code: x.t.code, ...x.r })), history: p.history } : null };
    d.champions.push(Object.assign({}, archive.champion));
    d.teams = d.teams.filter(t => !out.some(o => o.id === t.id)).concat(ch.in);
    d.reserve = d.reserve.filter(t => !ch.in.some(i => i.id === t.id)).concat(out);
    d.cup = null; d.promo = null;                     // the live league sets up the next season's promotion league (Live.applyRules)
    d.season = season + 1;
    d.table = {}; d.week = 1; d.weekMatch = 1; d.history = []; d.seasonPlan = null;   // next season gets a new fixture
    d.tieOrder = null; this.tieOrderFor();                                           // ...and a new tie-break draw
    delete d.weekPlan;
    this.save();
    return archive;
  },
  /* write a finished match into the league: table, history, next match / week. Returns true when a new week began.
     Used by the browser (App.onOver) and by the live league's catch-up (07_live.js), so both give the same league.
     s.div 'promo': a promotion league match (its own table and history); s.cup: a playoff match (the bracket). */
  record(s, res, winnerId) {
    if (s.cup) return this.recordCup(s, res, winnerId);       // a playoff match: into the bracket, not the table
    if (s.div === 'promo') return this.recordPromo(s, res, winnerId);
    const d = this.data;
    this.applyTo(d.table, res);
    /* teams / result: [home, away] */
    d.history.push(this.entry(s, res, winnerId));
    d.matchNo++;
    d.weekMatch++;
    let newWeek = false;
    if (d.weekMatch > s.perWeek) { d.week++; d.weekMatch = 1; newWeek = true; }
    this.save();
    return newWeek;
  },
  recordPromo(s, res, winnerId) {
    const p = this.data.promo;
    if (!this.promoOn()) return false;
    this.applyTo(p.table, res, this.data.reserve);
    p.history.push(this.entry(s, res, winnerId));
    return false;
  },
  /** @returns {HistoryEntry} */
  entry(s, res, winnerId) {
    return { matchNo: s.matchNo, week: s.week, weekMatch: s.weekMatch, mode: 'match', seed: s.seed, theme: res.theme, date: s.date || new Date().toISOString(),
      teams: res.teams.map(t => t.id), winner: winnerId, duration: res.duration,
      result: res.teams.map(t => ({ id: t.id, code: t.code, score: t.score, saves: t.saves })) };
  },
  applyTo(table, res, teams = this.data.teams) {
    for (const tm of res.teams) {
      if (!teams.some(t => t.id === tm.id)) continue;
      const op = res.teams.find(x => x.id !== tm.id);
      if (!op) continue;
      const r = table[tm.id] || (table[tm.id] = { played: 0, pts: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 });
      r.played++; r.gf += tm.score; r.ga += op.score; r.pts += this.pointsFor(res, tm);
      if (tm.score > op.score) r.w++; else if (tm.score === op.score) r.d++; else r.l++;
    }
  },
};
/* panel: last-results badges (empty slots as dashes), e.g. G B M */
const FORM_TR = { W: 'G', D: 'B', L: 'M' };
function formHtml(form) {
  const pad = Array(Math.max(0, CONFIG.FORM_COUNT - form.length)).fill('<i class="fp fe">–</i>');
  /* results (W / D / L → G / B / M); a finished season of the old group-match league keeps its places (1st 2nd …) */
  return pad.concat(form.map(p => typeof p === 'string' ? `<i class="fp f${p}">${FORM_TR[p] || p}</i>` : `<i class="fp f${Math.min(p, 5)}">${ordinal(p).toLowerCase()}</i>`)).join('');
}
function validColor(c, def) { return /^#[0-9a-fA-F]{6}$/.test(String(c || '')) ? String(c).toUpperCase() : def; }
/* every match gets its own random 32-bit seed (never shown, never stored ahead of the match; played matches keep theirs in the history) */
function randomSeed() {
  return randomSeedRaw();
}
/* live league (07_live.js): every seed is derived from the season / week / match, so every browser plays the same matches */
function pickSeed(...parts) { return Live.on ? Live.seed(parts) : randomSeed(); }
function randomSeedRaw() {
  try { const a = new Uint32Array(1); crypto.getRandomValues(a); if (a[0]) return a[0]; } catch (e) { /* no crypto: fall back below */ }
  return 1 + Math.floor(Math.random() * 4294967295);
}
function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

/* =====================================================================
   RECORDER  (MediaRecorder: canvas stream + synthesized audio)
   ===================================================================== */
const Recorder = {
  rec: null, chunks: [], active: false, t0: 0, filename: '', mime: '', discard: false,
  supported() { return !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream); },
  pickMime() {
    for (const m of ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm'])
      if (MediaRecorder.isTypeSupported(m)) return m;
    return '';
  },
  start(base) {
    const vs = Renderer.canvas.captureStream(60);
    const tracks = [...vs.getVideoTracks()];
    if (AudioSys.recDest) tracks.push(...AudioSys.recDest.stream.getAudioTracks());
    const stream = new MediaStream(tracks);
    this.mime = this.pickMime();
    const opts = { videoBitsPerSecond: 12000000, audioBitsPerSecond: 192000 };
    if (this.mime) opts.mimeType = this.mime;
    this.rec = new MediaRecorder(stream, opts);
    this.chunks = []; this.discard = false;
    this.rec.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.rec.onstop = () => this.finish();
    this.filename = base + (this.mime.startsWith('video/mp4') ? '.mp4' : '.webm');
    this.rec.start(250);
    this.active = true; this.t0 = performance.now();
    UI.recState(true);
  },
  stop(discard) {
    if (!this.active) return;
    this.active = false; this.discard = !!discard;
    try { this.rec.stop(); } catch (e) { /* already stopped */ }
    UI.recState(false);
  },
  finish() {
    if (!this.discard && this.chunks.length) {
      downloadBlob(new Blob(this.chunks, { type: (this.mime || 'video/webm').split(';')[0] }), this.filename);
      UI.toast(`🎬 Video indirildi: ${this.filename}`);
    } else if (this.discard) UI.toast('Kayıt iptal edildi.');
    this.chunks = [];
  },
};

/* =====================================================================
   UI PANEL  (Turkish control panel)
   ===================================================================== */
/** a panel element by id (typed loosely: inputs, selects, buttons, canvas…) @type {(id: string) => any} */
const $ = (id) => document.getElementById(id);
const UI = {
  init() {
    const s = League.data.settings;
    $('theme').value = s.theme;
    $('speedMult').value = s.speedMult; $('simSpeed').value = String(s.simSpeed);
    $('volume').value = s.volume; $('testMatch').checked = s.testMatch;
    $('pointsInput').value = League.data.points.join(','); $('seasonLen').value = League.data.seasonLength;
    AudioSys.vol = s.volume; AudioSys.muted = s.muted;
    const read = () => {
      s.theme = $('theme').value;
      s.speedMult = clamp(+$('speedMult').value || 1, 0.7, 1.5);
      s.simSpeed = +$('simSpeed').value || 1;
      s.testMatch = $('testMatch').checked;
      League.save(); this.refresh();
      if (!App.running || App.end) App.prepare();
    };
    ['theme', 'speedMult', 'testMatch'].forEach(id => $(id).addEventListener('change', read));
    $('speedMult').addEventListener('input', () => { $('speedVal').textContent = '×' + (+$('speedMult').value).toFixed(2); });
    $('simSpeed').addEventListener('change', () => { s.simSpeed = +$('simSpeed').value || 1; League.save(); });
    $('volume').addEventListener('input', () => { s.volume = +$('volume').value; AudioSys.vol = s.volume; AudioSys.apply(); });
    $('volume').addEventListener('change', () => League.save());
    $('btnMute').addEventListener('click', () => { s.muted = !s.muted; AudioSys.muted = s.muted; AudioSys.apply(); League.save(); this.refresh(); });
    $('btnStart').addEventListener('click', () => App.start(false));
    $('btnRecord').addEventListener('click', () => App.start(true));
    $('btnPause').addEventListener('click', () => App.togglePause());
    $('btnReset').addEventListener('click', () => App.reset());
    $('btnNewDay').addEventListener('click', () => {
      const d = League.data;
      if (d.week > d.seasonLength) { alert(League.cupPhase() ? 'Lig maçları bitti. Önce yükselme eleme maçlarını oynayın.' : 'Sezon tamamlandı. Önce yeni sezonu başlatın.'); return; }
      /* skipping a week leaves its unplayed matches unplayed for good: warn and ask first */
      const left = App.unplayedThisWeek();
      if (left.length) {
        const code = (id) => (d.teams.find(t => t.id === id) || {}).code || '?';
        const list = left.map(x => `  • ${x.no}. maç: ${x.ids.map(code).join(' – ')}`).join('\n');
        if (!confirm(`⚠️ Hafta ${d.week} içinde oynanmamış ${left.length} maç var:\n${list}\n\n` +
          `Yeni haftaya geçilirse bu maçlar hiç oynanmayacak; bu ${left.length * 2} takım sezonu diğerlerinden eksik maçla bitirecek (adil olmaz).\n\nYine de sonraki haftaya (Hafta ${d.week + 1}) geçilsin mi?`)) return;
      }
      d.week++; d.weekMatch = 1; League.save(); this.refresh(); if (!App.running || App.end) App.prepare();
      this.toast(d.week > d.seasonLength ? '🏁 Sezonun son haftası geçildi.' : `📅 Hafta ${d.week} başladı.`);
    });
    $('btnExport').addEventListener('click', () => {
      downloadBlob(new Blob([JSON.stringify(League.data, null, 2)], { type: 'application/json' }), `arena_league_week${League.data.week}.json`);
    });
    $('btnImport').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', (ev) => {
      const f = /** @type {HTMLInputElement} */ (ev.target).files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const d = JSON.parse(String(rd.result));
          if (!d || !Array.isArray(d.teams) || d.teams.length < 2) throw new Error('Geçersiz dosya: takım listesi yok.');
          if (!League.validTeamCount(d.teams.length))
            throw new Error(`Takım sayısı (${d.teams.length}) çift olmalı; her hafta her takım bir maç oynar.`);
          League.data = League.normalize(d); League.save(); this.init2(); App.prepare();
          this.toast('✅ Lig verisi içe aktarıldı.');
        } catch (e) { alert('İçe aktarma başarısız: ' + e.message); }
        $('importFile').value = '';
      };
      rd.readAsText(f);
    });
    $('btnResetLeague').addEventListener('click', () => {
      if (!confirm('Lig tablosu, gün sayacı, maç numarası ve geçmiş silinecek (takımlar korunur). Emin misiniz?')) return;
      const d = League.data; d.table = {}; d.week = 1; d.weekMatch = 1; d.matchNo = 1; d.history = []; d.champions = []; d.seasonPlan = null; d.tieOrder = null; d.cup = null; delete d.weekPlan;
      League.save(); this.refresh(); App.prepare(); this.toast('Lig sıfırlandı.');
    });
    $('btnTeams').addEventListener('click', () => TeamEditor.open());
    $('pointsInput').addEventListener('change', () => {
      const arr = $('pointsInput').value.split(/[,\s;]+/).filter(Boolean).map(x => Math.max(0, Math.round(+x) || 0)).slice(0, 3);
      while (arr.length < 3) arr.push(0);
      League.data.points = arr; $('pointsInput').value = arr.join(','); League.save();
    });
    $('seasonLen').addEventListener('change', () => {
      const d = League.data;
      /* the season fixture is fixed once the season has begun */
      if (League.seasonStarted()) { $('seasonLen').value = d.seasonLength; alert('Sezon başladı: sezon uzunluğu ancak yeni sezonda değiştirilebilir.'); return; }
      d.seasonLength = Math.max(1, Math.round(+$('seasonLen').value) || CONFIG.SEASON_LENGTH);
      d.seasonPlan = null; League.save(); this.refresh(); if (!App.running || App.end) App.prepare();
    });
    $('btnCopy').addEventListener('click', async () => {
      const t = $('caption').value; if (!t) return;
      try { await navigator.clipboard.writeText(t); } catch (e) { $('caption').select(); document.execCommand('copy'); }
      this.toast('📋 Kopyalandı');
    });
    $('btnBalance').addEventListener('click', () => Balance.run());
    this.refresh();
  },
  init2() { this.init_values(); this.refresh(); },
  init_values() {
    const s = League.data.settings;
    $('theme').value = s.theme; $('speedMult').value = s.speedMult;
    $('testMatch').checked = s.testMatch;
    $('pointsInput').value = League.data.points.join(','); $('seasonLen').value = League.data.seasonLength;
  },
  refresh() {
    const d = League.data, s = d.settings;
    $('speedVal').textContent = '×' + (+s.speedMult).toFixed(2);
    $('btnMute').textContent = s.muted ? '🔇' : '🔊';
    const code = (id) => esc((d.teams.find(t => t.id === id) || {}).code || '?');
    const plan = App.seasonPlan(), started = League.seasonStarted();
    $('seasonLen').disabled = started;
    $('seasonLen').title = started ? 'Sezon başladı: yeni sezonda değiştirilebilir' : '';
    let info = `<div class="kv"><span>Sezon</span><b>${d.season || 1}</b></div><div class="kv"><span>Hafta</span><b>${Math.min(d.week, d.seasonLength)} / ${d.seasonLength}</b></div>`;
    if (!plan) {
      info += `<div class="warn">⚠️ Takım sayısı (${d.teams.length}) tek. Her hafta her takım bir maç oynasın diye maç oynatılamaz — <b>Takımları düzenle</b> ile takım sayısını çift yapın.</div>`;
      $('fixture').innerHTML = '';
    } else {
      info += `<div class="kv"><span>Sıradaki maç</span><b>${d.week > d.seasonLength ? '—' : `${d.weekMatch} / ${App.perWeek()}`}</b></div><div class="kv"><span>Oynanan maç (bu sezon)</span><b>${d.history.length}</b></div>`
        + `<div class="hint">${d.teams.length} takım, her maç iki takım arasında (${CONFIG.MATCH_TIME} sn) → haftada ${App.perWeek()} maç; her takım her hafta tam 1 maç oynar. Haftanın son maçı kaydedilince hafta kendiliğinden ilerler.</div>`;
      const wk = plan.weeks[d.week - 1];
      if (wk) info += `<div class="hint" style="margin-top:10px"><b>Hafta ${d.week} maçları</b> (ilk yazılan ev sahibi, üst kale)</div>` + wk.map((g, i) =>
        `<div class="kv"><span>${i + 1}. maç${i + 1 < d.weekMatch ? ' ✓' : i + 1 === d.weekMatch ? ' ▶' : ''}</span><b style="font-weight:600">${g.map(code).join(' – ')}</b></div>`).join('');
      const st = fixtureStats(d.teams.map(t => t.id), plan.weeks.slice(0, d.seasonLength));
      $('fixture').innerHTML = `<details><summary>📋 Sezon ${d.season || 1} fikstürü (${d.seasonLength} hafta)</summary>`
        + `<div class="hint">Sezon başında bir kez oluşturuldu ve sezon bitene kadar değişmez. Her takım ikilisi sezonda ${st.min === st.max ? `<b>${st.min}</b>` : `<b>${st.min}–${st.max}</b>`} kez karşılaşır; her takım <b>${st.homeMin}–${st.homeMax}</b> maçta ev sahibi.</div>`
        + `<div class="fixture">${plan.weeks.slice(0, d.seasonLength).map((w, i) => `<div class="wk${i + 1 === d.week ? ' cur' : ''}"><b>H${i + 1}</b> · ${w.map(g => g.map(code).join('–')).join(' &nbsp;|&nbsp; ')}</div>`).join('')}</div></details>`;
    }
    $('leagueInfo').innerHTML = info;
    const note = $('seasonNote');
    if (d.week >= d.seasonLength) {
      note.classList.remove('hidden');
      if (d.week > d.seasonLength) {
        const c = League.seasonChange(), nm = (a) => a.map(t => esc(t.name)).join(', ') || '—';
        if (c.pending) {
          const ms = League.cupMatches(), next = ms.find(m => !m.res), nmId = (id) => esc((League.poolTeam(id) || {}).name || '?');
          note.innerHTML = `🏁 <b>Lig maçları bitti!</b> Şampiyon: <b>🏆 ${esc(c.champion.name)}</b> (${c.pts} puan).<br>Ligden çıkacaklar: ${nm(c.out)}<br>`
            + `⚔️ <b>Yükselme eleme maçları</b> (havuzdaki ${CONFIG.CUP_SIZE} takım, tek maç): ${ms.filter(m => m.res).length} / ${CUP_SHAPE.length} oynandı`
            + (next && next.a && next.b ? ` · sıradaki: <b>${cupName(next.k)[1]}</b> — ${nmId(next.a)} · ${nmId(next.b)}` : ' · kura Başlat\'a basınca çekilir')
            + `.<br><span class="hint">Final galibi, finalist ve 3.lük maçı galibi ligi yükselir; eleme bitince yeni sezon başlatılabilir.</span>`;
        } else {
          note.innerHTML = `🏁 <b>Sezon tamamlandı!</b> Şampiyon: <b>🏆 ${esc(c.champion.name)}</b> (${c.pts} puan).<br>Ligden çıkacaklar: ${nm(c.out)}<br>Gelecekler: ${nm(c.in)}<br><button id="btnEndSeason" style="margin-top:8px">Yeni sezonu başlat</button>`;
          $('btnEndSeason').addEventListener('click', () => {
            if (!confirm('Şampiyon kaydedilecek, son takımlar çıkıp yükselenler gelecek ve yeni sezon 1. haftadan başlayacak. Emin misiniz?')) return;
            League.endSeason(); this.init2(); App.prepare(); this.toast('🏆 Yeni sezon başladı.');
          });
        }
      } else note.innerHTML = `🏁 Sezonun son haftası. Haftanın maçlarından sonra tablonun lideri şampiyon olur; son ${CONFIG.RELEGATE_COUNT} takım ligden çıkar${League.cupOn() ? `; yerlerine havuzdaki ${CONFIG.CUP_SIZE} takımın eleme maçlarında ilk 3'e girenler gelir` : ''}.`;
    } else note.classList.add('hidden');
    const rk = League.ranking();
    $('leagueTable').innerHTML = `<table><thead><tr><th>#</th><th>Takım</th><th title="Oynanan">O</th><th title="Galibiyet">G</th><th title="Beraberlik">B</th><th title="Mağlubiyet">M</th><th title="Atılan gol">AG</th><th title="Yenilen gol">YG</th><th title="Averaj">AV</th><th title="Puan">P</th><th title="Son ${CONFIG.FORM_COUNT} maç (eskiden yeniye)">Son ${CONFIG.FORM_COUNT}</th></tr></thead><tbody>` +
      rk.map((x, i) => { const av = x.r.gf - x.r.ga; return `<tr><td>${i + 1}</td><td class="tn"><span class="dot" style="background:${x.t.c1};border-color:${x.t.c2}"></span>${esc(x.t.name)}</td><td>${x.r.played}</td><td>${x.r.w}</td><td>${x.r.d}</td><td>${x.r.l}</td><td>${x.r.gf}</td><td>${x.r.ga}</td><td>${av > 0 ? '+' : ''}${av}</td><td><b>${x.r.pts}</b></td><td class="form">${formHtml(League.formOf(x.t.id))}</td></tr>`; }).join('') +
      `</tbody></table>` + (d.champions.length ? `<div class="hint">🏆 Şampiyonlar: ${d.champions.map(c => `${esc(c.name)} (sezon ${c.season || '?'})`).join(', ')}</div>` : '');
    this.status();
  },
  status() {
    const el = $('status');
    if (!el) return;
    if (Recorder.active) el.textContent = 'Kayıt alınıyor…';
    else if (App.end) el.textContent = 'Maç bitti.';
    else if (App.running) el.textContent = App.paused ? 'Duraklatıldı' : 'Maç oynanıyor…';
    else el.textContent = 'Hazır — Başlat\'a basın.';
    $('btnPause').textContent = App.paused ? '▶ Devam' : '⏸ Duraklat';
  },
  storageWarn(on) { $('storageWarn').classList.toggle('hidden', !on); },
  recState(on) {
    $('recBadge').classList.toggle('hidden', !on);
    ['btnStart', 'btnRecord', 'btnBalance', 'simSpeed'].forEach(id => { $(id).disabled = on; });
    this.status();
  },
  tick() {
    if (Recorder.active) {
      const s = Math.floor((performance.now() - Recorder.t0) / 1000);
      $('recTime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
  },
  toast(msg) {
    if (Live.on) return;                       // the live site has no panel messages
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2600);
  },
};
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

const TeamEditor = {
  rows: [],
  open() {
    this.rows = League.data.teams.map(t => ({ ...t }));
    this.render(); $('teamModal').classList.remove('hidden');
    $('teAdd').onclick = () => { this.collect(); this.rows.push({ id: 'n' + Date.now().toString(36), name: 'New Team', code: 'NEW', c1: '#888888', c2: '#FFFFFF' }); this.render(); };
    $('teCancel').onclick = () => $('teamModal').classList.add('hidden');
    $('teSave').onclick = () => this.save();
  },
  render() {
    $('teBody').innerHTML = this.rows.map((t, i) => `<tr data-i="${i}">
      <td><input class="te-name" value="${esc(t.name)}" maxlength="40"></td>
      <td><input class="te-code" value="${esc(t.code)}" maxlength="3"></td>
      <td><input type="color" class="te-c1" value="${esc(t.c1.toLowerCase())}"></td>
      <td><input type="color" class="te-c2" value="${esc(t.c2.toLowerCase())}"></td>
      <td><button class="te-del" data-i="${i}" title="Sil">🗑</button></td></tr>`).join('');
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.te-del')).forEach(b => b.onclick = () => { this.collect(); this.rows.splice(+b.dataset.i, 1); this.render(); });
  },
  collect() {
    const val = (tr, cls) => /** @type {HTMLInputElement} */ (tr.querySelector(cls)).value;
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#teBody tr')).forEach(tr => {
      const r = this.rows[+tr.dataset.i];
      r.name = val(tr, '.te-name').trim() || r.name;
      r.code = upTR(val(tr, '.te-code')).replace(CODE_STRIP, '').slice(0, 3);
      r.c1 = validColor(val(tr, '.te-c1'), r.c1); r.c2 = validColor(val(tr, '.te-c2'), r.c2);
    });
  },
  save() {
    this.collect();
    if (League.seasonStarted()) { alert('Sezon başladı: takımlar ancak yeni sezon başında (hiç maç oynanmadan) değiştirilebilir; fikstür sezon bitene kadar sabit.'); return; }
    if (!League.validTeamCount(this.rows.length)) {
      alert(`Takım sayısı çift olmalı (2, 4, 6 … 18 …); şu an ${this.rows.length}. Her hafta her takım bir maç oynar.`);
      return;
    }
    const codes = new Set();
    for (const r of this.rows) {
      if (r.code.length !== 3) { alert(`"${r.name}" için kod tam 3 harf/rakam olmalı.`); return; }
      if (codes.has(r.code)) { alert(`Kod tekrar ediyor: ${r.code}`); return; }
      codes.add(r.code);
    }
    const d = League.data;
    d.teams = this.rows.map(r => ({ ...r }));
    const ids = new Set(d.teams.map(t => t.id));
    for (const id of Object.keys(d.table)) if (!ids.has(id)) delete d.table[id];
    d.seasonPlan = null;                       // new team list → new fixture (allowed only before the season begins)
    League.save(); UI.refresh(); App.prepare();
    $('teamModal').classList.add('hidden'); UI.toast('✅ Takımlar kaydedildi.');
  },
};

/* =====================================================================
   APP  (match setup, lifecycle, results, caption)
   ===================================================================== */
const App = {
  game: null, setup: null, running: false, paused: false, end: null, endT: 0, matchRealT: 0, title: '', intro: null, introT: 0,
  introOn() { return !!(this.running && this.intro && this.introT < CONFIG.INTRO_DURATION); },
  simSpeed() { return League.data.settings.simSpeed || 1; },
  /* matches per week: every club plays once a week (18 clubs → 9 matches) */
  perWeek() { return Math.max(1, Math.floor(League.data.teams.length / 2)); },
  /* the season fixture: a round robin (see planRoundRobin), built once when the season starts and stored with the league;
     it is never rebuilt while the season is running (team list and season length are locked then) */
  seasonPlan() {
    const d = League.data, ids = d.teams.map(t => t.id), key = ids.slice().sort().join(',');
    const p = d.seasonPlan, season = d.season || 1;
    if (p && p.season === season && p.key === key && p.size === 2 && p.weeks.length >= d.seasonLength) return p;
    if (!League.validTeamCount(ids.length)) return null;
    const rng = new RNG(pickSeed('plan', season));
    d.seasonPlan = { season, key, size: 2, created: new Date().toISOString(), weeks: planRoundRobin(ids, d.seasonLength, rng) };
    delete d.weekPlan;
    League.save();
    return d.seasonPlan;
  },
  /* the matches of the current week that have not been played yet */
  unplayedThisWeek() {
    const d = League.data, plan = this.seasonPlan();
    if (!plan || d.week > d.seasonLength) return [];
    const wk = plan.weeks[d.week - 1] || [];
    return wk.map((ids, i) => ({ no: i + 1, ids })).filter(x => x.no >= d.weekMatch);
  },
  /* the next promotion playoff match once the league matches are over (the bracket is drawn here, on first need), else null */
  cupMatch() {
    if (!League.cupPhase()) return null;
    League.cup(true);
    return League.cupNext();
  },
  /* a 1v1 match's options for the Game: CONFIG.MATCH_TIME seconds; a playoff match cannot end level (golden goal, penalties) */
  matchOpts(teams, seed, theme, knockout) {
    const s = League.data.settings;
    return { mode: 'match', teams: teams.map(t => ({ ...t })), seed, theme, speedMult: s.speedMult,
      matchTime: CONFIG.MATCH_TIME, knockout: !!knockout };
  },
  /* a playoff match: two pool clubs, the first one drawn is the home club (top goal). div 'promo': the promotion league's playoff
     (live league, played on the promotion channel alongside the league) */
  buildCupSetup(m, div) {
    const d = League.data, s = d.settings;
    const seed = pickSeed('cupmatch', d.season || 1, m.k);
    const srng = new RNG((seed ^ 0x5BD1E995) >>> 0);
    const teams = [m.a, m.b].map(id => League.poolTeam(id)).filter(Boolean);
    const err = teams.length === 2 ? null : 'Bu eleme maçı için takımlar bulunamadı.';
    let theme = s.theme;
    if (theme === 'auto') theme = srng.pick(THEME_IDS);
    else if (!THEME_DEFS[theme]) theme = 'classic';
    return { err, title: `PLAYOFF · ${cupName(m.k)[0]}`, mode: 'match', div: div || 'main', cup: m.k, round: m.r, week: d.week, weekMatch: d.weekMatch, perWeek: this.perWeek(),
      matchNo: d.matchNo, seed, theme, test: Live.on ? false : s.testMatch,
      date: Live.on ? new Date(Live.nextStart()).toISOString() : null,
      opts: this.matchOpts(teams, seed, theme, true) };
  },
  /* a club for the screens */
  tObj(t) { return t ? { id: t.id, name: t.name, code: t.code, c1: t.c1, c2: t.c2 } : null; },
  /* the round of a playoff match as match rows (the intro before it, the end screen after it).
     played: the result of the match just played when it is not in the bracket (test match) */
  cupBoard(round, key, played) {
    const tm = (id) => this.tObj(League.poolTeam(id));
    const matches = League.cupMatches().filter(m => m.r === round).map(m => {
      const res = m.res || (played && played.k === m.k ? played : null), label = cupName(m.k)[0];
      const a = tm(m.a), b = tm(m.b);
      if (res && a && b) {
        const aw = res.winner === m.a, sc = (w) => (w ? res.sw : res.sl), pn = (w) => (res.pw !== undefined ? (w ? res.pw : res.pl) : null);
        return { label, status: 'done', hi: m.k === key, a, b, sa: sc(aw), sb: sc(!aw), pa: pn(aw), pb: pn(!aw), win: aw ? 'a' : 'b', gg: !!res.gg };
      }
      return { label, status: m.k === key ? 'now' : 'later', a, b };
    });
    return { heading: 'PLAYOFFS', sub: `SEASON ${League.data.season || 1} · ${CUP_ROUNDS[round]} · ${League.poDirect() ? 'THE WINNER GOES UP' : 'TOP 3 GO UP'}`, later: 'COMING UP', matches };
  },
  /* a division's clubs, table, results and fixture: 'main' (the league) or 'promo' (the live league's promotion league) */
  div(key) {
    const d = League.data;
    if (key === 'promo') {
      const p = League.promoOn() ? d.promo : null;
      return { key, teams: d.reserve, table: p ? p.table : {}, history: p ? p.history : [], weeks: p ? p.plan : [], per: p ? p.per : Math.max(1, d.reserve.length >> 1),
        rank: (t, h) => League.promoRanking(t, h), tableTitle: 'PROMOTION LEAGUE', po: p && p.po ? League.poSize() : 0, up: League.poDirect(), prefix: 'PROMO · ' };
    }
    const plan = this.seasonPlan();
    return { key: 'main', teams: d.teams, table: d.table, history: d.history, weeks: plan ? plan.weeks : [], per: this.perWeek(),
      rank: (t, h) => League.ranking(t, h), tableTitle: 'LEAGUE TABLE', po: 0, up: 0, prefix: '' };
  },
  /* live league: the promotion match of the slot about to be played (the promotion channel), or null if it has none.
     The next unplayed promotion match is played once its planned slot (League.promoSlot) has come. */
  buildPromoSetup() {
    if (!League.promoOn()) return null;
    const d = League.data, p = d.promo, j = Live.count() - (d.liveSeasonStart || 0), i = League.promoDone();
    if (i >= p.n + p.po || League.promoSlot(i) > j) return null;
    if (i >= p.n) {                                                   // the promotion league is over: its playoff
      League.cup(true);
      const m = League.cupNext();
      return m ? this.buildCupSetup(m, 'promo') : null;
    }
    const week = Math.floor(i / p.per) + 1, wm = i % p.per + 1, s = d.settings;
    const seed = pickSeed('pmatch', d.season || 1, week, wm), srng = new RNG((seed ^ 0x5BD1E995) >>> 0);
    const teams = ((p.plan[week - 1] || [])[wm - 1] || []).map(id => League.poolTeam(id)).filter(Boolean);
    let theme = s.theme;
    if (theme === 'auto') theme = srng.pick(THEME_IDS);
    else if (!THEME_DEFS[theme]) theme = 'classic';
    return { err: teams.length === 2 ? null : 'Bu yükselme ligi maçı için fikstürde takım bulunamadı.', title: `PROMO · WEEK ${week} · MATCH ${wm}`, mode: 'match', div: 'promo',
      week, weekMatch: wm, perWeek: p.per, matchNo: i + 1, seed, theme, test: false, date: new Date(Live.nextStart()).toISOString(),
      opts: this.matchOpts(teams, seed, theme, false) };
  },
  buildSetup() {
    const cm = this.cupMatch();
    if (cm) return this.buildCupSetup(cm);
    /* live league: once the league's matches are over the season's last slots belong to the promotion channel alone */
    if (Live.on && League.promoOn() && League.mainOver()) return null;
    const d = League.data, s = d.settings;
    const seed = pickSeed('match', d.season || 1, d.week, d.weekMatch);   // a fresh hidden seed for every match setup (live league: derived from the fixture)
    const srng = new RNG((seed ^ 0x5BD1E995) >>> 0);
    /* every match is the next match of the season fixture: [home, away] */
    let teams = [], err = null;
    const plan = this.seasonPlan();
    if (!plan) err = `Takım sayısı (${d.teams.length}) çift olmalı — Takımları düzenle ile düzeltin.`;
    else if (d.week > d.seasonLength) err = 'Sezon tamamlandı — panelden yeni sezonu başlatın.';
    else {
      const ids = (plan.weeks[d.week - 1] || [])[d.weekMatch - 1] || [];
      teams = ids.map(id => d.teams.find(t => t.id === id)).filter(Boolean);
      if (teams.length !== 2) err = 'Bu maç için fikstürde takım bulunamadı.';
    }
    let theme = s.theme;
    if (theme === 'auto') theme = srng.pick(THEME_IDS);
    else if (!THEME_DEFS[theme]) theme = 'classic';
    const title = `WEEK ${d.week} · MATCH ${d.weekMatch}`;
    return { err, title, mode: 'match', div: 'main', week: d.week, weekMatch: d.weekMatch, perWeek: this.perWeek(), matchNo: d.matchNo, seed, theme, test: Live.on ? false : s.testMatch,
      date: Live.on ? new Date(Live.nextStart()).toISOString() : null,
      opts: this.matchOpts(teams, seed, theme, false) };
  },
  /* what the video shows before the match: the week's matches (played ones with their scores, the one about to start, the rest) */
  buildIntro() {
    const s = this.setup, d = League.data, D = this.div(s.div);
    if (s.cup) return Object.assign({ title: s.title }, this.cupBoard(s.round, s.cup));
    const tm = (id) => this.tObj(D.teams.find(t => t.id === id));
    const matches = [], week = D.weeks[s.week - 1] || [];
    for (let j = 1; j <= s.perWeek; j++) {
      const label = `MATCH ${j}`;
      if (j < s.weekMatch) {
        const h = D.history.slice().reverse().find(x => x.week === s.week && x.weekMatch === j);
        if (h && h.result.length === 2) {
          const [ra, rb] = h.result, a = tm(ra.id), b = tm(rb.id);
          if (a && b) matches.push({ label, status: 'done', a, b, sa: ra.score, sb: rb.score, win: ra.score > rb.score ? 'a' : ra.score < rb.score ? 'b' : '' });
        }
      } else if (j === s.weekMatch) matches.push({ label, status: 'now', a: this.tObj(s.opts.teams[0]), b: this.tObj(s.opts.teams[1]) });
      else { const ids = week[j - 1] || []; matches.push({ label, status: 'later', a: tm(ids[0]), b: tm(ids[1]) }); }
    }
    return { title: s.title, heading: `${D.prefix}WEEK ${s.week} MATCHES`, sub: `SEASON ${d.season || 1}${s.div === 'promo' ? ' · PROMOTION LEAGUE' : ''}`, later: 'COMING UP', matches };
  },
  prepare() {
    if (Recorder.active) return false;
    return this.load(this.buildSetup());
  },
  /* get a match setup ready to play: its game, the screens before it (the live league loads the match a viewer picks) */
  load(setup) {
    this.setup = setup;
    this.title = setup.title;
    this.end = null; this.endT = 0; this.running = false; this.paused = false; this.matchRealT = 0; acc = 0;
    this.intro = null; this.introT = 0;
    if (setup.err) { this.game = null; UI.toast('⚠️ ' + setup.err); UI.status(); return false; }
    this.game = new Game(setup.opts);
    this.game.onEvent = (t, dd) => FX.onEvent(t, dd);
    FX.reset(this.game); Renderer.resetTrails();
    this.intro = this.buildIntro();
    UI.status();
    return true;
  },
  start(record) {
    if (Recorder.active || Balance.busy) return;
    AudioSys.init(); AudioSys.resume();
    if (!this.prepare()) return;
    if (record) {
      if (!Recorder.supported()) { alert('Bu tarayıcı MediaRecorder/captureStream desteklemiyor. Güncel Chrome kullanın.'); return; }
      const s = this.setup;
      Recorder.start(s.cup ? `match_playoff_${s.cup}` : `match_week${s.week}_match${s.weekMatch}`);
    }
    this.running = true;
    lastNow = performance.now();
    UI.status();
  },
  togglePause() {
    if (!this.game || !this.running || this.end) return;
    this.paused = !this.paused;
    if (this.paused) { if (AudioSys.ctx) AudioSys.ctx.suspend(); } else { AudioSys.resume(); }
    UI.status();
  },
  reset() {
    if (Recorder.active) Recorder.stop(true);
    AudioSys.resume();
    this.prepare();
  },
  /* a playoff match is over: the bracket records it; the end screen shows the round's results (after the final: who goes up and down) */
  onOverCup() {
    const g = this.game, s = this.setup, d = League.data;
    const res = g.getResult(), W = g.teams[g.winner], L = g.teams[1 - g.winner];
    const played = { k: s.cup, winner: W.id, loser: L.id, sw: W.score, sl: L.score, gg: res.golden && !res.pens };
    if (res.pens) { played.pw = W.pen; played.pl = L.pen; }
    if (!s.test && !s.recorded) { s.recorded = true; League.record(s, res, W.id); }
    const board = this.cupBoard(s.round, s.cup, played);
    let summary = null;
    if (!s.test && League.cupDone() && League.seasonOver()) {
      const ch = League.seasonChange();
      summary = { season: d.season || 1, champion: { id: ch.champion.id, name: ch.champion.name },
        up: ch.in.map(t => ({ id: t.id, name: t.name, c1: t.c1, c2: t.c2 })), down: ch.out.map(t => ({ id: t.id, name: t.name, c1: t.c1, c2: t.c2 })) };
      FX.startEndConfetti([W.c1, W.c2, '#FFD54F', '#ffffff']);
    }
    this.end = { title: s.title, winner: { name: W.name, code: W.code, c1: W.c1, c2: W.c2 }, rows: [], cup: board, summary, seasonEnd: null,
      subtitle: scoreLine(g),
      standings: [W, L].map((T, i) => ({ name: T.name, code: T.code, c1: T.c1, c2: T.c2, place: i + 1, gf: T.score, pts: 0 })) };
    this.endT = 0;
    $('caption').value = this.captionCup(W, L, res, summary);
    UI.refresh();
  },
  onOver() {
    if (this.setup.cup) return this.onOverCup();
    const g = this.game, s = this.setup, d = League.data, D = this.div(s.div);
    const res = g.getResult();
    const [H, A] = g.teams;
    const before = JSON.parse(JSON.stringify(D.table));
    const after = JSON.parse(JSON.stringify(D.table));
    League.applyTo(after, res, D.teams);
    const histAfter = D.history.concat([/** @type {HistoryEntry} */ ({ result: res.teams.map(t => ({ id: t.id, score: t.score })) })]);
    const rkB = D.rank(before, D.history), rkA = D.rank(after, histAfter);
    const oldRank = new Map(rkB.map((x, i) => [x.t.id, i])), newRank = new Map(rkA.map((x, i) => [x.t.id, i]));
    const today = new Set(res.teams.map(t => t.id));
    const gdOf = (tab, id) => { const r = League.rowOf(tab, id); return r.gf - r.ga; };
    const rows = D.teams.map(t => {
      const tm = res.teams.find(x => x.id === t.id);
      return { id: t.id, name: t.name, c1: t.c1, c2: t.c2, today: today.has(t.id),
        oldRank: oldRank.get(t.id), newRank: newRank.get(t.id),
        oldPts: League.rowOf(before, t.id).pts, newPts: League.rowOf(after, t.id).pts,
        played: League.rowOf(after, t.id).played, dPlayed: tm ? 1 : 0,
        oldGd: gdOf(before, t.id), newGd: gdOf(after, t.id),
        res: tm ? League.resultOf(histAfter[histAfter.length - 1], t.id) : null, delta: tm ? League.pointsFor(res, tm) : null,
        oldForm: League.formOf(t.id, D.history), newForm: League.formOf(t.id, histAfter) };
    });
    const leaderBefore = rkB[0] && rkB[0].r.played ? rkB[0].t.id : null;
    const leaderAfter = rkA[0].t;
    /* this match's result: both clubs with their goals and points */
    const standings = [H, A].map(T => {
      const tm = res.teams.find(x => x.id === T.id);
      return { name: T.name, code: T.code, c1: T.c1, c2: T.c2, place: T.place, gf: T.score, pts: League.pointsFor(res, tm) };
    });
    const W = g.winner >= 0 ? g.teams[g.winner] : null;
    this.end = { title: s.title, winner: W ? { name: W.name, code: W.code, c1: W.c1, c2: W.c2 } : null, rows, standings, seasonEnd: null,
      tableTitle: D.tableTitle, po: D.po, up: D.up,
      subtitle: scoreLine(g), score: { a: this.tObj(H), b: this.tObj(A), sa: H.score, sb: A.score } };
    this.endT = 0;
    /* persist (the live league may have recorded it already: a match the viewer joined after its whistle) */
    if (!s.test && !s.recorded) {
      s.recorded = true;
      if (League.record(s, res, W ? W.id : null)) setTimeout(() => UI.toast(`📅 Hafta ${d.week} başladı.`), 300);
      /* last match of the season: the table leader is the champion, the last teams will be relegated */
      if (s.div !== 'promo' && League.mainOver()) {
        const ch = League.seasonChange();
        this.end.seasonEnd = { season: d.season || 1, champion: { id: ch.champion.id, name: ch.champion.name }, out: ch.out.map(t => t.id), in: ch.in.map(t => ({ id: t.id, name: t.name })), playoff: ch.pending };
        for (const r of this.end.rows) { r.champ = r.id === ch.champion.id; r.out = ch.out.some(t => t.id === r.id); }
        FX.startEndConfetti([ch.champion.c1, ch.champion.c2, '#FFD54F', '#ffffff']);
      }
    }
    $('caption').value = this.caption(res, leaderBefore !== leaderAfter.id && rkA[0].r.pts > 0 ? leaderAfter : null);
    UI.refresh();
  },
  caption(res, newLeader) {
    const s = this.setup, g = this.game, [H, A] = g.teams;
    const W = g.winner >= 0 ? g.teams[g.winner] : null, L = W ? g.teams[1 - g.winner] : null;
    const l1 = W ? `Week ${s.week} · Match ${s.weekMatch} 🏆 ${W.name} beat ${L.name} ${W.score}–${L.score}!`
      : `Week ${s.week} · Match ${s.weekMatch} 🤝 ${H.name} ${H.score}–${A.score} ${A.name}: a draw!`;
    const extra = newLeader && !s.test ? `New league leader: ${newLeader.name}!` : '';
    let l2 = 'Who wins the next one? Comment your team 👇';
    let season = '';
    const se = this.end && this.end.seasonEnd;
    if (se) {
      const nm = (ids) => ids.map(id => (League.data.teams.find(t => t.id === id) || (League.data.reserve.find(t => t.id === id)) || {}).name).filter(Boolean).join(', ');
      season = `🏆 ${se.champion.name} are the Season ${se.season} champions!\n🔻 Relegated: ${nm(se.out)}\n` +
        (se.playoff ? '⚔️ The promotion playoff decides who replaces them!' : `🔺 Joining next season: ${se.in.map(t => t.name).join(', ')}`);
      l2 = se.playoff ? 'Who gets promoted? Comment your team 👇' : 'Who wins next season? Comment your team 👇';
    }
    return [l1, season, extra, l2, '#satisfying #football #simulation #oddlysatisfying #league'].filter(Boolean).join('\n');
  },
  captionCup(W, L, res, summary) {
    const s = this.setup, label = cupName(s.cup)[0];
    const how = res.pens ? ` (${W.pen}–${L.pen} on penalties)` : res.golden ? ' with a golden goal' : '';
    const l1 = `Promotion playoff · ${label} 🏆 ${W.name} beat ${L.name} ${W.score}–${L.score}${how}!`;
    let l2, l3 = '';
    if (summary) {
      l2 = `🔺 Promoted: ${summary.up.map(t => t.name).join(', ')}\n🔻 Relegated: ${summary.down.map(t => t.name).join(', ')}`;
      l3 = 'Who wins next season? Comment your team 👇';
    } else if (s.cup === '3RD') l2 = `🥉 ${W.name} take the last promotion place!`;
    else if (s.cup === 'FIN') l2 = '';
    else if (s.round === 2) l2 = League.poDirect() ? `${W.name} go on to the final!` : `${W.name} are promoted and go on to the final!`;
    else l2 = `${W.name} move on!`;
    if (!l3) l3 = 'Who goes up next? Comment your team 👇';
    return [l1, l2, l3, '#satisfying #football #simulation #oddlysatisfying #league'].filter(Boolean).join('\n');
  },
};
/* "RMA 2 – 1 BAR" (+ golden goal / penalties) */
function scoreLine(g) {
  const [A, B] = g.teams;
  return `${A.code} ${A.score} – ${B.score} ${B.code}` + (g.pens ? ` · PENS ${A.pen}–${B.pen}` : g.extra && g.winner >= 0 ? ' · GOLDEN GOAL' : '');
}

/* =====================================================================
   BALANCE TEST  (100 headless matches, chunked, no drawing / audio)
   ===================================================================== */
const Balance = {
  busy: false,
  run() {
    if (this.busy || Recorder.active) return;
    const s = League.data.settings, teamsAll = League.data.teams;
    if (teamsAll.length < 2) { alert('Yeterli takım yok.'); return; }
    this.busy = true; $('btnBalance').disabled = true;
    const N = 100, res = [];
    let i = 0;
    const t0 = performance.now();
    const stepChunk = () => {
      const until = performance.now() + 30;
      while (i < N && performance.now() < until) {
        const seed = randomSeed();
        const r = new RNG((seed ^ 0x51ED27) >>> 0);
        const teams = r.shuffle(teamsAll).slice(0, 2);
        let theme = s.theme === 'auto' ? r.pick(THEME_IDS) : s.theme;
        const g = new Game(App.matchOpts(teams, seed, theme, false));
        while (!g.over && g.t < 200) g.step(DT);
        res.push(g.getResult());
        i++;
      }
      $('balBar').style.width = (i / N * 100) + '%';
      if (i < N) setTimeout(stepChunk, 0);
      else { this.show(res, (performance.now() - t0) / 1000); this.busy = false; $('btnBalance').disabled = false; }
    };
    $('balOut').innerHTML = '<div class="hint">Simüle ediliyor…</div>';
    stepChunk();
  },
  show(res, secs) {
    const N = res.length, pct = (x, tot) => tot ? Math.round(x / tot * 100) + '%' : '–';
    const goals = res.reduce((a, r) => a + r.goals, 0), og = res.reduce((a, r) => a + r.ownGoals, 0);
    const home = res.filter(r => !r.draw && r.winner === r.teams[0].id).length, draws = res.filter(r => r.draw).length;
    const byTeam = new Map();
    for (const r of res) for (const t of r.teams) {
      const op = r.teams.find(x => x.id !== t.id);
      const b = byTeam.get(t.code) || { m: 0, w: 0, gf: 0 }; b.m++; if (t.score > op.score) b.w++; b.gf += t.score; byTeam.set(t.code, b);
    }
    let html = `<div class="bal-grid">
      <div class="kv"><span>Ort. toplam gol</span><b>${(goals / N).toFixed(1)}</b></div>
      <div class="kv"><span>Beraberlik</span><b>${pct(draws, N)}</b></div>
      <div class="kv"><span>Ev sahibi (üst kale) / deplasman galibiyeti</span><b>${pct(home, N)} / ${pct(N - draws - home, N)}</b></div>
      <div class="kv"><span>Ort. kurtarış</span><b>${(res.reduce((a, r) => a + r.saves, 0) / N).toFixed(1)}</b></div>
      <div class="kv"><span>Kendi kalesine gol</span><b>${pct(og, goals)}</b></div>
    </div><div class="hint">${N} maç (${CONFIG.MATCH_TIME} sn) · ${secs.toFixed(1)} sn'de simüle edildi · ev sahibi ve deplasman galibiyeti ~eşitse taraflar adil</div>`;
    html += `<div class="hint"><b>Takım bazında</b> (maç · galibiyet · ort. gol):</div><table class="mini"><tbody>` +
      [...byTeam.entries()].sort((a, b) => b[1].w / b[1].m - a[1].w / a[1].m).map(([c, b]) => `<tr><td>${esc(c)}</td><td>${b.m}</td><td>${pct(b.w, b.m)}</td><td>${(b.gf / b.m).toFixed(2)}</td></tr>`).join('') + '</tbody></table>';
    $('balOut').innerHTML = html;
  },
};

/* =====================================================================
   MAIN LOOP  (fixed 240 Hz physics steps, render at display rate)
   ===================================================================== */
let lastNow = performance.now(), acc = 0;
function frame(now) {
  if (Offline.active) { lastNow = now; requestAnimationFrame(frame); return; }   // headless render drives the game itself
  let rdt = (now - lastNow) / 1000; lastNow = now;
  if (rdt > 0.1) rdt = 0.1; if (rdt < 0) rdt = 0;
  const g = App.game;
  let dtW = 0;
  if (g && App.running && !App.paused && !g.over && App.introOn()) {
    App.introT += rdt;                         // the pre-match screens play first; the match itself waits
  } else if (g && App.running && !App.paused && !g.over) {
    const sp = Recorder.active ? 1 : App.simSpeed();
    const ts = g.timeScale();
    acc += rdt * sp * ts;
    let n = 0;
    while (acc >= DT && n < 200) { g.step(DT); acc -= DT; n++; if (g.over) break; }
    if (n >= 200) acc = 0;
    dtW = rdt * sp * ts;
    App.matchRealT += rdt * sp;
    if (g.over && !App.end) App.onOver();
  } else if (App.end) dtW = rdt;
  FX.update(dtW, App.paused ? 0 : rdt);
  if (App.end && !App.paused) {
    App.endT += rdt;
    if (Recorder.active && App.endT >= CONFIG.END_DURATION + 0.3) { Recorder.stop(false); UI.status(); }
  }
  Renderer.draw(g, App);
  UI.tick();
  requestAnimationFrame(frame);
}

function fitCanvas() {
  const c = Renderer.canvas, wrap = $('stage');
  const pad = document.body.classList.contains('live') ? 112 : 0;   // live site: room for the tab bar (top) and the sound bar (bottom)
  const W = wrap.clientWidth - 16, H = wrap.clientHeight - 16 - pad;
  let h = H, w = h * 9 / 16;
  if (w > W) { w = W; h = w * 16 / 9; }
  c.style.width = Math.floor(w) + 'px'; c.style.height = Math.floor(h) + 'px';
}

async function boot() {
  Renderer.init($('c'));
  if (Live.on) return Live.boot();             // the public site: the live league plays itself on schedule (07_live.js)
  League.load();
  UI.init();
  League.save();
  UI.storageWarn(!League.storageOK);
  if (League.migrated) setTimeout(() => UI.toast('⚽ Takımlar dünyanın önde gelen kulüpleriyle değiştirildi — lig tablosu sıfırdan başladı.'), 600);
  fitCanvas(); window.addEventListener('resize', fitCanvas);
  try {
    await Promise.race([
      Promise.all([document.fonts.load(`80px "Bebas Neue"`), document.fonts.load(`700 30px Inter`), document.fonts.load(`600 30px Inter`)]),
      new Promise(r => setTimeout(r, 2500)),
    ]);
  } catch (e) { /* fonts optional */ }
  App.prepare();
  document.addEventListener('keydown', (e) => {
    const el = /** @type {HTMLElement} */ (e.target);
    if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); if (!App.running || App.end) App.start(false); else App.togglePause(); }
  });
  requestAnimationFrame(frame);
}
window.addEventListener('DOMContentLoaded', boot);
