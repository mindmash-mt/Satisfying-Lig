#!/usr/bin/env node
/*
  Günlük maç günü — aktif ligin bu haftaki kalan grup maçlarını oynatır, her biri için MP4 üretir
  ve lig verisini günceller. Her sabah zamanlanmış görev çalıştırır; elle çalıştırmak ligi bir hafta ilerletir.

  Kullanım:  node tools/daily.js [active] [--dry-run] [--max N] [--bitrate MBPS] [--reset] [--out KLASÖR]
    --dry-run   videoları üretir ama lig verisine hiçbir şey yazmaz (deneme için; çıktı out/dry-run/<tarih>)
    --max N     en fazla N maç oynat (hafta yarım kalırsa sonraki çalıştırma tamamlar)
    --bitrate   video bit hızı, Mbps (varsayılan 8)
    --reset     ligi sıfırdan başlat (mevcut league.json yok sayılır; --max 0 ile maç oynatmadan sadece sıfırlar)
    --out       videoların yazılacağı klasör (varsayılan out/active/<İstanbul tarihi>)

  Lig verisi:   data/active/league.json   (tarayıcıdaki "Tabloyu dışa aktar" ile aynı biçim)
  Okunur tablo: data/active/STANDINGS.md
  Sezon arşivi: data/active/seasons/season-<n>.json
  Çıktı:        <out>/*.mp4, <out>/captions.txt, <out>/summary.json

  Sezonun son haftası bittiğinde final oynanmaz: tablonun lideri şampiyon olur, sezon arşivlenir
  ve yeni sezon 1. haftadan başlar.

  KEEP_TMP=1 ortam değişkeniyle ara dosyalar (ham H.264 + WAV) silinmez.

  Gereken: Node 18+, Playwright + Chromium, ffmpeg.
*/
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const league = 'active';
if (args[0] && !args[0].startsWith('--') && args[0] !== league) {
  console.error('Kullanım: node tools/daily.js [active] [--dry-run] [--max N] [--bitrate MBPS] [--reset] [--out KLASÖR]');
  process.exit(2);
}
const dry = args.includes('--dry-run');
const maxMatches = +opt('--max', 99);
const bitrate = +opt('--bitrate', 8) * 1e6;
const STORAGE_KEY = 'arenaLeague_v1';

const istanbul = (d = new Date()) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};
const now = istanbul();
const dataDir = path.join(ROOT, 'data', league);
const leagueFile = path.join(dataDir, 'league.json');
const outDir = path.resolve(ROOT, opt('--out', path.join('out', dry ? 'dry-run' : league, now.date)));
const tmpDir = path.join(outDir, '.tmp');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright'))); }

const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

function writeLeague(d) {
  if (dry) return;
  const tmp = leagueFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2) + '\n');
  fs.renameSync(tmp, leagueFile);
}

/* rank: the table order and last-match places from the app itself (League.ranking / League.formOf), so the rules live in one place only */
function standingsMd(d, rank) {
  const rankIds = rank.map(x => x.id), formOf = Object.fromEntries(rank.map(x => [x.id, x.form || []]));
  const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
  const formTxt = (id) => formOf[id].length ? formOf[id].map(ord).join(' ') : '–';
  const row = (id) => d.table[id] || { played: 0, pts: 0, wins: 0, gf: 0, ga: 0 };
  const rk = rankIds.map(id => d.teams.find(t => t.id === id)).filter(Boolean).map(t => ({ t, r: row(t.id) }));
  const code = (id) => (d.teams.find(t => t.id === id) || {}).code || id;
  const L = [];
  L.push('# Satisfying Lig — Aktif lig', '');
  L.push(`Sezon **${d.season || 1}** · sıradaki: **Hafta ${d.week} / ${d.seasonLength}**, grup maçı ${d.weekMatch} · bu sezon oynanan maç: **${d.history.length}**`, '');
  L.push(`_Son güncelleme: ${now.date} ${istanbul().time} (İstanbul)_`, '');
  L.push('| # | Takım | O | P | 1. | AG | YG | AV | Son maçlar |', '|---:|---|---:|---:|---:|---:|---:|---:|---|');
  rk.forEach((x, i) => { const r = x.r, av = r.gf - r.ga; L.push(`| ${i + 1} | ${x.t.name} | ${r.played} | **${r.pts}** | ${r.wins} | ${r.gf} | ${r.ga} | ${av > 0 ? '+' : ''}${av} | ${formTxt(x.t.id)} |`); });
  L.push('', 'O: oynanan · P: puan · 1.: birincilik · AG: atılan gol · YG: yenilen gol · AV: averaj · Son maçlar: son maçlardaki sırası (eskiden yeniye, en sağdaki en yeni)', '');
  const last = d.history.slice(-9).reverse();
  if (last.length) {
    L.push('## Son maçlar', '', '| Maç | Hafta · grup | Sıralama (gol) | Tema | Süre | Tarih |', '|---:|---|---|---|---:|---|');
    for (const h of last) {
      const order = h.result.slice().sort((a, b) => a.place - b.place).map(r => `${r.place}. ${code(r.id)} (${r.gf})`).join(' · ');
      const when = `H${h.week} · ${h.weekMatch}`;
      L.push(`| ${h.matchNo} | ${when} | ${order} | ${h.theme} | ${Math.round(h.duration)} sn | ${istanbul(new Date(h.date)).date} |`);
    }
    L.push('');
  }
  if (d.champions.length) {
    L.push('## Şampiyonlar', '', ...d.champions.map(c => `- Sezon ${c.season || '?'}: **${c.name}**`), '');
  }
  return L.join('\n');
}

(async () => {
  const html = path.join(tmpDir, 'app.html');
  execFileSync('sh', [path.join(ROOT, 'build.sh'), html], { stdio: 'ignore' });
  const reset = args.includes('--reset');
  const saved = !reset && fs.existsSync(leagueFile) ? fs.readFileSync(leagueFile, 'utf8') : null;
  log(`${dry ? 'DENEME (lig verisi değişmez) · ' : ''}Lig: ${league} · ${saved ? 'mevcut veri yüklendi' : reset ? 'lig sıfırlandı' : 'yeni lig başlıyor'} · çıktı: ${path.relative(ROOT, outDir)}`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.on('pageerror', e => log('Sayfa hatası:', e.message));
  await page.addInitScript(([key, val]) => { try { localStorage.clear(); if (val) localStorage.setItem(key, val); } catch (e) { /* ignore */ } }, [STORAGE_KEY, saved]);
  let sink = null;
  await page.exposeFunction('__sink', (kind, b64) => { if (sink) sink(kind, Buffer.from(b64, 'base64')); });
  await page.goto('file://' + html + '?studio');   // the studio (league in localStorage), not the live site
  await page.waitForFunction(() => typeof Offline !== 'undefined' && typeof App !== 'undefined' && App.setup, null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  const fontsOK = await page.evaluate(() => document.fonts.check('80px "Bebas Neue"') && document.fonts.check('700 30px Inter'));
  if (!fontsOK) log('⚠️ Google Fonts yüklenemedi; videolarda yedek yazı tipi kullanılacak.');

  const plan = await page.evaluate(() => {
    Offline.begin();
    const d = League.data, s = d.settings;
    if (!d.season) d.season = 1;
    s.testMatch = false; s.theme = s.theme || 'auto';
    League.save();
    /* the season fixture is built once at the start of the season and stored in league.json */
    const sp = App.seasonPlan();
    if (!sp) return { error: `Takım sayısı (${d.teams.length}) ${CONFIG.GROUP_SIZE}'nın katı değil; gruplar eşit olamaz.` };
    return { season: d.season, week: d.week, weekMatch: d.weekMatch, perWeek: App.perWeek(), seasonLength: d.seasonLength,
      groups: (sp.weeks[d.week - 1] || []).map(g => g.map(id => (d.teams.find(t => t.id === id) || {}).code || id)) };
  });
  if (plan.error) throw new Error(plan.error);
  log(`Sezon ${plan.season} · Hafta ${plan.week}/${plan.seasonLength} · grup maçı ${plan.weekMatch}/${plan.perWeek} · gruplar: ${plan.groups.map(g => g.join(' ')).join(' | ')}`);

  const videos = [];
  const renderOne = async () => {
    const vPath = path.join(tmpDir, 'video.h264'), aPath = path.join(tmpDir, 'audio.wav');
    const vOut = fs.openSync(vPath, 'w'), aOut = fs.openSync(aPath, 'w');
    sink = (kind, buf) => fs.writeSync(kind === 'video' ? vOut : aOut, buf);
    const t0 = Date.now();
    let r;
    try { r = await page.evaluate((b) => Offline.renderMatch({ bitrate: b }), bitrate); }
    finally { sink = null; fs.closeSync(vOut); fs.closeSync(aOut); }
    const mp4 = path.join(outDir, r.base + '.mp4');
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-fflags', '+genpts', '-r', '60', '-f', 'h264', '-i', vPath, '-i', aPath,
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', mp4]);
    if (!process.env.KEEP_TMP) { fs.rmSync(vPath); fs.rmSync(aPath); }
    const d = await page.evaluate(() => League.data);
    writeLeague(d);
    const size = fs.statSync(mp4).size;
    log(`✅ ${r.title} · kazanan ${r.winner} · ${r.seconds.toFixed(1)} sn video · ${(size / 1048576).toFixed(1)} MB · ${((Date.now() - t0) / 1000).toFixed(0)} sn'de üretildi`);
    videos.push({ file: path.relative(ROOT, mp4), title: r.title, winner: r.winner, subtitle: r.subtitle, seconds: +r.seconds.toFixed(1), theme: r.theme, standings: r.standings, caption: r.caption });
    return d;
  };

  let d = await page.evaluate(() => League.data), played = 0, archived = null;
  writeLeague(d);
  try {
    /* the rest of this week's group matches (a run cut short yesterday is completed first) */
    const startWeek = plan.week;
    while (d.week <= d.seasonLength && played < maxMatches) {
      d = await renderOne(); played++;
      if (d.week !== startWeek) break;   // week finished
    }
    /* season over → the table leader is the champion; last teams out, reserve clubs in; new season */
    if (d.week > d.seasonLength) {
      archived = await page.evaluate(() => League.endSeason());
      if (!dry) {
        fs.mkdirSync(path.join(dataDir, 'seasons'), { recursive: true });
        fs.writeFileSync(path.join(dataDir, 'seasons', `season-${archived.season}.json`), JSON.stringify(archived, null, 2) + '\n');
      }
      d = await page.evaluate(() => League.data);
      writeLeague(d);
      log(`🏆 Sezon ${archived.season} bitti — şampiyon: ${archived.champion.name}. Çıkanlar: ${archived.relegated.map(t => t.name).join(', ')} · Gelenler: ${archived.promoted.map(t => t.name).join(', ')}`);
      log(`📦 Sezon ${archived.season} arşivlendi; Sezon ${d.season} başladı.`);
    }
  } finally {
    let rank = null;
    try { rank = await page.evaluate(() => League.ranking().map(x => ({ id: x.t.id, form: League.formOf(x.t.id) }))); } catch (e) { /* page gone */ }
    await browser.close();
    if (d && !dry && rank) fs.writeFileSync(path.join(dataDir, 'STANDINGS.md'), standingsMd(d, rank));
    if (!process.env.KEEP_TMP) fs.rmSync(tmpDir, { recursive: true, force: true });
    const summary = { league, dryRun: dry, date: now.date, videos, seasonArchived: archived ? archived.season : null,
      next: d ? { season: d.season, week: d.week, weekMatch: d.weekMatch } : null };
    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    fs.writeFileSync(path.join(outDir, 'captions.txt'), videos.map(v => `=== ${path.basename(v.file)} ===\n${v.caption}\n`).join('\n'));
    log(`Bitti: ${videos.length} video → ${path.relative(ROOT, outDir)}`);
    console.log('SUMMARY ' + JSON.stringify(summary));
  }
})().catch(e => { console.error('❌', e && e.stack || e); process.exit(1); });
