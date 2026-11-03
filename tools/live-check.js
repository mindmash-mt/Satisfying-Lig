#!/usr/bin/env node
/*
  Canlı lig determinizm kontrolü — her tarayıcı aynı maçı birebir aynı hesaplamalı.
  1) DM (src/01_core.js) fonksiyonlarının doğruluğu: Math.sin/cos/atan2/exp ile karşılaştırır.
  2) Simülasyonun motorun matematik kütüphanesinden bağımsız olduğu: Math.sin/cos/atan2/hypot/exp/pow/log
     bozulmuşken (farklı bir tarayıcıyı taklit eder) oynanan maçlar normal sonuçlarla bit bit aynı olmalı.
  3) Takvim: günde 308 maç, bant geçişleri (05:00 / 09:00 / 19:00) doğru saatte.
  4) Taşma kuralı: aralık zorla 1 dakikaya indirilir (maçlar sığmaz) → maçlar asla üst üste binmez, hiçbir maç
     planlı saatinden önce başlamaz, takvim kilitlenmez ve normal aralığa dönülünce gecikme erir.
  5) --long: gerçek takvimle 48 saatlik hızlandırılmış koşu (gün ve bant geçişleri, ~13 sezon, şampiyon sınırı).
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
console.log(`${N} maç + sezon fikstürü, Math kütüphanesi bozulmuşken: ${same ? 'birebir aynı ✅' : 'FARKLI ❌ (simülasyon hâlâ Math.sin/cos/… kullanıyor)'}`);

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
    const { Live } = loadLive(), c = (n) => Live.clock(Live.slot(n));
    ok(Live.slots().length === 308 && c(0) === '05:00' && c(47) === '08:55' && c(48) === '09:00' && c(107) === '18:50' && c(108) === '19:00' && c(307) === '04:57' && c(308) === '05:00' && Live.slot(308) - Live.slot(0) === 864e5,
      'Takvim: günde 308 maç · 05:00 / 08:55→09:00 / 18:50→19:00 / 04:57→05:00 (ertesi gün)');
  }
  {
    const L = loadLive();
    L.CONFIG.LIVE.bands = [{ from: '05:00', every: 1 }, { from: '06:00', every: 3 }]; L.Live._slots = null;
    const log = await runUntil(L, L.Live.slot(0) + 4 * 3600e3);
    const late = log.map(x => x.start - x.slot), back = log.findIndex((x, i) => i > 60 && x.start === x.slot);
    ok(sane(log, L.CONFIG.LIVE.gap) && log.length > 60 && back > 0,
      `Taşma kuralı (05–06 arası her 1 dk, maçlar sığmıyor): ${log.length} maç, üst üste binen yok, en büyük gecikme ${Math.round(Math.max(...late) / 60e3)} dk, normal aralıkta ${log[back] ? L.Live.clock(log[back].start) : '—'}'de saatine döndü`);
  }
  if (process.argv.includes('--long')) {
    const L = loadLive(), t0 = Date.now();
    const log = await runUntil(L, L.Live.slot(0) + 48 * 3600e3);
    const d = L.League.data, late = log.filter(x => x.start > x.slot).length, longest = Math.max(...log.map(x => x.end - x.start)) / 1000;
    ok(sane(log, L.CONFIG.LIVE.gap) && log.length === 616 && d.season >= 12 && d.champions.length <= L.CONFIG.LIVE.keepChampions,
      `48 saat: ${log.length} maç, ${d.season - 1} sezon bitti, ertelenen maç ${late}, en uzun maç ${longest.toFixed(0)} sn (${((Date.now() - t0) / 1000).toFixed(0)} sn'de hesaplandı)`);
  }
  process.exit(fail ? 1 : 0);
})();
