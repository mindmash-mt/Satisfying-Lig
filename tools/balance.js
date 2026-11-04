#!/usr/bin/env node
/*
  Terminal denge testi — fizik/oyun mantığını (src/01_core.js + src/02_sim.js) çizimsiz çalıştırır.
  Her maç bir 1'e 1 maçtır (CONFIG.MATCH_TIME saniye; ilk takım ev sahibi, üst kale).
  Kullanım:  node tools/balance.js [maç sayısı] [--eleme]     (--eleme: berabere biterse altın gol + penaltı)
  Örnek:     node tools/balance.js 400
  Başka seed'lerle: SEED0=777777 node tools/balance.js 4000
  Ayar denemek için: CFG='{"BALL_SPEED":650,"FINAL_GOAL_FRAC":0.5}' node tools/balance.js
*/
const fs = require('fs'), path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const m = { exports: {} };
new Function('module', src('01_core.js') + '\n' + src('02_sim.js') +
  '\nmodule.exports = { CONFIG, DEFAULT_TEAMS, Game, RNG, DT, THEME_IDS };')(m);
const { CONFIG, DEFAULT_TEAMS, Game, RNG, DT, THEME_IDS } = m.exports;
if (process.env.CFG) Object.assign(CONFIG, JSON.parse(process.env.CFG));

const N = +(process.argv.find(a => /^\d+$/.test(a)) || 200), knockout = process.argv.includes('--eleme');
const teamsAll = DEFAULT_TEAMS.map((t, i) => ({ id: 't' + (i + 1), ...t }));
/* the live player's loop: 60 fps frames, physics at the game's time scale → screen seconds */
const run = (opts) => {
  /* added time: from 'addedTime' to the end of that period (half time, full time, golden goal start, penalties) */
  const g = new Game(opts); let acc = 0, n = 0, from = -1; const added = [];
  g.onEvent = (t) => {
    if (t === 'addedTime') from = g.clock;
    else if (from >= 0 && (t === 'halfTime' || t === 'win' || t === 'goldenGoal' || t === 'penalties')) { added.push(g.clock - from); from = -1; }
  };
  while (!g.over) { acc += g.timeScale() / 60; while (acc >= DT && !g.over) { g.step(DT); acc -= DT; } n++; }
  return { r: g.getResult(), screen: n / 60, added };
};
let goals = 0, saves = 0, own = 0, draws = 0, home = 0, golden = 0, pens = 0, esc = 0, addN = 0, addT = 0;
const scr = [], hist = {};
for (let i = 0; i < N; i++) {
  const seed = (+process.env.SEED0 || 1000) + i * 7919, rng = new RNG(seed ^ 0x51ED27);
  const teams = rng.shuffle(teamsAll).slice(0, 2), theme = rng.pick(THEME_IDS);
  const { r, screen, added } = run({ mode: 'match', teams, seed, theme, lives: 1, speedMult: 1, powerups: false, matchTime: CONFIG.MATCH_TIME, knockout });
  goals += r.goals; saves += r.saves; own += r.ownGoals; esc += r.escapes; scr.push(screen);
  if (r.draw) draws++; else if (r.winner === r.teams[0].id) home++;
  if (r.golden) golden++; if (r.pens) pens++;
  for (const x of added) { addN++; addT += x; }
  const k = r.teams.map(t => t.score).sort((a, b) => b - a).join('-'); hist[k] = (hist[k] || 0) + 1;
}
scr.sort((a, b) => a - b);
const pct = (x) => Math.round((x / N) * 1000) / 10 + '%';
console.log(`${N} maç · 1'e 1 · ${CONFIG.MATCH_TIME} sn${knockout ? ' · eleme (altın gol + penaltı)' : ''}`);
console.log(`Ort. gol: ${(goals / N).toFixed(2)} · Beraberlik: ${pct(draws)} · Ev sahibi (üst kale) galibiyeti: ${pct(home)} · Deplasman: ${pct(N - draws - home)}`);
console.log(`Ekran süresi (maç): min ${scr[0].toFixed(1)} · medyan ${scr[N >> 1].toFixed(1)} · maks ${scr[N - 1].toFixed(1)} sn${knockout ? ` · altın gole giden ${pct(golden)} · penaltıya giden ${pct(pens)}` : ''}`);
console.log(`Uzatma (devre / maç sonunda top kaleye gidiyordu): maç başına ${(addN / N).toFixed(2)} kez · ort. +${addN ? (addT / addN).toFixed(1) : 0} sn`);
console.log(`Ort. kurtarış: ${(saves / N).toFixed(1)} · Kendi kalesine: ${goals ? Math.round((own / goals) * 100) : 0}% · Duvardan kaçan top: ${esc}`);
console.log('En sık skorlar: ' + Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} (${pct(v)})`).join(' · '));
const o = { mode: 'match', teams: teamsAll.slice(0, 2), seed: 48213, theme: 'classic', lives: 1, speedMult: 1, powerups: false, matchTime: CONFIG.MATCH_TIME, knockout: true };
console.log('Determinizm (aynı seed iki kez):', JSON.stringify(run(o)) === JSON.stringify(run(o)) ? 'aynı ✅' : 'FARKLI ❌');
