import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const GAME_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['config.js', 'sfx.js', 'entities.js', 'weapons.js', 'render.js', 'game.js'];
const errors = [];
const rafQueue = [];
let now = 0;
const listeners = {};

function makeElement(id) {
  return {
    id,
    style: {},
    textContent: '',
    innerHTML: '',
    value: '',
    type: '',
    maxLength: 14,
    placeholder: '',
    autocomplete: '',
    spellcheck: false,
    disabled: false,
    className: '',
    onclick: null,
    _handlers: {},
    getContext: () => ctxStub,
    addEventListener(type, fn) { (this._handlers[type] ||= []).push(fn); },
    focus() {},
    appendChild() {},
    classList: {
      _set: new Set(),
      add(...a) { a.forEach(x => this._set.add(x)); },
      remove(...a) { a.forEach(x => this._set.delete(x)); },
      toggle(c, force) { force ? this._set.add(c) : this._set.delete(c); },
      contains(c) { return this._set.has(c); },
    },
  };
}

const elements = new Map();
const ctxStub = new Proxy({}, {
  get(_, prop) {
    if (prop === 'measureText') return () => ({ width: 10 });
    if (prop === 'createLinearGradient') return () => ({ addColorStop() {} });
    return () => undefined;
  },
  set() { return true; },
});
let lastCreatedInput = null;
let createdButtons = [];

const documentStub = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  },
  createElement(tag) {
    const el = makeElement(null);
    if (tag === 'input') lastCreatedInput = el;
    if (tag === 'button') createdButtons.push(el);
    return el;
  },
  querySelector(sel) { return sel === '#overlay input' ? lastCreatedInput : null; },
  addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
};

function dispatch(type, e) {
  for (const fn of listeners[type] || []) {
    try { fn(e); } catch (err) { errors.push(`listener ${type}: ${err.stack}`); }
  }
}

const sandbox = {
  console,
  document: documentStub,
  window: {
    AudioContext: class {
      constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
      resume() { this.state = 'running'; }
      createOscillator() {
        return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} };
      }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    },
    webkitAudioContext: null,
  },
  addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
  requestAnimationFrame: cb => { rafQueue.push(cb); },
  performance: { now: () => now },
  setTimeout: (fn) => { fn(); return 1; },
  clearTimeout: () => {},
  Math, JSON, Object, Array, Number, String, Boolean, RegExp, Date, isNaN, parseFloat, parseInt,
};

sandbox.globalThis = sandbox;
vm.createContext(sandbox);

let source = '';
for (const file of FILES) source += fs.readFileSync(`${GAME_DIR}/js/${file}`, 'utf8') + '\n';
source += '\nglobalThis.__G = G; globalThis.__game = game; globalThis.__CFG = CFG; globalThis.__KONAMI = KONAMI; globalThis.__keys = keys;\n';

try {
  vm.runInContext(source, sandbox, { filename: 'game.js' });
} catch (err) {
  console.error('LOAD ERROR:', err.stack);
  process.exit(1);
}

const G = sandbox.__G;
const game = sandbox.__game;

function press(key, repeat = false) {
  dispatch('keydown', { key, target: null, repeat, preventDefault() {} });
  dispatch('keyup', { key, target: null });
}
function step(frames = 1, dtMs = 16) {
  for (let i = 0; i < frames; i++) {
    now += dtMs;
    const cb = rafQueue.shift();
    if (!cb) { errors.push('rAF queue empty — game loop stopped'); return; }
    cb(now);
  }
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function walkToDoor(maxFrames) {
  const d = game.G.door;
  if (!d) return;
  let walked = 0;
  while (walked < maxFrames && G.phase === 'play') {
    const p = game.player;
    sandbox.__keys['w'] = d.y < p.y - 4;
    sandbox.__keys['s'] = d.y > p.y + 4;
    sandbox.__keys['a'] = d.x < p.x - 4;
    sandbox.__keys['d'] = d.x > p.x + 4;
    step(2);
    if (dist(p, d) < 34) break;
    walked += 2;
  }
  for (const k of ['w', 's', 'a', 'd']) sandbox.__keys[k] = false;
}
function chaseAndKill(maxFrames) {
  let frames = 0;
  while (game.enemies.length > 0 && frames < maxFrames) {
    const p = game.player;
    const target = game.enemies.reduce((best, e) => (dist(p, e) < dist(p, best) ? e : best));
    sandbox.__keys['w'] = target.y < p.y - 6;
    sandbox.__keys['s'] = target.y > p.y + 6;
    sandbox.__keys['a'] = target.x < p.x - 6;
    sandbox.__keys['d'] = target.x > p.x + 6;
    if (dist(p, target) < 130) press(' ');
    step(3);
    frames += 3;
  }
  for (const k of ['w', 's', 'a', 'd']) sandbox.__keys[k] = false;
}

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
}

/* ---- initial state ---- */
check('boot: menu phase', G.phase === 'menu', G.phase);
check('boot: overlay rendered', elements.get('overlay') && elements.get('overlay').innerHTML.includes('EMBER'), elements.get('overlay')?.innerHTML.slice(0, 40));

/* ---- start game ---- */
lastCreatedInput.value = 'HARNESS';
sandbox.beginGame();
check('beginGame: play phase', G.phase === 'play', G.phase);
check('beginGame: player spawned', !!game.player, JSON.stringify(game.player));
check('beginGame: enemies spawned', game.enemies.length > 0, game.enemies.length);
check('beginGame: hero name set', G.name === 'HARNESS', G.name);

/* ---- survival segment without godMode: enemy contact damage, potion, dash ---- */
step(400);
const hpBefore = G.hp;
check('survival: player took contact damage', G.hp < G.maxHp, `${G.hp}/${G.maxHp}`);
press('e');
check('potion: consumed when hurt', G.potions === 1 || G.hp > hpBefore, `potions=${G.potions} hp=${G.hp}`);
press('shift');
check('dash: active i-frames', game.player.dashT > 0, game.player.dashT);

/* ---- god mode for the rest of the run ---- */
G.godMode = true;

/* ---- candle easter egg ---- */
for (let i = 0; i < 5; i++) {
  const el = elements.get('candle');
  for (const fn of el._handlers.click || []) fn();
  step(1);
}
check('easter egg: candle +100 gold', G.gold >= 100, G.gold);

/* ---- konami code: god mode toggle ---- */
for (const k of sandbox.__KONAMI) press(k);
step(1);
check('easter egg: konami toggles god mode', G.godMode === false, G.godMode);
G.godMode = true;

/* ---- pause / mute / weapon cycle ---- */
press('p');
check('pause: phase paused', G.phase === 'paused', G.phase);
press('p');
check('pause: resumed', G.phase === 'play', G.phase);
press('m');
check('mute: toggled', G.mute === true, G.mute);
press('m');

/* ---- fight through level 1: attack until enemies die ---- */
chaseAndKill(9000);
check('level 1: all enemies slain', game.enemies.length === 0, `${game.enemies.length} left, kills=${G.kills}`);
check('level 1: door opened after boss', (game.G.door && game.G.door.open === true) || G.phase === 'shop', JSON.stringify({door: game.G.door, phase: G.phase}));
check('level 1: enemies drop loot', game.G.loot.length > 0 || G.gold > 0, `loot=${game.G.loot.length}, gold=${G.gold}`);

/* ---- pick up loot ---- */
let lootFrames = 0;
while (game.G.loot.length > 0 && lootFrames < 400) { step(2); lootFrames += 2; }

/* ---- enter shop ---- */
walkToDoor(1200);
check('shop: entered', G.phase === 'shop', G.phase);
check('shop: merchant overlay rendered', elements.get('overlay').innerHTML.includes('CAMPFIRE'), elements.get('overlay').innerHTML.slice(0, 50));
check('shop: buy buttons created', createdButtons.length >= 9, createdButtons.length);

/* ---- buy weapons and fire each ---- */
G.gold = 9999;
sandbox.buyWeapon('wave');
check('shop: wave blade owned', game.weapons.includes('wave'), game.weapons.join(','));
sandbox.resumePlay();
game.player.attackCd = 0;
press(' ');
step(2);
check('shop: wave attack fired', game.waves.length > 0, game.waves.length);
G.phase = 'shop';
sandbox.buyWeapon('crossbow');
sandbox.selectWeapon(3);
sandbox.resumePlay();
game.player.attackCd = 0;
press(' ');
step(2);
check('shop: crossbow fires bolts', game.projectiles.some(p => p.team === 'player'), game.projectiles.length);
G.phase = 'shop';
sandbox.buyWeapon('staff');
sandbox.selectWeapon(4);
sandbox.resumePlay();
game.player.attackCd = 0;
press(' ');
step(2);
check('shop: staff fires fireball', game.projectiles.some(p => p.team === 'player' && p.boom), game.projectiles.length);
G.phase = 'shop';

/* ---- play through levels 2-5 ---- */
let level = 2;
while (level <= 5 && G.phase === 'shop') {
  sandbox.nextLevel();
  check(`level ${level}: entered`, G.phase === 'play', G.phase);
  sandbox.selectWeapon(1);
  chaseAndKill(15000);
  check(`level ${level}: cleared`, game.enemies.length === 0, `kills=${G.kills}`);
  walkToDoor(1500);
  check(`level ${level}: shop reached`, G.phase === 'shop', G.phase);
  level++;
}

/* ---- final level 6 ---- */
sandbox.nextLevel();
check('level 6: entered', G.phase === 'play', G.phase);
sandbox.selectWeapon(1);
chaseAndKill(20000);
check('level 6: cleared (boss slain)', game.enemies.length === 0, `kills=${G.kills}`);
walkToDoor(1500);
check('level 6: final shop', G.phase === 'shop', G.phase);
sandbox.nextLevel();
check('game: WIN state', G.phase === 'won', G.phase);

/* ---- death path ---- */
G.godMode = false;
sandbox.resetGame();
sandbox.beginGame();
G.godMode = false;
G.hp = 1;
sandbox.__keys['w'] = true;
sandbox.__keys['d'] = true;
step(1500);
sandbox.__keys['w'] = false;
sandbox.__keys['d'] = false;
check('death: phase dead after hp depletion', G.phase === 'dead', `${G.phase} hp=${G.hp}`);

/* ---- try-again path ---- */
sandbox.resetGame();
check('reset: back to menu', G.phase === 'menu', G.phase);

/* ---- results ---- */
console.log('\n=== EMBERQUEST 2D SMOKE TEST ===\n');
let pass = 0, fail = 0;
for (const r of results) {
  const mark = r.ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${r.name}${r.ok ? '' : `  -> ${r.extra}`}`);
  r.ok ? pass++ : fail++;
}
if (errors.length) {
  console.log('\n=== RUNTIME ERRORS ===');
  for (const e of errors) console.log(e);
}
console.log(`\n${pass} passed, ${fail} failed, ${errors.length} runtime errors`);
process.exit(fail || errors.length ? 1 : 0);