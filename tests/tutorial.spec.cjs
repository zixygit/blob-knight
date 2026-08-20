const { test, expect } = require("@playwright/test");

test("tutorial completes into level 1", async ({ page }) => {
  page.on("pageerror", e => console.log("PAGEERROR:", e.message));
  await page.goto("http://localhost:8123/index.html");
  await page.evaluate(() => { localStorage.clear(); location.reload(); });
  await page.waitForTimeout(400);

  /* fresh state → PLAY starts the 2-step tutorial */
  await page.evaluate(() => { if (typeof STATS !== "undefined") STATS.runs = 0; });
  await page.locator(".btn", { hasText: "PLAY" }).first().click();
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

  /* dummies dead → real level 1 begins */
  const level = await page.evaluate(() => G.level);
  expect(level).toBe(1);
  const phase = await page.evaluate(() => G.phase);
  expect(phase).toBe("play");
  await expect(page.locator("#tutHint")).toBeHidden();
  console.log("TUTORIAL OK → level", level, "phase", phase);
});