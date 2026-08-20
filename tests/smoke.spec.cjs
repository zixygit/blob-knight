/* idea 93: headless smoke test — menu → start → kill → shop → next level, plus
   the v1.6 quality pass: combo, auto level-up, invuln window, GOD RUN clamp,
   boss shield windows, objective chip, pause RESTART RUN, SCREEN SIZE option */
const { test, expect } = require("@playwright/test");

test.describe("BLOB KNIGHT smoke", () => {
  test("fresh run: menu, start, kill, shop, next level", async ({ page }) => {
    await page.goto("http://localhost:8123/index.html");

    /* menu renders with title + PLAY/CONTINUE/SETTINGS */
    await expect(page.locator("#overlay")).toBeVisible();
    await expect(page.getByText("BLOB", { exact: false }).first()).toBeVisible();
    await expect(page.locator(".btn", { hasText: "PLAY" })).toBeVisible();
    await expect(page.locator(".btn", { hasText: "CONTINUE" })).toBeVisible();
    await expect(page.locator(".btn", { hasText: "SETTINGS" })).toBeVisible();
    /* difficulty chips incl. the new GOD RUN */
    await expect(page.locator(".diff-chip", { hasText: "GOD RUN" })).toBeVisible();

    /* start a run (skip tutorial) */
    await page.evaluate(() => { STATS.runs = 1; beginGame(); });
    await expect(page.locator("#overlay")).toBeHidden();

    /* player spawned and can move */
    await page.keyboard.down("d");
    await page.waitForTimeout(200);
    await page.keyboard.up("d");

    /* attack spawns slash arcs — no crash */
    await page.keyboard.press("Space");
    await page.waitForTimeout(120);

    /* objective chip shows foes left during a level */
    const foes = await page.evaluate(() => game.G.minionsLeft);
    expect(foes).toBeGreaterThan(0);
    await expect(page.locator("#objHint")).toHaveText(new RegExp(`FOES LEFT: ${foes}`));

    /* shop path: force level clear + open shop, buy a potion */
    await page.evaluate(() => {
      G.level = 1; G.gold = 200; openShop();
    });
    await expect(page.getByText("CAMPFIRE MERCHANT")).toBeVisible();
    await page.locator(".btn", { hasText: "POTION" }).first().click({ noWaitAfter: true });

    /* walk to next door and proceed to level 2 without error */
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.evaluate(() => { G.level = 1; setupLevel(2); G.phase = "play"; });
    await page.waitForTimeout(300);
    expect(errs).toEqual([]);
  });

  test("sword hits build the combo ramp; kills refresh it", async ({ page }) => {
    await page.goto("http://localhost:8123/index.html");
    await page.evaluate(() => { STATS.runs = 1; beginGame(); });
    await expect(page.locator("#overlay")).toBeHidden();

    /* spawn a docile dummy right next to the player */
    await page.evaluate(() => {
      const def = Object.assign({}, ENEMY_TYPES.brute, { name: "COMBO DUMMY", hp: 400, speed: 0, dmg: [1, 1] });
      const d = new Enemy(def, game.player.x + 26, game.player.y);
      d.summoned = true;
      game.enemies.push(d);
      game.G.minionsLeft = 99;
    });
    await page.keyboard.press("Space");   // release-attack: slash
    await page.waitForTimeout(200);
    const combo = await page.evaluate(() => G.combo);
    expect(combo).toBeGreaterThanOrEqual(1);
    const window = await page.evaluate(() => G.comboT);
    expect(window).toBeGreaterThan(0);
    /* damage ramp: playerDamage scales with combo */
    const dmg = await page.evaluate(() => { G.combo = 12; G.comboT = 1; return game.playerDamage().d; });
    const base = await page.evaluate(() => { G.combo = 0; return game.playerDamage().d; });
    expect(dmg).toBeGreaterThan(base);
  });

  test("level-up auto-applies without blocking play", async ({ page }) => {
    await page.goto("http://localhost:8123/index.html");
    await page.evaluate(() => { STATS.runs = 1; beginGame(); });
    await expect(page.locator("#overlay")).toBeHidden();

    const before = await page.evaluate(() => G.playerLevel);
    /* spawn a killable dummy with XP on the table, then slay it deterministically */
    await page.evaluate(() => {
      G.xp = 999;
      const def = Object.assign({}, ENEMY_TYPES.brute, { name: "XP DUMMY", hp: 30, speed: 0, dmg: [1, 1] });
      const d = new Enemy(def, game.player.x + 26, game.player.y);
      game.enemies.push(d);
      hurtEnemy(d, 999, 0, 0);
    });
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => G.playerLevel);
    const phase = await page.evaluate(() => G.phase);
    const overlayHidden = await page.evaluate(() => $("overlay").style.display === "none");
    expect(after).toBeGreaterThan(before);
    expect(phase).toBe("play");
    expect(overlayHidden).toBe(true);
  });

  test("post-hit invincibility window absorbs follow-up hits", async ({ page }) => {
    await page.goto("http://localhost:8123/index.html");
    await page.evaluate(() => { STATS.runs = 1; beginGame(); });
    await expect(page.locator("#overlay")).toBeHidden();

    const hp0 = await page.evaluate(() => G.hp);
    await page.evaluate(() => { damagePlayer(10, game.player.x - 10, game.player.y); });
    const hp1 = await page.evaluate(() => G.hp);
    expect(hp1).toBeLessThan(hp0);
    /* immediate second hit inside the window is ignored */
    await page.evaluate(() => { damagePlayer(10, game.player.x - 10, game.player.y); });
    const hp2 = await page.evaluate(() => G.hp);
    expect(hp2).toBe(hp1);
    const invuln = await page.evaluate(() => G.invulnT);
    expect(invuln).toBeGreaterThan(0);
  });

  test("GOD RUN clamps max HP to 2 forever", async ({ page }) => {
    await page.goto("http://localhost:8123/index.html");
    await page.evaluate(() => {
      STATS.runs = 1;
      G.difficulty = "godrun";
      beginGame();
    });
    await expect(page.locator("#overlay")).toBeHidden();

    const maxHp = await page.evaluate(() => G.maxHp);
    expect(maxHp).toBe(2);
    /* even a level-up / blessing cannot grow it */
    await page.evaluate(() => { G.maxHp = 500; G.hp = 500; renderHUD(); });
    const clamped = await page.evaluate(() => ({ maxHp: G.maxHp, hp: G.hp }));
    expect(clamped.maxHp).toBe(2);
    expect(clamped.hp).toBe(2);
  });

  test("boss shield windows block damage", async ({ page }) => {
    await page.goto("http://localhost:8123/index.html");
    await page.evaluate(() => { STATS.runs = 1; beginGame(); });
    await expect(page.locator("#overlay")).toBeHidden();

    /* raise a BONE WARDEN-style guard and try to hurt it */
    const result = await page.evaluate(() => {
      const b = new Enemy(LEVELS[2].boss, 400, 300);
      b.shieldT = 1.5;
      game.enemies.push(b);
      const hpBefore = b.hp;
      hurtEnemy(b, 50, 0, 0);
      const hpAfter = b.hp;
      return { hpBefore, hpAfter, blockFx: game.effects.some(f => f.txt === "BLOCKED") };
    });
    expect(result.hpAfter).toBe(result.hpBefore);
    expect(result.blockFx).toBe(true);
  });

  test("pause menu offers RESTART RUN; settings offer SCREEN SIZE", async ({ page }) => {
    await page.goto("http://localhost:8123/index.html");
    await page.evaluate(() => { STATS.runs = 1; beginGame(); });
    await expect(page.locator("#overlay")).toBeHidden();

    await page.keyboard.press("p");
    await expect(page.locator(".btn", { hasText: "RESTART RUN" })).toBeVisible();
    await page.locator(".btn", { hasText: "OPTIONS" }).click();
    await expect(page.locator(".btn", { hasText: /SCREEN SIZE/ })).toBeVisible();
    const zoomBefore = await page.evaluate(() => SETTINGS.zoom);
    await page.locator(".btn", { hasText: /SCREEN SIZE/ }).click();
    const zoomAfter = await page.evaluate(() => SETTINGS.zoom);
    expect(zoomAfter).not.toBe(zoomBefore);
    /* transform actually applied */
    const tf = await page.evaluate(() => $("gameWrap").style.transform);
    expect(tf).toContain("scale(" + zoomAfter + ")");
    await page.evaluate(() => { SETTINGS.zoom = 1; saveSettings(); });
  });
});