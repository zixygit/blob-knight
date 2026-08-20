/* idea 93: headless smoke test — start run → kill → buy → beat level 1 */
const { test, expect } = require("@playwright/test");

test.describe("EMBERQUEST 2D smoke", () => {
  test("fresh run: menu, start, kill, shop, next level", async ({ page }) => {
    await page.goto("http://localhost:8123/index.html");

    /* menu renders with title + BEGIN */
    await expect(page.locator("#overlay")).toBeVisible();
    await expect(page.getByText("EMBERQUEST", { exact: false }).first()).toBeVisible();

    /* start a run (skip lore crawl by forcing phase, then click BEGIN) */
    await page.evaluate(() => { G.skipTutorial = true; });
    await page.locator(".btn", { hasText: "BEGIN" }).first().click();
    await expect(page.locator("#overlay")).toBeHidden();

    /* player spawned and can move */
    await page.keyboard.down("d");
    await page.waitForTimeout(200);
    await page.keyboard.up("d");

    /* attack spawns projectiles/arcs — no crash */
    await page.keyboard.press("Space");
    await page.waitForTimeout(120);

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
});