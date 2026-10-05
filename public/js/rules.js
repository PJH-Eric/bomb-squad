/* ===== rules.js — 炸彈小隊規則核心（純邏輯，瀏覽器與伺服器共用） =====
 *
 * 單機、電腦對手、線上伺服器都用這一份規則，不另寫會互相漂移的版本。
 * 全部以「格」為單位：格 (cx, cy) 涵蓋 [cx, cx+1) × [cy, cy+1)，玩家座標是中心點。
 * 隨機一律走可注入的種子亂數（mulberry32），同一個 seed 會得到同一張地圖與同一串掉寶。
 *
 *   createGame(opts)        建立一局
 *   step(state, inputs, dt) 推進一個固定步長（建議 1/60 秒）
 *   snapshot / decode       線上對局的壓縮快照
 */
(function (root) {
  'use strict';

  /* ---------- 常數 ---------- */
  const DT = 1 / 60;
  const DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
  const FUSE = 3;              /* 炸彈引爆秒數 */
  const AIR_EVERY = 45;        /* 每隔幾秒飛來一架空投機 */
  const PLANE_SPEED = 5;       /* 空投機飛行速度（格／秒） */
  const FLAME_COOL_T = 0.3;    /* 磚塊格的無殺傷火花停留秒數 */
  const FLAME_T = 0.5;         /* 火焰停留秒數 */
  const HIT_INSET = 0.1;       /* 火焰判定：人物中心要深入格子才算被炸（離格線 0.1 內算擦邊，安全） */
  const HALF = 0.36;           /* 玩家碰撞半寬（比格子小，轉角才好過） */
  const START = { fire: 2, bomb: 1 };
  const MAX = { fire: 8, bomb: 6, speed: 5 };
  const SPEED = { base: 3.2, step: 0.5, slow: 1.7 };
  const CURSE_T = 8;           /* 負面道具持續秒數 */
  const SHIELD_T = 1.2;        /* 護盾破掉後的無敵秒數 */
  const COUNTDOWN = 3;
  const SLIDE_SPEED = 7;       /* 被踢的炸彈滑行格/秒 */
  const AUTO_BOMB_EVERY = 0.7; /* 手滑詛咒：自動放炸彈的間隔 */
  const END_HOLD = 2.2;        /* 分出勝負後，畫面多跑幾秒讓爆炸演完 */

  const ITEM_TYPES = ['fire', 'bomb', 'speed', 'kick', 'shield', 'c_slow', 'c_auto', 'c_short'];
  const POSITIVE = ['fire', 'bomb', 'speed', 'kick', 'shield'];
  const CURSES = ['c_slow', 'c_auto', 'c_short'];
  const DROP_WEIGHTS = { fire: 24, bomb: 24, speed: 18, kick: 7, shield: 7, c_slow: 6, c_auto: 6, c_short: 6 };
  const ITEM_RATE = 0.4;       /* 軟磚被炸掉時掉寶機率 */

  const LAYOUTS = ['classic', 'open', 'dense', 'fab'];
  const RANDOM_LAYOUTS = ['classic', 'open', 'dense'];
  const FAB_THEME = 7;          /* 日月光廠房主題：隨機版型時固定用「產線」版型 */
  const LAYOUT_NAMES = { classic: '經典', open: '空曠', dense: '密集', fab: '產線' };
  const THEME_COUNT = 8;
  const SHAPES = ['circle', 'triangle', 'square', 'diamond', 'star', 'cross', 'heart', 'moon'];
  const SLOT_COLORS = ['#4aa8ff', '#ff6b6b', '#ffc83d', '#4cd08a', '#b47cff', '#ff8fc7', '#ff9a3c', '#3ed6d6'];

  /* ---------- 種子亂數 ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** 對局中的亂數：狀態存在 state.rng，快照/重播都能重現 */
  function rand(state) {
    state.rng = (state.rng + 0x6D2B79F5) | 0;
    let t = Math.imul(state.rng ^ (state.rng >>> 15), 1 | state.rng);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /* ---------- 地圖 ---------- */
  function sizeFor(count) { return count <= 4 ? { w: 15, h: 13 } : { w: 17, h: 15 }; }

  function spawnPoints(w, h) {
    const mx = (w - 1) / 2, my = (h - 1) / 2;
    return [[1, 1], [w - 2, h - 2], [w - 2, 1], [1, h - 2], [mx, 1], [mx, h - 2], [1, my], [w - 2, my]];
  }

  function connected(grid, w, h) {
    let start = -1, free = 0;
    for (let i = 0; i < grid.length; i++) if (grid[i] !== 1) { free++; if (start < 0) start = i; }
    if (start < 0) return true;
    const seen = new Uint8Array(grid.length);
    const stack = [start]; seen[start] = 1;
    let n = 0;
    while (stack.length) {
      const i = stack.pop(); n++;
      const x = i % w, y = (i / w) | 0;
      const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [a, b] of nb) {
        if (a < 0 || b < 0 || a >= w || b >= h) continue;
        const j = b * w + a;
        if (!seen[j] && grid[j] !== 1) { seen[j] = 1; stack.push(j); }
      }
    }
    return n === free;
  }

  /**
   * 產生地圖：左上四分之一隨機，再左右上下鏡射，所以每個出生點的處境都一樣公平。
   * layout：classic 經典立柱／open 空曠（立柱減半）／dense 密集（多一些隨機硬牆，保證全連通）
   */
  function generateMap(seed, w, h, layout, density) {
    const rnd = mulberry32(seed >>> 0);
    const grid = new Array(w * h).fill(0);
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    const at = (x, y) => y * w + x;
    const set4 = (x, y, v) => {
      grid[at(x, y)] = v; grid[at(w - 1 - x, y)] = v;
      grid[at(x, h - 1 - y)] = v; grid[at(w - 1 - x, h - 1 - y)] = v;
    };
    for (let x = 0; x < w; x++) { grid[at(x, 0)] = 1; grid[at(x, h - 1)] = 1; }
    for (let y = 0; y < h; y++) { grid[at(0, y)] = 1; grid[at(w - 1, y)] = 1; }

    /* 出生點安全區：曼哈頓距離 3 以內不放軟磚（15×13 清四個角、17×15 清八個點，地圖才對稱） */
    const safe = new Uint8Array(w * h);
    for (const [sx, sy] of spawnPoints(w, h).slice(0, w <= 15 ? 4 : 8)) {
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (Math.abs(x - sx) + Math.abs(y - sy) <= 3) safe[at(x, y)] = 1;
      }
    }

    for (let y = 1; y <= cy; y++) for (let x = 1; x <= cx; x++) {
      if (layout === 'fab') {
        /* 產線（仿無塵室）：十字主走道貫穿全場；兩排 2 格寬的機台隔著一條維修走道，機台之間留直向走道；
           機台排從外往內是 [2,3]、[5,6]，主走道旁多留一格當緩衝 */
        const aisle = x === cx || y === cy;
        if (y % 2 === 0 && (x === 2 || x === 3 || x === 5 || x === 6) && !aisle) set4(x, y, 1);
      } else if (x % 2 === 0 && y % 2 === 0) {
        const k = (x / 2) + (y / 2);
        if (layout === 'open') { if (k % 3 === 0) set4(x, y, 1); }          /* 空曠：每 3 顆留 1 顆 */
        else if (layout === 'dense') set4(x, y, 1);
        else if (k % 3 !== 0) set4(x, y, 1);                                  /* 經典：硬牆比傳統少 1/3，多留些空間給軟磚 */
      }
    }
    if (layout === 'dense') {
      for (let y = 1; y <= cy; y++) for (let x = 1; x <= cx; x++) {
        if (grid[at(x, y)] !== 0 || safe[at(x, y)]) continue;
        if (rnd() < 0.06) {
          const keep = grid.slice();
          set4(x, y, 1);
          if (!connected(grid, w, h)) for (let i = 0; i < grid.length; i++) grid[i] = keep[i];
        }
      }
    }
    if (layout === 'fab' && !connected(grid, w, h)) { for (let i = 0; i < grid.length; i++) if (grid[i] === 1 && i % w !== 0 && i % w !== w - 1 && ((i / w) | 0) !== 0 && ((i / w) | 0) !== h - 1) grid[i] = 0; }
    const d = density == null ? (layout === 'fab' ? 0.82 : 0.88) : density;
    for (let y = 1; y <= cy; y++) for (let x = 1; x <= cx; x++) {
      if (grid[at(x, y)] !== 0 || safe[at(x, y)]) continue;
      if (rnd() < d) set4(x, y, 2);
    }
    return grid;
  }

  /* ---------- 建立一局 ---------- */
  /**
   * opts：{ seed, players:[{slot,name,animal,kind,level}], layout, themeId, timeLimit, items, curses, countdown }
   * layout 可填 'random'（由 seed 決定）；themeId 填 -1 也是隨機。
   */
  function createGame(opts) {
    const seed = (opts.seed == null ? 1 : opts.seed) >>> 0;
    const pick = mulberry32(seed ^ 0x9e3779b9);
    const count = opts.players.length;
    const { w, h } = sizeFor(count);
    let themeId = opts.themeId;
    if (themeId == null || themeId < 0) themeId = Math.floor(pick() * THEME_COUNT);
    let layout = opts.layout;
    if (!layout || layout === 'random') layout = themeId === FAB_THEME ? 'fab' : RANDOM_LAYOUTS[Math.floor(pick() * RANDOM_LAYOUTS.length)];
    const grid = generateMap(seed, w, h, layout, opts.density);
    /* 每局隨機分配出生點：只在「已清出安全區」的點之間洗牌，所以每個位置一樣公平；同一個 seed 洗出來一樣（連線雙方一致） */
    const spawns = spawnPoints(w, h).slice(0, w <= 15 ? 4 : 8);
    { const sr = mulberry32((seed ^ 0x51ed270b) >>> 0); for (let i = spawns.length - 1; i > 0; i--) { const j = Math.floor(sr() * (i + 1)); const t = spawns[i]; spawns[i] = spawns[j]; spawns[j] = t; } }
    const state = {
      seed, rng: (seed ^ 0xa5a5a5a5) | 0, w, h, grid, layout, themeId,
      phase: 'countdown', countdown: opts.countdown == null ? COUNTDOWN : opts.countdown,
      time: 0, timeLimit: opts.timeLimit == null ? 180 : opts.timeLimit,
      items: opts.items !== false, curses: opts.curses !== false,
      players: [], bombs: [], flames: [], itemsOn: [], events: [],
      nextId: 1, gridVer: 1, result: null, endHold: 0, airAt: AIR_EVERY, plane: null
    };
    opts.players.forEach((p, i) => {
      const [sx, sy] = spawns[i % spawns.length];
      state.players.push({
        slot: p.slot == null ? i : p.slot, idx: i, name: p.name || ('玩家' + (i + 1)), animal: p.animal || 'cat',
        kind: p.kind || 'human', level: p.level || null,
        x: sx + 0.5, y: sy + 0.5, dir: 'D', moving: false, alive: true,
        fire: START.fire, maxBombs: START.bomb, speedLvl: 0, kick: false, shield: false,
        curse: null, invuln: 0, bombsOut: 0, kills: 0, autoT: 0,
        diedAt: null, killer: null, cause: null, left: false
      });
    });
    return state;
  }

  /* ---------- 查詢輔助 ---------- */
  const cellIdx = (s, x, y) => y * s.w + x;
  const inside = (s, x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h;
  const cellOf = p => ({ x: Math.floor(p.x), y: Math.floor(p.y) });
  function speedOf(p) {
    if (p.curse && p.curse.type === 'c_slow') return SPEED.slow;
    return SPEED.base + SPEED.step * p.speedLvl;
  }
  function rangeOf(p) { return p.curse && p.curse.type === 'c_short' ? 1 : p.fire; }
  function maxBombsOf(p) { return p.maxBombs; }
  function bombAt(s, x, y) {
    for (const b of s.bombs) if (b.cx === x && b.cy === y) return b;
    return null;
  }
  function itemAt(s, x, y) {
    for (const it of s.itemsOn) if (it.cx === x && it.cy === y) return it;
    return null;
  }
  function flameAt(s, x, y) {
    for (const f of s.flames) if (f.cx === x && f.cy === y) return f;
    return null;
  }
  function overlapsCell(p, cx, cy) {
    return Math.abs(p.x - (cx + 0.5)) < 0.5 + HALF && Math.abs(p.y - (cy + 0.5)) < 0.5 + HALF;
  }
  const getPlayer = (s, slot) => s.players.find(p => p.slot === slot);
  const alivePlayers = s => s.players.filter(p => p.alive);

  /** 計算一顆炸彈的十字爆炸範圍（不改動任何狀態） */
  function blast(s, b) {
    const cells = [{ x: b.cx, y: b.cy }];
    const softs = [];
    const chain = [];
    for (const d of Object.values(DIRS)) {
      for (let i = 1; i <= b.range; i++) {
        const x = b.cx + d[0] * i, y = b.cy + d[1] * i;
        if (!inside(s, x, y)) break;
        const g = s.grid[cellIdx(s, x, y)];
        if (g === 1) break;
        cells.push({ x, y });
        if (g === 2) { softs.push({ x, y }); break; }
        const other = bombAt(s, x, y);
        if (other && other !== b) { chain.push(other); break; }
      }
    }
    return { cells, softs, chain };
  }

  /* ---------- 移動與碰撞 ---------- */
  function cellBlocked(s, x, y, p) {
    if (!inside(s, x, y)) return true;
    if (s.grid[cellIdx(s, x, y)] !== 0) return true;
    for (const b of s.bombs) {
      if (b.cx === x && b.cy === y && b.pass.indexOf(p.slot) < 0) return true;
    }
    return false;
  }
  function collides(s, p, nx, ny) {
    const x0 = Math.floor(nx - HALF), x1 = Math.floor(nx + HALF - 1e-9);
    const y0 = Math.floor(ny - HALF), y1 = Math.floor(ny + HALF - 1e-9);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (cellBlocked(s, x, y, p)) return true;
    return false;
  }
  function blockingBomb(s, p, nx, ny) {
    const x0 = Math.floor(nx - HALF), x1 = Math.floor(nx + HALF - 1e-9);
    const y0 = Math.floor(ny - HALF), y1 = Math.floor(ny + HALF - 1e-9);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const b = bombAt(s, x, y);
      if (b && b.pass.indexOf(p.slot) < 0) return b;
    }
    return null;
  }
  function slideFree(s, x, y) {
    if (!inside(s, x, y) || s.grid[cellIdx(s, x, y)] !== 0 || bombAt(s, x, y)) return false;
    for (const q of s.players) if (q.alive && overlapsCell(q, x, y)) return false;
    return true;
  }

  function movePlayer(s, p, dir, dt) {
    if (!dir || !DIRS[dir]) { p.moving = false; return; }
    p.dir = dir;
    const [dx, dy] = DIRS[dir];
    const dist = speedOf(p) * dt;
    const nx = p.x + dx * dist, ny = p.y + dy * dist;
    if (!collides(s, p, nx, ny)) { p.x = nx; p.y = ny; p.moving = true; return; }

    /* 擋住了：先看是不是炸彈、有踢炸彈能力就踢 */
    const b = blockingBomb(s, p, nx, ny);
    if (b && p.kick && !b.sl) {
      const laneOff = dx !== 0 ? Math.abs(p.y - (b.cy + 0.5)) : Math.abs(p.x - (b.cx + 0.5));
      if (laneOff < 0.3 && slideFree(s, b.cx + dx, b.cy + dy)) {
        b.cx += dx; b.cy += dy; b.sl = { dx, dy, prog: 0 };
        s.events.push({ t: 'kick', x: b.cx, y: b.cy });
      }
    }
    /* 轉角輔助：偏離車道中心就往中心滑，才鑽得進一格寬的通道 */
    let moved = false;
    if (dx !== 0) {
      const lane = Math.round(p.y - 0.5) + 0.5, off = lane - p.y;
      if (Math.abs(off) > 1e-4 && !collides(s, p, p.x + dx * dist, lane)) {
        const st = Math.sign(off) * Math.min(Math.abs(off), dist);
        if (!collides(s, p, p.x, p.y + st)) { p.y += st; moved = true; }
      }
    } else {
      const lane = Math.round(p.x - 0.5) + 0.5, off = lane - p.x;
      if (Math.abs(off) > 1e-4 && !collides(s, p, lane, p.y + dy * dist)) {
        const st = Math.sign(off) * Math.min(Math.abs(off), dist);
        if (!collides(s, p, p.x + st, p.y)) { p.x += st; moved = true; }
      }
    }
    p.moving = moved;
  }

  /* ---------- 放炸彈 ---------- */
  function canPlaceBomb(s, p) {
    if (!p.alive || p.bombsOut >= maxBombsOf(p)) return false;
    const c = cellOf(p);
    if (!inside(s, c.x, c.y) || s.grid[cellIdx(s, c.x, c.y)] !== 0) return false;
    return !bombAt(s, c.x, c.y);
  }
  function placeBomb(s, p) {
    if (!canPlaceBomb(s, p)) return null;
    const c = cellOf(p);
    const pass = [];
    for (const q of s.players) if (q.alive && overlapsCell(q, c.x, c.y)) pass.push(q.slot);
    const b = { id: s.nextId++, owner: p.slot, cx: c.x, cy: c.y, t: FUSE, range: rangeOf(p), pass, sl: null };
    s.bombs.push(b);
    p.bombsOut++;
    s.events.push({ t: 'place', x: b.cx, y: b.cy, slot: p.slot });
    return b;
  }

  /* ---------- 爆炸與傷害 ---------- */
  function rollDrop(s) {
    if (!s.items) return null;
    if (rand(s) >= ITEM_RATE) return null;
    const pool = Object.keys(DROP_WEIGHTS).filter(k => s.curses || CURSES.indexOf(k) < 0);
    let total = 0;
    for (const k of pool) total += DROP_WEIGHTS[k];
    let r = rand(s) * total;
    for (const k of pool) { r -= DROP_WEIGHTS[k]; if (r < 0) return k; }
    return pool[0];
  }

  /** 空投：從正向道具裡依權重抽一種（不受掉寶率影響，空投一定有東西） */
  function pickAirItem(s) {
    const pool = Object.keys(DROP_WEIGHTS).filter(k => POSITIVE.indexOf(k) >= 0);
    let total = 0; for (const k of pool) total += DROP_WEIGHTS[k];
    let r = rand(s) * total;
    for (const k of pool) { r -= DROP_WEIGHTS[k]; if (r < 0) return k; }
    return pool[0];
  }
  function airFreeCell(s, x, y) {
    return inside(s, x, y) && s.grid[cellIdx(s, x, y)] === 0 && !bombAt(s, x, y) && !itemAt(s, x, y) && !flameAt(s, x, y);
  }
  /** 空投機起飛：沿隨機一列橫越地圖，道具就投在飛過的那一列（1～2 個） */
  function launchPlane(s) {
    const dir = rand(s) < 0.5 ? 1 : -1;
    /* 只挑還有空位的列，空投才一定掉得下來 */
    const rows = [];
    for (let y = 1; y < s.h - 1; y++) {
      const free = [];
      for (let x = 1; x < s.w - 1; x++) if (airFreeCell(s, x, y)) free.push(x);
      if (free.length) rows.push({ y, free });
    }
    if (!rows.length) return;
    const pick = rows[Math.floor(rand(s) * rows.length)], row = pick.y;
    const n = Math.min(pick.free.length, rand(s) < 0.5 ? 1 : 2);
    const drops = [];
    for (let k = 0; k < n; k++) {
      const x = pick.free.splice(Math.floor(rand(s) * pick.free.length), 1)[0];
      drops.push({ cx: x, cy: row, type: pickAirItem(s) });
    }
    drops.sort((a, b) => dir * (a.cx - b.cx));
    s.plane = { x: dir > 0 ? -2 : s.w + 2, row, dir, drops };
    s.events.push({ t: 'plane', row, dir });
  }
  function stepPlane(s, dt) {
    if (s.phase !== 'play') return;
    if (!s.plane && s.items && s.time >= s.airAt) { s.airAt += AIR_EVERY; launchPlane(s); }
    const pl = s.plane;
    if (!pl) return;
    pl.x += pl.dir * PLANE_SPEED * dt;
    while (pl.drops.length && (pl.dir > 0 ? pl.x >= pl.drops[0].cx + 0.5 : pl.x <= pl.drops[0].cx + 0.5)) {
      const d = pl.drops.shift();
      if (airFreeCell(s, d.cx, d.cy)) {
        s.itemsOn.push({ id: s.nextId++, cx: d.cx, cy: d.cy, type: d.type, fresh: true });
        s.events.push({ t: 'airdrop', x: d.cx, y: d.cy, type: d.type });
      }
    }
    if (pl.dir > 0 ? pl.x > s.w + 2 : pl.x < -2) s.plane = null;
  }

  function explodeAll(s) {
    const queue = s.bombs.filter(b => b.t <= 0);
    const exploded = new Set();
    const drops = [];
    while (queue.length) {
      const b = queue.pop();
      if (exploded.has(b)) continue;
      exploded.add(b);
      const r = blast(s, b);
      for (const c of r.cells) {
        const f = flameAt(s, c.x, c.y);
        /* 磚塊被炸掉的那一格只有視覺火花（無殺傷）：磚塊一消失就走進去不該被燒到 */
        const cool = r.softs.some(q => q.x === c.x && q.y === c.y);
        if (f) { if (!cool) { f.t = FLAME_T; f.cool = false; } f.owner = b.owner; }
        else s.flames.push({ cx: c.x, cy: c.y, t: cool ? FLAME_COOL_T : FLAME_T, owner: b.owner, cool });
        const it = itemAt(s, c.x, c.y);
        if (it && !it.fresh) { s.itemsOn.splice(s.itemsOn.indexOf(it), 1); s.events.push({ t: 'itemgone', x: c.x, y: c.y }); }
      }
      for (const sc of r.softs) {
        const i = cellIdx(s, sc.x, sc.y);
        if (s.grid[i] === 2) {
          s.grid[i] = 0; s.gridVer++;
          s.events.push({ t: 'brk', x: sc.x, y: sc.y });
          const d = rollDrop(s);
          if (d) drops.push({ x: sc.x, y: sc.y, type: d });
        }
      }
      for (const o of r.chain) if (!exploded.has(o)) { o.t = 0; queue.push(o); }
      s.events.push({ t: 'boom', x: b.cx, y: b.cy, range: b.range });
      const owner = getPlayer(s, b.owner);
      if (owner) owner.bombsOut = Math.max(0, owner.bombsOut - 1);
    }
    if (exploded.size) s.bombs = s.bombs.filter(b => !exploded.has(b));
    for (const d of drops) s.itemsOn.push({ id: s.nextId++, cx: d.x, cy: d.y, type: d.type, fresh: true });
  }

  function hurt(s, p, ownerSlot) {
    if (!p.alive || p.invuln > 0 || s.phase === 'over' && s.result) return;
    if (p.shield) {
      p.shield = false; p.invuln = SHIELD_T;
      s.events.push({ t: 'shield', slot: p.slot });
      return;
    }
    p.alive = false; p.diedAt = s.time; p.killer = ownerSlot; p.moving = false;
    p.cause = ownerSlot === p.slot ? 'self' : 'flame';
    if (ownerSlot != null && ownerSlot !== p.slot) {
      const k = getPlayer(s, ownerSlot);
      if (k) k.kills++;
    }
    s.events.push({ t: 'die', slot: p.slot, x: p.x, y: p.y, by: ownerSlot });
    scatterItems(s, p);
  }

  /** 淘汰時，把身上一半的強化道具噴到附近的空格 */
  function scatterItems(s, p) {
    const owned = [];
    for (let i = 0; i < p.fire - START.fire; i++) owned.push('fire');
    for (let i = 0; i < p.maxBombs - START.bomb; i++) owned.push('bomb');
    for (let i = 0; i < p.speedLvl; i++) owned.push('speed');
    if (p.kick) owned.push('kick');
    if (p.shield) owned.push('shield');
    for (let i = owned.length - 1; i > 0; i--) {
      const j = Math.floor(rand(s) * (i + 1));
      [owned[i], owned[j]] = [owned[j], owned[i]];
    }
    const give = owned.slice(0, Math.floor(owned.length / 2));
    if (!give.length) return;
    const c = cellOf(p);
    const seen = new Set([cellIdx(s, c.x, c.y)]);
    const q = [[c.x, c.y]];
    const spots = [];
    while (q.length && spots.length < give.length) {
      const [x, y] = q.shift();
      if (s.grid[cellIdx(s, x, y)] === 0 && !itemAt(s, x, y) && !bombAt(s, x, y)) spots.push([x, y]);
      for (const d of Object.values(DIRS)) {
        const nx = x + d[0], ny = y + d[1];
        if (!inside(s, nx, ny)) continue;
        const k = cellIdx(s, nx, ny);
        if (seen.has(k) || s.grid[k] === 1) continue;
        seen.add(k);
        q.push([nx, ny]);
      }
    }
    give.forEach((type, i) => {
      if (spots[i]) s.itemsOn.push({ id: s.nextId++, cx: spots[i][0], cy: spots[i][1], type, fresh: true });
    });
  }

  function pickup(s, p) {
    const c = cellOf(p);
    const it = itemAt(s, c.x, c.y);
    if (!it) return;
    s.itemsOn.splice(s.itemsOn.indexOf(it), 1);
    switch (it.type) {
      case 'fire': p.fire = Math.min(MAX.fire, p.fire + 1); break;
      case 'bomb': p.maxBombs = Math.min(MAX.bomb, p.maxBombs + 1); break;
      case 'speed': p.speedLvl = Math.min(MAX.speed, p.speedLvl + 1); break;
      case 'kick': p.kick = true; break;
      case 'shield': p.shield = true; break;
      default: p.curse = { type: it.type, t: CURSE_T }; p.autoT = 0;
    }
    s.events.push({ t: 'item', slot: p.slot, type: it.type, x: it.cx, y: it.cy });
  }

  /* ---------- 結算 ---------- */
  function finish(s, reason) {
    const alive = alivePlayers(s);
    let winner = null;
    if (reason === 'time') {
      let best = -1, tops = [];
      for (const p of alive) {
        if (p.kills > best) { best = p.kills; tops = [p]; } else if (p.kills === best) tops.push(p);
      }
      if (tops.length === 1) winner = tops[0].slot;
    } else if (alive.length === 1) winner = alive[0].slot;
    const rank = s.players.slice().sort((a, b) => {
      if (winner != null) { if (a.slot === winner) return -1; if (b.slot === winner) return 1; }
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      if (a.alive && b.alive) return b.kills - a.kills;
      return (b.diedAt || 0) - (a.diedAt || 0);
    });
    s.result = {
      reason: winner == null ? 'draw' : reason, winner,
      ranking: rank.map(p => p.slot), kills: s.players.map(p => [p.slot, p.kills]),
      time: s.time, timeout: reason === 'time'
    };
    s.phase = 'over';
    s.endHold = END_HOLD;
    s.events.push({ t: 'over', winner });
  }

  /** 玩家中途離場（斷線逾時、被踢）：直接淘汰，道具噴出去 */
  function removePlayer(s, slot) {
    const p = getPlayer(s, slot);
    if (!p || !p.alive) return;
    p.left = true; p.alive = false; p.diedAt = s.time; p.cause = 'left'; p.moving = false;
    scatterItems(s, p);
    s.events.push({ t: 'left', slot });
    if (s.phase === 'play' && alivePlayers(s).length <= 1) finish(s, 'last');
  }

  /* ---------- 主迴圈 ---------- */
  /**
   * inputs：{ [slot]: { dir: 'U'|'D'|'L'|'R'|null, dir2?: 同上, bomb: boolean } }；bomb 是「按下」的邊緣訊號，步進時會被消耗。
   * dir2 是「還按著的另一個方向」：dir 被擋住走不動時改走 dir2，提早按轉彎也會沿原方向走到路口再轉。
   */
  function step(s, inputs, dt) {
    dt = dt || DT;
    s.events.length = 0;

    if (s.phase === 'countdown') {
      const before = Math.ceil(s.countdown);
      s.countdown -= dt;
      const after = Math.ceil(Math.max(0, s.countdown));
      if (after !== before && after > 0) s.events.push({ t: 'count', n: after });
      if (s.countdown <= 0) { s.phase = 'play'; s.countdown = 0; s.events.push({ t: 'go' }); }
      for (const k in inputs) if (inputs[k]) inputs[k].bomb = false;
      return s;
    }
    if (s.phase === 'over') {
      s.endHold -= dt;
      for (const k in inputs) if (inputs[k]) inputs[k].bomb = false;
    } else {
      s.time += dt;
    }

    const playing = s.phase === 'play';
    for (const p of s.players) {
      if (!p.alive) continue;
      const inp = (playing && inputs[p.slot]) || null;
      if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
      if (p.curse) { p.curse.t -= dt; if (p.curse.t <= 0) p.curse = null; }
      movePlayer(s, p, inp ? inp.dir : null, dt);
      if (inp && inp.dir2 && inp.dir2 !== inp.dir && !p.moving) movePlayer(s, p, inp.dir2, dt);
      if (inp && inp.bomb) { placeBomb(s, p); }
      if (inp) inp.bomb = false;
      if (playing && p.curse && p.curse.type === 'c_auto') {
        p.autoT -= dt;
        if (p.autoT <= 0) { p.autoT = AUTO_BOMB_EVERY; placeBomb(s, p); }
      }
      pickup(s, p);
    }

    /* 炸彈：倒數、滑行、玩家離開後變實心 */
    for (const b of s.bombs) {
      b.t -= dt;
      if (b.pass.length) b.pass = b.pass.filter(sl => { const q = getPlayer(s, sl); return q && q.alive && overlapsCell(q, b.cx, b.cy); });
      if (b.sl) {
        b.sl.prog += SLIDE_SPEED * dt;
        while (b.sl && b.sl.prog >= 1) {
          b.sl.prog -= 1;
          const nx = b.cx + b.sl.dx, ny = b.cy + b.sl.dy;
          if (slideFree(s, nx, ny)) { b.cx = nx; b.cy = ny; } else { b.sl = null; }
        }
      }
    }
    explodeAll(s);

    /* 火焰 */
    for (const f of s.flames) f.t -= dt;
    s.flames = s.flames.filter(f => f.t > 0);
    for (const it of s.itemsOn) it.fresh = false;
    stepPlane(s, dt);
    if (s.phase !== 'over') {
      for (const p of s.players) {
        if (!p.alive) continue;
        const c = cellOf(p);
        if (Math.abs(p.x - (c.x + 0.5)) > 0.5 - HIT_INSET || Math.abs(p.y - (c.y + 0.5)) > 0.5 - HIT_INSET) continue;
        const f = flameAt(s, c.x, c.y);
        if (f && !f.cool) hurt(s, p, f.owner);
      }
    }

    if (s.phase === 'over') s.plane = null;
    if (s.phase === 'play') {
      const alive = alivePlayers(s);
      if (s.players.length >= 2 && alive.length <= 1) finish(s, 'last');
      else if (s.timeLimit > 0 && s.time >= s.timeLimit) finish(s, 'time');
    }
    return s;
  }

  /* ---------- 線上快照 ---------- */
  const CURSE_CODE = { c_slow: 1, c_auto: 2, c_short: 3 };
  const CURSE_NAME = [null, 'c_slow', 'c_auto', 'c_short'];
  const TYPE_CODE = {}; ITEM_TYPES.forEach((t, i) => { TYPE_CODE[t] = i; });
  const r2 = n => Math.round(n * 100);

  function gridString(s) { return s.grid.join(''); }

  /** 把一局壓成可以丟過網路的小物件；includeGrid 只有地圖變動時才帶 */
  function snapshot(s, includeGrid) {
    const snap = {
      ph: s.phase, cd: Math.round(s.countdown * 10), tm: Math.round(s.time * 10),
      p: s.players.map(p => [
        p.slot, r2(p.x), r2(p.y), p.dir, (p.alive ? 1 : 0) | (p.moving ? 2 : 0) | (p.shield ? 4 : 0) | (p.left ? 8 : 0),
        p.fire, p.maxBombs, p.speedLvl, p.kick ? 1 : 0,
        p.curse ? CURSE_CODE[p.curse.type] : 0, p.curse ? Math.round(p.curse.t * 10) : 0,
        p.kills, Math.round(p.invuln * 10), p.bombsOut
      ]),
      b: s.bombs.map(b => [b.id, b.cx, b.cy, r2(b.t), b.owner, b.sl ? b.sl.dx : 0, b.sl ? b.sl.dy : 0, b.sl ? r2(b.sl.prog) : 0, b.range]),
      f: s.flames.map(f => [f.cx, f.cy, r2(f.t)]),
      i: s.itemsOn.map(i => [i.id, i.cx, i.cy, TYPE_CODE[i.type]]),
      pl: s.plane ? [r2(s.plane.x), s.plane.row, s.plane.dir] : 0,
      e: s.events.slice(),
      r: s.result
    };
    if (includeGrid) snap.g = gridString(s);
    return snap;
  }

  /** 靜態資料（開局時送一次）：地圖尺寸、玩家名單、規則設定 */
  function startInfo(s) {
    return {
      seed: s.seed, w: s.w, h: s.h, layout: s.layout, themeId: s.themeId, timeLimit: s.timeLimit,
      items: s.items, curses: s.curses,
      players: s.players.map(p => ({ slot: p.slot, name: p.name, animal: p.animal, kind: p.kind, level: p.level })),
      g: gridString(s)
    };
  }

  /** 客戶端：用開局資料建立可繪製的狀態 */
  function viewFromStart(info) {
    return {
      seed: info.seed, w: info.w, h: info.h, layout: info.layout, themeId: info.themeId, timeLimit: info.timeLimit,
      items: info.items, curses: info.curses,
      grid: info.g.split('').map(Number), gridVer: 1,
      phase: 'countdown', countdown: COUNTDOWN, time: 0, result: null,
      players: info.players.map((p, i) => Object.assign({
        idx: i, x: 0, y: 0, dir: 'D', moving: false, alive: true, shield: false, left: false,
        fire: START.fire, maxBombs: START.bomb, speedLvl: 0, kick: false, curse: null, invuln: 0, kills: 0, bombsOut: 0
      }, p)),
      bombs: [], flames: [], itemsOn: [], events: [], plane: null
    };
  }

  /** 客戶端：把快照套到可繪製狀態上 */
  function applySnapshot(v, snap) {
    v.phase = snap.ph; v.countdown = snap.cd / 10; v.time = snap.tm / 10; v.result = snap.r || null;
    if (snap.g) { v.grid = snap.g.split('').map(Number); v.gridVer++; }
    for (const a of snap.p) {
      const p = v.players.find(q => q.slot === a[0]);
      if (!p) continue;
      p.x = a[1] / 100; p.y = a[2] / 100; p.dir = a[3];
      p.alive = !!(a[4] & 1); p.moving = !!(a[4] & 2); p.shield = !!(a[4] & 4); p.left = !!(a[4] & 8);
      p.fire = a[5]; p.maxBombs = a[6]; p.speedLvl = a[7]; p.kick = !!a[8];
      p.curse = a[9] ? { type: CURSE_NAME[a[9]], t: a[10] / 10 } : null;
      p.kills = a[11]; p.invuln = a[12] / 10; p.bombsOut = a[13];
    }
    v.bombs = snap.b.map(a => ({
      id: a[0], cx: a[1], cy: a[2], t: a[3] / 100, owner: a[4],
      sl: a[5] || a[6] ? { dx: a[5], dy: a[6], prog: a[7] / 100 } : null, range: a[8]
    }));
    v.flames = snap.f.map(a => ({ cx: a[0], cy: a[1], t: a[2] / 100 }));
    v.itemsOn = snap.i.map(a => ({ id: a[0], cx: a[1], cy: a[2], type: ITEM_TYPES[a[3]] }));
    v.plane = snap.pl ? { x: snap.pl[0], row: snap.pl[1], dir: snap.pl[2] } : null;
    v.events = snap.e || [];
    return v;
  }

  root.Rules = {
    DT, DIRS, FUSE, AIR_EVERY, PLANE_SPEED, FLAME_T, HALF, HIT_INSET, START, MAX, SPEED, CURSE_T, COUNTDOWN, SLIDE_SPEED,
    ITEM_TYPES, POSITIVE, CURSES, LAYOUTS, RANDOM_LAYOUTS, FAB_THEME, LAYOUT_NAMES, THEME_COUNT, SHAPES, SLOT_COLORS, DROP_WEIGHTS,
    mulberry32, rand, sizeFor, spawnPoints, generateMap, connected, createGame, step,
    blast, bombAt, itemAt, flameAt, cellOf, cellIdx, inside, speedOf, rangeOf, maxBombsOf,
    canPlaceBomb, placeBomb, overlapsCell, movePlayer, slideFree, getPlayer, alivePlayers, collides, removePlayer, finish,
    snapshot, startInfo, viewFromStart, applySnapshot, gridString
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Rules;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
