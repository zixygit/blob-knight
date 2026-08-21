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
  brute: "A moss‑crusted troll. Slow, but every blow lands like a boulder.",
  shooter: "Pines grow where its bolts fall. The forest feeds on the fallen.",
  bomber: "Fungal fury given form. It hugs you with a warm, final embrace.",
  charger: "A skeleton that learned one trick — and mastered it.",
  elite: "An ancient of the woods. Time has only sharpened its hatred.",
  freezer: "Ice crystallizes around its heart. It chills everything it touches.",
  phantom: "Neither here nor there. It blinks through space to stand beside you.",
  summoner: "A bone‑caller who fills the ranks faster than you can thin them.",
  imp: "A fragment of a larger fury. Small, sharp, and utterly spiteful.",
  splitter: "Cut it down and it laughs in two voices.",
  shielder: "Frontal attacks are wasted breath. Find its flank.",
  healer: "It mends what you break. Kill it first.",
  burrower: "The ground remembers its tunnels. So will you.",
  sniper: "Patient. Precise. The laser sight is your only warning.",
  swarm: "One is a pest. A dozen is a verdict.",
  guard: "It patrols a post that no longer matters. Old habits die last.",
  boss: "The lords of this realm. Each holds a fragment of the Sovereign's crown.",
  main_character: "Born as a droplet, fell from a leaf, gained consciousness upon hitting the earth. Awakened to a human pack killing kin, hid while an aggressive slime from the deep forest slew the humans, then realized survival requires devouring what lies beneath. Now wields a human sword and descends ever deeper.",
  spined_goblin: "The most common goblin variant, covered in sharp spines that deter casual attackers. Relentless pursuers driven by simple instinct: follow, strike, repeat. Not particularly intelligent, but their numbers make them dangerous.",
  moss_troll: "A lumbering brute covered in thick moss and crustacean-like growths. Trolls are solitary creatures that claim territory as their own. Move slowly but deliver crushing blows. When wounded, they rage harder. Fire particularly disturbs their mossy hides.",
  pine_thrower: "A forest-defense entity that hurls wooden bolts from hardened pine growths on its limbs. Each bolt that lands sends a pine sapling sprouting where it strikes—nature's retaliation. They keep their distance, raining projectiles while retreating toward denser foliage.",
  bomb_mushroom: "A parasitic fungus that has learned to explode. It seeks warm-blooded targets, hugging them close before detonating. The blast spreads spores that infect the ground, making the area hazardous for seconds after. Not malicious—just driven by its nature to spread spores.",
  skull_charger: "A skeletal entity that haunts the edges of dark forests. It has learned one trick—and mastered it: the charge. It dashes with unerring precision, turning its own momentum into a lethal weapon. The windup before charging is its only tell, and experienced fighters learn to sidestep it.",
  ancient: "An elite guardian that has stood watch over sacred groves for centuries. Time has only sharpened its hatred. Moves with unnatural speed for its size and strikes with arcane precision. Those who wound it find their blows reflected or absorbed into its ancient power.",
  frost_acolyte: "A frosty entity that channels cold from the deep places beneath the world. Its shots don't just hurt—they chill, slowing everything they touch. Stays at the edge of combat, weaving freezing projectiles while other enemies close in. Its presence drops the temperature around it.",
  shade_wraith: "A ghostly entity that exists partially out of phase with reality. Blinks through space without warning, appearing beside unsuspecting prey. Wraiths don't chase—they teleport, striking from unexpected angles. Their presence feels like a draft in a still room.",
  bone_caller: "A summoner of the deep crypts. Fills the ranks faster than any foe can thin them, raising imps from the bones of the fallen. Stays at the back of combat, summoning minions to swarm opponents. The bone caller itself is fragile, but its minions can overwhelm even seasoned adventurers.",
  frost_burrower: "The ground remembers its tunnels, and this entity remembers its burrows. Diggs underground and emerges beneath unsuspecting prey, striking from the earth itself. Its emergence is accompanied by a shockwave that knocks targets off balance. Most dangerous when it has the element of surprise.",
  spectral_sniper: "Patient. Precise. The laser sight is your only warning. Takes careful aim, marking its target before firing a high-velocity shot that pierces through defenses. The sight of the red laser dot creeping across the battlefield is the sniper's signature—and the moment to take cover or dodge.",
  void_swarm: "One is a pest. A dozen is a verdict. A boids-like flock that moves in unison, overwhelming targets with sheer numbers and coordinated strafing. Each individual is small and fragile, but the flock moves as a single entity, circling, compressing, expanding—always shifting, always pressing.",
  crypt_watcher: "It patrols a post that no longer matters. Old habits die last. A stationary sentinel that guards crypt entrances and ancient waypoints. Aggros when players enter its radius, then chases with relentless pursuit. Never forgets a trespasser and will call for reinforcement if provoked.",
  glazed_shielder: "A guardian entity that blocks frontal damage with a glowing barrier. Frontal attacks are wasted breath against it. Must be flanked—attack from the sides or rear where its shield cannot protect it. The glaze on its armor reflects minor projectiles, making direct confrontation risky.",
  court_healer: "A graceful entity that mends what others break. Beams HP to other enemies, turning battles into a war of attrition. The healer itself avoids combat when possible, staying at the back and supporting allies. Kill it first, or its allies will outlast you through constant restoration.",
  imp: "A fragment of a larger fury—small, sharp, and utterly spiteful. Individually weak, but dangerous in numbers. Swarm targets, nipping and biting until the target weakens or flees. The basic infantry of the underworld forces, bred for combat from the moment of their creation.",
  bone_splitter: "A sinister variant of the bone imp. When destroyed, it splits into two smaller imps, each inheriting its hostility. The name comes from the dual voices that can be heard when it splits—two minds becoming one in death. They laugh in two voices because they are two now, sharing a single purpose.",
  main_lore: "The protagonist's journey: born as a droplet falling from a leaf, gained consciousness upon impact, witnessed a human pack kill passive kin while hiding, saw an aggressive deep-forest slime destroy the humans, realized survival requires devouring what lies beneath, grew by consuming, and now wields a human sword as it descends ever deeper into the dark.",
  /* chapter two: the sundered depths */
  acid: "It spits, and where its spit lands, nothing grows for a hundred years. Kill it and it gives the ground one last gift. Keep moving.",
  drone: "A crystal wasp that never lands. It circles, it watches, and the moment you raise a blade toward it, it is simply elsewhere.",
  assassin: "You will not hear it. You will see the dust where it stood, then the red ring where it returns. The ring is a promise — step out of it.",
  gazer: "One enormous eye, lidless and patient. It shows you exactly where its hatred will go — the thin line tracks, the thick line has already decided.",
  berserker: "Every wound is an argument it wins louder. At two-thirds blood it snarls; at one-third it forgets pain entirely. The roar is your opening.",
  hunter: "It does not chase where you are. It stalks where you are about to be. Break stride, double back, refuse it the pattern.",
  commander: "The banner does not fight. The banner makes everything around it braver and faster. Silence the horn first, or face the whole warren at a run.",
  tentacle: "Something vast beneath the rift flexes, and the ground swells in warning. Nine-tenths of the beast is elsewhere; you fight the tenth you can reach.",
  trapper: "Its silk does not bite — it merely holds you, politely, for everyone else. The pale patches on the floor are not decorations.",
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
