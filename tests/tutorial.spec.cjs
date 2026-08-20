const { test, expect } = require("@playwright/test");

test("tutorial completes into level 1", async ({ page }) => {
  page.on("pageerror", e => console.log("PAGEERROR:", e.message));
  await page.goto("http://localhost:8123/index.html");
  await page.evaluate(() => { G.skipTutorial = false; localStorage.clear(); location.reload(); });
  await page.waitForTimeout(400);

  /* fresh state → BEGIN starts the lore crawl then the tutorial */
  await page.evaluate(() => { if (typeof STATS !== "undefined") STATS.runs = 0; });
  await page.locator(".btn", { hasText: "BEGIN" }).first().click();
  await expect(page.locator("#crawl")).toHaveClass(/show/);
  await page.waitForTimeout(7400);   /* lore crawl plays out */
  await expect(page.locator("#tutHint")).toBeVisible();

  /* step 1: move right */
  await page.keyboard.down("d");
  await page.waitForTimeout(400);
  await page.keyboard.up("d");

  /* step 2: kill the dummies (hurtEnemy directly for determinism) */
  await page.evaluate(() => {
    for (const e of [...game.enemies]) hurtEnemy(e, 999, 1, 0);
  });
  await page.waitForTimeout(300);

  /* step 3: dash */
  await page.keyboard.press("Shift");
  await page.waitForTimeout(300);

  /* step 4: door opens once dummies are dead */
  await page.waitForTimeout(300);
  const doorOpen = await page.evaluate(() => game.G.door.open);
  expect(doorOpen).toBe(true);
  const minions = await page.evaluate(() => game.G.minionsLeft);
  expect(minions).toBe(0);

  /* walk to the door → real level 1 begins */
  await page.keyboard.down("d");
  await page.waitForTimeout(4500);
  await page.keyboard.up("d");
  await page.waitForTimeout(500);
  const level = await page.evaluate(() => G.level);
  expect(level).toBe(1);
  const phase = await page.evaluate(() => G.phase);
  expect(phase).toBe("play");
  console.log("TUTORIAL OK → level", level, "phase", phase);
});
