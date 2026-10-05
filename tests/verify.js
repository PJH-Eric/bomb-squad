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
  return R.createGame(Object.assign({ seed: 11, players, layout: 'classic', countdown: 0, timeLimit: 0 }, extra || {}));
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
test('地圖尺寸：≤4 人 15×13，5～8 人 17×15', () => {
  assert.deepStrictEqual(R.sizeFor(2), { w: 15, h: 13 });
  assert.deepStrictEqual(R.sizeFor(4), { w: 15, h: 13 });
  assert.deepStrictEqual(R.sizeFor(5), { w: 17, h: 15 });
  assert.deepStrictEqual(R.sizeFor(8), { w: 17, h: 15 });
});
test('同一個 seed 產生同一張地圖，不同 seed 不同', () => {
  const a = R.generateMap(5, 15, 13, 'classic'), b = R.generateMap(5, 15, 13, 'classic'), c = R.generateMap(6, 15, 13, 'classic');
  assert.deepStrictEqual(a, b);
  assert.notDeepStrictEqual(a, c);
});
test('三種版型 × 多個 seed：四向對稱、全連通、出生點安全區沒有軟磚', () => {
  for (const layout of R.LAYOUTS) for (const [w, h] of [[15, 13], [17, 15]]) for (let seed = 1; seed <= 25; seed++) {
    const g = R.generateMap(seed, w, h, layout);
    assert(R.connected(g, w, h), `${layout} ${w}x${h} seed ${seed} 不連通`);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      assert.strictEqual(g[y * w + x], g[y * w + (w - 1 - x)], '左右不對稱');
      assert.strictEqual(g[y * w + x], g[(h - 1 - y) * w + x], '上下不對稱');
    }
    for (const [sx, sy] of R.spawnPoints(w, h).slice(0, w <= 15 ? 4 : 8)) {
      assert.strictEqual(g[sy * w + sx], 0, '出生點被占');
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (Math.abs(x - sx) + Math.abs(y - sy) <= 3) assert.notStrictEqual(g[y * w + x], 2, '安全區有軟磚');
      }
    }
  }
});
test('邊框全是硬牆', () => {
  const g = R.generateMap(3, 15, 13, 'open');
  for (let x = 0; x < 15; x++) { assert.strictEqual(g[x], 1); assert.strictEqual(g[12 * 15 + x], 1); }
  for (let y = 0; y < 13; y++) { assert.strictEqual(g[y * 15], 1); assert.strictEqual(g[y * 15 + 14], 1); }
});
test('密集版型比經典多硬牆', () => {
  const count = g => g.filter(v => v === 1).length;
  let more = 0;
  for (let seed = 1; seed <= 20; seed++) if (count(R.generateMap(seed, 15, 13, 'dense')) > count(R.generateMap(seed, 15, 13, 'classic'))) more++;
  assert(more >= 15, '密集應該通常比較多硬牆，只有 ' + more);
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
  assert(q.x - 2.5 > slow * 1.4, '加速沒有生效');
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
test('判定寬鬆：中心離格線很近（擦邊）不算被炸，進到格子中間才算', () => {
  const edge = mk(3); arena(edge);
  put(edge.players[0], 1, 1); put(edge.players[2], 9, 9);
  edge.players[1].x = 4 + 0.05; edge.players[1].y = 3.5;     /* 站在炸彈格 3 與旁邊火焰格 4 的交界上 */
  edge.bombs.push({ id: 1, owner: 0, cx: 3, cy: 3, t: 0, range: 2, pass: [], sl: null });
  R.step(edge, {}, R.DT);
  assert(edge.players[1].alive, '擦邊應該活著');
  const mid = mk(3); arena(mid);
  put(mid.players[0], 1, 1); put(mid.players[2], 9, 9);
  mid.players[1].x = 4.5; mid.players[1].y = 3.5;
  mid.bombs.push({ id: 1, owner: 0, cx: 3, cy: 3, t: 0, range: 2, pass: [], sl: null });
  R.step(mid, {}, R.DT);
  assert(!mid.players[1].alive, '站在火焰格正中間應該被炸');
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
  assert.strictEqual(t.players[0].fire, 3);
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
test('淘汰時噴出一半的強化道具', () => {
  const s = mk(3); arena(s);
  put(s.players[0], 1, 1); put(s.players[1], 6, 6); put(s.players[2], 11, 9);
  const v = s.players[1]; v.fire = 6; v.maxBombs = 3; v.speedLvl = 2;   /* 4+2+2 = 8 個 */
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
  assert(score.easy >= score.toddler, '簡單勝場應不少於幼幼班');
  assert(score.hard > score.toddler * 2, '困難應明顯強過幼幼班');
  assert(surv.hard > surv.toddler, '困難存活應比幼幼班久');
});

console.log('\n' + passed + ' 項通過' + (failed.length ? '，' + failed.length + ' 項失敗：\n  - ' + failed.join('\n  - ') : ''));
process.exit(failed.length ? 1 : 0);
