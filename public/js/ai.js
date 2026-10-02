/* ===== ai.js — 電腦對手（四段難度，瀏覽器與伺服器共用） =====
 *
 * 電腦跟真人走同一套輸入：每個 tick 只輸出 { dir, bomb }，不偷改狀態。
 * 難度差異都能從行為看出來，不是只換名字：
 *   幼幼班  反應慢、常常發呆亂走、不追人、不知道連鎖爆炸、放炸彈偶爾忘了逃
 *   簡單    會逃、會炸磚、偶爾追人，但看不出連鎖爆炸，也不太撿道具
 *   普通    看得出連鎖爆炸、會撿遠一點的道具、會追近處的對手
 *   困難    決策最快、會算對手逃不逃得掉、積極搶道具、避開詛咒、優先壓制對手
 */
(function (root) {
  'use strict';
  const R = root.Rules || (typeof require !== 'undefined' ? require('./rules.js') : null);

  const LEVEL_ORDER = ['toddler', 'easy', 'normal', 'hard'];
  const LEVELS = {
    toddler: { name: '幼幼班', interval: 0.55, bombProb: 0.3, hunt: 0, chain: false, react: 0.5, itemRange: 3, itemProb: 0.4, wander: 0.5, sloppy: 0.4, curseOk: true },
    easy:    { name: '簡單',   interval: 0.3,  bombProb: 0.6, hunt: 0.3, chain: false, react: 0.9, itemRange: 5, itemProb: 0.75, wander: 0.15, sloppy: 0.1, curseOk: true },
    normal:  { name: '普通',   interval: 0.16, bombProb: 0.9, hunt: 0.8, chain: true, react: 1, itemRange: 9, itemProb: 1, wander: 0.03, sloppy: 0, curseOk: false },
    hard:    { name: '困難',   interval: 0.07, bombProb: 1, hunt: 1, chain: true, react: 1, itemRange: 16, itemProb: 1, wander: 0, sloppy: 0, curseOk: false, trap: true }
  };
  const FOUR = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DIR_OF = { '1,0': 'R', '-1,0': 'L', '0,1': 'D', '0,-1': 'U' };

  function createBrain(level, seed) {
    const lv = LEVELS[level] ? level : 'normal';
    return {
      level: lv, cfg: LEVELS[lv], rnd: R.mulberry32((seed == null ? 7 : seed) >>> 0),
      next: 0, path: [], dir: null, bomb: false, stuck: 0
    };
  }

  /* ---------- 危險地圖 ---------- */
  function dangerMap(s, chain) {
    const n = s.w * s.h;
    const danger = new Float32Array(n).fill(Infinity);
    const burn = new Float32Array(n);
    const list = s.bombs.map(b => ({ b, t: b.t, bl: R.blast(s, b) }));
    if (chain) {
      for (let iter = 0; iter < list.length; iter++) {
        let changed = false;
        for (const a of list) for (const o of a.bl.chain) {
          const e = list.find(x => x.b === o);
          if (e && a.t < e.t) { e.t = a.t; changed = true; }
        }
        if (!changed) break;
      }
    }
    for (const e of list) for (const c of e.bl.cells) {
      const i = c.y * s.w + c.x;
      if (e.t < danger[i]) danger[i] = e.t;
    }
    for (const f of s.flames) if (!f.cool) burn[f.cy * s.w + f.cx] = Math.max(burn[f.cy * s.w + f.cx], f.t);
    return { danger, burn };
  }

  /** 走第 k 步進入的格子，玩家的中心點會停留在 [Tin, Tout] 這段時間；跟爆炸或餘燼重疊就算不安全 */
  function unsafeAt(dm, i, k, tile) {
    const tin = (k - 0.5) * tile - 0.1, tout = (k + 0.5) * tile + 0.1;
    const d = dm.danger[i];
    if (d < Infinity && tin < d + R.FLAME_T + 0.05 && tout > d - 0.1) return true;
    return dm.burn[i] > 0 && tin < dm.burn[i] + 0.05;
  }

  /** 時間感知的廣度優先：只走「抵達時還沒爆」的路 */
  function bfs(s, start, dm, p, avoid, strict) {
    const n = s.w * s.h;
    const dist = new Int16Array(n).fill(-1);
    const prev = new Int32Array(n).fill(-1);
    const tile = 1 / R.speedOf(p);
    dist[start] = 0;
    const q = [start];
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % s.w, y = (i / s.w) | 0;
      for (const d of FOUR) {
        const nx = x + d[0], ny = y + d[1];
        if (!R.inside(s, nx, ny)) continue;
        const j = ny * s.w + nx;
        if (dist[j] >= 0 || s.grid[j] !== 0) continue;
        if (R.bombAt(s, nx, ny)) continue;
        if (avoid && avoid[j]) continue;
        if (strict && (dm.danger[j] < Infinity || dm.burn[j] > 0)) continue;   /* 平時不踩任何會被炸到的格子 */
        if (unsafeAt(dm, j, dist[i] + 1, tile)) continue;
        dist[j] = dist[i] + 1; prev[j] = i; q.push(j);
      }
    }
    return { dist, prev, order: q };
  }

  function pathTo(prev, start, goal) {
    const out = [];
    for (let i = goal; i !== start && i >= 0; i = prev[i]) out.push(i);
    return out.reverse();
  }

  function escapePath(s, startCell, dm, p) {
    const r = bfs(s, startCell, dm, p, null, false);
    let best = -1;
    for (const i of r.order) {
      if (i === startCell) continue;
      if (dm.danger[i] === Infinity && dm.burn[i] === 0) { best = i; break; }
    }
    if (best >= 0) return pathTo(r.prev, startCell, best);
    return null;
  }

  function withBomb(s, b, fn) {
    s.bombs.push(b);
    try { return fn(); } finally { s.bombs.pop(); }
  }

  function enemiesOf(s, p) { return s.players.filter(q => q.alive && q.slot !== p.slot); }

  /* ---------- 判斷：這裡放炸彈划不划算 ---------- */
  function bombWanted(brain, s, p, me, dm) {
    const cfg = brain.cfg;
    if (!R.canPlaceBomb(s, p)) return false;
    const x = me % s.w, y = (me / s.w) | 0;
    const virt = { id: -1, owner: p.slot, cx: x, cy: y, range: R.rangeOf(p), t: R.FUSE, pass: [p.slot], sl: null };
    const bl = R.blast(s, virt);
    const foes = enemiesOf(s, p);
    const hit = foes.filter(q => { const c = R.cellOf(q); return bl.cells.some(k => k.x === c.x && k.y === c.y); });
    const useful = bl.softs.length > 0 || (hit.length > 0 && brain.rnd() < cfg.hunt);
    if (!useful) return false;
    if (brain.rnd() > cfg.bombProb) return false;
    const skip = brain.rnd() < cfg.sloppy;
    if (skip) return true;
    return withBomb(s, virt, () => {
      const dm2 = dangerMap(s, cfg.chain);
      return !!escapePath(s, me, dm2, p);
    });
  }

  function farmCell(brain, s, p, reach) {
    const range = R.rangeOf(p);
    for (const i of reach.order) {
      if (i === reach.order[0]) continue;
      const x = i % s.w, y = (i / s.w) | 0;
      const bl = R.blast(s, { cx: x, cy: y, range, id: -1, owner: p.slot, pass: [], sl: null });
      if (bl.softs.length) return i;
    }
    return -1;
  }

  /* ---------- 決策 ---------- */
  function decide(brain, s, p) {
    const cfg = brain.cfg;
    const c = R.cellOf(p);
    const me = c.y * s.w + c.x;
    const dm = dangerMap(s, cfg.chain);
    const inDanger = dm.danger[me] < Infinity || dm.burn[me] > 0;

    if (inDanger) {
      if (brain.rnd() < cfg.react) {
        const path = escapePath(s, me, dm, p);
        if (path) { brain.path = path; return; }
        /* 逃不掉：往最晚爆的鄰格擠 */
        let best = null, bestT = dm.danger[me];
        for (const d of FOUR) {
          const nx = c.x + d[0], ny = c.y + d[1];
          if (!R.inside(s, nx, ny) || s.grid[ny * s.w + nx] !== 0 || R.bombAt(s, nx, ny)) continue;
          if (dm.burn[ny * s.w + nx] > 0) continue;   /* 還在燒的格子沒有炸彈指著，danger 是 Infinity，不擋掉會直接走進火裡 */
          const t = dm.danger[ny * s.w + nx];
          if (t > bestT) { bestT = t; best = ny * s.w + nx; }
        }
        brain.path = best != null ? [best] : [];
      }
      return;
    }

    if (bombWanted(brain, s, p, me, dm)) {
      brain.bomb = true;
      brain.next = 0;       /* 下一拍立刻決定怎麼逃 */
      brain.path = [];
      return;
    }

    if (brain.rnd() < cfg.wander) { wander(brain, s, p, me, dm); return; }

    /* 避開詛咒道具（普通以上） */
    let avoid = null;
    if (!cfg.curseOk) {
      avoid = new Uint8Array(s.w * s.h);
      for (const it of s.itemsOn) if (R.CURSES.indexOf(it.type) >= 0) avoid[it.cy * s.w + it.cx] = 1;
    }
    const reach = bfs(s, me, dm, p, avoid, true);

    /* 1. 道具 */
    let bestItem = null, bestD = 1e9;
    for (const it of s.itemsOn) {
      if (!cfg.curseOk && R.CURSES.indexOf(it.type) >= 0) continue;
      const j = it.cy * s.w + it.cx, d = reach.dist[j];
      if (d > 0 && d <= cfg.itemRange && d < bestD) { bestD = d; bestItem = j; }
    }
    if (bestItem != null && brain.rnd() < cfg.itemProb) { brain.path = pathTo(reach.prev, me, bestItem); return; }

    /* 2. 追人 */
    if (cfg.hunt > 0 && brain.rnd() < cfg.hunt) {
      let tgt = -1, td = 1e9;
      for (const q of enemiesOf(s, p)) {
        const qc = R.cellOf(q), j = qc.y * s.w + qc.x, d = reach.dist[j];
        if (d >= 0 && d < td) { td = d; tgt = j; }
      }
      const limit = brain.level === 'hard' ? 14 : brain.level === 'normal' ? 7 : 4;
      if (tgt >= 0 && td <= limit) {
        const path = pathTo(reach.prev, me, tgt);
        if (path.length > 1) path.pop();          /* 停在對手前一格，不要貼臉 */
        brain.path = path;
        return;
      }
    }

    /* 3. 找磚頭炸 */
    const f = farmCell(brain, s, p, reach);
    if (f >= 0) { brain.path = pathTo(reach.prev, me, f); return; }

    /* 4. 磚都炸完了：逼近對手（沒有路就等） */
    if (cfg.hunt > 0) {
      const open = new Uint8Array(s.w * s.h);
      let best = -1, bd = 1e9;
      for (const q of enemiesOf(s, p)) {
        const qc = R.cellOf(q), j = qc.y * s.w + qc.x;
        const d = Math.abs(qc.x - c.x) + Math.abs(qc.y - c.y);
        if (d < bd) { bd = d; best = j; }
      }
      if (best >= 0) {
        let to = -1, td = 1e9;
        for (const i of reach.order) {
          const x = i % s.w, y = (i / s.w) | 0;
          const d = Math.abs(x - best % s.w) + Math.abs(y - ((best / s.w) | 0));
          if (d < td) { td = d; to = i; }
        }
        if (to >= 0 && to !== me) { brain.path = pathTo(reach.prev, me, to); return; }
      }
      void open;
    }
    wander(brain, s, p, me, dm);
  }

  function wander(brain, s, p, me, dm) {
    const x = me % s.w, y = (me / s.w) | 0;
    const opts = [];
    for (const d of FOUR) {
      const nx = x + d[0], ny = y + d[1];
      if (!R.inside(s, nx, ny) || s.grid[ny * s.w + nx] !== 0 || R.bombAt(s, nx, ny)) continue;
      const j = ny * s.w + nx;
      if (dm.danger[j] < Infinity || dm.burn[j] > 0) continue;
      opts.push(j);
    }
    brain.path = opts.length ? [opts[Math.floor(brain.rnd() * opts.length)]] : [];
  }

  /* ---------- 每個 tick 呼叫 ---------- */
  function think(brain, s, p, dt) {
    if (!p.alive || s.phase !== 'play') { brain.path = []; return { dir: null, bomb: false }; }
    brain.next -= dt;
    brain.bomb = false;
    if (brain.next <= 0) {
      brain.next = brain.cfg.interval * (0.8 + brain.rnd() * 0.4);
      decide(brain, s, p);
    }
    /* 走向路徑上的下一格中心 */
    let dir = null;
    while (brain.path.length) {
      const i = brain.path[0];
      const tx = (i % s.w) + 0.5, ty = ((i / s.w) | 0) + 0.5;
      const dx = tx - p.x, dy = ty - p.y;
      if (Math.abs(dx) < 0.07 && Math.abs(dy) < 0.07) { brain.path.shift(); continue; }
      if (Math.abs(dx) >= Math.abs(dy)) dir = dx > 0 ? 'R' : 'L'; else dir = dy > 0 ? 'D' : 'U';
      break;
    }
    /* 卡住（被炸彈或別人擋到）就重新想 */
    if (dir && !p.moving) { brain.stuck += dt; if (brain.stuck > 0.35) { brain.stuck = 0; brain.path = []; brain.next = 0; } } else brain.stuck = 0;
    brain.dir = dir;
    return { dir, bomb: brain.bomb };
  }

  root.AI = { LEVELS, LEVEL_ORDER, createBrain, think, dangerMap, bfs, escapePath };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.AI;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
