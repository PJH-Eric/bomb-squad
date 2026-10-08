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
  /* 空襲（突然死亡）：遊戲進行超過 SKY_START 秒後，每 SKY_EVERY 秒從天上掉一批炸彈到隨機空格；每過 SKY_STEP 秒每批多 1 顆，最多 SKY_MAX 顆。
     2:30 起每批 1 顆、2:40 起 2 顆、2:50 起 3 顆，之後維持 3 顆。炸彈落地後 SKY_FUSE 秒爆炸，火力橫掃到牆（SKY_RANGE），不屬於任何玩家（不算擊倒）。
     時間限制比較短的局（2 分鐘），空襲會提前到「最後 SKY_LAST 秒」開始（1:30 起，一樣 1／2／3 顆），不然 2 分鐘的局根本等不到空襲就結束了 */
  const SKY_START = 150, SKY_EVERY = 2, SKY_STEP = 10, SKY_MAX = 3, SKY_FUSE = 3, SKY_RANGE = 99, SKY_LAST = 30;
  /** 這一局的空襲從第幾秒開始：預設 SKY_START；有時間限制而且比 SKY_START + SKY_LAST 短，就提前到限制時間的最後 SKY_LAST 秒（再短的限制也不會早於第 SKY_LAST 秒，所以只有很短的測試局不會空襲） */
  const skyStartFor = timeLimit => (timeLimit > 0 ? Math.max(SKY_LAST, Math.min(SKY_START, timeLimit - SKY_LAST)) : SKY_START);
  const PLANE_SPEED = 5;       /* 空投機飛行速度（格／秒） */
  const FLAME_COOL_T = 0.15;   /* 磚塊格的無殺傷火花停留秒數（原本 0.3，太久：看起來像那格還有火，連鎖的火焰也會在剛清掉的磚塊格上多停一下） */
  const FLAME_T = 0.3;         /* 火焰停留秒數（原本 0.5，太久、走位被波及；磚塊格的火花另外是 FLAME_COOL_T） */
  /* 半身機制：身體站在「剛好一半在炸彈格、一半在旁邊那一格」（同一條左右或上下線上）時，不會被那顆炸彈波及——
     火焰是「一格一格」判定的：身體壓在某一個火線格裡的比例 ≥ HALF_BODY（60%）才算被炸，一半（50%）還是安全，留 10% 的容錯給手動站位；
     再深入一點才會被炸。歷史：最早是「中心要深入火線格 0.1 格」，換算約 64%；曾試過 50%、40%、55%，太容易被波及，現在上半身取 75%、左右 64%、下半身 25%。踢球另外用 KICK_OVERLAP（50%）：半個身體壓在炸彈線上就踢得到。
     身體的範圍＝畫面上人物實際畫出來的範圍：左右 ±HALF；上下因為人物往上提（腳在判定點附近），頭在上方 BODY_UP 格、腳在下方 BODY_DOWN 格
     （數字來自人物圖實際畫出來的範圍，render.js 的 SPRITE／SHADOW_DROP）；不然站在火線下方、頭已經燒到了卻還是安全（上下比左右難被波及） */
  const HALF_BODY = 0.75;
  /* 火線從左右兩側經過時各自的門檻：身體壓進那一格的比例 ≥ SIDE_LEFT／SIDE_RIGHT 才被炸（可以左右不同）。
     直火中心離角色判定中心 ≤ 0.5 + HALF − SIDE×2×HALF 格就被炸（用 scripts/flame-tuning.js 量四個方向的實際邊界）。
     目前：上半身 75%、下半身 25%、右 64%、左 36% */
  const SIDE_LEFT = 0.36, SIDE_RIGHT = 0.64;
  const BODY_UP = 0.76, BODY_DOWN = 0.19;
  /* 上下半身要有明顯差異：上半身（頭）看整個身體的比例（HALF_BODY），
     下半身只允許壓到「一點點」不被波及——腳、影子圈與火焰光暈一起算「下半身」，從判定點往下 FEET_REACH 格，
     下半身壓進火線格 FEET_HIT（25%，約 0.125 格）就被炸。站在火線正上方那一格、腳貼到火線時一定會被炸；
     剛好站在格子正中間（下半身剛好碰到格線）仍然安全 */
  const FEET_REACH = 0.5, FEET_HIT = 0.25;
  const HURT_LIFT = (BODY_UP - BODY_DOWN) / 2;     /* 身體中心比判定點高多少（約 0.285） */
  const HALF = 0.36;           /* 玩家碰撞半寬（比格子小，轉角才好過） */
  const START = { fire: 2, bomb: 1 };
  const MAX = { fire: 11, bomb: 8, speed: 6 };
  const SPEED = { base: 3.5, step: 0.5, slow: 1.7, trait: 0.8 };
  /* 各角色的能力（兩層平衡）：
   *   初始：火力、炸彈數 1～2；跑速 1～2（1.5 是標準 3.5 格／秒，2 是 3.9、1 是 3.1）。
   *         四種組合（九隻分在這四組），火力＋炸彈每多 1，跑速就少 0.5（火力＋炸彈＋2×跑速 都是 6）。
   *   上限：撿道具最多能升到的火力格數／炸彈顆數／加速次數，三項加起來每隻都是 25（地圖變大後，比原本的 19 多給火力 3、炸彈 2、加速 1），
   *         同一種初始組合的幾隻靠上限走不同路線，所以 9 隻都不一樣，也沒有哪隻全面比別隻強。 */
  const ANIMAL_STATS = {
    cat:     { fire: 1, bomb: 1, speed: 2,   max: { fire: 10, bomb: 9, speed: 6 } },
    dog:     { fire: 1, bomb: 2, speed: 1.5, max: { fire: 9, bomb: 10, speed: 6 } },
    bunny:   { fire: 1, bomb: 1, speed: 2,   max: { fire: 9, bomb: 8, speed: 8 } },
    bear:    { fire: 2, bomb: 1, speed: 1.5, max: { fire: 12, bomb: 7, speed: 6 } },
    panda:   { fire: 2, bomb: 2, speed: 1,   max: { fire: 11, bomb: 9, speed: 5 } },
    fox:     { fire: 1, bomb: 2, speed: 1.5, max: { fire: 10, bomb: 8, speed: 7 } },
    frog:    { fire: 2, bomb: 1, speed: 1.5, max: { fire: 11, bomb: 7, speed: 7 } },
    penguin: { fire: 2, bomb: 2, speed: 1,   max: { fire: 10, bomb: 10, speed: 5 } },
    chick:   { fire: 1, bomb: 1, speed: 2,   max: { fire: 8, bomb: 10, speed: 7 } }
  };
  const START_STATS = { fire: START.fire, bomb: START.bomb, speed: 1.5, max: MAX };
  const statsOf = animal => ANIMAL_STATS[animal] || START_STATS;
  const CURSE_T = 8;           /* 負面道具持續秒數 */
  const GHOST_T = 8;           /* 隱身持續秒數 */
  const SUPER_T = 8;           /* 超人標誌持續秒數 */
  const SHIELD_T = 1.2;        /* 護盾破掉後的無敵秒數 */
  const COUNTDOWN = 3;
  const SLIDE_SPEED = 12;      /* 被踢的炸彈滑行格/秒（原本 7，加快） */
  const AUTO_BOMB_EVERY = 0.7; /* 手滑詛咒：自動放炸彈的間隔 */
  const END_HOLD = 2.2;        /* 分出勝負後，畫面多跑幾秒讓爆炸演完 */

  /* 新道具一律加在最後面：快照用「順序」當道具編號 */
  const ITEM_TYPES = ['fire', 'bomb', 'speed', 'kick', 'shield', 'c_slow', 'c_auto', 'c_short', 'ghost', 'super', 'ultra', 'c_flip'];
  const POSITIVE = ['fire', 'bomb', 'speed', 'kick', 'shield', 'ghost', 'super', 'ultra'];
  const CURSES = ['c_slow', 'c_auto', 'c_short', 'c_flip'];
  /* 有秒數限制的（隱身、超人標誌、四種詛咒）權重都壓低；永久的大力藥丸比它們常見 */
  const DROP_WEIGHTS = { fire: 24, bomb: 24, speed: 18, kick: 4, shield: 6, c_slow: 3, c_auto: 3, c_short: 3, ghost: 3, super: 3, ultra: 12, c_flip: 3 };
  const ITEM_RATE = 0.4;       /* 軟磚被炸掉時掉寶機率 */

  const LAYOUTS = ['classic', 'open', 'dense', 'fab'];
  const RANDOM_LAYOUTS = ['classic', 'open', 'dense'];
  const FAB_THEME = 7;          /* 日月光廠房主題：固定用「產線」版型（產線版型只有它有，不開放給其他主題選） */
  const LAYOUT_NAMES = { classic: '經典', open: '空曠', dense: '密集', fab: '產線' };
  const THEME_COUNT = 13;
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
  /* 格子數盡量多（比最初每邊各多 2 格、小圖 221 格／大圖 285 格），走位與佈局空間大；每格大小仍由「可用空間 ÷ 格數」自動算，人物、道具、炸彈跟著等比縮放 */
  const MAP_SMALL = { w: 17, h: 13 }, MAP_LARGE = { w: 19, h: 15 };
  function sizeFor(count) { return count <= 4 ? Object.assign({}, MAP_SMALL) : Object.assign({}, MAP_LARGE); }
  /** 這種尺寸的地圖用幾個出生點：小圖只用四個角，大圖再加上四邊中點 */
  function spawnCount(w, h) { return h <= MAP_SMALL.h ? 4 : 8; }

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

  /* 各版型的硬牆設定：rate＝硬牆佔整張地圖可走空間（邊框內側）的平均比例，len＝一組硬牆最長幾格，horiz＝只排橫條（機台）。
     每張圖實際比例是 rate 的 0.6～1.2 倍，而且放的時候不會超過目標太多，所以不會有少數地圖硬牆多到爆；
     中央區的硬牆約一半的地圖還會再換成軟磚 */
  const HARD_STYLE = {
    classic: { rate: 0.12, len: 3 },
    open: { rate: 0.06, len: 2 },
    dense: { rate: 0.16, len: 3 },
    fab: { rate: 0.12, len: 3, minLen: 2, horiz: true }
  };
  const HARD_OVER = 1.1;        /* 放到一組之後總量最多可以超過目標幾倍（超過就不放那一組） */
  const SOFT_MIN = 0.88;        /* 可放軟磚的格子，每格至少 88% 機率放 */
  const SOFTEN_RATE = 0.5;     /* 約一半的地圖會把中央區的硬牆全換成軟磚 */
  const SOFTEN_REACH = 0.55;    /* 中央區範圍：離中心不超過半徑的這個比例 */

  /**
   * 產生地圖：左上四分之一隨機撒一組組長短不一的硬牆，再左右上下鏡射，所以每個出生點的處境都一樣公平，
   * 但每張圖的硬牆位置、長度、方向都不固定，沒有任何規則排列。每放一組都檢查全圖連通，擋死路就撤回。
   * layout：classic 經典／open 空曠（硬牆少）／dense 密集（硬牆多）／fab 產線（橫向機台，一組 2～3 格）
   * soften：true／false 強制中央硬牆是否改軟磚；不給就由 seed 決定（約一半的地圖會改）
   */
  function generateMap(seed, w, h, layout, density, soften) {
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

    /* 出生點安全區：曼哈頓距離 2 以內不放軟磚（小圖清四個角、大圖清八個點，地圖才對稱）；距離 1 以內連硬牆也不放，免得一出生就被卡住 */
    const safe = new Uint8Array(w * h), nearSpawn = new Uint8Array(w * h);
    for (const [sx, sy] of spawnPoints(w, h).slice(0, spawnCount(w, h))) {
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const d = Math.abs(x - sx) + Math.abs(y - sy);
        if (d <= 2) safe[at(x, y)] = 1;
        if (d <= 1) nearSpawn[at(x, y)] = 1;
      }
    }

    const st = HARD_STYLE[layout] || HARD_STYLE.classic;
    const target = Math.round(st.rate * (w - 2) * (h - 2) * (0.6 + rnd() * 0.6));   /* 每張圖的硬牆總量也不一樣（0.6～1.2 倍，上限壓低，避免有些圖不可破壞的東西太多） */
    let placed = 0;
    for (let tries = 0; tries < 600 && placed < target; tries++) {
      const x0 = 1 + Math.floor(rnd() * cx), y0 = 1 + Math.floor(rnd() * cy);
      const horiz = st.horiz || rnd() < 0.5;
      const lo = st.minLen || 1;
      const len = lo + Math.floor(rnd() * (st.len - lo + 1));
      let cells = [];
      for (let k = 0; k < len; k++) cells.push(horiz ? [x0 + k, y0] : [x0, y0 + k]);
      /* 除了直條、橫條，也會出現 L 形與 2×2 方塊（產線只排橫向機台） */
      const kind = rnd();
      if (!st.horiz && kind < 0.25) { const fx = rnd() < 0.5 ? 1 : -1, fy = rnd() < 0.5 ? 1 : -1; cells = [[x0, y0], [x0 + fx, y0], [x0, y0 + fy]]; }
      else if (!st.horiz && kind < 0.35 && layout !== 'open') cells = [[x0, y0], [x0 + 1, y0], [x0, y0 + 1], [x0 + 1, y0 + 1]];
      /* 整組都要落在左上四分之一、是空格、不貼著出生點，也不能和別組硬牆上下左右相連（才會一組一組分開） */
      const ok = cells.every(([x, y]) => {
        if (x > cx || y > cy || grid[at(x, y)] !== 0 || nearSpawn[at(x, y)]) return false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (cells.some(c => c[0] === nx && c[1] === ny)) continue;
          if (nx < 1 || ny < 1 || nx > w - 2 || ny > h - 2) continue;
          if (grid[at(nx, ny)] === 1) return false;
        }
        return true;
      });
      if (!ok) continue;
      const keep = grid.slice();
      for (const [x, y] of cells) set4(x, y, 1);
      let added = 0;
      for (let i = 0; i < grid.length; i++) if (grid[i] === 1 && keep[i] === 0) added++;       /* 鏡射後真正多了幾格 */
      if (!connected(grid, w, h) || placed + added > Math.ceil(target * HARD_OVER)) { for (let i = 0; i < grid.length; i++) grid[i] = keep[i]; continue; }
      placed += added;
    }

    /* 約一半的地圖：中央區的硬牆全部換成軟磚，中間更好打、操作空間更大（出生點安全區裡的不動，那裡不放軟磚） */
    const centerSoft = soften == null ? mulberry32((seed ^ 0x2f6b9d1) >>> 0)() < SOFTEN_RATE : !!soften;
    if (centerSoft) {
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (grid[at(x, y)] === 1 && !safe[at(x, y)] && Math.abs(x - cx) <= cx * SOFTEN_REACH && Math.abs(y - cy) <= cy * SOFTEN_REACH) grid[at(x, y)] = 2;
      }
    }
    /* 軟磚：每張圖的整體疏密不同，再隨機放幾個「磚塊堆」和「空地」，分布成一塊一塊的而不是均勻鋪滿 */
    const d = density == null ? 0.92 + rnd() * 0.06 : density;
    const spots = [];
    for (let i = 0, n = 3 + Math.floor(rnd() * 4); i < n; i++) spots.push({ x: 1 + rnd() * cx, y: 1 + rnd() * cy, r: 1.5 + rnd() * 2.5, k: rnd() < 0.5 ? 0.2 : -0.15 });
    for (let y = 1; y <= cy; y++) for (let x = 1; x <= cx; x++) {
      if (grid[at(x, y)] !== 0 || safe[at(x, y)]) continue;
      let p = d;
      if (density == null) for (const sp of spots) { const dist = Math.hypot(x - sp.x, y - sp.y); if (dist < sp.r) p += sp.k * (1 - dist / sp.r); }
      if (rnd() < Math.max(SOFT_MIN, Math.min(1, p))) set4(x, y, 2);   /* 軟磚至少 88%，地圖盡量滿版 */
    }
    /* 保底：機率有運氣成分，填完還不到 88% 就把剩下的空格隨機補上（一樣四向對稱） */
    if (density == null) {
      let eligible = 0, filled = 0;
      const rest = [];
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (grid[at(x, y)] === 1 || safe[at(x, y)]) continue;
        eligible++;
        if (grid[at(x, y)] === 2) filled++; else if (x <= cx && y <= cy) rest.push([x, y]);
      }
      for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
      for (const [x, y] of rest) {
        if (filled >= eligible * SOFT_MIN) break;
        const n = new Set([at(x, y), at(w - 1 - x, y), at(x, h - 1 - y), at(w - 1 - x, h - 1 - y)]).size;
        set4(x, y, 2); filled += n;
      }
    }
    return grid;
  }

  /* ---------- 地圖機關 ----------
   * 地板上的裝置，整局固定不變，存在 state.fx（跟 grid 同長的陣列，不動 grid，所以磚牆規則、碰撞、AI 的判斷都不受影響）。
   * 機關可以和軟磚疊在一起（磚炸掉才露出來）；位置四向鏡像，每個出生點的處境一樣公平，也不會放在出生點旁。
   *   草叢：站在裡面的人，任何人（對手、電腦、觀戰、淘汰的，連自己）都看不到，放在草叢裡的炸彈本體也一樣（火力線的危險預警照樣會顯示）；
   *         只放在走道格（左右都是硬牆，或上下都是硬牆），所以裡面的炸彈只會沿著一條直線炸
   *   輸送帶：踩上去被往帶子的方向推，頭尾相連的環；停在帶子上的炸彈也被載著走
   *   緩速格：走過去只剩 SLOW_MULT 倍速度
   *   尖刺：不傷人；炸彈放在上面、或被踢到上面，會立刻爆炸 */
  const FX_GRASS = 1, FX_SLOW = 2, FX_SPIKE = 3, FX_BELT = 4;     /* 輸送帶 4 上、5 下、6 左、7 右 */
  const BELT_VEC = { 4: [0, -1], 5: [0, 1], 6: [-1, 0], 7: [1, 0] };
  const SLOW_MULT = 0.6;       /* 緩速格上的速度倍率 */
  const BELT_SPEED = 1.6;      /* 輸送帶推人的速度（格／秒） */
  const FX_KEEP = 0.87;        /* 主題有機關的話，每張圖有 87% 機率出現（所以偶爾一張圖都沒有）；每個主題最多 1 種，機關太多會干擾玩家自己的操作 */
  /* 各主題適合的機關（外觀風格在 art.js 的 FX_STYLE）；不適合的主題留空，不是每個主題都有機關：grass 草叢、belt 輸送帶、slow 緩速格、spike 尖刺 */
  const THEME_FX = [
    ['slow'],    /* 0 糖果樂園：糖漿 */
    ['belt'],    /* 1 海底世界：洋流 */
    ['belt'],    /* 2 太空站：磁浮輸送帶 */
    ['grass'],   /* 3 森林：草叢 */
    ['slow'],    /* 4 沙漠：流沙 */
    ['slow'],    /* 5 雪地：積雪 */
    [],          /* 6 競技場：維持單純的比賽場地，沒有機關 */
    ['belt'],    /* 7 日月光廠房：產線輸送帶 */
    ['spike'],   /* 8 礦山：石筍 */
    ['spike'],   /* 9 地下墓穴：骨刺 */
    ['spike'],   /* 10 火山：黑曜石刺 */
    ['grass'],   /* 11 聖誕小鎮：聖誕樹叢 */
    ['belt']     /* 12 遊樂園：旋轉輸送台 */
  ];
  const fxAt = (s, x, y) => (s.fx && x >= 0 && y >= 0 && x < s.w && y < s.h ? s.fx[y * s.w + x] : 0);
  const isBelt = v => v >= FX_BELT && v < FX_BELT + 4;
  /** 輸送帶這一格的「進來方向」：指向這一格的那條輸送帶的方向碼；找不到（斷頭）就當直的，回傳自己的方向 */
  function beltIn(fx, w, x, y) {
    const code = fx[y * w + x];
    for (let c = FX_BELT; c < FX_BELT + 4; c++) {
      const px = x - BELT_VEC[c][0], py = y - BELT_VEC[c][1];
      if (px >= 0 && py >= 0 && px < w && fx[py * w + px] === c) return c;
    }
    return code;
  }

  /**
   * 依 seed 與主題產生機關；用自己的亂數，不影響地圖與掉寶的亂數序列。唯一會動到 grid 的是：尖刺、草叢所在格的軟磚會被拿掉（只會多開路，連通不受影響）。
   * 尖刺總數：小圖 2～6 個、大圖 4～8 個（偶數，四向鏡像）；緩速格是一小塊；草叢數量規則同尖刺；輸送帶是頭尾相連的環形（6～10 格，多半不是單純的長方形），每個角落一圈。
   */
  function generateFx(seed, w, h, grid, themeId, layout) {
    const fx = new Array(w * h).fill(0);
    /* 「產線」一定有輸送帶：產線版型、日月光廠房主題都固定放輸送帶（不受 FX_KEEP 機率影響，也不管主題原本的機關） */
    const line = layout === 'fab' || themeId === FAB_THEME;
    const feats = line ? ['belt'] : (THEME_FX[themeId] || []);
    if (!feats.length) return fx;
    const rnd = mulberry32((seed ^ 0x7f4a7c15) >>> 0);
    const cx = (w - 1) / 2, cy = (h - 1) / 2, large = h > MAP_SMALL.h;
    const at = (x, y) => y * w + x;
    const near = new Uint8Array(w * h), safe = new Uint8Array(w * h);
    for (const [sx, sy] of spawnPoints(w, h).slice(0, spawnCount(w, h))) {
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const d = Math.abs(x - sx) + Math.abs(y - sy);
        if (d <= 1) near[at(x, y)] = 1;
        if (d <= 2) safe[at(x, y)] = 1;
      }
    }
    const on = line ? feats : feats.filter(() => rnd() < FX_KEEP);
    /* 一個格子的四向鏡像（在中線上的格子會少幾個）；fl 記錄左右、上下各翻了沒有 */
    const group = (x, y) => {
      const out = [[x, y, 0, 0]];
      if (w - 1 - x !== x) out.push([w - 1 - x, y, 1, 0]);
      if (h - 1 - y !== y) { out.push([x, h - 1 - y, 0, 1]); if (w - 1 - x !== x) out.push([w - 1 - x, h - 1 - y, 1, 1]); }
      return out;
    };
    const free = (x, y, noSafe) => x >= 1 && y >= 1 && x <= w - 2 && y <= h - 2 && grid[at(x, y)] !== 1 && fx[at(x, y)] === 0 && !near[at(x, y)] && !(noSafe && safe[at(x, y)]);
    const pickCell = (maxX, maxY, ok) => {
      for (let t = 0; t < 60; t++) {
        const x = 1 + Math.floor(rnd() * maxX), y = 1 + Math.floor(rnd() * maxY);
        if (ok(x, y)) return [x, y];
      }
      return null;
    };
    for (const kind of on) {
      if (kind === 'belt') {
        /* 輸送帶是一圈頭尾相連的環，每個角落放 1 圈（大圖有機會再多放 1 個小環），再鏡像到四個角落。形狀盡量隨機：
           外框寬 2～4 格、高 2～3 格，再隨機往外或往內推出 0～2 個凸起（每個多 2 格），繞圈方向（順／逆時針）、橫放直放、位置都隨機；一圈最多 MAX_LOOP 格。
           每格的方向就是路徑上的「下一格」，所以踩上去會一路繞圈。整圈只放在左上四分之一、不碰中線（中線上的格子鏡像後方向會打架），環與環之間不相鄰 */
        const MAX_LOOP = 10;
        const makeLoop = () => {
          const bw = 2 + Math.floor(rnd() * 3), bh = 2 + Math.floor(rnd() * 2);
          let loop = [];
          for (let x = 0; x < bw; x++) loop.push([x, 0]);
          for (let y = 1; y < bh; y++) loop.push([bw - 1, y]);
          for (let x = bw - 2; x >= 0; x--) loop.push([x, bh - 1]);
          for (let y = bh - 2; y >= 1; y--) loop.push([0, y]);
          const bumps = [0, 0, 1, 1, 2][Math.floor(rnd() * 5)];
          for (let n = 0; n < bumps; n++) {
            for (let t = 0; t < 12 && loop.length + 2 <= MAX_LOOP; t++) {
              const i = Math.floor(rnd() * loop.length), a = loop[i], b = loop[(i + 1) % loop.length];
              const dx = b[0] - a[0], dy = b[1] - a[1], sgn = rnd() < 0.5 ? 1 : -1, nx = -dy * sgn, ny = dx * sgn;
              const a2 = [a[0] + nx, a[1] + ny], b2 = [b[0] + nx, b[1] + ny];
              if ([a2, b2].some(c => loop.some(q => q[0] === c[0] && q[1] === c[1]))) continue;
              loop.splice(i + 1, 0, a2, b2);       /* a → a2 → b2 → b（往外或往內推出一個凸起） */
              break;
            }
          }
          if (rnd() < 0.5) loop = loop.map(c => [c[1], c[0]]);      /* 橫的、直的都有 */
          if (rnd() < 0.5) loop.reverse();                          /* 順時針、逆時針都有 */
          const minX = Math.min(...loop.map(c => c[0])), minY = Math.min(...loop.map(c => c[1]));
          return loop.map(c => [c[0] - minX, c[1] - minY]);
        };
        const beltNear = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h && isBelt(fx[at(nx, ny)])) return true; } return false; };
        const placeLoop = () => {
          for (let attempt = 0; attempt < 10; attempt++) {
            const rel = makeLoop();
            const start = pickCell(Math.ceil(cx) - 1, Math.ceil(cy) - 1, (x, y) => rel.every(([rx, ry]) => x + rx < cx && y + ry < cy && free(x + rx, y + ry) && !beltNear(x + rx, y + ry)));
            if (!start) continue;
            rel.forEach(([rx, ry], k) => {
              const nxt = rel[(k + 1) % rel.length], vec = [nxt[0] - rx, nxt[1] - ry];
              for (const [gx, gy, fxl, fyl] of group(start[0] + rx, start[1] + ry)) {
                const dx = fxl ? -vec[0] : vec[0], dy = fyl ? -vec[1] : vec[1];
                fx[at(gx, gy)] = FX_BELT + (dy < 0 ? 0 : dy > 0 ? 1 : dx < 0 ? 2 : 3);
              }
            });
            return rel.length;
          }
          return 0;
        };
        const first = placeLoop();
        if (first && first <= 6 && large && rnd() < 0.3) placeLoop();       /* 第一圈小的、而且是大圖，才有機會再多一個環 */
      } else {
        /* 尖刺、草叢、緩速格：一格一格散開，彼此不能相連（輸送帶是唯一例外）；數量規則一樣：小圖 2～6 格、大圖 4～8 格。
           機關一多會干擾操作；草叢還會讓人和炸彈完全看不到，更不能多 */
        const code = kind === 'spike' ? FX_SPIKE : kind === 'grass' ? FX_GRASS : FX_SLOW;
        const target = large ? 2 * (2 + Math.floor(rnd() * 3)) : 2 * (1 + Math.floor(rnd() * 3));
        const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp; } return arr; };
        const wall = (x, y) => grid[at(x, y)] === 1;
        /* 草叢只放走道格：左右都是硬牆、或上下都是硬牆（邊框也算），裡面的炸彈就只會沿著剩下那條直線炸；符合的格子不夠就少放，甚至這張圖沒有草叢 */
        const suits = kind === 'grass' ? (x, y) => (wall(x - 1, y) && wall(x + 1, y)) || (wall(x, y - 1) && wall(x, y + 1)) : () => true;
        const cands = [];
        for (let y = 1; y <= Math.floor(cy); y++) for (let x = 1; x <= Math.floor(cx); x++) if (free(x, y, true) && suits(x, y)) cands.push([x, y]);
        /* 不能相連：八個方向（含斜角）都不能已經有機關，同一組鏡像的格子彼此也不能相鄰 */
        const touches = g => g.some(([gx, gy]) => {
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = gx + dx, ny = gy + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            if (fx[at(nx, ny)] !== 0 || g.some(q => q[0] === nx && q[1] === ny)) return true;
          }
          return false;
        });
        let count = 0;
        for (const c of shuffle(cands)) {
          if (count >= target) break;
          const g = group(c[0], c[1]);
          if (g.length < 2 || count + g.length > target || touches(g)) continue;     /* 正中央那一格（只有 1 個）不放，免得總數變奇數 */
          for (const [gx, gy] of g) {
            fx[at(gx, gy)] = code;
            if (kind !== 'slow' && grid[at(gx, gy)] === 2) grid[at(gx, gy)] = 0;     /* 尖刺、草叢要讓人看得見，所以開局不蓋軟磚；緩速格可以和軟磚疊在一起 */
          }
          count += g.length;
        }
      }
    }
    return fx;
  }

  /* ---------- 建立一局 ---------- */
  /**
   * opts：{ seed, players:[{slot,name,animal,kind,level}], layout, themeId, timeLimit, items, curses, countdown, soften, fx }
   * layout 可填 'random'（由 seed 決定）；themeId 填 -1 也是隨機；fx 填 false 就沒有地圖機關。
   */
  function createGame(opts) {
    const seed = (opts.seed == null ? 1 : opts.seed) >>> 0;
    const pick = mulberry32(seed ^ 0x9e3779b9);
    const count = opts.players.length;
    const { w, h } = sizeFor(count);
    let themeId = opts.themeId;
    if (themeId == null || themeId < 0) themeId = Math.floor(pick() * THEME_COUNT);
    let layout = opts.layout;
    /* 「產線」版型只有日月光廠房主題有：日月光固定用產線版型（不管選了什麼版型）；其他主題不開放產線，舊設定裡的 fab 當成隨機 */
    if (themeId === FAB_THEME) layout = 'fab';
    else if (!layout || layout === 'random' || layout === 'fab') layout = RANDOM_LAYOUTS[Math.floor(pick() * RANDOM_LAYOUTS.length)];
    const grid = generateMap(seed, w, h, layout, opts.density, opts.soften);
    /* 每局隨機分配出生點：只在「已清出安全區」的點之間洗牌，所以每個位置一樣公平；同一個 seed 洗出來一樣（連線雙方一致） */
    const spawns = spawnPoints(w, h).slice(0, spawnCount(w, h));
    { const sr = mulberry32((seed ^ 0x51ed270b) >>> 0); for (let i = spawns.length - 1; i > 0; i--) { const j = Math.floor(sr() * (i + 1)); const t = spawns[i]; spawns[i] = spawns[j]; spawns[j] = t; } }
    const fx = opts.fx === false ? new Array(w * h).fill(0) : generateFx(seed, w, h, grid, themeId, layout);
    const state = {
      seed, rng: (seed ^ 0xa5a5a5a5) | 0, w, h, grid, fx, layout, themeId,
      phase: 'countdown', countdown: opts.countdown == null ? COUNTDOWN : opts.countdown,
      time: 0, timeLimit: opts.timeLimit == null ? 180 : opts.timeLimit,
      items: opts.items !== false, curses: opts.curses !== false,
      players: [], bombs: [], flames: [], itemsOn: [], events: [],
      nextId: 1, gridVer: 1, result: null, endHold: 0, airAt: AIR_EVERY, plane: null, skyStart: skyStartFor(opts.timeLimit == null ? 180 : opts.timeLimit), skyAt: skyStartFor(opts.timeLimit == null ? 180 : opts.timeLimit)
    };
    opts.players.forEach((p, i) => {
      const [sx, sy] = spawns[i % spawns.length];
      state.players.push({
        slot: p.slot == null ? i : p.slot, idx: i, name: p.name || ('玩家' + (i + 1)), animal: p.animal || 'cat',
        kind: p.kind || 'human', level: p.level || null,
        x: sx + 0.5, y: sy + 0.5, dir: 'D', moving: false, alive: true,
        fire: statsOf(p.animal || 'cat').fire, maxBombs: statsOf(p.animal || 'cat').bomb, speedLvl: 0, kick: false, shield: false,
        curse: null, invuln: 0, bombsOut: 0, kills: 0, autoT: 0, ghostT: 0, superT: 0,
        diedAt: null, killer: null, cause: null, left: false
      });
    });
    return state;
  }

  /* ---------- 查詢輔助 ---------- */
  const cellIdx = (s, x, y) => y * s.w + x;
  const inside = (s, x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h;
  const cellOf = p => ({ x: Math.floor(p.x), y: Math.floor(p.y) });
  /** 被火燒的判定格：身體（左右 ±HALF、上下 −BODY_UP～+BODY_DOWN）壓到的格子裡，左右、上下的重疊比例都 ≥ HALF_BODY 的全部算 */
  function hurtCells(p) {
    const out = [], bw = 2 * HALF, bh = BODY_UP + BODY_DOWN;
    const x0 = p.x - HALF, x1 = p.x + HALF, y0 = p.y - BODY_UP, y1 = p.y + BODY_DOWN, y2 = p.y + Math.max(BODY_DOWN, FEET_REACH);
    for (let cy = Math.floor(y0); cy <= Math.floor(y2); cy++) for (let cx = Math.floor(x0); cx <= Math.floor(x1); cx++) {
      const ox = Math.min(x1, cx + 1) - Math.max(x0, cx), oy = Math.max(0, Math.min(y1, cy + 1) - Math.max(y0, cy));
      const feet = Math.max(0, Math.min(p.y + FEET_REACH, cy + 1) - Math.max(p.y, cy)) / FEET_REACH;
      /* 一格一格算：整個身體壓不到 60%、下半身也壓不到 20% 的格子都不算 */
      const side = cx + 0.5 < p.x ? SIDE_LEFT : SIDE_RIGHT;      /* 這一格在角色的左邊還是右邊 */
      if (ox / bw >= side - 1e-9 && (oy / bh >= HALF_BODY - 1e-9 || feet >= FEET_HIT - 1e-9)) out.push({ x: cx, y: cy });
    }
    return out;
  }
  /**
   * 這個人被哪一格火焰燒到（沒有就回 null）：
   *  1. 單一火線格：身體壓在這一格的比例（左右、上下都要）≥ HALF_BODY 就被炸。站在同一條線上的兩格各一半，每格都不到門檻，不會被這顆炸彈波及（半身機制）。
   *  2. 並排的火線：同方向（都是橫火、或都是直火）的火線跨了兩排／兩欄以上，身體壓到的面積加起來達到門檻就被炸 —— 否則站在並排火線的中間，
   *     每格都只有一半（甚至 2×2 每格 25%），會明明整個身體都在火裡卻不死。只有一排（同一條線上各壓一半）不算並排，維持半身機制。
   */
  function flameHit(s, p) {
    const bw = 2 * HALF, bh = BODY_UP + BODY_DOWN;
    const x0 = p.x - HALF, x1 = p.x + HALF, y0 = p.y - BODY_UP, y1 = p.y + BODY_DOWN, y2 = p.y + Math.max(BODY_DOWN, FEET_REACH);
    const cells = [];
    for (let cy = Math.floor(y0); cy <= Math.floor(y2); cy++) for (let cx = Math.floor(x0); cx <= Math.floor(x1); cx++) {
      const f = flameAt(s, cx, cy);
      if (!f || f.cool) continue;
      cells.push({ f, cx, cy, side: cx + 0.5 < p.x ? SIDE_LEFT : SIDE_RIGHT, fx: (Math.min(x1, cx + 1) - Math.max(x0, cx)) / bw, fy: Math.max(0, Math.min(y1, cy + 1) - Math.max(y0, cy)) / bh,
        feet: Math.max(0, Math.min(p.y + FEET_REACH, cy + 1) - Math.max(p.y, cy)) / FEET_REACH });
    }
    const th = HALF_BODY - 1e-9;
    for (const a of cells) if (a.fx >= a.side - 1e-9 && (a.fy >= th || a.feet >= FEET_HIT - 1e-9)) return a.f;      /* 整個身體壓到 75%，或下半身壓到 25% */
    /* 並排的火線：壓到的火焰格不是排在「同一條線」上（橫火都在同一排、或直火都在同一欄才算同一條線），
       就把壓到的面積全部加起來，達到門檻就被炸（含十字交叉的中心格、橫火直火混在一起、兩排／兩欄並排、2×2 區塊）；
       只有一條線（同一條線上各壓一半）不算並排，維持半身機制 */
    const touch = cells.filter(c => c.fx * c.fy > 1e-9);        /* 只算身體真的有壓到（面積 > 0）的火焰格，擦邊沒壓到的不算 */
    if (touch.length >= 2) {
      const sameRow = touch.every(c => c.cy === touch[0].cy && c.f.h), sameCol = touch.every(c => c.cx === touch[0].cx && c.f.v);
      if (!sameRow && !sameCol) {
        let area = 0; for (const c of touch) area += c.fx * c.fy;
        if (area >= th) return touch[0].f;
      }
    }
    return null;
  }
  /* 超人標誌期間：火力、炸彈數、加速都拉到「這隻角色」的上限（詛咒照樣有效，所以遲緩、短火還是會壓過它） */
  const fireOf = p => p.superT > 0 ? Math.max(p.fire, statsOf(p.animal).max.fire) : p.fire;
  const speedLvlOf = p => p.superT > 0 ? Math.max(p.speedLvl, statsOf(p.animal).max.speed) : p.speedLvl;
  function speedOf(p) {
    if (p.curse && p.curse.type === 'c_slow') return SPEED.slow;
    return SPEED.base + SPEED.trait * (statsOf(p.animal).speed - 1.5) + SPEED.step * speedLvlOf(p);
  }
  function rangeOf(p) { return p.curse && p.curse.type === 'c_short' ? 1 : fireOf(p); }
  function maxBombsOf(p) { return p.superT > 0 ? Math.max(p.maxBombs, statsOf(p.animal).max.bomb) : p.maxBombs; }
  /** 方向顛倒詛咒：上下左右對調（移動與預測共用 movePlayer，所以伺服器和本機預測一致） */
  const FLIP = { U: 'D', D: 'U', L: 'R', R: 'L' };
  const flipDir = (p, dir) => (dir && p.curse && p.curse.type === 'c_flip' ? FLIP[dir] : dir);
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
    const cells = [{ x: b.cx, y: b.cy, h: true, v: true }];     /* h／v：這一格是橫向、直向的火線（中心兩者都是），並排火線的判定要用 */
    const softs = [];
    const chain = [];
    for (const d of Object.values(DIRS)) {
      for (let i = 1; i <= b.range; i++) {
        const x = b.cx + d[0] * i, y = b.cy + d[1] * i;
        if (!inside(s, x, y)) break;
        const g = s.grid[cellIdx(s, x, y)];
        if (g === 1) break;
        cells.push({ x, y, h: d[0] !== 0, v: d[1] !== 0 });
        if (g === 2) { softs.push({ x, y }); break; }
        const other = bombAt(s, x, y);
        /* 碰到別的炸彈：引爆它，但火焰不會被擋住，照樣噴完自己的射程（連鎖時每個方向以最長的那顆為準）；只有硬牆、軟磚才會擋 */
        if (other && other !== b) chain.push(other);
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
  /* 踢炸彈：往 (dx, dy) 走會撞到、而且在前方的炸彈裡，選「身體最對準它那條線」的一顆（同時碰到兩顆時踢比較對準的，不是隨便一顆）；
     身體至少有 KICK_OVERLAP（25%，比半個身體還少很多）壓在炸彈的線上就踢得到，不必對得很準。身體寬 2×HALF；中心離炸彈那條線的距離 o，壓在線上的寬度是 (0.5 + HALF − o)，
     所以門檻是 o ≤ 0.5 + HALF − 2×HALF×KICK_OVERLAP（50% 時是 0.5：中心在炸彈格的邊線上；現在 25%，約 0.68：中心離線再多一點也踢得到） */
  const KICK_OVERLAP = 0.25;     /* 比火焰的半身門檻（60%）寬鬆很多：踢球希望容易踢到，火焰希望一半站位安全 */
  const KICK_REACH = 0.5 + HALF - 2 * HALF * KICK_OVERLAP;
  function kickTarget(s, p, nx, ny, dx, dy) {
    const x0 = Math.floor(nx - HALF), x1 = Math.floor(nx + HALF - 1e-9);
    const y0 = Math.floor(ny - HALF), y1 = Math.floor(ny + HALF - 1e-9);
    let best = null, bestOff = 9;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const b = bombAt(s, x, y);
      if (!b || b.pass.indexOf(p.slot) >= 0) continue;
      const along = dx !== 0 ? (b.cx + 0.5 - p.x) * dx : (b.cy + 0.5 - p.y) * dy;
      if (along <= 0) continue;
      const off = dx !== 0 ? Math.abs(p.y - (b.cy + 0.5)) : Math.abs(p.x - (b.cx + 0.5));
      if (off < bestOff) { best = b; bestOff = off; }
    }
    return best && bestOff <= KICK_REACH + 1e-9 ? best : null;
  }
  function slideFree(s, x, y) {
    if (!inside(s, x, y) || s.grid[cellIdx(s, x, y)] !== 0 || bombAt(s, x, y)) return false;
    for (const q of s.players) if (q.alive && overlapsCell(q, x, y)) return false;
    return true;
  }

  /** 草叢：站在草叢裡的活人，任何人都看不到（對手、電腦、旁觀的、淘汰的，連自己也看不到自己），沒有例外 */
  function hiddenInGrass(s, q) {
    if (!q || !q.alive) return false;
    const c = cellOf(q);
    return fxAt(s, c.x, c.y) === FX_GRASS;
  }
  /** 草叢：玩家放在草叢裡的炸彈任何人都看不到（包括放的人自己、電腦、觀戰的）；它的火力線預警另外照樣顯示。
   *  空襲炸彈（owner −1）是環境事件，永遠看得到，不然掉進草叢就像「空襲沒出現」 */
  function bombHiddenInGrass(s, b) { return b.owner >= 0 && fxAt(s, b.cx, b.cy) === FX_GRASS; }
  /** 輸送帶：站在帶子上被往帶子方向推，同時慢慢拉回格子中線（才不會貼著牆卡住）；撞到東西就不動 */
  function conveyPlayer(s, p, dt) {
    const c = cellOf(p), f = fxAt(s, c.x, c.y);
    if (!isBelt(f)) return;
    const [dx, dy] = BELT_VEC[f], d = BELT_SPEED * dt;
    let nx = p.x + dx * d, ny = p.y + dy * d;
    if (dx !== 0) { const off = c.y + 0.5 - p.y; ny += Math.sign(off) * Math.min(Math.abs(off), d); }
    else { const off = c.x + 0.5 - p.x; nx += Math.sign(off) * Math.min(Math.abs(off), d); }
    if (!collides(s, p, nx, ny)) { p.x = nx; p.y = ny; return; }
    nx = p.x + dx * d; ny = p.y + dy * d;
    if (!collides(s, p, nx, ny)) { p.x = nx; p.y = ny; }
  }

  function movePlayer(s, p, dir, dt) {
    dir = flipDir(p, dir);
    if (!dir || !DIRS[dir]) { p.moving = false; return; }
    p.dir = dir;
    const [dx, dy] = DIRS[dir];
    const under = cellOf(p);
    const dist = speedOf(p) * (fxAt(s, under.x, under.y) === FX_SLOW ? SLOW_MULT : 1) * dt;
    const nx = p.x + dx * dist, ny = p.y + dy * dist;
    if (!collides(s, p, nx, ny)) { p.x = nx; p.y = ny; p.moving = true; return; }

    /* 擋住了：先看是不是炸彈、有踢炸彈能力就踢 */
    const b = p.kick ? kickTarget(s, p, nx, ny, dx, dy) : null;
    if (b && !b.sl && slideFree(s, b.cx + dx, b.cy + dy)) {
      b.cx += dx; b.cy += dy; b.sl = { dx, dy, prog: 0 };
      s.events.push({ t: 'kick', x: b.cx, y: b.cy });
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

  /**
   * 被輸送帶載著走的炸彈。f 是這一格走了幾成（0～1）；過半就算進到下一格（爆炸位置離畫面上的炸彈最多半格），
   * sl.prog 是給畫面的：畫面把炸彈畫在「所在格往後退 (1 - prog) 格」的地方，所以過半前（還算舊格）是 1 + f、過半後是 f。
   * 走到下一格的中心後，如果還在帶子上就照那一格的方向繼續（轉彎），不在帶子上或前面被擋住（牆、磚、炸彈、人）就停。
   */
  function stepBeltBomb(s, b, dt) {
    const st = b.sl;
    st.f += BELT_SPEED * dt;
    if (!st.sw && st.f >= 0.5) {
      if (slideFree(s, b.cx + st.dx, b.cy + st.dy)) { b.cx += st.dx; b.cy += st.dy; st.sw = true; }
      else st.f = 0.499;                       /* 前面突然有人或東西：先停在半路，等路通了再走 */
    }
    if (st.sw && st.f >= 1) {
      const rem = st.f - 1, f = fxAt(s, b.cx, b.cy);
      if (isBelt(f) && slideFree(s, b.cx + BELT_VEC[f][0], b.cy + BELT_VEC[f][1])) { st.dx = BELT_VEC[f][0]; st.dy = BELT_VEC[f][1]; st.f = rem; st.sw = false; }
      else { b.sl = null; return; }
    }
    st.prog = st.sw ? st.f : 1 + st.f;
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
    return inside(s, x, y) && s.grid[cellIdx(s, x, y)] === 0 && !bombAt(s, x, y) && !itemAt(s, x, y) && !flameAt(s, x, y) && fxAt(s, x, y) !== FX_SPIKE;
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
  /** 這個時間點這一批要掉幾顆炸彈（空襲開始前 0 顆；start 預設 150 秒） */
  function skyCount(time, start) { const a = start == null ? SKY_START : start; return time < a ? 0 : Math.min(SKY_MAX, 1 + Math.floor((time - a) / SKY_STEP)); }
  /** 空襲：每隔 SKY_EVERY 秒，從天上掉 skyCount 顆炸彈到隨機空格（沒有磚、牆、炸彈、火焰，也沒有人站在上面的格子） */
  function stepSky(s) {
    if (s.phase !== 'play') return;
    while (s.time >= s.skyAt) {
      const n = skyCount(s.skyAt, s.skyStart);
      s.skyAt += SKY_EVERY;
      for (let k = 0; k < n; k++) {
        const free = [];
        for (let y = 1; y < s.h - 1; y++) for (let x = 1; x < s.w - 1; x++) {
          if (s.grid[cellIdx(s, x, y)] !== 0 || bombAt(s, x, y) || flameAt(s, x, y) || fxAt(s, x, y) === FX_SPIKE) continue;
          if (s.players.some(q => q.alive && overlapsCell(q, x, y))) continue;
          free.push(y * s.w + x);
        }
        if (!free.length) break;
        const i = free[Math.floor(rand(s) * free.length)], x = i % s.w, y = (i / s.w) | 0;
        s.bombs.push({ id: s.nextId++, owner: -1, cx: x, cy: y, t: SKY_FUSE, range: SKY_RANGE, pass: [], sl: null });
        s.events.push({ t: 'sky', x, y });
      }
    }
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
        if (f) { if (!cool) { f.t = FLAME_T; f.cool = false; } f.owner = b.owner; f.h = f.h || c.h; f.v = f.v || c.v; }
        else s.flames.push({ cx: c.x, cy: c.y, t: cool ? FLAME_COOL_T : FLAME_T, owner: b.owner, cool, h: c.h, v: c.v });
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
    const st = statsOf(p.animal);
    for (let i = 0; i < p.fire - st.fire; i++) owned.push('fire');
    for (let i = 0; i < p.maxBombs - st.bomb; i++) owned.push('bomb');
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
      case 'fire': p.fire = Math.min(statsOf(p.animal).max.fire, p.fire + 1); break;
      case 'bomb': p.maxBombs = Math.min(statsOf(p.animal).max.bomb, p.maxBombs + 1); break;
      case 'speed': p.speedLvl = Math.min(statsOf(p.animal).max.speed, p.speedLvl + 1); break;
      case 'kick': p.kick = true; break;
      case 'shield': p.shield = true; break;
      case 'ghost': p.ghostT = GHOST_T; break;
      case 'super': p.superT = SUPER_T; break;
      case 'ultra': p.fire = Math.max(p.fire, statsOf(p.animal).max.fire); break;   /* 永久：火力直接升到這隻角色的上限 */
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
      if (p.ghostT > 0) p.ghostT = Math.max(0, p.ghostT - dt);
      if (p.superT > 0) p.superT = Math.max(0, p.superT - dt);
      if (p.curse) { p.curse.t -= dt; if (p.curse.t <= 0) p.curse = null; }
      movePlayer(s, p, inp ? inp.dir : null, dt);
      if (inp && inp.dir2 && inp.dir2 !== inp.dir && !p.moving) movePlayer(s, p, inp.dir2, dt);
      conveyPlayer(s, p, dt);
      if (inp && inp.bomb) { placeBomb(s, p); }
      if (inp) inp.bomb = false;
      if (playing && p.curse && p.curse.type === 'c_auto') {
        p.autoT -= dt;
        if (p.autoT <= 0) { p.autoT = AUTO_BOMB_EVERY; placeBomb(s, p); }
      }
      pickup(s, p);
    }

    stepSky(s);

    /* 炸彈：倒數、滑行、玩家離開後變實心 */
    for (const b of s.bombs) {
      b.t -= dt;
      if (b.pass.length) b.pass = b.pass.filter(sl => { const q = getPlayer(s, sl); return q && q.alive && overlapsCell(q, b.cx, b.cy); });
      if (!b.sl && isBelt(fxAt(s, b.cx, b.cy))) {
        /* 輸送帶：停在帶子上的炸彈被載著走（速度同人），沿路跟著帶子轉彎 */
        const [dx, dy] = BELT_VEC[fxAt(s, b.cx, b.cy)];
        if (slideFree(s, b.cx + dx, b.cy + dy)) b.sl = { dx, dy, prog: 1, f: 0, sw: false, belt: true };
      }
      if (b.sl && b.sl.belt) stepBeltBomb(s, b, dt);
      else if (b.sl) {
        b.sl.prog += SLIDE_SPEED * dt;
        while (b.sl && b.sl.prog >= 1) {
          b.sl.prog -= 1;
          const nx = b.cx + b.sl.dx, ny = b.cy + b.sl.dy;
          if (slideFree(s, nx, ny)) { b.cx = nx; b.cy = ny; } else { b.sl = null; }
        }
      }
      /* 尖刺：炸彈放在上面、被踢上去（踢的當下就算進到那一格）、或滑到上面，立刻爆炸，歸放炸彈的人 */
      if (b.t > 0 && fxAt(s, b.cx, b.cy) === FX_SPIKE) { b.t = 0; b.sl = null; s.events.push({ t: 'spike', x: b.cx, y: b.cy }); }
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
        const hitBy = flameHit(s, p);
        if (hitBy) hurt(s, p, hitBy.owner);
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
  const CURSE_CODE = { c_slow: 1, c_auto: 2, c_short: 3, c_flip: 4 };
  const CURSE_NAME = [null, 'c_slow', 'c_auto', 'c_short', 'c_flip'];
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
        p.kills, Math.round(p.invuln * 10), p.bombsOut, Math.round(p.ghostT * 10), Math.round(p.superT * 10)
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

  /**
   * 隱身：在快照裡把指定玩家標成「對這位觀看者來說是隱身」（第 5 欄的旗標 16），回傳淺拷貝，原本的快照不動。
   * 位置、方向、移動狀態照送：隱身的人還是要讓人隱約看到身形（畫面上只剩約 17% 的淡淡輪廓），
   * 不是完全消失；電腦對手另外在 ai.js 裡完全看不到隱身的人。
   */
  function hideInSnapshot(snap, slots) {
    if (!slots.length) return snap;
    return Object.assign({}, snap, {
      p: snap.p.map(a => {
        if (slots.indexOf(a[0]) < 0) return a;
        const b = a.slice();
        b[4] = a[4] | 16;
        return b;
      })
    });
  }

  /** 靜態資料（開局時送一次）：地圖尺寸、玩家名單、規則設定 */
  function startInfo(s) {
    return {
      seed: s.seed, w: s.w, h: s.h, layout: s.layout, themeId: s.themeId, timeLimit: s.timeLimit,
      items: s.items, curses: s.curses,
      players: s.players.map(p => ({ slot: p.slot, name: p.name, animal: p.animal, kind: p.kind, level: p.level })),
      g: gridString(s), fx: s.fx.join('')
    };
  }

  /** 客戶端：用開局資料建立可繪製的狀態 */
  function viewFromStart(info) {
    return {
      seed: info.seed, w: info.w, h: info.h, layout: info.layout, themeId: info.themeId, timeLimit: info.timeLimit,
      items: info.items, curses: info.curses,
      grid: info.g.split('').map(Number), gridVer: 1, fx: info.fx ? info.fx.split('').map(Number) : new Array(info.w * info.h).fill(0),
      phase: 'countdown', countdown: COUNTDOWN, time: 0, result: null,
      players: info.players.map((p, i) => Object.assign({
        idx: i, x: 0, y: 0, dir: 'D', moving: false, alive: true, shield: false, left: false,
        fire: statsOf(p.animal).fire, maxBombs: statsOf(p.animal).bomb, speedLvl: 0, kick: false, curse: null, invuln: 0, kills: 0, bombsOut: 0, ghostT: 0, superT: 0, hidden: false
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
      p.hidden = !!(a[4] & 16);          /* 對這位觀看者是隱身：位置照送，畫面只畫淡淡的身形 */
      p.x = a[1] / 100; p.y = a[2] / 100; p.dir = a[3];
      p.alive = !!(a[4] & 1); p.moving = !!(a[4] & 2); p.shield = !!(a[4] & 4); p.left = !!(a[4] & 8);
      p.fire = a[5]; p.maxBombs = a[6]; p.speedLvl = a[7]; p.kick = !!a[8];
      p.curse = a[9] ? { type: CURSE_NAME[a[9]], t: a[10] / 10 } : null;
      p.kills = a[11]; p.invuln = a[12] / 10; p.bombsOut = a[13]; p.ghostT = (a[14] || 0) / 10; p.superT = (a[15] || 0) / 10;
    }
    v.bombs = snap.b.map(a => ({
      id: a[0], cx: a[1], cy: a[2], t: a[3] / 100, owner: a[4],
      sl: a[5] || a[6] ? { dx: a[5], dy: a[6], prog: a[7] / 100 } : null, range: a[8]
    }));
    v.flames = snap.f.map(a => ({ cx: a[0], cy: a[1], t: a[2] / 100 }));
    v.itemsOn = snap.i.map(a => ({ id: a[0], cx: a[1], cy: a[2], type: ITEM_TYPES[a[3]] }));
    v.plane = snap.pl ? { x: snap.pl[0] / 100, row: snap.pl[1], dir: snap.pl[2] } : null;
    v.events = snap.e || [];
    return v;
  }

  root.Rules = {
    DT, DIRS, FUSE, AIR_EVERY, SKY_START, SKY_EVERY, SKY_STEP, SKY_MAX, SKY_FUSE, SKY_RANGE, SKY_LAST, skyStartFor, skyCount, PLANE_SPEED, FLAME_T, HALF, HALF_BODY, SIDE_LEFT, SIDE_RIGHT, BODY_UP, BODY_DOWN, FEET_REACH, FEET_HIT, HURT_LIFT, hurtCells, START, MAX, SPEED, ANIMAL_STATS, statsOf, CURSE_T, GHOST_T, SUPER_T, COUNTDOWN, SLIDE_SPEED,
    KICK_OVERLAP, KICK_REACH, ITEM_TYPES, POSITIVE, CURSES, LAYOUTS, RANDOM_LAYOUTS, FAB_THEME, LAYOUT_NAMES, THEME_COUNT, SHAPES, SLOT_COLORS, DROP_WEIGHTS,
    mulberry32, rand, sizeFor, spawnCount, MAP_SMALL, MAP_LARGE, spawnPoints, generateMap, connected, createGame, step,
    blast, bombAt, itemAt, flameAt, cellOf, cellIdx, inside, speedOf, rangeOf, maxBombsOf, fireOf, speedLvlOf, flipDir, hideInSnapshot,
    canPlaceBomb, placeBomb, overlapsCell, movePlayer, slideFree, getPlayer, alivePlayers, collides, removePlayer, finish,
    snapshot, startInfo, viewFromStart, applySnapshot, gridString,
    FX_GRASS, FX_SLOW, FX_SPIKE, FX_BELT, BELT_VEC, SLOW_MULT, BELT_SPEED, THEME_FX, FX_KEEP, generateFx, fxAt, isBelt, beltIn, conveyPlayer, hiddenInGrass, bombHiddenInGrass
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Rules;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
