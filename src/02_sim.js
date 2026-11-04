/* =====================================================================
   ARENA  (geometry builders — pure functions of state, no RNG)
   ===================================================================== */
function buildGeo(kind, verts, sideTeams, cx, cy, goalInfo, netDepth, goalFrac, baseLen) {
  const N = verts.length;
  const sides = [], walls = [], posts = [], goals = [];
  let inR = Infinity;
  for (let j = 0; j < N; j++) {
    const a = verts[j], b = verts[(j + 1) % N];
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = DM.hypot(dx, dy);
    if (L < 0.5) continue;                       // collapsed side (during morph)
    const tx = dx / L, ty = dy / L;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    let nx = ty, ny = -tx;
    if (nx * (mx - cx) + ny * (my - cy) < 0) { nx = -nx; ny = -ny; }
    const d = nx * (mx - cx) + ny * (my - cy);
    if (d < inR) inR = d;
    const team = sideTeams[j];
    const side = { ax: a.x, ay: a.y, bx: b.x, by: b.y, mx, my, tx, ty, nx, ny, L, team };
    sides.push(side);
    if (team == null || team < 0) { walls.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, nx, ny }); continue; }
    const gi = goalInfo(team);
    const baseHw = Math.min((baseLen || L) * goalFrac * 0.5, L * 0.46);
    const hw = Math.min(baseHw * gi.mult, L * 0.46);
    const p1x = mx - tx * hw, p1y = my - ty * hw, p2x = mx + tx * hw, p2y = my + ty * hw;
    walls.push({ ax: a.x, ay: a.y, bx: p1x, by: p1y, nx, ny }, { ax: p2x, ay: p2y, bx: b.x, by: b.y, nx, ny });
    posts.push({ x: p1x, y: p1y, team }, { x: p2x, y: p2y, team });
    if (gi.closed) walls.push({ ax: p1x, ay: p1y, bx: p2x, by: p2y, nx, ny, goalWall: true });
    goals.push({ team, mx, my, tx, ty, nx, ny, hw, baseHw, L, p1x, p1y, p2x, p2y,
      closed: gi.closed, locked: gi.locked, wallPU: gi.wallPU, depth: netDepth });
  }
  if (!isFinite(inR)) inR = 100;
  return { kind, cx, cy, verts, sides, walls, posts, goals, inR, netDepth };
}

/* =====================================================================
   PHYSICS + ENTITIES (Ball, Player, Keeper) + POWERUPS — Game simulation
   All gameplay randomness uses this.rng (seeded). Fixed step DT.
   ===================================================================== */
class Game {
  constructor(o) {
    this.o = o;
    this.mode = o.matchTime > 0 ? 'match' : 'arena';   // 'match': a timed 1v1 league / playoff match (the only kind played now)
    this.rng = new RNG(o.seed >>> 0);
    this.onEvent = null;
    this.cx = CONFIG.CX; this.cy = CONFIG.CY;
    this.themeId = THEME_DEFS[o.theme] ? o.theme : 'classic';
    this.theme = THEME_DEFS[this.themeId];
    this.t = 0;
    this.ballId = 1; this.puId = 1;
    this.balls = []; this.players = []; this.powerups = [];
    this.stats = { goals: 0, saves: 0, ownGoals: 0, powerups: 0, escapes: 0 };
    this.otMult = 1; this.overtime = false; this.everOvertime = false;
    this.otStart = 0;            // overtime clock restarts at every elimination
    this.fxSpeedUntil = -1;
    this.elimSlow = 0; this.morph = null; this.finalDuel = false;
    this.winnerSet = false; this.winner = -1; this.ending = 0; this.over = false; this.duration = 0;
    /* timed 1v1 match (o.matchTime seconds of screen time): the score decides, a draw stays a draw unless o.knockout
       (then a golden goal for at most CONFIG.GOLDEN_TIME seconds, then penalties). clock = screen seconds played. */
    this.timed = o.matchTime > 0 && o.teams.length === 2; this.matchTime = this.timed ? o.matchTime : 0;
    this.knockout = !!o.knockout; this.clock = 0; this.extra = false; this.pens = null; this.draw = false;
    if (this.timed) this.cx = CONFIG.FINAL_CX;
    this.slowmo = null; this.slowmoCd = 0;
    this.spawnBlock = 0;
    this.nextPU = o.powerups ? this.rng.range(CONFIG.PU_MIN, CONFIG.PU_MAX) : Infinity;
    this.omega = 0; this.rot = 0;

    let defs = o.teams.slice();
    if (!this.timed) defs = this.rng.shuffle(defs);   // timed match: teams[0] is the home club (top goal), teams[1] the away club
    this.N0 = defs.length;
    this.teams = defs.map((d, i) => ({
      i, id: d.id, name: d.name, code: d.code, c1: d.c1, c2: d.c2,
      lives: o.lives, eliminated: false, place: 0, gf: 0, gfT: [], ga: 0, saves: 0, score: 0, pen: 0,
      skill: this.rng.range(0.25, 0.55),
      fx: { giant: -1, wall: -1, small: -1, big: -1 },
      elimT: -1, hitT: -1,
      k: { s: 0, vs: 0, halfLen: 20, flashT: -9, saveCd: 0, active: true },
    }));

    if (defs.length <= 2) {
      this.shape = 'rect'; this.W = CONFIG.FINAL_W; this.H = CONFIG.FINAL_H; this.rectTeams = [0, 1];
      this.netDepth = CONFIG.NET_DEPTH_RECT; this.finalDuel = true; this.startDuelScore();
    } else {
      this.shape = 'poly';
      const N = defs.length;
      this.va = [];
      const a0 = Math.PI / 2 - Math.PI / N;     // one side sits at the bottom
      for (let i = 0; i < N; i++) this.va.push(a0 + i * TAU / N);
      this.sides = defs.map((_, i) => i);
      this.R = this.radiusFor(N);
      this.omega = this.rng.sign() * CONFIG.ROT_SPEED_DEG * DEG;
      this.netDepth = CONFIG.NET_DEPTH;
    }

    this.geo = this.computeGeo();
    this.initPlayers();
    this.updateKeepers(0);
    this.spawnBall(true);
  }

  emit(type, data) { if (this.onEvent) this.onEvent(type, data || {}); }
  radiusFor(N) { return CONFIG.R0 * (0.82 + 0.18 * N / this.N0); }
  /* final duel: scores start at 0–0 and the first team to CONFIG.FINAL_GOALS goals wins (lives = goals still allowed) */
  startDuelScore() { for (const i of this.activeTeams()) { const T = this.teams[i]; T.lives = this.timed ? Infinity : CONFIG.FINAL_GOALS; T.score = 0; } }
  /* timed match: seconds left on the clock (the golden goal has its own clock) */
  timeLeft() { return this.extra ? Math.max(0, this.matchTime + CONFIG.GOLDEN_TIME - this.clock) : Math.max(0, this.matchTime - this.clock); }
  activeTeams() { const a = []; for (const T of this.teams) if (!T.eliminated) a.push(T.i); return a; }
  liveBalls() { return this.balls.filter(b => b.state === 'live'); }

  /* ---------- geometry ---------- */
  goalInfo(team) {
    const T = this.teams[team], t = this.t;
    /* a locked goal keeps the width it had when its team went out */
    if (T.eliminated) return { mult: T.lockMult || 1, closed: true, locked: true, wallPU: false };
    let mult = CONFIG.GOAL_GROW ? this.otMult : 1;
    /* arena keeps its size, so (with GOAL_GROW) the remaining open goals grow a little after every elimination */
    if (CONFIG.GOAL_GROW && this.shape === 'poly') mult *= 1 + CONFIG.ELIM_GOAL_GROW * (this.N0 - this.activeTeams().length);
    if (t < T.fx.small) mult *= 0.6;
    if (t < T.fx.big) mult *= 1.4;
    const wallPU = t < T.fx.wall && !T.eliminated;
    return { mult, closed: T.eliminated || wallPU, locked: T.eliminated, wallPU };
  }
  /* regular polygon stretched vertically (centred on cy) to fill the 9:16 frame; goals share the mean side length */
  polyGeo(va, R, rot, sides) {
    const raw = va.map(a => ({ x: R * DM.cos(a + rot), y: R * DM.sin(a + rot) }));
    let y0 = Infinity, y1 = -Infinity;
    for (const v of raw) { if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y; }
    const sy = Math.max(1, 2 * CONFIG.ARENA_HALF_H / Math.max(1, y1 - y0)), ym = (y0 + y1) / 2;
    const verts = raw.map(v => ({ x: this.cx + v.x, y: this.cy + (v.y - ym) * sy }));
    let per = 0, n = 0;
    for (let i = 0; i < verts.length; i++) { const a = verts[i], b = verts[(i + 1) % verts.length], L = DM.hypot(b.x - a.x, b.y - a.y); if (L >= 0.5) { per += L; n++; } }
    return buildGeo('poly', verts, sides, this.cx, this.cy, (tm) => this.goalInfo(tm), CONFIG.NET_DEPTH, CONFIG.GOAL_FRAC, n ? per / n : 0);
  }
  /* centre line of the rectangular final-duel pitch: shifted down a little so it clears the scoreboard */
  rectCy() { return this.cy + CONFIG.FINAL_DY; }
  rectGeo(W, H, teams) {
    const cy = this.rectCy(), x0 = this.cx - W / 2, x1 = this.cx + W / 2, y0 = cy - H / 2, y1 = cy + H / 2;
    const verts = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
    const g = buildGeo('rect', verts, [teams[0], -1, teams[1], -1], this.cx, cy, (tm) => this.goalInfo(tm), CONFIG.NET_DEPTH_RECT, CONFIG.FINAL_GOAL_FRAC);
    g.W = W; g.H = H;
    return g;
  }
  computeGeo() {
    if (this.shape === 'rect') return this.rectGeo(this.W, this.H, this.rectTeams);
    let va = this.va, R = this.R;
    if (this.morph && this.morph.kind === 'poly') {
      const e = easeInOutCubic(this.morph.t / this.morph.dur);
      va = this.morph.fromVa.map((a, i) => a + (this.morph.toVa[i] - a) * e);
      R = lerp(this.morph.fromR, this.morph.toR, e);
    }
    return this.polyGeo(va, R, this.rot, this.sides);
  }
  insidePoint(geo, x, y, margin) {   // nearest safe point inside the inscribed circle
    const gx = geo.cx, gy = geo.cy, dx = x - gx, dy = y - gy, d = DM.hypot(dx, dy);
    const lim = Math.max(0, geo.inR - margin);
    let maxOut = -Infinity;
    for (const s of geo.sides) { const o = (x - s.mx) * s.nx + (y - s.my) * s.ny; if (o > maxOut) maxOut = o; }
    if (maxOut <= -margin) return { x, y };
    if (d <= lim || d < 1e-6) return { x, y };
    return { x: gx + dx * lim / d, y: gy + dy * lim / d };
  }
  wallVel(x, y) { return [-this.omega * (y - this.cy), this.omega * (x - this.cx)]; }

  /* ---------- setup ---------- */
  makePlayer(team, x, y, captain) {
    const h = this.rng.range(0, TAU);
    return { team, x, y, h, turn: 0, turnTarget: 0, turnT: 0, vx: DM.cos(h) * CONFIG.PLAYER_SPEED, vy: DM.sin(h) * CONFIG.PLAYER_SPEED,
      alive: true, captain: !!captain };
  }
  /* final duel: where a team's second (non-captain) player stands — in its own half, on the other flank from x */
  duelMateSpot(team, top, W, H, x) {
    const side = team === top ? -1 : 1, flank = x > this.cx ? -1 : 1;
    return { x: this.cx + flank * W * 0.24, y: this.rectCy() + side * H * 0.24 };
  }
  initPlayers() {
    const mk = (team, x, y, cap) => this.makePlayer(team, x, y, cap);
    if (this.finalDuel) {
      /* direct final (only 2 teams): captain + one team-mate each */
      const [top, bottom] = this.rectTeams;
      for (const t of [top, bottom]) {
        const side = t === top ? -1 : 1, flank = t === top ? 1 : -1;
        const cx = this.cx + flank * this.W * 0.2, cy = this.rectCy() + side * this.H * 0.18;
        this.players.push(mk(t, cx, cy, true));
        const m = this.duelMateSpot(t, top, this.W, this.H, cx);
        this.players.push(mk(t, m.x, m.y, false));
      }
    } else {
      for (const g of this.geo.goals) {
        this.players.push(mk(g.team, this.cx + (g.mx - this.cx) * 0.5, this.cy + (g.my - this.cy) * 0.5));
      }
    }
  }
  targetSpeed() {
    let s = CONFIG.BALL_SPEED * this.o.speedMult * this.theme.speed;
    if (this.t < this.fxSpeedUntil) s *= 1.4;
    if (this.finalDuel) s *= 1.15;
    return s;
  }
  /* every wall/post bounce makes that ball a little faster (capped); a new ball starts at base speed */
  wallBoost(b) {
    this.endShot(b);
    if (this.t - b.wallT < 0.05) return;            // a corner double-bounce counts once
    b.wallT = this.t;
    b.boost = Math.min(CONFIG.BALL_MAX_MULT, b.boost * (1 + CONFIG.WALL_ACCEL));
    b.sp = this.targetSpeed() * b.boost;
  }
  /* captain shot: ball goes CAPTAIN_SHOT_MULT × faster; anything else it hits brings it back to its previous speed */
  headingToRivalGoal(b, team) {
    const g = this.geo.goals.find(gg => gg.team !== team && !gg.closed);
    if (!g) return false;
    const dx = g.mx - b.x, dy = g.my - b.y, d = DM.hypot(dx, dy), v = DM.hypot(b.vx, b.vy);
    if (d < 1e-6 || v < 1e-6) return false;
    return (dx * b.vx + dy * b.vy) / (d * v) > DM.cos(CONFIG.CAPTAIN_AIM_DEG * DEG);
  }
  ballSpeedTarget(b) { return this.targetSpeed() * b.boost * (b.shot ? CONFIG.CAPTAIN_SHOT_MULT : 1); }
  endShot(b) {
    if (!b.shot) return;
    b.shot = false; b.shotTeam = -1;
    b.sp = this.ballSpeedTarget(b);
  }
  maxBallsNow() {
    if (this.finalDuel) return 1;
    return Math.min(CONFIG.MAX_BALLS, 1 + Math.floor(this.t / CONFIG.BALL_ADD_EVERY));
  }
  spawnBall(initial) {
    const ox = this.geo.cx, oy = this.geo.cy;      // kick-off from the centre spot
    let x = ox, y = oy;
    const BR = CONFIG.BALL_R;
    for (let k = 0; k < 10; k++) {
      let ok = true;
      for (const b of this.balls) if (b.state === 'live' && (b.x - x) ** 2 + (b.y - y) ** 2 < (BR * 2 + 8) ** 2) ok = false;
      if (ok) break;
      x = ox + this.rng.range(-70, 70); y = oy + this.rng.range(-70, 70);
    }
    const a = this.rng.range(0, TAU), sp = this.targetSpeed();
    const b = { id: this.ballId++, x, y, px: x, py: y, vx: DM.cos(a) * sp, vy: DM.sin(a) * sp, sp, boost: 1, wallT: -9,
      lastTouch: -1, state: 'live', born: initial ? -10 : this.t, netT: 0, nl: null, netTeam: -1, hitP: -9, vanishT: 0, shot: false, shotTeam: -1 };
    this.balls.push(b);
    this.spawnBlock = this.t + 0.35;
    this.emit('spawnBall', { x, y, initial: !!initial, id: b.id });
    return b;
  }

  /* ---------- main step ---------- */
  timeScale() {
    if (this.over || this.pens) return 1;
    if (this.winnerSet) return CONFIG.TS_SLOW;
    if (this.elimSlow > 0) return CONFIG.TS_SLOW;
    if (this.slowmo && this.t < this.slowmo.until) return CONFIG.FINAL_SLOWMO_TS;
    return 1;
  }
  step(dt) {
    if (this.over) return;
    /* the match clock runs on screen time: a slow-motion step takes longer on screen */
    if (this.timed && !this.winnerSet) {
      if (this.t === 0) this.emit('kickoff', {});
      this.clock += dt / this.timeScale();
      const left = Math.ceil(this.timeLeft());                   // last 10 seconds: one tick a second (sound / clock pulse only)
      if (left <= 10 && left > 0 && left !== this.lastTick) { this.lastTick = left; this.emit('countdown', { n: left }); }
    }
    this.t += dt;
    if (this.pens) { this.stepPens(dt); return; }
    if (this.morph) {
      this.morph.t += dt;
      const e = easeInOutCubic(this.morph.t / this.morph.dur);
      for (const m of this.morph.moves) { m.e.x = lerp(m.x0, m.x1, e); m.e.y = lerp(m.y0, m.y1, e); }
      if (this.morph.t >= this.morph.dur) this.finishMorph();
      return;
    }
    if (this.shape === 'poly') this.rot += this.omega * dt;
    this.updateTimers(dt);
    this.geo = this.computeGeo();
    this.updateKeepers(dt);
    this.updatePlayers(dt);
    this.updateBalls(dt);
    this.updatePickups();
    if (!this.winnerSet) this.spawnSchedule();
    this.checkFinalSlowmo();
    if (this.elimSlow > 0) {
      this.elimSlow -= dt;
      if (this.elimSlow <= 0 && !this.winnerSet) this.afterElimination();
    }
    if (this.timed && !this.winnerSet) this.checkClock();
    if (!this.winnerSet && this.t > CONFIG.HARD_TIME_LIMIT) this.forceFinish();
    if (this.winnerSet) {
      this.ending -= dt;
      if (this.ending <= 0) { this.over = true; this.emit('over'); }
    }
  }

  updateTimers(dt) {
    const t = this.t;
    const ot = t - this.otStart;
    if (CONFIG.GOAL_GROW && !this.overtime && ot >= CONFIG.OT_AT && !this.winnerSet) { this.overtime = true; this.everOvertime = true; this.emit('overtime'); }
    if (this.overtime) {
      this.otMult = 1 + (CONFIG.OT_MULT - 1) * clamp01((ot - CONFIG.OT_AT) / CONFIG.OT_RAMP)
        + 1.2 * clamp01((ot - CONFIG.OT_AT - CONFIG.OT_RAMP) / 5);
    }
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i]; p.age += dt;
      if (p.age >= CONFIG.PU_LIFE) { this.powerups.splice(i, 1); this.emit('puExpire', { x: p.x, y: p.y }); }
    }
    if (!this.winnerSet && t >= this.nextPU) {
      this.nextPU = t + this.rng.range(CONFIG.PU_MIN, CONFIG.PU_MAX);
      if (this.powerups.length < CONFIG.PU_MAX_COUNT) this.spawnPowerup();
    }
  }

  spawnSchedule() {
    if (this.t < this.spawnBlock) return;
    let live = 0; for (const b of this.balls) if (b.state === 'live') live++;
    if (live < this.maxBallsNow()) this.spawnBall(false);
  }

  /* ---------- keepers ---------- */
  updateKeepers(dt) {
    const KI = CONFIG.KEEPER_INSET;
    for (const g of this.geo.goals) {
      const T = this.teams[g.team], k = T.k;
      if (T.eliminated) { k.active = false; continue; }
      k.active = true;
      let half = g.baseHw * CONFIG.KEEPER_LEN_FRAC;
      if (this.t < T.fx.giant) half *= 1.8;
      half = Math.min(half, g.hw * 0.92);
      k.halfLen = half;
      const maxS = Math.max(0, g.hw - half - 4);
      if (dt > 0) {
        /* keepers always follow the ball: they line up with the nearest ball (preferring one heading
           for their goal) and, scaled by skill, read where it will cross the goal line */
        let best = null, bd = Infinity, bestIn = false;
        for (const b of this.balls) {
          if (b.state !== 'live') continue;
          const rx = b.x - g.mx, ry = b.y - g.my;
          const out = rx * g.nx + ry * g.ny, vo = b.vx * g.nx + b.vy * g.ny;
          const incoming = vo > 0 && out < 0;
          const d = rx * rx + ry * ry;
          if ((incoming && !bestIn) || (incoming === bestIn && d < bd)) { bd = d; best = b; bestIn = incoming; }
        }
        let target = 0;
        if (best) {
          const rx = best.x - g.mx, ry = best.y - g.my;
          const out = rx * g.nx + ry * g.ny, along = rx * g.tx + ry * g.ty;
          target = along;
          if (bestIn) {
            const vo = best.vx * g.nx + best.vy * g.ny, vt = best.vx * g.tx + best.vy * g.ty;
            const tt = Math.max(0, (-out - KI) / vo);
            target = lerp(along, along + vt * Math.min(tt, 1.2), T.skill * CONFIG.KEEPER_READ);
          }
        }
        target = clamp(target, -maxS, maxS);
        const desired = clamp((target - k.s) * (CONFIG.KEEPER_GAIN * (0.6 + T.skill)), -CONFIG.KEEPER_SPEED, CONFIG.KEEPER_SPEED);
        k.vs += (desired - k.vs) * Math.min(1, dt * 14);
        k.s += k.vs * dt;
        if (k.saveCd > 0) k.saveCd -= dt;
      }
      if (k.s > maxS) { k.s = maxS; if (k.vs > 0) k.vs = 0; }
      else if (k.s < -maxS) { k.s = -maxS; if (k.vs < 0) k.vs = 0; }
      k.x = g.mx - g.nx * KI + g.tx * k.s; k.y = g.my - g.ny * KI + g.ty * k.s;
      k.tx = g.tx; k.ty = g.ty; k.nx = g.nx; k.ny = g.ny;
      const [wx, wy] = this.wallVel(k.x, k.y);
      k.vx = g.tx * k.vs + wx; k.vy = g.ty * k.vs + wy;
    }
    for (const T of this.teams) if (T.eliminated) T.k.active = false;
  }

  /* ---------- players ---------- */
  pushPlayer(p, qx, qy, rad, wvx, wvy) {
    let dx = p.x - qx, dy = p.y - qy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rad * rad) return;
    let d = Math.sqrt(d2);
    if (d < 1e-6) { dx = this.cx - p.x; dy = this.cy - p.y; d = DM.hypot(dx, dy) || 1; }
    const nx = dx / d, ny = dy / d;
    p.x = qx + nx * rad; p.y = qy + ny * rad;
    const vn = (p.vx - wvx) * nx + (p.vy - wvy) * ny;
    if (vn < 0) { p.vx -= 2 * vn * nx; p.vy -= 2 * vn * ny; p.h = DM.atan2(p.vy, p.vx); }
  }
  updatePlayers(dt) {
    const R = CONFIG.PLAYER_R, sp = CONFIG.PLAYER_SPEED;
    for (const p of this.players) {
      if (!p.alive) continue;
      if (this.teams[p.team].eliminated) { p.alive = false; continue; }
      p.turnT -= dt;
      if (p.turnT <= 0) { p.turnT = this.rng.range(0.3, 0.9); p.turnTarget = this.rng.range(-2.4, 2.4); }
      p.turn += (p.turnTarget - p.turn) * Math.min(1, dt * 3);
      p.h += p.turn * dt;
      p.vx = DM.cos(p.h) * sp; p.vy = DM.sin(p.h) * sp;
      p.x += p.vx * dt; p.y += p.vy * dt;
      for (const s of this.geo.sides) {
        closestOnSeg(p.x, p.y, s.ax, s.ay, s.bx, s.by);
        const qx = _qx, qy = _qy, [wx, wy] = this.wallVel(qx, qy);
        this.pushPlayer(p, qx, qy, R, wx, wy);
      }
      for (const T of this.teams) {
        const k = T.k; if (!k.active) continue;
        closestOnSeg(p.x, p.y, k.x - k.tx * k.halfLen, k.y - k.ty * k.halfLen, k.x + k.tx * k.halfLen, k.y + k.ty * k.halfLen);
        this.pushPlayer(p, _qx, _qy, R + CONFIG.KEEPER_THICK / 2, k.vx, k.vy);
      }
    }
    const P = this.players;
    for (let i = 0; i < P.length; i++) {
      const a = P[i]; if (!a.alive) continue;
      for (let j = i + 1; j < P.length; j++) {
        const b = P[j]; if (!b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= 4 * R * R) continue;
        const d = Math.sqrt(d2) || 1, nx = dx / d, ny = dy / d, ov = (2 * R - d) / 2;
        a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
        const van = a.vx * nx + a.vy * ny; if (van > 0) { a.vx -= 2 * van * nx; a.vy -= 2 * van * ny; a.h = DM.atan2(a.vy, a.vx); }
        const vbn = b.vx * nx + b.vy * ny; if (vbn < 0) { b.vx -= 2 * vbn * nx; b.vy -= 2 * vbn * ny; b.h = DM.atan2(b.vy, b.vx); }
      }
    }
  }

  /* ---------- balls ---------- */
  collideStatic(b, qx, qy, rad, wvx, wvy, kind, dev, inx, iny) {
    let dx = b.x - qx, dy = b.y - qy;
    const d2 = dx * dx + dy * dy;
    /* inx/iny: inward normal of a wall — a ball squeezed past the wall line is always pushed back inside */
    const wrongSide = inx !== undefined && dx * inx + dy * iny < 0;
    if (d2 >= rad * rad && !wrongSide) return false;
    let d = Math.sqrt(d2), nx, ny;
    if (wrongSide) { nx = inx; ny = iny; }
    else {
      if (d < 1e-6) { dx = this.cx - b.x; dy = this.cy - b.y; d = DM.hypot(dx, dy) || 1; }
      nx = dx / d; ny = dy / d;
    }
    b.x = qx + nx * (rad + 0.05); b.y = qy + ny * (rad + 0.05);
    let rvx = b.vx - wvx, rvy = b.vy - wvy;
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return false;
    rvx -= 2 * vn * nx; rvy -= 2 * vn * ny;
    if (dev) {
      const a = this.rng.range(-this.theme.dev, this.theme.dev) * DEG, c = DM.cos(a), s = DM.sin(a);
      const ox = rvx * c - rvy * s, oy = rvx * s + rvy * c;
      if (ox * nx + oy * ny > 0.15 * DM.hypot(ox, oy)) { rvx = ox; rvy = oy; }
    }
    b.vx = rvx + wvx; b.vy = rvy + wvy;
    if (kind) this.emit(kind, { x: b.x - nx * CONFIG.BALL_R, y: b.y - ny * CONFIG.BALL_R, speed: -vn, nx, ny, id: b.id });
    return true;
  }
  ballPlayer(b, p) {
    const rad = CONFIG.BALL_R + CONFIG.PLAYER_R;
    let dx = b.x - p.x, dy = b.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rad * rad) return;
    let d = Math.sqrt(d2);
    if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
    const nx = dx / d, ny = dy / d;
    b.x = p.x + nx * rad; b.y = p.y + ny * rad;
    let vn = b.vx * nx + b.vy * ny;
    if (vn < 0) { b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; }
    b.vx += 0.6 * p.vx; b.vy += 0.6 * p.vy;
    vn = b.vx * nx + b.vy * ny;
    const m = DM.hypot(b.vx, b.vy) || 1;
    if (vn < 0.25 * m) { const add = 0.25 * m - vn; b.vx += nx * add; b.vy += ny * add; }
    const fresh = this.t - b.hitP > 0.12;
    b.lastTouch = p.team; b.hitP = this.t;
    if (fresh) this.emit('player', { x: b.x - nx * CONFIG.BALL_R, y: b.y - ny * CONFIG.BALL_R, team: p.team });
    if (this.finalDuel && !this.winnerSet && p.captain && this.headingToRivalGoal(b, p.team)) {
      if (!b.shot || b.shotTeam !== p.team) {
        b.shot = true; b.shotTeam = p.team;
        b.sp = this.ballSpeedTarget(b);
        this.emit('captainShot', { x: b.x, y: b.y, team: p.team, id: b.id });
      }
    } else this.endShot(b);
  }
  ballKeeper(b, T) {
    const k = T.k, rad = CONFIG.BALL_R + CONFIG.KEEPER_THICK / 2;
    closestOnSeg(b.x, b.y, k.x - k.tx * k.halfLen, k.y - k.ty * k.halfLen, k.x + k.tx * k.halfLen, k.y + k.ty * k.halfLen);
    const qx = _qx, qy = _qy;
    let dx = b.x - qx, dy = b.y - qy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rad * rad) return;
    this.endShot(b);
    b.lastTouch = T.i;                 // keepers count as the last touch too (goal credit / own goal)
    const outward = b.vx * k.nx + b.vy * k.ny;
    let d = Math.sqrt(d2);
    if (d < 1e-6) { dx = -k.nx; dy = -k.ny; d = 1; }
    const nx = dx / d, ny = dy / d;
    b.x = qx + nx * rad; b.y = qy + ny * rad;
    let rvx = b.vx - k.vx, rvy = b.vy - k.vy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) { rvx -= 2 * vn * nx; rvy -= 2 * vn * ny; b.vx = rvx + k.vx; b.vy = rvy + k.vy; }
    if (outward > 0 && k.saveCd <= 0 && !this.winnerSet) {
      T.saves++; this.stats.saves++; k.saveCd = 0.7; k.flashT = this.t;
      this.emit('save', { team: T.i, x: k.x, y: k.y, nx: k.nx, ny: k.ny });
    } else if (vn < 0) this.emit('keeperHit', { team: T.i, x: qx, y: qy });
  }
  updateNetBall(b, dt) {
    b.netT += dt;
    const n = b.nl, damp = DM.exp(-7 * dt);
    n.vo *= damp; n.va *= damp;
    n.o += n.vo * dt; n.a += n.va * dt;
    const g = this.geo.goals.find(gg => gg.team === b.netTeam);
    const depth = this.geo.netDepth, BR = CONFIG.BALL_R;
    if (n.o > depth - BR) { n.o = depth - BR; n.vo = -Math.abs(n.vo) * 0.3; }
    if (g) {
      const lim = Math.max(0, g.hw - BR);
      if (n.a > lim) { n.a = lim; n.va = -Math.abs(n.va) * 0.3; } else if (n.a < -lim) { n.a = -lim; n.va = Math.abs(n.va) * 0.3; }
      b.x = g.mx + g.tx * n.a + g.nx * n.o; b.y = g.my + g.ty * n.a + g.ny * n.o;
    }
    if (b.netT >= 0.5) b.state = 'dead';
  }
  updateBalls(dt) {
    const BR = CONFIG.BALL_R;
    for (const b of this.balls) {
      if (b.state === 'live') {
        b.sp += (this.ballSpeedTarget(b) - b.sp) * Math.min(1, dt * 5);
        b.px = b.x; b.py = b.y;
        b.x += b.vx * dt; b.y += b.vy * dt;
      } else if (b.state === 'net') this.updateNetBall(b, dt);
    }
    const live = this.balls.filter(b => b.state === 'live');
    for (const b of live) {
      for (const p of this.players) if (p.alive) this.ballPlayer(b, p);
      for (const T of this.teams) if (T.k.active) this.ballKeeper(b, T);
    }
    for (let i = 0; i < live.length; i++) {
      const a = live[i];
      for (let j = i + 1; j < live.length; j++) {
        const c = live[j];
        const dx = c.x - a.x, dy = c.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= 4 * BR * BR) continue;
        const d = Math.sqrt(d2) || 1, nx = d2 > 0 ? dx / d : 1, ny = d2 > 0 ? dy / d : 0, ov = (2 * BR - d) / 2;
        a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov;
        const rel = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
        if (rel > 0) {
          a.vx -= rel * nx; a.vy -= rel * ny; c.vx += rel * nx; c.vy += rel * ny;
          this.endShot(a); this.endShot(c);
          this.emit('ballball', { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 });
        }
      }
    }
    const geo = this.geo;
    for (const b of live) {
      for (let it = 0; it < 2; it++) {
        for (const p of geo.posts) {
          const [wx, wy] = this.wallVel(p.x, p.y);
          if (this.collideStatic(b, p.x, p.y, BR + CONFIG.POST_R, wx, wy, 'post', true)) this.wallBoost(b);
        }
        for (const w of geo.walls) {
          const ts = closestOnSeg(b.x, b.y, w.ax, w.ay, w.bx, w.by);
          const qx = _qx, qy = _qy, [wx, wy] = this.wallVel(qx, qy);
          const interior = ts > 0 && ts < 1;
          if (this.collideStatic(b, qx, qy, BR, wx, wy, w.goalWall ? 'goalWallHit' : 'wall', true,
            interior ? -w.nx : undefined, interior ? -w.ny : undefined)) this.wallBoost(b);
        }
      }
      const m = DM.hypot(b.vx, b.vy);
      if (m > 1e-6) { b.vx *= b.sp / m; b.vy *= b.sp / m; }
      else { const a = this.rng.range(0, TAU); b.vx = DM.cos(a) * b.sp; b.vy = DM.sin(a) * b.sp; }
    }
    for (const b of live) {
      if (b.state !== 'live') continue;
      if (this.checkGoal(b)) continue;
      let maxOut = -Infinity;
      for (const s of geo.sides) { const o = (b.x - s.mx) * s.nx + (b.y - s.my) * s.ny; if (o > maxOut) maxOut = o; }
      if (maxOut > 1) {                       // safety net: escaped ball goes back to center
        this.stats.escapes++;
        if (this.debugEscape) this.debugEscape(b, maxOut);
        this.endShot(b);
        b.x = b.px = geo.cx; b.y = b.py = geo.cy;
        const a = this.rng.range(0, TAU); b.vx = DM.cos(a) * b.sp; b.vy = DM.sin(a) * b.sp;
      }
    }
    if (this.balls.some(b => b.state === 'dead')) this.balls = this.balls.filter(b => b.state !== 'dead');
  }

  /* ---------- goals / elimination ---------- */
  checkGoal(b) {
    for (const g of this.geo.goals) {
      if (g.closed) continue;
      const rx = b.x - g.mx, ry = b.y - g.my;
      const out = rx * g.nx + ry * g.ny;
      if (out < 0) continue;
      let along = rx * g.tx + ry * g.ty;
      /* beyond |hw| means the ball wrapped around a post into the net side */
      if (Math.abs(along) >= g.hw + CONFIG.POST_R + CONFIG.BALL_R) continue;
      along = clamp(along, -(g.hw - CONFIG.BALL_R), g.hw - CONFIG.BALL_R);
      this.scoreGoal(b, g, along, out);
      return true;
    }
    return false;
  }
  /* a goal scored by team i: bump its tally and remember when (the ball icon behind its goal pops in then) */
  creditGoal(i) { const T = this.teams[i]; T.gf++; T.gfT.push(this.t); }
  scoreGoal(b, g, along, out) {
    b.state = 'net'; b.netTeam = g.team; b.netT = 0;
    b.nl = { a: along, o: out, va: b.vx * g.tx + b.vy * g.ty, vo: Math.max(120, b.vx * g.nx + b.vy * g.ny) };
    if (this.winnerSet) return;
    const T = this.teams[g.team];
    const scorer = b.lastTouch, own = scorer === g.team;
    /* only a goal that some opponent scored counts as "conceded" (YG): an own goal, or a ball nobody had touched, still knocks the team out
       but is no team's goal, so every YG is some team's AG and the league's totals match */
    if (!own && scorer >= 0) T.ga++;
    T.hitT = this.t; this.stats.goals++;
    this.spawnBlock = Math.max(this.spawnBlock, this.t + CONFIG.GOAL_RESPAWN);
    const ev = { team: g.team, scorer, own, x: b.x, y: b.y, along, nx: g.nx, ny: g.ny, ballId: b.id };
    if (own) this.stats.ownGoals++;
    if (this.timed) {
      /* 1v1 match: every goal (an own goal too) goes to the other club, like in football, so the score, AG and YG always agree */
      const other = g.team === 0 ? 1 : 0;
      if (own || scorer < 0) T.ga++;
      this.creditGoal(other); this.teams[other].score++;
      ev.benefit = other; ev.score = [this.teams[0].score, this.teams[1].score]; ev.golden = this.extra;
      this.emit('goal', ev);
      if (this.extra) this.finish(other);                    // golden goal
      return;
    }
    if (scorer >= 0 && !own) this.creditGoal(scorer);
    if (this.finalDuel) { const other = this.activeTeams().find(i => i !== g.team); if (other !== undefined) this.teams[other].score++; }
    T.lives--;
    this.emit('goal', ev);
    if (T.lives <= 0) this.eliminate(g.team, { scorer, own });
  }
  eliminate(i, by) {
    const T = this.teams[i];
    if (T.eliminated) return;
    const act = this.activeTeams().length;
    const gi = this.goalInfo(i); T.lockMult = gi.mult * (this.t < T.fx.small ? 1 / 0.6 : 1) * (this.t < T.fx.big ? 1 / 1.4 : 1);
    T.eliminated = true; T.place = act; T.elimT = this.t; T.lives = 0;
    /* reset the overtime clock: next overtime starts OT_AT seconds after this elimination */
    this.otStart = this.t; this.overtime = false; this.otMult = 1;
    T.k.active = false;
    /* by: the goal that knocked the team out (scorer = last touch, -1 if nobody touched it; own = own goal) */
    this.emit('eliminate', { team: i, place: act, scorer: by ? by.scorer : -1, own: !!(by && by.own) });
    const left = this.activeTeams();
    if (left.length <= 1) { this.finish(left.length ? left[0] : i); return; }
    this.elimSlow = Math.max(this.elimSlow, CONFIG.ELIM_SLOW_GAME);
  }
  /* The arena keeps its original N-gon (eliminated goals stay locked) until only 2 teams remain;
     then it morphs into the final-duel pitch. Rotation speeds up after every elimination. */
  afterElimination() {
    if (this.shape === 'poly' && this.activeTeams().length === 2) this.startMorph();
    else if (this.shape === 'poly') this.omega *= CONFIG.ROT_GROWTH;
  }
  startMorph() {
    const rem = [];
    for (let j = 0; j < this.sides.length; j++) if (!this.teams[this.sides[j]].eliminated) rem.push(j);
    const M = rem.length;
    const moves = [];
    let targetGeo;
    if (M === 2) {
      const ga = this.geo.goals.find(g => g.team === this.sides[rem[0]]);
      const gb = this.geo.goals.find(g => g.team === this.sides[rem[1]]);
      const ta = this.sides[rem[0]], tb = this.sides[rem[1]];
      const top = (ga && gb && ga.my > gb.my) ? tb : ta, bottom = top === ta ? tb : ta;
      this.finalDuel = true; this.startDuelScore();
      const live = this.liveBalls();
      let keep = null, bd = Infinity;
      for (const b of live) { const d = (b.x - this.cx) ** 2 + (b.y - this.cy) ** 2; if (d < bd) { bd = d; keep = b; } }
      for (const b of live) if (b !== keep) { b.state = 'vanish'; }
      this.morph = { kind: 'rect', t: 0, dur: CONFIG.ELIM_FREEZE, top, bottom, moves };
      targetGeo = this.rectGeo(CONFIG.FINAL_W, CONFIG.FINAL_H, [top, bottom]);
      this.emit('finalDuel', { top, bottom });
    } else {
      const N = this.va.length, va = this.va;
      const s0 = rem[0];
      const ext = []; for (let k = 1; k < M; k++) ext.push(rem[k]); ext.push(s0 + N);
      const A = (i) => va[i % N] + TAU * Math.floor(i / N);
      const groups = Array.from({ length: M + 1 }, () => []);
      let k = 1;
      for (let i = s0 + 1; i <= s0 + N; i++) { while (ext[k - 1] < i) k++; groups[k].push(i); }
      let phi = 0;
      for (let kk = 1; kk <= M; kk++) {
        const rep = groups[kk].reduce((s, i) => s + A(i), 0) / groups[kk].length;
        phi += rep - kk * TAU / M;
      }
      phi /= M;
      const toVa = new Array(N);
      for (let kk = 1; kk <= M; kk++) {
        const na = phi + kk * TAU / M;
        for (const i of groups[kk]) toVa[i % N] = va[i % N] + (na - A(i));
      }
      const newVa = []; for (let kk = 0; kk < M; kk++) newVa.push(phi + kk * TAU / M);
      const newSides = rem.map(j => this.sides[j]);
      this.morph = { kind: 'poly', t: 0, dur: CONFIG.ELIM_FREEZE, fromVa: va.slice(), toVa, fromR: this.R,
        toR: this.radiusFor(M), newVa, newSides, moves };
      targetGeo = this.polyGeo(newVa, this.morph.toR, this.rot, newSides);
    }
    const addMove = (e, margin) => { const p = this.insidePoint(targetGeo, e.x, e.y, margin); moves.push({ e, x0: e.x, y0: e.y, x1: p.x, y1: p.y }); };
    for (const b of this.balls) if (b.state === 'live') addMove(b, CONFIG.BALL_R + 8);
    for (const p of this.players) if (p.alive && !this.teams[p.team].eliminated) addMove(p, CONFIG.PLAYER_R + 8);
    if (M === 2) {
      /* final duel: each team's arena player becomes its captain and a team-mate slides out of it into its own half */
      const { top } = this.morph;
      for (const t of [this.morph.top, this.morph.bottom]) {
        let cap = this.players.find(p => p.alive && p.team === t);
        if (!cap) {
          const side = t === top ? -1 : 1;
          cap = this.makePlayer(t, this.cx, this.rectCy() + side * CONFIG.FINAL_H * 0.18, true);
          this.players.push(cap); addMove(cap, CONFIG.PLAYER_R + 8);
        }
        cap.captain = true;
        const mv = moves.find(m => m.e === cap), m = this.duelMateSpot(t, top, CONFIG.FINAL_W, CONFIG.FINAL_H, mv ? mv.x1 : cap.x);
        const mate = this.makePlayer(t, cap.x, cap.y, false);
        this.players.push(mate);
        moves.push({ e: mate, x0: cap.x, y0: cap.y, x1: m.x, y1: m.y });
      }
    }
    this.powerups = this.powerups.filter(p => {
      const q = this.insidePoint(targetGeo, p.x, p.y, CONFIG.PU_WALL_MARGIN);
      return Math.abs(q.x - p.x) < 0.5 && Math.abs(q.y - p.y) < 0.5;
    });
    this.morph.targetGeo = targetGeo;
    this.emit('morphStart', { kind: this.morph.kind });
  }
  finishMorph() {
    const m = this.morph;
    for (const mv of m.moves) { mv.e.x = mv.x1; mv.e.y = mv.y1; if (mv.e.px !== undefined) { mv.e.px = mv.x1; mv.e.py = mv.y1; } }
    this.morph = null;
    if (m.kind === 'poly') {
      this.va = m.newVa; this.sides = m.newSides; this.R = m.toR;
      this.omega *= CONFIG.ROT_GROWTH;
    } else {
      this.shape = 'rect'; this.W = CONFIG.FINAL_W; this.H = CONFIG.FINAL_H;
      this.rectTeams = [m.top, m.bottom]; this.omega = 0; this.netDepth = CONFIG.NET_DEPTH_RECT;
    }
    this.balls = this.balls.filter(b => b.state === 'live');
    this.geo = this.computeGeo();
    for (const p of this.players) if (p.alive) { const q = this.insidePoint(this.geo, p.x, p.y, CONFIG.PLAYER_R + 6); p.x = q.x; p.y = q.y; }
    for (const b of this.balls) { const q = this.insidePoint(this.geo, b.x, b.y, CONFIG.BALL_R + 6); b.x = b.px = q.x; b.y = b.py = q.y; }
    if (m.kind === 'rect') {
      for (const b of this.balls) b.sp = this.targetSpeed() * b.boost;
      if (!this.balls.length) this.spawnBall(false);
    }
    this.updateKeepers(0);
    this.emit('morphEnd', { kind: m.kind });
  }
  /* timed match: full time (the score decides; level → draw, or golden goal in a knockout match), end of the golden goal → penalties */
  checkClock() {
    const [A, B] = this.teams;
    if (!this.extra && this.clock >= this.matchTime) {
      if (A.score !== B.score) this.finish(A.score > B.score ? 0 : 1);
      else if (!this.knockout) { this.draw = true; this.finish(-1); }
      else { this.extra = true; this.emit('goldenGoal', {}); }
    } else if (this.extra && this.clock >= this.matchTime + CONFIG.GOLDEN_TIME) this.startPens();
  }
  /* penalty shoot-out: drawn at once from the match's RNG (5 each, then sudden death), shown one kick every PEN_STEP seconds */
  startPens() {
    const first = this.rng.next() < 0.5 ? 0 : 1, kicks = [], sc = [0, 0], n = [0, 0];
    for (let i = 0; i < 200; i++) {
      const team = i % 2 === 0 ? first : 1 - first, goal = this.rng.next() < CONFIG.PEN_P;
      kicks.push({ team, goal }); n[team]++; if (goal) sc[team]++;
      const left = (k) => Math.max(0, 5 - n[k]);
      if (n[0] <= 5 && n[1] <= 5) { if (sc[0] + left(0) < sc[1] || sc[1] + left(1) < sc[0]) break; }
      else if (n[0] === n[1] && sc[0] !== sc[1]) break;
      if (n[0] === 5 && n[1] === 5 && sc[0] !== sc[1]) break;
    }
    for (const b of this.balls) if (b.state === 'live') b.state = 'vanish';
    this.slowmo = null;
    this.pens = { t: 0, first, kicks, shown: 0, winner: sc[0] > sc[1] ? 0 : 1 };
    this.emit('penalties', { first });
  }
  stepPens(dt) {
    const P = this.pens;
    if (this.winnerSet) { this.ending -= dt; if (this.ending <= 0) { this.over = true; this.emit('over'); } return; }
    P.t += dt;
    while (P.shown < P.kicks.length && P.t >= 0.8 + P.shown * CONFIG.PEN_STEP) {
      const k = P.kicks[P.shown++];
      if (k.goal) this.teams[k.team].pen++;
      this.emit('penKick', { team: k.team, goal: k.goal });
    }
    if (P.shown >= P.kicks.length && P.t >= 0.8 + P.kicks.length * CONFIG.PEN_STEP + 0.4) this.finish(P.winner);
  }
  finish(w) {
    if (this.winnerSet) return;
    this.winnerSet = true; this.winner = w;
    if (w >= 0) { this.teams[w].place = 1; if (this.timed) this.teams[1 - w].place = 2; }
    else if (this.timed) for (const T of this.teams) T.place = 1;
    this.duration = this.t; this.ending = CONFIG.WIN_SLOW_GAME; this.elimSlow = 0;
    this.slowmo = null;
    this.emit('win', { team: w });
  }
  forceFinish() {   // pathological safety: rank remaining teams by lives (never hit with sane settings)
    const act = this.activeTeams().map(i => this.teams[i]);
    act.sort((a, b) => b.lives - a.lives || a.ga - b.ga || a.i - b.i);
    for (let r = act.length - 1; r >= 1; r--) { act[r].eliminated = true; act[r].place = r + 1; act[r].elimT = this.t; }
    this.finish(act[0].i);
  }
  checkFinalSlowmo() {
    if (!this.finalDuel || this.winnerSet || this.morph || this.t < this.slowmoCd) return;
    /* timed match: in a golden goal, and in the last 10 seconds while the match is level or one goal apart */
    const hot = this.timed ? this.extra || (this.timeLeft() <= 10 && Math.abs(this.teams[0].score - this.teams[1].score) <= 1) : true;
    if (!hot) return;
    for (const g of this.geo.goals) {
      const T = this.teams[g.team];
      if ((!this.timed && T.lives !== 1) || g.closed) continue;
      for (const b of this.balls) {
        if (b.state !== 'live') continue;
        const dx = b.x - g.mx, dy = b.y - g.my;
        if (dx * dx + dy * dy < CONFIG.FINAL_SLOWMO_DIST ** 2 && b.vx * g.nx + b.vy * g.ny > 0) {
          this.slowmo = { start: this.t, until: this.t + CONFIG.FINAL_SLOWMO_GAME, team: g.team, x: g.mx, y: g.my };
          this.slowmoCd = this.t + 2.5;
          this.emit('finalSlowmo', { team: g.team });
          return;
        }
      }
    }
  }

  /* ---------- POWERUPS (logic) ---------- */
  spawnPowerup() {
    const geo = this.geo, M = CONFIG.PU_WALL_MARGIN;
    /* no Extra Life in single-life matches; no Split Ball when only one ball is allowed */
    const defs = POWERUP_DEFS.filter(d => !(d.id === 'life' && this.o.lives <= 1) && !(d.id === 'split' && CONFIG.MAX_BALLS <= 1));
    let pos = null;
    for (let tries = 0; tries < 12 && !pos; tries++) {
      let x, y;
      if (this.shape === 'rect') {
        x = this.cx + this.rng.range(-1, 1) * (this.W / 2 - M);
        y = geo.cy + this.rng.range(-1, 1) * (this.H / 2 - M);
      } else {
        const r = Math.sqrt(this.rng.next()) * Math.max(0, geo.inR - M), a = this.rng.range(0, TAU);
        x = this.cx + DM.cos(a) * r; y = this.cy + DM.sin(a) * r;
      }
      let ok = true;
      for (const p of this.powerups) if ((p.x - x) ** 2 + (p.y - y) ** 2 < 90 * 90) ok = false;
      if (ok) pos = { x, y };
    }
    if (!pos) return;
    const def = this.rng.weighted(defs);
    const pu = { id: this.puId++, x: pos.x, y: pos.y, def, age: 0 };
    this.powerups.push(pu);
    this.emit('puSpawn', { x: pu.x, y: pu.y, def });
  }
  updatePickups() {
    const rr = (CONFIG.BALL_R + CONFIG.PU_R) ** 2;
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      for (const b of this.balls) {
        if (b.state !== 'live') continue;
        if ((b.x - pu.x) ** 2 + (b.y - pu.y) ** 2 < rr) {
          this.powerups.splice(i, 1);
          this.applyPowerup(pu, b);
          break;
        }
      }
    }
  }
  applyPowerup(pu, b) {
    const def = pu.def, act = this.activeTeams();
    const lt = b.lastTouch, ltActive = lt >= 0 && !this.teams[lt].eliminated;
    let target = -1;
    if (def.kind === 'pos') target = ltActive ? lt : this.rng.pick(act);
    else if (def.kind === 'neg') { const c = act.filter(i => i !== lt); target = this.rng.pick(c.length ? c : act); }
    const T = target >= 0 ? this.teams[target] : null;
    const code = T ? T.code : '';
    let text = '';
    switch (def.id) {
      case 'giant': T.fx.giant = this.t + def.dur; text = `🧤 ${code} GIANT KEEPER!`; break;
      case 'wall': T.fx.wall = this.t + def.dur; text = `🧱 ${code} LOCKED THEIR GOAL!`; break;
      case 'small': T.fx.small = this.t + def.dur; text = `🔍 ${code} SMALL GOAL!`; break;
      case 'big': T.fx.big = this.t + def.dur; text = `🎯 ${code} BIG GOAL!`; break;
      case 'speed': this.fxSpeedUntil = this.t + def.dur; text = '⚡ SPEED UP!'; break;
      case 'split': {
        let live = 0; for (const x of this.balls) if (x.state === 'live') live++;
        const cap = CONFIG.MAX_BALLS <= 1 ? 1 : (this.finalDuel ? 1 : CONFIG.MAX_BALLS) + 1;
        text = '➕ SPLIT BALL!';
        if (live < cap) {
          const a = DM.atan2(b.vy, b.vx), sp = b.sp;
          const px = -DM.sin(a), py = DM.cos(a);
          const nb = { id: this.ballId++, x: b.x + px * 17, y: b.y + py * 17, px: b.x, py: b.y,
            vx: DM.cos(a + 0.4) * sp, vy: DM.sin(a + 0.4) * sp, sp, boost: b.boost, wallT: -9, lastTouch: b.lastTouch, state: 'live',
            born: this.t, netT: 0, nl: null, netTeam: -1, hitP: -9, vanishT: 0, shot: false, shotTeam: -1 };
          b.x -= px * 17; b.y -= py * 17;
          b.vx = DM.cos(a - 0.4) * sp; b.vy = DM.sin(a - 0.4) * sp;
          this.balls.push(nb);
        }
        break;
      }
      case 'life':
        if (T.lives < 4) { T.lives++; text = `❤️ ${code} EXTRA LIFE!`; }
        else text = `❤️ ${code} FULL HEALTH!`;
        break;
    }
    this.stats.powerups++;
    this.emit('powerup', { def, team: target, x: pu.x, y: pu.y, text });
  }

  /* ---------- result ---------- */
  getResult() {
    return {
      mode: this.mode, seed: this.o.seed >>> 0, theme: this.themeId,
      duration: +this.duration.toFixed(2), overtime: this.everOvertime, draw: this.draw, golden: this.extra, pens: !!this.pens,
      goals: this.stats.goals, saves: this.stats.saves, ownGoals: this.stats.ownGoals, escapes: this.stats.escapes,
      winner: this.winner >= 0 ? this.teams[this.winner].id : null,
      teams: this.teams.map(T => ({ id: T.id, code: T.code, name: T.name, slot: T.i, place: T.place,
        gf: T.gf, ga: T.ga, saves: T.saves, score: T.score, pen: T.pen })),
    };
  }
}
