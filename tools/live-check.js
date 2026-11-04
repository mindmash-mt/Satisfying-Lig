#!/usr/bin/env node
/*
  Canlı lig determinizm kontrolü — her tarayıcı aynı maçı birebir aynı hesaplamalı.
  1) DM (src/01_core.js) fonksiyonlarının doğruluğu: Math.sin/cos/atan2/exp ile karşılaştırır.
  2) Simülasyonun motorun matematik kütüphanesinden bağımsız olduğu: Math.sin/cos/atan2/hypot/exp/pow/log
     bozulmuşken (farklı bir tarayıcıyı taklit eder) oynanan maçlar normal sonuçlarla bit bit aynı olmalı.
  3) Takvim: her 2 dakikada bir maç, günde 720 maç; bir lig maçı (giriş + 90 sn + tablo) 2 dakikalık aralığa her zaman sığar,
     uzayan eleme maçlarının gecikmesi sonraki aralıklarda erir. Takvim değişince lig dondurulur ve yeni takvimle devam eder.
  3b) Fikstür: tek devreli lig (her ikili bir kez, ev sahipliği dengeli); 1'e 1 maç kuralları (90 sn, beraberlik, eleme maçında
     altın gol + penaltı), puanlama (3-1-0) ve sıralama (puan → averaj → atılan gol → aralarındaki maç).
  4) Taşma kuralı: aralık zorla 1 dakikaya indirilir (maçlar sığmaz) → maçlar asla üst üste binmez, hiçbir maç
     planlı saatinden önce başlamaz, takvim kilitlenmez ve normal aralığa dönülünce gecikme erir.
  5) Kural değişikliği ligi sıfırlamaz: dondurulmuş lig (taban) yeni kurallarla devam eder, geçmiş aynen kalır, yeni puan /
     sezon uzunluğu uygulanır, iki bağımsız tarayıcı ve checkpoint'ten devam eden üçüncüsü birebir aynı sonucu bulur;
     yayın iş akışının taban kararı (tools/live-base.js) doğru çalışır.
  5c) Geçmiş sekmesi: biten her sezonun tablosu + yükselme elemesi arşivlenir, sekme yalnızca seçili sezonu çizer (açılışta en son),
     eski biçimli kayıtlar önbellek olarak kabul edilmez, taban arşivi korur; eski ligin (grup maçları) sezonları da gösterilir.
  5d) Yayında başlangıç (tools/live-start.js): yeni lig yayından birkaç dk sonra başlar, sonraki yayınlarda aynı kalır,
     live-start.json kaybolursa checkpoint'ten geri okunur, eski ligin şampiyonları ve sezonları taşınır.
  6) --long: gerçek takvimle 48 saatlik hızlandırılmış koşu (1440 maç, ~8,7 sezon: 153 lig + 12 eleme maçı, şampiyon sınırı).
  Kullanım: node tools/live-check.js [maç sayısı] [--long]
*/
const fs = require('fs'), path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const load = () => { const m = { exports: {} }; new Function('module', src('01_core.js') + '\n' + src('02_sim.js') +
  '\nmodule.exports = { CONFIG, DEFAULT_TEAMS, Game, RNG, DT, THEME_IDS, DM, planRoundRobin };')(m); return m.exports; };
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
  const { CONFIG, DEFAULT_TEAMS, Game, RNG, DT, THEME_IDS, planRoundRobin } = load();
  const teams = DEFAULT_TEAMS.map((t, i) => ({ id: 't' + (i + 1), ...t })), out = [];
  /* league matches (90 s, draws allowed) and playoff matches (golden goal, penalties: a short golden goal so some go to penalties) */
  for (const knockout of [false, true]) for (let i = 0; i < N; i++) {
    if (knockout) CONFIG.GOLDEN_TIME = 3;
    const seed = ((knockout ? 0x85EBCA6B : 0x9E3779B9) * (i + 1)) >>> 0, rng = new RNG(seed ^ 0x51ED27);
    const g = new Game({ mode: 'match', teams: rng.shuffle(teams).slice(0, 2), seed, theme: rng.pick(THEME_IDS), lives: 1, speedMult: 1, powerups: false, matchTime: CONFIG.MATCH_TIME, knockout });
    let n = 0; while (!g.over) { g.step(DT); n++; }
    out.push({ n, r: g.getResult(), clock: g.clock, b: g.balls.map(b => [b.x, b.y, b.vx, b.vy]) });
  }
  out.push(planRoundRobin(teams.map(t => t.id), 17, new RNG(12345)));
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
console.log(`${N} lig maçı + ${N} eleme maçı (1'e 1) + sezon fikstürü, Math kütüphanesi bozulmuşken: ${same ? 'birebir aynı ✅' : 'FARKLI ❌ (simülasyon hâlâ Math.sin/cos/… kullanıyor)'}`);

/* 3–5) timetable, overrun rule, long run (the real engine: src/07_live.js through tools/live-node.js) */
(async () => {
  const { loadLive } = require('./live-node.js');
  const ok = (cond, msg) => { if (!cond) fail++; console.log(`${msg} ${cond ? '✅' : '❌'}`); };
  /* run the league until time t, logging every match's [planned slot, start, end] */
  const runUntil = async (L, t) => {
    const log = [], close = L.Live.closeMatch.bind(L.Live);
    L.Live.closeMatch = (m) => { log.push({ n: m.n, slot: L.Live.slot(m.n), start: m.start, end: m.start + Math.round(m.dur * 1000), dur: m.dur, cup: !!m.s.cup }); close(m); };
    await L.Live.catchUp(0, () => t);
    return log;
  };
  const sane = (log, gap) => log.every((x, i) => x.start >= x.slot && (i === 0 || x.start >= log[i - 1].end + gap * 1000) && x.end > x.start);
  {
    const { Live, CONFIG } = loadLive(), c = (n) => Live.clock(Live.slot(n));
    CONFIG.LIVE.start = '2026-11-04T22:00'; Live._slots = null; Live._sched = null;
    ok(Live.slots().length === 480 && c(0) === '22:00' && c(1) === '22:03' && c(20) === '23:00' && c(40) === '00:00' && Live.slot(480) - Live.slot(0) === 864e5,
      'Takvim: her 3 dk\'da bir, günde 480 maç · 22:00, 22:03 … 23:00 … 00:00 (gün geçişi)');
    CONFIG.LIVE.start = '2026-11-04T22:01'; Live._sched = null;
    ok(c(0) === '22:03' && c(1) === '22:06', 'Başlangıç saati aralığa denk gelmezse ilk maç sıradaki 3 dk\'da (22:01 → 22:03)');
    const start = { salt: CONFIG.LIVE.salt, start: '2026-11-05T09:17' }, B = loadLive({ start });
    ok(B.Live.cfg().start === '2026-11-05T09:17' && B.Live.clock(B.Live.slot(0)) === '09:18' && B.Live.league().includes('2026-11-05T09:17') && loadLive({ start: { ...start, salt: 'başka' } }).Live.cfg().start === loadLive().CONFIG.LIVE.start,
      'Yayının seçtiği başlangıç (BUILD_START, 09:17 → ilk maç 09:18) bu salt için geçerli, ligin kimliğine dahil; başka salt\'ın başlangıcı yok sayılıyor');
  }
  /* 3b) fixture, match rules, scoring, ranking */
  {
    const L = loadLive(), { App, League, Live, CONFIG, Game, DT, fixtureStats } = L;
    Live.adopt(null);
    const plan = App.seasonPlan(), ids = League.data.teams.map(t => t.id), st = fixtureStats(ids, plan.weeks);
    ok(plan.weeks.length === 17 && plan.weeks.every(w => w.length === 9 && new Set(w.flat()).size === 18) && st.min === 1 && st.max === 1 && st.homeMin >= 8 && st.homeMax <= 9,
      `Fikstür: 17 hafta × 9 maç, her takım haftada 1 maç, her ikili tam 1 kez karşılaşıyor, her takım ${st.homeMin}–${st.homeMax} maçta ev sahibi`);
    const G0 = CONFIG.GOLDEN_TIME;
    const play = (knockout, seed, golden) => {
      if (golden !== undefined) CONFIG.GOLDEN_TIME = golden;
      const g = new Game({ mode: 'match', teams: League.data.teams.slice(0, 2).map(t => ({ ...t })), seed, theme: 'classic', lives: 1, speedMult: 1, powerups: false, matchTime: CONFIG.MATCH_TIME, knockout });
      let acc = 0, n = 0; while (!g.over) { acc += g.timeScale() / 60; while (acc >= DT && !g.over) { g.step(DT); acc -= DT; } n++; }
      return { g, r: g.getResult(), screen: n / 60 };
    };
    let draw = null, win = null;
    for (let s = 1; s < 400 && !(draw && win); s++) { const x = play(false, s); if (x.r.draw) draw = draw || x; else win = win || x; }
    ok(draw && win && draw.g.winner === -1 && draw.r.teams.every(t => t.place === 1) && win.r.teams.map(t => t.place).sort().join() === '1,2'
       && [draw, win].every(x => x.screen >= CONFIG.MATCH_TIME + CONFIG.HALF_BREAK && x.screen < CONFIG.MATCH_TIME + CONFIG.HALF_BREAK + 2 * CONFIG.ADDED_MAX + 1.2 && x.r.teams.every(t => t.score === t.gf) && x.r.teams[0].ga === x.r.teams[1].score),
      `Lig maçı ${CONFIG.MATCH_TIME} sn + ${CONFIG.HALF_BREAK} sn devre arası (ekranda ${win.screen.toFixed(1)} sn), beraberlik olabiliyor; skor = AG, rakibin skoru = YG (kendi kalesine gol rakibe)`);
    let gg = null, pens = null;
    for (let s = 1; s < 600 && !gg; s++) { const x = play(true, s, 30); if (x.r.golden && !x.r.pens) gg = x; }
    for (let s = 1; s < 600 && !pens; s++) { const x = play(true, s, 0.3); if (x.r.pens) pens = x; }
    CONFIG.GOLDEN_TIME = G0;
    const pw = pens && pens.g.teams[pens.g.winner], pl = pens && pens.g.teams[1 - pens.g.winner];
    ok(gg && pens && gg.g.winner >= 0 && gg.r.teams[gg.g.winner].score === gg.r.teams[1 - gg.g.winner].score + 1 && !pens.r.draw && pw.score === pl.score && pw.pen > pl.pen && pens.g.pens.kicks.length >= 6,
      `Eleme maçı berabere bitmez: altın gol (${gg && gg.r.teams.map(t => t.score).join('–')}), sonra penaltılar (${pens && `${pw.score}–${pl.score}, pen. ${pw.pen}–${pl.pen}`})`);
    /* added time: when the time is up while the ball is in a goal's half moving towards it (up / down), the match goes on
       until the ball turns back or goes in (at most ADDED_MAX s); it never ends while that is still the case */
    {
      let n = 0, withAdded = 0, bad = 0, maxAdd = 0;
      for (let s = 1; s <= 150; s++) {
        const g = new Game({ mode: 'match', teams: League.data.teams.slice(0, 2).map(t => ({ ...t })), seed: 5000 + s, theme: 'classic', lives: 1, speedMult: 1, powerups: false, matchTime: CONFIG.MATCH_TIME, knockout: false });
        let added = false;
        g.onEvent = (t) => {
          if (t === 'addedTime') added = true;
          if (t === 'halfTime') added = false;                    // this test looks at full time
          if (t === 'win') {
            const over = g.clock - CONFIG.MATCH_TIME;
            if (g.attacking() && over < CONFIG.ADDED_MAX) bad++;
            if (added) maxAdd = Math.max(maxAdd, over);
            const b = g.balls.find(x => x.state === 'live');
            if (!added && over > 0.05) bad++;                     // no added time → ends right at full time
            if (added && b && over < CONFIG.ADDED_MAX && ((b.vy < 0 && b.y < g.rectCy()) || (b.vy > 0 && b.y > g.rectCy()))) bad++;
          }
        };
        while (!g.over) g.step(DT);
        n++; if (added) withAdded++;
      }
      ok(bad === 0 && withAdded > 10 && withAdded < n && maxAdd <= CONFIG.ADDED_MAX + 0.01,
        `Uzatma: ${n} maçın ${withAdded}'inde süre bittiğinde top kaleye gidiyordu → maç top geri dönene / gol olana kadar sürdü (en uzun +${maxAdd.toFixed(1)} sn); top kaleye giderken hiç bitmedi`);
    }
    /* half time: at MATCH_TIME / 2 (+ added time) a HALF_BREAK-second break with the clock stopped; the clubs change ends and the
       second half kicks off from the centre at exactly MATCH_TIME / 2 */
    {
      const g = new Game({ mode: 'match', teams: League.data.teams.slice(0, 2).map(t => ({ ...t })), seed: 777, theme: 'classic', lives: 1, speedMult: 1, powerups: false, matchTime: CONFIG.MATCH_TIME, knockout: false });
      const home = g.teams[0].id, topOf = () => g.teams[g.geo.goals.find(x => x.my < g.rectCy()).team].id, ev = [];
      let topBefore = topOf(), atHT = null, after = null, pauseOK = true, kick2 = null;
      g.onEvent = (t, d) => {
        if (t === 'halfTime') atHT = { clock: g.clock, t: g.t };
        if (t === 'kickoff' && d.half === 2) kick2 = { clock: g.clock, t: g.t, balls: g.balls.filter(b => b.state === 'live').length };
        ev.push(t);
      };
      while (!g.over) {
        const c = g.clock; g.step(DT);
        if (g.morph && g.morph.kind === 'half' && g.clock !== c && atHT && g.t > atHT.t + DT) pauseOK = false;
        if (kick2 && !after) after = topOf();
      }
      const brk = kick2 && atHT ? kick2.t - atHT.t : 0;
      ok(topBefore === home && after && after !== home && atHT && atHT.clock >= CONFIG.MATCH_TIME / 2 && pauseOK && Math.abs(brk - CONFIG.HALF_BREAK) < 0.02 && kick2.clock === CONFIG.MATCH_TIME / 2 && kick2.balls === 1 && g.clock >= CONFIG.MATCH_TIME,
        `Devre arası: ${atHT ? atHT.clock.toFixed(1) : '?'}. sn'de, ${brk.toFixed(1)} sn sürdü (saat durdu); ev sahibi 1. yarıda üst, 2. yarıda alt kalede; 2. yarı ${CONFIG.MATCH_TIME / 2}. sn'den ortadan başladı`);
    }
    /* 4 outfield players per club: captain in midfield, 2 defenders, 1 forward, each always inside its third (it flips at half time);
       every player touch sends the ball towards the rival goal's end, at most KICK_MAX_DEG off straight */
    {
      let outside = 0, kicks = 0, badKick = 0, roles = '', flip = true;
      for (let s = 1; s <= 40; s++) {
        const g = new Game({ mode: 'match', teams: League.data.teams.slice(0, 2).map(t => ({ ...t })), seed: 9000 + s, theme: 'classic', lives: 1, speedMult: 1, powerups: false, matchTime: CONFIG.MATCH_TIME, knockout: false });
        if (s === 1) roles = g.teams.map(T => g.players.filter(p => p.team === T.i).map(p => p.role + (p.captain ? '(C)' : '')).join('+')).join(' / ');
        const z0 = g.zoneOf(g.players.find(p => p.role === 'def'));
        /* the ball's direction right at the kick (later in the same step it may already bounce off a wall or a keeper) */
        g.onEvent = (t, d) => {
          if (t !== 'player') return;
          const b = g.balls.find(x => x.state === 'live'), down = d.team === g.rectTeams[0];
          if (b) { kicks++; const ang = Math.atan2(Math.abs(b.vx), (down ? 1 : -1) * b.vy) * 180 / Math.PI; if (ang > CONFIG.KICK_MAX_DEG + 0.01) badKick++; }
        };
        while (!g.over) {
          g.step(DT);
          if (!g.morph) for (const p of g.players) { const [y0, y1] = g.zoneOf(p); if (p.y < y0 + CONFIG.PLAYER_R - 0.01 || p.y > y1 - CONFIG.PLAYER_R + 0.01) outside++; }
        }
        if (s === 1) { const z1 = g.zoneOf(g.players.find(p => p.role === 'def' && p.team === g.players.find(q => q.role === 'def').team)); flip = Math.sign(z0[0] - g.rectCy()) !== Math.sign(z1[0] - g.rectCy()); }
      }
      ok(roles === 'mid(C)+def+def+fwd / mid(C)+def+def+fwd' && outside === 0 && kicks > 500 && badKick === 0 && flip,
        `Diziliş: ${roles} · oyuncular hep kendi üçte birlik bölgesinde (devre arasında bölgeler yer değiştiriyor) · ${kicks} vuruşun hepsi rakip kaleye doğru, en fazla ±${CONFIG.KICK_MAX_DEG}°`);
    }
    /* scoring and ranking on a hand-made table */
    const d = League.data, [a, b, c] = d.teams.map(t => t.id);
    const res = (x, y, sx, sy) => ({ teams: [{ id: x, code: x, score: sx, saves: 0 }, { id: y, code: y, score: sy, saves: 0 }] });
    const S = (w, m) => ({ week: w, weekMatch: m, perWeek: 9, matchNo: 1, seed: 1 });
    League.record(S(1, 1), res(a, b, 3, 1), a); League.record(S(1, 2), res(c, a, 2, 2), null);
    const r = (id) => d.table[id];
    ok(r(a).pts === 4 && r(a).w === 1 && r(a).d === 1 && r(a).gf === 5 && r(a).ga === 3 && r(b).pts === 0 && r(b).l === 1 && r(c).pts === 1 && r(c).d === 1 && League.formOf(a).join() === 'W,D',
      'Puanlama 3-1-0: galibiyet 3, beraberlik 1; G/B/M, AG/YG ve son maçlar doğru');
    /* head to head: two clubs level on points, goal difference and goals; the one that won their match is ahead */
    const L2 = loadLive(); L2.Live.adopt(null); const d2 = L2.League.data, [p, q, r2, s2] = d2.teams.map(t => t.id);
    L2.League.record(S(1, 1), res(p, q, 1, 2), q); L2.League.record(S(1, 2), res(p, r2, 3, 0), p); L2.League.record(S(1, 3), res(q, s2, 0, 2), s2);
    /* p: 3 pts, 4–2 · q: 3 pts, 2–3 → not level. Make them level: */
    L2.League.record(S(1, 4), res(r2, q, 0, 1), q);   // q: 6 pts 3–3
    L2.League.record(S(1, 5), res(s2, p, 1, 1), null); // p: 4 pts
    const rk = L2.League.ranking().map(x => x.t.id);
    const L3 = loadLive(); L3.Live.adopt(null); const d3 = L3.League.data, [u, v, w3, x3] = d3.teams.map(t => t.id);
    L3.League.record(S(1, 1), res(u, v, 1, 2), v); L3.League.record(S(1, 2), res(u, w3, 3, 0), u); L3.League.record(S(1, 3), res(v, x3, 2, 1), v);
    L3.League.record(S(1, 4), res(w3, v, 1, 0), w3); L3.League.record(S(1, 5), res(x3, u, 0, 0), null); L3.League.record(S(1, 6), res(w3, x3, 0, 0), null);
    /* u: W1 D1 L1 4–2 → 4 pts, gd +2, gf 4 · v: W2 L1 4–3 → 6 pts. Tie test on u vs w3 instead: */
    const tie = loadLive(); tie.Live.adopt(null); const dt = tie.League.data, [h1, h2, h3, h4] = dt.teams.map(t => t.id);
    tie.League.record(S(1, 1), res(h1, h2, 2, 1), h1);   // h1 3 pts 2–1, h2 0 pts 1–2
    tie.League.record(S(1, 2), res(h2, h3, 2, 1), h2);   // h2 3 pts 3–3, h3 0 pts 1–2
    tie.League.record(S(1, 3), res(h3, h1, 2, 1), h3);   // h3 3 pts 3–3, h1 3 pts 3–3 → h1, h2, h3 all 3 pts, 0 gd, 3 gf: a 3-way tie, h2h all 3 pts, 0 gd → draw
    tie.League.record(S(1, 4), res(h4, h1, 0, 0), null); // h1 4 pts → ahead
    const tr = tie.League.ranking().map(x => x.t.id), order = tie.League.tieOrderFor();
    const twoWay = loadLive(); twoWay.Live.adopt(null); const dw = twoWay.League.data, [k1, k2, k3, k4] = dw.teams.map(t => t.id);
    twoWay.League.record(S(1, 1), res(k1, k2, 2, 1), k1);   // k1 beat k2
    twoWay.League.record(S(1, 2), res(k3, k1, 1, 0), k3);   // k1: 3 pts 2–2 · k3: 3 pts 1–0
    twoWay.League.record(S(1, 3), res(k2, k4, 2, 1), k2);   // k2: 3 pts 3–3
    twoWay.League.record(S(1, 4), res(k4, k3, 2, 1), k4);   // k3: 3 pts 2–2 · k4: 3 pts 3–3
    /* k1 3 pts 2–2 (gd 0, gf 2), k3 3 pts 2–2 (gd 0, gf 2) → level; head to head: k3 beat k1 → k3 first */
    const wr = twoWay.League.ranking().map(x => x.t.id);
    ok(tr[0] === h1 && wr.indexOf(k3) < wr.indexOf(k1) && wr.indexOf(k2) < wr.indexOf(k1) && rk.length === 18,
      'Sıralama: puan → averaj → atılan gol → aralarındaki maç (eşit iki takımda maçı kazanan önde) → kura');
  }
  {
    const L = loadLive();
    L.CONFIG.LIVE.start = '2026-11-04T00:00'; L.CONFIG.LIVE.bands = [{ from: '00:00', every: 1 }, { from: '01:00', every: 3 }]; L.Live._slots = null; L.Live._sched = null;
    const log = await runUntil(L, L.Live.slot(0) + 8 * 3600e3);
    const late = log.map(x => x.start - x.slot), back = log.findIndex((x, i) => i > 60 && x.start === x.slot);
    ok(sane(log, L.CONFIG.LIVE.gap) && log.length > 60 && back > 0,
      `Taşma kuralı (00–01 arası her 1 dk, maçlar sığmıyor): ${log.length} maç, üst üste binen yok, en büyük gecikme ${Math.round(Math.max(...late) / 60e3)} dk, normal aralıkta ${log[back] ? L.Live.clock(log[back].start) : '—'}'de saatine döndü`);
  }
  /* 5) a rule change does not reset the league: the frozen league (base) plays on under the new rules */
  {
    const T = (L, n) => L.Live.slot(n) + 1;                       // a moment shortly after match n's kick-off
    const shortSeason = (L, len) => { L.CONFIG.SEASON_LENGTH = len; L.Live.adopt(null); };   // len weeks × 9 league matches + 12 playoff matches per season
    const J = (x) => JSON.stringify(x, (k, v) => (k === 'created' ? undefined : v));   // seasonPlan.created is a wall-clock stamp, informational only
    /* the old rules: 2-week seasons (18 league + 12 playoff matches); freeze the league 4 matches into season 2 */
    const A = loadLive(); shortSeason(A, 2);
    await A.Live.catchUp(0, () => T(A, 34)); A.Live.snapshot();
    const frozen = JSON.parse(A.Live.lastClean).data, mk = (data) => ({ id: 'test', league: A.Live.league(), sim: 'old', count: data.liveCount, data });
    const base = mk(frozen);
    /* the new rules: other points, 3-week seasons */
    const fromBase = (b) => { const L = loadLive({ simHash: 'new', base: b }); L.CONFIG.POINTS = [5, 2, 0]; L.CONFIG.SEASON_LENGTH = 3; L.Live.adopt(L.Live.baseState()); return L; };
    const B = fromBase(base), d0 = B.League.data;
    ok(d0.liveCount === frozen.liveCount && J(d0.history) === J(frozen.history) && J(d0.table) === J(frozen.table) && J(d0.champions) === J(frozen.champions) && J(d0.seasons) === J(frozen.seasons) && frozen.seasons.length === 1 && d0.season === frozen.season,
      `Taban: ${frozen.liveCount} maçlık lig (Sezon ${frozen.season}, ${frozen.history.length} lig maçı, ${frozen.champions.length} şampiyon) olduğu gibi yüklendi`);
    ok(d0.points.join() === '5,2,0' && d0.seasonLength === 2, 'Yeni puanlama hemen geçerli; başlamış sezonun uzunluğu (2 hafta) sezon bitene kadar korunuyor');
    const hashed = B.Live.hash();
    ok(hashed.endsWith('@test') && hashed.startsWith('new:') && J(B.Live.parts(hashed)) === J({ sim: 'new', league: B.Live.league(), base: 'test' }) &&
       J(B.Live.parts('abc:' + B.Live.league())) === J({ sim: 'abc', league: B.Live.league(), base: '' }) && B.Live.parts('abc:başka-lig').league === null,
      'Hash: <kural>:<lig kimliği>@<taban>; tabansız hash\'ler de ayrıştırılıyor');
    /* play on across the season change (match 60): 70 matches */
    await B.Live.catchUp(0, () => T(B, 70)); B.Live.snapshot();
    const dB = B.League.data;
    ok(dB.liveCount === 70 && dB.season === frozen.season + 1 && dB.seasonLength === 3 && dB.champions.length === frozen.champions.length + 1 && J(dB.champions.slice(0, frozen.champions.length)) === J(frozen.champions) && dB.seasons.length === 2 && J(dB.seasons[0]) === J(frozen.seasons[0]),
      `Sezon geçişi: yeni sezon 3 hafta (eski 2), eski şampiyonlar aynen duruyor, ${dB.champions.length}. şampiyon eklendi`);
    /* the points of the matches played after the freeze are the new ones, the table before the freeze is not rewritten */
    const rowsBefore = Object.fromEntries(Object.entries(frozen.table).map(([k, v]) => [k, v.pts]));
    {
      const C = fromBase(base); await C.Live.catchUp(0, () => T(C, 40));      // 6 more matches, still season 2
      const dC = C.League.data, added = dC.history.slice(frozen.history.length);
      const exp = {}; added.forEach(h => h.result.forEach((r, i) => { const o = h.result[1 - i]; exp[r.id] = (exp[r.id] || 0) + (r.score > o.score ? 5 : r.score === o.score ? 2 : 0); }));
      ok(added.length > 0 && Object.keys(dC.table).every(k => dC.table[k].pts - (rowsBefore[k] || 0) === (exp[k] || 0)) && J(dC.history.slice(0, frozen.history.length)) === J(frozen.history),
        `Taban sonrası ${added.length} maç yeni puanla (5-2-0) işlendi; tabandaki tablo ve geçmiş yeniden yazılmadı`);
    }
    ok(J(B.Live.baseState()) === J(frozen), 'Oynarken taban bozulmuyor (kopya üzerinde çalışılıyor)');
    /* determinism: another browser from the same base, and one that resumes from a checkpoint half way */
    const B2 = fromBase(base); await B2.Live.catchUp(0, () => T(B2, 70)); B2.Live.snapshot();
    const B3 = fromBase(base); await B3.Live.catchUp(0, () => T(B3, 50)); B3.Live.snapshot();
    const B4 = fromBase(base); B4.Live.adopt(B4.Live.parseState(B3.Live.lastClean));
    await B4.Live.catchUp(0, () => T(B4, 70)); B4.Live.snapshot();
    ok(J(dB) === J(B2.League.data) && J(dB) === J(B4.League.data) && B4.Live.parseState(B3.Live.lastClean),
      'Aynı tabandan iki bağımsız tarayıcı + yarı yoldaki checkpoint\'ten devam eden: 70. maçta birebir aynı lig');
    /* a state taken under another base / other rules is rejected */
    const other = loadLive({ simHash: 'new', base: { ...base, id: 'other' } });
    ok(other.Live.parseState(B3.Live.lastClean) === null && loadLive({ simHash: 'x' }).Live.parseState(B3.Live.lastClean) === null,
      'Başka tabanın / başka kuralın checkpoint\'i geçersiz sayılıyor');
    /* a freeze exactly between two seasons: the new season length applies at once */
    const E = loadLive(); shortSeason(E, 2); for (let i = 0; i < 30; i++) E.Live.record(E.Live.computeNext()); E.Live.snapshot();   // exactly the 30 matches of season 1
    const eb = mk(JSON.parse(E.Live.lastClean).data), F = fromBase(eb);
    ok(eb.data.season === 2 && eb.data.history.length === 0 && F.League.data.seasonLength === 3, 'Sezonlar arasında dondurulan lig: yeni sezon uzunluğu (3 hafta) hemen geçerli');
  }
  /* 5c) the "Geçmiş" tab: season archive + rendering of one season at a time; the old group-match league's seasons */
  {
    const L = loadLive(); L.CONFIG.SEASON_LENGTH = 2; L.Live.adopt(null);
    const { Live, LivePages, League } = L, count = (h, re) => (h.match(re) || []).length;
    ok(LivePages.history().includes('Henüz biten sezon yok'), 'Geçmiş: ilk sezon bitmeden "henüz biten sezon yok" gösteriliyor');
    await Live.catchUp(0, () => Live.slot(62) + 1); Live.snapshot();
    const d = League.data, sz = d.seasons, c0 = sz[0];
    const top3 = (r) => [r.cup.res.FIN[0], r.cup.res.FIN[1], r.cup.res['3RD'][0]].sort().join();
    ok(sz.length === 2 && sz.every((r, i) => r.f === 2 && r.season === i + 1 && r.champ === d.champions[i].id && r.rows[0][0] === r.champ && r.rows[0][2] === d.champions[i].pts
        && r.rows.length === 18 && r.rows.every((x, k) => !k || r.rows[k - 1][2] >= x[2]) && r.rows.every(x => x[2] === 3 * x[3] + x[4] && x[1] === x[3] + x[4] + x[5]) && r.n === 18 && r.p.join() === '3,1,0'
        && r.out.length === 3 && r.rows.slice(-3).map(x => x[0]).sort().join() === r.out.slice().sort().join()
        && r.up.length === 3 && r.up.slice().sort().join() === top3(r) && Object.keys(r.cup.res).length === 12 && r.t0 > 0 && r.t1 > r.t0),
      `Arşiv: ${sz.length} biten sezon; her birinde sıralı tablo (şampiyon başta, P = 3G + B), düşen 3, yükselen 3 (= final galibi, finalist, 3.lük galibi), 12 eleme maçı`);
    ok(JSON.stringify(c0).length < 1700, `Arşiv küçük: sezon başına ${JSON.stringify(c0).length} bayt (50 sezon ≈ ${Math.round(JSON.stringify(c0).length * 50 / 1024)} KB)`);
    Live.histSel = '';
    let h = LivePages.history();
    const nm = (id) => LivePages.anyTeam(id).name;
    ok(h.includes('Sezon 2 şampiyonu') && !h.includes('Sezon 1 şampiyonu') && count(h, /<table class="lp-table"/g) === 1 && count(h, /<option /g) === 2 && h.includes(`<option value="n2" selected>`)
        && h.includes('title="Önceki sezon">') && h.includes('title="Sonraki sezon" disabled') && h.includes('Yükselme eleme maçları') && count(h, /class="fx-match done"/g) === 12,
      'Sekme açılınca en son biten sezon (2): yalnızca onun tablosu, 12 eleme maçı; sezon seçici 2 sezon listeliyor');
    ok(sz[1].up.every(id => h.includes(nm(id))) && h.includes(nm(sz[1].champ)) && sz[1].out.every(id => h.includes(nm(id))), 'Seçili sezonun şampiyonu, yükselenleri ve düşenleri sayfada');
    Live.histSel = 'n1'; h = LivePages.history();
    ok(h.includes('Sezon 1 şampiyonu') && !h.includes('Sezon 2 şampiyonu') && count(h, /<table class="lp-table"/g) === 1 && h.includes('title="Önceki sezon" disabled') && h.includes(`data-season="n2" title="Sonraki sezon"`) && h.includes(`<option value="n1" selected>`),
      'Eski sezon (1) seçilince yalnızca onun tablosu yüklenir; ‹ pasif, › sezon 2\'ye gidiyor');
    Live.histSel = 'n99'; ok(LivePages.history().includes('Sezon 2 şampiyonu'), 'Geçersiz seçim en son sezona düşüyor');
    Live.histSel = '';
    /* the old group-match league's archive (BUILD_START.legacy): listed before this league's seasons, drawn with its own columns */
    const oldRec = { season: 7, champ: 't3', t0: 29890000, t1: 29890200, n: 51, p: [4, 3, 2, 1, 0, 0], rows: d.teams.map((t, i) => [t.id, 17, 60 - i, 5, 30, 20, 1, 2, 3]), out: ['t1', 't2', 't4'], up: ['t19', 't20', 't21'],
      cup: { draw: d.reserve.map(t => t.id), res: { FIN: ['t19', 't20', 2, 1, 29890300] } } };
    const O = loadLive({ start: { salt: L.CONFIG.LIVE.salt, start: L.CONFIG.LIVE.start, legacy: { champions: [{ id: 't3', name: 'Atlético Madrid', season: 7, pts: 60 }], seasons: [oldRec] } } });
    O.CONFIG.SEASON_LENGTH = 2; O.Live.adopt(null);
    let ho = O.LivePages.history();
    ok(ho.includes('Eski lig · Sezon 7') && ho.includes('Eski format') && ho.includes('title="Birincilik"') && ho.includes('Eski lig şampiyonları'), 'Eski ligin (6\'lı grup maçları) biten sezonu Geçmiş\'te kendi sütunlarıyla, şampiyonlarıyla');
    await O.Live.catchUp(0, () => O.Live.slot(31) + 1); O.Live.histSel = ''; ho = O.LivePages.history();
    ok(ho.includes('<option value="n1" selected>') && ho.includes('<option value="o7">') && ho.includes('title="Galibiyet"') && !ho.includes('Eski format'), 'Yeni ligin sezonu bitince sekme onunla açılıyor; eski ligin sezonları listede kalıyor');
    /* the table is the one that was on the screen: frozen at the season's end */
    const R = loadLive(); R.CONFIG.SEASON_LENGTH = 2; R.Live.adopt(null);
    let last = null; const close = R.Live.closeMatch.bind(R.Live);
    R.Live.closeMatch = (m) => { if (R.League.seasonOver()) last = R.League.ranking().map(x => [x.t.id, x.r.played, x.r.pts]); close(m); };
    await R.Live.catchUp(0, () => R.Live.slot(32) + 1);
    ok(last && JSON.stringify(R.League.data.seasons[0].rows.map(r => r.slice(0, 3))) === JSON.stringify(last), 'Arşivlenen tablo, sezonun bittiği andaki tabloyla aynı');
    /* storage: only the newest keepChampions seasons; old-format states are not trusted as caches */
    const K = loadLive(); K.CONFIG.SEASON_LENGTH = 2; K.CONFIG.LIVE.keepChampions = 1; K.Live.adopt(null);
    await K.Live.catchUp(0, () => K.Live.slot(62) + 1);
    ok(K.League.data.seasons.length === 1 && K.League.data.seasons[0].season === 2, 'Arşiv en fazla keepChampions sezon tutuyor (en yenileri)');
    const env = JSON.parse(Live.lastClean), noav = { ...env }; delete noav.av;
    ok(Live.parseState(env) && Live.parseState(noav) === null && Live.parseState(noav, true) && Live.parseState({ ...env, av: 1 }) === null,
      'Eski biçimli kayıt (av 1, grup maçları) önbellek/checkpoint olarak geçersiz');
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
    ok(r.action === 'none' && st('S1', 1).hash.endsWith(lg), 'Taban kararı: lig kimliği (start/salt) değişti → yeni lig, eski durum yok sayılır');
  }
  /* 5d) the league's start at its first deploy (tools/live-start.js) */
  {
    const { decide, START_DELAY } = require('./live-start.js'), L = loadLive(), cfg = L.CONFIG.LIVE;
    const now = Date.parse('2026-11-04T18:41:20Z');   // 21:41:20 in Istanbul
    const oldPub = { hash: 'cf0af4167499:satisfying-lig-live-1:2026-11-04T00:36:05:00/5,09:00/10,19:00/3:10', data: { season: 6, champions: [{ id: 't3', name: 'Atlético Madrid', season: 5, pts: 60, x: 1 }], seasons: [{ season: 5 }] } };
    let r = decide({ cfg, prev: null, pub: oldPub, now });
    const exp = new Date(Math.ceil((now + START_DELAY * 60e3) / 60e3) * 60e3 + 3 * 3600e3).toISOString().slice(0, 16);
    ok(r.action === 'new' && r.start.salt === cfg.salt && r.start.start === exp && r.start.start === '2026-11-04T21:46' && r.start.legacy.seasons.length === 1 && r.start.legacy.champions[0].x === undefined && r.start.legacy.from === 'satisfying-lig-live-1',
      `Başlangıç: ilk yayında yeni lig ${START_DELAY} dk sonra (21:41:20 → ${r.start.start}); eski ligin sezonları ve şampiyonları taşındı`);
    const first = r.start;
    r = decide({ cfg, prev: first, pub: oldPub, now: now + 3600e3 });
    ok(r.action === 'keep' && r.start === first, 'Başlangıç: sonraki yayınlarda aynen taşınıyor (lig yeniden başlamıyor)');
    const S = loadLive({ start: first });
    r = decide({ cfg, prev: null, pub: { hash: S.Live.hash(), data: { seasons: [] } }, now: now + 7200e3 });
    ok(r.action === 'recover' && r.start.start === first.start, 'Başlangıç: live-start.json kaybolursa yayındaki checkpoint\'in lig kimliğinden geri okunuyor');
    r = decide({ cfg, prev: { salt: 'eski', start: '2026-01-01T00:00' }, pub: null, now, manual: '2026-11-05T09:00' });
    ok(r.action === 'new' && r.start.start === '2026-11-05T09:00' && !r.start.legacy, 'Başlangıç: elle verilen saat (LIVE_START), checkpoint yoksa eski lig arşivi yok');
  }
  /* 3c) a timetable change does not reset the league: frozen in a base, the new timetable starts after the base's last match.
     Also: a state written while the timetable was part of the league's identity belongs to the same league. */
  {
    const A = loadLive(); A.CONFIG.LIVE.bands = [{ from: '00:00', every: 2 }]; A.Live._slots = null; A.Live._sched = null; A.Live.adopt(null);
    await A.Live.catchUp(0, () => A.Live.slot(12) + 1); A.Live.snapshot();
    const frozen = JSON.parse(A.Live.lastClean).data, lg = A.Live.league();
    const N = loadLive({ simHash: 'new', base: { id: 'tt', league: lg, sim: 'new', count: frozen.liveCount, data: frozen } }); N.Live.adopt(N.Live.baseState());
    const s0 = N.Live.slot(frozen.liveCount), grid = (t) => Math.ceil((t + 3 * 3600e3) / 180e3) * 180e3 - 3 * 3600e3;
    ok(frozen.liveCount === 12 && s0 === grid(frozen.liveLastEnd) && N.Live.slot(frozen.liveCount + 1) - s0 === 180e3 && N.Live.nextStart() === s0,
      `Takvim değişikliği (2 dk → 3 dk) ligi sıfırlamıyor: 12 maçlık lig dondu, 13. maç eski son maçın bitişinden sonraki ilk 3 dk aralığında (${N.Live.clock(s0)}), sonrakiler 3 dk arayla`);
    const oldHash = `abc123:${lg}:00:00/3:10@b1`, P = N.Live.parts(oldHash), { decide } = require('./live-base.js');
    const r = decide({ cur: { league: lg, sim: 'S2' }, prevBase: { id: 'b1', league: lg + ':00:00/3:10', sim: 'S1', count: 5, data: { liveCount: 5 } }, pub: { hash: oldHash, data: { liveCount: 9 } }, parts: (h) => N.Live.parts(h) });
    ok(P.sim === 'abc123' && P.league === lg && P.base === 'b1' && N.Live.parts('abc123:başka:2026-01-01T00:00').league === null && r.action === 'rebase' && r.base.data.liveCount === 9,
      'Takvimli eski hash (<kural>:<salt>:<start>:<takvim>:<gap>) aynı lig sayılıyor; taban kararı onu dondurup devam ediyor');
  }
  /* 3c') the publish workflow plays the published checkpoint on with the PUBLISHED page's own code (tools/live-node.js loadPage):
     the same league as the engine loaded from src/ */
  {
    const tmp = path.join(require('os').tmpdir(), `live-check-page-${process.pid}.html`);
    require('child_process').execFileSync('sh', [path.join(__dirname, '..', 'build.sh'), tmp], { stdio: 'ignore' });
    const html = fs.readFileSync(tmp, 'utf8'); fs.rmSync(tmp, { force: true });
    const { loadPage } = require('./live-node.js'), P = loadPage(html), S = loadLive({ simHash: P.Live.sim() });
    const t = S.Live.slot(25) + 1;
    await P.Live.catchUp(0, () => t); await S.Live.catchUp(0, () => t); P.Live.snapshot(); S.Live.snapshot();
    ok(P.League.data.liveCount > 20 && JSON.stringify(P.League.data.history) === JSON.stringify(S.League.data.history) && P.Live.hash() === S.Live.hash(),
      `Yayındaki sayfanın kendi koduyla ilerletilen lig (${P.League.data.liveCount} maç), kaynaktan yüklenen motorla birebir aynı`);
  }
  /* 3d) every league match fits its 2-minute slot; a playoff match that runs over only delays the next few matches */
  {
    const long = process.argv.includes('--long'), L = loadLive(), t0 = Date.now();
    L.CONFIG.LIVE.start = '2026-11-04T00:00'; L.Live._slots = null; L.Live._sched = null; L.Live.adopt(null);
    const hours = long ? 48 : 9, log = await runUntil(L, L.Live.slot(0) + hours * 3600e3);
    const d = L.League.data, lg = Math.max(...log.filter(x => !x.cup).map(x => x.dur)), cup = Math.max(...log.filter(x => x.cup).map(x => x.dur), 0);
    const lateness = log.map(x => x.start - x.slot), worst = Math.max(...lateness);
    const lateLeague = log.filter((x, i) => !x.cup && lateness[i] > 0).length, n = log.length;
    /* a league match (half time + added time at both whistles) very rarely runs a few seconds past its slot: the next one starts a bit late */
    const slotS = L.Live.slots().length ? 86400 / L.Live.slots().length : 120;
    ok(sane(log, L.CONFIG.LIVE.gap) && lg < slotS && worst < 60e3 && lateLeague <= Math.ceil(n * 0.01) && log.some(x => x.cup) && (!long || (n === Math.round(48 * 3600 / slotS) && d.season >= 5)),
      `${hours} saat: ${n} maç${long ? `, ${d.season - 1} sezon bitti` : ''} · en uzun lig maçı ${lg.toFixed(0)} sn (< ${slotS} sn), en uzun eleme maçı ${cup.toFixed(0)} sn · en büyük gecikme ${Math.round(worst / 1000)} sn, geciken lig maçı ${lateLeague} (${((Date.now() - t0) / 1000).toFixed(0)} sn'de hesaplandı)`);
  }
  process.exit(fail ? 1 : 0);
})();
