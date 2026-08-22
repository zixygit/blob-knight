/* AI pass: NPC→boss wake transition, boss state machine
   (intro → chase → attack → recovery → phase), pack-tactic cooperation,
   the BOLT MAW projectile predator, and the PHANTOM SABER lunge. */
const { test, expect } = require("@playwright/test");

test.describe("boss & enemy AI", () => {
  test("a stung former lord wakes into its ORIGINAL fight — no free kills", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    const out = await page.evaluate(() => {
      STATS.runs = 1; beginGame();
      localStorage.setItem("blobknight.defeated", JSON.stringify(["1:GOBLIN CHIEFTAIN"]));
      G.runSeed = 42; G.keepSeed = true;
      setupLevel(3); G.phase = "play";
      game.player.dropT = 0;
      const npc = game.enemies.find(e => e.isNPC);
      if (!npc) return { npc: false };
      /* the first blow wakes it — it must NOT die to the poke */
      const hpBeforePoke = npc.hp;
      hurtEnemy(npc, 500, 0, 0, {});
      const woke = {
        npc: true,
        alive: !npc.dead && game.enemies.includes(npc),
        isBoss: npc.isBoss === true && npc.isNPC === false,
        fullHp: npc.hp === Math.round(npc.originalBoss.hp * CHALLENGE.bossHp),
        originalSize: npc.r === npc.originalR,
        originalName: npc.name === npc.originalBoss.name,
        introState: npc.bossState === "intro",
        shielded: npc.shieldT > 0,
      };
      /* the wake beat is invulnerable: follow-ups are BLOCKED, not lethal */
      const hpDuringIntro = npc.hp;
      hurtEnemy(npc, 500, 0, 0, {});
      const blocked = npc.hp === hpDuringIntro && game.effects.some(f => f.txt === "BLOCKED");
      /* after the intro, the real kit comes out */
      for (let i = 0; i < 40; i++) update(0.05);   // 2s: intro over, chase begins
      const chaseState = npc.bossState;
      npc.volleyT = 0.01;
      const shots0 = game.projectiles.length;
      for (let i = 0; i < 12 && game.projectiles.length === shots0; i++) update(0.05);
      return { ...woke, hpBeforePoke, blocked, chaseState, firedShots: game.projectiles.length > shots0 };
    });
    expect(out.npc).toBeTruthy();
    expect(out.alive).toBeTruthy();
    expect(out.isBoss).toBeTruthy();
    expect(out.fullHp).toBeTruthy();
    expect(out.originalSize).toBeTruthy();
    expect(out.originalName).toBeTruthy();
    expect(out.introState).toBeTruthy();
    expect(out.shielded).toBeTruthy();
    expect(out.blocked).toBeTruthy();
    expect(out.chaseState).toBe("chase");
    expect(out.firedShots).toBeTruthy();   // original attacks, not standing around
    expect(errs).toEqual([]);
  });

  test("boss state machine: intro → chase → attack → recovery → phase", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    const out = await page.evaluate(() => {
      STATS.runs = 1; beginGame();
      G.difficulty = "normal"; G.phase = "play"; G.bossRush = false;
      setupLevel(2);
      game.enemies = []; game.G.minionsLeft = 0;
      game.player.dropT = 0;
      spawnBoss();
      const boss = game.enemies.find(e => e.isBoss);
      const res = { intro: boss.bossState };
      const sim = s => { for (let i = 0; i < Math.round(s / 0.05); i++) update(0.05); };
      sim(1.4);   // arrival beat ends
      res.afterIntro = boss.bossState;
      /* committed volley: attack, then a punishable recovery, then chase */
      boss.volleyT = 0.01;
      sim(0.15);
      res.fired = boss.bossState === "attack" && game.projectiles.length > 0;
      sim(0.5);
      res.recovering = boss.bossState === "recovery";
      sim(0.6);
      res.backToChase = boss.bossState === "chase";
      /* enrage cuts to an invulnerable phase shift */
      boss.enraged = false;
      boss.hp = boss.maxHp * 0.4;
      sim(0.1);
      res.phase = boss.bossState === "phase" && boss.shieldT > 0;
      const hpInPhase = boss.hp;
      hurtEnemy(boss, 300, 0, 0, {});
      res.phaseInvuln = boss.hp === hpInPhase;
      sim(1.0);
      res.afterPhase = boss.bossState;
      return res;
    });
    expect(out.intro).toBe("intro");
    expect(out.afterIntro).toBe("chase");
    expect(out.fired).toBeTruthy();
    expect(out.recovering).toBeTruthy();
    expect(out.backToChase).toBeTruthy();
    expect(out.phase).toBeTruthy();
    expect(out.phaseInvuln).toBeTruthy();
    expect(out.afterPhase).toBe("chase");
    expect(errs).toEqual([]);
  });

  test("pack tactics: the mark calls cover fire; webs feed the charger", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    const out = await page.evaluate(() => {
      STATS.runs = 1; beginGame();
      G.phase = "play"; game.player.dropT = 0;
      game.enemies = []; game.projectiles = [];
      /* assassin mid-vanish + a shooter within call range */
      const a = new Enemy(Object.assign({}, ENEMY_TYPES.assassin), 300, 300);
      a.aState = "vanish"; a.vT = 0.01;
      game.enemies.push(a);
      game.player.x = 300; game.player.y = 300; game.player.dir = 0;   // the mark lands behind the player
      const sh = new Enemy(Object.assign({}, ENEMY_TYPES.shooter, { fireCd: 99 }), 420, 300);
      sh.cooldown = 5;
      game.enemies.push(sh);
      const shots0 = game.projectiles.length;
      update(0.05);
      const markCover = a.aState === "mark" && game.projectiles.length > shots0 && sh.cooldown > 1;
      /* webbed target → the charger's clock runs hot */
      game.enemies = []; game.projectiles = [];
      const mk = slow => {
        const c = new Enemy(Object.assign({}, ENEMY_TYPES.charger), 380, 300);
        c.chargeT = 0.6; c.windup = 0;
        game.enemies.push(c);
        G.slowT = slow ? 2 : 0;
        update(0.5);
        return c.windup > 0;
      };
      return { markCover, slowCharges: mk(true), briskHolds: !mk(false) };
    });
    expect(out.markCover).toBeTruthy();
    expect(out.slowCharges).toBeTruthy();
    expect(out.briskHolds).toBeTruthy();
    expect(errs).toEqual([]);
  });

  test("BOLT MAW eats shots, bursts them back, and dies to steel", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    const out = await page.evaluate(() => {
      STATS.runs = 1; beginGame();
      G.phase = "play"; game.player.dropT = 0;
      game.enemies = []; game.projectiles = [];
      const maw = new Enemy(Object.assign({}, ENEMY_TYPES.bolt_eater), 400, 300);
      game.enemies.push(maw);
      /* a bolt in the hunger field is devoured */
      game.projectiles.push(new Projectile("player", 360, 300, -100, 0, 5, 5, "#fff"));
      const bolts0 = game.projectiles.length;
      update(0.1);
      const eaten = maw.fed === 1 && game.projectiles.length < bolts0;
      /* five stolen shots come spitting home */
      maw.fed = 4;
      game.projectiles.push(new Projectile("player", 370, 300, -50, 0, 5, 5, "#fff"));
      update(0.15);
      const burst = game.projectiles.filter(pr => pr.team === "enemy").length >= 6 && maw.fed === 0;
      /* bombs are too chunky to swallow */
      game.projectiles = [];
      const bomb = new Projectile("player", 370, 300, -50, 0, 9, 0, "#3a3a4a", { bomb: true, fuse: 5 });
      game.projectiles.push(bomb);
      update(0.15);
      const bombSafe = game.projectiles.includes(bomb);
      /* steel still works */
      hurtEnemy(maw, 999, 0, 0, {});
      const dies = maw.dead;
      return { eaten, burst, bombSafe, dies };
    });
    expect(out.eaten).toBeTruthy();
    expect(out.burst).toBeTruthy();
    expect(out.bombSafe).toBeTruthy();
    expect(out.dies).toBeTruthy();
    expect(errs).toEqual([]);
  });

  test("PHANTOM SABER: the swing carries you — with i-frames", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    const out = await page.evaluate(() => {
      STATS.runs = 1; beginGame();
      G.phase = "play"; game.player.dropT = 0;
      game.enemies = []; game.projectiles = []; game.obstacles = [];
      game.weapons.push("saber");
      selectPrimary("saber");
      const p = game.player;
      p.x = 300; p.y = 300; p.dir = 0; p.attackCd = 0;
      const foe = new Enemy(Object.assign({}, ENEMY_TYPES.brute, { hp: 500, speed: 0, dmg: [0, 0] }), 345, 300);
      game.enemies.push(foe);
      weaponAttack(game);
      const cut = foe.hp < foe.maxHp;
      const iframes = p.dashT > 0;
      const hp0 = G.hp;
      G.invulnT = 0;
      damagePlayer(20, 0, 0);   // mid-lunge: the spectral step absorbs it
      const phased = G.hp === hp0;
      update(0.25);
      const moved = p.x - 300 >= 40;
      /* wrong-aim check: a foe behind the lunge line is safe */
      game.enemies = [];
      const behind = new Enemy(Object.assign({}, ENEMY_TYPES.brute, { hp: 500, speed: 0, dmg: [0, 0] }), 290, 380);
      game.enemies.push(behind);
      p.x = 300; p.y = 300; p.attackCd = 0; p.dashT = 0;
      weaponAttack(game);
      return { cut, iframes, phased, moved, behindSafe: behind.hp === behind.maxHp };
    });
    expect(out.cut).toBeTruthy();
    expect(out.iframes).toBeTruthy();
    expect(out.phased).toBeTruthy();
    expect(out.moved).toBeTruthy();
    expect(out.behindSafe).toBeTruthy();
    expect(errs).toEqual([]);
  });
});
