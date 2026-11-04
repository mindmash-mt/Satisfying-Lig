#!/usr/bin/env node
/*
  Canlı lig checkpoint'i (live-state.json): ligin şu ana kadar biten bütün maçlardan sonraki durumu. Siteye ilk kez
  girenler geçmiş maçları kendi tarayıcılarında hesaplamasın diye GitHub Pages iş akışı her yayında ve 15 dakikada bir
  üretir. Tarayıcısız çalışır (Node, ~15 sn). Dosya yalnızca hızlandırır: yoksa ya da eskiyse tarayıcı aynı sonucu
  kendisi hesaplar.

  Arşivsiz eski biçimli bir checkpoint (Geçmiş sekmesi öncesi) bulunursa lig, aynı kurallarla ligin başından o ana kadar
  yeniden hesaplanır ve SADECE yayındakiyle birebir aynıysa (geçmiş sezonların arşivi dışında) onun yerine geçer: böylece
  biten sezonların tabloları geri kazanılır. Farklıysa yayındaki durum aynen kullanılır, arşiv ileriye dönük tutulur.

  Her seferinde sıfırdan değil, sitede yayında olan son checkpoint'ten devam eder (LIVE_URL verilirse), böylece süre
  lig yaşlandıkça uzamaz. Simülasyon değiştiyse yayındaki checkpoint geçersizdir ama lig sıfırlanmaz: tools/live-base.js
  onu sitenin TABANI yapmıştır (dist/live-base.json) ve checkpoint tabandan devam eder. Ne checkpoint ne taban varsa
  (ilk yayın ya da yeni lig) ligin başından hesaplar; bu MAX_FROM_SCRATCH maçı aşıyorsa durur.

  Kullanım:  LIVE_URL=https://kullanici.github.io/repo/ node tools/live-state.js [çıktı]   (varsayılan dist/live-state.json)
             LIVE_NOW=2026-11-05T21:00:00+03:00 …   (deneme: o andaki durum)
*/
const fs = require('fs'), path = require('path');
const { loadLive } = require('./live-node.js');
const ROOT = path.join(__dirname, '..');
const MAX_FROM_SCRATCH = 3000;
const MAX_BACKFILL = 2000;          // an old-format checkpoint is rebuilt (with the season archive) only up to this many matches (~5 min)
const out = path.resolve(process.argv[2] || path.join(ROOT, 'dist', 'live-state.json'));

/* what the built page carries: its simulation fingerprint and its base (dist/index.html is the source of truth; the
   base file next to it is what build.sh embedded) */
function built() {
  const dir = path.dirname(out), f = path.join(dir, 'index.html');
  const html = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const m = html.match(/const BUILD_SIM_HASH = '([^']+)'/), b = path.join(dir, 'live-base.json'), st = path.join(dir, 'live-start.json');
  return { simHash: m ? m[1] : require('child_process').execFileSync('node', [path.join(__dirname, 'live-fingerprint.js')]).toString().trim(),
    base: fs.existsSync(b) ? JSON.parse(fs.readFileSync(b, 'utf8')) : null,
    start: fs.existsSync(st) ? JSON.parse(fs.readFileSync(st, 'utf8')) : null };
}

/* a checkpoint written before the season archive existed: rebuild it with the archive if the league from its start is provably the same */
const canon = (L, d) => { const c = L.League.normalize(JSON.parse(JSON.stringify(d))); delete c.seasons; if (c.seasonPlan) delete c.seasonPlan.created; return JSON.stringify(c); };
async function adoptLegacy(L, legacy, hasBase) {
  const { Live, League } = L, n = legacy.liveCount || 0, tag = `eski biçimli checkpoint (${n} maç)`;
  if (hasBase || n > MAX_BACKFILL) { Live.adopt(legacy); return `${tag}, arşivsiz${hasBase ? ' (taban var: taban öncesi sezonlar yeniden hesaplanamaz)' : ''}`; }
  Live.adopt(null);
  await Live.catchUp(0, () => legacy.liveLastEnd);
  if (canon(L, League.data) === canon(L, legacy)) return `${tag} → ligin başından yeniden hesaplandı, yayındakiyle birebir aynı (${League.data.seasons.length} sezonluk arşiv eklendi)`;
  console.warn('⚠️ Ligin başından yeniden hesaplanan durum yayındakinden farklı çıktı; yayındaki durum aynen kullanılıyor (arşiv ileriye dönük tutulacak).');
  Live.adopt(legacy);
  return `${tag}, arşivsiz (yeniden hesap eşleşmedi)`;
}

(async () => {
  const { simHash, base, start } = built();
  const L = loadLive({ simHash, base, start }), { Live, League } = L;
  const now = process.env.LIVE_NOW ? Date.parse(process.env.LIVE_NOW) : Date.now();
  if (isNaN(now)) throw new Error('LIVE_NOW okunamadı');
  let from = base ? `taban ${base.id} (${base.count} maç)` : 'ligin başı', prevText = null;
  if (process.env.LIVE_URL) {
    try {
      const r = await fetch(new URL('live-state.json', process.env.LIVE_URL), { headers: { 'cache-control': 'no-cache' } });
      const txt = r.ok ? await r.text() : null, d = txt ? Live.parseState(txt) : null, legacy = txt && !d ? Live.parseState(txt, true) : null;
      /* the furthest valid state wins; the base (if any) is already loaded */
      if (d && (d.liveLastEnd || 0) <= now && (d.liveCount || 0) >= League.data.liveCount) {
        prevText = txt;
        Live.adopt(d);
        from = `yayındaki checkpoint (${d.liveCount} maç)`;
      } else if (legacy && (legacy.liveLastEnd || 0) <= now && (legacy.liveCount || 0) >= League.data.liveCount) {
        from = await adoptLegacy(L, legacy, !!base);
      } else {
        let other = false; try { other = !!txt && Live.parts(JSON.parse(txt).hash).league === null; } catch (e) { /* unreadable */ }
        console.log(!r.ok ? `Yayındaki checkpoint yok (HTTP ${r.status}).` : d ? 'Yayındaki checkpoint tabandan eski; tabandan devam ediliyor.'
          : other ? 'Yayındaki checkpoint başka bir lige ait (yeni lig: başından hesaplanıyor).' : 'Yayındaki checkpoint bu kodla uyumsuz (simülasyon değişmiş: taban kullanılıyor).');
      }
    } catch (e) { console.log('Yayındaki checkpoint okunamadı:', e.message); }
  }
  /* from scratch: refuse an unbounded recomputation (it would also hit every visitor's browser) */
  if (!League.data.liveCount) {
    let n = 0; while (n <= MAX_FROM_SCRATCH && Live.slot(n) <= now) n++;
    if (n > MAX_FROM_SCRATCH) {
      console.error(`❌ Lig ${CONFIG_START(L)} tarihinden beri ${MAX_FROM_SCRATCH}+ maç oynadı ve ne geçerli bir checkpoint ne de taban var.\n` +
        '   Normalde tools/live-base.js bir taban üretir. Yeni bir lig başlatmak isterseniz src/01_core.js içinde CONFIG.LIVE.start\'ı bugüne/ileri alın.');
      process.exit(1);
    }
  }
  const t0 = Date.now(), c0 = League.data.liveCount || 0;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  try {
    await Live.catchUp(0, () => now);
    Live.snapshot();
  } catch (e) {
    /* never publish the site without a checkpoint: the next run would have to start from scratch */
    if (prevText) { fs.writeFileSync(out, prevText); console.error('⚠️ Hesaplama başarısız; yayındaki checkpoint aynen yeniden yayınlandı.'); }
    throw e;
  }
  fs.writeFileSync(out, Live.lastClean);
  const d = League.data;
  console.log(`${path.relative(ROOT, out)}: ${from} → ${d.liveCount} maç (+${d.liveCount - c0}, ${((Date.now() - t0) / 1000).toFixed(1)} sn) · Sezon ${d.season} · Hafta ${d.week} · hash ${Live.hash()}`);
})().catch(e => { console.error('❌', e && e.stack || e); process.exit(1); });
function CONFIG_START(L) { return L.Live.cfg().start; }
