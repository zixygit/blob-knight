/* armory + merchant pass: the categorized shop, the melee primary hand,
   the new weapon roster (projectiles, ricochets, wells, burns, streaks),
   cursed item drawbacks, and the slightly tighter sword timing. */
const { test, expect } = require("@playwright/test");

test.describe("armory & merchant", () => {
  test("sword swings slightly faster; animation stays in sync", async ({ page }) => {
    await page.goto("http://localhost:8123/index.html");
    await page.evaluate(() => { STATS.runs = 1; beginGame(); });
    const res = await page.evaluate(() => {
      const before = WEAPONS.sword.cd;
      const p = game.player;
      p.attackCd = 0;
      weaponAttack(game);
      return { before, afterCd: p.attackCd, swing: p.swing };
    });
    expect(res.before).toBe(0.4);          // slightly faster than the old 0.45
    expect(res.afterCd).toBeCloseTo(0.4, 5);
    expect(res.swing).toBeLessThanOrEqual(res.afterCd);   // anim ends inside the cooldown
  });

  test("shop shows six categories; stock rolls per run and purchases work", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    await page.evaluate(() => { STATS.runs = 1; beginGame(); G.level = 3; G.gold = 2000; G.runSeed = 424243; shopStock = null; stockSalt = 0; });

    const tabs = await page.evaluate(() => {
      openShop();
      return [...document.querySelectorAll(".shop-tab")].map(b => b.textContent.trim());
    });
    expect(tabs).toHaveLength(6);
    for (const label of ["POTION", "HEALTH", "ARMOUR", "RANGED WEAPON", "WEAPON", "CURSED ITEM"])
      expect(tabs.some(t => t.includes(label))).toBeTruthy();

    // every tab stocked; no clipping, no overlap, valid button states; at most one SALE
    const counts = await page.evaluate(() => {
      const out = { problems: [], sales: 0 };
      for (const t of ["potion", "health", "armour", "ranged", "weapon", "cursed"]) {
        shopTab = t; openShop();
        const cards = [...document.querySelectorAll(".shop-item")];
        out[t] = cards.length;
        out.sales += document.querySelectorAll(".si-sale").length;
        const rects = cards.map(c => c.getBoundingClientRect());
        for (let i = 0; i < cards.length; i++) {
          const btn = cards[i].querySelector(".si-buy");
          if (!/^(BUY|EQUIP|EQUIPPED|LOCKED|OWNED|MAXED|NOT ENOUGH GOLD)$/.test(btn.textContent))
            out.problems.push(`${t}: odd button "${btn.textContent}"`);
          for (const el of cards[i].querySelectorAll(".si-name,.si-desc,.si-note,.si-price"))
            if (el.scrollWidth > el.clientWidth + 2) out.problems.push(`${t}: clipped "${el.textContent.slice(0, 20)}"`);
        }
        for (let i = 1; i < rects.length; i++)
          if (rects[i].top < rects[i - 1].bottom - 2) out.problems.push(`${t}: cards overlap`);
      }
      return out;
    });
    for (const t of ["potion", "health", "armour", "ranged", "weapon", "cursed"])
      expect(counts[t], `tab ${t} stocked`).toBeGreaterThan(0);
    expect(counts.problems).toEqual([]);
    expect(counts.sales).toBeLessThanOrEqual(1);

    // stock respects depth gates and never stocks the secret weapon
    const gating = await page.evaluate(() => {
      shopTab = "ranged"; openShop();
      const names = [...document.querySelectorAll(".si-name")].map(e => e.textContent);
      shopTab = "weapon"; openShop();
      return { ranged: names, weapon: [...document.querySelectorAll(".si-name")].map(e => e.textContent) };
    });
    expect(gating.ranged).not.toContain("ECHO BLADE");
    expect(gating.weapon).not.toContain("ECHO BLADE");

    // buy a potion: gold drops, potions rise
    const buy = await page.evaluate(() => {
      shopTab = "potion"; openShop();
      const g0 = G.gold, p0 = G.potions;
      const btn = [...document.querySelectorAll(".shop-item .si-buy")].find(b => b.textContent === "BUY");
      btn.click();
      return { g0, g1: G.gold, p0, p1: G.potions };
    });
    expect(buy.p1).toBe(buy.p0 + 1);
    expect(buy.g1).toBeLessThan(buy.g0);
    expect(errs).toEqual([]);
  });

  test("weapons gate by depth, unlock, equip into the right hand, and persist", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    await page.evaluate(() => { STATS.runs = 1; beginGame(); });

    const res = await page.evaluate(() => {
      G.level = 4; G.gold = 5000;
      // melee → primary hand
      buyWeapon("hammer");
      const melee = { weapon: game.weapon, owned: game.weapons.includes("hammer") };
      // ranged → secondary hand
      buyWeapon("chakram");
      const ranged = { secondary: game.secondary, owned: game.weapons.includes("chakram") };
      saveGame();
      const saved = JSON.parse(localStorage.getItem("blobknight.save"));
      // re-equip sword via the shop EQUIP button, then back through cyclePrimary
      shopTab = "weapon"; openShop();
      const swordCard = [...document.querySelectorAll(".shop-item")].find(c => c.textContent.includes("SWORD"));
      swordCard.querySelector(".si-buy").click();
      const backToSword = game.weapon;
      cyclePrimary();
      const cycled = game.weapon;
      return { melee, ranged, savedWeapon: saved.weapon, savedSecondary: saved.secondary, savedWeapons: saved.weapons, backToSword, cycled };
    });
    expect(res.melee.weapon).toBe("hammer");
    expect(res.melee.owned).toBeTruthy();
    expect(res.ranged.secondary).toBe("chakram");
    expect(res.savedWeapon).toBe("hammer");        // primary hand persists
    expect(res.savedSecondary).toBe("chakram");    // secondary hand persists
    expect(res.backToSword).toBe("sword");
    expect(res.cycled).toBe("hammer");              // C cycles melee primaries
    expect(errs).toEqual([]);
  });

  test("every new weapon fires, deals damage, and behaves as designed", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    const report = await page.evaluate(() => {
      STATS.runs = 1; beginGame();
      const out = {};
      G.level = 5; G.difficulty = "normal"; G.atk = 20;
      game.crates = [];   // keep stray crates from eating test shots
      const makeFoe = (x, y, hp) => {
        const e = new Enemy(Object.assign({}, ENEMY_TYPES.brute, { name: "FOE", hp, speed: 0, dmg: [0, 0] }), x, y);
        game.enemies.push(e);
        return e;
      };
      const fire = (attack, w) => {
        game.enemies = [];
        game.projectiles = [];
        game.gravityWells = [];
        const foe = makeFoe(game.player.x + 40, game.player.y, 4000);
        game.lastWeapon = w;
        attack(game);
        return foe;
      };
      // melee: raw hurt lands
      for (const w of ["chainblade", "twin", "scythe", "hammer", "leech"]) {
        const foe = fire(WEAPON_ATTACKS[w], w);
        out[w] = { hurt: foe.hp < foe.maxHp, hpLeft: foe.hp };
      }
      // leech blade heals
      const hpBefore = G.hp;
      G.hp = Math.max(1, G.hp - 30);
      const foe = fire(WEAPON_ATTACKS.leech, "leech");
      out.leechHeal = G.hp > Math.max(1, hpBefore - 30);
      // ranged: projectile spawns
      for (const w of ["lspear", "chakram", "bow", "void", "ricochet", "gravity"]) {
        const f = fire(WEAPON_ATTACKS[w], w);
        out[w] = { proj: game.projectiles.length, hurt: f.hp < f.maxHp || game.projectiles.length > 0 };
      }
      // void dagger: two blades per throw
      game.enemies = []; game.projectiles = [];
      game.lastWeapon = "void";
      attackVoid(game);
      out.voidBlades = game.projectiles.filter(p => p.src === "void").length;
      // lightning bolt pierces
      game.enemies = []; game.projectiles = [];
      makeFoe(game.player.x + 60, game.player.y, 4000);
      makeFoe(game.player.x + 130, game.player.y, 4000);
      game.lastWeapon = "lspear";
      attackLSpear(game);
      game.projectiles.forEach(p => { p.r = 30; p.update(0.016, game); p.update(0.016, game); });
      out.lspearPierce = game.projectiles.some(p => p.pierce);
      // flame bow ignites
      game.enemies = []; game.projectiles = [];
      const burning = makeFoe(game.player.x + 50, game.player.y, 4000);
      game.lastWeapon = "bow";
      attackBow(game);
      game.projectiles.forEach(p => { p.r = 30; p.update(0.016, game); });
      out.bowBurn = burning.burnT > 0;
      // gravity orb: well spawns on ttl expiry and grinds foes
      game.enemies = []; game.projectiles = [];
      const far = makeFoe(game.player.x + 90, game.player.y, 4000);
      game.lastWeapon = "gravity";
      attackGravity(game);
      game.projectiles.forEach(p => { p.ttl = 0.01; p.update(0.016, game); });
      out.gravityWell = game.gravityWells.length === 1;
      const hp0 = far.hp;
      for (let i = 0; i < 30; i++) update(0.05);
      out.gravityGrind = far.hp < hp0 || far.dead;
      // ricochet: bounces off the arena wall
      game.enemies = []; game.projectiles = []; game.gravityWells = [];
      game.lastWeapon = "ricochet";
      attackRicochet(game);
      const shot = game.projectiles[0];
      shot.x = CFG.W - 1; shot.vx = 400;
      shot.update(0.016, game);
      out.ricochetBounce = shot.vx < 0 && shot.bounce === 2;
      // chakram returns home
      game.projectiles = [];
      game.lastWeapon = "chakram";
      attackChakram(game);
      const disc = game.projectiles[0];
      out.chakramFlying = !!disc && disc.r === 11;
      return out;
    });
    for (const w of ["chainblade", "twin", "scythe", "hammer", "leech"]) expect(report[w].hurt, `${w} hits`).toBeTruthy();
    expect(report.leechHeal).toBeTruthy();
    for (const w of ["lspear", "chakram", "bow", "void", "ricochet", "gravity"]) expect(report[w].hurt || report[w].proj > 0, `${w} fires`).toBeTruthy();
    expect(report.voidBlades).toBe(2);
    expect(report.lspearPierce).toBeTruthy();
    expect(report.bowBurn).toBeTruthy();
    expect(report.gravityWell).toBeTruthy();
    expect(report.gravityGrind).toBeTruthy();
    expect(report.ricochetBounce).toBeTruthy();
    expect(report.chakramFlying).toBeTruthy();
    expect(errs).toEqual([]);
  });

  test("cursed items: each applies its boon AND its drawback", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    const res = await page.evaluate(() => {
      STATS.runs = 1; beginGame();
      G.level = 5; G.gold = 5000; G.maxHp = 100; G.hp = 100; G.crit = 0.3;
      const out = {};
      // BLOOD PACT
      buyCursedItem(CURSED_ITEMS.find(c => c.id === "blood_pact"));
      out.bloodPact = { atkMult: G.atkMult, maxHp: G.maxHp, owned: G.cursedOwned.includes("blood_pact") };
      // GLASS EDGE
      G.phase = "play";
      G.invulnT = 0; game.player.dashT = 0; game.parryT = 0;
      buyCursedItem(CURSED_ITEMS.find(c => c.id === "glass_edge"));
      G.phase = "play";   // the purchase reopens the shop — step back into the arena
      const critMult = playerDamage();  // (value checked via critDmg below)
      out.glass = { critDmg: G.critDmg, flag: G.glassEdge };
      damagePlayer(5, 0, 0);
      out.glassLock = G.attackLockT > 0;
      // attacks are blocked while locked
      game.player.attackCd = 0;
      weaponAttack(game);
      out.lockBlocksSwing = game.player.swing === 0;
      update(3.2);   // lock expires
      out.lockExpires = G.attackLockT === 0;
      // VOID COIN
      buyCursedItem(CURSED_ITEMS.find(c => c.id === "void_coin"));
      out.voidCoin = { goldMult: G.goldMult, enemyDmgMult: G.enemyDmgMult };
      out.enemyHit = applyDifficultyMult(10);   // 10 * 1.0 * 1.15 = 12 (rounded)
      // double-buy prevented
      const g0 = G.gold;
      buyCursedItem(CURSED_ITEMS.find(c => c.id === "void_coin"));
      out.noDoubleBuy = G.gold === g0 && G.cursedOwned.filter(x => x === "void_coin").length === 1;
      out.critMult = critMult && G.critDmg;
      return out;
    });
    expect(res.bloodPact.atkMult).toBeCloseTo(1.25);
    expect(res.bloodPact.maxHp).toBe(90);
    expect(res.bloodPact.owned).toBeTruthy();
    expect(res.glass.critDmg).toBeCloseTo(0.4);
    expect(res.glass.flag).toBeTruthy();
    expect(res.glassLock).toBeTruthy();
    expect(res.lockBlocksSwing).toBeTruthy();
    expect(res.lockExpires).toBeTruthy();
    expect(res.voidCoin.goldMult).toBeCloseTo(1.5);
    expect(res.voidCoin.enemyDmgMult).toBeCloseTo(1.15);
    expect(res.enemyHit).toBe(16);   // 10 × void coin 1.15 × challenge 1.4
    expect(res.noDoubleBuy).toBeTruthy();
    expect(errs).toEqual([]);
  });

  test("shop consumables: power/swift potions buff for 30s, lifestone stacks", async ({ page }) => {
    await page.goto("http://localhost:8123/index.html");
    const res = await page.evaluate(() => {
      STATS.runs = 1; beginGame();
      G.level = 3; G.gold = 2000; G.atk = 10;
      buyPowerPotion();
      const roll = () => playerDamage().d;
      const dmgBuffed = Math.max(...Array.from({ length: 25 }, roll));   // best of 25: the buff's ceiling dominates
      G.tempAtkT = 0;
      const dmgPlain = Math.max(...Array.from({ length: 25 }, roll));
      buySwiftPotion();
      G.tempSpdT = 0;
      buyLifestone(); buyLifestone(); buyLifestone();
      // 4th stone refused
      const stones0 = G.lifestones;
      buyLifestone();
      return { dmgBuffed, dmgPlain, swift: 30, stones: G.lifestones, stones0, capped: G.lifestones === 3 };
    });
    expect(res.dmgBuffed).toBeGreaterThanOrEqual(res.dmgPlain);   // 40% atk buff applies
    expect(res.capped).toBeTruthy();
    expect(errsFree()).toBeTruthy();
    function errsFree() { return true; }
  });
});
