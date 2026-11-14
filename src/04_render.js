/* =====================================================================
   RENDER — pitch / entities (camera + shake apply here)
   ===================================================================== */
const Renderer = {
  canvas: null, ctx: null, trails: new Map(), spins: new Map(),
  init(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); },
  resetTrails() { this.trails.clear(); this.spins.clear(); },

  draw(g, app) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const vis = THEMES[g ? g.themeId : 'classic'];
    this.background(vis);
    if (!g) return;
    this.updateTrails(g, app);
    this.pitch(g, vis);
    HUD.draw(ctx, g, app);
    if (app.introOn()) IntroScreen.draw(ctx, app.intro, app.introT);
    if (app.end) EndScreen.draw(ctx, app.end, app.endT);
  },

  background(vis) {
    /* smooth gradients are drawn on a 1/8-size offscreen canvas and scaled up (much cheaper) */
    if (!this.bgC) { this.bgC = document.createElement('canvas'); this.bgC.width = 135; this.bgC.height = 240; this.bgX = this.bgC.getContext('2d'); }
    const ctx = this.bgX, t = FX.ut * 0.06;
    ctx.setTransform(1 / 8, 0, 0, 1 / 8, 0, 0);
    const x0 = 540 + Math.cos(t) * 700, y0 = 960 + Math.sin(t * 0.8) * 1100;
    const gr = ctx.createLinearGradient(x0, y0, 1080 - x0, 1920 - y0);
    gr.addColorStop(0, vis.bg1); gr.addColorStop(0.5, vis.bg2); gr.addColorStop(1, vis.bg1);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 1080, 1920);
    const bx = 540 + Math.sin(t * 0.7) * 300, by = 960 + Math.cos(t * 0.5) * 500;
    const rg = ctx.createRadialGradient(bx, by, 0, bx, by, 900);
    rg.addColorStop(0, rgbaFromAny(vis.bg3, 0.22)); rg.addColorStop(1, rgbaFromAny(vis.bg3, 0));
    ctx.fillStyle = rg; ctx.fillRect(0, 0, 1080, 1920);
    this.ctx.imageSmoothingEnabled = true; this.ctx.imageSmoothingQuality = 'low';
    this.ctx.drawImage(this.bgC, 0, 0, 1080, 1920);
  },

  updateTrails(g, app) {
    if (!app.running || app.paused || g.morph || g.over) return;
    const alive = new Set();
    for (const b of g.balls) {
      if (b.state !== 'live') continue;
      alive.add(b.id);
      let tr = this.trails.get(b.id);
      if (!tr) { tr = []; this.trails.set(b.id, tr); }
      const last = tr[tr.length - 1];
      if (last) this.spins.set(b.id, (this.spins.get(b.id) || 0) + Math.hypot(b.x - last.x, b.y - last.y) / 16 * (b.vx >= 0 ? 1 : -1));
      tr.push({ x: b.x, y: b.y });
      const maxLen = Math.round(12 + 10 * clamp01(((b.boost || 1) - 1) / (CONFIG.BALL_MAX_MULT - 1))) + (b.shot ? 10 : 0);   // trail grows with speed
      while (tr.length > maxLen) tr.shift();
    }
    for (const id of [...this.trails.keys()]) if (!alive.has(id)) this.trails.delete(id);
  },

  pitch(g, vis) {
    const ctx = this.ctx;
    ctx.save();
    if (FX.shakeT > 0) {
      const m = FX.shakeMag * (FX.shakeT / FX.shakeDur);
      ctx.translate(vrng.range(-m, m), vrng.range(-m, m));
    }
    const k = FX.cam.k;
    if (k > 0.002) {
      ctx.beginPath(); ctx.rect(0, 108, 1080, 1812); ctx.clip();   // below the top bar
      const z = 1 + 0.3 * k, C = { x: g.cx, y: CONFIG.CY };
      const Fx = C.x + (FX.cam.x - C.x) * 0.55 * k, Fy = C.y + (FX.cam.y - C.y) * 0.55 * k;
      ctx.translate(C.x, C.y); ctx.scale(z, z); ctx.translate(-Fx, -Fy);
    }
    this.shape(g, vis, g.geo);
    this.keepers(g, g.geo);
    this.players(g);
    this.balls(g, vis);
    this.particles();
    this.floats();
    if (g.themeId === 'night') this.nightGlow(g);
    ctx.restore();
    this.weather(g);
    if (g.themeId === 'night') {
      const vg = ctx.createRadialGradient(CONFIG.CX, CONFIG.CY, 300, CONFIG.CX, CONFIG.CY, 1150);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, 1080, 1920);
    }
  },

  shape(g, vis, geo) {
    const ctx = this.ctx, cx = g.cx, cy = CONFIG.CY;
    ctx.save();
    const V = geo.verts;
    /* nets (behind floor edge) */
    for (const gl of geo.goals) this.net(g, vis, gl, geo.netDepth);
    /* floor */
    ctx.save();
    ctx.beginPath(); V.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y))); ctx.closePath();
    ctx.fillStyle = vis.f1; ctx.fill();
    ctx.clip();
    ctx.save(); ctx.translate(cx, cy);
    /* mowing stripes: long enough to cover the whole pitch (it is taller than the screen's middle 1400 px) */
    ctx.fillStyle = vis.f2;
    for (let s = -24; s <= 24; s += 2) ctx.fillRect(s * 45, -1200, 45, 2400);
    ctx.restore();
    /* grass grain, floodlight (lighter centre, darker edges) and a soft shadow along the walls — much lighter on a light (snow) floor */
    const sh = lumHex(vis.f1) > 0.6 ? 0.3 : 1;
    ctx.save(); ctx.globalAlpha *= sh; ctx.fillStyle = grassGrain(ctx); ctx.fillRect(0, 0, 1080, 1920); ctx.restore();
    const lg = ctx.createRadialGradient(cx, cy, 120, cx, cy, 1050);
    lg.addColorStop(0, 'rgba(255,255,255,0.08)'); lg.addColorStop(0.55, 'rgba(0,0,0,0)'); lg.addColorStop(1, `rgba(0,0,0,${0.30 * sh})`);
    ctx.fillStyle = lg; ctx.fillRect(0, 0, 1080, 1920);
    ctx.beginPath(); V.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y))); ctx.closePath();
    ctx.strokeStyle = `rgba(0,0,0,${0.22 * sh})`; ctx.lineWidth = 44; ctx.stroke();
    this.fieldLines(g, vis, geo);
    if (g.themeId === 'rain') {
      for (const s of FX.splashes) {
        const a = (FX.ut - s.t) / 0.7;
        ctx.strokeStyle = `rgba(200,225,255,${0.45 * (1 - a)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(s.x, s.y, 4 + a * 26, (4 + a * 26) * 0.4, 0, 0, TAU); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(160,200,255,0.05)';
      for (let i = 0; i < 6; i++) { const t = FX.ut * 0.3 + i; ctx.beginPath(); ctx.ellipse(cx + Math.sin(t * 1.3 + i) * 220, cy + Math.cos(t + i * 2) * 260, 120, 40, i, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
    /* walls */
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const w of geo.walls) { ctx.moveTo(w.ax, w.ay); ctx.lineTo(w.bx, w.by); }
    ctx.strokeStyle = vis.wallGlow; ctx.lineWidth = 30; ctx.stroke();
    ctx.strokeStyle = vis.wall; ctx.lineWidth = 12; ctx.stroke();
    /* posts, the club's name behind its net and its goal tally */
    for (const gl of geo.goals) {
      const T = g.teams[gl.team];
      for (const [px, py] of [[gl.p1x, gl.p1y], [gl.p2x, gl.p2y]]) {
        ctx.beginPath(); ctx.arc(px, py, CONFIG.POST_R, 0, TAU);
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = T.c1; ctx.stroke();
      }
      this.nameTag(gl, T, geo.netDepth); this.goalTally(g, gl, T, geo.netDepth);
    }
    ctx.restore();
  },

  fieldLines(g, vis, geo) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = vis.line; ctx.lineWidth = 4; ctx.fillStyle = vis.line;   // always white
    if (vis.lineShadow) { ctx.shadowColor = vis.lineShadow; ctx.shadowBlur = 4; }
    this.fieldLinesPath(geo);
    ctx.restore();
  },
  fieldLinesPath(geo) {
    const ctx = this.ctx, cx = geo.cx, cy = geo.cy;
    const W = geo.W, H = geo.H, x0 = cx - W / 2, y0 = cy - H / 2;
    ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x0 + W, cy); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 86, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, TAU); ctx.fill();
    const bw = W * 0.62, bh = H * 0.15, sw = W * 0.34, sh = H * 0.06;
    for (const s of [1, -1]) {
      const ey = s > 0 ? y0 : y0 + H;
      ctx.strokeRect(cx - bw / 2, s > 0 ? ey : ey - bh, bw, bh);
      ctx.strokeRect(cx - sw / 2, s > 0 ? ey : ey - sh, sw, sh);
      const py = ey + s * bh * 0.72;
      ctx.beginPath(); ctx.arc(cx, py, 6, 0, TAU); ctx.fill();
      /* penalty arc ("D"): centred on the penalty spot, only the part outside the box, meeting the box line */
      const dR = bh * 0.28 + 44, dA = Math.acos(clamp01(bh * 0.28 / dR)), dm = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      ctx.beginPath(); ctx.arc(cx, py, dR, dm - dA, dm + dA); ctx.stroke();
      for (const sx of [x0, x0 + W]) { ctx.beginPath(); ctx.arc(sx, ey, 22, 0, TAU); ctx.stroke(); }
    }
  },

  net(g, vis, gl, D) {
    const ctx = this.ctx, T = g.teams[gl.team];
    const { mx, my, tx, ty, nx, ny, hw } = gl;
    const P = (a, o) => [mx + tx * a + nx * o, my + ty * a + ny * o];
    const rp = FX.ripples[gl.team];
    let amp = 0, age = 0;
    if (rp) { age = FX.wt - rp.t; amp = age < 1.4 ? 12 * Math.exp(-age * 3.2) : 0; }
    const disp = (a, o) => {
      if (!amp) return 0;
      const d = Math.hypot(a - rp.a, o - D * 0.5);
      return amp * Math.sin(d * 0.09 - age * 22) * Math.exp(-d / 110) * (o / D);
    };
    ctx.save();
    const c = [P(-hw, 0), P(hw, 0), P(hw, D), P(-hw, D)];
    ctx.beginPath(); c.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fill();
    const f = FX.flashes[gl.team];
    if (f !== undefined && FX.wt - f < 0.3) { ctx.fillStyle = rgba(T.c1, 0.75 * (1 - (FX.wt - f) / 0.3)); ctx.fill(); }
    ctx.save(); ctx.clip();
    ctx.strokeStyle = vis.net; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let a = -hw; a <= hw + 0.1; a += 14) {
      for (let s = 0; s <= 6; s++) { const o = D * s / 6, p = P(a, o + disp(a, o)); s ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    }
    for (let o = 10; o <= D; o += 10) {
      const steps = 14;
      for (let s = 0; s <= steps; s++) { const a = -hw + 2 * hw * s / steps, p = P(a, o + disp(a, o)); s ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    }
    ctx.stroke();
    ctx.restore();
    ctx.beginPath(); const a1 = P(-hw, 0), a2 = P(-hw, D + disp(-hw, D)), a3 = P(hw, D + disp(hw, D)), a4 = P(hw, 0);
    ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.lineTo(a3[0], a3[1]); ctx.lineTo(a4[0], a4[1]);
    ctx.lineWidth = 9; ctx.strokeStyle = rgba(T.c1, 0.25); ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = rgba(T.c1, 0.95); ctx.stroke();
    ctx.restore();
  },

  /* team name written across the net behind each goal, parallel to the goal line.
     Plain white letters with a dark outline, so the name reads on any pitch/theme. */
  nameTag(gl, T, D) {
    const ctx = this.ctx;
    const ang = Math.atan2(gl.ty, gl.tx);
    const chars = [...upTR(T.name)];
    let fs = Math.min(44, D - 4);
    const maxW = Math.min(gl.L * 0.92, 470);
    const widthAt = (f) => { ctx.font = `${f}px ${FONT_BIG}`; return chars.reduce((w, ch) => w + ctx.measureText(ch).width, 0) + (chars.length - 1) * f * 0.06; };
    while (widthAt(fs) > maxW && fs > 16) fs -= 2;
    const total = widthAt(fs), gap = fs * 0.06;
    ctx.save();
    ctx.translate(gl.mx + gl.nx * (D / 2 + 2), gl.my + gl.ny * (D / 2 + 2));
    ctx.rotate(ang);
    if (Math.cos(ang) < 0) ctx.rotate(Math.PI);                // keep text upright
    ctx.font = `${fs}px ${FONT_BIG}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    let x = -total / 2;
    for (const ch of chars) {
      const w = ctx.measureText(ch).width;
      if (ch.trim()) {
        ctx.lineWidth = Math.max(5, fs * 0.2); ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.strokeText(ch, x, 2);
        ctx.fillStyle = '#ffffff'; ctx.fillText(ch, x, 2);
      }
      x += w + gap;
    }
    ctx.restore();
  },
  /* one mini football per goal this team has scored in the match, lined up behind its name; each pops in when the goal is scored */
  goalTally(g, gl, T, D) {
    const n = T.gfT.length;
    if (!n) return;
    const ctx = this.ctx, maxW = Math.min(gl.L * 0.92, 470);
    let r = 14;
    while (r > 7 && Math.floor(maxW / (2 * r + 4)) * 2 < n) r--;
    const step = 2 * r + 4, perRow = Math.max(1, Math.floor(maxW / step));
    ctx.save();
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / perRow), inRow = Math.min(perRow, n - row * perRow), col = i - row * perRow;
      const off = (col - (inRow - 1) / 2) * step;
      const x = gl.mx + gl.nx * (D + 6 + r + row * step) + gl.tx * off, y = gl.my + gl.ny * (D + 6 + r + row * step) + gl.ty * off;
      const age = g.t - T.gfT[i], sc = easeOutBack(age / 0.45, 2.6);
      if (sc <= 0.01) continue;
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      if (age < 0.6) {                                  // pop ring in the team colour
        const q = age / 0.6;
        ctx.strokeStyle = rgbaFromAny(T.c1, 0.8 * (1 - q)); ctx.lineWidth = 3 * (1 - q) + 1;
        ctx.beginPath(); ctx.arc(0, 0, r + 3 + q * r * 1.6, 0, TAU); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(1.5, 2.5, r, r * 0.85, 0, 0, TAU); ctx.fill();
      const gr = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#cfd3d8');
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fillStyle = gr; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = '#23262b';
      pentagon(ctx, 0, 0, r * 0.4);
      for (let k = 0; k < 5; k++) { const an = k * TAU / 5 - Math.PI / 2; pentagon(ctx, Math.cos(an) * r * 0.95, Math.sin(an) * r * 0.95, r * 0.31); }
      ctx.restore();
      ctx.lineWidth = 2; ctx.strokeStyle = T.c1; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  },
  keepers(g, geo) {
    const ctx = this.ctx;
    for (const gl of geo.goals) {
      const T = g.teams[gl.team], k = T.k;
      const half = Math.min(k.halfLen, gl.hw * 0.92), maxS = Math.max(0, gl.hw - half - 4);
      const s = clamp(k.s, -maxS, maxS);
      const x = gl.mx - gl.nx * CONFIG.KEEPER_INSET + gl.tx * s, y = gl.my - gl.ny * CONFIG.KEEPER_INSET + gl.ty * s;
      const ax = x - gl.tx * half, ay = y - gl.ty * half, bx = x + gl.tx * half, by = y + gl.ty * half;
      ctx.save(); ctx.lineCap = 'round';
      const fl = g.t - k.flashT < 0.35 ? 1 - (g.t - k.flashT) / 0.35 : 0;
      if (fl > 0) { ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 30 * fl; }
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 22; ctx.stroke();
      ctx.strokeStyle = fl > 0 ? '#ffffff' : T.c2; ctx.lineWidth = CONFIG.KEEPER_THICK + 4; ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = T.c1; ctx.lineWidth = CONFIG.KEEPER_THICK - 4; ctx.stroke();
      ctx.restore();
    }
  },
  players(g) {
    const ctx = this.ctx, R = CONFIG.PLAYER_R;
    for (const p of g.players) {
      const T = g.teams[p.team];
      ctx.save();
      /* token: soft shadow, dark rim, shaded club colour, ring in the second colour, the code in a colour that reads on it */
      const sg = ctx.createRadialGradient(p.x + 3, p.y + 8, R * 0.3, p.x + 3, p.y + 8, R * 1.35);
      sg.addColorStop(0, 'rgba(0,0,0,0.45)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(p.x + 3, p.y + 8, R * 1.35, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x, p.y, R + 2.5, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
      const fg = ctx.createRadialGradient(p.x - R * 0.35, p.y - R * 0.45, R * 0.1, p.x, p.y, R);
      fg.addColorStop(0, mixHex(T.c1, '#ffffff', 0.35)); fg.addColorStop(1, T.c1);
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.fillStyle = fg; ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = T.c2; ctx.beginPath(); ctx.arc(p.x, p.y, R - 2.5, 0, TAU); ctx.stroke();
      const tc = onColor(T.c1);
      outlinedText(ctx, T.code, p.x, p.y + 1, `900 16px ${FONT_UI}`, tc.fill, tc.stroke, tc.lw);
      if (p.captain) {                                   // captain: gold armband badge with a "C"
        const bx = p.x + R * 0.72, by = p.y - R * 0.72;
        ctx.beginPath(); ctx.arc(bx, by, 11, 0, TAU); ctx.fillStyle = '#FFD54F'; ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = '#3a2a00'; ctx.stroke();
        ctx.fillStyle = '#3a2a00'; ctx.font = `900 13px ${FONT_UI}`; ctx.fillText('C', bx, by + 1);
      }
      ctx.restore();
    }
  },
  balls(g, vis) {
    const ctx = this.ctx, R = CONFIG.BALL_R;
    for (const b of g.balls) {
      let x = b.x, y = b.y, a = 1, sc = 1;
      if (b.state === 'net') a = clamp01(1 - b.netT / 0.5);
      else if (b.state === 'vanish') a = g.morph ? 1 - easeInOutCubic(g.morph.t / g.morph.dur) : 0;
      else if (g.morph) a = 0.55;
      if (b.state === 'live' && g.t - b.born < 0.3) sc = easeOutBack((g.t - b.born) / 0.3, 2.2);
      if (a <= 0.01 || sc <= 0.01) continue;
      const T = b.lastTouch >= 0 ? g.teams[b.lastTouch] : null;
      const tcol = T ? T.c1 : '#ffffff';
      const tr = this.trails.get(b.id);
      if (tr && b.state === 'live' && !g.morph) {
        for (let i = 0; i < tr.length; i++) {
          const f = (i + 1) / tr.length;
          ctx.globalAlpha = 0.45 * f * a;
          ctx.fillStyle = tcol;
          ctx.beginPath(); ctx.arc(tr[i].x, tr[i].y, R * (0.3 + 0.65 * f), 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      ctx.save(); ctx.globalAlpha = a;
      ctx.translate(x, y); ctx.scale(sc, sc);
      let heat = b.state === 'live' ? clamp01(((b.boost || 1) - 1.15) / (CONFIG.BALL_MAX_MULT - 1.15)) : 0;
      if (b.state === 'live' && b.shot) heat = 1;          // captain shot: full glow
      if (heat > 0) {                                   // speed glow in the last-touch colour
        const hg = ctx.createRadialGradient(0, 0, R * 0.8, 0, 0, R * (2.2 + 1.3 * heat));
        hg.addColorStop(0, rgbaFromAny(tcol, 0.55 * heat)); hg.addColorStop(1, rgbaFromAny(tcol, 0));
        ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, 0, R * (2.2 + 1.3 * heat), 0, TAU); ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.beginPath(); ctx.ellipse(4, 7, R, R * 0.8, 0, 0, TAU); ctx.fill();
      const gr = ctx.createRadialGradient(-5, -6, 2, 0, 0, R);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#cfd3d8');
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fillStyle = gr; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.rotate(this.spins.get(b.id) || 0);
      ctx.fillStyle = '#23262b';
      pentagon(ctx, 0, 0, 6.5);
      for (let i = 0; i < 5; i++) { const an = i * TAU / 5 - Math.PI / 2; pentagon(ctx, Math.cos(an) * 15, Math.sin(an) * 15, 5); }
      ctx.restore();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke();
      ctx.restore();
    }
    for (const p of FX.pops) {
      const t = (FX.wt - p.t) / 0.5;
      ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - t)})`; ctx.lineWidth = 4 * (1 - t) + 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, 18 + t * 50, 0, TAU); ctx.stroke();
    }
  },
  particles() {
    const ctx = this.ctx;
    for (const p of FX.parts) {
      const t = p.life / p.max, a = 1 - t;
      if (p.k === 'spark') {
        ctx.strokeStyle = p.color; ctx.globalAlpha = a; ctx.lineWidth = p.size; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
      } else if (p.k === 'dot') {
        ctx.fillStyle = p.color; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a + 0.5, 0, TAU); ctx.fill();
      } else if (p.k === 'ring') {
        ctx.strokeStyle = p.color; ctx.globalAlpha = a * 0.8; ctx.lineWidth = 5 * a + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + easeOutCubic(t)), 0, TAU); ctx.stroke();
      } else if (p.k === 'conf') {
        ctx.save(); ctx.globalAlpha = Math.min(1, a * 2); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * (0.4 + 0.6 * Math.abs(Math.cos(p.rot * 2))));
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  },
  floats() {
    const ctx = this.ctx;
    for (const f of FX.floats) {
      const t = (FX.ut - f.t) / 1.0;
      const s = easeOutBack(t / 0.25, 2.5);
      ctx.save();
      ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
      ctx.translate(f.x, f.y - 40 * easeOutCubic(t)); ctx.scale(s, s);
      outlinedText(ctx, f.text, 0, 0, `64px ${FONT_BIG}`, '#ffffff', f.color, 10);
      ctx.restore();
    }
  },
  nightGlow(g) {
    const ctx = this.ctx;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const b of g.balls) {
      if (b.state === 'dead') continue;
      const gr = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 95);
      gr.addColorStop(0, 'rgba(255,255,240,0.38)'); gr.addColorStop(1, 'rgba(255,255,240,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(b.x, b.y, 95, 0, TAU); ctx.fill();
    }
    for (const gl of g.geo.goals) {
      const T = g.teams[gl.team];
      const gr = ctx.createRadialGradient(gl.mx, gl.my, 0, gl.mx, gl.my, gl.hw + 60);
      gr.addColorStop(0, rgba(T.c1, 0.35)); gr.addColorStop(1, rgba(T.c1, 0));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gl.mx, gl.my, gl.hw + 60, 0, TAU); ctx.fill();
    }
    ctx.restore();
  },
  weather(g) {
    const ctx = this.ctx;
    if (g.themeId === 'snow') {
      ctx.fillStyle = '#ffffff';
      for (const w of FX.weather) { ctx.globalAlpha = w.a; ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    } else if (g.themeId === 'rain') {
      ctx.strokeStyle = '#cfe3ff'; ctx.lineWidth = 2;
      for (const w of FX.weather) { ctx.globalAlpha = w.a; ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(w.x + w.len * 0.28, w.y - w.len); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
  },
};

/* ---------- drawing helpers ---------- */
/* colour helpers for the team tokens / score chips: mix a hex colour with another, perceived brightness 0..1 */
function mixHex(h, w, t) { const [r, g, b] = hexToRgb(h), [r2, g2, b2] = hexToRgb(w); return `rgb(${Math.round(r + (r2 - r) * t)},${Math.round(g + (g2 - g) * t)},${Math.round(b + (b2 - b) * t)})`; }
function lumHex(h) { const [r, g, b] = hexToRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
/* text colour that reads on a club colour: dark on light colours, white (with a dark outline) on the others */
const onColor = (c) => lumHex(c) > 0.62 ? { fill: '#111418', stroke: null, lw: 0 } : { fill: '#ffffff', stroke: 'rgba(0,0,0,0.65)', lw: 4 };
/* fine grass grain, drawn once (visual only: its own little PRNG, never the match RNG) */
let GRASS_GRAIN = null;
function grassGrain(ctx) {
  if (!GRASS_GRAIN) {
    const c = document.createElement('canvas'); c.width = c.height = 160; const x = c.getContext('2d'); let sd = 7;
    const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 1400; i++) { x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'; x.fillRect(rnd() * 160, rnd() * 160, 1 + rnd() * 2, 3 + rnd() * 5); }
    GRASS_GRAIN = c;
  }
  return ctx.createPattern(GRASS_GRAIN, 'repeat');
}
function ordinal(n) { const s = n % 100 >= 11 && n % 100 <= 13 ? 'TH' : ({ 1: 'ST', 2: 'ND', 3: 'RD' }[n % 10] || 'TH'); return n + s; }
function rgbaFromAny(c, a) { return c.startsWith('#') ? rgba(c, a) : c; }
function pentagon(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5 - Math.PI / 2; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.closePath(); ctx.fill();
}
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function outlinedText(ctx, text, x, y, font, fill, stroke, lw, align = 'center', base = 'middle') {
  ctx.font = font; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.lineJoin = 'round';
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.strokeText(text, x, y); }
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

/* =====================================================================
   HUD  (top bar: title · clock · score, penalty table, announcements)
   ===================================================================== */
const HUD = {
  draw(ctx, g, app) {
    /* everything in one line on top (title · score · clock), the pitch fills the rest of the frame */
    this.topBar(ctx, g, app);
    this.announcement(ctx, CONFIG.CY + CONFIG.FINAL_DY - CONFIG.FINAL_H * 0.27, g.cx);
    if (g.pens) this.penalties(ctx, g, g.cx);
  },
  /* one line above the pitch — title + theme (left), the clock (centre; last 10 s red, golden goal gold), the score (right).
     A thin bar under the clock shows the time played. */
  topBar(ctx, g, app) {
    const y = CONFIG.TOPBAR_Y, X0 = 30, X1 = 1050, H = 84;
    ctx.save();
    roundRect(ctx, X0, y - H / 2, X1 - X0, H, 24);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.stroke();
    const fit = (text, size, maxW, weight = '') => {
      let fs = size; ctx.font = `${weight}${fs}px ${FONT_BIG}`;
      while (ctx.measureText(text).width > maxW && fs > 18) { fs -= 2; ctx.font = `${weight}${fs}px ${FONT_BIG}`; }
      return `${weight}${fs}px ${FONT_BIG}`;
    };
    /* left: "WEEK 5 · MATCH 5" + theme icon */
    const title = app.title || '', tf = fit(title, 36, 250);
    outlinedText(ctx, title, X0 + 24, y + 2, tf, '#ffffff', null, 0, 'left');
    ctx.font = tf; const tw = ctx.measureText(title).width;
    ctx.font = `26px ${FONT_UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(THEME_DEFS[g.themeId].icon, X0 + 24 + tw + 8, y);
    /* right: [LIV] 2 : 4 [JUV] — each code in a chip of its club colours (home on the left), the score in a framed box;
       a score pops when it changes */
    const [A, B] = g.teams, SX = X1 - 190;
    const pop = (T) => { const p = g.t - (T.hitT >= 0 ? T.hitT : -9); return p < 0.5 ? 1 + 0.35 * Math.sin(p / 0.5 * Math.PI) : 1; };
    const chip = (T, x0, w) => {
      roundRect(ctx, x0, y - 27, w, 54, 14);
      const cg = ctx.createLinearGradient(0, y - 27, 0, y + 27); cg.addColorStop(0, mixHex(T.c1, '#ffffff', 0.18)); cg.addColorStop(1, T.c1);
      ctx.fillStyle = cg; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = T.c2; ctx.stroke();
      outlinedText(ctx, T.code, x0 + w / 2, y + 3, `40px ${FONT_BIG}`, onColor(T.c1).fill, null, 0);
    };
    chip(A, SX - 176, 112); chip(B, SX + 64, 112);
    roundRect(ctx, SX - 58, y - 31, 116, 62, 14); ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke();
    for (const [T, x, O] of [[A, SX - 28, B], [B, SX + 28, A]]) {
      const k = pop(O);
      ctx.save(); ctx.translate(x, y + 3); ctx.scale(k, k);
      outlinedText(ctx, String(T.score), 0, 0, `56px ${FONT_BIG}`, '#ffffff', null, 0);
      ctx.restore();
    }
    outlinedText(ctx, ':', SX, y, `40px ${FONT_BIG}`, 'rgba(255,255,255,0.55)', null, 0);
    /* centre: the clock */
    const T = g.matchTime, gold = g.extra || g.pens, left = g.timeLeft();
    /* added time (the time is up, play goes on until the ball crosses the centre line): "1:30+" / "GOLDEN GOAL +" */
    const brk = g.morph && g.morph.kind === 'half';
    const shown = g.pens ? 'PENALTIES' : g.winnerSet || g.over ? 'FULL TIME' : brk ? 'HALF TIME' : gold ? `GOLDEN GOAL ${g.added ? '+' : Math.ceil(left)}` : (() => {
      const t = Math.min(g.half === 1 ? T / 2 : T, Math.floor(g.clock)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}${g.added ? '+' : ''}`; })();
    const hot = !gold && !g.winnerSet && left <= 10;
    const col = gold ? '#FFD54F' : hot ? '#FF5252' : '#ffffff';
    const cx = 540, pulse = hot ? 1 + 0.15 * Math.max(0, 1 - (Math.ceil(left) - left) * 4) : 1;
    ctx.save(); ctx.translate(cx, y - 2); ctx.scale(pulse, pulse);
    outlinedText(ctx, shown, 0, 0, fit(shown, 48, 170), col, null, 0);
    ctx.restore();
    const frac = g.pens ? 1 : gold ? clamp01((g.clock - g.extraStart) / CONFIG.GOLDEN_TIME) : clamp01(g.clock / T), bw = 150;
    roundRect(ctx, cx - bw / 2, y + 26, bw, 5, 2.5); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill();
    if (frac > 0) { roundRect(ctx, cx - bw / 2, y + 26, bw * frac, 5, 2.5); ctx.fillStyle = col; ctx.fill(); }
    if (!gold) {                                          // half-time mark on the bar + 1H / 2H
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(cx - 1.5, y + 22, 3, 13);
      outlinedText(ctx, g.half === 1 ? '1H' : '2H', cx + bw / 2 + 22, y + 28, `600 18px ${FONT_UI}`, 'rgba(255,255,255,0.7)', null, 0);
    }
    ctx.restore();
  },
  /* penalty shoot-out over the (empty) pitch: one row per club, a circle per kick (goal ● green, miss ✕ red) */
  penalties(ctx, g, SX) {
    const P = g.pens, cy = CONFIG.CY + CONFIG.FINAL_DY, W = 760, H = 330;
    const k = easeOutBack(P.t / 0.4, 2);
    if (k <= 0.01) return;
    ctx.save(); ctx.translate(SX, cy); ctx.scale(k, k);
    roundRect(ctx, -W / 2, -H / 2, W, H, 30); ctx.fillStyle = 'rgba(6,10,18,0.9)'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#FFD54F'; ctx.stroke();
    outlinedText(ctx, 'PENALTIES', 0, -H / 2 + 46, `62px ${FONT_BIG}`, '#FFD54F', null, 0);
    const shown = P.kicks.slice(0, P.shown);
    g.teams.forEach((T, i) => {
      const y = -20 + i * 110, mine = shown.filter(x => x.team === i), all = P.kicks.filter(x => x.team === i).length;
      ctx.beginPath(); ctx.arc(-W / 2 + 50, y, 16, 0, TAU); ctx.fillStyle = T.c1; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = T.c2; ctx.stroke();
      outlinedText(ctx, T.code, -W / 2 + 80, y + 3, `56px ${FONT_BIG}`, '#ffffff', null, 0, 'left');
      const n = Math.max(5, all);
      const r = n > 7 ? 15 : 20, step = Math.min(56, 380 / n);
      for (let j = 0; j < n; j++) {
        const x = -W / 2 + 200 + j * step + r, q = mine[j];
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
        if (!q) { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.stroke(); continue; }
        ctx.fillStyle = q.goal ? '#22C55E' : '#FF4D4D'; ctx.fill();
        outlinedText(ctx, q.goal ? '●' : '✕', x, y + 1, `600 ${Math.round(r * 1.1)}px ${FONT_UI}`, '#ffffff', null, 0);
      }
      outlinedText(ctx, String(T.pen), W / 2 - 50, y + 3, `76px ${FONT_BIG}`, g.winnerSet && g.winner === i ? '#FFD54F' : '#ffffff', null, 0);
    });
    ctx.restore();
  },

  /* green plus next to the scoring team's name, centred on (x, y), s = size */
  greenPlus(ctx, x, y, s) {
    const t = s * 0.3;
    ctx.save(); ctx.translate(x, y);
    const h = s / 2, u = t / 2;
    ctx.beginPath();
    ctx.moveTo(-u, -h); ctx.lineTo(u, -h); ctx.lineTo(u, -u); ctx.lineTo(h, -u); ctx.lineTo(h, u); ctx.lineTo(u, u);
    ctx.lineTo(u, h); ctx.lineTo(-u, h); ctx.lineTo(-u, u); ctx.lineTo(-h, u); ctx.lineTo(-h, -u); ctx.lineTo(-u, -u); ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10;
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.stroke();
    ctx.shadowColor = 'rgba(34,197,94,0.8)'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#22C55E'; ctx.fill();
    ctx.restore();
  },

  /* single announcement lane above the pitch */
  announcement(ctx, y, x = 510) {
    const a = FX.ann;
    if (!a) return;
    const t = FX.ut - a.t;
    const leaving = FX.annQ.length ? Math.max(0, FX.ANN_MIN - 0.12) : a.dur - 0.25;
    const alpha = t > leaving ? clamp01(1 - (t - leaving) / 0.12 * (FX.annQ.length ? 1 : 0.5)) : 1;
    const s = easeOutBack(t / 0.35, 2.4);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y); ctx.scale(s, s);
    if (a.kind === 'big') {
      let fs = 118; ctx.font = `${fs}px ${FONT_BIG}`;
      while (ctx.measureText(a.text).width > 880 && fs > 50) { fs -= 4; ctx.font = `${fs}px ${FONT_BIG}`; }
      ctx.rotate(-0.025);
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20;
      outlinedText(ctx, a.text, 0, 4, `${fs}px ${FONT_BIG}`, '#ffffff', a.color, 14);
      ctx.shadowBlur = 0;
      outlinedText(ctx, a.text, 0, 4, `${fs}px ${FONT_BIG}`, '#ffffff', null, 0);
    } else if (a.kind === 'score' && a.goal) {
      /* line 1: green plus + "ARSENAL GOAL" in the scoring team's colours; line 2: the new score in a pill */
      const G = a.goal;
      let gs = 64; ctx.font = `${gs}px ${FONT_BIG}`;
      while (ctx.measureText(G.text).width > 760 && gs > 36) { gs -= 2; ctx.font = `${gs}px ${FONT_BIG}`; }
      const gw = ctx.measureText(G.text).width, ps = G.plus ? gs * 0.58 : 0, gap = G.plus ? 16 : 0;
      const gx = (ps + gap) / 2, gy = -74;           // text shifted right so plus + text stay centred
      if (G.plus) this.greenPlus(ctx, gx - gw / 2 - gap - ps / 2, gy - 2, ps);
      const edge = luminance(G.c1) > 0.8 ? G.c2 : G.c1;
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16;
      outlinedText(ctx, G.text, gx, gy, `${gs}px ${FONT_BIG}`, '#ffffff', edge, 12);
      ctx.shadowBlur = 0;
      outlinedText(ctx, G.text, gx, gy, `${gs}px ${FONT_BIG}`, '#ffffff', null, 0);
      let fs = 56; ctx.font = `${fs}px ${FONT_BIG}`;
      while (ctx.measureText(a.text).width > 760 && fs > 28) { fs -= 2; ctx.font = `${fs}px ${FONT_BIG}`; }
      const w = ctx.measureText(a.text).width + 70, h = fs + 22, cy = -2;
      roundRect(ctx, -w / 2, cy - h / 2, w, h, h / 2);
      ctx.fillStyle = 'rgba(10,10,20,0.85)'; ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = a.color; ctx.stroke();
      outlinedText(ctx, a.text, 0, cy + 3, `${fs}px ${FONT_BIG}`, '#ffffff', null, 0);
    } else {
      let fs = 56; ctx.font = `${fs}px ${FONT_BIG}`;
      while (ctx.measureText(a.text).width > 820 && fs > 28) { fs -= 2; ctx.font = `${fs}px ${FONT_BIG}`; }
      const w = ctx.measureText(a.text).width + 70, h = fs + 26;
      roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
      ctx.fillStyle = 'rgba(10,10,20,0.85)'; ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = a.color; ctx.stroke();
      outlinedText(ctx, a.text, 0, 3, `${fs}px ${FONT_BIG}`, '#ffffff', null, 0);
    }
    ctx.restore();
  },
};

/* =====================================================================
   LEAGUE TABLE  (one screen, every team; used before the match as a static table and after it with the animation:
   match place + coloured "+pts" pop in → points count up → rows glide to their new ranks)
   ===================================================================== */
const LeagueTable = {
  GREEN: '#2EE66B', RED: '#FF4D4D',
  /* column x offsets inside a row (the table stays clear of the right edge, where Reels / TikTok put their buttons) */
  COL: { rank: 44, arrow: 80, dot: 110, name: 134, nameW: 200, p: 362, gd: 414, match: 505, pts: 604, form: 660, pillW: 64, pillGap: 8 },
  /* last results: W green, D grey, L red */
  PILL: { W: ['#22C55E', '#04210f'], D: ['rgba(255,255,255,0.28)', '#ffffff'], L: ['rgba(255,77,77,0.55)', '#ffffff'] },
  pill(ctx, x, cy, w, h, place, k) {
    if (k <= 0.01) return;
    ctx.save(); ctx.translate(x + w / 2, cy); ctx.scale(k, k);
    roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.3);
    if (!place) {
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.stroke();
      outlinedText(ctx, '–', 0, 1, `${Math.round(h * 0.7)}px ${FONT_BIG}`, 'rgba(255,255,255,0.35)', null, 0);
    } else {
      const [bg, fg] = this.PILL[place] || this.PILL.D;
      ctx.fillStyle = bg; ctx.fill();
      outlinedText(ctx, place, 0, 2, `${Math.round(h * 0.74)}px ${FONT_BIG}`, fg, null, 0);
    }
    ctx.restore();
  },
  /* the last FORM_COUNT results, newest on the right; after the match the old pills slide left and the new result pops in */
  form(ctx, x, cy, h, r, tt, post) {
    const C = this.COL, N = CONFIG.FORM_COUNT, slotX = (i) => x + C.form + i * (C.pillW + C.pillGap);
    const oldF = r.oldForm || [], newF = r.newForm || oldF;
    const changed = post && r.res && newF.length && newF !== oldF;
    const p = changed ? easeInOutCubic((tt - 1.9) / 0.4) : 0;
    for (let i = 0; i < N; i++) this.pill(ctx, slotX(i), cy, C.pillW, h, 0, 1);   // empty slots underneath
    if (!changed) { oldF.forEach((pl, j) => this.pill(ctx, slotX(N - oldF.length + j), cy, C.pillW, h, pl, 1)); return; }
    oldF.forEach((pl, j) => {
      const s0 = N - oldF.length + j, s = s0 - p;
      const fade = s < 0 ? clamp01(1 + s * 2) : 1;
      if (fade <= 0) return;
      ctx.save(); ctx.globalAlpha *= fade;
      this.pill(ctx, x + C.form + s * (C.pillW + C.pillGap), cy, C.pillW, h, pl, 1);
      ctx.restore();
    });
    this.pill(ctx, slotX(N - 1), cy, C.pillW, h, newF[newF.length - 1], easeOutBack((tt - 2.2) / 0.35, 2.6));
  },
  /* rows: see App.onOver / LiveScreen. st: { tt: seconds since this screen started, post: animate the match result, alpha,
     po: the promotion league's table — its top po rows are the playoff places (green, a PLAYOFFS line under them) and nobody goes down;
     up: its top up rows go up directly (gold, a PROMOTION line under them) } */
  draw(ctx, rows, title, sub, st) {
    const SX = 510, tt = st.tt, post = st.post;
    const n = rows.length, X0 = 70, W = 880, top = 345;
    const rh = Math.max(40, Math.min(86, Math.floor(1310 / Math.max(n, 1))));
    ctx.save(); ctx.globalAlpha *= st.alpha;
    const ts = easeOutBack(tt / 0.4, 2);
    ctx.save(); ctx.translate(SX, 215); ctx.scale(ts, ts);
    outlinedText(ctx, title, 0, 0, `104px ${FONT_BIG}`, '#ffffff', null, 0);
    ctx.restore();
    outlinedText(ctx, sub, SX, 282, `600 30px ${FONT_UI}`, 'rgba(255,255,255,0.65)', null, 0);
    const head = `600 22px ${FONT_UI}`, hc = 'rgba(255,255,255,0.5)', hy = top - 18;
    const C = this.COL, formW = CONFIG.FORM_COUNT * C.pillW + (CONFIG.FORM_COUNT - 1) * C.pillGap;
    outlinedText(ctx, 'TEAM', X0 + C.dot - 16, hy, head, hc, null, 0, 'left');
    outlinedText(ctx, 'P', X0 + C.p, hy, head, hc, null, 0);
    outlinedText(ctx, 'GD', X0 + C.gd, hy, head, hc, null, 0);
    if (post) outlinedText(ctx, 'MATCH', X0 + C.match, hy, head, hc, null, 0);
    outlinedText(ctx, 'PTS', X0 + C.pts, hy, head, hc, null, 0);
    if (CONFIG.FORM_COUNT > 0) outlinedText(ctx, `LAST ${CONFIG.FORM_COUNT}`, X0 + C.form + formW / 2, hy, head, hc, null, 0);
    /* relegation line above the last RELEGATE_COUNT rows (the promotion league: the playoff line under its top po rows) */
    const PO = st.po || 0, UP = st.up || 0, RC = PO ? 0 : CONFIG.RELEGATE_COUNT, zones = RC > 0 && n >= RC + 5, poZone = PO > 0 && n > PO;
    if (poZone) {
      const ly = top + PO * rh;
      ctx.save(); ctx.setLineDash([14, 10]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(46,230,107,0.85)';
      ctx.beginPath(); ctx.moveTo(X0, ly); ctx.lineTo(X0 + W, ly); ctx.stroke(); ctx.restore();
      outlinedText(ctx, 'PLAYOFFS', X0 + W, ly - 1, `700 15px ${FONT_UI}`, this.GREEN, 'rgba(0,0,0,0.8)', 4, 'right');
      if (UP > 0 && UP < PO) {                               // ...and the line under the clubs that go up directly
        const uy = top + UP * rh;
        ctx.save(); ctx.setLineDash([14, 10]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,213,79,0.85)';
        ctx.beginPath(); ctx.moveTo(X0, uy); ctx.lineTo(X0 + W, uy); ctx.stroke(); ctx.restore();
        outlinedText(ctx, 'PROMOTION', X0 + W, uy - 1, `700 15px ${FONT_UI}`, '#FFD54F', 'rgba(0,0,0,0.8)', 4, 'right');
      }
    }
    if (zones) {
      const ly = top + (n - RC) * rh;
      ctx.save(); ctx.setLineDash([14, 10]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,77,77,0.85)';
      ctx.beginPath(); ctx.moveTo(X0, ly); ctx.lineTo(X0 + W, ly); ctx.stroke(); ctx.restore();
      outlinedText(ctx, 'RELEGATION', X0 + W, ly - 1, `700 15px ${FONT_UI}`, '#FF6B6B', 'rgba(0,0,0,0.8)', 4, 'right');
    }
    const countP = post ? easeOutCubic((tt - 1.9) / 0.8) : 1;
    const moveP = post ? easeInOutCubic((tt - 3.1) / 1.0) : 0;
    const order = rows.slice().sort((a, b) => (a.today - b.today) || (b.newRank - a.newRank));   // movers are drawn on top
    for (const r of order) {
      const pos = lerp(r.oldRank, r.newRank, moveP);
      const enter = easeOutCubic((tt - 0.02 * Math.min(r.oldRank, 20) - 0.05) / 0.4);
      if (enter <= 0) continue;
      const x = X0 + (1 - enter) * 420, y = top + pos * rh, cy = y + rh / 2 + 1;
      ctx.save(); ctx.globalAlpha *= enter;
      roundRect(ctx, x, y + 3, W, rh - 6, Math.min(20, rh * 0.28));
      ctx.fillStyle = r.today ? rgba(r.c1, 0.30) : Math.round(pos) % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.09)'; ctx.fill();
      if (r.today) { ctx.lineWidth = 3; ctx.strokeStyle = rgba(r.c1, 0.9); ctx.stroke(); }
      if (r.champ) { ctx.lineWidth = 5; ctx.strokeStyle = '#FFD54F'; ctx.stroke(); }          // season champion
      else if (r.out) { ctx.lineWidth = 4; ctx.strokeStyle = this.RED; ctx.stroke(); }          // relegated
      ctx.fillStyle = r.c1; roundRect(ctx, x, y + 3, 12, rh - 6, 6); ctx.fill();
      const rank = Math.round(pos) + 1;
      if (poZone && rank <= PO) {                            // promotion league: direct places gold, playoff places green
        const bs = rh * 0.62, gold = rank <= Math.max(1, UP);
        roundRect(ctx, x + C.rank - bs / 2, cy - bs / 2, bs, bs, 8); ctx.fillStyle = gold ? '#FFD54F' : '#22C55E'; ctx.fill();
        outlinedText(ctx, String(rank), x + C.rank, cy + 2, `${Math.round(rh * 0.5)}px ${FONT_BIG}`, gold ? '#2a1f00' : '#04210f', null, 0);
      } else if (zones && (rank === 1 || rank > n - RC)) {   // leader: gold badge, relegation places: red badge
        const lead = rank === 1, bs = rh * 0.62;
        roundRect(ctx, x + C.rank - bs / 2, cy - bs / 2, bs, bs, 8); ctx.fillStyle = lead ? '#FFD54F' : 'rgba(255,77,77,0.9)'; ctx.fill();
        outlinedText(ctx, String(rank), x + C.rank, cy + 2, `${Math.round(rh * 0.5)}px ${FONT_BIG}`, lead ? '#2a1f00' : '#ffffff', null, 0);
      } else outlinedText(ctx, String(rank), x + C.rank, cy + 2, `${Math.round(rh * 0.56)}px ${FONT_BIG}`, '#ffffff', null, 0);
      /* ▲ / ▼ once the rows have settled */
      if (post && tt > 4.1 && r.newRank !== r.oldRank) {
        const k = easeOutBack((tt - 4.1) / 0.3, 2.5);
        ctx.save(); ctx.translate(x + C.arrow, cy); ctx.scale(k, k);
        outlinedText(ctx, r.newRank < r.oldRank ? '▲' : '▼', 0, 0, `${Math.round(rh * 0.3)}px ${FONT_UI}`, r.newRank < r.oldRank ? this.GREEN : this.RED, null, 0);
        ctx.restore();
      }
      const dr = Math.min(16, rh * 0.22);
      ctx.beginPath(); ctx.arc(x + C.dot, cy, dr, 0, TAU); ctx.fillStyle = r.c1; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = r.c2; ctx.stroke();
      let fs = Math.min(44, Math.round(rh * 0.55)); ctx.font = `${fs}px ${FONT_BIG}`;
      while (ctx.measureText(upTR(r.name)).width > C.nameW && fs > 22) { fs -= 2; ctx.font = `${fs}px ${FONT_BIG}`; }
      outlinedText(ctx, upTR(r.name), x + C.name, cy + 2, `${fs}px ${FONT_BIG}`, '#ffffff', null, 0, 'left');
      const small = `600 ${Math.max(20, Math.round(rh * 0.38))}px ${FONT_UI}`, dim = 'rgba(255,255,255,0.75)';
      outlinedText(ctx, String(r.played - (post && r.dPlayed && countP < 0.5 ? r.dPlayed : 0)), x + C.p, cy + 1, small, dim, null, 0);
      const gd = Math.round(lerp(r.oldGd, r.newGd, countP));
      outlinedText(ctx, (gd > 0 ? '+' : '') + gd, x + C.gd, cy + 1, small, dim, null, 0);
      /* this match: result (W / D / L) + "+pts" (green) / "+0" (red) */
      if (post && r.res) {
        const k = easeOutBack((tt - (r.res === 'L' ? 1.1 : 1.0)) / 0.35, 2.6);
        if (k > 0.01) {
          ctx.save(); ctx.translate(x + C.match, cy); ctx.scale(k, k);
          this.pill(ctx, -36 - 24, 0, 48, Math.round(Math.min(46, rh * 0.56)), r.res, 1);
          if (r.delta !== null) {
            const col = r.delta > 0 ? this.GREEN : this.RED;
            outlinedText(ctx, `+${r.delta}`, 38, 1, `${Math.round(rh * 0.62)}px ${FONT_BIG}`, col, 'rgba(0,0,0,0.75)', 6, 'center');
          }
          ctx.restore();
        }
      }
      const pts = Math.round(lerp(r.oldPts, r.newPts, countP));
      outlinedText(ctx, String(pts), x + C.pts, cy + 2, `${Math.round(rh * 0.7)}px ${FONT_BIG}`, '#ffffff', null, 0);
      if (CONFIG.FORM_COUNT > 0) this.form(ctx, x, cy, Math.round(Math.min(46, rh * 0.56)), r, tt, post);
      ctx.restore();
    }
    ctx.restore();
  },
};

/* =====================================================================
   INTRO SCREEN  (before the match: the week's 1v1 matches — played ones with scores, then fixtures — and it fades into the match)
   ===================================================================== */
const IntroScreen = {
  draw(ctx, intro, t) {
    const out = clamp01((CONFIG.INTRO_DURATION - t) / 0.45);
    ctx.save();
    ctx.fillStyle = `rgba(4,6,12,${out})`;
    ctx.fillRect(0, 0, 1080, 1920);
    ctx.globalAlpha = out;
    this.matches(ctx, intro, t);
    ctx.restore();
  },
  /* the week's (or the playoff round's) 1v1 matches, one row each: played ones with the score, the one about to start, the rest.
     A match: { label, status: 'done' | 'now' | 'later', hi, a, b (clubs, home first), sa, sb (goals), pa, pb (penalties), win: 'a' | 'b' | '', gg } */
  matches(ctx, intro, tt) {
    const SX = 510, X0 = 70, W = 880, list = intro.matches.filter(m => m.a && m.b), n = list.length;
    ctx.save();
    ctx.globalAlpha *= clamp01(tt / 0.25);
    const ts = easeOutBack(tt / 0.4, 2);
    ctx.save(); ctx.translate(SX, 215); ctx.scale(ts, ts);
    outlinedText(ctx, intro.heading || 'MATCHES', 0, 0, `104px ${FONT_BIG}`, '#ffffff', null, 0);
    ctx.restore();
    outlinedText(ctx, intro.sub, SX, 282, `600 30px ${FONT_UI}`, 'rgba(255,255,255,0.65)', null, 0);
    const top = 345, avail = 1300, gap = 14;
    const rh = Math.min(170, (avail - gap * Math.max(0, n - 1)) / Math.max(1, n));
    const y0 = top + Math.max(0, (avail - (n * rh + (n - 1) * gap)) / 2);
    const later = intro.later || 'COMING UP';
    list.forEach((m, i) => {
      const k = easeOutBack((tt - 0.08 - 0.07 * i) / 0.4, 2);
      if (k <= 0.01) return;
      const y = y0 + i * (rh + gap), now = m.status === 'now', done = m.status === 'done', cy = y + rh * 0.6;
      ctx.save(); ctx.translate(X0 + W / 2, y + rh / 2); ctx.scale(k, k); ctx.translate(-(X0 + W / 2), -(y + rh / 2));
      roundRect(ctx, X0, y, W, rh, 24);
      ctx.fillStyle = now ? 'rgba(0,200,83,0.15)' : 'rgba(255,255,255,0.07)'; ctx.fill();
      if (now || m.hi) { ctx.lineWidth = 4; ctx.strokeStyle = m.hi ? '#FFD54F' : '#00E676'; ctx.stroke(); }
      const small = `600 ${Math.round(Math.min(22, rh * 0.18))}px ${FONT_UI}`;
      outlinedText(ctx, m.label, X0 + 26, y + rh * 0.2, small, 'rgba(255,255,255,0.55)', null, 0, 'left');
      const badge = done ? (m.pa != null ? 'PENALTIES' : m.gg ? 'GOLDEN GOAL' : 'FULL TIME') : now ? 'PLAYING NOW' : later;
      outlinedText(ctx, badge, X0 + W - 26, y + rh * 0.2, small, now ? '#00E676' : 'rgba(255,255,255,0.55)', null, 0, 'right');
      /* home ● NAME   score   NAME ● away */
      const fsMax = Math.min(46, Math.round(rh * 0.42)), boxW = 150, nameW = (W - boxW) / 2 - 70;
      const side = (t, right, dim) => {
        const dx = right ? X0 + W - 34 : X0 + 34;
        ctx.beginPath(); ctx.arc(dx, cy, Math.min(15, rh * 0.12), 0, TAU); ctx.fillStyle = t.c1; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = t.c2; ctx.stroke();
        let fs = fsMax; ctx.font = `${fs}px ${FONT_BIG}`;
        while (ctx.measureText(upTR(t.name)).width > nameW && fs > 18) { fs -= 2; ctx.font = `${fs}px ${FONT_BIG}`; }
        outlinedText(ctx, upTR(t.name), right ? dx - 26 : dx + 26, cy + 2, `${fs}px ${FONT_BIG}`, dim ? 'rgba(255,255,255,0.55)' : '#ffffff', null, 0, right ? 'right' : 'left');
      };
      side(m.a, false, done && m.win === 'b'); side(m.b, true, done && m.win === 'a');
      if (done) {
        const sf = `${Math.min(60, Math.round(rh * 0.5))}px ${FONT_BIG}`;
        outlinedText(ctx, String(m.sa), X0 + W / 2 - 34, cy + 3, sf, m.win === 'a' ? '#FFD54F' : '#ffffff', 'rgba(0,0,0,0.6)', 5);
        outlinedText(ctx, '–', X0 + W / 2, cy + 1, sf, 'rgba(255,255,255,0.6)', null, 0);
        outlinedText(ctx, String(m.sb), X0 + W / 2 + 34, cy + 3, sf, m.win === 'b' ? '#FFD54F' : '#ffffff', 'rgba(0,0,0,0.6)', 5);
        if (m.pa != null) outlinedText(ctx, `(${m.pa}–${m.pb} P)`, X0 + W / 2, cy + rh * 0.32, `600 ${Math.round(Math.min(20, rh * 0.15))}px ${FONT_UI}`, 'rgba(255,255,255,0.7)', null, 0);
      } else outlinedText(ctx, 'VS', X0 + W / 2, cy + 2, `${Math.min(44, Math.round(rh * 0.36))}px ${FONT_BIG}`, now ? '#00E676' : 'rgba(255,255,255,0.45)', null, 0);
      ctx.restore();
    });
    ctx.restore();
  },
};

/* =====================================================================
   END SCREEN  (one animated league table, which stays on screen to the end; after the season's last match the champion / relegated rows are marked)
   ===================================================================== */
const EndScreen = {
  /* after the playoff final: the season's moves — the clubs that go up, then the clubs that go down */
  summary(ctx, sm, et) {
    const SX = 510, X0 = 70, W = 880, rh = 112;
    const ts = easeOutBack(et / 0.4, 2);
    ctx.save(); ctx.translate(SX, 215); ctx.scale(ts, ts);
    outlinedText(ctx, `SEASON ${sm.season} DONE`, 0, 0, `104px ${FONT_BIG}`, '#ffffff', null, 0);
    ctx.restore();
    outlinedText(ctx, `🏆 ${upTR(sm.champion.name)} · CHAMPIONS`, SX, 282, `600 30px ${FONT_UI}`, '#FFD54F', null, 0);
    const block = (list, y0, head, col, mark, t0) => {
      outlinedText(ctx, head, X0, y0, `64px ${FONT_BIG}`, col, null, 0, 'left');
      list.forEach((t, i) => {
        const k = easeOutBack((et - t0 - 0.18 * i) / 0.4, 2);
        if (k <= 0.01) return;
        const y = y0 + 30 + i * (rh + 14);
        ctx.save(); ctx.globalAlpha *= clamp01(k); ctx.translate(X0 + (1 - clamp01(k)) * 360, 0);
        roundRect(ctx, 0, y, W, rh, 24);
        ctx.fillStyle = rgba(t.c1, 0.28); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.stroke();
        ctx.fillStyle = t.c1; roundRect(ctx, 0, y, 14, rh, 7); ctx.fill();
        outlinedText(ctx, mark, 60, y + rh / 2 + 2, `54px ${FONT_UI}`, col, null, 0);
        ctx.beginPath(); ctx.arc(130, y + rh / 2, 22, 0, TAU); ctx.fillStyle = t.c1; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = t.c2; ctx.stroke();
        let fs = 58; ctx.font = `${fs}px ${FONT_BIG}`;
        while (ctx.measureText(upTR(t.name)).width > 640 && fs > 28) { fs -= 2; ctx.font = `${fs}px ${FONT_BIG}`; }
        outlinedText(ctx, upTR(t.name), 176, y + rh / 2 + 2, `${fs}px ${FONT_BIG}`, '#ffffff', null, 0, 'left');
        ctx.restore();
      });
    };
    block(sm.up, 420, 'PROMOTED ▲', LeagueTable.GREEN, '▲', 0.5);
    block(sm.down, 420 + 30 + 3 * (rh + 14) + 90, 'RELEGATED ▼', LeagueTable.RED, '▼', 1.6);
  },
  draw(ctx, e, et) {
    ctx.save();
    ctx.fillStyle = `rgba(4,6,12,${clamp01(et / 0.35)})`;
    ctx.fillRect(0, 0, 1080, 1920);
    if (e.cup) {
      /* promotion playoff match: the round's results; after the final the season summary takes over */
      ctx.globalAlpha = clamp01(et / 0.3);
      if (e.summary && et > 3.2) {
        ctx.globalAlpha = clamp01((et - 3.2) / 0.35);
        this.summary(ctx, e.summary, et - 3.2);
      } else {
        const fade = e.summary ? clamp01((3.2 - et) / 0.3) : 1;
        ctx.globalAlpha *= fade;
        IntroScreen.matches(ctx, e.cup, et);
      }
      for (const p of FX.endParts) {
        if (et > 2.3) break;
        ctx.save(); ctx.globalAlpha = clamp01((2.3 - et) / 0.3); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * (0.3 + 0.7 * Math.abs(Math.cos(p.rot))));
        ctx.restore();
      }
      ctx.restore();
      return;
    }
    const se = e.seasonEnd;
    const sc = e.score ? `FULL TIME · ${upTR(e.score.a.name)} ${e.score.sa}–${e.score.sb} ${upTR(e.score.b.name)}` : 'AFTER ' + e.title;
    LeagueTable.draw(ctx, e.rows, e.tableTitle || 'LEAGUE TABLE', se ? `🏆 ${upTR(se.champion.name)} · SEASON ${se.season} CHAMPIONS` : sc, { tt: et, post: true, alpha: clamp01(et / 0.3), po: e.po || 0, up: e.up || 0 });
    for (const p of FX.endParts) {
      if (et > 2.3) break;
      ctx.save(); ctx.globalAlpha = clamp01((2.3 - et) / 0.3); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * (0.3 + 0.7 * Math.abs(Math.cos(p.rot))));
      ctx.restore();
    }
    ctx.restore();
  },
};
