/* =====================================================================
   LIVE LEAGUE  (the public site: a league that never stops — matches play themselves on a fixed timetable,
   every visitor sees the same match at the same moment)
   No server: the simulation is deterministic (seeded RNG + DM math, see 01_core.js) and every seed is derived
   from the season / week / group match, so each browser computes the league by itself:
     • finished matches are simulated without drawing (cached in localStorage; live-state.json on the site,
       refreshed every 15 minutes by the Pages workflow, is a ready-made checkpoint so first visits are quick),
     • the match that is on is fast-forwarded to "now" and then plays in real time,
     • between matches: the league table and a countdown to the next kick-off.
   Timetable (CONFIG.LIVE.bands, Istanbul time): 05–09 every 5 min, 09–19 every 10 min, 19–05 every 3 min.
   A match starts at its slot, or GAP seconds after the previous match ended if that one ran over (never seen
   in 3000 test matches, but it can never jam: the overrun is absorbed by the next slots). A match's length
   on screen is computed from its own simulation, so every browser agrees on it too.
   The studio (old panel: preview, recording, videos) is at ?studio. Debug: ?now=<past ISO time>.
   ===================================================================== */
const Live = {
  on: !/[?&]studio\b/.test(location.search),
  CACHE_KEY: 'arenaLive_v2',
  HOLD: 4,                  // seconds the final table stays after the end screen
  RESYNC_GAP: 60e3,         // the page slept longer than this (ms): reload from the newest saved state
  offset: 0, skew: 0, phase: 'loading', progress: null, cur: null, pending: null, st: null, simT: 0,
  sound: false, lastClean: null, lastFrame: 0,

  /* --- timetable ---------------------------------------------------------- */
  cfg() { return CONFIG.LIVE; },
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
    const [ds, ts] = c.start.split('T'), [y, mo, d] = ds.split('-').map(Number), tm = this.mins(ts || c.bands[0].from);
    const startMs = Date.UTC(y, mo - 1, d, 0, tm) - off;
    const day = Math.floor((startMs + off - b0 * 60e3) / 864e5), base0 = day * 864e5 + b0 * 60e3 - off;
    let n0 = 0; while (n0 < S.length && base0 + S[n0] * 60e3 < startMs) n0++;
    return (this._sched = { slots: S, base0, n0 });
  },
  /* planned kick-off of live match n */
  slot(n) {
    const { slots: S, base0, n0 } = this.sched(), k = n + n0, day = Math.floor(k / S.length);
    return base0 + day * 864e5 + S[k - day * S.length] * 60e3;
  },
  /* actual kick-off of the next match: its slot, or GAP after the previous match if that one ran over */
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
  /* saved states are only valid for the same results (BUILD_SIM_HASH = fingerprint of the simulation, see build.sh)
     and the same league start / timetable */
  hash() {
    const c = this.cfg();
    return [typeof BUILD_SIM_HASH !== 'undefined' ? BUILD_SIM_HASH : 'dev', c.salt, c.start, c.bands.map(b => b.from + '/' + b.every).join(','), c.gap].join(':');
  },
  count() { return League.data.liveCount || 0; },

  /* --- league state ------------------------------------------------------ */
  freshLeague() { const d = League.normalize(null); d.liveCount = 0; d.liveSeasonStart = 0; d.liveLastEnd = 0; return d; },
  /* live match number of a season's group match */
  matchIndex(week, wm) { return (League.data.liveSeasonStart || 0) + (week - 1) * App.perWeek() + (wm - 1); },
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
  /* the next match computed without drawing: its setup, the finished game, start and length */
  computeNext() {
    const start = this.nextStart(), s = App.buildSetup();
    if (s.err) throw new Error(s.err);
    const g = new Game(s.opts);
    return { n: this.count(), start, s, g, dur: this.timeGame(g) };
  },
  /* write a computed match into the league (identical to watching it: same steps, same League.record) */
  record(m) { League.record(m.s, m.g.getResult(), m.g.teams[m.g.winner].id); this.closeMatch(m); },
  /* after a match: season over → champion, relegation, new season; then the next live match */
  closeMatch(m) {
    const d = League.data, ended = d.week > d.seasonLength;
    if (ended) { League.endSeason(); d.champions = d.champions.slice(-this.cfg().keepChampions); }
    d.liveCount = (d.liveCount || 0) + 1;
    d.liveLastEnd = m.start + Math.round(m.dur * 1000);
    if (ended) d.liveSeasonStart = d.liveCount;
    this.pending = null;
    this.snapshot();
  },
  /* a state "after liveCount matches", taken only between matches (cache, checkpoint, resync) */
  snapshot() { this.lastClean = JSON.stringify({ hash: this.hash(), savedAt: new Date(this.now()).toISOString(), data: League.data }); },
  saveCache() { if (!this.lastClean) this.snapshot(); try { localStorage.setItem(this.CACHE_KEY, this.lastClean); } catch (e) { /* full / blocked: recompute next time */ } },
  parseState(txt) { try { const c = typeof txt === 'string' ? JSON.parse(txt) : txt; return c && c.hash === this.hash() && c.data ? c.data : null; } catch (e) { return null; } },
  readCache() { try { return this.parseState(localStorage.getItem(this.CACHE_KEY)); } catch (e) { return null; } },
  /* the site's checkpoint; its HTTP Date header also corrects a wrong device clock */
  async readCheckpoint() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return null;
    try {
      const t0 = Date.now(), r = await fetch('live-state.json', { cache: 'no-cache' }), t1 = Date.now();
      const sd = Date.parse(r.headers.get('Date') || '');
      if (!isNaN(sd)) { const sk = sd + 500 - (t0 + t1) / 2; this.skew = Math.abs(sk) > 2000 ? sk : 0; }
      return r.ok ? this.parseState(await r.json()) : null;
    } catch (e) { return null; }
  },
  /* best starting point for time t: the furthest saved state whose last match had ended by t */
  async loadState(t) {
    const cands = [this.parseState(this.lastClean), this.readCache(), await this.readCheckpoint()];
    t = this.now();
    const pick = cands.filter(d => d && (d.liveLastEnd || 0) <= t).sort((a, b) => (b.liveCount || 0) - (a.liveCount || 0))[0];
    League.data = pick ? Object.assign(League.normalize(pick), { liveCount: pick.liveCount || 0, liveSeasonStart: pick.liveSeasonStart || 0, liveLastEnd: pick.liveLastEnd || 0 }) : this.freshLeague();
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

  /* --- boot / loop ---------------------------------------------------------- */
  async boot() {
    const q = new URLSearchParams(location.search).get('now');
    /* only the past can be replayed: a future ?now would show results before their kick-off */
    if (q && !isNaN(Date.parse(q))) this.offset = Math.min(0, Date.parse(q) - Date.now());
    document.body.classList.add('live');
    League.data = this.freshLeague();
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
    await this.sync();
  },
  /* (re)build the league up to now and join the current match; used at start and after the page slept */
  async sync() {
    this.phase = 'loading'; this.progress = null; this.pending = null;
    App.game = null; App.end = null; App.running = false;
    try {
      await this.loadState(this.now());
      const m = await this.catchUp();
      this.saveCache();
      if (m) this.startMatch(m); else this.phase = 'wait';
    } catch (e) { console.error(e); this.phase = 'error'; this.err = String(e && e.message || e); }
    this.lastFrame = this.now();
  },
  ui() {
    const tabs = document.createElement('nav');
    tabs.id = 'liveTabs';
    tabs.innerHTML = `<button data-tab="live" class="on">⚽ Canlı</button><button data-tab="table">Lig tablosu</button><button data-tab="fixture">Fikstür</button>`;
    const pane = document.createElement('div');
    pane.id = 'livePane'; pane.className = 'hidden';
    $('stage').appendChild(tabs); $('stage').appendChild(pane);
    tabs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.showTab(b.dataset.tab); });
    const bar = document.createElement('div');
    bar.id = 'liveBar';
    bar.innerHTML = `<button id="liveSound">🔇 Ses kapalı</button><span id="liveInfo"></span>`;
    $('stage').appendChild(bar);
    $('liveSound').addEventListener('click', () => {
      this.sound = !this.sound;
      if (this.sound) { AudioSys.init(); AudioSys.resume(); }
      AudioSys.muted = !this.sound; if (AudioSys.ctx) AudioSys.apply();
      $('liveSound').textContent = this.sound ? '🔊 Ses açık' : '🔇 Ses kapalı';
    });
  },
  /* bottom bar: how often matches are now, and the next kick-off */
  info(now) {
    if (this.phase === 'loading' || this.phase === 'error') return 'Lig yükleniyor…';
    const next = this.phase === 'match' && this.cur
      ? Math.max(this.slot(this.cur.n + 1), this.cur.start + Math.round(this.cur.dur * 1000) + this.cfg().gap * 1000)
      : this.nextStart();
    if (!this.count() && this.phase === 'wait') return `Lig ${LivePages.day(next).split(' ').slice(0, 2).join(' ')} ${this.clock(next)}'te başlıyor`;
    return `Her ${this.every(now)} dk'da bir maç · sıradaki ${this.clock(next)}`;
  },
  tab: 'live', paneKey: '',
  showTab(tab) {
    this.tab = tab; this.paneKey = '';
    document.querySelectorAll('#liveTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    $('livePane').classList.toggle('hidden', tab === 'live');
    this.renderPane();
    if (tab === 'fixture') { const cur = document.querySelector('#livePane .fx-week.cur'); if (cur) cur.scrollIntoView({ block: 'start' }); }
    else $('livePane').scrollTop = 0;
  },
  /* the open tab is redrawn only when the league changes (a match ends, a new one starts) */
  renderPane() {
    if (this.tab === 'live' || this.phase === 'loading') return;
    const d = League.data, s = App.setup;
    const live = this.phase === 'match' && s && !d.history.some(h => h.week === s.week && h.weekMatch === s.weekMatch) ? `${s.week}-${s.weekMatch}` : '';
    const key = [this.tab, d.season, d.history.length, this.count(), live].join('|');
    if (key === this.paneKey) return;
    this.paneKey = key;
    $('livePane').innerHTML = `<div class="lp-in">${this.tab === 'table' ? LivePages.table() : LivePages.fixture(live)}</div>`;
  },
  /* join a computed match that is on: replay it from its kick-off up to now */
  startMatch(m) {
    App.prepare();
    if (!App.game) { this.phase = 'error'; this.err = App.setup && App.setup.err || ''; return; }
    App.running = true; App.paused = false;
    this.cur = m; this.st = { acc: 0 }; this.simT = 0;
    this.phase = 'match';
  },
  /* fixed 60 fps steps up to the wall clock (so every viewer stays in sync); the match ends at its computed length */
  advanceMatch(now) {
    const m = this.cur, target = Math.min((now - m.start) / 1000, m.dur), rdt = 1 / 60;
    const enabled = AudioSys.enabled;
    if (target - this.simT > 0.5) AudioSys.enabled = false;      // no burst of sounds while fast-forwarding
    try {
      while (this.simT + rdt <= target) { Offline.stepFrame(this.st, rdt); this.simT += rdt; }
    } finally { AudioSys.enabled = enabled; }
    if ((now - m.start) / 1000 >= m.dur) this.finishMatch();
  },
  finishMatch() {
    const g = App.game;
    if (g && !App.end) { while (!g.over) g.step(DT); App.onOver(); }   // safety: the result is always recorded
    this.closeMatch(this.cur);
    this.cur = null; App.game = null; App.end = null; App.running = false;
    this.saveCache();
    this.phase = 'wait';
  },
  frame(t) {
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
          else this.startMatch(m);
        } else if (this.phase === 'wait' && !this.pending && !this.prepTimer) {
          /* use the quiet time between matches to compute the next one (no hitch at kick-off) */
          this.prepTimer = setTimeout(() => { this.prepTimer = null; try { if (this.phase === 'wait' && !this.pending) this.pending = this.computeNext(); } catch (e) { /* retried at kick-off */ } }, 300);
        }
        if (this.phase === 'match') this.advanceMatch(now);
      }
    } catch (e) { console.error(e); this.phase = 'error'; this.err = String(e && e.message || e); }
    this.renderPane();
    const info = this.info(now);
    if (info !== this._info && $('liveInfo')) { this._info = info; $('liveInfo').textContent = info; }
    if (this.tab !== 'live') { /* a tab covers the stream: the match keeps running in sync, nothing to draw */ }
    else if (this.phase === 'match' && App.game) Renderer.draw(App.game, App);
    else LiveScreen.draw(Renderer.ctx, this, now);
    requestAnimationFrame((tt) => this.frame(tt));
  },
};

/* between matches: the league table and the countdown to the next kick-off */
const LiveScreen = {
  draw(ctx, L, now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    FX.update(0, 1 / 60);
    Renderer.background(THEMES.classic);
    if (L.phase === 'loading' || L.phase === 'error') {
      outlinedText(ctx, L.phase === 'error' ? 'SOMETHING WENT WRONG' : 'LOADING LEAGUE…', 510, 900, `90px ${FONT_BIG}`, '#ffffff', null, 0);
      const p = L.progress, sub = L.phase === 'error' ? (L.err || '') : p ? `${p.done} MATCHES` : '';
      if (sub) outlinedText(ctx, sub, 510, 990, `600 34px ${FONT_UI}`, 'rgba(255,255,255,0.7)', null, 0);
      return;
    }
    const d = League.data, next = L.nextStart();
    const plan = App.seasonPlan(), ids = plan && d.week <= d.seasonLength ? ((plan.weeks[d.week - 1] || [])[d.weekMatch - 1] || []) : [];
    const rows = League.ranking().map((x, i) => {
      const f = League.formOf(x.t.id), gd = x.r.gf - x.r.ga;
      return { id: x.t.id, name: x.t.name, c1: x.t.c1, c2: x.t.c2, today: false, oldRank: i, newRank: i,
        oldPts: x.r.pts, newPts: x.r.pts, played: x.r.played, dPlayed: 0, oldGd: gd, newGd: gd, place: null, delta: null, oldForm: f, newForm: f };
    });
    const last = d.champions.length ? d.champions[d.champions.length - 1] : null;
    const sub = d.history.length ? `SEASON ${d.season} · AFTER ${d.history.length} MATCHES` : last ? `🏆 ${upTR(last.name)} · SEASON ${last.season} CHAMPIONS` : `SEASON ${d.season}`;
    LeagueTable.draw(ctx, rows, 'LEAGUE TABLE', sub, { tt: 99, post: false, alpha: 1 });
    /* next match box */
    const X0 = 70, W = 880, y = 1668, h = 200;
    roundRect(ctx, X0, y, W, h, 28);
    ctx.fillStyle = 'rgba(0,200,83,0.13)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#00E676'; ctx.stroke();
    outlinedText(ctx, `NEXT · WEEK ${d.week} · GROUP MATCH ${d.weekMatch}`, X0 + 30, y + 42, `44px ${FONT_BIG}`, '#ffffff', null, 0, 'left');
    outlinedText(ctx, `KICK-OFF ${L.clock(next)} (TR)`, X0 + W - 30, y + 42, `600 24px ${FONT_UI}`, '#00E676', null, 0, 'right');
    const s = Math.max(0, Math.ceil((next - now) / 1000));
    const hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60, p2 = (v) => String(v).padStart(2, '0');
    outlinedText(ctx, `${hh ? hh + ':' : ''}${p2(mm)}:${p2(ss)}`, X0 + W / 2, y + 128, `110px ${FONT_BIG}`, '#ffffff', null, 0);
    outlinedText(ctx, 'STARTS IN', X0 + 30, y + 128, `600 24px ${FONT_UI}`, 'rgba(255,255,255,0.6)', null, 0, 'left');
    const codes = ids.map(id => (d.teams.find(t => t.id === id) || {}).code).filter(Boolean).join(' · ');
    outlinedText(ctx, codes, X0 + W / 2, y + 180, `600 24px ${FONT_UI}`, 'rgba(255,255,255,0.75)', null, 0);
  },
};

/* the "Lig tablosu" and "Fikstür" tabs (HTML, Turkish like the rest of the site's controls) */
const LivePages = {
  MONTHS: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  DAYS: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
  local(ms) { return new Date(ms + Live.cfg().utcOffset * 3600e3); },
  day(ms) { const t = this.local(ms); return `${t.getUTCDate()} ${this.MONTHS[t.getUTCMonth()]} ${this.DAYS[t.getUTCDay()]}`; },
  dot(t) { return `<span class="dot" style="background:${t.c1};border-color:${t.c2}"></span>`; },
  champ() {
    const c = League.data.champions, last = c[c.length - 1];
    return last ? `<div class="lp-note">🏆 Sezon ${last.season} şampiyonu: <b>${esc(last.name)}</b></div>` : '';
  },
  champs() {
    const c = League.data.champions.slice(-10).reverse();
    return c.length ? `<h3 class="lp-h3">Son şampiyonlar</h3><ol class="lp-champs">${c.map(x => `<li><span>Sezon ${x.season}</span><b>${esc(x.name)}</b><span>${x.pts} puan</span></li>`).join('')}</ol>` : '';
  },
  /* kick-off of a season's group match: the actual one once played (or next), the planned slot otherwise */
  kickoff(w, m) {
    const d = League.data, n = Live.matchIndex(w, m), h = d.history.find(x => x.week === w && x.weekMatch === m);
    if (h && h.date) { const t = Date.parse(h.date); return { t, late: t - Live.slot(n) > 1000 }; }
    if (n === Live.count()) { const t = Live.nextStart(); return { t, late: t - Live.slot(n) > 1000 }; }
    return { t: Live.slot(n), late: false };
  },
  bandsText() { return Live.cfg().bands.map((b, i, B) => `${b.from}–${B[(i + 1) % B.length].from} her ${b.every} dk`).join(' · '); },
  table() {
    const d = League.data, rk = League.ranking(), out = rk.length - Math.min(CONFIG.RELEGATE_COUNT, d.reserve.length);
    const rows = rk.map((x, i) => {
      const av = x.r.gf - x.r.ga;
      return `<tr class="${i >= out ? 'rel' : ''}"><td>${i + 1}</td><td class="tn">${this.dot(x.t)}${esc(x.t.name)}</td><td>${x.r.played}</td><td><b>${x.r.pts}</b></td>` +
        `<td class="opt">${x.r.wins}</td><td class="opt">${x.r.gf}</td><td class="opt">${x.r.ga}</td><td>${av > 0 ? '+' : ''}${av}</td><td class="form">${formHtml(League.formOf(x.t.id))}</td></tr>`;
    }).join('');
    return `<h2>Lig tablosu</h2><div class="lp-sub">Sezon ${d.season} · ${d.history.length} / ${d.seasonLength * App.perWeek()} maç oynandı</div>${this.champ()}
      <table class="lp-table"><thead><tr><th>#</th><th>Takım</th><th title="Oynanan">O</th><th title="Puan">P</th><th class="opt" title="Birincilik">1.</th><th class="opt" title="Atılan gol">AG</th><th class="opt" title="Yenilen gol">YG</th><th title="Averaj">AV</th><th title="Son ${CONFIG.FORM_COUNT} maçtaki sırası (en sağdaki en yeni)">Son ${CONFIG.FORM_COUNT}</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="lp-legend">Puan: ${d.points.slice(0, CONFIG.GROUP_SIZE).map((p, i) => `${i + 1}. → ${p}`).join(' · ')} · Kırmızı çizgili son ${CONFIG.RELEGATE_COUNT} takım sezon sonunda ligden düşer.</div>${this.champs()}`;
  },
  fixture(live) {
    const d = League.data, plan = App.seasonPlan();
    if (!plan) return '<h2>Fikstür</h2>';
    const team = (id) => d.teams.find(t => t.id === id) || d.reserve.find(t => t.id === id);
    const per = App.perWeek();
    const weeks = plan.weeks.slice(0, d.seasonLength).map((groups, wi) => {
      const w = wi + 1, cur = w === Math.min(d.week, d.seasonLength);
      const k0 = this.kickoff(w, 1).t, k1 = this.kickoff(w, Math.min(per, groups.length)).t;
      const matches = groups.slice(0, per).map((ids, mi) => {
        const m = mi + 1, K = this.kickoff(w, m), ko = K.t;
        const h = d.history.find(x => x.week === w && x.weekMatch === m);
        const isLive = live === `${w}-${m}`;
        const badge = h ? '<span class="b done">Bitti</span>' : isLive ? '<span class="b live">● CANLI</span>' : '';
        let body;
        if (h) body = h.result.slice().sort((a, b) => a.place - b.place).map(r => {
          const t = team(r.id) || { name: r.code, c1: '#888', c2: '#fff' }, pts = d.points[r.place - 1] || 0;
          return `<li><i class="fp f${Math.min(r.place, 5)}">${ordinal(r.place).toLowerCase()}</i>${this.dot(t)}<span class="nm">${esc(t.name)}</span><span class="pt ${pts ? 'g' : 'r'}">+${pts}</span></li>`;
        }).join('');
        else body = ids.map(id => { const t = team(id); return t ? `<li>${this.dot(t)}<span class="nm">${esc(t.name)}</span></li>` : ''; }).join('');
        return `<div class="fx-match${h ? ' done' : ''}${isLive ? ' live' : ''}"><div class="fx-head"><b>Grup maçı ${m}</b><span>${Live.clock(ko)}${K.late ? ' · ertelendi' : ''}</span>${badge}</div><ol class="${h ? 'res' : 'teams'}">${body}</ol></div>`;
      }).join('');
      return `<section class="fx-week${cur ? ' cur' : ''}"><h3>Hafta ${w}<span>${this.day(k0)} · ${Live.clock(k0)}–${Live.clock(k1)}</span></h3>${matches}</section>`;
    }).join('');
    return `<h2>Sezon ${d.season} fikstürü</h2><div class="lp-sub">${d.seasonLength} hafta · her takım haftada bir maç · maç saatleri (TSİ): ${this.bandsText()}</div>${this.champ()}${weeks}`;
  },
};
