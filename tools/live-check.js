#!/usr/bin/env node
/*
  Canlı lig determinizm kontrolü — her tarayıcı aynı maçı birebir aynı hesaplamalı.
  1) DM (src/01_core.js) fonksiyonlarının doğruluğu: Math.sin/cos/atan2/exp ile karşılaştırır.
  2) Simülasyonun motorun matematik kütüphanesinden bağımsız olduğu: Math.sin/cos/atan2/hypot/exp/pow/log
     bozulmuşken (farklı bir tarayıcıyı taklit eder) oynanan maçlar normal sonuçlarla bit bit aynı olmalı.
  3) Takvim: günde 308 maç, bant geçişleri (05:00 / 09:00 / 19:00) doğru saatte.
  4) Taşma kuralı: aralık zorla 1 dakikaya indirilir (maçlar sığmaz) → maçlar asla üst üste binmez, hiçbir maç
     planlı saatinden önce başlamaz, takvim kilitlenmez ve normal aralığa dönülünce gecikme erir.
  5) Kural değişikliği ligi sıfırlamaz: dondurulmuş lig (taban) yeni kurallarla devam eder, geçmiş aynen kalır, yeni puan /
     sezon uzunluğu uygulanır, iki bağımsız tarayıcı ve checkpoint'ten devam eden üçüncüsü birebir aynı sonucu bulur;
     yayın iş akışının taban kararı (tools/live-base.js) doğru çalışır.
  5c) Geçmiş sekmesi: biten her sezonun tablosu + yükselme elemesi arşivlenir, sekme yalnızca seçili sezonu çizer (açılışta en son),
     eski biçimli (arşivsiz) kayıtlar önbellek olarak kabul edilmez, taban arşivi korur.
  6) --long: gerçek takvimle 48 saatlik hızlandırılmış koşu (gün ve bant geçişleri, ~10 sezon: 51 grup + 12 eleme maçı, şampiyon sınırı).
  Kullanım: node tools/live-check.js [maç sayısı] [--long]
*/
const fs = require('fs'), path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const load = () => { const m = { exports: {} }; new Function('module', src('01_core.js') + '\n' + src('02_sim.js') +
  '\nmodule.exports = { CONFIG, DEFAULT_TEAMS, Game, RNG, DT, THEME_IDS, DM, planSeason };')(m); return m.exports; };
const N = +(process.argv.find(a => /^\d+$/.test(a)) || 20);
let fail = 0;

/* 1) accuracy */
{
  const { DM } = load();
  let e = { sin: 0, cos: 0, atan2: 0, exp: 0 };
  const rel = (a, b) => Math.abs(a - b) / Math.max(1e-300, Math.abs(b));
  for (let i = 0; i < 200000; i++) {
    const x = (Math.random() - 0.5) * 80, y = (Math.random() - 0.5) * 80;
    e.sin = Math.max(e.sin, Math.abs(DM.sin(x) - Math.sin(x)));
    e.cos = Math.max(e.cos, Math.abs(DM.cos(x) - Math.cos(x)));
    e.atan2 = Math.max(e.atan2, Math.abs(DM.atan2(y, x) - Math.atan2(y, x)));
    const z = (Math.random() - 0.7) * 60;
    e.exp = Math.max(e.exp, rel(DM.exp(z), Math.exp(z)));
  }
  const ok = Object.values(e).every(v => v < 1e-14);
  if (!ok) fail++;
  console.log(`DM doğruluğu (en büyük hata): ${Object.entries(e).map(([k, v]) => `${k} ${v.toExponential(1)}`).join(' · ')} ${ok ? '✅' : '❌'}`);
}

/* 2) independence from the engine's libm */
const runAll = () => {
  const { DEFAULT_TEAMS, Game, RNG, DT, THEME_IDS, planSeason } = load();
  const teams = DEFAULT_TEAMS.map((t, i) => ({ id: 't' + (i + 1), ...t })), out = [];
  for (let i = 0; i < N; i++) {
    const seed = (0x9E3779B9 * (i + 1)) >>> 0, rng = new RNG(seed ^ 0x51ED27);
    const g = new Game({ mode: 'arena', teams: rng.shuffle(teams).slice(0, 6), seed, theme: rng.pick(THEME_IDS), lives: 1, speedMult: 1, powerups: false });
    let n = 0; while (!g.over) { g.step(DT); n++; }
    out.push({ n, r: g.getResult(), b: g.balls.map(b => [b.x, b.y, b.vx, b.vy]) });
  }
  /* promotion playoff matches: two clubs, the final-duel pitch */
  for (let i = 0; i < N; i++) {
    const seed = (0x85EBCA6B * (i + 1)) >>> 0, rng = new RNG(seed ^ 0x51ED27);
    const g = new Game({ mode: 'arena', teams: rng.shuffle(teams).slice(0, 2), seed, theme: rng.pick(THEME_IDS), lives: 1, speedMult: 1, powerups: false });
    let n = 0; while (!g.over) { g.step(DT); n++; }
    out.push({ n, r: g.getResult(), b: g.balls.map(b => [b.x, b.y, b.vx, b.vy]) });
  }
  out.push(planSeason(teams.map(t => t.id), 17, 6, new RNG(12345)));
  return JSON.stringify(out);
};
const normal = runAll();
const keep = {};
for (const f of ['sin', 'cos', 'tan', 'atan', 'atan2', 'hypot', 'exp', 'pow', 'log']) {
  keep[f] = Math[f];
  Math[f] = (...a) => { const v = keep[f](...a); return v * (1 + 3e-16); };   // a "different browser": last-bit differences
}
const poisoned = runAll();
Object.assign(Math, keep);
const same = normal === poisoned;
if (!same) fail++;
console.log(`${N} grup maçı + ${N} eleme (1v1) maçı + sezon fikstürü, Math kütüphanesi bozulmuşken: ${same ? 'birebir aynı ✅' : 'FARKLI ❌ (simülasyon hâlâ Math.sin/cos/… kullanıyor)'}`);

/* 3–5) timetable, overrun rule, long run (the real engine: src/07_live.js through tools/live-node.js) */
(async () => {
  const { loadLive } = require('./live-node.js');
  const ok = (cond, msg) => { if (!cond) fail++; console.log(`${msg} ${cond ? '✅' : '❌'}`); };
  /* run the league until time t, logging every match's [planned slot, start, end] */
  const runUntil = async (L, t) => {
    const log = [], close = L.Live.closeMatch.bind(L.Live);
    L.Live.closeMatch = (m) => { log.push({ n: m.n, slot: L.Live.slot(m.n), start: m.start, end: m.start + Math.round(m.dur * 1000) }); close(m); };
    await L.Live.catchUp(0, () => t);
    return log;
  };
  const sane = (log, gap) => log.every((x, i) => x.start >= x.slot && (i === 0 || x.start >= log[i - 1].end + gap * 1000) && x.end > x.start);
  {
    const { Live, CONFIG } = loadLive(), c = (n) => Live.clock(Live.slot(n));
    CONFIG.LIVE.start = '2026-11-04'; Live._slots = null;
    ok(Live.slots().length === 308 && c(0) === '05:00' && c(47) === '08:55' && c(48) === '09:00' && c(107) === '18:50' && c(108) === '19:00' && c(307) === '04:57' && c(308) === '05:00' && Live.slot(308) - Live.slot(0) === 864e5,
      'Takvim: günde 308 maç · 05:00 / 08:55→09:00 / 18:50→19:00 / 04:57→05:00 (ertesi gün)');
    CONFIG.LIVE.start = '2026-11-04T00:31'; Live._slots = null;
    ok(c(0) === '00:33' && c(1) === '00:36' && c(88) === '04:57' && c(89) === '05:00' && Live.slot(308) - Live.slot(0) === 864e5,
      'Saatli başlangıç: 00:31 → ilk maç 00:33 (sıradaki 3 dk aralığı) · 04:57→05:00 bant geçişi');
  }
  {
    const L = loadLive();
    L.CONFIG.LIVE.start = '2026-11-04'; L.CONFIG.LIVE.bands = [{ from: '05:00', every: 1 }, { from: '06:00', every: 3 }]; L.Live._slots = null;
    const log = await runUntil(L, L.Live.slot(0) + 4 * 3600e3);
    const late = log.map(x => x.start - x.slot), back = log.findIndex((x, i) => i > 60 && x.start === x.slot);
    ok(sane(log, L.CONFIG.LIVE.gap) && log.length > 60 && back > 0,
      `Taşma kuralı (05–06 arası her 1 dk, maçlar sığmıyor): ${log.length} maç, üst üste binen yok, en büyük gecikme ${Math.round(Math.max(...late) / 60e3)} dk, normal aralıkta ${log[back] ? L.Live.clock(log[back].start) : '—'}'de saatine döndü`);
  }
  /* 5) a rule change does not reset the league: the frozen league (base) plays on under the new rules */
  {
    const T = (L, n) => L.Live.slot(n) + 1;                       // a moment shortly after match n's kick-off
    const shortSeason = (L, len) => { L.CONFIG.SEASON_LENGTH = len; L.Live.adopt(null); };   // len group weeks + 12 playoff matches per season
    const J = (x) => JSON.stringify(x, (k, v) => (k === 'created' ? undefined : v));   // seasonPlan.created is a wall-clock stamp, informational only
    /* the old rules: 2-week seasons (6 group + 12 playoff matches); freeze the league 4 matches into season 2 */
    const A = loadLive(); shortSeason(A, 2);
    await A.Live.catchUp(0, () => T(A, 22)); A.Live.snapshot();
    const frozen = JSON.parse(A.Live.lastClean).data, mk = (data) => ({ id: 'test', league: A.Live.league(), sim: 'old', count: data.liveCount, data });
    const base = mk(frozen);
    /* the new rules: other points, 3-week seasons */
    const fromBase = (b) => { const L = loadLive({ simHash: 'new', base: b }); L.CONFIG.POINTS = [9, 5, 2, 1, 0, 0, 0, 0, 0, 0]; L.CONFIG.SEASON_LENGTH = 3; L.Live.adopt(L.Live.baseState()); return L; };
    const B = fromBase(base), d0 = B.League.data;
    ok(d0.liveCount === frozen.liveCount && J(d0.history) === J(frozen.history) && J(d0.table) === J(frozen.table) && J(d0.champions) === J(frozen.champions) && J(d0.seasons) === J(frozen.seasons) && frozen.seasons.length === 1 && d0.season === frozen.season,
      `Taban: ${frozen.liveCount} maçlık lig (Sezon ${frozen.season}, ${frozen.history.length} grup maçı, ${frozen.champions.length} şampiyon) olduğu gibi yüklendi`);
    ok(d0.points.slice(0, 4).join() === '9,5,2,1' && d0.seasonLength === 2 && d0.settings.lives === B.CONFIG.DEFAULT_LIVES,
      'Yeni puanlama hemen geçerli; başlamış sezonun uzunluğu (2 hafta) sezon bitene kadar korunuyor');
    const hashed = B.Live.hash();
    ok(hashed.endsWith('@test') && hashed.startsWith('new:') && J(B.Live.parts(hashed)) === J({ sim: 'new', league: B.Live.league(), base: 'test' }) &&
       J(B.Live.parts('abc:' + B.Live.league())) === J({ sim: 'abc', league: B.Live.league(), base: '' }) && B.Live.parts('abc:başka-lig').league === null,
      'Hash: <kural>:<lig kimliği>@<taban>; tabansız (eski biçim) hash\'ler de ayrıştırılıyor');
    /* play on across the season change (match 36): 45 matches */
    const logB = []; const closeB = B.Live.closeMatch.bind(B.Live);
    B.Live.closeMatch = (m) => { logB.push(B.League.data.history.length); closeB(m); };
    await B.Live.catchUp(0, () => T(B, 45)); B.Live.snapshot();
    const dB = B.League.data;
    ok(dB.liveCount === 45 && dB.season === frozen.season + 1 && dB.seasonLength === 3 && dB.champions.length === frozen.champions.length + 1 && J(dB.champions.slice(0, frozen.champions.length)) === J(frozen.champions) && dB.seasons.length === 2 && J(dB.seasons[0]) === J(frozen.seasons[0]),
      `Sezon geçişi: yeni sezon 3 hafta (eski 2), eski şampiyonlar aynen duruyor, ${dB.champions.length}. şampiyon eklendi`);
    /* the points of the matches played after the freeze are the new ones, the table before the freeze is not rewritten */
    const rowsBefore = Object.fromEntries(Object.entries(frozen.table).map(([k, v]) => [k, v.pts]));
    {
      const C = fromBase(base); await C.Live.catchUp(0, () => T(C, 26));      // 4 more matches, still season 2
      const dC = C.League.data, added = dC.history.slice(frozen.history.length);
      const exp = {}; added.forEach(h => h.result.forEach(r => { exp[r.id] = (exp[r.id] || 0) + ([9, 5, 2, 1][r.place - 1] || 0); }));
      ok(added.length > 0 && Object.keys(dC.table).every(k => dC.table[k].pts - (rowsBefore[k] || 0) === (exp[k] || 0)) && J(dC.history.slice(0, frozen.history.length)) === J(frozen.history),
        `Taban sonrası ${added.length} maç yeni puanla (9-5-2-1) işlendi; tabandaki tablo ve geçmiş yeniden yazılmadı`);
    }
    ok(J(B.Live.baseState()) === J(frozen), 'Oynarken taban bozulmuyor (kopya üzerinde çalışılıyor)');
    /* determinism: another browser from the same base, and one that resumes from a checkpoint half way */
    const B2 = fromBase(base); await B2.Live.catchUp(0, () => T(B2, 45)); B2.Live.snapshot();
    const B3 = fromBase(base); await B3.Live.catchUp(0, () => T(B3, 31)); B3.Live.snapshot();
    const B4 = fromBase(base); B4.Live.adopt(B4.Live.parseState(B3.Live.lastClean));
    await B4.Live.catchUp(0, () => T(B4, 45)); B4.Live.snapshot();
    ok(J(dB) === J(B2.League.data) && J(dB) === J(B4.League.data) && B4.Live.parseState(B3.Live.lastClean),
      'Aynı tabandan iki bağımsız tarayıcı + yarı yoldaki checkpoint\'ten devam eden: 45. maçta birebir aynı lig');
    /* a state taken under another base / other rules is rejected */
    const other = loadLive({ simHash: 'new', base: { ...base, id: 'other' } });
    ok(other.Live.parseState(B3.Live.lastClean) === null && loadLive({ simHash: 'x' }).Live.parseState(B3.Live.lastClean) === null,
      'Başka tabanın / başka kuralın checkpoint\'i geçersiz sayılıyor');
    /* a freeze exactly between two seasons: the new season length applies at once */
    const E = loadLive(); shortSeason(E, 2); await E.Live.catchUp(0, () => T(E, 18)); E.Live.snapshot();
    const eb = mk(JSON.parse(E.Live.lastClean).data), F = fromBase(eb);
    ok(eb.data.season === 2 && eb.data.history.length === 0 && F.League.data.seasonLength === 3, 'Sezonlar arasında dondurulan lig: yeni sezon uzunluğu (3 hafta) hemen geçerli');
  }
  /* 5c) the "Geçmiş" tab: season archive + rendering of one season at a time */
  {
    const L = loadLive(); L.CONFIG.SEASON_LENGTH = 2; L.Live.adopt(null);
    const { Live, LivePages, League } = L, count = (h, re) => (h.match(re) || []).length;
    ok(LivePages.history().includes('Henüz biten sezon yok'), 'Geçmiş: ilk sezon bitmeden "henüz biten sezon yok" gösteriliyor');
    await Live.catchUp(0, () => Live.slot(40) + 1); Live.snapshot();
    const d = League.data, sz = d.seasons, c0 = sz[0];
    const top3 = (r) => [r.cup.res.FIN[0], r.cup.res.FIN[1], r.cup.res['3RD'][0]].sort().join();
    ok(sz.length === 2 && sz.every((r, i) => r.season === i + 1 && r.champ === d.champions[i].id && r.rows[0][0] === r.champ && r.rows[0][2] === d.champions[i].pts
        && r.rows.length === 18 && r.rows.every((x, k) => !k || r.rows[k - 1][2] >= x[2]) && r.n === 6 && r.p.slice(0, 4).join() === '4,3,2,1'
        && r.out.length === 3 && r.rows.slice(-3).map(x => x[0]).sort().join() === r.out.slice().sort().join()
        && r.up.length === 3 && r.up.slice().sort().join() === top3(r) && Object.keys(r.cup.res).length === 12 && r.t0 > 0 && r.t1 > r.t0),
      `Arşiv: ${sz.length} biten sezon; her birinde sıralı tablo (şampiyon başta), düşen 3, yükselen 3 (= final galibi, finalist, 3.lük galibi), 12 eleme maçı`);
    ok(JSON.stringify(c0).length < 1500, `Arşiv küçük: sezon başına ${JSON.stringify(c0).length} bayt (50 sezon ≈ ${Math.round(JSON.stringify(c0).length * 50 / 1024)} KB)`);
    Live.histSel = 0;
    let h = LivePages.history();
    const nm = (id) => LivePages.anyTeam(id).name;
    ok(h.includes('Sezon 2 şampiyonu') && !h.includes('Sezon 1 şampiyonu') && count(h, /<table class="lp-table"/g) === 1 && count(h, /<option /g) === 2 && h.includes(`<option value="2" selected>`)
        && h.includes('title="Önceki sezon">') && h.includes('title="Sonraki sezon" disabled') && h.includes('Yükselme eleme maçları') && count(h, /class="fx-match done"/g) === 12,
      'Sekme açılınca en son biten sezon (2): yalnızca onun tablosu, 12 eleme maçı; sezon seçici 2 sezon listeliyor');
    ok(sz[1].up.every(id => h.includes(nm(id))) && h.includes(nm(sz[1].champ)) && sz[1].out.every(id => h.includes(nm(id))), 'Seçili sezonun şampiyonu, yükselenleri ve düşenleri sayfada');
    Live.histSel = 1; h = LivePages.history();
    ok(h.includes('Sezon 1 şampiyonu') && !h.includes('Sezon 2 şampiyonu') && count(h, /<table class="lp-table"/g) === 1 && h.includes('title="Önceki sezon" disabled') && h.includes(`data-season="2" title="Sonraki sezon"`) && h.includes(`<option value="1" selected>`),
      'Eski sezon (1) seçilince yalnızca onun tablosu yüklenir; ‹ pasif, › sezon 2\'ye gidiyor');
    Live.histSel = 99; ok(LivePages.history().includes('Sezon 2 şampiyonu'), 'Geçersiz seçim en son sezona düşüyor');
    Live.histSel = 0;
    /* the table is the one that was on the screen: frozen at the season's end */
    const R = loadLive(); R.CONFIG.SEASON_LENGTH = 2; R.Live.adopt(null);
    let last = null; const close = R.Live.closeMatch.bind(R.Live);
    R.Live.closeMatch = (m) => { if (R.League.seasonOver()) last = R.League.ranking().map(x => [x.t.id, x.r.played, x.r.pts]); close(m); };
    await R.Live.catchUp(0, () => R.Live.slot(20) + 1);
    ok(last && JSON.stringify(R.League.data.seasons[0].rows.map(r => r.slice(0, 3))) === JSON.stringify(last), 'Arşivlenen tablo, sezonun bittiği andaki tabloyla aynı');
    /* storage: only the newest keepChampions seasons; old-format (archive-less) states are not trusted as caches */
    const K = loadLive(); K.CONFIG.SEASON_LENGTH = 2; K.CONFIG.LIVE.keepChampions = 1; K.Live.adopt(null);
    await K.Live.catchUp(0, () => K.Live.slot(40) + 1);
    ok(K.League.data.seasons.length === 1 && K.League.data.seasons[0].season === 2, 'Arşiv en fazla keepChampions sezon tutuyor (en yenileri)');
    const env = JSON.parse(Live.lastClean), noav = { ...env }; delete noav.av;
    ok(Live.parseState(env) && Live.parseState(noav) === null && Live.parseState(noav, true) && Live.parseState({ ...env, av: 0 }) === null,
      'Arşivsiz eski biçimli kayıt önbellek/checkpoint olarak geçersiz; yalnızca yayın aracı (legacy) kabul ediyor');
  }
  /* 5b) the publish workflow's base decision (tools/live-base.js) */
  {
    const { decide } = require('./live-base.js'), L = loadLive(), parts = (h) => L.Live.parts(h), lg = L.Live.league();
    const st = (sim, count, base) => ({ hash: `${sim}:${lg}${base ? '@' + base : ''}`, savedAt: 't' + count, data: { liveCount: count } });
    const bs = (sim, count, id = 'b1') => ({ id, league: lg, sim, count, data: { liveCount: count } });
    const cur = { league: lg, sim: 'S2' }, run = (prevBase, pub, c = cur) => decide({ cur: c, prevBase, pub, parts });
    let r;
    r = run(null, null);                              ok(r.action === 'none', 'Taban kararı: ilk yayın → tabansız');
    r = run(null, st('S2', 50));                      ok(r.action === 'none', 'Taban kararı: checkpoint bu kodla uyumlu, taban yok → tabansız');
    r = run(null, st('S1', 142));                     ok(r.action === 'rebase' && r.base.data.liveCount === 142 && r.base.sim === 'S2' && r.base.count === 142, 'Taban kararı: kural değişti → yayındaki checkpoint (142 maç) yeni tabanı oldu');
    r = run(bs('S2', 142), st('S2', 160, 'b1'));      ok(r.action === 'keep' && r.base.id === 'b1', 'Taban kararı: kural aynı → taban aynen taşınıyor');
    r = run(bs('S1', 142), st('S1', 190, 'b1'));      ok(r.action === 'rebase' && r.base.data.liveCount === 190, 'Taban kararı: ikinci kural değişikliği → taban birikimli, en son checkpoint\'ten yenilendi');
    r = run(bs('S1', 142), null);                     ok(r.action === 'rebase' && r.base.data.liveCount === 142, 'Taban kararı: checkpoint yok → önceki tabandan devam (lig sıfırlanmıyor)');
    r = run(bs('S1', 200), st('S1', 150));            ok(r.action === 'rebase' && r.base.data.liveCount === 200, 'Taban kararı: elde en ileri durum seçilir');
    r = run(bs('S1', 142), st('S1', 190, 'b1'), { league: lg + 'x', sim: 'S2' });
    ok(r.action === 'none' && st('S1', 1).hash.endsWith(lg), 'Taban kararı: lig kimliği (start/takvim/salt) değişti → yeni lig, eski durum yok sayılır');
  }
  if (process.argv.includes('--long')) {
    const L = loadLive(), t0 = Date.now();
    L.CONFIG.LIVE.start = '2026-11-04'; L.Live._slots = null;
    const log = await runUntil(L, L.Live.slot(0) + 48 * 3600e3);
    const d = L.League.data, late = log.filter(x => x.start > x.slot).length, longest = Math.max(...log.map(x => x.end - x.start)) / 1000;
    ok(sane(log, L.CONFIG.LIVE.gap) && log.length === 616 && d.season >= 10 && d.champions.length <= L.CONFIG.LIVE.keepChampions,
      `48 saat: ${log.length} maç, ${d.season - 1} sezon bitti, ertelenen maç ${late}, en uzun maç ${longest.toFixed(0)} sn (${((Date.now() - t0) / 1000).toFixed(0)} sn'de hesaplandı)`);
  }
  process.exit(fail ? 1 : 0);
})();
