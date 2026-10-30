/* 火線形狀判定驗證：並排火線、十字火線、交叉火線，在「半身」門檻調整後的實際判定邊界。
 * 用 rules.js 的 R.step 當裁判（炸彈 t=0，下一步就爆），一小格一小格移動角色，找出被炸的範圍。
 *   node scripts/flame-shapes.js                     印出新判定的各形狀邊界與二維分布，並檢查不變式（有不符合時結束碼 1）
 *   OLD_RULES=/path/to/old-rules.js node scripts/flame-shapes.js     另外載入舊版 rules.js 並排對照（例如 git show <commit>:public/js/rules.js > old-rules.js） */
'use strict';
const path = require('path');
const R = require('../public/js/rules.js');
const OLD = process.env.OLD_RULES ? require(path.resolve(process.env.OLD_RULES)) : null;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : ' FAIL ') + m); if (!c) fails++; };

function players() { return [0, 1, 2].map(i => ({ slot: i, name: 'P', animal: 'cat', kind: 'human' })); }
/** bombs：[cx, cy, range]，玩家在 (x, y)，回傳有沒有被炸死 */
function hit(rules, bombs, x, y) {
  const s = rules.createGame({ seed: 11, players: players(), layout: 'classic', countdown: 0, timeLimit: 0, fx: false });
  for (let j = 1; j < s.h - 1; j++) for (let i = 1; i < s.w - 1; i++) s.grid[j * s.w + i] = 0;
  s.phase = 'play';
  s.players[0].x = 1.5; s.players[0].y = 1.5; s.players[2].x = s.w - 1.5; s.players[2].y = s.h - 1.5;
  s.players[1].x = x; s.players[1].y = y;
  for (const [cx, cy, range] of bombs) s.bombs.push({ id: s.nextId++, owner: 0, cx, cy, t: 0, range, pass: [], sl: null });
  rules.step(s, {}, rules.DT);
  return !s.players[1].alive;
}
/** 沿著一條線掃描，回傳連續被炸的區間 [[from, to], ...]（取樣間隔 step） */
function intervals(rules, bombs, from, to, step, at) {
  const out = []; let cur = null;
  const n = Math.round((to - from) / step);
  for (let i = 0; i <= n; i++) {
    const t = from + i * step, [x, y] = at(t), h = hit(rules, bombs, x, y);
    if (h && !cur) cur = [t, t]; else if (h) cur[1] = t; else if (cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out;
}
const fmt = iv => iv.length ? iv.map(([a, b]) => `[${a.toFixed(2)}, ${b.toFixed(2)}]`).join(' ') : '（沒有）';
const near = (a, b, e) => Math.abs(a - b) <= e;

console.log('單一火線邊界（格）：右 / 左 / 上 / 下');
const dirs = (rules) => {
  const b = {};
  const probe = (bombs, along, from, to, start) => { const iv = intervals(rules, bombs, from, to, 0.005, along); return iv; };
  /* 右：直火中心 x=7.5（炸彈 (7,1) 往下），角色在 y=5 從左邊靠近；被炸的最左位置 → 距離 = 7.5 − x */
  const r = probe([[7, 1, 8]], t => [t, 5.5 + R.HURT_LIFT], 5.5, 7.5);
  b.right = 7.5 - r[0][0];
  const l = probe([[7, 1, 8]], t => [t, 5.5 + R.HURT_LIFT], 7.5, 9.5);
  b.left = l[l.length - 1][1] - 7.5;
  const u = probe([[1, 5, 8]], t => [5.5, t], 5.0, 7.5);        /* 橫火 y=5.5，角色在下方（火線在上方） */
  b.above = u[u.length - 1][1] - 5.5;
  const d = probe([[1, 5, 8]], t => [5.5, t], 3.0, 5.5);        /* 角色在上方（火線在下方，腳先碰到） */
  b.below = 5.5 - d[0][0];
  return b;
};
const bn = dirs(R);
console.log(`  新：右 ${bn.right.toFixed(3)}／左 ${bn.left.toFixed(3)}／上 ${bn.above.toFixed(3)}／下 ${bn.below.toFixed(3)}`);
if (OLD) { const bo = dirs(OLD); console.log(`  舊：右 ${bo.right.toFixed(3)}／左 ${bo.left.toFixed(3)}／上 ${bo.above.toFixed(3)}／下 ${bo.below.toFixed(3)}`); }
const expect = { right: 0.5 + R.HALF - R.SIDE_RIGHT * 2 * R.HALF, left: 0.5 + R.HALF - R.SIDE_LEFT * 2 * R.HALF, above: 0.5 + R.BODY_UP - R.UPPER_HIT * (R.BODY_UP + R.BODY_DOWN), below: 0.5 + R.FEET_REACH - R.FEET_HIT * R.FEET_REACH };
for (const k of Object.keys(expect)) ok(near(bn[k], expect[k], 0.012), `單線 ${k} 邊界 ${bn[k].toFixed(3)}，由參數推得 ${expect[k].toFixed(3)}`);

console.log('\n並排火線（兩條相鄰的火線）');
{
  /* 橫火兩排：第 3、4 列（y∈[3,5)），角色 x=6.5 上下移動。從上方進來由「腳」決定、從下方離開由「頭」決定 */
  const bombs = [[3, 3, 4], [3, 4, 4]];
  const f = (rules) => intervals(rules, bombs, 1.8, 6.4, 0.01, t => [6.5, t]);
  const n = f(R); console.log('  橫火兩排（角色上下移動）被炸 y 區間：新 ' + fmt(n) + (OLD ? '／舊 ' + fmt(f(OLD)) : ''));
  ok(n.length === 1, '橫向並排：被炸的位置是連續的一段（沒有中間破洞）');
  ok(near(n[0][0], 3.5 - expect.below, 0.015), `橫向並排：從上方進來，邊界同單線的腳門檻（y≈${(3.5 - expect.below).toFixed(2)}），實測 ${n[0][0].toFixed(2)}`);
  ok(near(n[0][1], 4.5 + expect.above, 0.015), `橫向並排：從下方進來，邊界同單線的頭門檻（y≈${(4.5 + expect.above).toFixed(2)}），實測 ${n[0][1].toFixed(2)}`);
  ok(hit(R, bombs, 6.5, 4.0 + R.HURT_LIFT), '橫向並排：身體跨在兩排交界（各壓一半、面積加總 100%）：被炸');
  ok(!hit(R, bombs, 6.5, 2.5) && !hit(R, bombs, 6.5, 5.5 + R.HURT_LIFT + 0.4), '橫向並排：站在兩排外面那一格正中間：安全');
  /* 直火兩欄：第 3、4 欄（x∈[3,5)），角色 y=7.5 左右移動 */
  const bombsV = [[3, 3, 5], [4, 3, 5]];
  const g = (rules) => intervals(rules, bombsV, 1.8, 6.6, 0.01, t => [t, 7.5]);
  const m = g(R); console.log('  直火兩欄（角色左右移動）被炸 x 區間：新 ' + fmt(m) + (OLD ? '／舊 ' + fmt(g(OLD)) : ''));
  ok(m.length === 1, '直向並排：被炸的位置是連續的一段');
  ok(near(m[0][0], 3.5 - expect.right, 0.015), `直向並排：從左邊進來（火線在右），邊界同單線右門檻（x≈${(3.5 - expect.right).toFixed(3)}），實測 ${m[0][0].toFixed(3)}`);
  ok(near(m[0][1], 4.5 + expect.left, 0.015), `直向並排：從右邊進來（火線在左），邊界同單線左門檻（x≈${(4.5 + expect.left).toFixed(3)}），實測 ${m[0][1].toFixed(3)}`);
  ok(hit(R, bombsV, 4.0, 7.5), '直向並排：身體跨在兩欄交界（各壓一半）：被炸');
}

/** 二維分布：在 x∈[x0,x1]、y∈[y0,y1] 每隔 step 取樣，印出 # 被炸／. 安全（新），有舊版就並排印 */
function map2d(title, bombs, x0, x1, y0, y1, step) {
  const rows = (rules) => { const out = []; for (let y = y0; y <= y1 + 1e-9; y += step) { let r = ''; for (let x = x0; x <= x1 + 1e-9; x += step) r += hit(rules, bombs, x, y) ? '#' : '.'; out.push(r); } return out; };
  const a = rows(R), b = OLD ? rows(OLD) : null;
  console.log(`  ${title}（x ${x0}～${x1}、y ${y0}～${y1}，# 被炸）` + (b ? '    左：新／右：舊' : ''));
  a.forEach((r, i) => console.log('    ' + r + (b ? '    ' + b[i] : '')));
  const count = rs => rs.join('').split('#').length - 1;
  console.log(`    被炸取樣點：新 ${count(a)}` + (b ? `／舊 ${count(b)}` : ''));
  return a;
}

console.log('\n十字火線（單一炸彈，中心 (6,3)）');
{
  const cross = [[6, 3, 4]];
  map2d('十字：右上斜角那一格周圍', cross, 6.4, 8.6, 1.4, 3.6, 0.1);
  ok(!hit(R, cross, 7.5, 2.5), '十字：站在斜對角那一格正中間：安全');
  ok(!hit(R, cross, 7.15, 2.5), '十字：斜對角那格往直火靠一點（壓進直火約 28%）：安全');
  ok(hit(R, cross, 6.5, 2.67), '十字：站在十字中心正上方那一格的下緣（那格本身就在直火上）：被炸');
  ok(hit(R, cross, 7.5, 2.67), '十字：斜對角那格往橫火靠、腳壓進橫火超過 30%：被炸');
  ok(!hit(R, cross, 7.5, 2.62), '十字：斜對角那格、腳壓進橫火約 24%：還沒到 30%，安全');
  ok(hit(R, cross, 7.03, 2.5), '十字：斜對角那格往直火靠到壓進直火約 46%（直火在左邊，過左門檻 44.4%）：被炸');
  ok(hit(R, cross, 6.5, 3.5 + R.HURT_LIFT) && hit(R, cross, 6.0, 3.0 + R.HURT_LIFT), '十字：站在十字中心附近：被炸');
}

console.log('\n交叉火線（兩顆炸彈的兩條線交叉：橫火第 3 列、直火第 6 欄）');
{
  const crossing = [[3, 3, 5], [6, 1, 5]];
  map2d('交叉：交叉點右上方斜角那一格周圍', crossing, 6.4, 8.6, 1.4, 3.6, 0.1);
  ok(!hit(R, [[3, 3, 5]], 7.5, 2.5) && !hit(R, [[6, 1, 5]], 7.5, 2.5), '交叉：單獨一條線時，站在斜角格正中間：安全');
  ok(hit(R, crossing, 7.5, 2.67), '交叉：斜角格往橫火靠、腳壓進超過 30%：被炸');
  ok(!hit(R, crossing, 7.15, 2.5), '交叉：斜角格往直火靠一點（約 28%）：安全');
  /* 交叉點兩側都有火：身體同時壓兩條線，面積加總 ≥ HALF_BODY 也要被炸（不是只看單格門檻） */
  ok(hit(R, crossing, 6.5, 3.5 + R.HURT_LIFT), '交叉：站在交叉點：被炸');
}

console.log(fails ? `\n${fails} 項失敗` : '\n全部符合');
process.exit(fails ? 1 : 0);
