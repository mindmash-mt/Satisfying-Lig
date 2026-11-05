#!/usr/bin/env node
/*
  Sitenin durağan dosyalarını üretir (public/): PNG simgeler (public/icon.svg'den) ve paylaşım görseli og.jpg
  (1200×630; sağında gerçek bir maç karesi). Yalnızca simge ya da görünüm değişince elle çalıştırılır; çıktı repoya eklenir.
  Kullanım: ./build.sh /tmp/site/index.html && node tools/make-assets.js /tmp/site/index.html [geçmiş bir an, ör. 2026-11-04T19:54:35Z]
  (Playwright + Chromium gerekir; an, sayfanın ?now= parametresine verilir: o anda oynanan maçın bir karesi alınır.)
*/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const site = path.resolve(process.argv[2] || 'index.html'), pub = path.join(__dirname, '..', 'public');
const when = process.argv[3] || '2026-11-04T19:54:35Z';
(async () => {
  const b = await chromium.launch();
  const svg = fs.readFileSync(path.join(pub, 'icon.svg'), 'utf8');
  for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['apple-touch-icon.png', 180, 0], ['icon-maskable-512.png', 512, 0.12]]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    const inner = Math.round(size * (1 - 2 * pad));
    await p.setContent(`<html><body style="margin:0;background:#0b0e14;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</body></html>`);
    await p.screenshot({ path: path.join(pub, name) });
    await p.close();
  }
  /* og image: a real frame of a live match, inside a 1200×630 card */
  const p = await b.newPage({ viewport: { width: 540, height: 960 } });
  await p.goto('file://' + site + '?now=' + encodeURIComponent(when));
  await p.waitForTimeout(7000);
  const frame = await p.locator('#c').screenshot({ type: 'png' });
  await p.close();
  const og = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await og.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@600;800&display=swap" rel="stylesheet"></head>
  <body style="margin:0;width:1200px;height:630px;background:radial-gradient(circle at 30% 40%,#16324a,#0b0e14 70%);font-family:Inter,sans-serif;color:#fff;display:flex;align-items:center;overflow:hidden">
    <div style="flex:1;padding:0 40px 0 80px">
      <div style="font-family:'Bebas Neue';font-size:120px;line-height:.9;letter-spacing:1px">SATISFYING<br><span style="color:#2ee59d">LİG</span></div>
      <div style="font-size:30px;font-weight:800;margin-top:28px">Kendi kendine oynayan canlı futbol ligi</div>
      <div style="font-size:24px;font-weight:600;color:#8b95a8;margin-top:14px">Her 3 dakikada bir maç · 90 saniye · herkes aynı maçı aynı anda izler</div>
    </div>
    <img src="data:image/png;base64,${frame.toString('base64')}" style="height:600px;margin-right:60px;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.6)">
  </body></html>`, { waitUntil: 'networkidle' });
  await og.evaluate(() => document.fonts.ready);
  await og.screenshot({ path: path.join(pub, 'og.jpg'), type: 'jpeg', quality: 88 });
  await b.close();
})();
