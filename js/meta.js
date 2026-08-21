/* ============================================================
   BLOB KNIGHT — meta systems: stats, bestiary, achievements,
   daily challenge, difficulty, New Game+ (ideas 57-64)
   ============================================================ */
"use strict";

const STATS_KEY = "blobknight.stats";
const STATS = loadStats();

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return Object.assign({ runs: 0, deaths: 0, kills: 0, playtime: 0, wins: 0, weaponUses: {}, bestCombo: 0, seenEnemies: {}, unlocked: {} }, JSON.parse(raw));
  } catch (e) { /* ignore */ }
  return { runs: 0, deaths: 0, kills: 0, playtime: 0, wins: 0, weaponUses: {}, bestCombo: 0, seenEnemies: {}, unlocked: {} };
}
function saveStats() {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(STATS)); } catch (e) { /* ignore */ }
}

/* ---------- achievements (idea 64) ---------- */
const ACHIEVEMENTS = [
  { id: "firstblood", name: "FIRST BLOOD", desc: "Slay your first foe", check: () => STATS.kills >= 1 },
  { id: "centurion", name: "CENTURION", desc: "Slay 100 foes", check: () => STATS.kills >= 100 },
  { id: "demonkiller", name: "DRAGON SLAYER", desc: "Defeat Emberfang", check: () => STATS.unlocked["demonkiller"] },
  { id: "conqueror", name: "CONQUEROR", desc: "Complete the game", check: () => STATS.wins >= 1 },
  { id: "ironwill", name: "IRON WILL", desc: "Win without dying once", check: () => STATS.wins >= 1 && STATS.deaths === 0 },
  { id: "wealthy", name: "COFFER KING", desc: "Hold 500 gold at once", check: () => STATS.bestGold >= 500 },
  { id: "combo10", name: "UNSTOPPABLE", desc: "Reach a x10 combo", check: () => STATS.bestCombo >= 10 },
  { id: "candle", name: "CURIOUS", desc: "Find the candle secret", check: () => STATS.unlocked["candle"] },
  { id: "godmode", name: "CHEAT CODE", desc: "Enter the old code", check: () => STATS.unlocked["godmode"] },
  { id: "speedrun", name: "RUSH HOUR", desc: "Finish boss rush", check: () => STATS.unlocked["bossrush"] },
];
function checkAchievements() {
  for (const a of ACHIEVEMENTS) if (!STATS.unlocked[a.id] && a.check()) unlockAchievement(a.id);
}
function unlockAchievement(id) {
  STATS.unlocked[id] = true;
  saveStats();
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (a) {
    flash(`🏆 ACHIEVEMENT: ${a.name}`, "#ffd166");
    SFX.levelup();
  }
  /* idea 96: mirror to Steam when present */
  if (typeof STEAM !== "undefined" && STEAM.available) STEAM.unlock(id.toUpperCase());
}

/* ---------- bestiary (idea 63) ---------- */
const BESTIARY_LORE = {
  chaser: "A spined hunter that knows only pursuit. Its eyes have never blinked.",
  brute: "A moss-crusted troll. Slow, but every blow lands like a boulder.",
  shooter: "Pines grow where its bolts fall. The forest feeds on the fallen.",
  bomber: "Fungal fury given form. It hugs you with a warm, final embrace.",
  charger: "A skeleton that learned one trick — and mastered it.",
  elite: "An ancient of the woods. Time has only sharpened its hatred.",
  freezer: "Ice crystallizes around its heart. It chills everything it touches.",
  phantom: "Neither here nor there. It blinks through space to stand beside you.",
  summoner: "A bone-caller who fills the ranks faster than you can thin them.",
  imp: "A fragment of a larger fury. Small, sharp, and utterly spiteful.",
  splitter: "Cut it down and it laughs in two voices.",
  shielder: "Frontal attacks are wasted breath. Find its flank.",
  healer: "It mends what you break. Kill it first.",
  burrower: "The ground remembers its tunnels. So will you.",
  sniper: "Patient. Precise. The laser sight is your only warning.",
  swarm: "One is a pest. A dozen is a verdict.",
  guard: "It patrols a post that no longer matters. Old habits die last.",
  boss: "The lords of this realm. Each holds a fragment of the Sovereign's crown.",
};
function seeEnemy(kind) {
  if (!kind || STATS.seenEnemies[kind]) return;
  STATS.seenEnemies[kind] = true;
  saveStats();
}

/* ---------- difficulty (idea 59) ---------- */
const DIFFICULTIES = {
  casual: { name: "CASUAL", mult: 0.6, desc: "Enemies deal 40% less damage" },
  normal: { name: "NORMAL", mult: 1.0, desc: "The realm as intended" },
  hard: { name: "HARD", mult: 1.4, desc: "Enemies deal 40% more damage" },
  nightmare: { name: "NIGHTMARE", mult: 1.8, desc: "Enemies deal 80% more, take 25% less" },
  extreme: { name: "EXTREME", mult: 2.2, desc: "Enemies deal 120% more — start with 2 HP" },
  godrun: { name: "GOD RUN", mult: 2.8, desc: "180% more damage — 2 HP forever, potions only" },
};
function applyDifficultyMult(dmg) {
  return Math.round(dmg * (DIFFICULTIES[G.difficulty] || DIFFICULTIES.normal).mult);
}

/* ---------- daily challenge (idea 61) ---------- */
function dailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function startDaily() {
  G.runSeed = dailySeed();
  G.daily = true;
  resetRunStart();
  beginGame();
}

/* ---------- New Game+ (idea 60) ---------- */
function startNewGamePlus() {
  G.ngPlus = true;
  G.runSeed = (G.runSeed || 1) + 999;
  resetRunStart();
  /* keep weapons from the finished run */
  if (game.weapons && game.weapons.length > 1) { game.weapons = game.weapons.slice(); }
  G.maxHp = Math.max(G.maxHp, 100);
  G.hp = G.maxHp;
  G.gold = Math.max(G.gold, 100);
  beginGame();
}

/* ---------- stats screen (idea 62) ---------- */
function showStats() {
  const top = Object.entries(STATS.weaponUses).sort((a, b) => b[1] - a[1])[0];
  showOverlay("📊 STATS", `
    Runs: <b>${STATS.runs}</b> · Wins: <b>${STATS.wins}</b> · Deaths: <b>${STATS.deaths}</b><br>
    Kills: <b>${STATS.kills}</b> · Best combo: <b>x${STATS.bestCombo}</b><br>
    Playtime: <b>${Math.round(STATS.playtime / 60)}m ${Math.round(STATS.playtime % 60)}s</b><br>
    Favorite weapon: <b>${top ? (WEAPONS[top[0]] ? WEAPONS[top[0]].icon + " " + WEAPONS[top[0]].name : top[0]) : "—"} (${top ? top[1] : 0} uses)</b>`, "⬅ BACK", resetGame);
}

function showBestiary() {
  const rows = Object.entries(ENEMY_TYPES).map(([kind, t]) => {
    const seen = !!STATS.seenEnemies[kind];
    return `${seen ? "👁" : "❓"} <b>${t.name || kind.toUpperCase()}</b> — ${seen ? (BESTIARY_LORE[kind] || "A foe of the realm.") : "Not yet encountered."}`;
  }).join("<br>");
  showOverlay("📖 BESTIARY", rows, "⬅ BACK", resetGame);
}

function showAchievements() {
  const rows = ACHIEVEMENTS.map(a => `${STATS.unlocked[a.id] ? "🏆" : "🔒"} <b>${a.name}</b> — ${a.desc}`).join("<br>");
  showOverlay("🏅 ACHIEVEMENTS", rows, "⬅ BACK", resetGame);
}
/* idea 99: opt-in death heatmap telemetry (off by default, stays on-device) */
const TELEMETRY_KEY = "blobknight.telemetry";
let TELEMETRY = loadTelemetry();
function loadTelemetry() {
  try { return JSON.parse(localStorage.getItem(TELEMETRY_KEY)) || { enabled: false, deaths: [] }; }
  catch (e) { return { enabled: false, deaths: [] }; }
}
function setTelemetry(on) {
  TELEMETRY.enabled = on;
  try { localStorage.setItem(TELEMETRY_KEY, JSON.stringify(TELEMETRY)); } catch (e) { /* ignore */ }
  flash(on ? "Telemetry ON — deaths recorded locally" : "Telemetry OFF", "#9a90b8");
}
function recordDeath() {
  if (!TELEMETRY.enabled) return;
  TELEMETRY.deaths.push({
    lv: G.level, boss: !!G.bossSpawned, hp: Math.round(G.hp / G.maxHp * 100),
    atk: G.atk, x: Math.round((game.player ? game.player.x : 0) / 20), y: Math.round((game.player ? game.player.y : 0) / 20),
    t: Date.now(),
  });
  if (TELEMETRY.deaths.length > 500) TELEMETRY.deaths = TELEMETRY.deaths.slice(-500);
  try { localStorage.setItem(TELEMETRY_KEY, JSON.stringify(TELEMETRY)); } catch (e) { /* ignore */ }
}
function showTelemetry() {
  const stats = { perLevel: {}, bossDeaths: 0, lowHp: 0, sample: 0 };
  for (const d of TELEMETRY.deaths) {
    stats.perLevel[d.lv] = (stats.perLevel[d.lv] || 0) + 1;
    if (d.boss) stats.bossDeaths++;
    if (d.hp < 20) stats.lowHp++;
    stats.sample++;
  }
  const rows = Object.entries(stats.perLevel).map(([lv, n]) => `Level <b>${lv}</b>: ${n} deaths`).join("<br>");
  showOverlay("☠️ TELEMETRY", TELEMETRY.enabled
    ? `Recorded: <b>${stats.sample}</b> deaths · Boss deaths: <b>${stats.bossDeaths}</b> · Low-HP (&lt;20%): <b>${stats.lowHp}</b><br>${rows}<br><br><span class="merchant">Stored only on this device. Used to tune difficulty.</span>`
    : "Telemetry is OFF. Opt in to record death heatmap data — stored only on this device, never sent anywhere.",
    TELEMETRY.enabled ? "⛔ TURN OFF" : "✅ OPT IN", () => { setTelemetry(!TELEMETRY.enabled); resetGame(); });
}
