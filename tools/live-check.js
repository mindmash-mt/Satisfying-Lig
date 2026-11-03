#!/usr/bin/env node
/*
  Canlı lig determinizm kontrolü — her tarayıcı aynı maçı birebir aynı hesaplamalı.
  1) DM (src/01_core.js) fonksiyonlarının doğruluğu: Math.sin/cos/atan2/exp ile karşılaştırır.
  2) Simülasyonun motorun matematik kütüphanesinden bağımsız olduğu: Math.sin/cos/atan2/hypot/exp/pow/log
     bozulmuşken (farklı bir tarayıcıyı taklit eder) oynanan maçlar normal sonuçlarla bit bit aynı olmalı.
  Kullanım: node tools/live-check.js [maç sayısı]
*/
const fs = require('fs'), path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const load = () => { const m = { exports: {} }; new Function('module', src('01_core.js') + '\n' + src('02_sim.js') +
  '\nmodule.exports = { CONFIG, DEFAULT_TEAMS, Game, RNG, DT, THEME_IDS, DM, planSeason };')(m); return m.exports; };
const N = +(process.argv[2] || 20);
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
process.exit(fail ? 1 : 0);
