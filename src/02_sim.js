/* =====================================================================
   PITCH  (geometry builder — a pure function of state, no RNG)
   ===================================================================== */
/* the rectangular pitch: 4 sides (top goal side, right wall, bottom goal side, left wall); a goal side is split into two walls
   and two posts around its goal mouth (FINAL_GOAL_FRAC of the side) */
function buildGeo(verts, sideTeams, cx, cy, netDepth, goalFrac) {
  const N = verts.length;
  const sides = [], walls = [], posts = [], goals = [];
  for (let j = 0; j < N; j++) {
    const a = verts[j], b = verts[(j + 1) % N];
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = DM.hypot(dx, dy);
    if (L < 0.5) continue;
    const tx = dx / L, ty = dy / L;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    let nx = ty, ny = -tx;
    if (nx * (mx - cx) + ny * (my - cy) < 0) { nx = -nx; ny = -ny; }
    const team = sideTeams[j];
    sides.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, mx, my, tx, ty, nx, ny, L, team });
    if (team == null || team < 0) { walls.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, nx, ny }); continue; }
    const baseHw = Math.min(L * goalFrac * 0.5, L * 0.46);
    const hw = Math.min(baseHw, L * 0.46);
    const p1x = mx - tx * hw, p1y = my - ty * hw, p2x = mx + tx * hw, p2y = my + ty * hw;
    walls.push({ ax: a.x, ay: a.y, bx: p1x, by: p1y, nx, ny }, { ax: p2x, ay: p2y, bx: b.x, by: b.y, nx, ny });
    posts.push({ x: p1x, y: p1y, team }, { x: p2x, y: p2y, team });
    goals.push({ team, mx, my, tx, ty, nx, ny, hw, baseHw, L, p1x, p1y, p2x, p2y, depth: netDepth });
  }
  return { cx, cy, verts, sides, walls, posts, goals, netDepth };
}

/* =====================================================================
   PHYSICS + ENTITIES (Ball, Player, Keeper) — Game simulation
   A timed match between two clubs: o.matchTime seconds of screen time, the score decides; a draw stays a draw unless
   o.knockout (then a golden goal for at most CONFIG.GOLDEN_TIME seconds, then penalties).
   All gameplay randomness uses this.rng (seeded). Fixed step DT.
   ===================================================================== */
/* the roles of a club's outfield players, in the order of Game.duelSpots (the first is the captain) */
const GAME_ROLES = ['mid', 'def', 'def', 'fwd'];
class Game {
  /** @param {{teams: {id: string, name: string, code: string, c1: string, c2: string}[], seed: number, theme: string,
   *           speedMult: number, matchTime: number, knockout?: boolean}} o  teams[0]: the home club (top goal) */
  constructor(o) {
    this.o = o;
    this.mode = 'match';
    this.rng = new RNG(o.seed >>> 0);
    this.onEvent = null;
    this.cx = CONFIG.FINAL_CX; this.cy = CONFIG.CY;
    this.themeId = THEME_DEFS[o.theme] ? o.theme : 'classic';
    this.theme = THEME_DEFS[this.themeId];
    this.t = 0;
    this.ballId = 1;
    this.balls = []; this.players = [];
    this.stats = { goals: 0, saves: 0, ownGoals: 0, escapes: 0 };
    this.morph = null;           // the half-time break: { kind: 'half', t, dur, moves } (players walk to their new halves)
    this.winnerSet = false; this.winner = -1; this.ending = 0; this.over = false; this.duration = 0;
    /* clock = screen seconds played */
    this.timed = true; this.matchTime = o.matchTime;
    this.knockout = !!o.knockout; this.clock = 0; this.extra = false; this.pens = null; this.draw = false;
    this.extraStart = 0;         // clock when the golden goal began
    this.added = 0;              // clock when the running added time began (0: none)
    this.addedSide = 0;          // which half the ball was in when the time ran out (-1 top, 1 bottom); the whistle waits for the other one
    this.half = 1;               // 1 / 2; at half time the clubs change ends (rectTeams swaps)
    this.slowmo = null; this.slowmoCd = 0;
    this.spawnBlock = 0;

    this.teams = o.teams.slice(0, 2).map((d, i) => ({
      i, id: d.id, name: d.name, code: d.code, c1: d.c1, c2: d.c2,
      place: 0, gf: 0, gfT: [], ga: 0, saves: 0, score: 0, pen: 0,
      skill: this.rng.range(0.25, 0.55),
      hitT: -1,
      k: { s: 0, vs: 0, halfLen: 20, flashT: -9, saveCd: 0, active: true },
    }));
    this.W = CONFIG.FINAL_W; this.H = CONFIG.FINAL_H; this.rectTeams = [0, 1];
    this.netDepth = CONFIG.NET_DEPTH_RECT;

    this.geo = this.computeGeo();
    this.initPlayers();
    this.updateKeepers(0);
    this.spawnBall(true);
  }

  emit(type, data) { if (this.onEvent) this.onEvent(type, data || {}); }
  /* seconds left on the clock (the golden goal has its own clock) */
  timeLeft() { return this.extra ? Math.max(0, this.extraStart + CONFIG.GOLDEN_TIME - this.clock) : Math.max(0, this.matchTime - this.clock); }
  /* added time: once the time is up (half time, full time, end of the golden goal) play goes on until the ball crosses the centre
     line — the whistle never blows in the middle of an attack. The side the ball is on when the clock runs out is remembered; the
     whistle waits for the ball to be on the other side (or in the net: the attack is over), at most ADDED_MAX seconds after the
     time was up (over). Returns true while play must go on. */
  waitForCentreLine(over, data) {
    const b = this.balls.find(x => x.state === 'live');
    if (!b || over >= CONFIG.ADDED_MAX) return false;         // in the net / about to respawn, or the limit is reached: nothing to wait for
    const side = b.y < this.rectCy() ? -1 : 1;
    if (!this.added) { this.added = this.clock; this.addedSide = side; this.emit('addedTime', data); }
    return side === this.addedSide;
  }

  /* ---------- geometry ---------- */
  /* centre line of the pitch: shifted down a little so it clears the top bar */
  rectCy() { return this.cy + CONFIG.FINAL_DY; }
  computeGeo() {
    const W = this.W, H = this.H, teams = this.rectTeams;
    const cy = this.rectCy(), x0 = this.cx - W / 2, x1 = this.cx + W / 2, y0 = cy - H / 2, y1 = cy + H / 2;
    const verts = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
    const g = buildGeo(verts, [teams[0], -1, teams[1], -1], this.cx, cy, CONFIG.NET_DEPTH_RECT, CONFIG.FINAL_GOAL_FRAC);
    g.W = W; g.H = H;
    return g;
  }

  /* ---------- setup ---------- */
  makePlayer(team, x, y, captain) {
    const h = this.rng.range(0, TAU);
    return { team, x, y, h, turn: 0, turnTarget: 0, turnT: 0, vx: DM.cos(h) * CONFIG.PLAYER_SPEED, vy: DM.sin(h) * CONFIG.PLAYER_SPEED,
      alive: true, captain: !!captain };
  }
  /* kick-off spots of a club (top: the club at the top goal): captain (midfield), left / right defender, forward (see GAME_ROLES);
     CONFIG.TEAM_PLAYERS of them */
  duelSpots(t, top) {
    const side = t === top ? -1 : 1, flank = t === top ? 1 : -1;
    const cx = this.cx, cy = this.rectCy(), W = this.W, H = this.H;
    return [{ x: cx + flank * W * 0.2, y: cy + side * H * 0.08 }, { x: cx - W * 0.25, y: cy + side * H / 3 },
      { x: cx + W * 0.25, y: cy + side * H / 3 }, { x: cx - flank * W * 0.1, y: cy - side * H * 0.3 }].slice(0, Math.max(1, CONFIG.TEAM_PLAYERS));
  }
  /* a player's area (y range): its third of the pitch, seen from its own goal (it flips at half time) */
  zoneOf(p) {
    const top = this.rectTeams[0], side = p.team === top ? -1 : 1, cy = this.rectCy(), H = this.H;
    const a = p.role === 'def' ? side * H / 2 : p.role === 'fwd' ? -side * H / 6 : -H / 6;
    const b = p.role === 'def' ? side * H / 6 : p.role === 'fwd' ? -side * H / 2 : H / 6;
    return [cy + Math.min(a, b), cy + Math.max(a, b)];
  }
  initPlayers() {
    const [top, bottom] = this.rectTeams;
    for (const t of [top, bottom]) this.duelSpots(t, top).forEach((p, k) => {
      const pl = this.makePlayer(t, p.x, p.y, k === 0);
      pl.role = GAME_ROLES[k] || 'mid';
      this.players.push(pl);
    });
  }
  targetSpeed() { return CONFIG.BALL_SPEED * this.o.speedMult * this.theme.speed * 1.15; }
  /* every wall/post bounce makes the ball a little faster (capped); a new ball starts at base speed */
  wallBoost(b) {
    this.endShot(b);
    if (this.t - b.wallT < 0.05) return;            // a corner double-bounce counts once
    b.wallT = this.t;
    b.boost = Math.min(CONFIG.BALL_MAX_MULT, b.boost * (1 + CONFIG.WALL_ACCEL));
    b.sp = this.targetSpeed() * b.boost;
  }
  /* captain shot: ball goes CAPTAIN_SHOT_MULT × faster; anything else it hits brings it back to its previous speed */
  headingToRivalGoal(b, team) {
    const g = this.geo.goals.find(gg => gg.team !== team);
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
    if (this.slowmo && this.t < this.slowmo.until) return CONFIG.FINAL_SLOWMO_TS;
    return 1;
  }
  step(dt) {
    if (this.over) return;
    /* the match clock runs on screen time: a slow-motion step takes longer on screen */
    if (!this.winnerSet && !this.morph) {                        // the clock stops during the half-time break
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
    this.geo = this.computeGeo();
    this.updateKeepers(dt);
    this.updatePlayers(dt);
    this.updateBalls(dt);
    if (!this.winnerSet) this.spawnSchedule();
    this.checkFinalSlowmo();
    if (!this.winnerSet) this.checkClock();
    if (!this.winnerSet && this.t > CONFIG.HARD_TIME_LIMIT) this.forceFinish();
    if (this.winnerSet) {
      this.ending -= dt;
      if (this.ending <= 0) { this.over = true; this.emit('over'); }
    }
  }

  /* one ball at a time: a new one kicks off GOAL_RESPAWN seconds after a goal */
  spawnSchedule() {
    if (this.t < this.spawnBlock) return;
    for (const b of this.balls) if (b.state === 'live') return;
    this.spawnBall(false);
  }

  /* ---------- keepers ---------- */
  updateKeepers(dt) {
    const KI = CONFIG.KEEPER_INSET;
    for (const g of this.geo.goals) {
      const T = this.teams[g.team], k = T.k;
      let half = g.baseHw * CONFIG.KEEPER_LEN_FRAC;
      half = Math.min(half, g.hw * 0.92);
      k.halfLen = half;
      const maxS = Math.max(0, g.hw - half - 4);
      if (dt > 0) {
        /* keepers always follow the ball: they line up with it and, scaled by skill, read where it will cross the goal line */
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
      k.vx = g.tx * k.vs; k.vy = g.ty * k.vs;
    }
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
      p.turnT -= dt;
      if (p.turnT <= 0) { p.turnT = this.rng.range(0.3, 0.9); p.turnTarget = this.rng.range(-2.4, 2.4); }
      p.turn += (p.turnTarget - p.turn) * Math.min(1, dt * 3);
      p.h += p.turn * dt;
      p.vx = DM.cos(p.h) * sp; p.vy = DM.sin(p.h) * sp;
      p.x += p.vx * dt; p.y += p.vy * dt;
      for (const s of this.geo.sides) {
        closestOnSeg(p.x, p.y, s.ax, s.ay, s.bx, s.by);
        this.pushPlayer(p, _qx, _qy, R, 0, 0);
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
    /* a player stays in its third (after the walls and the other players pushed it) — at the edge it turns back */
    for (const p of P) {
      if (!p.alive || !p.role) continue;
      const [y0, y1] = this.zoneOf(p);
      if (p.y < y0 + R) { p.y = y0 + R; if (p.vy < 0) { p.vy = -p.vy; p.h = DM.atan2(p.vy, p.vx); } }
      if (p.y > y1 - R) { p.y = y1 - R; if (p.vy > 0) { p.vy = -p.vy; p.h = DM.atan2(p.vy, p.vx); } }
    }
  }

  /* ---------- ball ---------- */
  collideStatic(b, qx, qy, rad, kind, dev, inx, iny) {
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
    let rvx = b.vx, rvy = b.vy;
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return false;
    rvx -= 2 * vn * nx; rvy -= 2 * vn * ny;
    if (dev) {
      const a = this.rng.range(-this.theme.dev, this.theme.dev) * DEG, c = DM.cos(a), s = DM.sin(a);
      const ox = rvx * c - rvy * s, oy = rvx * s + rvy * c;
      if (ox * nx + oy * ny > 0.15 * DM.hypot(ox, oy)) { rvx = ox; rvy = oy; }
    }
    b.vx = rvx; b.vy = rvy;
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
    this.kick(b, p, dx / d, dy / d, rad);
  }
  /* a player's touch sends the ball forward — a random direction within ±KICK_MAX_DEG of straight at the rival goal's
     end (only the up / down part is fixed), at the ball's speed. While the ball is still touching the player right after a kick it
     is only pushed clear (no new direction). */
  kick(b, p, nx, ny, rad) {
    const fresh = this.t - b.hitP > 0.12;
    b.hitP = this.t;
    if (!fresh) { b.x = p.x + nx * rad; b.y = p.y + ny * rad; return; }
    const down = p.team === this.rectTeams[0], a = this.rng.range(-1, 1) * CONFIG.KICK_MAX_DEG * DEG, sp = DM.hypot(b.vx, b.vy) || b.sp;
    b.vx = DM.sin(a) * sp; b.vy = (down ? 1 : -1) * DM.cos(a) * sp;
    b.x = p.x + (b.vx / sp) * rad; b.y = p.y + (b.vy / sp) * rad;
    b.lastTouch = p.team;
    this.emit('player', { x: b.x - (b.vx / sp) * CONFIG.BALL_R, y: b.y - (b.vy / sp) * CONFIG.BALL_R, team: p.team });
    if (!this.winnerSet && p.captain && this.headingToRivalGoal(b, p.team)) {
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
    const geo = this.geo;
    for (const b of live) {
      for (let it = 0; it < 2; it++) {
        for (const p of geo.posts) {
          if (this.collideStatic(b, p.x, p.y, BR + CONFIG.POST_R, 'post', true)) this.wallBoost(b);
        }
        for (const w of geo.walls) {
          const ts = closestOnSeg(b.x, b.y, w.ax, w.ay, w.bx, w.by);
          const interior = ts > 0 && ts < 1;
          if (this.collideStatic(b, _qx, _qy, BR, 'wall', true, interior ? -w.nx : undefined, interior ? -w.ny : undefined)) this.wallBoost(b);
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
        this.endShot(b);
        b.x = b.px = geo.cx; b.y = b.py = geo.cy;
        const a = this.rng.range(0, TAU); b.vx = DM.cos(a) * b.sp; b.vy = DM.sin(a) * b.sp;
      }
    }
    if (this.balls.some(b => b.state === 'dead')) this.balls = this.balls.filter(b => b.state !== 'dead');
  }

  /* ---------- goals ---------- */
  checkGoal(b) {
    for (const g of this.geo.goals) {
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
  /* every goal (an own goal too) goes to the other club, like in football, so the score, AG and YG always agree */
  scoreGoal(b, g, along, out) {
    b.state = 'net'; b.netTeam = g.team; b.netT = 0;
    b.nl = { a: along, o: out, va: b.vx * g.tx + b.vy * g.ty, vo: Math.max(120, b.vx * g.nx + b.vy * g.ny) };
    if (this.winnerSet) return;
    const T = this.teams[g.team];
    const scorer = b.lastTouch, own = scorer === g.team;
    T.ga++;
    T.hitT = this.t; this.stats.goals++;
    this.spawnBlock = Math.max(this.spawnBlock, this.t + CONFIG.GOAL_RESPAWN);
    if (own) this.stats.ownGoals++;
    const other = g.team === 0 ? 1 : 0;
    this.creditGoal(other); this.teams[other].score++;
    this.emit('goal', { team: g.team, scorer, own, x: b.x, y: b.y, along, nx: g.nx, ny: g.ny, ballId: b.id,
      benefit: other, score: [this.teams[0].score, this.teams[1].score], golden: this.extra });
    if (this.extra) this.finish(other);                    // golden goal
  }
  /* the half-time break is over: second half kicks off from the centre spot */
  finishMorph() {
    const m = this.morph;
    for (const mv of m.moves) { mv.e.x = mv.x1; mv.e.y = mv.y1; if (mv.e.px !== undefined) { mv.e.px = mv.x1; mv.e.py = mv.y1; } }
    this.morph = null;
    this.balls = [];
    this.geo = this.computeGeo();
    this.updateKeepers(0);
    this.spawnBall(false);
    this.emit('kickoff', { half: 2 });
  }
  /* full time (the score decides; level → draw, or golden goal in a knockout match), end of the golden goal → penalties */
  checkClock() {
    /* half time (with added time, like full time) */
    if (this.half === 1 && !this.extra) {
      const ht = this.matchTime / 2;
      if (this.clock < ht) return;
      if (this.waitForCentreLine(this.clock - ht, { half: 1 })) return;
      this.added = 0;
      this.halfTime();
      return;
    }
    const [A, B] = this.teams, end = this.extra ? this.extraStart + CONFIG.GOLDEN_TIME : this.matchTime;
    if (this.clock < end) return;
    /* time is up: added time until the ball crosses the centre line (or goes in), at most ADDED_MAX seconds */
    if (this.waitForCentreLine(this.clock - end, {})) return;
    this.added = 0;
    if (!this.extra) {
      if (A.score !== B.score) this.finish(A.score > B.score ? 0 : 1);
      else if (!this.knockout) { this.draw = true; this.finish(-1); }
      else { this.extra = true; this.extraStart = this.clock; this.emit('goldenGoal', {}); }
    } else this.startPens();
  }
  /* half time: the ball goes, the clubs change ends (the goals' teams swap) and their players walk into their new halves during the
     break (CONFIG.HALF_BREAK s, the clock stops); then the second half kicks off at MATCH_TIME / 2 */
  halfTime() {
    this.emit('halfTime', {});
    this.half = 2; this.clock = this.matchTime / 2;
    for (const b of this.balls) if (b.state !== 'dead') b.state = 'vanish';
    this.slowmo = null;
    this.rectTeams = [this.rectTeams[1], this.rectTeams[0]];
    this.geo = this.computeGeo();
    for (const T of this.teams) { T.k.s = 0; T.k.vs = 0; }
    this.updateKeepers(0);
    const moves = [], top = this.rectTeams[0];
    for (const t of this.rectTeams) {
      const spots = this.duelSpots(t, top), mine = this.players.filter(p => p.alive && p.team === t);
      mine.forEach((p, k) => { const q = spots[Math.min(k, spots.length - 1)]; moves.push({ e: p, x0: p.x, y0: p.y, x1: q.x, y1: q.y }); });
    }
    this.morph = { kind: 'half', t: 0, dur: CONFIG.HALF_BREAK, moves };
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
    if (w >= 0) { this.teams[w].place = 1; this.teams[1 - w].place = 2; }
    else for (const T of this.teams) T.place = 1;
    this.duration = this.t; this.ending = CONFIG.WIN_SLOW_GAME;
    this.slowmo = null;
    this.emit('win', { team: w });
  }
  forceFinish() {   // pathological safety net (never hit: the clock always reaches full time long before HARD_TIME_LIMIT)
    const [A, B] = this.teams;
    if (A.score === B.score) { this.draw = true; this.finish(-1); } else this.finish(A.score > B.score ? 0 : 1);
  }
  /* slow motion when the ball nears a goal: in a golden goal, and in the last 10 seconds while the match is level or one goal apart */
  checkFinalSlowmo() {
    if (this.winnerSet || this.morph || this.t < this.slowmoCd) return;
    const hot = this.extra || (this.timeLeft() <= 10 && Math.abs(this.teams[0].score - this.teams[1].score) <= 1);
    if (!hot) return;
    for (const g of this.geo.goals) {
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

  /* ---------- result ---------- */
  getResult() {
    return {
      mode: this.mode, seed: this.o.seed >>> 0, theme: this.themeId,
      duration: +this.duration.toFixed(2), overtime: false, draw: this.draw, golden: this.extra, pens: !!this.pens,
      goals: this.stats.goals, saves: this.stats.saves, ownGoals: this.stats.ownGoals, escapes: this.stats.escapes,
      winner: this.winner >= 0 ? this.teams[this.winner].id : null,
      teams: this.teams.map(T => ({ id: T.id, code: T.code, name: T.name, slot: T.i, place: T.place,
        gf: T.gf, ga: T.ga, saves: T.saves, score: T.score, pen: T.pen })),
    };
  }
}
