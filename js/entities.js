/* ============================================================
   EMBERQUEST 2D — entities: Player, Enemy, Projectile, Pickup, Wave
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
  }

  update(dt, game) {
    const p = game.player;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);

    if (this.knock > 0) {
      this.knock -= dt;
      this.x += this.kx; this.y += this.ky;
      this.clamp();
      return;
    }

    if (this.isBoss) { this.updateBoss(dt, game); return; }
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
    }
  }

  /* ranged: keep distance, fire projectiles (freezer shots chill) */
  behaveShooter(dt, game, p) {
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
      game.SFX && game.SFX.boss();
    }
    if (!this.enraged2 && b.enrage2At && this.hp < this.maxHp * b.enrage2At) {
      this.enraged = true; this.enraged2 = true;
      game.flash(`${this.name} goes BERSERK!`, "#ff2a6a");
      game.shake = Math.max(game.shake, 0.35);
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
  }
  update(dt, game) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.x < 0 || this.x > CFG.W || this.y < 0 || this.y > CFG.H) this.ttl = 0;
    if (this.ttl <= 0) return true; // remove

    if (this.team === "player") {
      for (const e of game.enemies) {
        if (dist(this, e) < this.r + e.r) {
          if (this.boom) {
            game.explodePlayer(this.x, this.y, this.boomR);
          } else {
            const hit = game.playerDamage();
            game.hurtEnemy(e, hit.d, Math.cos(Math.atan2(this.vy, this.vx)) * 6, Math.sin(Math.atan2(this.vy, this.vx)) * 6,
              { knock: 0.18, crit: hit.crit });
          }
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

/* ---------- wave blade shockwave ---------- */
class Wave {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.r = 20;
    this.maxR = 210;
    this.ttl = 0.5;
    this.hitSet = new Set();
    this.done = false;
  }
  update(dt, game) {
    const grow = (this.maxR - this.r) / 0.5;
    this.r += grow * dt;
    this.ttl -= dt;
    for (const e of [...game.enemies]) {   // copy: kills splice the live array
      if (!this.hitSet.has(e) && dist(this, e) < this.r + e.r) {
        this.hitSet.add(e);
        const hit = game.playerDamage();
        const ang = Math.atan2(e.y - this.y, e.x - this.x);
        game.hurtEnemy(e, hit.d, Math.cos(ang) * 14, Math.sin(ang) * 14, { knock: 0.35, crit: hit.crit });
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
