/* ============================================================
   EMBERQUEST 2D — canvas renderer
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

  ctx.save();
  if (game.shake > 0) {
    const s = Math.min(1, game.shake / 0.25) * 6;
    ctx.translate((Math.random() - 0.5) * 2 * s, (Math.random() - 0.5) * 2 * s);
  }

  /* floor */
  ctx.fillStyle = L.bg;
  ctx.fillRect(-10, -10, CFG.W + 20, CFG.H + 20);
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x < CFG.W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CFG.H); ctx.stroke(); }
  for (let y = 0; y < CFG.H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CFG.W, y); ctx.stroke(); }

  /* walls */
  ctx.strokeStyle = L.wall;
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, CFG.W - 12, CFG.H - 12);

  drawLoot(game);
  drawDoor(game);
  drawWaves(game);
  drawEnemies(game);
  drawProjectiles(game);
  drawPlayer(game);
  drawEffects(game);

  ctx.restore();
}

function drawLoot(game) {
  const colors = { gold: "#ffd166", potion: "#ff6b6b", herb: "#6bff9a", stone: "#e8e3f5", charm: "#c084fc", rune: "#8fd4ff" };
  for (const l of game.G.loot) {
    ctx.save();
    ctx.translate(l.x, l.y + Math.sin(l.t * 4) * 2);
    ctx.shadowColor = colors[l.type];
    ctx.shadowBlur = 8;
    ctx.fillStyle = colors[l.type];
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
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
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(111,195,255,0.15)";
    ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, 7); ctx.fill();
    ctx.strokeStyle = "#6fc3ff";
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

    // charger telegraph
    if (e.kind === "charger" && e.windup > 0) {
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(game.time * 14));
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(0, 0, e.r + 6, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
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
    ctx.beginPath(); ctx.arc(0, 0, pr.r, 0, 7); ctx.fill();
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

function drawEffects(game) {
  for (const f of game.effects) {
    const a = clamp(f.t / 0.3, 0, 1);
    if (f.type === "hit") {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = f.crit ? "#ffd166" : "#fff";
      ctx.font = f.crit ? "bold 17px monospace" : "bold 14px monospace";
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
    }
  }
}
