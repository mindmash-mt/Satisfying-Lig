/* =====================================================================
   STATISTICS  (the live site's "İstatistik" tab and the club pages)
   Worked out from what the league state already carries: the finished seasons' archive (League.data.seasons: final
   tables, relegation / promotion, the playoff bracket and the league matches' scores, see Live.archiveSeason) and the
   running season (table, history), the league's and the promotion league's (pl / promo: its matches count in the all-time
   table, the records, the streaks, the head-to-head and the goal averages; titles and season records are the league's). Nothing here touches the league or its results (the simulation fingerprint does not
   change); the numbers are recomputed only when the league changes (a match ends, a season ends).
   Seasons archived before the scores were kept (no `m`) still count in the all-time table, the titles and the goal
   averages; the match records (biggest wins, streaks, head-to-head) start after them.
   ===================================================================== */
/** @typedef {{ s: number, w: number, i: number, h: string, a: string, hs: number, as: number, dv: string }} StatMatch  a league match: season, week, order in the season, home / away club, goals and division ('main' the league, 'promo' the promotion league) */
/** @typedef {{ id: string, len: number, from: StatMatch, to: StatMatch, on: boolean }} StatStreak */
const LiveStats = {
  _key: '', _v: null,
  key() {
    const d = League.data, s = d.seasons || [];
    return [d.season, d.history.length, d.promo ? d.promo.history.length : 0, s.length, s.length ? s[s.length - 1].season : 0, d.teams.map(t => t.id).join(), d.reserve.map(t => t.id).join()].join('|');
  },
  get() { const k = this.key(); if (k !== this._key || !this._v) { this._key = k; this._v = this.compute(); } return this._v; },
  /* this league's finished seasons (the 1v1 format), oldest first */
  recs() { return (League.data.seasons || []).filter(r => r && r.f === 2 && Array.isArray(r.rows)).slice().sort((x, y) => x.season - y.season); },
  /* an archived season's league matches (Live.archiveSeason: 4 base-36 characters a match); lg: { m, rows } (the season record
     itself, or its promotion league rec.pl with dv 'promo') */
  decode(rec, lg = rec, dv = 'main') {
    const m = typeof lg.m === 'string' ? lg.m : '', per = Math.max(1, lg.rows.length >> 1), out = [];
    for (let j = 0; (j + 1) * 4 <= m.length; j++) {
      const v = [0, 1, 2, 3].map(k => parseInt(m[j * 4 + k], 36)), h = lg.rows[v[0]], a = lg.rows[v[1]];
      if (!h || !a || v.some(x => isNaN(x))) return [];
      out.push({ s: rec.season, w: Math.floor(j / per) + 1, i: j, h: h[0], a: a[0], hs: v[2], as: v[3], dv });
    }
    return out;
  },
  /* an archived season's promotion league matches ([] for a season without one) */
  decodePl(rec) { return rec.pl && Array.isArray(rec.pl.rows) ? this.decode(rec, rec.pl, 'promo') : []; },
  /* the running season's matches: the league's ('main') or the promotion league's ('promo') */
  current(dv = 'main') {
    const d = League.data, hist = dv === 'promo' ? (League.promoOn() ? d.promo.history : []) : d.history;
    return hist.filter(h => h.result && h.result.length === 2)
      .map((h, i) => ({ s: d.season, w: h.week, i, h: h.result[0].id, a: h.result[1].id, hs: h.result[0].score, as: h.result[1].score, dv }));
  },
  /* the running promotion league's table as archive rows (null: no promotion league or no match yet) */
  curPromo() {
    const d = League.data;
    if (!League.promoOn() || !d.promo.history.length) return null;
    return { season: d.season, cur: true, n: d.promo.history.length, rows: League.promoRanking().map(x => [x.t.id, x.r.played, x.r.pts, x.r.w, x.r.d, x.r.l, x.r.gf, x.r.ga]) };
  },
  compute() {
    const d = League.data, recs = this.recs();
    const cur = { season: d.season, cur: true, n: d.history.length, champ: '', out: [], up: [],
      rows: League.ranking().map(x => [x.t.id, x.r.played, x.r.pts, x.r.w, x.r.d, x.r.l, x.r.gf, x.r.ga]) };
    const curPl = this.curPromo();
    /* every season with its matches (the league's, then the promotion league's: a club plays in one of them a season);
       an archived season without its scores breaks the records' continuity */
    const blocks = recs.map(r => {
      const a = this.decode(r), b = this.decodePl(r);
      return { s: r.season, ms: a.concat(b), lost: (!a.length && r.n > 0) || (!!r.pl && !b.length && r.pl.n > 0) };
    }).concat([{ s: d.season, ms: this.current().concat(this.current('promo')), lost: false }]);
    let since = d.season;
    for (let k = blocks.length - 1; k >= 0 && !blocks[k].lost; k--) since = blocks[k].s;
    const ms = blocks.flatMap(b => b.ms);
    /* all-time table: the seasons' final tables + the running season, the league's and the promotion league's
       (seasons: in the league, pl: in the promotion league) */
    const at = new Map();
    const get = (id) => { if (!at.has(id)) at.set(id, { id, seasons: 0, pl: 0, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, titles: 0, best: 0 }); return at.get(id); };
    const add = (r, promo) => r.rows.forEach((x, i) => {
      const A = get(x[0]);
      if (promo) A.pl++; else A.seasons++;
      A.played += x[1]; A.pts += x[2]; A.w += x[3]; A.d += x[4]; A.l += x[5]; A.gf += x[6]; A.ga += x[7];
      if (!promo && !r.cur && (!A.best || i + 1 < A.best)) A.best = i + 1;
    });
    for (const r of recs.concat(d.history.length ? [cur] : [])) add(r, false);
    for (const r of recs.filter(r => r.pl).map(r => r.pl).concat(curPl ? [curPl] : [])) add(r, true);
    const titles = new Map();
    for (const c of d.champions) { const T = titles.get(c.id) || { id: c.id, n: 0, seasons: [] }; T.n++; T.seasons.push(c.season); titles.set(c.id, T); if (at.has(c.id)) at.get(c.id).titles++; }
    const allTime = [...at.values()].sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || y.titles - x.titles || x.id.localeCompare(y.id));
    const titleList = [...titles.values()].sort((x, y) => y.n - x.n || Math.max(...y.seasons) - Math.max(...x.seasons));
    /* match records */
    const order = (x, y) => x.s - y.s || x.i - y.i;
    const big = ms.filter(m => m.hs !== m.as).sort((x, y) => Math.abs(y.hs - y.as) - Math.abs(x.hs - x.as) || Math.max(y.hs, y.as) - Math.max(x.hs, x.as) || order(x, y));
    const goals = ms.slice().sort((x, y) => (y.hs + y.as) - (x.hs + x.as) || order(x, y));
    /* streaks (league and promotion league matches, across seasons while the club plays in one of them) */
    /** @type {{ w: StatStreak[], u: StatStreak[] }} */
    const streaks = { w: [], u: [] };
    /** @type {Object<string, { w: StatStreak|null, u: StatStreak|null, last: number }>} */
    const run = {};
    const close = (id, k) => { const R = run[id], s = R && R[k]; if (s && s.len >= 2) streaks[k].push(s); if (R) R[k] = null; };
    for (const b of blocks) {
      if (b.lost) { Object.keys(run).forEach(id => { close(id, 'w'); close(id, 'u'); }); continue; }
      for (const m of b.ms) for (const [id, gf, ga] of [[m.h, m.hs, m.as], [m.a, m.as, m.hs]]) {
        const R = run[id] || (run[id] = { w: null, u: null, last: m.s });
        if (R.last < m.s - 1) { close(id, 'w'); close(id, 'u'); }                  // a season without matches in between (the old pool)
        R.last = m.s;
        for (const k of ['w', 'u']) {
          if (k === 'w' ? gf > ga : gf >= ga) { if (!R[k]) R[k] = { id, len: 0, from: m, to: m, on: false }; R[k].len++; R[k].to = m; }
          else close(id, k);
        }
      }
    }
    for (const id of Object.keys(run)) {
      const on = (d.teams.some(t => t.id === id) || d.reserve.some(t => t.id === id)) && run[id].last >= d.season - 1;
      for (const k of ['w', 'u']) { if (run[id][k]) run[id][k].on = on; close(id, k); }
    }
    const byLen = (x, y) => y.len - x.len || (y.on ? 1 : 0) - (x.on ? 1 : 0) || order(y.to, x.to);
    streaks.w.sort(byLen); streaks.u.sort(byLen);
    /* season records (the league's finished seasons only) and goals per season (league + promotion league) */
    const seasonRec = (f, better) => {
      let best = null;
      for (const r of recs) for (const x of r.rows) { const v = f(x); if (best === null || better(v, best.v)) best = { id: x[0], season: r.season, v }; }
      return best;
    };
    const seasonRecs = recs.length ? [
      { label: 'En çok puan', r: seasonRec(x => x[2], (a, b) => a > b), unit: 'puan' },
      { label: 'En az puan', r: seasonRec(x => x[2], (a, b) => a < b), unit: 'puan' },
      { label: 'En çok galibiyet', r: seasonRec(x => x[3], (a, b) => a > b), unit: 'galibiyet' },
      { label: 'En çok gol atan', r: seasonRec(x => x[6], (a, b) => a > b), unit: 'gol' },
      { label: 'En az gol yiyen', r: seasonRec(x => x[7], (a, b) => a < b), unit: 'gol' },
    ] : [];
    const tot = (lg) => (lg ? { n: lg.n || 0, g: lg.rows.reduce((s, x) => s + x[6], 0), dr: lg.rows.reduce((s, x) => s + x[4], 0) / 2 } : { n: 0, g: 0, dr: 0 });
    const perSeason = recs.concat([cur]).map(r => {
      const a = tot(r.cur ? Object.assign({}, r, { n: d.history.length }) : r), b = tot(r.cur ? curPl : r.pl);
      const n = a.n + b.n, g = a.g + b.g, dr = a.dr + b.dr;
      return { season: r.season, cur: !!r.cur, n, pn: b.n, goals: g, avg: n ? g / n : 0, draws: n ? dr / n : 0 };
    }).filter(x => x.n > 0);
    return { recs, cur, since, first: recs.length ? recs[0].season : d.season, lost: blocks.some(b => b.lost), ms, allTime, titles: titleList, big, goals, streaks, seasonRecs, perSeason };
  },
  /* the matches between two clubs (oldest first; league and promotion league) */
  h2h(a, b) { return this.get().ms.filter(m => (m.h === a && m.a === b) || (m.h === b && m.a === a)); },
  /* a club's result in a match: 'W' / 'D' / 'L' (null if it did not play) */
  res(m, id) { const me = m.h === id ? m.hs : m.a === id ? m.as : -1, op = m.h === id ? m.as : m.hs; return me < 0 ? null : me > op ? 'W' : me < op ? 'L' : 'D'; },
  /* how far a pool club got in a playoff bracket ({ draw, res: { key: { winner, loser } } }) */
  cupFate(c, id) {
    if (!c || !c.draw.includes(id)) return '';
    const ms = League.cupMatchesOf(c).filter(m => m.res && (m.res.winner === id || m.res.loser === id));
    const last = ms[ms.length - 1];
    if (cupDirect(c).includes(id)) return 'Doğrudan yükseldi';
    if (!last) return c.draw.length > PO_SIZE && c.draw.slice(0, 4).includes(id) ? 'Elemede (1. turu bay geçti)' : 'Elemede';
    const won = last.res.winner === id;
    if (last.k === 'FIN') return won ? 'Eleme birincisi' : 'Eleme finalisti';
    if (last.k === '3RD') return won ? 'Eleme üçüncüsü' : 'Eleme dördüncüsü';
    if (!won) return ['1. turda elendi', 'Çeyrek finalde elendi', 'Yarı finalde elendi'][last.r] || 'Elendi';
    return 'Elemede';
  },
  /* every season of a club, oldest first: in the league (rank, table row) or in the pool (playoff), and what came of it */
  seasonsOf(id) {
    const d = League.data, S = this.get(), out = [], lg = Live.legacy();
    if (lg) for (const r of lg.seasons) {
      const i = r.rows.findIndex(x => x[0] === id);
      if (i >= 0) out.push({ old: true, season: r.season, rank: i + 1, size: r.rows.length, row: null, pts: r.rows[i][2], played: r.rows[i][1], champ: r.champ === id, down: (r.out || []).includes(id), up: false, pool: false, fate: '' });
    }
    for (const r of S.recs) {
      const i = r.rows.findIndex(x => x[0] === id), up = (r.up || []).includes(id);
      if (i >= 0) out.push({ season: r.season, rank: i + 1, size: r.rows.length, row: r.rows[i], pts: r.rows[i][2], played: r.rows[i][1], champ: r.champ === id, down: (r.out || []).includes(id), up: false, pool: false, fate: '' });
      else if (r.pl && r.pl.rows.some(x => x[0] === id)) {
        /* the promotion league: its place, and the playoff for its top 4 */
        const k = r.pl.rows.findIndex(x => x[0] === id), cf = r.cup ? this.cupFate(LivePages.cupOf(r), id) : '';
        out.push({ season: r.season, pool: true, pl: true, rank: k + 1, row: r.pl.rows[k], pts: r.pl.rows[k][2], played: r.pl.rows[k][1], cf, up, fate: `Yükselme ligi ${k + 1}.${cf ? ' · ' + cf : ''}`, champ: false, down: false });
      } else if (up || (r.cup && r.cup.draw.includes(id))) out.push({ season: r.season, pool: true, up, fate: r.cup ? this.cupFate(LivePages.cupOf(r), id) : '', champ: false, down: false });
    }
    const pos = S.cur.rows.findIndex(x => x[0] === id);
    if (pos >= 0) out.push({ season: d.season, cur: true, rank: pos + 1, size: S.cur.rows.length, row: S.cur.rows[pos], pts: S.cur.rows[pos][2], played: S.cur.rows[pos][1], champ: false, down: false, up: false, pool: false, fate: '' });
    else if (d.reserve.some(t => t.id === id)) {
      const c = League.cup(), cf = c ? this.cupFate(c, id) : '';
      if (League.promoOn()) {
        const k = League.promoRanking().findIndex(x => x.t.id === id), r = League.rowOf(d.promo.table, id);
        out.push({ season: d.season, cur: true, pool: true, pl: true, cf, rank: k + 1, row: [id, r.played, r.pts, r.w, r.d, r.l, r.gf, r.ga], pts: r.pts, played: r.played,
          up: false, champ: false, down: false, fate: `Yükselme ligi ${k + 1}. sırada (${r.played} maç, ${r.pts} puan)${cf ? ' · ' + cf : ''}` });
      } else out.push({ season: d.season, cur: true, pool: true, up: false, champ: false, down: false, fate: cf || 'Lig maçları bitince eleme oynar' });
    }
    return out;
  },
};

/* ---- HTML: the "İstatistik" tab and the club pages (Turkish, like the rest of the site's controls) ---- */
const StatsPages = {
  /* charts are drawn in the pane's own width (in px), so their text stays readable on a phone */
  chartW() { const w = typeof window !== 'undefined' && typeof window.innerWidth === 'number' ? window.innerWidth : 0; return w ? Math.round(Math.min(700, Math.max(280, w - 46))) : 640; },
  team(id) { return LivePages.anyTeam(id) || { id, name: id, code: '?', c1: '#888888', c2: '#ffffff' }; },
  name(id) { return LivePages.tlink(this.team(id)); },
  /* "Sezon 3 · 5. hafta" ("Yükselme ligi · Sezon 3 · 5. hafta") */
  when(m) { return `${m.dv === 'promo' ? 'Yükselme ligi · ' : ''}Sezon ${m.s} · ${m.w}. hafta`; },
  /* a match as "Real Madrid 5–1 Barcelona" (home first, the winner bold) */
  score(m) {
    const w = m.hs > m.as ? 'h' : m.hs < m.as ? 'a' : '';
    return `<span class="${w === 'h' ? 'win' : ''}">${this.name(m.h)}</span> <b class="sc">${m.hs}–${m.as}</b> <span class="${w === 'a' ? 'win' : ''}">${this.name(m.a)}</span>`;
  },
  list(items, empty) { return items.length ? `<ol class="st-list">${items.map(x => `<li>${x}</li>`).join('')}</ol>` : `<div class="st-empty">${empty}</div>`; },
  streakTxt(s) { return `${this.name(s.id)} <b class="sc">${s.len} maç</b> <span class="mut">${this.when(s.from)} – ${s.to.s === s.from.s ? `${s.to.w}. hafta` : this.when(s.to)}${s.on ? ' · <em class="on">sürüyor</em>' : ''}</span>`; },
  card(title, body) { return `<section class="st-card"><h4>${title}</h4>${body}</section>`; },
  /* the "İstatistik" tab */
  page() {
    const S = LiveStats.get(), d = League.data, head = '<h2>İstatistik</h2>';
    if (!S.allTime.length) return `${head}<div class="lp-sub">Henüz maç oynanmadı. İlk maçtan sonra tüm zamanlar tablosu ve rekorlar burada görünür.</div>`;
    const span = S.recs.length ? `Sezon ${S.first}–${d.season}` : `Sezon ${d.season}`;
    const sub = `<div class="lp-sub">${span} · biten ${S.recs.length} sezon ve sürmekte olan sezon · lig ve yükselme ligi maçları · kulüp adına dokunun: kulüp sayfası (ikili karşılaşmalar orada)</div>`;
    const note = S.lost && S.since > S.first ? `<div class="lp-legend">Maç rekorları (farklı galibiyet, seriler) yalnızca Sezon ${S.since} ve sonrasını kapsar; tablolar ve gol ortalamaları bütün sezonları kapsar.</div>` : '';
    /* all-time table */
    const rows = S.allTime.map((x, i) => {
      const av = x.gf - x.ga;
      return `<tr><td>${i + 1}</td><td class="tn">${LivePages.dot(this.team(x.id))}${this.name(x.id)}</td><td>${x.seasons}</td><td class="opt">${x.pl}</td><td>${x.played}</td><td class="opt">${x.w}</td><td class="opt">${x.d}</td><td class="opt">${x.l}</td>`
        + `<td class="opt">${x.gf}</td><td class="opt">${x.ga}</td><td>${av > 0 ? '+' : ''}${av}</td><td><b>${x.pts}</b></td><td>${x.titles ? `🏆 ${x.titles}` : ''}</td></tr>`;
    }).join('');
    const table = `<h3 class="lp-h3">Tüm zamanlar tablosu</h3><table class="lp-table"><caption class="sr-only">Tüm zamanlar tablosu</caption><thead><tr><th scope="col">#</th><th scope="col">Takım</th><th scope="col" title="Ligde oynadığı sezon">Sz</th><th scope="col" class="opt" title="Yükselme liginde oynadığı sezon">YL</th><th scope="col" title="Oynanan (lig + yükselme ligi)">O</th>`
      + `<th scope="col" class="opt" title="Galibiyet">G</th><th scope="col" class="opt" title="Beraberlik">B</th><th scope="col" class="opt" title="Mağlubiyet">M</th><th scope="col" class="opt" title="Atılan gol">AG</th><th scope="col" class="opt" title="Yenilen gol">YG</th>`
      + `<th scope="col" title="Averaj">AV</th><th scope="col" title="Puan">P</th><th scope="col" title="Şampiyonluk"><span aria-hidden="true">🏆</span><span class="sr-only">Şampiyonluk</span></th></tr></thead><tbody>${rows}</tbody></table>`
      + `<div class="lp-legend">Bütün sezonların toplamı (sürmekte olan sezon dahil): lig ve yükselme ligi maçları birlikte; puanlar her sezonun kendi puanlamasıyla. Sz: ligde, YL: yükselme liginde geçen sezon. Sıralama: puan → averaj → atılan gol.</div>`;
    /* titles */
    const titles = `<h3 class="lp-h3">Şampiyonluklar</h3>` + (S.titles.length
      ? `<ol class="lp-champs">${S.titles.map(t => `<li><b>${this.name(t.id)}</b><span>${t.n} şampiyonluk</span><span>Sezon ${t.seasons.join(', ')}</span></li>`).join('')}</ol>`
      : '<div class="st-empty">İlk sezon bitince şampiyonlar burada listelenir.</div>');
    /* records */
    const top = (a) => a.slice(0, 5);
    const recs = `<h3 class="lp-h3">Rekorlar</h3><div class="st-grid">`
      + this.card('En farklı galibiyetler', this.list(top(S.big).map(m => `${this.score(m)} <span class="mut">${this.when(m)}</span>`), 'Henüz galibiyet yok.'))
      + this.card('En gollü maçlar', this.list(top(S.goals).map(m => `${this.score(m)} <span class="mut">${m.hs + m.as} gol · ${this.when(m)}</span>`), 'Henüz maç yok.'))
      + this.card('En uzun galibiyet serileri', this.list(top(S.streaks.w).map(s => this.streakTxt(s)), 'Henüz art arda iki galibiyet yok.'))
      + this.card('En uzun yenilmezlik serileri', this.list(top(S.streaks.u).map(s => this.streakTxt(s)), 'Henüz seri yok.'))
      + (S.seasonRecs.length ? this.card('Sezon rekorları (lig)', `<ol class="st-list">${S.seasonRecs.filter(x => x.r).map(x => `<li><span class="mut">${x.label}:</span> ${this.name(x.r.id)} <b class="sc">${x.r.v} ${x.unit}</b> <span class="mut">Sezon ${x.r.season}</span></li>`).join('')}</ol>`) : '')
      + '</div>';
    return `${head}${sub}${note}${table}${titles}${recs}${this.goalsSection(S)}`;
  },
  /* goals per match, season by season: a bar chart (hover: the numbers) and the same numbers as a table */
  goalsSection(S) {
    const P = S.perSeason;
    if (!P.length) return '';
    const W = this.chartW(), H = 190, L = 34, R = 10, T = 16, B = 26, pw = W - L - R, ph = H - T - B;
    const max = Math.max(1, Math.ceil(Math.max(...P.map(x => x.avg)))), step = pw / P.length, bw = Math.max(3, Math.min(34, step * 0.62));
    const y = (v) => T + ph - (v / max) * ph, fmt = (v) => v.toFixed(2).replace('.', ',');
    const ticks = [0, max / 2, max].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="gr"/><text x="${L - 6}" y="${y(v) + 4}" class="ax" text-anchor="end">${Number.isInteger(v) ? v : fmt(v)}</text>`).join('');
    const hi = P.reduce((a, x) => (x.avg > a.avg ? x : a), P[0]), lab = new Set([hi, P[P.length - 1]]);
    const every = Math.ceil(P.length / 12);
    const bars = P.map((x, i) => {
      const cx = L + step * (i + 0.5), top = y(x.avg), h = Math.max(0, T + ph - top), r = Math.min(4, bw / 2, h);
      const path = `M${cx - bw / 2},${T + ph}V${top + r}Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top}H${cx + bw / 2 - r}Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r}V${T + ph}Z`;
      const tip = `Sezon ${x.season}${x.cur ? ' (sürüyor)' : ''}: maç başına ${fmt(x.avg)} gol, ${x.n} maç${x.pn ? ` (${x.pn} yükselme ligi)` : ''}, ${x.goals} gol, beraberlik %${Math.round(x.draws * 100)}`;
      return `<g class="hit"><title>${tip}</title><rect x="${cx - step / 2}" y="${T}" width="${step}" height="${ph}" fill="transparent"/><path d="${path}" class="bar${x.cur ? ' cur' : ''}"/>`
        + (lab.has(x) ? `<text x="${cx}" y="${top - 5}" class="vl" text-anchor="middle">${fmt(x.avg)}</text>` : '')
        + (i % every === 0 || i === P.length - 1 ? `<text x="${cx}" y="${H - 8}" class="ax" text-anchor="middle">${x.season}</text>` : '') + '</g>';
    }).join('');
    const svg = `<svg class="st-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sezon başına maç başı gol ortalaması: en yüksek Sezon ${hi.season}, ${fmt(hi.avg)} gol">${ticks}${bars}</svg>`;
    const rows = P.slice().reverse().map(x => `<tr><td>Sezon ${x.season}${x.cur ? ' <em class="on">sürüyor</em>' : ''}</td><td>${x.n}</td><td>${x.goals}</td><td><b>${fmt(x.avg)}</b></td><td>%${Math.round(x.draws * 100)}</td></tr>`).join('');
    return `<h3 class="lp-h3">Sezon başına gol ortalaması</h3><div class="st-box">${svg}<div class="lp-legend" style="margin:4px 0 0">Maç başına gol, lig ve yükselme ligi maçları (çubuğun üstüne gelince ayrıntı) · soluk çubuk: sürmekte olan sezon</div></div>`
      + `<details class="st-det"><summary>Tablo olarak göster</summary><table class="lp-table"><thead><tr><th scope="col">Sezon</th><th scope="col">Maç</th><th scope="col">Gol</th><th scope="col">Maç başı</th><th scope="col">Beraberlik</th></tr></thead><tbody>${rows}</tbody></table></details>`;
  },
  /* the opponent a club's head-to-head opens with: its next match's (league or promotion league), else its last match's,
     else the first club in the list */
  defaultOpp(id, clubs) {
    const d = League.data, other = (ids) => (ids.includes(id) ? ids.find(x => x !== id) : '');
    const plan = App.seasonPlan(), per = App.perWeek();
    const fx = (plan ? plan.weeks.slice(0, d.seasonLength).flatMap(w => w.slice(0, per)).slice(d.history.length) : [])
      .concat(League.promoOn() ? d.promo.plan.flat().slice(d.promo.history.length) : []);
    const ok = (o) => !!o && clubs.some(t => t.id === o);
    for (const ids of fx) { const o = other(ids); if (ok(o)) return o; }
    const ms = LiveStats.get().ms;
    for (let k = ms.length - 1; k >= 0; k--) { const o = other([ms[k].h, ms[k].a]); if (ok(o)) return o; }
    return clubs.length ? clubs[0].id : '';
  },
  /* a club's head-to-head with an opponent picked from every club the league knows (opp: the picked one, '' = defaultOpp) */
  clubH2h(id, opp) {
    const d = League.data, clubs = d.teams.concat(d.reserve).filter(t => t.id !== id).sort((x, y) => x.name.localeCompare(y.name, 'tr'));
    if (!clubs.length) return '';
    const b = opp && clubs.some(t => t.id === opp) ? opp : this.defaultOpp(id, clubs), me = this.team(id), op = this.team(b);
    const sel = `<select class="h2h-sel" aria-label="Rakip kulüp">${clubs.map(t => `<option value="${esc(t.id)}"${t.id === b ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>`;
    const pick = `<div class="h2h-bar"><b class="h2h-me">${LivePages.dot(me)}${esc(me.name)}</b><span aria-hidden="true">vs</span>${sel}</div>`;
    const ms = LiveStats.h2h(id, b), cnt = { W: 0, D: 0, L: 0 };
    let ga = 0, gb = 0;
    for (const m of ms) { cnt[LiveStats.res(m, id)]++; ga += m.h === id ? m.hs : m.as; gb += m.h === b ? m.hs : m.as; }
    const tile = (v, l) => `<div class="st-tile"><b>${v}</b><span>${l}</span></div>`;
    const sum = ms.length ? `<div class="st-tiles">${tile(cnt.W, `${esc(me.code)} galibiyeti`)}${tile(cnt.D, 'beraberlik')}${tile(cnt.L, `${esc(op.code)} galibiyeti`)}${tile(`${ga}–${gb}`, 'goller')}</div>` : '';
    const list = this.list(ms.slice().reverse().slice(0, 20).map(m => `${this.score(m)} <span class="mut">${this.when(m)}</span>`), 'Bu iki kulüp henüz karşılaşmadı.');
    return `<h3 class="lp-h3">İkili karşılaşma</h3>${pick}<div aria-live="polite">${sum}${list}</div><div class="lp-legend" style="margin:4px 0 0">Lig ve yükselme ligi maçları · rakibi listeden seçin</div>`;
  },
  /* ---- a club's page ---- */
  club(id, opp = '') {
    const t = LivePages.anyTeam(id), back = '<button type="button" class="tm-back" data-back="1">‹ Geri</button>';
    if (!t) return `${back}<h2>Kulüp bulunamadı</h2>`;
    const S = LiveStats.get(), d = League.data, list = LiveStats.seasonsOf(id), cur = list.find(x => x.cur);
    const A = S.allTime.find(x => x.id === id), atRank = S.allTime.indexOf(A) + 1, T = S.titles.find(x => x.id === id);
    const status = !cur ? 'Bu sezon ligde değil' : cur.pool ? `Sezon ${d.season} · havuzda: ${cur.fate}` : `Sezon ${d.season} · ${cur.rank}. sırada · ${cur.played} maç, ${cur.pts} puan`;
    const tile = (v, l) => `<div class="st-tile"><b>${v}</b><span>${l}</span></div>`;
    const tiles = `<div class="st-tiles">${tile(T ? T.n : 0, 'şampiyonluk')}${tile(list.filter(x => !x.pool && !x.old).length, 'ligde sezon')}${tile(A ? `${atRank}.` : '—', 'tüm zamanlar')}${tile(A ? A.pts : 0, 'toplam puan')}</div>`;
    const head = `${back}<div class="tm-head"><span class="tm-badge" style="background:${esc(t.c1)};border-color:${esc(t.c2)}" aria-hidden="true">${esc(t.code)}</span><div><h2 tabindex="-1" id="tmTitle">${esc(t.name)}</h2><div class="lp-sub" style="margin:0">${status}</div></div></div>`;
    return head + tiles + this.clubForm(id) + this.clubH2h(id, opp) + this.clubChart(list) + this.clubSeasons(list) + this.clubEvents(list) + this.clubRecords(id);
  },
  /* the running season (the league's, or the promotion league's for a pool club): points after every match (the leader's for
     comparison) and the last results */
  clubForm(id) {
    const d = League.data, promo = !d.teams.some(t => t.id === id);
    if (promo && !(League.promoOn() && d.reserve.some(t => t.id === id))) return '';
    const dv = promo ? 'promo' : 'main', all = LiveStats.current(dv), ms = all.filter(m => m.h === id || m.a === id);
    const title = `Sezon ${d.season} formu${promo ? ' · yükselme ligi' : ''}`;
    if (!ms.length) return `<h3 class="lp-h3">${title}</h3><div class="st-empty">Bu sezon henüz maçı yok.</div>`;
    const lastList = () => `<h3 class="lp-h3">Son maçlar</h3><ol class="st-list">${ms.slice(-10).reverse().map(m => { const r = LiveStats.res(m, id); return `<li><i class="fp f${r}">${FORM_TR[r]}</i>${this.score(m)} <span class="mut">${promo ? 'Yükselme ligi · ' : ''}${m.w}. hafta</span></li>`; }).join('')}</ol>`;
    if (ms.length < 2) return lastList();                       // a line needs two matches
    const pts = (r) => (r === 'W' ? d.points[0] : r === 'D' ? d.points[1] : d.points[2]);
    const cum = (tid) => { let s = 0; return all.filter(m => m.h === tid || m.a === tid).map(m => (s += pts(LiveStats.res(m, tid)))); };
    const leadId = (promo ? League.promoRanking() : League.ranking())[0].t.id;
    const me = cum(id), leadPts = leadId === id ? [] : cum(leadId), lead = leadPts.length >= 2 ? leadPts : null;
    const W = this.chartW(), H = 200, L = 34, R = 70, T = 14, B = 26, pw = W - L - R, ph = H - T - B, n = Math.max(promo ? d.promo.plan.length : d.seasonLength, me.length, lead ? lead.length : 0);
    const max = Math.max(3, ...me, ...(lead || [0])), x = (k) => L + (n > 1 ? (k / (n - 1)) * pw : pw / 2), y = (v) => T + ph - (v / max) * ph;
    const line = (a) => a.map((v, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join('');
    const yt = [0, Math.round(max / 2), max].map(v => `<line x1="${L}" x2="${L + pw}" y1="${y(v)}" y2="${y(v)}" class="gr"/><text x="${L - 6}" y="${y(v) + 4}" class="ax" text-anchor="end">${v}</text>`).join('');
    const xt = [0, Math.floor((n - 1) / 2), n - 1].map(k => `<text x="${x(k)}" y="${H - 8}" class="ax" text-anchor="middle">${k + 1}. maç</text>`).join('');
    const dots = ms.map((m, k) => {
      const r = LiveStats.res(m, id);
      return `<g class="hit"><title>${m.w}. hafta: ${esc(this.team(m.h).code)} ${m.hs}–${m.as} ${esc(this.team(m.a).code)} (${FORM_TR[r]}) · ${me[k]} puan</title><circle cx="${x(k)}" cy="${y(me[k])}" r="12" fill="transparent"/><circle cx="${x(k)}" cy="${y(me[k])}" r="4.5" class="pt-${r}"/></g>`
    }).join('');
    const tag = (a, cls, label) => `<text x="${x(a.length - 1) + 8}" y="${y(a[a.length - 1]) + 4}" class="${cls}">${label}</text>`;
    const svg = `<svg class="st-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sezon ${d.season}: ${me.length} maçta ${me[me.length - 1]} puan${lead ? `, lider ${esc(this.team(leadId).name)} ${lead[lead.length - 1]} puan` : ''}">${yt}${xt}`
      + (lead ? `<path d="${line(lead)}" class="ln lead"/>${tag(lead, 'dl mut', `Lider ${esc(this.team(leadId).code)}`)}` : '')
      + `<path d="${line(me)}" class="ln"/>${dots}${tag(me, 'dl', esc(this.team(id).code))}</svg>`;
    return `<h3 class="lp-h3">${title}</h3><div class="st-box">${svg}<div class="lp-legend" style="margin:4px 0 0">Her maçtan sonraki toplam puan · noktalar: <b class="k-W">G</b> galibiyet, <b class="k-D">B</b> beraberlik, <b class="k-L">M</b> mağlubiyet</div></div>`
      + lastList();
  },
  /* the finishing position season by season (this league; the pool below the table) */
  clubChart(list) {
    const L0 = list.filter(x => !x.old);
    if (L0.length < 2) return '';
    const size = Math.max(...L0.filter(x => !x.pool).map(x => x.size), 18);
    const W = this.chartW(), H = 210, L = 46, R = 12, T = 12, B = 26, pw = W - L - R, ph = H - T - B, rows = size + 2;
    const x = (k) => L + (L0.length > 1 ? (k / (L0.length - 1)) * pw : pw / 2), y = (rank) => T + ((rank - 1) / (rows - 1)) * ph;
    const yPool = y(rows), rel = CONFIG.RELEGATE_COUNT;
    const band = `<rect x="${L}" y="${y(size - rel + 0.5)}" width="${pw}" height="${y(size + 0.5) - y(size - rel + 0.5)}" class="relband"/>`;
    const yt = [1, Math.round(size / 2), size].map(r => `<line x1="${L}" x2="${L + pw}" y1="${y(r)}" y2="${y(r)}" class="gr"/><text x="${L - 6}" y="${y(r) + 4}" class="ax" text-anchor="end">${r}.</text>`).join('')
      + `<text x="${L - 6}" y="${yPool + 4}" class="ax" text-anchor="end">Havuz</text>`;
    const every = Math.ceil(L0.length / 10);
    const xt = L0.map((s, k) => (k % every === 0 || k === L0.length - 1 ? `<text x="${x(k)}" y="${H - 6}" class="ax" text-anchor="middle">S${s.season}</text>` : '')).join('');
    let path = '';
    L0.forEach((s, k) => { if (!s.pool) path += `${k && !L0[k - 1].pool ? 'L' : 'M'}${x(k).toFixed(1)},${y(s.rank).toFixed(1)}`; });
    const dots = L0.map((s, k) => {
      const cy = s.pool ? yPool : y(s.rank), cls = s.pool ? (s.up ? 'pt-up' : 'pt-pool') : s.champ ? 'pt-champ' : s.down ? 'pt-L' : 'pt-pos';
      const tip = `Sezon ${s.season}${s.cur ? ' (sürüyor)' : ''}: ${s.pool ? `havuzda${s.fate ? ' · ' + s.fate : ''}${s.up ? ' · yükseldi' : ''}` : `${s.rank}. sıra, ${s.pts} puan${s.champ ? ' · şampiyon' : ''}${s.down ? ' · düştü' : ''}`}`;
      return `<g class="hit"><title>${tip}</title><circle cx="${x(k)}" cy="${cy}" r="12" fill="transparent"/><circle cx="${x(k)}" cy="${cy}" r="${s.champ ? 6 : 4.5}" class="${cls}${s.cur ? ' cur' : ''}"/></g>`;
    }).join('');
    const best = L0.filter(s => !s.pool && !s.cur).reduce((a, s) => (!a || s.rank < a.rank ? s : a), null);
    return `<h3 class="lp-h3">Sezon sezon sırası</h3><div class="st-box"><svg class="st-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sezon sonu sıraları${best ? `: en iyi ${best.rank}. sıra (Sezon ${best.season})` : ''}">${band}${yt}${xt}<path d="${path}" class="ln"/>${dots}</svg>`
      + `<div class="lp-legend" style="margin:4px 0 0">Sezon sonundaki sıra (1 en üstte) · kırmızı bant: düşme hattı · altın: şampiyon · alttaki sıra: havuzda geçen sezonlar (yeşil: yükseldi) · halka: sürmekte olan sezon</div></div>`;
  },
  outcome(s) {
    return [s.champ ? '<span class="tg champ">🏆 Şampiyon</span>' : '', s.down ? '<span class="tg down">🔻 Düştü</span>' : '', s.up ? '<span class="tg up">🔺 Yükseldi</span>' : '',
      s.pool && (s.pl ? s.cf : s.fate) ? `<span class="mut">${esc(s.pl ? s.cf : s.fate)}</span>` : '', s.cur ? '<span class="tg cur">Sürüyor</span>' : ''].filter(Boolean).join(' ');
  },
  clubSeasons(list) {
    if (!list.length) return '';
    const rows = list.slice().reverse().map(s => {
      const nm = `${s.old ? 'Eski lig · ' : ''}Sezon ${s.season}`;
      if (s.pool && !s.pl) return `<tr><td>${nm}</td><td class="tn mut">Havuz</td><td>—</td><td>—</td><td class="opt">—</td><td>—</td><td class="tn">${this.outcome(s)}</td></tr>`;
      const r = s.row, gd = r ? r[6] - r[7] : 0;
      return `<tr><td>${nm}</td><td class="tn${s.pl ? ' mut' : ''}">${s.pl ? 'Yükselme ligi' : 'Lig'}</td><td><b>${s.rank}.</b></td><td>${s.played}</td><td class="opt">${r ? `${r[3]}-${r[4]}-${r[5]}` : '—'}</td><td>${r ? `${gd > 0 ? '+' : ''}${gd}` : '—'}</td><td class="tn"><b>${s.pts}</b> <span class="mut">puan</span> ${this.outcome(s)}</td></tr>`;
    }).join('');
    return `<h3 class="lp-h3">Sezon geçmişi</h3><table class="lp-table st-seasons"><caption class="sr-only">Sezon geçmişi</caption><thead><tr><th scope="col">Sezon</th><th scope="col">Nerede</th><th scope="col">Sıra</th><th scope="col" title="Oynanan">O</th><th scope="col" class="opt" title="Galibiyet-beraberlik-mağlubiyet">G-B-M</th><th scope="col" title="Averaj">AV</th><th scope="col">Puan · sonuç</th></tr></thead><tbody>${rows}</tbody></table>`;
  },
  /* titles, relegations and promotions in order */
  clubEvents(list) {
    const ev = [];
    for (const s of list) {
      const nm = `${s.old ? 'Eski lig · ' : ''}Sezon ${s.season}`;
      if (s.champ) ev.push(`<span class="tg champ">🏆</span> ${nm} şampiyonu (${s.pts} puan)`);
      if (s.down) ev.push(`<span class="tg down">🔻</span> ${nm} sonunda ${s.rank}. sırayla ligden düştü`);
      if (s.up) ev.push(`<span class="tg up">🔺</span> ${nm} sonunda lige yükseldi${s.fate ? ` (${esc(s.fate)})` : ''}`);
    }
    return `<h3 class="lp-h3">Şampiyonluk, düşme ve yükselme</h3>` + (ev.length ? `<ol class="st-list">${ev.reverse().map(x => `<li>${x}</li>`).join('')}</ol>` : '<div class="st-empty">Henüz şampiyonluk, düşme ya da yükselme yok.</div>');
  },
  clubRecords(id) {
    const S = LiveStats.get(), mine = S.ms.filter(m => m.h === id || m.a === id);
    if (!mine.length) return '';
    const margin = (m) => (m.h === id ? m.hs - m.as : m.as - m.hs);
    const pick = (f) => mine.reduce((a, m) => (f(m) > f(a) ? m : a), mine[0]);
    const win = pick(margin), loss = pick(m => -margin(m));
    const ws = S.streaks.w.find(s => s.id === id), us = S.streaks.u.find(s => s.id === id);
    const items = [margin(win) > 0 ? `<span class="mut">En farklı galibiyet:</span> ${this.score(win)} <span class="mut">${this.when(win)}</span>` : '',
      margin(loss) < 0 ? `<span class="mut">En ağır yenilgi:</span> ${this.score(loss)} <span class="mut">${this.when(loss)}</span>` : '',
      ws ? `<span class="mut">En uzun galibiyet serisi:</span> ${this.streakTxt(ws)}` : '', us ? `<span class="mut">En uzun yenilmezlik serisi:</span> ${this.streakTxt(us)}` : ''].filter(Boolean);
    return items.length ? `<h3 class="lp-h3">Kulüp rekorları</h3><ol class="st-list">${items.map(x => `<li>${x}</li>`).join('')}</ol>` : '';
  },
};
