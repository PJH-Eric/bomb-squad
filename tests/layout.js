/* ===== tests/layout.js — 版面調整測試：格子變少、每格變大，連帶的地圖、出生點、人物、道具都要跟著對 =====
 * 用法：node tests/layout.js
 * 純 Node，不需要瀏覽器。真實瀏覽器裡的實際量測另見 scripts/layout-check.js（選用，需要 Chrome）。
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const R = require('../public/js/rules.js');
const AI = require('../public/js/ai.js');
const Renderer = require('../public/js/render.js').Renderer;   /* render.js 在 Node 裡把 Renderer 掛在 module.exports 上 */

let passed = 0;
const failed = [];
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failed.push(name); console.log('  ✗ ' + name + '\n      ' + (e && e.message)); }
}

const OLD = { small: { w: 17, h: 13 }, large: { w: 19, h: 15 } };      /* 改版前（方形）的格數 */
const LAYOUTS = R.LAYOUTS;
const SEEDS = 60;

/** 各種裝置上，對局畫面留給地圖的可用空間（CSS 像素）：資訊欄在棋盤上方外牆圈裡，所以只扣 8px 邊距。手機直放改為遮罩，不在此列 */
const VIEWPORTS = [
  { name: '手機橫放', availW: 828, availH: 374 },
  { name: '平板直放', availW: 804, availH: 1164 },
  { name: '平板橫放', availW: 1164, availH: 804 },
  { name: '桌機', availW: 1424, availH: 884 }
];

console.log('地圖尺寸');
test('≤4 人用小圖 23×11，5～8 人用大圖 27×13（長方形），而且都是奇數（才有中心行列、才能左右上下對稱）', () => {
  for (let n = 1; n <= 8; n++) {
    const z = R.sizeFor(n);
    const want = n <= 4 ? { w: 23, h: 11 } : { w: 27, h: 13 };
    assert.deepStrictEqual(z, want, n + ' 人');
    assert.strictEqual(z.w % 2, 1); assert.strictEqual(z.h % 2, 1);
  }
});
test('長方形且格子夠多：寬比高多，內部格數小圖 189（原 165）、大圖 275（原 221），人多的地圖比較大', () => {
  const small = R.sizeFor(2), large = R.sizeFor(8);
  assert(small.w > small.h && large.w > large.h, '要是橫向的長方形');
  assert.strictEqual((small.w - 2) * (small.h - 2), 189); assert.strictEqual((large.w - 2) * (large.h - 2), 275);
  assert(large.w * large.h > small.w * small.h, '人多的地圖要比人少的大');
  assert(small.w * small.h >= 2 * 8 * 4 && large.w * large.h >= 8 * 8 * 3, '格子總數要夠 8 人出生點、軟磚與走位');
  assert(R.isLargeMap(large.w) && !R.isLargeMap(small.w), '大圖旗標以寬度判斷');
});
test('sizeFor 每次回傳新物件，改動回傳值不會污染常數', () => {
  const a = R.sizeFor(2); a.w = 99;
  assert.strictEqual(R.sizeFor(2).w, 23);
});
test('出生點數量：小圖 4 個（四個角）、大圖 8 個；而且全部落在邊框內側', () => {
  assert.strictEqual(R.spawnCount(R.sizeFor(2).w, R.sizeFor(2).h), 4);
  assert.strictEqual(R.spawnCount(R.sizeFor(8).w, R.sizeFor(8).h), 8);
  for (const n of [2, 8]) {
    const { w, h } = R.sizeFor(n);
    const pts = R.spawnPoints(w, h).slice(0, R.spawnCount(w, h));
    assert.strictEqual(new Set(pts.map(p => p.join(','))).size, pts.length, '出生點不能重疊');
    for (const [x, y] of pts) assert(x >= 1 && y >= 1 && x <= w - 2 && y <= h - 2, `出生點 ${x},${y} 在邊框上`);
  }
});

console.log('\n地圖生成（所有版型 × 兩種尺寸 × 多個 seed）');
for (const n of [2, 8]) {
  const { w, h } = R.sizeFor(n);
  test(`${w}×${h}：四向對稱、全連通、邊框是硬牆`, () => {
    for (const layout of LAYOUTS) for (let seed = 1; seed <= SEEDS; seed++) {
      const g = R.generateMap(seed, w, h, layout);
      assert.strictEqual(g.length, w * h);
      assert(R.connected(g, w, h), `${layout} seed ${seed} 不連通`);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = g[y * w + x];
        assert(v === 0 || v === 1 || v === 2, '格子值只能是 0／1／2');
        assert.strictEqual(v, g[y * w + (w - 1 - x)], `${layout} seed ${seed} 左右不對稱`);
        assert.strictEqual(v, g[(h - 1 - y) * w + x], `${layout} seed ${seed} 上下不對稱`);
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) assert.strictEqual(v, 1, '邊框要是硬牆');
      }
    }
  });
  test(`${w}×${h}：出生點本身與四周都是空的，一出生不會被卡住（至少 2 個方向能走）`, () => {
    for (const layout of LAYOUTS) for (let seed = 1; seed <= SEEDS; seed++) {
      const g = R.generateMap(seed, w, h, layout);
      for (const [sx, sy] of R.spawnPoints(w, h).slice(0, R.spawnCount(w, h))) {
        assert.strictEqual(g[sy * w + sx], 0, '出生點被占');
        let open = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g[(sy + dy) * w + sx + dx] === 0) open++;
        assert(open >= 2, `${layout} seed ${seed} 出生點 ${sx},${sy} 只剩 ${open} 個方向`);
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
          if (Math.abs(x - sx) + Math.abs(y - sy) <= 2) assert.notStrictEqual(g[y * w + x], 2, '安全區有軟磚');
        }
      }
    }
  });
  test(`${w}×${h}：軟磚填充率至少 88%（排除出生點安全區），地圖開局不顯空，硬牆也不會多到沒路`, () => {
    const sp = R.spawnPoints(w, h).slice(0, R.spawnCount(w, h));
    for (const layout of LAYOUTS) for (let seed = 1; seed <= SEEDS; seed++) {
      const g = R.generateMap(seed, w, h, layout);
      let eligible = 0, soft = 0, hard = 0;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const v = g[y * w + x];
        if (v === 1) { hard++; continue; }
        if (sp.some(([a, b]) => Math.abs(x - a) + Math.abs(y - b) <= 2)) continue;
        eligible++; if (v === 2) soft++;
      }
      assert(soft / eligible >= 0.88, `${layout} seed ${seed} 軟磚只佔 ${(soft / eligible * 100).toFixed(0)}%`);
      assert(hard <= (w - 2) * (h - 2) * 0.45, `${layout} seed ${seed} 硬牆 ${hard} 太多`);
    }
  });
  test(`${w}×${h}：不同 seed 的排列真的不一樣（60 張裡至少 55 種）`, () => {
    for (const layout of ['classic', 'open', 'dense']) {
      const seen = new Set();
      for (let seed = 1; seed <= SEEDS; seed++) seen.add(R.generateMap(seed, w, h, layout).join(''));
      assert(seen.size >= 55, layout + ' 只有 ' + seen.size + ' 種');
    }
  });
}
test('不可破壞的東西不會太多：任何一張圖硬牆都不超過可走空間的 24%，經典／產線平均約 9%、密集約 12%、空曠約 5%', () => {
  const avg = {};
  for (const n of [2, 8]) {
    const { w, h } = R.sizeFor(n), inner = (w - 2) * (h - 2);
    for (const layout of LAYOUTS) {
      let sum = 0, N = 150;
      for (let seed = 1; seed <= N; seed++) {
        const g = R.generateMap(seed, w, h, layout);
        let hard = 0; for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (g[y * w + x] === 1) hard++;
        assert(hard / inner <= 0.24, `${w}×${h} ${layout} seed ${seed} 硬牆佔 ${(hard / inner * 100).toFixed(0)}%，太多`);
        sum += hard / inner;
      }
      (avg[layout] = avg[layout] || []).push(sum / N);
    }
  }
  const m = k => avg[k].reduce((a, b) => a + b, 0) / avg[k].length;
  assert(m('open') < m('classic') && m('classic') < m('dense'), '空曠 < 經典 < 密集 的硬牆量順序要保持');
  assert(m('dense') <= 0.16 && m('classic') <= 0.12 && m('open') <= 0.07, '各版型平均硬牆量太高');
  assert(m('open') >= 0.02, '空曠也要有一些硬牆，不然沒有變化');
});
test('約一半的地圖把中央硬牆換成軟磚（30%～70% 之間），小圖大圖都一樣', () => {
  for (const n of [2, 8]) {
    const { w, h } = R.sizeFor(n);
    let diff = 0, total = 200;
    for (let seed = 1; seed <= total; seed++) if (R.generateMap(seed, w, h, 'classic').join('') !== R.generateMap(seed, w, h, 'classic', undefined, false).join('')) diff++;
    assert(diff / total >= 0.3 && diff / total <= 0.7, `${w}×${h} 比例 ${diff / total}`);
  }
});

console.log('\n開局（玩家位置、道具）');
test('2～8 人開局：每人站在不同的空格出生點上，位置在新地圖範圍內', () => {
  for (let n = 2; n <= 8; n++) for (let seed = 1; seed <= 20; seed++) {
    const players = Array.from({ length: n }, (_, i) => ({ slot: i, name: 'P' + i, animal: 'cat', kind: 'human' }));
    const s = R.createGame({ seed, players, layout: 'random', countdown: 0, timeLimit: 0 });
    const z = R.sizeFor(n);
    assert.strictEqual(s.w, z.w); assert.strictEqual(s.h, z.h);
    assert.strictEqual(s.grid.length, z.w * z.h);
    const cells = new Set();
    for (const p of s.players) {
      const c = R.cellOf(p);
      assert(R.inside(s, c.x, c.y), '玩家在地圖外');
      assert.strictEqual(s.grid[R.cellIdx(s, c.x, c.y)], 0, '玩家站在牆上');
      cells.add(c.x + ',' + c.y);
    }
    assert.strictEqual(cells.size, n, `${n} 人出生點重疊`);
  }
});
test('空投機、掉寶都落在新地圖的空格上（跑 60 秒不會掉到牆裡或地圖外）', () => {
  for (const n of [2, 8]) {
    const players = Array.from({ length: n }, (_, i) => ({ slot: i, name: 'P' + i, animal: 'cat', kind: 'ai', level: 'normal' }));
    const s = R.createGame({ seed: 77, players, layout: 'random', countdown: 0, timeLimit: 0 });
    const brains = players.map((p, i) => AI.createBrain(p.level, 500 + i));
    const inputs = {};
    for (let t = 0; t < 60 * 60 && s.phase !== 'over'; t++) {
      s.players.forEach((p, k) => { const o = AI.think(brains[k], s, p, R.DT); inputs[p.slot] = inputs[p.slot] || {}; inputs[p.slot].dir = o.dir; if (o.bomb) inputs[p.slot].bomb = true; });
      R.step(s, inputs, R.DT);
      for (const it of s.itemsOn) {
        assert(R.inside(s, it.cx, it.cy), '道具在地圖外');
        assert.notStrictEqual(s.grid[R.cellIdx(s, it.cx, it.cy)], 1, '道具掉進硬牆');
      }
      if (s.plane) assert(s.plane.row >= 1 && s.plane.row <= s.h - 2, '空投機的航線不在地圖內');
    }
  }
});
test('電腦在新地圖上不會卡死在出生點：開局 20 秒內每個人都移動過（小圖 4 人、大圖 8 人）', () => {
  for (const n of [4, 8]) for (const seed of [3, 9, 21]) {
    const players = Array.from({ length: n }, (_, i) => ({ slot: i, name: 'AI' + i, animal: 'cat', kind: 'ai', level: 'normal' }));
    const s = R.createGame({ seed, players, layout: 'random', countdown: 0, timeLimit: 0 });
    const brains = players.map((p, i) => AI.createBrain(p.level, seed * 31 + i));
    const start = s.players.map(p => [p.x, p.y]), moved = new Set(), inputs = {};
    for (let t = 0; t < 20 * 60 && s.phase !== 'over'; t++) {
      s.players.forEach((p, k) => { const o = AI.think(brains[k], s, p, R.DT); inputs[p.slot] = inputs[p.slot] || {}; inputs[p.slot].dir = o.dir; if (o.bomb) inputs[p.slot].bomb = true; });
      R.step(s, inputs, R.DT);
      s.players.forEach((p, k) => { if (Math.hypot(p.x - start[k][0], p.y - start[k][1]) > 0.8) moved.add(k); });
    }
    assert.strictEqual(moved.size, n, `${n} 人 seed ${seed} 有人沒動：${moved.size}/${n}`);
  }
});
test('快照往返：新尺寸的地圖字串長度正確，還原後格子一致', () => {
  for (const n of [2, 8]) {
    const players = Array.from({ length: n }, (_, i) => ({ slot: i, name: 'P' + i, animal: 'cat', kind: 'human' }));
    const s = R.createGame({ seed: 5, players, layout: 'classic', countdown: 0, timeLimit: 0 });
    const info = R.startInfo(s);
    assert.strictEqual(info.g.length, s.w * s.h);
    const v = R.viewFromStart(info);
    assert.strictEqual(v.w, s.w); assert.strictEqual(v.h, s.h);
    assert.deepStrictEqual(v.grid, s.grid);
  }
});

console.log('\n格子與畫面大小');
test('每種裝置：格子多了之後每格仍夠大（小圖 ≥ 17px、大圖 ≥ 15px），整張地圖塞得進畫面，縮水不超過約三成', () => {
  for (const vp of VIEWPORTS) {
    const sm = R.sizeFor(2), lg = R.sizeFor(8);
    const tS = Renderer.tileCss(vp.availW, vp.availH, sm.w, sm.h), oS = Renderer.tileCss(vp.availW, vp.availH, OLD.small.w, OLD.small.h);
    const tL = Renderer.tileCss(vp.availW, vp.availH, lg.w, lg.h), oL = Renderer.tileCss(vp.availW, vp.availH, OLD.large.w, OLD.large.h);
    assert(tS >= 17, `${vp.name} 小圖每格只有 ${tS}px`);
    assert(tL >= 15, `${vp.name} 大圖每格只有 ${tL}px`);
    assert(tS >= oS * 0.7, `${vp.name} 小圖 ${oS}→${tS}px 縮太多`);
    assert(tL >= oL * (vp.name === '平板直放' ? 0.65 : 0.7), `${vp.name} 大圖 ${oL}→${tL}px 縮太多`);
    for (const [t, z] of [[tS, sm], [tL, lg]]) {
      assert(t * z.w <= vp.availW + 0.001 && t * z.h <= vp.availH + 0.001, `${vp.name} ${z.w}×${z.h} 超出畫面`);
    }
  }
});
test('tileCss：取寬高較吃緊的那一邊、取整數、最小 12px、沒有上限', () => {
  assert.strictEqual(Renderer.tileCss(1300, 550, 23, 11), 50);        /* 高度吃緊：550/11 */
  assert.strictEqual(Renderer.tileCss(300, 900, 23, 11), 13);         /* 寬度吃緊：300/21 */
  assert.strictEqual(Renderer.tileCss(10, 10, 23, 11), 12);           /* 太小時保底 12 */
  assert(Renderer.tileCss(4000, 4000, 23, 11) > 150, '不該有格子上限');
});
test('人物、道具、炸彈的大小是格子邊長的固定倍數，格子大小怎麼變它們就等比跟著變', () => {
  const S = Renderer.SPRITE;
  assert(S && S.animal > 0 && S.item > 0 && S.bomb > 0 && S.plane > 0);
  assert(S.animal <= 1.2, '人物比一格大太多會蓋住隔壁格');
  assert(S.bombOverAlpha > 0 && S.bombOverAlpha <= 1, '炸彈疊在人物上的不透明度要在 0～1 之間');
  assert(S.ghostFaint >= 0.1 && S.ghostFaint <= 0.3, '隱身的淡淡身形要看得出來（≥ 10%）又不搶眼（≤ 30%）：' + S.ghostFaint);
  /* 眼睛讀到的位置（腳下影子與光圈）要貼近火焰判定用的中心，不然上下與左右的「半身」感覺會不一致 */
  assert(S.foot >= -0.05 && S.foot <= 0.15, '腳下影子離判定中心 ' + S.foot + ' 格，太遠');
  assert(S.item < 1, '道具要比一格小，不然會跟牆重疊');
  assert(S.bomb >= S.animal * 0.95 && S.bomb <= S.animal * 1.05, '炸彈要跟人物差不多大（95%～105%），人物站在同一格才不會把炸彈整顆蓋住');
  for (const vp of VIEWPORTS) for (const n of [2, 8]) {
    const z = R.sizeFor(n), t = Renderer.tileCss(vp.availW, vp.availH, z.w, z.h);
    const animal = Math.round(t * S.animal), item = Math.round(t * S.item), bomb = Math.round(t * S.bomb);
    /* 手機橫放的大圖最擠（每格約 28px），人物也要有 18px、道具 13px 才看得清楚 */
    assert(animal >= 18 && item >= 13 && bomb >= 15, `${vp.name} ${n} 人 人物 ${animal}px／道具 ${item}px／炸彈 ${bomb}px 太小`);
    assert(Math.abs(animal / t - S.animal) < 0.05 && Math.abs(item / t - S.item) < 0.06, '倍數不成比例');
  }
});
test('Renderer.fit：畫布寬高 = 格數 × 格子像素，樣式尺寸與回傳值一致，換尺寸會清掉舊的圖快取', () => {
  const canvas = { width: 0, height: 0, style: {}, getContext() { return {}; } };
  const r = new Renderer(canvas);
  {
    const sm = R.sizeFor(2);
    const o = r.fit(828, 322, sm.w, sm.h);
    const k = r.dpr, tCss = Renderer.tileCss(828, 322, sm.w, sm.h);   /* Node 裡沒有 devicePixelRatio，dpr 會是 1 */
    assert.strictEqual(r.T, tCss * k);
    assert.strictEqual(canvas.width, sm.w * tCss * k); assert.strictEqual(canvas.height, sm.h * tCss * k);
    assert.strictEqual(o.tile, tCss); assert.strictEqual(o.w, sm.w * tCss); assert.strictEqual(o.h, sm.h * tCss);
    assert.strictEqual(canvas.style.width, o.w + 'px'); assert.strictEqual(canvas.style.height, o.h + 'px');
    r.sprites.set('x', 1);
    const lg = R.sizeFor(8);
    r.fit(828, 322, lg.w, lg.h);
    assert.strictEqual(r.sprites.size, 0, '換地圖尺寸要清掉舊圖');
    assert.strictEqual(canvas.width, lg.w * Renderer.tileCss(828, 322, lg.w, lg.h) * k);
  }
});

console.log('\n觸控操作版面（手機／平板 × 直放／橫放）');
const TouchLayout = require('../public/js/touchlayout.js');
/* vw×vh 是視窗；資訊欄在棋盤上方外牆圈裡，所以上下各只留 8px 邊距 */
const TOUCH_VIEWS = [
  { name: '手機直放', vw: 390, vh: 844 }, { name: '手機橫放', vw: 844, vh: 390 },
  { name: '小手機橫放', vw: 667, vh: 375 }, { name: '平板直放', vw: 820, vh: 1180 },
  { name: '平板橫放', vw: 1180, vh: 820 }, { name: '大平板橫放', vw: 1366, vh: 1024 }
].map(v => Object.assign(v, { availW: v.vw - 16, availH: v.vh - 16 }));
const planFor = (v, n, touch, extra) => { const z = R.sizeFor(n); return TouchLayout.plan(Object.assign({ vw: v.vw, vh: v.vh, availW: v.availW, availH: v.availH, mapW: z.w, mapH: z.h, touch, tile: Renderer.tileCss }, extra || {})); };
const byName = name => TOUCH_VIEWS.find(v => v.name === name);

test('裝置分類：短邊 < 560 是手機，其餘是平板；橫放看寬 > 高', () => {
  assert.strictEqual(TouchLayout.deviceClass(390, 844).key, 'phone-p');
  assert.strictEqual(TouchLayout.deviceClass(844, 390).key, 'phone-l');
  assert.strictEqual(TouchLayout.deviceClass(820, 1180).key, 'tablet-p');
  assert.strictEqual(TouchLayout.deviceClass(1180, 820).key, 'tablet-l');
});
test('橫放控制鈕大小依螢幕高度等比例：搖桿 32%（120～172px）、炸彈鈕 23%（86～116px）；手機 844×390 約 125／90px，平板 1180×820 取上限 172／116px', () => {
  const ph = TouchLayout.sizes(844, 390), tb = TouchLayout.sizes(1180, 820);
  assert.strictEqual(ph.stick, Math.round(390 * 0.32)); assert.strictEqual(ph.bomb, Math.round(390 * 0.23));
  assert(ph.stick >= 120 && ph.bomb >= 86 && ph.stick <= 172 && ph.bomb <= 116);
  assert.strictEqual(tb.stick, 172); assert.strictEqual(tb.bomb, 116);
  assert.strictEqual(TouchLayout.sizes(667, 375).stick, 120, '小手機取下限 120px');
  assert.strictEqual(TouchLayout.sizes(667, 375).bomb, 86, '小手機炸彈鈕取下限 86px');
  for (const s of [ph, tb]) assert(s.knob < s.stick * 0.6 && s.knob >= s.stick * 0.38, '搖桿球與底盤比例不對');
});
test('設定的大小倍率（0.8～1.3）直接乘在預設尺寸上，可以超出搖桿 120～172px、炸彈鈕 86～116px 的上下限；不合法的倍率會夾回範圍', () => {
  const base = TouchLayout.sizes(1180, 820, 1);
  assert.strictEqual(TouchLayout.sizes(1180, 820, 1.3).stick, Math.round(172 * 1.3));
  assert(TouchLayout.sizes(1180, 820, 1.3).stick > TouchLayout.MAX_STICK && TouchLayout.sizes(1180, 820, 1.3).bomb > TouchLayout.MAX_BOMB, '放大後要能超出上限');
  assert(TouchLayout.sizes(667, 375, 0.8).stick < TouchLayout.MIN_STICK, '縮小後要能低於下限');
  assert.strictEqual(TouchLayout.sizes(1180, 820, 5).stick, TouchLayout.sizes(1180, 820, 1.3).stick);
  assert.strictEqual(TouchLayout.sizes(1180, 820, 0).stick, TouchLayout.sizes(1180, 820, 0.8).stick);
  assert.deepStrictEqual(TouchLayout.sizes(1180, 820, NaN), base); assert.deepStrictEqual(TouchLayout.sizes(1180, 820), base);
});
test('預設透明度平時約 45%、按住約 80%；邊距手機 20px、平板 32px；不再有 overlay 縮小（SHRINK）', () => {
  assert.strictEqual(TouchLayout.OPACITY_IDLE, 0.45); assert.strictEqual(TouchLayout.OPACITY_DOWN, 0.8);
  assert.strictEqual(TouchLayout.EDGE['phone-l'], 20); assert.strictEqual(TouchLayout.EDGE['tablet-l'], 32); assert.strictEqual(TouchLayout.EDGE['tablet-p'], 32);
  assert.strictEqual(TouchLayout.SHRINK, undefined);
  const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
  assert(!/\.touch\.overlay/.test(css), 'CSS 不該再有 overlay 縮小的特例');
  assert(Storage_defaults().touchOpacity === 0.45 && Storage_defaults().touchScale === 1, '設定預設值');
});
function Storage_defaults() {
  const sandbox = { self: {}, localStorage: { getItem() { return null; }, setItem() {} } };
  require('vm').runInNewContext(fs.readFileSync(path.join(__dirname, '../public/js/storage.js'), 'utf8'), sandbox);
  return sandbox.self.Store.SETTING_DEFAULTS;
}
test('沒有觸控鈕（桌機、滑鼠）：不留任何空位', () => {
  for (const v of TOUCH_VIEWS) for (const n of [2, 8]) {
    const p = planFor(v, n, false, { player: false });      /* player:false＝觀戰者，手機直放也不擋 */
    assert.strictEqual(p.mode, 'none'); assert.strictEqual(p.gutter, 0); assert.strictEqual(p.bottom, 0);
  }
});
test('手機直放：玩家看到「請橫向遊玩」遮罩（rotate），觀戰者不會被擋', () => {
  for (const n of [2, 8]) {
    assert.strictEqual(planFor(byName('手機直放'), n, true).mode, 'rotate');
    assert.strictEqual(planFor(byName('手機直放'), n, false).mode, 'rotate', '沒顯示觸控鈕的手機直放玩家一樣要轉橫');
    assert.notStrictEqual(planFor(byName('手機直放'), n, false, { player: false }).mode, 'rotate', '觀戰者直放也能看');
  }
  for (const name of ['手機橫放', '小手機橫放', '平板直放', '平板橫放']) assert.notStrictEqual(planFor(byName(name), 2, true).mode, 'rotate', name);
});
test('手機橫放：固定 overlay、格子與沒有控制鈕時一樣大（不縮格子、不留位置），控制鈕不縮小', () => {
  for (const name of ['手機橫放', '小手機橫放']) for (const n of [2, 8]) {
    const v = byName(name), p = planFor(v, n, true), z = R.sizeFor(n);
    assert.strictEqual(p.mode, 'overlay'); assert.strictEqual(p.gutter, 0); assert.strictEqual(p.bottom, 0);
    assert.strictEqual(p.tile, Renderer.tileCss(v.availW, v.availH, z.w, z.h), 'overlay 不該縮小格子');
    assert.deepStrictEqual(p.sizes, TouchLayout.sizes(v.vw, v.vh), '控制鈕只由高度比例與倍率決定，不再縮小');
    assert.strictEqual(p.edge, 20);
  }
});
test('平板橫放：控制鈕放棋盤上下留白，最多蓋到最下方外牆圈、不蓋可玩格；格子至少保有 80%；邊距 32px', () => {
  for (const name of ['平板橫放', '大平板橫放']) for (const n of [2, 8]) for (const scale of [0.8, 1, 1.3]) {
    const v = byName(name), p = planFor(v, n, true, { scale }), z = R.sizeFor(n);
    const free = Renderer.tileCss(v.availW, v.availH, z.w, z.h);
    assert.strictEqual(p.mode, 'bars'); assert.strictEqual(p.gutter, 0); assert.strictEqual(p.edge, 32);
    assert(p.tile * z.w <= v.availW && p.tile * z.h <= v.availH - p.bottom + 0.001, `${name} ${n} 人 ×${scale} 地圖超出`);
    const need = p.sizes.stick + p.edge, below = (v.availH - p.bottom - p.tile * z.h) / 2 + p.bottom;
    assert(below + p.tile >= need - 0.001, `${name} ${n} 人 ×${scale} 控制鈕會蓋到可玩格（下方留白 ${below}＋外牆 ${p.tile} < ${need}）`);
    assert(p.tile >= free * 0.8, `${name} ${n} 人 ×${scale} 格子縮太多：${free}→${p.tile}`);
  }
  const p1180 = planFor(byName('平板橫放'), 2, true);
  assert.strictEqual(p1180.sizes.stick, 172); assert.strictEqual(p1180.sizes.bomb, 116);
});
test('平板直放：維持 bottom 模式，按搖桿大小留出底部空間，地圖整張仍在可用空間內', () => {
  const v = byName('平板直放');
  for (const n of [2, 8]) {
    const p = planFor(v, n, true), z = R.sizeFor(n);
    assert.strictEqual(p.mode, 'bottom'); assert.strictEqual(p.gutter, 0);
    assert.strictEqual(p.bottom, p.sizes.stick + TouchLayout.BOTTOM + TouchLayout.GAP);
    assert(p.tile * z.w <= v.availW && p.tile * z.h <= v.availH - p.bottom, `${n} 人地圖超出`);
    assert.strictEqual(p.edge, 32);
  }
});
test('plan 不修改傳入的資料，尺寸物件是複本', () => {
  const a = TouchLayout.sizes(390, 844); a.stick = 1;
  assert.strictEqual(TouchLayout.sizes(390, 844).stick, 150);
});
test('game.js／style.css 用的是 touchlayout 的變數，沒有殘留寫死的搖桿尺寸', () => {
  const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
  assert(/--stick/.test(css) && /--bomb/.test(css) && /--gut/.test(css) && /--tc-op/.test(css));
  assert(!/width: 156px; height: 156px/.test(css), '還有寫死的 156px 搖桿');
  const game = fs.readFileSync(path.join(__dirname, '../public/js/game.js'), 'utf8');
  assert(/TouchLayout/.test(game) && /Renderer\.tileCss/.test(game));
});
test('多點觸控基礎：搖桿與炸彈鍵各自記錄 pointerId、用 Pointer Events（不是 touch*）、頁面隱藏與 pagehide 會完整重置', () => {
  const game = fs.readFileSync(path.join(__dirname, '../public/js/game.js'), 'utf8');
  assert(/let stickId = null, bombId = null/.test(game) && /e\.pointerId !== bombId/.test(game) && /if \(stickId !== null\) return/.test(game));
  assert(!/touchstart|touchmove|touchend/.test(game), '不能改成 touch* 事件');
  assert(/visibilitychange/.test(game) && /pagehide/.test(game) && /this\.resetTouch = /.test(game));
});

console.log('\n殘留檢查');
test('程式、說明裡不再有舊的大圖 17×15 尺寸，也沒有寫死的出生點門檻 w <= 15', () => {
  const root = path.join(__dirname, '..');
  const files = ['public/js', 'lib', 'README.md', 'public/index.html'].flatMap(p => {
    const full = path.join(root, p);
    return fs.statSync(full).isDirectory() ? fs.readdirSync(full).filter(f => /\.(js|html)$/.test(f)).map(f => path.join(full, f)) : [full];
  });
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    assert(!/17\s*[×x]\s*15/.test(text), path.basename(f) + ' 還有舊尺寸 17×15');
    assert(!/w <= 15/.test(text), path.basename(f) + ' 還有寫死的 w <= 15');
  }
});
test('index.html 有載入 mappick.js，且每支 script 都存在', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]);
  assert(srcs.includes('js/mappick.js'));
  for (const s of srcs) assert(fs.existsSync(path.join(__dirname, '../public', s)), s + ' 不存在');
});

console.log('\n' + passed + ' 項通過' + (failed.length ? '，' + failed.length + ' 項失敗：\n  - ' + failed.join('\n  - ') : ''));
if (failed.length) process.exit(1);
