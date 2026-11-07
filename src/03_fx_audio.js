/* =====================================================================
   THEMES  (visual palettes; gameplay modifiers are in THEME_DEFS)
   ===================================================================== */
/* pitch lines are always white in every theme; on the light snow floor they get a soft blue shadow so they still read */
const LINE_WHITE = 'rgba(255,255,255,0.85)';
const THEMES = {
  classic: { bg1: '#03110a', bg2: '#0b3019', bg3: '#14532d', f1: '#1f7d3d', f2: '#1a6f35', line: LINE_WHITE,
    wall: '#ffffff', wallGlow: 'rgba(255,255,255,0.13)', net: 'rgba(255,255,255,0.38)' },
  snow:    { bg1: '#7fa9cf', bg2: '#d7e9f8', bg3: '#ffffff', f1: '#eef6fd', f2: '#e0edf8', line: LINE_WHITE,
    wall: '#2d5b8c', wallGlow: 'rgba(45,91,140,0.16)', net: 'rgba(40,80,130,0.45)', lineShadow: 'rgba(30,70,120,0.75)' },
  rain:    { bg1: '#02060b', bg2: '#0c1925', bg3: '#1b3348', f1: '#163b2b', f2: '#123222', line: LINE_WHITE,
    wall: '#cfdae4', wallGlow: 'rgba(190,215,255,0.12)', net: 'rgba(210,230,255,0.33)' },
  night:   { bg1: '#000000', bg2: '#04060c', bg3: '#0a1630', f1: '#0b1d13', f2: '#09180f', line: LINE_WHITE,
    wall: '#b8ffd6', wallGlow: 'rgba(110,255,170,0.22)', net: 'rgba(170,255,210,0.30)' },
};
const FONT_BIG = '"Bebas Neue", Impact, "Arial Narrow", sans-serif';
const FONT_UI = 'Inter, system-ui, sans-serif';

/* =====================================================================
   EFFECTS  (visual-only; uses its own PRNG so gameplay stays deterministic)
   ===================================================================== */
const vrng = new RNG(20240601);
const FX = {
  game: null,
  parts: [], floats: [], ann: null, annQ: [], ripples: {}, flashes: {}, pops: [],
  shakeT: 0, shakeDur: 0.25, shakeMag: 0, wt: 0, ut: 0,
  cam: { k: 0, x: CONFIG.CX, y: CONFIG.CY },
  weather: [], splashes: [], endParts: [],
  reset(game) {
    this.game = game;
    this.parts = []; this.floats = []; this.ann = null; this.annQ = []; this.ripples = {}; this.flashes = {}; this.pops = [];
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
  /* Announcements (the goal and the new score, HALF TIME, GOLDEN GOAL!, PENALTIES!) share ONE lane above the pitch.
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
      case 'wall': case 'post':
        this.sparks(d.x, d.y, d.nx, d.ny, vrng.int(4, 6), '#ffffff'); AudioSys.bounce(d.speed); break;
      case 'player': { const T = this.team(d.team); this.ring(d.x, d.y, T.c1, 34); AudioSys.tup(1); break; }
      case 'keeperHit': AudioSys.tup(0.7); break;
      case 'captainShot': { const T = this.team(d.team); this.ring(d.x, d.y, '#FFD54F', 70); this.burst(d.x, d.y, T.c1, 12); this.shake(0.12, 6); AudioSys.shot(); break; }
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
        AudioSys.goal();
        /* "+ ARSENAL GOAL" and under it the new score. Every goal is the other club's goal (a keeper's deflection
           into its own net is common here, so it is not called an own goal on screen) */
        const B = this.team(d.benefit), [A0, A1] = g.teams;
        const goal = { text: `${upTR(B.name)} GOAL`, c1: B.c1, c2: B.c2, plus: true };
        this.announce({ kind: 'score', text: `${A0.code} ${d.score[0]} – ${d.score[1]} ${A1.code}${d.golden ? ' · GOLDEN GOAL' : ''}`, color: B.c1, goal, dur: 1.9 });
        break;
      }
      case 'kickoff': AudioSys.whistle(0.5, 0.22); if (d.half === 2) this.announce({ kind: 'big', text: 'SECOND HALF', color: '#00C853', dur: 1.2 }); break;
      case 'halfTime': this.announce({ kind: 'big', text: 'HALF TIME', color: '#FFB300', dur: 2.2 }); AudioSys.whistle(0.35, 0.24); AudioSys.whistle(0.7, 0.24, 0.45); break;
      case 'countdown': AudioSys.tick(d.n <= 3 ? 1 : 0.6); break;
      case 'goldenGoal': this.announce({ kind: 'big', text: 'GOLDEN GOAL!', color: '#FFB300', dur: 1.8 }); AudioSys.whistle(0.6, 0.24); break;
      case 'penalties': this.announce({ kind: 'big', text: 'PENALTIES!', color: '#FFB300', dur: 1.6 }); AudioSys.whistle(1.0, 0.24); break;
      case 'penKick': if (d.goal) AudioSys.goal(); else AudioSys.save(); break;
      case 'spawnBall': if (!d.initial) { this.pops.push({ x: d.x, y: d.y, t: this.wt }); AudioSys.pop(1); } break;
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
  /* offline (headless video render): sounds go to an OfflineAudioContext and are timed by `clock` (video seconds) */
  offline: false, clock: null,
  init() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    } catch (e) { return false; }
    this.offline = false; this.clock = null;
    this.build(true);
    return true;
  },
  /* fresh OfflineAudioContext long enough for `seconds` of video (see Offline in 06_offline.js) */
  initOffline(seconds) {
    const rate = 48000;
    this.ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
    this.offline = true; this.clock = 0; this.rl = {};
    this.vol = 0.8; this.muted = false;
    this.build(false);
  },
  build(live) {
    const c = this.ctx;
    this.master = c.createGain();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.knee.value = 10; this.comp.ratio.value = 4;
    this.comp.attack.value = 0.003; this.comp.release.value = 0.2;
    this.master.connect(this.comp);
    this.comp.connect(c.destination);
    this.recDest = null;
    if (live) { this.recDest = c.createMediaStreamDestination(); this.comp.connect(this.recDest); }
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.apply();
  },
  now() { return this.clock != null ? this.clock : this.ctx.currentTime; },
  resume() { if (this.ctx && !this.offline && this.ctx.state === 'suspended') this.ctx.resume(); },
  apply() { if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol, this.now(), 0.02); },
  ready() { return this.enabled && this.ctx && (this.offline || this.ctx.state === 'running'); },
  limit(key, n, win) {
    const now = this.now();
    const arr = (this.rl[key] = (this.rl[key] || []).filter(t => now - t < win));
    if (arr.length >= n) return false;
    arr.push(now); return true;
  },
  tone(type, f, dur, gain, opt = {}) {
    const c = this.ctx, t = this.now() + (opt.delay || 0);
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
    const c = this.ctx, t = this.now() + (opt.delay || 0);
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
  tup(k) {
    if (!this.ready() || !this.limit('tup', 3, 0.04)) return;
    this.tone('sine', 230, 0.09, 0.3 * k, { f2: 140 }); this.noise(0.05, 0.06 * k, { type: 'lowpass', f: 900 });
  },
  save() {
    if (!this.ready() || !this.limit('save', 2, 0.1)) return;
    this.tone('sine', 120, 0.24, 0.55, { f2: 50 }); this.noise(0.12, 0.35, { type: 'lowpass', f: 700 }); this.tone('triangle', 190, 0.08, 0.2);
  },
  /* captain shot: quick rising zap + a short thump */
  shot() {
    if (!this.ready() || !this.limit('shot', 2, 0.08)) return;
    this.tone('sawtooth', 260, 0.16, 0.16, { f2: 1250, lp: 2600 }); this.tone('sine', 140, 0.12, 0.4, { f2: 60 });
  },
  /* last 10 seconds of a match: a short clock tick (louder for the last 3) */
  tick(k) { if (!this.ready() || !this.limit('tick', 1, 0.3)) return; this.tone('square', 1700, 0.035, 0.07 * k, { lp: 3000 }); this.tone('sine', 880, 0.05, 0.08 * k); },
  pop(k) { if (!this.ready() || !this.limit('pop', 2, 0.08)) return; this.tone('sine', 520, 0.08, 0.13 * k, { f2: 980 }); },
  whistle(dur, gain, delay) {
    if (!this.ready()) return;
    const c = this.ctx, t = this.now() + (delay || 0);
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
  finalWhistle() {
    if (!this.ready()) return;
    this.whistle(1.15, 0.24); this.crowd(2.8, 0.6, 0.1);
    [261.6, 329.6, 392, 523.3].forEach((f, i) => this.tone('sawtooth', f, 1.9, 0.09, { delay: 0.35 + i * 0.02, lp: 1800, attack: 0.04 }));
  },
};

/* =====================================================================
   BACKGROUND MUSIC  (live site: plays on the screens without a match in play — the pages, the "Canlı" list, the countdown
   table, a match's intro and end screens — and fades out at kick-off). Several tracks, synthesised like the sound effects
   (no files); each plays for about a minute and a half, then another one follows (never the same twice in a row, every track
   once before any repeats). Music goes through the master gain, so "Ses kapalı" silences it too. Never in a video render.
   ===================================================================== */
/**
 * @typedef {Object} MusicTrack
 * @property {string} name
 * @property {number} lvl        the track's level (evens out how loud the tracks sound)
 * @property {number} bpm
 * @property {number} swing        delay of every second 16th (share of a 16th)
 * @property {Array<[number, number[]]>} chords  one chord a bar: root (MIDI) and intervals
 * @property {Object<string, string>} [drums]   16 steps a bar: k kick, s snare, c clap, h hat, H open hat ('x' full, 'o' soft)
 * @property {{ wave: OscillatorType, pat: string, oct: number, gain: number, lp: number }} [bass]  x root, o octave, 5 fifth, 3 third
 * @property {{ wave: OscillatorType, gain: number, lp: number, attack: number, release: number, detune?: number }} [pad]  the bar's chord, held
 * @property {{ wave: OscillatorType, pat: string, gain: number, lp: number, len: number, oct: number, order: string, lo?: number }} [arp]  chord tones on the pattern's steps (also stabs: order 'chord')
 * @property {{ wave: OscillatorType, pat: string, gain: number, lp: number, oct: number, kind?: string }} [lead]  a motif (32 steps) fitted to the chords, every second pass
 */
const Music = {
  /** @type {MusicTrack[]} */
  TRACKS: [
    { name: 'Gece Lo-fi', lvl: 0.56, bpm: 80, swing: 0.2,
      chords: [[53, [0, 4, 7, 11]], [52, [0, 3, 7, 10]], [50, [0, 3, 7, 10]], [48, [0, 4, 7, 11]]],
      drums: { k: 'x......x..x.....', s: '....x.......x...', h: 'o.o.o.o.o.o.o.oo' },
      bass: { wave: 'sine', pat: 'x.......x..5....', oct: -12, gain: 0.2, lp: 500 },
      pad: { wave: 'triangle', gain: 0.032, lp: 1300, attack: 0.25, release: 0.8 },
      lead: { wave: 'sine', pat: '..x...x.x.....x...x.x...x.......', gain: 0.07, lp: 2500, oct: 12, kind: 'keys' } },
    { name: 'Neon Gece', lvl: 0.85, bpm: 100, swing: 0,
      chords: [[57, [0, 3, 7]], [53, [0, 4, 7]], [48, [0, 4, 7]], [55, [0, 4, 7]]],
      drums: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' },
      bass: { wave: 'sawtooth', pat: 'x.x.x.x.x.x.x.xo', oct: -24, gain: 0.11, lp: 520 },
      pad: { wave: 'sawtooth', gain: 0.018, lp: 900, attack: 0.4, release: 0.6, detune: 9 },
      arp: { wave: 'sawtooth', pat: 'xxxxxxxxxxxxxxxx', gain: 0.03, lp: 2000, len: 0.12, oct: 12, order: 'up' } },
    { name: 'Tribün Funk', lvl: 0.65, bpm: 108, swing: 0.12,
      chords: [[52, [0, 3, 7, 10]], [57, [0, 4, 7, 10]], [52, [0, 3, 7, 10]], [59, [0, 3, 7, 10]]],
      drums: { k: 'x..x..x...x..x..', s: '....x.......x..o', h: 'xoxoxoxoxoxoxoxo' },
      bass: { wave: 'square', pat: 'x..o..x.5.x..o.x', oct: -12, gain: 0.08, lp: 750 },
      arp: { wave: 'square', pat: '....x..x....x.x.', gain: 0.03, lp: 1900, len: 0.09, oct: 0, order: 'chord' },
      lead: { wave: 'square', pat: 'x.x...x...x.x.x.....x.x...x.....', gain: 0.035, lp: 2400, oct: 12 } },
    { name: '8-Bit Marş', lvl: 0.66, bpm: 144, swing: 0,
      chords: [[60, [0, 4, 7]], [55, [0, 4, 7]], [57, [0, 3, 7]], [53, [0, 4, 7]]],
      drums: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
      bass: { wave: 'triangle', pat: 'x.o.x.o.x.o.x.o.', oct: -24, gain: 0.22, lp: 3000 },
      arp: { wave: 'square', pat: 'x.x.x.x.x.x.x.x.', gain: 0.018, lp: 4000, len: 0.07, oct: 0, order: 'updown' },
      lead: { wave: 'square', pat: 'x.x.x...x.x.xx..x...x.x.x.x.....', gain: 0.035, lp: 5000, oct: 12 } },
    { name: 'Tropik Akşam', lvl: 0.61, bpm: 116, swing: 0.06,
      chords: [[52, [0, 3, 7]], [48, [0, 4, 7]], [55, [0, 4, 7]], [50, [0, 4, 7]]],
      drums: { k: 'x...x...x...x...', c: '....x.......x...', h: '..x...x...x...x.' },
      bass: { wave: 'sine', pat: 'x..x..x...x..x..', oct: -12, gain: 0.2, lp: 600 },
      arp: { wave: 'sine', pat: 'x.xx.x.xx.x.x.x.', gain: 0.07, lp: 3000, len: 0.18, oct: 12, order: 'random' },
      lead: { wave: 'triangle', pat: '....x.x.x...x.......x.x.x.x.x...', gain: 0.06, lp: 3000, oct: 24, kind: 'pluck' } },
    { name: 'Soyunma Odası', lvl: 0.75, bpm: 70, swing: 0,
      chords: [[50, [0, 4, 7, 11, 14]], [47, [0, 3, 7, 10, 14]], [43, [0, 4, 7, 11, 14]], [45, [0, 5, 7, 10, 14]]],
      bass: { wave: 'sine', pat: 'x.......5.......', oct: -12, gain: 0.16, lp: 400 },
      pad: { wave: 'triangle', gain: 0.03, lp: 1100, attack: 1.2, release: 2.2, detune: 6 },
      arp: { wave: 'sine', pat: 'x.....x.....x...', gain: 0.045, lp: 6000, len: 1.6, oct: 24, order: 'random', lo: 1 } },
    { name: 'Stadyum Rock', lvl: 0.91, bpm: 126, swing: 0,
      chords: [[50, [0, 7, 12]], [45, [0, 7, 12]], [47, [0, 7, 12]], [43, [0, 7, 12]]],
      drums: { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
      bass: { wave: 'sawtooth', pat: 'x.x.x.x.x.x.x.x.', oct: -12, gain: 0.09, lp: 480 },
      arp: { wave: 'sawtooth', pat: 'x.x.x.x.x.x.x.x.', gain: 0.025, lp: 1500, len: 0.2, oct: 0, order: 'chord' },
      lead: { wave: 'sawtooth', pat: 'x...x...x.x.x.......x...x.x.x...', gain: 0.03, lp: 2600, oct: 12 } },
  ],
  vol: 0.6,                 // the music bus' level (the master volume and mute come after it)
  TRACK_SEC: 90,            // a track plays about this long (whole passes of its chords), then the next one follows
  on: false, ctx: null, out: null, bus: null, timer: 0,
  /** @type {MusicTrack|null} */ track: null,
  ti: -1, bag: [], step: 0, nextT: 0, steps: 0, motif: null,
  /* called every frame: want = music should play now (sound on, no match in play on the screen) */
  want(want) {
    const A = AudioSys, ok = !!(want && A.ctx && !A.offline && !A.muted && A.ctx.state === 'running');
    if (ok === this.on) return;
    this.on = ok;
    if (ok) this.begin(A.ctx, A.master); else this.stop();
  },
  /* start playing (a new track) into dest; live: a timer schedules the notes ahead of time */
  begin(ctx, dest, live = true) {
    this.ctx = ctx; this.out = dest;
    this.play(this.pick(), ctx.currentTime + 0.15);
    if (live && !this.timer) this.timer = setInterval(() => this.pump(), 200);
    if (live) this.pump();
  },
  stop() {
    clearInterval(this.timer); this.timer = 0;
    this.fade(this.bus); this.bus = null; this.track = null;
  },
  /* the next track: every track once in a random order, then a new order (never the one just played first) */
  pick() {
    if (!this.bag.length) {
      const n = this.TRACKS.length, a = [...Array(n).keys()];
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      if (a[0] === this.ti && n > 1) a.push(a.shift());
      this.bag = a;
    }
    return this.ti = /** @type {number} */ (this.bag.shift());
  },
  fade(bus) {
    if (!bus || !this.ctx) return;
    const t = this.ctx.currentTime;
    bus.gain.cancelScheduledValues(t); bus.gain.setTargetAtTime(0, t, 0.35);
    setTimeout(() => { try { bus.disconnect(); } catch (e) { /* gone */ } }, 4000);
  },
  /* track i from time t: a fresh bus (the old one fades out underneath, so tracks cross-fade) */
  play(i, t) {
    const c = this.ctx, T = this.TRACKS[i];
    this.fade(this.bus);
    const bus = c.createGain();
    bus.gain.setValueAtTime(0.0001, t); bus.gain.setTargetAtTime(this.vol * T.lvl, t, 0.7);
    bus.connect(this.out);
    this.bus = bus; this.track = T; this.step = 0; this.nextT = t;
    const bars = T.chords.length, barSec = 240 / T.bpm;
    this.steps = 16 * bars * Math.max(1, Math.round(this.TRACK_SEC / (barSec * bars)));
    this.motif = this.makeMotif(i);
  },
  /* the lead's motif: a gentle random walk over the chord tones, the second half a variation of the first */
  makeMotif(i) {
    const T = this.TRACKS[i];
    if (!T.lead) return null;
    const r = new RNG(7919 * (i + 1)), pat = T.lead.pat, half = pat.length >> 1, out = [];
    let v = 3;
    for (let k = 0; k < pat.length; k++) {
      if (pat[k] !== 'x') { out.push(-1); continue; }
      if (k >= half && k < pat.length - 6 && out[k - half] >= 0) { out.push(out[k - half]); continue; }
      v = Math.max(0, Math.min(7, v + r.int(-2, 2)));
      out.push(v);
    }
    return out;
  },
  /* schedule the notes up to `until` (seconds of the context clock) */
  scheduleUntil(until) {
    while (this.track && this.nextT < until) {
      const T = this.track, sd = 15 / T.bpm, s = this.step;
      if (s >= this.steps) { this.play(this.pick(), this.nextT + sd * 2); continue; }
      this.doStep(T, s, this.nextT + (s % 2 ? T.swing * sd : 0), sd);
      this.step++; this.nextT += sd;
    }
  },
  pump() { if (this.on && this.ctx) this.scheduleUntil(this.ctx.currentTime + 1.5); },
  hz(m) { return 440 * Math.pow(2, (m - 69) / 12); },
  /* one 16th step of the track (t: its time, sd: a 16th in seconds) */
  doStep(T, s, t, sd) {
    const bar = Math.floor(s / 16), st = s % 16, nb = T.chords.length, [root, iv] = T.chords[bar % nb];
    const tones = iv.map(x => root + x), pass = Math.floor(bar / nb), first = bar === 0;
    const len = (pat, k) => { let n = 1; while (n < pat.length && pat[(k + n) % pat.length] === '.') n++; return n; };
    /* drums (the track's first bar without kick and snare: it eases in) */
    if (T.drums) for (const [kind, pat] of Object.entries(T.drums)) {
      const ch = pat[st];
      if (ch === '.' || (first && kind !== 'h')) continue;
      this.drum(kind, t, ch === 'o' ? 0.5 : 1);
    }
    if (T.bass) {
      const B = T.bass, ch = B.pat[st];
      if (ch !== '.') {
        const m = root + B.oct + (ch === 'o' ? 12 : ch === '5' ? 7 : ch === '3' ? iv[1] : 0);
        this.voice(t, m, Math.min(len(B.pat, st), 8) * sd * 0.92, { wave: B.wave, gain: B.gain, lp: B.lp, attack: 0.008, sus: 0.7, release: 0.06 });
      }
    }
    if (T.pad && st === 0) {
      const P = T.pad;
      for (const m of tones) this.voice(t, m, 16 * sd, { wave: P.wave, gain: P.gain, lp: P.lp, attack: P.attack, sus: 0.85, release: P.release, detune: P.detune });
    }
    if (T.arp && T.arp.pat[st] === 'x') {
      const A = T.arp, k = (bar * 16 + st);
      const ms = A.order === 'chord' ? tones
        : [A.order === 'up' ? tones[k % tones.length]
          : A.order === 'updown' ? tones.concat(tones.slice(1, -1).reverse())[k % Math.max(1, 2 * tones.length - 2)]
          : tones[(A.lo || 0) + Math.floor(Math.random() * (tones.length - (A.lo || 0)))]];
      for (const m of ms) this.voice(t, m + A.oct, A.len, { wave: A.wave, gain: A.gain, lp: A.lp, attack: 0.004, sus: A.len > 0.5 ? 0.3 : 0.15, release: Math.max(0.05, A.len * 0.6), bell: A.len > 0.5 });
    }
    /* the lead: every second pass through the chords */
    if (T.lead && this.motif && pass % 2 === 1) {
      const L = T.lead, k = (bar % 2) * 16 + st, v = this.motif[k];
      if (v >= 0) {
        const n = tones.length, m = tones[v % n] + 12 * Math.floor(v / n) + L.oct;
        const d = Math.min(len(L.pat, k), 4) * sd;
        const o = L.kind === 'pluck' ? { attack: 0.003, sus: 0.1, release: 0.12 } : L.kind === 'keys' ? { attack: 0.01, sus: 0.35, release: 0.3 } : { attack: 0.01, sus: 0.6, release: 0.08 };
        this.voice(t, m, d, Object.assign({ wave: L.wave, gain: L.gain, lp: L.lp }, o));
        if (L.kind === 'keys') this.voice(t, m + 12, d * 0.5, { wave: 'sine', gain: L.gain * 0.25, lp: L.lp, attack: 0.005, sus: 0.1, release: 0.2 });
      }
    }
  },
  /* a note: oscillator(s) → low-pass → envelope (attack, a decay to sus × peak, release after dur) → the bus */
  voice(t, m, dur, o) {
    const c = this.ctx, f = this.hz(m), g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = o.lp || 4000; lp.Q.value = 0.4;
    const pk = o.gain, at = o.attack || 0.005, end = t + Math.max(dur, at + 0.01), rel = o.release || 0.08;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(pk, t + at);
    g.gain.setTargetAtTime(Math.max(0.0001, pk * (o.sus === undefined ? 0.7 : o.sus)), t + at, Math.max(0.03, (end - t - at) * 0.35));
    g.gain.setTargetAtTime(0.0001, end, rel / 3);
    lp.connect(g); g.connect(this.bus);
    const oscs = [o.wave || 'sine'].concat(o.detune ? [o.wave || 'sine'] : []).map((w, i) => {
      const x = c.createOscillator(); x.type = w; x.frequency.value = f; if (i) x.detune.value = o.detune;
      x.connect(lp); return x;
    });
    if (o.bell) { const x = c.createOscillator(), xg = c.createGain(); x.frequency.value = f * 2.76; xg.gain.value = 0.35; x.connect(xg); xg.connect(lp); oscs.push(x); }
    for (const x of oscs) { x.start(t); x.stop(end + rel * 2 + 0.05); }
  },
  /* drum sounds: kick, snare, clap, closed / open hat (v: 0..1) */
  drum(kind, t, v) {
    const c = this.ctx;
    const env = (node, gain, dur, at = 0.002) => {
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain * v, t + at); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      node.connect(g); g.connect(this.bus); return g;
    };
    const noise = (type, f, q, gain, dur) => {
      const s = c.createBufferSource(); s.buffer = AudioSys.noiseBuf; s.loop = true;
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      s.connect(fl); env(fl, gain, dur); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    };
    if (kind === 'k') {
      const o = c.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      env(o, 0.42, 0.28); o.start(t); o.stop(t + 0.32);
    } else if (kind === 's') {
      noise('bandpass', 1900, 0.8, 0.16, 0.16);
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
      env(o, 0.08, 0.1); o.start(t); o.stop(t + 0.14);
    } else if (kind === 'c') {
      noise('bandpass', 1300, 1.2, 0.17, 0.13);
    } else if (kind === 'h' || kind === 'H') {
      noise('highpass', 7500, 0.7, 0.05, kind === 'H' ? 0.22 : 0.045);
    }
  },
};
