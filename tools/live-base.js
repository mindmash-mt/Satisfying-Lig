#!/usr/bin/env node
/*
  Canlı ligin TABANI (live-base.json): simülasyon kuralları değiştiğinde ligin sıfırlanmaması için GitHub Pages iş akışı
  her yayında bu aracı, siteyi derlemeden önce çalıştırır.

  Sorun: canlı lig tarayıcıda maç maç hesaplanır; kural (sonuç) değişince aynı geçmiş artık aynı çıkmaz. Eski kodu
  tutmadığımız için geçmişi yeniden hesaplamak yerine geçmişi DONDURURUZ:

    • Yayındaki site son 15 dakikanın checkpoint'ini (live-state.json) taşır. Yeni kod farklı bir simülasyon parmak izi
      (BUILD_SIM_HASH) taşıyorsa, bu checkpoint yeni sitenin TABANI olur: build.sh onu sayfaya gömer (BUILD_BASE).
    • Tarayıcılar ve checkpoint üreteci ligi tabandan başlatır; tabandan sonraki maçlar yeni kurallarla oynanır,
      tabandan önceki her şey (tablo, şampiyonlar, geçmiş, sezon) olduğu gibi kalır.
    • Kural aynı kaldıkça (15 dakikalık yayınlar, görünüm değişiklikleri) taban aynen taşınır: yayındaki live-base.json
      yeniden yayınlanır. Taban birikimlidir: sonraki bir kural değişikliği yine o anki checkpoint'ten tabanı yeniler.
    • Yeniden belirlenen tek şey, son checkpoint ile yayın arasındaki maçlardır (en fazla ~15 dk): bunlar yeni
      kurallarla yeniden oynanır.

  Lig kimliği (salt, start, takvim, gap) değişirse bilinçli olarak yeni bir lig başlar: taban ve checkpoint yok sayılır.

  Yayındaki dosyalar okunamazsa (404 dışında bir hata) araç HATA verir ve yayın yapılmaz: yanlışlıkla ligi sıfırlamaktansa
  eski site yayında kalır, 15 dakika sonra yeniden denenir.

  Kullanım:  LIVE_URL=https://kullanici.github.io/repo/ node tools/live-base.js [çıktı]   (varsayılan dist/live-base.json)
             Çıktı yazılmazsa (ya da silinirse) lig tabansız, ligin başından hesaplanır.
*/
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');

/* Saf karar işlevi (live-check.js sınar).
   cur:       { league, sim }  bu kodun lig kimliği ve simülasyon parmak izi
   prevBase:  yayındaki live-base.json (ya da null)
   pub:       yayındaki live-state.json (ya da null)
   parts:     Live.parts (bir durumun hash'ini { sim, league, base } olarak ayırır)
   Döner: { action: 'keep' | 'rebase' | 'none', base, why } */
function decide({ cur, prevBase, pub, parts }) {
  const sameLeague = (x) => x && x.league === cur.league;
  /* the lineage continues: same league, same rules as the published base */
  if (prevBase && prevBase.data && sameLeague(prevBase) && prevBase.sim === cur.sim)
    return { action: 'keep', base: prevBase, why: `kural değişmedi: taban ${prevBase.id} (${prevBase.count} maç) aynen taşınıyor` };
  const pp = pub && pub.data ? parts(pub.hash) : null;
  const pubOK = !!pp && pp.league === cur.league;
  /* published checkpoint already belongs to this code without a base: nothing to freeze */
  if (pubOK && pp.sim === cur.sim && !pp.base)
    return { action: 'none', base: null, why: 'yayındaki checkpoint bu kodla uyumlu, taban gerekmiyor' };
  /* the rules changed (or the lineage is unknown): freeze the furthest state of this league that we have */
  const cands = [];
  if (pubOK && pub.data.liveCount) cands.push({ from: 'yayındaki checkpoint', data: pub.data, savedAt: pub.savedAt, was: pp.sim });
  if (prevBase && prevBase.data && sameLeague(prevBase) && prevBase.data.liveCount) cands.push({ from: 'önceki taban', data: prevBase.data, savedAt: prevBase.savedAt, was: prevBase.sim });
  cands.sort((a, b) => b.data.liveCount - a.data.liveCount);          // ties: the checkpoint (listed first) wins
  const best = cands[0];
  if (!best) return { action: 'none', base: null, why: 'korunacak bir lig durumu yok: lig kendi kendine, ligin başından hesaplanır' };
  const id = crypto.createHash('sha1').update(JSON.stringify(best.data)).digest('hex').slice(0, 10);
  return { action: 'rebase', why: `simülasyon değişti (${best.was} → ${cur.sim}): lig ${best.from} durumunda donduruldu (${best.data.liveCount} maç), yeni kurallar buradan devam ediyor`,
    base: { id, league: cur.league, sim: cur.sim, count: best.data.liveCount, savedAt: best.savedAt || null, data: best.data } };
}

/* a published file: { text } or { absent: true } (404). Any other failure is an error: never guess the league away. */
async function fetchPublished(name, retries = 4) {
  if (!process.env.LIVE_URL) return { absent: true };
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
  const out = path.resolve(process.argv[2] || path.join(ROOT, 'dist', 'live-base.json'));
  const { loadLive } = require('./live-node.js');
  const sim = require('child_process').execFileSync('node', [path.join(__dirname, 'live-fingerprint.js')]).toString().trim();
  /* the league's start chosen by tools/live-start.js (run before this, next to the output) is part of the league's identity */
  const sf = path.join(path.dirname(out), 'live-start.json'), start = fs.existsSync(sf) ? JSON.parse(fs.readFileSync(sf, 'utf8')) : null;
  const { Live } = loadLive({ simHash: sim, start });
  const cur = { league: Live.league(), sim };
  const prevBase = readJSON(await fetchPublished('live-base.json'), 'live-base.json');
  const pub = readJSON(await fetchPublished('live-state.json'), 'live-state.json');
  const r = decide({ cur, prevBase, pub, parts: (h) => Live.parts(h) });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (r.base) fs.writeFileSync(out, JSON.stringify(r.base)); else fs.rmSync(out, { force: true });
  console.log(`Canlı lig tabanı [${r.action}] (kural ${sim}): ${r.why}`);
}
module.exports = { decide };
if (require.main === module) main().catch(e => { console.error('❌', e && e.message || e); process.exit(1); });
