#!/usr/bin/env node
/*
  Canlı lig "parmak izi": simülasyonun SONUÇLARINI özetleyen kısa bir hash. build.sh bunu BUILD_SIM_HASH olarak
  sayfaya yazar; tarayıcı önbelleği ve live-state.json yalnızca aynı parmak iziyle geçerlidir.
  Yalnızca görünümü değiştiren düzenlemeler (çizim, panel, sekmeler) parmak izini değiştirmez, kaydedilmiş lig
  durumları geçerli kalır. Maç sonuçlarını, fikstürü, puanlamayı, sıralamayı, sezon geçişini, maç sürelerini ya da maç
  takvimini (CONFIG.LIVE.bands / gap) değiştiren her düzenleme parmak izini değiştirir. Lig yine de SIFIRLANMAZ: yayın iş akışı (tools/live-base.js) ligi
  o anki hâliyle dondurur ("taban") ve yeni kurallar bir sonraki maçtan itibaren o durumun üzerinden devam eder.
  Kullanım: node tools/live-fingerprint.js   → 12 karakterlik hash
*/
const crypto = require('crypto');
const { loadLive } = require('./live-node.js');
const { Live, League, App, CONFIG } = loadLive();
const out = [];
const play = (k) => { for (let i = 0; i < k; i++) { const m = Live.computeNext(); out.push(m.ms.map(M => [M.ch, M.s.seed, M.dur, M.s.cup || null])); Live.record(m); } };
CONFIG.SEASON_LENGTH = 2; Live.adopt(null);       // a short season (every season, Live.applyRules takes the length from CONFIG): 18 slots, each with a league match;
                                                  // alongside them the promotion league (2 weeks × 6 matches) and its playoff (the last 4 slots)
play(18);                                         // the whole season: every club plays, tables + tie orders + durations, playoff draw and bracket,
                                                  // then the season change inside closeMatch (champion, relegation, promotion, pool)
play(1);                                          // next season's fixtures and the matches with the new clubs
const d = League.data;
/* the timetable too: changing it freezes the league (base) and the new timetable starts from there, like a rule change */
out.push(CONFIG.LIVE.bands, CONFIG.LIVE.gap);
out.push(d.teams.map(t => t.id), d.reserve.map(t => t.id), d.champions, d.tieOrder, App.seasonPlan().weeks, League.ranking().map(x => [x.t.id, x.r]), d.history,
  d.promo, d.seasons.map(r => [r.rows, r.pl, r.cup, r.up, r.out]));
process.stdout.write(crypto.createHash('sha1').update(JSON.stringify(out)).digest('hex').slice(0, 12) + '\n');
