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

  const LEVEL_ORDER = ['toddler', 'easy', 'normal', 'hard', 'myth'];
  const LEVELS = {
    /* interval 決策間隔（秒，越大反應越慢）、hunt 追人機率、chase 追人最遠格數、react 發現危險時每次決策會逃的機率、notice 發現危險後要多久才反應得過來（秒）、
       wander 發呆亂走機率、sloppy 放了炸彈卻沒先確認退路的機率。
       （margin 走位安全餘裕：校準顯示留越多反而越保守越弱，所以所有等級都用預設 0.1，不列入強度權重） */
    toddler: { name: '幼幼班', interval: 0.62, bombProb: 0.31, hunt: 0.04, chase: 2, chain: false, react: 0.45, notice: 0.23, itemRange: 4, itemProb: 0.34, wander: 0.46, sloppy: 0.4, curseOk: true },
    easy:    { name: '簡單', interval: 0.55, bombProb: 0.54, hunt: 0.21, chase: 5, chain: false, react: 0.59, notice: 0.21, itemRange: 5, itemProb: 0.45, wander: 0.3, sloppy: 0.24, curseOk: true },
    normal:  { name: '普通', interval: 0.38, bombProb: 0.74, hunt: 0.36, chase: 7, chain: true, react: 0.71, notice: 0.48, itemRange: 8, itemProb: 0.77, wander: 0.16, sloppy: 0.11, curseOk: false },
    hard:    { name: '困難', interval: 0.23, bombProb: 0.91, hunt: 0.89, chase: 12, chain: true, react: 0.73, notice: 0.31, itemRange: 15, itemProb: 0.77, wander: 0.12, sloppy: 0.12, curseOk: false, trap: true },
    /* 神話：決策最快、逃得最準、追人與撿道具距離最遠、很少發呆與失誤（參數由強度目標 84 算出） */
    myth:    { name: '神話', interval: 0.14, bombProb: 0.91, hunt: 0.9, chase: 36, chain: true, react: 0.9, notice: 0.1, itemRange: 36, itemProb: 0.9, wander: 0.06, sloppy: 0.06, curseOk: false, trap: true }
  };

  /* ---------- 等級權重表：把每個參數換算成「強度值」（0～100），用強度值來定級距與調數值 ----------
   * 權重是實測校準出來的（scripts/ai-weights.js：逐一把每個參數調到最強／最弱，跟三個基準電腦各打 200 局，看成績差多少），
   * 不是憑感覺：決策間隔與逃生機率合起來佔 6 成，追人距離、發呆、失誤機率影響都很小。
   * 每一項：w 權重、worst 最弱的值、best 最強的值。把參數換成 0（最弱）～1（最強）後乘上權重再加總，權重總和 100，
   * 所以強度值就是 0～100。調難度時不要憑感覺改單一數字，而是先決定這一級的目標強度（LEVEL_POWER，級距要平均），
   * 再用 scaleToPower() 算出對應的參數；tests/verify.js 會檢查每一級的強度值都貼近目標、級距夠大。 */
  const POWER_WEIGHTS = {
    interval:  { w: 34, worst: 0.8, best: 0.04, label: '決策間隔（秒）' },
    react:     { w: 28, worst: 0, best: 1, label: '發現危險時逃的機率' },
    notice:    { w: 12, worst: 1.0, best: 0, label: '發現危險後的反應延遲（秒）' },
    hunt:      { w: 6, worst: 0, best: 1, label: '追人機率' },
    bombProb:  { w: 6, worst: 0.2, best: 1, label: '放炸彈意願' },
    itemRange: { w: 5, worst: 0, best: 40, label: '撿道具最遠格數' },
    sloppy:    { w: 3, worst: 0.5, best: 0, label: '放炸彈沒確認退路的機率' },
    wander:    { w: 2, worst: 0.6, best: 0, label: '發呆亂走機率' },
    chase:     { w: 2, worst: 0, best: 40, label: '追人最遠格數' },
    itemProb:  { w: 1, worst: 0, best: 1, label: '撿道具意願' },
    chain:     { w: 1, worst: 0, best: 1, label: '會算連鎖爆炸', flag: true }
  };
  const POWER_TOTAL = Object.keys(POWER_WEIGHTS).reduce((a, k) => a + POWER_WEIGHTS[k].w, 0);
  /* 各等級的目標強度（33、45、58、73、89：級距 12、13、15、16，越高級略微拉開）；改這張表就能整體調整難度的級距。
     半身機制改成 40%（更容易被火波及）後，整體再加了 3 點，讓電腦稍微聰明一點 */
  const LEVEL_POWER = { toddler: 33, easy: 45, normal: 58, hard: 73, myth: 89 };
  const POWER_DEFAULT = { notice: 0 };

  function paramValue(cfg, k) {
    const v = POWER_WEIGHTS[k].flag ? (cfg[k] ? 1 : 0) : cfg[k];
    return v == null ? POWER_DEFAULT[k] : v;
  }
  /** 0（最弱）～1（最強） */
  function paramNorm(k, v) {
    const { worst, best } = POWER_WEIGHTS[k];
    return Math.max(0, Math.min(1, (v - worst) / (best - worst)));
  }
  /** 每個參數對強度值的貢獻（權重 × 正規化值），加總就是強度值 */
  function powerBreakdown(cfg) {
    const out = {};
    for (const k of Object.keys(POWER_WEIGHTS)) out[k] = POWER_WEIGHTS[k].w * paramNorm(k, paramValue(cfg, k)) / POWER_TOTAL * 100;
    return out;
  }
  function power(cfg) {
    const b = powerBreakdown(cfg);
    return Object.keys(b).reduce((a, k) => a + b[k], 0);
  }
  /**
   * 依目標強度算出新的參數：所有數值參數一起往「最強」（a>0）或「最弱」（a<0）等比例移動，找出剛好等於目標強度的比例。
   * 旗標（chain）與沒有權重的欄位（name、curseOk、trap）不動；追人距離與撿道具距離取整數。回傳新物件，不改原本的。
   */
  function scaleToPower(cfg, target) {
    const make = a => {
      const o = Object.assign({}, cfg);
      for (const k of Object.keys(POWER_WEIGHTS)) {
        if (POWER_WEIGHTS[k].flag) continue;
        const n = paramNorm(k, paramValue(cfg, k));
        const n2 = a >= 0 ? n + a * (1 - n) : n * (1 + a);
        const { worst, best } = POWER_WEIGHTS[k];
        let v = worst + (best - worst) * n2;
        v = (k === 'chase' || k === 'itemRange') ? Math.round(v) : Math.round(v * 100) / 100;
        o[k] = v;
      }
      return o;
    };
    let lo = -1, hi = 1;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (power(make(mid)) < target) lo = mid; else hi = mid; }
    return make((lo + hi) / 2);
  }
  const FOUR = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DIR_OF = { '1,0': 'R', '-1,0': 'L', '0,1': 'D', '0,-1': 'U' };

  /** cfg 可選：直接給一組參數（校準工具用），沒給就用等級表 */
  function createBrain(level, seed, cfg) {
    const lv = LEVELS[level] ? level : 'normal';
    return {
      level: lv, cfg: cfg || LEVELS[lv], rnd: R.mulberry32((seed == null ? 7 : seed) >>> 0),
      next: 0, path: [], dir: null, bomb: false, stuck: 0
    };
  }

  /* ---------- 危險地圖 ---------- */
  function dangerMap(s, chain, margin) {
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
    /* 半身機制：人物往上提，頭比判定點高約 0.76 格，所以站在火線「正下方一格」時頭會燒到（從那一格上緣走過去就算被炸）。
       把火線下面那一格也當成危險區（時間一樣），電腦就不會在那裡停留或橫著走過去 */
    for (let y = s.h - 2; y >= 1; y--) for (let x = 1; x < s.w - 1; x++) {
      const i = y * s.w + x, up = i - s.w;
      if (s.grid[i] === 1) continue;
      if (danger[up] < danger[i]) danger[i] = danger[up];
      if (burn[up] > burn[i]) burn[i] = burn[up];
    }
    return { danger, burn, margin: margin == null ? 0.1 : margin };
  }

  /** 走第 k 步進入的格子，玩家的中心點會停留在 [Tin, Tout] 這段時間；跟爆炸或餘燼重疊就算不安全 */
  function unsafeAt(dm, i, k, tile) {
    const m = dm.margin;
    const tin = (k - 0.5) * tile - m, tout = (k + 0.5) * tile + m;
    const d = dm.danger[i];
    if (d < Infinity && tin < d + R.FLAME_T + 0.05 && tout > d - m) return true;
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
        if (seenBomb(s, nx, ny)) continue;
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

  /* 草叢裡的炸彈電腦也看不到，所以走路規劃時不會把它當障礙（可能撞上去，卡住了會重想）；火力線的危險仍然算進去 */
  function seenBomb(s, x, y) { const b = R.bombAt(s, x, y); return !!b && !R.bombHiddenInGrass(s, b); }

  /* 隱身的對手電腦也「看不到」，不然就變成開外掛 */
  function enemiesOf(s, p) { return s.players.filter(q => q.alive && q.slot !== p.slot && !(q.ghostT > 0) && !R.hiddenInGrass(s, q)); }   /* 躲在遠處草叢裡的也看不到 */

  /* ---------- 判斷：這裡放炸彈划不划算 ---------- */
  function bombWanted(brain, s, p, me, dm) {
    const cfg = brain.cfg;
    if (!R.canPlaceBomb(s, p)) return false;
    const x = me % s.w, y = (me / s.w) | 0;
    if (R.fxAt(s, x, y) === R.FX_SPIKE) return false;      /* 尖刺上放炸彈會當場爆炸 */
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
      const dm2 = dangerMap(s, cfg.chain, cfg.margin);
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
    const dm = dangerMap(s, cfg.chain, cfg.margin);
    /* 被火燒是看身體壓到的格子（半身機制），走在格子邊緣時要提早躲 */
    const inDanger = dm.danger[me] < Infinity || dm.burn[me] > 0 || R.hurtCells(p).some(k => R.inside(s, k.x, k.y) && (dm.danger[k.y * s.w + k.x] < Infinity || dm.burn[k.y * s.w + k.x] > 0));

    if (!inDanger) brain.noticeAt = null;
    else if (brain.noticeAt == null) brain.noticeAt = s.time + (cfg.notice || 0) * (0.5 + brain.rnd());   /* 發現腳下有危險後，要過一小段時間才反應得過來 */

    if (inDanger) {
      if (s.time >= brain.noticeAt && brain.rnd() < cfg.react) {
        const path = escapePath(s, me, dm, p);
        if (path) { brain.path = path; return; }
        /* 逃不掉：往最晚爆的鄰格擠 */
        let best = null, bestT = dm.danger[me];
        for (const d of FOUR) {
          const nx = c.x + d[0], ny = c.y + d[1];
          if (!R.inside(s, nx, ny) || s.grid[ny * s.w + nx] !== 0 || seenBomb(s, nx, ny)) continue;
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
      const limit = cfg.chase;
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
      if (!R.inside(s, nx, ny) || s.grid[ny * s.w + nx] !== 0 || seenBomb(s, nx, ny)) continue;
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
    /* 方向顛倒：電腦不會因為操作反了就自己走進火裡，先反過來抵銷（其他詛咒對電腦照常有效） */
    if (dir && p.curse && p.curse.type === 'c_flip') dir = R.flipDir(p, dir);
    brain.dir = dir;
    return { dir, bomb: brain.bomb };
  }

  root.AI = { LEVELS, LEVEL_ORDER, POWER_WEIGHTS, POWER_TOTAL, LEVEL_POWER, power, powerBreakdown, scaleToPower, createBrain, think, dangerMap, bfs, escapePath };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.AI;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
