/* ============================================================
   BLOB KNIGHT — world building: obstacles, hazards, traps,
   destructibles, shrines, minimap (roadmap ideas 39-48)
   ============================================================ */
"use strict";

/* seeded RNG (idea 45) — same seed = same level layout per run */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let worldRng = mulberry32(1);
function wrand(a, b) { return a + worldRng() * (b - a); }
function wrandi(a, b) { return Math.floor(wrand(a, b + 1)); }
function wpick(arr) { return arr[Math.floor(worldRng() * arr.length)]; }

function circleRect(cx, cy, cr, r) {
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
  const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  return Math.hypot(cx - nx, cy - ny) < cr;
}

/* build the obstacles/hazards/traps/crates/shrine for a level */
function buildWorld(n, seed) {
  worldRng = mulberry32(seed || (n * 7919 + 13));
  const ob = [], haz = [], traps = [], crates = [];
  let shrine = null;
  const CX = CFG.W / 2, CY = CFG.H / 2, M = CFG.MARGIN;
  const avoid = (x, y, r) => {
    if (Math.hypot(x - CX, y - CY) < 160) return true;         // player spawn
    if (Math.hypot(x - (CFG.W - 36), y - CY) < 70) return true; // door
    for (const o of ob) if (o.x < x + r && o.x + o.w > x - r && o.y < y + r && o.y + o.h > y - r) return true;
    return false;
  };

  /* idea 39: tile rooms — pillars/walls/cover rects */
  const nOb = n >= 3 ? 4 : 3;
  for (let i = 0; i < nOb; i++) {
    let x, y, w, h, tries = 0;
    do {
      w = wrandi(28, 70); h = wrandi(28, 70);
      x = wrand(M + 20, CFG.W - M - 20 - w);
      y = wrand(M + 20, CFG.H - M - 20 - h);
      tries++;
    } while (avoid(x + w / 2, y + h / 2, 60) && tries < 40);
    ob.push({ x, y, w, h });
  }

  /* idea 41: themed hazard tiles */
  const themes = { 3: "lava", 4: "ice", 5: "void", 6: "void", 7: "lava", 8: "ice", 9: "lava", 10: "void" };
  const theme = themes[n];
  if (theme && n >= 3) {
    const count = n >= 5 ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const w = wrandi(50, 100), h = wrandi(20, 30);
      const x = wrand(M + 20, CFG.W - M - 20 - w);
      const y = wrand(M + 20, CFG.H - M - 20 - h);
      if (!avoid(x + w / 2, y + h / 2, 80)) haz.push({ x, y, w, h, type: theme });
    }
  }

  /* idea 40: destructible barrels/crates */
  const nCr = n >= 3 ? 3 : 2;
  for (let i = 0; i < nCr; i++) {
    let x, y, tries = 0;
    do { x = wrand(M + 30, CFG.W - M - 30); y = wrand(M + 30, CFG.H - M - 30); tries++; }
    while (avoid(x, y, 50) && tries < 30);
    crates.push({ x, y, r: 11, hp: 8, maxHp: 8 });
  }

  /* idea 46: environmental traps — spike traps that retract */
  if (n >= 2) {
    const nTr = n >= 4 ? 3 : 2;
    for (let i = 0; i < nTr; i++) {
      let x, y, tries = 0;
      do { x = wrand(M + 30, CFG.W - M - 30); y = wrand(M + 30, CFG.H - M - 30); tries++; }
      while (avoid(x, y, 70) && tries < 30);
      traps.push({ x, y, r: 16, cycle: wrand(1.5, 3.5), t: wrand(0, 2), active: false });
    }
  }

  /* idea 47: shrines — pay HP for buff / gamble gold */
  if (n === 2 || n === 4) {
    shrine = { x: CFG.W - 90, y: CFG.H - 80, r: 20, used: false };
  }

  return { obstacles: ob, hazards: haz, traps, crates, shrine };
}

/* idea 43: minimap data — normalized positions */
function minimapData(game) {
  const pts = [];
  for (const e of game.enemies) pts.push({ x: e.x, y: e.y, c: e.isBoss ? "#ff5a2a" : e.color });
  for (const l of game.G.loot) pts.push({ x: l.x, y: l.y, c: "#ffd166" });
  const d = game.G.door;
  if (d) pts.push({ x: d.x, y: d.y, c: d.open ? "#6bff9a" : "#3b2f5e" });
  return pts;
}