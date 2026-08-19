/* ============================================================
   EMBERQUEST 2D — weapons: attack implementations
   ============================================================ */
"use strict";

/* Sword: arc slash in facing direction */
function attackSword(game) {
  const p = game.player;
  for (const e of [...game.enemies]) {   // copy: kills splice the live array
    const d = dist(p, e);
    if (d < CFG.SWORD_RANGE + e.r) {
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      let diff = Math.abs(ang - p.dir);
      while (diff > Math.PI) diff -= 2 * Math.PI;
      diff = Math.abs(diff);
      if (diff < CFG.SWORD_ARC || d < e.r + 12) {
        const hit = game.playerDamage();
        game.hurtEnemy(e, hit.d, Math.cos(p.dir) * 8, Math.sin(p.dir) * 8, { knock: 0.2, crit: hit.crit });
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
}

/* Crossbow: rapid straight bolts */
function attackCrossbow(game) {
  const p = game.player;
  const speed = 520;
  const dmg = rand(game.G.atk - 4, game.G.atk + 2);
  game.projectiles.push(new Projectile("player", p.x + Math.cos(p.dir) * 16, p.y + Math.sin(p.dir) * 16,
    Math.cos(p.dir) * speed, Math.sin(p.dir) * speed, 5, dmg, "#6fc3ff"));
}

/* Ember Staff: slow fireball that detonates in an area */
function attackStaff(game) {
  const p = game.player;
  const speed = 380;
  const dmg = rand(game.G.atk, game.G.atk + 6);
  game.projectiles.push(new Projectile("player", p.x + Math.cos(p.dir) * 16, p.y + Math.sin(p.dir) * 16,
    Math.cos(p.dir) * speed, Math.sin(p.dir) * speed, 7, dmg, "#ff8b3d", { boom: true, boomR: 64 }));
}

const WEAPON_ATTACKS = {
  sword: attackSword,
  wave: attackWave,
  crossbow: attackCrossbow,
  staff: attackStaff,
};

/* fire the currently equipped weapon */
function weaponAttack(game) {
  if (game.G.phase !== "play" || !game.player || game.player.attackCd > 0) return;
  const w = game.weapon;
  game.player.attackCd = WEAPONS[w].cd;
  if (w === "sword") game.player.swing = 0.3;
  WEAPON_ATTACKS[w](game);
}
