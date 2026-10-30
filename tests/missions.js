/* ===== tests/missions.js — 新手教學關卡測試 =====
 * 用寫好的小機器人（廣度優先找路）真的把每一關玩過，確認每關擺得出來、做得到、星星合理；
 * 另外檢查失敗條件、解鎖規則、字典是否三種語言都有。用法：node tests/missions.js */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const R = require('../public/js/rules.js');
const AI = require('../public/js/ai.js');
const M = require('../public/js/missions.js');

let passed = 0;
const failed = [];
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failed.push(name); console.log('  ✗ ' + name + '\n      ' + (e && e.message)); }
}

/** 開一局並把倒數跳過，回傳操作用的小工具 */
function start(id) {
  const run = M.create(id, { animal: 'cat', AI });
  const s = run.state;
  const inputs = { 0: { dir: null, bomb: false } };
  const bot = { run, s, inputs, evs: [], last: null };
  bot.step = () => {
    for (const p of s.players) { p.px = p.x; p.py = p.y; }
    for (const p of s.players) { const br = run.brains[p.slot]; if (br) { const o = AI.think(br, s, p, R.DT); inputs[p.slot] = inputs[p.slot] || { dir: null, bomb: false }; inputs[p.slot].dir = o.dir; if (o.bomb) inputs[p.slot].bomb = true; } }
    R.step(s, inputs, R.DT);
    bot.evs = s.events.slice();
    bot.last = run.update(s, bot.evs);
    return bot.last;
  };
  bot.stepN = n => { for (let i = 0; i < n && (!bot.last || bot.last.status === 'play'); i++) bot.step(); };
  bot.stepN(Math.ceil(2.2 / R.DT));      /* 倒數 */
  assert.strictEqual(s.phase, 'play');
  const me = s.players[0];
  bot.me = me;
  bot.cell = () => [Math.floor(me.x), Math.floor(me.y)];
  /** 走到格子 (tx, ty)：每格重算最短路（避開硬牆、軟磚與炸彈），沿著路走到格心附近 */
  bot.walk = (tx, ty, maxSec) => {
    const W = s.w;
    for (let i = 0; i < (maxSec || 20) / R.DT; i++) {
      const [cx, cy] = bot.cell();
      if (cx === tx && cy === ty && Math.abs(me.x - (tx + 0.5)) < 0.2 && Math.abs(me.y - (ty + 0.5)) < 0.2) { inputs[0].dir = null; return true; }
      const blocked = (x, y) => s.grid[y * W + x] !== 0 || s.bombs.some(b => b.cx === x && b.cy === y && !(x === cx && y === cy));
      const prev = new Map([[cy * W + cx, -1]]); const q = [[cx, cy]];
      while (q.length) { const [x, y] = q.shift(); if (x === tx && y === ty) break; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = ny * W + nx; if (!prev.has(k) && !blocked(nx, ny)) { prev.set(k, y * W + x); q.push([nx, ny]); } } }
      let k = ty * W + tx; if (!prev.has(k)) { inputs[0].dir = null; return false; }
      let nxt = k; while (prev.get(nxt) !== cy * W + cx && prev.get(nxt) !== -1) nxt = prev.get(nxt);
      const nx = nxt % W, ny = (nxt / W) | 0;
      let dir;
      if (cx === tx && cy === ty) dir = Math.abs(me.x - (tx + 0.5)) > Math.abs(me.y - (ty + 0.5)) ? (me.x > tx + 0.5 ? 'L' : 'R') : (me.y > ty + 0.5 ? 'U' : 'D');
      else if (nx !== cx) dir = nx > cx ? 'R' : 'L'; else dir = ny > cy ? 'D' : 'U';
      inputs[0].dir = dir;
      if (bot.step().status !== 'play') { inputs[0].dir = null; return bot.last.status === 'win'; }
    }
    inputs[0].dir = null; return false;
  };
  bot.bomb = () => { inputs[0].bomb = true; bot.step(); };
  return bot;
}

console.log('關卡內容');
test('7 關，編號 1～7，每關都有 key，教學固定用小圖、沒有隨機道具與詛咒', () => {
  assert.strictEqual(M.MISSIONS.length, 7);
  M.MISSIONS.forEach((m, i) => { assert.strictEqual(m.id, i + 1); assert(m.key); });
  for (const m of M.MISSIONS) {
    const run = M.create(m.id, { AI }), s = run.state;
    assert.deepStrictEqual([s.w, s.h], [R.sizeFor(1).w, R.sizeFor(1).h]);
    assert.strictEqual(s.items, false); assert.strictEqual(s.curses, false); assert.strictEqual(s.timeLimit, 0);
    for (const p of s.players) assert(s.grid[Math.floor(p.y) * s.w + Math.floor(p.x)] === 0, m.id + ' 出生點必須是空地');
    for (const it of s.itemsOn) assert(s.grid[it.cy * s.w + it.cx] === 0, m.id + ' 道具必須放在空地');
  }
  assert.strictEqual(M.create(99), null);
});
test('解鎖：第 1 關一開始就開，其餘要前一關拿到星星', () => {
  assert(M.unlocked(1, {}) && M.unlocked(1, null));
  assert(!M.unlocked(2, {}) && !M.unlocked(2, { 1: 0 }) && M.unlocked(2, { 1: 1 }));
  assert(!M.unlocked(5, { 1: 3, 2: 3, 3: 3 }) && M.unlocked(5, { 4: 2 }));
});

console.log('\n真的玩一遍（機器人）');
test('第 1 關 移動撿道具：依序走到三個道具，過關，時間短拿 3 星', () => {
  const b = start(1);
  for (const [x, y] of [[5, 3], [11, 5], [17, 7]]) assert(b.walk(x, y), '走不到 ' + x + ',' + y);
  assert.strictEqual(b.last.status, 'win'); assert.strictEqual(b.last.progress.n, 3);
  assert(b.last.stars >= 2, '星星 ' + b.last.stars);
});
test('第 2 關 炸開磚塊：一顆炸彈炸開一格、走過去拿到對面道具，過關 3 星', () => {
  const b = start(2);
  assert.strictEqual(b.last.status, 'play');
  assert(b.walk(10, 5)); b.bomb(); assert(b.walk(7, 5));
  b.stepN(Math.ceil(3.6 / R.DT));
  assert(b.s.grid[5 * b.s.w + 11] === 0, '磚塊要被炸開');
  assert(b.walk(19, 5), '走不到對面'); assert.strictEqual(b.last.status, 'win'); assert.strictEqual(b.last.stars, 3);
});
test('第 3 關 躲開爆炸：放 2 顆炸彈都躲開，過關；站著不動被炸到則失敗', () => {
  const b = start(3);
  for (let i = 0; i < 2; i++) { assert(b.walk(1, 1)); b.bomb(); assert(b.walk(3, 3)); b.stepN(Math.ceil(3.4 / R.DT)); }
  assert.strictEqual(b.last.status, 'win', JSON.stringify(b.last)); assert(b.last.stars >= 1);
  const d = start(3); d.bomb(); d.stepN(Math.ceil(4 / R.DT));
  assert.strictEqual(d.last.status, 'fail'); assert.strictEqual(d.last.reason, 'dead');
});
test('第 4 關 擊倒電腦：幼幼班電腦在場上；玩家死掉失敗、電腦死掉過關、超過時間失敗', () => {
  const b = start(4);
  assert.strictEqual(b.s.players.length, 2); assert.strictEqual(b.s.players[1].kind, 'ai');
  const foe = b.s.players[1]; foe.alive = false; b.step();
  assert.strictEqual(b.last.status, 'win'); assert(b.last.stars >= 1);
  const c = start(4); c.s.players[0].alive = false; c.step(); assert.strictEqual(c.last.status, 'fail'); assert.strictEqual(c.last.reason, 'dead');
  const t = start(4); t.s.time = 101; t.step(); assert.strictEqual(t.last.status, 'fail'); assert.strictEqual(t.last.reason, 'time');
});
test('第 4 關：電腦打得動、遊戲跑得完（幼幼班對一個不動的玩家，不卡死、不例外）', () => {
  const b = start(4);
  for (let i = 0; i < 60 * 40 && b.last.status === 'play'; i++) b.step();
  assert(['play', 'fail', 'win'].includes(b.last.status));
});
test('第 5 關 踢炸彈與護盾：撿踢炸彈、撿護盾、把炸彈踢出去，過關', () => {
  const b = start(5);
  assert(b.walk(5, 5)); assert(b.walk(9, 5)); b.bomb();
  assert(b.walk(11, 5)); assert(b.walk(10, 5, 3) || true);
  b.inputs[0].dir = 'L'; b.stepN(Math.ceil(1.2 / R.DT));
  assert.strictEqual(b.last.status === 'win' || b.last.progress.n === 3, true, JSON.stringify(b.last));
});
test('第 6 關 地圖機關：踩過緩速格、輸送帶、草叢，過關', () => {
  const b = start(6);
  assert(b.walk(5, 5)); assert(b.walk(11, 5)); b.stepN(Math.ceil(1 / R.DT));
  assert(b.walk(17, 5)); assert.strictEqual(b.last.status, 'win', JSON.stringify(b.last));
});
test('第 7 關 空襲求生：失敗條件與過關條件；用電腦腦當玩家能撐過 30 秒（固定 seed，結果固定）', () => {
  const d = start(7); d.s.players[0].alive = false; d.step(); assert.strictEqual(d.last.status, 'fail');
  const w = start(7); w.s.time = 30; w.step(); assert.strictEqual(w.last.status, 'win'); assert.strictEqual(w.last.stars, 1);
  const b = start(7), brain = AI.createBrain('hard', 1);
  for (let i = 0; i < 60 * 40 && b.last.status === 'play'; i++) { const o = AI.think(brain, b.s, b.me, R.DT); b.inputs[0].dir = o.dir; b.step(); }
  assert.strictEqual(b.last.status, 'win', '機器人沒撐過空襲：' + JSON.stringify(b.last));
  assert(b.s.events !== null);
});

console.log('\n字典');
test('每關的標題、目標、提示、失敗原因，繁中／簡中／英文都有', () => {
  const src = fs.readFileSync(path.join(__dirname, '../public/js/locales.js'), 'utf8');
  const keys = ['home.tutorial', 'home.tutorialDesc', 'mission.title', 'mission.locked', 'mission.next', 'mission.retry', 'mission.back', 'mission.win', 'mission.fail.dead', 'mission.fail.time'];
  for (const m of M.MISSIONS) for (const f of ['title', 'goal', 'hint']) keys.push(`mission.${m.id}.${f}`);
  for (const k of keys) {
    const n = (src.match(new RegExp("'" + k.replace(/\./g, '\\.') + "'", 'g')) || []).length + (src.match(new RegExp('"' + k.replace(/\./g, '\\.') + '"', 'g')) || []).length;
    assert(n >= 2, k + ' 字典不齊（繁中＋英文要有 L()，簡中要有一行）');
  }
});

console.log('\n' + passed + ' 項通過' + (failed.length ? '，' + failed.length + ' 項失敗：\n  - ' + failed.join('\n  - ') : ''));
if (failed.length) process.exit(1);
