/* =====================================================================
   LEAGUE  (persistent table in localStorage, JSON import/export)
   ===================================================================== */
const League = {
  data: null, storageOK: true,
  fresh() {
    return {
      version: 1, teamsVersion: 3,
      teams: DEFAULT_TEAMS.map((t, i) => ({ id: 't' + (i + 1), name: t.name, code: t.code, c1: t.c1, c2: t.c2 })),
      reserve: RESERVE_TEAMS.map((t, i) => ({ id: 't' + (DEFAULT_TEAMS.length + i + 1), name: t.name, code: t.code, c1: t.c1, c2: t.c2 })),
      table: {}, week: 1, weekMatch: 1, matchNo: 1, season: 1, seasonLength: CONFIG.SEASON_LENGTH,
      points: CONFIG.POINTS.slice(), seasonPlan: null, tieOrder: null,
      history: [], champions: [], settings: {},
    };
  },
  defaultSettings() {
    return { theme: 'auto', lives: CONFIG.DEFAULT_LIVES, speedMult: CONFIG.DEFAULT_SPEED_MULT, powerups: false,
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
      const pl = Array.isArray(r.places) ? r.places.slice(0, 6).map(x => +x || 0) : [];
      while (pl.length < 6) pl.push(0);
      if (!Array.isArray(r.places)) pl[0] = +r.wins || 0;   // older tables only knew the wins
      out.table[id] = { played: +r.played || 0, pts: +r.pts || 0, wins: +r.wins || 0, gf: +r.gf || 0, ga: +r.ga || 0, places: pl };
    }
    out.week = Math.max(1, +d.week || 1); out.weekMatch = Math.max(1, +d.weekMatch || 1); out.matchNo = Math.max(1, +d.matchNo || 1);
    delete out.day;
    delete out.derbyWinPoints;               // the derby mode was removed: every match is a group match
    out.season = Math.max(1, +d.season || 1);
    out.seasonPlan = this.validPlanShape(d.seasonPlan) ? d.seasonPlan : null;
    out.tieOrder = Array.isArray(d.tieOrder) ? d.tieOrder.map(String) : null;
    out.seasonLength = Math.max(1, +d.seasonLength || CONFIG.SEASON_LENGTH);
    out.points = Array.isArray(d.points) && d.points.length ? d.points.map(x => +x || 0) : CONFIG.POINTS.slice();
    while (out.points.length < 10) out.points.push(0);
    /* the old default scoring (10-7-5-4-3-2-1) becomes the new default (4-3-2-1); custom scoring is kept */
    if (out.points.join(',') === '10,7,5,4,3,2,1,0,0,0') out.points = CONFIG.POINTS.slice();
    out.teamsVersion = 3;
    out.history = Array.isArray(d.history) ? d.history : [];
    out.champions = Array.isArray(d.champions) ? d.champions : [];
    out.settings = Object.assign(this.defaultSettings(), d.settings || {});
    delete out.settings.seed;                 // the seed is chosen per match and never stored ahead of it
    /* removed options: match mode (derby / season final), manual team pick, team count per match (always CONFIG.GROUP_SIZE) */
    for (const k of ['mode', 'selMode', 'manual', 'teamCount']) delete out.settings[k];
    /* settings v2: single life by default — migrate older saved settings once */
    if (!d.settings || d.settings.sv !== 2) { out.settings.lives = CONFIG.DEFAULT_LIVES; out.settings.sv = 2; }
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
    try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.data)); this.storageOK = true; }
    catch (e) { this.storageOK = false; }
    UI.storageWarn(!this.storageOK);
  },
  rowOf(table, id) { return table[id] || { played: 0, pts: 0, wins: 0, gf: 0, ga: 0, places: [0, 0, 0, 0, 0, 0] }; },
  /* the season's tie-break draw: a random order of the clubs, drawn once when the season starts and stored with the league
     (so it is the same on every screen and in the repo files). It only decides a tie that nothing else separates. */
  tieOrderFor() {
    const d = this.data, ids = d.teams.map(t => t.id);
    const have = Array.isArray(d.tieOrder) ? d.tieOrder.filter(id => ids.includes(id)) : [];
    if (Array.isArray(d.tieOrder) && d.tieOrder.length === ids.length && have.length === ids.length && new Set(have).size === ids.length) return d.tieOrder;
    const rng = new RNG(randomSeed());
    d.tieOrder = have.concat(rng.shuffle(ids.filter(id => !have.includes(id))));
    return d.tieOrder;
  },
  /* table order: points → 1st places → 2nd places → 3rd places → 4th places → goals scored (own goals excluded) → the season's draw.
     Goal difference is deliberately not used: a club's goals against follow its finishing place, so it would only count the placing twice. */
  ranking(table = this.data.table) {
    const draw = this.tieOrderFor(), pos = (id) => draw.indexOf(id);
    return this.data.teams.map(t => ({ t, r: this.rowOf(table, t.id) })).sort((a, b) => {
      if (b.r.pts !== a.r.pts) return b.r.pts - a.r.pts;
      const pa = a.r.places || [], pb = b.r.places || [];
      for (let i = 0; i < 4; i++) if ((pb[i] || 0) !== (pa[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
      return b.r.gf - a.r.gf || pos(a.t.id) - pos(b.t.id);
    });
  },
  pointsFor(res, tm) { return this.data.points[tm.place - 1] || 0; },
  /* every group has exactly CONFIG.GROUP_SIZE clubs, so the league size must be a multiple of it */
  validTeamCount(n) { return n >= CONFIG.GROUP_SIZE && n % CONFIG.GROUP_SIZE === 0; },
  /* the season has begun once a match was played or a week/group match was passed: from then on the fixture,
     the team list and the season length are fixed until the season ends */
  seasonStarted() { const d = this.data; return d.history.length > 0 || d.week > 1 || d.weekMatch > 1; },
  validPlanShape(p) {
    return !!(p && typeof p === 'object' && Array.isArray(p.weeks) && p.weeks.every(w => Array.isArray(w) && w.every(g => Array.isArray(g))));
  },
  /* end of season: the table leader is the champion; the last RELEGATE_COUNT teams go out, the next clubs of the reserve queue come in */
  seasonChange() {
    const d = this.data, rk = this.ranking();
    const k = Math.max(0, Math.min(CONFIG.RELEGATE_COUNT, d.reserve.length, rk.length - 2));
    return { champion: rk[0].t, pts: rk[0].r.pts, out: rk.slice(rk.length - k).map(x => x.t), in: d.reserve.slice(0, k) };
  },
  /* archive the finished season (returned, for the season file) and start the next one with the new team list */
  endSeason() {
    const d = this.data, ch = this.seasonChange(), season = d.season || 1;
    const brief = (t) => ({ id: t.id, name: t.name, code: t.code });
    const archive = { season, endedAt: new Date().toISOString(),
      champion: { id: ch.champion.id, name: ch.champion.name, season, pts: ch.pts },
      relegated: ch.out.map(brief), promoted: ch.in.map(brief),
      table: this.ranking().map((x, i) => ({ rank: i + 1, id: x.t.id, name: x.t.name, code: x.t.code, ...x.r })),
      history: d.history };
    d.champions.push(Object.assign({}, archive.champion));
    d.teams = d.teams.filter(t => !ch.out.some(o => o.id === t.id)).concat(ch.in);
    d.reserve = d.reserve.slice(ch.in.length).concat(ch.out);
    d.season = season + 1;
    d.table = {}; d.week = 1; d.weekMatch = 1; d.history = []; d.seasonPlan = null;   // next season gets a new fixture
    d.tieOrder = null; this.tieOrderFor();                                           // ...and a new tie-break draw
    delete d.weekPlan;
    this.save();
    return archive;
  },
  applyTo(table, res) {
    for (const tm of res.teams) {
      if (!this.data.teams.some(t => t.id === tm.id)) continue;
      const r = table[tm.id] || (table[tm.id] = { played: 0, pts: 0, wins: 0, gf: 0, ga: 0, places: [0, 0, 0, 0, 0, 0] });
      if (!Array.isArray(r.places)) r.places = [r.wins || 0, 0, 0, 0, 0, 0];
      r.places[tm.place - 1]++;
      r.played++; r.gf += tm.gf; r.ga += tm.ga; r.pts += this.pointsFor(res, tm);
      if (tm.place === 1) r.wins++;
    }
  },
};
function validColor(c, def) { return /^#[0-9a-fA-F]{6}$/.test(String(c || '')) ? String(c).toUpperCase() : def; }
/* every match gets its own random 32-bit seed (never shown, never stored ahead of the match; played matches keep theirs in the history) */
function randomSeed() {
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
const $ = (id) => document.getElementById(id);
const UI = {
  init() {
    const s = League.data.settings;
    $('theme').value = s.theme; $('lives').value = s.lives;
    $('speedMult').value = s.speedMult; $('simSpeed').value = String(s.simSpeed);
    $('volume').value = s.volume; $('testMatch').checked = s.testMatch;
    $('pointsInput').value = League.data.points.slice(0, CONFIG.GROUP_SIZE).join(','); $('seasonLen').value = League.data.seasonLength;
    AudioSys.vol = s.volume; AudioSys.muted = s.muted;
    const read = () => {
      s.theme = $('theme').value;
      s.lives = clamp(Math.round(+$('lives').value || 3), 1, 5);
      s.speedMult = clamp(+$('speedMult').value || 1, 0.7, 1.5);
      s.simSpeed = +$('simSpeed').value || 1;
      s.testMatch = $('testMatch').checked;
      League.save(); this.refresh();
      if (!App.running || App.end) App.prepare();
    };
    ['theme', 'lives', 'speedMult', 'testMatch'].forEach(id => $(id).addEventListener('change', read));
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
      if (d.week > d.seasonLength) { alert('Sezon tamamlandı. Önce yeni sezonu başlatın.'); return; }
      /* skipping a week leaves its unplayed group matches unplayed for good: warn and ask first */
      const left = App.unplayedThisWeek();
      if (left.length) {
        const code = (id) => (d.teams.find(t => t.id === id) || {}).code || '?';
        const list = left.map(x => `  • ${x.no}. grup maçı: ${x.ids.map(code).join(' · ')}`).join('\n');
        if (!confirm(`⚠️ Hafta ${d.week} içinde oynanmamış ${left.length} grup maçı var:\n${list}\n\n` +
          `Yeni haftaya geçilirse bu maçlar hiç oynanmayacak; bu ${left.length * CONFIG.GROUP_SIZE} takım sezonu diğerlerinden eksik maçla bitirecek (adil olmaz).\n\nYine de sonraki haftaya (Hafta ${d.week + 1}) geçilsin mi?`)) return;
      }
      d.week++; d.weekMatch = 1; League.save(); this.refresh(); if (!App.running || App.end) App.prepare();
      this.toast(d.week > d.seasonLength ? '🏁 Sezonun son haftası geçildi.' : `📅 Hafta ${d.week} başladı.`);
    });
    $('btnExport').addEventListener('click', () => {
      downloadBlob(new Blob([JSON.stringify(League.data, null, 2)], { type: 'application/json' }), `arena_league_week${League.data.week}.json`);
    });
    $('btnImport').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', (ev) => {
      const f = ev.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const d = JSON.parse(rd.result);
          if (!d || !Array.isArray(d.teams) || d.teams.length < 2) throw new Error('Geçersiz dosya: takım listesi yok.');
          if (!League.validTeamCount(d.teams.length))
            throw new Error(`Takım sayısı (${d.teams.length}) ${CONFIG.GROUP_SIZE}'nın katı olmalı; aksi halde gruplar eşit olmaz.`);
          League.data = League.normalize(d); League.save(); this.init2(); App.prepare();
          this.toast('✅ Lig verisi içe aktarıldı.');
        } catch (e) { alert('İçe aktarma başarısız: ' + e.message); }
        $('importFile').value = '';
      };
      rd.readAsText(f);
    });
    $('btnResetLeague').addEventListener('click', () => {
      if (!confirm('Lig tablosu, gün sayacı, maç numarası ve geçmiş silinecek (takımlar korunur). Emin misiniz?')) return;
      const d = League.data; d.table = {}; d.week = 1; d.weekMatch = 1; d.matchNo = 1; d.history = []; d.champions = []; d.seasonPlan = null; d.tieOrder = null; delete d.weekPlan;
      League.save(); this.refresh(); App.prepare(); this.toast('Lig sıfırlandı.');
    });
    $('btnTeams').addEventListener('click', () => TeamEditor.open());
    $('pointsInput').addEventListener('change', () => {
      const arr = $('pointsInput').value.split(/[,\s;]+/).filter(Boolean).map(x => Math.max(0, Math.round(+x) || 0)).slice(0, CONFIG.GROUP_SIZE);
      while (arr.length < 10) arr.push(0);
      League.data.points = arr; $('pointsInput').value = arr.slice(0, CONFIG.GROUP_SIZE).join(','); League.save();
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
    $('theme').value = s.theme; $('lives').value = s.lives; $('speedMult').value = s.speedMult;
    $('testMatch').checked = s.testMatch;
    $('pointsInput').value = League.data.points.slice(0, CONFIG.GROUP_SIZE).join(','); $('seasonLen').value = League.data.seasonLength;
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
      info += `<div class="warn">⚠️ Takım sayısı (${d.teams.length}) ${CONFIG.GROUP_SIZE}'nın katı değil. Gruplar eşit olsun diye maç oynatılamaz — <b>Takımları düzenle</b> ile takım sayısını ${CONFIG.GROUP_SIZE}'nın katı yapın.</div>`;
      $('fixture').innerHTML = '';
    } else {
      info += `<div class="kv"><span>Sıradaki grup maçı</span><b>${d.week > d.seasonLength ? '—' : `${d.weekMatch} / ${App.perWeek()}`}</b></div><div class="kv"><span>Oynanan maç (bu sezon)</span><b>${d.history.length}</b></div>`
        + `<div class="hint">${d.teams.length} takım, her maçta ${CONFIG.GROUP_SIZE} takım → haftada ${App.perWeek()} grup maçı; her takım her hafta tam 1 maç oynar. Haftanın son grup maçı kaydedilince hafta kendiliğinden ilerler.</div>`;
      const wk = plan.weeks[d.week - 1];
      if (wk) info += `<div class="hint" style="margin-top:10px"><b>Hafta ${d.week} grupları</b></div>` + wk.map((g, i) =>
        `<div class="kv"><span>${i + 1}. grup${i + 1 < d.weekMatch ? ' ✓' : i + 1 === d.weekMatch ? ' ▶' : ''}</span><b style="font-weight:600">${g.map(code).join(' · ')}</b></div>`).join('');
      const st = fixtureMeetings(d.teams.map(t => t.id), plan.weeks.slice(0, d.seasonLength));
      $('fixture').innerHTML = `<details><summary>📋 Sezon ${d.season || 1} fikstürü (${d.seasonLength} hafta)</summary>`
        + `<div class="hint">Sezon başında adil olarak bir kez oluşturuldu ve sezon bitene kadar değişmez. Her takım ikilisi sezonda en az <b>${st.min}</b>, en çok <b>${st.max}</b> kez aynı grupta.</div>`
        + `<div class="fixture">${plan.weeks.slice(0, d.seasonLength).map((w, i) => `<div class="wk${i + 1 === d.week ? ' cur' : ''}"><b>H${i + 1}</b> · ${w.map(g => g.map(code).join(' ')).join(' &nbsp;|&nbsp; ')}</div>`).join('')}</div></details>`;
    }
    $('leagueInfo').innerHTML = info;
    const note = $('seasonNote');
    if (d.week >= d.seasonLength) {
      note.classList.remove('hidden');
      if (d.week > d.seasonLength) {
        const c = League.seasonChange(), nm = (a) => a.map(t => esc(t.name)).join(', ') || '—';
        note.innerHTML = `🏁 <b>Sezon tamamlandı!</b> Şampiyon: <b>🏆 ${esc(c.champion.name)}</b> (${c.pts} puan).<br>Ligden çıkacaklar: ${nm(c.out)}<br>Gelecekler: ${nm(c.in)}<br><button id="btnEndSeason" style="margin-top:8px">Yeni sezonu başlat</button>`;
        $('btnEndSeason').addEventListener('click', () => {
          if (!confirm('Şampiyon kaydedilecek, son takımlar çıkıp yedeklerden takımlar gelecek ve yeni sezon 1. haftadan başlayacak. Emin misiniz?')) return;
          League.endSeason(); this.init2(); App.prepare(); this.toast('🏆 Yeni sezon başladı.');
        });
      } else note.innerHTML = `🏁 Sezonun son haftası. Haftanın maçlarından sonra tablonun lideri şampiyon olur; son ${CONFIG.RELEGATE_COUNT} takım ligden çıkar.`;
    } else note.classList.add('hidden');
    const rk = League.ranking();
    $('leagueTable').innerHTML = `<table><thead><tr><th>#</th><th>Takım</th><th title="Oynanan">O</th><th title="Puan">P</th><th title="Birincilik">1st</th><th title="Atılan gol">AG</th><th title="Yenilen gol">YG</th><th title="Averaj">AV</th></tr></thead><tbody>` +
      rk.map((x, i) => { const av = x.r.gf - x.r.ga; return `<tr><td>${i + 1}</td><td class="tn"><span class="dot" style="background:${x.t.c1};border-color:${x.t.c2}"></span>${esc(x.t.name)}</td><td>${x.r.played}</td><td><b>${x.r.pts}</b></td><td>${x.r.wins}</td><td>${x.r.gf}</td><td>${x.r.ga}</td><td>${av > 0 ? '+' : ''}${av}</td></tr>`; }).join('') +
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
      <td><input type="color" class="te-c1" value="${t.c1.toLowerCase()}"></td>
      <td><input type="color" class="te-c2" value="${t.c2.toLowerCase()}"></td>
      <td><button class="te-del" data-i="${i}" title="Sil">🗑</button></td></tr>`).join('');
    document.querySelectorAll('.te-del').forEach(b => b.onclick = () => { this.collect(); this.rows.splice(+b.dataset.i, 1); this.render(); });
  },
  collect() {
    document.querySelectorAll('#teBody tr').forEach(tr => {
      const r = this.rows[+tr.dataset.i];
      r.name = tr.querySelector('.te-name').value.trim() || r.name;
      r.code = upTR(tr.querySelector('.te-code').value).replace(CODE_STRIP, '').slice(0, 3);
      r.c1 = validColor(tr.querySelector('.te-c1').value, r.c1); r.c2 = validColor(tr.querySelector('.te-c2').value, r.c2);
    });
  },
  save() {
    this.collect();
    if (League.seasonStarted()) { alert('Sezon başladı: takımlar ancak yeni sezon başında (hiç maç oynanmadan) değiştirilebilir; fikstür sezon bitene kadar sabit.'); return; }
    if (!League.validTeamCount(this.rows.length)) {
      alert(`Takım sayısı ${CONFIG.GROUP_SIZE}'nın katı olmalı (${CONFIG.GROUP_SIZE}, ${CONFIG.GROUP_SIZE * 2}, ${CONFIG.GROUP_SIZE * 3}, ${CONFIG.GROUP_SIZE * 4}…); şu an ${this.rows.length}. Aksi halde gruplar eşit olmaz.`);
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
  /* league points a finishing place earns */
  pointsForPlace(place) { return League.data.points[place - 1] || 0; },
  /* group matches per week: every club plays once a week (18 clubs, 6 per match → 3) */
  perWeek() { return Math.max(1, Math.floor(League.data.teams.length / CONFIG.GROUP_SIZE)); },
  /* the season fixture: built once when the season starts (fair split, see planSeason) and stored with the league;
     it is never rebuilt while the season is running (team list and season length are locked then) */
  seasonPlan() {
    const d = League.data, ids = d.teams.map(t => t.id), key = ids.slice().sort().join(',');
    const p = d.seasonPlan, season = d.season || 1;
    if (p && p.season === season && p.key === key && p.size === CONFIG.GROUP_SIZE && p.weeks.length >= d.seasonLength) return p;
    if (!League.validTeamCount(ids.length)) return null;
    const rng = new RNG(randomSeed());
    /* normally the season has not begun yet. A save from an older version (weekly plans) may be mid-season:
       then the weeks already passed stay as they were played and the current week keeps its played groups */
    const fixed = [];
    if (League.seasonStarted()) {
      const arena = d.history.filter(h => h.mode === 'arena' && Array.isArray(h.teams));
      for (let w = 1; w < d.week; w++) fixed.push(arena.filter(h => h.week === w).map(h => h.teams.slice()));
      const old = d.weekPlan && d.weekPlan.week === d.week && Array.isArray(d.weekPlan.groups) ? d.weekPlan.groups : null;
      const valid = (gs) => gs.every(g => g.length === CONFIG.GROUP_SIZE) && new Set(gs.flat()).size === gs.flat().length && gs.flat().every(id => ids.includes(id));
      let cur = arena.filter(h => h.week === d.week).sort((a, b) => (a.weekMatch || 0) - (b.weekMatch || 0)).map(h => h.teams.slice());
      if (!valid(cur)) cur = [];
      if (old && valid(old) && old.length === ids.length / CONFIG.GROUP_SIZE && cur.every((g, i) => old[i] && g.slice().sort().join() === old[i].slice().sort().join())) cur = old.map(g => g.slice());
      else {
        const rest = rng.shuffle(ids.filter(id => !cur.some(g => g.includes(id))));
        while (rest.length) cur.push(rest.splice(0, CONFIG.GROUP_SIZE));
      }
      fixed.push(cur);
    }
    const weeks = fixed.concat(planSeason(ids, d.seasonLength, CONFIG.GROUP_SIZE, rng, fixed));
    d.seasonPlan = { season, key, size: CONFIG.GROUP_SIZE, created: new Date().toISOString(), weeks };
    delete d.weekPlan;
    League.save();
    return d.seasonPlan;
  },
  /* the group matches of the current week that have not been played yet */
  unplayedThisWeek() {
    const d = League.data, plan = this.seasonPlan();
    if (!plan || d.week > d.seasonLength) return [];
    const wk = plan.weeks[d.week - 1] || [];
    return wk.map((ids, i) => ({ no: i + 1, ids })).filter(x => x.no >= d.weekMatch);
  },
  buildSetup() {
    const d = League.data, s = d.settings;
    const seed = randomSeed();                 // a fresh hidden seed for every match setup
    const srng = new RNG((seed ^ 0x5BD1E995) >>> 0);
    /* every match is the next group match of the season fixture */
    let teams = [], err = null;
    const plan = this.seasonPlan();
    if (!plan) err = `Takım sayısı (${d.teams.length}) ${CONFIG.GROUP_SIZE}'nın katı olmalı — Takımları düzenle ile düzeltin.`;
    else if (d.week > d.seasonLength) err = 'Sezon tamamlandı — panelden yeni sezonu başlatın.';
    else {
      const ids = (plan.weeks[d.week - 1] || [])[d.weekMatch - 1] || [];
      teams = ids.map(id => d.teams.find(t => t.id === id)).filter(Boolean);
      if (teams.length !== CONFIG.GROUP_SIZE) err = 'Bu grup maçı için fikstürde takım bulunamadı.';
    }
    let theme = s.theme;
    if (theme === 'auto') theme = srng.pick(THEME_IDS);
    else if (!THEME_DEFS[theme]) theme = 'classic';
    const title = `WEEK ${d.week} · GROUP MATCH ${d.weekMatch}`;
    return { err, title, mode: 'arena', week: d.week, weekMatch: d.weekMatch, perWeek: this.perWeek(), matchNo: d.matchNo, seed, theme, test: s.testMatch,
      opts: { mode: 'arena', teams: teams.map(t => ({ ...t })), seed, theme, lives: s.lives, speedMult: s.speedMult, powerups: false } };
  },
  /* what the video shows before the match: today's matches (played ones with their results, the rest as fixtures) */
  buildIntro() {
    const s = this.setup, d = League.data;
    const tm = (id) => d.teams.find(t => t.id === id);
    const tObj = (t, extra) => Object.assign({ id: t.id, name: t.name, c1: t.c1, c2: t.c2 }, extra || {});
    const matches = [], week = (this.seasonPlan().weeks[s.week - 1]) || [];
    for (let j = 1; j <= s.perWeek; j++) {
      const label = `GROUP MATCH ${j}`;
      if (j < s.weekMatch) {
        const h = d.history.slice().reverse().find(x => x.mode === 'arena' && x.week === s.week && x.weekMatch === j);
        if (h) matches.push({ label, status: 'done', teams: h.result.slice().sort((a, b) => a.place - b.place)
          .map(r => { const t = tm(r.id); return t ? tObj(t, { place: r.place, pts: d.points[r.place - 1] || 0 }) : null; }).filter(Boolean) });
      } else if (j === s.weekMatch) matches.push({ label, status: 'now', teams: s.opts.teams.map(t => tObj(t)) });
      else matches.push({ label, status: 'later', teams: (week[j - 1] || []).map(tm).filter(Boolean).map(t => tObj(t)) });
    }
    return { title: s.title, sub: `WEEK ${s.week}`, matches };
  },
  prepare() {
    if (Recorder.active) return false;
    const setup = this.buildSetup();
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
      Recorder.start(`arena_week${s.week}_match${s.weekMatch}`);
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
  onOver() {
    const g = this.game, s = this.setup, d = League.data;
    const res = g.getResult();
    const W = g.teams[g.winner];
    const before = JSON.parse(JSON.stringify(d.table));
    const after = JSON.parse(JSON.stringify(d.table));
    League.applyTo(after, res);
    const rkB = League.ranking(before), rkA = League.ranking(after);
    const oldRank = new Map(rkB.map((x, i) => [x.t.id, i])), newRank = new Map(rkA.map((x, i) => [x.t.id, i]));
    const today = new Set(res.teams.map(t => t.id));
    const gdOf = (tab, id) => { const r = League.rowOf(tab, id); return r.gf - r.ga; };
    const rows = d.teams.map(t => {
      const tm = res.teams.find(x => x.id === t.id);
      return { id: t.id, name: t.name, c1: t.c1, c2: t.c2, today: today.has(t.id),
        oldRank: oldRank.get(t.id), newRank: newRank.get(t.id),
        oldPts: League.rowOf(before, t.id).pts, newPts: League.rowOf(after, t.id).pts,
        played: League.rowOf(after, t.id).played, dPlayed: tm ? 1 : 0,
        oldGd: gdOf(before, t.id), newGd: gdOf(after, t.id),
        place: tm ? tm.place : null, delta: tm ? League.pointsFor(res, tm) : null };
    });
    const leaderBefore = rkB[0] && rkB[0].r.played ? rkB[0].t.id : null;
    const leaderAfter = rkA[0].t;
    let subtitle;
    {
      const L = g.teams.find(t => t.place === 2);
      subtitle = L && g.finalDuel ? `Final: ${W.code} ${W.score} – ${L.score} ${L.code}` : `${W.gf} goals · ${W.saves} saves`;
    }
    /* this match's full result: every team's place, goals scored (own goals excluded) and points earned */
    const standings = res.teams.slice().sort((a, b) => a.place - b.place).map(tm => {
      const T = g.teams[tm.slot];
      return { name: T.name, code: T.code, c1: T.c1, c2: T.c2, place: tm.place, gf: tm.gf, pts: League.pointsFor(res, tm) };
    });
    this.end = { title: s.title, winner: { name: W.name, code: W.code, c1: W.c1, c2: W.c2 }, rows, standings, seasonEnd: null, subtitle };
    this.endT = 0;
    /* persist */
    if (!s.test) {
      d.table = after;
      d.history.push({ matchNo: s.matchNo, week: s.week, weekMatch: s.weekMatch, mode: 'arena', seed: s.seed, theme: res.theme, date: new Date().toISOString(),
        teams: res.teams.map(t => t.id), winner: W.id, duration: res.duration,
        result: res.teams.map(t => ({ id: t.id, code: t.code, place: t.place, gf: t.gf, ga: t.ga, saves: t.saves, score: t.score })) });
      d.matchNo++;
      d.weekMatch++;
      if (d.weekMatch > s.perWeek) { d.week++; d.weekMatch = 1; setTimeout(() => UI.toast(`📅 Hafta ${d.week} başladı.`), 300); }
      League.save();
      /* last group match of the season: the table leader is the champion, the last teams will be relegated */
      if (d.week > d.seasonLength) {
        const ch = League.seasonChange();
        this.end.seasonEnd = { season: d.season || 1, champion: { id: ch.champion.id, name: ch.champion.name }, out: ch.out.map(t => t.id), in: ch.in.map(t => ({ id: t.id, name: t.name })) };
        for (const r of this.end.rows) { r.champ = r.id === ch.champion.id; r.out = ch.out.some(t => t.id === r.id); }
        FX.startEndConfetti([ch.champion.c1, ch.champion.c2, '#FFD54F', '#ffffff']);
      }
    }
    $('caption').value = this.caption(res, W, leaderBefore !== leaderAfter.id && rkA[0].r.pts > 0 ? leaderAfter : null);
    UI.refresh();
  },
  caption(res, W, newLeader) {
    const s = this.setup, g = this.game;
    const L = g.teams.find(t => t.place === 2);
    const l1 = `Week ${s.week} · Group Match ${s.weekMatch} 🏆 ${W.name} win${L && g.finalDuel ? ` the final ${W.score}–${L.score} vs ${L.name}` : ''}!`;
    const top = g.teams.slice().sort((a, b) => b.gf - a.gf || a.place - b.place)[0];
    let extra = '';
    if (top && top.gf > 0) {
      extra = `${top.name} scored the most goals (${top.gf})`;
      if (newLeader && !s.test) extra += newLeader.id === top.id ? ' and they are the new league leader!' : ` — and ${newLeader.name} is the new league leader!`;
      else extra += '!';
    } else if (newLeader && !s.test) extra = `New league leader: ${newLeader.name}!`;
    let l2 = 'Who takes the top spot next? Comment your team 👇';
    let season = '';
    const se = this.end && this.end.seasonEnd;
    if (se) {
      const nm = (ids) => ids.map(id => (League.data.teams.find(t => t.id === id) || (League.data.reserve.find(t => t.id === id)) || {}).name).filter(Boolean).join(', ');
      season = `🏆 ${se.champion.name} are the Season ${se.season} champions!\n🔻 Relegated: ${nm(se.out)}\n🔺 Joining next season: ${se.in.map(t => t.name).join(', ')}`;
      l2 = 'Who wins next season? Comment your team 👇';
    }
    return [l1, season, extra, l2, '#satisfying #football #simulation #arena #oddlysatisfying #league'].filter(Boolean).join('\n');
  },
};

/* =====================================================================
   BALANCE TEST  (100 headless matches, chunked, no drawing / audio)
   ===================================================================== */
const Balance = {
  busy: false,
  run() {
    if (this.busy || Recorder.active) return;
    const s = League.data.settings, teamsAll = League.data.teams;
    const n = CONFIG.GROUP_SIZE;
    if (teamsAll.length < n) { alert('Yeterli takım yok.'); return; }
    this.busy = true; $('btnBalance').disabled = true;
    const N = 100, res = [];
    let i = 0;
    const t0 = performance.now();
    const stepChunk = () => {
      const until = performance.now() + 30;
      while (i < N && performance.now() < until) {
        const seed = randomSeed();
        const r = new RNG((seed ^ 0x51ED27) >>> 0);
        const teams = r.shuffle(teamsAll).slice(0, n).map(t => ({ ...t }));
        let theme = s.theme === 'auto' ? r.pick(THEME_IDS) : s.theme;
        const g = new Game({ mode: 'arena', teams, seed, theme, lives: s.lives, speedMult: s.speedMult, powerups: false });
        while (!g.over && g.t < 200) g.step(DT);
        res.push(g.getResult());
        i++;
      }
      $('balBar').style.width = (i / N * 100) + '%';
      if (i < N) setTimeout(stepChunk, 0);
      else { this.show(res, n, (performance.now() - t0) / 1000); this.busy = false; $('btnBalance').disabled = false; }
    };
    $('balOut').innerHTML = '<div class="hint">Simüle ediliyor…</div>';
    stepChunk();
  },
  show(res, n, secs) {
    const N = res.length, d = res.map(r => r.duration);
    const avg = d.reduce((a, b) => a + b, 0) / N;
    const goals = res.reduce((a, r) => a + r.goals, 0), og = res.reduce((a, r) => a + r.ownGoals, 0);
    const ok = avg >= 25 && avg <= 40;
    const slot = Array.from({ length: n }, () => Array(n).fill(0));
    const byTeam = new Map();
    for (const r of res) for (const t of r.teams) {
      slot[t.slot][t.place - 1]++;
      const b = byTeam.get(t.code) || { m: 0, w: 0, ps: 0 }; b.m++; if (t.place === 1) b.w++; b.ps += t.place; byTeam.set(t.code, b);
    }
    const pct = (x, tot) => tot ? Math.round(x / tot * 100) + '%' : '–';
    let html = `<div class="bal-grid">
      <div class="kv"><span>Ortalama süre</span><b class="${ok ? 'ok' : 'bad'}">${avg.toFixed(1)} sn</b></div>
      <div class="kv"><span>Min / Maks</span><b>${Math.min(...d).toFixed(1)} / ${Math.max(...d).toFixed(1)} sn</b></div>
      <div class="kv"><span>Uzatmaya giden</span><b>${pct(res.filter(r => r.overtime).length, N)}</b></div>
      <div class="kv"><span>Ort. toplam gol</span><b>${(goals / N).toFixed(1)}</b></div>
      <div class="kv"><span>Ort. kurtarış</span><b>${(res.reduce((a, r) => a + r.saves, 0) / N).toFixed(1)}</b></div>
      <div class="kv"><span>Kendi kalesine gol</span><b>${pct(og, goals)}</b></div>
    </div><div class="hint">${N} maç · ${secs.toFixed(1)} sn'de simüle edildi · hedef ortalama 25–40 sn ${ok ? '✅' : '⚠️'}</div>`;
    html += `<div class="hint"><b>Başlangıç pozisyonuna (kale) göre sıra dağılımı</b> — her satır ~eşitse rastgelelik adil:</div><table class="mini"><thead><tr><th>Kale</th>${Array.from({ length: n }, (_, k) => `<th>${k + 1}.</th>`).join('')}</tr></thead><tbody>` +
      slot.map((row, si) => `<tr><td>#${si + 1}</td>${row.map(c => `<td>${pct(c, N)}</td>`).join('')}</tr>`).join('') + '</tbody></table>';
    html += `<div class="hint"><b>Takım bazında</b> (maç · birincilik · ort. sıra):</div><table class="mini"><tbody>` +
      [...byTeam.entries()].sort((a, b) => b[1].w / b[1].m - a[1].w / a[1].m).map(([c, b]) => `<tr><td>${esc(c)}</td><td>${b.m}</td><td>${pct(b.w, b.m)}</td><td>${(b.ps / b.m).toFixed(2)}</td></tr>`).join('') + '</tbody></table>';
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
  const W = wrap.clientWidth - 16, H = wrap.clientHeight - 16;
  let h = H, w = h * 9 / 16;
  if (w > W) { w = W; h = w * 16 / 9; }
  c.style.width = Math.floor(w) + 'px'; c.style.height = Math.floor(h) + 'px';
}

async function boot() {
  Renderer.init($('c'));
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
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); if (!App.running || App.end) App.start(false); else App.togglePause(); }
  });
  requestAnimationFrame(frame);
}
window.addEventListener('DOMContentLoaded', boot);
