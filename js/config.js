/* ============================================================
   BLOB KNIGHT — config: constants, enemy types, levels, weapons
   ============================================================ */
"use strict";

const CFG = {
  W: 800,
  H: 600,
  MARGIN: 30,
  TITLE: "BLOB KNIGHT", VERSION: "0.06",   // idea 100: version tag
  PLAYER: { r: 14, speed: 170, maxHp: 100, atk: 10, def: 4, potions: 2, potionHeal: 40 },
  SWORD_RANGE: 42,
  SWORD_ARC: 1.1,
  DASH_SPEED: 3.1,   // speed multiplier while dashing
  DASH_TIME: 0.16,   // dash duration = i-frame window
  DASH_CD: 1.6,
};

const MAX_LEVEL = 16;   /* chapter two: the sundered depths (12-16) */

/* ---------- enemy archetypes (stats can be overridden per level) ---------- */
const ENEMY_TYPES = {
  chaser:   { name: "SPINED GOBLIN", r: 13, speed: 90,  color: "#7a9e3d", dmg: [4, 7],   hp: 28, kind: "chaser" },
  brute:    { name: "MOSS TROLL", r: 18, speed: 55,  color: "#4e6b2a", dmg: [6, 10],  hp: 62, kind: "brute" },
  shooter:  { name: "PINE THROWER", r: 12, speed: 72,  color: "#8fb05a", dmg: [3, 6],   hp: 28, kind: "shooter",
              fireCd: 2.2, proj: { speed: 260, r: 5, color: "#c9b458", dmg: [4, 7] } },
  bomber:   { name: "BOMB MUSHROOM", r: 13, speed: 125, color: "#a3c04d", dmg: [9, 14],  hp: 24, kind: "bomber", blastR: 70 },
  charger:  { name: "SKULL CHARGER", r: 14, speed: 80,  color: "#c9d96a", dmg: [7, 11],  hp: 42, kind: "charger",
              chargeSpeed: 430, chargeCd: 2.6, windup: 0.55 },
  elite:    { name: "ANCIENT", r: 19, speed: 60,  color: "#3f6a3f", dmg: [7, 12],  hp: 90, kind: "elite" },
  /* --- frozen spire and beyond --- */
  freezer:  { name: "FROST ACOLYTE", r: 13, speed: 70,  color: "#7fd4e8", dmg: [3, 6],   hp: 30, kind: "freezer",
              fireCd: 2.4, proj: { speed: 240, r: 6, color: "#a8e6f0", dmg: [3, 6], slow: 2.6 } },
  phantom:  { name: "SHADE WRAITH", r: 12, speed: 150, color: "#b06fd4", dmg: [6, 9],   hp: 22, kind: "phantom", teleCd: 3.4 },
  summoner: { name: "BONE CALLER", r: 15, speed: 60,  color: "#8a5fc0", dmg: [4, 7],   hp: 48, kind: "summoner",
              summonCd: 5, summonMax: 3 },
  imp:      { name: "IMP", r: 9,  speed: 140, color: "#d47f4e", dmg: [3, 5],   hp: 12, kind: "chaser" },
  /* --- roadmap batch C: new archetypes --- */
  splitter: { name: "BONE SPLITTER", r: 12, speed: 95,  color: "#8fd4c8", dmg: [4, 7],   hp: 30, kind: "splitter" },
  shielder: { name: "GLAZED SHIELDER", r: 15, speed: 55,  color: "#c8c8e8", dmg: [5, 8],   hp: 70, kind: "shielder", shieldDir: 0, shieldArc: 1.2 },
  healer:   { name: "COURT HEALER", r: 13, speed: 60,  color: "#6bff9a", dmg: [3, 5],   hp: 40, kind: "healer", healCd: 4, healAmt: 14, healR: 130 },
  burrower: { name: "FROST BURROWER", r: 13, speed: 110, color: "#9a7a5a", dmg: [6, 10],  hp: 34, kind: "burrower",
              burrowCd: 3.2, emergeR: 46 },
  sniper:   { name: "SPECTRAL SNIPER", r: 11, speed: 60,  color: "#ff8b3d", dmg: [9, 14],  hp: 26, kind: "sniper",
              fireCd: 3.0, proj: { speed: 620, r: 6, color: "#ff5a2a", dmg: [9, 14] }, aimT: 0.5 },
  swarm:    { name: "VOID SWARM", r: 7,  speed: 150, color: "#e8d17a", dmg: [3, 5],   hp: 8,  kind: "swarm" },
  guard:    { name: "CRYPT WATCHER", r: 15, speed: 55,  color: "#7a8aa8", dmg: [5, 8],   hp: 55, kind: "guard",
              patrolA: 60, patrolB: 200, aggro: 200 },
  /* --- chapter two: the sundered depths — new archetypes --- */
  acid:     { name: "FEN SPITTER", r: 13, speed: 70,  color: "#8fc04d", dmg: [4, 7],  hp: 34, kind: "acid",
              fireCd: 3.2, proj: { speed: 210, r: 7, color: "#a8e05a", dmg: [4, 7],
              pool: { r: 42, life: 3, dps: 8, color: "#8fc04d" } } },
  drone:    { name: "GLASS HORNET", r: 10, speed: 135, color: "#c8e8f0", dmg: [3, 5],  hp: 20, kind: "drone",
              fireCd: 2.9, proj: { speed: 300, r: 4, color: "#a8d8e8", dmg: [5, 8] } },
  assassin: { name: "DUSK STALKER", r: 12, speed: 165, color: "#6a5a9a", dmg: [8, 13], hp: 26, kind: "assassin", teleCd: 5 },
  gazer:    { name: "RIFT EYE", r: 14, speed: 40,  color: "#d4a8ff", dmg: [8, 12], hp: 44, kind: "gazer",
              gazeCd: 4.5, gazeRange: 340 },
  berserker:{ name: "MAW BRUTE", r: 16, speed: 62,  color: "#b83a3a", dmg: [7, 11], hp: 80, kind: "berserker" },
  hunter:   { name: "PREY SEEKER", r: 13, speed: 125, color: "#e8a83d", dmg: [9, 14], hp: 38, kind: "hunter", huntCd: 3.6 },
  commander:{ name: "BANNER WARDEN", r: 16, speed: 55, color: "#c8a44a", dmg: [6, 10], hp: 95, kind: "commander", rallyCd: 7 },
  tentacle: { name: "RIFT TENDRIL", r: 18, speed: 0,  color: "#8a6fd4", dmg: [10, 15], hp: 120, kind: "tentacle", slamCd: 3.8 },
  trapper:  { name: "SILK WEAVER", r: 12, speed: 80,  color: "#d8d8e8", dmg: [3, 6],  hp: 30, kind: "trapper",
              fireCd: 3.5, proj: { speed: 260, r: 6, color: "#e8e8f8", dmg: [3, 6],
              pool: { r: 46, life: 4, dps: 0, web: true, color: "#c8c8d8" } } },
};

/* ---------- level layouts ---------- */
const LEVELS = {
  1: {
    name: "FOREST OF FANGMOOR",
    bg: "#1d2f1d", wall: "#2f462f",
    minions: [
      { name: "SPINED GOBLIN",  type: "chaser",  count: 2 },
      { name: "PINE THROWER",   type: "shooter", count: 1 },
      { name: "BOMB MUSHROOM",  type: "bomber",  count: 1 },
      { name: "MOSS TROLL",     type: "brute",   count: 1 },
    ],
    boss: {
      name: "GOBLIN CHIEFTAIN", kind: "boss", isBoss: true,
      hp: 70, r: 21, speed: 85, color: "#c2553d", dmg: [6, 10],
      volley: { count: 3, spread: 0.45, speed: 280, dmg: [5, 8], color: "#e8a83d" },
      radial: null,
      summon: { type: "swarm", name: "GOBLIN SWARM", count: 2, cd: 10 },   // mech: swarm lord
      volleyCd: 2.6, radialCd: 0, enrageAt: 0.5,
    },
    bossReward: 60,
  },
  2: {
    name: "THE HOLLOW DEPTHS",
    bg: "#1a1f2e", wall: "#2e3a52",
    minions: [
      { name: "RATTLEBONE",    type: "chaser",  count: 2 },
      { name: "CRYPT FIEND",   type: "shooter", count: 1, proj: { speed: 300, r: 6, color: "#b8c4d8", dmg: [5, 8] } },
      { name: "SKULL CHARGER", type: "charger", count: 1 },
      { name: "CRYPT WATCHER", type: "guard",   count: 1 },
      { name: "BONE SPLITTER", type: "splitter", count: 1 },
      { name: "BONE GOLIATH",  type: "elite",   count: 1 },
    ],
    boss: {
      name: "BONE WARDEN", kind: "boss", isBoss: true,
      hp: 135, r: 23, speed: 75, color: "#c8c0d8", dmg: [8, 13],
      volley: { count: 3, spread: 0.5, speed: 320, dmg: [7, 10], color: "#b8c4d8" },
      radial: { count: 10, speed: 230, dmg: [6, 9], color: "#9a90b8" },
      mech: "shield", mechCd: 7, mechDur: 2.5,                     // mech: guards in windows
      volleyCd: 2.3, radialCd: 3.6, enrageAt: 0.5,
    },
    bossReward: 110,
  },
  3: {
    name: "THE DRAGON'S LAIR",
    bg: "#2a1616", wall: "#4a2626",
    minions: [
      { name: "EMBER WHELP",    type: "chaser",  count: 2 },
      { name: "FLAME HUSK",     type: "shooter", count: 2, proj: { speed: 340, r: 7, color: "#ff8b3d", dmg: [7, 10] } },
      { name: "MAGMA BOMB",     type: "bomber",  count: 1 },
      { name: "ASH SWARM",      type: "swarm",   count: 2 },
      { name: "INFERNAL BRUTE", type: "elite",   count: 1 },
    ],
    boss: {
      name: "EMBERFANG, THE DRAGON", kind: "boss", isBoss: true,
      hp: 320, r: 34, speed: 100, color: "#ff5a2a", dmg: [12, 18],
      volley: { count: 4, spread: 0.5, speed: 360, dmg: [10, 14], color: "#ff8b3d", burn: true },   // mech: volley ignites the ground
      radial: { count: 14, speed: 260, dmg: [8, 12], color: "#ffb45e" },
      volleyCd: 2.0, radialCd: 3.0, enrageAt: 0.5,
    },
    bossReward: 250,
  },
  4: {
    name: "THE FROZEN SPIRE",
    bg: "#14212c", wall: "#2e4a5e",
    minions: [
      { name: "ICE GOBLIN",      type: "chaser",  count: 2 },
      { name: "FROST ACOLYTE",   type: "freezer", count: 2 },
      { name: "GLAZED SHIELDER", type: "shielder", count: 1 },
      { name: "FROST BURROWER",  type: "burrower", count: 1 },
      { name: "AVALANCHE BRUTE", type: "charger", count: 1 },
      { name: "GLACIER TROLL",   type: "brute",   count: 1 },
    ],
    boss: {
      name: "KARVATH, FROST MONARCH", kind: "boss", isBoss: true,
      hp: 230, r: 26, speed: 80, color: "#5ab8d4", dmg: [9, 14],
      volley: { count: 5, spread: 0.4, speed: 300, dmg: [7, 10], color: "#a8e6f0", slow: 2.2 },
      radial: { count: 12, speed: 220, dmg: [7, 10], color: "#7fd4e8" },
      summon: { type: "imp", name: "ICE SPARK", count: 2, cd: 7 },
      mech: "blink", mechCd: 6,                                     // mech: teleports beside you
      volleyCd: 2.4, radialCd: 3.8, enrageAt: 0.5, enrage2At: 0.22,
    },
    bossReward: 180,
  },
  5: {
    name: "THE HOLLOW COURT",
    bg: "#1d1526", wall: "#3d2a52",
    minions: [
      { name: "SHADE WRAITH", type: "phantom",  count: 2 },
      { name: "BONE CALLER",  type: "summoner", count: 1 },
      { name: "CRYPT FIEND",  type: "shooter",  count: 1, proj: { speed: 300, r: 6, color: "#b8c4d8", dmg: [5, 8] } },
      { name: "COURT HEALER", type: "healer",   count: 1 },
      { name: "SPECTRAL SNIPER", type: "sniper", count: 1 },
      { name: "GRAVE KNIGHT", type: "elite",    count: 1 },
    ],
    boss: {
      name: "THE HOLLOW KING", kind: "boss", isBoss: true,
      hp: 330, r: 28, speed: 78, color: "#9a86c8", dmg: [10, 15],
      volley: { count: 4, spread: 0.45, speed: 330, dmg: [8, 12], color: "#b8a8e8" },
      radial: { count: 14, speed: 240, dmg: [7, 11], color: "#8a76b8" },
      summon: { type: "phantom", name: "COURT WRAITH", count: 2, cd: 7 },  // mech: spirit court
      spiral: { count: 3, step: 0.22, twist: 0.75, speed: 190, dmg: [6, 9], color: "#c0a8f0" },
      laser: { speed: 420, dmg: [10, 14], color: "#c0a8f0", sweep: 2.4, cd: 6 },        // idea 34
      volleyCd: 2.2, radialCd: 3.6, enrageAt: 0.55, enrage2At: 0.25,
    },
    bossReward: 240,
  },
  6: {
    name: "THE VOID THRONE",
    bg: "#0e0e1a", wall: "#2a2a4e",
    minions: [
      { name: "VOID SPARK",    type: "freezer",  count: 1 },
      { name: "NULL WRAITH",   type: "phantom",  count: 2 },
      { name: "VOID WEAVER",   type: "summoner", count: 1 },
      { name: "VOID SEED",     type: "bomber",   count: 2 },
      { name: "VOID MARKSMAN", type: "sniper",   count: 1 },
      { name: "VOID SWARM",    type: "swarm",    count: 3 },
      { name: "VOID SENTINEL", type: "elite",    count: 1 },
    ],
    boss: {
      name: "THE VOID SOVEREIGN", kind: "boss", isBoss: true,
      hp: 520, r: 36, speed: 95, color: "#7a4ae8", dmg: [13, 19],
      volley: { count: 5, spread: 0.5, speed: 360, dmg: [10, 14], color: "#a88cff" },
      radial: { count: 18, speed: 250, dmg: [8, 12], color: "#c0a8f0" },
      summon: { type: "imp", name: "VOID MOTE", count: 3, cd: 8 },
      spiral: { count: 4, step: 0.2, twist: 0.55, speed: 210, dmg: [7, 10], color: "#8a76d8" },
      laser: { speed: 460, dmg: [12, 16], color: "#a88cff", sweep: 2.8, cd: 7 },        // idea 34
      aoe: { radius: 90, count: 3, dmg: [9, 13], delay: 1.1, color: "#c0a8f0", cd: 8 },  // idea 34
      despair: { count: 26, speed: 300, dmg: [10, 14], color: "#ff2a6a" },              // idea 35: desperation
      mech: "pull",                                                               // mech: gravity well at berserk
      volleyCd: 2.1, radialCd: 3.2, enrageAt: 0.6, enrage2At: 0.28, despairAt: 0.05,
    },
    bossReward: 400,
  },
  7: {
    name: "THE ASHEN FIELDS",
    bg: "#241a10", wall: "#4a3620",
    minions: [
      { name: "EMBER WHELP",    type: "chaser",  count: 3 },
      { name: "FLAME HUSK",     type: "shooter", count: 2, proj: { speed: 340, r: 7, color: "#ff8b3d", dmg: [7, 10] } },
      { name: "MAGMA BOMB",     type: "bomber",  count: 2 },
      { name: "ASH SWARM",      type: "swarm",   count: 3 },
      { name: "INFERNAL BRUTE", type: "elite",   count: 1 },
    ],
    boss: {
      name: "KAELTHAR, ASH WARDEN", kind: "boss", isBoss: true,
      hp: 430, r: 30, speed: 90, color: "#ff8b3d", dmg: [11, 16],
      volley: { count: 5, spread: 0.5, speed: 340, dmg: [9, 13], color: "#ffb45e" },
      radial: { count: 16, speed: 250, dmg: [8, 12], color: "#ff8b3d" },
      summon: { type: "imp", name: "ASH MOTE", count: 2, cd: 8 },
      spiral: { count: 3, step: 0.22, twist: 0.6, speed: 210, dmg: [7, 10], color: "#ffb45e" },
      laser: { speed: 440, dmg: [11, 15], color: "#ff8b3d", sweep: 2.5, cd: 6.5 },
      mech: "tremor", mechCd: 6, mechCount: 3, mechR: 230,               // mech: ground-shaking rings
      volleyCd: 2.2, radialCd: 3.4, enrageAt: 0.55, enrage2At: 0.25,
    },
    bossReward: 320,
  },
  8: {
    name: "THE SUNKEN ARCHIVES",
    bg: "#0e1a22", wall: "#22404f",
    minions: [
      { name: "ICE GOBLIN",     type: "chaser",   count: 2 },
      { name: "CRYPT FIEND",    type: "shooter",  count: 2, proj: { speed: 300, r: 6, color: "#b8c4d8", dmg: [5, 8] } },
      { name: "BONE CALLER",    type: "summoner", count: 1 },
      { name: "COURT HEALER",   type: "healer",   count: 1 },
      { name: "SPECTRAL SNIPER", type: "sniper",  count: 1 },
      { name: "SKULL CHARGER",  type: "charger",  count: 1 },
      { name: "BONE GOLIATH",   type: "elite",    count: 1 },
      { name: "TIDE SPITTER",   type: "acid",     count: 1 },   /* chapter two preview */
      { name: "REEF WEAVER",    type: "trapper",  count: 1 },
    ],
    boss: {
      name: "LURIAN, THE ARCHIVIST", kind: "boss", isBoss: true,
      hp: 480, r: 32, speed: 85, color: "#5ab8d4", dmg: [10, 15],
      volley: { count: 5, spread: 0.45, speed: 350, dmg: [10, 14], color: "#a8e6f0", slow: 2.0 },
      radial: { count: 16, speed: 240, dmg: [8, 12], color: "#7fd4e8" },
      summon: { type: "phantom", name: "ARCHIVE WRAITH", count: 2, cd: 8 },
      aoe: { radius: 80, count: 3, dmg: [9, 13], delay: 1.0, color: "#7fd4e8", cd: 8 },
      mech: "tide", mechCd: 7, mechCount: 4, mechR: 250,                 // mech: chilling tide surge
      volleyCd: 2.1, radialCd: 3.3, enrageAt: 0.55, enrage2At: 0.26,
    },
    bossReward: 360,
  },
  9: {
    name: "THE CRIMSON PEAKS",
    bg: "#2a0e0e", wall: "#4a1a1a",
    minions: [
      { name: "EMBER WHELP",    type: "chaser",  count: 2 },
      { name: "FLAME HUSK",     type: "shooter", count: 3, proj: { speed: 340, r: 7, color: "#ff8b3d", dmg: [7, 10] } },
      { name: "MAGMA BOMB",     type: "bomber",  count: 2 },
      { name: "ASH SWARM",      type: "swarm",   count: 3 },
      { name: "AVALANCHE BRUTE", type: "charger", count: 2 },
      { name: "INFERNAL BRUTE", type: "elite",   count: 2 },
      { name: "CINDER MAW",     type: "berserker", count: 1 },  /* chapter two preview */
    ],
    boss: {
      name: "VOLKRATH, CRIMSON TITAN", kind: "boss", isBoss: true,
      hp: 560, r: 36, speed: 90, color: "#ff5a2a", dmg: [13, 19],
      volley: { count: 6, spread: 0.5, speed: 370, dmg: [11, 15], color: "#ff8b3d" },
      radial: { count: 18, speed: 260, dmg: [9, 13], color: "#ffb45e" },
      summon: { type: "imp", name: "CINDER MOTE", count: 3, cd: 7 },
      spiral: { count: 4, step: 0.2, twist: 0.6, speed: 230, dmg: [8, 12], color: "#ff8b3d" },
      laser: { speed: 470, dmg: [13, 17], color: "#ff5a2a", sweep: 2.8, cd: 6 },
      despair: { count: 28, speed: 310, dmg: [11, 15], color: "#ff2a6a" },
      mech: "charge", mechCd: 5, mechSpeed: 620,                        // mech: telegraphed dash
      volleyCd: 1.9, radialCd: 3.0, enrageAt: 0.6, enrage2At: 0.28, despairAt: 0.08,
    },
    bossReward: 450,
  },
  10: {
    name: "THE WORLD'S END",
    bg: "#0a0a12", wall: "#26263e",
    minions: [
      { name: "NULL WRAITH",    type: "phantom",  count: 3 },
      { name: "VOID WEAVER",    type: "summoner", count: 2 },
      { name: "VOID SEED",      type: "bomber",   count: 2 },
      { name: "VOID MARKSMAN",  type: "sniper",   count: 2 },
      { name: "VOID SWARM",     type: "swarm",    count: 3 },
      { name: "VOID SENTINEL",  type: "elite",    count: 2 },
      { name: "BONE CALLER",    type: "summoner", count: 1 },
      { name: "VOID HORNET",    type: "drone",    count: 1 },  /* chapter two preview */
      { name: "NULL SEEKER",    type: "hunter",   count: 1 },
    ],
    boss: {
      name: "THARAN, THE WORLD-ENDER", kind: "boss", isBoss: true,
      hp: 700, r: 38, speed: 100, color: "#c2553d", dmg: [14, 20],
      volley: { count: 6, spread: 0.5, speed: 380, dmg: [12, 16], color: "#a88cff" },
      radial: { count: 20, speed: 270, dmg: [10, 14], color: "#c0a8f0" },
      summon: { type: "imp", name: "END MOTE", count: 4, cd: 7 },
      spiral: { count: 5, step: 0.2, twist: 0.6, speed: 240, dmg: [9, 13], color: "#a88cff" },
      laser: { speed: 500, dmg: [14, 18], color: "#c2553d", sweep: 3.0, cd: 6 },
      aoe: { radius: 100, count: 4, dmg: [11, 15], delay: 1.0, color: "#c2553d", cd: 7 },
      despair: { count: 32, speed: 320, dmg: [12, 16], color: "#ff2a6a" },
      mech: ["pull", "tremor"], mechCd: 6, mechCount: 3, mechR: 240,   // mech: world-ending combo
      volleyCd: 1.8, radialCd: 2.8, enrageAt: 0.6, enrage2At: 0.3, despairAt: 0.1,
    },
    bossReward: 550,
  },
  /* idea 88: secret level — post-credits, after a New Game+ victory */
  11: {
    name: "THE HOLLOW THRONE",
    bg: "#07060e", wall: "#1c1a34",
    minions: [
      { name: "HOLLOW SPARK",   type: "freezer",  count: 2 },
      { name: "NULL WRAITH",    type: "phantom",  count: 3 },
      { name: "HOLLOW WEAVER",  type: "summoner", count: 2 },
      { name: "HOLLOW SEED",    type: "bomber",   count: 2 },
      { name: "HOLLOW MARKSMAN", type: "sniper",  count: 2 },
      { name: "HOLLOW SWARM",   type: "swarm",    count: 4 },
      { name: "HOLLOW SENTINEL", type: "elite",   count: 2 },
      { name: "HOLLOW TENDRIL", type: "tentacle", count: 1 },   /* chapter two preview */
      { name: "HOLLOW EYE",     type: "gazer",    count: 1 },
      { name: "HOLLOW BLADE",   type: "assassin", count: 1 },
    ],
    boss: {
      name: "THE HOLLOW KING, ECHO OF THE SOVEREIGN", kind: "boss", isBoss: true,
      hp: 680, r: 38, speed: 105, color: "#4ae8c8", dmg: [15, 22],
      volley: { count: 6, spread: 0.5, speed: 400, dmg: [12, 16], color: "#4ae8c8" },
      radial: { count: 22, speed: 280, dmg: [10, 14], color: "#6fffc9" },
      summon: { type: "imp", name: "HOLLOW MOTE", count: 4, cd: 7 },
      spiral: { count: 5, step: 0.2, twist: 0.6, speed: 240, dmg: [9, 13], color: "#6fffc9" },
      laser: { speed: 500, dmg: [14, 18], color: "#4ae8c8", sweep: 3.0, cd: 6 },
      aoe: { radius: 100, count: 4, dmg: [11, 15], delay: 1.0, color: "#6fffc9", cd: 7 },
      despair: { count: 32, speed: 320, dmg: [12, 16], color: "#ff2a6a" },
      mech: "blink", mechCd: 5,                                       // mech: echoes dart across the dark
      volleyCd: 1.9, radialCd: 2.9, enrageAt: 0.6, enrage2At: 0.28, despairAt: 0.05,
    },
    bossReward: 600,
  },

  /* ============================================================
     CHAPTER TWO — THE SUNDERED DEPTHS (12-16)
     12 teaches the new mechanics, 13-15 combine them under pressure,
     16 is the mastery test. Boss kits are phase-gated (`from: 2/3`),
     so each fight escalates instead of just speeding up.
     ============================================================ */
  12: {
    name: "THE MAW GATE",
    bg: "#16241a", wall: "#2e4a34",
    /* teaches: acid pools deny ground, drones punish standing still,
       webs slow you into both — keep moving, watch the floor */
    minions: [
      { name: "FEN LURKER",   type: "chaser",  count: 2 },
      { name: "FEN SPITTER",  type: "acid",    count: 2 },
      { name: "GLASS HORNET", type: "drone",   count: 2 },
      { name: "SILK WEAVER",  type: "trapper", count: 1 },
      { name: "FEN BRUTE",    type: "brute",   count: 1, elite: "FRANTIC" },   /* mini-boss */
    ],
    boss: {
      name: "SPLINTERMAW, THE FEN TYRANT", kind: "boss", isBoss: true,
      hp: 600, r: 34, speed: 82, color: "#5a8a3d", dmg: [11, 16],
      volley: { count: 3, spread: 0.5, speed: 230, dmg: [8, 12], color: "#a8e05a", pool: { r: 46, life: 3, dps: 9, color: "#8fc04d" } },
      radial: { count: 12, speed: 220, dmg: [7, 10], color: "#8fc04d", from: 2 },
      summon: { type: "drone", name: "SPRITE HORNET", count: 2, cd: 9, from: 2 },
      aoe: { radius: 84, count: 3, dmg: [9, 13], delay: 1.0, color: "#a8e05a", cd: 8, from: 3 },
      mech: "charge", mechCd: 5.5, mechSpeed: 540,                    /* mech: devouring lunge through the muck */
      volleyCd: 2.4, radialCd: 3.6, enrageAt: 0.6, enrage2At: 0.3,
    },
    bossReward: 480,
  },
  13: {
    name: "THE GLASS COURT",
    bg: "#181426", wall: "#3a2f56",
    /* combines: the healer sustains the shielder wall while stalkers
       blink in — decide fast who dies first */
    minions: [
      { name: "DUSK STALKER",   type: "assassin", count: 1 },
      { name: "GLAZED SHIELDER", type: "shielder", count: 1 },
      { name: "COURT HEALER",   type: "healer",   count: 1 },
      { name: "RIFT EYE",       type: "gazer",    count: 1 },
      { name: "COURT WRAITH",   type: "phantom",  count: 1 },
      { name: "THE FIRST BLADE", type: "assassin", count: 1, elite: "FLEETING" },   /* mini-boss */
    ],
    boss: {
      name: "VESPERA, THE GLASS QUEEN", kind: "boss", isBoss: true,
      hp: 640, r: 30, speed: 88, color: "#b8a8e8", dmg: [10, 15],
      volley: { count: 4, spread: 0.45, speed: 320, dmg: [8, 12], color: "#d8ccf8", bounce: 2 },
      radial: { count: 8, speed: 260, dmg: [7, 11], color: "#c0a8f0", bounce: 1, from: 2 },
      summon: { type: "assassin", name: "GLASS DANCER", count: 1, cd: 14, from: 2 },
      spiral: { count: 3, step: 0.22, twist: 0.65, speed: 200, dmg: [6, 10], color: "#d8ccf8", from: 3 },
      despair: { count: 22, speed: 300, dmg: [10, 14], color: "#ff2a6a" },
      mech: ["blink", "clones"], mechCd: 6,                         /* mech: warps + mirror echoes */
      volleyCd: 2.3, radialCd: 3.8, enrageAt: 0.62, enrage2At: 0.28, despairAt: 0.05,
    },
    bossReward: 520,
  },
  14: {
    name: "THE THUNDER ROOST",
    bg: "#141a24", wall: "#2e3a54",
    /* pressure: hunters lead your movement while harriers orbit —
       dodge sideways, never straight; the berserker punishes hesitation */
    waves: [
      [ { name: "STORM HARRIER",   type: "drone",   count: 2 },
        { name: "PREY SEEKER",     type: "hunter",  count: 1 },
        { name: "GALE SWARM",      type: "swarm",   count: 2 } ],
      [ { name: "GALE SEEKER",     type: "hunter",  count: 1, elite: "FRANTIC" },   /* mini-boss */
        { name: "MAW BRUTE",       type: "berserker", count: 1 },
        { name: "SPECTRAL SNIPER", type: "sniper",  count: 1 } ],
    ],
    boss: {
      name: "THANE VOLDRIC, THE STORM HUNTER", kind: "boss", isBoss: true,
      hp: 700, r: 32, speed: 92, color: "#6a8ae8", dmg: [11, 17],
      volley: { count: 3, spread: 0.4, speed: 340, dmg: [9, 13], color: "#a8c8ff", lead: true },
      radial: { count: 14, speed: 250, dmg: [8, 12], color: "#8ab8ff", from: 2 },
      summon: { type: "drone", name: "TEMPEST HARRIER", count: 2, cd: 10, from: 2 },
      laser: { speed: 430, dmg: [11, 15], color: "#a8c8ff", sweep: 2.2, cd: 7, from: 2 },
      spiral: { count: 4, step: 0.2, twist: 0.55, speed: 220, dmg: [7, 11], color: "#a8c8ff", from: 3 },
      despair: { count: 26, speed: 310, dmg: [11, 15], color: "#ff2a6a" },
      mech: ["lightning", "charge"], mechCd: 5, mechSpeed: 600,      /* mech: sky strikes + harpoon dash */
      volleyCd: 2.2, radialCd: 3.4, enrageAt: 0.6, enrage2At: 0.28, despairAt: 0.06,
    },
    bossReward: 560,
  },
  15: {
    name: "THE IRON WARREN",
    bg: "#241d12", wall: "#4a3a20",
    /* army fight: three waves — the banner warden's rally turns every
       remaining foe into a charge; kill the banner, break the army */
    waves: [
      [ { name: "IRON LEGIONARY", type: "guard",   count: 2 },
        { name: "FORGE TROLL",    type: "brute",   count: 1 },
        { name: "EMBER TICK",     type: "bomber",  count: 1 } ],
      [ { name: "BANNER SERGEANT", type: "commander", count: 1 },
        { name: "GLAZED SHIELDER", type: "shielder", count: 1 },
        { name: "IRON CROSSBOW",  type: "shooter", count: 2, proj: { speed: 320, r: 5, color: "#ffb45e", dmg: [6, 9] } } ],
      [ { name: "FORGE TROLL",    type: "brute",   count: 2, elite: "WARDING" },   /* mini-boss pair */
        { name: "SILK WEAVER",    type: "trapper", count: 1 },
        { name: "EMBER TICK",     type: "bomber",  count: 2 } ],
    ],
    boss: {
      name: "FORGEMASTER ORUN, HERALD OF LEGIONS", kind: "boss", isBoss: true,
      hp: 780, r: 34, speed: 78, color: "#d4883d", dmg: [12, 18],
      volley: { count: 4, spread: 0.5, speed: 300, dmg: [9, 13], color: "#ffb45e" },
      radial: { count: 16, speed: 240, dmg: [8, 12], color: "#ff8b3d", from: 2 },
      summon: { type: "guard", name: "IRON LEGIONARY", count: 3, cd: 8, from: 2 },
      aoe: { radius: 90, count: 3, dmg: [10, 14], delay: 1.1, color: "#ffb45e", cd: 7, from: 2 },
      spiral: { count: 4, step: 0.2, twist: 0.6, speed: 220, dmg: [8, 12], color: "#ff8b3d", from: 3 },
      despair: { count: 28, speed: 300, dmg: [12, 16], color: "#ff2a6a" },
      mech: ["vents", "shield"], mechCd: 6.5, mechDur: 2.0,          /* mech: forge vents + guard windows */
      volleyCd: 2.2, radialCd: 3.4, enrageAt: 0.6, enrage2At: 0.28, despairAt: 0.06,
    },
    bossReward: 620,
  },
  16: {
    name: "THE ABYSSAL SEAT",
    bg: "#0a0a14", wall: "#26264a",
    /* mastery: tendrils and pools carve up the arena, the banner warden
       rallies, hunters and stalkers dive — every lesson at once */
    waves: [
      [ { name: "RIFT TENDRIL",  type: "tentacle", count: 2 },
        { name: "RIFT EYE",      type: "gazer",    count: 2 },
        { name: "FEN SPITTER",   type: "acid",     count: 2 },
        { name: "ABYSS WRAITH",  type: "phantom",  count: 2 } ],
      [ { name: "DUSK STALKER",   type: "assassin", count: 2 },
        { name: "PREY SEEKER",    type: "hunter",   count: 2 },
        { name: "BANNER WARDEN",  type: "commander", count: 1, elite: "WARDING" },   /* mini-boss */
        { name: "VOID SWARM",     type: "swarm",    count: 3 } ],
    ],
    boss: {
      name: "AZHAROTH, HEART OF THE EMBERFALL", kind: "boss", isBoss: true,
      hp: 900, r: 40, speed: 95, color: "#ff6a3d", dmg: [14, 20],
      volley: { count: 5, spread: 0.45, speed: 360, dmg: [10, 14], color: "#ff8b3d", burn: true },
      radial: { count: 18, speed: 260, dmg: [9, 13], color: "#ffb45e" },
      summon: { type: "imp", name: "EMBER MOTE", count: 3, cd: 8, from: 2 },
      spiral: { count: 5, step: 0.2, twist: 0.55, speed: 240, dmg: [8, 12], color: "#ff8b3d", from: 2 },
      laser: { speed: 480, dmg: [13, 17], color: "#ff5a2a", sweep: 2.8, cd: 6, from: 2 },
      aoe: { radius: 100, count: 4, dmg: [11, 15], delay: 0.9, color: "#ff8b3d", cd: 6, from: 3 },
      despair: { count: 32, speed: 320, dmg: [12, 16], color: "#ff2a6a" },
      mech: ["pull", "lightning", "emberfall"], mechCd: 5.5,        /* mech: gravity + sky strikes + ember rain */
      volleyCd: 2.0, radialCd: 2.9, enrageAt: 0.62, enrage2At: 0.26, despairAt: 0.06,
    },
    bossReward: 700,
  },
};

/* ---------- weapon catalog ---------- */
const WEAPONS = {
  sword:    { name: "SWORD",       icon: "⚔️", cd: 0.45, cost: 0,   desc: "Arc slash" },
  wave:     { name: "WAVE BLADE",  icon: "🌊", cd: 1.30, cost: 150, desc: "Shockwave burst" },
  crossbow: { name: "CROSSBOW",    icon: "🏹", cd: 0.28, cost: 200, desc: "Fast bolts" },
  staff:    { name: "EMBER STAFF", icon: "🔥", cd: 0.9,  cost: 300, desc: "Explosive fireball" },
  spear:    { name: "SPEAR",       icon: "🔱", cd: 0.7,  cost: 220, desc: "Long lunge + pierce" },
  boomerang:{ name: "BOOMERANG",   icon: "🪃", cd: 0.9,  cost: 260, desc: "Returns, hits twice" },
  orbs:     { name: "ORBIT ORBS",  icon: "🪐", cd: 0.1,  cost: 280, desc: "Orbiting shards" },
  chain:    { name: "CHAIN LIGHTNING", icon: "⚡", cd: 1.1, cost: 350, desc: "Arc to 3 foes" },
};

/* idea 51: elemental damage + zone weaknesses */
const ELEMENT_WEAKNESS = { 1: null, 2: "ice", 3: "ice", 4: "fire", 5: "lightning", 6: "lightning", 7: "fire", 8: "ice", 9: "lightning", 10: "fire",
                           11: null, 12: "fire", 13: "lightning", 14: "ice", 15: "ice", 16: "fire" };
const ELEMENTS = { fire: "#ff8b3d", ice: "#7fd4e8", lightning: "#ffd166" };

/* idea 52: throwable bombs as consumable */
const BOMB = { cost: 60, dmg: [18, 26], r: 90, fuse: 1.2 };

/* idea 53: deployables from the shop */
const DEPLOYABLES = [
  { name: "TURRET", cost: 140, desc: "Fires at foes for 8s", icon: "🤖" },
  { name: "BEAR TRAP", cost: 90, desc: "Holds foes in place", icon: "🪤" },
];

/* idea 54: cursed items — strong with a downside */
const CURSED_ITEMS = [
  { name: "DRAINBLADE", desc: "+8 ATK but -20 max HP", apply: () => { G.atk += 8; G.maxHp = Math.max(30, G.maxHp - 20); G.hp = Math.min(G.hp, G.maxHp); } },
  { name: "VELOCITY RUNE", desc: "+25% speed but -15% crit", apply: () => { CFG.PLAYER.speed *= 1.25; G.crit = Math.max(0, G.crit - 0.15); } },
  { name: "GREED SPIRE", desc: "+50% gold but take +20% damage", apply: () => { G.goldMult *= 1.5; G.dmgTakenMult = (G.dmgTakenMult || 1) * 1.2; } },
];

/* idea 55: item set bonuses — owning matching items grants a bonus */
const ITEM_SETS = [
  { id: "ember", items: ["staff", "charm"], bonus: "+15% crit when holding Ember Staff + charm" },
  { id: "frost", items: ["wave", "rune"], bonus: "+2 DEF when holding Wave Blade + rune" },
];

const KONAMI = ["arrowup","arrowup","arrowdown","arrowdown","arrowleft","arrowright","arrowleft","arrowright","b","a"];

/* ---------- progression data ---------- */
const XP_NEED = [30, 45, 65, 90, 120, 155];                 // xp per player level

const PERKS = [                                             // idea 12: perk drops
  { name: "BRUTE",     desc: "+50% knockback",      apply: () => { G.knockMult = (G.knockMult || 1) * 1.5; } },
  { name: "SWIFT",     desc: "+15% move speed",     apply: () => { CFG.PLAYER.speed *= 1.15; } },
  { name: "BLOODTHIRST", desc: "Lifesteal 6%",      apply: () => { G.lifesteal = (G.lifesteal || 0) + 0.06; } },
  { name: "REAPER",    desc: "+10% crit chance",    apply: () => { G.crit += 0.10; } },
  { name: "BULWARK",   desc: "+20 max HP",          apply: () => { if (typeof canIncreaseMaxHp === "function" && !canIncreaseMaxHp()) return; G.maxHp += 20; G.hp += 20; } },
  { name: "GREED",     desc: "+25% gold gained",    apply: () => { G.goldMult = (G.goldMult || 1) * 1.25; } },
  { name: "RECKLESS",  desc: "+25% damage, -10 HP", apply: () => { G.atk += 3; G.maxHp -= 10; G.hp = Math.min(G.hp, G.maxHp); } },
  { name: "SHIELDED",  desc: "+25 shield HP",       apply: () => { G.shieldMax += 25; G.shield += 25; } },
];

const ARTIFACTS = [                                     // idea 16: one passive trinket
  { name: "EMBER HEART", desc: "+30 max HP",           apply: () => { if (typeof canIncreaseMaxHp === "function" && !canIncreaseMaxHp()) return; G.maxHp += 30; G.hp += 30; } },
  { name: "VOID SHARD",  desc: "+12% crit chance",     apply: () => { G.crit += 0.12; } },
  { name: "THORN PACT",  desc: "Reflect 25% damage",   apply: () => { G.thorns = 0.25; } },
  { name: "PHOENIX GEM", desc: "Revive once per run",  apply: () => { G.revives = 1; } },
  { name: "WAR DRUM",    desc: "+20% attack speed",    apply: () => { G.asMult = (G.asMult || 1) * 0.8; } },
  { name: "SERAPH WINGS", desc: "Dash cooldown -40%",  apply: () => { CFG.DASH_CD *= 0.6; } },
];

const CLASSES = [                                       // idea 20: starting classes
  { name: "KNIGHT", icon: "🛡️", desc: "+30 HP, +3 DEF, +1 potion", apply: () => { if (typeof canIncreaseMaxHp === "function" && !canIncreaseMaxHp()) { G.def += 3; G.potions += 1; return; } G.maxHp += 30; G.hp += 30; G.def += 3; G.potions += 1; } },
  { name: "RANGER", icon: "🏹", desc: "+12% crit, +15% speed, +1 herb", apply: () => { G.crit += 0.12; CFG.PLAYER.speed *= 1.15; if (typeof canIncreaseMaxHp === "function" && !canIncreaseMaxHp()) return; G.maxHp += 8; G.hp += 8; } },
  { name: "MAGE",    icon: "🔥", desc: "+5 ATK, starts with Ember Staff", apply: () => { G.atk += 5; if (!game.weapons.includes("staff")) game.weapons.push("staff"); game.secondary = "staff"; } },
];

const META_UPGRADES = [                                 // idea 19: shrine meta-upgrades
  { key: "hp",    name: "HEARTFELT START", desc: "+15 max HP on every run", cost: 50, max: 5 },
  { key: "atk",   name: "SHARPENED EDGE",  desc: "+2 ATK on every run",      cost: 40, max: 5 },
  { key: "gold",  name: "COFFER",          desc: "+50 starting gold",        cost: 30, max: 3 },
  { key: "potion", name: "APOTHECARY",     desc: "+1 starting potion",       cost: 45, max: 3 },
  { key: "crit",  name: "CRUEL OATH",      desc: "+5% crit on every run",    cost: 55, max: 4 },
];

const STAMINA = { max: 100, dashCost: 40, regen: 30 };  // idea 14: stamina resource

/* ---------- player settings (ideas 66/67/68/71/72) ---------- */
const SETTINGS_KEY = "blobknight.settings";
/* idea 20: screen-size (zoom) presets — FIT, COZY, ZOOMED */
const SCREEN_SIZES = { "0.9": { label: "COZY" }, "1": { label: "FIT" }, "1.1": { label: "ZOOMED" } };
const DEFAULT_SETTINGS = {
  vol: 0.8,            // master volume 0..1 (idea 66)
  shake: 1,            // screen shake intensity 0..1 (idea 67)
  colorblind: "off",   // off | deuteranopia | protanopia (idea 71)
  holdAttack: false,   // hold SPACE to keep attacking (idea 72)
  zoom: 1,             // screen size multiplier (idea 20)
  keymap: {            // idea 68: key rebinding
    up: "w", down: "s", left: "a", right: "d",
    attack: " ", secondary: "r", dash: "shift", potion: "e", bomb: "f",
    turret: "g", trap: "t",
    weapon: "q", pause: "p", mute: "m",
  },
};
const SETTINGS = loadSettings();
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return Object.assign(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), JSON.parse(raw));
  } catch (e) { /* ignore */ }
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch (e) { /* ignore */ }
}
/* colorblind palette swap (idea 71) */
const CB_PALETTES = {
  deuteranopia: { red: "#c98a3d", green: "#6fc3ff" },
  protanopia:   { red: "#e8b45e", green: "#6fc3ff" },
};

const ELITE_MODS = [                                    // idea 30: elite rolls
  { name: "ANCIENT", desc: "+50% speed",        apply: d => { d.speed = Math.round(d.speed * 1.5); } },
  { name: "COLOSSAL", desc: "Bigger + tougher",  apply: d => { d.r += 4; } },
  { name: "REGENERATIVE", desc: "Heals over time", apply: () => {} },
  { name: "SCALDING", desc: "Burning touch",     apply: d => { d.burn = true; } },
  /* chapter two: behavior elites — the mod changes HOW the foe fights */
  { name: "FRANTIC", desc: "Attacks twice as fast", apply: () => {} },
  { name: "FLEETING", desc: "Blinks away when struck", apply: () => {} },
  { name: "DEATHBURST", desc: "Erupts on death", apply: () => {} },
  { name: "WARDING", desc: "Raises a guard periodically", apply: () => {} },
  { name: "AUREATE", desc: "Gilded — spills riches", apply: d => { d.hp = Math.round(d.hp * 1.2); } },
];
