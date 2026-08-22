/* ============================================================
   BLOB KNIGHT — weapons: attack implementations
   ============================================================ */
"use strict";

/* Sword: arc slash in facing direction — God Run perk 2: 360° slash */
function attackSword(game) {
  const is360 = G.difficulty === "godrun" && typeof isGodPerkUnlocked === "function" && isGodPerkUnlocked(2);
  const p = game.player;
  game.arcs = game.arcs || [];
  if (is360) {
    // 360° slash — full surrounding, with distinct visual
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) game.arcs.push({ ang: a, t: 0.35 });
    if (game.arcs.length > 8) game.arcs.splice(0, game.arcs.length - 8);
    game.effects.push({ type: "ring", x: p.x, y: p.y, r: CFG.SWORD_RANGE + 6, t: 0.3, color: "#ffd166" });
    for (const e of [...game.enemies]) {
      const d = dist(p, e);
      if (d < CFG.SWORD_RANGE + 14 + e.r) {
        const hit = game.playerDamage();
        const ang = Math.atan2(e.y - p.y, e.x - p.x);
        game.hurtEnemy(e, Math.round(hit.d * 0.9),
          Math.cos(ang) * 12, Math.sin(ang) * 12,
          { knock: 0.3, crit: hit.crit, color: "#ffd166", hitStop: 0.06 });
        if (G.comboT > 0) G.combo = Math.min(12, G.combo + 1);
        else G.combo = 1;
        G.comboT = 1.6;
      }
    }
    SFX.hit();
    // slight cooldown balance for 360
    game.player.attackCd = (WEAPONS.sword.cd * 1.3) * (G.asMult || 1);
    game.player.swing = 0.4;
    game.parryT = 0.22;
    if (typeof STATS !== "undefined") STATS.weaponUses["sword"] = (STATS.weaponUses["sword"] || 0) + 1;
    return;
  }
  game.arcs.push({ ang: p.dir, t: 0.25 });           // idea 7: slash afterimage
  if (game.arcs.length > 3) game.arcs.shift();       // keep last 3
  for (const e of [...game.enemies]) {   // copy: kills splice the live array
    const d = dist(p, e);
    if (d < CFG.SWORD_RANGE + e.r) {
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      let diff = Math.abs(ang - p.dir);
      while (diff > Math.PI) diff -= 2 * Math.PI;
      diff = Math.abs(diff);
      if (diff < CFG.SWORD_ARC || d < e.r + 12) {
        const hit = game.playerDamage();
        const heavy = e.kind === "brute" || e.kind === "elite" || e.isBoss;
        game.hurtEnemy(e, hit.d,
          Math.cos(p.dir) * (heavy ? 13 : 8), Math.sin(p.dir) * (heavy ? 13 : 8),
          { knock: heavy ? 0.35 : 0.2, crit: hit.crit, color: heavy ? "#ffb45e" : undefined }); // idea 2: heavier knock vs brutes
        /* idea 7: combo timing — every sword hit refreshes the chain */
        if (G.comboT > 0) G.combo = Math.min(12, G.combo + 1);
        else G.combo = 1;
        G.comboT = 1.6;
      }
    }
  }
  /* idea: sword slash deflects enemy projectiles back at them */
  for (let i = game.projectiles ? game.projectiles.length - 1 : -1; i >= 0; i--) {
    const pr = game.projectiles[i];
    if (pr.team === "player") continue;
    if (dist(p, pr) < CFG.SWORD_RANGE + pr.r) {
      const ang = Math.atan2(pr.y - p.y, pr.x - p.x);
      let diff = Math.abs(ang - p.dir);
      while (diff > Math.PI) diff -= 2 * Math.PI;
      diff = Math.abs(diff);
      if (diff < CFG.SWORD_ARC || dist(p, pr) < pr.r + 12) {
        pr.vx = -pr.vx; pr.vy = -pr.vy;
        pr.team = "player";
        pr.ttl = 5;
        game.effects.push({ type: "spark", x: pr.x, y: pr.y, vx: Math.cos(ang) * 140, vy: Math.sin(ang) * 140, t: 0.3, color: "#8fd4ff" });
        SFX.hit();
      }
    }
  }
}

/* Wave Blade: an expanding shockwave ring that bursts out and
   hits everything it passes through, knocking foes far back */
function attackWave(game) {
  const p = game.player;
  game.waves.push(new Wave(p.x, p.y));
  game.effects.push({ type: "waveflash", x: p.x, y: p.y, t: 0.3 });
  game.lastElement = "ice";   // idea 51: wave blade is frosty
}

/* Crossbow: rapid straight bolts */
function attackCrossbow(game) {
  const p = game.player;
  const speed = 520;
  const dmg = rand(game.G.atk - 4, game.G.atk + 2);
  game.effects.push({ type: "muzzle", x: p.x + Math.cos(p.dir) * 18, y: p.y + Math.sin(p.dir) * 18, dir: p.dir, t: 0.06 }); // idea 6
  game.projectiles.push(new Projectile("player", p.x + Math.cos(p.dir) * 16, p.y + Math.sin(p.dir) * 16,
    Math.cos(p.dir) * speed, Math.sin(p.dir) * speed, 5, dmg, "#6fc3ff"));
}

/* Ember Staff: slow fireball that detonates in an area */
function attackStaff(game) {
  const p = game.player;
  const speed = 380;
  const dmg = rand(game.G.atk, game.G.atk + 6);
  game.lastElement = "fire";   // idea 51
  game.effects.push({ type: "muzzle", x: p.x + Math.cos(p.dir) * 18, y: p.y + Math.sin(p.dir) * 18, dir: p.dir, t: 0.07, color: "#ff8b3d" }); // idea 6
  game.projectiles.push(new Projectile("player", p.x + Math.cos(p.dir) * 16, p.y + Math.sin(p.dir) * 16,
    Math.cos(p.dir) * speed, Math.sin(p.dir) * speed, 11, dmg, "#ff8b3d", { boom: true, boomR: 88 }));
  if (G.passiveStaff) {   // idea 49: staff leaves burning ground
    game.burnZones = game.burnZones || [];
    game.burnZones.push({ x: p.x + Math.cos(p.dir) * 40, y: p.y + Math.sin(p.dir) * 40, t: 2.5, r: 40 });
  }
}

/* idea 50: Spear — long lunge + pierce */
function attackSpear(game) {
  const p = game.player;
  p.attackCd = WEAPONS.spear.cd;
  p.swing = 0.4;
  const reach = CFG.SWORD_RANGE * 2.1;
  for (const e of [...game.enemies]) {
    const d = dist(p, e);
    if (d < reach + e.r) {
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      let diff = Math.abs(ang - p.dir);
      while (diff > Math.PI) diff -= 2 * Math.PI;
      if (Math.abs(diff) < 0.6) {
        const hit = game.playerDamage();
        game.hurtEnemy(e, hit.d * 1.2, Math.cos(p.dir) * 18, Math.sin(p.dir) * 18, { knock: 0.5, crit: hit.crit, color: "#8fd4ff" });
      }
    }
  }
  for (let i = 0; i < 5; i++) {
    game.effects.push({ type: "spark", x: p.x + Math.cos(p.dir) * (20 + i * 14), y: p.y + Math.sin(p.dir) * (20 + i * 14), vx: Math.cos(p.dir) * 40, vy: Math.sin(p.dir) * 40, t: 0.2, color: "#8fd4ff" });
  }
}

/* idea 50: Boomerang — returns, hits twice */
function attackBoomerang(game) {
  const p = game.player;
  const speed = 380;
  game.projectiles.push(new Projectile("player", p.x + Math.cos(p.dir) * 14, p.y + Math.sin(p.dir) * 14,
    Math.cos(p.dir) * speed, Math.sin(p.dir) * speed, 8, rand(game.G.atk, game.G.atk + 5), "#e8d17a", { boomerang: true }));
}

/* idea 50: Orbit Orbs — orbiting shards around the player */
function attackOrbs(game) {
  const p = game.player;
  game.orbits = game.orbits || [];
  const n = game.orbits.length;
  if (n < 3) {
    const base = Math.random() * Math.PI * 2;
    for (let i = n; i < 3; i++) game.orbits.push({ ang: base + (i / 3) * Math.PI * 2, dmg: rand(game.G.atk, game.G.atk + 4) });
  }
  for (const o of game.orbits) {
    o.ang += 4.2 * (game.lastDt || 0.016);
    const ox = p.x + Math.cos(o.ang) * 46, oy = p.y + Math.sin(o.ang) * 46;
    for (const e of [...game.enemies]) {
      if (dist({ x: ox, y: oy }, e) < e.r + 10) {
        const hit = game.playerDamage();
        game.hurtEnemy(e, o.dmg + hit.d, Math.cos(o.ang) * 8, Math.sin(o.ang) * 8, { knock: 0.15, crit: hit.crit, color: "#c084fc" });
        break;
      }
    }
    game.effects.push({ type: "trail", x: ox, y: oy, t: 0.15, color: "#c084fc", r: 4 });
  }
}

/* idea 50: Chain Lightning — arcs to 3 foes */
function attackChain(game) {
  const p = game.player;
  game.lastElement = "lightning";   // idea 51
  const hitSet = [];
  let cur = p;
  const dmg = rand(game.G.atk + 2, game.G.atk + 8);
  for (let i = 0; i < 3; i++) {
    let target = null, best = 1e9;
    for (const e of game.enemies) {
      if (hitSet.includes(e) || e.dead) continue;
      const d = dist(cur, e);
      if (d < 200 && d < best) { best = d; target = e; }
    }
    if (!target) break;
    hitSet.push(target);
    game.effects.push({ type: "beam", x1: cur.x, y1: cur.y, x2: target.x, y2: target.y, t: 0.18, color: "#ffd166" });
    const hit = game.playerDamage();
    game.hurtEnemy(target, dmg + hit.d, 0, 0, { knock: 0.1, crit: hit.crit, color: "#ffd166", hitStop: 0.06 });
    cur = target;
  }
  game.effects.push({ type: "muzzle", x: p.x + Math.cos(p.dir) * 18, y: p.y + Math.sin(p.dir) * 18, dir: p.dir, t: 0.06, color: "#ffd166" });
}

/* idea 52: throwable bomb consumable */
function throwBomb(game) {
  if (G.bombs <= 0 || G.phase !== "play" || !game.player) return;
  G.bombs--;
  const p = game.player;
  const speed = 300;
  game.projectiles.push(new Projectile("player", p.x, p.y,
    Math.cos(p.dir) * speed, Math.sin(p.dir) * speed, 9, 0, "#3a3a4a",
    { bomb: true, boomR: BOMB.r, boomDmg: BOMB.dmg, fuse: BOMB.fuse }));
  flash("💣 BOMB THROWN!", "#ffd166");
  renderHUD();
}

/* ============================================================
   NEW WEAPONS — each one changes how a fight is approached
   ============================================================ */

/* shared: chained hits refresh the combo window (sword-style) */
function comboTick(n) {
  G.combo = Math.min(12, Math.max(1, (G.comboT > 0 ? G.combo : 0) + (n || 1)));
  G.comboT = 1.6;
}

/* shared: is the foe inside a wedge in front of the player? */
function inFront(p, e, range, arc) {
  const d = dist(p, e);
  if (d > range + e.r) return false;
  const diff = Math.abs(Math.atan2(e.y - p.y, e.x - p.x) - p.dir + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  return Math.abs(diff) < arc || d < e.r + 14;
}

/* ---- melee primaries (SPACE) ---- */

/* Chain Blade — a sword on a chain: mid-range sweep that strings groups along */
function attackChainBlade(game) {
  const p = game.player;
  const reach = 66, arc = 1.35;
  game.arcs.push({ ang: p.dir, t: 0.25, arc: arc, r: reach - 10 });
  if (game.arcs.length > 3) game.arcs.shift();
  for (let i = 0; i < 4; i++)
    game.effects.push({ type: "spark", x: p.x + Math.cos(p.dir) * (24 + i * 13), y: p.y + Math.sin(p.dir) * (24 + i * 13), vx: Math.cos(p.dir) * 50, vy: Math.sin(p.dir) * 50, t: 0.18, color: "#c8c8e8" });
  for (const e of [...game.enemies]) {
    if (inFront(p, e, reach, arc)) {
      const hit = game.playerDamage();
      game.hurtEnemy(e, Math.round(hit.d * 0.85), Math.cos(p.dir) * 10, Math.sin(p.dir) * 10, { knock: 0.25, crit: hit.crit, color: "#c8c8e8" });
      comboTick();
    }
  }
}

/* Twin Blades — blinding alternating slashes; each hit counts double combo */
let _twinAlt = 1;
function attackTwin(game) {
  const p = game.player;
  const dir = p.dir + _twinAlt * 0.32;   // left/right alternating slashes
  _twinAlt = -_twinAlt;
  game.arcs.push({ ang: dir, t: 0.16, arc: 0.9, r: 26 });
  if (game.arcs.length > 4) game.arcs.shift();
  const sanguine = (G.syn || []).includes("sanguine");
  for (const e of [...game.enemies]) {
    if (inFront({ ...p, dir }, e, 34, 0.95)) {
      const hit = game.playerDamage();
      game.hurtEnemy(e, Math.round(hit.d * 0.55), Math.cos(dir) * 5, Math.sin(dir) * 5, { knock: 0.12, crit: hit.crit, color: "#8fd4ff" });
      /* SANGUINE EDGE: a thousand fast cuts stack the bleed */
      if (sanguine && !e.isNPC) { e.bleedN = Math.min(3, (e.bleedN || 0) + 1); e.bleedT = 3; }
      comboTick(2);   // twin blades live on the combo ramp
    }
  }
}

/* Scythe — a huge reaping arc that drags foes a step closer */
function attackScythe(game) {
  const p = game.player;
  const reach = 50, arc = 1.45;   // ~166° — wider than the sword, and it hooks behind
  game.arcs.push({ ang: p.dir, t: 0.28, arc: arc, r: reach - 6 });
  if (game.arcs.length > 3) game.arcs.shift();
  for (const e of [...game.enemies]) {
    if (inFront(p, e, reach, arc)) {
      const hit = game.playerDamage();
      const ang = Math.atan2(p.y - e.y, p.x - e.x);   // pull inward: the scythe reaps toward you
      game.hurtEnemy(e, Math.round(hit.d * 0.8), Math.cos(ang) * 7, Math.sin(ang) * 7, { knock: 0.14, crit: hit.crit, color: "#b8e8a0" });
      comboTick();
    }
  }
}

/* War Hammer — a committed slam: everything nearby pays for it */
function attackHammer(game) {
  const p = game.player;
  const reach = 64;
  game.arcs.push({ ang: p.dir, t: 0.35, arc: 1.25, r: reach - 8 });
  const ix = p.x + Math.cos(p.dir) * 22, iy = p.y + Math.sin(p.dir) * 22;
  game.effects.push({ type: "ring", x: ix, y: iy, r: reach, t: 0.22, color: "#ffb45e" });
  game.shake = Math.max(game.shake, 0.16);
  let landed = false;
  for (const e of [...game.enemies]) {
    if (inFront(p, e, reach, 1.25)) {
      landed = true;
      const hit = game.playerDamage();
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      game.hurtEnemy(e, Math.round(hit.d * 2.6), Math.cos(ang) * 22, Math.sin(ang) * 22, { knock: 0.55, crit: hit.crit, color: "#ffb45e", hitStop: 0.09 });
      comboTick();
    }
  }
  if (landed) { SFX.boom(); game.shake = Math.max(game.shake, 0.22); }
}

/* Leech Blade — every wound drinks: heals a fraction of damage dealt */
function attackLeech(game) {
  const p = game.player;
  game.arcs.push({ ang: p.dir, t: 0.25, arc: 1.05, r: 34 });
  if (game.arcs.length > 3) game.arcs.shift();
  let healed = 0;
  const sanguine = (G.syn || []).includes("sanguine");
  for (const e of [...game.enemies]) {
    if (inFront(p, e, CFG.SWORD_RANGE + 2, CFG.SWORD_ARC)) {
      const hit = game.playerDamage();
      const dmg = Math.round(hit.d * 0.85);
      game.hurtEnemy(e, dmg, Math.cos(p.dir) * 8, Math.sin(p.dir) * 8, { knock: 0.2, crit: hit.crit, color: "#ff6b6b" });
      /* SANGUINE EDGE: bleeding wounds pour harder */
      healed += Math.max(1, Math.round(dmg * (e.bleedN > 0 && sanguine ? 0.18 : 0.12)));
      comboTick();
    }
  }
  if (healed > 0) {
    G.hp = Math.min(G.maxHp, G.hp + healed);
    game.effects.push({ type: "heal", x: p.x, y: p.y - 16, t: 0.4, txt: `+${healed}`, color: "#ff6b6b" });
  }
}

/* Echo Blade (secret) — the swing keeps going: a spectral slash flies the arc */
function attackEcho(game) {
  const p = game.player;
  game.arcs.push({ ang: p.dir, t: 0.22, arc: 1.15, r: 38, color: "#c0a8f0" });
  if (game.arcs.length > 3) game.arcs.shift();
  for (const e of [...game.enemies]) {
    if (inFront(p, e, CFG.SWORD_RANGE + 4, 1.15)) {
      const hit = game.playerDamage();
      game.hurtEnemy(e, hit.d, Math.cos(p.dir) * 8, Math.sin(p.dir) * 8, { knock: 0.2, crit: hit.crit, color: "#c0a8f0" });
      comboTick();
    }
  }
  /* the echo itself — a short-lived slash that rides the swing's momentum */
  const pr = new Projectile("player", p.x + Math.cos(p.dir) * 20, p.y + Math.sin(p.dir) * 20,
    Math.cos(p.dir) * 330, Math.sin(p.dir) * 330, 9, rand(Math.max(2, game.G.atk - 3), game.G.atk + 2), "#c0a8f0",
    { pierce: true, src: "echo" });
  pr.ttl = 0.55;
  game.projectiles.push(pr);
}

/* ---- ranged secondaries (R) ---- */

/* Lightning Spear — short thrust up close, crackling bolt down range */
function attackLSpear(game) {
  const p = game.player;
  game.lastElement = "lightning";
  /* melee thrust */
  game.arcs.push({ ang: p.dir, t: 0.2, arc: 0.6, r: 44 });
  for (const e of [...game.enemies]) {
    if (inFront(p, e, CFG.SWORD_RANGE * 1.4, 0.6)) {
      const hit = game.playerDamage();
      game.hurtEnemy(e, Math.round(hit.d * 1.1), Math.cos(p.dir) * 14, Math.sin(p.dir) * 14, { knock: 0.35, crit: hit.crit, color: "#ffd166" });
      comboTick();
    }
  }
  /* the bolt itself — pierces every foe in the lane */
  const speed = 640;
  game.projectiles.push(new Projectile("player", p.x + Math.cos(p.dir) * 18, p.y + Math.sin(p.dir) * 18,
    Math.cos(p.dir) * speed, Math.sin(p.dir) * speed, 6, rand(game.G.atk - 2, game.G.atk + 4), "#ffd166",
    { pierce: true, bolt: true, src: "lspear" }));
  game.effects.push({ type: "muzzle", x: p.x + Math.cos(p.dir) * 18, y: p.y + Math.sin(p.dir) * 18, dir: p.dir, t: 0.07, color: "#ffd166" });
}

/* Chakram — heavy disc that banks off a wall and cuts again on the way home */
function attackChakram(game) {
  const p = game.player;
  const speed = 400;
  game.projectiles.push(new Projectile("player", p.x + Math.cos(p.dir) * 14, p.y + Math.sin(p.dir) * 14,
    Math.cos(p.dir) * speed, Math.sin(p.dir) * speed, 11, rand(game.G.atk, game.G.atk + 5), "#e8d17a",
    { chakram: true, bounce: 1 }));
}

/* Flame Bow — quick burning arrows; the fire keeps working after the hit */
function attackBow(game) {
  const p = game.player;
  game.lastElement = "fire";
  const speed = 560;
  game.projectiles.push(new Projectile("player", p.x + Math.cos(p.dir) * 16, p.y + Math.sin(p.dir) * 16,
    Math.cos(p.dir) * speed, Math.sin(p.dir) * speed, 5, rand(game.G.atk - 3, game.G.atk + 1), "#ff8b3d",
    { burn: true }));
  game.effects.push({ type: "muzzle", x: p.x + Math.cos(p.dir) * 18, y: p.y + Math.sin(p.dir) * 18, dir: p.dir, t: 0.06, color: "#ff8b3d" });
}

/* Void Dagger — two flick knives; three quick hits trigger VOID FRENZY */
function attackVoid(game) {
  const p = game.player;
  for (let i = -1; i <= 1; i += 2) {
    const ang = p.dir + i * 0.08;
    const pr = new Projectile("player", p.x + Math.cos(ang) * 14, p.y + Math.sin(ang) * 14,
      Math.cos(ang) * 470, Math.sin(ang) * 470, 4, rand(Math.max(1, game.G.atk - 4), Math.max(2, game.G.atk - 1)), "#a88cff",
      { src: "void" });
    pr.ttl = 0.5;   // short-range flick
    game.projectiles.push(pr);
  }
}

/* Ricochet Gun — the room itself becomes the weapon */
function attackRicochet(game) {
  const p = game.player;
  const speed = 440;
  game.projectiles.push(new Projectile("player", p.x + Math.cos(p.dir) * 14, p.y + Math.sin(p.dir) * 14,
    Math.cos(p.dir) * speed, Math.sin(p.dir) * speed, 4, rand(Math.max(2, game.G.atk - 4), game.G.atk), "#8fd4ff",
    { ricochet: true, bounce: 3 }));
  game.effects.push({ type: "muzzle", x: p.x + Math.cos(p.dir) * 18, y: p.y + Math.sin(p.dir) * 18, dir: p.dir, t: 0.06, color: "#8fd4ff" });
}

/* Gravity Orb — lobbed sphere that collapses into a brief singularity */
function attackGravity(game) {
  const p = game.player;
  const speed = 330;
  const pr = new Projectile("player", p.x + Math.cos(p.dir) * 14, p.y + Math.sin(p.dir) * 14,
    Math.cos(p.dir) * speed, Math.sin(p.dir) * speed, 9, rand(Math.max(1, Math.round(game.G.atk * 0.3)), Math.round(game.G.atk * 0.3) + 2), "#a88cff",
    { well: { r: 110, t: 1.6, dps: 5 } });
  pr.ttl = 0.45;   // pops open mid-range
  game.projectiles.push(pr);
  game.effects.push({ type: "muzzle", x: p.x + Math.cos(p.dir) * 18, y: p.y + Math.sin(p.dir) * 18, dir: p.dir, t: 0.07, color: "#a88cff" });
}

/* idea 53: deployables */
function deployTurret(game) {
  const p = game.player;
  const t = { x: p.x, y: p.y + 10, ttl: 8, team: "player", kind: "turret" };
  game.deployables = game.deployables || [];
  game.deployables.push(t);
  flash("🤖 TURRET DEPLOYED!", "#8fd4ff");
}
function deployTrap(game) {
  const p = game.player;
  const t = { x: p.x, y: p.y + 10, armed: true, team: "player", kind: "trap", dmg: rand(10, 14), hitOnce: false };
  game.deployables = game.deployables || [];
  game.deployables.push(t);
  flash("🪤 BEAR TRAP SET!", "#e8d17a");
}

const WEAPON_ATTACKS = {
  sword: attackSword,
  wave: attackWave,
  crossbow: attackCrossbow,
  staff: attackStaff,
  spear: attackSpear,
  boomerang: attackBoomerang,
  orbs: attackOrbs,
  chain: attackChain,
  chainblade: attackChainBlade,
  twin: attackTwin,
  scythe: attackScythe,
  hammer: attackHammer,
  leech: attackLeech,
  echo: attackEcho,
  lspear: attackLSpear,
  chakram: attackChakram,
  bow: attackBow,
  void: attackVoid,
  ricochet: attackRicochet,
  gravity: attackGravity,
};

/* ---- primary hand (SPACE): melee weapons; the sword is always owned ---- */
function meleeOwned() {
  return Object.keys(WEAPONS).filter(w => WEAPONS[w].type === "melee" && game.weapons.includes(w));
}
function selectPrimary(w) {
  if (!WEAPONS[w] || WEAPONS[w].type !== "melee" || !game.weapons.includes(w)) return;
  game.weapon = w;
  flash(`${WEAPONS[w].icon} ${WEAPONS[w].name} — melee hand (SPACE)`, "#6fc3ff");
  renderHUD();
}
function cyclePrimary() {
  const owned = meleeOwned();
  if (owned.length <= 1) { flash("Only the sword — buy melee weapons at the shop", "#9a90b8"); return; }
  const i = owned.indexOf(game.weapon);
  selectPrimary(owned[(i + 1) % owned.length]);
}

/* fire the primary hand — melee weapons; sword by default */
function weaponAttack(game) {
  if (game.G.phase !== "play" || !game.player || game.player.attackCd > 0) return;
  if ((G.attackLockT || 0) > 0) { flash("ATTACK DISABLED — GLASS EDGE", "#ff8b3d"); return; }
  const w = WEAPONS[game.weapon] && WEAPONS[game.weapon].type === "melee" ? game.weapon : "sword";
  game.lastWeapon = w;
  game.player.attackCd = WEAPONS[w].cd * (G.asMult || 1) * (G.voidBuffT > 0 ? 0.7 : 1);
  game.player.swing = 0.3;
  WEAPON_ATTACKS[w](game);
  SFX.weapon(w);   /* idea 77: distinct SFX per weapon type */
  /* idea 49: sword passive — brief parry window that deflects contact */
  if (w === "sword") game.parryT = 0.18;
  /* idea 62: favorite weapon tracking */
  if (typeof STATS !== "undefined") STATS.weaponUses[w] = (STATS.weaponUses[w] || 0) + 1;
}

/* fire the secondary hand (R / right-click / 🏹 button) — any owned ranged weapon */
function secondaryAttack(game) {
  if (game.G.phase !== "play" || !game.player || game.player.attackCd > 0) return;
  if ((G.attackLockT || 0) > 0) { flash("ATTACK DISABLED — GLASS EDGE", "#ff8b3d"); return; }
  const w = game.secondary;
  if (!w || !WEAPONS[w] || WEAPONS[w].type === "melee") {
    flash("No ranged weapon armed — buy one at the shop", "#9a90b8");
    return;
  }
  game.lastWeapon = w;
  game.player.attackCd = WEAPONS[w].cd * (G.asMult || 1) * (G.voidBuffT > 0 ? 0.7 : 1);
  if (w === "spear" || w === "lspear") game.player.swing = 0.3;
  WEAPON_ATTACKS[w](game);
  SFX.weapon(w);   /* idea 77: distinct SFX per weapon type */
  /* idea 62: favorite weapon tracking */
  if (typeof STATS !== "undefined") STATS.weaponUses[w] = (STATS.weaponUses[w] || 0) + 1;
}
