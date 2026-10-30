/* ===== missions.js — 新手教學關卡（純邏輯，不碰 DOM，瀏覽器與測試共用） =====
 * 7 個由淺入深的單人關卡，沿用正式規則（rules.js）：每關 create() 蓋出一局特別擺好的小圖，
 * 再用 update(state, events) 每一格判斷進度、過關（done）或失敗（fail）。
 * 星星：過關至少 1 顆，依各關的表現（時間、用幾顆炸彈、撿了幾個道具）拿到 2、3 顆。前一關拿到星星才解鎖下一關。
 * 地圖座標：小圖 23×11（含外圈），內部 x 1～21、y 1～9；偶數／偶數格是硬牆柱，其他是空地。
 */
(function (root) {
  'use strict';
  const R = root.Rules || (typeof require !== 'undefined' ? require('./rules.js') : null);

  const PLAYER = 0, FOE = 1;
  const THEME = 6;      /* 教學用固定主題，畫面乾淨好辨認 */

  /** 一局的基底：空場地、四周圍牆、偶數／偶數格放硬牆柱；沒有隨機道具、詛咒與機關；計時從 0 往上數 */
  function arena(animal, foe, name) {
    const players = [{ slot: PLAYER, name: name || '', animal: animal || 'cat', kind: 'human' }];
    if (foe) players.push({ slot: FOE, name: foe.name || '', animal: foe.animal || 'bear', kind: 'ai', level: foe.level });
    const s = R.createGame({ seed: 7, players, layout: 'open', themeId: THEME, countdown: 2, timeLimit: 0, items: false, curses: false, fx: false });
    for (let y = 1; y < s.h - 1; y++) for (let x = 1; x < s.w - 1; x++) s.grid[y * s.w + x] = (x % 2 === 0 && y % 2 === 0) ? 1 : 0;
    s.fx.fill(0);
    s.itemsOn.length = 0;
    s.gridVer++;
    return s;
  }
  const put = (p, x, y) => { p.x = x + 0.5; p.y = y + 0.5; p.px = p.x; p.py = p.y; };
  const item = (s, x, y, type) => s.itemsOn.push({ id: s.nextId++, cx: x, cy: y, type, fresh: false });
  const brick = (s, x, y) => { s.grid[y * s.w + x] = 2; };
  const me = s => s.players.find(p => p.slot === PLAYER);
  const cellOf = p => [Math.floor(p.x), Math.floor(p.y)];
  const starsByTime = (t, three, two) => (t <= three ? 3 : t <= two ? 2 : 1);
  const starsByCount = (n, three, two) => (n <= three ? 3 : n <= two ? 2 : 1);

  /* 每關：id、key（字典 mission.<id>.*）、foe（電腦對手，沒有就 null）、setup、update。
     update 回傳 { status: 'play'|'win'|'fail', progress: { k, n, max }, reason?, stars? }；ctx 是每次開局重新建立的記錄 */
  const MISSIONS = [
    {
      id: 1, key: 'move',
      setup(s, ctx) {
        put(me(s), 1, 1);
        ctx.want = [[5, 3, 'fire'], [11, 5, 'bomb'], [17, 7, 'speed']];
        for (const [x, y, t] of ctx.want) item(s, x, y, t);
        ctx.got = 0;
      },
      update(s, evs, ctx) {
        for (const e of evs) if (e.t === 'item' && e.slot === PLAYER) ctx.got++;
        const prog = { k: 'items', n: ctx.got, max: ctx.want.length };
        if (ctx.got >= ctx.want.length) return { status: 'win', progress: prog, stars: starsByTime(s.time, 22, 40) };
        return { status: 'play', progress: prog };
      }
    },
    {
      id: 2, key: 'bricks',
      setup(s, ctx) {
        put(me(s), 1, 5);
        for (let y = 1; y <= 9; y++) brick(s, 11, y);       /* 一整排軟磚擋路，炸開任何一格就過得去 */
        item(s, 19, 5, 'fire');                              /* 終點：對面的道具 */
        ctx.placed = 0; ctx.goal = false;
      },
      update(s, evs, ctx) {
        for (const e of evs) { if (e.t === 'place' && e.slot === PLAYER) ctx.placed++; if (e.t === 'item' && e.slot === PLAYER && e.x === 19 && e.y === 5) ctx.goal = true; }
        let left = 0; for (let y = 1; y <= 9; y++) if (s.grid[y * s.w + 11] === 2) left++;
        const prog = { k: 'bricks', n: 9 - left, max: 9 };
        if (ctx.goal) return { status: 'win', progress: prog, stars: starsByCount(ctx.placed, 1, 3) };
        return { status: 'play', progress: prog };
      }
    },
    {
      id: 3, key: 'escape',
      setup(s, ctx) {
        put(me(s), 1, 1);
        me(s).fire = 2;          /* 火力 2：十字比較長，才需要真的躲 */
        ctx.cells = []; ctx.booms = 0;
      },
      update(s, evs, ctx) {
        for (const e of evs) {
          if (e.t === 'place' && e.slot === PLAYER) ctx.cells.push(e.x + ',' + e.y);
          if (e.t === 'boom' && ctx.cells.includes(e.x + ',' + e.y)) ctx.booms++;
        }
        const prog = { k: 'booms', n: Math.min(2, ctx.booms), max: 2 };
        if (!me(s).alive) return { status: 'fail', reason: 'dead', progress: prog };
        if (ctx.booms >= 2) return { status: 'win', progress: prog, stars: starsByTime(s.time, 16, 28) };
        return { status: 'play', progress: prog };
      }
    },
    {
      id: 4, key: 'duel', foe: { animal: 'bear', level: 'toddler' },
      setup(s, ctx) {
        put(me(s), 1, 1); put(s.players[1], 21, 9);
        me(s).fire = 2; me(s).maxBombs = 2;
        for (let y = 1; y <= 9; y++) for (let x = 1; x <= 21; x++) {
          if (s.grid[y * s.w + x] !== 0 || x + y <= 4 || x + y >= 26) continue;      /* 兩個出生角落周圍留空 */
          if ((x * 3 + y * 5) % 7 === 0) brick(s, x, y);
        }
        ctx.limit = 100;
      },
      update(s, evs, ctx) {
        const foe = s.players.find(p => p.slot === FOE);
        const prog = { k: 'foe', n: foe.alive ? 0 : 1, max: 1 };
        if (!me(s).alive) return { status: 'fail', reason: 'dead', progress: prog };
        if (!foe.alive) return { status: 'win', progress: prog, stars: starsByTime(s.time, 35, 65) };
        if (s.time >= ctx.limit) return { status: 'fail', reason: 'time', progress: prog };
        return { status: 'play', progress: prog };
      }
    },
    {
      id: 5, key: 'kick',
      setup(s, ctx) {
        put(me(s), 1, 5);
        item(s, 5, 5, 'kick'); item(s, 9, 5, 'shield');
        ctx.kick = false; ctx.shield = false; ctx.kicked = false;
      },
      update(s, evs, ctx) {
        for (const e of evs) {
          if (e.t === 'item' && e.slot === PLAYER) { if (e.type === 'kick') ctx.kick = true; if (e.type === 'shield') ctx.shield = true; }
          if (e.t === 'kick') ctx.kicked = true;
        }
        const n = (ctx.kick ? 1 : 0) + (ctx.shield ? 1 : 0) + (ctx.kicked ? 1 : 0);
        const prog = { k: 'kick', n, max: 3 };
        if (!me(s).alive) return { status: 'fail', reason: 'dead', progress: prog };
        if (n >= 3) return { status: 'win', progress: prog, stars: starsByTime(s.time, 25, 45) };
        return { status: 'play', progress: prog };
      }
    },
    {
      id: 6, key: 'terrain',
      setup(s, ctx) {
        put(me(s), 1, 5);
        const W = s.w, at = (x, y) => y * W + x;
        s.fx[at(5, 5)] = R.FX_SLOW;                          /* 緩速格 */
        s.fx[at(17, 5)] = R.FX_GRASS;                        /* 草叢 */
        /* 輸送帶：繞著 (12,4) 那根硬牆柱的一圈（上、下、左、右各一個方向碼） */
        const ring = [[11, 3, 3], [12, 3, 3], [13, 3, 1], [13, 4, 1], [13, 5, 2], [12, 5, 2], [11, 5, 0], [11, 4, 0]];
        for (const [x, y, d] of ring) s.fx[at(x, y)] = R.FX_BELT + d;
        ctx.seen = { slow: false, belt: false, grass: false };
      },
      update(s, evs, ctx) {
        const [cx, cy] = cellOf(me(s)), v = s.fx[cy * s.w + cx];
        if (v === R.FX_SLOW) ctx.seen.slow = true;
        else if (R.isBelt(v)) ctx.seen.belt = true;
        else if (v === R.FX_GRASS) ctx.seen.grass = true;
        const n = (ctx.seen.slow ? 1 : 0) + (ctx.seen.belt ? 1 : 0) + (ctx.seen.grass ? 1 : 0);
        const prog = { k: 'terrain', n, max: 3 };
        if (n >= 3) return { status: 'win', progress: prog, stars: starsByTime(s.time, 25, 45) };
        return { status: 'play', progress: prog };
      }
    },
    {
      id: 7, key: 'sky',
      setup(s, ctx) {
        put(me(s), 11, 5);
        s.skyStart = 2; s.skyAt = 2;                          /* 開局 2 秒就開始空襲，不用等 2 分半 */
        item(s, 3, 3, 'shield'); item(s, 19, 7, 'shield'); item(s, 3, 9, 'speed');
        ctx.bonus = 0; ctx.target = 30;
      },
      update(s, evs, ctx) {
        for (const e of evs) if (e.t === 'item' && e.slot === PLAYER) ctx.bonus++;
        const prog = { k: 'survive', n: Math.min(ctx.target, Math.floor(s.time)), max: ctx.target };
        if (!me(s).alive) return { status: 'fail', reason: 'dead', progress: prog };
        if (s.time >= ctx.target) return { status: 'win', progress: prog, stars: Math.min(3, 1 + ctx.bonus) };
        return { status: 'play', progress: prog };
      }
    }
  ];

  /** 開一局教學：回傳 { id, state, brains, ctx, update(state, events) } 給 GameScreen 與 App 使用 */
  function create(id, o) {
    o = o || {};
    const def = MISSIONS.find(m => m.id === id);
    if (!def) return null;
    const s = arena(o.animal, def.foe && Object.assign({ name: o.foeName }, def.foe), o.name);
    const ctx = {};
    def.setup(s, ctx);
    const brains = {};
    if (def.foe && o.AI) brains[FOE] = o.AI.createBrain(def.foe.level, 4242);
    s.players.forEach(p => { p.rx = p.x; p.ry = p.y; p.px = p.x; p.py = p.y; });
    return { id, key: def.key, state: s, brains, ctx, update: (st, evs) => def.update(st, evs, ctx), def };
  }

  /** 前一關拿到星星才解鎖下一關；stars 是 { [id]: 0～3 } */
  function unlocked(id, stars) { return id <= 1 || ((stars || {})[id - 1] | 0) > 0; }

  root.Missions = { MISSIONS, create, unlocked, PLAYER, FOE };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Missions;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
