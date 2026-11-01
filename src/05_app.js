/* =====================================================================
   LEAGUE  (persistent table in localStorage, JSON import/export)
   ===================================================================== */
const League = {
  data: null, storageOK: true,
  fresh() {
    return {
      version: 1, teamsVersion: 3,
      teams: DEFAULT_TEAMS.map((t, i) => ({ id: 't' + (i + 1), name: t.name, code: t.code, c1: t.c1, c2: t.c2 })),
      table: {}, week: 1, weekMatch: 1, matchNo: 1, seasonLength: CONFIG.SEASON_LENGTH,
      points: CONFIG.POINTS.slice(), derbyWinPoints: CONFIG.DERBY_WIN_POINTS,
      history: [], champions: [], settings: {},
    };
  },
  defaultSettings() {
    return { mode: 'arena', teamCount: CONFIG.DEFAULT_TEAM_COUNT, selMode: 'auto', manual: [], seed: randomSeed(),
      theme: 'auto', lives: CONFIG.DEFAULT_LIVES, speedMult: CONFIG.DEFAULT_SPEED_MULT, powerups: false,
      simSpeed: 1, volume: 0.8, muted: false, testMatch: false, sv: 2 };
  },
  normalize(d) {
    const f = this.fresh();
    if (!d || typeof d !== 'object' || !Array.isArray(d.teams) || d.teams.length < 2) { f.settings = this.defaultSettings(); return f; }
    const out = Object.assign(f, d);
    const used = new Set();
    out.teams = d.teams.filter(t => t && t.name).map((t, i) => {
      let id = String(t.id || ('t' + (i + 1)));
      while (used.has(id)) id += '_';
      used.add(id);
      return { id, name: String(t.name).slice(0, 40), code: upTR(t.code || t.name).replace(CODE_STRIP, '').slice(0, 3).padEnd(3, 'X'),
        c1: validColor(t.c1, '#888888'), c2: validColor(t.c2, '#ffffff') };
    });
    out.table = (d.table && typeof d.table === 'object') ? d.table : {};
    for (const id of Object.keys(out.table)) {
      const r = out.table[id] || {};
      out.table[id] = { played: +r.played || 0, pts: +r.pts || 0, wins: +r.wins || 0, gf: +r.gf || 0, ga: +r.ga || 0 };
    }
    out.week = Math.max(1, +d.week || 1); out.weekMatch = Math.max(1, +d.weekMatch || 1); out.matchNo = Math.max(1, +d.matchNo || 1);
    delete out.day;
    out.seasonLength = Math.max(1, +d.seasonLength || CONFIG.SEASON_LENGTH);
    out.points = Array.isArray(d.points) && d.points.length ? d.points.map(x => +x || 0) : CONFIG.POINTS.slice();
    while (out.points.length < 10) out.points.push(0);
    out.teamsVersion = 3;
    out.history = Array.isArray(d.history) ? d.history : [];
    out.champions = Array.isArray(d.champions) ? d.champions : [];
    out.settings = Object.assign(this.defaultSettings(), d.settings || {});
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
      Object.assign(this.data, { teams: f.teams, table: {}, week: 1, weekMatch: 1, matchNo: 1, history: [], champions: [], teamsVersion: 3 });
      this.data.settings.manual = [];
      this.migrated = true;
    }
  },
  save() {
    try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.data)); this.storageOK = true; }
    catch (e) { this.storageOK = false; }
    UI.storageWarn(!this.storageOK);
  },
  rowOf(table, id) { return table[id] || { played: 0, pts: 0, wins: 0, gf: 0, ga: 0 }; },
  ranking(table = this.data.table) {
    return this.data.teams.map(t => ({ t, r: this.rowOf(table, t.id) })).sort((a, b) =>
      b.r.pts - a.r.pts || (b.r.gf - b.r.ga) - (a.r.gf - a.r.ga) || b.r.gf - a.r.gf || b.r.wins - a.r.wins || a.t.name.localeCompare(b.t.name));
  },
  pointsFor(res, tm) {
    if (res.mode === 'arena') return this.data.points[tm.place - 1] || 0;
    if (res.mode === 'derby') return tm.place === 1 ? this.data.derbyWinPoints : 0;
    return 0;
  },
  applyTo(table, res) {
    if (res.mode === 'final') return;
    for (const tm of res.teams) {
      if (!this.data.teams.some(t => t.id === tm.id)) continue;
      const r = table[tm.id] || (table[tm.id] = { played: 0, pts: 0, wins: 0, gf: 0, ga: 0 });
      r.played++; r.gf += tm.gf; r.ga += tm.ga; r.pts += this.pointsFor(res, tm);
      if (tm.place === 1) r.wins++;
    }
  },
};
function validColor(c, def) { return /^#[0-9a-fA-F]{6}$/.test(String(c || '')) ? String(c).toUpperCase() : def; }
function randomSeed() { return 1 + Math.floor(Math.random() * 99999); }
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
    $('mode').value = s.mode; $('teamCount').value = s.teamCount; $('selMode').value = s.selMode;
    $('seed').value = s.seed; $('theme').value = s.theme; $('lives').value = s.lives;
    $('speedMult').value = s.speedMult; $('simSpeed').value = String(s.simSpeed);
    $('volume').value = s.volume; $('testMatch').checked = s.testMatch;
    $('pointsInput').value = League.data.points.join(','); $('seasonLen').value = League.data.seasonLength;
    $('derbyPts').value = League.data.derbyWinPoints;
    AudioSys.vol = s.volume; AudioSys.muted = s.muted;
    const read = () => {
      s.mode = $('mode').value;
      s.teamCount = clamp(Math.round(+$('teamCount').value || 6), 4, 10);
      s.selMode = $('selMode').value;
      s.seed = Math.max(0, Math.floor(+$('seed').value || 0));
      s.theme = $('theme').value;
      s.lives = clamp(Math.round(+$('lives').value || 3), 1, 5);
      s.speedMult = clamp(+$('speedMult').value || 1, 0.7, 1.5);
      s.simSpeed = +$('simSpeed').value || 1;
      s.testMatch = $('testMatch').checked;
      League.save(); this.refresh();
      if (!App.running || App.end) App.prepare();
    };
    ['mode', 'teamCount', 'selMode', 'seed', 'theme', 'lives', 'speedMult', 'testMatch'].forEach(id => $(id).addEventListener('change', read));
    $('speedMult').addEventListener('input', () => { $('speedVal').textContent = '×' + (+$('speedMult').value).toFixed(2); });
    $('simSpeed').addEventListener('change', () => { s.simSpeed = +$('simSpeed').value || 1; League.save(); });
    $('volume').addEventListener('input', () => { s.volume = +$('volume').value; AudioSys.vol = s.volume; AudioSys.apply(); });
    $('volume').addEventListener('change', () => League.save());
    $('btnMute').addEventListener('click', () => { s.muted = !s.muted; AudioSys.muted = s.muted; AudioSys.apply(); League.save(); this.refresh(); });
    $('btnRandSeed').addEventListener('click', () => { $('seed').value = randomSeed(); read(); });
    $('btnStart').addEventListener('click', () => App.start(false));
    $('btnRecord').addEventListener('click', () => App.start(true));
    $('btnPause').addEventListener('click', () => App.togglePause());
    $('btnReset').addEventListener('click', () => App.reset());
    $('btnNewDay').addEventListener('click', () => {
      League.data.week++; League.data.weekMatch = 1; League.save(); this.refresh(); if (!App.running || App.end) App.prepare();
      this.toast(`📅 Hafta ${League.data.week} başladı.`);
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
          League.data = League.normalize(d); League.save(); this.init2(); App.prepare();
          this.toast('✅ Lig verisi içe aktarıldı.');
        } catch (e) { alert('İçe aktarma başarısız: ' + e.message); }
        $('importFile').value = '';
      };
      rd.readAsText(f);
    });
    $('btnResetLeague').addEventListener('click', () => {
      if (!confirm('Lig tablosu, gün sayacı, maç numarası ve geçmiş silinecek (takımlar korunur). Emin misiniz?')) return;
      const d = League.data; d.table = {}; d.week = 1; d.weekMatch = 1; d.matchNo = 1; d.history = []; d.champions = [];
      League.save(); this.refresh(); App.prepare(); this.toast('Lig sıfırlandı.');
    });
    $('btnTeams').addEventListener('click', () => TeamEditor.open());
    $('pointsInput').addEventListener('change', () => {
      const arr = $('pointsInput').value.split(/[,\s;]+/).filter(Boolean).map(x => Math.max(0, Math.round(+x) || 0)).slice(0, 10);
      while (arr.length < 10) arr.push(0);
      League.data.points = arr; $('pointsInput').value = arr.join(','); League.save();
    });
    $('derbyPts').addEventListener('change', () => { League.data.derbyWinPoints = Math.max(0, Math.round(+$('derbyPts').value) || 0); League.save(); });
    $('seasonLen').addEventListener('change', () => { League.data.seasonLength = Math.max(1, Math.round(+$('seasonLen').value) || 30); League.save(); this.refresh(); });
    $('btnCopy').addEventListener('click', async () => {
      const t = $('caption').value; if (!t) return;
      try { await navigator.clipboard.writeText(t); } catch (e) { $('caption').select(); document.execCommand('copy'); }
      this.toast('📋 Kopyalandı');
    });
    $('btnBalance').addEventListener('click', () => Balance.run());
    $('manualList').addEventListener('change', () => {
      s.manual = [...document.querySelectorAll('#manualList input:checked')].map(i => i.value);
      League.save(); this.refresh(); if (!App.running || App.end) App.prepare();
    });
    this.refresh();
  },
  init2() { this.init_values(); this.refresh(); },
  init_values() {
    const s = League.data.settings;
    $('mode').value = s.mode; $('teamCount').value = s.teamCount; $('selMode').value = s.selMode;
    $('seed').value = s.seed; $('theme').value = s.theme; $('lives').value = s.lives; $('speedMult').value = s.speedMult;
    $('testMatch').checked = s.testMatch;
    $('pointsInput').value = League.data.points.join(','); $('seasonLen').value = League.data.seasonLength; $('derbyPts').value = League.data.derbyWinPoints;
  },
  refresh() {
    const d = League.data, s = d.settings;
    $('speedVal').textContent = '×' + (+s.speedMult).toFixed(2);
    $('btnMute').textContent = s.muted ? '🔇' : '🔊';
    $('rowTeamCount').style.display = s.mode === 'arena' ? '' : 'none';
    $('rowSel').style.display = s.mode === 'final' ? 'none' : '';
    $('manualList').classList.toggle('hidden', s.selMode !== 'manual' || s.mode === 'final');
    if (s.selMode === 'manual') {
      const ml = $('manualList');
      const need = s.mode === 'derby' ? 2 : s.teamCount;
      ml.innerHTML = `<div class="hint">Seçili: <b>${s.manual.filter(id => d.teams.some(t => t.id === id)).length}</b> / ${need} — ${s.mode === 'derby' ? 'tam 2 takım' : '4–10 takım (işaretli sayı kullanılır)'}</div>` +
        d.teams.map(t => `<label class="mt"><input type="checkbox" value="${t.id}" ${s.manual.includes(t.id) ? 'checked' : ''}><span class="dot" style="background:${t.c1};border-color:${t.c2}"></span>${esc(t.code)} · ${esc(t.name)}</label>`).join('');
    }
    $('leagueInfo').innerHTML = `<div class="kv"><span>Hafta</span><b>${d.week} / ${d.seasonLength}</b></div><div class="kv"><span>Sıradaki grup maçı</span><b>${d.weekMatch} / ${App.perWeek()}</b></div><div class="kv"><span>Oynanan maç (toplam)</span><b>${d.history.length}</b></div><div class="hint">${d.teams.length} takım, maç başına ${s.teamCount} takım → haftada ${App.perWeek()} grup maçı; haftanın son grup maçı kaydedilince hafta kendiliğinden ilerler.</div>`
      + (s.selMode === 'auto' ? (() => {
          const plan = App.weekPlan(), cs = App.coocStats();
          const rows = plan.groups.map((g, i) => `<div class="kv"><span>${i + 1}. grup${i + 1 < d.weekMatch ? ' ✓' : i + 1 === d.weekMatch ? ' ▶' : ''}</span><b style="font-weight:600">${g.map(id => esc((d.teams.find(t => t.id === id) || {}).code || '?')).join(' · ')}</b></div>`).join('');
          return `<div class="hint" style="margin-top:10px"><b>Hafta ${d.week} grupları</b> (geçmişe göre adil dağıtım)</div>${rows}<div class="hint">Aynı grupta bulunma, takım ikilisi başına: en az <b>${cs.min}</b>, en çok <b>${cs.max}</b> kez.</div>`;
        })() : '');
    const note = $('seasonNote');
    if (d.week >= d.seasonLength) {
      note.classList.remove('hidden');
      note.innerHTML = d.week > d.seasonLength
        ? `🏁 <b>Sezon tamamlandı!</b> Mod olarak <b>Season Final</b> seçip şampiyonluk maçını oynayın. Ardından yeni sezon için "Ligi sıfırla".`
        : `🏁 Sezonun son haftası. Haftanın maçlarından sonra <b>Season Final</b> modunu oynayabilirsiniz.`;
    } else note.classList.add('hidden');
    const rk = League.ranking();
    $('leagueTable').innerHTML = `<table><thead><tr><th>#</th><th>Takım</th><th title="Oynanan">O</th><th title="Puan">P</th><th title="Birincilik">1st</th><th title="Atılan gol">AG</th><th title="Yenilen gol">YG</th><th title="Averaj">AV</th></tr></thead><tbody>` +
      rk.map((x, i) => { const av = x.r.gf - x.r.ga; return `<tr><td>${i + 1}</td><td class="tn"><span class="dot" style="background:${x.t.c1};border-color:${x.t.c2}"></span>${esc(x.t.name)}</td><td>${x.r.played}</td><td><b>${x.r.pts}</b></td><td>${x.r.wins}</td><td>${x.r.gf}</td><td>${x.r.ga}</td><td>${av > 0 ? '+' : ''}${av}</td></tr>`; }).join('') +
      `</tbody></table>` + (d.champions.length ? `<div class="hint">🏆 Şampiyonlar: ${d.champions.map(c => `${esc(c.name)} (hafta ${c.week})`).join(', ')}</div>` : '');
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
    if (this.rows.length < 4) { alert('En az 4 takım olmalı.'); return; }
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
    d.settings.manual = d.settings.manual.filter(id => ids.has(id));
    League.save(); UI.refresh(); App.prepare();
    $('teamModal').classList.add('hidden'); UI.toast('✅ Takımlar kaydedildi.');
  },
};

/* =====================================================================
   APP  (match setup, lifecycle, results, caption)
   ===================================================================== */
const App = {
  game: null, setup: null, running: false, paused: false, end: null, endT: 0, matchRealT: 0, title: '',
  simSpeed() { return League.data.settings.simSpeed || 1; },
  /* league points a finishing place earns in the current mode (null = no points, e.g. Season Final) */
  pointsForPlace(place) {
    const mode = this.setup ? this.setup.mode : 'arena';
    if (mode === 'arena') return League.data.points[place - 1] || 0;
    if (mode === 'derby') return place === 1 ? League.data.derbyWinPoints : 0;
    return null;
  },
  /* group matches per week: every club plays once a week (18 clubs, 6 per match → 3) */
  perWeek() { const d = League.data; return groupSizes(d.teams.length, clamp(d.settings.teamCount, 4, 10)).length; },
  /* how many times each pair of clubs has shared an arena match (from history) */
  coocMap() {
    const C = new Map();
    for (const h of League.data.history) {
      if (h.mode !== 'arena') continue;
      const t = h.teams;
      for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
        const k = t[i] < t[j] ? t[i] + '|' + t[j] : t[j] + '|' + t[i];
        C.set(k, (C.get(k) || 0) + 1);
      }
    }
    return C;
  },
  coocStats() {
    const C = this.coocMap(), ids = League.data.teams.map(t => t.id), v = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = ids[i] < ids[j] ? ids[i] + '|' + ids[j] : ids[j] + '|' + ids[i]; v.push(C.get(k) || 0);
    }
    return v.length ? { min: Math.min(...v), max: Math.max(...v) } : { min: 0, max: 0 };
  },
  /* this week's groups: computed once at the start of the week (fair split by meeting history) and stored */
  weekPlan() {
    const d = League.data, s = d.settings;
    const ids = d.teams.map(t => t.id);
    const key = ids.join(',') + '#' + s.teamCount;
    if (!d.weekPlan || d.weekPlan.week !== d.week || d.weekPlan.key !== key) {
      const C = this.coocMap();
      const cooc = (a, b) => C.get(a < b ? a + '|' + b : b + '|' + a) || 0;
      const rng = new RNG((d.week * 7919 + d.history.length * 31 + 17) >>> 0);
      d.weekPlan = { week: d.week, key, groups: planGroups(ids, groupSizes(ids.length, s.teamCount), cooc, rng) };
      League.save();
    }
    return d.weekPlan;
  },
  buildSetup() {
    const d = League.data, s = d.settings;
    const seed = (s.seed >>> 0);
    const srng = new RNG((seed ^ 0x5BD1E995) >>> 0);
    let teams, err = null;
    if (s.mode === 'final') {
      teams = League.ranking().slice(0, Math.min(4, d.teams.length)).map(x => x.t);
      if (teams.length < 3) err = 'Season Final için en az 3 takım gerekli.';
    } else {
      const n = s.mode === 'derby' ? 2 : s.teamCount;
      if (s.selMode === 'manual') {
        teams = d.teams.filter(t => s.manual.includes(t.id));
        if (s.mode === 'derby' && teams.length !== 2) err = 'Derby için manuel listede tam 2 takım işaretleyin.';
        if (s.mode === 'arena' && (teams.length < 4 || teams.length > 10)) err = 'Arena için manuel listede 4–10 takım işaretleyin.';
      } else if (s.mode === 'arena') {
        /* auto arena: this week's fair group (every club once a week, pairs meet equally often) */
        const plan = this.weekPlan();
        const ids = plan.groups[(d.weekMatch - 1) % plan.groups.length];
        teams = ids.map(id => d.teams.find(t => t.id === id)).filter(Boolean);
        if (teams.length < 3) err = 'Grup için yeterli takım yok.';
      } else {
        /* auto derby: draw from the least-played teams (seeded) */
        const groups = new Map();
        for (const t of d.teams) { const p = League.rowOf(d.table, t.id).played; if (!groups.has(p)) groups.set(p, []); groups.get(p).push(t); }
        teams = [];
        for (const p of [...groups.keys()].sort((a, b) => a - b)) {
          const grp = srng.shuffle(groups.get(p).sort((a, b) => a.id.localeCompare(b.id)));
          for (const t of grp) if (teams.length < n) teams.push(t);
        }
        if (teams.length < n) err = 'Yeterli takım yok.';
      }
    }
    let theme = s.theme;
    if (theme === 'auto') theme = srng.pick(THEME_IDS);
    else if (!THEME_DEFS[theme]) theme = 'classic';
    const title = s.mode === 'final' ? 'SEASON FINAL' : s.mode === 'derby' ? `WEEK ${d.week} · DERBY` : `WEEK ${d.week} · GROUP MATCH ${d.weekMatch}`;
    return { err, title, mode: s.mode, week: d.week, weekMatch: d.weekMatch, perWeek: this.perWeek(), matchNo: d.matchNo, seed, theme, test: s.testMatch,
      opts: { mode: s.mode, teams: (teams || []).map(t => ({ ...t })), seed, theme, lives: s.lives, speedMult: s.speedMult, powerups: false } };
  },
  prepare() {
    if (Recorder.active) return false;
    const setup = this.buildSetup();
    this.setup = setup;
    this.title = setup.title;
    this.end = null; this.endT = 0; this.running = false; this.paused = false; this.matchRealT = 0; acc = 0;
    if (setup.err) { this.game = null; UI.toast('⚠️ ' + setup.err); UI.status(); return false; }
    this.game = new Game(setup.opts);
    this.game.onEvent = (t, dd) => FX.onEvent(t, dd);
    FX.reset(this.game); Renderer.resetTrails();
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
      Recorder.start(s.mode === 'arena' ? `arena_week${s.week}_match${s.weekMatch}_seed${s.seed}` : `${s.mode}_week${s.week}_seed${s.seed}`);
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
    const rows = d.teams.map(t => {
      const tm = res.teams.find(x => x.id === t.id);
      return { id: t.id, name: t.name, c1: t.c1, c2: t.c2, today: today.has(t.id),
        oldRank: oldRank.get(t.id), newRank: newRank.get(t.id),
        oldPts: League.rowOf(before, t.id).pts, newPts: League.rowOf(after, t.id).pts,
        played: League.rowOf(after, t.id).played, gf: League.rowOf(after, t.id).gf, delta: tm ? League.pointsFor(res, tm) : 0 };
    });
    const leaderBefore = rkB[0] && rkB[0].r.played ? rkB[0].t.id : null;
    const leaderAfter = rkA[0].t;
    let subtitle;
    if (g.isDerby) { const a = g.teams[0], b = g.teams[1]; subtitle = `${a.code} ${a.score} – ${b.score} ${b.code}`; }
    else {
      const L = g.teams.find(t => t.place === 2);
      subtitle = L && g.finalDuel ? `Final: ${W.code} ${W.score} – ${L.score} ${L.code}` : `${W.gf} goals · ${W.saves} saves`;
    }
    /* this match's full result: every team's place, goals scored (own goals excluded) and points earned */
    const standings = res.teams.slice().sort((a, b) => a.place - b.place).map(tm => {
      const T = g.teams[tm.slot];
      return { name: T.name, code: T.code, c1: T.c1, c2: T.c2, place: tm.place, gf: tm.gf, pts: s.mode === 'final' ? null : League.pointsFor(res, tm) };
    });
    this.end = { winner: { name: W.name, code: W.code, c1: W.c1, c2: W.c2 }, rows, standings, champion: s.mode === 'final', subtitle };
    this.endT = 0;
    FX.startEndConfetti([W.c1, W.c2, '#FFD54F', '#ffffff']);
    /* persist */
    if (!s.test) {
      if (s.mode === 'final') d.champions.push({ id: W.id, name: W.name, week: s.week, seed: s.seed });
      d.table = after;
      d.history.push({ matchNo: s.matchNo, week: s.week, weekMatch: s.mode === 'arena' ? s.weekMatch : null, mode: s.mode, seed: s.seed, theme: res.theme, date: new Date().toISOString(),
        teams: res.teams.map(t => t.id), winner: W.id, duration: res.duration,
        result: res.teams.map(t => ({ id: t.id, code: t.code, place: t.place, gf: t.gf, ga: t.ga, saves: t.saves, score: t.score })) });
      d.matchNo++;
      if (s.mode === 'arena') {
        d.weekMatch++;
        if (d.weekMatch > s.perWeek) { d.week++; d.weekMatch = 1; setTimeout(() => UI.toast(`📅 Hafta ${d.week} başladı.`), 300); }
      }
      d.settings.seed = randomSeed(); $('seed').value = d.settings.seed;
      League.save();
    }
    $('caption').value = this.caption(res, W, leaderBefore !== leaderAfter.id && rkA[0].r.pts > 0 ? leaderAfter : null);
    UI.refresh();
  },
  caption(res, W, newLeader) {
    const s = this.setup, g = this.game;
    let l1;
    if (s.mode === 'final') l1 = `Season Final 🏆 ${W.name} are the champions!`;
    else if (s.mode === 'derby') { const L = g.teams[1 - g.winner]; l1 = `Week ${s.week} · Derby 🏆 ${W.name} win ${W.score}–${L.score} vs ${L.name}!`; }
    else {
      const L = g.teams.find(t => t.place === 2);
      l1 = `Week ${s.week} · Group Match ${s.weekMatch} 🏆 ${W.name} win${L && g.finalDuel ? ` the final ${W.score}–${L.score} vs ${L.name}` : ''}!`;
    }
    const top = g.teams.slice().sort((a, b) => b.gf - a.gf || a.place - b.place)[0];
    let extra = '';
    if (top && top.gf > 0) {
      extra = `${top.name} scored the most goals (${top.gf})`;
      if (newLeader && !s.test) extra += newLeader.id === top.id ? ' and they are the new league leader!' : ` — and ${newLeader.name} is the new league leader!`;
      else extra += '!';
    } else if (newLeader && !s.test) extra = `New league leader: ${newLeader.name}!`;
    const l2 = s.mode === 'final' ? 'Who wins next season? Comment your team 👇' : 'Who takes the top spot next? Comment your team 👇';
    return [l1, extra, l2, '#satisfying #football #simulation #arena #oddlysatisfying #league'].filter(Boolean).join('\n');
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
    const mode = s.mode, n = mode === 'derby' ? 2 : mode === 'final' ? Math.min(4, teamsAll.length) : s.teamCount;
    if (teamsAll.length < n) { alert('Yeterli takım yok.'); return; }
    this.busy = true; $('btnBalance').disabled = true;
    const N = 100, res = [];
    let i = 0;
    const t0 = performance.now();
    const stepChunk = () => {
      const until = performance.now() + 30;
      while (i < N && performance.now() < until) {
        const seed = randomSeed() * 7 + i;
        const r = new RNG((seed ^ 0x51ED27) >>> 0);
        const teams = r.shuffle(teamsAll).slice(0, n).map(t => ({ ...t }));
        let theme = s.theme === 'auto' ? r.pick(THEME_IDS) : s.theme;
        const g = new Game({ mode, teams, seed, theme, lives: s.lives, speedMult: s.speedMult, powerups: false });
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
  let rdt = (now - lastNow) / 1000; lastNow = now;
  if (rdt > 0.1) rdt = 0.1; if (rdt < 0) rdt = 0;
  const g = App.game;
  let dtW = 0;
  if (g && App.running && !App.paused && !g.over) {
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
