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
test('≤4 人用小圖 15×11，5～8 人用大圖 15×13，而且都是奇數（才有中心行列、才能左右上下對稱）', () => {
  for (let n = 1; n <= 8; n++) {
    const z = R.sizeFor(n);
    const want = n <= 4 ? { w: 15, h: 11 } : { w: 15, h: 13 };
    assert.deepStrictEqual(z, want, n + ' 人');
    assert.strictEqual(z.w % 2, 1); assert.strictEqual(z.h % 2, 1);
  }
});
test('格子數仍比最初少：小圖 165 格（原 195，少 10% 以上）、大圖 195 格（原 255，少 20% 以上），列數也都比原本少', () => {
  const small = R.sizeFor(2), large = R.sizeFor(8);
  assert(small.w * small.h <= OLD.small.w * OLD.small.h * 0.9, '小圖格數：' + small.w * small.h);
  assert(large.w * large.h <= OLD.large.w * OLD.large.h * 0.8, '大圖格數：' + large.w * large.h);
  assert(small.h < OLD.small.h && large.h < OLD.large.h, '列數要比原本少，橫放與桌機的每格才會變大');
  assert(small.w >= 15 && large.w >= 15, '橫向至少 15 格，走位空間才夠');
});
test('sizeFor 每次回傳新物件，改動回傳值不會污染常數', () => {
  const a = R.sizeFor(2); a.w = 99;
  assert.strictEqual(R.sizeFor(2).w, 15);
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
test('每種裝置：每格不比舊地圖小；橫放、桌機至少大 10%，直放的大圖至少大 5%，整張地圖仍然塞得進畫面', () => {
  for (const vp of VIEWPORTS) {
    const sm = R.sizeFor(2), lg = R.sizeFor(8);
    const tNewS = Renderer.tileCss(vp.availW, vp.availH, sm.w, sm.h), tOldS = Renderer.tileCss(vp.availW, vp.availH, OLD.small.w, OLD.small.h);
    const tNewL = Renderer.tileCss(vp.availW, vp.availH, lg.w, lg.h), tOldL = Renderer.tileCss(vp.availW, vp.availH, OLD.large.w, OLD.large.h);
    const landscape = vp.availW > vp.availH;                  /* 橫放、桌機是高度吃緊，列數少就直接變大 */
    assert(tNewS >= tOldS * (landscape ? 1.1 : 1), `${vp.name} 小圖 ${tOldS}→${tNewS}px`);
    assert(tNewL >= tOldL * (landscape ? 1.1 : 1.05), `${vp.name} 大圖 ${tOldL}→${tNewL}px`);
    for (const [t, z] of [[tNewS, sm], [tNewL, lg]]) {
      assert(t * z.w <= vp.availW + 0.001 && t * z.h <= vp.availH + 0.001, `${vp.name} ${z.w}×${z.h} 超出畫面`);
    }
  }
});
test('tileCss：取寬高較吃緊的那一邊、取整數、最小 12px、沒有上限', () => {
  assert.strictEqual(Renderer.tileCss(1300, 550, 15, 11), 50);        /* 高度吃緊：550/11 */
  assert.strictEqual(Renderer.tileCss(260, 900, 15, 11), 17);         /* 寬度吃緊：260/15 */
  assert.strictEqual(Renderer.tileCss(10, 10, 15, 11), 12);           /* 太小時保底 12 */
  assert(Renderer.tileCss(4000, 4000, 15, 11) > 200, '不該有格子上限');
});
test('人物、道具、炸彈的大小是格子邊長的固定倍數，格子放大它們就等比放大', () => {
  const S = Renderer.SPRITE;
  assert(S && S.animal > 0 && S.item > 0 && S.bomb > 0 && S.plane > 0);
  assert(S.animal <= 1.2, '人物比一格大太多會蓋住隔壁格');
  assert(S.item < 1 && S.bomb <= 1, '道具與炸彈要比一格小，不然會跟牆重疊');
  for (const vp of VIEWPORTS) {
    const sm = R.sizeFor(2);
    const t = Renderer.tileCss(vp.availW, vp.availH, sm.w, sm.h), told = Renderer.tileCss(vp.availW, vp.availH, OLD.small.w, OLD.small.h);
    const animal = Math.round(t * S.animal), item = Math.round(t * S.item), bomb = Math.round(t * S.bomb);
    assert(Math.round(told * S.animal) <= animal, `${vp.name} 人物變小了`);
    assert(Math.round(told * S.item) <= item && Math.round(told * S.bomb) <= bomb, `${vp.name} 道具或炸彈沒有變大`);
    /* 手機也要看得清楚：4 人以下的小圖，人物至少 26px、道具至少 19px（舊版手機直放小圖人物約 27px） */
    assert(animal >= 26 && item >= 19, `${vp.name} 人物 ${animal}px／道具 ${item}px 太小`);
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
