#!/usr/bin/env node
/*
  Canlı lig checkpoint'i — siteye ilk kez girenler geçmiş maçların hepsini kendi tarayıcılarında hesaplamasın diye
  ligin şu ana kadarki durumunu live-state.json olarak üretir (GitHub Pages iş akışı her yayında ve 6 saatte bir çalıştırır).
  Dosya yalnızca hızlandırır: yoksa ya da kod değiştiyse (hash tutmazsa) tarayıcı aynı sonucu kendisi hesaplar.

  Kullanım:  node tools/live-state.js [çıktı dosyası]   (varsayılan: dist/live-state.json)
             LIVE_NOW=2026-11-21T13:00:00+03:00 node tools/live-state.js …   (deneme: o andaki durum)
  Gereken:   Node 18+, Playwright + Chromium
*/
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(ROOT, 'dist', 'live-state.json'));
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright'))); }

(async () => {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const html = path.join(path.dirname(out), '.live-state-app.html');
  execFileSync('sh', [path.join(ROOT, 'build.sh'), html], { stdio: 'ignore' });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => console.error('Sayfa hatası:', e.message));
    await page.goto('file://' + html + (process.env.LIVE_NOW ? '?now=' + encodeURIComponent(process.env.LIVE_NOW) : ''));
    await page.waitForFunction(() => typeof Live !== 'undefined' && Live.phase !== 'loading' && Live.lastClean, null, { timeout: 600000 });
    const state = await page.evaluate(() => Live.lastClean);
    if (!state) throw new Error('Durum üretilemedi.');
    fs.writeFileSync(out, state);
    const d = JSON.parse(state);
    console.log(`${path.relative(ROOT, out)}: ${d.data.liveCount} maç · Sezon ${d.data.season} · Hafta ${d.data.week} · hash ${d.hash}`);
  } finally {
    await browser.close();
    fs.rmSync(html, { force: true });
  }
})().catch(e => { console.error('❌', e && e.stack || e); process.exit(1); });
