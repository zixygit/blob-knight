/* chapter two: the sundered depths — expansion smoke test.
   Validates levels 12-16 end to end: new enemy kinds spawn, wave
   encounters chain, phase-gated boss kits unlock, floor hazards
   appear and expire, and the run can be WON at level 16. */
const { test, expect } = require("@playwright/test");

const NEW_KINDS = ["acid", "drone", "assassin", "gazer", "berserker", "hunter", "commander", "tentacle", "trapper"];

test.describe("chapter two expansion", () => {
  test("all 16 levels configure and spawn without errors", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    await page.evaluate(() => { STATS.runs = 1; });

    const report = await page.evaluate(() => {
      const out = {};
      for (let n = 1; n <= MAX_LEVEL; n++) {
        G.phase = "play";
        G.bossRush = false;
        G.difficulty = "normal";
        setupLevel(n);
        const kinds = game.enemies.map(e => e.kind);
        out[n] = {
          name: LEVELS[n].name,
          minions: game.G.minionsLeft,
          kinds: [...new Set(kinds)],
          boss: LEVELS[n].boss.name,
          waves: (LEVELS[n].waves || []).length,
        };
      }
      return out;
    });
    expect(Object.keys(report)).toHaveLength(16);
    for (const n of Object.keys(report)) {
      expect(report[n].minions, `level ${n} minion count`).toBeGreaterThan(0);
      expect(report[n].boss, `level ${n} boss defined`).toBeTruthy();
    }
    // chapter two levels use the new archetypes
    const kinds12 = report[12].kinds;
    for (const k of ["acid", "drone", "trapper"]) expect(kinds12).toContain(k);
    const kinds13 = report[13].kinds;
    for (const k of ["assassin", "gazer", "shielder", "healer"]) expect(kinds13).toContain(k);
    expect(report[14].waves).toBe(2);
    expect(report[15].waves).toBe(3);
    expect(report[16].waves).toBe(2);
    expect(report[16].kinds).toContain("tentacle");
    expect(errs).toEqual([]);
  });

  test("every new archetype updates, fights, and dies cleanly", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    await page.evaluate(() => { STATS.runs = 1; beginGame(); });

    const result = await page.evaluate((kinds) => {
      const out = {};
      for (const kind of kinds) {
        G.level = 1;
        G.phase = "play";
        game.enemies = []; game.projectiles = []; game.effects = []; game.hazardZones = [];
        game.G.minionsLeft = 1; game.G.bossSpawned = true;   // no auto-boss
        const e = new Enemy(Object.assign({}, ENEMY_TYPES[kind]), 400, 200);
        game.enemies.push(e);
        game.player.x = 200; game.player.y = 200;
        game.player.dropT = 0;
        let steps = 0;
        for (let i = 0; i < 480; i++) {
          e.update(1 / 60, game);
          for (const pr of [...game.projectiles]) pr.update(1 / 60, game);
          game.projectiles = game.projectiles.filter(p => p.ttl > 0 && p.x > -50 && p.x < CFG.W + 50 && p.y > -50 && p.y < CFG.H + 50);
          game.effects.length = 0;
          steps++;
          if (e.dead) break;
        }
        out[kind] = { alive: !e.dead, steps, inBounds: e.x >= 0 && e.x <= CFG.W && e.y >= 0 && e.y <= CFG.H };
        if (!e.dead) hurtEnemy(e, 99999, 1, 0);
      }
      return out;
    }, NEW_KINDS);
    for (const kind of NEW_KINDS) {
      expect(result[kind].inBounds, `${kind} stays in the arena`).toBe(true);
    }
    expect(errs).toEqual([]);
  });

  test("wave encounters chain, then the boss arrives", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    await page.evaluate(() => { STATS.runs = 1; });
    const state = await page.evaluate(() => {
      G.difficulty = "normal"; G.phase = "play";
      setupLevel(15);   // 3 waves
      const w1 = game.G.minionsLeft;
      for (const e of [...game.enemies]) if (!e.isBoss) killEnemy(e, true);
      const w2 = game.G.minionsLeft;
      for (const e of [...game.enemies]) if (!e.isBoss) killEnemy(e, true);
      const w3 = game.G.minionsLeft;
      for (const e of [...game.enemies]) if (!e.isBoss) killEnemy(e, true);
      return { w1, w2, w3, boss: game.enemies.some(e => e.isBoss), bossName: game.enemies.find(e => e.isBoss)?.name, spawned: game.G.bossSpawned };
    });
    expect(state.w1).toBe(4);       // wave 1: 2 guards + brute + bomber
    expect(state.w2).toBe(4);       // wave 2: commander + shielder + 2 shooters
    expect(state.w3).toBe(5);       // wave 3: 2 brutes + weaver + 2 bombers
    expect(state.spawned).toBe(true);
    expect(state.bossName).toContain("FORGEMASTER ORUN");
    expect(errs).toEqual([]);
  });

  test("boss phase gating: kits unlock at enrage thresholds", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    await page.evaluate(() => { STATS.runs = 1; });
    const state = await page.evaluate(() => {
      G.difficulty = "normal"; G.phase = "play"; G.bossRush = false;
      setupLevel(12);
      game.enemies = [];
      game.G.minionsLeft = 0;
      spawnBoss();
      const boss = game.enemies.find(e => e.isBoss);
      const full = boss.maxHp;
      const sim = (frames) => { for (let i = 0; i < frames; i++) { game.player.dropT = 0; boss.update(1 / 60, game); game.effects.length = 0; } };
      sim(60);
      const phase1 = { enraged: boss.enraged, enraged2: boss.enraged2 };
      boss.hp = full * 0.5; sim(60);   // cross enrageAt 0.6
      const phase2 = { enraged: boss.enraged, enraged2: boss.enraged2 };
      boss.hp = full * 0.2; sim(60);   // cross enrage2At 0.3
      const phase3 = { enraged: boss.enraged, enraged2: boss.enraged2 };
      return { phase1, phase2, phase3, name: boss.name };
    });
    expect(state.name).toContain("SPLINTERMAW");
    expect(state.phase1.enraged).toBe(false);
    expect(state.phase2.enraged).toBe(true);
    expect(state.phase2.enraged2).toBe(false);
    expect(state.phase3.enraged2).toBe(true);
    expect(errs).toEqual([]);
  });

  test("floor hazards spawn from acid globs and expire", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    await page.evaluate(() => { STATS.runs = 1; beginGame(); });
    const state = await page.evaluate(() => {
      G.level = 12; G.phase = "play";
      game.G.minionsLeft = 1; game.G.bossSpawned = true;
      game.enemies = []; game.hazardZones = []; game.projectiles = [];
      const e = new Enemy(Object.assign({}, ENEMY_TYPES.acid), 500, 300);
      game.enemies.push(e);
      e.cooldown = 0.01;
      game.player.x = 500; game.player.y = 150; game.player.dropT = 0;
      let fired = 0;
      for (let i = 0; i < 300; i++) {
        e.update(1 / 60, game);
        fired += game.projectiles.length;
        game.projectiles = game.projectiles.filter(p => !p.update(1 / 60, game));
        if (game.hazardZones.length > 0) break;
      }
      const zones = game.hazardZones.length;
      for (let i = 0; i < 400 && game.hazardZones.length; i++) {
        for (const z of [...game.hazardZones]) { z.t -= 1 / 60; if (z.t <= 0) game.hazardZones.splice(game.hazardZones.indexOf(z), 1); }
      }
      return { zones, after: game.hazardZones.length, projSeen: fired > 0, eAlive: !e.dead };
    });
    expect(state.eAlive).toBe(true);
    expect(state.zones, "acid glob splashed into a pool").toBeGreaterThan(0);
    expect(state.after, "pool expired").toBe(0);
    expect(errs).toEqual([]);
  });

  test("full run: level 16 boss dies and the game is won", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    await page.evaluate(() => { STATS.runs = 1; });
    await page.evaluate(() => {
      G.difficulty = "normal"; G.phase = "play";
      setupLevel(16);
      for (let w = 0; w < 2; w++) for (const e of [...game.enemies]) if (!e.isBoss && !e.isNPC) killEnemy(e, true);
      const boss = game.enemies.find(e => e.isBoss);
      hurtEnemy(boss, 999999, 1, 0);
      nextLevel();   // 17 > MAX_LEVEL → winGame()
    });
    await expect(page.locator("#overlay")).toBeVisible();
    await expect(page.getByText("BLOB KNIGHT COMPLETE")).toBeVisible();
    expect(errs).toEqual([]);
  });

  test("PHOENIX GEM revive fires once, then death stands", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    await page.evaluate(() => { STATS.runs = 1; beginGame(); });
    const state = await page.evaluate(() => {
      G.phase = "play"; G.invulnT = 0;
      game.player.dashT = 0; game.player.hurtT = 0;
      G.hp = 1; G.revives = 1;
      damagePlayer(50, 0, 0);
      const afterPhoenix = { hp: G.hp, phase: G.phase, revives: G.revives };
      G.hp = 1; G.invulnT = 0;   // the gem is spent — the next fatal blow must stick
      damagePlayer(50, 0, 0);
      const afterDeath = { phase: G.phase };
      return { afterPhoenix, afterDeath };
    });
    expect(state.afterPhoenix.revives).toBe(0);
    expect(state.afterPhoenix.phase).toBe("play");
    expect(state.afterDeath.phase).toBe("dead");
    expect(errs).toEqual([]);
  });
});
