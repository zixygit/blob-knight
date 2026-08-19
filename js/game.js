/* ============================================================
   EMBERQUEST 2D — game state, flow, input, loop
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
  godMode: false,
  mute: false,
  slowT: 0,
  level: 1, door: null, loot: [], bossSpawned: false, minionsLeft: 0,
};

const game = {
  G,
  player: null,
  enemies: [],
  projectiles: [],   // player bolts + enemy shots
  waves: [],         // wave blade shockwaves
  loot: G.loot,
  effects: [],
  time: 0,
  shake: 0,
  weapon: "sword",
  weapons: ["sword"], // owned weapons
};

/* ---------- input ---------- */
const keys = {};
addEventListener("keydown", e => {
  if (e.target && e.target.tagName === "INPUT") return;   // typing a hero name
  const k = e.key.toLowerCase();
  SFX.unlock();
  keys[k] = true;
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
  if (e.key === " " && !e.repeat) weaponAttack(game);
  if (k === "e" && !e.repeat) drinkPotion();
  if (k === "q" && !e.repeat) cycleWeapon();
  if (k >= "1" && k <= "4" && !e.repeat) selectWeapon(Number(k));
  if (k === "shift" && !e.repeat) tryDash();
  if ((k === "p" || k === "escape") && !e.repeat) togglePause();
  if (k === "m" && !e.repeat) toggleMute();
});
addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);
addEventListener("pointerdown", () => SFX.unlock(), { once: true });

/* ---------- level setup ---------- */
function setupLevel(n) {
  G.level = n;
  const L = LEVELS[n];
  game.player = new Player(n === 3 ? CFG.W / 2 : CFG.MARGIN + 30, CFG.H / 2);
  game.enemies = [];
  game.projectiles = [];
  game.waves = [];
  game.effects = [];
  game.G.loot = [];
  game.G.door = { x: CFG.W - 36, y: CFG.H / 2, r: 14, open: false };
  game.G.bossSpawned = false;
  game.G.minionsLeft = 0;

  for (const m of L.minions) {
    const base = ENEMY_TYPES[m.type];
    const def = Object.assign({}, base, m);
    for (let i = 0; i < (m.count || 1); i++) {
      let x, y;
      do {
        x = rand(60, CFG.W - 60);
        y = rand(60, CFG.H - 60);
      } while (dist({ x, y }, game.player) < 100);
      const e = new Enemy(def, x, y);
      if (m.proj) e.proj = m.proj;
      game.enemies.push(e);
      game.G.minionsLeft++;
    }
  }
  flash(`LEVEL ${n}/${MAX_LEVEL}: ${L.name} — slay all foes`, "#9a90b8");
  renderHUD();
}

function spawnBoss() {
  const b = LEVELS[G.level].boss;
  const boss = new Enemy(b, CFG.W - 120, CFG.H / 2);
  game.enemies.push(boss);
  game.G.bossSpawned = true;
  game.shake = Math.max(game.shake, 0.25);
  flash(`⚔️ ${b.name} has arrived!`, "#ff7847");
  SFX.boss();
}

/* ---------- combat helpers ---------- */
function playerDamage() {
  const crit = Math.random() < (0.1 + G.crit);
  return { d: rand(G.atk, G.atk + 5) * (crit ? 2 : 1), crit };
}

/* single place where enemies take damage: flash, knockback, kill */
function hurtEnemy(e, dmg, kx, ky, opts = {}) {
  if (e.dead) return;
  e.hp -= dmg;
  e.hurtT = 0.12;
  e.knock = opts.knock || 0.2;
  e.kx = kx; e.ky = ky;
  game.effects.push({ type: "hit", x: e.x, y: e.y, t: 0.3, txt: dmg, crit: opts.crit });
  if (opts.crit) { flash(`CRITICAL ${dmg}!`, "#ffd166"); SFX.crit(); }
  else SFX.hit();
  if (e.hp <= 0) killEnemy(e);
}

function damagePlayer(d, sx, sy, fx) {
  if (G.godMode || G.phase !== "play") return;
  if (game.player.dashT > 0) return;                       // dash i-frames
  const mitigated = Math.max(1, d - Math.min(d - 1, Math.round(G.def * 0.6)));
  G.hp -= mitigated;
  game.player.hurtT = 0.25;
  game.shake = Math.max(game.shake, 0.18);
  game.effects.push({ type: "hurt", x: game.player.x, y: game.player.y, t: 0.3 });
  const ang = Math.atan2(game.player.y - sy, game.player.x - sx);
  game.player.x = clamp(game.player.x + Math.cos(ang) * 6, CFG.MARGIN, CFG.W - CFG.MARGIN);
  game.player.y = clamp(game.player.y + Math.sin(ang) * 6, CFG.MARGIN, CFG.H - CFG.MARGIN);
  if (fx === "slow") {
    const wasChilled = G.slowT > 0.3;
    G.slowT = 2.6;
    if (!wasChilled) flash("CHILLED! Movement slowed", "#7fd4e8");
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

/* ember staff detonation: area damage from player attack */
function explodePlayer(x, y, r) {
  game.effects.push({ type: "boom", x, y, t: 0.4 });
  game.shake = Math.max(game.shake, 0.15);
  SFX.boom();
  for (const e of [...game.enemies]) {
    if (dist({ x, y }, e) < r + e.r) {
      const hit = playerDamage();
      const ang = Math.atan2(e.y - y, e.x - x);
      hurtEnemy(e, Math.round(hit.d * 0.9) + 2, Math.cos(ang) * 10, Math.sin(ang) * 10,
        { knock: 0.3, crit: hit.crit });
    }
  }
}

function killEnemy(e, silent) {
  if (e.dead) return;
  e.dead = true;
  const idx = game.enemies.indexOf(e);
  if (idx >= 0) game.enemies.splice(idx, 1);
  G.kills++;
  if (!silent) { game.effects.push({ type: "boom", x: e.x, y: e.y, t: 0.4 }); SFX.boom(); }
  if (e.isBoss) {
    G.gold += LEVELS[G.level].bossReward;
    game.G.door.open = true;
    game.G.loot.push(new Pickup("potion", e.x, e.y));
    game.shake = Math.max(game.shake, 0.3);
    flash(`BOSS SLAIN! +${LEVELS[G.level].bossReward} gold`, "#ffd166");
  } else if (!e.summoned) {
    game.G.minionsLeft--;
    dropLoot(e.x, e.y, false);
    if (game.G.minionsLeft <= 0 && !game.G.bossSpawned) spawnBoss();
  } else if (Math.random() < 0.3) {
    game.G.loot.push(new Pickup("gold", e.x, e.y, rand(5, 15)));
  }
  renderHUD();
}

function dropLoot(x, y, isBoss) {
  if (isBoss) { G.gold += 25; return; }
  const r = Math.random();
  if (r < 0.38) game.G.loot.push(new Pickup("gold", x, y, rand(15, 40)));
  else if (r < 0.56) game.G.loot.push(new Pickup("potion", x, y));
  else if (r < 0.70) game.G.loot.push(new Pickup("herb", x, y));
  else if (r < 0.82) game.G.loot.push(new Pickup("stone", x, y));
  else if (r < 0.92) game.G.loot.push(new Pickup("charm", x, y));
  else game.G.loot.push(new Pickup("rune", x, y));
}

function pickup(l) {
  switch (l.type) {
    case "gold":   G.gold += l.v; flash(`+${l.v} gold`, "#ffd166"); break;
    case "potion": G.potions++; flash("+1 potion", "#6bff9a"); break;
    case "herb":   G.maxHp += 8; G.hp += 8; flash("Max HP +8", "#6bff9a"); break;
    case "stone":  G.atk += 1; G.sword++; flash("ATK +1, sword level up!", "#ffd166"); break;
    case "charm":  G.crit += 0.05; G.sword++; flash("CRIT CHARM! +5% crit", "#c084fc"); break;
    case "rune":   G.def += 1; G.armor++; flash("GUARD RUNE! DEF +1", "#8fd4ff"); break;
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
  p.dashT = CFG.DASH_TIME;
  p.dashCd = CFG.DASH_CD;
  p.dashAng = p.dir;
  game.effects.push({ type: "waveflash", x: p.x, y: p.y, t: 0.3 });
  SFX.dash();
}

/* ---------- boss attacks ---------- */
function bossVolley(boss, cfg) {
  const p = game.player;
  const base = Math.atan2(p.y - boss.y, p.x - boss.x);
  const spread = cfg.spread || 0.4;
  for (let i = 0; i < cfg.count; i++) {
    const ang = base + (i - (cfg.count - 1) / 2) * spread;
    game.projectiles.push(new Projectile("enemy", boss.x, boss.y,
      Math.cos(ang) * cfg.speed, Math.sin(ang) * cfg.speed,
      cfg.r || 7, rand(cfg.dmg[0], cfg.dmg[1]), cfg.color || "#ff8b3d", { slow: cfg.slow || 0 }));
  }
  flash(`${boss.name} fires a volley!`, "#ff7847");
}

function bossRadial(boss, cfg) {
  const n = cfg.count;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    game.projectiles.push(new Projectile("enemy", boss.x, boss.y,
      Math.cos(ang) * cfg.speed, Math.sin(ang) * cfg.speed,
      cfg.r || 6, rand(cfg.dmg[0], cfg.dmg[1]), cfg.color || "#9a90b8"));
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
function selectWeapon(n) {
  const ordered = Object.keys(WEAPONS).filter(w => game.weapons.includes(w));
  if (n >= 1 && n <= ordered.length) {
    game.weapon = ordered[n - 1];
    flash(`Equipped ${WEAPONS[game.weapon].icon} ${WEAPONS[game.weapon].name}`, "#6fc3ff");
    renderHUD();
  }
}

function cycleWeapon() {
  const ordered = Object.keys(WEAPONS).filter(w => game.weapons.includes(w));
  const i = ordered.indexOf(game.weapon);
  selectWeapon(((i + 1) % ordered.length) + 1);
}

/* ---------- update loop ---------- */
function update(dt) {
  game.time += dt;
  game.shake = Math.max(0, game.shake - dt);
  if (game.player) {
    game.player.attackCd = Math.max(0, game.player.attackCd - dt);
    game.player.swing = Math.max(0, game.player.swing - dt);
    game.player.hurtT = Math.max(0, game.player.hurtT - dt);
    game.player.dashCd = Math.max(0, game.player.dashCd - dt);
  }
  G.slowT = Math.max(0, G.slowT - dt);
  for (const f of game.effects) f.t -= dt;
  game.effects = game.effects.filter(f => f.t > 0);

  if (G.phase !== "play") return;

  /* movement: dash overrides input; chill slows */
  const p = game.player;
  let dx = 0, dy = 0;
  if (keys["w"] || keys["arrowup"]) dy -= 1;
  if (keys["s"] || keys["arrowdown"]) dy += 1;
  if (keys["a"] || keys["arrowleft"]) dx -= 1;
  if (keys["d"] || keys["arrowright"]) dx += 1;
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    p.dir = Math.atan2(dy / len, dx / len);
  }
  if (p.dashT > 0) {
    p.dashT -= dt;
    const sp = CFG.PLAYER.speed * CFG.DASH_SPEED;
    p.x = clamp(p.x + Math.cos(p.dashAng) * sp * dt, CFG.MARGIN, CFG.W - CFG.MARGIN);
    p.y = clamp(p.y + Math.sin(p.dashAng) * sp * dt, CFG.MARGIN, CFG.H - CFG.MARGIN);
  } else if (dx || dy) {
    const len = Math.hypot(dx, dy);
    const sp = CFG.PLAYER.speed * (G.slowT > 0 ? 0.55 : 1);
    p.x = clamp(p.x + (dx / len) * sp * dt, CFG.MARGIN, CFG.W - CFG.MARGIN);
    p.y = clamp(p.y + (dy / len) * sp * dt, CFG.MARGIN, CFG.H - CFG.MARGIN);
  }

  /* enemies */
  for (const e of game.enemies) e.update(dt, game);

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
  game.projectiles = game.projectiles.filter(pr => !pr.update(dt, game));

  /* waves */
  game.waves = game.waves.filter(w => !w.update(dt, game));

  /* pickups */
  for (const l of game.G.loot) l.t += dt;
  for (let i = game.G.loot.length - 1; i >= 0; i--) {
    if (dist(game.G.loot[i], p) < 26) { pickup(game.G.loot[i]); game.G.loot.splice(i, 1); }
  }

  /* door */
  const d = game.G.door;
  if (d && d.open && dist(p, d) < 34) { d.open = false; openShop(); }

  syncDashHud();
}

/* ---------- flow ---------- */
function die() {
  G.phase = "dead";
  showOverlay("☠️ YOU FELL", `You felled ${G.kills} foes in level ${G.level}. The embers fade... but the story can be relived.`, "🔄 TRY AGAIN", resetGame);
}

function winGame() {
  G.phase = "won";
  showOverlay("🏆 EMBERQUEST COMPLETE", `You cast down the Void Sovereign atop the Void Throne — the realm is saved. ${G.kills} foes felled, sword level ${G.sword}, armor level ${G.armor}.`, "🏆 PLAY AGAIN", resetGame);
}

function openShop() {
  G.phase = "shop";
  const owned = game.weapons;
  showOverlay("🛒 CAMPFIRE MERCHANT", `Level ${G.level} of ${MAX_LEVEL} cleared · ${G.gold} gold.`, null, null, [
    { label: `🧪 POTION (40g)`, fn: buyPotion, disabled: G.gold < 40 },
    { label: `🍵 FULL HEAL (30g)`, fn: buyHeal, disabled: G.gold < 30 || G.hp >= G.maxHp },
    { label: `⚔️ +2 ATK (80g)`, fn: buyAttack, disabled: G.gold < 80 },
    { label: `🛡️ +2 DEF (100g)`, fn: buyArmor, disabled: G.gold < 100 },
    { label: `🌊 WAVE BLADE (150g)`, fn: buyWeapon.bind(null, "wave"), disabled: owned.includes("wave") || G.gold < 150, note: owned.includes("wave") ? "OWNED" : "Shockwave burst" },
    { label: `🏹 CROSSBOW (200g)`, fn: buyWeapon.bind(null, "crossbow"), disabled: owned.includes("crossbow") || G.gold < 200, note: owned.includes("crossbow") ? "OWNED" : "Fast bolts" },
    { label: `🔥 EMBER STAFF (300g)`, fn: buyWeapon.bind(null, "staff"), disabled: owned.includes("staff") || G.gold < 300, note: owned.includes("staff") ? "OWNED" : "Explosive fireball" },
    { label: `➡️ NEXT DOOR (FREE)`, fn: nextLevel },
    { label: `⬅️ BACK TO FIGHT`, fn: resumePlay },
  ]);
}

function buyPotion() { G.gold -= 40; G.potions++; SFX.buy(); flash("Bought potion"); renderHUD(); openShop(); }
function buyHeal()   { G.gold -= 30; G.hp = G.maxHp; SFX.buy(); flash("Fully healed!", "#6bff9a"); renderHUD(); openShop(); }
function buyAttack() { G.gold -= 80; G.atk += 2; G.sword++; SFX.buy(); flash("ATK +2"); renderHUD(); openShop(); }
function buyArmor()  { G.gold -= 100; G.def += 2; G.armor++; SFX.buy(); flash("DEF +2"); renderHUD(); openShop(); }
function buyWeapon(w) {
  G.gold -= WEAPONS[w].cost;
  game.weapons.push(w);
  game.weapon = w;
  SFX.buy();
  flash(`UNLOCKED ${WEAPONS[w].icon} ${WEAPONS[w].name}!`, "#6fc3ff");
  renderHUD();
  openShop();
}

function nextLevel() {
  hideOverlay();
  const n = G.level + 1;
  if (n > MAX_LEVEL) return winGame();
  G.sword++; G.atk += 3; G.maxHp += 20; G.hp = G.maxHp; G.potions++;
  G.slowT = 0;
  setupLevel(n);
  G.phase = "play";
  SFX.levelup();
  flash(`LEVEL CLEAR! Sword → ${G.sword}, Max HP +20, +1 potion`, "#6bff9a");
}

function resumePlay() { hideOverlay(); G.phase = "play"; }

/* ---------- pause & sound ---------- */
function togglePause() {
  if (G.phase === "play") {
    G.phase = "paused";
    showOverlay("⏸ PAUSED", "The embers hold their breath.", "▶ RESUME", resumePaused);
  } else if (G.phase === "paused") {
    resumePaused();
  }
}
function resumePaused() { hideOverlay(); G.phase = "play"; }

function toggleMute() {
  G.mute = !G.mute;
  flash(G.mute ? "🔇 SOUND OFF" : "🔊 SOUND ON", "#9a90b8");
}

function resetGame() {
  Object.assign(G, {
    phase: "menu", hp: 100, maxHp: 100, atk: 10, def: 4, gold: 0, potions: 2,
    sword: 1, armor: 1, kills: 0, crit: 0, godMode: false, slowT: 0, level: 1,
    door: null, loot: [], bossSpawned: false, minionsLeft: 0,
  });
  Object.assign(game, { player: null, enemies: [], projectiles: [], waves: [], effects: [], time: 0, shake: 0, weapon: "sword", weapons: ["sword"] });
  showOverlay("EMBER<span>QUEST</span>", `Slay the Void Sovereign and save the realm across ${MAX_LEVEL} lands.<br>Move <span class='kbd'>WASD</span> · Attack <span class='kbd'>SPACE</span> · Dash <span class='kbd'>SHIFT</span> · Potion <span class='kbd'>E</span> · Weapons <span class='kbd'>1-4</span>/<span class='kbd'>Q</span> · Pause <span class='kbd'>P</span> · Sound <span class='kbd'>M</span>`, null, null, [
    { label: "⚡ BEGIN", fn: beginGame, primary: true },
  ]);
}

/* ---------- overlays ---------- */
function showOverlay(title, body, btnLabel, btnFn, buttons) {
  const o = $("overlay");
  o.innerHTML = `<h2>${title}</h2><p>${body}</p>`;
  o.style.display = "flex";
  if (G.phase === "menu") {
    const inp = document.createElement("input");
    inp.type = "text"; inp.maxLength = 14; inp.placeholder = "NAME YOUR HERO...";
    inp.autocomplete = "off"; inp.spellcheck = false;
    inp.addEventListener("keydown", ev => { if (ev.key === "Enter") beginGame(); });
    o.appendChild(inp);
    inp.focus();
  }
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
    o.appendChild(el);
  }
}

function hideOverlay() { $("overlay").innerHTML = ""; $("overlay").style.display = "none"; }

function beginGame() {
  const inp = document.querySelector("#overlay input");
  G.name = ((inp && inp.value.trim()) || "HERO").toUpperCase();
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
  $("hName").textContent = G.name;
  $("hHpText").textContent = Math.max(0, Math.round(G.hp)) + "/" + G.maxHp;
  $("hpFill").style.width = Math.max(0, G.hp / G.maxHp * 100) + "%";
  $("hGold").textContent = G.gold + "g";
  $("hPot").textContent = "🧪 x" + G.potions;
  $("hSword").textContent = "⚔️ " + G.sword;
  $("hArmor").textContent = "🛡️ " + G.armor;
  $("hKills").textContent = "☠️ " + G.kills;
  $("hLevel").textContent = `📍 LV ${G.level}/${MAX_LEVEL}`;
  $("hWeapon").textContent = WEAPONS[game.weapon].icon + " " + WEAPONS[game.weapon].name;
  dashHudCache = "";   // force refresh next frame
}

/* ---------- easter egg 1: candle ---------- */
const candle = $("candle");
candle.addEventListener("click", () => {
  G.candleClicks = (G.candleClicks || 0) + 1;
  if (G.candleClicks === 5) {
    G.candleClicks = 0;
    G.gold += 100;
    flash("SECRET FOUND: +100 GOLD 🕯️", "#ffd166");
    renderHUD();
  } else if (G.candleClicks > 1) {
    flash(`The candle flickers... (${G.candleClicks}/5)`, "#ffb45e");
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

renderHUD();
resetGame();
requestAnimationFrame(loop);
