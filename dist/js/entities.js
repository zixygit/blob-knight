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
    this.vx = 0; this.vy = 0;   // chapter two: velocity sample for predictive foes
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
    // boss AI state machine: intro → chase → attack → recovery → phase
    this.bossState = "intro";
    this.bossStateT = 1.1;

    // idea 21: standardized telegraph — flash + marker before an attack
    this.telegraph = 0;
    this.fearT = 0;       // idea 29: low-HP flee
    // idea 30: elite modifiers
    this.eliteMod = def.eliteMod || null;
  }

  update(dt, game) {
    const p = game.player;
    /* FRENZY modifier quickens every foe's tempo */
    const tempo = (this.eliteMod === "FRANTIC" ? 2 : 1) * ((G.mod && G.mod.frenzy) ? 1.35 : 1);
    this.cooldown = Math.max(0, this.cooldown - dt * tempo);
    this.hurtT = Math.max(0, this.hurtT - dt);
    /* shield windows (boss phases, parries, WARDING) decay every frame — without this the first lord stays BLOCKED forever */
    this.shieldT = Math.max(0, (this.shieldT || 0) - dt);
    /* flame bow: burning foes take damage over time */
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.hp -= (this.burnDps || 3) * dt;
      if (Math.random() < 0.25) game.effects.push({ type: "spark", x: this.x + rand(-6, 6), y: this.y - this.r, vx: 0, vy: -rand(20, 50), t: 0.25, color: "#ff8b3d" });
      if (this.hp <= 0) { game.killEnemy(this); return; }
    }
    /* SANGUINE EDGE: twin-blade bleeds stack and tick */
    if (this.bleedN > 0) {
      this.bleedT -= dt;
      if (this.bleedT <= 0) this.bleedN = 0;
      else {
        this.hp -= 2 * this.bleedN * dt;
        if (Math.random() < 0.12) game.effects.push({ type: "spark", x: this.x + rand(-5, 5), y: this.y - this.r, vx: 0, vy: -rand(15, 40), t: 0.2, color: "#ff6b6b" });
        if (this.hp <= 0) { game.killEnemy(this); return; }
      }
    }
    /* PHASING elites slip between worlds — learn the rhythm or waste your swings */
    if (this.eliteMod === "PHASING" && !this.isBoss) {
      this.phaseT = (this.phaseT === undefined ? rand(2, 4) : this.phaseT) - dt;
      if (this.phaseT <= 0) {
        this.phased = !this.phased;
        this.phaseT = this.phased ? 0.8 : rand(2.5, 4);
        game.effects.push({ type: "boom", x: this.x, y: this.y, t: 0.25 });
      }
    }
    /* idea 30: elite mods — regen over time */
    if (this.eliteMod === "REGENERATIVE" && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + 1.5 * dt);
    }
    /* chapter two: WARDING elites periodically raise a guard window */
    if (this.eliteMod === "WARDING" && this.kind !== "shielder" && !this.isBoss) {
      this.wardT = (this.wardT === undefined ? rand(3, 6) : this.wardT) - dt;
      if (this.wardT <= 0) {
        this.wardT = 6.5;
        this.shieldT = 1.2;
        game.effects.push({ type: "ring", x: this.x, y: this.y, r: this.r + 12, t: 0.4, color: "#c8c8e8" });
        game.flash(`${this.name} raises its guard!`, "#c8c8e8");
        game.SFX && game.SFX.shield();
      }
    }
    /* chapter two: mirror echoes expire instead of flooding the arena */
    if (this.echoTtl !== undefined) {
      this.echoTtl -= dt;
      if (this.echoTtl <= 0) { game.killEnemy(this, true); return; }
    }
    /* chapter two: banner aura + rally state tick off */
    if (this.buffedT > 0) this.buffedT -= dt;
    if (this.lungeT > 0) {
      this.lungeT -= dt;
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      this.x += Math.cos(ang) * 300 * dt;
      this.y += Math.sin(ang) * 300 * dt;
      if (dist(this, p) < this.r + p.r && this.cooldown <= 0) {
        this.cooldown = 0.9;
        game.damagePlayer(rand(this.dmg[0], this.dmg[1]), this.x, this.y);
      }
      this.clamp();
      return;
    }

    if (this.knock > 0) {
      this.knock -= dt;
      /* idea 91: frame-independent knockback — px/frame → px/sec */
      this.x += this.kx * 60 * dt; this.y += this.ky * 60 * dt;
      this.clamp();
      return;
    }

    if (this.isNPC) {
      this.updateNPC(dt, game);
      return;
    }
    if (this.isBoss) { this.updateBoss(dt, game); return; }
    /* idea 29: fear — low-HP minions flee briefly */
    if (this.hp < this.maxHp * 0.25 && this.maxHp > 8 && this.kind !== "shielder" && this.kind !== "guard" && this.kind !== "tentacle") {
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
    /* chapter two: banner-buffed allies move faster for this frame */
    const baseSpeed = this.speed;
    if (this.buffedT > 0) this.speed = Math.round(baseSpeed * 1.3);
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
      /* chapter two: the sundered depths */
      case "acid":      this.behaveAcid(dt, game, p); break;
      case "drone":     this.behaveDrone(dt, game, p); break;
      case "assassin":  this.behaveAssassin(dt, game, p); break;
      case "gazer":     this.behaveGazer(dt, game, p); break;
      case "berserker": this.behaveBerserker(dt, game, p); break;
      case "hunter":    this.behaveHunter(dt, game, p); break;
      case "commander": this.behaveCommander(dt, game, p); break;
      case "tentacle":  this.behaveTentacle(dt, game, p); break;
      case "trapper":   this.behaveTrapper(dt, game, p); break;
      case "blink_assassin": this.behaveBlinkAssassin(dt, game, p); break;
      case "siege_drone": this.behaveSiegeDrone(dt, game, p); break;
      case "mimic_knight": this.behaveMimicKnight(dt, game, p); break;
      case "plague_crawler": this.behavePlagueCrawler(dt, game, p); break;
      case "rift_mage": this.behaveRiftMage(dt, game, p); break;
      case "executioner": this.behaveExecutioner(dt, game, p); break;
      case "chain_beast": this.behaveChainBeast(dt, game, p); break;
      case "bolt_eater":  this.behaveBoltEater(dt, game, p); break;
      /* replayability: mini-bosses + the gilded mimic */
      case "mb_warden":     this.behaveMBWarden(dt, game, p); break;
      case "mb_paragon":    this.behaveMBParagon(dt, game, p); break;
      case "mb_glutton":    this.behaveMBGlutton(dt, game, p); break;
      case "mb_nullsinger": this.behaveMBNullsinger(dt, game, p); break;
      case "gilded_mimic":  this.behaveGildedMimic(dt, game, p); break;
    }
    this.speed = baseSpeed;
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
      /* rare elite contact powers */
      if (this.eliteMod === "VENOMOUS") { G.slowT = Math.max(G.slowT, 1.4); game.flash("VENOM — slowed!", "#7ac74f"); }
      if (this.eliteMod === "VAMPIRIC") { this.hp = Math.min(this.maxHp, this.hp + 6); game.effects.push({ type: "heal", x: this.x, y: this.y - 14, t: 0.4, txt: "+6", color: "#ff6b6b" }); }
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
    // approach slowly while waiting to charge; a webbed or chilled target draws the charge faster
    const ang = Math.atan2(p.y - this.y, p.x - this.x);
    this.x += Math.cos(ang) * this.speed * 0.5 * dt;
    this.y += Math.sin(ang) * this.speed * 0.5 * dt;
    this.chargeT -= dt * (G.slowT > 0.5 ? 1.6 : 1);   // PACK TACTIC: trappers and freezers feed the charger
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

  /* ---------- chapter two: the sundered depths ---------- */

  /* acid: kites and lobs globs that splash into corrosive pools — the floor is the weapon */
  behaveAcid(dt, game, p) {
    this.dodgeIncoming(dt, game);
    const d = Math.max(1, dist(this, p));
    const want = 200;
    if (d < want - 40) { this.x -= (p.x - this.x) / d * this.speed * 0.7 * dt; this.y -= (p.y - this.y) / d * this.speed * 0.7 * dt; }
    else if (d > want + 40) { this.x += (p.x - this.x) / d * this.speed * dt; this.y += (p.y - this.y) / d * this.speed * dt; }
    if (this.cooldown <= 0) {
      this.cooldown = this.fireCd || 3.2;
      const pr = this.proj || { speed: 210, r: 7, color: "#a8e05a", dmg: [4, 7], pool: { r: 42, life: 3, dps: 8 } };
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      const shot = new Projectile("enemy", this.x, this.y,
        Math.cos(ang) * pr.speed, Math.sin(ang) * pr.speed,
        pr.r, rand(pr.dmg[0], pr.dmg[1]), pr.color, { pool: pr.pool || null });
      shot.ttl = Math.min(shot.ttl, 1.0);   // globs fall short and splash
      game.projectiles.push(shot);
      game.effects.push({ type: "ring", x: this.x, y: this.y, r: 10, t: 0.25, color: pr.color });
    }
  }

  /* drone: orbits the player, strafes bursts, flips orbit when aimed at */
  behaveDrone(dt, game, p) {
    if (this.orbDir === undefined) { this.orbDir = Math.random() < 0.5 ? 1 : -1; this.orbT = rand(2, 4); }
    this.orbT -= dt;
    if (this.orbT <= 0) { this.orbT = rand(2, 4); this.orbDir = -this.orbDir; }   // repositions dynamically
    const d = Math.max(1, dist(this, p));
    const want = 230;
    const toP = Math.atan2(p.y - this.y, p.x - this.x);
    const tangent = toP + Math.PI / 2 * this.orbDir;
    let mx = Math.cos(tangent), my = Math.sin(tangent);
    if (d < want - 30) { mx -= Math.cos(toP) * 1.2; my -= Math.sin(toP) * 1.2; }
    else if (d > want + 30) { mx += Math.cos(toP) * 1.2; my += Math.sin(toP) * 1.2; }
    /* skitter when the player takes aim — it never sits still under fire */
    this.dodgeT = Math.max(0, (this.dodgeT || 0) - dt);
    let diff = Math.abs(toP - p.dir + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    if (Math.abs(diff) < 0.5 && d < 320 && this.dodgeT <= 0) {
      this.dodgeT = 1.2;
      this.orbDir = -this.orbDir;
      mx += Math.cos(toP) * 2; my += Math.sin(toP) * 2;
    }
    const len = Math.hypot(mx, my) || 1;
    this.x += mx / len * this.speed * dt;
    this.y += my / len * this.speed * dt;
    if (this.cooldown <= 0) {
      this.cooldown = this.fireCd || 2.9;
      this.burst = 2; this.burstT = 0;
    }
    if (this.burst > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this.burstT = 0.16;
        this.burst--;
        const pr = this.proj || { speed: 300, r: 4, color: "#a8d8e8", dmg: [5, 8] };
        const ang = Math.atan2(p.y - this.y, p.x - this.x) + rand(-6, 6) / 100;
        game.projectiles.push(new Projectile("enemy", this.x, this.y,
          Math.cos(ang) * pr.speed, Math.sin(ang) * pr.speed, pr.r, rand(pr.dmg[0], pr.dmg[1]), pr.color));
      }
    }
  }

  /* assassin: circles → vanishes → reappears behind you (telegraphed) → 3-slash combo → retreats */
  behaveAssassin(dt, game, p) {
    if (!this.aState) { this.aState = "stalk"; this.atkT = rand(1.5, this.teleCd || 5); }
    if (this.aState === "stalk") {
      const d = Math.max(1, dist(this, p));
      const toP = Math.atan2(p.y - this.y, p.x - this.x);
      const tangent = toP + Math.PI / 2;
      let mx = Math.cos(tangent), my = Math.sin(tangent);
      if (d < 200) { mx -= Math.cos(toP); my -= Math.sin(toP); }
      else if (d > 240) { mx += Math.cos(toP); my += Math.sin(toP); }
      const len = Math.hypot(mx, my) || 1;
      this.x += mx / len * this.speed * dt;
      this.y += my / len * this.speed * dt;
      this.atkT -= dt;
      if (this.atkT <= 0) {
        this.aState = "vanish"; this.vT = 0.7; this.phased = true;
        game.effects.push({ type: "boom", x: this.x, y: this.y, t: 0.3 });
        game.flash(`${this.name} melts into shadow...`, "#b06fd4");
      }
      return;
    }
    if (this.aState === "vanish") {
      this.vT -= dt;
      if (this.vT <= 0) {
        const behind = p.dir + Math.PI;
        this.x = clamp(p.x + Math.cos(behind) * 52, CFG.MARGIN, CFG.W - CFG.MARGIN);
        this.y = clamp(p.y + Math.sin(behind) * 52, CFG.MARGIN, CFG.H - CFG.MARGIN);
        this.phased = false;
        this.aState = "mark"; this.mT = 0.55;
        game.effects.push({ type: "boom", x: this.x, y: this.y, t: 0.3 });
        game.effects.push({ type: "ring", x: this.x, y: this.y, r: 26, t: 0.55, color: "#ff2a6a" });
        game.SFX && game.SFX.teleport();
        /* PACK TACTIC: the red ring is the signal — nearby gunners bracket the
           player's likely dodge so the escape route is covered too */
        let synced = false;
        for (const o of game.enemies) {
          if (o === this || o.dead || o.isNPC || o.isBoss) continue;
          if ((o.kind === "shooter" || o.kind === "drone" || o.kind === "sniper" || o.kind === "siege_drone") && dist(o, this) < 320) {
            const lead = 0.35;   // fire where the dodge is going, not where it started
            const tx = clamp(p.x + (p.vx || 0) * lead, CFG.MARGIN, CFG.W - CFG.MARGIN);
            const ty = clamp(p.y + (p.vy || 0) * lead, CFG.MARGIN, CFG.H - CFG.MARGIN);
            const base = Math.atan2(ty - o.y, tx - o.x);
            for (let i = -1; i <= 1; i++) {
              game.projectiles.push(new Projectile("enemy", o.x, o.y,
                Math.cos(base + i * 0.16) * 300, Math.sin(base + i * 0.16) * 300, 5, rand(4, 7), "#e8a83d"));
            }
            o.cooldown = Math.max(o.cooldown, (o.fireCd || 2.2) * 0.8);
            game.effects.push({ type: "ring", x: o.x, y: o.y, r: 12, t: 0.3, color: "#e8a83d" });
            synced = true;
          }
        }
        if (synced) game.flash("ESCAPE DENIED — they hunt in concert!", "#e8a83d");
      }
      return;
    }
    if (this.aState === "mark") {
      this.mT -= dt;   // the red ring is your warning — move
      if (this.mT <= 0) { this.aState = "combo"; this.slashes = 3; this.sT = 0; }
      return;
    }
    if (this.aState === "combo") {
      this.sT -= dt;
      if (this.sT <= 0) {
        this.sT = 0.22;
        this.slashes--;
        const ang = Math.atan2(p.y - this.y, p.x - this.x);
        this.x += Math.cos(ang) * 70;
        this.y += Math.sin(ang) * 70;
        game.arcs = game.arcs || [];
        game.arcs.push({ ang, t: 0.2 });
        if (dist(this, p) < this.r + p.r + 10) game.damagePlayer(rand(this.dmg[0], this.dmg[1]), this.x, this.y);
        SFX.hit();
        if (this.slashes <= 0) { this.aState = "flee"; this.fT = 0.5; }
      }
      return;
    }
    /* flee: dash away, then back to stalking */
    this.fT -= dt;
    const away = Math.atan2(this.y - p.y, this.x - p.x);
    this.x += Math.cos(away) * 320 * dt;
    this.y += Math.sin(away) * 320 * dt;
    if (this.fT <= 0) { this.aState = "stalk"; this.atkT = this.teleCd || 5; }
  }

  /* gazer: drifts, then charges a beam — tracks early, locks late, sweeps nothing: sidestep it */
  behaveGazer(dt, game, p) {
    if (this.gazeCharge > 0) {
      this.gazeCharge -= dt;
      if (this.gazeCharge > (this.gazeLock || 0.5)) this.aimAng = Math.atan2(p.y - this.y, p.x - this.x);
      if (this.gazeCharge <= 0) {
        const range = this.gazeRange || 340;
        game.effects.push({ type: "beam", x1: this.x, y1: this.y, x2: this.x + Math.cos(this.aimAng) * range, y2: this.y + Math.sin(this.aimAng) * range, t: 0.25, color: "#d4a8ff" });
        game.shake = Math.max(game.shake, 0.12);
        SFX.boom();
        let dAng = Math.abs(Math.atan2(p.y - this.y, p.x - this.x) - this.aimAng + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        if (dist(this, p) < range && Math.abs(dAng) < 0.08) game.damagePlayer(rand(this.dmg[0], this.dmg[1]), this.x, this.y);
      }
      return;
    }
    this.dodgeIncoming(dt, game);
    const d = Math.max(1, dist(this, p));
    const want = 280;
    if (d < want - 60) { this.x -= (p.x - this.x) / d * this.speed * 0.6 * dt; this.y -= (p.y - this.y) / d * this.speed * 0.6 * dt; }
    else if (d > want + 60) { this.x += (p.x - this.x) / d * this.speed * dt; this.y += (p.y - this.y) / d * this.speed * dt; }
    this.gazeT = (this.gazeT === undefined ? rand(1.5, this.gazeCd || 4.5) : this.gazeT) - dt;
    if (this.gazeT <= 0 && dist(this, p) < (this.gazeRange || 340)) {
      this.gazeT = this.gazeCd || 4.5;
      this.gazeCharge = 1.3;
      this.gazeLock = 0.5;   // aim locks in the last half-second — that's the dodge window
      this.aimAng = Math.atan2(p.y - this.y, p.x - this.x);
      game.flash(`${this.name} focuses its gaze!`, "#d4a8ff");
    }
  }

  /* berserker: rages harder at 66% and 33% HP — the roar pause is the opening */
  behaveBerserker(dt, game, p) {
    if (this.rageStage === undefined) this.rageStage = 0;
    if (this.roarT > 0) { this.roarT -= dt; return; }
    const frac = this.hp / this.maxHp;
    if (this.rageStage < 1 && frac < 0.66) this.enterRage(game, 1);
    else if (this.rageStage < 2 && frac < 0.33) this.enterRage(game, 2);
    const ang = Math.atan2(p.y - this.y, p.x - this.x);
    const sp = this.speed * (1 + this.rageStage * 0.4);
    this.x += Math.cos(ang) * sp * dt;
    this.y += Math.sin(ang) * sp * dt;
    if (dist(this, p) < this.r + p.r && this.cooldown <= 0) {
      this.cooldown = [0.9, 0.6, 0.4][this.rageStage];
      game.damagePlayer(rand(this.dmg[0], this.dmg[1]), this.x, this.y);
    }
  }
  enterRage(game, stage) {
    this.rageStage = stage;
    this.roarT = 0.6;
    game.effects.push({ type: "ring", x: this.x, y: this.y, r: this.r + 18, t: 0.6, color: "#ff5a2a" });
    game.flash(`${this.name} ${stage === 1 ? "SNARLS" : "GOES BERSERK"}!`, "#ff5a2a");
    game.shake = Math.max(game.shake, 0.15);
    SFX.boss();
  }

  /* hunter: strikes where you're GOING — the orange ring marks the predicted spot */
  behaveHunter(dt, game, p) {
    if (this.hDashT > 0) {
      this.hDashT -= dt;
      this.x += Math.cos(this.hDashAng) * 520 * dt;
      this.y += Math.sin(this.hDashAng) * 520 * dt;
      if (dist(this, p) < this.r + p.r) {
        game.damagePlayer(rand(this.dmg[0], this.dmg[1]), this.x, this.y);
        this.hDashT = 0;
      }
      return;
    }
    if (this.markT > 0) {
      this.markT -= dt;
      if (this.markT <= 0) {
        this.hDashAng = Math.atan2(this.markY - this.y, this.markX - this.x);
        this.hDashT = 0.42;
        game.effects.push({ type: "boom", x: this.x, y: this.y, t: 0.25 });
      }
      return;
    }
    const d = Math.max(1, dist(this, p));
    const toP = Math.atan2(p.y - this.y, p.x - this.x);
    const tangent = toP + Math.PI / 2 * (this.hDir || 1);
    let mx = Math.cos(tangent), my = Math.sin(tangent);
    if (d < 200) { mx -= Math.cos(toP) * 1.4; my -= Math.sin(toP) * 1.4; }
    else if (d > 260) { mx += Math.cos(toP) * 1.4; my += Math.sin(toP) * 1.4; }
    const len = Math.hypot(mx, my) || 1;
    this.x += mx / len * this.speed * dt;
    this.y += my / len * this.speed * dt;
    this.huntT = (this.huntT === undefined ? rand(1.5, this.huntCd || 3.6) : this.huntT) - dt;
    if (this.huntT <= 0 && d < 340) {
      this.huntT = this.huntCd || 3.6;
      this.hDir = -(this.hDir || 1);
      this.markX = clamp(p.x + (p.vx || 0) * 0.55, CFG.MARGIN, CFG.W - CFG.MARGIN);
      this.markY = clamp(p.y + (p.vy || 0) * 0.55, CFG.MARGIN, CFG.H - CFG.MARGIN);
      this.markT = 0.7;
      game.effects.push({ type: "ring", x: this.markX, y: this.markY, r: 22, t: 0.7, color: "#ff8b3d" });
      game.flash(`${this.name} marks your path!`, "#e8a83d");
    }
  }

  /* commander: banner aura speeds nearby foes; the rally drives them all into a charge */
  behaveCommander(dt, game, p) {
    for (const o of game.enemies) {
      if (o === this || o.dead || o.isBoss) continue;
      if (dist(this, o) < 150) o.buffedT = 0.2;
    }
    this.rallyT = (this.rallyT === undefined ? rand(2.5, this.rallyCd || 7) : this.rallyT) - dt;
    if (this.rallyT <= 0) {
      this.rallyT = this.rallyCd || 7;
      game.effects.push({ type: "ring", x: this.x, y: this.y, r: 220, t: 0.6, color: "#ffd166" });
      game.flash(`${this.name} sounds the rally!`, "#ffd166");
      game.SFX && game.SFX.boss();
      for (const o of game.enemies) {
        if (o === this || o.dead || o.isBoss || o.kind === "tentacle") continue;
        if (dist(this, o) < 220) o.lungeT = Math.max(o.lungeT || 0, 0.35);
      }
    }
    this.behaveChaser(dt, game, p);
  }

  /* tentacle: rooted rift-limb — slams telegraphed zones, carving up the arena */
  behaveTentacle(dt, game, p) {
    if (this.slam) {
      this.slam.t -= dt;
      if (Math.random() < 0.3) game.effects.push({ type: "spark", x: this.slam.x + (Math.random() - 0.5) * 60, y: this.slam.y + (Math.random() - 0.5) * 60, vx: 0, vy: -rand(20, 60), t: 0.25, color: this.color });
      if (this.slam.t <= 0) {
        const s = this.slam;
        this.slam = null;
        game.effects.push({ type: "boom", x: s.x, y: s.y, t: 0.4 });
        game.shake = Math.max(game.shake, 0.15);
        SFX.boom();
        if (dist({ x: s.x, y: s.y }, p) < s.r + p.r) game.damagePlayer(rand(this.dmg[0], this.dmg[1]), s.x, s.y);
      }
      return;
    }
    this.slamT = (this.slamT === undefined ? rand(1, this.slamCd || 3.8) : this.slamT) - dt;
    if (this.slamT <= 0) {
      this.slamT = this.slamCd || 3.8;
      this.slam = { x: clamp(p.x + rand(-40, 40), CFG.MARGIN, CFG.W - CFG.MARGIN), y: clamp(p.y + rand(-40, 40), CFG.MARGIN, CFG.H - CFG.MARGIN), r: 58, t: 0.9 };
      game.effects.push({ type: "ring", x: this.slam.x, y: this.slam.y, r: 58, t: 0.9, color: this.color });
    }
  }

  /* trapper: lobs silk that sticks to the ground — webs slow you into everyone else's attacks */
  behaveTrapper(dt, game, p) {
    this.dodgeIncoming(dt, game);
    const d = Math.max(1, dist(this, p));
    const want = 240;
    if (d < want - 40) { this.x -= (p.x - this.x) / d * this.speed * 0.7 * dt; this.y -= (p.y - this.y) / d * this.speed * 0.7 * dt; }
    else if (d > want + 40) { this.x += (p.x - this.x) / d * this.speed * dt; this.y += (p.y - this.y) / d * this.speed * dt; }
    if (this.cooldown <= 0) {
      this.cooldown = this.fireCd || 3.5;
      const pr = this.proj || { speed: 260, r: 6, color: "#e8e8f8", dmg: [3, 6], pool: { r: 46, life: 4, dps: 0, web: true, color: "#c8c8d8" } };
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      const shot = new Projectile("enemy", this.x, this.y,
        Math.cos(ang) * pr.speed, Math.sin(ang) * pr.speed,
        pr.r, rand(pr.dmg[0], pr.dmg[1]), pr.color, { pool: pr.pool || null });
      shot.ttl = Math.min(shot.ttl, 0.85);
      game.projectiles.push(shot);
    }
  }

  /* Blink Assassin — tracks, vanishes, reappears offset, telegraph, dash, retreat */
  behaveBlinkAssassin(dt, game, p) {
    if (!this.baState) { this.baState = "track"; this.baT = rand(1.2, this.dashCd || 4.5); }
    if (this.baState === "track") {
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      this.x += Math.cos(ang) * this.speed * 0.85 * dt;
      this.y += Math.sin(ang) * this.speed * 0.85 * dt;
      this.baT -= dt;
      if (this.baT <= 0 && dist(this, p) < 280) {
        this.baState = "vanish"; this.baT = 0.4;
        game.effects.push({ type: "boom", x: this.x, y: this.y, t: 0.25 });
        this.phased = true;
      }
      return;
    }
    if (this.baState === "vanish") {
      this.baT -= dt;
      if (this.baT <= 0) {
        const off = (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2);
        const ang = p.dir + off;
        this.x = clamp(p.x + Math.cos(ang) * 48, CFG.MARGIN, CFG.W - CFG.MARGIN);
        this.y = clamp(p.y + Math.sin(ang) * 48, CFG.MARGIN, CFG.H - CFG.MARGIN);
        this.phased = false;
        this.baState = "telegraph"; this.baT = 0.5;
        game.effects.push({ type: "ring", x: this.x, y: this.y, r: this.r + 10, t: 0.5, color: "#ff4d6a" });
        game.flash(`${this.name} blinks!`, "#ff4d6a");
      }
      return;
    }
    if (this.baState === "telegraph") {
      this.baT -= dt;
      if (this.baT <= 0) { this.baState = "dash"; this.baT = 0.35; this.baDir = Math.atan2(p.y - this.y, p.x - this.x); }
      return;
    }
    if (this.baState === "dash") {
      this.x += Math.cos(this.baDir) * 420 * dt;
      this.y += Math.sin(this.baDir) * 420 * dt;
      if (dist(this, p) < this.r + p.r && this.cooldown <= 0) {
        this.cooldown = 0.8;
        game.damagePlayer(rand(this.dmg[0], this.dmg[1]), this.x, this.y);
      }
      this.baT -= dt;
      if (this.baT <= 0) { this.baState = "retreat"; this.baT = 0.6; this.retreatDir = Math.atan2(this.y - p.y, this.x - p.x); }
      return;
    }
    if (this.baState === "retreat") {
      this.x += Math.cos(this.retreatDir) * this.speed * 1.2 * dt;
      this.y += Math.sin(this.retreatDir) * this.speed * 1.2 * dt;
      this.baT -= dt;
      if (this.baT <= 0) { this.baState = "track"; this.baT = rand(2, 4); }
      return;
    }
  }

  /* Siege Drone — maintains distance, predicts, bursts, charged shot */
  behaveSiegeDrone(dt, game, p) {
    const d = Math.max(1, dist(this, p));
    const want = 260;
    if (d < want - 30) { this.x -= (p.x - this.x)/d * this.speed * 0.7 * dt; this.y -= (p.y - this.y)/d * this.speed * 0.7 * dt; }
    else if (d > want + 30) { this.x += (p.x - this.x)/d * this.speed * 0.6 * dt; this.y += (p.y - this.y)/d * this.speed * 0.6 * dt; }
    else {
      const perp = Math.atan2(p.y - this.y, p.x - this.x) + Math.PI/2;
      this.x += Math.cos(perp) * this.speed * 0.4 * dt;
      this.y += Math.sin(perp) * this.speed * 0.4 * dt;
    }
    this.burstT = (this.burstT || 0) - dt;
    this.chargeT = (this.chargeT || 0) - dt;
    if (this.chargeT <= 0 && Math.random() < 0.12) {
      this.chargeT = this.chargeCd || 7;
      this.charging = 1.2;
      game.effects.push({ type: "ring", x: this.x, y: this.y, r: this.r + 12, t: 1.2, color: "#5ab8ff" });
      game.flash(`${this.name} charging!`, "#5ab8ff");
    }
    if (this.charging > 0) {
      this.charging -= dt;
      game.effects.push({ type: "trail", x: this.x, y: this.y, t: 0.1, color: "#5ab8ff", r: 4 });
      if (this.charging <= 0) {
        const predX = clamp(p.x + (p.vx||0)*0.6, CFG.MARGIN, CFG.W - CFG.MARGIN);
        const predY = clamp(p.y + (p.vy||0)*0.6, CFG.MARGIN, CFG.H - CFG.MARGIN);
        const ang = Math.atan2(predY - this.y, predX - this.x);
        game.projectiles.push(new Projectile("enemy", this.x, this.y, Math.cos(ang)*420, Math.sin(ang)*420, 7, rand(10,14), "#5ab8ff"));
        game.effects.push({ type: "boom", x: this.x, y: this.y, t: 0.3 });
      }
      return;
    }
    if (this.burstT <= 0) {
      this.burstT = this.burstCd || 3.2;
      this.burstCount = 3;
      this.burstDelay = 0;
    }
    if (this.burstCount > 0) {
      this.burstDelay -= dt;
      if (this.burstDelay <= 0) {
        this.burstDelay = 0.14;
        this.burstCount--;
        const predX = clamp(p.x + (p.vx||0)*0.45, CFG.MARGIN, CFG.W - CFG.MARGIN);
        const predY = clamp(p.y + (p.vy||0)*0.45, CFG.MARGIN, CFG.H - CFG.MARGIN);
        const ang = Math.atan2(predY - this.y, predX - this.x) + rand(-8,8)/100;
        game.projectiles.push(new Projectile("enemy", this.x, this.y, Math.cos(ang)*320, Math.sin(ang)*320, 5, rand(this.dmg[0],this.dmg[1]), "#5ab8ff"));
      }
    }
  }

  /* Mimic Knight — blocks one direction, changes guard, counterattacks */
  behaveMimicKnight(dt, game, p) {
    const toP = Math.atan2(p.y - this.y, p.x - this.x);
    let diff = Math.abs(toP - this.shieldDir);
    while (diff > Math.PI) diff -= 2*Math.PI;
    diff = Math.abs(diff);
    // update guard direction to face player, but with delay
    this.shieldDir += (toP - this.shieldDir) * 2.5 * dt;
    // if player attacks from front, block
    if (this.cooldown <= 0 && dist(this, p) < this.r + p.r + 18 && diff < this.blockArc/2 + 0.4) {
      // blocked — telegraph counter
      if (!this.counterTelegraph) {
        this.counterTelegraph = 0.45;
        game.effects.push({ type: "ring", x: this.x, y: this.y, r: this.r + 8, t: 0.45, color: "#c8c8e8" });
        game.flash(`${this.name} prepares to counter!`, "#c8c8e8");
      }
    }
    if (this.counterTelegraph > 0) {
      this.counterTelegraph -= dt;
      if (this.counterTelegraph <= 0) {
        this.counterTelegraph = 0;
        if (dist(this, p) < 70) {
          game.damagePlayer(rand(this.dmg[0], this.dmg[1]), this.x, this.y);
          game.effects.push({ type: "hit", x: p.x, y: p.y, t: 0.3, txt: "COUNTER!", color: "#c8c8e8" });
        }
        this.cooldown = this.counterCd || 3;
      }
      return;
    }
    // normal chase but slower when guarding
    const ang = Math.atan2(p.y - this.y, p.x - this.x);
    this.x += Math.cos(ang) * this.speed * 0.65 * dt;
    this.y += Math.sin(ang) * this.speed * 0.65 * dt;
    if (dist(this, p) < this.r + p.r && this.cooldown <= 0 && diff > this.blockArc/2) {
      this.cooldown = 0.9;
      game.damagePlayer(rand(this.dmg[0], this.dmg[1]), this.x, this.y);
    }
  }

  /* Plague Crawler — leaves damaging trail, close attack, larger hazard */
  behavePlagueCrawler(dt, game, p) {
    const ang = Math.atan2(p.y - this.y, p.x - this.x);
    this.x += Math.cos(ang) * this.speed * dt;
    this.y += Math.sin(ang) * this.speed * dt;
    this.trailT = (this.trailT || 0) - dt;
    if (this.trailT <= 0) {
      this.trailT = this.trailCd || 0.6;
      game.G.aoeZones.push({ x: this.x, y: this.y, r: 32, t: 3, max: 3, dmg: [3,5], color: "#7ac74f" });
      game.effects.push({ type: "ring", x: this.x, y: this.y, r: 32, t: 3, color: "#7ac74f" });
    }
    if (dist(this, p) < this.r + p.r + 12 && this.cooldown <= 0) {
      this.cooldown = 1.0;
      game.damagePlayer(rand(this.dmg[0], this.dmg[1]), this.x, this.y);
      // occasionally larger hazard
      if (Math.random() < 0.25) {
        game.G.aoeZones.push({ x: p.x, y: p.y, r: 64, t: 4, max: 4, dmg: [5,8], color: "#7ac74f" });
        game.effects.push({ type: "ring", x: p.x, y: p.y, r: 64, t: 4, color: "#7ac74f" });
        game.flash("Plague zone!", "#7ac74f");
      }
    }
  }

  /* Rift Mage — portals that spawn weaker enemies, telegraphed ranged, stays away */
  behaveRiftMage(dt, game, p) {
    const d = Math.max(1, dist(this, p));
    if (d < 180) { this.x -= (p.x - this.x)/d * this.speed * dt; this.y -= (p.y - this.y)/d * this.speed * dt; }
    else if (d > 260) { this.x += (p.x - this.x)/d * this.speed * 0.5 * dt; this.y += (p.y - this.y)/d * this.speed * 0.5 * dt; }
    this.portalT = (this.portalT || 0) - dt;
    if (this.portalT <= 0 && game.enemies.length < 18) {
      const spawned = game.enemies.filter(e=> e.summoned).length;
      if (spawned < (this.spawnMax || 2)) {
        this.portalT = this.portalCd || 9;
        const px = clamp(this.x + rand(-80,80), CFG.MARGIN, CFG.W - CFG.MARGIN);
        const py = clamp(this.y + rand(-80,80), CFG.MARGIN, CFG.H - CFG.MARGIN);
        game.effects.push({ type: "ring", x: px, y: py, r: 22, t: 1.2, color: "#a78bfa" });
        game.flash(`${this.name} opens a rift!`, "#a78bfa");
        setTimeout(()=>{
          const def = Object.assign({}, ENEMY_TYPES.imp, { name: "RIFT SPAWN" });
          const e = new Enemy(def, px, py);
          e.summoned = true;
          game.enemies.push(e);
        }, 800);
      }
    }
    if (this.cooldown <= 0) {
      this.cooldown = 2.8;
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      game.effects.push({ type: "ring", x: this.x, y: this.y, r: this.r + 6, t: 0.5, color: "#a78bfa" });
      setTimeout(()=>{
        game.projectiles.push(new Projectile("enemy", this.x, this.y, Math.cos(ang)*280, Math.sin(ang)*280, 6, rand(this.dmg[0],this.dmg[1]), "#a78bfa"));
      }, 350);
      game.flash(`${this.name} casts!`, "#a78bfa");
    }
  }

  /* Executioner — slow, large telegraphed slam, high damage, enrage below 50% */
  behaveExecutioner(dt, game, p) {
    if (this.enraged2) {
      this.speed = 68;
      this.slamCd = 2.2;
    } else if (this.hp < this.maxHp * (this.enrageHp || 0.5) && !this.enraged) {
      this.enraged = true;
      this.enraged2 = true;
      game.flash(`${this.name} ENRAGED!`, "#ff2a6a");
      game.shake = Math.max(game.shake, 0.3);
    }
    const d = dist(this, p);
    if (d > this.r + p.r + 18) {
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      this.x += Math.cos(ang) * this.speed * dt;
      this.y += Math.sin(ang) * this.speed * dt;
    } else if (this.cooldown <= 0) {
      // telegraph large slam
      if (!this.slamTelegraph) {
        this.slamTelegraph = 0.7;
        game.effects.push({ type: "ring", x: p.x, y: p.y, r: 52, t: 0.7, color: "#1a1a2e" });
        game.effects.push({ type: "ring", x: this.x, y: this.y, r: this.r + 12, t: 0.7, color: "#ff2a6a" });
        game.flash(`${this.name} winds up!`, "#ff2a6a");
      }
    }
    if (this.slamTelegraph > 0) {
      this.slamTelegraph -= dt;
      if (this.slamTelegraph <= 0) {
        this.slamTelegraph = 0;
        this.cooldown = this.slamCd || 3.5;
        // large range slam
        if (dist(this, p) < 78) {
          game.damagePlayer(rand(this.dmg[0], this.dmg[1]), this.x, this.y);
          game.effects.push({ type: "boom", x: p.x, y: p.y, t: 0.4 });
          game.shake = Math.max(game.shake, 0.25);
        }
        // also ground slam ring
        game.effects.push({ type: "ring", x: this.x, y: this.y, r: 78, t: 0.3, color: "#ff2a6a" });
      }
    }
  }

  /* Chain Beast — throws chain that restricts movement, remains as obstacle if misses */
  behaveChainBeast(dt, game, p) {
    const d = dist(this, p);
    if (d < 70 && this.cooldown <= 0) {
      this.cooldown = 1.1;
      game.damagePlayer(rand(this.dmg[0], this.dmg[1]), this.x, this.y);
      return;
    }
    this.chainT = (this.chainT || 0) - dt;
    if (this.chainT <= 0 && d < (this.chainRange || 180) && d > 70) {
      this.chainT = this.chainCd || 4.5;
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      game.effects.push({ type: "ring", x: this.x, y: this.y, r: this.r + 8, t: 0.5, color: "#8b5a2b" });
      game.flash(`${this.name} throws chain!`, "#8b5a2b");
      // telegraph line
      game.effects.push({ type: "beam", x1: this.x, y1: this.y, x2: p.x, y2: p.y, t: 0.5, color: "#8b5a2b" });
      setTimeout(()=>{
        if (dist(this, p) < 90) {
          // hit — restrict movement
          G.slowT = Math.max(G.slowT, 1.8);
          game.effects.push({ type: "hit", x: p.x, y: p.y, t: 0.4, txt: "CHAINED!", color: "#8b5a2b" });
          game.flash("CHAINED!", "#8b5a2b");
        } else {
          // miss — chain remains as temporary obstacle
          const mx = clamp(this.x + Math.cos(ang) * 70, CFG.MARGIN, CFG.W - CFG.MARGIN);
          const my = clamp(this.y + Math.sin(ang) * 70, CFG.MARGIN, CFG.H - CFG.MARGIN);
          game.obstacles = game.obstacles || [];
          const obs = { x: mx - 18, y: my - 8, w: 36, h: 16 };
          game.obstacles.push(obs);
          setTimeout(()=> {
            const idx = game.obstacles.indexOf(obs);
            if (idx >= 0) game.obstacles.splice(idx, 1);
          }, 3500);
          game.effects.push({ type: "ring", x: mx, y: my, r: 22, t: 3.5, color: "#8b5a2b" });
        }
      }, 450);
    } else if (d > 90) {
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      this.x += Math.cos(ang) * this.speed * dt;
      this.y += Math.sin(ang) * this.speed * dt;
    }
  }

  /* BOLT MAW: devours player projectiles in its maw-field; five stolen shots
     come spitting back out. The answer is a blade, not more bolts. */
  behaveBoltEater(dt, game, p) {
    this.eatPulse = (this.eatPulse || 0) - dt;
    if (this.eatPulse <= 0) {
      this.eatPulse = 0.12;
      for (let i = game.projectiles.length - 1; i >= 0; i--) {
        const pr = game.projectiles[i];
        if (pr.team !== "player" || pr.bomb || dist(pr, this) > (this.eatR || 74)) continue;
        game.projectiles.splice(i, 1);
        this.fed = (this.fed || 0) + 1;
        game.effects.push({ type: "spark", x: pr.x, y: pr.y, vx: 0, vy: 0, t: 0.2, color: this.color });
        game.effects.push({ type: "trail", x: pr.x, y: pr.y, t: 0.12, color: this.color, r: 3 });
      }
    }
    if ((this.fed || 0) >= 5) {
      this.fed = 0;
      game.flash(`${this.name} spits your shots back!`, "#a88cff");
      game.SFX && game.SFX.teleport();
      const base = Math.atan2(p.y - this.y, p.x - this.x);
      for (let i = 0; i < 6; i++) {
        const ang = base + (i - 2.5) * 0.17;
        game.projectiles.push(new Projectile("enemy", this.x, this.y,
          Math.cos(ang) * 300, Math.sin(ang) * 300, 5, rand(4, 7), "#a88cff"));
      }
      game.effects.push({ type: "ring", x: this.x, y: this.y, r: 26, t: 0.4, color: "#a88cff" });
    }
    /* it advances the whole time — standing still just feeds it */
    const ang = Math.atan2(p.y - this.y, p.x - this.x);
    this.x += Math.cos(ang) * this.speed * dt;
    this.y += Math.sin(ang) * this.speed * dt;
    if (dist(this, p) < this.r + p.r && this.cooldown <= 0) {
      this.cooldown = 1.0;
      game.damagePlayer(rand(this.dmg[0], this.dmg[1]), this.x, this.y);
    }
  }

  /* ---------- replayability: mini-bosses — each punishes a strategy ---------- */
  /* WARDEN OF BOLTS: anti-ranged — point defense erases projectiles, melee is the answer */
  behaveMBWarden(dt, game, p) {
    this.dodgeIncoming(dt, game);
    const d = Math.max(1, dist(this, p));
    const want = 240;
    if (d < want - 40) { this.x -= (p.x - this.x) / d * this.speed * 0.8 * dt; this.y -= (p.y - this.y) / d * this.speed * 0.8 * dt; }
    else if (d > want + 40) { this.x += (p.x - this.x) / d * this.speed * dt; this.y += (p.y - this.y) / d * this.speed * dt; }
    /* point defense: periodically sweeps incoming shots out of the air */
    this.pdCd = (this.pdCd === undefined ? 2.2 : this.pdCd) - dt;
    if (this.pdCd <= 0) {
      let zapped = 0;
      for (let i = game.projectiles.length - 1; i >= 0; i--) {
        const pr = game.projectiles[i];
        if (pr.team !== "player" || dist(pr, this) > 95) continue;
        game.effects.push({ type: "spark", x: pr.x, y: pr.y, vx: 0, vy: -60, t: 0.2, color: "#5ab8ff" });
        game.projectiles.splice(i, 1);
        zapped++;
      }
      if (zapped) { game.flash(`${this.name} sweeps your shots aside!`, "#5ab8ff"); game.SFX && game.SFX.shield(); }
      this.pdCd = 2.2;
    }
    if (this.cooldown <= 0) {
      this.cooldown = 2.4;
      const base = Math.atan2(p.y - this.y, p.x - this.x);
      for (let i = 0; i < 5; i++) {
        const ang = base + (i - 2) * 0.22;
        game.projectiles.push(new Projectile("enemy", this.x, this.y, Math.cos(ang) * 300, Math.sin(ang) * 300, 5, rand(this.dmg[0], this.dmg[1]), "#5ab8ff"));
      }
    }
  }

  /* BLADE PARAGON: anti-melee — parries swings up close, dashes in for a triple cut */
  behaveMBParagon(dt, game, p) {
    const d = dist(this, p);
    /* read the player's swing: if a melee arc comes in, raise the guard */
    if (d < 90 && p.swing > 0.12 && (this.parryCd || 0) <= 0) {
      this.shieldT = 0.4;
      this.parryCd = 1.6;
      game.effects.push({ type: "ring", x: this.x, y: this.y, r: this.r + 10, t: 0.4, color: "#e8d17a" });
      game.flash(`${this.name} PARRIES!`, "#e8d17a");
      game.SFX && game.SFX.shield();
    }
    this.parryCd = Math.max(0, (this.parryCd || 0) - dt);
    if (this.lungeT > 0) {
      this.lungeT -= dt;
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      this.x += Math.cos(ang) * 340 * dt;
      this.y += Math.sin(ang) * 340 * dt;
      if (dist(this, p) < this.r + p.r + 8 && this.cooldown <= 0) {
        this.cooldown = 0.5;
        game.damagePlayer(rand(this.dmg[0], this.dmg[1]), this.x, this.y);
      }
      this.clamp();
      return;
    }
    const ang = Math.atan2(p.y - this.y, p.x - this.x);
    this.x += Math.cos(ang) * this.speed * 0.6 * dt;
    this.y += Math.sin(ang) * this.speed * 0.6 * dt;
    this.dashCd2 = (this.dashCd2 === undefined ? 2.6 : this.dashCd2) - dt;
    if (this.dashCd2 <= 0 && d > 110 && d < 300) {
      this.dashCd2 = rand(2.4, 3.6);
      this.lungeT = 0.45;
      game.effects.push({ type: "ring", x: this.x, y: this.y, r: this.r + 8, t: 0.35, color: "#e8d17a" });
    }
  }

  /* THE GLUTTON: anti-grouping — swallows small foes to mend itself, slams hard */
  behaveMBGlutton(dt, game, p) {
    /* feast: eats any nearby runt and heals — punishing swarm/group play */
    for (const o of [...game.enemies]) {
      if (o === this || o.dead || o.isNPC) continue;
      const small = o.kind === "swarm" || o.kind === "imp" || o.r <= 10;
      if (small && dist(this, o) < this.r + o.r + 8) {
        game.effects.push({ type: "boom", x: o.x, y: o.y, t: 0.3 });
        game.killEnemy(o, true);
        this.hp = Math.min(this.maxHp, this.hp + 20);
        this.fed = (this.fed || 0) + 1;
        game.effects.push({ type: "heal", x: this.x, y: this.y - 16, t: 0.4, txt: "+20", color: "#6bff9a" });
        game.flash(`${this.name} DEVOURS a runt!`, "#b83a3a");
      }
    }
    const d = dist(this, p);
    if (d > this.r + p.r + 16) {
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      const sp = this.speed * (1 + Math.min(0.6, (this.fed || 0) * 0.15));
      this.x += Math.cos(ang) * sp * dt;
      this.y += Math.sin(ang) * sp * dt;
    } else if (this.cooldown <= 0) {
      this.cooldown = 1.4;
      game.damagePlayer(rand(this.dmg[0], this.dmg[1]), this.x, this.y);
      game.shake = Math.max(game.shake, 0.18);
    }
  }

  /* NULLSINGER: anti-slow-damage — phases out between strikes, calls the void */
  behaveMBNullsinger(dt, game, p) {
    this.nsCd = (this.nsCd === undefined ? 4.5 : this.nsCd) - dt;
    if (this.nsCd <= 0) {
      this.nsCd = rand(4.5, 6);
      this.phased = true;
      this.phaseT2 = 1.1;
      game.effects.push({ type: "boom", x: this.x, y: this.y, t: 0.3 });
      game.flash(`${this.name} slips out of reach…`, "#a78bfa");
      for (let i = 0; i < 2; i++) {
        const imp = new Enemy(Object.assign({}, ENEMY_TYPES.imp, { name: "NULL MOTE" }),
          clamp(this.x + rand(-40, 40), CFG.MARGIN, CFG.W - CFG.MARGIN),
          clamp(this.y + rand(-40, 40), CFG.MARGIN, CFG.H - CFG.MARGIN));
        imp.summoned = true;
        game.enemies.push(imp);
      }
    }
    if (this.phaseT2 > 0) {
      this.phaseT2 -= dt;
      if (this.phaseT2 <= 0) this.phased = false;
      return;   // gone — burst damage during the visible window is the counter
    }
    const d = Math.max(1, dist(this, p));
    const want = 220;
    if (d < want - 40) { this.x -= (p.x - this.x) / d * this.speed * 0.8 * dt; this.y -= (p.y - this.y) / d * this.speed * 0.8 * dt; }
    else if (d > want + 40) { this.x += (p.x - this.x) / d * this.speed * dt; this.y += (p.y - this.y) / d * this.speed * dt; }
    if (this.cooldown <= 0) {
      this.cooldown = 2.6;
      const base = Math.atan2(p.y - this.y, p.x - this.x);
      for (let i = 0; i < 3; i++) {
        const ang = base + (i - 1) * 0.3;
        game.projectiles.push(new Projectile("enemy", this.x, this.y, Math.cos(ang) * 270, Math.sin(ang) * 270, 6, rand(this.dmg[0], this.dmg[1]), "#a78bfa"));
      }
    }
  }

  /* GILDED MIMIC: bolts with the treasure — kill it before it slips away */
  behaveGildedMimic(dt, game, p) {
    this.despawnT = (this.despawnT === undefined ? 9 : this.despawnT) - dt;
    if (this.despawnT <= 0) {
      game.flash("The mimic escapes with the gold…", "#9a90b8");
      game.effects.push({ type: "boom", x: this.x, y: this.y, t: 0.3 });
      game.killEnemy(this, true);
      return;
    }
    const ang = Math.atan2(this.y - p.y, this.x - p.x) + Math.sin(game.time * 3) * 0.7;
    this.x = clamp(this.x + Math.cos(ang) * this.speed * dt, CFG.MARGIN, CFG.W - CFG.MARGIN);
    this.y = clamp(this.y + Math.sin(ang) * this.speed * dt, CFG.MARGIN, CFG.H - CFG.MARGIN);
    if (Math.random() < 0.2) game.effects.push({ type: "spark", x: this.x + rand(-8, 8), y: this.y + rand(-8, 8), vx: 0, vy: -30, t: 0.3, color: "#ffd166" });
  }

  /* ---------- boss AI: chase + volley + radial + spiral + summon + enrages ---------- */
  /* boss AI states: intro (arrival) → chase → attack (committed pattern)
     → recovery (punishable beat) → chase; enrage thresholds cut to a brief
     invulnerable PHASE shift. Movement and pattern initiation follow state. */
  setBossState(s, t) {
    this.bossState = s;
    this.bossStateT = t !== undefined ? t : 0;
    if (s === "phase") this.shieldT = Math.max(this.shieldT || 0, 0.9);   // the shift is invulnerable
  }

  updateBoss(dt, game) {
    const p = game.player;
    const b = this.boss;
    const d = dist(this, p);
    this.bossStateT -= dt;

    if (this.bossState === "intro" || this.bossState === "phase") {
      /* arrival / phase-shift beat: standing, invulnerable, committed to nothing */
      if (this.bossState === "phase") this.shieldT = Math.max(this.shieldT, 0.1);
      if (this.bossStateT <= 0) this.setBossState("chase");
      return;
    }
    if (this.bossState === "attack" && this.bossStateT <= 0)
      this.setBossState("recovery", 0.3 + Math.random() * 0.25);
    if (this.bossState === "recovery" && this.bossStateT <= 0)
      this.setBossState("chase");

    const ang = Math.atan2(p.y - this.y, p.x - this.x);
    if (this.bossState === "chase") {
      if (d > 160) {
        const sp = this.speed * (this.enraged2 ? 1.45 : this.enraged ? 1.25 : 1);
        this.x += Math.cos(ang) * sp * dt;
        this.y += Math.sin(ang) * sp * dt;
      } else if (d < 90) {
        this.x -= Math.cos(ang) * this.speed * 0.5 * dt;
        this.y -= Math.sin(ang) * this.speed * 0.5 * dt;
      }
    } else if (this.bossState === "attack" && d > 130) {
      /* committed patterns allow a heavy drift, not a chase */
      this.x += Math.cos(ang) * this.speed * 0.35 * dt;
      this.y += Math.sin(ang) * this.speed * 0.35 * dt;
    }
    /* recovery: stands its ground — that's the punish window */

    if (d < this.r + p.r && this.cooldown <= 0) {
      this.cooldown = 1.0;
      game.damagePlayer(rand(this.dmg[0], this.dmg[1]), this.x, this.y);
    }

    if (!this.enraged && this.hp < this.maxHp * (b.enrageAt || 0.5)) {
      this.enraged = true;
      game.flash(`${this.name} is ENRAGED!`, "#ff5a2a");
      game.slowmoT = 0.9;                    // idea 31: slow-mo cinematic
      game.shake = Math.max(game.shake, 0.3);
      this.setBossState("phase", 0.9);
      game.SFX && game.SFX.boss();
    }
    /* New Game+ secret — the SECOND CROWN: once, at the brink, the lord mends */
    if (b.secondCrown && !this.crownUsed && this.hp < this.maxHp * 0.12) {
      this.crownUsed = true;
      this.hp = Math.round(this.maxHp * 0.18);
      this.shieldT = 1.5;
      game.flash(`${this.name} dons the SECOND CROWN!`, "#ff2a6a");
      game.slowmoT = 0.8;
      game.shake = Math.max(game.shake, 0.35);
      game.effects.push({ type: "ring", x: this.x, y: this.y, r: this.r + 44, t: 0.7, color: "#ff2a6a" });
      this.setBossState("phase", 1.0);
      game.SFX && game.SFX.boss();
    }
    if (!this.enraged2 && b.enrage2At && this.hp < this.maxHp * b.enrage2At) {
      this.enraged = true; this.enraged2 = true;
      game.flash(`${this.name} goes BERSERK!`, "#ff2a6a");
      game.slowmoT = 0.9;                    // idea 31
      game.shake = Math.max(game.shake, 0.35);
      this.setBossState("phase", 0.9);
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
    /* chapter two: phase-gated kits — patterns may declare `from: 2/3` so
       bosses escalate by UNLOCKING mechanics, not just attacking faster */
    const phase = this.enraged2 ? 3 : this.enraged ? 2 : 1;
    const ready = c => !c.from || phase >= c.from;

    this.volleyT -= dt;
    if (b.volley && ready(b.volley) && this.volleyT <= 0 && this.bossState === "chase") {
      this.volleyT = (b.volleyCd || 2.4) * mult;
      this.setBossState("attack", 0.4);   // committed to the volley
      game.bossVolley(this, b.volley);
    }
    if (b.radial && ready(b.radial)) {
      this.radialT -= dt;
      if (this.radialT <= 0 && this.bossState === "chase") {
        this.radialT = (b.radialCd || 3.5) * mult;
        this.setBossState("attack", 0.5);   // the eruption plants it
        game.bossRadial(this, b.radial);
      }
    }
    if (b.summon && ready(b.summon)) {
      this.bossSumT -= dt;
      if (this.bossSumT <= 0) {
        this.bossSumT = b.summon.cd * mult;
        game.bossSummon(this, b.summon);
      }
    }
    if (b.spiral && ready(b.spiral)) {
      this.spiralT -= dt;
      if (this.spiralT <= 0) {
        this.spiralT = b.spiral.step * mult;
        game.bossSpiral(this, b.spiral, this.spiralAng);
        this.spiralAng += b.spiral.twist;
      }
    }
    /* idea 34: laser sweep */
    if (b.laser && ready(b.laser)) {
      this.laserT = (this.laserT || 0) - dt;
      if (this.laserT <= 0 && this.bossState === "chase") {
        this.laserT = b.laser.cd * mult;
        this.laserAng = Math.atan2(p.y - this.y, p.x - this.x) - b.laser.sweep / 2;
        this.laserSpin = b.laser.sweep / 1.2;
        this.setBossState("attack", 1.2);   // the sweep is a committed stance
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
    if (b.aoe && ready(b.aoe)) {
      this.aoeT = (this.aoeT || 0) - dt;
      if (this.aoeT <= 0 && this.bossState === "chase") {
        this.aoeT = b.aoe.cd * mult;
        this.setBossState("attack", 0.4);
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
    // New unique boss patterns — distinct, telegraphed, counterable
    this.updateNewPatterns(dt, game);
    /* idea 18: per-boss signature mechanics — each depth's boss fights differently */
    const mechs = Array.isArray(b.mech) ? b.mech : (b.mech ? [b.mech] : []);
    for (const m of mechs) this.runMech(m, dt, game, b);
  }

  // New unique patterns: telegraphed slam, homing orb, cross beam — gated so the first lord stays fair
  updateNewPatterns(dt, game) {
    if ((G.level || 1) <= 1) return; // GOBLIN CHIEFTAIN stays readable — no extra hammers/homing
    const p = game.player;
    const b = this.boss;
    // Delayed Hammer — telegraphed AOE that forces movement
    this.hammerT = (this.hammerT || 0) - dt;
    if (this.hammerT === undefined) this.hammerT = 4.5;
    if (this.hammerT <= 0) {
      this.hammerT = 5.5;
      this.hammerTelegraph = 1.0;
      game.flash(`${this.name} raises its hammer!`, "#ffd166");
      game.effects.push({ type: "ring", x: this.x, y: this.y, r: this.r + 30, t: 1.0, color: "#ffd166" });
      game.SFX && game.SFX.boss();
    }
    if (this.hammerTelegraph > 0) {
      this.hammerTelegraph -= dt;
      game.effects.push({ type: "ring", x: this.x, y: this.y, r: this.r + 30 + (1.0 - this.hammerTelegraph)*40, t: 0.08, color: "#ffd166" });
      if (this.hammerTelegraph <= 0) {
        // slam — large AOE, must move away
        game.shake = Math.max(game.shake, 0.4);
        game.effects.push({ type: "boom", x: this.x, y: this.y, t: 0.5 });
        for (let i = 0; i < 16; i++) {
          const ang = (i/16)*Math.PI*2;
          game.projectiles.push(new Projectile("enemy", this.x, this.y, Math.cos(ang)*220, Math.sin(ang)*220, 6, rand(7,11), "#ffd166"));
        }
        if (dist(this, p) < 120) game.damagePlayer(rand(10,15), this.x, this.y);
      }
    }
    // Homing Orb — slow orb that follows player, punishes staying still
    this.homingT = (this.homingT || 0) - dt;
    if (this.homingT <= 0) {
      this.homingT = 7;
      game.flash(`${this.name} summons a homing orb!`, "#c084fc");
      const orb = new Projectile("enemy", this.x, this.y, 0, 0, 10, rand(8,12), "#c084fc", { homing: true });
      orb.homing = true;
      orb.ttl = 6;
      game.projectiles.push(orb);
      game.effects.push({ type: "ring", x: this.x, y: this.y, r: 16, t: 0.6, color: "#c084fc" });
    }
  }

  runMech(m, dt, game, b) {
    const p = game.player;
    switch (m) {
      /* BONE WARDEN: raises a guard — frontal damage blocked while it lasts */
      case "shield": {
        // shieldT decays generically (top of update + updateBoss); here we only count the downtime
        if ((this.shieldT || 0) <= 0) {
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
        if (this.chargeT <= 0 && dist(this, p) < 340 && this.bossState === "chase") {
          this.chargeT = b.mechCd || 5;
          this.windup = 0.7;
          this.setBossState("attack", 0.7);
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
      /* VOLDRIC / AZHAROTH: sky strikes — telegraphed bolts on your position */
      case "lightning": {
        this.boltT = (this.boltT || 0) - dt;
        if (this.boltT <= 0) {
          this.boltT = b.mechCd || 5;
          const n = this.enraged2 ? 3 : this.enraged ? 2 : 1;
          game.flash(`${this.name} calls down the storm!`, "#ffd166");
          game.SFX && game.SFX.boss();
          for (let i = 0; i < n; i++) {
            const zx = clamp(p.x + rand(-70, 70) + i * 45 - n * 22, CFG.MARGIN, CFG.W - CFG.MARGIN);
            const zy = clamp(p.y + rand(-70, 70) + i * 35 - n * 17, CFG.MARGIN, CFG.H - CFG.MARGIN);
            game.G.aoeZones.push({ x: zx, y: zy, r: 52, t: 0.8, max: 0.8, dmg: [9, 13], color: "#ffd166" });
            game.effects.push({ type: "ring", x: zx, y: zy, r: 52, t: 0.8, color: "#ffd166" });
          }
        }
        break;
      }
      /* ORUN: forge vents — staggered bursts plus lingering heat pools shrink the arena */
      case "vents": {
        this.ventT = (this.ventT || 0) - dt;
        if (this.ventT <= 0) {
          this.ventT = b.mechCd || 6.5;
          game.flash(`${this.name} stokes the forge!`, "#ffb45e");
          game.shake = Math.max(game.shake, 0.2);
          for (let i = 0; i < 4; i++) {
            const zx = rand(CFG.MARGIN + 20, CFG.W - CFG.MARGIN - 20);
            const zy = rand(CFG.MARGIN + 20, CFG.H - CFG.MARGIN - 20);
            game.G.aoeZones.push({ x: zx, y: zy, r: 64, t: 0.9 + i * 0.25, max: 0.9, dmg: [9, 13], color: "#ffb45e" });
            game.effects.push({ type: "ring", x: zx, y: zy, r: 64, t: 0.9 + i * 0.25, color: "#ffb45e" });
          }
          if (typeof spawnHazardZone === "function") {
            for (let i = 0; i < 2; i++) {
              spawnHazardZone(rand(CFG.MARGIN + 40, CFG.W - CFG.MARGIN - 40), rand(CFG.MARGIN + 40, CFG.H - CFG.MARGIN - 40),
                { r: 44, life: 4, dps: 7, color: "#ff8b3d" });
            }
          }
        }
        break;
      }
      /* VESPERA: mirror echoes — temporary clones that volley, then shatter on their own */
      case "clones": {
        this.cloneT = (this.cloneT || 0) - dt;
        if (this.cloneT <= 0) {
          this.cloneT = (b.mechCd || 6) * 1.6;
          game.flash(`${this.name} shatters into echoes!`, "#c0a8f0");
          for (let i = 0; i < 2; i++) {
            const def = Object.assign({}, ENEMY_TYPES.shooter, {
              name: "GLASS ECHO", hp: 26, r: 11, speed: 110, dmg: [4, 7], color: "#c0a8f0",
              fireCd: 1.8, proj: { speed: 300, r: 5, color: "#c0a8f0", dmg: [5, 8] },
            });
            const ang = Math.random() * Math.PI * 2;
            const e = new Enemy(def,
              clamp(this.x + Math.cos(ang) * 60, CFG.MARGIN, CFG.W - CFG.MARGIN),
              clamp(this.y + Math.sin(ang) * 60, CFG.MARGIN, CFG.H - CFG.MARGIN));
            e.summoned = true;   // echoes don't count toward the clear
            e.echoTtl = 9;       // ...and can't flood the arena
            game.enemies.push(e);
            game.effects.push({ type: "boom", x: e.x, y: e.y, t: 0.3 });
          }
          game.SFX && game.SFX.teleport();
        }
        break;
      }
      /* AZHAROTH: emberfall — a marching wall of strikes chasing across the arena */
      case "emberfall": {
        this.fallT = (this.fallT || 0) - dt;
        if (this.fallT <= 0) {
          this.fallT = b.mechCd || 5.5;
          game.flash(`${this.name} rains the EMBERFALL!`, "#ff5a2a");
          game.shake = Math.max(game.shake, 0.2);
          const ang = Math.atan2(p.y - this.y, p.x - this.x);
          for (let i = 1; i <= 6; i++) {
            const zx = clamp(this.x + Math.cos(ang) * i * 90 + rand(-30, 30), CFG.MARGIN, CFG.W - CFG.MARGIN);
            const zy = clamp(this.y + Math.sin(ang) * i * 90 + rand(-30, 30), CFG.MARGIN, CFG.H - CFG.MARGIN);
            game.G.aoeZones.push({ x: zx, y: zy, r: 56, t: 0.5 + i * 0.22, max: 0.5, dmg: [10, 14], color: "#ff8b3d" });
            game.effects.push({ type: "ring", x: zx, y: zy, r: 56, t: 0.5 + i * 0.22, color: "#ff8b3d" });
          }
        }
        break;
      }
    }
  }

  updateNPC(dt, game) {
    const p = game.player;
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.npcTimer -= dt;
    if (this.npcState === "idle") {
      this.y += Math.sin(game.time * 1.2 + this.x) * 0.12;
      if (this.npcTimer <= 0) {
        this.npcState = "wander";
        this.npcTimer = rand(1, 2);
        this.npcDir = Math.random() * Math.PI * 2;
        game.effects.push({ type: "ring", x: this.x, y: this.y, r: this.r + 4, t: 0.25, color: this.color });
      }
    } else if (this.npcState === "wander") {
      this.x += Math.cos(this.npcDir) * this.speed * 0.7 * dt;
      this.y += Math.sin(this.npcDir) * this.speed * 0.7 * dt;
      this.clamp();
      if (dist(this, p) < 50) this.npcDir += Math.PI;
      for (const o of game.obstacles || []) {
        if (circleRect(this.x, this.y, this.r, o)) { this.npcDir += Math.PI / 2; break; }
      }
      if (this.npcTimer <= 0) {
        this.npcState = "stop";
        this.npcTimer = rand(0.6, 1.2);
      }
    } else if (this.npcState === "stop") {
      if (this.npcTimer <= 0) {
        this.npcState = "idle";
        this.npcTimer = rand(1.5, 2.5);
      }
    }
  }

  /* A former lord stung awake: restore its ORIGINAL kit with fresh combat
     state. Called from hurtEnemy on the first blow — the wake beat is a
     telegraphed, invulnerable intro, never a free kill. */
  wakeFromNpc(game) {
    const def = (typeof enrichBossNG === "function" && G.ngPlus) ? enrichBossNG(this.originalBoss) : this.originalBoss;
    this.isNPC = false;
    this.npcHostile = false;
    this.isBoss = true;
    this.boss = def;
    this.r = this.originalR;
    this.color = this.originalColor;
    this.maxHp = Math.max(1, Math.round(def.hp * (typeof CHALLENGE !== "undefined" ? CHALLENGE.bossHp : 1)));
    this.hp = this.maxHp;
    this.speed = def.speed;
    this.name = def.name;
    /* fresh timers — the lord remembers nothing of its stroll */
    this.enraged = false; this.enraged2 = false;
    this.crownUsed = false; this.despairDone = false;
    this.volleyT = def.volleyCd || 3;
    this.radialT = def.radialCd || 0;
    this.bossSumT = 4; this.spiralT = 0; this.spiralAng = Math.random() * Math.PI * 2;
    this.laserT = 0; this.laserSpin = 0; this.aoeT = 0;
    this.mechShieldT = 0; this.shieldT = 0;
    this.cooldown = 0; this.knock = 0; this.hurtT = 0.15;
    this.bossState = "intro";
    this.bossStateT = 1.0;
    this.shieldT = 1.0;   // the windup is your warning
    game.shake = Math.max(game.shake, 0.35);
    game.slowmoT = 0.7;
    game.flash(`⚠ ${def.name} AWAKENS!`, "#ff7847");
    game.effects.push({ type: "ring", x: this.x, y: this.y, r: this.r + 46, t: 0.8, color: "#ff7847" });
    game.SFX && game.SFX.boss();
    const banner = document.getElementById("bossBanner");
    if (banner) {
      banner.textContent = `⚔️ ${def.name} ⚔️`;
      banner.classList.add("show");
      setTimeout(() => banner.classList.remove("show"), 2000);
    }
  }
}

/* ---------- projectiles (player bolts & enemy shots) ----------
   opts: { slow, boom, boomR, boomDmg, boomerang, bomb, fuse, pool, bounce,
           chakram, pierce, burn, well, src, bolt } */
function sweptHit(ax, ay, bx, by, r, ex, ey, er){
  const cr = r + er;
  const abx = bx - ax, aby = by - ay;
  const aex = ex - ax, aey = ey - ay;
  const abLen2 = abx*abx + aby*aby;
  if (abLen2 === 0) return Math.hypot(aex, aey) < cr;
  let t = (aex*abx + aey*aby) / abLen2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + abx*t, cy = ay + aby*t;
  return Math.hypot(ex - cx, ey - cy) < cr;
}

/* on-hit riders shared by every player projectile: flame bow ignites,
   void dagger streaks build into an attack-speed frenzy */
function onPlayerProjectileHit(pr, e, game) {
  if (pr.burn && !e.isBoss) { e.burnT = 2.5; e.burnDps = 3; }
  else if (pr.burn) { e.burnT = 1.6; e.burnDps = 3; }   // bosses shrug off most of the blaze
  /* TEMPEST: lightning spear bolts leap to one more foe */
  if (pr.src === "lspear" && (G.syn || []).includes("tempest") && !e.dead) {
    let target = null, best = 150;
    for (const o of game.enemies) {
      if (o === e || o.dead || o.isNPC || o.phased) continue;
      const d = dist(e, o);
      if (d < best) { best = d; target = o; }
    }
    if (target) {
      game.effects.push({ type: "beam", x1: e.x, y1: e.y, x2: target.x, y2: target.y, t: 0.15, color: "#ffd166" });
      const hit = game.playerDamage();
      game.hurtEnemy(target, Math.round(hit.d * 0.6), 0, 0, { knock: 0.1, crit: hit.crit, color: "#ffd166" });
    }
  }
  /* COMBUSTION: bolt weapons pop burning foes like dry kindling */
  if (!pr.burn && e.burnT > 0 && (G.syn || []).includes("combustion") && !e.dead && !e.isNPC) {
    const burst = 6 + G.level;
    e.burnT = 0;
    game.effects.push({ type: "boom", x: e.x, y: e.y, t: 0.3 });
    game.effects.push({ type: "hit", x: e.x, y: e.y - 16, t: 0.3, txt: "COMBUST!", color: "#ff8b3d" });
    for (const o of [...game.enemies]) {
      if (o === e || o.isNPC) continue;
      if (dist(e, o) < 55) game.hurtEnemy(o, Math.round(burst * 0.6), 0, 0, { knock: 0.15, color: "#ff8b3d" });
    }
    game.hurtEnemy(e, burst, 0, 0, { knock: 0.15, color: "#ff8b3d" });
  }
  if (pr.src === "void" && !e.dead) {
    G.voidStreak = (G.voidStreakT > 0 ? G.voidStreak : 0) + 1;
    G.voidStreakT = 2.5;
    if (G.voidStreak >= 3) {
      G.voidStreak = 0;
      G.voidBuffT = 3.5;
      if (typeof flash === "function") flash("VOID FRENZY — attacks hastened!", "#a88cff");
      game.effects.push({ type: "ring", x: game.player.x, y: game.player.y, r: 30, t: 0.5, color: "#a88cff" });
    }
  }
}
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
    this.pool = (opts && opts.pool) || null;       // chapter two: splashes into a hazard zone
    this.bounce = (opts && opts.bounce) || 0;      // chapter two: glass shards ricochet off walls
    this.chakram = !!(opts && opts.chakram);       // disc: bounces once, returns, re-cuts on the way back
    this.returning = false;
    this.ricocheting = !!(opts && opts.ricochet);  // ricochet gun: caroms off walls
    this.pierce = !!(opts && opts.pierce);         // lightning bolt: passes through foes
    this.burn = !!(opts && opts.burn);             // flame bow: ignites the target
    this.well = (opts && opts.well) || null;       // gravity orb: collapses into a pull zone
    this.src = (opts && opts.src) || null;         // firing weapon (void dagger streak tracking)
    this.bolt = !!(opts && opts.bolt);             // elongated lightning render
    this.hitSet = new Set();
    this.px = x; this.py = y; // previous pos for swept
  }
  /* chapter two: acid globs / webs splash into a lingering floor zone when they land */
  splash(game) {
    if (!this.pool || typeof spawnHazardZone !== "function") return;
    spawnHazardZone(clamp(this.x, CFG.MARGIN, CFG.W - CFG.MARGIN), clamp(this.y, CFG.MARGIN, CFG.H - CFG.MARGIN), this.pool);
  }
  update(dt, game) {
    const prevX = this.x, prevY = this.y;
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
    /* chakram: flies out, then carves its way back to the hand —
       the return leg may cut the same foe again */
    if (this.chakram) {
      this.t += dt;
      if (!this.returning && this.t > 0.5) { this.returning = true; this.hitSet.clear(); }
      if (this.returning) {
        const p = game.player;
        const ang = Math.atan2(p.y - this.y, p.x - this.x);
        this.vx += Math.cos(ang) * 900 * dt;
        this.vy += Math.sin(ang) * 900 * dt;
        const sp = Math.hypot(this.vx, this.vy);
        if (sp > 430) { this.vx = this.vx / sp * 430; this.vy = this.vy / sp * 430; }
        if (dist(this, p) < 26) return true;   // caught
      }
    }
    // Homing orb — new boss pattern
    if (this.homing) {
      const p = game.player;
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      const homingStrength = 180;
      this.vx += Math.cos(ang) * homingStrength * dt;
      this.vy += Math.sin(ang) * homingStrength * dt;
      const sp = Math.hypot(this.vx, this.vy);
      if (sp > 260) { this.vx = this.vx / sp * 260; this.vy = this.vy / sp * 260; }
      if (Math.random() < 0.15) game.effects.push({ type: "trail", x: this.x, y: this.y, t: 0.2, color: "#c084fc", r: 5 });
    }
    this.ttl -= dt;
    // God Run perk 3: Sword Bounce — player projectiles bounce
    const canBounce = G.difficulty === "godrun" && typeof isGodPerkUnlocked === "function" && isGodPerkUnlocked(3) && this.team === "player";
    if (this.x < 0 || this.x > CFG.W || this.y < 0 || this.y > CFG.H) {
      if (this.bounce > 0 && (this.team === "enemy" || this.chakram || this.ricocheting)) {
        /* ricochet: enemy glass shards + player chakram/ricochet shots carom off walls */
        if (this.x < 0 || this.x > CFG.W) this.vx = -this.vx;
        if (this.y < 0 || this.y > CFG.H) this.vy = -this.vy;
        this.x = clamp(this.x, 0, CFG.W);
        this.y = clamp(this.y, 0, CFG.H);
        this.bounce--;
        this.hitSet.clear();                       // a carom lets it cut the same foe again
        if (this.chakram) this.returning = true;   // the wall sends the disc home
        game.effects.push({ type: "spark", x: this.x, y: this.y, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, t: 0.2, color: this.color });
        SFX.hit();
      } else if (canBounce && this.ttl > 0.5) {
        if (this.x < 0 || this.x > CFG.W) this.vx = -this.vx * 0.95;
        if (this.y < 0 || this.y > CFG.H) this.vy = -this.vy * 0.95;
        this.x = clamp(this.x, 0, CFG.W);
        this.y = clamp(this.y, 0, CFG.H);
        this.bounces = (this.bounces || 0) + 1;
        if (this.bounces > 3) this.ttl = 0;
        else {
          game.effects.push({ type: "spark", x: this.x, y: this.y, vx: (Math.random()-0.5)*60, vy: (Math.random()-0.5)*60, t: 0.2, color: "#ffd166" });
          SFX.hit();
        }
      } else this.ttl = 0;
    }
    if (this.ttl <= 0) {
      if (this.pool) this.splash(game);   // landed: leave the pool behind
      if (this.well && this.team === "player") spawnGravityWell(this.x, this.y, this.well);
      if (this.chain && this.team === "player") {
        // chain reached max range without a hook — the exile still comes down at your feet
        if (typeof chainSlam === "function" && game && game.player) chainSlam(game.player.x, game.player.y);
        else if (game && game.player) game.effects.push({ type: "ring", x: game.player.x, y: game.player.y, r: (typeof CHAIN_ABILITY!=="undefined"?CHAIN_ABILITY.aoeR:125), t: 0.3, color: "#c8c8e8" });
      }
      return true; // remove
    }

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

    // Bomb — explode on enemy contact (swept, immediate)
    if (this.bomb && this.team === "player") {
      for (const e of game.enemies) {
        if (e.isNPC) continue;
        if (sweptHit(prevX, prevY, this.x, this.y, this.r, e.x, e.y, e.r)) {
          game.explodePlayer(this.x, this.y, this.boomR, this.boomDmg);
          return true;
        }
      }
    }
    if (this.team === "player") {
      /* base chain — hook, pull, exile */
      if (this.chain) {
        if (game && game.player) {
          game.chainFx = { x0: game.player.x, y0: game.player.y, x1: this.x, y1: this.y, t: 0.08, color: "#c8c8e8" };
          game.effects.push({ type: "trail", x: this.x, y: this.y, t: 0.10, color: "#c8c8e8", r: 3 });
        }
        for (const e of game.enemies) {
          if (e.isNPC || e.dead || e.phased) continue;
          if (sweptHit(prevX, prevY, this.x, this.y, this.r, e.x, e.y, e.r)) {
            if (e.isBoss && (e.shieldT || 0) > 0) {
              game.effects.push({ type: "hit", x: e.x, y: e.y - 12, t: 0.3, txt: "BLOCKED", color: "#c8c8e8" });
              if (typeof chainSlam === "function" && game.player) chainSlam(game.player.x, game.player.y);
              return true;
            }
            game.chain = { target: e, t: (typeof CHAIN_ABILITY !== "undefined" ? CHAIN_ABILITY.pullTime : 0.32), total: (typeof CHAIN_ABILITY !== "undefined" ? CHAIN_ABILITY.pullTime : 0.32) };
            game.chainFx = { x0: game.player.x, y0: game.player.y, x1: e.x, y1: e.y, t: (typeof CHAIN_ABILITY !== "undefined" ? CHAIN_ABILITY.pullTime : 0.32), color: "#c8c8e8" };
            game.effects.push({ type: "beam", x1: game.player.x, y1: game.player.y, x2: e.x, y2: e.y, t: 0.18, color: "#c8c8e8" });
            game.effects.push({ type: "ring", x: e.x, y: e.y, r: e.r + 10, t: 0.25, color: "#c8c8e8" });
            if (typeof SFX !== "undefined" && SFX.hit) SFX.hit();
            if (typeof flash === "function") flash(`⛓️ HOOKED ${e.name}!`, "#c8c8e8");
            return true;
          }
        }
        return false;
      }
      /* idea 40: projectiles can break crates */
      for (const c of game.crates || []) {
        if (sweptHit(prevX, prevY, this.x, this.y, this.r, c.x, c.y, c.r)) {
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
        if (e.isNPC) continue;
        if (sweptHit(prevX, prevY, this.x, this.y, this.r, e.x, e.y, e.r)) {
          if (this.boom) {
            game.explodePlayer(this.x, this.y, this.boomR, this.boomDmg);
            return true; // bolt consumed
          }
          if (this.well) {                          // gravity orb: collapse on first contact
            spawnGravityWell(this.x, this.y, this.well);
            return true;
          }
          if (this.boomerang || this.chakram || this.pierce) {   // pass through: hit each foe once per leg
            if (this.hitSet.has(e)) continue;
            this.hitSet.add(e);
            const hit = game.playerDamage();
            game.hurtEnemy(e, hit.d, Math.cos(Math.atan2(this.vy, this.vx)) * 6, Math.sin(Math.atan2(this.vy, this.vx)) * 6,
              { knock: 0.18, crit: hit.crit });
            onPlayerProjectileHit(this, e, game);
            continue;
          }
          const hit = game.playerDamage();
          game.hurtEnemy(e, hit.d, Math.cos(Math.atan2(this.vy, this.vx)) * 6, Math.sin(Math.atan2(this.vy, this.vx)) * 6,
            { knock: 0.18, crit: hit.crit });
          onPlayerProjectileHit(this, e, game);
          return true; // bolt consumed
        }
      }
    } else {
      const p = game.player;
      if (sweptHit(prevX, prevY, this.x, this.y, this.r, p.x, p.y, p.r)) {
        game.damagePlayer(this.dmg, this.x, this.y, this.slow ? "slow" : null);
        if (this.pool) this.splash(game);   // hit you: it still splashes
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
