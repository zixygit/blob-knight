/* ============================================================
   EMBERQUEST 2D — sfx: tiny WebAudio synth, zero assets
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
      g.gain.setValueAtTime(vol || 0.04, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
      o.connect(g);
      g.connect(a.destination);
      o.start();
      o.stop(a.currentTime + dur + 0.03);
    } catch (e) { /* audio is a nicety, never fatal */ }
  }

  return {
    unlock: ctx,
    hit:      () => tone(240, 0.07, "square",   0.035, 160),
    crit:     () => tone(520, 0.12, "square",   0.05,  180),
    hurt:     () => tone(130, 0.18, "sawtooth", 0.05,  70),
    pickup:   () => tone(680, 0.08, "triangle", 0.045, 900),
    potion:   () => tone(520, 0.14, "triangle", 0.045, 780),
    dash:     () => tone(300, 0.12, "sine",     0.05,  640),
    boom:     () => tone(90,  0.25, "sawtooth", 0.06,  40),
    boss:     () => tone(70,  0.4,  "sawtooth", 0.07,  50),
    buy:      () => tone(760, 0.07, "triangle", 0.045, 620),
    teleport: () => tone(900, 0.1,  "sine",     0.035, 300),
    levelup() {
      tone(523, 0.1,  "triangle", 0.05);
      setTimeout(() => tone(659, 0.1,  "triangle", 0.05), 100);
      setTimeout(() => tone(784, 0.2,  "triangle", 0.05), 200);
    },
  };
})();
