/* ============================================================
   BLOB KNIGHT — entities: Player, Enemy, Projectile, Pickup, Wave
   ============================================================ */
"use strict";

/* ---------- player ---------- */
class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.r = CFG.PLAYER.r;
    this.dir = 0;
    this.attackCd = 0;
    this.hurtT = 0;
    this.swing = 0;
    this.dashT = 0;      // active dash (i-frames while > 0)
    this.dashCd = 0;     // dash recharge
    this.dashAng = 0;
  }
}

/* ---------- enemies ---------- */
class Enemy {
  constructor(def, x, y) {
    Object.assign(this, def);
    this.x = x; this.y = y;
    this.maxHp = def.hp;
    if (this.isBoss) this.boss = def;

    this.cooldown = 0;          // generic attack cooldown (shooter fire, contact)
    this.knock = 0; this.kx = 0; this.ky = 0;
    this.hurtT = 0;             // white flash when damaged
    this.dead = false;          // guards against double-kill in the same frame
    this.summoned = false;      // true for adds spawned mid-fight

    // charger state
    this.chargeT = rand(1, def.chargeCd || 2.6);
    this.chargeCd = def.chargeCd || 2.6;
    this.windupT = def.windup || 0.55;
    this.windup = 0;
    this.dashing = false;
    this.dashT = 0;
    this.dashX = 0; this.dashY = 0;

    // phantom / summoner state
    this.teleT = def.teleCd || 3.4;
    this.sumT = def.summonCd || 5;

    // boss state
    this.volleyT = this.volleyCd || 3;
    this.radialT = this.radialCd || 0;
    this.bossSumT = 4;
    this.spiralT = 0;
    this.spiralAng = Math.random() * Math.PI * 2;
    this.enraged = false;
    this.enraged2 = false;

    // idea 21: standardized telegraph — flash + marker before an attack
    this.telegraph = 0;
    this.fearT = 0;       // idea 29: low-HP flee
    // idea 30: elite modifiers
    this.eliteMod = def.eliteMod || null;
  }

  update(dt, game) {
    const p = game.player;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    /* idea 30: elite mods — regen over time */
    if (this.eliteMod === "REGENERATIVE" && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + 1.5 * dt);
    }

    if (this.knock > 0) {
      this.knock -= dt;
      /* idea 91: frame-independent knockback — px/frame → px/sec */
      this.x += this.kx * 60 * dt; this.y += this.ky * 60 * dt;
      this.clamp();
      return;
    }

    if (this.isBoss) { this.updateBoss(dt, game); return; }
    /* idea 29: fear — low-HP minions flee briefly */
    if (this.hp < this.maxHp * 0.25 && this.maxHp > 8 && this.kind !== "shielder" && this.kind !== "guard") {
      if (this.fearT <= 0 && Math.random() < 0.004) { this.fearT = 1.6; game.flash(`${this.name} flees in fear!`, "#9a90b8"); }
    }
    if (this.fearT > 0) {
      this.fearT -= dt;
      const ang = Math.atan2(this.y - p.y, this.x - p.x);
      this.x += Math.cos(ang) * this.speed * 1.4 * dt;
      this.y += Math.sin(ang) * this.speed * 1.4 * dt;
      this.clamp();
      return;
    }
    switch (this.kind) {
      case "chaser":   this.behaveChaser(dt, game, p); break;
      case "brute":    this.behaveChaser(dt, game, p); break;
      case "elite":    this.behaveChaser(dt, game, p); break;
      case "shooter":  this.behaveShooter(dt, game, p); break;
      case "freezer":  this.behaveShooter(dt, game, p); break;   // same kiting AI, chilling shots
      case "bomber":   this.behaveBomber(dt, game, p); break;
      case "charger":  this.behaveCharger(dt, game, p); break;
      case "phantom":  this.behavePhantom(dt, game, p); break;
      case "summoner": this.behaveSummoner(dt, game, p); break;
      case "splitter": this.behaveSplitter(dt, game, p); break;
      case "shielder": this.behaveShielder(dt, game, p); break;
      case "healer":   this.behaveHealer(dt, game, p); break;
      case "burrower": this.behaveBurrower(dt, game, p); break;
      case "sniper":   this.behaveSniper(dt, game, p); break;
      case "swarm":    this.behaveSwarm(dt, game, p); break;
      case "guard":    this.behaveGuard(dt, game, p); break;
    }
    this.clamp();
  }

  clamp() {
    this.x = clamp(this.x, CFG.MARGIN, CFG.W - CFG.MARGIN);
    this.y = clamp(this.y, CFG.MARGIN, CFG.H - CFG.MARGIN);
  }

  /* melee: chase + contact damage */
  behaveChaser(dt, game, p) {
    const ang = Math.atan2(p.y - this.y, p.x - this.x);
    this.x += Math.cos(ang) * this.speed * dt;
    this.y += Math.sin(ang) * this.speed * dt;
    if (dist(this, p) < this.r + p.r && this.cooldown <= 0) {
      this.cooldown = 0.9;
      game.damagePlayer(rand(this.dmg[0], this.dmg[1]), this.x, this.y);
      if (this.burn) {   // idea 30: SCALDING elite mod
        game.damagePlayer(3, this.x, this.y, "slow");
        game.flash("SCALDED!", "#ff5a2a");
      }
    }
  }

  /* ranged: keep distance, fire projectiles (freezer shots chill) */
  behaveShooter(dt, game, p) {
    this.dodgeIncoming(dt, game);
    const d = Math.max(1, dist(this, p));
    const want = 220;
    if (d < want - 40) { this.x -= (p.x - this.x) / d * this.speed * 0.6 * dt; this.y -= (p.y - this.y) / d * this.speed * 0.6 * dt; }
    else if (d > want + 40) { this.x += (p.x - this.x) / d * this.speed * dt; this.y += (p.y - this.y) / d * this.speed * dt; }
    if (this.cooldown <= 0) {
      this.cooldown = this.fireCd || 2.2;
      const proj = this.proj || { speed: 260, r: 5, color: "#c9b458", dmg: [4, 7] };
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      const shot = new Projectile("enemy", this.x, this.y,
        Math.cos(ang) * proj.speed, Math.sin(ang) * proj.speed,
        proj.r, rand(proj.dmg[0], proj.dmg[1]), proj.color, { slow: proj.slow || 0 });
      game.projectiles.push(shot);
    }
  }

  /* idea 9: smarter casters — sidestep player bolts that come too close */
  dodgeIncoming(dt, game) {
    if (!game.projectiles || !game.projectiles.length) return;
    let near = null, best = 1e9;
    for (const pr of game.projectiles) {
      if (pr.team !== "player") continue;
      const dx = pr.x - this.x, dy = pr.y - this.y;
      if (dx < -110 || dx > 110 || dy < -110 || dy > 110) continue;
      const d = dx * dx + dy * dy;
      if (d < best) { best = d; near = pr; }
    }
    if (!near) return;
    const strafe = Math.atan2(near.vy, near.vx) + Math.PI / 2;
    const dir = Math.cos(strafe - Math.atan2(near.y - this.y, near.x - this.x)) > 0 ? 1 : -1;
    this.x += Math.cos(strafe) * dir * this.speed * 1.5 * dt;
    this.y += Math.sin(strafe) * dir * this.speed * 1.5 * dt;
  }

  /* suicide rusher: explodes near the player */
  behaveBomber(dt, game, p) {
    const ang = Math.atan2(p.y - this.y, p.x - this.x);
    this.x += Math.cos(ang) * this.speed * dt;
    this.y += Math.sin(ang) * this.speed * dt;
    if (dist(this, p) < this.r + p.r + 6) {
      game.explode(this.x, this.y, this.blastR || 70, this.dmg);
      game.killEnemy(this, true);
    }
  }

  /* telegraphed dash attack */
  behaveCharger(dt, game, p) {
    if (this.dashing) {
      this.dashT -= dt;
      this.x += this.dashX * dt;
      this.y += this.dashY * dt;
      if (dist(this, p) < this.r + p.r) {
        game.damagePlayer(rand(this.dmg[0], this.dmg[1]), this.x, this.y);
        this.dashing = false;
      }
      if (this.dashT <= 0) { this.dashing = false; this.cooldown = 1.0; }
      return;
    }
    if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0) {
        this.dashing = true;
        this.dashT = 0.55;
        const ang = Math.atan2(p.y - this.y, p.x - this.x);
        this.dashX = Math.cos(ang) * this.chargeSpeed;
        this.dashY = Math.sin(ang) * this.chargeSpeed;
      }
      return;
    }
    // approach slowly while waiting to charge
    const ang = Math.atan2(p.y - this.y, p.x - this.x);
    this.x += Math.cos(ang) * this.speed * 0.5 * dt;
    this.y += Math.sin(ang) * this.speed * 0.5 * dt;
    this.chargeT -= dt;
    if (this.chargeT <= 0 && dist(this, p) < 320) {
      this.chargeT = this.chargeCd;
      this.windup = this.windupT;
    }
  }

  /* phantom: blinks beside the player, then lunges */
  behavePhantom(dt, game, p) {
    this.teleT -= dt;
    if (this.teleT <= 0) {
      this.teleT = this.teleCd || 3.4;
      const ang = Math.random() * Math.PI * 2;
      const d = rand(90, 150);
      game.effects.push({ type: "boom", x: this.x, y: this.y, t: 0.3 });
      this.x = clamp(p.x + Math.cos(ang) * d, CFG.MARGIN, CFG.W - CFG.MARGIN);
      this.y = clamp(p.y + Math.sin(ang) * d, CFG.MARGIN, CFG.H - CFG.MARGIN);
      game.effects.push({ type: "boom", x: this.x, y: this.y, t: 0.3 });
      game.SFX && game.SFX.teleport();
      return;
    }
    this.behaveChaser(dt, game, p);
  }

  /* summoner: keeps its distance and calls forth imps */
  behaveSummoner(dt, game, p) {
    this.dodgeIncoming(dt, game);
    const d = Math.max(1, dist(this, p));
    const want = 260;
    if (d < want - 40) { this.x -= (p.x - this.x) / d * this.speed * 0.7 * dt; this.y -= (p.y - this.y) / d * this.speed * 0.7 * dt; }
    else if (d > want + 40) { this.x += (p.x - this.x) / d * this.speed * dt; this.y += (p.y - this.y) / d * this.speed * dt; }
    if (d < this.r + p.r && this.cooldown <= 0) {
      this.cooldown = 0.9;
      game.damagePlayer(rand(this.dmg[0], this.dmg[1]), this.x, this.y);
    }
    this.sumT -= dt;
    if (this.sumT <= 0) {
      this.sumT = this.summonCd || 5;
      const mine = game.enemies.filter(e => e.master === this && !e.dead).length;
      if (mine < (this.summonMax || 3)) {
        const def = Object.assign({}, ENEMY_TYPES.imp, { name: "IMP" });
        const ang = Math.random() * Math.PI * 2;
        const imp = new Enemy(def,
          clamp(this.x + Math.cos(ang) * 34, CFG.MARGIN, CFG.W - CFG.MARGIN),
          clamp(this.y + Math.sin(ang) * 34, CFG.MARGIN, CFG.H - CFG.MARGIN));
        imp.summoned = true;
        imp.master = this;
        game.enemies.push(imp);
        game.effects.push({ type: "boom", x: imp.x, y: imp.y, t: 0.3 });
        game.flash(`${this.name} calls a minion!`, "#c084fc");
      }
    }
  }

  /* idea 22: splitter — splits into 2 imps on death */
  behaveSplitter(dt, game, p) {
    this.behaveChaser(dt, game, p);
  }
  dieSplit() {
    if (this.dead || this.split) return;
    this.split = true;
    for (let i = 0; i < 2; i++) {
      const def = Object.assign({}, ENEMY_TYPES.imp, { name: this.name + " SHARD" });
      const m = new Enemy(def, this.x + (i ? 14 : -14), this.y + (i ? 10 : -10));
      m.summoned = true;
      m.split = true;
      game.enemies.push(m);
      game.effects.push({ type: "boom", x: m.x, y: m.y, t: 0.3 });
    }
    game.flash(`${this.name} splits!`, "#8fd4c8");
  }

  /* idea 23: shielder — blocks frontal damage, must flank */
  behaveShielder(dt, game, p) {
    this.shieldAng = Math.atan2(p.y - this.y, p.x - this.x);   // face the player
    this.behaveChaser(dt, game, p);
  }
  isShielded(from) {
    if (this.kind !== "shielder") return false;
    let diff = Math.abs(Math.atan2(this.y - from.y, this.x - from.x) - this.shieldAng);
    while (diff > Math.PI) diff -= 2 * Math.PI;
    return Math.abs(diff) < (this.shieldArc || 1.2);
  }

  /* idea 24: healer — beams HP to other enemies */
  behaveHealer(dt, game, p) {
    this.dodgeIncoming(dt, game);
    const d = Math.max(1, dist(this, p));
    const want = 240;
    if (d < want - 50) { this.x -= (p.x - this.x) / d * this.speed * 0.7 * dt; this.y -= (p.y - this.y) / d * this.speed * 0.7 * dt; }
    else if (d > want + 50) { this.x += (p.x - this.x) / d * this.speed * dt; this.y += (p.y - this.y) / d * this.speed * dt; }
    this.healT = (this.healT || 0) - dt;
    if (this.healT <= 0) {
      this.healT = this.healCd || 4;
      for (const e of game.enemies) {
        if (e === this || e.dead) continue;
        if (dist(this, e) < (this.healR || 130) && e.hp < e.maxHp) {
          e.hp = Math.min(e.maxHp, e.hp + (this.healAmt || 14));
          game.effects.push({ type: "beam", x1: this.x, y1: this.y, x2: e.x, y2: e.y, t: 0.35, color: "#6bff9a" });
          game.effects.push({ type: "heal", x: e.x, y: e.y - 14, t: 0.4, txt: "+" + (this.healAmt || 14) });
        }
      }
      game.SFX && game.SFX.heal();
    }
  }

  /* idea 25: burrower — underground, emerges under player */
  behaveBurrower(dt, game, p) {
    if (this.burrowing) {
      this.burrowT -= dt;
      if (this.burrowT <= 0) {
        this.burrowing = false;
        this.x = clamp(p.x + rand(-20, 20), CFG.MARGIN, CFG.W - CFG.MARGIN);
        this.y = clamp(p.y + rand(-20, 20), CFG.MARGIN, CFG.H - CFG.MARGIN);
        game.effects.push({ type: "boom", x: this.x, y: this.y, t: 0.3 });
        game.flash(`${this.name} bursts from the ground!`, "#9a7a5a");
      }
      return;
    }
    this.behaveChaser(dt, game, p);
    this.burrowT2 = (this.burrowT2 || this.burrowCd || 3.2) - dt;
    if (this.burrowT2 <= 0) {
      this.burrowT2 = this.burrowCd || 3.2;
      if (dist(this, p) < 180) {
        this.burrowing = true;
        this.burrowT = 1.1;
        game.effects.push({ type: "boom", x: this.x, y: this.y, t: 0.3 });
        game.flash(`${this.name} burrows underground!`, "#9a7a5a");
      }
    }
  }

  /* idea 26: sniper — laser sight then fast shot (idea 21 telegraph) */
  behaveSniper(dt, game, p) {
    this.dodgeIncoming(dt, game);
    const d = Math.max(1, dist(this, p));
    const want = 300;
    if (d < want - 60) { this.x -= (p.x - this.x) / d * this.speed * 0.6 * dt; this.y -= (p.y - this.y) / d * this.speed * 0.6 * dt; }
    else if (d > want + 60) { this.x += (p.x - this.x) / d * this.speed * dt; this.y += (p.y - this.y) / d * this.speed * dt; }
    if (this.aimT > 0) {
      this.aimT -= dt;
      this.aimAng = Math.atan2(p.y - this.y, p.x - this.x);
      if (this.aimT <= 0) this.fireSniperShot(game);
      return;   // telegraph phase: laser sight on, no fire
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.cooldown <= 0) {
      this.cooldown = this.fireCd || 3.0;
      this.aimT = this.aimT0 || 0.5;   // start telegraph
      this.aimAng = Math.atan2(p.y - this.y, p.x - this.x);
      game.flash(`${this.name} takes aim...`, "#ff8b3d");
    }
  }
  fireSniperShot(game) {
    const p = game.player;
    const proj = this.proj || { speed: 620, r: 6, color: "#ff5a2a", dmg: [9, 14] };
    const shot = new Projectile("enemy", this.x, this.y,
      Math.cos(this.aimAng) * proj.speed, Math.sin(this.aimAng) * proj.speed,
      proj.r, rand(proj.dmg[0], proj.dmg[1]), proj.color);
    game.projectiles.push(shot);
  }

  /* idea 27: swarm — boids-lite flocking */
  behaveSwarm(dt, game, p) {
    let sepX = 0, sepY = 0, n = 0;
    for (const o of game.enemies) {
      if (o === this || o.dead) continue;
      const d = dist(this, o);
      if (d < 24 && d > 0) { sepX += (this.x - o.x) / d; sepY += (this.y - o.y) / d; n++; }
    }
    this.x += sepX * 60 * dt;
    this.y += sepY * 60 * dt;
    this.behaveChaser(dt, game, p);
  }

  /* idea 28: patrolling guards with aggro radius */
  behaveGuard(dt, game, p) {
    const d = dist(this, p);
    if (d < (this.aggro || 200) && !this.aggroed) { this.aggroed = true; game.flash(`${this.name} spots you!`, "#7a8aa8"); }
    if (this.aggroed) { this.behaveChaser(dt, game, p); return; }
    this.patrolT = (this.patrolT || 0) - dt;
    if (this.patrolT <= 0) {
      this.patrolT = 2.2;
      this.patrolDir = -this.patrolDir || 1;
    }
    this.x += Math.cos(this.patrolDir || 1) * this.speed * 0.5 * dt;
  }

  /* ---------- boss AI: chase + volley + radial + spiral + summon + enrages ---------- */
  updateBoss(dt, game) {
    const p = game.player;
    const b = this.boss;
    const d = dist(this, p);
    if (d > 160) {
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      const sp = this.speed * (this.enraged2 ? 1.45 : this.enraged ? 1.25 : 1);
      this.x += Math.cos(ang) * sp * dt;
      this.y += Math.sin(ang) * sp * dt;
    } else if (d < 90) {
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      this.x -= Math.cos(ang) * this.speed * 0.5 * dt;
      this.y -= Math.sin(ang) * this.speed * 0.5 * dt;
    }
    if (d < this.r + p.r && this.cooldown <= 0) {
      this.cooldown = 1.0;
      game.damagePlayer(rand(this.dmg[0], this.dmg[1]), this.x, this.y);
    }

    if (!this.enraged && this.hp < this.maxHp * (b.enrageAt || 0.5)) {
      this.enraged = true;
      game.flash(`${this.name} is ENRAGED!`, "#ff5a2a");
      game.slowmoT = 0.9;                    // idea 31: slow-mo cinematic
      game.shake = Math.max(game.shake, 0.3);
      game.SFX && game.SFX.boss();
    }
    if (!this.enraged2 && b.enrage2At && this.hp < this.maxHp * b.enrage2At) {
      this.enraged = true; this.enraged2 = true;
      game.flash(`${this.name} goes BERSERK!`, "#ff2a6a");
      game.slowmoT = 0.9;                    // idea 31
      game.shake = Math.max(game.shake, 0.35);
      game.SFX && game.SFX.boss();
    }
    /* idea 35: desperation attack at ~5% HP — one massive burst */
    if (b.despair && !this.despairDone && this.hp < this.maxHp * (b.despairAt || 0.05)) {
      this.despairDone = true;
      game.flash(`${this.name} unleashes its DESPERATION!`, "#ff2a6a");
      game.effects.push({ type: "ring", x: this.x, y: this.y, r: this.r + 20, t: 0.5, color: "#ff2a6a" });   // idea 18: telegraph
      setTimeout(() => game.flash(`“${DESPERATION_TAUNTS[rand(0, DESPERATION_TAUNTS.length - 1)]}”`, "#c2553d"), 900);   // idea 87
      game.slowmoT = 1.2;
      game.shake = Math.max(game.shake, 0.5);
      const n = b.despair.count;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + Math.random() * 0.3;
        game.projectiles.push(new Projectile("enemy", this.x, this.y,
          Math.cos(ang) * b.despair.speed, Math.sin(ang) * b.despair.speed,
          7, rand(b.despair.dmg[0], b.despair.dmg[1]), b.despair.color));
      }
      game.SFX && game.SFX.boss();
    }
    const mult = this.enraged2 ? 0.5 : this.enraged ? 0.65 : 1;

    this.volleyT -= dt;
    if (b.volley && this.volleyT <= 0) {
      this.volleyT = (b.volleyCd || 2.4) * mult;
      game.bossVolley(this, b.volley);
    }
    if (b.radial) {
      this.radialT -= dt;
      if (this.radialT <= 0) {
        this.radialT = (b.radialCd || 3.5) * mult;
        game.bossRadial(this, b.radial);
      }
    }
    if (b.summon) {
      this.bossSumT -= dt;
      if (this.bossSumT <= 0) {
        this.bossSumT = b.summon.cd * mult;
        game.bossSummon(this, b.summon);
      }
    }
    if (b.spiral) {
      this.spiralT -= dt;
      if (this.spiralT <= 0) {
        this.spiralT = b.spiral.step * mult;
        game.bossSpiral(this, b.spiral, this.spiralAng);
        this.spiralAng += b.spiral.twist;
      }
    }
    /* idea 34: laser sweep */
    if (b.laser) {
      this.laserT = (this.laserT || 0) - dt;
      if (this.laserT <= 0) {
        this.laserT = b.laser.cd * mult;
        this.laserAng = Math.atan2(p.y - this.y, p.x - this.x) - b.laser.sweep / 2;
        this.laserSpin = b.laser.sweep / 1.2;
        game.flash(`${this.name} sweeps its gaze!`, "#c0a8f0");
      }
      if (this.laserSpin > 0) {
        this.laserSpin -= dt;
        this.laserAng += b.laser.sweep / 1.2 * dt;
        game.effects.push({ type: "beam", x1: this.x, y1: this.y, x2: this.x + Math.cos(this.laserAng) * 800, y2: this.y + Math.sin(this.laserAng) * 800, t: 0.08, color: b.laser.color });
        const hit = dist(this, p) < 240 && Math.abs((Math.atan2(p.y - this.y, p.x - this.x) - this.laserAng + Math.PI) % (2 * Math.PI) - Math.PI) < 0.09;
        if (hit && (this.laserHitT || 0) <= 0) {
          game.damagePlayer(rand(b.laser.dmg[0], b.laser.dmg[1]), this.x, this.y);
          this.laserHitT = 0.4;
        }
        this.laserHitT = Math.max(0, (this.laserHitT || 0) - dt);
      }
    }
    /* idea 34: ground AOE zones */
    if (b.aoe) {
      this.aoeT = (this.aoeT || 0) - dt;
      if (this.aoeT <= 0) {
        this.aoeT = b.aoe.cd * mult;
        game.flash(`${this.name} tears the ground!`, "#c0a8f0");
        for (let i = 0; i < b.aoe.count; i++) {
          const zx = clamp(p.x + rand(-220, 220), CFG.MARGIN, CFG.W - CFG.MARGIN);
          const zy = clamp(p.y + rand(-220, 220), CFG.MARGIN, CFG.H - CFG.MARGIN);
          game.G.aoeZones.push({
            x: zx, y: zy,
            r: b.aoe.radius, t: b.aoe.delay, max: b.aoe.delay, dmg: b.aoe.dmg, color: b.aoe.color,
          });
          game.effects.push({ type: "ring", x: zx, y: zy, r: b.aoe.radius, t: b.aoe.delay, color: b.aoe.color });   // idea 18: telegraph
        }
      }
    }
    /* idea 18: per-boss signature mechanics — each depth's boss fights differently */
    const mechs = Array.isArray(b.mech) ? b.mech : (b.mech ? [b.mech] : []);
    for (const m of mechs) this.runMech(m, dt, game, b);
  }

  runMech(m, dt, game, b) {
    const p = game.player;
    switch (m) {
      /* BONE WARDEN: raises a guard — frontal damage blocked while it lasts */
      case "shield": {
        this.shieldT = Math.max(0, (this.shieldT || 0) - dt);
        if (this.shieldT <= 0) {
          this.mechShieldT = (this.mechShieldT || 0) - dt;
          if (this.mechShieldT <= 0) {
            this.mechShieldT = b.mechCd || 7;
            this.shieldT = b.mechDur || 2.5;
            game.flash(`${this.name} raises its guard!`, "#c8c8e8");
            game.SFX && game.SFX.shield();
            game.effects.push({ type: "ring", x: this.x, y: this.y, r: this.r + 14, t: 0.4, color: "#c8c8e8" });
          }
        }
        break;
      }
      /* KARVATH / ECHO: teleports beside the player */
      case "blink": {
        this.blinkT = (this.blinkT || 0) - dt;
        if (this.blinkT <= 0) {
          this.blinkT = b.mechCd || 6;
          const ang = Math.random() * Math.PI * 2;
          const dd = rand(100, 170);
          game.effects.push({ type: "boom", x: this.x, y: this.y, t: 0.3 });
          this.x = clamp(p.x + Math.cos(ang) * dd, CFG.MARGIN, CFG.W - CFG.MARGIN);
          this.y = clamp(p.y + Math.sin(ang) * dd, CFG.MARGIN, CFG.H - CFG.MARGIN);
          game.effects.push({ type: "boom", x: this.x, y: this.y, t: 0.3 });
          game.flash(`${this.name} warps!`, "#c084fc");
          game.SFX && game.SFX.teleport();
        }
        break;
      }
      /* VOID SOVEREIGN / THARAN: gravity well at berserk — drags the player in */
      case "pull": {
        if (!this.enraged2) break;
        const dd = dist(this, p);
        if (dd < 300 && dd > 24) {
          const ang = Math.atan2(this.y - p.y, this.x - p.x);
          p.x = clamp(p.x + Math.cos(ang) * 140 * dt, CFG.MARGIN, CFG.W - CFG.MARGIN);
          p.y = clamp(p.y + Math.sin(ang) * 140 * dt, CFG.MARGIN, CFG.H - CFG.MARGIN);
          game.effects.push({ type: "trail", x: p.x, y: p.y, t: 0.2, color: "#a88cff", r: 4 });
        }
        break;
      }
      /* KAELTHAR / THARAN: pounding ground rings — expanding tremors hurt on contact */
      case "tremor": {
        this.tremorT = (this.tremorT || 0) - dt;
        if (this.tremorT <= 0) {
          this.tremorT = b.mechCd || 6;
          game.flash(`${this.name} pounds the ground!`, "#ffb45e");
          game.shake = Math.max(game.shake, 0.25);
          game.SFX && game.SFX.boom();
          for (let i = 0; i < (b.mechCount || 3); i++) {
            const ring = new Wave(this.x + rand(-40, 40), this.y + rand(-40, 40), "enemy");
            ring.maxR = b.mechR || 220;
            ring.color = "#ffb45e";
            ring.ttl = 0.5;
            game.waves.push(ring);
            game.effects.push({ type: "ring", x: ring.x, y: ring.y, r: ring.maxR, t: 0.5, color: "#ffb45e" });
          }
        }
        break;
      }
      /* VOLKRATH: telegraphed dash — flash windup, then a wall of impact */
      case "charge": {
        if (this.dashing) {
          this.dashT -= dt;
          this.x += this.dashX * dt;
          this.y += this.dashY * dt;
          if (dist(this, p) < this.r + p.r) {
            game.damagePlayer(rand(this.dmg[0], this.dmg[1]), this.x, this.y);
            this.dashing = false;
          }
          if (this.dashT <= 0) this.dashing = false;
          break;
        }
        if (this.windup > 0) {
          this.windup -= dt;
          if (this.windup <= 0) {
            this.dashing = true;
            this.dashT = 0.6;
            const ang = Math.atan2(p.y - this.y, p.x - this.x);
            this.dashX = Math.cos(ang) * (b.mechSpeed || 580);
            this.dashY = Math.sin(ang) * (b.mechSpeed || 580);
          }
          break;
        }
        this.chargeT -= dt;
        if (this.chargeT <= 0 && dist(this, p) < 340) {
          this.chargeT = b.mechCd || 5;
          this.windup = 0.7;
          game.flash(`${this.name} braces to charge!`, "#ff5a2a");
          game.SFX && game.SFX.boss();
        }
        break;
      }
      /* LURIAN: chilling tide — slow nova + ice spikes around the player */
      case "tide": {
        this.tideT = (this.tideT || 0) - dt;
        if (this.tideT <= 0) {
          this.tideT = b.mechCd || 7;
          const r = b.mechR || 240;
          game.flash(`${this.name} calls the tide!`, "#7fd4e8");
          game.effects.push({ type: "ring", x: this.x, y: this.y, r, t: 0.6, color: "#7fd4e8" });
          if (dist(this, p) < r) {
            G.slowT = Math.max(G.slowT, 2.2);
            game.flash("CHILLED!", "#7fd4e8");
          }
          for (let i = 0; i < (b.mechCount || 4); i++) {
            game.G.aoeZones.push({
              x: clamp(p.x + rand(-200, 200), CFG.MARGIN, CFG.W - CFG.MARGIN),
              y: clamp(p.y + rand(-200, 200), CFG.MARGIN, CFG.H - CFG.MARGIN),
              r: 60, t: 1.0, max: 1.0, dmg: b.aoe ? b.aoe.dmg : [6, 9], color: "#7fd4e8",
            });
          }
        }
        break;
      }
    }
  }
}

/* ---------- projectiles (player bolts & enemy shots) ----------
   opts: { slow: seconds, boom: bool, boomR: px } */
class Projectile {
  constructor(team, x, y, vx, vy, r, dmg, color, opts) {
    this.team = team;
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.r = r; this.dmg = dmg;
    this.color = color;
    this.ttl = 5;
    this.slow = (opts && opts.slow) || 0;
    this.boom = !!(opts && opts.boom);
    this.boomR = (opts && opts.boomR) || 64;
    this.boomDmg = (opts && opts.boomDmg) || null;
    this.boomerang = !!(opts && opts.boomerang);   // idea 50
    this.bomb = !!(opts && opts.bomb);             // idea 52
    this.fuse = (opts && opts.fuse) || 0;
    this.hitSet = new Set();
  }
  update(dt, game) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    /* idea 50: boomerang returns after a moment */
    if (this.boomerang) {
      this.t += dt;
      if (this.t > 0.28) {
        const p = game.player;
        const ang = Math.atan2(p.y - this.y, p.x - this.x);
        const pull = 500 + 200 * Math.max(0, this.t - 0.28);
        this.vx += Math.cos(ang) * pull * dt * 4;
        this.vy += Math.sin(ang) * pull * dt * 4;
        if (dist(this, p) < 24) return true;   // caught
      }
    }
    this.ttl -= dt;
    if (this.x < 0 || this.x > CFG.W || this.y < 0 || this.y > CFG.H) this.ttl = 0;
    if (this.ttl <= 0) return true; // remove

    /* idea 52: bomb fuse countdown then area boom */
    if (this.bomb) {
      this.fuse -= dt;
      if (Math.floor(this.fuse * 8) % 2 === 0) game.effects.push({ type: "trail", x: this.x, y: this.y, t: 0.1, color: "#3a3a4a", r: 6 });
      if (this.fuse <= 0) {
        game.explodePlayer(this.x, this.y, this.boomR, this.boomDmg);
        return true;
      }
      return false;
    }

    /* idea 5: trail particles behind projectiles */
    game.effects.push({ type: "trail", x: this.x, y: this.y, t: 0.16, color: this.color, r: this.r });

    if (this.team === "player") {
      /* idea 40: projectiles can break crates */
      for (const c of game.crates || []) {
        if (dist(this, c) < this.r + c.r) {
          c.hp -= Math.max(1, Math.round(this.dmg / 3));
          game.effects.push({ type: "spark", x: this.x, y: this.y, vx: (Math.random() - 0.5) * 100, vy: -rand(40, 120), t: 0.3, color: "#c9b458" });
          if (c.hp <= 0) {
            /* idea 85: crates can hide lore notes */
            if (Math.random() < 0.5 && game.G.loreNotes.length < LORE_NOTES.length) {
              const missing = LORE_NOTES.filter(n => !game.G.loreNotes.includes(n.id));
              const note = missing[rand(0, missing.length - 1)];
              game.G.loot.push(new Pickup("lore", c.x, c.y, note.id));
            } else {
              dropLoot(c.x, c.y, false);
            }
            game.effects.push({ type: "boom", x: c.x, y: c.y, t: 0.3 });
            game.crates.splice(game.crates.indexOf(c), 1);
          }
          return true; // bolt consumed
        }
      }
      for (const e of game.enemies) {
        if (dist(this, e) < this.r + e.r) {
          if (this.boom) {
            game.explodePlayer(this.x, this.y, this.boomR);
            return true; // bolt consumed
          }
          if (this.boomerang) {           // idea 50: hit each enemy once, keep flying
            if (this.hitSet.has(e)) continue;
            this.hitSet.add(e);
            const hit = game.playerDamage();
            game.hurtEnemy(e, hit.d, Math.cos(Math.atan2(this.vy, this.vx)) * 6, Math.sin(Math.atan2(this.vy, this.vx)) * 6,
              { knock: 0.18, crit: hit.crit });
            continue;
          }
          const hit = game.playerDamage();
          game.hurtEnemy(e, hit.d, Math.cos(Math.atan2(this.vy, this.vx)) * 6, Math.sin(Math.atan2(this.vy, this.vx)) * 6,
            { knock: 0.18, crit: hit.crit });
          return true; // bolt consumed
        }
      }
    } else {
      const p = game.player;
      if (dist(this, p) < this.r + p.r) {
        game.damagePlayer(this.dmg, this.x, this.y, this.slow ? "slow" : null);
        return true;
      }
    }
    return false;
  }
}

/* ---------- wave shockwave ----------
   team "player" = wave blade (hits enemies); team "enemy" = boss tremors (hits the player) */
class Wave {
  constructor(x, y, team) {
    this.x = x; this.y = y;
    this.r = 20;
    this.maxR = 210;
    this.ttl = 0.5;
    this.hitSet = new Set();
    this.done = false;
    this.team = team || "player";
    this.color = this.team === "enemy" ? "#ffb45e" : "#6fc3ff";
  }
  update(dt, game) {
    const grow = (this.maxR - this.r) / 0.5;
    this.r += grow * dt;
    this.ttl -= dt;
    if (this.team === "enemy") {
      const p = game.player;
      if (p && dist(this, p) < this.r + p.r) {
        game.damagePlayer(rand(6, 10), this.x, this.y);
      }
      return this.ttl <= 0;
    }
    for (const e of [...game.enemies]) {   // copy: kills splice the live array
      if (!this.hitSet.has(e) && dist(this, e) < this.r + e.r) {
        this.hitSet.add(e);
        const hit = game.playerDamage();
        const ang = Math.atan2(e.y - this.y, e.x - this.x);
        game.hurtEnemy(e, hit.d, Math.cos(ang) * 14, Math.sin(ang) * 14, { knock: 0.35, crit: hit.crit, element: game.lastElement });
      }
    }
    return this.ttl <= 0;
  }
}

/* ---------- loot pickups ---------- */
class Pickup {
  constructor(type, x, y, v) {
    this.type = type; // gold | potion | herb | stone | charm | rune
    this.x = x; this.y = y;
    this.v = v || 0;
    this.t = rand(0, 6);
  }
}
