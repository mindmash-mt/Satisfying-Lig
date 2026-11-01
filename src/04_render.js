/* =====================================================================
   RENDER — arena / entities (camera + shake apply here)
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
    this.arena(g, vis);
    HUD.draw(ctx, g, app, vis);
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
      const maxLen = Math.round(12 + 10 * clamp01(((b.boost || 1) - 1) / (CONFIG.BALL_MAX_MULT - 1)));   // trail grows with speed
      while (tr.length > maxLen) tr.shift();
    }
    for (const id of [...this.trails.keys()]) if (!alive.has(id)) this.trails.delete(id);
  },

  arena(g, vis) {
    const ctx = this.ctx;
    ctx.save();
    if (FX.shakeT > 0) {
      const m = FX.shakeMag * (FX.shakeT / FX.shakeDur);
      ctx.translate(vrng.range(-m, m), vrng.range(-m, m));
    }
    const k = FX.cam.k;
    if (k > 0.002) {
      ctx.beginPath(); ctx.rect(0, 452, 1080, 950); ctx.clip();
      const z = 1 + 0.3 * k, C = { x: CONFIG.CX, y: CONFIG.CY };
      const Fx = C.x + (FX.cam.x - C.x) * 0.55 * k, Fy = C.y + (FX.cam.y - C.y) * 0.55 * k;
      ctx.translate(C.x, C.y); ctx.scale(z, z); ctx.translate(-Fx, -Fy);
    }
    let keeperAlpha = 1;
    if (g.morph && g.morph.kind === 'rect') {
      const e = easeInOutCubic(g.morph.t / g.morph.dur);
      const pg = g.polyGeo(g.va, g.R, g.rot, g.sides);
      this.shape(g, vis, pg, 1 - e, 1 - 0.12 * e, g.rot);
      this.shape(g, vis, g.morph.targetGeo, e, 0.88 + 0.12 * e, 0);
      keeperAlpha = 1 - e;
      this.keepers(g, pg, keeperAlpha);
    } else {
      const geo = g.morph ? g.computeGeo() : g.geo;
      this.shape(g, vis, geo, 1, 1, geo.kind === 'poly' ? g.rot : 0);
      this.keepers(g, geo, 1);
    }
    this.bumpers(g);
    this.powerups(g);
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

  shape(g, vis, geo, alpha, scale, rot) {
    if (alpha <= 0.003) return;
    const ctx = this.ctx, cx = CONFIG.CX, cy = CONFIG.CY;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (scale !== 1) { ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-cx, -cy); }
    const V = geo.verts;
    /* nets (behind floor edge) */
    for (const gl of geo.goals) {
      if (gl.locked) { ctx.save(); ctx.globalAlpha *= 0.55; this.net(g, vis, gl, geo.netDepth); ctx.restore(); }
      else this.net(g, vis, gl, geo.netDepth);
    }
    /* floor */
    ctx.save();
    ctx.beginPath(); V.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y))); ctx.closePath();
    ctx.fillStyle = vis.f1; ctx.fill();
    ctx.clip();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    ctx.fillStyle = vis.f2;
    for (let s = -12; s <= 12; s += 2) ctx.fillRect(s * 45, -700, 45, 1400);
    ctx.restore();
    this.fieldLines(g, vis, geo, rot);
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
    for (const w of geo.walls) if (!w.goalWall) { ctx.moveTo(w.ax, w.ay); ctx.lineTo(w.bx, w.by); }
    ctx.strokeStyle = vis.wallGlow; ctx.lineWidth = 30; ctx.stroke();
    ctx.strokeStyle = vis.wall; ctx.lineWidth = 12; ctx.stroke();
    /* goal closures, posts, effect icons */
    for (const gl of geo.goals) {
      const T = g.teams[gl.team];
      if (gl.locked) this.lockWall(g, gl, T);
      else if (gl.wallPU) this.brickWall(gl, T);
      for (const [px, py] of [[gl.p1x, gl.p1y], [gl.p2x, gl.p2y]]) {
        ctx.beginPath(); ctx.arc(px, py, CONFIG.POST_R, 0, TAU);
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = T.c1; ctx.stroke();
      }
      if (!T.eliminated) this.goalIcons(g, gl, T);
      if (!g.isDerby) this.nameTag(gl, T, geo.netDepth, g.o.lives > 1 && !T.eliminated && !g.finalDuel ? T.lives : 0);
      if (gl.locked) this.resultTag(g, gl, T);
    }
    ctx.restore();
  },

  fieldLines(g, vis, geo, rot) {
    const ctx = this.ctx, cx = CONFIG.CX, cy = CONFIG.CY;
    ctx.strokeStyle = vis.line; ctx.lineWidth = 4; ctx.fillStyle = vis.line;
    if (geo.kind === 'poly') {
      ctx.beginPath(); ctx.arc(cx, cy, 92, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 7, 0, TAU); ctx.fill();
      ctx.save(); ctx.globalAlpha *= 0.35; ctx.beginPath();
      geo.verts.forEach((v, i) => { const x = cx + (v.x - cx) * 0.55, y = cy + (v.y - cy) * 0.55; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.closePath(); ctx.stroke(); ctx.restore();
      return;
    }
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
      ctx.beginPath(); ctx.arc(cx, ey + s * bh, 60, s > 0 ? 0.2 * Math.PI : 1.2 * Math.PI, s > 0 ? 0.8 * Math.PI : 1.8 * Math.PI); ctx.stroke();
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
    const glow = T.eliminated ? 0.25 : 1;
    ctx.beginPath(); const a1 = P(-hw, 0), a2 = P(-hw, D + disp(-hw, D)), a3 = P(hw, D + disp(hw, D)), a4 = P(hw, 0);
    ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.lineTo(a3[0], a3[1]); ctx.lineTo(a4[0], a4[1]);
    ctx.lineWidth = 9; ctx.strokeStyle = rgba(T.c1, 0.25 * glow); ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = rgba(T.c1, 0.95 * glow); ctx.stroke();
    ctx.restore();
  },

  lockWall(g, gl, T) {
    const ctx = this.ctx;
    const p = easeOutCubic((g.t - T.elimT) / 0.25);
    const { mx, my, tx, ty, hw } = gl;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = T.c1; ctx.shadowBlur = 22;
    ctx.strokeStyle = T.c1; ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(gl.p1x, gl.p1y); ctx.lineTo(gl.p1x + tx * hw * p, gl.p1y + ty * hw * p);
    ctx.moveTo(gl.p2x, gl.p2y); ctx.lineTo(gl.p2x - tx * hw * p, gl.p2y - ty * hw * p);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
  },
  /* team name written across the net behind each goal (also after elimination), parallel to the goal line.
     Letters alternate between the club's two colours; each letter gets a contrasting outline so it reads on any pitch. */
  nameTag(gl, T, D, hearts) {
    const ctx = this.ctx;
    const ang = Math.atan2(gl.ty, gl.tx);
    const chars = [...upTR(T.name)];
    let fs = Math.min(40, D - 10);
    const maxW = Math.min(gl.L * 0.92, 470);
    const widthAt = (f) => { ctx.font = `${f}px ${FONT_BIG}`; return chars.reduce((w, ch) => w + ctx.measureText(ch).width, 0) + (chars.length - 1) * f * 0.04; };
    while (widthAt(fs) > maxW && fs > 16) fs -= 2;
    const hs = hearts ? fs * 0.55 : 0, heartsW = hearts ? 10 + hearts * (hs + 3) : 0;
    while (hearts && widthAt(fs) + heartsW > maxW && fs > 16) fs -= 2;
    const total = widthAt(fs) + heartsW, gap = fs * 0.04;
    ctx.save();
    ctx.translate(gl.mx + gl.nx * (D / 2 + 2), gl.my + gl.ny * (D / 2 + 2));
    ctx.rotate(ang);
    if (Math.cos(ang) < 0) ctx.rotate(Math.PI);                // keep text upright
    ctx.font = `${fs}px ${FONT_BIG}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    let x = -total / 2, k = 0;
    for (const ch of chars) {
      const w = ctx.measureText(ch).width;
      if (ch.trim()) {
        const col = k % 2 === 0 ? T.c1 : T.c2;
        const dark = luminance(col) < 0.35;
        ctx.lineWidth = 6; ctx.strokeStyle = dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)';
        ctx.strokeText(ch, x, 2);
        ctx.fillStyle = col; ctx.fillText(ch, x, 2);
        k++;
      }
      x += w + gap;
    }
    if (hearts) for (let h = 0; h < hearts; h++) drawHeart(ctx, x + 10 + h * (hs + 3) + hs / 2, 2, hs, '#ff3d57', 'rgba(0,0,0,0.6)');
    ctx.restore();
  },
  /* small result tag just in front of an eliminated team's closed goal: "4TH · +4 PTS" */
  resultTag(g, gl, T) {
    const ctx = this.ctx;
    const p = easeOutBack((g.t - T.elimT - 0.15) / 0.35, 2);
    if (p <= 0.01) return;
    const pts = App.pointsForPlace(T.place);
    const text = `${ordinal(T.place)}${pts === null ? '' : ` · +${pts} PTS`}`;
    const ang = Math.atan2(gl.ty, gl.tx);
    ctx.save();
    ctx.translate(gl.mx - gl.nx * 34, gl.my - gl.ny * 34);
    ctx.rotate(ang);
    if (Math.cos(ang) < 0) ctx.rotate(Math.PI);
    ctx.scale(p, p);
    let fs = 32; ctx.font = `${fs}px ${FONT_BIG}`;
    const maxW = Math.max(90, gl.L * 0.7);
    while (ctx.measureText(text).width > maxW - 24 && fs > 16) { fs -= 2; ctx.font = `${fs}px ${FONT_BIG}`; }
    const w = ctx.measureText(text).width + 28, h = fs + 12;
    roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fillStyle = 'rgba(8,10,18,0.78)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = T.c1; ctx.stroke();
    outlinedText(ctx, text, 0, 2, `${fs}px ${FONT_BIG}`, '#ffffff', null, 0);
    ctx.restore();
  },
  brickWall(gl, T) {
    const ctx = this.ctx;
    ctx.save(); ctx.lineCap = 'butt';
    ctx.shadowColor = T.c1; ctx.shadowBlur = 18;
    ctx.strokeStyle = T.c1; ctx.lineWidth = 18;
    ctx.beginPath(); ctx.moveTo(gl.p1x, gl.p1y); ctx.lineTo(gl.p2x, gl.p2y); ctx.stroke();
    ctx.shadowBlur = 0; ctx.setLineDash([22, 6]); ctx.strokeStyle = T.c2; ctx.lineWidth = 6; ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  },
  goalIcons(g, gl, T) {
    const icons = [];
    if (g.t < T.fx.giant) icons.push('🧤');
    if (g.t < T.fx.wall) icons.push('🧱');
    if (g.t < T.fx.small) icons.push('🔍');
    if (g.t < T.fx.big) icons.push('🎯');
    if (!icons.length) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `32px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha *= 0.75 + 0.25 * Math.sin(FX.ut * 6);
    icons.forEach((ic, i) => {
      const off = (i - (icons.length - 1) / 2) * 40;
      const x = gl.mx - gl.nx * 74 + gl.tx * off, y = gl.my - gl.ny * 74 + gl.ty * off;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(x, y, 21, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(ic, x, y + 2);
    });
    ctx.restore();
  },

  keepers(g, geo, alphaMul) {
    const ctx = this.ctx;
    for (const gl of geo.goals) {
      const T = g.teams[gl.team], k = T.k;
      let alpha = alphaMul;
      if (T.eliminated) alpha *= 1 - clamp01((g.t - T.elimT) / 0.6);
      if (alpha <= 0.01) continue;
      const half = Math.min(k.halfLen, gl.hw * 0.92), maxS = Math.max(0, gl.hw - half - 4);
      const s = clamp(k.s, -maxS, maxS);
      const x = gl.mx - gl.nx * CONFIG.KEEPER_INSET + gl.tx * s, y = gl.my - gl.ny * CONFIG.KEEPER_INSET + gl.ty * s;
      const ax = x - gl.tx * half, ay = y - gl.ty * half, bx = x + gl.tx * half, by = y + gl.ty * half;
      ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'round';
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
  bumpers(g) {
    const ctx = this.ctx;
    for (const b of g.bumpers) {
      const f = clamp01(1 - (g.t - b.flashT) / 0.25);
      const r = b.r * (1 + 0.15 * f);
      ctx.save();
      const gr = ctx.createRadialGradient(b.x - 8, b.y - 10, 2, b.x, b.y, r);
      gr.addColorStop(0, f > 0 ? '#ffffff' : '#ff8a80'); gr.addColorStop(0.45, '#e53935'); gr.addColorStop(1, '#7f0000');
      if (f > 0) { ctx.shadowColor = '#ff5252'; ctx.shadowBlur = 40 * f; }
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.fillStyle = gr; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 5; ctx.strokeStyle = f > 0 ? '#ffffff' : '#ffcdd2'; ctx.stroke();
      ctx.beginPath(); ctx.arc(b.x, b.y, r * 0.45, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
    }
  },
  powerups(g) {
    const ctx = this.ctx;
    for (const p of g.powerups) {
      const s = easeOutBack(p.age / 0.35) * (1 + 0.07 * Math.sin(p.age * 6));
      let a = 1;
      if (p.age > CONFIG.PU_LIFE - 2) a = 0.3 + 0.7 * (0.5 + 0.5 * Math.cos(p.age * 18));
      ctx.save(); ctx.globalAlpha *= a;
      ctx.translate(p.x, p.y); ctx.scale(s, s);
      const gr = ctx.createRadialGradient(0, 0, 10, 0, 0, 58);
      gr.addColorStop(0, 'rgba(255,215,64,0.55)'); gr.addColorStop(1, 'rgba(255,215,64,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 58, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, CONFIG.PU_R, 0, TAU);
      ctx.fillStyle = 'rgba(18,18,30,0.9)'; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = '#FFD740'; ctx.stroke();
      ctx.rotate(Math.sin(p.age * 3) * 0.15);
      ctx.font = `30px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      ctx.fillText(p.def.icon, 0, 2);
      ctx.restore();
    }
  },
  players(g) {
    const ctx = this.ctx, R = CONFIG.PLAYER_R;
    for (const p of g.players) {
      const T = g.teams[p.team];
      let a = 1;
      if (!p.alive || T.eliminated) a = 1 - clamp01((g.t - T.elimT) / 0.6);
      if (a <= 0.01) continue;
      ctx.save(); ctx.globalAlpha *= a;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(p.x + 4, p.y + 7, R, R * 0.8, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.fillStyle = T.c1; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = T.c2; ctx.stroke();
      ctx.fillStyle = T.c2; ctx.font = `800 15px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(T.code, p.x, p.y + 1);
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
      const heat = b.state === 'live' ? clamp01(((b.boost || 1) - 1.15) / (CONFIG.BALL_MAX_MULT - 1.15)) : 0;
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
      gr.addColorStop(0, rgba(T.c1, T.eliminated ? 0.12 : 0.35)); gr.addColorStop(1, rgba(T.c1, 0));
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
function drawHeart(ctx, x, y, s, fill, stroke) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 16, s / 16);
  ctx.beginPath();
  ctx.moveTo(0, 6); ctx.bezierCurveTo(-14, -3, -9, -15, 0, -8); ctx.bezierCurveTo(9, -15, 14, -3, 0, 6);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = 2.2; ctx.strokeStyle = stroke; ctx.stroke(); }
  ctx.restore();
}

/* =====================================================================
   HUD  (title, derby / final-duel scoreboard, big texts, seed)
   ===================================================================== */
const HUD = {
  draw(ctx, g, app, vis) {
    const SX = 510; // center of safe area (60..960)
    /* title */
    const title = app.title || '';
    let tfs = 86; ctx.font = `${tfs}px ${FONT_BIG}`;
    while (ctx.measureText(title).width > 800 && tfs > 50) { tfs -= 2; ctx.font = `${tfs}px ${FONT_BIG}`; }
    const tw = ctx.measureText(title).width;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 16;
    outlinedText(ctx, title, SX - 34, 260, `${tfs}px ${FONT_BIG}`, '#ffffff', null, 0);
    ctx.shadowBlur = 0;
    ctx.font = `56px ${FONT_UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(THEME_DEFS[g.themeId].icon, SX - 34 + tw / 2 + 16, 256);
    ctx.restore();
    /* CTA — first 3 seconds */
    const ct = app.matchRealT;
    if (ct < 3) {
      const a = ct > 2.6 ? (3 - ct) / 0.4 : 1;
      ctx.save(); ctx.globalAlpha = a;
      outlinedText(ctx, 'Who wins? Comment below 👇', SX, 316, `600 30px ${FONT_UI}`, '#ffffff', 'rgba(0,0,0,0.55)', 6);
      ctx.restore();
    }
    if (g.isDerby) { this.scoreboard(ctx, g, SX); this.announcement(ctx, 1462); }
    else { this.announcement(ctx, 394); if (g.finalDuel && !g.morph) this.duelScore(ctx, g, SX); }
    ctx.save(); ctx.globalAlpha = 0.42;
    outlinedText(ctx, `seed ${g.o.seed >>> 0}`, SX, g.finalDuel && !g.isDerby ? 1556 : 1532, `500 22px ${FONT_UI}`, '#ffffff', null, 0);
    ctx.restore();
  },

  scoreboard(ctx, g, SX) {
    const A = g.teams[0], B = g.teams[1];
    ctx.save();
    roundRect(ctx, SX - 390, 336, 780, 104, 30);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke();
    const cy = 380;
    ctx.beginPath(); ctx.arc(SX - 345, cy, 22, 0, TAU); ctx.fillStyle = A.c1; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = A.c2; ctx.stroke();
    ctx.beginPath(); ctx.arc(SX + 345, cy, 22, 0, TAU); ctx.fillStyle = B.c1; ctx.fill(); ctx.strokeStyle = B.c2; ctx.stroke();
    outlinedText(ctx, A.code, SX - 310, cy + 4, `72px ${FONT_BIG}`, '#ffffff', null, 0, 'left');
    outlinedText(ctx, B.code, SX + 310, cy + 4, `72px ${FONT_BIG}`, '#ffffff', null, 0, 'right');
    const pulseA = g.t - (B.hitT >= 0 ? B.hitT : -9), pulseB = g.t - (A.hitT >= 0 ? A.hitT : -9);
    const sa = pulseA < 0.5 ? 1 + 0.35 * Math.sin(pulseA / 0.5 * Math.PI) : 1, sb = pulseB < 0.5 ? 1 + 0.35 * Math.sin(pulseB / 0.5 * Math.PI) : 1;
    ctx.save(); ctx.translate(SX - 70, cy + 4); ctx.scale(sa, sa); outlinedText(ctx, String(A.score), 0, 0, `96px ${FONT_BIG}`, '#ffffff', null, 0); ctx.restore();
    outlinedText(ctx, '–', SX, cy + 2, `80px ${FONT_BIG}`, 'rgba(255,255,255,0.7)', null, 0);
    ctx.save(); ctx.translate(SX + 70, cy + 4); ctx.scale(sb, sb); outlinedText(ctx, String(B.score), 0, 0, `96px ${FONT_BIG}`, '#ffffff', null, 0); ctx.restore();
    let label, col = '#ffffff';
    if (g.goldenGoal) { const x = Math.floor(g.t - g.ggStart); label = `+0:${String(x).padStart(2, '0')}`; col = '#FFD54F'; }
    else { const s = Math.ceil(g.derbyLeft); label = `0:${String(s).padStart(2, '0')}`; if (s <= 5) col = '#ff6b6b'; }
    outlinedText(ctx, label, SX, 426, `30px ${FONT_BIG}`, col, null, 0);
    ctx.restore();
  },

  /* final duel score (first to CONFIG.FINAL_GOALS) in the band under the pitch: top team on the left */
  duelScore(ctx, g, SX) {
    const [ia, ib] = g.rectTeams || [], A = g.teams[ia], B = g.teams[ib];
    if (!A || !B) return;
    ctx.save();
    const cy = 1436;
    roundRect(ctx, SX - 360, cy - 52, 720, 104, 30);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(SX - 315, cy, 22, 0, TAU); ctx.fillStyle = A.c1; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = A.c2; ctx.stroke();
    ctx.beginPath(); ctx.arc(SX + 315, cy, 22, 0, TAU); ctx.fillStyle = B.c1; ctx.fill(); ctx.strokeStyle = B.c2; ctx.stroke();
    outlinedText(ctx, A.code, SX - 280, cy + 4, `72px ${FONT_BIG}`, '#ffffff', null, 0, 'left');
    outlinedText(ctx, B.code, SX + 280, cy + 4, `72px ${FONT_BIG}`, '#ffffff', null, 0, 'right');
    const pulseA = g.t - (B.hitT >= 0 ? B.hitT : -9), pulseB = g.t - (A.hitT >= 0 ? A.hitT : -9);
    const sa = pulseA < 0.5 ? 1 + 0.35 * Math.sin(pulseA / 0.5 * Math.PI) : 1, sb = pulseB < 0.5 ? 1 + 0.35 * Math.sin(pulseB / 0.5 * Math.PI) : 1;
    ctx.save(); ctx.translate(SX - 70, cy + 4); ctx.scale(sa, sa); outlinedText(ctx, String(A.score), 0, 0, `96px ${FONT_BIG}`, '#ffffff', null, 0); ctx.restore();
    outlinedText(ctx, '–', SX, cy + 2, `80px ${FONT_BIG}`, 'rgba(255,255,255,0.7)', null, 0);
    ctx.save(); ctx.translate(SX + 70, cy + 4); ctx.scale(sb, sb); outlinedText(ctx, String(B.score), 0, 0, `96px ${FONT_BIG}`, '#ffffff', null, 0); ctx.restore();
    outlinedText(ctx, `FIRST TO ${CONFIG.FINAL_GOALS} WINS`, SX, cy + 74, `600 26px ${FONT_UI}`, 'rgba(255,255,255,0.75)', null, 0);
    ctx.restore();
  },

  /* single announcement lane: above the pitch (arena) or in the bottom band (derby, under the scoreboard layout) */
  announcement(ctx, y) {
    const a = FX.ann;
    if (!a) return;
    const t = FX.ut - a.t;
    const leaving = FX.annQ.length ? Math.max(0, FX.ANN_MIN - 0.12) : a.dur - 0.25;
    const alpha = t > leaving ? clamp01(1 - (t - leaving) / 0.12 * (FX.annQ.length ? 1 : 0.5)) : 1;
    const s = easeOutBack(t / 0.35, 2.4);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(510, y); ctx.scale(s, s);
    if (a.kind === 'big') {
      let fs = 118; ctx.font = `${fs}px ${FONT_BIG}`;
      while (ctx.measureText(a.text).width > 880 && fs > 50) { fs -= 4; ctx.font = `${fs}px ${FONT_BIG}`; }
      ctx.rotate(-0.025);
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20;
      outlinedText(ctx, a.text, 0, 4, `${fs}px ${FONT_BIG}`, '#ffffff', a.color, 14);
      ctx.shadowBlur = 0;
      outlinedText(ctx, a.text, 0, 4, `${fs}px ${FONT_BIG}`, '#ffffff', null, 0);
    } else {
      const elim = a.kind === 'elim';
      let fs = elim ? 76 : 56; ctx.font = `${fs}px ${FONT_BIG}`;
      while (ctx.measureText(a.text).width > (elim ? 860 : 820) && fs > 28) { fs -= 2; ctx.font = `${fs}px ${FONT_BIG}`; }
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
   END SCREEN  (winner card → animated league table → "See you tomorrow")
   ===================================================================== */
const EndScreen = {
  draw(ctx, e, et) {
    const SX = 510;
    ctx.save();
    ctx.fillStyle = `rgba(4,6,12,${0.88 * clamp01(et / 0.35)})`;
    ctx.fillRect(0, 0, 1080, 1920);
    if (et < 2.1) this.card(ctx, e, et, SX);
    if (et >= 1.9 && et < 5.8) this.table(ctx, e, et - 2, SX);
    for (const p of FX.endParts) {
      if (et > 2.3) break;
      ctx.save(); ctx.globalAlpha = clamp01((2.3 - et) / 0.3); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * (0.3 + 0.7 * Math.abs(Math.cos(p.rot))));
      ctx.restore();
    }
    if (et >= 5.5) {
      const t = et - 5.5;
      ctx.fillStyle = `rgba(0,0,0,${0.85 * clamp01(t / 0.5)})`; ctx.fillRect(0, 0, 1080, 1920);
      const s = easeOutBack(t / 0.4, 2);
      ctx.save(); ctx.translate(SX, 935); ctx.scale(s, s);
      outlinedText(ctx, 'See you tomorrow ⚽', 0, 0, `104px ${FONT_BIG}`, '#ffffff', null, 0);
      ctx.restore();
    }
    ctx.restore();
  },
  card(ctx, e, et, SX) {
    const W = e.winner;
    const inS = easeOutBack(et / 0.5, 1.8);
    const out = et > 1.8 ? clamp01((2.1 - et) / 0.3) : 1;
    ctx.save();
    ctx.globalAlpha = out;
    ctx.translate(SX, 945); ctx.scale(inS * (0.9 + 0.1 * out), inS * (0.9 + 0.1 * out));
    const w = 780, h = 840;
    ctx.shadowColor = rgba(W.c1, 0.7); ctx.shadowBlur = 60;
    roundRect(ctx, -w / 2, -h / 2, w, h, 48);
    const gr = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    gr.addColorStop(0, shade(W.c1, 0.15)); gr.addColorStop(1, shade(W.c1, -0.55));
    ctx.fillStyle = gr; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 10; ctx.strokeStyle = W.c2; ctx.stroke();
    /* rays */
    ctx.save(); roundRect(ctx, -w / 2, -h / 2, w, h, 48); ctx.clip();
    ctx.globalAlpha *= 0.12; ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 14; i++) { const a = i * TAU / 14 + et * 0.5; ctx.beginPath(); ctx.moveTo(0, -150); ctx.arc(0, -150, 900, a, a + 0.12); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    const ts = 1 + 0.06 * Math.sin(et * 6);
    ctx.save(); ctx.translate(0, -170); ctx.scale(ts, ts);
    ctx.font = `230px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🏆', 0, 0);
    ctx.restore();
    const light = luminance(W.c1) > 0.62;
    const txt = light ? '#111111' : '#ffffff';
    outlinedText(ctx, e.champion ? 'CHAMPION' : 'WINNER', 0, 85, `170px ${FONT_BIG}`, txt, null, 0);
    let fs = 92; ctx.font = `${fs}px ${FONT_BIG}`;
    while (ctx.measureText(upTR(W.name)).width > w - 80 && fs > 40) { fs -= 4; ctx.font = `${fs}px ${FONT_BIG}`; }
    outlinedText(ctx, upTR(W.name), 0, 205, `${fs}px ${FONT_BIG}`, txt, null, 0);
    outlinedText(ctx, e.subtitle, 0, 300, `600 34px ${FONT_UI}`, light ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)', null, 0);
    ctx.restore();
  },
  table(ctx, e, tt, SX) {
    const fadeIn = clamp01(tt / 0.3), fadeOut = tt > 3.4 ? clamp01((3.8 - tt) / 0.4) : 1;
    const alpha = Math.min(fadeIn, fadeOut);
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha;
    const ts = easeOutBack(tt / 0.4, 2);
    ctx.save(); ctx.translate(SX, 430); ctx.scale(ts, ts);
    outlinedText(ctx, e.champion ? 'FINAL STANDINGS' : 'LEAGUE TABLE', 0, 0, `110px ${FONT_BIG}`, '#ffffff', null, 0);
    ctx.restore();
    const X0 = 70, W = 880, top = 545, rh = 104;
    outlinedText(ctx, 'TEAM', X0 + 150, top - 26, `600 24px ${FONT_UI}`, 'rgba(255,255,255,0.55)', null, 0, 'left');
    outlinedText(ctx, 'P', X0 + W - 250, top - 26, `600 24px ${FONT_UI}`, 'rgba(255,255,255,0.55)', null, 0);
    outlinedText(ctx, 'PTS', X0 + W - 70, top - 26, `600 24px ${FONT_UI}`, 'rgba(255,255,255,0.55)', null, 0);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, top - 4, 1080, rh * 8 + 4); ctx.clip();
    const moveP = easeInOutCubic((tt - 1.8) / 0.7);
    const countP = easeOutCubic((tt - 0.9) / 0.7);
    for (const r of e.rows) {
      const pos = lerp(r.oldRank, r.newRank, moveP);
      if (pos > 8.5) continue;
      const enter = easeOutCubic((tt - 0.05 * Math.min(r.oldRank, 8)) / 0.4);
      const x = X0 + (1 - enter) * 500, y = top + pos * rh;
      ctx.save(); ctx.globalAlpha *= enter;
      roundRect(ctx, x, y + 6, W, rh - 12, 22);
      ctx.fillStyle = r.today ? rgba(r.c1, 0.32) : 'rgba(255,255,255,0.07)'; ctx.fill();
      if (r.today) { ctx.lineWidth = 3; ctx.strokeStyle = rgba(r.c1, 0.9); ctx.stroke(); }
      ctx.fillStyle = r.c1; roundRect(ctx, x, y + 6, 14, rh - 12, 7); ctx.fill();
      const rank = Math.round(pos) + 1;
      outlinedText(ctx, String(rank), x + 54, y + rh / 2 + 3, `56px ${FONT_BIG}`, '#ffffff', null, 0);
      ctx.beginPath(); ctx.arc(x + 140, y + rh / 2, 20, 0, TAU); ctx.fillStyle = r.c1; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = r.c2; ctx.stroke();
      let fs = 50; ctx.font = `${fs}px ${FONT_BIG}`;
      while (ctx.measureText(upTR(r.name)).width > 370 && fs > 30) { fs -= 2; ctx.font = `${fs}px ${FONT_BIG}`; }
      outlinedText(ctx, upTR(r.name), x + 174, y + rh / 2 + 3, `${fs}px ${FONT_BIG}`, '#ffffff', null, 0, 'left');
      outlinedText(ctx, String(r.played), x + W - 250, y + rh / 2 + 2, `600 30px ${FONT_UI}`, 'rgba(255,255,255,0.75)', null, 0);
      const pts = Math.round(lerp(r.oldPts, r.newPts, countP));
      outlinedText(ctx, String(pts), x + W - 70, y + rh / 2 + 3, `60px ${FONT_BIG}`, '#ffffff', null, 0);
      if (r.delta > 0 && tt > 0.35 && tt < 2.8) {
        const s = easeOutBack((tt - 0.35) / 0.35, 2.6), a = tt > 2.4 ? (2.8 - tt) / 0.4 : 1;
        ctx.save(); ctx.globalAlpha *= clamp01(a); ctx.translate(x + W - 150, y + rh / 2); ctx.scale(s, s);
        roundRect(ctx, -46, -24, 92, 48, 24); ctx.fillStyle = '#00C853'; ctx.fill();
        outlinedText(ctx, `+${r.delta}`, 0, 3, `42px ${FONT_BIG}`, '#ffffff', null, 0);
        ctx.restore();
      }
      if (tt > 2.5) {
        const s = easeOutBack((tt - 2.5) / 0.3, 2.5);
        ctx.save(); ctx.translate(x + 96, y + rh / 2); ctx.scale(s, s);
        if (r.newRank < r.oldRank) outlinedText(ctx, '▲', 0, 0, `34px ${FONT_UI}`, '#00E676', null, 0);
        else if (r.newRank > r.oldRank) outlinedText(ctx, '▼', 0, 0, `34px ${FONT_UI}`, '#FF5252', null, 0);
        else outlinedText(ctx, '–', 0, 0, `34px ${FONT_UI}`, 'rgba(255,255,255,0.45)', null, 0);
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();
  },
};
