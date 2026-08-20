/* ============================================================
   BLOB KNIGHT — sfx: tiny WebAudio synth, zero assets
   ============================================================ */
"use strict";

const SFX = (() => {
  let ac = null;

  /* browsers only allow audio after a user gesture: call unlock() on
     the first keypress / click, everything else degrades silently */
  function ctx() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { ac = null; }
    }
    if (ac && ac.state === "suspended") ac.resume();
    return ac;
  }

  function tone(freq, dur, type, vol, slideTo) {
    const a = ctx();
    if (!a || G.mute) return;
    try {
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, a.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), a.currentTime + dur);
      const v = (vol || 0.04) * (SETTINGS.vol ?? 0.8);   // idea 66: master volume
      g.gain.setValueAtTime(v, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
      o.connect(g);
      g.connect(a.destination);
      o.start();
      o.stop(a.currentTime + dur + 0.03);
    } catch (e) { /* audio is a nicety, never fatal */ }
  }

  return {
    unlock: ctx,
    heartbeat() {                                  // idea 74: low-HP heartbeat
      tone(70, 0.1, "sine", 0.05, 55);
      setTimeout(() => tone(60, 0.12, "sine", 0.045, 48), 150);
    },
    /* idea 77: distinct attack SFX per weapon type */
    weapon(kind) {
      switch (kind) {
        case "sword":     tone(520, 0.09, "square", 0.035, 180); break;
        case "spear":     tone(340, 0.08, "square", 0.03, 120); tone(240, 0.06, "triangle", 0.02, 90); break;
        case "crossbow":  tone(700, 0.05, "square", 0.03, 300); tone(140, 0.1, "triangle", 0.025, 60); break;
        case "staff":     tone(280, 0.12, "sawtooth", 0.02, 90); tone(560, 0.1, "triangle", 0.018, 220); break;
        case "wave":      tone(180, 0.16, "sine", 0.03, 420); break;
        case "boomerang": tone(400, 0.14, "triangle", 0.025, 900); break;
        case "orbs":      tone(660, 0.1, "sine", 0.025, 330); break;
        case "chain":     tone(900, 0.2, "sawtooth", 0.03, 120); tone(1400, 0.08, "square", 0.02, 300); break;
        default:          tone(500, 0.08, "square", 0.03, 200);
      }
    },
    hit:      () => tone(240, 0.07, "square",   0.035, 160),
    crit:     () => tone(520, 0.12, "square",   0.05,  180),
    shield:   () => tone(340, 0.09, "square",   0.045, 210),   // idea 18: boss guard clank
    hurt:     () => tone(130, 0.18, "sawtooth", 0.05,  70),
    pickup:   () => tone(680, 0.08, "triangle", 0.045, 900),
    potion:   () => tone(520, 0.14, "triangle", 0.045, 780),
    dash:     () => tone(300, 0.12, "sine",     0.05,  640),
    boom:     () => tone(90,  0.25, "sawtooth", 0.06,  40),
    boss:     () => tone(70,  0.4,  "sawtooth", 0.07,  50),
    buy:      () => tone(760, 0.07, "triangle", 0.045, 620),
    teleport: () => tone(900, 0.1,  "sine",     0.035, 300),
    heal: () => { tone(520, 0.12, "sine", 0.04, 780); setTimeout(() => tone(680, 0.12, "sine", 0.04, 900), 90); },
    levelup() {
      tone(523, 0.1,  "triangle", 0.05);
      setTimeout(() => tone(659, 0.1,  "triangle", 0.05), 100);
      setTimeout(() => tone(784, 0.2,  "triangle", 0.05), 200);
    },
    /* ideas 75/76: procedural zone music with boss layer */
    musicOn: false,
    _mTimer: 0, _mStep: 0,
    musicTick(dt) {
      if (!this.musicOn || G.mute) return;
      this._mTimer -= dt;
      if (this._mTimer > 0) return;
      const scales = {
        0: [261.63, 329.63, 392, 523.25],
        1: [220, 261.63, 329.63, 392],          // forest: A-minor mood
        2: [174.61, 220, 261.63, 349.23],       // caves: darker
        3: [196, 246.94, 293.66, 392],          // ruins
        4: [146.83, 185, 220, 293.66],          // crypts
        5: [130.81, 164.81, 196, 261.63],       // volcanic
        6: [110, 138.59, 164.81, 220],          // void: lowest dread
      };
      const sc = scales[G.level] || scales[1];
      const boss = !!G.bossSpawned;
      const beat = boss ? 0.17 : 0.26;          // boss = faster heartbeat tempo
      this._mTimer = beat * (2 + (this._mStep % 3));
      const step = this._mStep++;
      const root = sc[step % sc.length];
      if (step % 4 === 0) tone(root, beat * 2, "triangle", 0.016, root * 0.98);
      if (step % 8 === 4) tone(root * 2, beat * 1.6, "sine", 0.010);
      if (boss && step % 2 === 1) tone(root / 2, beat * 2.2, "sawtooth", 0.010);  // idea 76: bass layer
      if (boss && step % 8 === 6) tone(root * 3, beat * 1.2, "sine", 0.008);      // tense sparkle
    },
  };
})();
