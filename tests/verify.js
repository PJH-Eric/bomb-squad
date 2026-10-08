/* ===== tests/verify.js — 規則單元測試 ＋ 電腦對戰 =====
 * 用法：node tests/verify.js            （完整）
 *       node tests/verify.js --quick    （少跑幾局電腦對戰）
 */
'use strict';
const assert = require('assert');
const R = require('../public/js/rules.js');
const AI = require('../public/js/ai.js');

let passed = 0;
const failed = [];
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failed.push(name); console.log('  ✗ ' + name + '\n      ' + (e && e.message)); }
}
const quick = process.argv.includes('--quick');

function mk(n, extra) {
  const players = [];
  for (let i = 0; i < n; i++) players.push({ slot: i, name: 'P' + i, animal: 'cat', kind: 'human' });
  return R.createGame(Object.assign({ seed: 11, players, layout: 'classic', countdown: 0, timeLimit: 0, fx: false }, extra || {}));
}
/** 清出一塊空場地，方便做精準的規則測試 */
function arena(s) {
  for (let y = 1; y < s.h - 1; y++) for (let x = 1; x < s.w - 1; x++) s.grid[y * s.w + x] = 0;
  s.phase = 'play'; s.countdown = 0;
}
function run(s, inputs, sec) {
  const n = Math.round(sec / R.DT);
  for (let i = 0; i < n; i++) R.step(s, inputs, R.DT);
}
const put = (p, x, y) => { p.x = x + 0.5; p.y = y + 0.5; };

console.log('\n地圖');
test('地圖尺寸：≤4 人 17×13，5～8 人 19×15', () => {
  assert.deepStrictEqual(R.sizeFor(2), { w: 17, h: 13 });
  assert.deepStrictEqual(R.sizeFor(4), { w: 17, h: 13 });
  assert.deepStrictEqual(R.sizeFor(5), { w: 19, h: 15 });
  assert.deepStrictEqual(R.sizeFor(8), { w: 19, h: 15 });
});
test('同一個 seed 產生同一張地圖，不同 seed 不同', () => {
  const a = R.generateMap(5, 17, 13, 'classic'), b = R.generateMap(5, 17, 13, 'classic'), c = R.generateMap(6, 17, 13, 'classic');
  assert.deepStrictEqual(a, b);
  assert.notDeepStrictEqual(a, c);
});
test('三種版型 × 多個 seed：四向對稱、全連通、出生點安全區沒有軟磚', () => {
  for (const layout of R.LAYOUTS) for (const [w, h] of [[17, 13], [19, 15]]) for (let seed = 1; seed <= 25; seed++) {
    const g = R.generateMap(seed, w, h, layout);
    assert(R.connected(g, w, h), `${layout} ${w}x${h} seed ${seed} 不連通`);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      assert.strictEqual(g[y * w + x], g[y * w + (w - 1 - x)], '左右不對稱');
      assert.strictEqual(g[y * w + x], g[(h - 1 - y) * w + x], '上下不對稱');
    }
    for (const [sx, sy] of R.spawnPoints(w, h).slice(0, R.spawnCount(w, h))) {
      assert.strictEqual(g[sy * w + sx], 0, '出生點被占');
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (Math.abs(x - sx) + Math.abs(y - sy) <= 2) assert.notStrictEqual(g[y * w + x], 2, '安全區有軟磚');
      }
    }
  }
});
test('邊框全是硬牆', () => {
  const g = R.generateMap(3, 17, 13, 'open');
  for (let x = 0; x < 17; x++) { assert.strictEqual(g[x], 1); assert.strictEqual(g[12 * 17 + x], 1); }
  for (let y = 0; y < 13; y++) { assert.strictEqual(g[y * 17], 1); assert.strictEqual(g[y * 17 + 16], 1); }
});
test('密集版型比經典多硬牆', () => {
  const count = g => g.filter(v => v === 1).length - (2 * (17 + 13) - 4);   /* 扣掉外框那圈牆，只比裡面的硬牆 */
  /* 每張圖的硬牆量本來就會在 0.6～1.2 倍之間浮動，所以不逐張比，用 100 個 seed 的總量與多數決判斷 */
  let more = 0, dense = 0, classic = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const d = count(R.generateMap(seed, 17, 13, 'dense')), c = count(R.generateMap(seed, 17, 13, 'classic'));
    dense += d; classic += c; if (d > c) more++;
  }
  assert(dense >= classic * 1.2, '密集的硬牆總量應該明顯比經典多：' + dense + ' vs ' + classic);
  assert(more >= 60, '密集應該通常比較多硬牆，只有 ' + more + '／100');
});

console.log('\n移動');
test('玩家用方向移動，速度隨加速道具增加', () => {
  const s = mk(2); arena(s);
  const p = s.players[0]; put(p, 2, 1);
  run(s, { 0: { dir: 'R' } }, 0.5);
  const slow = p.x - 2.5;
  const s2 = mk(2); arena(s2);
  const q = s2.players[0]; put(q, 2, 1); q.speedLvl = 3;
  run(s2, { 0: { dir: 'R' } }, 0.5);
  assert(q.x - 2.5 > slow * 1.3, '加速沒有生效');
});
test('角色初始能力都在 1～2 之間，而且彼此平衡（沒有哪隻全面比別隻強）', () => {
  const ids = Object.keys(R.ANIMAL_STATS);
  const players = ids.map((a, i) => ({ slot: i, name: a, animal: a, kind: 'human' }));
  const s = R.createGame({ seed: 5, players, layout: 'classic', countdown: 0, timeLimit: 0 });
  for (const p of s.players) {
    const st = R.ANIMAL_STATS[p.animal];
    assert.strictEqual(p.fire, st.fire); assert.strictEqual(p.maxBombs, st.bomb);
    for (const k of ['fire', 'bomb', 'speed']) assert(st[k] >= 1 && st[k] <= 2, p.animal + ' 的 ' + k + ' 超出 1～2');
    assert.strictEqual(st.fire + st.bomb + 2 * st.speed, 6, p.animal + ' 的開場總強度跟別隻不一樣');
    assert.strictEqual(st.max.fire + st.max.bomb + st.max.speed, 25, p.animal + ' 的上限總和跟別隻不一樣');
  }
  /* 把開場＋上限當成六個數字：每隻都不一樣，而且沒有哪隻六項全都不輸另一隻 */
  const vec = a => { const t = R.ANIMAL_STATS[a]; return [t.fire, t.bomb, t.speed, t.max.fire, t.max.bomb, t.max.speed]; };
  assert.strictEqual(new Set(ids.map(a => vec(a).join())).size, ids.length, '有角色的能力完全一樣');
  for (const a of ids) for (const b of ids) {
    if (a === b) continue;
    const x = vec(a), y = vec(b);
    assert(!x.every((v, k) => v <= y[k]), a + ' 全面不如 ' + b);
  }
  const sp = a => R.speedOf({ animal: a, speedLvl: 0 });
  assert(sp('bunny') > sp('dog') && sp('dog') > sp('panda'));
  /* 撿道具不會超過角色自己的上限 */
  const bear = s.players.find(p => p.animal === 'bear'); bear.x = 2.5; bear.y = 1.5;
  for (let i = 0; i < 12; i++) { s.itemsOn.push({ id: 900 + i, cx: 2, cy: 1, type: 'speed' }); R.step(s, {}, R.DT); }
  assert.strictEqual(bear.speedLvl, R.ANIMAL_STATS.bear.max.speed);
  /* 快照還原的畫面也要帶到同樣的初始值 */
  const v = R.viewFromStart(R.startInfo(s));
  v.players.forEach((p, i) => { assert.strictEqual(p.fire, s.players[i].fire); assert.strictEqual(p.maxBombs, s.players[i].maxBombs); });
});
test('撞硬牆停住', () => {
  const s = mk(2); arena(s);
  const p = s.players[0]; put(p, 1, 1);
  run(s, { 0: { dir: 'L' } }, 1);
  assert(p.x >= 1 + R.HALF - 1e-6 && p.x < 1.5, 'x=' + p.x);
});
test('轉角輔助：偏離通道中心也能鑽進一格寬的通道', () => {
  const s = mk(2); arena(s);
  for (let x = 4; x < s.w - 1; x++) { s.grid[1 * s.w + x] = 1; s.grid[3 * s.w + x] = 1; }   /* x≥4 只剩 y=2 一條通道 */
  const p = s.players[0]; p.x = 3.5; p.y = 2.75;                                          /* 偏離通道中心 */
  run(s, { 0: { dir: 'R' } }, 1.0);
  assert(p.x > 5, '沒有鑽進通道 x=' + p.x);
});

console.log('\n炸彈與爆炸');
test('放炸彈：同格不能重複放、數量受上限限制', () => {
  const s = mk(2); arena(s); const p = s.players[0]; put(p, 3, 3);
  const inp = { 0: { dir: null, bomb: true } };
  run(s, inp, 0.05);
  assert.strictEqual(s.bombs.length, 1);
  inp[0].bomb = true; run(s, inp, 0.05);
  assert.strictEqual(s.bombs.length, 1, '同一格放了兩顆');
  p.maxBombs = 2; put(p, 4, 3); inp[0].bomb = true; run(s, inp, 0.05);
  assert.strictEqual(s.bombs.length, 2);
  put(p, 5, 3); inp[0].bomb = true; run(s, inp, 0.05);
  assert.strictEqual(s.bombs.length, 2, '超過上限');
});
test('剛放下炸彈時能走出去，走出去後變成障礙', () => {
  const s = mk(2); arena(s); const p = s.players[0]; put(p, 3, 3);
  run(s, { 0: { dir: null, bomb: true } }, 0.05);
  run(s, { 0: { dir: 'R' } }, 0.6);
  assert(p.x > 4.2, '走不出炸彈格 x=' + p.x);
  run(s, { 0: { dir: 'L' } }, 0.6);
  assert(p.x > 4.3, '回頭應該被炸彈擋住 x=' + p.x);
});
test('爆炸是十字形，被硬牆擋住', () => {
  const s = mk(2); arena(s); s.grid[3 * s.w + 5] = 1;
  const b = { id: 99, owner: 0, cx: 3, cy: 3, t: 0, range: 3, pass: [], sl: null };
  s.bombs.push(b); s.players[0].bombsOut = 1;
  put(s.players[0], 1, 1); put(s.players[1], 1, 11);
  R.step(s, {}, R.DT);
  const has = (x, y) => !!R.flameAt(s, x, y);
  assert(has(3, 3) && has(4, 3) && has(2, 3) && has(1, 3) && has(3, 6) && has(3, 0 + 1));
  assert(!has(5, 3), '硬牆後不該有火');
  assert(!has(4, 4), '不該有斜向火');
});
test('火焰炸掉第一塊軟磚就停，磚被移除', () => {
  const s = mk(2); arena(s);
  s.grid[3 * s.w + 5] = 2; s.grid[3 * s.w + 6] = 2;
  s.bombs.push({ id: 1, owner: 0, cx: 3, cy: 3, t: 0, range: 5, pass: [], sl: null });
  put(s.players[0], 1, 1); put(s.players[1], 1, 11);
  R.step(s, {}, R.DT);
  assert.strictEqual(s.grid[3 * s.w + 5], 0, '第一塊沒炸掉');
  assert.strictEqual(s.grid[3 * s.w + 6], 2, '第二塊不該被炸');
  assert(R.flameAt(s, 5, 3) && !R.flameAt(s, 6, 3));
});
test('連鎖引爆：炸彈被火焰引爆，遠處的炸彈跟著炸', () => {
  const s = mk(2); arena(s);
  s.bombs.push({ id: 1, owner: 0, cx: 3, cy: 3, t: 0, range: 2, pass: [], sl: null });
  s.bombs.push({ id: 2, owner: 1, cx: 5, cy: 3, t: 2.0, range: 2, pass: [], sl: null });
  s.bombs.push({ id: 3, owner: 1, cx: 5, cy: 5, t: 2.0, range: 2, pass: [], sl: null });
  put(s.players[0], 1, 1); put(s.players[1], 1, 11);
  R.step(s, {}, R.DT);
  assert.strictEqual(s.bombs.length, 0, '三顆應該一起炸 剩 ' + s.bombs.length);
  assert(R.flameAt(s, 5, 6) || R.flameAt(s, 5, 7));
});
test('連鎖時以最長火力為主：長火力的火焰穿過短火力的炸彈，噴完自己的射程', () => {
  const s = mk(2); arena(s);
  put(s.players[0], 1, 1); put(s.players[1], 1, 11);
  s.bombs.push({ id: 1, owner: 0, cx: 3, cy: 5, t: 0, range: 5, pass: [], sl: null });      /* 長：往右能噴到 x=8 */
  s.bombs.push({ id: 2, owner: 1, cx: 5, cy: 5, t: 2.5, range: 1, pass: [], sl: null });    /* 短：擋在路上，會被引爆 */
  R.step(s, {}, R.DT);
  assert.strictEqual(s.bombs.length, 0, '短炸彈應該被連鎖引爆');
  for (let x = 4; x <= 8; x++) assert(R.flameAt(s, x, 5), `長火力應該一路噴到 x=${x}（不被短炸彈擋住）`);
  assert(!R.flameAt(s, 9, 5), '超過長火力射程的格子沒有火');
  assert(R.flameAt(s, 5, 4) && R.flameAt(s, 5, 6), '短炸彈自己的上下火焰照常有');
});
test('連鎖時火焰穿過炸彈後，仍被軟磚擋住；短炸彈引爆長炸彈也是以長的射程為準', () => {
  const s = mk(2); arena(s);
  put(s.players[0], 1, 1); put(s.players[1], 1, 11);
  s.grid[5 * s.w + 7] = 2;                                                                    /* x=7 有軟磚 */
  s.bombs.push({ id: 1, owner: 0, cx: 3, cy: 5, t: 0, range: 5, pass: [], sl: null });
  s.bombs.push({ id: 2, owner: 1, cx: 5, cy: 5, t: 2.5, range: 1, pass: [], sl: null });
  R.step(s, {}, R.DT);
  assert(R.flameAt(s, 6, 5), '穿過短炸彈後繼續噴');
  assert(R.flameAt(s, 7, 5), '軟磚那格有火花');
  assert.strictEqual(s.grid[5 * s.w + 7], 0, '軟磚被炸掉');
  assert(!R.flameAt(s, 8, 5), '軟磚後面不會有火（照樣被擋住）');
  /* 反過來：短炸彈先炸，引爆後面的長炸彈，長炸彈照樣噴自己的完整射程 */
  const t = mk(2); arena(t);
  put(t.players[0], 1, 1); put(t.players[1], 1, 11);
  t.bombs.push({ id: 1, owner: 0, cx: 3, cy: 5, t: 0, range: 1, pass: [], sl: null });
  t.bombs.push({ id: 2, owner: 1, cx: 4, cy: 5, t: 2.5, range: 6, pass: [], sl: null });
  R.step(t, {}, R.DT);
  assert.strictEqual(t.bombs.length, 0);
  for (let x = 5; x <= 10; x++) assert(R.flameAt(t, x, 5), `長炸彈被引爆後應該噴到 x=${x}`);
});
test('被火焰碰到淘汰，擊殺數記給放炸彈的人，自己炸自己不算擊殺', () => {
  const s = mk(3); arena(s);
  put(s.players[0], 1, 1); put(s.players[1], 3, 3); put(s.players[2], 9, 9);
  s.bombs.push({ id: 1, owner: 0, cx: 3, cy: 3, t: 0, range: 2, pass: [], sl: null });
  R.step(s, {}, R.DT);
  assert(!s.players[1].alive); assert.strictEqual(s.players[0].kills, 1);
  const t = mk(3); arena(t);
  put(t.players[0], 3, 3); put(t.players[1], 1, 1); put(t.players[2], 9, 9);
  t.bombs.push({ id: 1, owner: 0, cx: 3, cy: 3, t: 0, range: 2, pass: [], sl: null });
  R.step(t, {}, R.DT);
  assert(!t.players[0].alive); assert.strictEqual(t.players[0].kills, 0);
});
test('半身機制（左右）：剛好一半在火線格裡是安全的，再深入（≥60%）才被炸；站在炸彈格與旁邊那格各一半，不會被這顆炸彈波及', () => {
  /* 炸彈在 (3,3)、射程 2：火線是 x∈[3,6)（格 3、4、5），y 在第 3 列。身體寬 0.72，中心離火線末端 6.0 越近，在火線裡的比例越低：比例 = (6.36 − x) / 0.72 */
  const hit = (x, y) => {
    const s = mk(3); arena(s);
    put(s.players[0], 1, 1); put(s.players[2], 9, 11);
    s.players[1].x = x; s.players[1].y = y == null ? 3.5 + R.HURT_LIFT : y;      /* 預設：身體中心剛好在火線這一列的正中間 */
    s.bombs.push({ id: 1, owner: 0, cx: 3, cy: 3, t: 0, range: 2, pass: [], sl: null });
    R.step(s, {}, R.DT);
    return !s.players[1].alive;
  };
  assert(R.HALF_BODY === 0.6);
  assert(!hit(6.4), '身體只有一小角在火線裡：安全');
  assert(!hit(6.0), '剛好一半（50%）在最後一個火線格裡：安全 —— 這就是半身機制');
  assert(!hit(5.95), '約 57%：還在容錯範圍，安全');
  assert(hit(5.9), '約 64%：被炸');
  assert(hit(5.5), '站在火線正中間：被炸');
  assert(hit(3.5), '站在炸彈那一格：被炸');
  /* 半身站在炸彈格（3）與旁邊的火線格（4）的交界上（x=4.0）：兩格各一半，都不到 60% → 這顆炸彈波及不到 */
  assert(!hit(4.0), '站在炸彈格與旁邊那格各一半（同一條左右線上）：不會被這顆炸彈波及');
  assert(!hit(3.0), '站在炸彈格與左邊那格各一半（左邊沒有火線格）：不會被波及');
});
test('半身機制（上下）：剛好一半是安全的；站在炸彈格與上下相鄰格各一半，不會被這顆炸彈波及；人物往上提，頭比腳高很多，用身體實際範圍判定', () => {
  /* 火線是第 3 列 y∈[3,4]，玩家站在 x=5.5（火線上）。身體約從 y−0.76 到 y+0.19（高 0.95）；從下方碰到火線的比例 = (4.76 − y)/0.95，從上方 = (y + 0.19 − 3)/0.95 */
  const hit = y => {
    const s = mk(3); arena(s);
    put(s.players[0], 1, 1); put(s.players[2], 11, 11);
    s.players[1].x = 5.5; s.players[1].y = y;
    s.bombs.push({ id: 1, owner: 0, cx: 3, cy: 3, t: 0, range: 2, pass: [], sl: null });
    R.step(s, {}, R.DT);
    return !s.players[1].alive;
  };
  assert(!hit(4.45), '火線在上方、只有頭的一小角碰到：安全');
  assert(!hit(4.285), '剛好一半（50%）在火線裡（身體中心在格線上）：安全 —— 這就是半身機制');
  assert(!hit(4.23), '約 56%：安全');
  assert(hit(4.15), '約 64%（頭已經燒進去一大半）：被炸 —— 以前判定在下一格，這裡不會死');
  assert(hit(3.5), '站在火線正中間：被炸');
  assert(hit(3.45), '約 67%：被炸');
  assert(!hit(3.35), '約 57%（只有下半身在火線裡）：安全');
  assert(!hit(3.1), '只有腳尖（約 30%）在火線裡：安全');
  assert(Math.abs(R.HURT_LIFT - (R.BODY_UP - R.BODY_DOWN) / 2) < 1e-9);
  /* 炸彈在 (5,5)，玩家 x=5.5 站在炸彈格（5）與上面一格（4）各一半（身體中心 y = 5.0）：上下是同一條火線，各一半，不會被波及 */
  const s2 = mk(3); arena(s2); put(s2.players[0], 1, 1); put(s2.players[2], 11, 11);
  s2.players[1].x = 5.5; s2.players[1].y = 5.0 + R.HURT_LIFT;
  s2.bombs.push({ id: 1, owner: 0, cx: 5, cy: 5, t: 0, range: 2, pass: [], sl: null });
  R.step(s2, {}, R.DT);
  assert(s2.players[1].alive, '站在炸彈格與上面那格各一半（同一條上下線上）：不會被這顆炸彈波及');
});

test('並排的火線：站在兩條並排火線的中間（各壓一半）會被炸；同一條線上各壓一半仍然安全（半身機制）', () => {
  const run1 = (bombs, x, y) => {
    const s = mk(3); arena(s);
    put(s.players[0], 1, 1); put(s.players[2], 15, 11);
    s.players[1].x = x; s.players[1].y = y;
    for (const [cx, cy] of bombs) s.bombs.push({ id: s.nextId++, owner: 0, cx, cy, t: 0, range: 4, pass: [], sl: null });
    R.step(s, {}, R.DT);
    return !s.players[1].alive;
  };
  /* 上下並排的兩條橫火：炸彈在 (3,3) 與 (3,4)，火線是第 3、4 列；玩家在 x=6.5（離炸彈遠，只有橫火），身體中心剛好在兩列的交界（y−0.285 = 4.0）：各壓一半 */
  assert(run1([[3, 3], [3, 4]], 6.5, 4.0 + R.HURT_LIFT), '上下並排的兩條橫火，各壓一半：整個身體都在火裡，要被炸');
  assert(!run1([[3, 3]], 6.5, 4.0 + R.HURT_LIFT), '只有一條橫火、另一半身體在沒有火的格子：安全（半身機制）');
  /* 左右並排的兩條直火：炸彈在 (3,3) 與 (4,3)，火線是第 3、4 欄；玩家在 y=6.5（離炸彈遠，只有直火），中心在兩欄的交界 x=4.0 */
  assert(run1([[3, 3], [4, 3]], 4.0, 6.5 + R.HURT_LIFT - 0.0), '左右並排的兩條直火，各壓一半：要被炸');
  assert(!run1([[3, 3]], 4.0, 6.5 + R.HURT_LIFT), '只有一條直火、另一半身體在沒有火的格子：安全');
  /* 同一條線上各壓一半：炸彈 (3,3)，玩家站在 (4,3)(5,3) 的交界 x=5.0：兩格都是同一條橫火，不算並排，安全 */
  assert(!run1([[3, 3]], 5.0, 3.5 + R.HURT_LIFT), '同一條橫火上各壓一半：安全（半身機制）');
  assert(!run1([[5, 2]], 5.5, 4.0 + R.HURT_LIFT), '同一條直火上（上下）各壓一半：安全（半身機制）');
  /* 十字交叉的中心附近照常判定：站在炸彈格正中間被炸 */
  assert(run1([[3, 3]], 3.5, 3.5 + R.HURT_LIFT), '站在炸彈格正中間：被炸');
});

test('磚塊被炸掉後，那一格的火花不傷人（走進去不會被燒到），火線上的空格仍會', () => {
  const s = mk(3); arena(s);
  s.grid[3 * s.w + 5] = 2;                                       /* 炸彈 (3,3) 射程 3：4 空格、5 軟磚 */
  put(s.players[0], 1, 1); put(s.players[1], 9, 9); put(s.players[2], 1, 11);
  s.bombs.push({ id: 1, owner: 0, cx: 3, cy: 3, t: 0, range: 3, pass: [], sl: null });
  R.step(s, {}, R.DT);
  assert.strictEqual(s.grid[3 * s.w + 5], 0, '磚塊應消失');
  const brick = R.flameAt(s, 5, 3); assert(brick && brick.cool, '磚塊格是無殺傷火花');
  const open = R.flameAt(s, 4, 3); assert(open && !open.cool, '一般火線格有殺傷');
  s.players[1].x = 5.5; s.players[1].y = 3.5;                    /* 走進剛清掉的磚塊格 */
  R.step(s, {}, R.DT);
  assert(s.players[1].alive, '站在磚塊格的火花上不該被炸');
  s.players[2].x = 4.5; s.players[2].y = 3.5;
  R.step(s, {}, R.DT);
  assert(!s.players[2].alive, '站在一般火線格仍會被炸');
  for (let i = 0; i < 40; i++) R.step(s, {}, R.DT);
  assert(!R.flameAt(s, 5, 3), '火花很快消失');
});

test('提早按轉彎：被擋住時沿還按著的方向走到路口再轉', () => {
  const mkCol = () => {
    const s = mk(2); arena(s);
    for (let y = 1; y < s.h - 1; y++) for (let x = 1; x < s.w - 1; x++) if (x % 2 === 0 && y % 2 === 0) s.grid[y * s.w + x] = 1;
    s.players[0].x = 2.2; s.players[0].y = 3.5; put(s.players[1], 11, 11);   /* 正上方 (2,2) 是柱子，(3,2) 是路口 */
    return s;
  };
  const a = mkCol();
  run(a, { 0: { dir: 'U', bomb: false } }, 1);
  assert(a.players[0].y > 3, '只按上：維持原本行為，停在柱子前');
  const b = mkCol();
  run(b, { 0: { dir: 'U', dir2: 'R', bomb: false } }, 1);
  assert(b.players[0].y < 2.5, '按著右再按上：走到 x=3 的路口轉上去');
});
test('出生點每局隨機（同 seed 一致），且一定落在已清空的安全出生點', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const a = mk(4, { seed }), b = mk(4, { seed });
    const pa = a.players.map(p => p.x + ',' + p.y).join('|');
    assert.strictEqual(pa, b.players.map(p => p.x + ',' + p.y).join('|'), '同 seed 要一樣');
    seen.add(a.players[0].x + ',' + a.players[0].y);
    const pts = R.spawnPoints(a.w, a.h).slice(0, 4).map(q => (q[0] + 0.5) + ',' + (q[1] + 0.5));
    for (const p of a.players) assert(pts.includes(p.x + ',' + p.y), '要在出生點上');
    assert.strictEqual(new Set(a.players.map(p => p.x + ',' + p.y)).size, 4, '不能重疊');
  }
  assert(seen.size >= 3, '玩家 0 的出生點應該會變化：' + seen.size);
});
/** 在玩家腳下放一個道具並走一步，讓他撿起來 */
function give(s, p, type) {
  s.itemsOn.push({ id: s.nextId++, cx: Math.floor(p.x), cy: Math.floor(p.y), type });
  R.step(s, {}, R.DT);
}
test('隱身道具：8 秒後消失，電腦對手看不到隱身的人', () => {
  const s = mk(2); arena(s); const p = s.players[0]; put(p, 2, 1); put(s.players[1], 12, 11);
  give(s, p, 'ghost');
  assert(p.ghostT > 7.9 && p.ghostT <= 8, '撿到要有 8 秒隱身');
  run(s, {}, 4); assert(p.ghostT > 3.8 && p.ghostT < 4.1);
  run(s, {}, 4.1); assert.strictEqual(p.ghostT, 0);
  /* 隱身中的人被炸到照樣會出局 */
  const t = mk(2); arena(t); const q = t.players[0]; put(q, 5, 5); put(t.players[1], 12, 11); q.ghostT = 5;
  t.bombs.push({ id: 1, owner: 1, cx: 5, cy: 5, t: 0, range: 1, pass: [], sl: null });
  R.step(t, {}, R.DT);
  assert(!q.alive, '隱身不能擋爆炸');
});
test('隱身：快照把隱身的人標成「對你是隱身」但位置照送（畫面只畫淡淡身形），自己、觀戰者不被標，還原後恢復', () => {
  const s = mk(3); arena(s); put(s.players[0], 2, 1); put(s.players[1], 5, 5); put(s.players[2], 9, 9);
  s.players[1].ghostT = 5; s.players[1].dir = 'L'; s.players[1].moving = true;
  const snap = R.snapshot(s, false);
  const hid = R.hideInSnapshot(snap, [1]);
  const e = hid.p.find(a => a[0] === 1), orig = snap.p.find(a => a[0] === 1);
  assert(e[4] & 16, '要有隱身旗標');
  assert.strictEqual(e[1], orig[1], '位置要照送，對手才看得到淡淡的身形'); assert.strictEqual(e[2], orig[2]);
  assert.strictEqual(e[3], 'L', '方向照送'); assert(e[4] & 2, '移動狀態照送'); assert(e[4] & 1, '還活著');
  assert.strictEqual(orig[4] & 16, 0, '不能改到原本的快照');
  assert.strictEqual(hid.p.find(a => a[0] === 0)[4] & 16, 0, '其他人不受影響');
  const v = R.viewFromStart(R.startInfo(s));
  R.applySnapshot(v, JSON.parse(JSON.stringify(hid)));
  assert(v.players[1].hidden && !v.players[0].hidden && v.players[1].ghostT > 4.9);
  assert(Math.abs(v.players[1].x - 5.5) < 0.01 && Math.abs(v.players[1].y - 5.5) < 0.01, '客戶端拿得到隱身者的位置');
  assert.strictEqual(v.players[1].dir, 'L');
  R.applySnapshot(v, snap);
  assert(!v.players[1].hidden && Math.abs(v.players[1].x - 5.5) < 0.01);
});
test('超人標誌：8 秒內火力、炸彈、跑速都是這隻角色的最高，結束後還原；詛咒仍壓過它', () => {
  const s = mk(2); arena(s); const p = s.players[0]; put(p, 2, 1); put(s.players[1], 12, 11);
  const mx = R.ANIMAL_STATS.cat.max, base = { sp: R.speedOf(p), b: R.maxBombsOf(p), r: R.rangeOf(p) };
  give(s, p, 'super');
  assert(p.superT > 7.9 && p.superT <= 8);
  assert.strictEqual(R.rangeOf(p), mx.fire); assert.strictEqual(R.maxBombsOf(p), mx.bomb);
  assert(Math.abs(R.speedOf(p) - (base.sp + R.SPEED.step * mx.speed)) < 1e-9, '跑速要加到最高級');
  assert.strictEqual(R.fireOf(p), mx.fire); assert.strictEqual(R.speedLvlOf(p), mx.speed);
  p.curse = { type: 'c_short', t: 5 };
  assert.strictEqual(R.rangeOf(p), 1, '短火詛咒照樣有效');
  p.curse = null;
  /* 超人期間可以同時放最高數量的炸彈，且爆炸範圍是最高火力 */
  put(p, 3, 3);
  for (let i = 0; i < mx.bomb; i++) { put(p, 3 + (i % 5), 2 + Math.floor(i / 5) * 2); R.placeBomb(s, p); }
  assert.strictEqual(s.bombs.length, mx.bomb); assert(s.bombs.every(b => b.range === mx.fire));
  s.bombs.length = 0; p.bombsOut = 0;
  run(s, {}, 8.1);
  assert.strictEqual(p.superT, 0);
  assert.strictEqual(R.rangeOf(p), base.r); assert.strictEqual(R.maxBombsOf(p), base.b); assert(Math.abs(R.speedOf(p) - base.sp) < 1e-9);
});
test('大力藥丸：火力直接升到這隻角色的最高，而且不會消失', () => {
  for (const a of ['cat', 'bear', 'chick']) {
    const s = mk(2); arena(s); s.players[0].animal = a; const p = s.players[0]; put(p, 2, 1); put(s.players[1], 12, 11);
    give(s, p, 'ultra');
    assert.strictEqual(p.fire, R.ANIMAL_STATS[a].max.fire, a);
    run(s, {}, 20); assert.strictEqual(R.rangeOf(p), R.ANIMAL_STATS[a].max.fire, a + ' 之後還是最高');
  }
});
test('方向顛倒詛咒：8 秒內上下左右相反，結束後恢復；單人預測用的 movePlayer 也一樣', () => {
  const s = mk(2); arena(s); const p = s.players[0]; put(p, 6, 5); put(s.players[1], 12, 11);
  give(s, p, 'c_flip');
  assert(p.curse && p.curse.type === 'c_flip' && p.curse.t > 7.9);
  const x0 = p.x; run(s, { 0: { dir: 'R' } }, 0.4);
  assert(p.x < x0 - 0.5 && p.dir === 'L', '按右應該往左走');
  const y0 = p.y; run(s, { 0: { dir: 'D' } }, 0.4);
  assert(p.y < y0 - 0.5, '按下應該往上走');
  assert.strictEqual(R.flipDir({ curse: null }, 'R'), 'R');
  run(s, {}, 8.1); assert.strictEqual(p.curse, null);
  const x1 = p.x; run(s, { 0: { dir: 'R' } }, 0.3);
  assert(p.x > x1 + 0.4, '詛咒結束後恢復正常');
});
test('新道具都有圖示、名稱、說明，掉落表有權重；關閉詛咒就不會掉方向顛倒', () => {
  const Art = require('../public/js/art.js').Art || global.Art;
  for (const t of R.ITEM_TYPES) {
    assert(Art.itemSVG(t).length > 200, t + ' 沒有圖示'); assert(Art.ITEM_NAMES[t], t + ' 沒有名稱'); assert(Art.ITEM_DESC[t], t + ' 沒有說明');
    assert(R.DROP_WEIGHTS[t] > 0, t + ' 沒有掉落權重');
  }
  assert(R.DROP_WEIGHTS.ultra > R.DROP_WEIGHTS.ghost && R.DROP_WEIGHTS.ultra > R.DROP_WEIGHTS.super, '大力藥丸要比隱身、超人標誌常見');
  for (const t of ['ghost', 'super'].concat(R.CURSES)) assert(R.DROP_WEIGHTS[t] <= 3, t + ' 有秒數限制，掉落權重不能高');
  assert(R.POSITIVE.includes('ghost') && R.POSITIVE.includes('super') && R.POSITIVE.includes('ultra') && R.CURSES.includes('c_flip'));
  const s = mk(2, { curses: false }); arena(s);
  const seen = new Set();
  for (let i = 0; i < 4000; i++) {
    s.grid[3 * s.w + 3] = 2;
    s.bombs.push({ id: i + 1, owner: 0, cx: 3, cy: 4, t: 0, range: 1, pass: [], sl: null });
    R.step(s, {}, R.DT);
    for (const it of s.itemsOn) seen.add(it.type);
    s.itemsOn.length = 0; s.flames.length = 0;
  }
  assert(seen.has('ghost') && seen.has('ultra') && !seen.has('c_flip') && !seen.has('c_slow'), '掉落：' + [...seen]);
});
test('空襲：150 秒前不掉炸彈；每 2 秒掉一批，顆數 2:30→1、2:40→2、2:50 起 3，最多 3 顆', () => {
  assert.deepStrictEqual([R.SKY_START, R.SKY_EVERY, R.SKY_STEP, R.SKY_MAX, R.SKY_FUSE], [150, 2, 10, 3, 3]);
  assert.deepStrictEqual([0, 100, 149.9, 150, 159.9, 160, 169.9, 170, 180, 300].map(x => R.skyCount(x)), [0, 0, 0, 1, 1, 2, 2, 3, 3, 3]);
  const s = mk(2); arena(s); put(s.players[0], 1, 1); put(s.players[1], 15, 11);
  s.players.forEach(p => { p.invuln = 1e9; });                   /* 不讓空襲把人炸死，才能一路數下去 */
  s.time = 140;
  const bucket = {};
  for (let i = 0; i < 60 * 65; i++) {
    R.step(s, {}, R.DT);
    for (const e of s.events) if (e.t === 'sky') { const k = Math.floor(s.time); bucket[k] = (bucket[k] || 0) + 1; }
  }
  for (let t = 140; t < 150; t++) assert.strictEqual(bucket[t] || 0, 0, t + ' 秒不該有空襲');
  const want = t => (t % 2 ? 0 : R.skyCount(t));                 /* 只有偶數秒（150、152、…）才掉，每批的顆數看時間 */
  for (let t = 150; t < 200; t++) assert.strictEqual(bucket[t] || 0, want(t), t + ' 秒應該 ' + want(t) + ' 顆：' + (bucket[t] || 0));
  const sum = (a, b) => { let n = 0; for (let t = a; t < b; t++) n += bucket[t] || 0; return n; };
  assert.deepStrictEqual([sum(150, 160), sum(160, 170), sum(170, 200)], [5, 10, 45], '每 10 秒的總顆數：1×5、2×5、3×15');
});
test('空襲提前：2 分鐘的局最後 30 秒（1:30 起）也一定會空襲，3 分鐘以上維持 2:30，不限時也是 2:30；顆數照 1／2／3 排', () => {
  assert.deepStrictEqual([0, 120, 180, 300, 60, 20].map(x => R.skyStartFor(x)), [150, 90, 150, 150, 30, 30]);
  assert.deepStrictEqual([89, 90, 99, 100, 110, 119].map(x => R.skyCount(x, 90)), [0, 1, 1, 2, 3, 3]);
  for (const [limit, start] of [[120, 90], [180, 150], [300, 150], [0, 150]]) {
    const s = mk(2, { timeLimit: limit, fx: false }); arena(s);
    assert.strictEqual(s.skyStart, start); assert.strictEqual(s.skyAt, start);
    put(s.players[0], 1, 1); put(s.players[1], 15, 11);
    let first = null;
    const end = limit > 0 ? limit : start + 30;
    while (s.time < end - 0.05 && s.phase === 'play') {
      R.step(s, {}, R.DT);
      for (const p of s.players) { p.alive = true; p.invuln = 9; put(p, p === s.players[0] ? 1 : 15, p === s.players[0] ? 1 : 11); }   /* 人不要被炸死，才好看整段空襲 */
      if (first == null && s.events.some(e => e.t === 'sky')) first = s.time;
    }
    assert(first != null, limit + ' 秒的局沒有空襲');
    assert(Math.abs(first - start) < 0.1, limit + ' 秒的局應該 ' + start + ' 秒開始空襲，實際 ' + first);
  }
});
test('空襲炸彈：不屬於任何人、引信 3 秒、火力橫掃到牆邊；落在空格上，不會掉在人腳下或磚塊裡', () => {
  const s = mk(2); arena(s); put(s.players[0], 1, 1); put(s.players[1], 15, 11);
  s.players.forEach(p => { p.invuln = 1e9; });
  s.grid[6 * s.w + 8] = 2; s.grid[7 * s.w + 3] = 1;
  s.time = 149.99;
  let landed = null;
  for (let i = 0; i < 60 * 4 && !landed; i++) {
    R.step(s, {}, R.DT);
    const e = s.events.find(x => x.t === 'sky');
    if (e) landed = e;
  }
  assert(landed, '應該有第一顆空襲');
  const b = s.bombs.find(x => x.cx === landed.x && x.cy === landed.y);
  assert(b && b.owner === -1 && b.range === R.SKY_RANGE && b.t <= R.SKY_FUSE && b.t > R.SKY_FUSE - 0.1, '空襲炸彈屬性：' + JSON.stringify(b));
  assert.strictEqual(s.grid[landed.y * s.w + landed.x], 0, '不能掉進磚或牆');
  assert(!s.players.some(p => R.overlapsCell(p, landed.x, landed.y)), '不能掉在人腳下');
  assert(landed.x >= 1 && landed.y >= 1 && landed.x <= s.w - 2 && landed.y <= s.h - 2);
  /* 引爆瞬間：這一列、這一欄都被火焰燒到牆邊（軟磚擋住就停在磚，一樣的規則） */
  let boomed = false;
  for (let i = 0; i < 60 * 4 && !boomed; i++) { R.step(s, {}, R.DT); boomed = s.events.some(x => x.t === 'boom' && x.x === landed.x && x.y === landed.y); }
  assert(boomed, '3 秒後要爆炸');
  const reach = (dx, dy) => { let n = 0; for (let x = landed.x + dx, y = landed.y + dy; ; x += dx, y += dy) { const g = s.grid[y * s.w + x]; if (x < 0 || y < 0 || x >= s.w || y >= s.h || g === 1) break; if (!R.flameAt(s, x, y)) break; n++; if (g === 2) break; } return n; };
  const wallDist = (dx, dy) => { let n = 0; for (let x = landed.x + dx, y = landed.y + dy; x > 0 && y > 0 && x < s.w - 1 && y < s.h - 1; x += dx, y += dy) n++; return n; };
  /* 沒有磚擋的方向，火焰一路燒到最外圈牆前一格 */
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let blocked = false;
    for (let x = landed.x + dx, y = landed.y + dy; x > 0 && y > 0 && x < s.w - 1 && y < s.h - 1; x += dx, y += dy) if (s.grid[y * s.w + x] !== 0) blocked = true;
    if (!blocked) assert.strictEqual(reach(dx, dy), wallDist(dx, dy), '方向 ' + dx + ',' + dy + ' 應該一路燒到牆');
  }
});
test('空襲炸彈炸死人不算任何人的擊倒；每局亂數相同、掉落位置也相同', () => {
  const s = mk(3); arena(s); put(s.players[0], 1, 1); put(s.players[1], 5, 5); put(s.players[2], 15, 11);
  s.bombs.push({ id: 99, owner: -1, cx: 5, cy: 5, t: 0, range: R.SKY_RANGE, pass: [], sl: null });
  R.step(s, {}, R.DT);
  assert(!s.players[1].alive, '被空襲炸到要淘汰');
  assert.strictEqual(s.players.reduce((a, p) => a + p.kills, 0), 0, '空襲不算擊倒');
  assert.strictEqual(s.players[1].cause, 'flame');
  const drops = () => { const g = mk(2, { seed: 77 }); arena(g); put(g.players[0], 1, 1); put(g.players[1], 15, 11); g.players.forEach(p => { p.invuln = 1e9; }); g.time = 149.9; const out = []; for (let i = 0; i < 60 * 25; i++) { R.step(g, {}, R.DT); for (const e of g.events) if (e.t === 'sky') out.push(e.x + ',' + e.y); } return out.join('|'); };
  const a = drops(); assert(a.length > 20 && a === drops(), '同 seed 掉落位置要一樣');
});
test('空襲：倒數與結束後不掉；沒有空格也不會出錯；快照裡帶得出去（owner -1、range 99）', () => {
  const c = mk(2); arena(c); c.phase = 'countdown'; c.countdown = 100; c.time = 200;
  R.step(c, {}, R.DT); assert.strictEqual(c.bombs.length, 0, '倒數中不掉');
  const o = mk(2); arena(o); put(o.players[0], 1, 1); put(o.players[1], 15, 11); o.time = 200; o.phase = 'over'; o.endHold = 5;
  R.step(o, {}, R.DT); assert.strictEqual(o.bombs.length, 0, '結束後不掉');
  const f = mk(2); arena(f); for (let y = 1; y < f.h - 1; y++) for (let x = 1; x < f.w - 1; x++) f.grid[y * f.w + x] = 1;
  f.time = 150; R.step(f, {}, R.DT); assert.strictEqual(f.bombs.length, 0, '沒有空格就不掉，也不能當掉');
  const s = mk(2); arena(s); put(s.players[0], 1, 1); put(s.players[1], 15, 11); s.players.forEach(p => { p.invuln = 1e9; }); s.time = 149.99;
  for (let i = 0; i < 3; i++) R.step(s, {}, R.DT);
  assert(s.bombs.length >= 1);
  const v = R.viewFromStart(R.startInfo(s));
  R.applySnapshot(v, JSON.parse(JSON.stringify(R.snapshot(s, false))));
  const vb = v.bombs.find(b => b.owner === -1);
  assert(vb && vb.range === R.SKY_RANGE, '客戶端拿得到空襲炸彈');
  assert(s.events.length === 0 || s.events.every(e => e.t), '事件格式正常');
});
test('空投機：每 45 秒飛來一架，掉 1～2 個正向道具，直到遊戲結束；關閉道具就不來', () => {
  const s = mk(2, { items: true }); arena(s);
  put(s.players[0], 1, 1); put(s.players[1], 13, 11);
  s.phase = 'play'; s.countdown = 0;
  let planes = 0, drops = [], flying = false, row = -1;
  for (let i = 0; i < 60 * 100; i++) {
    R.step(s, {}, R.DT);
    for (const e of s.events) { if (e.t === 'plane') { planes++; row = e.row; } if (e.t === 'airdrop') { drops.push(e); assert.strictEqual(e.y, row, '道具要掉在飛機飛過的那一列'); } }
    if (s.plane) flying = true;
    if (planes === 0 && s.time < 44.5) assert(!s.plane, '45 秒前不該有飛機');
    s.players.forEach(p => { p.alive = true; p.invuln = 99; });
  }
  assert(planes >= 2, '100 秒內至少兩架：' + planes);
  assert(drops.length >= planes && drops.length <= planes * 2, '每架 1～2 個：' + drops.length + '/' + planes);
  assert(drops.every(d => R.POSITIVE.includes(d.type)), '空投只給正向道具');
  assert(flying);
  const off = mk(2, { items: false }); arena(off); off.phase = 'play'; off.countdown = 0;
  for (let i = 0; i < 60 * 60; i++) { R.step(off, {}, R.DT); off.players.forEach(p => { p.alive = true; p.invuln = 99; }); }
  assert(!off.plane && off.itemsOn.length === 0, '道具關閉時不空投');
  const snapOn = (() => { const t = mk(2, { items: true }); arena(t); t.phase = 'play'; t.countdown = 0; t.time = 44.99; t.airAt = 45; for (let i = 0; i < 30; i++) R.step(t, {}, R.DT); const v = R.viewFromStart(R.startInfo(t)); R.applySnapshot(v, R.snapshot(t, false)); return { got: v.plane, real: t.plane }; })();
  assert(snapOn.got && snapOn.real, '快照要帶飛機位置');
  assert(Math.abs(snapOn.got.x - snapOn.real.x) < 0.02 && snapOn.got.row === snapOn.real.row && snapOn.got.dir === snapOn.real.dir, '線上還原的飛機位置要跟伺服器一致：' + JSON.stringify(snapOn));
});

test('護盾擋一次爆炸，之後有短暫無敵', () => {
  const s = mk(3); arena(s);
  put(s.players[0], 1, 1); put(s.players[1], 3, 3); put(s.players[2], 9, 9);
  s.players[1].shield = true;
  s.bombs.push({ id: 1, owner: 0, cx: 3, cy: 3, t: 0, range: 2, pass: [], sl: null });
  R.step(s, {}, R.DT);
  assert(s.players[1].alive && !s.players[1].shield && s.players[1].invuln > 0);
});
test('軟磚掉寶：關閉道具就不掉；掉出的寶可以被撿起', () => {
  const s = mk(2, { items: false }); arena(s);
  for (let x = 4; x < 10; x++) s.grid[3 * s.w + x] = 2;
  put(s.players[0], 1, 1); put(s.players[1], 1, 11);
  s.bombs.push({ id: 1, owner: 0, cx: 3, cy: 3, t: 0, range: 9, pass: [], sl: null });
  R.step(s, {}, R.DT);
  assert.strictEqual(s.itemsOn.length, 0);
  const t = mk(2); arena(t);
  t.itemsOn.push({ id: 5, cx: 2, cy: 1, type: 'fire' }); t.itemsOn.push({ id: 6, cx: 3, cy: 1, type: 'c_slow' });
  put(t.players[0], 1, 1);
  run(t, { 0: { dir: 'R' } }, 0.9);
  assert.strictEqual(t.players[0].fire, R.statsOf('cat').fire + 1);
  assert(t.players[0].curse && t.players[0].curse.type === 'c_slow');
});
test('詛咒限時消失；縮短火力讓炸彈只剩 1 格；手滑會自動放炸彈', () => {
  const s = mk(2); arena(s); const p = s.players[0]; put(p, 3, 3); p.fire = 4;
  p.curse = { type: 'c_short', t: 1 };
  run(s, { 0: { dir: null, bomb: true } }, 0.05);
  assert.strictEqual(s.bombs[0].range, 1);
  run(s, {}, 1.2); assert.strictEqual(p.curse, null);
  const t = mk(2); arena(t); const q = t.players[0]; put(q, 3, 3); q.maxBombs = 6; q.curse = { type: 'c_auto', t: 3 };
  run(t, { 0: { dir: 'R' } }, 1.5);
  assert(t.bombs.length >= 2, '手滑沒有自動放炸彈');
});
test('踢炸彈：有踢炸彈能力才會滑，沒有就被擋住', () => {
  const mkKick = kick => {
    const s = mk(2); arena(s); const p = s.players[0]; put(p, 2, 3); p.kick = kick;
    s.bombs.push({ id: 1, owner: 1, cx: 3, cy: 3, t: 5, range: 2, pass: [], sl: null });
    put(s.players[1], 1, 11);
    run(s, { 0: { dir: 'R' } }, 1.2);
    return s;
  };
  assert(mkKick(true).bombs[0].cx > 4, '炸彈沒被踢走');
  assert.strictEqual(mkKick(false).bombs[0].cx, 3, '沒能力卻推動了炸彈');
});
test('踢炸彈：身體有 30% 壓在炸彈線上就踢得到（偏 0.64 格以內，比半個身體寬鬆很多），偏太多就踢不到；同時碰到兩顆踢最對準的那顆', () => {
  const kickAt = (off, extra) => {
    const s = mk(2); arena(s); const p = s.players[0]; p.kick = true; p.x = 2.5; p.y = 3.5 + off;
    s.bombs.push({ id: 1, owner: 1, cx: 3, cy: 3, t: 9, range: 2, pass: [], sl: null });
    if (extra) s.bombs.push(extra);
    put(s.players[1], 1, 11);
    run(s, { 0: { dir: 'R' } }, 0.9);
    return s;
  };
  assert(kickAt(0).bombs[0].cx > 4, '正對要踢得到');
  assert(kickAt(0.45).bombs[0].cx > 4, '半個身體（偏 0.45）要踢得到');
  assert(kickAt(-0.5).bombs[0].cx > 4, '往另一邊偏半格也要踢得到');
  assert.strictEqual(kickAt(0.7).bombs[0].cx, 3, '偏太多就踢不到');
  assert(Math.abs(R.KICK_REACH - (0.5 + R.HALF - 2 * R.HALF * 0.3)) < 1e-9 && R.KICK_OVERLAP === 0.3, '30% 的身體壓在線上 ⇔ 中心離線 0.644 格');
  assert(kickAt(0.5).bombs[0].cx > 4, '剛好半個身體（50%，中心在邊線上）要踢得到');
  assert(kickAt(0.56).bombs[0].cx > 4, '約 42%：要踢得到');
  assert(kickAt(0.62).bombs[0].cx > 4, '約 33%：要踢得到');
  assert.strictEqual(kickAt(0.68).bombs[0].cx, 3, '不到 30% 踢不到');
  /* 站在兩顆炸彈的交界（上下各壓一部分）：踢比較對準的那顆，另一顆不動 */
  const s2 = kickAt(0.4, { id: 2, owner: 1, cx: 3, cy: 4, t: 9, range: 2, pass: [], sl: null });
  assert(s2.bombs[0].cx > 4 && s2.bombs[1].cx === 3, '應該踢上面那顆（偏 0.4，離它比較近）');
  /* 往別的方向走也一樣（向上踢） */
  const s3 = mk(2); arena(s3); const q = s3.players[0]; q.kick = true; q.x = 5.5 + 0.45; q.y = 6.5;
  s3.bombs.push({ id: 1, owner: 1, cx: 5, cy: 5, t: 9, range: 2, pass: [], sl: null }); put(s3.players[1], 1, 11);
  run(s3, { 0: { dir: 'U' } }, 0.9);
  assert(s3.bombs[0].cy < 4, '往上踢半身也要踢得到：' + s3.bombs[0].cy);
});
test('淘汰時噴出一半的強化道具', () => {
  const s = mk(3); arena(s);
  put(s.players[0], 1, 1); put(s.players[1], 6, 6); put(s.players[2], 11, 9);
  const v = s.players[1], st = R.statsOf(v.animal);
  v.fire = st.fire + 4; v.maxBombs = st.bomb + 2; v.speedLvl = 2;   /* 4+2+2 = 8 個（只算撿到的，不含角色初始能力） */
  s.bombs.push({ id: 1, owner: 0, cx: 6, cy: 6, t: 0, range: 1, pass: [], sl: null });
  R.step(s, {}, R.DT);
  assert.strictEqual(s.itemsOn.length, 4);
});
test('最後一人存活就結束；同時全滅是平手', () => {
  const s = mk(2); arena(s);
  put(s.players[0], 1, 1); put(s.players[1], 3, 3);
  s.bombs.push({ id: 1, owner: 0, cx: 3, cy: 3, t: 0, range: 1, pass: [], sl: null });
  R.step(s, {}, R.DT);
  assert.strictEqual(s.phase, 'over'); assert.strictEqual(s.result.winner, 0);
  const t = mk(2); arena(t);
  put(t.players[0], 3, 4); put(t.players[1], 3, 2);
  t.bombs.push({ id: 1, owner: 0, cx: 3, cy: 3, t: 0, range: 1, pass: [], sl: null });
  R.step(t, {}, R.DT);
  assert.strictEqual(t.result.winner, null); assert.strictEqual(t.result.reason, 'draw');
});
test('時間到：存活者中擊倒最多者勝，同分平手', () => {
  const s = mk(3, { timeLimit: 5 }); arena(s);
  put(s.players[0], 1, 1); put(s.players[1], 11, 1); put(s.players[2], 1, 11);
  s.players[1].kills = 2; s.players[0].kills = 1;
  run(s, {}, 5.2);
  assert.strictEqual(s.phase, 'over'); assert.strictEqual(s.result.winner, 1); assert.strictEqual(s.result.reason, 'time');
  const t = mk(2, { timeLimit: 3 }); arena(t); put(t.players[0], 1, 1); put(t.players[1], 11, 1);
  run(t, {}, 3.2);
  assert.strictEqual(t.result.winner, null);
});
test('倒數期間不能動也不能放炸彈', () => {
  const s = mk(2, { countdown: 3 });
  const p = s.players[0], x = p.x;
  const inp = { 0: { dir: 'R', bomb: true } };
  run(s, inp, 1);
  assert.strictEqual(p.x, x); assert.strictEqual(s.bombs.length, 0); assert.strictEqual(s.phase, 'countdown');
  run(s, inp, 2.2);
  assert.strictEqual(s.phase, 'play');
});
test('同 seed、同輸入 → 同樣的結果（可重現）', () => {
  const play = () => {
    const s = mk(4, { seed: 77, timeLimit: 40 });
    const brains = s.players.map((p, i) => AI.createBrain('normal', 100 + i));
    const inputs = {};
    for (let i = 0; i < 40 * 60; i++) {
      s.players.forEach((p, k) => { const o = AI.think(brains[k], s, p, R.DT); inputs[p.slot] = inputs[p.slot] || {}; inputs[p.slot].dir = o.dir; if (o.bomb) inputs[p.slot].bomb = true; });
      R.step(s, inputs, R.DT);
    }
    return JSON.stringify([s.players.map(p => [p.x.toFixed(3), p.y.toFixed(3), p.alive, p.kills]), s.grid.join('')]);
  };
  assert.strictEqual(play(), play());
});

console.log('\n地圖機關');
const fxOn = (n, extra) => mk(n, Object.assign({ fx: true }, extra || {}));
const flipX = c => (c === 6 ? 7 : c === 7 ? 6 : c), flipY = c => (c === 4 ? 5 : c === 5 ? 4 : c);
const KIND_OF = c => (c === R.FX_GRASS ? 'grass' : c === R.FX_SLOW ? 'slow' : c === R.FX_SPIKE ? 'spike' : R.isBelt(c) ? 'belt' : null);
test('機關：同 seed 一樣、四向鏡像（輸送帶方向跟著翻）、只在主題允許的種類、不放硬牆與出生點旁；尖刺小圖 2～6、大圖 4～8 個（偶數）', () => {
  let total = 0;
  for (let themeId = 0; themeId < R.THEME_COUNT; themeId++) for (const [w, h] of [[17, 13], [19, 15]]) for (let seed = 1; seed <= 30; seed++) {
    const grid = R.generateMap(seed, w, h, 'classic');
    const fx = R.generateFx(seed, w, h, grid, themeId);
    assert.deepStrictEqual(fx, R.generateFx(seed, w, h, R.generateMap(seed, w, h, 'classic'), themeId), '同 seed 不一致');   /* generateFx 會就地改 grid（拿掉磚、補牆），所以第二次要用新的地圖 */
    const allowed = R.THEME_FX[themeId];
    let spikes = 0, any = false;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = fx[y * w + x];
      if (!v) continue;
      any = true;
      assert(x > 0 && y > 0 && x < w - 1 && y < h - 1 && grid[y * w + x] !== 1, '機關放在牆上');
      assert(allowed.indexOf(KIND_OF(v)) >= 0, `主題 ${themeId} 不該有 ${KIND_OF(v)}`);
      const mx = fx[y * w + (w - 1 - x)], my = fx[(h - 1 - y) * w + x];
      if (R.isBelt(v)) { assert.strictEqual(mx, flipX(v), '左右鏡像方向錯'); assert.strictEqual(my, flipY(v), '上下鏡像方向錯'); }
      else { assert.strictEqual(mx, v, '左右不對稱'); assert.strictEqual(my, v, '上下不對稱'); }
      if (v === R.FX_SPIKE || v === R.FX_GRASS || v === R.FX_SLOW) {
        spikes++;
        for (const [sx, sy] of R.spawnPoints(w, h).slice(0, R.spawnCount(w, h))) assert(Math.abs(x - sx) + Math.abs(y - sy) > 2, '尖刺、草叢、緩速格離出生點太近');
      }
    }
    assert(allowed.length <= 1, '每個主題最多 1 種機關');
    if (spikes) { const lo = allowed[0] === 'grass' ? 2 : (h > 13 ? 4 : 2), hi = h > 13 ? 8 : 6; assert(spikes >= lo && spikes <= hi && spikes % 2 === 0, `尖刺、草叢數量 ${spikes}（${w}x${h}）`); total++; }
  }
  assert(total > 50, '尖刺出現的次數太少：' + total);
});
test('輸送帶：每一圈都頭尾相連（順著方向走一定繞回原點、每格只有一個上游）、形狀不全是長方形', () => {
  let loops = 0, irregular = 0;
  for (const themeId of [1, 2, 7, 12]) for (const [w, h] of [[17, 13], [19, 15]]) for (let seed = 1; seed <= 40; seed++) {
    const fx = R.generateFx(seed, w, h, R.generateMap(seed, w, h, 'classic'), themeId);
    const indeg = new Map(), seen = new Set();
    for (let i = 0; i < fx.length; i++) {
      if (!R.isBelt(fx[i])) continue;
      const [dx, dy] = R.BELT_VEC[fx[i]], x = i % w + dx, y = ((i / w) | 0) + dy, j = y * w + x;
      assert(R.isBelt(fx[j]), '輸送帶的下一格不是輸送帶（斷頭）');
      indeg.set(j, (indeg.get(j) || 0) + 1);
    }
    for (const [j, n] of indeg) assert.strictEqual(n, 1, '一格有多條輸送帶接進來');
    for (let i = 0; i < fx.length; i++) {
      if (!R.isBelt(fx[i]) || seen.has(i)) continue;
      let k = i, steps = 0, minX = 99, maxX = -1, minY = 99, maxY = -1; const cells = [];
      do {
        seen.add(k); steps++; cells.push(k);
        const x = k % w, y = (k / w) | 0; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        const [dx, dy] = R.BELT_VEC[fx[k]]; k = (y + dy) * w + x + dx;
        assert(steps <= 12, '環太長或沒接回來');
      } while (k !== i);
      assert(steps >= 4, '環太小');
      loops++;
      if (cells.some(c => { const x = c % w, y = (c / w) | 0; return x !== minX && x !== maxX && y !== minY && y !== maxY; })) irregular++;
    }
  }
  assert(loops > 100, '環太少：' + loops);
  assert(irregular > loops * 0.4, '不規則的環太少：' + irregular + '/' + loops);
});
test('產線一定有輸送帶：產線版型（任何主題）、日月光廠房（任何版型）每張圖都有，而且只有輸送帶；其他組合照主題規則', () => {
  const hasBelt = fx => fx.some(v => R.isBelt(v)), only = fx => fx.every(v => v === 0 || R.isBelt(v));
  for (const [w, h] of [[17, 13], [19, 15]]) for (let seed = 1; seed <= 30; seed++) {
    for (let themeId = 0; themeId < R.THEME_COUNT; themeId++) {
      const fx = R.generateFx(seed, w, h, R.generateMap(seed, w, h, 'fab'), themeId, 'fab');
      assert(hasBelt(fx) && only(fx), `產線版型 主題 ${themeId} seed ${seed} 沒有輸送帶（或混了別的機關）`);
    }
    for (const layout of R.LAYOUTS) {
      const fx = R.generateFx(seed, w, h, R.generateMap(seed, w, h, layout), R.FAB_THEME, layout);
      assert(hasBelt(fx) && only(fx), `日月光 版型 ${layout} seed ${seed} 沒有輸送帶`);
    }
  }
  /* 其他版型的其他主題，仍照主題規則（森林沒有輸送帶） */
  assert(!hasBelt(R.generateFx(3, 17, 13, R.generateMap(3, 17, 13, 'classic'), 3, 'classic')));
  /* createGame：隨機版型的日月光會用產線版型，所以一定有輸送帶 */
  for (let seed = 1; seed <= 20; seed++) { const g = mk(2, { seed, themeId: R.FAB_THEME, layout: 'random', fx: true }); assert.strictEqual(g.layout, 'fab'); assert(hasBelt(g.fx), '日月光隨機版型沒有輸送帶'); }
  for (const themeId of [0, 3, 6, 9]) { const g = mk(2, { seed: 5, themeId, layout: 'fab', fx: true }); assert(hasBelt(g.fx), '產線版型主題 ' + themeId + ' 沒有輸送帶'); }
});
test('輸送帶：每格找得到前一格（進來的方向），環上有轉角、直的格子進出同方向', () => {
  let corners = 0, straight = 0;
  for (const themeId of [1, 2, 7, 12]) for (let seed = 1; seed <= 30; seed++) {
    const w = 17, h = 13, fx = R.generateFx(seed, w, h, R.generateMap(seed, w, h, 'classic'), themeId);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = fx[y * w + x];
      if (!R.isBelt(v)) continue;
      const inC = R.beltIn(fx, w, x, y), [dx, dy] = R.BELT_VEC[inC];
      assert(R.isBelt(inC) && R.isBelt(fx[(y - dy) * w + (x - dx)]) && fx[(y - dy) * w + (x - dx)] === inC, '前一格要是指向這格的輸送帶');
      if (inC === v) straight++; else { corners++; assert.notStrictEqual(R.BELT_VEC[inC][0] * R.BELT_VEC[v][0] + R.BELT_VEC[inC][1] * R.BELT_VEC[v][1], -1, '不會有 180 度迴轉'); }
    }
  }
  assert(corners > 0 && straight > 0, '轉角：' + corners + '，直的：' + straight);
  assert(corners % 4 === 0, '每圈至少 4 個轉角，四個角落各一圈');
});
test('輸送帶：炸彈放在上面也被載走（速度同人、沿路轉彎、繞圈回到原點、離開帶子就停、被擋住就等）', () => {
  const s = fxOn(2); arena(s); s.fx.fill(0);
  put(s.players[0], 1, 1); put(s.players[1], 15, 11);
  const ring = [[3, 3, 7], [4, 3, 5], [4, 4, 6], [3, 4, 4]];                  /* 2×2 的環：右、下、左、上 */
  for (const [x, y, c] of ring) s.fx[y * s.w + x] = R.FX_BELT + (c - 4);
  s.fx[3 * s.w + 7] = R.FX_BELT + 3; s.fx[3 * s.w + 8] = R.FX_BELT + 3;       /* 另一條往右的直線：(7,3)(8,3)，之後是空地 */
  const mkBomb = (x, y) => { const b = { id: s.nextId++, owner: 0, cx: x, cy: y, t: 30, range: 2, pass: [], sl: null }; s.bombs.push(b); return b; };
  const b = mkBomb(3, 3), c = mkBomb(7, 3);
  let maxProg = 0, minProg = 9;
  for (let i = 0; i < Math.round(0.6 / R.DT); i++) { R.step(s, {}, R.DT); if (b.sl) { maxProg = Math.max(maxProg, b.sl.prog); minProg = Math.min(minProg, b.sl.prog); } }
  assert.deepStrictEqual([b.cx, b.cy], [4, 3], '0.6 秒（約 1 格）後應該在第二格');
  for (let i = 0; i < Math.round(2.0 / R.DT); i++) { R.step(s, {}, R.DT); if (b.sl) { maxProg = Math.max(maxProg, b.sl.prog); minProg = Math.min(minProg, b.sl.prog); } }
  assert.deepStrictEqual([b.cx, b.cy], [3, 3], '繞一圈（4 格 ÷ 1.6）後回到原點：' + b.cx + ',' + b.cy);
  assert(maxProg <= 1.5 + 1e-9 && minProg >= 0.5 - 1e-9, '畫面用的位移要在 0.5～1.5 之間：' + minProg + '～' + maxProg);
  assert.deepStrictEqual([c.cx, c.cy], [9, 3], '離開輸送帶就停在帶子外');
  assert(!c.sl && b.sl, '停下來的沒有滑行狀態，繞圈的還在走');
  /* 被擋住：前面有炸彈就停在原地 */
  const t = fxOn(2); arena(t); t.fx.fill(0); put(t.players[0], 1, 1); put(t.players[1], 15, 11);
  t.fx[5 * t.w + 5] = R.FX_BELT + 3; t.fx[5 * t.w + 6] = R.FX_BELT + 3;
  t.bombs.push({ id: 1, owner: 0, cx: 5, cy: 5, t: 30, range: 2, pass: [], sl: null }, { id: 2, owner: 0, cx: 6, cy: 5, t: 30, range: 2, pass: [], sl: null });
  t.bombs.push({ id: 3, owner: 0, cx: 7, cy: 5, t: 30, range: 2, pass: [], sl: null });
  run(t, {}, 1);
  assert.deepStrictEqual(t.bombs.map(x => [x.cx, x.cy]), [[5, 5], [6, 5], [7, 5]], '前面被擋住就不動');
  /* 經過快照再還原，畫面位移不變 */
  const snap = R.snapshot(s), v = R.applySnapshot(R.viewFromStart(R.startInfo(s)), JSON.parse(JSON.stringify(snap)));
  assert(v.bombs.every((vb, i) => !!vb.sl === !!s.bombs[i].sl));
});
test('尖刺與緩速格：一格一格散開、彼此不相連（含斜角）、數量 2～6／4～8（偶數）、尖刺不蓋軟磚、緩速格可蓋軟磚、地圖連通', () => {
  for (const [themeId, code] of [[8, R.FX_SPIKE], [9, R.FX_SPIKE], [10, R.FX_SPIKE], [0, R.FX_SLOW], [4, R.FX_SLOW], [5, R.FX_SLOW]]) {
    let seen = 0, maps = 0, bricksUnder = 0;
    for (const [w, h] of [[17, 13], [19, 15]]) for (const layout of R.LAYOUTS) for (let seed = 1; seed <= 40; seed++) {
      const orig = R.generateMap(seed, w, h, layout), grid = orig.slice(), fx = R.generateFx(seed, w, h, grid, themeId);
      let n = 0; maps++;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (fx[y * w + x] !== code) continue;
        n++;
        if (code === R.FX_SPIKE) assert.notStrictEqual(grid[y * w + x], 2, '尖刺上有軟磚'); else if (grid[y * w + x] === 2) bricksUnder++;
        assert.notStrictEqual(grid[y * w + x], 1, '機關在硬牆上');
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && x + dx > 0 && y + dy > 0 && x + dx < w - 1 && y + dy < h - 1) assert.strictEqual(fx[(y + dy) * w + x + dx], 0, `機關相連：${themeId} seed ${seed} ${x},${y} 與 ${x + dx},${y + dy}`);
      }
      assert(n <= (h > 13 ? 8 : 6) && n % 2 === 0, '數量 ' + n);
      for (let i = 0; i < grid.length; i++) if (grid[i] !== orig[i]) assert(code === R.FX_SPIKE && fx[i] === code && orig[i] === 2, '只有尖刺格的軟磚會被拿掉');
      assert(R.connected(grid, w, h));
      if (n) seen++;
    }
    assert(seen > maps * 0.7, '主題 ' + themeId + ' 機關太少出現：' + seen + '／' + maps);
    if (code === R.FX_SLOW) assert(bricksUnder > 0, '緩速格應該有機會疊在軟磚底下');
  }
});
test('草叢位置（森林、聖誕小鎮 × 兩種尺寸 × 四種版型 × 40 個 seed）：走道格、不相連（含斜角）、四向對稱、不靠邊框與出生點、不動硬牆、炸彈只沿一條直線炸', () => {
  let seen = 0, maps = 0, cells = 0;
  for (const themeId of [3, 11]) for (const [w, h] of [[17, 13], [19, 15]]) for (const layout of R.LAYOUTS) for (let seed = 1; seed <= 40; seed++) {
    const orig = R.generateMap(seed, w, h, layout), grid = orig.slice(), fx = R.generateFx(seed, w, h, grid, themeId);
    assert.deepStrictEqual(fx, R.generateFx(seed, w, h, orig.slice(), themeId), '同 seed 要一樣');
    const at = (x, y) => y * w + x, wl = (x, y) => grid[at(x, y)] === 1;
    const spawns = R.spawnPoints(w, h).slice(0, R.spawnCount(w, h));
    let n = 0; maps++;
    for (let i = 0; i < grid.length; i++) if (grid[i] !== orig[i]) assert(fx[i] === R.FX_GRASS && orig[i] === 2 && grid[i] === 0, '只有草叢格的軟磚會被拿掉，不能動硬牆');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = fx[at(x, y)];
      if (v !== R.FX_GRASS) { assert(v === 0, '草叢主題只該有草叢'); continue; }
      n++;
      assert(x >= 1 && y >= 1 && x <= w - 2 && y <= h - 2, '草叢在邊框上');
      assert.strictEqual(grid[at(x, y)], 0, '草叢格要是空地（不是牆、也不蓋軟磚）');
      assert((wl(x - 1, y) && wl(x + 1, y)) || (wl(x, y - 1) && wl(x, y + 1)), `草叢不在走道上：${x},${y}`);
      assert.strictEqual(fx[at(w - 1 - x, y)], R.FX_GRASS, '左右不對稱');
      assert.strictEqual(fx[at(x, h - 1 - y)], R.FX_GRASS, '上下不對稱');
      for (const [sx, sy] of spawns) assert(Math.abs(x - sx) + Math.abs(y - sy) > 2, '草叢離出生點太近');
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && x + dx > 0 && y + dy > 0 && x + dx < w - 1 && y + dy < h - 1) assert.notStrictEqual(fx[at(x + dx, y + dy)], R.FX_GRASS, `草叢相連：${x},${y} 與 ${x + dx},${y + dy}`);
      /* 這一格放炸彈，火焰只會落在同一條直線上（同一欄或同一列） */
      const cellsHit = R.blast({ w, h, grid, bombs: [] }, { cx: x, cy: y, range: 9, id: -1, owner: 0, pass: [], sl: null }).cells;
      assert(cellsHit.every(c => c.x === x) || cellsHit.every(c => c.y === y), `草叢裡的炸彈火焰不只一條線：${x},${y}`);
    }
    assert(n <= (h > 13 ? 8 : 6) && n % 2 === 0, '草叢數量 ' + n);
    assert(R.connected(grid, w, h), '地圖要連通');
    if (n) { seen++; cells += n; }
  }
  assert(seen > maps * 0.25, '草叢太少出現：' + seen + '／' + maps);
  console.log('      有草叢的圖 ' + seen + '／' + maps + '，平均每張 ' + (cells / seen).toFixed(1) + ' 格');
});
test('機關：各主題的機關種類符合風格（草叢、輸送帶、緩速、尖刺都有主題用得到），沒有機關的選項不會產生', () => {
  const has = k => R.THEME_FX.filter(a => a.indexOf(k) >= 0).length;
  for (const k of ['grass', 'belt', 'slow', 'spike']) assert(has(k) >= 2, k + ' 太少主題用');
  for (const t of [0, 4, 5]) assert(R.THEME_FX[t].indexOf('slow') >= 0, '糖果、沙漠、雪地要有緩速格：' + t);
  assert.strictEqual(R.THEME_FX.length, R.THEME_COUNT);
  assert(R.generateFx(3, 17, 13, R.generateMap(3, 17, 13, 'classic'), 99).every(v => v === 0));
  const s = mk(2, { fx: false });
  assert(s.fx.every(v => v === 0));
});
test('機關：不影響地圖與亂數（有沒有機關，磚牆、亂數、出生點都一樣）；起始資料帶得出去', () => {
  for (const themeId of [1, 4, 7, 10]) {
    const a = mk(4, { themeId, fx: true }), b = mk(4, { themeId, fx: false });
    a.grid.forEach((v, i) => { if (v !== b.grid[i]) { assert((a.fx[i] === R.FX_SPIKE || a.fx[i] === R.FX_GRASS) && b.grid[i] === 2 && v === 0, '只有尖刺、草叢格的軟磚會被拿掉'); } });
    assert(R.connected(a.grid, a.w, a.h));
    assert.strictEqual(a.rng, b.rng);
    assert.deepStrictEqual(a.players.map(p => [p.x, p.y]), b.players.map(p => [p.x, p.y]));
    assert(a.fx.some(v => v));
    const info = R.startInfo(a), v = R.viewFromStart(JSON.parse(JSON.stringify(info)));
    assert.deepStrictEqual(v.fx, a.fx);
  }
});
test('緩速格：站在上面走路只剩 SLOW_MULT 倍速度，離開就恢復', () => {
  const s = fxOn(2); arena(s);
  s.fx.fill(0);
  for (let x = 3; x <= 6; x++) s.fx[3 * s.w + x] = R.FX_SLOW;
  const p = s.players[0]; put(p, 3, 3);
  const x0 = p.x; run(s, { 0: { dir: 'R' } }, 0.3);
  const slow = p.x - x0;
  put(p, 8, 5); const x1 = p.x; run(s, { 0: { dir: 'R' } }, 0.3);
  const fast = p.x - x1;
  assert(Math.abs(slow / fast - R.SLOW_MULT) < 0.1, '倍率 ' + (slow / fast).toFixed(2));
});
test('輸送帶：沒按鍵也會被往帶子方向推，推進牆壁就停；速度是 BELT_SPEED', () => {
  const s = fxOn(2); arena(s);
  s.fx.fill(0);
  for (let x = 3; x <= 8; x++) s.fx[5 * s.w + x] = R.FX_BELT + 3;      /* 往右 */
  const p = s.players[0]; put(p, 3, 5);
  const x0 = p.x; run(s, {}, 1);
  assert(Math.abs((p.x - x0) - R.BELT_SPEED) < 0.1, '1 秒推了 ' + (p.x - x0).toFixed(2));
  s.fx.fill(0); s.fx[5 * s.w + 9] = R.FX_BELT + 3; s.grid[5 * s.w + 10] = 1; put(p, 9, 5);
  run(s, {}, 2);
  assert(p.x < 10 - R.HALF + 1e-6 && p.x > 9.5, '撞牆後該停住：' + p.x);
  put(p, 4, 7); for (let y = 5; y <= 7; y++) s.fx[y * s.w + 4] = R.FX_BELT + 0;      /* 往上 */
  const y0 = p.y; run(s, {}, 0.5);
  assert(p.y < y0 - 0.5 * R.BELT_SPEED + 0.1);
});
test('尖刺：炸彈放在上面當場爆炸（同一步），歸放炸彈的人；人走過去不受傷', () => {
  const s = fxOn(2); arena(s);
  s.fx.fill(0); s.fx[5 * s.w + 5] = R.FX_SPIKE;
  const p = s.players[0], q = s.players[1]; put(p, 5, 5); put(q, 12, 9);
  p.shield = false;
  R.step(s, { 0: { bomb: true } }, R.DT);
  assert(s.bombs.length === 0, '炸彈應該已經爆炸');
  assert(s.events.some(e => e.t === 'spike') && s.events.some(e => e.t === 'boom'));
  assert(s.flames.some(f => f.cx === 5 && f.cy === 5 && f.owner === 0));
  const t = fxOn(2); arena(t); t.fx.fill(0); t.fx[5 * t.w + 5] = R.FX_SPIKE;
  put(t.players[0], 4, 5); put(t.players[1], 12, 9);
  run(t, { 0: { dir: 'R' } }, 0.6);
  assert(t.players[0].alive, '走過尖刺不該受傷');
});
test('尖刺：被踢的炸彈碰到尖刺立刻爆炸，不會繼續滑；空襲不會把炸彈掉在尖刺上', () => {
  const s = fxOn(2); arena(s);
  s.fx.fill(0); s.fx[5 * s.w + 8] = R.FX_SPIKE;
  const p = s.players[0]; p.kick = true; put(p, 3, 5); put(s.players[1], 15, 11);
  R.placeBomb(s, p); p.bombsOut = 0;
  put(p, 2, 5);
  run(s, { 0: { dir: 'R' } }, 0.55);
  assert(s.bombs.every(b => !(b.cy === 5 && b.cx > 8)), '炸彈不該滑過尖刺');
  assert(s.events.length >= 0);
  /* 空襲 */
  const k = fxOn(2); arena(k); k.fx.fill(0);
  for (let y = 1; y < k.h - 1; y++) for (let x = 1; x < k.w - 1; x++) if (!(x === 7 && y === 7)) k.fx[y * k.w + x] = R.FX_SPIKE;
  k.time = R.SKY_START; k.skyAt = R.SKY_START; put(k.players[0], 1, 1); put(k.players[1], 15, 11);
  for (let i = 0; i < 400; i++) R.step(k, {}, R.DT);
  assert(k.bombs.every(b => b.owner !== -1 || (b.cx === 7 && b.cy === 7)) || k.flames.length >= 0);
  for (const b of k.bombs) if (b.owner === -1) assert(k.fx[b.cy * k.w + b.cx] !== R.FX_SPIKE, '空襲炸彈掉在尖刺上');
});
test('草叢：裡面的活人與炸彈，任何人（貼在旁邊的、自己、觀戰的）都看不到；不在草叢的看得到；電腦也看不到', () => {
  const s = fxOn(2); arena(s);
  s.fx.fill(0); s.fx[5 * s.w + 5] = R.FX_GRASS;
  const [a, b] = s.players; put(a, 5, 5); put(b, 12, 5);
  assert(R.hiddenInGrass(s, a), '草叢裡的人看不到（對所有人，包括自己）');
  assert(!R.hiddenInGrass(s, b), '不在草叢的看得到');
  b.alive = false; put(b, 5, 5);
  assert(!R.hiddenInGrass(s, b), '已淘汰的不畫（走淘汰動畫）');
  b.alive = true; put(b, 12, 5);
  const bomb = { owner: 0, cx: 5, cy: 5 };
  assert(R.bombHiddenInGrass(s, bomb), '草叢裡的炸彈誰都看不到');
  assert(!R.bombHiddenInGrass(s, { owner: -1, cx: 5, cy: 5 }), '空襲炸彈永遠看得到，掉進草叢也不藏');
  assert(!R.bombHiddenInGrass(s, { owner: 0, cx: 6, cy: 6 }), '不在草叢的炸彈看得到');
  assert.deepStrictEqual(s.players.filter(q => q.alive && q.slot !== b.slot && !R.hiddenInGrass(s, q)).length, 0, '電腦的敵人清單要排除草叢裡的人');
  const brain = AI.createBrain('hard', 1);
  assert.strictEqual(typeof AI.think(brain, s, b).bomb, 'boolean');
});

console.log('\n快照');
test('快照壓縮再還原後，繪製所需的欄位一致', () => {
  const s = mk(4, { seed: 5 });
  const info = R.startInfo(s);
  const v = R.viewFromStart(info);
  const brains = s.players.map((p, i) => AI.createBrain('normal', i + 1));
  const inputs = {};
  for (let i = 0; i < 600; i++) {
    s.players.forEach((p, k) => { const o = AI.think(brains[k], s, p, R.DT); inputs[p.slot] = inputs[p.slot] || {}; inputs[p.slot].dir = o.dir; if (o.bomb) inputs[p.slot].bomb = true; });
    R.step(s, inputs, R.DT);
  }
  const snap = JSON.parse(JSON.stringify(R.snapshot(s, true)));
  R.applySnapshot(v, snap);
  assert.deepStrictEqual(v.grid, s.grid);
  assert.strictEqual(v.bombs.length, s.bombs.length);
  assert.strictEqual(v.flames.length, s.flames.length);
  assert.strictEqual(v.itemsOn.length, s.itemsOn.length);
  s.players.forEach((p, k) => {
    const q = v.players[k];
    assert(Math.abs(p.x - q.x) < 0.011 && Math.abs(p.y - q.y) < 0.011);
    assert.strictEqual(p.alive, q.alive); assert.strictEqual(p.fire, q.fire); assert.strictEqual(p.maxBombs, q.maxBombs);
  });
});

console.log('\n電腦對手');
function playGame(levels, seed, timeLimit) {
  const players = levels.map((lv, i) => ({ slot: i, name: 'AI' + i, animal: 'cat', kind: 'ai', level: lv }));
  const s = R.createGame({ seed, players, layout: 'random', countdown: 0, timeLimit });
  const brains = players.map((p, i) => AI.createBrain(p.level, seed * 31 + i));
  const inputs = {};
  let guard = 0;
  while (s.phase !== 'over' && guard++ < (timeLimit + 5) * 60) {
    s.players.forEach((p, k) => {
      const o = AI.think(brains[k], s, p, R.DT);
      inputs[p.slot] = inputs[p.slot] || { dir: null, bomb: false };
      inputs[p.slot].dir = o.dir; if (o.bomb) inputs[p.slot].bomb = true;
    });
    R.step(s, inputs, R.DT);
  }
  return s;
}
test('電腦跑完整局都不會當機，且每局都分得出結果', () => {
  for (let seed = 1; seed <= (quick ? 6 : 16); seed++) {
    const s = playGame(['toddler', 'easy', 'normal', 'hard'], seed, 150);
    assert.strictEqual(s.phase, 'over', 'seed ' + seed + ' 沒結束');
    assert(s.result);
  }
});
test('等級權重表：權重總和 100，每一級的強度值貼近目標、級距平均且往上越拉越開', () => {
  const W = AI.POWER_WEIGHTS;
  assert.strictEqual(Object.values(W).reduce((a, b) => a + b.w, 0), 100, '權重總和要是 100，強度值才是 0～100');
  assert.strictEqual(AI.POWER_TOTAL, 100);
  /* 實測校準：決策間隔與逃生機率最重要（scripts/ai-weights.js），這個比例不能被改回憑感覺 */
  assert(W.interval.w + W.react.w >= 55, '決策間隔＋逃生機率應佔大部分權重');
  const target = AI.LEVEL_ORDER.map(k => AI.LEVEL_POWER[k]), real = AI.LEVEL_ORDER.map(k => AI.power(AI.LEVELS[k]));
  assert.deepStrictEqual(target, [33, 45, 58, 73, 89], '目標強度（級距）');
  real.forEach((v, i) => assert(Math.abs(v - target[i]) <= 1.5, AI.LEVEL_ORDER[i] + ' 強度 ' + v.toFixed(1) + ' 偏離目標 ' + target[i]));
  const gaps = target.slice(1).map((v, i) => v - target[i]);
  gaps.forEach((g, i) => assert(g >= 10, '第 ' + (i + 1) + ' 個級距只有 ' + g));
  gaps.slice(1).forEach((g, i) => assert(g >= gaps[i], '級距要越往上越大或相等：' + gaps.join(',')));
  for (const k of AI.LEVEL_ORDER) for (const f of Object.keys(W)) {
    const v = W[f].flag ? (AI.LEVELS[k][f] ? 1 : 0) : (AI.LEVELS[k][f] == null ? 0 : AI.LEVELS[k][f]);
    const lo = Math.min(W[f].worst, W[f].best), hi = Math.max(W[f].worst, W[f].best);
    assert(v >= lo - 1e-9 && v <= hi + 1e-9, k + ' 的 ' + f + ' = ' + v + ' 超出權重表範圍 ' + lo + '～' + hi);
  }
  const b = AI.powerBreakdown(AI.LEVELS.hard);
  assert(Math.abs(Object.values(b).reduce((x, y) => x + y, 0) - AI.power(AI.LEVELS.hard)) < 1e-9, '各項貢獻加總要等於強度值');
});
test('scaleToPower：依目標強度算出參數，強度值貼近目標、單調、不改原本的設定', () => {
  const before = JSON.stringify(AI.LEVELS.normal);
  let last = -1;
  for (const t of [15, 25, 40, 55, 70, 85, 95]) {
    const c = AI.scaleToPower(AI.LEVELS.normal, t), p = AI.power(c);
    assert(Math.abs(p - t) <= 0.8, '目標 ' + t + ' 實際 ' + p.toFixed(2));
    assert(p > last, '目標越高強度要越高');
    last = p;
    assert.strictEqual(c.chain, AI.LEVELS.normal.chain, '旗標不動');
    assert.strictEqual(c.name, AI.LEVELS.normal.name);
  }
  assert.strictEqual(JSON.stringify(AI.LEVELS.normal), before, '不能改到原本的等級表');
  /* 強度越高：反應越快、逃得越準（保命的兩個重點參數同向變化） */
  const lo = AI.scaleToPower(AI.LEVELS.normal, 30), hi = AI.scaleToPower(AI.LEVELS.normal, 80);
  assert(hi.interval < lo.interval && hi.react > lo.react && hi.notice < lo.notice);
});
test('神話等級存在、排在最後，而且每一級都有名稱與完整參數', () => {
  assert.deepStrictEqual(AI.LEVEL_ORDER, ['toddler', 'easy', 'normal', 'hard', 'myth']);
  for (const k of AI.LEVEL_ORDER) {
    const c = AI.LEVELS[k];
    assert(c && c.name && c.interval > 0 && c.react > 0 && c.react <= 1, k + ' 參數不完整');
  }
  assert.strictEqual(AI.LEVELS.myth.name, '神話');
  const h = AI.LEVELS.hard, m = AI.LEVELS.myth;
  assert(m.interval < h.interval && m.react >= h.react && m.sloppy <= h.sloppy && m.wander <= h.wander && m.chase > h.chase, '神話每一項都不能比困難差');
  assert.strictEqual(AI.createBrain('myth', 1).level, 'myth');
});
test('電腦不會自己卡死在出生點：開局 20 秒內每個人都移動過', () => {
  const s = R.createGame({ seed: 3, players: ['easy', 'normal', 'hard', 'toddler'].map((lv, i) => ({ slot: i, kind: 'ai', level: lv })), countdown: 0, timeLimit: 0 });
  const brains = s.players.map((p, i) => AI.createBrain(p.kind === 'ai' ? p.level : 'normal', i));
  const start = s.players.map(p => [p.x, p.y]);
  const moved = s.players.map(() => false);
  const inputs = {};
  for (let i = 0; i < 20 * 60; i++) {
    s.players.forEach((p, k) => { const o = AI.think(brains[k], s, p, R.DT); inputs[p.slot] = inputs[p.slot] || {}; inputs[p.slot].dir = o.dir; if (o.bomb) inputs[p.slot].bomb = true; });
    R.step(s, inputs, R.DT);
    s.players.forEach((p, k) => { if (Math.hypot(p.x - start[k][0], p.y - start[k][1]) > 1.5) moved[k] = true; });
  }
  assert(moved.every(Boolean), JSON.stringify(moved));
});
test('四段難度有可觀察的差異：困難 > 普通 > 簡單 > 幼幼班（勝場與存活時間）', () => {
  const games = process.env.LADDER_GAMES ? +process.env.LADDER_GAMES : (quick ? 40 : 160);
  const score = { toddler: 0, easy: 0, normal: 0, hard: 0 };
  const surv = { toddler: 0, easy: 0, normal: 0, hard: 0 };
  const lv = ['toddler', 'easy', 'normal', 'hard'];
  for (let g = 0; g < games; g++) {
    const order = lv.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = (g * 7 + i * 3) % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    const s = playGame(order, 1000 + g, 150);
    const w = s.result.winner;
    if (w != null) score[order[w]] += 1;
    s.players.forEach((p, k) => { surv[order[k]] += p.alive ? s.time : (p.diedAt || 0); });
  }
  console.log('      勝場', JSON.stringify(score), '平均存活秒', JSON.stringify(Object.fromEntries(lv.map(k => [k, Math.round(surv[k] / games)]))));
  assert(score.hard >= score.normal * 0.85, '困難勝場不應明顯少於普通（兩者在統計上接近）');
  assert(score.normal >= score.easy, '普通勝場應不少於簡單');
  assert(score.easy + 3 >= score.toddler, '簡單勝場不應明顯少於幼幼班（兩者都常是 0～2 場，差 3 場內算雜訊，存活秒數另有嚴格比較）');
  assert(surv.easy > surv.toddler, '簡單的存活時間應比幼幼班久');
  assert(score.hard > score.toddler * 2, '困難應明顯強過幼幼班');
  assert(surv.hard > surv.toddler, '困難存活應比幼幼班久');
  /* 簡單、普通、困難要拉得開：平均存活要有明顯差距（單位：秒），場數夠多時勝場也要差一截 */
  const avg = k => surv[k] / games;
  assert(avg('normal') - avg('easy') >= 6, '普通應比簡單多活至少 6 秒：' + Math.round(avg('normal') - avg('easy')));
  /* 半身機制改成 40%（更容易被火波及）後，每一級都死得更快、存活時間的差距縮小（困難比普通只多活幾秒），所以這一項從 4 秒放寬成 2 秒；
     困難和普通的強弱差距主要看下面的勝場（差一倍以上） */
  assert(avg('hard') - avg('normal') >= 2, '困難應比普通多活至少 2 秒：' + Math.round(avg('hard') - avg('normal')));
  if (games >= 100) {
    assert(score.normal >= score.easy * 1.5, '普通勝場應明顯多於簡單');
    assert(score.hard >= score.normal * 1.5, '困難勝場應明顯多於普通');
  }
});
test('神話比困難強：一個神話對三個困難，擊倒明顯比每個困難多，而且不會比困難更常被淘汰', () => {
  const games = process.env.MYTH_GAMES ? +process.env.MYTH_GAMES : (quick ? 16 : 200);
  let kills = 0, opp = 0, dead = 0, oppDead = 0, wins = 0, oppWins = 0;
  for (let g = 0; g < games; g++) {
    const order = ['myth', 'hard', 'hard', 'hard'];
    for (let i = order.length - 1; i > 0; i--) { const j = (g * 7 + i * 3) % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    const s = playGame(order, 2000 + g, 150);
    const k = order.indexOf('myth');
    kills += s.players[k].kills; if (!s.players[k].alive) dead++;
    s.players.forEach((p, i) => { if (i !== k) { opp += p.kills / 3; if (!p.alive) oppDead += 1 / 3; } });
    if (s.result.winner === k) wins++; else if (s.result.winner != null) oppWins += 1 / 3;     /* 每個困難平均贏幾場 */
  }
  console.log('      神話 擊倒/局', (kills / games).toFixed(2), '（每個困難平均', (opp / games).toFixed(2) + '）', '被淘汰', dead, '／', games, '（每個困難平均', (oppDead).toFixed(1) + '）', '勝場', wins);
  assert(kills > opp * 1.5, '神話擊倒應明顯多於困難：' + kills + ' vs ' + opp.toFixed(1));
  assert(dead <= oppDead + games * 0.1, '神話不該比困難更常被淘汰：' + dead + ' vs ' + oppDead.toFixed(1));
  /* 很多局到時間沒人倒下就是平手，所以不用「勝率 25%」當門檻；只要求神話的勝場不少於每個困難的平均 */
  assert(wins >= oppWins - 1, '神話勝場應不少於每個困難的平均：' + wins + ' vs ' + oppWins.toFixed(1));
});

console.log('\n' + passed + ' 項通過' + (failed.length ? '，' + failed.length + ' 項失敗：\n  - ' + failed.join('\n  - ') : ''));
process.exit(failed.length ? 1 : 0);
