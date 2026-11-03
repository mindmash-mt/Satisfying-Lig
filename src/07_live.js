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
  freshLeague() { const d = League.normalize(null); d.liveCount = 0; d.liveSeasonStart = 0; return d; },
  /* live match number of a season's group match (for its kick-off time) */
  matchIndex(week, wm) {
    const d = League.data;
    return (d.liveSeasonStart || 0) + (week - 1) * App.perWeek() + (wm - 1);
  },
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
    const ended = d.week > d.seasonLength;
    if (ended) League.endSeason();
    d.liveCount = (d.liveCount || 0) + 1;
    if (ended) d.liveSeasonStart = d.liveCount;
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
    League.data = pick ? Object.assign(League.normalize(pick), { liveCount: pick.liveCount || 0, liveSeasonStart: pick.liveSeasonStart || 0 }) : this.freshLeague();
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
    /* everything up to the latest kick-off is played without drawing; that match itself is fast-forwarded (it may still be on) */
    const target = Math.max(0, this.startedBy(this.now()) - 1);
    await this.loadState(target);
    await this.catchUp(target);
    this.phase = 'wait';
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
    $('liveInfo').textContent = `Maç saatleri: ${this.cfg().times.join(' · ')} (TSİ)`;
    $('liveSound').addEventListener('click', () => {
      this.sound = !this.sound;
      if (this.sound) { AudioSys.init(); AudioSys.resume(); }
      AudioSys.muted = !this.sound; AudioSys.apply && AudioSys.ctx && AudioSys.apply();
      $('liveSound').textContent = this.sound ? '🔊 Ses açık' : '🔇 Ses kapalı';
    });
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
    this.renderPane();
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
      const p = L.progress, sub = L.phase === 'error' ? (L.err || '') : p ? `${p.done} / ${p.total} MATCHES` : '';
      if (sub) outlinedText(ctx, sub, 510, 990, `600 34px ${FONT_UI}`, 'rgba(255,255,255,0.7)', null, 0);
      return;
    }
    const d = League.data, n = L.count(), next = L.kickoff(n);
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
  table() {
    const d = League.data, rk = League.ranking(), out = rk.length - Math.min(CONFIG.RELEGATE_COUNT, d.reserve.length);
    const rows = rk.map((x, i) => {
      const av = x.r.gf - x.r.ga;
      return `<tr class="${i >= out ? 'rel' : ''}"><td>${i + 1}</td><td class="tn">${this.dot(x.t)}${esc(x.t.name)}</td><td>${x.r.played}</td><td><b>${x.r.pts}</b></td>` +
        `<td class="opt">${x.r.wins}</td><td class="opt">${x.r.gf}</td><td class="opt">${x.r.ga}</td><td>${av > 0 ? '+' : ''}${av}</td><td class="form">${formHtml(League.formOf(x.t.id))}</td></tr>`;
    }).join('');
    return `<h2>Lig tablosu</h2><div class="lp-sub">Sezon ${d.season} · ${d.history.length} / ${d.seasonLength * App.perWeek()} maç oynandı</div>${this.champ()}
      <table class="lp-table"><thead><tr><th>#</th><th>Takım</th><th title="Oynanan">O</th><th title="Puan">P</th><th class="opt" title="Birincilik">1.</th><th class="opt" title="Atılan gol">AG</th><th class="opt" title="Yenilen gol">YG</th><th title="Averaj">AV</th><th title="Son ${CONFIG.FORM_COUNT} maçtaki sırası (en sağdaki en yeni)">Son ${CONFIG.FORM_COUNT}</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="lp-legend">Puan: ${d.points.slice(0, CONFIG.GROUP_SIZE).map((p, i) => `${i + 1}. → ${p}`).join(' · ')} · Kırmızı çizgili son ${CONFIG.RELEGATE_COUNT} takım sezon sonunda ligden düşer.</div>`;
  },
  fixture(live) {
    const d = League.data, plan = App.seasonPlan();
    if (!plan) return '<h2>Fikstür</h2>';
    const team = (id) => d.teams.find(t => t.id === id) || d.reserve.find(t => t.id === id);
    const per = App.perWeek();
    const weeks = plan.weeks.slice(0, d.seasonLength).map((groups, wi) => {
      const w = wi + 1, cur = w === Math.min(d.week, d.seasonLength);
      const ms0 = Live.kickoff(Live.matchIndex(w, 1));
      const matches = groups.slice(0, per).map((ids, mi) => {
        const m = mi + 1, ko = Live.kickoff(Live.matchIndex(w, m));
        const h = d.history.find(x => x.week === w && x.weekMatch === m);
        const isLive = live === `${w}-${m}`;
        const badge = h ? '<span class="b done">Bitti</span>' : isLive ? '<span class="b live">● CANLI</span>' : '';
        let body;
        if (h) body = h.result.slice().sort((a, b) => a.place - b.place).map(r => {
          const t = team(r.id) || { name: r.code, c1: '#888', c2: '#fff' }, pts = d.points[r.place - 1] || 0;
          return `<li><i class="fp f${Math.min(r.place, 5)}">${ordinal(r.place).toLowerCase()}</i>${this.dot(t)}<span class="nm">${esc(t.name)}</span><span class="pt ${pts ? 'g' : 'r'}">+${pts}</span></li>`;
        }).join('');
        else body = ids.map(id => { const t = team(id); return t ? `<li>${this.dot(t)}<span class="nm">${esc(t.name)}</span></li>` : ''; }).join('');
        return `<div class="fx-match${h ? ' done' : ''}${isLive ? ' live' : ''}"><div class="fx-head"><b>Grup maçı ${m}</b><span>${this.day(ko).split(' ').slice(0, 2).join(' ')} · ${Live.clock(ko)}</span>${badge}</div><ol class="${h ? 'res' : 'teams'}">${body}</ol></div>`;
      }).join('');
      return `<section class="fx-week${cur ? ' cur' : ''}"><h3>Hafta ${w}<span>${this.day(ms0)}</span></h3>${matches}</section>`;
    }).join('');
    return `<h2>Sezon ${d.season} fikstürü</h2><div class="lp-sub">${d.seasonLength} hafta · her gün ${Live.cfg().times.join(' · ')} (TSİ) · her takım haftada bir maç</div>${this.champ()}${weeks}`;
  },
};
