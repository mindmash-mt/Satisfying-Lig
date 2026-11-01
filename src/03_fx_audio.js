/* =====================================================================
   THEMES  (visual palettes; gameplay modifiers are in THEME_DEFS)
   ===================================================================== */
const THEMES = {
  classic: { bg1: '#03110a', bg2: '#0b3019', bg3: '#14532d', f1: '#1f7d3d', f2: '#1a6f35', line: 'rgba(255,255,255,0.78)',
    wall: '#ffffff', wallGlow: 'rgba(255,255,255,0.13)', net: 'rgba(255,255,255,0.38)' },
  snow:    { bg1: '#7fa9cf', bg2: '#d7e9f8', bg3: '#ffffff', f1: '#eef6fd', f2: '#e0edf8', line: 'rgba(60,110,170,0.55)',
    wall: '#2d5b8c', wallGlow: 'rgba(45,91,140,0.16)', net: 'rgba(40,80,130,0.45)' },
  rain:    { bg1: '#02060b', bg2: '#0c1925', bg3: '#1b3348', f1: '#163b2b', f2: '#123222', line: 'rgba(210,230,255,0.55)',
    wall: '#cfdae4', wallGlow: 'rgba(190,215,255,0.12)', net: 'rgba(210,230,255,0.33)' },
  night:   { bg1: '#000000', bg2: '#04060c', bg3: '#0a1630', f1: '#0b1d13', f2: '#09180f', line: 'rgba(140,255,190,0.32)',
    wall: '#b8ffd6', wallGlow: 'rgba(110,255,170,0.22)', net: 'rgba(170,255,210,0.30)' },
  bumpers: { bg1: '#04101c', bg2: '#0b2b33', bg3: '#7a1020', f1: '#1f7d3d', f2: '#1a6f35', line: 'rgba(255,255,255,0.78)',
    wall: '#ffffff', wallGlow: 'rgba(255,255,255,0.13)', net: 'rgba(255,255,255,0.38)' },
};
const FONT_BIG = '"Bebas Neue", Impact, "Arial Narrow", sans-serif';
const FONT_UI = 'Inter, system-ui, sans-serif';

/* =====================================================================
   EFFECTS  (visual-only; uses its own PRNG so gameplay stays deterministic)
   ===================================================================== */
const vrng = new RNG(20240601);
const FX = {
  game: null,
  parts: [], floats: [], ann: null, annQ: [], feed: [], ripples: {}, flashes: {}, pops: [],
  shakeT: 0, shakeDur: 0.25, shakeMag: 0, wt: 0, ut: 0,
  cam: { k: 0, x: CONFIG.CX, y: CONFIG.CY },
  weather: [], splashes: [], endParts: [],
  reset(game) {
    this.game = game;
    this.parts = []; this.floats = []; this.ann = null; this.annQ = []; this.feed = []; this.ripples = {}; this.flashes = {}; this.pops = [];
    this.shakeT = 0; this.wt = 0; this.cam = { k: 0, x: CONFIG.CX, y: CONFIG.CY }; this.endParts = [];
    vrng.reseed(((game.o.seed >>> 0) * 31 + 7) >>> 0);
    this.initWeather(game.themeId);
  },
  initWeather(id) {
    this.weather = []; this.splashes = [];
    if (id === 'snow') for (let i = 0; i < 150; i++) this.weather.push({ x: vrng.range(0, 1080), y: vrng.range(0, 1920), r: vrng.range(2, 6), vy: vrng.range(50, 120), ph: vrng.range(0, TAU), a: vrng.range(0.5, 0.95) });
    if (id === 'rain') for (let i = 0; i < 130; i++) this.weather.push({ x: vrng.range(0, 1300), y: vrng.range(0, 1920), len: vrng.range(26, 46), vy: vrng.range(1300, 1700), a: vrng.range(0.18, 0.4) });
  },
  shake(dur, mag) { this.shakeT = Math.max(this.shakeT, dur); this.shakeDur = dur; this.shakeMag = Math.max(mag, this.shakeT > 0 ? this.shakeMag : 0); },
  team(i) { return this.game && i >= 0 ? this.game.teams[i] : null; },
  addFeed(text, color) { this.feed.push({ text, color: color || '#ffffff', t: this.ut }); if (this.feed.length > 6) this.feed.shift(); },
  /* Announcements (GOAL!, SAVE!, OVERTIME, power-ups, eliminations) share ONE lane above the pitch.
     A newcomer waits until the current one has been visible for ANN_MIN seconds, so texts never overlap
     and nothing is written over the pitch. */
  ANN_MIN: 0.55,
  announce(item) {
    item = Object.assign({ kind: 'big', color: '#ffffff', dur: 1.2 }, item);
    if (this.annQ.some(q => q.text === item.text) || (this.ann && this.ann.text === item.text && this.ut - this.ann.t < 0.3)) return;
    if (!this.ann) { item.t = this.ut; this.ann = item; return; }
    this.annQ.push(item);
    if (this.annQ.length > 3) this.annQ.splice(this.annQ.findIndex(q => q.low) >= 0 ? this.annQ.findIndex(q => q.low) : 0, 1);
  },
  addBig(text, color, size, dur) { this.announce({ kind: 'big', text, color, dur: dur || 1.2 }); },
  addBanner(text, color) { this.announce({ kind: 'pill', text, color: color || '#FFD54F', dur: 1.6 }); },
  sparks(x, y, nx, ny, n, color) {
    for (let i = 0; i < n; i++) {
      const a = (nx || ny) ? Math.atan2(ny, nx) + vrng.range(-1.2, 1.2) : vrng.range(0, TAU);
      const s = vrng.range(160, 420);
      this.parts.push({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: vrng.range(0.14, 0.26), color, size: vrng.range(2, 3.5) });
    }
  },
  ring(x, y, color, r) { this.parts.push({ k: 'ring', x, y, life: 0, max: 0.35, color, size: r || 40 }); },
  confetti(x, y, nx, ny, n, colors) {
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(-ny, -nx) + vrng.range(-1.1, 1.1), s = vrng.range(280, 820);
      this.parts.push({ k: 'conf', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: 0, max: vrng.range(0.9, 1.5),
        color: colors[i % colors.length], size: vrng.range(7, 13), rot: vrng.range(0, TAU), vr: vrng.range(-12, 12) });
    }
  },
  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = vrng.range(0, TAU), s = vrng.range(120, 360);
      this.parts.push({ k: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: vrng.range(0.3, 0.6), color, size: vrng.range(3, 6) });
    }
  },
  startEndConfetti(colors) {
    this.endParts = [];
    for (let i = 0; i < 140; i++) this.endParts.push({ x: vrng.range(40, 1040), y: vrng.range(-900, 150), vy: vrng.range(220, 520), vx: vrng.range(-60, 60),
      rot: vrng.range(0, TAU), vr: vrng.range(-8, 8), size: vrng.range(10, 18), color: colors[i % colors.length], ph: vrng.range(0, TAU) });
  },

  onEvent(type, d) {
    const g = this.game; if (!g) return;
    switch (type) {
      case 'wall': case 'post': case 'goalWallHit':
        this.sparks(d.x, d.y, d.nx, d.ny, vrng.int(4, 6), '#ffffff'); AudioSys.bounce(d.speed); break;
      case 'ballball': this.sparks(d.x, d.y, 0, 0, 3, '#ffffff'); AudioSys.ballball(); break;
      case 'player': { const T = this.team(d.team); this.ring(d.x, d.y, T.c1, 34); AudioSys.tup(1); break; }
      case 'keeperHit': AudioSys.tup(0.7); break;
      case 'bumper': this.ring(d.x, d.y, '#ff5252', 70); AudioSys.boing(); break;
      case 'save': {
        const T = this.team(d.team);
        this.burst(d.x, d.y, '#ffffff', 10); this.ring(d.x, d.y, T.c1, 60);
        AudioSys.save(); break;
      }
      case 'goal': {
        const T = this.team(d.team), S = d.scorer >= 0 ? this.team(d.scorer) : null;
        this.ripples[d.team] = { a: d.along, t: this.wt };
        this.flashes[d.team] = this.wt;
        this.shake(0.25, 18);
        const cols = S && !d.own ? [S.c1, S.c2, '#ffffff'] : ['#ffffff', T.c1, '#FFD54F'];
        this.confetti(d.x, d.y, d.nx, d.ny, 40, cols);
        AudioSys.goal(); if (d.own) AudioSys.wahwah();
        break;
      }
      case 'eliminate': {
        const T = this.team(d.team);
        /* the only on-screen texts during play: who went out, in which place, how many points */
        const pts = App.pointsForPlace(d.place);
        this.addFeed(`❌ ${upTR(T.name)} · ${ordinal(d.place)}${pts === null ? '' : ` · +${pts} PTS`}`, T.c1);
        this.addBanner(`❌ ${upTR(T.name)} ELIMINATED`, T.c1);
        this.shake(0.3, 10); AudioSys.eliminate(); break;
      }
      case 'powerup': {
        const T = this.team(d.team);
        this.burst(d.x, d.y, '#FFD54F', 18); this.ring(d.x, d.y, '#FFD54F', 80);
        AudioSys.powerup(); break;
      }
      case 'puSpawn': this.ring(d.x, d.y, '#FFD54F', 50); AudioSys.pop(0.6); break;
      case 'puExpire': this.burst(d.x, d.y, 'rgba(255,255,255,0.7)', 6); break;
      case 'spawnBall': if (!d.initial) { this.pops.push({ x: d.x, y: d.y, t: this.wt }); AudioSys.pop(1); } break;
      case 'overtime':
        AudioSys.whistle(0.45, 0.25); break;
      case 'finalDuel': AudioSys.whoosh(); break;
      case 'goldenGoal': AudioSys.whistle(0.5, 0.25); break;
      case 'morphStart': AudioSys.whoosh(); break;
      case 'win': AudioSys.finalWhistle(); break;
    }
  },

  update(dtW, dtR) {
    this.wt += dtW; this.ut += dtR;
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dtR);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dtW;
      if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
      if (p.k === 'spark' || p.k === 'dot') { p.x += p.vx * dtW; p.y += p.vy * dtW; const f = Math.exp(-5 * dtW); p.vx *= f; p.vy *= f; }
      else if (p.k === 'conf') { p.vy += 900 * dtW; const f = Math.exp(-2.2 * dtW); p.vx *= f; p.vy *= f; p.x += p.vx * dtW; p.y += p.vy * dtW; p.rot += p.vr * dtW; }
    }
    this.floats = this.floats.filter(f => this.ut - f.t < 1.0);
    if (this.ann) {
      const age = this.ut - this.ann.t;
      if (age >= this.ann.dur || (this.annQ.length && age >= this.ANN_MIN)) this.ann = null;
    }
    if (!this.ann && this.annQ.length) { this.ann = this.annQ.shift(); this.ann.t = this.ut; }
    this.pops = this.pops.filter(p => this.wt - p.t < 0.5);
    for (const w of this.weather) {
      if (w.len) { w.y += w.vy * dtR; w.x -= w.vy * 0.28 * dtR; if (w.y > 1940) { w.y = -40; w.x = vrng.range(0, 1400); } }
      else { w.y += w.vy * dtR; w.x += Math.sin(this.ut * 1.3 + w.ph) * 22 * dtR; if (w.y > 1930) { w.y = -10; w.x = vrng.range(0, 1080); } }
    }
    if (this.game && this.game.themeId === 'rain' && dtR > 0 && vrng.next() < dtR * 14) {
      const r = Math.sqrt(vrng.next()) * 330, a = vrng.range(0, TAU);
      this.splashes.push({ x: CONFIG.CX + Math.cos(a) * r, y: CONFIG.CY + Math.sin(a) * r, t: this.ut });
    }
    this.splashes = this.splashes.filter(s => this.ut - s.t < 0.7);
    for (const p of this.endParts) { p.y += p.vy * dtR; p.x += (p.vx + Math.sin(this.ut * 3 + p.ph) * 50) * dtR; p.rot += p.vr * dtR; if (p.y > 1960) { p.y = vrng.range(-200, -20); } }
    /* camera: zoom toward goal during final-duel slow motion */
    const g = this.game;
    let target = 0;
    if (g && g.slowmo && g.t < g.slowmo.until && !g.over) { target = 1; this.cam.x = g.slowmo.x; this.cam.y = g.slowmo.y; }
    this.cam.k += (target - this.cam.k) * Math.min(1, dtR * 6);
  },
};

/* =====================================================================
   AUDIO  (Web Audio synthesis — no external files)
   master gain → compressor → speakers + MediaStreamAudioDestinationNode (recording)
   ===================================================================== */
const AudioSys = {
  ctx: null, master: null, comp: null, recDest: null, noiseBuf: null,
  vol: 0.8, muted: false, rl: {}, enabled: true,
  init() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    } catch (e) { return false; }
    const c = this.ctx;
    this.master = c.createGain();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.knee.value = 10; this.comp.ratio.value = 4;
    this.comp.attack.value = 0.003; this.comp.release.value = 0.2;
    this.master.connect(this.comp);
    this.comp.connect(c.destination);
    this.recDest = c.createMediaStreamDestination();
    this.comp.connect(this.recDest);
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.apply();
    return true;
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  apply() { if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol, this.ctx.currentTime, 0.02); },
  ready() { return this.enabled && this.ctx && this.ctx.state === 'running'; },
  limit(key, n, win) {
    const now = this.ctx.currentTime;
    const arr = (this.rl[key] = (this.rl[key] || []).filter(t => now - t < win));
    if (arr.length >= n) return false;
    arr.push(now); return true;
  },
  tone(type, f, dur, gain, opt = {}) {
    const c = this.ctx, t = c.currentTime + (opt.delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (opt.f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.f2), t + (opt.glide || dur));
    const at = opt.attack || 0.003;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + at);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (opt.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = opt.lp; o.connect(fl); node = fl; }
    node.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  },
  noise(dur, gain, opt = {}) {
    const c = this.ctx, t = c.currentTime + (opt.delay || 0);
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = opt.type || 'bandpass';
    fl.frequency.setValueAtTime(opt.f || 1000, t);
    if (opt.f2) fl.frequency.exponentialRampToValueAtTime(opt.f2, t + dur);
    fl.Q.value = opt.Q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + (opt.attack || 0.005));
    if (opt.hold) g.gain.setValueAtTime(gain, t + opt.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  },
  bounce(speed) {
    if (!this.ready() || !this.limit('b', 3, 0.025)) return;
    const f = 360 + Math.min(1600, speed || 600) * 0.35 + vrng.range(-45, 45);
    this.tone('triangle', f, 0.03, 0.16); this.tone('sine', f * 2.01, 0.02, 0.05);
  },
  ballball() { if (!this.ready() || !this.limit('bb', 3, 0.025)) return; this.tone('triangle', 1150 + vrng.range(-90, 90), 0.03, 0.15); },
  tup(k) {
    if (!this.ready() || !this.limit('tup', 3, 0.04)) return;
    this.tone('sine', 230, 0.09, 0.3 * k, { f2: 140 }); this.noise(0.05, 0.06 * k, { type: 'lowpass', f: 900 });
  },
  save() {
    if (!this.ready() || !this.limit('save', 2, 0.1)) return;
    this.tone('sine', 120, 0.24, 0.55, { f2: 50 }); this.noise(0.12, 0.35, { type: 'lowpass', f: 700 }); this.tone('triangle', 190, 0.08, 0.2);
  },
  boing() {
    if (!this.ready() || !this.limit('boing', 2, 0.06)) return;
    const o = this.tone('sine', 190, 0.32, 0.35, { f2: 560, glide: 0.12 });
    const c = this.ctx, lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 22; lg.gain.value = 40;
    lfo.connect(lg); lg.connect(o.frequency); lfo.start(); lfo.stop(c.currentTime + 0.35);
    this.tone('triangle', 380, 0.18, 0.08, { f2: 900 });
  },
  pop(k) { if (!this.ready() || !this.limit('pop', 2, 0.08)) return; this.tone('sine', 520, 0.08, 0.13 * k, { f2: 980 }); },
  whistle(dur, gain, delay) {
    if (!this.ready()) return;
    const c = this.ctx, t = c.currentTime + (delay || 0);
    [2850, 2990].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), bp = c.createBiquadFilter();
      o.type = i ? 'sine' : 'square'; o.frequency.value = f; lfo.frequency.value = 32; lg.gain.value = 90;
      bp.type = 'bandpass'; bp.frequency.value = 2900; bp.Q.value = 3;
      lfo.connect(lg); lg.connect(o.frequency); o.connect(bp); bp.connect(g); g.connect(this.master);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain * (i ? 0.6 : 0.5), t + 0.02);
      g.gain.setValueAtTime(gain * (i ? 0.6 : 0.5), t + dur - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    });
  },
  crowd(dur, gain, delay) {
    if (!this.ready()) return;
    this.noise(dur, gain, { type: 'bandpass', f: 650, Q: 0.7, attack: 0.18, hold: dur * 0.35, delay });
    this.noise(dur, gain * 0.55, { type: 'bandpass', f: 1500, Q: 0.9, attack: 0.25, hold: dur * 0.3, delay });
    this.noise(dur * 0.8, gain * 0.4, { type: 'lowpass', f: 300, attack: 0.1, delay });
  },
  goal() { if (!this.ready() || !this.limit('goal', 2, 0.15)) return; this.whistle(0.28, 0.22); this.crowd(1.2, 0.5, 0.05); },
  wahwah() {
    if (!this.ready()) return;
    [[392, 370], [370, 349], [349, 330], [330, 262]].forEach(([a, b], i) =>
      this.tone('sawtooth', a, i === 3 ? 0.6 : 0.26, 0.16, { f2: b, delay: 0.25 + i * 0.27, lp: 900, attack: 0.03 }));
  },
  eliminate() {
    if (!this.ready()) return;
    this.tone('sine', 85, 0.8, 0.8, { f2: 28 }); this.noise(0.6, 0.35, { type: 'lowpass', f: 220 });
    this.tone('square', 2400, 0.025, 0.13, { delay: 0.14 }); this.tone('square', 1600, 0.035, 0.12, { delay: 0.17 });
    this.noise(0.04, 0.25, { type: 'highpass', f: 4000, delay: 0.14 });
  },
  powerup() {
    if (!this.ready()) return;
    [880, 1108.7, 1318.5].forEach((f, i) => { this.tone('triangle', f, 0.14, 0.2, { delay: i * 0.07 }); this.tone('sine', f * 2, 0.1, 0.06, { delay: i * 0.07 }); });
  },
  whoosh() { if (!this.ready()) return; this.noise(0.7, 0.22, { type: 'bandpass', f: 300, f2: 2400, Q: 1.5, attack: 0.3 }); },
  finalWhistle() {
    if (!this.ready()) return;
    this.whistle(1.15, 0.24); this.crowd(2.8, 0.6, 0.1);
    [261.6, 329.6, 392, 523.3].forEach((f, i) => this.tone('sawtooth', f, 1.9, 0.09, { delay: 0.35 + i * 0.02, lp: 1800, attack: 0.04 }));
  },
};
