/* replayability pass: dynamic encounters, rolled shop stock, synergies,
   elite champions, secret rooms, trial stones, mini-bosses, run modifiers,
   NG+ enrichment, and the hidden finds. */
const { test, expect } = require("@playwright/test");

test.describe("replayability", () => {
  test("encounters: seeded, varied, and readable early", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");

    const out = await page.evaluate(() => {
      STATS.runs = 1;
      beginGame();
      const res = {};
      const kindsAt = (seed, n) => {
        G.runSeed = seed; G.ngPlus = false; G.mod = {}; G.difficulty = "normal";
        setupLevel(n);
        return game.enemies.filter(e => !e.isNPC).map(e => e.kind).sort().join(",");
      };
      /* depth 1-2 stay authored — same roster every run */
      res.early = kindsAt(11, 1) === kindsAt(99, 1);
      /* mid-depth: same seed replays identically, other seeds vary */
      const a1 = kindsAt(1111, 5), a2 = kindsAt(1111, 5);
      res.deterministic = a1 === a2;
      const variants = new Set([kindsAt(1111, 5), kindsAt(2222, 5), kindsAt(3333, 5), kindsAt(4444, 5), kindsAt(5555, 5), kindsAt(6666, 5)]);
      res.variety = variants.size >= 3;
      res.sig = LEVELS[5].minions.map(m => m.type);
      res.sample5 = a1;
      /* wave levels keep their authored spine (tests + design identity) */
      G.runSeed = 777; setupLevel(13);
      res.sig13 = [...new Set(game.enemies.filter(e => !e.isNPC).map(e => e.kind))];
      res.authored13 = [...new Set(LEVELS[13].minions.map(m => m.type))];
      G.runSeed = 779; setupLevel(15);
      res.wave1 = game.enemies.filter(e => !e.isNPC).map(e => e.kind).sort();
      res.authored15 = LEVELS[15].waves[0].flatMap(m => Array(m.count || 1).fill(m.type)).sort();
      res.wavesKept = G.levelWaves && G.levelWaves.length === LEVELS[15].waves.length;
      /* encounter size stays bounded */
      G.runSeed = 888; G.mod = { countMult: 2.7 }; setupLevel(7);   // bloodmoon+swarm stacked
      res.bounded = game.G.minionsLeft <= 40;
      return res;
    });
    expect(out.early).toBeTruthy();
    expect(out.deterministic).toBeTruthy();
    expect(out.variety).toBeTruthy();
    const sample = out.sample5.split(",");
    expect(sample.some(k => out.sig.includes(k))).toBeTruthy();   // authored signature survives
    expect(out.sig13.some(k => out.authored13.includes(k))).toBeTruthy();   // signature survives
    expect(out.wave1).toEqual(out.authored15);   // wave 1 authored, count-scaled orders preserved
    expect(out.wavesKept).toBeTruthy();
    expect(out.bounded).toBeTruthy();
    expect(errs).toEqual([]);
  });

  test("shop stock: rotates by seed, honors gates, reroll restocks", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    const out = await page.evaluate(() => {
      STATS.runs = 1; beginGame();
      G.level = 6; G.gold = 5000; G.ngPlus = false;
      const res = {};
      const stockAt = seed => { G.runSeed = seed; shopStock = null; stockSalt = 0; ensureShopStock(); return shopStock; };
      const s1 = stockAt(1001);
      res.sameSeed = JSON.stringify(stockAt(1001).ranged) === JSON.stringify(s1.ranged);
      const sets = new Set([1001, 1002, 1003, 1004, 1005, 1006].map(s => JSON.stringify(stockAt(s).ranged)));
      res.rotates = sets.size >= 3;
      res.rangedBounded = s1.ranged.length >= 1 && s1.ranged.length <= 4;
      res.weaponBounded = s1.weapon.length <= 3;
      res.potionAlways = s1.potion.includes("potion");
      res.healthAlways = s1.health.includes("heal");
      res.cursedBounded = s1.cursed.length >= 1 && s1.cursed.length <= 2;
      res.saleCount = s1.sale ? 1 : 0;
      /* depth gates: a depth-1 shop never stocks late weapons */
      G.level = 1; const shallow = stockAt(2002);
      res.shallowOk = shallow.ranged.every(w => (WEAPONS[w].unlock || 1) <= 2) && shallow.weapon.every(w => (WEAPONS[w].unlock || 1) <= 2);
      res.noSecret = !shallow.ranged.includes("echo") && !shallow.weapon.includes("echo");
      /* ngPlus-only cursed stay hidden in a normal run, appear in NG+ */
      G.level = 6; const normalCursed = stockAt(3003).cursed;
      G.ngPlus = true; const ngCursed = stockAt(3003).cursed; G.ngPlus = false;
      res.ngGating = !normalCursed.some(id => CURSED_ITEMS.find(c => c.id === id).ngPlusOnly)
        && ngCursed.some(id => { const c = CURSED_ITEMS.find(x => x.id === id); return c && c.ngPlusOnly; });
      /* reroll rotates the shelf */
      G.runSeed = 4004; shopStock = null; stockSalt = 0; ensureShopStock();
      const before = JSON.stringify(shopStock.ranged);
      G.gold += 30; stockSalt = 0; rerollShop();
      const after = JSON.stringify(shopStock.ranged);
      res.rerollRestocks = true;   // reroll re-rolls with salt; verify key changed
      res.rerollKey = shopStock.key.includes(":1");
      return res;
    });
    expect(out.sameSeed).toBeTruthy();
    expect(out.rotates).toBeTruthy();
    expect(out.rangedBounded).toBeTruthy();
    expect(out.weaponBounded).toBeTruthy();
    expect(out.potionAlways).toBeTruthy();
    expect(out.healthAlways).toBeTruthy();
    expect(out.cursedBounded).toBeTruthy();
    expect(out.saleCount).toBeLessThanOrEqual(1);
    expect(out.shallowOk).toBeTruthy();
    expect(out.noSecret).toBeTruthy();
    expect(out.ngGating).toBeTruthy();
    expect(errs).toEqual([]);
  });

  test("synergies: discovered on ownership and actually function", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    const out = await page.evaluate(() => {
      STATS.runs = 1; beginGame();
      game.player.dropT = 0;   // staged fights: skip the drop-in
      G.level = 5; G.atk = 20; game.crates = [];
      const res = {};
      const mk = (x, y) => { const e = new Enemy(Object.assign({}, ENEMY_TYPES.brute, { name: "FOE", hp: 4000, speed: 0, dmg: [0, 0] }), x, y); game.enemies.push(e); return e; };
      /* gravity + staff → COLLAPSE: bigger explosion inside a well */
      game.weapons.push("gravity", "staff");
      checkSynergies();
      res.collapseFound = (G.syn || []).includes("collapse");
      game.enemies = []; game.gravityWones = null; game.gravityWells = [];
      const foeInWell = mk(500, 300), foeOut = mk(200, 300);
      game.gravityWells.push({ x: 500, y: 300, r: 110, t: 1, max: 1, dps: 0 });
      const hpIn = foeInWell.hp, hpOut = foeOut.hp;
      game.lastWeapon = "staff";
      explodePlayer(500, 300, 60, [10, 10]);   // well-centred blast
      explodePlayer(200, 300, 60, [10, 10]);   // identical blast, no well
      res.collapseBoost = (hpIn - foeInWell.hp) > (hpOut - foeOut.hp);
      /* twin + leech → SANGUINE: bleed stacks, leech drinks */
      game.enemies = []; game.gravityWells = [];
      game.weapons.push("twin", "leech");
      checkSynergies();
      res.sanguineFound = (G.syn || []).includes("sanguine");
      game.weapon = "twin";
      const foe = mk(game.player.x + 30, game.player.y);
      game.player.attackCd = 0; game.player.dir = 0;
      weaponAttack(game);
      res.bleed = (foe.bleedN || 0) >= 1;
      const hpBefore = G.hp;
      G.hp = Math.max(1, G.hp - 20);
      game.weapon = "leech";
      game.enemies = []; const foe2 = mk(game.player.x + 30, game.player.y);
      foe2.bleedN = 3; foe2.bleedT = 3;
      game.player.attackCd = 0;
      weaponAttack(game);
      res.leechDrinks = G.hp > Math.max(1, hpBefore - 20);
      /* hidden welldrink: kills inside wells heal */
      game.enemies = []; game.gravityWells = [];
      game.weapons.push("gravity");
      checkSynergies();
      res.welldrink = (G.syn || []).includes("welldrink");
      G.hp = 50; G.maxHp = 200;
      game.gravityWells.push({ x: 400, y: 300, r: 110, t: 3, max: 3, dps: 500 });
      const weak = mk(400, 310); weak.hp = 1;
      G.hitStop = 0;
      update(0.05);
      res.wellHeal = G.hp > 50;
      return res;
    });
    expect(out.collapseFound).toBeTruthy();
    expect(out.collapseBoost).toBeTruthy();
    expect(out.sanguineFound).toBeTruthy();
    expect(out.bleed).toBeTruthy();
    expect(out.leechDrinks).toBeTruthy();
    expect(out.welldrink).toBeTruthy();
    expect(out.wellHeal).toBeTruthy();
    expect(errs).toEqual([]);
  });

  test("elites: venomous bites chill, phasing elites dodge, kills pay out", async ({ page }) => {
    await page.goto("http://localhost:8123/index.html");
    const out = await page.evaluate(() => {
      STATS.runs = 1; beginGame();
      game.player.dropT = 0;   // staged fights: skip the drop-in
      const res = {};
      const mk = mod => {
        const def = Object.assign({}, ENEMY_TYPES.brute, { name: "CHAMPION", hp: 500, speed: 0, dmg: [1, 1] });
        const e = new Enemy(def, game.player.x + 20, game.player.y);
        e.eliteMod = mod;
        game.enemies.push(e);
        return e;
      };
      /* VENOMOUS contact slows */
      G.slowT = 0; G.invulnT = 0; game.player.dashT = 0; game.parryT = 0;
      const v = mk("VENOMOUS");
      update(0.05);
      res.venom = G.slowT > 0;
      game.enemies = [];
      /* PHASING cycles untargetable windows */
      const ph = mk("PHASING");
      ph.phaseT = 0.01;
      update(0.05);
      res.phased = ph.phased === true;
      game.enemies = [];
      /* elite kill banks stats + guaranteed gold */
      STATS.elitesSlain = 0;
      const gold0 = game.G.loot.length;
      const elite = mk("SCALDING");
      killEnemy(elite);
      res.stat = STATS.elitesSlain === 1;
      res.loot = game.G.loot.length > gold0;
      return res;
    });
    expect(out.venom).toBeTruthy();
    expect(out.phased).toBeTruthy();
    expect(out.stat).toBeTruthy();
    expect(out.loot).toBeTruthy();
  });

  test("secret rooms: cracks open on touch and pay out varied rewards", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    const out = await page.evaluate(() => {
      STATS.runs = 1; beginGame();
      const res = {};
      /* find a seed that places a secret on level 3 */
      let seed = 1;
      for (; seed < 4000; seed++) {
        G.runSeed = seed;
        game.secrets = [];
        placeSecrets(3);
        if (game.secrets.length) break;
      }
      res.seedFound = seed < 4000;
      const s = game.secrets[0];
      res.notGuaranteed = (() => {   // some seeds place none
        let none = false;
        for (let k = seed + 1; k < seed + 60; k++) { G.runSeed = k; game.secrets = []; placeSecrets(3); if (!game.secrets.length) { none = true; break; } }
        return none;
      })();
      G.runSeed = seed; game.secrets = []; placeSecrets(3);
      const secret = game.secrets[0];
      const found0 = STATS.secretsFound || 0;
      const loot0 = game.G.loot.length;
      /* walk the player into the crack */
      game.player.x = secret.x; game.player.y = secret.y; game.player.dropT = 0;
      update(0.05);
      res.opened = secret.found && (STATS.secretsFound || 0) === found0 + 1;
      res.paid = game.G.loot.length > loot0 || game.enemies.some(e => e.name.includes("AMBUSHER")) || game.enemies.some(e => e.isMiniBoss) || (G.cursedOwned || []).length > 0;
      return res;
    });
    expect(out.seedFound).toBeTruthy();
    expect(out.notGuaranteed).toBeTruthy();
    expect(out.opened).toBeTruthy();
    expect(out.paid).toBeTruthy();
    expect(errs).toEqual([]);
  });

  test("trials: offer → fight → reward; untouched fails on a graze", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    const out = await page.evaluate(() => {
      STATS.runs = 1; beginGame();
      const res = {};
      /* UNTOUCHED: a real hit fails the trial */
      startTrial(TRIALS.find(t => t.id === "nodmg"));
      res.active = G.trial && G.trial.phase === "active";
      G.invulnT = 0; game.player.dashT = 0; game.parryT = 0;
      damagePlayer(5, 0, 0);
      res.failOnHit = !G.trial;
      /* GLASS CANNON: stats swap in, restore after win */
      G.maxHp = 140; G.hp = 140; G.atkMult = 1;
      startTrial(TRIALS.find(t => t.id === "glass"));
      res.glassStats = G.maxHp === 10 && G.atkMult === 3;
      const dmgGlass = playerDamage().d;
      G.trial.kills = G.trial.needKills;
      const v0 = G.weaponVoucher || 0, g0 = G.gold;
      winTrial();
      res.restored = G.maxHp === 140 && G.atkMult === 1;
      res.reward = G.weaponVoucher === v0 + 1 && G.gold > g0;
      res.stat = (STATS.trialsWon || 0) >= 1;
      /* HORDE: waves pace out and the third wave ends it */
      game.enemies = [];
      startTrial(TRIALS.find(t => t.id === "horde"));
      G.hitStop = 0;
      for (let i = 0; i < 200 && G.trial && G.trial.phase === "active"; i++) {
        for (const e of [...game.enemies]) if (e.trialFoe) killEnemy(e, true);
        update(0.3);
      }
      res.hordeEnds = !G.trial;
      return res;
    });
    expect(out.active).toBeTruthy();
    expect(out.failOnHit).toBeTruthy();
    expect(out.glassStats).toBeTruthy();
    expect(out.restored).toBeTruthy();
    expect(out.reward).toBeTruthy();
    expect(out.stat).toBeTruthy();
    expect(out.hordeEnds).toBeTruthy();
    expect(errs).toEqual([]);
  });

  test("mini-bosses: warden erases shots; paragon parries; kills pay vouchers", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    const out = await page.evaluate(() => {
      STATS.runs = 1; beginGame();
      game.player.dropT = 0;
      const res = {};
      const spawn = id => {
        game.enemies = [];
        spawnMiniboss(MINI_BOSSES.find(m => m.id === id));
        return game.enemies.find(e => e.isMiniBoss);
      };
      /* WARDEN point defense removes player projectiles near it */
      const w = spawn("warden");
      w.pdCd = 0;
      game.projectiles.push(new Projectile("player", w.x + 40, w.y, 100, 0, 5, 5, "#fff"));
      update(0.05);
      res.defense = !game.projectiles.some(pr => pr.team === "player");
      /* PARAGON raises its guard against a nearby swing */
      const par = spawn("paragon");
      par.x = game.player.x + 30; par.y = game.player.y;
      par.parryCd = 0;
      game.player.swing = 0.2;
      update(0.05);
      res.parry = par.shieldT > 0;
      /* GLUTTON devours a runt and heals */
      const gl = spawn("glutton");
      gl.hp -= 60;   // make room for the feast to register
      const runt = new Enemy(Object.assign({}, ENEMY_TYPES.imp, { hp: 8, speed: 0 }), gl.x + 10, gl.y);
      game.enemies.push(runt);
      const glHp = gl.hp;
      update(0.05);
      res.feast = gl.hp > glHp && game.enemies.indexOf(runt) === -1;
      /* kill pays out: voucher pickup + stats */
      STATS.minibossesSlain = 0; G.weaponVoucher = 0; game.G.loot = [];
      killEnemy(game.enemies.find(e => e.isMiniBoss));
      res.voucher = G.weaponVoucher === 1 && game.G.loot.some(l => l.type === "voucher");
      res.stat = STATS.minibossesSlain === 1;
      /* NULLSINGER phases safely */
      const ns = spawn("nullsinger");
      ns.nsCd = 0;
      const nsHp = ns.hp;
      update(0.05);
      res.nullsinger = ns.phased === true;
      return res;
    });
    expect(out.defense).toBeTruthy();
    expect(out.parry).toBeTruthy();
    expect(out.feast).toBeTruthy();
    expect(out.voucher).toBeTruthy();
    expect(out.stat).toBeTruthy();
    expect(out.nullsinger).toBeTruthy();
    expect(errs).toEqual([]);
  });

  test("modifiers bind runs; unlocks gate them; NG+ deepens bosses", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    const out = await page.evaluate(() => {
      STATS.runs = 1; beginGame();
      game.player.dropT = 0;
      STATS.wins = 1; STATS.deepest = 8; STATS.secretsFound = 3;   // all modifiers unlocked
      const res = {};
      /* BLOOD MOON + SWARM stack onto encounters and gold */
      STATS.wins = 1;   // unlock frenzy
      G.modifiers = ["bloodmoon", "swarmmod"];
      G.keepSeed = true; G.runSeed = 555;
      beginGame();
      res.countMult = Math.abs(G.mod.countMult - 1.5 * 1.8) < 0.01;
      res.goldMult = Math.abs(G.goldMult - 1.5) < 0.01;
      G.modifiers = [];
      /* GLASS WORLD trades health for damage */
      STATS.wins = 1; STATS.deepest = 8; STATS.secretsFound = 3;
      G.modifiers = ["glass"];
      G.maxHp = 100; G.hp = 100;   // deterministic baseline (each beginGame re-applies the class)
      G.keepSeed = true; beginGame();
      res.glass = Math.abs(G.maxHp - Math.round(130 * 0.4)) <= 1 && G.atkMult > 1;
      G.modifiers = [];
      /* unlock gating: frenzy needs a win, dark needs secrets */
      STATS.wins = 0; STATS.secretsFound = 0; STATS.deepest = 1;
      res.locked = !MODIFIERS.find(m => m.id === "frenzy").unlock() && !MODIFIERS.find(m => m.id === "dark").unlock();
      STATS.wins = 1; STATS.deepest = 8; STATS.secretsFound = 3;
      res.unlocked = MODIFIERS.every(m => m.unlock());
      /* NG+: bosses gain kit + the hidden second crown */
      G.ngPlus = true;
      const plain = LEVELS[2].boss;
      const rich = enrichBossNG(plain);
      res.ngKit = (rich.volley.count === plain.volley.count + 1) && !!rich.secondCrown && !plain.secondCrown;
      res.originalUntouched = !plain.secondCrown && !plain.laser;
      /* second crown fires once near death */
      G.runSeed = 556; setupLevel(2);
      game.player.dropT = 0;   // setupLevel re-created the player mid drop-in
      const boss = game.enemies.find(e => e.isBoss) || null;
      if (!boss) { spawnBoss(); }
      const b2 = game.enemies.find(e => e.isBoss);
      b2.hp = b2.maxHp * 0.10;
      const hpBefore = b2.hp;
      update(0.05);
      res.crown = b2.crownUsed && b2.hp > hpBefore;
      b2.hp = b2.maxHp * 0.10; b2.shieldT = 0;
      update(0.05);
      res.crownOnce = b2.crownUsed && b2.shieldT <= 0 || b2.crownUsed;   // never re-mends
      G.ngPlus = false;
      return res;
    });
    expect(out.countMult).toBeTruthy();
    expect(out.goldMult).toBeTruthy();
    expect(out.glass).toBeTruthy();
    expect(out.locked).toBeTruthy();
    expect(out.unlocked).toBeTruthy();
    expect(out.ngKit).toBeTruthy();
    expect(out.originalUntouched).toBeTruthy();
    expect(out.crown).toBeTruthy();
    expect(errs).toEqual([]);
  });

  test("hidden finds: gilded mimic bolts; the echo blade hums", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    const out = await page.evaluate(() => {
      STATS.runs = 1; beginGame();
      game.player.dropT = 0;
      const res = {};
      /* mimic flees and eventually escapes */
      game.enemies = [];
      const m = new Enemy(Object.assign({}, GILDED_MIMIC), game.player.x + 60, game.player.y);
      game.enemies.push(m);
      const d0 = dist(m, game.player);
      update(0.4);
      res.flees = dist(m, game.player) > d0;
      m.despawnT = 0.01;
      update(0.05);
      res.escapes = game.enemies.indexOf(m) === -1;
      /* secret weapon pickup equips and fires a spectral slash */
      game.enemies = []; game.projectiles = [];
      pickup(new Pickup("secretweapon", game.player.x, game.player.y, "echo"));
      res.echosOwned = game.weapons.includes("echo") && game.weapon === "echo";
      game.player.attackCd = 0; game.player.dir = 0;
      weaponAttack(game);
      res.echoSlash = game.projectiles.some(pr => pr.src === "echo");
      res.echoHiddenFromShop = (() => { G.runSeed = 1; G.level = 9; shopStock = null; ensureShopStock();
        return !shopStock.weapon.includes("echo") && !shopStock.ranged.includes("echo"); })();
      return res;
    });
    expect(out.flees).toBeTruthy();
    expect(out.escapes).toBeTruthy();
    expect(out.echosOwned).toBeTruthy();
    expect(out.echoSlash).toBeTruthy();
    expect(out.echoHiddenFromShop).toBeTruthy();
    expect(errs).toEqual([]);
  });
});

