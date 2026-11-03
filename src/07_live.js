/* =====================================================================
   LIVE LEAGUE  (the public site: matches play themselves at fixed times, every visitor sees the same match)
   No server: the simulation is deterministic (seeded RNG + DM math, see 01_core.js), and every seed is derived
   from the season / week / group match. So each browser computes the league by itself:
     • the past matches are simulated without drawing (cached in localStorage; live-state.json on the site,
       built by the Pages workflow, is a ready-made checkpoint so first visits are quick),
     • the match whose kick-off has passed is fast-forwarded to "now" and then plays in real time,
     • between matches: the league table and a countdown to the next kick-off.
   Kick-off times: CONFIG.LIVE.times (Istanbul time) from CONFIG.LIVE.start; match n of the live league is the
   n-th kick-off. The studio (old panel: preview, recording, videos) is at ?studio.
   Debug: ?now=2026-11-04T12:00:30+03:00 shows the site as at that moment.
   ===================================================================== */
const Live = {
  on: !/[?&]studio\b/.test(location.search),
  CACHE_KEY: 'arenaLive_v1',
  HOLD: 4,                       // seconds the final table stays after the end screen before the countdown returns
  STALE: 900,                    // a kick-off longer ago than this (s) is surely over (match ≤ HARD_TIME_LIMIT game seconds + screens)
  offset: 0, phase: 'loading', progress: null, kick: 0, st: null, simT: 0, sound: false,

  /* --- schedule ------------------------------------------------------- */
  cfg() { return CONFIG.LIVE; },
  times() { return this.cfg().times.map(t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; }).sort((a, b) => a - b); },
  dayStartUTC(day) { const [y, mo, d] = this.cfg().start.split('-').map(Number); return Date.UTC(y, mo - 1, d + day) - this.cfg().utcOffset * 3600e3; },
  kickoff(n) { const T = this.times(), day = Math.floor(n / T.length); return this.dayStartUTC(day) + T[n % T.length] * 60e3; },
  kickoffISO(n) { return new Date(this.kickoff(n)).toISOString(); },
  /* number of kick-offs at or before time t */
  startedBy(t) {
    const T = this.times(), day = Math.floor((t - this.dayStartUTC(0)) / 864e5);
    if (day < 0) return 0;
    let n = day * T.length;
    while (this.kickoff(n) <= t) n++;
    return n;
  },
  now() { return Date.now() + this.offset; },
  clock(ms) { return new Date(ms + this.cfg().utcOffset * 3600e3).toISOString().slice(11, 16); },

  /* --- determinism ------------------------------------------------------ */
  seed(parts) {
    let h = 0x811C9DC5;
    const str = [this.cfg().salt].concat(parts).join('|');
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    h ^= h >>> 16; h = Math.imul(h, 0x85EBCA6B); h ^= h >>> 13;
    return (h >>> 0) || 1;
  },
  /* caches are only valid for the same simulation code and league start (build.sh fills BUILD_SIM_HASH) */
  hash() { return [typeof BUILD_SIM_HASH !== 'undefined' ? BUILD_SIM_HASH : 'dev', this.cfg().salt, this.cfg().start].join(':'); },
  count() { return League.data.liveCount || 0; },

  /* --- league state ------------------------------------------------------ */
  freshLeague() { const d = League.normalize(null); d.liveCount = 0; return d; },
  /* one match without drawing; identical to watching it (same Game steps, same League.record) */
  playHeadless() {
    const s = App.buildSetup();
    if (s.err) throw new Error(s.err);
    const g = new Game(s.opts);
    while (!g.over) g.step(DT);
    League.record(s, g.getResult(), g.teams[g.winner].id);
    this.closeMatch();
  },
  /* after a match: season over → champion, relegation, new season; then the next live match */
  closeMatch() {
    const d = League.data;
    if (d.week > d.seasonLength) League.endSeason();
    d.liveCount = (d.liveCount || 0) + 1;
  },
  /* only called between matches, so a saved state is always "after liveCount matches" (also used by tools/live-state.js) */
  saveCache() {
    this.lastClean = JSON.stringify({ hash: this.hash(), savedAt: new Date(this.now()).toISOString(), data: League.data });
    try { localStorage.setItem(this.CACHE_KEY, this.lastClean); } catch (e) { /* storage full / blocked: recompute next time */ }
  },
  readCache() {
    try { const c = JSON.parse(localStorage.getItem(this.CACHE_KEY) || 'null'); return c && c.hash === this.hash() && c.data ? c.data : null; } catch (e) { return null; }
  },
  async readCheckpoint() {
    if (location.protocol === 'file:') return null;
    try {
      const r = await fetch('live-state.json', { cache: 'no-cache' });
      if (!r.ok) return null;
      const c = await r.json();
      return c && c.hash === this.hash() && c.data ? c.data : null;
    } catch (e) { return null; }
  },
  /* best starting point: the furthest saved state that does not pass `target` matches */
  async loadState(target) {
    const pick = [this.readCache(), await this.readCheckpoint()].filter(d => d && (d.liveCount || 0) <= target)
      .sort((a, b) => (b.liveCount || 0) - (a.liveCount || 0))[0];
    League.data = pick ? Object.assign(League.normalize(pick), { liveCount: pick.liveCount || 0 }) : this.freshLeague();
  },
  /* simulate the missing matches, in small slices so the page stays responsive */
  async catchUp(target) {
    const from = this.count();
    while (this.count() < target) {
      const until = performance.now() + 40;
      while (this.count() < target && performance.now() < until) this.playHeadless();
      this.progress = { done: this.count() - from, total: target - from };
      await new Promise(r => setTimeout(r, 0));
    }
    this.progress = null;
    this.saveCache();
  },

  /* --- boot / loop ---------------------------------------------------------- */
  async boot() {
    const q = new URLSearchParams(location.search).get('now');
    if (q && !isNaN(Date.parse(q))) this.offset = Date.parse(q) - Date.now();
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
    /* everything up to the latest kick-off is played without drawing; that match itself is fast-forwarded (it may still be on) */
    const target = Math.max(0, this.startedBy(this.now()) - 1);
    await this.loadState(target);
    await this.catchUp(target);
    this.phase = 'wait';
  },
  ui() {
    const bar = document.createElement('div');
    bar.id = 'liveBar';
    bar.innerHTML = `<button id="liveSound">🔇 Ses kapalı</button><span id="liveInfo"></span>`;
    $('stage').appendChild(bar);
    $('liveInfo').textContent = `Maç saatleri: ${this.cfg().times.join(' · ')} (TSİ)`;
    $('liveSound').addEventListener('click', () => {
      this.sound = !this.sound;
      if (this.sound) { AudioSys.init(); AudioSys.resume(); }
      AudioSys.muted = !this.sound; AudioSys.apply && AudioSys.ctx && AudioSys.apply();
      $('liveSound').textContent = this.sound ? '🔊 Ses açık' : '🔇 Ses kapalı';
    });
  },
  /* start the match whose kick-off was at this.kick and bring it to the current moment */
  startMatch() {
    App.prepare();
    if (!App.game) { this.phase = 'error'; return; }
    App.running = true; App.paused = false;
    this.st = { acc: 0 }; this.simT = 0;
    this.phase = 'match';
  },
  /* fixed 60 fps steps up to the wall clock (so every viewer stays in sync, also after the tab slept) */
  advanceMatch(now) {
    const target = (now - this.kick) / 1000, rdt = 1 / 60;
    const behind = target - this.simT > 0.5;
    const enabled = AudioSys.enabled;
    if (behind) AudioSys.enabled = false;          // no burst of sounds while fast-forwarding
    try {
      while (this.simT + rdt <= target) {
        Offline.stepFrame(this.st, rdt);
        this.simT += rdt;
        if (App.end && App.endT >= CONFIG.END_DURATION + this.HOLD) { this.finishMatch(); return; }
      }
    } finally { AudioSys.enabled = enabled; }
  },
  finishMatch() {
    this.closeMatch();
    App.game = null; App.end = null; App.running = false;
    this.saveCache();
    this.phase = 'wait';
  },
  frame(t) {
    const now = this.now();
    try {
      if (this.phase === 'wait') {
        const n = this.count();
        if (this.kickoff(n + 1) <= now) { this.playHeadless(); this.saveCache(); }   // a later match has started too: skip ahead
        else if (this.kickoff(n) <= now - this.STALE * 1000) { this.playHeadless(); this.saveCache(); }   // long over: no need to replay it frame by frame
        else if (this.kickoff(n) <= now) { this.kick = this.kickoff(n); this.startMatch(); }
      }
      if (this.phase === 'match') this.advanceMatch(now);
    } catch (e) { console.error(e); this.phase = 'error'; this.err = String(e && e.message || e); }
    if (this.phase === 'match' && App.game) Renderer.draw(App.game, App);
    else LiveScreen.draw(Renderer.ctx, this, now);
    requestAnimationFrame((tt) => this.frame(tt));
  },
};

/* between matches: the league table (next match's clubs highlighted) and the countdown to the next kick-off */
const LiveScreen = {
  draw(ctx, L, now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    FX.update(0, 1 / 60);
    Renderer.background(THEMES.classic);
    if (L.phase === 'loading' || L.phase === 'error') {
      outlinedText(ctx, L.phase === 'error' ? 'SOMETHING WENT WRONG' : 'LOADING LEAGUE…', 510, 900, `90px ${FONT_BIG}`, '#ffffff', null, 0);
      const p = L.progress, sub = L.phase === 'error' ? (L.err || '') : p ? `${p.done} / ${p.total} MATCHES` : '';
      if (sub) outlinedText(ctx, sub, 510, 990, `600 34px ${FONT_UI}`, 'rgba(255,255,255,0.7)', null, 0);
      return;
    }
    const d = League.data, n = L.count(), next = L.kickoff(n);
    const plan = App.seasonPlan(), ids = plan && d.week <= d.seasonLength ? ((plan.weeks[d.week - 1] || [])[d.weekMatch - 1] || []) : [];
    const nextSet = new Set(ids);
    const rows = League.ranking().map((x, i) => {
      const f = League.formOf(x.t.id), gd = x.r.gf - x.r.ga;
      return { id: x.t.id, name: x.t.name, c1: x.t.c1, c2: x.t.c2, today: nextSet.has(x.t.id), oldRank: i, newRank: i,
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
