/* menu screen regression: no clipped PLAY button when panels expand,
   title spacing, panel auto-collapse, graceful EXIT. */
const { test, expect } = require("@playwright/test");

test.describe("main menu", () => {
  test("PLAY stays on-screen no matter how the panels expand", async ({ page }) => {
    const errs = [];
    page.on("pageerror", e => errs.push(e.message));
    await page.goto("http://localhost:8123/index.html");
    const out = await page.evaluate(() => {
      STATS.runs = 3; resetGame();
      const overlay = document.getElementById("overlay");
      const rect = el => el.getBoundingClientRect();
      const frame = rect(document.getElementById("gameWrap"));
      const visible = el => { const r = rect(el); return r.top >= frame.top - 1 && r.bottom <= frame.bottom + 1; };
      const res = { title: document.querySelector("#overlay h2").textContent };
      // both panels forced open (the old flexbox-centering bug clipped PLAY off-screen)
      document.getElementById("diffPanel").style.display = "flex";
      document.getElementById("modPanel").style.display = "flex";
      const play = [...overlay.querySelectorAll("button.btn")].find(b => b.textContent.includes("PLAY"));
      res.playTop = Math.round(rect(play).top);
      res.playOnScreen = rect(play).top >= 0 && visible(play);
      res.exitReachable = rect([...overlay.querySelectorAll("button.btn")].find(b => b.textContent.includes("EXIT"))).bottom <= window.innerHeight + 200;
      return res;
    });
    expect(out.title).toBe("BLOB KNIGHT");   // the space is back
    expect(out.playOnScreen).toBeTruthy();
    expect(errs).toEqual([]);
  });

  test("panels auto-collapse each other; EXIT leaves via a farewell screen", async ({ page }) => {
    await page.goto("http://localhost:8123/index.html");
    await page.evaluate(() => { STATS.runs = 3; resetGame(); });
    await page.locator(".btn", { hasText: "DIFFICULTY" }).click();
    await page.waitForTimeout(100);
    const diffOpen = await page.evaluate(() => document.getElementById("diffPanel").style.display);
    await page.locator(".btn", { hasText: "MODIFIERS" }).click();
    await page.waitForTimeout(100);
    const state = await page.evaluate(() => ({
      diff: document.getElementById("diffPanel").style.display,
      mod: document.getElementById("modPanel").style.display,
    }));
    expect(diffOpen).toBe("flex");
    expect(state.diff).toBe("none");   // opening MODIFIERS folded DIFFICULTY
    expect(state.mod).toBe("flex");
    // EXIT shows a farewell with a way back
    await page.locator(".btn", { hasText: "EXIT" }).click();
    await expect(page.getByText("FAREWELL, KNIGHT")).toBeVisible();
    await page.locator(".btn", { hasText: "STAY" }).click();
    await expect(page.locator(".btn", { hasText: "PLAY" })).toBeVisible();
  });
});
