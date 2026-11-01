/* =====================================================================
   OFFLINE RENDER  (headless video production — driven by tools/daily.js)
   Plays the next match frame by frame at exactly 60 fps, independent of real time:
   every canvas frame goes to a WebCodecs H.264 encoder and the synthesized sounds are
   rendered with an OfflineAudioContext. Encoded data is handed to the Node runner through
   window.__sink(kind, base64) ('video' = H.264 Annex B stream, 'audio' = 16-bit WAV).
   The match itself runs through the normal App lifecycle, so the league table, history,
   week/group progress and caption are updated exactly as in the browser.
   ===================================================================== */
const Offline = {
  active: false, FPS: 60,
  begin() { this.active = true; App.running = false; },

  /* one main-loop frame, identical to frame() in 05_app.js but with a fixed real-time step */
  stepFrame(st, rdt) {
    const g = App.game;
    let dtW = 0;
    if (g && !g.over && App.introOn()) {
      App.introT += rdt;
    } else if (g && !g.over) {
      const ts = g.timeScale();
      st.acc += rdt * ts;
      let n = 0;
      while (st.acc >= DT && n < 200) { g.step(DT); st.acc -= DT; n++; if (g.over) break; }
      if (n >= 200) st.acc = 0;
      dtW = rdt * ts;
      App.matchRealT += rdt;
      if (g.over && !App.end) App.onOver();
    } else if (App.end) dtW = rdt;
    FX.update(dtW, rdt);
    if (App.end) App.endT += rdt;
  },

  /* exact number of video frames for a match: replays the same loop on a copy of the game (deterministic) */
  countFrames(opts, rdt) {
    const g = new Game(opts);
    let acc = 0, n = 0;
    while (!g.over && n < 60 * 60 * 30) {
      acc += rdt * g.timeScale();
      let k = 0;
      while (acc >= DT && k < 200) { g.step(DT); acc -= DT; k++; if (g.over) break; }
      if (k >= 200) acc = 0;
      n++;
    }
    return n + Math.ceil((CONFIG.INTRO_DURATION + CONFIG.END_DURATION + 0.3) / rdt) + 1;
  },

  async blobB64(blob) {
    const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
    return url.slice(url.indexOf(',') + 1);
  },

  async pickCodec(w, h, bitrate) {
    for (const codec of ['avc1.640033', 'avc1.4d0033', 'avc1.42e033']) {
      const cfg = { codec, width: w, height: h, bitrate, framerate: this.FPS, avc: { format: 'annexb' }, latencyMode: 'quality' };
      try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg; } catch (e) { /* try next */ }
    }
    throw new Error('Bu tarayıcıda H.264 VideoEncoder yok.');
  },

  wav(buf, frames) {
    const ch = buf.numberOfChannels, rate = buf.sampleRate, n = Math.min(frames, buf.length);
    const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, rate, true);
    out.setUint32(28, rate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
    str(36, 'data'); out.setUint32(40, n * ch * 2, true);
    const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7FFF, true); o += 2; }
    return new Blob([out.buffer], { type: 'audio/wav' });
  },

  /* plays + encodes the next match of the current league settings */
  async renderMatch({ bitrate = 10e6 } = {}) {
    if (!this.active) this.begin();
    const fps = this.FPS, rdt = 1 / fps, c = Renderer.canvas;
    if (!App.prepare()) throw new Error(App.setup && App.setup.err || 'Maç hazırlanamadı.');
    const s = App.setup;
    const total = this.countFrames(s.opts, rdt);
    AudioSys.initOffline(total / fps + 2);
    App.running = true; App.paused = false;

    const cfg = await this.pickCodec(c.width, c.height, bitrate);
    const pend = []; let pendBytes = 0, encErr = null;
    const enc = new VideoEncoder({
      output: (chunk) => { const b = new Uint8Array(chunk.byteLength); chunk.copyTo(b); pend.push(b); pendBytes += b.length; },
      error: (e) => { encErr = e; },
    });
    enc.configure(cfg);
    const flush = async () => {
      if (!pend.length) return;
      const blob = new Blob(pend); pend.length = 0; pendBytes = 0;
      await window.__sink('video', await this.blobB64(blob));
    };

    const st = { acc: 0 };
    let i = 0;
    for (;;) {
      AudioSys.clock = i / fps;
      this.stepFrame(st, rdt);
      Renderer.draw(App.game, App);
      const vf = new VideoFrame(c, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      enc.encode(vf, { keyFrame: i % (fps * 2) === 0 });
      vf.close();
      i++;
      if (encErr) throw encErr;
      while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 0));
      if (pendBytes > 4e6) await flush();
      if (App.end && App.endT >= CONFIG.END_DURATION + 0.3) break;
      if (i > total + fps * 5) throw new Error('Video beklenenden uzun sürdü.');
    }
    await enc.flush(); enc.close();
    if (encErr) throw encErr;
    await flush();

    AudioSys.clock = null;
    const buf = await AudioSys.ctx.startRendering();
    await window.__sink('audio', await this.blobB64(this.wav(buf, Math.round(i / fps * buf.sampleRate))));
    AudioSys.ctx = null; AudioSys.offline = false;
    App.running = false;

    const E = App.end, d = League.data;
    return {
      title: App.title, mode: s.mode, week: s.week, weekMatch: s.weekMatch, seed: s.seed, theme: s.theme,
      frames: i, seconds: i / fps, codec: cfg.codec,
      winner: E.winner.name, subtitle: E.subtitle,
      standings: E.standings.map(x => ({ place: x.place, name: x.name, code: x.code, gf: x.gf, pts: x.pts })),
      caption: $('caption').value,
      base: s.mode === 'arena' ? `s${d.season || 1}_week${String(s.week).padStart(2, '0')}_match${s.weekMatch}_seed${s.seed}` : `s${d.season || 1}_${s.mode}_seed${s.seed}`,
    };
  }
};
