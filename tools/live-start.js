#!/usr/bin/env node
/*
  Canlı ligin BAŞLANGICI (live-start.json): yeni bir lig (yeni CONFIG.LIVE.salt) ilk yayınlandığında, yayından birkaç
  dakika sonra başlasın diye başlangıç saatini yayın anında belirler. GitHub Pages iş akışı her yayında, siteyi
  derlemeden önce çalıştırır; build.sh dosyayı sayfaya gömer (BUILD_START).

    • Yayındaki live-start.json bu salt'a aitse aynen taşınır: lig her yayında aynı saatte başlamış olarak kalır.
    • Yoksa ama yayındaki checkpoint (live-state.json) bu salt'ın ligine aitse, başlangıç onun lig kimliğinden geri okunur
      (live-start.json kaybolsa bile lig sıfırlanmaz).
    • İkisi de yoksa bu salt ilk kez yayınlanıyordur: başlangıç = şimdi + START_DELAY dakika (İstanbul saati, dakikaya
      yuvarlanmış). Yayındaki checkpoint başka (eski) bir lige aitse onun şampiyonları ve biten sezonları "eski lig" olarak
      saklanır (Geçmiş sekmesi); o ligin sürmekte olan sezonu tamamlanmadığı için saklanmaz.

  Yayındaki dosyalar okunamazsa (404 dışında bir hata) araç HATA verir ve yayın yapılmaz: başlangıç saati yanlışlıkla
  değişip lig sıfırlanmasın; 15 dakika sonra yeniden denenir.

  Kullanım:  LIVE_URL=https://kullanici.github.io/repo/ node tools/live-start.js [çıktı]   (varsayılan dist/live-start.json)
             LIVE_START=2026-11-05T21:00 …   (elle: bu salt'ın başlangıcı; yalnızca yeni bir lig için)
             LIVE_URL verilmezse dosya yazılmaz: sayfa CONFIG.LIVE.start'ı kullanır (yerel derleme).
*/
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const START_DELAY = 4;              // minutes between the deploy and the first match of a new league (the deploy itself takes ~1–2 min)

/* Saf karar işlevi (live-check.js sınar).
   cfg:      CONFIG.LIVE (salt, bands, gap, utcOffset)
   prev:     yayındaki live-start.json (ya da null)
   pub:      yayındaki live-state.json (ya da null)
   now:      ms
   manual:   LIVE_START (ya da null)
   Döner: { action: 'keep' | 'recover' | 'new', start, why, legacy } */
function decide({ cfg, prev, pub, now, manual }) {
  if (prev && prev.salt === cfg.salt && prev.start) return { action: 'keep', start: prev, why: `lig ${prev.start}'te başladı; aynen taşınıyor` };
  /* league id in a state's hash: <sim>:<salt>:<start>[@base] (older: <sim>:<salt>:<start>:<bands>:<gap>[@base]) */
  const id = pub && typeof pub.hash === 'string' ? pub.hash.split('@')[0] : '';
  const m = id.match(/^[^:]*:([^:]+):(\d{4}-\d\d-\d\dT\d\d:\d\d|\d{4}-\d\d-\d\d)(?::|$)/);
  if (m && m[1] === cfg.salt) {
    const legacy = prev && prev.legacy ? prev.legacy : null;
    return { action: 'recover', start: { salt: cfg.salt, start: m[2], legacy }, why: `live-start.json yok; başlangıç (${m[2]}) yayındaki checkpoint'ten geri okundu` };
  }
  let start = manual;
  if (!start) {
    const t = new Date(Math.ceil((now + START_DELAY * 60e3) / 60e3) * 60e3 + cfg.utcOffset * 3600e3);
    start = t.toISOString().slice(0, 16);
  }
  /* the league being replaced: its champions and finished seasons (the running season is not finished: it is not kept) */
  let legacy = null;
  if (pub && pub.data && Array.isArray(pub.data.seasons) && !(m && m[1] === cfg.salt)) {
    legacy = { from: m ? m[1] : null, endedAt: new Date(now).toISOString(), season: pub.data.season || null,
      champions: (pub.data.champions || []).map(c => ({ id: c.id, name: c.name, season: c.season, pts: c.pts })), seasons: pub.data.seasons };
  } else if (prev && prev.legacy) legacy = prev.legacy;
  return { action: 'new', start: { salt: cfg.salt, start, createdAt: new Date(now).toISOString(), legacy },
    why: `yeni lig (${cfg.salt}): ilk maç ${start} (TSİ)${legacy ? `; eski ligin ${legacy.seasons.length} biten sezonu ve ${legacy.champions.length} şampiyonu Geçmiş'e taşındı` : ''}` };
}

/* a published file: { text } or { absent: true } (404). Any other failure is an error: never guess the league away. */
async function fetchPublished(name, retries = 4) {
  const url = new URL(name, process.env.LIVE_URL);
  let err;
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
      if (r.status === 404) return { absent: true };
      if (r.ok) return { text: await r.text() };
      err = new Error(`HTTP ${r.status}`);
    } catch (e) { err = e; }
    await new Promise(r => setTimeout(r, 1500 * 2 ** i));
  }
  throw new Error(`${url} okunamadı (${err.message}). Lig yanlışlıkla sıfırlanmasın diye yayın durduruldu.`);
}
const readJSON = (f, name) => { if (f.absent) return null; try { return JSON.parse(f.text); } catch (e) { throw new Error(`${name} bozuk (${e.message}); yayın durduruldu.`); } };

async function main() {
  const out = path.resolve(process.argv[2] || path.join(ROOT, 'dist', 'live-start.json'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (!process.env.LIVE_URL && !process.env.LIVE_START) { fs.rmSync(out, { force: true }); console.log('LIVE_URL yok: başlangıç CONFIG.LIVE.start (yerel derleme).'); return; }
  const { loadLive } = require('./live-node.js');
  const { CONFIG } = loadLive();
  const manual = process.env.LIVE_START || null;
  if (manual && !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(manual)) throw new Error('LIVE_START biçimi YYYY-MM-DDTHH:MM olmalı');
  const prev = process.env.LIVE_URL ? readJSON(await fetchPublished('live-start.json'), 'live-start.json') : null;
  const pub = process.env.LIVE_URL ? readJSON(await fetchPublished('live-state.json'), 'live-state.json') : null;
  const r = decide({ cfg: CONFIG.LIVE, prev, pub, now: Date.now(), manual });
  fs.writeFileSync(out, JSON.stringify(r.start));
  console.log(`Canlı lig başlangıcı [${r.action}]: ${r.why}`);
}
module.exports = { decide, START_DELAY };
if (require.main === module) main().catch(e => { console.error('❌', e && e.message || e); process.exit(1); });
