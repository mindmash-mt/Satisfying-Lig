#!/usr/bin/env node
/*
  Terminal denge testi — fizik/oyun mantığını (src/01_core.js + src/02_sim.js) çizimsiz çalıştırır.
  Kullanım:  node tools/balance.js [mod] [takım sayısı] [can] [maç sayısı]
  Örnek:     node tools/balance.js arena 6 1 200
             node tools/balance.js derby
  Ayar denemek için: CFG='{"BALL_SPEED":650,"WALL_ACCEL":0.08}' node tools/balance.js
*/
const fs = require('fs'), path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const m = { exports: {} };
new Function('module', src('01_core.js') + '\n' + src('02_sim.js') +
  '\nmodule.exports = { CONFIG, DEFAULT_TEAMS, Game, RNG, DT, THEME_IDS };')(m);
const { CONFIG, DEFAULT_TEAMS, Game, RNG, DT, THEME_IDS } = m.exports;
if (process.env.CFG) Object.assign(CONFIG, JSON.parse(process.env.CFG));

const [mode = 'arena', nArg = '6', livesArg = '1', countArg = '100'] = process.argv.slice(2);
const n = mode === 'derby' ? 2 : mode === 'final' ? 4 : +nArg, lives = +livesArg, N = +countArg;
const teamsAll = DEFAULT_TEAMS.map((t, i) => ({ id: 't' + (i + 1), ...t }));
const run = (opts) => { const g = new Game(opts); while (!g.over) g.step(DT); return g.getResult(); };

const durs = [], slot = Array.from({ length: n }, () => Array(n).fill(0));
let goals = 0, saves = 0, own = 0, ot = 0, esc = 0;
for (let i = 0; i < N; i++) {
  const seed = 1000 + i * 7919, rng = new RNG(seed ^ 0x51ED27);
  const teams = rng.shuffle(teamsAll).slice(0, n);
  const theme = rng.pick(THEME_IDS);
  const r = run({ mode, teams, seed, theme, lives, speedMult: 1, powerups: false });
  durs.push(r.duration); goals += r.goals; saves += r.saves; own += r.ownGoals; esc += r.escapes; if (r.overtime) ot++;
  for (const t of r.teams) slot[t.slot][t.place - 1]++;
}
durs.sort((a, b) => a - b);
const avg = durs.reduce((a, b) => a + b, 0) / N, pct = (x) => Math.round((x / N) * 100) + '%';
console.log(`${N} maç · mod ${mode} · ${n} takım · ${lives} can`);
console.log(`Süre: ort ${avg.toFixed(1)} sn · medyan ${durs[N >> 1].toFixed(1)} · min ${durs[0].toFixed(1)} · maks ${durs[N - 1].toFixed(1)} (hedef ort. 25–40 sn ${avg >= 25 && avg <= 40 ? '✅' : '⚠️'})`);
console.log(`Uzatma: ${pct(ot)} · Ort. gol: ${(goals / N).toFixed(1)} · Ort. kurtarış: ${(saves / N).toFixed(1)} · Kendi kalesine: ${goals ? Math.round((own / goals) * 100) : 0}% · Duvardan kaçan top: ${esc}`);
console.log('Kale pozisyonuna göre sıra dağılımı (satırlar ~eşitse adil):');
slot.forEach((row, i) => console.log(`  kale #${i + 1}: ` + row.map(pct).join(' ')));
const o = { mode, teams: teamsAll.slice(0, n), seed: 48213, theme: 'classic', lives, speedMult: 1, powerups: false };
console.log('Determinizm (aynı seed iki kez):', JSON.stringify(run(o)) === JSON.stringify(run(o)) ? 'aynı ✅' : 'FARKLI ❌');
