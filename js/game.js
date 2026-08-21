/* ============================================================
   BLOB KNIGHT — game state, flow, input, loop
   ============================================================ */
"use strict";

const $ = id => document.getElementById(id);
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* ---------- global state ---------- */
const G = {
  phase: "menu",          // menu | play | paused | shop | won | dead
  name: "HERO",
  hp: 100, maxHp: 100, atk: 10, def: 4,
  gold: 0, potions: 2, sword: 1, armor: 1, kills: 0, crit: 0,
  bombs: 0, turrets: 0, traps: 0,   // tool inventory (F/G/T)
  godMode: false,
  mute: false,
  slowT: 0,
  invulnT: 0,             // idea 4: post-hit invincibility window
  hitStop: 0,             // idea 1: freeze frames on hit
  combo: 0, comboT: 0,    // idea 10: kill streak combo
  xp: 0, playerLevel: 1,  // idea 11: XP + level-ups
  stamina: STAMINA.max,   // idea 14
  shield: 0, shieldMax: 0, shieldRegenT: 0,   // idea 18
  lifesteal: 0, thorns: 0, revives: 0,        // ideas 17/16
  knockMult: 1, goldMult: 1, asMult: 1,       // perk multipliers
  perks: [], artifact: null,                  // ideas 12/16
  wLevels: { sword: 1, wave: 1, crossbow: 1, staff: 1 }, // idea 13
  chargeT: 0, charging: false,                // idea 15: charged heavy
  className: "KNIGHT",                        // idea 20
  meta: { essence: 0, lvls: { hp: 0, atk: 0, gold: 0, potion: 0, crit: 0 } }, // idea 19
  slowmoT: 0,                                 // idea 31: boss phase cinematics
  dmgTaken: 0,                                // idea 38: boss grade
  bossRush: false,                            // idea 36
  doubleBoss: false,                          // idea 37
  aoeZones: [],                               // idea 34: ground AOE patterns
  difficulty: "normal",                       // idea 59
  runSeed: 1, daily: false, ngPlus: false,    // ideas 61/60
  playtime: 0,                                // idea 62
  level: 1, door: null, loot: [], bossSpawned: false, minionsLeft: 0, loreNotes: [],
};

function canIncreaseMaxHp() { return !(G.difficulty === "extreme" && G.extremeMaxLocked); }

// God Run perk system — unlock order 3 → 4 → 1 → 2, only active in God Run
const GODRUN_PERKS = {
  3: { name: "SWORD BOUNCE", desc: "Sword projectiles bounce off walls/enemies", icon: "🔄", order: 1 },
  4: { name: "FAST ATTACKS", desc: "+35% attack speed", icon: "⚡", order: 2 },
  1: { name: "ONE-HIT SHIELD", desc: "1 shield every 5s, absorbs one hit", icon: "🛡️", order: 3 },
  2: { name: "360° SLASH", desc: "Full surrounding sword attack", icon: "🌀", order: 4 },
};
const GODRUN_ORDER = [3,4,1,2];
const GODRUN_KEY = "blobknight.godperks";
function loadGodPerks(){ try{ const r=localStorage.getItem(GODRUN_KEY); if(r) return JSON.parse(r);}catch(e){} return {unlocked:[], level:0}; }
let GOD_PERKS = loadGodPerks();
function saveGodPerks(){ try{ localStorage.setItem(GODRUN_KEY, JSON.stringify(GOD_PERKS)); }catch(e){} }
function isGodPerkUnlocked(id){ return GOD_PERKS.unlocked.includes(id); }
function nextGodPerk(){ return GODRUN_ORDER[GOD_PERKS.unlocked.length] || null; }

const game = {
  G,
  player: null,
  enemies: [],
  projectiles: [],   // player bolts + enemy shots
  waves: [],         // wave blade shockwaves
  hazardZones: [],   // chapter two: acid pools, silk webs, forge heat
  loot: G.loot,
  effects: [],
  arcs: [],          // idea 7: slash afterimages
  bombs: 0,          // idea 52
  deployables: [],   // idea 53
  burnZones: [],     // idea 49
  orbits: [],        // idea 50
  time: 0,
  shake: 0,
  weapon: "sword",        // primary hand — the sword is always equipped
  secondary: null,        // secondary hand — ranged weapons (crossbow/staff/...)
  weapons: ["sword"],     // owned weapons
};

/* ---------- input ---------- */
const keys = {};
const KM = () => SETTINGS.keymap;
let lastGp = null, gpPollT = 0;                 // perf: throttled gamepad polling
addEventListener("keydown", e => {
  if (e.target && e.target.tagName === "INPUT") return;   // typing a hero name
  const k = e.key.toLowerCase();
  SFX.unlock();
  if (!SFX.musicOn) { SFX.musicOn = true; SFX._mTimer = 0.2; }  // idea 75: music starts on first input
  keys[k] = true;
  const km = KM();
  const isAction = Object.values(km).includes(k);
  if (isAction) e.preventDefault();
  if (k === km.attack && !e.repeat) { G.charging = true; G.chargeT = 0; }   // charge starts on press; attack fires on release
  if (k === km.secondary && !e.repeat) secondaryAttack(game);
  if (k === km.potion && !e.repeat) drinkPotion();
  if (k === km.weapon && !e.repeat) cycleWeapon();
  if (k >= "1" && k <= "4" && !e.repeat) selectWeapon(Number(k));
  if (k === km.dash && !e.repeat) tryDash();
  if ((k === km.pause || k === "escape") && !e.repeat) togglePause();
  if (k === km.mute && !e.repeat) toggleMute();
  if (k === km.bomb && !e.repeat) throwBomb(game);
  if (k === km.turret && !e.repeat) deployTurretKey();
  if (k === km.trap && !e.repeat) deployTrapKey();
  /* ENTER skips any interstitial screen (shop / branch / level-clear) or starts from the menu */
  if (k === "enter" && !e.repeat) {
    const ob = typeof overlayButtons !== "undefined" ? overlayButtons() : [];
    const focusedOverlayBtn = ob.length && document.activeElement && ob.includes(document.activeElement);
    if (focusedOverlayBtn) { /* overlay handler will click the focused button */ }
    else if (G.phase === "shop") nextLevel();
    else if (G.phase === "branch") { G.branchBonus = "combat"; nextLevel(); }
    else if (G.phase === "clear") nextLevel();
    else if (G.phase === "menu") beginGame();
  }
});
addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
  if (e.key.toLowerCase() === KM().attack && G.charging) {
    G.charging = false;
    if (G.chargeT >= 0.6) tryHeavy(); else weaponAttack(game);
    G.chargeT = 0;
  }
});
addEventListener("pointerdown", () => SFX.unlock(), { once: true });
/* right-click fires the secondary weapon */
addEventListener("contextmenu", e => {
  e.preventDefault();
  if (G.phase === "play") secondaryAttack(game);
});

/* ---------- level setup ---------- */
/* chapter two: shared minion spawner — used by level setup AND wave reinforcements */
function spawnMinionList(list) {
  for (const m of list) {
    const base = Object.assign({}, ENEMY_TYPES[m.type], m);
    for (let i = 0; i < (m.count || 1); i++) {
      let x, y;
      do {
        x = rand(60, CFG.W - 60);
        y = rand(60, CFG.H - 60);
      } while (dist({ x, y }, game.player) < 100);
      const def = Object.assign({}, base);
      /* idea 30: elite rolls — any enemy can spawn elite with a modifier + guaranteed loot.
         chapter two: level defs may force a specific elite (named mini-boss hunts). */
      const forced = m.elite && ELITE_MODS.find(mo => mo.name === m.elite);
      if (forced) {
        forced.apply(def);
        def.eliteMod = forced.name;
        def.hp = Math.round(def.hp * 1.5);
        def.r += 3;
        def.name = (m.name || "FOE") + " " + forced.name;
      } else if (m.type !== "guard" && Math.random() < 0.12) {
        const mod = ELITE_MODS[rand(0, ELITE_MODS.length - 1)];
        mod.apply(def);
        def.eliteMod = mod.name;
        def.hp = Math.round(def.hp * 1.5);
        def.r += 3;
        def.name = (m.name || "FOE") + " " + mod.name;
      }
      /* idea 59/60: difficulty + New Game+ scaling */
      const diff = DIFFICULTIES[G.difficulty] || DIFFICULTIES.normal;
      if (diff.mult > 1) def.hp = Math.round(def.hp * (1 + (diff.mult - 1) * 0.5));
      if (G.ngPlus) { def.hp = Math.round(def.hp * 1.4); def.speed = Math.round(def.speed * 1.1); }
      const e = new Enemy(def, x, y);
      if (m.proj) e.proj = m.proj;
      game.enemies.push(e);
      seeEnemy(e.kind);   // idea 63: bestiary tracking
      game.G.minionsLeft++;
    }
  }
}

function setupLevel(n) {
  G.level = n;
  const L = LEVELS[n];
  game.player = new Player(n === 3 ? CFG.W / 2 : CFG.MARGIN + 30, CFG.H / 2);
  game.player.dropT = 0.9;          // idea 9: drop-in animation
  game.player.dropY = -160;         // start above the arena
  game.enemies = [];
  game.projectiles = [];
  game.waves = [];
  game.effects = [];
game.arcs = [];
  game.orbits = [];
  game.deployables = [];
  game.burnZones = [];
  game.G.loot = [];
  game.G.door = { x: CFG.W - 36, y: CFG.H / 2, r: 14, open: false };
game.G.bossSpawned = false;
  game.G.minionsLeft = 0;
  game.G.aoeZones = [];
  game.hazardZones = [];        /* chapter two: acid pools, silk webs, forge heat */
  G.branchChosen = false;
  G.levelWaves = null;          /* chapter two: multi-wave encounters */
  G.waveIdx = 0;

  /* ideas 39-48: build the world (obstacles, hazards, traps, crates, shrine) */
  const world = buildWorld(n, G.runSeed || (G.level * 7919 + 13));
  Object.assign(game, {
    obstacles: world.obstacles, hazards: world.hazards, traps: world.traps, crates: world.crates, shrine: world.shrine,
  });
  // Previous bosses as NPCs in later stages — only after defeating
  try{
    G.defeatedBosses = G.defeatedBosses || JSON.parse(localStorage.getItem("blobknight.defeated") || "[]");
    if (G.level > 1 && G.defeatedBosses.length > 0) {
      const candidates = G.defeatedBosses.filter(k => !k.startsWith(`${n}:`)).slice(-2);
      for (const key of candidates) {
        const lvl = parseInt(key.split(":")[0]);
        const bossDef = LEVELS[lvl] ? LEVELS[lvl].boss : null;
        if (bossDef) {
          // NPC size: 55% of boss, preserve original for combat transition
          const npcR = Math.max(10, Math.round(bossDef.r * 0.55));
          const npcDef = Object.assign({}, bossDef, { name: bossDef.name + " (Ally)", isBoss: false, hp: 1, maxHp: 1, speed: 55, r: npcR, color: bossDef.color });
          const npc = new Enemy(npcDef, world.shrine ? world.shrine.x + rand(-60,60) : rand(120, CFG.W-120), world.shrine ? world.shrine.y + rand(-40,40) : rand(120, CFG.H-120));
          npc.isNPC = true;
          npc.npcName = bossDef.name;
          npc.originalBoss = Object.assign({}, bossDef);
          npc.originalR = bossDef.r;
          npc.originalColor = bossDef.color;
          npc.npcHostile = false;
          // NPC behavior: idle → wander → stop → idle (believable, not random)
          npc.npcState = "idle";
          npc.npcTimer = rand(1, 2);
          npc.npcDir = Math.random() * Math.PI * 2;
          game.enemies.push(npc);
        }
      }
      if (candidates.length > 0) flash(`Allies from past victories appear`, "#6bff9a");
    }
  }catch(e){}
  /* idea 48: combat path bonus — drop loot on entry */
  if (G.branchBonus === "combat" && n >= 3) {
    for (let i = 0; i < 3; i++) {
      game.G.loot.push(new Pickup(wpick(["gold", "herb", "stone", "charm", "rune"]), CFG.W / 2 + rand(-80, 80), CFG.H / 2 + rand(-60, 60)));
    }
    G.branchBonus = null;
    flash("COMBAT PATH: +LOOT", "#ffd166");
  }

  /* idea 36: boss rush — skip minions, boss right away */
  if (G.bossRush) {
    spawnBoss();
    flash(`BOSS RUSH — LEVEL ${n}/${MAX_LEVEL}`, "#ff7847");
    renderHUD();
    saveGame();
    return;
  }

  /* chapter two: multi-wave encounters — wave 1 now, reinforcements as each falls */
  G.levelWaves = L.waves || null;
  G.waveIdx = 0;
  spawnMinionList(L.waves ? L.waves[0] : (L.minions || []));
  flash(`LEVEL ${n}/${MAX_LEVEL}: ${L.name} — slay all foes`, "#9a90b8");
  renderHUD();
  saveGame();
}

/* idea 87: boss taunts (reuse flash system) */
const BOSS_TAUNTS = [
  "You carry death in your pocket…",
  "The forest remembers every trespasser.",
  "Your light is borrowed, little ember.",
  "Rust your sword — you'll need the weight.",
  "The crypts have been hungry for a century.",
  "Molten gods spit at your kind.",
  "We are the shadow at the end of all flames.",
  /* chapter two: the sundered depths */
  "The maw is patient. The maw is hungry.",
  "Every shard of me will remember your face.",
  "The storm already knows where you will stand.",
  "Iron does not bleed. You will.",
  "You climbed so deep just to burn.",
  "I am the first fire. You are kindling.",
];
const DESPERATION_TAUNTS = [
  "IMPOSSIBLE —",
  "My crown is slipping…",
  "ENOUGH!",
  "Even the void weeps for you…",
];

function spawnBoss() {
  const b = LEVELS[G.level].boss;
  const boss = new Enemy(b, CFG.W - 120, CFG.H / 2);
  game.enemies.push(boss);
  game.G.bossSpawned = true;
  game.shake = Math.max(game.shake, 0.25);
  /* idea 32: boss intro banner */
  const banner = $("bossBanner");
  if (banner) {
    banner.textContent = `⚔️ ${b.name} ⚔️`;
    banner.classList.add("show");
    setTimeout(() => banner.classList.remove("show"), 2600);
  }
  flash(`⚔️ ${b.name} has arrived!`, "#ff7847");
  /* idea 87: boss taunt one-liners via the flash system */
  setTimeout(() => flash(`“${BOSS_TAUNTS[G.level] || BOSS_TAUNTS[0]}”`, "#c2553d"), 1100);
  SFX.boss();
  /* idea 37: double-boss secret level */
  if (G.doubleBoss) {
    const second = new Enemy(b, CFG.MARGIN + 90, CFG.H / 2);
    second.x = CFG.W - 220; second.y = CFG.H - 90;
    game.enemies.push(second);
    flash("THE TWINS DESCEND!", "#ff2a6a");
  }
}

/* ---------- combat helpers ---------- */
function playerDamage() {
  const crit = Math.random() < (0.1 + G.crit);
  const w = game.lastWeapon || game.weapon || "sword";
  const wl = G.wLevels[w] || 1;                          // idea 13: per-weapon scaling
  const base = Math.round(G.atk * (1 + (wl - 1) * 0.5));
  /* idea 7: combo timing — chained hits ramp damage up to x12 */
  const comb = Math.min(G.combo || 0, 12);
  const dmg = Math.round(rand(base, base + 5) * (crit ? 2 : 1) * (1 + comb * 0.04));
  return { d: dmg, crit };
}

/* idea 15: charged heavy attack */
function tryHeavy() {
  if (G.phase !== "play" || !game.player || game.player.attackCd > 0) return;
  if (G.chargeT < 0.6) return;   // not charged enough
  G.phase = "charging";          // no-op guard; handled inline below
  G.phase = "play";
  const p = game.player;
  p.attackCd = 1.0 * (G.asMult || 1);
  p.swing = 0.45;
  game.arcs = game.arcs || [];
  game.arcs.push({ ang: p.dir, t: 0.5 });
  const dmg = Math.round((G.atk * 2.2) * (G.chargeT / 0.6));
  game.shake = Math.max(game.shake, 0.25);
  SFX.boom();
  for (const e of [...game.enemies]) {
    const d = dist(p, e);
    if (d < CFG.SWORD_RANGE * 1.6 + e.r) {
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      const hit = playerDamage();
      hurtEnemy(e, dmg + hit.d,
        Math.cos(p.dir) * 18, Math.sin(p.dir) * 18,
        { knock: 0.6, crit: hit.crit, color: "#ffd166", hitStop: 0.08 });
    }
  }
  /* idea: heavy slam destroys incoming projectiles */
  for (let i = game.projectiles ? game.projectiles.length - 1 : -1; i >= 0; i--) {
    const pr = game.projectiles[i];
    if (pr.team !== "player" && dist(p, pr) < CFG.SWORD_RANGE * 1.6 + pr.r) {
      game.projectiles.splice(i, 1);
      game.effects.push({ type: "spark", x: pr.x, y: pr.y, vx: (Math.random() - 0.5) * 160, vy: -rand(30, 90), t: 0.35, color: "#ffd166" });
    }
  }
  flash("HEAVY SLAM!", "#ffd166");
  G.chargeT = 0;
}

/* idea 11: level-up — auto-apply a random blessing, no popup (keeps the flow going) */
function checkLevelUp() {
  const need = XP_NEED[G.playerLevel - 1];
  if (!need || G.xp < need) return;
  G.xp -= need;
  G.playerLevel++;
  const cards = [
    { label: "💪 +5 ATK", fn: () => { G.atk += 5; } },
    { label: "❤️ +25 MAX HP", fn: () => { if (!canIncreaseMaxHp()) { flash("Max HP locked on EXTREME", "#9a90b8"); return; } G.maxHp += 25; G.hp += 25; } },
    { label: "🍀 +5% CRIT", fn: () => { G.crit += 0.05; } },
    { label: "⚡ +30 STAMINA", fn: () => { STAMINA.max += 30; } },
    { label: "🛡️ +3 DEF", fn: () => { G.def += 3; } },
    { label: "💨 -25% DASH COOLDOWN", fn: () => { CFG.DASH_CD *= 0.75; } },
  ];
  const c = cards[Math.floor(Math.random() * cards.length)];
  c.fn();
  flash(`⬆ LEVEL ${G.playerLevel}: ${c.label}`, "#ffd166");
  SFX.levelup();
  renderHUD();
}

/* single place where enemies take damage: flash, knockback, kill */
function hurtEnemy(e, dmg, kx, ky, opts = {}) {
  if (e.dead) return;
  /* idea 18: boss shield windows block all frontal damage */
  if (e.shieldT > 0 && !opts.ignoreShield) {
    e.hurtT = 0.08;
    game.effects.push({ type: "hit", x: e.x, y: e.y - 12, t: 0.3, txt: "BLOCKED", color: "#c8c8e8" });
    SFX.shield();
    return;
  }
  /* idea 23: shielder blocks frontal damage */
  if (e.kind === "shielder" && !opts.ignoreShield && e.isShielded(game.player)) {
    e.hurtT = 0.08;
    game.effects.push({ type: "hit", x: e.x, y: e.y - 12, t: 0.3, txt: "BLOCKED", color: "#c8c8e8" });
    SFX.hit();
    return;
  }
  /* chapter two: a phased assassin can't be struck — wait for the red ring */
  if (e.phased) {
    game.effects.push({ type: "hit", x: e.x, y: e.y - 12, t: 0.25, txt: "PHASED", color: "#b06fd4" });
    return;
  }
  e.hp -= dmg;
  /* idea 51: elemental weakness — +30% damage vs weak enemies */
  const weakness = ELEMENT_WEAKNESS[G.level];
  if (weakness && opts.element === weakness) {
    e.hp -= Math.round(dmg * 0.3);
    game.effects.push({ type: "hit", x: e.x, y: e.y - 14, t: 0.3, txt: "WEAK!", color: ELEMENTS[weakness] });
  }
  e.hurtT = 0.12;
  e.knock = opts.knock || 0.2;
  e.kx = kx; e.ky = ky;
  /* chapter two: FLEETING elites blink away from the blade */
  if (e.eliteMod === "FLEETING" && !e.isBoss && Math.random() < 0.3) {
    const a = Math.random() * Math.PI * 2;
    game.effects.push({ type: "boom", x: e.x, y: e.y, t: 0.3 });
    e.x = clamp(e.x + Math.cos(a) * 90, CFG.MARGIN, CFG.W - CFG.MARGIN);
    e.y = clamp(e.y + Math.sin(a) * 90, CFG.MARGIN, CFG.H - CFG.MARGIN);
    e.knock = 0;
    game.effects.push({ type: "boom", x: e.x, y: e.y, t: 0.3 });
  }
  G.hitStop = Math.max(G.hitStop, opts.hitStop || 0.045);      // idea 1: hit-stop freeze
  const dcol = opts.color || (e.isBoss ? "#ff7847" : "#fff");
  game.effects.push({ type: "hit", x: e.x, y: e.y, t: 0.3, txt: dmg, crit: opts.crit, color: dcol });
  for (let i = 0; i < 6; i++) {                                 // idea 4: directional sparks
    const a = Math.atan2(ky || 1, kx || 1) + (Math.random() - 0.5) * 1.4;
    const sp = rand(60, 190);
    game.effects.push({ type: "spark", x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0.28, color: e.color });
  }
  if (opts.crit) { flash(`CRITICAL ${dmg}!`, "#ffd166"); SFX.crit(); }
  else SFX.hit();
  if (e.hp <= 0) killEnemy(e);
}

function damagePlayer(d, sx, sy, fx) {
  if (G.godMode || G.phase !== "play") return;
  /* God Run perk 1: One-Hit Shield — absorbs one attack, 5s cooldown */
  if (G.difficulty === "godrun" && typeof isGodPerkUnlocked === "function" && isGodPerkUnlocked(1) && G.godShield > 0) {
    G.godShield = 0;
    G.godShieldCd = 5.0;
    flash("🛡️ SHIELD BLOCKED!", "#6fc3ff");
    game.effects.push({ type: "hit", x: game.player.x, y: game.player.y - 14, t: 0.4, txt: "BLOCKED", color: "#6fc3ff" });
    SFX.shield();
    return;
  }
  /* idea 4: post-hit invincibility — brief grace window so clusters don't stunlock */
  if (G.invulnT > 0) return;
  if (game.player.dashT > 0) return;                       // dash i-frames
  /* idea 49: sword parry — negate the hit */
  if (game.parryT > 0) {
    game.parryT = 0;
    game.effects.push({ type: "boom", x: game.player.x, y: game.player.y, t: 0.35 });
    flash("PARRY!", "#6bff9a");
    SFX.dash();
    return;
  }
  if (G.dmgTakenMult) d = Math.round(d * G.dmgTakenMult);  // idea 54: cursed downside
  d = applyDifficultyMult(d);                              // idea 59: difficulty
  let mitigated = Math.max(1, d - Math.min(d - 1, Math.round(G.def * 0.6)));
  /* idea 18: shield layer absorbs damage first */
  if (G.shield > 0) {
    const absorbed = Math.min(G.shield, mitigated);
    G.shield -= absorbed;
    mitigated -= absorbed;
    game.effects.push({ type: "hit", x: game.player.x, y: game.player.y - 14, t: 0.3, txt: `🛡${absorbed}`, color: "#8fd4ff" });
    if (mitigated <= 0) return;
  }
  G.shieldRegenT = 4;   // pause shield regen after being hit
  G.hp -= mitigated;
  G.dmgTaken += mitigated;   // idea 38: boss grade tracking
  G.invulnT = 0.6;           // idea 4: grace window after a real hit
  game.player.hurtT = 0.25;
  game.shake = Math.max(game.shake, 0.18);
  game.effects.push({ type: "hurt", x: game.player.x, y: game.player.y, t: 0.3 });
  const ang = Math.atan2(game.player.y - sy, game.player.x - sx);
  game.player.x = clamp(game.player.x + Math.cos(ang) * 6, CFG.MARGIN, CFG.W - CFG.MARGIN);
  game.player.y = clamp(game.player.y + Math.sin(ang) * 6, CFG.MARGIN, CFG.H - CFG.MARGIN);
  /* idea 16: thorns reflect */
  if (G.thorns > 0) {
    const src = game.enemies.find(e => dist(e, game.player) < 60);
    if (src) hurtEnemy(src, Math.round(mitigated * G.thorns), 0, 0, { knock: 0.2, color: "#c084fc" });
  }
  if (fx === "slow") {
    const wasChilled = G.slowT > 0.3;
    G.slowT = 2.6;
    if (!wasChilled) flash("CHILLED!", "#7fd4e8");
  }
  SFX.hurt();
  renderHUD();
  if (G.hp <= 0) die();
}

function explode(x, y, r, dmg) {
  game.effects.push({ type: "boom", x, y, t: 0.4 });
  game.shake = Math.max(game.shake, 0.15);
  SFX.boom();
  if (dist({ x, y }, game.player) < r + game.player.r) {
    damagePlayer(rand(dmg[0], dmg[1]), x, y);
  }
}

/* chapter two: persistent floor hazards — acid pools burn in pulses, webs drag you slow.
   Bounded (26 max) so big encounters can't tank the framerate. */
function spawnHazardZone(x, y, cfg) {
  game.hazardZones = game.hazardZones || [];
  game.hazardZones.push({ x, y, r: cfg.r || 40, t: cfg.life || 3, max: cfg.life || 3, dps: cfg.dps || 0, web: !!cfg.web, color: cfg.color || "#8fc04d" });
  if (game.hazardZones.length > 26) game.hazardZones.shift();
}

/* ember staff detonation: area damage from player attack */
function explodePlayer(x, y, r, dmg) {
  game.effects.push({ type: "boom", x, y, t: 0.4 });
  game.shake = Math.max(game.shake, 0.15);
  SFX.boom();
  for (const e of [...game.enemies]) {
    if (dist({ x, y }, e) < r + e.r) {
      const hit = playerDamage();
      const ang = Math.atan2(e.y - y, e.x - x);
      hurtEnemy(e, Math.round((dmg ? rand(dmg[0], dmg[1]) : hit.d * 0.9 + 2)), Math.cos(ang) * 10, Math.sin(ang) * 10,
        { knock: 0.3, crit: hit.crit, color: dmg ? "#ffb45e" : undefined });
    }
  }
}

function killEnemy(e, silent) {
  if (e.dead) return;
  e.dead = true;
  /* idea 63: bestiary */
  seeEnemy(e.kind || (e.isBoss ? "boss" : null));
  /* idea 22: splitter spawns imps before dying */
  if (e.kind === "splitter" && !e.split) {
    e.split = true;
    const def = Object.assign({}, ENEMY_TYPES.imp, { name: e.name + " SHARD" });
    for (let i = 0; i < 2; i++) {
      const m = new Enemy(def, e.x + (i ? 14 : -14), e.y + (i ? 10 : -10));
      m.summoned = true;
      game.enemies.push(m);
      game.effects.push({ type: "boom", x: m.x, y: m.y, t: 0.3 });
    }
    flash(`${e.name} splits!`, "#8fd4c8");
  }
  const idx = game.enemies.indexOf(e);
  if (idx >= 0) game.enemies.splice(idx, 1);
  G.kills++;
  /* idea 7: combo timing — kills & sword hits chain within the window */
  if (G.comboT > 0) G.combo = Math.min(12, G.combo + 1);
  else G.combo = 1;
  G.comboT = 1.6;
  /* idea 11: XP */
  if (!e.summoned || e.isBoss) {
    const xpGain = Math.round((e.maxHp || 20) / 6) + (e.isBoss ? 25 : 0);
    G.xp += Math.round(xpGain * (G.xpMult || 1));
    game.effects.push({ type: "heal", x: e.x, y: e.y - 14, t: 0.5, txt: `+${xpGain} XP`, color: "#c9b458" });
    checkLevelUp();
  }
  /* idea 17: lifesteal */
  if (G.lifesteal > 0) {
    const heal = Math.max(1, Math.round((e.maxHp || 20) * G.lifesteal));
    G.hp = Math.min(G.maxHp, G.hp + heal);
    game.effects.push({ type: "heal", x: game.player.x, y: game.player.y - 16, t: 0.5, txt: `+${heal}`, color: "#ff6b6b" });
  }
  /* idea 8: colored death shard burst */
  const col = e.color || "#ff7847";
  for (let i = 0; i < (e.isBoss ? 16 : 8); i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = rand(80, e.isBoss ? 260 : 200);
    game.effects.push({ type: "shard", x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, t: 0.5, color: col });
  }
  if (!silent) { game.effects.push({ type: "boom", x: e.x, y: e.y, t: 0.4 }); SFX.boom(); }
  /* chapter two: behavior elite mods + acid corpses fight back from the grave */
  if (!e.isBoss) {
    if (e.eliteMod === "DEATHBURST") {
      flash(`${e.name} erupts!`, "#ff8b3d");
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        game.projectiles.push(new Projectile("enemy", e.x, e.y, Math.cos(a) * 240, Math.sin(a) * 240, 5, rand(e.dmg[0], e.dmg[1]), "#ff8b3d"));
      }
    }
    if (e.eliteMod === "AUREATE") {
      game.G.loot.push(new Pickup("perk", e.x, e.y));
      game.G.loot.push(new Pickup("gold", e.x + 14, e.y + 6, rand(40, 80)));
      flash("GILDED FOE — riches spill!", "#ffd166");
    }
    if (e.kind === "acid") {
      spawnHazardZone(e.x, e.y, { r: 40, life: 2.6, dps: 8, color: "#8fc04d" });
      spawnHazardZone(e.x + rand(-34, 34), e.y + rand(-34, 34), { r: 32, life: 2.2, dps: 6, color: "#8fc04d" });
    }
  }
  /* idea 62: stats tracking */
  STATS.kills++;
  if (G.combo > STATS.bestCombo) STATS.bestCombo = G.combo;
  if (G.gold > (STATS.bestGold || 0)) STATS.bestGold = G.gold;
  saveStats();
  checkAchievements();
  if (e.isBoss) {
    G.gold += LEVELS[G.level].bossReward;
    // track defeated bosses for NPCs in later stages
    G.defeatedBosses = G.defeatedBosses || [];
    const bossKey = `${G.level}:${e.name}`;
    if (!G.defeatedBosses.includes(bossKey)) {
      G.defeatedBosses.push(bossKey);
      try{ localStorage.setItem("blobknight.defeated", JSON.stringify(G.defeatedBosses)); }catch(e){}
    }
    game.G.door.open = true;
    game.G.loot.push(new Pickup("potion", e.x, e.y));
    game.shake = Math.max(game.shake, 0.3);
    flash(`BOSS SLAIN! +${LEVELS[G.level].bossReward} gold`, "#ffd166");
    /* idea 38: post-fight grade card by damage taken */
    const ratio = G.dmgTaken / Math.max(1, G.maxHp);
    const grade = ratio < 0.5 ? "S" : ratio < 1 ? "A" : ratio < 1.8 ? "B" : "C";
    G.grade = grade;    // idea 86: epilogue varies by performance
    const gradeCol = grade === "S" ? "#ffd166" : grade === "A" ? "#6bff9a" : grade === "B" ? "#8fd4ff" : "#ff8b3d";
    flash(`FIGHT GRADE: ${grade} — ${Math.round(ratio * 100)}% HP lost`, gradeCol);
    const bar = $("bossBar");
    if (bar) bar.classList.remove("show");
  } else if (!e.summoned) {
    game.G.minionsLeft--;
    dropLoot(e.x, e.y, false);
    if (game.G.minionsLeft <= 0 && !game.G.bossSpawned) {
      /* chapter two: wave encounters — reinforcements arrive before the boss */
      if (G.levelWaves && G.waveIdx < G.levelWaves.length - 1) {
        G.waveIdx++;
        flash("⚔ ANOTHER WAVE APPROACHES!", "#ff7847");
        game.shake = Math.max(game.shake, 0.15);
        SFX.boss();
        spawnMinionList(G.levelWaves[G.waveIdx]);
      } else spawnBoss();
    }
  } else if (Math.random() < 0.15) {
    game.G.loot.push(new Pickup("gold", e.x, e.y, rand(5, 15)));
  }
  renderHUD();
}

function dropLoot(x, y, isBoss) {
  if (isBoss) { G.gold += 25; return; }
  if (Math.random() < 0.90) return; // exactly 10% orb drop — 90% no drop
  const r = Math.random();
  if (r < 0.30) game.G.loot.push(new Pickup("gold", x, y, rand(15, 40)));
  else if (r < 0.45) game.G.loot.push(new Pickup("potion", x, y));
  else if (r < 0.58) game.G.loot.push(new Pickup("herb", x, y));
  else if (r < 0.70) game.G.loot.push(new Pickup("stone", x, y));
  else if (r < 0.80) game.G.loot.push(new Pickup("charm", x, y));
  else if (r < 0.90) game.G.loot.push(new Pickup("rune", x, y));
  else game.G.loot.push(new Pickup("perk", x, y));          // idea 12: rare perk drop
}

function pickup(l) {
  switch (l.type) {
    case "gold":   G.gold += Math.round(l.v * (G.goldMult || 1)); flash(`+${l.v} gold`, "#ffd166"); break;
    case "potion": G.potions++; flash("+1 potion", "#6bff9a"); break;
    case "herb":   if (!canIncreaseMaxHp()) { flash("Max HP locked on EXTREME", "#9a90b8"); break; } G.maxHp += 8; G.hp += 8; flash("Max HP +8", "#6bff9a"); break;
    case "stone":  {                                    // idea 13: upgrades the equipped weapon
      const w = game.secondary || "sword";
      G.wLevels[w] = (G.wLevels[w] || 1) + 1;
      G.sword++;
      flash(`${WEAPONS[w].icon} ${WEAPONS[w].name} LV ${G.wLevels[w]}!`, "#ffd166");
      break;
    }
    case "charm":  G.crit += 0.05; G.sword++; flash("CRIT CHARM! +5% crit", "#c084fc"); break;
    case "rune":   G.def += 1; G.armor++; flash("GUARD RUNE! DEF +1", "#8fd4ff"); break;
    case "lore":   addLoreNote(l.v); break;    // idea 85: collectible lore notes
    case "perk": {
      const p = PERKS[rand(0, PERKS.length - 1)];
      p.apply();
      G.perks.push(p.name);
      flash(`PERK: ${p.name} — ${p.desc}`, "#c084fc");
      break;
    }
  }
  SFX.pickup();
  renderHUD();
}

function drinkPotion() {
  if (G.phase !== "play" || G.potions <= 0 || G.hp >= G.maxHp) return;
  G.potions--;
  const heal = CFG.PLAYER.potionHeal;
  G.hp = Math.min(G.maxHp, G.hp + heal);
  game.effects.push({ type: "heal", x: game.player.x, y: game.player.y, t: 0.4, txt: `+${heal}` });
  SFX.potion();
  renderHUD();
}

/* ---------- dash ---------- */
function tryDash() {
  if (G.phase !== "play" || !game.player) return;
  const p = game.player;
  if (p.dashT > 0 || p.dashCd > 0) return;
  if (G.stamina < STAMINA.dashCost) { flash("TOO TIRED — stamina low", "#9a90b8"); return; }  // idea 14
  G.stamina -= STAMINA.dashCost;
  p.dashT = CFG.DASH_TIME;
  p.dashCd = CFG.DASH_CD;
  p.dashAng = p.dir;
  game.effects.push({ type: "waveflash", x: p.x, y: p.y, t: 0.3 });
  SFX.dash();
}

/* ---------- boss attacks ---------- */
function bossVolley(boss, cfg) {
  const p = game.player;
  let base = Math.atan2(p.y - boss.y, p.x - boss.x);
  /* chapter two: VOLDRIC leads your movement — dodge sideways, not backward */
  if (cfg.lead) base = Math.atan2(p.y + (p.vy || 0) * 0.35 - boss.y, p.x + (p.vx || 0) * 0.35 - boss.x);
  const spread = cfg.spread || 0.4;
  for (let i = 0; i < cfg.count; i++) {
    const ang = base + (i - (cfg.count - 1) / 2) * spread;
    const shot = new Projectile("enemy", boss.x, boss.y,
      Math.cos(ang) * cfg.speed, Math.sin(ang) * cfg.speed,
      cfg.r || 7, rand(cfg.dmg[0], cfg.dmg[1]), cfg.color || "#ff8b3d",
      { slow: cfg.slow || 0, pool: cfg.pool || null, bounce: cfg.bounce || 0 });
    if (cfg.pool) shot.ttl = Math.min(shot.ttl, 1.1);   // globs arc down at range and splash
    game.projectiles.push(shot);
  }
  /* idea 18: EMBERFANG — a volley that scorches the ground where it lands */
  if (cfg.burn) {
    game.burnZones = game.burnZones || [];
    for (let i = 0; i < 2; i++) {
      game.burnZones.push({
        x: clamp(p.x + rand(-90, 90), CFG.MARGIN, CFG.W - CFG.MARGIN),
        y: clamp(p.y + rand(-90, 90), CFG.MARGIN, CFG.H - CFG.MARGIN),
        t: 2.2, r: 46,
      });
      game.effects.push({ type: "ring", x: game.burnZones[game.burnZones.length - 1].x, y: game.burnZones[game.burnZones.length - 1].y, r: 46, t: 0.5, color: "#ff8b3d" });
    }
  }
  flash(`${boss.name} fires a volley!`, "#ff7847");
}

function bossRadial(boss, cfg) {
  const n = cfg.count;
  game.effects.push({ type: "ring", x: boss.x, y: boss.y, r: 26, t: 0.3, color: cfg.color || "#9a90b8" });   // idea 18: telegraph
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    game.projectiles.push(new Projectile("enemy", boss.x, boss.y,
      Math.cos(ang) * cfg.speed, Math.sin(ang) * cfg.speed,
      cfg.r || 6, rand(cfg.dmg[0], cfg.dmg[1]), cfg.color || "#9a90b8", { bounce: cfg.bounce || 0 }));
  }
  flash(`${boss.name} erupts with a ring of fire!`, "#ff5a2a");
}

function bossSummon(boss, cfg) {
  const base = Object.assign({}, ENEMY_TYPES[cfg.type], { name: cfg.name || "MINION" });
  for (let i = 0; i < cfg.count; i++) {
    const ang = (i / cfg.count) * Math.PI * 2 + Math.random();
    const m = new Enemy(base,
      clamp(boss.x + Math.cos(ang) * 50, CFG.MARGIN, CFG.W - CFG.MARGIN),
      clamp(boss.y + Math.sin(ang) * 50, CFG.MARGIN, CFG.H - CFG.MARGIN));
    m.summoned = true;
    game.enemies.push(m);
    game.effects.push({ type: "boom", x: m.x, y: m.y, t: 0.3 });
  }
  flash(`${boss.name} summons ${cfg.name || "minions"}!`, "#c084fc");
  SFX.boss();
}

function bossSpiral(boss, cfg, baseAng) {
  for (let i = 0; i < cfg.count; i++) {
    const ang = baseAng + (i / cfg.count) * Math.PI * 2;
    game.projectiles.push(new Projectile("enemy", boss.x, boss.y,
      Math.cos(ang) * cfg.speed, Math.sin(ang) * cfg.speed,
      6, rand(cfg.dmg[0], cfg.dmg[1]), cfg.color));
  }
}

/* ---------- weapons ---------- */
/* the sword is the primary hand; 1-4 / Q pick the SECONDARY (ranged) weapon */
function selectWeapon(n) {
  const ordered = Object.keys(WEAPONS).filter(w => game.weapons.includes(w) && w !== "sword");
  if (ordered.length === 0) { flash("Only the sword — buy a ranged weapon at the shop", "#9a90b8"); return; }
  if (n >= 1 && n <= ordered.length) {
    game.secondary = ordered[n - 1];
    flash(`${WEAPONS[game.secondary].icon} ${WEAPONS[game.secondary].name} armed (R)`, "#6fc3ff");
    renderHUD();
  }
}

function cycleWeapon() {
  const ordered = Object.keys(WEAPONS).filter(w => game.weapons.includes(w) && w !== "sword");
  if (ordered.length === 0) { flash("Only the sword — buy a ranged weapon at the shop", "#9a90b8"); return; }
  const i = ordered.indexOf(game.secondary);
  selectWeapon(((i + 1) % ordered.length) + 1);
}

/* idea 53: deployable tools keyed off inventory (bought at the shop) */
function deployTurretKey() {
  if (G.phase !== "play" || !game.player) return;
  if ((G.turrets || 0) <= 0) { flash("No turrets — buy at the shop", "#9a90b8"); return; }
  G.turrets--;
  deployTurret(game);
  renderHUD();
}
function deployTrapKey() {
  if (G.phase !== "play" || !game.player) return;
  if ((G.traps || 0) <= 0) { flash("No bear traps — buy at the shop", "#9a90b8"); return; }
  G.traps--;
  deployTrap(game);
  renderHUD();
}

/* ---------- update loop ---------- */
function update(dt) {
  game.time += dt;
  game.lastDt = dt;    // frame delta for frame-rate-independent subsystems (orbits)
  capEntities();       /* idea 90 */
  SFX.musicTick(dt);   /* ideas 75/76: zone music + boss layer */
  /* idea 62: playtime (only while actively playing) */
  if (G.phase === "play") { G.playtime += dt; STATS.playtime += dt; if (Math.random() < dt / 5) saveStats(); }
  game.shake = Math.max(0, game.shake - dt);
  G.hitStop = Math.max(0, G.hitStop - dt);                    // idea 1
  G.comboT = Math.max(0, G.comboT - dt);                       // idea 10
  if (G.comboT <= 0) G.combo = 0;
  G.invulnT = Math.max(0, (G.invulnT || 0) - dt);              // idea 4: grace window tick
  // God Run perk 1: shield regen every 5s
  if (G.difficulty === "godrun" && typeof isGodPerkUnlocked === "function" && isGodPerkUnlocked(1) && G.godShieldCd > 0) {
    G.godShieldCd = Math.max(0, G.godShieldCd - dt);
    if (G.godShieldCd === 0 && G.godShield === 0) {
      G.godShield = 1;
      flash("🛡️ SHIELD READY!", "#6fc3ff");
      SFX.pickup();
      renderHUD();
    }
  }
  for (const a of game.arcs || []) a.t -= dt;                  // idea 7: slash afterimages
  game.arcs = (game.arcs || []).filter(a => a.t > 0);
  if (game.player) {
    game.player.attackCd = Math.max(0, game.player.attackCd - dt);
    game.player.swing = Math.max(0, game.player.swing - dt);
    game.player.hurtT = Math.max(0, game.player.hurtT - dt);
    game.player.dashCd = Math.max(0, game.player.dashCd - dt);
    game.player.lavaT = Math.max(0, (game.player.lavaT || 0) - dt);
  }
  G.slowT = Math.max(0, G.slowT - dt);
  /* idea 14: stamina regen */
  if (G.stamina < STAMINA.max) G.stamina = Math.min(STAMINA.max, G.stamina + STAMINA.regen * dt);
  /* idea 15: charging heavy — hold the attack button, release to slam */
  if (G.charging && G.phase === "play" && game.player) {
    G.chargeT = Math.min(2, G.chargeT + dt);
    if (G.chargeT > 0.6 && G.chargeT - dt <= 0.6) flash("HEAVY READY — RELEASE!", "#ffd166");
  }
  /* idea 18: regenerating shield */
  G.shieldRegenT = Math.max(0, G.shieldRegenT - dt);
  if (G.shieldMax > 0 && G.shieldRegenT <= 0 && G.shield < G.shieldMax) {
    G.shield = Math.min(G.shieldMax, G.shield + 6 * dt);
  }
  for (const f of game.effects) { f.t -= dt; if (f.vx !== undefined) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 300 * dt; } }
  game.effects = game.effects.filter(f => f.t > 0);

  if (G.phase !== "play") return;

  /* idea 73: tutorial room runs its own flow */
  if (G.level === 0) { updateTutorial(); }

  /* idea 31: slow-mo cinematic scales down combat dt */
  let slowFactor = 1;
  if (G.slowmoT > 0) { G.slowmoT -= dt; slowFactor = 0.3; }
  const combatDt = (G.hitStop > 0 ? 0 : dt) * slowFactor;

  /* idea 34: ground AOE zones tick down then explode */
  for (const z of [...G.aoeZones]) {
    z.t -= combatDt;
    if (z.t <= 0) {
      explode(z.x, z.y, z.r, z.dmg);
      game.G.aoeZones.splice(game.G.aoeZones.indexOf(z), 1);
    }
  }

  /* chapter two: floor hazards — pools pulse burn, webs drag you slow */
  for (let i = game.hazardZones.length - 1; i >= 0; i--) {
    const z = game.hazardZones[i];
    z.t -= combatDt;
    const pl = game.player;
    if (pl && dist(z, pl) < z.r + pl.r * 0.5) {
      if (z.web) G.slowT = Math.max(G.slowT, 0.5);
      if (z.dps > 0) {
        z.tickT = (z.tickT || 0) - combatDt;
        if (z.tickT <= 0) { z.tickT = 0.55; damagePlayer(Math.max(1, Math.round(z.dps * 0.55)), z.x, z.y); }
      }
    }
    if (z.t <= 0) game.hazardZones.splice(i, 1);
  }

  /* movement: dash overrides input; chill slows */
  const p = game.player;
  const px0 = p.x, py0 = p.y;   /* chapter two: velocity sample for predictive foes */
  let dx = 0, dy = 0;
  const km = KM();
  if (keys[km.up] || keys["arrowup"]) dy -= 1;
  if (keys[km.down] || keys["arrowdown"]) dy += 1;
  if (keys[km.left] || keys["arrowleft"]) dx -= 1;
  if (keys[km.right] || keys["arrowright"]) dx += 1;
  /* idea 69: gamepad axes — throttled poll, getGamepads() allocates each call */
  gpPollT -= dt;
  if (gpPollT <= 0 || !lastGp) {
    gpPollT = 0.2;
    lastGp = navigator.getGamepads ? navigator.getGamepads().find(g => g && g.connected) || null : null;
  }
  const gp = lastGp;
  if (gp) {
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    if (Math.abs(ax) > 0.2) dx = Math.round(ax * 2) / 2;
    if (Math.abs(ay) > 0.2) dy = Math.round(ay * 2) / 2;
  }
  /* idea 70: touch joystick */
  if (joy.active) { dx = joy.dx; dy = joy.dy; }
  /* idea 74: low-HP vignette + heartbeat */
  const lowHp = G.hp / G.maxHp < 0.3;
  const vig = $("vignette");
  if (vig) {
    vig.classList.toggle("show", lowHp && G.phase === "play");
    if (lowHp && Math.random() < dt / 2.5) SFX.heartbeat();
  }
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    p.dir = Math.atan2(dy / len, dx / len);
  }
  /* idea 9: drop-in animation — fall from above, land with dust */
  if (p.dropT > 0) {
    p.dropT -= dt;
    p.y = clamp(p.dropY + (CFG.H / 2 - p.dropY) * (1 - p.dropT / 0.9), CFG.MARGIN, CFG.H - CFG.MARGIN);
    if (p.dropT <= 0) {
      for (let i = 0; i < 8; i++) {
        game.effects.push({ type: "spark", x: p.x, y: p.y + p.r, vx: (Math.random() - 0.5) * 160, vy: -rand(20, 90), t: 0.35, color: "#c9b458" });
      }
      game.shake = Math.max(game.shake, 0.08);
    }
    syncDashHud();
    return;
  }
  if (p.dashT > 0) {
    p.dashT -= combatDt;
    const sp = CFG.PLAYER.speed * CFG.DASH_SPEED;
    p.x = clamp(p.x + Math.cos(p.dashAng) * sp * combatDt, CFG.MARGIN, CFG.W - CFG.MARGIN);
    p.y = clamp(p.y + Math.sin(p.dashAng) * sp * combatDt, CFG.MARGIN, CFG.H - CFG.MARGIN);
  } else if (dx || dy) {
    const len = Math.hypot(dx, dy);
    const sp = CFG.PLAYER.speed * (G.slowT > 0 ? 0.55 : 1);
    p.x = clamp(p.x + (dx / len) * sp * combatDt, CFG.MARGIN, CFG.W - CFG.MARGIN);
    p.y = clamp(p.y + (dy / len) * sp * combatDt, CFG.MARGIN, CFG.H - CFG.MARGIN);
  }

  /* idea 69: gamepad buttons (A=attack, B=dash, X=potion, LB=pause) */
  if (gp) {
    if (gp.buttons[0] && gp.buttons[0].pressed && !game._gpA && p.attackCd <= 0) weaponAttack(game);
    if (gp.buttons[5] && gp.buttons[5].pressed && !game._gpRb && p.attackCd <= 0) secondaryAttack(game);
    if (gp.buttons[1] && gp.buttons[1].pressed && !game._gpB) tryDash();
    if (gp.buttons[2] && gp.buttons[2].pressed && !game._gpX) drinkPotion();
    if ((gp.buttons[4] && gp.buttons[4].pressed && !game._gpLb)) togglePause();
    game._gpA = gp.buttons[0] && gp.buttons[0].pressed;
    game._gpRb = gp.buttons[5] && gp.buttons[5].pressed;
    game._gpB = gp.buttons[1] && gp.buttons[1].pressed;
    game._gpX = gp.buttons[2] && gp.buttons[2].pressed;
    game._gpLb = gp.buttons[4] && gp.buttons[4].pressed;
  }

  /* attack fires on release (quick tap or charged heavy) — nothing here */

  /* idea 39: circle-vs-rect obstacle collision for the player */
  for (const o of game.obstacles || []) {
    if (circleRect(p.x, p.y, p.r, o)) {
      const nx = Math.max(o.x, Math.min(p.x, o.x + o.w));
      const ny = Math.max(o.y, Math.min(p.y, o.y + o.h));
      const dxp = p.x - nx, dyp = p.y - ny;
      const d = Math.hypot(dxp, dyp) || 1;
      p.x = nx + dxp / d * (p.r + 1);
      p.y = ny + dyp / d * (p.r + 1);
    }
  }

  /* chapter two: real velocity — hunters and the Storm Hunter aim where you're GOING */
  p.vx = combatDt > 0.0001 ? (p.x - px0) / combatDt : 0;
  p.vy = combatDt > 0.0001 ? (p.y - py0) / combatDt : 0;

  /* idea 41: hazard tiles — ice/lava/void */
  for (const h of game.hazards || []) {
    if (p.x > h.x && p.x < h.x + h.w && p.y > h.y && p.y < h.y + h.h) {
      if (h.type === "ice") { const s = 0.55; p.x += dx * -s * combatDt; p.y += dy * -s * combatDt; }
      else if (h.type === "lava") {
        G.slowT = Math.max(G.slowT, 0.8);
        if ((p.lavaT || 0) <= 0) { p.lavaT = 0.35; damagePlayer(4, p.x, p.y); }
        if (Math.random() < 0.05) flash("LAVA!", "#ff5a2a");
      }
      else if (h.type === "void") { G.slowT = Math.max(G.slowT, 1.4); }
    }
  }

  /* idea 46: spike traps cycle active/inactive */
  for (const t of game.traps || []) {
    t.t += combatDt;
    t.active = Math.sin(t.t * (Math.PI * 2) / t.cycle) > 0.15;
    if (t.active && dist(p, t) < p.r + t.r) damagePlayer(rand(6, 9), t.x, t.y);
  }

  /* idea 40: destructible crates */
  for (let i = game.crates ? game.crates.length - 1 : -1; i >= 0; i--) {
    const c = game.crates[i];
    if (c.hp <= 0) {
      dropLoot(c.x, c.y, false);
      game.effects.push({ type: "boom", x: c.x, y: c.y, t: 0.3 });
      game.crates.splice(i, 1);
    }
  }

  /* enemies */
  for (const e of game.enemies) e.update(combatDt, game);
  /* idea 39: keep enemies out of obstacles */
  for (const e of game.enemies) {
    for (const o of game.obstacles || []) {
      if (circleRect(e.x, e.y, e.r, o)) {
        const nx = Math.max(o.x, Math.min(e.x, o.x + o.w));
        const ny = Math.max(o.y, Math.min(e.y, o.y + o.h));
        const dxe = e.x - nx, dye = e.y - ny;
        const d = Math.hypot(dxe, dye) || 1;
        e.x = nx + dxe / d * (e.r + 1);
        e.y = ny + dye / d * (e.r + 1);
      }
    }
  }

  /* keep foes from stacking into one blob */
  for (let i = 0; i < game.enemies.length; i++) {
    for (let j = i + 1; j < game.enemies.length; j++) {
      const a = game.enemies[i], b = game.enemies[j];
      const d = dist(a, b), min = a.r + b.r;
      if (d > 0 && d < min) {
        const push = (min - d) / 2 / d;
        const ox = (a.x - b.x) * push, oy = (a.y - b.y) * push;
        a.x += ox; a.y += oy;
        b.x -= ox; b.y -= oy;
      }
    }
  }
  for (const e of game.enemies) e.clamp();

  /* projectiles */
  game.projectiles = game.projectiles.filter(pr => !pr.update(combatDt, game));

  /* waves */
  game.waves = game.waves.filter(w => !w.update(combatDt, game));

  /* idea 53: deployables — turrets fire, traps hold foes */
  game.deployables = game.deployables || [];
  for (let i = game.deployables.length - 1; i >= 0; i--) {
    const d = game.deployables[i];
    if (d.kind === "turret") {
      d.ttl -= combatDt;
      let target = null, best = 1e9;
      for (const e of game.enemies) {
        const dd = dist(d, e);
        if (dd < 260 && dd < best) { best = dd; target = e; }
      }
      if (target) {
        d.rate = (d.rate === undefined ? 0 : d.rate) - combatDt;
        if (d.rate <= 0) {
          d.rate = 0.35;
          const ang = Math.atan2(target.y - d.y, target.x - d.x);
          game.projectiles.push(new Projectile("player", d.x, d.y, Math.cos(ang) * 380, Math.sin(ang) * 380, 4, 5, "#8fd4ff"));
        }
      }
      if (d.ttl <= 0) game.deployables.splice(i, 1);
    } else if (d.kind === "trap" && !d.hitOnce) {
      for (const e of game.enemies) {
        if (dist(d, e) < e.r + 14) {
          e.hp -= d.dmg;
          e.hurtT = 0.2;
          e.knock = 0;
          d.hitOnce = true;
          game.effects.push({ type: "hit", x: e.x, y: e.y - 10, t: 0.3, txt: d.dmg, color: "#e8d17a" });
          if (e.hp <= 0) killEnemy(e);
          flash("TRAP!", "#e8d17a");
          break;
        }
      }
    }
  }

  /* idea 49: staff burning ground */
  game.burnZones = game.burnZones || [];
  for (let i = game.burnZones.length - 1; i >= 0; i--) {
    const z = game.burnZones[i];
    z.t -= combatDt;
    for (const e of [...game.enemies]) {
      if (dist({ x: z.x, y: z.y }, e) < z.r + e.r) {
        e.hp -= 2 * combatDt;
        e.hurtT = 0.1;
        if (e.hp <= 0) killEnemy(e);
      }
    }
    game.effects.push({ type: "spark", x: z.x + (Math.random() - 0.5) * z.r * 2, y: z.y + (Math.random() - 0.5) * z.r * 2, vx: 0, vy: -rand(20, 60), t: 0.3, color: "#ff8b3d" });
    if (z.t <= 0) game.burnZones.splice(i, 1);
  }

  /* idea 49: sword parry window — negate contact damage */
  game.parryT = Math.max(0, (game.parryT || 0) - combatDt);

  /* pickups */
  for (const l of game.G.loot) l.t += dt;
  for (let i = game.G.loot.length - 1; i >= 0; i--) {
    if (dist(game.G.loot[i], p) < 26) { pickup(game.G.loot[i]); game.G.loot.splice(i, 1); }
  }

  /* door — level clear. Level 2 offers a path choice; every level offers an OPTIONAL shop.
     No screen-blocking reward popup: the player opts in or presses on.
     idea 19: phase guard — dying on the same frame must never trigger the clear screen. */
  const d = game.G.door;
  if (G.phase === "play" && d && d.open && G.level !== 0 && dist(p, d) < 34) {
    if (G.level === 2 && !G.branchChosen) {
      G.branchChosen = true;
      d.open = false;
      G.phase = "branch";
      showOverlay("🌳 THE PATH DIVIDES", "Two ways forward:", null, null, [
        { label: "⚔️ COMBAT PATH — +LOOT, harder", fn: () => { G.branchBonus = "combat"; nextLevel(); } },
        { label: "🛒 SHOP PATH — merchant ahead", fn: () => { G.branchBonus = "shop"; nextLevel(); openShop(); } },
      ]);
    } else {
      G.phase = "clear";
      showOverlay("⚑ LEVEL CLEAR", "The door is open.", null, null, [
        { label: "➡️ NEXT LEVEL", fn: nextLevel, primary: true },
        { label: "🛒 VISIT SHOP", fn: () => { G.phase = "play"; openShop(); } },
      ]);
    }
    return;
  }

  /* idea 47: shrine — pay HP for buff / gamble gold */
  const sh = game.shrine;
  if (sh && !sh.used && dist(p, sh) < 40 && keys["e"]) {
    sh.used = true;
    if (G.gold >= 50 && Math.random() < 0.5) {
      G.gold -= 50; G.atk += 2; flash("SHRINE: +2 ATK", "#ffd166");
    } else if (G.gold >= 50) {
      G.gold -= 50; flash("SHRINE: -50G", "#ff8b3d");
    } else {
      G.hp = Math.max(1, G.hp - 15); if (canIncreaseMaxHp()) { G.maxHp += 10; flash("SHRINE: -15 HP → +10 MAX", "#6bff9a"); } else { flash("Max HP locked on EXTREME", "#9a90b8"); }
    }
    game.effects.push({ type: "boom", x: sh.x, y: sh.y, t: 0.5 });
    renderHUD();
  }

  syncDashHud();
  updateBossBar();
  updateObjHint();
}

/* idea 15: live objective chip — foes left / boss name, cached to avoid DOM churn */
let objCache = "";
function updateObjHint() {
  const el = $("objHint");
  if (!el) return;
  let txt = "";
  if (G.phase === "play" && G.level > 0) {
    const boss = game.enemies.find(e => e.isBoss && !e.dead);
    if (boss) txt = `👑 ${boss.name}`;
    else if (game.G.bossSpawned) txt = "👑 BOSS INCOMING";
    else if (game.G.minionsLeft > 0) txt = `☠ FOES LEFT: ${game.G.minionsLeft}`;
  }
  if (txt !== objCache) { objCache = txt; el.textContent = txt; el.classList.toggle("show", !!txt); }
}

/* idea 33: boss HP bar pinned to top of HUD */
let bossBarNameCache = "";                                    // perf: skip redundant DOM writes
function updateBossBar() {
  const bar = $("bossBar");
  if (!bar) return;
  const boss = game.enemies.find(e => e.isBoss && !e.dead);
  const fill = $("bossBarFill");
  if (!boss) { bar.classList.remove("show"); return; }
  bar.classList.add("show");
  if (boss.name !== bossBarNameCache) { bossBarNameCache = boss.name; $("bossBarName").textContent = boss.name; }
  fill.style.width = Math.max(0, boss.hp / boss.maxHp * 100) + "%";
}

/* ---------- flow ---------- */
function die() {
  /* PHOENIX GEM: rise once per run — the artifact finally keeps its promise */
  if (G.revives > 0) {
    G.revives--;
    G.hp = G.maxHp;
    G.invulnT = 2.5;
    G.shield = G.shieldMax;
    flash("🔮 PHOENIX GEM — you rise again!", "#ff8b3d");
    SFX.levelup && SFX.levelup();
    game.shake = Math.max(game.shake, 0.3);
    game.effects.push({ type: "ring", x: game.player.x, y: game.player.y, r: 60, t: 0.8, color: "#ff8b3d" });
    renderHUD();
    return;
  }
  G.phase = "dead";
  STATS.deaths++;
  recordDeath();      /* idea 99: opt-in telemetry */
  saveStats();
  /* idea 19: earn ember essence on death, spend at the shrine */
  G.meta.essence += Math.max(1, Math.floor(G.kills / 3));
  saveGame();
  showOverlay("☠️ YOU FELL", `You felled <b>${G.kills}</b> foes. The embers fade... but the story can be relived.<br>Earned <b style="color:#c084fc">${G.meta.essence} ember essence</b>.`, null, null, [
    { label: "🕯️ VISIT THE EMBER SHRINE", fn: openShrine },
    { label: "🔄 TRY AGAIN", fn: restartRun, primary: true },
    { label: "🏠 MAIN MENU", fn: resetGame },
  ]);
}

/* idea 19: shrine — spend ember essence on permanent meta-upgrades */
function openShrine() {
  const lvls = G.meta.lvls;
  const buttons = META_UPGRADES.map(u => {
    const cur = lvls[u.key] || 0;
    const cost = Math.round(u.cost * (1 + cur * 0.6));
    const disabled = cur >= u.max || G.meta.essence < cost;
    return { label: `🕯️ ${u.name} — ${u.desc} (Lv${cur}/${u.max})`, disabled,
      note: disabled ? (cur >= u.max ? "MAXED" : `${cost} essence needed`) : `${cost} essence`,
      fn: () => { G.meta.essence -= cost; lvls[u.key] = cur + 1; flash(`${u.name} Lv${cur + 1}!`, "#c084fc"); saveGame(); openShrine(); } };
  });
  buttons.push({ label: "↩️ CLOSE SHRINE", fn: () => { G.phase = "menu"; resetGame(); } });
  G.phase = "shop";
  showOverlay("🕯️ THE EMBER SHRINE", `Permanent blessings for every future run.<br><b style="color:#c084fc">Essence: ${G.meta.essence}</b>`, null, null, buttons);
}

/* ---------- save / load (idea 57) ---------- */
const SAVE_KEY = "blobknight.save";
function saveGame() {
  try {
    const save = {
      name: G.name, className: G.className, meta: G.meta,
      level: G.level, hp: G.hp, maxHp: G.maxHp, atk: G.atk, def: G.def,
      gold: G.gold, potions: G.potions, sword: G.sword, armor: G.armor,
      crit: G.crit, perks: G.perks, artifact: G.artifact, wLevels: G.wLevels,
      weapons: game.weapons, weapon: game.weapon, secondary: game.secondary,
      bombs: G.bombs, turrets: G.turrets, traps: G.traps,
    };
    /* idea 96: cloud save when Steam is present, else localStorage */
    if (!STEAM.save(JSON.stringify(save))) localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (e) { /* storage unavailable — degrade silently */ }
}
function loadGame() {
  try {
    let raw = typeof STEAM !== "undefined" && STEAM.available ? STEAM.load() : null;
    if (!raw) raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    Object.assign(G, s);
    game.weapons = s.weapons || ["sword"];
    game.weapon = s.weapon || "sword";
    game.secondary = s.secondary || null;
    return true;
  } catch (e) { return false; }
}
function continueRun() {
  if (!loadGame()) { flash("No saved run found", "#9a90b8"); resetGame(); return; }
  SFX.unlock();
  hideOverlay();
  setTouchUI(true);
  setupLevel(G.level);
  G.phase = "play";
  renderHUD();
}

/* idea 65: credits */
function showCredits() {
  showOverlay("ℹ️ CREDITS", `<b>${CFG.TITLE}</b> — a ${MAX_LEVEL}-depth action RPG (v${CFG.VERSION})<br>Made with vanilla JavaScript + Canvas.<br>Code, design, and synth SFX by you.<br>Music: procedural synth loops.<br><br>Thanks for playing!`, "⬅ BACK", resetGame);
}

/* dedicated help / info panel — long-form text lives here, off the HUD */
function showHelp() {
  const back = G.phase === "paused" ? openPauseMenu : resetGame;
  showOverlay("❓ HELP", `
    <b>KEYBOARD</b><br>
    Move <span class="kbd">WASD</span> / arrows · Sword <span class="kbd">SPACE</span> (hold = heavy) · Ranged <span class="kbd">R</span>/right-click · Dash <span class="kbd">SHIFT</span> · Potion <span class="kbd">E</span> · Bomb <span class="kbd">F</span> · Turret <span class="kbd">G</span> · Trap <span class="kbd">T</span> · Cycle ranged <span class="kbd">Q</span>/<span class="kbd">1-4</span> · Pause <span class="kbd">P</span> · Sound <span class="kbd">M</span><br><br>
    <b>TOUCH</b><br>
    Drag the joystick to move. Buttons: sword, ranged, bomb, dash, potion, cycle, pause.<br><br>
    <b>TIPS</b><br>
    • Hold SPACE to charge a HEAVY SLAM.<br>
    • A well-timed sword swing PARRYS contact damage.<br>
    • Certain lands fear fire, ice, or lightning — pick weapons to match.<br>
    • Smash crates: they hide gold, loot, and lore scrolls.<br>
    • Ranged weapons fire on <span class="kbd">R</span> — the sword stays at the ready.<br><br>
    <b>THE ${MAX_LEVEL} DEPTHS</b><br>
    Slay every foe to open the door, then spend gold at the merchant. Clear all ${MAX_LEVEL} depths.`,
    "⬅ BACK", back);
}

/* idea 73: tutorial room 0 with floating prompts */
const TUTORIAL_STEPS = [
  "MOVE — walk to the dummies",
  "KILL BOTH DUMMIES",
];
function runTutorial() {
  hideOverlay();
  setTouchUI(true);
  G.phase = "play";
  G.level = 0;
  game.player = new Player(CFG.MARGIN + 60, CFG.H / 2);
  game.player.dropT = 0;
  game.enemies = [];
  game.projectiles = []; game.waves = []; game.effects = []; game.arcs = [];
  game.G.loot = [];
  game.G.bossSpawned = true;   // no boss spawn for dummies
  game.G.minionsLeft = 2;
  const dummy = Object.assign({}, ENEMY_TYPES.brute, { name: "TRAINING DUMMY", hp: 14, maxHp: 14, speed: 0, dmg: [1, 1] });
  const d1 = new Enemy(Object.assign({}, dummy), CFG.W / 2 - 40, CFG.H / 2);
  const d2 = new Enemy(Object.assign({}, dummy), CFG.W / 2 + 50, CFG.H / 2 + 20);
  game.enemies.push(d1, d2);
  game.tutStep = 0;
  updateTutHint();
}
function updateTutHint() {
  const el = $("tutHint");
  if (!el) return;
  el.textContent = TUTORIAL_STEPS[Math.min(game.tutStep, TUTORIAL_STEPS.length - 1)];
  el.classList.add("show");
}
function updateTutorial() {
  const p = game.player;
  if (!p) return;
  if (game.tutStep === 0 && game.player.dashT <= 0 && (keys[KM().right] || keys["arrowright"] || keys["d"] || joy.dx !== 0)) game.tutStep = 1;
  /* end as soon as both dummies are slain */
  if (game.tutStep === 1 && game.G.minionsLeft <= 0 && G.kills >= 2) {
    G.level = 1;
    beginGame();
    return;
  }
  updateTutHint();
}

function winGame() {
  G.phase = "won";
  STATS.wins++;
  if (G.bossRush) STATS.unlocked["bossrush"] = true;
  saveStats();
  checkAchievements();
  // God Run perk unlock — Normal wins unlock in order 3 → 4 → 1 → 2, only for God Run
  if (G.difficulty === "normal") {
    const next = nextGodPerk();
    if (next) {
      GOD_PERKS.unlocked.push(next);
      saveGodPerks();
      const perk = GODRUN_PERKS[next];
      flash(`🏆 GOD RUN PERK UNLOCKED: ${perk.icon} ${perk.name}!`, "#ffd166");
      SFX.levelup();
    }
  }
  /* idea 86: ending epilogue varies by performance */
  const grade = G.grade || "C";
  const tier =
    grade === "S" ? ["the Sovereign falls with barely a scratch. Chroniclers will call it a legend.",
                    "The Emberfell spark kindles anew — the world remembers you as its brightest fire."]
    : grade === "A" ? ["the throne shatters, though the fight left its mark. Bards argue over the details.",
                       "The realms rebuild, warmed by a stubborn little flame."]
    : grade === "B" ? ["the Sovereign is cast down — a hard-won victory, stitched and scarred.",
                       "The realms rebuild slowly, but they rebuild."]
    : ["the Sovereign falls, and you limp from the throne with more ash than pride.",
       "Even dim embers can win the day. The realms hold on."];
  if (G.ngPlus) {
    showOverlay("🏆 BLOB KNIGHT COMPLETE — NEW GAME +",
      `Grade <b>${grade}</b> · ${G.kills} foes felled.<br>${tier[0]}<br>${tier[1]}<br><br>🜂 A <b>SECRET DOOR</b> creaks open beyond the throne…`, null, null, [
        { label: "🜂 ENTER THE VOID THRONE", fn: startVoidThrone, primary: true },
        { label: "🏠 MAIN MENU", fn: resetGame },
      ]);
  } else {
    showOverlay("🏆 BLOB KNIGHT COMPLETE",
      `Grade <b>${grade}</b> · ${G.kills} foes felled.<br>${tier[0]}<br>${tier[1]}`, null, null, [
        { label: "🏆 PLAY AGAIN", fn: resetGame, primary: true },
        { label: "🏠 MAIN MENU", fn: resetGame },
      ]);
  }
}

/* idea 88: post-credits secret 7th level — unlocked after a New Game+ victory */
function startVoidThrone() {
  STATS.unlocked["voidthrone"] = true;
  saveStats();
  G.ngPlus = true;
  G.victories = (G.victories || 0) + 1;
  setupLevel(11);
  G.phase = "play";
  hideOverlay();
  flash("🜂 VOID THRONE — the true ending awaits", "#c2553d");
}

function openShop() {
  G.phase = "shop";
  const owned = game.weapons;
  const hasArtifact = !!G.artifact;
  const newWeapons = ["spear", "boomerang", "orbs", "chain"].filter(w => !owned.includes(w));
  const merchantLine = MERCHANT_LINES[rand(0, MERCHANT_LINES.length - 1)];   // idea 84
  const g = c => `${shopPrice(c)}g`;
  const afford = c => G.gold >= shopPrice(c);
  showOverlay("🛒 CAMPFIRE MERCHANT", `Level ${G.level}/${MAX_LEVEL} · <b>${G.gold}g</b><br><span class="merchant">“${merchantLine}”</span>`, null, null, [
    { label: `🧪 POTION`, note: `${g(40)} — +1`, fn: buyPotion, disabled: !afford(40) },
    { label: `🍵 FULL HEAL`, note: `${g(30)} — HP to max`, fn: buyHeal, disabled: !afford(30) || G.hp >= G.maxHp },
    { label: `⚔️ ATK +2`, note: g(80), fn: buyAttack, disabled: !afford(80) },
    { label: `🛡️ DEF +2`, note: g(100), fn: buyArmor, disabled: !afford(100) },
    { label: `🔮 ARTIFACT`, note: hasArtifact ? `HAS ${G.artifact}` : `${g(180)} — One trinket`, fn: buyArtifact, disabled: hasArtifact || !afford(180) },
    { label: `💣 BOMBS x3`, note: g(60), fn: buyBombs, disabled: !afford(60) },
    { label: `🤖 TURRET`, note: `${g(140)} — G`, fn: buyTurret, disabled: !afford(140) },
    { label: `🪤 TRAP`, note: `${g(90)} — T`, fn: buyTrap, disabled: !afford(90) },
    { label: `☠️ CURSED`, note: g(100), fn: buyCursed, disabled: !afford(100) },
    ...newWeapons.map(w => ({ label: `${WEAPONS[w].icon} ${WEAPONS[w].name}`, note: `${g(WEAPONS[w].cost)} — ${WEAPONS[w].desc}`, fn: buyWeapon.bind(null, w), disabled: !afford(WEAPONS[w].cost) })),
    { label: `🌊 WAVE BLADE`, note: owned.includes("wave") ? "OWNED" : `${g(150)} — Shockwave`, fn: buyWeapon.bind(null, "wave"), disabled: owned.includes("wave") || !afford(150) },
    { label: `🏹 CROSSBOW`, note: owned.includes("crossbow") ? "OWNED" : `${g(200)} — Fast bolts`, fn: buyWeapon.bind(null, "crossbow"), disabled: owned.includes("crossbow") || !afford(200) },
    { label: `🔥 EMBER STAFF`, note: owned.includes("staff") ? "OWNED" : `${g(300)} — Fireball`, fn: buyWeapon.bind(null, "staff"), disabled: owned.includes("staff") || !afford(300) },
    { label: `🔀 REROLL`, note: `30g`, fn: rerollShop, disabled: G.gold < 30 },
    { label: `➡️ NEXT DOOR`, fn: nextLevel, primary: true },
    { label: `⬅️ BACK`, fn: resumePlay },
  ]);
  checkSetBonus();   // idea 55
}

/* idea 56: reroll — 25% off everything next visit */
let rerolled = false;
function rerollShop() {
  G.gold -= 30;
  rerolled = true;
  flash("REROLL: 25% OFF", "#6bff9a");
  openShop();
}
function shopPrice(cost) { return Math.round(cost * (rerolled ? 0.75 : 1)); }

function buyPotion() { G.gold -= shopPrice(40); G.potions++; SFX.buy(); flash("Bought potion"); renderHUD(); openShop(); }
function buyHeal()   { G.gold -= shopPrice(30); G.hp = G.maxHp; SFX.buy(); flash("Fully healed!", "#6bff9a"); renderHUD(); openShop(); }
function buyAttack() { G.gold -= shopPrice(80); G.atk += 2; G.sword++; SFX.buy(); flash("ATK +2"); renderHUD(); openShop(); }
function buyArmor()  { G.gold -= shopPrice(100); G.def += 2; G.armor++; SFX.buy(); flash("DEF +2"); renderHUD(); openShop(); }
function buyBombs()  { G.gold -= shopPrice(60); G.bombs = (G.bombs || 0) + 3; SFX.buy(); flash("+3 bombs (F)"); renderHUD(); openShop(); }
function buyTurret() { G.gold -= shopPrice(140); G.turrets = (G.turrets || 0) + 1; SFX.buy(); flash("+1 turret (G)"); renderHUD(); openShop(); }
function buyTrap()   { G.gold -= shopPrice(90); G.traps = (G.traps || 0) + 1; SFX.buy(); flash("+1 bear trap (T)"); renderHUD(); openShop(); }
function buyCursed() {
  const c = CURSED_ITEMS[rand(0, CURSED_ITEMS.length - 1)];
  G.gold -= shopPrice(100);
  c.apply();
  flash(`CURSED: ${c.name} — ${c.desc}`, "#c084fc");
  renderHUD();
  openShop();
}

/* idea 55: set bonus check */
function checkSetBonus() {
  const owned = game.weapons;
  const hasCharm = G.perks.includes("REAPER") || G.crit > 0.1;
  for (const s of ITEM_SETS) {
    const haveAll = s.items.every(it => it === "charm" ? hasCharm : owned.includes(it));
    if (haveAll && !s.active) {
      s.active = true;
      if (s.id === "ember") G.crit += 0.15;
      if (s.id === "frost") G.def += 2;
      flash(`SET BONUS: ${s.bonus}`, "#ffd166");
    }
  }
}

function buyArtifact() {
  const opts = ARTIFACTS.filter(a => a.name !== G.artifact);
  showOverlay("🔮 CHOOSE AN ARTIFACT", "One passive trinket to carry you through the realm:", null, null,
    opts.map(a => ({ label: `${a.name} — ${a.desc}`, fn: () => { G.gold -= 180; G.artifact = a.name; a.apply(); SFX.buy(); flash(`ARTIFACT: ${a.name}!`, "#c084fc"); renderHUD(); openShop(); } })));
}

function buyWeapon(w) {
  G.gold -= WEAPONS[w].cost;
  game.weapons.push(w);
  game.secondary = w;
  SFX.buy();
  flash(`UNLOCKED ${WEAPONS[w].icon} ${WEAPONS[w].name}! (R to fire)`, "#6fc3ff");
  renderHUD();
  openShop();
}

function nextLevel() {
  hideOverlay();
  setTouchUI(true);
  rerolled = false;   // merchant discount lasts one visit
  const n = G.level + 1;
  if (n > MAX_LEVEL) return winGame();
  G.sword++; G.atk += 3; if (canIncreaseMaxHp()) { G.maxHp += 20; G.hp = G.maxHp; } else { G.hp = Math.min(G.maxHp, G.hp + 20); } G.potions++;
  G.slowT = 0;
  setupLevel(n);
  G.phase = "play";
  SFX.levelup();
  flash(`LEVEL CLEAR! ⚔️+1 ❤️+20 🧪+1`, "#6bff9a");
}

function resumePlay() { hideOverlay(); G.phase = "play"; setTouchUI(true); }

/* ---------- options menu (ideas 65-68, 71-72) — also the menu hub ---------- */
function openOptions() {
  G.phase = G.phase === "paused" ? "paused" : "options";
  /* idea 20: class picker lives here (menu stays minimal) */
  const classBtns = CLASSES.map(c => ({
    label: `${c.icon} ${c.name} — ${c.desc}`, primary: c.name === G.className,
    fn: () => { G.className = c.name; flash(`Class: ${c.name}`, "#6fc3ff"); openOptions(); },
  }));
  const extras = [
    { label: "💀 BOSS RUSH", fn: startBossRush, note: `${MAX_LEVEL} bosses back to back` },    // idea 36
    { label: "☀️ DAILY CHALLENGE", fn: startDaily, note: "Seeded run of the day" },              // idea 61
    { label: "📊 STATS", fn: showStats },                                                        // idea 62
    { label: "📖 BESTIARY", fn: showBestiary },                                                  // idea 63
    { label: "🏅 ACHIEVEMENTS", fn: showAchievements },                                          // idea 64
    { label: "📜 JOURNAL", fn: showJournal, note: `${G.loreNotes.length}/${LORE_NOTES.length} notes` },  // idea 85
    { label: "☠️ TELEMETRY", fn: showTelemetry },                                               // idea 99
    { label: "❓ HELP", fn: showHelp },
    { label: "ℹ️ CREDITS", fn: showCredits },                                                   // idea 65
  ];
  if (G.doubleBossUnlocked) extras.unshift({ label: "⚔️ DOUBLE BOSS", fn: startDoubleBoss, note: "Twins challenge" });  // idea 37
  const zoomOpt = () => `${SCREEN_SIZES[SETTINGS.zoom] ? SCREEN_SIZES[SETTINGS.zoom].label : SETTINGS.zoom}`;
  showOverlay("⚙️ SETTINGS", "Settings apply immediately.", null, null, [
    { label: `🔊 VOLUME: ${Math.round(SETTINGS.vol * 100)}%`, fn: () => { SETTINGS.vol = Math.round((SETTINGS.vol + 0.1) * 10) / 10; if (SETTINGS.vol > 1) SETTINGS.vol = 0; saveSettings(); SFX.pickup(); openOptions(); } },
    { label: `💥 SCREEN SHAKE: ${SETTINGS.shake ? "ON" : "OFF"}`, fn: () => { SETTINGS.shake = SETTINGS.shake ? 0 : 1; saveSettings(); openOptions(); } },
    { label: `🔍 SCREEN SIZE: ${zoomOpt()}`, fn: () => { const ks = Object.keys(SCREEN_SIZES); const i = Math.max(0, ks.indexOf(String(SETTINGS.zoom))); SETTINGS.zoom = Number(ks[(i + 1) % ks.length]); saveSettings(); applyZoom(); openOptions(); } },
    { label: `⌨️ REBIND: ATTACK (${SETTINGS.keymap.attack.toUpperCase()})`, fn: () => { flash("Press a key to rebind ATTACK...", "#6fc3ff"); window._rebind = "attack"; hideOverlay(); } },
    { label: `⌨️ REBIND: RANGED (${SETTINGS.keymap.secondary.toUpperCase()})`, fn: () => { flash("Press a key to rebind RANGED...", "#6fc3ff"); window._rebind = "secondary"; hideOverlay(); } },
    { label: `⌨️ REBIND: DASH (${SETTINGS.keymap.dash.toUpperCase()})`, fn: () => { flash("Press a key to rebind DASH...", "#6fc3ff"); window._rebind = "dash"; hideOverlay(); } },
    ...classBtns,
    ...extras,
    { label: `⬅️ BACK`, fn: G.phase === "paused" ? openPauseMenu : resetGame },
  ]);
}
function showGodPerks() {
  const order = GODRUN_ORDER;
  const rows = order.map(id => {
    const perk = GODRUN_PERKS[id];
    const unlocked = isGodPerkUnlocked(id);
    const next = nextGodPerk();
    const isNext = next === id && !unlocked;
    const status = unlocked ? "UNLOCKED" : isNext ? "NEXT" : "LOCKED";
    const statusIcon = unlocked ? "✅" : isNext ? "🔓" : "🔒";
    const statusColor = unlocked ? "#6bff9a" : isNext ? "#ffd166" : "#9a90b8";
    const req = isNext ? "Complete Normal Mode" : unlocked ? "Active in God Run" : `Unlock ${GODRUN_PERKS[next]?.name || "previous"} first`;
    const active = unlocked && G.difficulty === "godrun" ? `<br><span style="color:#6fc3ff; font-size:11px;">● ACTIVE NOW</span>` : "";
    return `<div style="text-align:center; padding:10px 0; border-bottom:1px solid #1e1a33; margin:0 12px;">
      <div style="font-weight:bold; letter-spacing:1px;">${perk.icon} ${perk.name}</div>
      <div style="color:#c8c0d8; font-size:12px; margin:2px 0;">${perk.desc}</div>
      <div style="color:${statusColor}; font-weight:bold; font-size:11px; letter-spacing:1.5px;">${statusIcon} ${status}</div>
      <div style="color:#9a90b8; font-size:11px;">${req}</div>${active}
    </div>`;
  }).join("");
  const progress = `<div style="text-align:center; margin-bottom:14px; color:#9a90b8; font-size:12px; letter-spacing:1px;">Progress: ${GOD_PERKS.unlocked.length}/4 — Order: 3 → 4 → 1 → 2</div>`;
  showOverlay("🌀 GOD RUN PERKS", progress + `<div style="display:flex; flex-direction:column; gap:2px;">${rows}</div>`, "⬅ BACK", resetGame);
}
function openPauseMenu() {
  showOverlay("⏸ PAUSED", "", null, null, [
    { label: "▶ RESUME", fn: resumePaused, primary: true },
    { label: "🔄 RESTART LEVEL", fn: () => { setupLevel(G.level); resumePaused(); } },
    { label: "🔄 RESTART RUN", fn: restartRun },
    { label: "🌀 GOD RUN PERKS", fn: showGodPerks },
    { label: "⚙️ OPTIONS", fn: openOptions },
    { label: "⚙️ DIFFICULTY", fn: openDifficultyMenu },
    { label: "❓ HELP", fn: showHelp },
    { label: "🏠 QUIT TO MENU", fn: resetGame },
  ]);
}

/* idea 68: key rebinding capture */
addEventListener("keydown", ev => {
  if (window._rebind) {
    const action = window._rebind;
    window._rebind = null;
    const k = ev.key.toLowerCase();
    if (k !== "escape") { SETTINGS.keymap[action] = k; saveSettings(); flash(`Rebound ${action.toUpperCase()} → ${k.toUpperCase()}`, "#6bff9a"); }
    openOptions();
    ev.preventDefault();
  }
});

/* idea 84: campfire merchant dialogue */
const MERCHANT_LINES = [
  "Gold spent is gold remembered.",
  "Found a spear in the last crypt — barely used it. Honest.",
  "I've seen your kind before. They don't come back.",
  "That cursed trinket? It pays the rent. Try it if you dare.",
  "Fresh potions. The mushrooms were VERY cooperative.",
  "The void's prices only go up, friend.",
  "Rumor says a hidden door waits beyond the throne…",
];

/* idea 85: collectible lore notes → journal */
const LORE_NOTES = [
  { id: "emberfell", title: "The Emberfell", text: "A burning star fell in the first age. Where it struck, the ten depths grew. Its last spark still smoulders beneath the Void Throne." },
  { id: "goblin", title: "Goblin of Fangmoor", text: "The Chieftain claims the forest by tooth and torch. His kin fear the deep woods — he does not. That is why he rules." },
  { id: "cave", title: "Echo of the Caves", text: "Cave singers learned to shape stone with song. Their final chord collapsed the gates behind the Hollow Warden." },
  { id: "ruins", title: "Ruin of the First Order", text: "The First Order built the throne to contain the Sovereign. They forgot that thrones can be seized, not just built." },
  { id: "crypt", title: "Crypt Keeper's Vow", text: "I, Keeper Vess, vow to hold the dead below the dead. The Grand Reaper reminds me nightly of this promise." },
  { id: "molten", title: "Molten Heart", text: "The Volcano is the Emberfell's echo, not its source. What thrashes inside is older — and far less patient." },
  { id: "void", title: "Sealed Epitaph", text: "Here lies the last door. Beyond it, the throne. Do not knock politely — the Sovereign answers." },
];
function addLoreNote(id) {
  const n = LORE_NOTES.find(x => x.id === id);
  if (!n || G.loreNotes.includes(id)) return;
  G.loreNotes.push(id);
  flash(`📜 LORE FOUND: ${n.title}`, "#ffd166");
  SFX.pickup();
}
function showJournal() {
  const rows = G.loreNotes.length === 0
    ? "The pages are blank. Lore scrolls hide inside crates — smash them all."
    : G.loreNotes.map(id => {
        const n = LORE_NOTES.find(x => x.id === id);
        return `<b>📜 ${n.title}</b><br><span class="merchant">${n.text}</span><br><br>`;
      }).join("");
  showOverlay("📖 JOURNAL", rows, "⬅ BACK", resetGame);
}

/* idea 89: auto-pause when the tab loses focus */
document.addEventListener("visibilitychange", () => {
  if (document.hidden && G.phase === "play") togglePause();
});

/* idea 90: entity caps so low-end machines hold 60fps */
const CAPS = { enemies: 55, projectiles: 220, effects: 320 };
function capEntities() {
  /* idea 90: entity caps so low-end machines hold 60fps */
  if (game.enemies.length > CAPS.enemies) {
    /* drop non-bosses first — never cull a boss mid-fight */
    const keep = game.enemies.filter(e => e.isBoss);
    const drop = game.enemies.filter(e => !e.isBoss);
    drop.length = Math.max(0, CAPS.enemies - keep.length);
    game.enemies = keep.concat(drop);
  }
  if (game.projectiles.length > CAPS.projectiles) game.projectiles.length = CAPS.projectiles;
  if (game.effects.length > CAPS.effects) game.effects.length = CAPS.effects;
  if (game.G.loot.length > 80) game.G.loot.length = 80;
}

/* idea 92: global error handler with a friendly overlay */
window.addEventListener("error", ev => {
  const o = $("overlay");
  if (o) {
    o.innerHTML = `<h2>💥 THE BLOB BURST</h2>
      <p>Something crashed the game. Sorry, hero.<br>
      <span class="merchant">${String(ev.message || ev.error).slice(0, 180)}</span></p>`;
    const b = document.createElement("button");
    b.className = "btn"; b.textContent = "↻ RESTART";
    b.onclick = () => location.reload();
    o.appendChild(b);
    o.style.display = "flex";
  }
});

/* ---------- pause & sound ---------- */
function togglePause() {
  if (G.phase === "play") {
    G.phase = "paused";
    saveGame();
    openPauseMenu();
  } else if (G.phase === "paused") {
    resumePaused();
  }
}

/* idea 59: difficulty settings */
function openDifficultyMenu() {
  const returnToMenu = G.phase === "menu";
  showOverlay("⚙️ DIFFICULTY", "Enemy power scaling:", null, null,
    Object.entries(DIFFICULTIES).map(([key, d]) => ({
      label: `${d.name} — ${d.desc}`, primary: G.difficulty === key,
      fn: () => { G.difficulty = key; flash(`Difficulty: ${d.name}`, "#6fc3ff"); if (returnToMenu) resetGame(); else togglePause(); },
    })));
}
function resumePaused() { hideOverlay(); G.phase = "play"; setTouchUI(true); }

function toggleMute() {
  G.mute = !G.mute;
  flash(G.mute ? "🔇 SOUND OFF" : "🔊 SOUND ON", "#9a90b8");
}

function resetGame() {
  const meta = G.meta;
  const cls = G.className;
  Object.assign(G, {
    phase: "menu", hp: 100, maxHp: 100, atk: 10, def: 4, gold: 0, potions: 2,
    sword: 1, armor: 1, kills: 0, crit: 0, godMode: false, slowT: 0, level: 1,
    bombs: 0, turrets: 0, traps: 0, invulnT: 0,
    door: null, loot: [], bossSpawned: false, minionsLeft: 0, hitStop: 0, combo: 0, comboT: 0,
    xp: 0, playerLevel: 1, stamina: STAMINA.max, shield: 0, shieldMax: 0, shieldRegenT: 0,
    lifesteal: 0, thorns: 0, revives: 0, knockMult: 1, goldMult: 1, asMult: 1,
    perks: [], artifact: null, wLevels: { sword: 1, wave: 1, crossbow: 1, staff: 1 },
    chargeT: 0, charging: false,
  });
  G.meta = meta || { essence: 0, lvls: { hp: 0, atk: 0, gold: 0, potion: 0, crit: 0 } };
  G.className = cls || "KNIGHT";
  Object.assign(game, { player: null, enemies: [], projectiles: [], waves: [], effects: [], arcs: [], time: 0, shake: 0, weapon: "sword", secondary: null, weapons: ["sword"],
    obstacles: [], hazards: [], traps: [], crates: [], shrine: null,
    orbits: [], deployables: [], burnZones: [], hazardZones: [] });
  rerolled = false;
  G.aoeZones = []; G.dmgTaken = 0; G.slowmoT = 0; G.branchChosen = false;
  function statsRuns() { try { return STATS.runs || 0; } catch (e) { return 0; } }
  const firstRun = statsRuns() === 0;
  const buttons = [
    { label: "▶ PLAY", fn: () => firstRun ? runTutorial() : beginGame(), primary: true, note: firstRun ? "First run: quick tutorial" : undefined },
    { label: "⚔️ DIFFICULTY", fn: () => { const p=document.getElementById("diffPanel"); if(p) p.style.display=p.style.display==="none"?"flex":"none"; }, note: DIFFICULTIES[G.difficulty].name },
    { label: "🌀 GOD RUN PERKS", fn: showGodPerks, note: `${GOD_PERKS.unlocked.length}/4 unlocked` },
    { label: "⚙️ SETTINGS", fn: openOptions },
    { label: "🚪 EXIT", fn: () => { flash("Thanks for playing BLOB KNIGHT!", "#ffd166"); setTimeout(()=> { try{ window.close(); }catch(e){} }, 400); } },
  ];
  showOverlay("BLOB<span>KNIGHT</span>", `Clear ${MAX_LEVEL} depths. Claim the throne.`, null, null, buttons, true);
  // Wrap main menu buttons in centered container for proper vertical centering
  const overlayEl = $("overlay");
  const menuCenter = document.createElement("div");
  menuCenter.className = "main-menu-center";
  [...overlayEl.querySelectorAll("button.btn")].forEach(btn => menuCenter.appendChild(btn));
  overlayEl.appendChild(menuCenter);
  /* difficulty panel — hidden until DIFFICULTY is clicked, expands directly underneath DIFFICULTY */
  const dh = document.createElement("div");
  dh.className = "menu-diff";
  dh.id = "diffPanel";
  dh.style.display = "none";
  dh.style.flexDirection = "column";
  dh.style.alignItems = "center";
  dh.style.width = "100%";
  dh.style.maxWidth = "340px";
  dh.style.gap = "6px";
  dh.style.marginTop = "6px";
  dh.style.marginBottom = "6px";
  for (const [key, d] of Object.entries(DIFFICULTIES)) {
    const b = document.createElement("button");
    b.className = "btn diff-chip" + (G.difficulty === key ? " on" : "");
    b.textContent = `${d.name} — ${d.desc}`;
    b.style.width = "100%";
    b.style.fontSize = "11px";
    b.style.justifyContent = "center";
    b.style.padding = "8px 12px";
    b.onclick = () => {
      G.difficulty = key;
      flash(`Difficulty: ${d.name} — ${d.desc}`, "#6fc3ff");
      [...dh.querySelectorAll("button")].forEach(btn => btn.classList.toggle("on", btn.textContent.startsWith(d.name)));
      const diffBtn = [...menuCenter.querySelectorAll("button.btn")].find(btn => btn.textContent.includes("DIFFICULTY"));
      if (diffBtn) diffBtn.textContent = `⚔️ DIFFICULTY — ${d.name}`;
    };
    dh.appendChild(b);
  }
  const diffBtnEl = [...menuCenter.querySelectorAll("button.btn")].find(b => b.textContent.includes("DIFFICULTY"));
  if (diffBtnEl) diffBtnEl.insertAdjacentElement("afterend", dh);
  else menuCenter.appendChild(dh);
}

/* idea 36: boss rush — clear each level's boss directly */
function startBossRush() {
  G.bossRush = true;
  G.doubleBoss = false;
  resetRunStart();
  beginGame();
}
/* idea 37: double-boss challenge */
function startDoubleBoss() {
  G.doubleBoss = true;
  G.bossRush = false;
  resetRunStart();
  beginGame();
}
function resetRunStart() {
  G.meta.essence = 0;
  G.xp = 0; G.playerLevel = 1; G.hp = 100; G.maxHp = 100; G.atk = 10; G.def = 4;
  G.gold = 0; G.potions = 2; G.sword = 1; G.armor = 1; G.kills = 0; G.crit = 0;
  G.stamina = STAMINA.max; G.shield = 0; G.shieldMax = 0;
  G.perks = []; G.artifact = null; G.wLevels = { sword: 1, wave: 1, crossbow: 1, staff: 1 };
}
/* idea: instant retry — skip the menu entirely so deaths never break the flow */
function restartRun() {
  G.bossRush = false; G.daily = false; G.ngPlus = false; G.branchChosen = false;
  resetRunStart();
  beginGame();
}

/* ---------- overlays ---------- */
function showOverlay(title, body, btnLabel, btnFn, buttons, addName) {
  resetJoy();   // drop any stuck joystick input while a menu is up
  setTouchUI(false);   // idea 104: never let the joystick/buttons block menu taps
  const o = $("overlay");
  o.innerHTML = `<h2>${title}</h2><p>${body}</p>`;
  o.classList.toggle("main-menu", !!addName);
  o.style.display = "flex";
  const list = (buttons || []).slice();
  if (btnLabel && btnFn) list.push({ label: btnLabel, fn: btnFn, primary: true });
  for (const b of list) {
    const el = document.createElement("button");
    el.className = "btn";
    el.textContent = (b.note ? `${b.label} — ${b.note}` : b.label);
    el.disabled = !!b.disabled;
    el.style.background = b.primary ? "#3a2c5a" : "";
    el.style.opacity = b.disabled ? ".4" : "1";
    el.style.cursor = b.disabled ? "not-allowed" : "pointer";
    el.onclick = b.fn;
    el.tabIndex = b.disabled ? -1 : 0;
    o.appendChild(el);
  }
  o.dataset.nav = "1";
  const navBtns = [...o.querySelectorAll("button.btn")].filter(b => !b.disabled);
  if (navBtns[0]) navBtns[0].focus();
}

function overlayButtons() {
  const o = $("overlay");
  if (!o || o.dataset.nav !== "1") return [];
  return [...o.querySelectorAll("button.btn")].filter(b => {
    if (b.disabled) return false;
    // only visible buttons — hidden difficulty options should not block navigation
    if (b.offsetParent === null) return false;
    const cs = getComputedStyle(b);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
    // also check parent diffPanel visibility
    const panel = document.getElementById("diffPanel");
    if (panel && panel.contains(b) && panel.style.display === "none") return false;
    return true;
  });
}
function overlayFocusMove(dir) {
  const btns = overlayButtons();
  if (!btns.length) return;
  let idx = btns.indexOf(document.activeElement);
  if (idx < 0) idx = 0;
  idx = (idx + dir + btns.length) % btns.length;
  btns[idx].focus();
}
addEventListener("keydown", e => {
  const btns = overlayButtons();
  if (!btns.length) return;
  const k = e.key.toLowerCase();
  if (k === "arrowup" || k === "arrowleft") { e.preventDefault(); e.stopPropagation(); overlayFocusMove(-1); }
  else if (k === "arrowdown" || k === "arrowright") { e.preventDefault(); e.stopPropagation(); overlayFocusMove(1); }
  else if (k === "enter" || k === " ") {
    const cur = document.activeElement;
    if (cur && btns.includes(cur)) { e.preventDefault(); e.stopPropagation(); cur.click(); }
  } else if (k === "escape") {
    const back = btns.find(b => /back|cancel|close|resume/i.test(b.textContent));
    if (back) { e.preventDefault(); e.stopPropagation(); back.click(); }
  }
}, true);

function hideOverlay() { const o=$("overlay"); if(o){ o.innerHTML=""; o.style.display="none"; o.dataset.nav=""; } if(document.activeElement&&document.activeElement.blur) document.activeElement.blur(); }

function beginGame() {
  /* name entry removed — the hero keeps their name across runs (idea: no menu detour after death) */
  setTouchUI(true);
  const th = $("tutHint"); if (th) th.classList.remove("show");
  /* idea 62: track runs */
  if (typeof STATS !== "undefined" && !G.fromContinue) { STATS.runs++; saveStats(); }
  G.fromContinue = false;
  /* idea 20: apply starting class + meta-upgrades */
  const cls = CLASSES.find(c => c.name === G.className) || CLASSES[0];
  cls.apply();
  const meta = G.meta.lvls;
  G.maxHp += meta.hp * 15; G.hp += meta.hp * 15;
  G.atk += meta.atk * 2;
  G.gold += meta.gold * 50;
  G.potions += meta.potion;
  G.crit += meta.crit * 0.05;
  /* second-last difficulty (extreme) — fixed 30 HP, no max increase; godrun — 2 HP */
  if (G.difficulty === "extreme") { G.maxHp = 30; G.hp = 30; G.extremeMaxLocked = true; }
  else if (G.difficulty === "godrun") { G.maxHp = 2; G.hp = 2; }
  // God Run perks — only active if unlocked, in order 3→4→1→2
  if (G.difficulty === "godrun") {
    if (isGodPerkUnlocked(4)) G.asMult = (G.asMult || 1) * 0.65; // Fast Attacks: 35% faster
    if (isGodPerkUnlocked(1)) { G.godShield = 1; G.godShieldCd = 0; G.godShieldMax = 1; }
    if (isGodPerkUnlocked(2)) G.has360Slash = true;
    // Sword Bounce (3) handled in projectile update
  }
  renderHUD();
  SFX.unlock();
  SFX.levelup();
  hideOverlay();
  setupLevel(1);
  G.phase = "play";
  renderHUD();
}

function flash(msg, color) {
  const t = $("toast");
  t.textContent = msg;
  t.style.color = color || "#ffd166";
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- HUD ---------- */
let dashHudCache = "";
function syncDashHud() {
  const p = game.player;
  if (!p) return;
  const txt = p.dashT > 0 ? "💨 DASH!" : p.dashCd > 0 ? `💨 ${p.dashCd.toFixed(1)}s` : "💨 READY";
  if (txt !== dashHudCache) {
    dashHudCache = txt;
    const el = $("hDash");
    el.textContent = txt;
    el.classList.toggle("ready", txt === "💨 READY");
  }
}

function renderHUD() {
  /* idea: GOD RUN — 2 HP forever; no blessing, shrine or herb may ever grow it */
  if (G.difficulty === "godrun") { G.maxHp = 2; G.hp = Math.min(G.hp, 2); }
  $("hName").textContent = G.name;
  $("hHpText").textContent = Math.max(0, Math.round(G.hp)) + "/" + G.maxHp;
  $("hpFill").style.width = Math.max(0, G.hp / G.maxHp * 100) + "%";
  $("hGold").textContent = G.gold + "g";
  $("hPot").textContent = "🧪 " + G.potions;
  $("hKills").textContent = "☠ " + G.kills;
  $("hLevel").textContent = G.level + "/" + MAX_LEVEL;
  $("hPLevel").textContent = "⬆" + G.playerLevel;
  $("hBomb").textContent = "💣 " + (G.bombs || 0);
  $("hTurret").textContent = "🤖 " + (G.turrets || 0);
  $("hTrap").textContent = "🪤 " + (G.traps || 0);
  $("hWeapon").textContent = WEAPONS.sword.icon + " " + WEAPONS.sword.name;
  const sec = game.secondary && WEAPONS[game.secondary] ? WEAPONS[game.secondary] : null;
  $("hSecondary").textContent = sec ? `${sec.icon} ${sec.name}` : "—";
  $("hSecondary").classList.toggle("on", !!sec);
  const comboEl = $("hCombo");
  if (comboEl) {
    comboEl.textContent = G.combo >= 2 ? `🔥 x${G.combo}` : "";
    comboEl.classList.toggle("active", G.combo >= 2);
  }
  const stEl = $("stamFill"), stT = $("hStamText");
  if (stEl) { stEl.style.width = Math.max(0, G.stamina / STAMINA.max * 100) + "%"; stT.textContent = "⚡ " + Math.round(G.stamina); }
  const shWrap = $("shieldWrap"), shF = $("shieldFill"), shT = $("hShieldText");
  if (shWrap) {
    shWrap.style.display = G.shieldMax > 0 ? "" : "none";
    shF.style.width = Math.max(0, G.shield / G.shieldMax * 100) + "%";
    shT.textContent = "🛡 " + Math.round(G.shield);
  }
  const classEl = $("hClass");
  if (classEl) classEl.textContent = (G.className || "KNIGHT").slice(0, 1) + (G.className || "KNIGHT").slice(1);
  updateHintKeys();
  dashHudCache = "";   // force refresh next frame
}

/* ---------- touch controls (idea 70) ---------- */
const isTouch = "ontouchstart" in window;
let joy = { active: false, id: null, dx: 0, dy: 0 };
function resetJoy() {
  joy.active = false; joy.id = null; joy.dx = 0; joy.dy = 0;
  const k = $("joyKnob"); if (k) k.style.transform = "translate(0,0)";
  const b = $("joyBase"); if (b) { b.style.left = ""; b.style.top = ""; b.style.bottom = ""; }
}
/* hide the whole touch UI (joystick zone + buttons) while any overlay menu is up,
   so its high z-index never blocks menu buttons from being tapped */
function setTouchUI(on) {
  const tc = $("touchControls");
  if (tc) tc.style.display = on && isTouch ? "flex" : "none";
}
function initTouch() {
  if (!isTouch) { $("touchControls").style.display = "none"; return; }
  $("touchControls").style.display = "flex";
  const zone = $("joyZone"), base = $("joyBase"), knob = $("joyKnob");
  const R = () => base.offsetWidth / 2;
  zone.addEventListener("pointerdown", e => {
    if (joy.active) return;            // one stick at a time
    e.preventDefault();
    /* fixed joystick: the base stays anchored; tilt is measured from its centre */
    joy = { active: true, id: e.pointerId, dx: 0, dy: 0 };
    knob.style.transform = "translate(0,0)";
    try { zone.setPointerCapture(e.pointerId); } catch (err) { /* no-op */ }
  });
  zone.addEventListener("pointermove", e => {
    if (!joy.active || e.pointerId !== joy.id) return;
    e.preventDefault();
    const b = base.getBoundingClientRect();
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    let dx = (e.clientX - cx) / R(), dy = (e.clientY - cy) / R();
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    joy.dx = dx; joy.dy = dy;
    knob.style.transform = `translate(${dx * (R() - 24)}px, ${dy * (R() - 24)}px)`;
  });
  const end = e => {
    if (!joy.active || e.pointerId !== joy.id) return;
    resetJoy();
  };
  zone.addEventListener("pointerup", end);
  zone.addEventListener("pointercancel", end);
  /* pointer-based press/release with window fallback so sliding a finger off
     a button still fires the release (and never leaks across fingers) */
  const hold = (el, fn, release) => {
    let id = null;
    el.addEventListener("pointerdown", e => { e.preventDefault(); fn(); id = e.pointerId; }, { passive: false });
    if (release) {
      const r = e => { if (id !== null && e.pointerId === id) { id = null; release(); } };
      window.addEventListener("pointerup", r);
      window.addEventListener("pointercancel", r);
    }
  };
  hold($("tAttack"), () => { G.charging = true; G.chargeT = 0; },
    () => { if (G.charging) { G.charging = false; if (G.chargeT >= 0.6) tryHeavy(); else weaponAttack(game); G.chargeT = 0; } });
  hold($("tSecondary"), () => secondaryAttack(game));
  hold($("tBomb"), () => throwBomb(game));
  hold($("tDash"), () => tryDash());
  hold($("tPotion"), () => drinkPotion());
  hold($("tCycle"), () => cycleWeapon());
  hold($("tPause"), () => togglePause());
}
initTouch();

/* contextual key hint shown in the bottom HUD strip (desktop only) */
function updateHintKeys() {
  const el = $("hintKeys");
  if (!el) return;
  const hasSec = game.secondary && WEAPONS[game.secondary];
  const parts = ["SPACE ⚔️", "R 🏹", "SHIFT 💨", "E 🧪", "F 💣", "G 🤖", "T 🪤"];
  const base = hasSec ? parts : parts.filter(p => !p.startsWith("R "));
  el.textContent = base.join("  ") + "   P ⏸   M 🔇";
}
updateHintKeys();
/* ---------- easter egg 1: candle ---------- */
const candle = $("candle");
candle.addEventListener("click", () => {
  G.candleClicks = (G.candleClicks || 0) + 1;
  if (G.candleClicks === 5) {
    G.candleClicks = 0;
    G.gold += 100;
    flash("SECRET FOUND: +100 GOLD 🕯️", "#ffd166");
    renderHUD();
  } else if (G.candleClicks === 10) {
    G.candleClicks = 0;
    G.doubleBossUnlocked = true;
    flash("SECRET UNLOCKED: DOUBLE BOSS ⚔️", "#ff2a6a");
  } else if (G.candleClicks > 1) {
    flash(`The candle flickers... (${G.candleClicks}/5, ${G.candleClicks}/10)`, "#ffb45e");
  } else {
    flash("The candle flickers faintly...", "#9a90b8");
  }
});

/* ---------- easter egg 2: Konami code ---------- */
G.konami = [];
addEventListener("keydown", ev => {
  if (ev.target && ev.target.tagName === "INPUT") return;
  const key = ev.key.toLowerCase();
  G.konami.push(key);
  if (G.konami.length > KONAMI.length) G.konami.shift();
  if (G.konami.join("") === KONAMI.join("")) {
    G.konami = [];
    G.godMode = !G.godMode;
    flash(G.godMode ? "KONAMI CODE — GOD MODE ⚡" : "GOD MODE DISABLED", "#ffd166");
    if (G.godMode && game.player) {
      game.effects.push({ type: "heal", x: game.player.x, y: game.player.y, t: 1, txt: "GOD MODE" });
    }
  }
});

/* ---------- loop & boot ---------- */
/* expose combat helpers to entities/weapons modules */
game.playerDamage = playerDamage;
game.damagePlayer = damagePlayer;
game.killEnemy = killEnemy;
game.hurtEnemy = hurtEnemy;
game.flash = flash;
game.explode = explode;
game.explodePlayer = explodePlayer;
game.bossVolley = bossVolley;
game.bossRadial = bossRadial;
game.bossSummon = bossSummon;
game.bossSpiral = bossSpiral;
game.SFX = SFX;

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw(game);
  requestAnimationFrame(loop);
}

/* ---------- screen size (zoom) + resize hygiene (idea 20) ---------- */
function applyZoom() {
  const w = $("gameWrap");
  if (w) w.style.transform = `scale(${SETTINGS.zoom || 1})`;
}
addEventListener("resize", () => { resetJoy(); applyZoom(); });
document.addEventListener("orientationchange", () => { resetJoy(); applyZoom(); });

renderHUD();
/* boot: menu shown once ALL scripts loaded — index.html runs boot() after meta.js */
if (typeof boot !== "undefined") boot();
requestAnimationFrame(loop);
