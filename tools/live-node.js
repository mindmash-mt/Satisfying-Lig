/*
  Canlı lig motorunu tarayıcısız (Node) çalıştırır: src/ dosyalarını, tarayıcıdakiyle aynı kodla, küçük
  DOM taklitleriyle yükler. live-state.js (checkpoint), live-fingerprint.js (build.sh) ve live-check.js
  (testler) kullanır. Sonuçlar tarayıcıdakiyle birebir aynıdır (DM, bkz. src/01_core.js).
  (vm sandbox'ı kullanılmaz: orada global erişimler birkaç kat yavaş.)
*/
const fs = require('fs'), path = require('path');
const FILES = ['01_core.js', '02_sim.js', '03_fx_audio.js', '04_render.js', '05_app.js', '06_offline.js', '07_live.js'];

function loadLive({ simHash, base } = {}) {
  const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : stub()), apply: () => stub(), construct: () => stub() });
  const store = new Map();
  const env = {
    location: { search: '', protocol: 'node:' },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    document: stub(), window: stub(), navigator: {}, requestAnimationFrame: () => 0,
  };
  /* simHash / base: what build.sh writes into the page (BUILD_SIM_HASH, BUILD_BASE = the frozen state of a league that changed rules) */
  const code = (simHash ? `const BUILD_SIM_HASH = ${JSON.stringify(simHash)};\n` : '') + `const BUILD_BASE = ${JSON.stringify(base || null)};\n` +
    FILES.map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n') +
    '\nreturn { Live, League, App, CONFIG, Game, DT, RNG, planSeason, DM, LivePages };';
  const L = new Function(...Object.keys(env), code)(...Object.values(env));
  L.Live.adopt(base && base.data ? L.Live.baseState() : null);
  return L;
}
module.exports = { loadLive };
