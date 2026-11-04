/*
  Canlı lig motorunu tarayıcısız (Node) çalıştırır: src/ dosyalarını, tarayıcıdakiyle aynı kodla, küçük
  DOM taklitleriyle yükler. live-state.js (checkpoint), live-fingerprint.js (build.sh) ve live-check.js
  (testler) kullanır. Sonuçlar tarayıcıdakiyle birebir aynıdır (DM, bkz. src/01_core.js).
  (vm sandbox'ı kullanılmaz: orada global erişimler birkaç kat yavaş.)
*/
const fs = require('fs'), path = require('path');
const FILES = ['01_core.js', '02_sim.js', '03_fx_audio.js', '04_render.js', '05_app.js', '06_offline.js', '07_live.js'];

/* the small DOM stand-ins the engine needs outside a browser */
function env() {
  const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : stub()), apply: () => stub(), construct: () => stub() });
  const store = new Map();
  return {
    location: { search: '', protocol: 'node:' },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    document: stub(), window: stub(), navigator: {}, requestAnimationFrame: () => 0,
  };
}
/* the live engine of a BUILT page (e.g. the site that is live now, with its own rules, base and start): its inline script.
   tools/live-base.js uses it to play the published league on to "now" with the code that is actually live before freezing it. */
function loadPage(html) {
  const i = html.lastIndexOf('<script>'), j = html.lastIndexOf('</script>');
  if (i < 0 || j < i) throw new Error('sayfada betik yok');
  const E = env(), code = html.slice(i + 8, j) + '\nreturn { Live, League, App, CONFIG };';
  const L = new Function(...Object.keys(E), code)(...Object.values(E));
  L.Live.adopt(L.Live.baseState());
  return L;
}
function loadLive({ simHash, base, start } = {}) {
  const env_ = env();
  /* simHash / base: what build.sh writes into the page (BUILD_SIM_HASH, BUILD_BASE = the frozen state of a league that changed rules) */
  /* start: live-start.json (BUILD_START = the league's start chosen at its first deploy, and the old league's archive) */
  const code = (simHash ? `const BUILD_SIM_HASH = ${JSON.stringify(simHash)};\n` : '') + `const BUILD_BASE = ${JSON.stringify(base || null)};\n` +
    `const BUILD_START = ${JSON.stringify(start || null)};\n` +
    FILES.map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n') +
    '\nreturn { Live, League, App, CONFIG, Game, DT, RNG, planRoundRobin, fixtureStats, DM, LivePages };';
  const L = new Function(...Object.keys(env_), code)(...Object.values(env_));
  L.Live.adopt(base && base.data ? L.Live.baseState() : null);
  return L;
}
module.exports = { loadLive, loadPage };
