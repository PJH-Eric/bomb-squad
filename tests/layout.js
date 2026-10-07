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

const OLD = { small: { w: 15, h: 13 }, large: { w: 17, h: 15 } };      /* 改版前的格數 */
const LAYOUTS = R.LAYOUTS;
const SEEDS = 60;

/** 各種裝置上，對局畫面留給地圖的可用空間（CSS 像素）：已扣掉頂端計時列、觸控搖桿與邊距 */
const VIEWPORTS = [
  { name: '手機直放', availW: 374, availH: 540 },
  { name: '手機橫放', availW: 828, availH: 322 },
  { name: '平板直放', availW: 804, availH: 902 },
  { name: '平板橫放', availW: 1164, availH: 752 },
  { name: '桌機', availW: 1084, availH: 832 }
];

console.log('地圖尺寸');
test('≤4 人用小圖 17×13，5～8 人用大圖 19×15，而且都是奇數（才有中心行列、才能左右上下對稱）', () => {
  for (let n = 1; n <= 8; n++) {
    const z = R.sizeFor(n);
    const want = n <= 4 ? { w: 17, h: 13 } : { w: 19, h: 15 };
    assert.deepStrictEqual(z, want, n + ' 人');
    assert.strictEqual(z.w % 2, 1); assert.strictEqual(z.h % 2, 1);
  }
});
test('格子數盡量多：長寬都不少於最初（15×13／17×15），小圖 221 格、大圖 285 格', () => {
  const small = R.sizeFor(2), large = R.sizeFor(8);
  assert(small.w >= OLD.small.w && small.h >= OLD.small.h, '小圖不能比最初小：' + small.w + '×' + small.h);
  assert(large.w >= OLD.large.w && large.h >= OLD.large.h, '大圖不能比最初小：' + large.w + '×' + large.h);
  assert(small.w * small.h >= OLD.small.w * OLD.small.h * 1.1, '小圖格數：' + small.w * small.h);
  assert(large.w * large.h >= OLD.large.w * OLD.large.h * 1.1, '大圖格數：' + large.w * large.h);
  assert(large.w * large.h > small.w * small.h, '人多的地圖要比人少的大');
  assert(small.w * small.h >= 2 * 8 * 4 && large.w * large.h >= 8 * 8 * 3, '格子總數要夠 8 人出生點、軟磚與走位');
});
test('sizeFor 每次回傳新物件，改動回傳值不會污染常數', () => {
  const a = R.sizeFor(2); a.w = 99;
  assert.strictEqual(R.sizeFor(2).w, 17);
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
    assert(tL >= oL * 0.7, `${vp.name} 大圖 ${oL}→${tL}px 縮太多`);
    for (const [t, z] of [[tS, sm], [tL, lg]]) {
      assert(t * z.w <= vp.availW + 0.001 && t * z.h <= vp.availH + 0.001, `${vp.name} ${z.w}×${z.h} 超出畫面`);
    }
  }
});
test('tileCss：取寬高較吃緊的那一邊、取整數、最小 12px、沒有上限', () => {
  assert.strictEqual(Renderer.tileCss(1300, 550, 17, 13), 42);        /* 高度吃緊：550/13 */
  assert.strictEqual(Renderer.tileCss(260, 900, 17, 13), 15);         /* 寬度吃緊：260/17 */
  assert.strictEqual(Renderer.tileCss(10, 10, 17, 13), 12);           /* 太小時保底 12 */
  assert(Renderer.tileCss(4000, 4000, 17, 13) > 200, '不該有格子上限');
});
test('人物、道具、炸彈的大小是格子邊長的固定倍數，格子大小怎麼變它們就等比跟著變', () => {
  const S = Renderer.SPRITE;
  assert(S && S.animal > 0 && S.item > 0 && S.bomb > 0 && S.plane > 0);
  assert(S.animal <= 1.2, '人物比一格大太多會蓋住隔壁格');
  assert(S.item < 1 && S.bomb <= 1, '道具與炸彈要比一格小，不然會跟牆重疊');
  for (const vp of VIEWPORTS) for (const n of [2, 8]) {
    const z = R.sizeFor(n), t = Renderer.tileCss(vp.availW, vp.availH, z.w, z.h);
    const animal = Math.round(t * S.animal), item = Math.round(t * S.item), bomb = Math.round(t * S.bomb);
    /* 手機直放的大圖最擠（每格約 17px），人物也要有 18px、道具 13px 才看得清楚 */
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
/* vw×vh 是視窗；頂端要留計時列（手機直放 86px，其他 60px），其餘邊距 8px */
const TOUCH_VIEWS = [
  { name: '手機直放', vw: 390, vh: 844, top: 86 }, { name: '手機橫放', vw: 844, vh: 390, top: 60 },
  { name: '小手機橫放', vw: 667, vh: 375, top: 60 }, { name: '平板直放', vw: 820, vh: 1180, top: 60 },
  { name: '平板橫放', vw: 1180, vh: 820, top: 60 }, { name: '大平板橫放', vw: 1366, vh: 1024, top: 60 }
].map(v => Object.assign(v, { availW: v.vw - 16, availH: v.vh - v.top - 8 }));
const planFor = (v, n, touch) => { const z = R.sizeFor(n); return TouchLayout.plan({ vw: v.vw, vh: v.vh, availW: v.availW, availH: v.availH, mapW: z.w, mapH: z.h, touch, tile: Renderer.tileCss }); };

test('裝置分類：短邊 < 560 是手機，其餘是平板；橫放看寬 > 高', () => {
  assert.strictEqual(TouchLayout.deviceClass(390, 844).key, 'phone-p');
  assert.strictEqual(TouchLayout.deviceClass(844, 390).key, 'phone-l');
  assert.strictEqual(TouchLayout.deviceClass(820, 1180).key, 'tablet-p');
  assert.strictEqual(TouchLayout.deviceClass(1180, 820).key, 'tablet-l');
});
test('控制鈕大小：平板比手機大、直放比橫放大；搖桿 ≥ 120px、炸彈鈕 ≥ 86px，手指好按，球心不超過搖桿', () => {
  const S = TouchLayout.SIZES;
  assert(S['tablet-p'].stick > S['phone-p'].stick && S['tablet-l'].stick > S['phone-l'].stick, '平板的搖桿要比手機大');
  assert(S['tablet-p'].bomb > S['phone-p'].bomb && S['tablet-l'].bomb > S['phone-l'].bomb, '平板的炸彈鈕要比手機大');
  assert(S['phone-p'].stick > S['phone-l'].stick && S['tablet-p'].stick > S['tablet-l'].stick, '直放比橫放寬裕');
  for (const [k, s] of Object.entries(S)) {
    assert(s.stick >= 120 && s.bomb >= 86, k + ' 控制鈕太小');
    assert(s.knob < s.stick * 0.6 && s.knob >= s.stick * 0.38, k + ' 搖桿球與底盤比例不對');
  }
  assert.deepStrictEqual(TouchLayout.sizes(390, 844), S['phone-p']);
});
test('沒有觸控鈕（桌機、滑鼠）：不留任何空位', () => {
  for (const v of TOUCH_VIEWS) for (const n of [2, 8]) {
    const p = planFor(v, n, false);
    assert.strictEqual(p.mode, 'none'); assert.strictEqual(p.gutter, 0); assert.strictEqual(p.bottom, 0);
  }
});
test('直放：控制鈕放底部，按搖桿大小留出剛好的底部空間，地圖整張仍在可用空間內', () => {
  for (const v of TOUCH_VIEWS.filter(v => v.vh > v.vw)) for (const n of [2, 8]) {
    const p = planFor(v, n, true), z = R.sizeFor(n);
    assert.strictEqual(p.mode, 'bottom'); assert.strictEqual(p.gutter, 0);
    assert.strictEqual(p.bottom, p.sizes.stick + TouchLayout.BOTTOM + TouchLayout.GAP, v.name);
    assert(p.tile * z.w <= v.availW && p.tile * z.h <= v.availH - p.bottom, `${v.name} ${n} 人地圖超出`);
    assert(p.tile >= 14, `${v.name} ${n} 人每格只有 ${p.tile}px`);
  }
});
test('橫放：控制鈕放在地圖兩側的空位，控制鈕只壓到最外圈邊牆，格子至少保有原本的 85%', () => {
  let gutters = 0;
  for (const v of TOUCH_VIEWS.filter(v => v.vw > v.vh)) for (const n of [2, 8]) {
    const p = planFor(v, n, true), z = R.sizeFor(n);
    const free = Renderer.tileCss(v.availW, v.availH, z.w, z.h);
    if (p.mode === 'gutter') {
      gutters++;
      const need = Math.max(p.sizes.stick, p.sizes.bomb) + TouchLayout.EDGE + TouchLayout.GAP;
      assert(p.gutter + p.tile * TouchLayout.OVERLAP >= need - 0.001, `${v.name} 兩側空位放不下控制鈕（留 ${p.gutter}px，要 ${need}px）`);
      assert(p.gutter < need, '空位不該比控制鈕還寬（壓邊牆可以省下一點）');
      assert(p.tile * z.w + 2 * p.gutter <= v.availW + 0.001, `${v.name} ${n} 人地圖加兩側空位超出畫面`);
      assert(p.tile >= free * TouchLayout.MIN_KEEP, `${v.name} ${n} 人格子縮太多：${free}→${p.tile}`);
    } else {
      assert.strictEqual(p.mode, 'overlay', v.name + ' 橫放只會是 gutter 或 overlay');
      assert.strictEqual(p.tile, free, 'overlay 不該縮小格子');
    }
    assert.strictEqual(p.bottom, 0);
  }
  assert(gutters >= 6, '橫放多數情況要能把控制鈕放進兩側空位，實際只有 ' + gutters + ' 種');
});
test('橫放的 4 人小圖（17×13）在常見的手機與大小平板上都能放兩側，不用疊在地圖上', () => {
  for (const v of TOUCH_VIEWS.filter(v => v.vw > v.vh)) assert.strictEqual(planFor(v, 2, true).mode, 'gutter', v.name);
});
test('橫放兩側空位不夠時控制鈕會先縮小，但不會小於搖桿 120px、炸彈鈕 86px', () => {
  const v = { vw: 1366, vh: 1024, availW: 1350, availH: 948 }, p = planFor(v, 2, true), std = TouchLayout.sizes(v.vw, v.vh);   /* 大 iPad 橫放、4 人小圖 */
  assert.strictEqual(p.mode, 'gutter');
  assert(p.sizes.stick < std.stick, '這個情況控制鈕應該縮小才放得下');
  for (const x of TOUCH_VIEWS) for (const n of [2, 8]) { const q = planFor(x, n, true); assert(q.sizes.stick >= TouchLayout.MIN_STICK && q.sizes.bomb >= TouchLayout.MIN_BOMB, `${x.name} ${n} 人控制鈕太小`); assert(q.sizes.knob < q.sizes.stick); }
});
test('overlay 退路：視窗小到兩側怎麼放都會讓格子縮太多時，才疊在地圖上，而且用最小的鈕、格子不縮', () => {
  const v = { vw: 1024, vh: 768, availW: 1008, availH: 692 };       /* iPad 橫放、4 人小圖：兩側怎麼放格子都縮超過 15% */
  const p = planFor(v, 2, true), z = R.sizeFor(2);
  assert.strictEqual(p.mode, 'overlay'); assert.strictEqual(p.gutter, 0);
  assert.strictEqual(p.tile, Renderer.tileCss(v.availW, v.availH, z.w, z.h), 'overlay 不該縮小格子');
  const k = TouchLayout.SHRINK[TouchLayout.SHRINK.length - 1];
  assert.strictEqual(p.sizes.stick, Math.max(TouchLayout.MIN_STICK, Math.round(TouchLayout.sizes(v.vw, v.vh).stick * k)), 'overlay 要用最小的鈕');
});
test('plan 不修改傳入的資料，尺寸物件是複本', () => {
  const a = TouchLayout.sizes(390, 844); a.stick = 1;
  assert.strictEqual(TouchLayout.sizes(390, 844).stick, TouchLayout.SIZES['phone-p'].stick);
});
test('game.js／style.css 用的是 touchlayout 的變數，沒有殘留寫死的搖桿尺寸', () => {
  const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
  assert(/--stick/.test(css) && /--bomb/.test(css) && /--gut/.test(css));
  assert(!/width: 156px; height: 156px/.test(css), '還有寫死的 156px 搖桿');
  assert(!/padding-bottom: calc\((210|190)px/.test(css), '還有寫死的底部留白');
  const game = fs.readFileSync(path.join(__dirname, '../public/js/game.js'), 'utf8');
  assert(/TouchLayout/.test(game) && /Renderer\.tileCss/.test(game));
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
