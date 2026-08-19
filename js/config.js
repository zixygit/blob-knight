/* ============================================================
   EMBERQUEST 2D — config: constants, enemy types, levels, weapons
   ============================================================ */
"use strict";

const CFG = {
  W: 800,
  H: 600,
  MARGIN: 30,
  PLAYER: { r: 14, speed: 170, maxHp: 100, atk: 10, def: 4, potions: 2, potionHeal: 40 },
  SWORD_RANGE: 42,
  SWORD_ARC: 1.1,
  DASH_SPEED: 3.1,   // speed multiplier while dashing
  DASH_TIME: 0.16,   // dash duration = i-frame window
  DASH_CD: 1.6,
};

const MAX_LEVEL = 6;

/* ---------- enemy archetypes (stats can be overridden per level) ---------- */
const ENEMY_TYPES = {
  chaser:   { r: 13, speed: 90,  color: "#7a9e3d", dmg: [4, 7],   hp: 28, kind: "chaser" },
  brute:    { r: 18, speed: 55,  color: "#4e6b2a", dmg: [6, 10],  hp: 62, kind: "brute" },
  shooter:  { r: 12, speed: 72,  color: "#8fb05a", dmg: [3, 6],   hp: 28, kind: "shooter",
              fireCd: 2.2, proj: { speed: 260, r: 5, color: "#c9b458", dmg: [4, 7] } },
  bomber:   { r: 13, speed: 125, color: "#a3c04d", dmg: [9, 14],  hp: 24, kind: "bomber", blastR: 70 },
  charger:  { r: 14, speed: 80,  color: "#c9d96a", dmg: [7, 11],  hp: 42, kind: "charger",
              chargeSpeed: 430, chargeCd: 2.6, windup: 0.55 },
  elite:    { r: 19, speed: 60,  color: "#3f6a3f", dmg: [7, 12],  hp: 90, kind: "elite" },
  /* --- frozen spire and beyond --- */
  freezer:  { r: 13, speed: 70,  color: "#7fd4e8", dmg: [3, 6],   hp: 30, kind: "freezer",
              fireCd: 2.4, proj: { speed: 240, r: 6, color: "#a8e6f0", dmg: [3, 6], slow: 2.6 } },
  phantom:  { r: 12, speed: 150, color: "#b06fd4", dmg: [6, 9],   hp: 22, kind: "phantom", teleCd: 3.4 },
  summoner: { r: 15, speed: 60,  color: "#8a5fc0", dmg: [4, 7],   hp: 48, kind: "summoner",
              summonCd: 5, summonMax: 3 },
  imp:      { r: 9,  speed: 140, color: "#d47f4e", dmg: [3, 5],   hp: 12, kind: "chaser" },
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
      { name: "BONE GOLIATH",  type: "elite",   count: 1 },
    ],
    boss: {
      name: "BONE WARDEN", kind: "boss", isBoss: true,
      hp: 135, r: 23, speed: 75, color: "#c8c0d8", dmg: [8, 13],
      volley: { count: 3, spread: 0.5, speed: 320, dmg: [7, 10], color: "#b8c4d8" },
      radial: { count: 10, speed: 230, dmg: [6, 9], color: "#9a90b8" },
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
      { name: "INFERNAL BRUTE", type: "elite",   count: 1 },
    ],
    boss: {
      name: "EMBERFANG, THE DRAGON", kind: "boss", isBoss: true,
      hp: 320, r: 34, speed: 100, color: "#ff5a2a", dmg: [12, 18],
      volley: { count: 4, spread: 0.5, speed: 360, dmg: [10, 14], color: "#ff8b3d" },
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
      { name: "AVALANCHE BRUTE", type: "charger", count: 1 },
      { name: "GLACIER TROLL",   type: "brute",   count: 1 },
    ],
    boss: {
      name: "KARVATH, FROST MONARCH", kind: "boss", isBoss: true,
      hp: 230, r: 26, speed: 80, color: "#5ab8d4", dmg: [9, 14],
      volley: { count: 5, spread: 0.4, speed: 300, dmg: [7, 10], color: "#a8e6f0", slow: 2.2 },
      radial: { count: 12, speed: 220, dmg: [7, 10], color: "#7fd4e8" },
      summon: { type: "imp", name: "ICE SPARK", count: 2, cd: 7 },
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
      { name: "GRAVE KNIGHT", type: "elite",    count: 1 },
    ],
    boss: {
      name: "THE HOLLOW KING", kind: "boss", isBoss: true,
      hp: 330, r: 28, speed: 78, color: "#9a86c8", dmg: [10, 15],
      volley: { count: 4, spread: 0.45, speed: 330, dmg: [8, 12], color: "#b8a8e8" },
      radial: { count: 14, speed: 240, dmg: [7, 11], color: "#8a76b8" },
      summon: { type: "phantom", name: "COURT WRAITH", count: 1, cd: 9 },
      spiral: { count: 3, step: 0.22, twist: 0.75, speed: 190, dmg: [6, 9], color: "#c0a8f0" },
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
      { name: "VOID SENTINEL", type: "elite",    count: 1 },
    ],
    boss: {
      name: "THE VOID SOVEREIGN", kind: "boss", isBoss: true,
      hp: 520, r: 36, speed: 95, color: "#7a4ae8", dmg: [13, 19],
      volley: { count: 5, spread: 0.5, speed: 360, dmg: [10, 14], color: "#a88cff" },
      radial: { count: 18, speed: 250, dmg: [8, 12], color: "#c0a8f0" },
      summon: { type: "imp", name: "VOID MOTE", count: 3, cd: 8 },
      spiral: { count: 4, step: 0.2, twist: 0.55, speed: 210, dmg: [7, 10], color: "#8a76d8" },
      volleyCd: 2.1, radialCd: 3.2, enrageAt: 0.6, enrage2At: 0.28,
    },
    bossReward: 400,
  },
};

/* ---------- weapon catalog ---------- */
const WEAPONS = {
  sword:    { name: "SWORD",       icon: "⚔️", cd: 0.45, cost: 0,   desc: "Arc slash" },
  wave:     { name: "WAVE BLADE",  icon: "🌊", cd: 1.30, cost: 150, desc: "Shockwave burst" },
  crossbow: { name: "CROSSBOW",    icon: "🏹", cd: 0.28, cost: 200, desc: "Fast bolts" },
  staff:    { name: "EMBER STAFF", icon: "🔥", cd: 0.9,  cost: 300, desc: "Explosive fireball" },
};

const KONAMI = ["arrowup","arrowup","arrowdown","arrowdown","arrowleft","arrowright","arrowleft","arrowright","b","a"];
