/* ============================================================
   BLOB KNIGHT — canvas renderer
   ============================================================ */
"use strict";

const ctx = (() => {
  const c = document.getElementById("game");
  c.width = CFG.W;
  c.height = CFG.H;
  return c.getContext("2d");
})();

function draw(game) {
  const L = LEVELS[game.G.level] || LEVELS[1];
  ctx.clearRect(0, 0, CFG.W, CFG.H);

  /* idea 82: animated title screen (menu phase) */
  if (game.G.phase === "menu") {
    ctx.fillStyle = "#12101e";
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    if (!game.embers) game.embers = [];
    for (let i = 0; i < 6 && game.embers.length < 60; i++) {
      game.embers.push({ x: Math.random() * CFG.W, y: Math.random() * CFG.H, v: 8 + Math.random() * 22, ph: Math.random() * 7, s: 1 + Math.random() * 2.5 });
    }
    ctx.save();
    for (const em of game.embers) {
      em.y -= em.v * 0.016; em.ph += 0.03;
      if (em.y < -6) { em.y = CFG.H + 6; em.x = Math.random() * CFG.W; }
      ctx.globalAlpha = 0.3 + 0.25 * Math.sin(em.ph * 2);
      ctx.fillStyle = "#ffb34d";
      ctx.beginPath(); ctx.arc(em.x + Math.sin(em.ph) * 12, em.y, em.s, 0, 7); ctx.fill();
    }
    ctx.restore();
    /* title with sword ember */
    ctx.save();
    const t = game.time || 0;
    ctx.textAlign = "center";
    ctx.shadowColor = "#ffb34d"; ctx.shadowBlur = 22 + Math.sin(t * 2) * 8;
    ctx.fillStyle = "#ffd166";
    ctx.font = "bold 52px monospace";
    ctx.fillText("BLOB KNIGHT", CFG.W / 2, 150);
    ctx.shadowBlur = 12; ctx.fillStyle = "#e8e3f5";
    ctx.font = "bold 22px monospace";
    ctx.fillText("TEN DEPTHS • ONE BLOB", CFG.W / 2, 194);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#9a90b8";
    ctx.font = "12px monospace";
    ctx.fillText("SWORD • TOOLS • GLORY", CFG.W / 2, 224);
    ctx.restore();
    return;
  }

  ctx.save();
  if (game.shake > 0 && SETTINGS.shake) {
    const s = Math.min(1, game.shake / 0.25) * 6 * SETTINGS.shake;
    ctx.translate((Math.random() - 0.5) * 2 * s, (Math.random() - 0.5) * 2 * s);
  }

  /* idea 71: colorblind mode — shape-coded loot */
  const cb = SETTINGS.colorblind !== "off";
  if (cb) ctx.setLineDash([4, 3]);

  /* floor */
  ctx.fillStyle = L.bg;
  ctx.fillRect(-10, -10, CFG.W + 20, CFG.H + 20);
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x < CFG.W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CFG.H); ctx.stroke(); }
  for (let y = 0; y < CFG.H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CFG.W, y); ctx.stroke(); }

  /* idea 79: parallax — distant layer shifts with player */
  const par = (game.player ? (CFG.W / 2 - game.player.x) * 0.06 : 0) % 400;
  ctx.save();
  ctx.fillStyle = L.wall;
  for (let i = 0; i < 5; i++) {
    const x = (i * 240 - 80 - par * (1 + i * 0.4) + 800) % 800;
    ctx.globalAlpha = 0.25 + i * 0.06;
    ctx.beginPath();
    ctx.arc(x, CFG.H - 20 - (i % 3) * 60, 18 + (i % 3) * 14, 0, 7);
    ctx.fill();
  }
  ctx.restore();

  /* idea 78: ambient particles — floating embers (also on title screen) */
  if (!game.embers || game.embers.length === 0) {
    game.embers = [];
    for (let i = 0; i < 26; i++) {
      game.embers.push({
        x: Math.random() * CFG.W, y: Math.random() * CFG.H,
        v: 8 + Math.random() * 20, ph: Math.random() * 7, s: 1 + Math.random() * 2,
      });
    }
  }
  ctx.save();
  for (const em of game.embers) {
    em.y -= em.v * 0.016; em.ph += 0.03;
    if (em.y < -6) { em.y = CFG.H + 6; em.x = Math.random() * CFG.W; }
    const ox = Math.sin(em.ph) * 12;
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(em.ph * 2);
    ctx.fillStyle = "#ffb34d";
    ctx.beginPath(); ctx.arc(em.x + ox, em.y, em.s, 0, 7); ctx.fill();
  }
  ctx.restore();

  /* walls */
  ctx.strokeStyle = L.wall;
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, CFG.W - 12, CFG.H - 12);

  /* idea 39: obstacle blocks / cover */
  ctx.fillStyle = L.wall;
  for (const o of game.obstacles || []) {
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.strokeRect(o.x, o.y, o.w, o.h);
  }

  /* idea 41: hazard tiles */
  for (const h of game.hazards || []) {
    ctx.fillStyle = h.type === "lava" ? "rgba(255,90,42,0.28)"
      : h.type === "ice" ? "rgba(127,212,232,0.22)"
      : "rgba(122,74,232,0.28)";
    ctx.fillRect(h.x, h.y, h.w, h.h);
  }

  /* idea 46: spike traps */
  for (const t of game.traps || []) {
    if (!t.active) continue;
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(game.time * 8));
    ctx.fillStyle = "#d8d8e8";
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(t.x + i * 6 - 3, t.y - t.r);
      ctx.lineTo(t.x + i * 6, t.y + t.r);
      ctx.lineTo(t.x + i * 6 + 3, t.y - t.r);
      ctx.fill();
    }
    ctx.restore();
  }

  /* idea 40: destructible crates */
  for (const c of game.crates || []) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = "#8a5a3d";
    ctx.fillRect(-c.r, -c.r, c.r * 2, c.r * 2);
    ctx.strokeStyle = "#5a3a2a";
    ctx.strokeRect(-c.r, -c.r, c.r * 2, c.r * 2);
    ctx.strokeStyle = "#5a3a2a";
    ctx.beginPath(); ctx.moveTo(-c.r, -c.r); ctx.lineTo(c.r, c.r); ctx.moveTo(c.r, -c.r); ctx.lineTo(-c.r, c.r); ctx.stroke();
    ctx.restore();
  }

  /* idea 47: shrine */
  const sh = game.shrine;
  if (sh && !sh.used) {
    ctx.save();
    ctx.translate(sh.x, sh.y);
    ctx.shadowColor = "#c084fc"; ctx.shadowBlur = 14;
    ctx.fillStyle = "#6a4a9a";
    ctx.beginPath(); ctx.moveTo(0, -sh.r); ctx.lineTo(sh.r * 0.8, sh.r); ctx.lineTo(-sh.r * 0.8, sh.r); ctx.fill();
    ctx.fillStyle = "#c084fc";
    ctx.font = "bold 10px monospace"; ctx.textAlign = "center";
    ctx.fillText("SHRINE", 0, 4);
    ctx.restore();
  }

  /* idea 43: minimap */
  drawMinimap(game);

  drawSecrets(game);
  drawTrialStone(game);
  drawHazardZones(game);
  drawGravityWells(game);
  drawLoot(game);
  drawDoor(game);
  drawWaves(game);
  drawEnemies(game);
  drawProjectiles(game);
  drawPlayer(game);
  drawEffects(game);

  /* DARK RUN modifier: the arena narrows to a lantern's reach */
  if (G.mod && G.mod.dark && game.G.phase === "play") {
    const p = game.player;
    const grad = ctx.createRadialGradient(p.x, p.y, 90, p.x, p.y, 230);
    grad.addColorStop(0, "rgba(5,4,10,0)");
    grad.addColorStop(1, "rgba(5,4,10,0.94)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CFG.W, CFG.H);
  }

  /* active trial: name + progress, pinned under the boss bar */
  if (G.trial && G.trial.phase === "active") {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = "#ffd166";
    let txt = `⚔ ${G.trial.name}`;
    if (G.trial.type === "time") txt += ` — ${Math.max(0, Math.ceil(G.trial.t))}s · ${G.trial.kills}/${G.trial.needKills}`;
    else if (G.trial.needKills) txt += ` — ${G.trial.kills}/${G.trial.needKills}`;
    else if (G.trial.type === "horde") txt += ` — WAVE ${Math.min(3, G.trial.wave)}/3`;
    ctx.fillText(txt, CFG.W / 2, 118);
    ctx.restore();
  }

  /* idea 81: palette shift — zone accent wash */
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = L.wall;
  ctx.fillRect(-10, -10, CFG.W + 20, CFG.H + 20);
  ctx.restore();

  ctx.restore();
  ctx.setLineDash([]);
}

/* chapter two: persistent floor hazards — acid pools, silk webs, forge heat */
function drawHazardZones(game) {
  for (const z of game.hazardZones || []) {
    const a = clamp(z.t / z.max, 0, 1);
    ctx.save();
    ctx.globalAlpha = (0.20 + 0.08 * Math.sin(game.time * 5)) * Math.min(1, a * 2);
    ctx.fillStyle = z.color;
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.35 + 0.3 * a;
    ctx.strokeStyle = z.color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.stroke();
    if (z.web) {   // silk strands read at a glance
      ctx.globalAlpha = 0.3 + 0.2 * a;
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const an = i / 4 * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.moveTo(z.x + Math.cos(an) * z.r * 0.2, z.y + Math.sin(an) * z.r * 0.2);
        ctx.lineTo(z.x + Math.cos(an) * z.r, z.y + Math.sin(an) * z.r);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/* secret wall cracks: a faint fissure that hums when you get close */
function drawSecrets(game) {
  for (const s of game.secrets || []) {
    ctx.save();
    ctx.translate(s.x, s.y);
    const pulse = 0.35 + 0.25 * Math.sin(game.time * 4);
    if (!s.found) {
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, -4); ctx.lineTo(-3, 0); ctx.lineTo(-6, 5); ctx.lineTo(2, 2); ctx.lineTo(5, 7);
      ctx.stroke();
      /* the nearby player makes it glow — the hint to look closer */
      if (game.player && dist(s, game.player) < 120) {
        ctx.globalAlpha = pulse * 0.6;
        ctx.beginPath(); ctx.arc(0, 0, 12 + 3 * Math.sin(game.time * 6), 0, 7); ctx.stroke();
      }
    } else {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(-8, -6, 16, 12);
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(game.time * 3);
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
}

/* trial stones: a humming monolith with the trial's sigil */
function drawTrialStone(game) {
  const st = game.trialStone;
  if (!st || st.used) return;
  ctx.save();
  ctx.translate(st.x, st.y);
  const pulse = 0.5 + 0.3 * Math.sin(game.time * 3);
  ctx.shadowColor = "#ffd166"; ctx.shadowBlur = 10;
  ctx.fillStyle = "#3a2c5a";
  ctx.beginPath();
  ctx.moveTo(0, -18); ctx.lineTo(12, 0); ctx.lineTo(0, 18); ctx.lineTo(-12, 0); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = `rgba(255,209,102,${pulse})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = `rgba(255,209,102,${pulse})`;
  ctx.font = "bold 11px monospace"; ctx.textAlign = "center";
  ctx.fillText("⚔", 0, 4);
  ctx.restore();
}

/* gravity orb: collapsed singularity — swirling pull zone */
function drawGravityWells(game) {
  for (const w of game.gravityWells || []) {
    const a = clamp(w.t / (w.max || 1.6), 0, 1);
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.globalAlpha = (0.10 + 0.05 * Math.sin(game.time * 9)) * a;
    ctx.fillStyle = "#7a4ae8";
    ctx.beginPath(); ctx.arc(0, 0, w.r, 0, 7); ctx.fill();
    ctx.globalAlpha = (0.55 + 0.3 * Math.sin(game.time * 7)) * a;
    ctx.strokeStyle = "#a88cff";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const off = game.time * 3.2 + i * 2.1;
      ctx.beginPath();
      ctx.arc(0, 0, w.r * (0.32 + i * 0.22), off, off + 2.2);
      ctx.stroke();
    }
    ctx.fillStyle = "#c0a8f0";
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill();
    ctx.restore();
  }
}

function drawLoot(game) {
  const colors = { gold: "#ffd166", potion: "#ff6b6b", herb: "#6bff9a", stone: "#e8e3f5", charm: "#c084fc", rune: "#8fd4ff", perk: "#c084fc",
    lore: "#e8d17a", voucher: "#6fc3ff", secretweapon: "#c0a8f0" };  const cb = SETTINGS.colorblind !== "off";
  for (const l of game.G.loot) {
    ctx.save();
    ctx.translate(l.x, l.y + Math.sin(l.t * 4) * 2);
    ctx.shadowColor = colors[l.type];
    ctx.shadowBlur = 8;
    ctx.fillStyle = colors[l.type];
    /* idea 71: shape-coded pickups for colorblind players */
    if (cb) {
      ctx.beginPath();
      if (l.type === "gold" || l.type === "potion") { ctx.arc(0, 0, 6, 0, 7); }
      else if (l.type === "herb" || l.type === "rune") { ctx.rect(-5, -5, 10, 10); }
      else { ctx.moveTo(0, -7); ctx.lineTo(6, 5); ctx.lineTo(-6, 5); ctx.closePath(); }
      ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
}

function drawDoor(game) {
  const d = game.G.door;
  if (!d) return;
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.shadowColor = d.open ? "#6bff9a" : "#3b2f5e";
  ctx.shadowBlur = d.open ? 14 : 4;
  ctx.fillStyle = d.open ? "#4caf7d" : "#3b2f5e";
  ctx.fillRect(-10, -26, 20, 52);
  if (d.open) {
    ctx.fillStyle = "#1f7a52";
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawWaves(game) {
  for (const w of game.waves) {
    const a = Math.max(0, w.ttl / 0.5);
    const col = w.color || "#6fc3ff";
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = col;
    ctx.globalAlpha = a * 0.15;
    ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, 7); ctx.fill();
    ctx.globalAlpha = a;
    ctx.strokeStyle = col;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, 7); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(w.x, w.y, w.r * 0.8, 0, 7); ctx.stroke();
    ctx.restore();
  }
}

function drawEnemies(game) {
  const G = game.G;
  for (const e of game.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);

    // charger telegraph (idea 21)
    if (e.kind === "charger" && e.windup > 0) {
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(game.time * 14));
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(0, 0, e.r + 6, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // sniper laser sight (idea 26 + telegraph)
    if (e.kind === "sniper" && e.aimT > 0) {
      const p = game.player;
      ctx.strokeStyle = "rgba(255,90,42," + (0.4 + 0.5 * Math.abs(Math.sin(game.time * 20))) + ")";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(e.aimAng) * 900, Math.sin(e.aimAng) * 900);
      ctx.stroke();
      ctx.fillStyle = "#ff5a2a";
      ctx.fillRect(Math.cos(e.aimAng) * 26 - 3, Math.sin(e.aimAng) * 26 - 3, 6, 6);
    }
    // shielder barrier (idea 23)
    if (e.kind === "shielder" && e.shieldAng !== undefined) {
      ctx.strokeStyle = "rgba(140,190,255,0.5)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 6, e.shieldAng - e.shieldArc, e.shieldAng + e.shieldArc);
      ctx.stroke();
    }
    // charger dash trail
    if (e.dashing) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(0, 0, e.r * 1.4, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // phantom: fading in and out of phase
    if (e.kind === "phantom") ctx.globalAlpha = 0.55 + 0.35 * Math.sin(game.time * 6);

    /* ---- chapter two tells — every new attack is readable before it lands ---- */
    // assassin: nearly invisible while phased, flashing while marking
    if (e.kind === "assassin") {
      if (e.aState === "vanish") ctx.globalAlpha = 0.12;
      else if (e.aState === "mark") ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(game.time * 18));
      else ctx.globalAlpha = 0.85;
    }
    // gazer: charge line — thin while tracking, thick + hot when locked
    if (e.kind === "gazer" && e.gazeCharge > 0) {
      const locked = e.gazeCharge <= (e.gazeLock || 0.5);
      ctx.strokeStyle = locked ? "rgba(255,90,180,0.9)" : "rgba(212,168,255,0.4)";
      ctx.lineWidth = locked ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(e.aimAng || 0) * (e.gazeRange || 340), Math.sin(e.aimAng || 0) * (e.gazeRange || 340));
      ctx.stroke();
    }
    // hunter: dashes through the marked spot — speed lines while striking
    if (e.kind === "hunter" && e.hDashT > 0) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(0, 0, e.r * 1.4, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // berserker: rage aura grows with each threshold
    if (e.kind === "berserker" && e.rageStage > 0) {
      ctx.globalAlpha = 0.18 + 0.12 * e.rageStage * Math.abs(Math.sin(game.time * (6 + e.rageStage * 3)));
      ctx.fillStyle = "#ff5a2a";
      ctx.beginPath(); ctx.arc(0, 0, e.r + 6 + e.rageStage * 3, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // commander: banner pole + inspiration aura ring
    if (e.kind === "commander") {
      ctx.strokeStyle = "rgba(255,209,102,0.35)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(0, 0, e.r + 10, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "#8a6a2a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -e.r); ctx.lineTo(0, -e.r - 16); ctx.stroke();
      ctx.fillStyle = "#ffd166";
      ctx.beginPath(); ctx.moveTo(0, -e.r - 16); ctx.lineTo(12, -e.r - 12); ctx.lineTo(0, -e.r - 8); ctx.closePath(); ctx.fill();
    }
    // tentacle: rooted spike crown
    if (e.kind === "tentacle") {
      ctx.strokeStyle = e.color; ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const an = i / 8 * Math.PI * 2 + Math.sin(game.time * 2 + i) * 0.2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(an) * e.r * 0.7, Math.sin(an) * e.r * 0.7);
        ctx.lineTo(Math.cos(an) * (e.r + 8), Math.sin(an) * (e.r + 8));
        ctx.stroke();
      }
    }
    // drone: buzzing wings
    if (e.kind === "drone") {
      const flap = Math.sin(game.time * 24) * 5;
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-e.r, -2); ctx.quadraticCurveTo(-e.r - 8, -6 - flap, -e.r - 3, -8 - flap); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(e.r, -2); ctx.quadraticCurveTo(e.r + 8, -6 - flap, e.r + 3, -8 - flap); ctx.stroke();
    }
    // elite modifier marker: a gold spark orbits every elite foe
    if (e.eliteMod && !e.isBoss) {
      const ea = game.time * 3;
      ctx.fillStyle = e.eliteMod === "AUREATE" ? "#ffd166" : "#ffb45e";
      ctx.shadowColor = "#ffd166"; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(Math.cos(ea) * (e.r + 8), Math.sin(ea) * (e.r + 8) * 0.6 - e.r * 0.4, 2.5, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
    }
    // WARDING elites + shielded minions: guard dome
    if (!e.isBoss && e.shieldT > 0) {
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(game.time * 16);
      ctx.strokeStyle = "#e8e8f8";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, e.r + 7, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (e.isBoss) { ctx.shadowColor = e.color; ctx.shadowBlur = 18; }
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.arc(0, 0, e.r, 0, 7); ctx.fill();

    // white flash when damaged
    if (e.hurtT > 0) {
      ctx.globalAlpha = Math.min(1, e.hurtT / 0.12) * 0.7;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(0, 0, e.r, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // eyes
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.arc(-e.r * 0.3, -e.r * 0.35, e.r * 0.3, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(e.r * 0.3, -e.r * 0.35, e.r * 0.3, 0, 7); ctx.fill();

    // freezer: ice crystals
    if (e.kind === "freezer") {
      ctx.strokeStyle = "#dff6ff";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const a = game.time * 1.5 + (i / 3) * Math.PI * 2;
        const cx = Math.cos(a) * (e.r + 6), cy = Math.sin(a) * (e.r + 6);
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy); ctx.lineTo(cx + 3, cy);
        ctx.moveTo(cx, cy - 3); ctx.lineTo(cx, cy + 3);
        ctx.stroke();
      }
    }

    // bolt maw: dashed hunger ring; swallowed shots orbit as motes
    if (e.kind === "bolt_eater") {
      ctx.strokeStyle = "rgba(168,140,255,0.35)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(0, 0, e.eatR || 74, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#a88cff";
      ctx.shadowColor = "#a88cff"; ctx.shadowBlur = 6;
      for (let i = 0; i < (e.fed || 0); i++) {
        const a = game.time * 4 + i * 1.3;
        ctx.beginPath(); ctx.arc(Math.cos(a) * (e.r + 6), Math.sin(a) * (e.r + 6), 2.5, 0, 7); ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    // summoner: orbiting summoning motes
    if (e.kind === "summoner") {
      ctx.fillStyle = "#c084fc";
      for (let i = 0; i < 2; i++) {
        const a = game.time * 2.5 + i * Math.PI;
        ctx.beginPath(); ctx.arc(Math.cos(a) * (e.r + 7), Math.sin(a) * (e.r + 7), 3, 0, 7); ctx.fill();
      }
    }

    // bomber fuse blink
    if (e.kind === "bomber") {
      ctx.fillStyle = Math.floor(game.time * 8) % 2 ? "#fff" : "#ff7847";
      ctx.beginPath(); ctx.arc(0, -e.r - 5, 3, 0, 7); ctx.fill();
    }

    // boss crown + enrage aura
    if (e.isBoss) {
      /* idea 18: BONE WARDEN guard window — dome that blocks hits */
      if (e.shieldT > 0) {
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = "#c8c8e8";
        ctx.beginPath(); ctx.arc(0, 0, e.r + 9, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.55 + 0.3 * Math.sin(game.time * 16);
        ctx.strokeStyle = "#e8e8f8";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, e.r + 9, 0, 7); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(-9, -e.r - 14, 18, 6);
      ctx.fillRect(-12, -e.r - 8, 24, 3);
      if (e.enraged2) {
        ctx.globalAlpha = 0.3 + 0.25 * Math.sin(game.time * 12);
        ctx.fillStyle = "#ff2a6a";
        ctx.beginPath(); ctx.arc(0, 0, e.r + 12, 0, 7); ctx.fill();
      } else if (e.enraged) {
        ctx.globalAlpha = 0.25 + 0.2 * Math.sin(game.time * 10);
        ctx.fillStyle = "#ff5a2a";
        ctx.beginPath(); ctx.arc(0, 0, e.r + 10, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // hp bar
    const bw = e.r * 2;
    ctx.fillStyle = "#221b33";
    ctx.fillRect(-bw / 2, -e.r - 8, bw, 4);
    ctx.fillStyle = e.isBoss ? "#ff5a2a" : "#ffd166";
    ctx.fillRect(-bw / 2, -e.r - 8, bw * Math.max(0, e.hp / e.maxHp), 4);
    ctx.restore();
  }
}

function drawProjectiles(game) {
  for (const pr of game.projectiles) {
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.shadowColor = pr.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = pr.color;
    if (pr.bolt) {            // lightning spear: crackling streak
      const ln = Math.hypot(pr.vx, pr.vy) || 1;
      ctx.strokeStyle = pr.color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-pr.vx / ln * 18, -pr.vy / ln * 18);
      ctx.lineTo(pr.vx / ln * 8, pr.vy / ln * 8);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(pr.vx / ln * 6, pr.vy / ln * 6, 2.5, 0, 7); ctx.fill();
    } else if (pr.chakram) {  // spinning disc
      ctx.rotate(game.time * 14);
      ctx.strokeStyle = pr.color;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, pr.r, 0.3, Math.PI * 2 - 0.3); ctx.stroke();
      ctx.fillStyle = pr.color;
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, pr.r, 0, 7); ctx.fill();
    }
    if (pr.boom) {           // staff fireball core
      ctx.fillStyle = "#ffd166";
      ctx.beginPath(); ctx.arc(0, 0, pr.r * 0.45, 0, 7); ctx.fill();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, pr.r + 2, 0, 7); ctx.stroke();
    ctx.restore();
  }
}

function drawPlayer(game) {
  const p = game.player;
  if (!p) return;
  const G = game.G;
  ctx.save();
  ctx.translate(p.x, p.y);

  // idea 7: slash-arc afterimages (last few arcs; weapons size their own arc)
  for (const a of game.arcs || []) {
    const fade = clamp(a.t / 0.25, 0, 1);
    const R = a.r || 36, ARC = a.arc || 1.0;
    ctx.save();
    ctx.globalAlpha = fade * 0.45;
    ctx.strokeStyle = a.color || "#e8e3f5";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    const a0 = a.ang - ARC;
    ctx.beginPath();
    ctx.arc(0, 0, R, Math.min(a0, a.ang), Math.max(a0, a.ang));
    ctx.stroke();
    ctx.restore();
  }

  // dash trail
  if (p.dashT > 0) {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#6fc3ff";
    ctx.beginPath();
    ctx.arc(-Math.cos(p.dashAng) * 14, -Math.sin(p.dashAng) * 14, p.r, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (G.godMode) { ctx.shadowColor = "#ffd166"; ctx.shadowBlur = 18; }
  if (G.invulnT > 0 && Math.floor(game.time * 18) % 2 === 0) ctx.globalAlpha = 0.45;   // idea 4: grace-window blink
  if (p.hurtT > 0 && Math.floor(game.time * 20) % 2 === 0) ctx.globalAlpha = 0.4;
  ctx.fillStyle = "#6fc3ff";
  ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 7); ctx.fill();
  ctx.fillStyle = "#4a90c8";
  ctx.beginPath(); ctx.arc(0, -3, p.r * 0.7, 0, 7); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(Math.cos(p.dir) * 4, Math.sin(p.dir) * 4 - 3, 3, 0, 7); ctx.fill();

  // chilled aura
  if (G.slowT > 0) {
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(game.time * 8);
    ctx.strokeStyle = "#7fd4e8";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, p.r + 5, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // sword swing arc
  if (p.swing > 0) {
    const a0 = p.dir - 1.0 + (1 - p.swing / 0.3) * 2.0;
    ctx.strokeStyle = G.godMode ? "#ffd166" : "#e8e3f5";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(Math.cos(a0) * 12, Math.sin(a0) * 12);
    ctx.lineTo(Math.cos(a0) * 44, Math.sin(a0) * 44);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 36, Math.min(a0, p.dir), Math.max(a0, p.dir)); ctx.stroke();
  }
  ctx.restore();
}

function drawMinimap(game) {
  const w = 92, h = 69, pad = 10;
  const sx = CFG.W - pad - w, sy = CFG.H - pad - h;   /* bottom-right, clear of the HUD */
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "rgba(13,11,20,0.6)";
  ctx.fillRect(sx, sy, w, h);
  ctx.strokeStyle = "rgba(155,144,184,0.4)";
  ctx.strokeRect(sx, sy, w, h);
  const px = v => sx + v / CFG.W * w;
  const py = v => sy + v / CFG.H * h;
  for (const pt of minimapData(game)) {
    ctx.fillStyle = pt.c;
    ctx.fillRect(px(pt.x) - 1.5, py(pt.y) - 1.5, 3, 3);
  }
  const p = game.player;
  if (p) {
    ctx.fillStyle = "#6fc3ff";
    ctx.fillRect(px(p.x) - 2, py(p.y) - 2, 4, 4);
  }
  ctx.restore();
}

function drawEffects(game) {
  for (const f of game.effects) {
    const a = clamp(f.t / (f.maxt || 0.3), 0, 1);
    if (f.type === "hit") {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color || "#fff";
      const size = f.crit ? 17 : 14;
      ctx.font = `bold ${size}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText(f.txt, f.x, f.y - 10 - (1 - a) * 20);
      ctx.restore();
    } else if (f.type === "heal") {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = "#6bff9a";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.fillText(f.txt, f.x, f.y - 20);
      ctx.restore();
    } else if (f.type === "boom") {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = "#ff7847";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(f.x, f.y, (1 - a) * 40, 0, 7); ctx.stroke();
      ctx.restore();
    } else if (f.type === "waveflash") {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = "#6fc3ff";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, (1 - a) * 30, 0, 7); ctx.stroke();
      ctx.restore();
    } else if (f.type === "spark") {        // idea 4: directional sparks
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.t / 0.28);
      ctx.fillStyle = f.color;
      ctx.fillRect(f.x - 2, f.y - 2, 4, 4);
      ctx.restore();
    } else if (f.type === "shard") {        // idea 8: death shards
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.t / 0.5);
      ctx.fillStyle = f.color;
      ctx.translate(f.x, f.y);
      ctx.rotate(f.t * 6);
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
    } else if (f.type === "trail") {        // idea 5: projectile trails
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.t / 0.16) * 0.5;
      ctx.fillStyle = f.color;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r || 3, 0, 7); ctx.fill();
      ctx.restore();
    } else if (f.type === "muzzle") {       // idea 6: muzzle flash
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.t / 0.07);
      ctx.fillStyle = f.color || "#fff";
      ctx.translate(f.x, f.y);
      ctx.rotate(f.dir);
      ctx.beginPath();
      ctx.moveTo(6, -3); ctx.lineTo(20, 0); ctx.lineTo(6, 3);
      ctx.fill();
      ctx.restore();
    } else if (f.type === "hurt") {         // player damage ring
      ctx.save();
      ctx.globalAlpha = a * 0.5;
      ctx.strokeStyle = "#ff5d5d";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, (1 - a) * 24, 0, 7); ctx.stroke();
      ctx.restore();
    } else if (f.type === "beam") {         // idea 24: healer beam
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = f.color || "#6bff9a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2);
      ctx.stroke();
      ctx.restore();
    } else if (f.type === "ring") {         // idea 18: closing telegraph ring
      ctx.save();
      ctx.globalAlpha = a * 0.8;
      ctx.strokeStyle = f.color || "#fff";
      ctx.lineWidth = 2 + a * 3;
      ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(4, (f.r || 40) * (1 - a)), 0, 7); ctx.stroke();
      ctx.restore();
    }
  }
}
