/* =====================================================================
   LIVE LEAGUE  (the public site: a league that never stops — matches play themselves on a fixed timetable,
   every visitor sees the same match at the same moment)
   No server: the simulation is deterministic (seeded RNG + DM math, see 01_core.js) and every seed is derived
   from the season / week / match, so each browser computes the league by itself:
     • finished matches are simulated without drawing (cached in localStorage; live-state.json on the site,
       refreshed every 15 minutes by the Pages workflow, is a ready-made checkpoint so first visits are quick),
     • the match that is on is fast-forwarded to "now" and then plays in real time,
     • between matches: the league table and a countdown to the next kick-off.
   Timetable (CONFIG.LIVE.bands, Istanbul time): a slot every 3 minutes, day and night (480 a day). Two leagues play side by
   side, each on its own "channel", and their matches of a slot kick off together:
     • main:  the league (18 clubs, 17 weeks × 9 = 153 matches: one in every slot of the season),
     • promo: the promotion league of the 12 pool clubs (a double round robin, 22 weeks × 6 = 132 matches spread evenly over
              the season's slots) and then its playoff (top 4: semi-finals, third place, final) in the season's last 4 slots,
              so both seasons end with the same slot (League.promoSlot). Champion, runner-up and third place go up.
   A match: ~5 s that week's matches, the 90 s match with a 6 s half-time break, ~9 s the animated table. A slot starts at
   its time, or GAP seconds after the previous slot's last match ended if that one ran over (a league match is ~108 s on
   screen, a playoff match with a golden goal and penalties at most ~2.3 min, so it does not happen; it can never jam anyway:
   the overrun is absorbed by the next slots). A match's length on screen is computed from its own simulation, so every browser
   agrees on it too. A season begun before the promotion league existed (frozen in a base) ends the old way: the 12 pool clubs'
   knockout after the league's matches, one match a slot (League.cupPhase).
   The site opens on the fixture ("Lig tablosu" › "Fikstür": the league's and the promotion league's fixtures are sub-tabs of their
   tables). "Canlı" lists the matches on now and those starting within 10 minutes; the viewer picks one
   and watches it (the canvas follows that channel from then on). A ⚽ next to a match in the fixture or a club in a table
   opens its live match too.
   The league's start comes from the deploy (BUILD_START, tools/live-start.js): a new league starts a few minutes after
   it goes live. BUILD_START also carries the old league's champions and finished seasons ("Geçmiş" tab).
   Changing the simulation never restarts the league: the Pages workflow freezes the league as it stands (BUILD_BASE) and the new
   rules play on from there (see hash() / applyRules() below and tools/live-base.js).
   The studio (old panel: preview, recording, videos) is at ?studio. Debug: ?now=<past ISO time>.
   Match links: ?tekrar=… replays one finished match by itself (see replayLink), for sharing.
   ===================================================================== */
const Live = {
  on: !/[?&]studio\b/.test(location.search),
  CACHE_KEY: 'arenaLive_v3',
  AV: 2,                    // saved-state format: 2 = 1v1 league (W/D/L table) with the season archive; older states are not trusted as caches
  HOLD: 0,                  // seconds the final table stays after the end screen (the table + countdown screen follows anyway)
  RESYNC_GAP: 60e3,         // the page slept longer than this (ms): reload from the newest saved state
  offset: 0, skew: 0, phase: 'loading', progress: null, cur: null, pending: null, st: null, simT: 0,
  sound: false, lastClean: null, lastFrame: 0,
  watch: '',                // the channel the viewer watches ('main' | 'promo'; '' = the "Canlı" list)
  wm: null,                 // ...and its match that is loaded into App (one of cur.ms)
  SOON: 10 * 60e3,          // "Canlı" lists the matches that start within this many ms

  /* --- timetable ---------------------------------------------------------- */
  /* CONFIG.LIVE, with the start the deploy chose for this salt (BUILD_START) */
  cfg() {
    const B = this.build();
    if (!B || B.salt !== CONFIG.LIVE.salt || !B.start) return CONFIG.LIVE;
    if (!this._cfg || this._cfg.src !== CONFIG.LIVE) this._cfg = Object.assign({}, CONFIG.LIVE, { start: B.start, src: CONFIG.LIVE });
    return this._cfg;
  },
  build() { return typeof BUILD_START !== 'undefined' && BUILD_START && typeof BUILD_START === 'object' ? BUILD_START : null; },
  /* the previous live league (before the 1v1 format): { champions, seasons } as it stood when this league was deployed */
  legacy() { const B = this.build(); return B && B.legacy && Array.isArray(B.legacy.seasons) ? B.legacy : null; },
  mins(hm) { const [h, m] = hm.split(':').map(Number); return h * 60 + m; },
  /* the day's slots in minutes after the first band starts (a "day" runs from bands[0].from to the next one) */
  slots() {
    if (this._slots) return this._slots;
    const B = this.cfg().bands, b0 = this.mins(B[0].from), out = [];
    B.forEach((b, i) => {
      const from = (this.mins(b.from) - b0 + 1440) % 1440, to = i + 1 < B.length ? (this.mins(B[i + 1].from) - b0 + 1440) % 1440 : 1440;
      for (let m = from; m < to; m += b.every) out.push(m);
    });
    return (this._slots = out);
  },
  /* the league starts at CONFIG.LIVE.start ('YYYY-MM-DD' = that day at the first band's time, or 'YYYY-MM-DDTHH:MM'):
     match 0 is the first slot at or after it; slots then follow the daily timetable */
  sched() {
    if (this._sched && this._sched.slots === this.slots()) return this._sched;
    const c = this.cfg(), off = c.utcOffset * 3600e3, S = this.slots(), b0 = this.mins(c.bands[0].from);
    /* anchor: match 0 at the league's start — or, for a league frozen in a base (rules or timetable changed), the base's next
       match at the first slot of the (new) timetable at or after the end of the base's last match */
    const B = this.baseId() ? BUILD_BASE.data : null;
    let startMs, firstN = 0;
    if (B && B.liveCount > 0 && B.liveLastEnd > 0) { startMs = B.liveLastEnd; firstN = B.liveCount; }
    else {
      const [ds, ts] = c.start.split('T'), [y, mo, d] = ds.split('-').map(Number), tm = this.mins(ts || c.bands[0].from);
      startMs = Date.UTC(y, mo - 1, d, 0, tm) - off;
    }
    const day = Math.floor((startMs + off - b0 * 60e3) / 864e5), base0 = day * 864e5 + b0 * 60e3 - off;
    let n0 = 0; while (n0 < S.length && base0 + S[n0] * 60e3 < startMs) n0++;
    return (this._sched = { slots: S, base0, n0, firstN });
  },
  /* planned kick-off of live match n (matches before a base's anchor: only for display, they were played on the old timetable) */
  slot(n) {
    const { slots: S, base0, n0, firstN } = this.sched(), k = n - firstN + n0, day = Math.floor(k / S.length);
    return base0 + day * 864e5 + S[k - day * S.length] * 60e3;
  },
  /* actual kick-off of the next slot: its time, or GAP after the previous slot's last match if that one ran over */
  nextStart() { return Math.max(this.slot(this.count()), (League.data.liveLastEnd || 0) + this.cfg().gap * 1000); },
  /* minutes between matches at time t */
  every(t) {
    const B = this.cfg().bands, loc = Math.floor((t + this.cfg().utcOffset * 3600e3) / 60e3) % 1440;
    let e = B[B.length - 1].every;
    for (const b of B.slice().sort((a, c) => this.mins(a.from) - this.mins(c.from))) if (this.mins(b.from) <= loc) e = b.every;
    return e;
  },
  now() { return Date.now() + this.offset + this.skew; },
  clock(ms) { return new Date(ms + this.cfg().utcOffset * 3600e3).toISOString().slice(11, 16); },

  /* --- determinism ------------------------------------------------------ */
  seed(parts) {
    let h = 0x811C9DC5;
    const str = [this.cfg().salt].concat(parts).join('|');
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    h ^= h >>> 16; h = Math.imul(h, 0x85EBCA6B); h ^= h >>> 13;
    return (h >>> 0) || 1;
  },
  /* A saved state (browser cache, checkpoint, base) is only valid for the exact timeline it belongs to:
       hash = <sim>:<league>[@<base id>]
     • league: the league's identity — salt, start, timetable. Changing any of them starts a NEW league.
     • sim:    BUILD_SIM_HASH, the fingerprint of the simulation's results (see build.sh). Changing the simulation does NOT
               restart the league: the deploy freezes the league as it stands and the new rules play on from there (the base).
     • base:   BUILD_BASE.id — the frozen state the new rules continue from (absent while the league never changed rules). */
  /* the league's identity: salt + start. The timetable (bands, gap) is NOT part of it: changing it changes the fingerprint
     (tools/live-fingerprint.js), so the league is frozen and goes on under the new timetable (see sched()). */
  league() {
    const c = this.cfg();
    return [c.salt, c.start].join(':');
  },
  sim() { return typeof BUILD_SIM_HASH !== 'undefined' ? BUILD_SIM_HASH : 'dev'; },
  baseId() { return typeof BUILD_BASE !== 'undefined' && BUILD_BASE && BUILD_BASE.data ? String(BUILD_BASE.id) : ''; },
  hash() { return this.sim() + ':' + this.league() + (this.baseId() ? '@' + this.baseId() : ''); },
  /* the parts of any saved state's hash: { sim, league, base }; sim/league null if foreign. Hashes written while the timetable was
     part of the league's identity (<sim>:<salt>:<start>:<bands>:<gap>) belong to the same league. */
  sameLeague(id) { const L = this.league(); return id === L || String(id || '').startsWith(L + ':'); },
  parts(hash) {
    const [rest, base = ''] = String(hash || '').split('@'), i = rest.indexOf(':');
    return i > 0 && this.sameLeague(rest.slice(i + 1)) ? { sim: rest.slice(0, i), league: this.league(), base } : { sim: null, league: null, base };
  },
  /* the frozen starting state of this build (a copy: playing must never touch it), or null */
  baseState() { return this.baseId() ? JSON.parse(JSON.stringify(BUILD_BASE.data)) : null; },
  count() { return League.data.liveCount || 0; },

  /* --- league state ------------------------------------------------------ */
  freshLeague() { const d = League.normalize(null); d.liveCount = 0; d.liveSeasonStart = 0; d.liveLastEnd = 0; d.seasons = []; return d; },
  /* The rules a live league plays by always come from CONFIG, never from what a saved state carries (League.normalize keeps a
     saved league's points / speed / season length). So a league frozen before a rule change plays the new rules from
     its next match on; matches already played stay as they were. A season that has begun keeps its length until it ends.
     Idempotent: states taken after this ran come out unchanged. */
  applyRules(d = League.data) {
    d.points = CONFIG.POINTS.slice();
    d.settings = League.defaultSettings();
    const begun = d.history.length > 0 || d.week > 1 || d.weekMatch > 1 || !!d.cup;
    /* the season's promotion league: set up (again: with the season's length) until the season's first slot is played; a season
       begun without one (the old format) ends the old way */
    if (!begun) { d.seasonLength = CONFIG.SEASON_LENGTH; d.promo = this.promoNew(d); }
    else if (!(d.promo && d.promo.season === d.season)) d.promo = null;
  },
  /* a season's promotion league: the pool clubs' double round robin (as many of its weeks as fit) spread over the league's N slots,
     the playoff in the last PO_SIZE slots. Its fixture and tie-break draw come from the season's seeds, like the league's. */
  promoNew(d) {
    const ids = d.reserve.map(t => t.id), nP = ids.length;
    if (nP < 2 || nP % 2) return null;
    const per = nP / 2, N = d.seasonLength * Math.max(1, Math.floor(d.teams.length / 2));
    const po = nP >= PO_SIZE && CONFIG.RELEGATE_COUNT === 3 ? PO_SHAPE.length : 0;
    const weeks = Math.max(0, Math.min(2 * (nP - 1), Math.floor((N - po) / per)));
    if (!weeks && !po) return null;
    return { season: d.season, per, N, po, n: weeks * per, plan: weeks ? planRoundRobin(ids, weeks, new RNG(this.seed(['pplan', d.season]))) : [],
      table: {}, history: [], tieOrder: new RNG(this.seed(['ptie', d.season])).shuffle(ids) };
  },
  /* make a saved state the live league (null = a brand-new league) */
  adopt(d) {
    League.data = d ? Object.assign(League.normalize(d), { liveCount: d.liveCount || 0, liveSeasonStart: d.liveSeasonStart || 0, liveLastEnd: d.liveLastEnd || 0 }) : this.freshLeague();
    if (!Array.isArray(League.data.seasons)) League.data.seasons = [];
    this.applyRules();
  },
  /* live match number of a season's league match */
  matchIndex(week, wm) { return (League.data.liveSeasonStart || 0) + (week - 1) * App.perWeek() + (wm - 1); },
  /* ...and of the i-th promotion playoff match (old format: after the season's league matches; promotion league: its last slots) */
  cupIndex(i) { return League.promoOn() ? this.promoIndex(League.data.promo.n + i) : (League.data.liveSeasonStart || 0) + League.data.seasonLength * App.perWeek() + i; },
  /* live match number (slot) of the season's i-th promotion match */
  promoIndex(i) { return (League.data.liveSeasonStart || 0) + League.promoSlot(i); },
  /* the matches planned for slot n of the running season (n ≥ the slot being played; [] past the season's end), without simulating:
     [{ ch, week, wm, ids } | { ch, cup, ids }] — ids [home, away], a playoff club not decided yet is null */
  peek(n) {
    const d = League.data, j = n - (d.liveSeasonStart || 0), per = App.perWeek(), N = d.seasonLength * per, out = [];
    if (j < 0) return out;
    const plan = App.seasonPlan(), cm = League.cupMatches();
    const shape = League.promoOn() ? PO_SHAPE : CUP_SHAPE;
    const cupAt = (ch, i) => { const k = shape[i], x = cm[i]; if (k) out.push({ ch, cup: k.k, r: k.r, ids: x ? [x.a, x.b] : [null, null] }); };
    if (j < N) { const w = Math.floor(j / per) + 1, m = j % per + 1; out.push({ ch: 'main', week: w, wm: m, ids: plan ? ((plan.weeks[w - 1] || [])[m - 1] || []).slice() : [] }); }
    else if (!League.promoOn() && League.cupOn() && j < N + CUP_SHAPE.length) cupAt('main', j - N);
    if (League.promoOn()) {
      const p = d.promo, i = League.promoIndexAt(j);
      if (i >= p.n) cupAt('promo', i - p.n);
      else if (i >= 0) { const w = Math.floor(i / p.per) + 1, m = i % p.per + 1; out.push({ ch: 'promo', week: w, wm: m, ids: ((p.plan[w - 1] || [])[m - 1] || []).slice() }); }
    }
    return out;
  },
  /* a match's length on screen (s): intro, the match at its time scale (slow motion), end table, hold.
     Steps the game to its end, frame by frame at 60 fps exactly like the live player. */
  timeGame(g) {
    const rdt = 1 / 60;
    let n = Math.ceil(CONFIG.INTRO_DURATION * 60), acc = 0;
    while (!g.over) {
      acc += rdt * g.timeScale();
      let k = 0;
      while (acc >= DT && k < 200) { g.step(DT); acc -= DT; k++; if (g.over) break; }
      if (k >= 200) acc = 0;
      n++;
    }
    return n / 60 + CONFIG.END_DURATION + this.HOLD;
  },
  /* the next slot computed without drawing: its matches (one per channel: setup, the finished game, length, the final whistle
     and the end of its screens, ms), its start and length (its longest match) */
  computeNext() {
    const start = this.nextStart(), ms = [];
    const add = (ch, s) => {
      if (!s) return;
      if (s.err) throw new Error(s.err);
      const g = new Game(s.opts), dur = this.timeGame(g);
      ms.push({ ch, s, g, dur, start, end: start + Math.round(dur * 1000), over: start + Math.round((dur - CONFIG.END_DURATION - this.HOLD) * 1000) });
    };
    add('main', App.buildSetup());
    add('promo', App.buildPromoSetup());
    if (!ms.length) throw new Error('Bu aralıkta oynanacak maç bulunamadı.');
    return { n: this.count(), start, ms, dur: Math.max(...ms.map(M => M.dur)) };
  },
  /* write one computed match into its league (identical to watching it: same steps, same League.record); once only */
  recordOne(M) {
    if (M.s.recorded) return;
    M.s.recorded = true;
    League.record(M.s, M.g.getResult(), M.g.winner >= 0 ? M.g.teams[M.g.winner].id : null);
  },
  /* write a computed slot into the league */
  record(m) { for (const M of m.ms) this.recordOne(M); this.closeMatch(m); },
  /* after a slot: season over (the league's matches AND the promotion league / playoff) → champion, relegation/promotion, new season;
     then the next slot */
  closeMatch(m) {
    const d = League.data, ended = League.seasonOver();
    if (ended) {
      const a = League.endSeason(), keep = this.cfg().keepChampions;
      d.seasons = (d.seasons || []).concat(this.archiveSeason(a)).slice(-keep);
      this.applyRules(d); d.champions = d.champions.slice(-keep);
    }
    d.liveCount = (d.liveCount || 0) + 1;
    d.liveLastEnd = m.start + Math.round(m.dur * 1000);
    if (ended) d.liveSeasonStart = d.liveCount;
    this.pending = null;
    this.snapshot();
  },
  /* a finished season for the "Geçmiş" tab, kept small: the final table (with the last results), who went down / up and the
     promotion playoff's bracket. The matches themselves are dropped. Times are minutes since 1970 (0 = unknown).
     f: 2 = a 1v1 season (rows: id, played, pts, W, D, L, GF, GA, last results; p: win/draw/loss points);
     a season of the old group-match league (no f) has rows: id, played, pts, 1st places, GF, GA, last places; p: points per place.
     Playoff results: [winner, loser, goals, goals, time, (penalties winner, penalties loser) | (golden goal: 1)].
     m: the season's league matches in the order played, 4 base-36 characters each: home and away club (index into rows) and
     their goals (the "İstatistik" tab and the club pages: records, streaks, head-to-head; ~0,6 KB a season). '' = not kept.
     pl: the promotion league (seasons since it exists): { n, rows, m } like the league's (rows in table order); its top 4's playoff is cup. */
  archiveSeason(a) {
    const min = (iso) => { const t = Date.parse(iso); return isNaN(t) ? 0 : Math.round(t / 60000); };
    const cup = a.cup, pr = a.promo, ts = a.history.concat(pr ? pr.history : []).map(h => min(h.date)).concat(cup ? Object.values(cup.res).map(r => min(r.date)) : []).filter(Boolean);
    const cr = (r) => [r.winner, r.loser, r.sw, r.sl, min(r.date)].concat(r.pw !== undefined ? [r.pw, r.pl] : r.gg ? [1] : []);
    const b36 = (v) => Math.min(35, Math.max(0, v | 0)).toString(36);
    /* a league's table rows (with the last results) and its matches' scores */
    const lg = (table, history) => {
      const ix = new Map(table.map((x, i) => [x.id, i]));
      const keepM = table.length <= 36 && history.every(h => h.result.length === 2 && ix.has(h.result[0].id) && ix.has(h.result[1].id));
      return { n: history.length, m: keepM ? history.map(h => b36(ix.get(h.result[0].id)) + b36(ix.get(h.result[1].id)) + b36(h.result[0].score) + b36(h.result[1].score)).join('') : '',
        rows: table.map(x => [x.id, x.played, x.pts, x.w, x.d, x.l, x.gf, x.ga].concat(League.formOf(x.id, history))) };
    };
    const main = lg(a.table, a.history);
    const rec = { f: 2, season: a.season, champ: a.champion.id, t0: ts.length ? Math.min(...ts) : 0, t1: ts.length ? Math.max(...ts) : 0,
      n: main.n, p: (a.points || League.data.points).slice(0, 3), m: main.m, rows: main.rows,
      out: a.relegated.map(t => t.id), up: a.promoted.map(t => t.id),
      cup: cup ? { draw: cup.draw.slice(), res: Object.fromEntries(Object.entries(cup.res).map(([k, r]) => [k, cr(r)])) } : null };
    if (pr) rec.pl = lg(pr.table, pr.history);
    return rec;
  },
  /* a state "after liveCount matches", taken only between matches (cache, checkpoint, resync) */
  snapshot() { this.lastClean = JSON.stringify({ hash: this.hash(), av: this.AV, savedAt: new Date(this.now()).toISOString(), data: League.data }); },
  saveCache() { if (!this.lastClean) this.snapshot(); try { localStorage.setItem(this.CACHE_KEY, this.lastClean); } catch (e) { /* full / blocked: recompute next time */ } },
  /* legacy: also accept a state written before the season archive existed (the publish tool rebuilds those, see live-state.js) */
  parseState(txt, legacy) { try { const c = typeof txt === 'string' ? JSON.parse(txt) : txt; return c && c.hash === this.hash() && (legacy || c.av === this.AV) && c.data ? c.data : null; } catch (e) { return null; } },
  readCache() { try { return this.parseState(localStorage.getItem(this.CACHE_KEY)); } catch (e) { return null; } },
  /* the site's checkpoint; its HTTP Date header also corrects a wrong device clock */
  async readCheckpoint() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return null;
    try {
      const t0 = Date.now(), r = await fetch('live-state.json', { cache: 'no-cache' }), t1 = Date.now();
      const sd = Date.parse(r.headers.get('Date') || '');
      if (!isNaN(sd)) { const sk = sd + 500 - (t0 + t1) / 2; this.skew = Math.abs(sk) > 2000 ? sk : 0; }
      if (!r.ok) return null;
      const c = await r.json();
      this.checkNewSite(c);
      return this.parseState(c);
    } catch (e) { return null; }
  },
  /* the site was redeployed with another league or other rules (the checkpoint belongs to a newer build): an open page would
     keep playing its own, old league, so it reloads — at most once every 10 minutes, so a stale cache can never loop it */
  checkNewSite(c) {
    if (!c || !c.hash || c.hash === this.hash() || location.protocol === 'file:') return;
    if (c.savedAt && Date.parse(c.savedAt) < this.bootAt) return;   // an old checkpoint (cache) is not news
    try {
      const k = 'arenaLiveReload', last = +sessionStorage.getItem(k) || 0;
      if (Date.now() - last < 600e3) return;
      sessionStorage.setItem(k, String(Date.now()));
    } catch (e) { return; }
    location.reload();
  },
  /* every 10 minutes: is a newer site live? (the checkpoint is refreshed every 15 minutes) */
  watchSite() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    setInterval(async () => {
      try { const r = await fetch('live-state.json', { cache: 'no-cache' }); if (r.ok) this.checkNewSite(await r.json()); } catch (e) { /* offline: try later */ }
    }, 600e3);
  },
  /* --- browser tab title ---------------------------------------------------------------------------------------------------
     Between matches: the countdown to the next kick-off ("⏱ 1:05 · RMA–BAR"); while a match is on: a ball running left and right
     ("··⚽···· RMA–BAR"). It must keep going in a background tab, where browsers slow timers down (Chrome: to once a minute after
     5 minutes) and stop drawing: a tiny Web Worker sends the tick (worker timers are not throttled like that), and the title is
     worked out from the clock alone — the match state itself only advances while the page is visible. */
  TITLE_W: 7,
  startTitle() {
    this.titleBase = document.title || 'Satisfying Lig';
    const tick = () => { try { this.titleTick(); } catch (e) { /* keep ticking */ } };
    try {
      const w = new Worker(URL.createObjectURL(new Blob(['setInterval(function () { postMessage(0); }, 250);'], { type: 'text/javascript' })));
      w.onmessage = tick;
    } catch (e) { setInterval(tick, 250); }
  },
  /* the clubs of a match as "RMA–BAR" (home first) */
  codes(ids) {
    const d = League.data, t = ids.map(id => d.teams.find(x => x.id === id) || League.poolTeam(id)).filter(Boolean);
    return t.length === 2 ? `${t[0].code}–${t[1].code}` : '';
  },
  /* the clubs of channel ch's next match (the league's by default), [] if not known yet */
  nextIds(ch = 'main') {
    const n = this.cur ? this.cur.n + 1 : this.count(), x = this.peek(n).find(m => m.ch === ch);
    return x ? x.ids.filter(Boolean) : [];
  },
  /* kick-off of slot n (≥ the slot being played): the actual one for the slot on now / next, the planned one after that */
  kickoffOf(n) {
    if (this.cur && n === this.cur.n) return this.cur.start;
    if (this.cur && n === this.cur.n + 1) return Math.max(this.slot(n), this.cur.start + Math.round(this.cur.dur * 1000) + this.cfg().gap * 1000);
    if (!this.cur && n === this.count()) return this.nextStart();
    return this.slot(n);
  },
  /* the matches being played at time t (kick-off, intro included, up to the final whistle) */
  onNow(t) { return this.cur ? this.cur.ms.filter(M => M.start <= t && t < M.over) : []; },
  /* the matches on now as keys for the pages ('m-<week>-<match>' league, 'p-<week>-<match>' promotion league, 'c-<key>' playoff)
     and the clubs that are playing (id → channel) */
  liveMap(t) {
    const keys = new Set(), teams = new Map();
    for (const M of this.onNow(t)) {
      const s = M.s;
      keys.add(s.cup ? 'c-' + s.cup : `${s.div === 'promo' ? 'p' : 'm'}-${s.week}-${s.weekMatch}`);
      for (const tm of s.opts.teams) teams.set(tm.id, M.ch);
    }
    return { keys, teams, sig: [...keys].join(',') };
  },
  titleText(now) {
    if (this.replay) return `▶ ${this.replay.codes} · Tekrar · Satisfying Lig`;
    if (this.phase === 'loading' || this.phase === 'error') return this.titleBase;
    let on = false, next = 0, vs = '';
    if (this.cur) {
      /* the ball runs from kick-off (intro included) until the final whistle (of the match watched, else any); during the end
         tables the countdown is back */
      const live = this.onNow(now), M = live.find(x => x.ch === this.watch) || live.find(x => x.ch === 'main') || live[0];
      if (M) { on = true; vs = this.codes(M.s.opts.teams.map(t => t.id)); }
      else {                                                     // after the whistles (also in a background tab, where the state is not advanced yet)
        next = this.kickoffOf(this.cur.n + 1);
        vs = this.codes(this.nextIds(this.watch || 'main'));
      }
    } else {
      next = this.nextStart(); vs = this.codes(this.nextIds(this.watch || 'main'));
      if (next <= now) on = true;                                // kicked off in a background tab
    }
    if (on) {
      const W = this.TITLE_W, k = Math.floor(now / 250) % (2 * (W - 1)), pos = k < W ? k : 2 * (W - 1) - k;
      return Array.from({ length: W }, (_, i) => (i === pos ? '⚽' : '·')).join('') + (vs ? ' ' + vs : '') + ' · CANLI';
    }
    const sec = Math.max(0, Math.ceil((next - now) / 1000)), h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, ss = String(sec % 60).padStart(2, '0');
    return `⏱ ${h ? h + ':' + String(m).padStart(2, '0') : m}:${ss}${vs ? ' · ' + vs : ''} · Satisfying Lig`;
  },
  titleTick() {
    const t = this.titleText(this.now());
    if (t !== document.title) document.title = t;
  },
  /* best starting point for time t: the furthest saved state whose last match had ended by t. The build's base is always a
     candidate (a league that changed rules starts from it, never from scratch); a brand-new league starts fresh. */
  async loadState(t) {
    const cands = [this.parseState(this.lastClean), this.readCache(), await this.readCheckpoint(), this.baseState()];
    t = this.now();
    const pick = cands.filter(d => d && (d.liveLastEnd || 0) <= t).sort((a, b) => (b.liveCount || 0) - (a.liveCount || 0))[0];
    this.adopt(pick);
    this.snapshot();
  },
  /* play every match that has ended by now; returns the match that is on (computed), or null.
     budgetMs > 0: yields to the page between slices (browser); 0: runs straight through (Node tools) */
  async catchUp(budgetMs = 40, nowFn = () => this.now()) {
    const from = this.count();
    for (;;) {
      const until = performance.now() + budgetMs;
      do {
        if (this.nextStart() > nowFn()) return null;
        const m = this.computeNext();
        if (m.start + m.dur * 1000 > nowFn()) return m;          // still on
        this.record(m);
      } while (!budgetMs || performance.now() < until);
      this.progress = { done: this.count() - from };
      await new Promise(r => setTimeout(r, 0));
    }
  },

  /* --- match links ------------------------------------------------------------------------------------------------------------
     ?tekrar=1.<sim>.<seed>.<home>.<away>.<theme>.<w5m2 | p5m2 | cFIN>.<kick-off, unix s>   (p: the promotion league)
     A finished match is fully described by its seed, its clubs (home first) and its theme, so the link replays it by itself: no
     league to compute, it opens at once (a ?now= link would rebuild the whole league up to that moment). Only under the same
     rules (<sim> = BUILD_SIM_HASH): with other rules the same seed plays a different match, so the link falls back to the live
     site. A match that is not over yet is not replayed either (its result would show before the live one): the live site
     opens, where it is on. Club ids are the same in every live league (DEFAULT_TEAMS + RESERVE_TEAMS). */
  siteUrl() { return String(location.href || '').split(/[?#]/)[0]; },
  /* m: { seed, ids: [home, away], theme, start (ms), cup } or { …, week, weekMatch, div } */
  replayLink(m) {
    const what = m.cup ? 'c' + m.cup : `${m.div === 'promo' ? 'p' : 'w'}${m.week}m${m.weekMatch}`;
    return `${this.siteUrl()}?tekrar=1.${this.sim()}.${m.seed >>> 0}.${m.ids[0]}.${m.ids[1]}.${m.theme}.${what}.${Math.round(m.start / 1000)}`;
  },
  openReplay(q) {
    const p = /^1\.([\w-]+)\.(\d+)\.([\w-]+)\.([\w-]+)\.(\w+)\.(?:([wp])(\d+)m(\d+)|c([\w-]+))\.(\d+)$/.exec(q);
    const say = (msg) => { this.notice = msg; this.noticeUntil = Date.now() + 15e3; };
    if (!p) return say('Maç bağlantısı geçersiz');
    if (p[1] !== this.sim()) return say('Bu maç eski kurallarla oynandı, tekrarı gösterilemiyor');
    const L = League.normalize(null), team = (id) => L.teams.find(t => t.id === id) || L.reserve.find(t => t.id === id);
    const [A, B] = [team(p[3]), team(p[4])], cup = p[9] && CUP_SHAPE.concat(PO_SHAPE).some(c => c.k === p[9]) ? p[9] : null;
    if (!A || !B || A === B || !THEME_DEFS[p[5]] || (p[9] && !cup)) return say('Maç bağlantısı geçersiz');
    const promo = p[6] === 'p', wk = +p[7] || 0, wm = +p[8] || 0;
    const seed = +p[2] >>> 0, start = +p[10] * 1000, opts = App.matchOpts([A, B], seed, p[5], !!cup);
    /* not over yet (or a link from the future): the live site shows it */
    const end = start + (this.timeGame(new Game(opts)) - CONFIG.END_DURATION - this.HOLD) * 1000;
    if (!(end <= this.now())) return say('Bu maç henüz bitmedi: canlı yayındasınız');
    const title = cup ? `PLAYOFF · ${cupName(cup)[0]}` : `${promo ? 'PROMO · ' : ''}WEEK ${wk} · MATCH ${wm}`;
    const when = `${LivePages.day(start).split(' ').slice(0, 2).join(' ')} ${this.clock(start)}`;
    this.replay = { opts, title, cup, div: promo ? 'promo' : 'main', week: wk, weekMatch: wm, codes: `${A.code}–${B.code}`,
      label: `${cup ? cupName(cup)[1] : `${promo ? 'Yükselme ligi · ' : ''}${wk}. hafta ${wm}. maç`} · ${A.code}–${B.code} · ${when}` };
  },
  /* play the linked match from kick-off, in real time, without touching any league */
  startReplay() {
    const R = this.replay, s = { title: R.title, mode: 'match', div: R.div, cup: R.cup, week: R.week, weekMatch: R.weekMatch, seed: R.opts.seed, theme: R.opts.theme, test: true, opts: R.opts };
    App.setup = s; App.title = s.title; App.end = null; App.intro = null;
    App.game = new Game(Object.assign({}, R.opts, { teams: R.opts.teams.map(t => ({ ...t })) }));
    App.game.onEvent = (t, d) => { FX.onEvent(t, d); this.onGameEvent(t, d); };
    FX.reset(App.game); Renderer.resetTrails();
    this.say(`Tekrar başladı: ${this.matchName()}.`);
    App.running = true; App.paused = false; App.matchRealT = 0;
    this.st = { acc: 0 }; this.replayAt = performance.now(); this.phase = 'replay';
    $('liveShare').classList.remove('hidden');
  },
  replayFrame() {
    const t = performance.now(), rdt = Math.min(0.1, (t - this.replayAt) / 1000), g = App.game;
    this.replayAt = t;
    if (!g.over) {
      const ts = g.timeScale(), st = this.st;
      st.acc += rdt * ts;
      let n = 0;
      while (st.acc >= DT && n < 200) { g.step(DT); st.acc -= DT; n++; if (g.over) break; }
      if (n >= 200) st.acc = 0;
      App.matchRealT += rdt;
      FX.update(rdt * ts, rdt);
    } else FX.update(rdt, rdt);
    const info = this.info();
    if (info !== this._info && $('liveInfo')) { this._info = info; $('liveInfo').textContent = info; }
    Renderer.draw(g, App);
  },
  /* --- screen readers ---------------------------------------------------------------------------------------------------
     The canvas shows the match and says nothing: a hidden live region (#liveAnnounce, polite) tells what happens — kick-off,
     goals with the new score, half time, golden goal, penalties, full time — and the canvas's label carries the score.
     Nothing is said while a match is being fast-forwarded (joining late says the score once instead). */
  ff: false, joined: false,
  say(text) {
    const el = $('liveAnnounce');
    if (!el || !text) return;
    el.textContent = '';                                         // the same sentence twice is still read out
    setTimeout(() => { el.textContent = text; }, 40);
  },
  matchName() {
    const t = App.setup && App.setup.opts ? App.setup.opts.teams : [];
    return t.length === 2 ? `${t[0].name} – ${t[1].name}` : '';
  },
  scoreText(g) { return g && g.teams.length === 2 ? `${g.teams[0].name} ${g.teams[0].score}, ${g.teams[1].name} ${g.teams[1].score}` : ''; },
  onGameEvent(type, d) {
    const g = App.game;
    if (this.ff || !g) return;
    let text = '';
    if (type === 'kickoff') text = d.half === 2 ? `İkinci yarı başladı. ${this.scoreText(g)}.` : `Maç başladı: ${this.matchName()}.`;
    else if (type === 'goal') text = `Gol! ${g.teams[d.benefit] ? g.teams[d.benefit].name : ''}${d.own ? ' (kendi kalesine)' : ''}. Skor: ${this.scoreText(g)}.`;
    else if (type === 'halfTime') text = `Devre arası. ${this.scoreText(g)}.`;
    else if (type === 'goldenGoal') text = `Berabere bitti, altın gol başladı: ilk golü atan kazanır.`;
    else if (type === 'penalties') text = 'Altın golde gol çıkmadı, penaltı atışları başlıyor.';
    else if (type === 'win') {
      const w = g.teams[d.team];
      text = `Maç bitti. ${this.scoreText(g)}. ${w ? `${w.name} kazandı${g.pens ? ' (penaltılarla)' : ''}.` : 'Berabere.'}`;
    }
    if (!text) return;
    this.say(text);
    const cv = $('c'), sc = this.scoreText(g);
    if (cv && sc) cv.setAttribute('aria-label', `${type === 'win' ? 'Maç sonucu' : 'Canlı maç'}: ${sc}`);
  },
  /* the share button: a link to the match on now (or the one being replayed); the phone's share sheet, else the clipboard */
  async share() {
    const s = App.setup;
    if (!s) return;
    const url = this.replay ? location.href : this.replayLink({ seed: s.seed, ids: s.opts.teams.map(t => t.id), theme: s.theme, cup: s.cup, div: s.div, week: s.week, weekMatch: s.weekMatch, start: this.wm ? this.wm.start : this.now() });
    const codes = s.opts.teams.map(t => t.code).join('–'), btn = $('liveShare'), html = btn.innerHTML;
    try {
      if (navigator.share) { await navigator.share({ title: `${codes} · Satisfying Lig`, url }); return; }
      await navigator.clipboard.writeText(url);
      btn.innerHTML = '✓<span class="lbl"> Kopyalandı</span>';
      setTimeout(() => { btn.innerHTML = html; }, 2500);
    } catch (e) {
      if (e && e.name === 'AbortError') return;               // the share sheet was closed
      window.prompt('Bağlantıyı kopyalayın:', url);
    }
  },

  /* --- boot / loop ---------------------------------------------------------- */
  async boot() {
    const q = new URLSearchParams(location.search).get('now');
    /* only the past can be replayed: a future ?now would show results before their kick-off */
    if (q && !isNaN(Date.parse(q))) this.offset = Math.min(0, Date.parse(q) - Date.now());
    document.body.classList.add('live');
    this.bootAt = Date.now();
    League.data = this.freshLeague();
    const rp = new URLSearchParams(location.search).get('tekrar');
    if (rp) this.openReplay(rp);
    if (!this.replay) this.watchSite();
    this.startTitle();
    UI.init();
    fitCanvas(); window.addEventListener('resize', fitCanvas);
    this.ui();
    requestAnimationFrame((t) => this.frame(t));
    try {
      await Promise.race([
        Promise.all([document.fonts.load(`80px "Bebas Neue"`), document.fonts.load(`700 30px Inter`), document.fonts.load(`600 30px Inter`)]),
        new Promise(r => setTimeout(r, 2500)),
      ]);
    } catch (e) { /* fonts optional */ }
    if (this.replay) { this.startReplay(); return; }
    await this.sync();
  },
  /* (re)build the league up to now and pick up the slot that is on; used at start and after the page slept */
  async sync() {
    this.phase = 'loading'; this.progress = null; this.pending = null; this.cur = null;
    this.unload();
    try {
      await this.loadState(this.now());
      const m = await this.catchUp();
      this.saveCache();
      if (m) this.startSlot(m); else this.phase = 'wait';
    } catch (e) { console.error(e); this.phase = 'error'; this.err = String(e && e.message || e); }
    this.lastFrame = this.now();
  },
  ui() {
    /* the tabs (WAI-ARIA tabs: ← → Home End move between them; only the selected one is in the Tab order). The site opens on the
       league's fixture (the "Lig tablosu" tab, its "Fikstür" sub-tab). */
    const tabs = document.createElement('nav');
    tabs.id = 'liveTabs';
    tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Bölümler');
    tabs.innerHTML = this.TABS.map(([k, label, short]) => `<button type="button" role="tab" id="tab-${k}" data-tab="${k}" aria-controls="livePane" aria-selected="false" tabindex="-1">`
      + (short ? `<span class="lg">${label}</span><span class="sh" aria-hidden="true">${short}</span>` : label) + '</button>').join('');
    const pane = document.createElement('div');
    pane.id = 'livePane';
    pane.setAttribute('role', 'tabpanel'); pane.tabIndex = -1;
    const cv = $('c');
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Canlı maç yayını');
    /* screen readers: the canvas shows the match, this hidden region says what happens (Live.say) */
    const ann = document.createElement('div');
    ann.id = 'liveAnnounce'; ann.className = 'sr-only';
    ann.setAttribute('aria-live', 'polite'); ann.setAttribute('aria-atomic', 'true');
    $('stage').appendChild(tabs); $('stage').appendChild(pane); $('stage').appendChild(ann);
    const el = (e) => /** @type {HTMLElement} */ (e.target);
    tabs.addEventListener('click', (e) => { const b = el(e).closest('button'); if (b) this.showTab(b.dataset.tab, true); });
    tabs.addEventListener('keydown', (e) => {
      const keys = this.TABS.map(t => t[0]), i = keys.indexOf(this.tab);
      const j = e.key === 'ArrowRight' ? (i + 1) % keys.length : e.key === 'ArrowLeft' ? (i - 1 + keys.length) % keys.length : e.key === 'Home' ? 0 : e.key === 'End' ? keys.length - 1 : -1;
      if (j < 0) return;
      e.preventDefault(); this.showTab(keys[j]); $('tab-' + keys[j]).focus();
    });
    /* "Geçmiş": the season picker (a select, and ‹ › for the neighbouring seasons); a club's page: the head-to-head's opponent */
    pane.addEventListener('change', (e) => {
      const s = /** @type {HTMLSelectElement} */ (e.target);
      if (s.matches('.hist-sel')) this.pickSeason(s.value);
      else if (s.matches('.h2h-sel')) {
        this.clubOpp = s.value; this.paneKey = ''; this.renderPane();
        const again = /** @type {HTMLElement} */ (document.querySelector('#livePane .h2h-sel')); if (again) again.focus();
      }
    });
    pane.addEventListener('click', (e) => {
      /* a live match (a "Canlı" card, ⚽ in the fixture or next to a club): watch it */
      const w = /** @type {HTMLElement} */ (el(e).closest('[data-watch]')); if (w) { this.watchCh(w.dataset.watch, +w.dataset.from || 0); return; }
      /* "Lig tablosu" / "Yükselme ligi": the Tablo / Fikstür switch */
      const sb = /** @type {HTMLElement} */ (el(e).closest('[data-sub]'));
      if (sb) { this.pickSub(sb.dataset.sub); const f = /** @type {HTMLElement} */ (document.querySelector(`#livePane [data-sub="${sb.dataset.sub}"]`)); if (f) f.focus({ preventScroll: true }); return; }
      const b = /** @type {HTMLButtonElement} */ (el(e).closest('.hist-nav')); if (b && !b.disabled) { this.pickSeason(b.dataset.season); return; }
      const t = /** @type {HTMLElement} */ (el(e).closest('[data-team]')); if (t) { this.openClub(t.dataset.team); return; }
      if (el(e).closest('[data-back]')) this.closeClub();
    });
    pane.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.club) { e.preventDefault(); this.closeClub(); } });
    /* the charts (İstatistik, club pages) are drawn for the pane's width: redraw after a resize */
    let rz = 0;
    window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (this.tab === 'stats' || this.club) { this.paneKey = ''; this.renderPane(); } }, 250); });
    const bar = document.createElement('div');
    bar.id = 'liveBar';
    bar.innerHTML = `<button type="button" id="liveSound" aria-pressed="false">🔇 Ses kapalı</button>`
      + `<button type="button" id="liveList" class="hidden" title="Canlı ve az sonra başlayacak maçlar">‹<span class="lbl"> Maçlar</span></button><span id="liveInfo"></span>`
      + `<button type="button" id="liveShare" class="hidden" aria-label="Paylaş" title="Bu maçın bağlantısı: açan kişi maçı baştan izler">🔗<span class="lbl" aria-hidden="true"> Paylaş</span></button>`
      + `<button type="button" id="liveAgain" class="hidden" aria-label="Baştan" title="Maçı baştan oynat">↻<span class="lbl" aria-hidden="true"> Baştan</span></button><a id="liveBack" class="hidden" href="${esc(this.siteUrl())}">⚽ Canlıya dön</a>`;
    $('stage').appendChild(bar);
    $('liveShare').addEventListener('click', () => this.share());
    $('liveAgain').addEventListener('click', () => this.startReplay());
    $('liveList').addEventListener('click', () => this.listView());
    if (this.replay) {
      /* a replayed match: no tabs (they would show no league), a tag on top says what is being replayed */
      document.body.classList.add('replay');
      const tag = document.createElement('div');
      tag.id = 'replayTag'; tag.textContent = `▶ Tekrar · ${this.replay.label}`;
      $('stage').appendChild(tag);
      pane.classList.add('hidden');
      $('liveBack').classList.remove('hidden'); $('liveAgain').classList.remove('hidden');
    }
    $('liveSound').addEventListener('click', () => {
      this.sound = !this.sound;
      if (this.sound) { AudioSys.init(); AudioSys.resume(); }
      AudioSys.muted = !this.sound; if (AudioSys.ctx) AudioSys.apply();
      $('liveSound').textContent = this.sound ? '🔊 Ses açık' : '🔇 Ses kapalı';
      $('liveSound').setAttribute('aria-pressed', String(this.sound));
    });
    if (!this.replay) this.showTab(this.tab);
  },
  /* bottom bar: the match watched (or how often matches are), and the next kick-off */
  info(now) {
    if (this.replay) return `▶ Tekrar · ${this.replay.label}`;
    if (this.notice && Date.now() < this.noticeUntil) return this.notice;
    if (this.phase === 'loading' || this.phase === 'error') return 'Lig yükleniyor…';
    const next = this.cur ? this.kickoffOf(this.cur.n + 1) : this.nextStart();
    if (!this.count() && this.phase === 'wait') return `Lig ${LivePages.day(next).split(' ').slice(0, 2).join(' ')} ${this.clock(next)}'te başlıyor`;
    const on = this.watched(), what = on ? `${LivePages.what(on.ch, on.s.cup ? { cup: on.s.cup } : on.s)} · ` : this.watch ? `${this.watch === 'promo' ? 'Yükselme ligi' : 'Lig'} · ` : '';
    return `${what}Her ${this.every(now)} dk'da maç · sıradaki ${this.clock(next)}`;
  },
  /* the match on the canvas (one of the slot's), or null */
  watched() { return this.wm && App.game ? this.wm : null; },
  /* [key, label, short label for narrow screens] */
  TABS: [['live', '⚽ Canlı', ''], ['table', 'Lig tablosu', 'Tablo'], ['promo', 'Yükselme ligi', 'Yükselme'], ['history', 'Geçmiş', ''], ['stats', 'İstatistik', 'İstat.']],
  tab: 'table', paneKey: '',
  /* "Lig tablosu" / "Yükselme ligi": the sub-tab shown ('table' | 'fixture'); the site opens on the league's fixture */
  sub: { table: 'fixture', promo: 'table' },
  scrollCur: true,          // scroll the fixture to the current week on its next drawing
  watchFrom: 0,             // the viewer picked a match that starts later: the channel's matches before that slot are not loaded
  histSel: '',              // "Geçmiş": the selected season's key (LivePages.histList; '' = the latest finished one)
  club: '',                 // a club's page is open over the tab (StatsPages.club)
  clubOpp: '',              // the club page's head-to-head opponent ('' = its next match's, see StatsPages.defaultOpp)
  pickSeason(k) { this.histSel = k; this.paneKey = ''; this.renderPane(); $('livePane').scrollTop = 0; },
  /* the open tab's sub-tab ("Lig tablosu" / "Yükselme ligi": 'table' | 'fixture'; other tabs: '') */
  subOf(tab = this.tab) { return this.sub[tab] || ''; },
  pickSub(v) {
    if (!(this.tab in this.sub) || (v !== 'table' && v !== 'fixture')) return;
    this.sub[this.tab] = v; this.paneKey = ''; this.scrollCur = this.wantsScroll(); $('livePane').scrollTop = 0; this.renderPane();
  },
  /* the page shows a fixture (or the old format's knockout): scroll to its current week */
  wantsScroll() { return this.subOf() === 'fixture' || (this.tab === 'promo' && !League.promoOn()); },
  openClub(id) {
    this.club = id; this.clubOpp = ''; this.paneKey = ''; this.renderPane(); $('livePane').scrollTop = 0;
    const h = $('tmTitle'); if (h) h.focus();
  },
  closeClub() {
    const id = this.club;
    this.club = ''; this.paneKey = ''; this.renderPane();
    const b = /** @type {HTMLElement} */ (document.querySelector(`#livePane [data-team="${CSS.escape(id)}"]`));
    if (b) b.focus(); else $('tab-' + this.tab).focus();
  },
  /* click: the "Canlı" tab while a match is on the canvas goes back to the list of matches */
  showTab(tab, click) {
    if (click && tab === 'live' && this.tab === 'live' && this.watch) { this.unload(); this.watch = ''; }
    this.tab = tab; this.paneKey = ''; this.club = '';
    if (tab === 'history') this.histSel = '';                 // opening the tab always starts at the latest season
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#liveTabs button')).forEach(b => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
    });
    const watching = tab === 'live' && !!this.watch;
    document.body.classList.toggle('watching', watching);
    $('livePane').classList.toggle('hidden', watching);
    $('livePane').setAttribute('aria-labelledby', 'tab-' + tab);
    $('tab-live').setAttribute('aria-controls', watching ? 'c' : 'livePane');
    $('liveList').classList.toggle('hidden', !watching);
    this.scrollCur = this.wantsScroll();
    $('livePane').scrollTop = 0;
    this.renderPane();
  },
  /* watch channel ch ('main' the league, 'promo' the promotion league) on the canvas; from: the slot the viewer picked (a match that
     starts later: the channel's match on now is not loaded) */
  watchCh(ch, from = 0) {
    if (ch !== 'main' && ch !== 'promo') return;
    if (this.watch !== ch || from !== this.watchFrom) this.unload();
    this.watch = ch; this.watchFrom = from;
    this.showTab('live');
  },
  /* back to the list of matches */
  listView() { this.unload(); this.watch = ''; this.showTab('live'); $('tab-live').focus(); },
  /* take the watched match off the canvas (the slot goes on: every match is recorded at its final whistle) */
  unload() {
    this.wm = null;
    App.game = null; App.end = null; App.running = false; App.intro = null; App.setup = null;
  },
  /* the open tab is redrawn only when the league changes (a match ends, a new one starts) */
  renderPane() {
    if ((this.tab === 'live' && this.watch) || this.replay) return;
    const pane = $('livePane');
    if (this.phase === 'loading' || this.phase === 'error') {
      const p = this.progress, key = ['loading', this.phase, p ? p.done : 0].join('|');
      if (key === this.paneKey) return;
      this.paneKey = key;
      pane.innerHTML = `<div class="lp-in"><h2>${this.phase === 'error' ? 'Bir sorun oluştu' : 'Lig yükleniyor…'}</h2><div class="lp-sub">${this.phase === 'error' ? esc(this.err || '') : p ? `${p.done} maç hesaplandı` : 'Maçlar tarayıcınızda hesaplanıyor.'}</div></div>`;
      return;
    }
    const d = League.data, now = this.now(), lv = this.liveMap(now);
    const pk = d.promo ? d.promo.history.length : 0, ck = d.cup ? Object.keys(d.cup.res).length : 0;
    /* the history tab shows one finished season only: it is built (and redrawn) when the selection or the archive changes, nothing else */
    const key = this.club ? ['club', this.club, this.clubOpp, d.season, d.history.length, pk, (d.seasons || []).length, ck].join('|')
      : this.tab === 'history' ? ['history', this.histSel, (d.seasons || []).length].join('|')
      : this.tab === 'stats' ? ['stats', d.season, d.history.length, pk, (d.seasons || []).length].join('|')
      : this.tab === 'live' ? ['live', this.count(), this.cur ? this.cur.n : -1, lv.sig, this.upcoming(now).map(x => x.n).join()].join('|')
      : [this.tab, this.subOf(), d.season, d.history.length, pk, ck, this.count(), lv.sig].join('|');
    if (key === this.paneKey) return;
    this.paneKey = key;
    const html = this.club ? StatsPages.club(this.club, this.clubOpp) : this.tab === 'table' || this.tab === 'promo' ? LivePages.division(this.tab, this.subOf(), lv)
      : this.tab === 'history' ? LivePages.history() : this.tab === 'stats' ? StatsPages.page() : LivePages.live(now);
    pane.innerHTML = `<div class="lp-in">${html}</div>`;
    if (this.tab === 'live') this.tickCountdowns(now, true);
    if (this.scrollCur && !this.club) {
      this.scrollCur = false;
      const cur = /** @type {HTMLElement} */ (document.querySelector('#livePane .fx-week.cur'));
      if (cur) cur.scrollIntoView({ block: 'start' });
    }
  },
  /* "Canlı": the countdowns to the coming kick-offs (spans with data-at = ms) */
  tickCountdowns(now, force) {
    if (this.tab !== 'live' || this.watch) return;
    const sec = Math.floor(now / 1000);
    if (!force && sec === this._cd) return;
    this._cd = sec;
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#livePane [data-at]')).forEach(e => {
      const s = Math.max(0, Math.ceil((+e.dataset.at - now) / 1000));
      e.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    });
  },
  /* the slots that start within SOON: [{ n, at (ms), ms: peek(n) }] */
  upcoming(now) {
    const out = [];
    if (this.phase !== 'wait' && this.phase !== 'match') return out;
    for (let n = this.cur ? this.cur.n + 1 : this.count(), k = 0; k < 20; n++, k++) {
      const at = this.kickoffOf(n);
      if (at > now + this.SOON) break;
      out.push({ n, at, ms: this.peek(n) });
    }
    return out;
  },
  /* a slot kicked off: its matches play (each league's channel); the one the viewer watches is loaded when the frame loop gets to it */
  startSlot(m) { this.cur = m; this.pending = null; this.phase = 'match'; this.wm = null; },
  /* load a match of the slot on the canvas: it is replayed from its kick-off up to now (advanceWatched) */
  startWatch(M) {
    App.load(M.s);
    if (!App.game) { this.phase = 'error'; this.err = M.s.err || ''; return; }
    App.running = true; App.paused = false;
    this.wm = M; this.st = { acc: 0 }; this.simT = 0; this.joined = false;
    const g = App.game, fx = g.onEvent;
    g.onEvent = (t, d) => { if (fx) fx(t, d); this.onGameEvent(t, d); };
  },
  /* the slot on now: the watched channel's match plays on the canvas; every other match is written into its league at its final
     whistle (the watched one by App.onOver, with its end screen); the slot is over when its longest match's screens are over */
  advanceSlot(now) {
    const m = this.cur, W = this.watch ? m.ms.find(M => M.ch === this.watch) : null;
    if (W && this.wm !== W && !W.s.recorded && now < W.over && m.n >= this.watchFrom) this.startWatch(W);
    if (this.wm) this.advanceWatched(now);
    for (const M of m.ms) if (M !== this.wm && !M.s.recorded && now >= M.over) this.recordOne(M);
    if (now >= m.start + m.dur * 1000) this.finishSlot();
  },
  /* fixed 60 fps steps up to the wall clock (so every viewer stays in sync); the match's screens end at its computed length */
  advanceWatched(now) {
    const M = this.wm, target = Math.min((now - M.start) / 1000, M.dur), rdt = 1 / 60;
    const enabled = AudioSys.enabled;
    this.ff = target - this.simT > 0.5;
    if (this.ff) AudioSys.enabled = false;                       // no burst of sounds (or announcements) while fast-forwarding
    try {
      while (this.simT + rdt <= target) { Offline.stepFrame(this.st, rdt); this.simT += rdt; }
    } finally { AudioSys.enabled = enabled; this.ff = false; }
    if (!this.joined) {                                          // the first frame of this match on this screen
      this.joined = true;
      const g = App.game;
      if (g && this.simT > 3 && !g.over) this.say(`Canlı maç sürüyor: ${this.scoreText(g)}.`);
    }
    if ((now - M.start) / 1000 >= M.dur) {                       // its end screen is over: the channel waits for its next match
      const g = App.game;
      if (g && !App.end) { while (!g.over) g.step(DT); App.onOver(); }   // safety: the result is always recorded
      this.unload();
    }
  },
  finishSlot() {
    this.record(this.cur);                                       // the matches not recorded yet (safety) and the slot itself
    this.cur = null; this.unload();
    this.saveCache();
    this.phase = 'wait';
  },
  frame(t) {
    if (this.phase === 'replay') { this.replayFrame(); requestAnimationFrame((tt) => this.frame(tt)); return; }
    const now = this.now();
    try {
      if (this.phase !== 'loading' && this.lastFrame && now - this.lastFrame > this.RESYNC_GAP) {
        this.lastFrame = now; this.sync();                         // the tab slept: rebuild from the newest saved state
      } else {
        if (this.phase !== 'loading') this.lastFrame = now;
        if (this.phase === 'wait' && this.nextStart() <= now) {
          if (!this.pending || this.pending.n !== this.count()) this.pending = this.computeNext();
          const m = this.pending;
          if (m.start + m.dur * 1000 <= now) { this.record(m); this.saveCache(); }   // already over
          else this.startSlot(m);
        } else if (this.phase === 'wait' && !this.pending && !this.prepTimer) {
          /* use the quiet time between slots to compute the next one (no hitch at kick-off) */
          this.prepTimer = setTimeout(() => { this.prepTimer = null; try { if (this.phase === 'wait' && !this.pending) this.pending = this.computeNext(); } catch (e) { /* retried at kick-off */ } }, 300);
        }
        if (this.phase === 'match') this.advanceSlot(now);
      }
    } catch (e) { console.error(e); this.phase = 'error'; this.err = String(e && e.message || e); }
    this.renderPane();
    this.tickCountdowns(now);
    const info = this.info(now);
    if (info !== this._info && $('liveInfo')) { this._info = info; $('liveInfo').textContent = info; }
    const canShare = !!this.watched();
    if (canShare !== this._canShare && $('liveShare')) { this._canShare = canShare; $('liveShare').classList.toggle('hidden', !canShare); }
    if (this.tab !== 'live' || !this.watch) { /* a page covers the canvas: the watched match keeps running in sync, nothing to draw */ }
    else if (this.watched()) Renderer.draw(App.game, App);
    else LiveScreen.draw(Renderer.ctx, this, now, this.watch);
    requestAnimationFrame((tt) => this.frame(tt));
  },
};

/* the watched channel between its matches: that league's table and the countdown to its next kick-off */
const LiveScreen = {
  draw(ctx, L, now, ch = 'main') {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    FX.update(0, 1 / 60);
    Renderer.background(THEMES.classic);
    if (L.phase === 'loading' || L.phase === 'error') {
      outlinedText(ctx, L.phase === 'error' ? 'SOMETHING WENT WRONG' : 'LOADING LEAGUE…', 510, 900, `90px ${FONT_BIG}`, '#ffffff', null, 0);
      const p = L.progress, sub = L.phase === 'error' ? (L.err || '') : p ? `${p.done} MATCHES` : '';
      if (sub) outlinedText(ctx, sub, 510, 990, `600 34px ${FONT_UI}`, 'rgba(255,255,255,0.7)', null, 0);
      return;
    }
    const d = League.data, promo = ch === 'promo';
    if (promo && !League.promoOn()) {
      outlinedText(ctx, 'PROMOTION LEAGUE', 510, 880, `96px ${FONT_BIG}`, '#ffffff', null, 0);
      outlinedText(ctx, 'STARTS WITH THE NEXT SEASON', 510, 970, `600 34px ${FONT_UI}`, 'rgba(255,255,255,0.7)', null, 0);
      return;
    }
    /* this channel's next match: the first slot from the next one (or the one the viewer picked) that has a match for it */
    const from = Math.max(L.cur ? L.cur.n + 1 : L.count(), L.watchFrom || 0);
    let nx = null, nn = from;
    for (let k = 0; k < 80; k++, nn++) { nx = L.peek(nn).find(x => x.ch === ch) || null; if (nx) break; }
    const next = L.kickoffOf(nx ? nn : from), ids = nx ? nx.ids.filter(Boolean) : [];
    const cm = nx && nx.cup ? nx : null;
    const sc = !promo && (League.cupPhase() || League.mainOver()) ? League.seasonChange() : null;   // the league is over: the final table shows the champion and the relegated clubs
    const rk = promo ? League.promoRanking() : League.ranking(), hist = promo ? d.promo.history : d.history;
    const rows = rk.map((x, i) => {
      const f = League.formOf(x.t.id, hist), gd = x.r.gf - x.r.ga, playing = ids.includes(x.t.id);
      return { id: x.t.id, name: x.t.name, c1: x.t.c1, c2: x.t.c2, today: playing, oldRank: i, newRank: i,
        champ: !!sc && x.t.id === sc.champion.id, out: !!sc && sc.out.some(t => t.id === x.t.id),
        oldPts: x.r.pts, newPts: x.r.pts, played: x.r.played, dPlayed: 0, oldGd: gd, newGd: gd, res: null, delta: null, oldForm: f, newForm: f };
    });
    const last = d.champions.length ? d.champions[d.champions.length - 1] : null;
    const sub = promo ? (League.promoLeagueOver() ? `SEASON ${d.season} · FINAL TABLE · TOP ${PO_SIZE} TO THE PLAYOFFS` : `SEASON ${d.season} · AFTER ${hist.length} MATCHES`)
      : sc ? `SEASON ${d.season} · FINAL TABLE` : d.history.length ? `SEASON ${d.season} · AFTER ${d.history.length} MATCHES` : last ? `🏆 ${upTR(last.name)} · SEASON ${last.season} CHAMPIONS` : `SEASON ${d.season}`;
    LeagueTable.draw(ctx, rows, promo ? 'PROMOTION LEAGUE' : 'LEAGUE TABLE', sub, { tt: 99, post: false, alpha: 1, po: promo && d.promo.po ? PO_SIZE : 0 });
    /* next match box: who plays, the kick-off and the countdown */
    const X0 = 70, W = 880, y = 1668, h = 200;
    roundRect(ctx, X0, y, W, h, 28);
    ctx.fillStyle = 'rgba(0,200,83,0.13)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#00E676'; ctx.stroke();
    const label = !nx ? 'NEXT SEASON' : cm ? `NEXT · PLAYOFF · ${cupName(cm.cup)[0]}` : `NEXT · ${promo ? 'PROMO · ' : ''}WEEK ${nx.week} · MATCH ${nx.wm}`;
    outlinedText(ctx, label, X0 + 30, y + 42, `44px ${FONT_BIG}`, '#ffffff', null, 0, 'left');
    outlinedText(ctx, `KICK-OFF ${L.clock(next)} (TR)`, X0 + W - 30, y + 42, `600 24px ${FONT_UI}`, '#00E676', null, 0, 'right');
    const s = Math.max(0, Math.ceil((next - now) / 1000));
    const hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60, p2 = (v) => String(v).padStart(2, '0');
    const tms = ids.map(id => d.teams.find(t => t.id === id) || League.poolTeam(id)).filter(Boolean);
    const cy = y + 122;
    outlinedText(ctx, `${hh ? hh + ':' : ''}${p2(mm)}:${p2(ss)}`, X0 + W / 2, cy + 4, `100px ${FONT_BIG}`, '#ffffff', null, 0);
    outlinedText(ctx, 'STARTS IN', X0 + W / 2, y + 180, `600 20px ${FONT_UI}`, 'rgba(255,255,255,0.6)', null, 0);
    /* home club on the left, away club on the right of the countdown */
    if (tms.length === 2) {
      ctx.save();
      const nameW = 220;
      tms.forEach((t, i) => {
        const right = i === 1, dx = right ? X0 + W - 44 : X0 + 44;
        ctx.beginPath(); ctx.arc(dx, cy, 14, 0, TAU); ctx.fillStyle = t.c1; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = t.c2; ctx.stroke();
        let fs = 42; ctx.font = `${fs}px ${FONT_BIG}`;
        while (ctx.measureText(upTR(t.name)).width > nameW && fs > 20) { fs -= 2; ctx.font = `${fs}px ${FONT_BIG}`; }
        outlinedText(ctx, upTR(t.name), right ? dx - 24 : dx + 24, cy + 2, `${fs}px ${FONT_BIG}`, '#ffffff', null, 0, right ? 'right' : 'left');
      });
      ctx.restore();
    }
  },
};

/* the "Canlı", "Lig tablosu", "Yükselme ligi" (each with its "Fikstür" sub-tab) and "Geçmiş" tabs (HTML, Turkish like the rest of the site's controls).
   lv (Live.liveMap): the matches on now — they get a ⚽ button (data-watch) in the fixture, and so do their clubs in the tables. */
const LivePages = {
  MONTHS: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  DAYS: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
  local(ms) { return new Date(ms + Live.cfg().utcOffset * 3600e3); },
  day(ms) { const t = this.local(ms); return `${t.getUTCDate()} ${this.MONTHS[t.getUTCMonth()]} ${this.DAYS[t.getUTCDay()]}`; },
  dot(t) { return `<span class="dot" style="background:${esc(t.c1)};border-color:${esc(t.c2)}" aria-hidden="true"></span>`; },
  /* a club's name that opens its page (StatsPages.club); a club the league does not know stays plain text */
  tlink(t) { return t && t.id && this.anyTeam(t.id) ? `<button type="button" class="tl" data-team="${esc(t.id)}">${esc(t.name)}</button>` : esc(t ? t.name : '?'); },
  /* a finished season's playoff bracket (Live.archiveSeason's compact form) as { draw, res } for League.cupMatchesOf */
  cupOf(rec) {
    return { draw: rec.cup.draw, res: Object.fromEntries(Object.entries(rec.cup.res).map(([k, r]) => [k, Object.assign({ winner: r[0], loser: r[1], sw: r[2], sl: r[3], t: r[4] * 60000 },
      r.length >= 7 ? { pw: r[5], pl: r[6] } : r.length === 6 ? { gg: 1 } : {})])) };
  },
  champ() {
    const c = League.data.champions, last = c[c.length - 1];
    return last ? `<div class="lp-note">🏆 Sezon ${last.season} şampiyonu: <b>${esc(last.name)}</b></div>` : '';
  },
  champs() {
    const c = League.data.champions.slice(-10).reverse();
    return c.length ? `<h3 class="lp-h3">Son şampiyonlar</h3><ol class="lp-champs">${c.map(x => `<li><span>Sezon ${x.season}</span><b>${this.tlink({ id: x.id, name: x.name })}</b><span>${x.pts} puan</span></li>`).join('')}</ol>` : '';
  },
  /* kick-off of a season's match: the actual one once played (or next), the planned slot otherwise */
  kickoff(w, m) {
    const d = League.data, h = d.history.find(x => x.week === w && x.weekMatch === m);
    return this.kickAt(Live.matchIndex(w, m), h && h.date);
  },
  /* ...of the season's i-th promotion league match */
  promoKickoff(i) {
    const p = League.data.promo, h = p.history[i];
    return this.kickAt(Live.promoIndex(i), h && h.date);
  },
  /* kick-off of live slot n: the actual one once played (date) or on / next, the planned slot otherwise; late: after its slot */
  kickAt(n, date) {
    if (date) { const t = Date.parse(date); return { t, late: t - Live.slot(n) > 1000 }; }
    if (n === Live.count()) { const t = Live.nextStart(); return { t, late: t - Live.slot(n) > 1000 }; }
    return { t: Live.slot(n), late: false };
  },
  /* a match's name: "Lig · 5. hafta 3. maç", "Yükselme ligi · 7. hafta 2. maç", "Yükselme elemesi · Yarı final 1" (x: { week, weekMatch | wm } or { cup }) */
  what(ch, x) {
    if (x.cup) return `${ch === 'promo' ? 'Yükselme elemesi' : 'Eleme'} · ${cupName(x.cup)[1]}`;
    return `${ch === 'promo' ? 'Yükselme ligi' : 'Lig'} · ${x.week}. hafta ${x.weekMatch || x.wm}. maç`;
  },
  /* ⚽: the match is on now, the button opens it (Live.watchCh) */
  liveBtn(ch, label) { return `<button type="button" class="b live" data-watch="${ch}" title="Canlı maçı izle"><span aria-hidden="true">⚽</span> ${label || 'CANLI · İzle'}</button>`; },
  ball(id, lv, name) {
    const ch = lv && lv.teams.get(id);
    return ch ? `<button type="button" class="lv-ball" data-watch="${ch}" title="Canlı maçını izle" aria-label="${esc(name || '')} şu an oynuyor: canlı maçı izle">⚽</button>` : '';
  },
  bandsText() {
    const B = Live.cfg().bands;
    if (B.length === 1) return `günün her saatinde her ${B[0].every} dk'da bir`;
    return B.map((b, i) => `${b.from}–${B[(i + 1) % B.length].from} her ${b.every} dk`).join(' · ');
  },
  /* a 1v1 league table (the running season's and a finished season's): list = [{ t: club, r: { played, pts, w, d, l, gf, ga }, form: ['W', …], rel, po }]
     in rank order (rel: goes down, po: playoff place); lv: the clubs playing now get a ⚽ */
  tableHtml(list, lv) {
    const rows = list.map((x, i) => {
      const av = x.r.gf - x.r.ga;
      return `<tr class="${x.rel ? 'rel' : x.po ? 'po' : ''}"><td>${i + 1}</td><td class="tn">${this.dot(x.t)}${this.tlink(x.t)}${this.ball(x.t.id, lv, x.t.name)}</td><td>${x.r.played}</td>` +
        `<td class="opt">${x.r.w}</td><td class="opt">${x.r.d}</td><td class="opt">${x.r.l}</td><td class="opt">${x.r.gf}</td><td class="opt">${x.r.ga}</td><td>${av > 0 ? '+' : ''}${av}</td><td><b>${x.r.pts}</b></td><td class="form">${formHtml(x.form)}</td></tr>`;
    }).join('');
    return `<table class="lp-table"><thead><tr><th scope="col">#</th><th scope="col">Takım</th><th scope="col" title="Oynanan">O</th><th scope="col" class="opt" title="Galibiyet">G</th><th scope="col" class="opt" title="Beraberlik">B</th><th scope="col" class="opt" title="Mağlubiyet">M</th><th scope="col" class="opt" title="Atılan gol">AG</th><th scope="col" class="opt" title="Yenilen gol">YG</th><th scope="col" title="Averaj">AV</th><th scope="col" title="Puan">P</th><th scope="col" title="Son ${CONFIG.FORM_COUNT} maç (en sağdaki en yeni)">Son ${CONFIG.FORM_COUNT}</th></tr></thead><tbody>${rows}</tbody></table>`;
  },
  /* a finished season of the old group-match league (6 clubs a match, points by place) */
  tableHtmlGroup(list) {
    const rows = list.map((x, i) => {
      const av = x.r.gf - x.r.ga;
      return `<tr class="${x.rel ? 'rel' : ''}"><td>${i + 1}</td><td class="tn">${this.dot(x.t)}${this.tlink(x.t)}</td><td>${x.r.played}</td><td><b>${x.r.pts}</b></td>` +
        `<td class="opt">${x.r.wins}</td><td class="opt">${x.r.gf}</td><td class="opt">${x.r.ga}</td><td>${av > 0 ? '+' : ''}${av}</td><td class="form">${formHtml(x.form)}</td></tr>`;
    }).join('');
    return `<table class="lp-table"><thead><tr><th scope="col">#</th><th scope="col">Takım</th><th scope="col" title="Oynanan">O</th><th scope="col" title="Puan">P</th><th scope="col" class="opt" title="Birincilik">1.</th><th scope="col" class="opt" title="Atılan gol">AG</th><th scope="col" class="opt" title="Yenilen gol">YG</th><th scope="col" title="Averaj">AV</th><th scope="col" title="Son ${CONFIG.FORM_COUNT} maçtaki sırası">Son ${CONFIG.FORM_COUNT}</th></tr></thead><tbody>${rows}</tbody></table>`;
  },
  pointsText(p) { return `Galibiyet ${p[0]}, beraberlik ${p[1]}, mağlubiyet ${p[2]} puan`; },
  table(lv) {
    const d = League.data, rk = League.ranking(), out = rk.length - Math.min(CONFIG.RELEGATE_COUNT, d.reserve.length);
    const list = rk.map((x, i) => ({ t: x.t, r: x.r, form: League.formOf(x.t.id), rel: i >= out }));
    const up = League.promoOn() ? `; yerlerine yükselme liginin ilk ${PO_SIZE} takımının elemesinde ilk 3'e girenler çıkar (Yükselme ligi sekmesi)`
      : League.cupOn() ? `; yerlerine havuzdaki ${CONFIG.CUP_SIZE} takımın eleme maçlarında ilk 3'e girenler çıkar (Yükselme sekmesi)` : '';
    return `<h2>Lig tablosu</h2><div class="lp-sub">Sezon ${d.season} · ${d.history.length} / ${d.seasonLength * App.perWeek()} maç oynandı</div>${this.champ()}
      ${this.tableHtml(list, lv)}
      <div class="lp-legend">${this.pointsText(d.points)} · Sıralama: puan → averaj → atılan gol → aralarındaki maç → kura · ⚽: şu an maçı olan takım (dokunun: canlı izleyin) · Kırmızı çizgili son ${CONFIG.RELEGATE_COUNT} takım sezon sonunda ligden düşer${up}.</div>${this.champs()}`;
  },
  /* kick-off of a playoff match: the actual one once played (or next), the planned slot otherwise */
  cupKickoff(i, m) {
    if (m.res && m.res.date) { const t = Date.parse(m.res.date); return { t, late: t - Live.slot(Live.cupIndex(i)) > 1000 }; }
    const n = Live.cupIndex(i);
    if (n === Live.count()) { const t = Live.nextStart(); return { t, late: t - Live.slot(n) > 1000 }; }
    return { t: Live.slot(n), late: false };
  },
  /* "▶ İzle": the link that replays a finished match (Live.replayLink) */
  replayA(m) { return `<a class="fx-rp" href="${esc(Live.replayLink(m))}" title="Bu maçı baştan izle (bağlantıyı paylaşabilirsiniz)">▶ İzle</a>`; },
  /* one 1v1 match as two lines (home first), with the goals once played; note: "altın gol" / "penaltılar 4–3" */
  pairHtml(a, b, sa, sb, done, win, ph) {
    const nm = (t, p) => (t ? `<li>${this.dot(t)}<span class="nm">${this.tlink(t)}</span>` : `<li class="tbd"><span class="nm">${p}</span>`);
    const side = (t, sc, w, p) => nm(t, p) + (done ? `<span class="pt ${w ? 'g' : ''}">${sc}</span>` : '') + '</li>';
    return `<ol class="res pair">${side(a, sa, win === 'a', ph ? ph[0] : '—')}${side(b, sb, win === 'b', ph ? ph[1] : '—')}</ol>`;
  },
  /* the bracket's rounds as HTML (the running playoff and a finished season's).
     o: { team(id) → club or null, kick(match) → { t: ms, late }, lv: the matches on now (Live.liveMap), ch: their channel,
     seed(ref) → "1." for the promotion league's places } */
  cupRounds(ms, c, o) {
    /* a slot whose club is not decided yet: "Çeyrek final 1 galibi" (the promotion league's playoff: "Yükselme ligi 1.si") */
    const tbd = (ref) => ref[0] === 's' ? (o.seed ? o.seed(+ref.slice(1)) : '—') : `${cupName(ref.slice(1))[1]} ${ref[0] === 'w' ? 'galibi' : 'mağlubu'}`;
    return CUP_ROUNDS_TR.map((rn, r) => {
      const list = ms.filter(m => m.r === r);
      if (!list.length) return '';
      const cur = list.some(m => !m.res) && !ms.some(m => m.r < r && !m.res);
      const body = list.map(m => {
        const K = o.kick(m), isLive = !!o.lv && o.lv.keys.has('c-' + m.k), def = m.def, R = m.res;
        const badge = (R ? '<span class="b done">Bitti</span>' : isLive ? this.liveBtn(o.ch || 'main') : '')
          + (R && R.seed !== undefined && R.date ? this.replayA({ seed: R.seed, ids: [m.a, m.b], theme: R.theme, cup: m.k, start: Date.parse(R.date) }) : '');
        const aWin = !!R && R.winner === m.a, sc = (w) => (w ? R.sw : R.sl);
        const note = R ? (R.pw !== undefined ? `<div class="fx-note">Penaltılar ${aWin ? R.pw : R.pl}–${aWin ? R.pl : R.pw}</div>` : R.gg ? '<div class="fx-note">Altın gol</div>' : '') : '';
        return `<div class="fx-match${R ? ' done' : ''}${isLive ? ' live' : ''}"><div class="fx-head"><b>${cupName(m.k)[1]}</b><span>${Live.clock(K.t)}${K.late ? ' · ertelendi' : ''}</span>${badge}</div>`
          + this.pairHtml(o.team(m.a), o.team(m.b), R ? sc(aWin) : 0, R ? sc(!aWin) : 0, !!R, R ? (aWin ? 'a' : 'b') : '', [tbd(def.a), tbd(def.b)]) + note + '</div>';
      }).join('');
      const k0 = o.kick(list[0]).t;
      const byes = r === 0 && c.draw.length > PO_SIZE ? `<div class="lp-legend" style="margin:0 0 4px">Bay geçenler: ${c.draw.slice(0, 4).map(id => esc((o.team(id) || {}).name || '?')).join(', ')}</div>` : '';
      return `<section class="fx-week${cur ? ' cur' : ''}"><h3>${rn}<span>${k0 ? `${this.day(k0)} · ${Live.clock(k0)}` : ''}</span></h3>${byes}${body}</section>`;
    }).join('');
  },
  /* a season of the old format: the promotion playoff of the pool clubs, played after the season's league matches */
  cup(lv) {
    const d = League.data, total = CONFIG.CUP_SIZE;
    const head = `<h2>Yükselme eleme maçları</h2>`;
    if (!League.cupOn()) return `${head}<div class="lp-sub">Bu ligde eleme maçı yok: havuz ${total} takım değil, sezon sonunda havuzun sıradaki takımları ligdekilerle yer değiştirir.</div>`;
    const guide = `<div class="lp-legend">Sezonun lig maçları bittikten sonra havuzdaki ${total} takım kura ile eşleşir ve tek maçlık eleme oynar (${CONFIG.MATCH_TIME} sn, rövanş yok; berabere biterse en fazla ${CONFIG.GOLDEN_TIME} sn altın gol, yine berabereyse penaltılar). `
      + `Kurada ilk 4 takım 1. turu bay geçer. <b>Final galibi, finalist ve 3.lük maçının galibi</b> ligi yükselir; ligin son ${CONFIG.RELEGATE_COUNT} takımı havuza düşer.</div>`;
    const c = League.cup(), ms = League.cupMatches();
    if (!c) {
      return `${head}<div class="lp-sub">Sezon ${d.season} · lig maçları bitince başlar (${d.history.length} / ${d.seasonLength * App.perWeek()} maç oynandı)</div>${this.champ()}${guide}`
        + `<h3 class="lp-h3">Havuzdaki takımlar</h3><ul class="lp-pool">${d.reserve.map(t => `<li>${this.dot(t)}${this.tlink(t)}</li>`).join('')}</ul>`;
    }
    const rounds = this.cupRounds(ms, c, { team: (id) => League.poolTeam(id), kick: (m) => this.cupKickoff(m.i, m), lv, ch: 'main' });
    const top = League.cupTop3();
    const done = top ? `<div class="lp-note">🔺 Yükselenler: <b>${top.map(t => esc(t.name)).join(', ')}</b></div>` : '';
    return `${head}<div class="lp-sub">Sezon ${d.season} · ${ms.filter(m => m.res).length} / ${ms.length} maç oynandı</div>${this.champ()}${done}${guide}${rounds}`;
  },
  /* a club by id: ligde ya da havuzda (every club ever in the league is in one of the two; the old league used the same ids) */
  anyTeam(id) { const d = League.data; return d.teams.find(t => t.id === id) || d.reserve.find(t => t.id === id) || null; },
  /* every finished season for the "Geçmiş" tab, newest last: this league's, then (before them) the old group-match league's.
     key: 'n<season>' (this league) or 'o<season>' (the old league) */
  histList() {
    const lg = Live.legacy(), old = lg ? lg.seasons.map(r => ({ key: 'o' + r.season, old: true, rec: r })) : [];
    return old.concat((League.data.seasons || []).map(r => ({ key: 'n' + r.season, old: false, rec: r })));
  },
  /* the "Geçmiş" tab: ONE finished season at a time (the latest when the tab opens), picked from the list on top.
     Only the selected season is turned into HTML; the others stay as compact data in the league state. */
  history() {
    const list = this.histList(), head = '<h2>Geçmiş</h2>';
    const oldChamps = Live.legacy() && Array.isArray(Live.legacy().champions) ? Live.legacy().champions : [];
    if (!list.length) return `${head}<div class="lp-sub">Henüz biten sezon yok. Bir sezon bitince son tablosu ve yükselme eleme sonuçları burada görünür.</div>${this.champs()}`;
    const found = list.findIndex(x => x.key === Live.histSel), at = found >= 0 ? found : list.length - 1;
    const { rec, old } = list[at], team = (id) => this.anyTeam(id) || { name: id, c1: '#888', c2: '#fff' };
    const when = (min) => { const ms = min * 60000; return `${this.day(ms).split(' ').slice(0, 2).join(' ')} ${Live.clock(ms)}`; };
    const name = (x) => `${x.old ? 'Eski lig · ' : ''}Sezon ${x.rec.season} · 🏆 ${esc(team(x.rec.champ).name)}`;
    const opts = list.slice().reverse().map(x => `<option value="${x.key}"${x === list[at] ? ' selected' : ''}>${name(x)}</option>`).join('');
    const bar = `<div class="hist-bar"><button class="hist-nav" data-season="${at > 0 ? list[at - 1].key : ''}" title="Önceki sezon"${at > 0 ? '' : ' disabled'}>‹</button>`
      + `<select class="hist-sel" aria-label="Sezon seç">${opts}</select>`
      + `<button class="hist-nav" data-season="${at < list.length - 1 ? list[at + 1].key : ''}" title="Sonraki sezon"${at < list.length - 1 ? '' : ' disabled'}>›</button></div>`;
    const out = new Set(rec.out);
    let table;
    if (rec.f === 2) {
      const rows = rec.rows.map(r => ({ t: team(r[0]), r: { played: r[1], pts: r[2], w: r[3], d: r[4], l: r[5], gf: r[6], ga: r[7] }, form: r.slice(8), rel: out.has(r[0]) }));
      table = `${this.tableHtml(rows)}<div class="lp-legend">${this.pointsText(rec.p)} · Kırmızı çizgili ${rec.out.length} takım bu sezon sonunda ligden düştü.</div>`;
    } else {
      const rows = rec.rows.map(r => ({ t: team(r[0]), r: { played: r[1], pts: r[2], wins: r[3], gf: r[4], ga: r[5] }, form: r.slice(6), rel: out.has(r[0]) }));
      table = `${this.tableHtmlGroup(rows)}<div class="lp-legend">Eski format: 6 takımlık grup maçları · Puan: ${rec.p.map((p, k) => `${k + 1}. → ${p}`).join(' · ')} · Kırmızı çizgili ${rec.out.length} takım bu sezon sonunda ligden düştü.</div>`;
    }
    let cup;
    const ups = `<div class="lp-note">🔺 Yükselenler: <b>${rec.up.map(id => esc(team(id).name)).join(', ')}</b></div>`;
    const bracket = () => { const c = this.cupOf(rec); return this.cupRounds(League.cupMatchesOf(c), c, { team: (id) => this.anyTeam(id), kick: (m) => ({ t: m.res ? m.res.t : 0, late: false }) }); };
    if (rec.pl) {
      /* the promotion league (and its top 4's playoff) */
      const po = new Set(rec.cup ? rec.cup.draw : []);
      const rows = rec.pl.rows.map(r => ({ t: team(r[0]), r: { played: r[1], pts: r[2], w: r[3], d: r[4], l: r[5], gf: r[6], ga: r[7] }, form: r.slice(8), po: po.has(r[0]) }));
      cup = `<h3 class="lp-h3">Yükselme ligi</h3>${this.tableHtml(rows)}<div class="lp-legend">${rec.pl.n} maç · ${po.size ? `yeşil çizgili ilk ${po.size} takım yükselme elemesi oynadı` : 'ilk takımlar lige yükseldi'}.</div>`
        + (rec.cup ? `<h3 class="lp-h3">Yükselme elemesi</h3>${ups}${bracket()}` : ups);
    } else if (rec.cup) {
      cup = `<h3 class="lp-h3">Yükselme eleme maçları</h3>${ups}${bracket()}`;
    } else cup = `<h3 class="lp-h3">Yükselme</h3><div class="lp-note">Bu sezon eleme maçı yoktu; havuzun sıradaki takımları yükseldi: <b>${rec.up.map(id => esc(team(id).name)).join(', ')}</b></div>`;
    const span = rec.t0 ? ` · ${when(rec.t0)} – ${when(rec.t1)}` : '';
    const what = old ? `${rec.n} grup maçı (eski format)` : `${rec.n} lig maçı`;
    const oc = old && oldChamps.length ? `<h3 class="lp-h3">Eski lig şampiyonları</h3><ol class="lp-champs">${oldChamps.slice().reverse().map(x => `<li><span>Sezon ${x.season}</span><b>${esc(x.name)}</b><span>${x.pts} puan</span></li>`).join('')}</ol>` : '';
    return `${head}${bar}<div class="lp-sub">${old ? 'Eski lig · ' : ''}Sezon ${rec.season}${span} · ${what}</div>`
      + `<div class="lp-note">🏆 ${old ? 'Eski lig · ' : ''}Sezon ${rec.season} şampiyonu: <b>${esc(team(rec.champ).name)}</b></div>${table}${cup}${oc}`;
  },
  /* the "Lig tablosu" ('table') and "Yükselme ligi" ('promo') tabs: a Tablo / Fikstür switch on top, then the division's table or
     its fixture (sub: 'table' | 'fixture'; the site opens on the league's fixture) */
  division(tab, sub, lv) {
    const fx = sub === 'fixture', promo = tab === 'promo';
    const seg = `<div class="seg" role="group" aria-label="${promo ? 'Yükselme ligi' : 'Lig'}: tablo ya da fikstür">`
      + [['table', 'Tablo'], ['fixture', 'Fikstür']].map(([k, l]) => `<button type="button" data-sub="${k}" aria-pressed="${String((k === 'fixture') === fx)}"${(k === 'fixture') === fx ? ' class="on"' : ''}>${l}</button>`).join('') + '</div>';
    return seg + (promo ? (fx ? this.promoFixture(lv) : this.promo(lv)) : (fx ? this.mainFixture(lv) : this.table(lv)));
  },
  /* a division's fixture: 'main' (the league) or 'promo' (the promotion league) */
  fixture(lv, div = 'main') { return div === 'promo' ? this.promoFixture(lv) : this.mainFixture(lv); },
  /* one match of a fixture: its number, kick-off, result (or ⚽ when it is on now) and replay link */
  fxMatch(no, K, h, ids, team, isLive, ch, link) {
    const badge = (h ? '<span class="b done">Bitti</span>' : isLive ? this.liveBtn(ch) : '') + (h && h.date ? this.replayA(Object.assign({ seed: h.seed, ids: h.teams, theme: h.theme, start: Date.parse(h.date) }, link)) : '');
    let body;
    if (h && h.result.length === 2) {
      const [ra, rb] = h.result;
      body = this.pairHtml(team(ra.id), team(rb.id), ra.score, rb.score, true, ra.score > rb.score ? 'a' : ra.score < rb.score ? 'b' : '');
    } else body = this.pairHtml(team(ids[0]), team(ids[1]), 0, 0, false, '');
    return `<div class="fx-match${h ? ' done' : ''}${isLive ? ' live' : ''}"><div class="fx-head"><b>${no}. maç</b><span>${Live.clock(K.t)}${K.late ? ' · ertelendi' : ''}</span>${badge}</div>${body}</div>`;
  },
  mainFixture(lv) {
    const d = League.data, plan = App.seasonPlan();
    if (!plan) return '<h2>Fikstür</h2>';
    const team = (id) => d.teams.find(t => t.id === id) || d.reserve.find(t => t.id === id);
    const per = App.perWeek();
    const weeks = plan.weeks.slice(0, d.seasonLength).map((pairs, wi) => {
      const w = wi + 1, cur = w === Math.min(d.week, d.seasonLength);
      const k0 = this.kickoff(w, 1).t, k1 = this.kickoff(w, Math.min(per, pairs.length)).t;
      const matches = pairs.slice(0, per).map((ids, mi) => {
        const m = mi + 1, h = d.history.find(x => x.week === w && x.weekMatch === m);
        return this.fxMatch(m, this.kickoff(w, m), h, ids, team, !!lv && lv.keys.has(`m-${w}-${m}`), 'main', { week: w, weekMatch: m });
      }).join('');
      return `<section class="fx-week${cur ? ' cur' : ''}"><h3>Hafta ${w}<span>${this.day(k0)} · ${Live.clock(k0)}–${Live.clock(k1)}</span></h3><div class="fx-grid">${matches}</div></section>`;
    }).join('');
    const extra = League.promoOn() ? ' · yükselme ligi maçları aynı saatlerde (Yükselme ligi › Fikstür)' : League.cupOn() ? ' · lig maçlarından sonra havuz kulüplerinin yükselme eleme maçları var (Yükselme ligi sekmesi)' : '';
    return `<h2>Sezon ${d.season} fikstürü</h2><div class="lp-sub">${d.seasonLength} hafta · her takım her takımla bir kez, haftada bir maç oynar (üstteki takım ev sahibi) · maçlar ${CONFIG.MATCH_TIME} sn · maç saatleri (TSİ): ${this.bandsText()}${extra} · ⚽: şu an oynanan maç (dokunun: canlı izleyin)</div>${this.champ()}${weeks}`;
  },
  /* the promotion league's season: its weeks (each match at the same time as a league match) and then its playoff */
  promoFixture(lv) {
    const d = League.data;
    if (!League.promoOn()) return `<h2>Yükselme ligi fikstürü</h2><div class="lp-sub">Bu sezon yükselme ligi yok: sezon eski formatla başladı, havuzdaki ${d.reserve.length} kulüp lig maçlarından sonra eleme oynar (Yükselme ligi › Tablo). Yükselme ligi yeni sezonla başlar.</div>`;
    const p = d.promo, team = (id) => League.poolTeam(id) || LivePages.anyTeam(id), curW = Math.min(p.plan.length, Math.floor(p.history.length / p.per) + 1);
    const weeks = p.plan.map((pairs, wi) => {
      const w = wi + 1, i0 = wi * p.per, k0 = this.promoKickoff(i0).t, k1 = this.promoKickoff(i0 + pairs.length - 1).t;
      const matches = pairs.map((ids, mi) => {
        const m = mi + 1, i = i0 + mi, h = p.history[i] && p.history[i].week === w && p.history[i].weekMatch === m ? p.history[i] : null;
        return this.fxMatch(m, this.promoKickoff(i), h, ids, team, !!lv && lv.keys.has(`p-${w}-${m}`), 'promo', { week: w, weekMatch: m, div: 'promo' });
      }).join('');
      return `<section class="fx-week${w === curW && !League.promoLeagueOver() ? ' cur' : ''}"><h3>Hafta ${w}<span>${this.day(k0)} · ${Live.clock(k0)}–${Live.clock(k1)}</span></h3><div class="fx-grid">${matches}</div></section>`;
    }).join('');
    return `<h2>Sezon ${d.season} · yükselme ligi fikstürü</h2><div class="lp-sub">${p.plan.length} hafta · havuzdaki ${d.reserve.length} kulüp, haftada ${p.per} maç · her maç bir lig maçıyla aynı saatte başlar · sezonun son ${p.po} maç saatinde ilk ${PO_SIZE} takımın yükselme elemesi · ⚽: şu an oynanan maç</div>`
      + weeks + (p.po ? `<h3 class="lp-h3">Yükselme elemesi</h3>${this.promoBracket(lv)}` : '');
  },
  /* the promotion league's playoff: its rounds (the clubs once the league is over, else "Yükselme ligi 1.si" …) */
  promoBracket(lv) {
    const p = League.data.promo, c = League.cup() || { season: League.data.season, draw: [], res: {} }, ms = League.cupMatchesOf(c);
    const r = this.cupRounds(ms, c, { team: (id) => League.poolTeam(id), kick: (m) => this.cupKickoff(m.i, m), lv, ch: 'promo', seed: (i) => `Yükselme ligi ${i + 1}.si` });
    return League.promoLeagueOver() ? r : r.replace(/fx-week cur/g, 'fx-week');   // the current week is the promotion league's until it is over
  },
  /* the "Yükselme ligi" tab: the promotion league's table (top 4: playoff), its playoff; a season of the old format: its knockout */
  promo(lv) {
    const d = League.data;
    if (!League.promoOn()) return `<div class="lp-note">Bu sezon eski formatla başladı: havuzdaki kulüpler lig maçlarından sonra eleme oynar. <b>Yükselme ligi</b> (havuz kulüplerinin ligle aynı anda oynadığı çift devreli lig) yeni sezonla başlar.</div>` + this.cup(lv);
    const p = d.promo, rk = League.promoRanking();
    const list = rk.map((x, i) => ({ t: x.t, r: x.r, form: League.formOf(x.t.id, p.history), po: !!p.po && i < PO_SIZE }));
    const legs = p.plan.length >= 2 * (d.reserve.length - 1) ? 'çift devreli (her takımla iki kez: bir iç saha, bir deplasman)' : `${p.plan.length} haftalık`;
    const top = League.cupTop3(), c = League.cup();
    const done = top ? `<div class="lp-note">🔺 Yükselenler: <b>${top.map(t => esc(t.name)).join(', ')}</b></div>` : '';
    const guide = `<div class="lp-legend">Havuzdaki ${d.reserve.length} kulüp, ligle aynı anda kendi aralarında ${legs} bir lig oynar; her maç bir lig maçıyla aynı saatte başlar ve iki sezon aynı anda biter. `
      + (p.po ? `Sezon sonunda ilk ${PO_SIZE} takım <b>yükselme elemesi</b> oynar: yarı finaller 1.–4. ve 2.–3. (ev sahibi üst sıradaki), sonra 3.lük maçı ve final (tek maç; berabere biterse en fazla ${CONFIG.GOLDEN_TIME} sn altın gol, sonra penaltılar). <b>Final galibi, finalist ve 3.lük maçının galibi</b> lige yükselir; ligin son ${CONFIG.RELEGATE_COUNT} takımı havuza düşer. Eleme sezonun son ${p.po} maç saatindedir: final, ligin son maçıyla aynı anda.`
        : `Sezon sonunda ilk ${CONFIG.RELEGATE_COUNT} takım lige yükselir.`) + ` ⚽: şu an maçı olan takım.</div>`;
    return `<h2>Yükselme ligi</h2><div class="lp-sub">Sezon ${d.season} · ${p.history.length} / ${p.n} maç oynandı${c ? ` · eleme ${Object.keys(c.res).length} / ${p.po} maç` : ''}</div>${done}`
      + this.tableHtml(list, lv) + `<div class="lp-legend">${this.pointsText(d.points)} · Yeşil çizgili ilk ${PO_SIZE} takım yükselme elemesine kalır.</div>${guide}`
      + (p.po ? `<h3 class="lp-h3">Yükselme elemesi</h3>${this.promoBracket(lv)}` : '');
  },
  /* the "Canlı" tab: the matches on now and those that start within 10 minutes; a card opens its match on the canvas */
  live(now) {
    const d = League.data, team = (id) => (id && this.anyTeam(id)) || null;
    const card = (ch, label, ids, status, from, on) => {
      const [a, b] = ids.map(team), nm = (t, fb) => (t ? `${this.dot(t)}<span class="nm">${esc(t.name)}</span>` : `<span class="nm tbd">${fb}</span>`);
      return `<button type="button" class="lv-card${on ? ' on' : ''}" data-watch="${ch}"${from ? ` data-from="${from}"` : ''}>`
        + `<span class="lv-top"><span class="lv-tag">${label}</span>${status}</span>`
        + `<span class="lv-teams"><span class="lv-t">${nm(a, 'Belli olacak')}</span><span class="lv-vs">${on ? '<span aria-hidden="true">⚽</span>' : '–'}</span><span class="lv-t r">${nm(b, 'Belli olacak')}</span></span></button>`;
    };
    const on = Live.onNow(now).map(M => card(M.ch, this.what(M.ch, M.s.cup ? { cup: M.s.cup } : M.s), M.s.opts.teams.map(t => t.id),
      `<span class="lv-st"><b class="lv-live">CANLI</b> · başlama ${Live.clock(M.start)}</span>`, 0, true));
    const soon = [];
    let newSeason = 0;
    for (const x of Live.upcoming(now)) {
      if (!x.ms.length) { newSeason = newSeason || x.at; continue; }
      for (const m of x.ms) soon.push(card(m.ch, this.what(m.ch, m), m.ids, `<span class="lv-st">${Live.clock(x.at)} · <span data-at="${x.at}"></span> sonra</span>`, x.n, false));
    }
    const head = `<h2>Canlı</h2><div class="lp-sub">Lig ve yükselme ligi maçları aynı anda başlar (her ${Live.every(now)} dk'da bir). İzlemek istediğiniz maça dokunun: maç bitince aynı ligin sıradaki maçı aynı ekranda başlar.</div>`;
    const empty = (t) => `<div class="st-empty">${t}</div>`;
    return head + `<h3 class="lp-h3">Şimdi oynanıyor</h3>` + (on.length ? `<div class="lv-list">${on.join('')}</div>` : empty('Şu an oynanan maç yok.'))
      + `<h3 class="lp-h3">${Math.round(Live.SOON / 60e3)} dk içinde başlayacak</h3>` + (soon.length ? `<div class="lv-list">${soon.join('')}</div>` : empty(newSeason ? '' : 'Önümüzdeki dakikalarda maç yok.'))
      + (newSeason ? `<div class="lp-note">🏁 Sezon ${d.season} bitiyor · yeni sezonun ilk maçları: ${Live.clock(newSeason)}</div>` : '');
  },
};
