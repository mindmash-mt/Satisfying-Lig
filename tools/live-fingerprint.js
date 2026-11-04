#!/usr/bin/env node
/*
  Canlı lig "parmak izi": simülasyonun SONUÇLARINI özetleyen kısa bir hash. build.sh bunu BUILD_SIM_HASH olarak
  sayfaya yazar; tarayıcı önbelleği ve live-state.json yalnızca aynı parmak iziyle geçerlidir.
  Yalnızca görünümü değiştiren düzenlemeler (çizim, panel, sekmeler) parmak izini değiştirmez, kaydedilmiş lig
  durumları geçerli kalır. Maç sonuçlarını, fikstürü, puanlamayı, sıralamayı, sezon geçişini ya da maç sürelerini
  değiştiren her düzenleme parmak izini değiştirir. Lig yine de SIFIRLANMAZ: yayın iş akışı (tools/live-base.js) ligi
  o anki hâliyle dondurur ("taban") ve yeni kurallar bir sonraki maçtan itibaren o durumun üzerinden devam eder.
  Kullanım: node tools/live-fingerprint.js   → 12 karakterlik hash
*/
const crypto = require('crypto');
const { loadLive } = require('./live-node.js');
const { Live, League, App, CONFIG } = loadLive();
const out = [];
const play = (k) => { for (let i = 0; i < k; i++) { const m = Live.computeNext(); out.push([m.s.seed, m.dur, m.s.cup || null]); Live.record(m); } };
CONFIG.SEASON_LENGTH = 2; Live.adopt(null);       // a short season (every season, Live.applyRules takes the length from CONFIG): 6 group matches, then the 12 promotion playoff matches
play(18);                                         // the whole season: every club plays, table + tie order + durations, playoff draw and bracket,
                                                  // then the season change inside closeMatch (champion, relegation, promotion, pool)
play(1);                                          // next season's fixture and a match with the new clubs
const d = League.data;
out.push(d.teams.map(t => t.id), d.reserve.map(t => t.id), d.champions, d.tieOrder, App.seasonPlan().weeks, League.ranking().map(x => [x.t.id, x.r]), d.history);
process.stdout.write(crypto.createHash('sha1').update(JSON.stringify(out)).digest('hex').slice(0, 12) + '\n');
