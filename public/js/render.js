/* ===== render.js — 對局畫面（Canvas 2D，所有圖都來自 art.js 的向量繪製） =====
 * Renderer.draw(view, opts) 只讀狀態、不改規則；單機與線上共用。
 */
(function (root) {
  'use strict';
  const R = root.Rules, Art = root.Art;
  const FACE = { U: 'up', D: 'down', L: 'left', R: 'left' };

  function shapePath(ctx, shape, x, y, r) {
    ctx.beginPath();
    switch (shape) {
      case 'triangle': ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.8); ctx.lineTo(x - r, y + r * 0.8); ctx.closePath(); break;
      case 'square': ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7); break;
      case 'diamond': ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 1.15); ctx.lineTo(x - r, y); ctx.closePath(); break;
      case 'star': for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r * 1.1; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); break;
      case 'cross': { const w = r * 0.38; ctx.rect(x - w, y - r, w * 2, r * 2); ctx.rect(x - r, y - w, r * 2, w * 2); break; }
      case 'heart': ctx.moveTo(x, y + r * 0.9); ctx.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.7, y - r * 1.1, x, y - r * 0.35); ctx.bezierCurveTo(x + r * 0.7, y - r * 1.1, x + r * 1.5, y - r * 0.1, x, y + r * 0.9); ctx.closePath(); break;
      case 'moon': ctx.arc(x, y, r, 0.5, Math.PI * 2 - 0.5); ctx.arc(x + r * 0.45, y, r * 0.8, Math.PI * 2 - 0.9, 0.9, true); ctx.closePath(); break;
      default: ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  }

  /* 各種圖在畫面上的大小，都是「一格邊長」的倍數：格子放大，人物、道具、炸彈就跟著等比放大 */
  /* foot：人物腳下的影子與光圈（眼睛讀到的「位置」）離判定中心往下多少格。以前是 0.34，上下方向的位置感比判定低一截，
     左右卻沒有，所以火線的半身感覺上下左右不一致；現在整個人物往上提，讓腳落在判定中心附近（≤ 0.15），看到的位置就是判定的位置 */
  const SPRITE = { animal: 1.12, item: 0.82, bomb: 1.1, plane: 2.1, bombOverAlpha: 0.25, foot: 0.08, ghostFaint: 0.17 };   /* ghostFaint：隱身的人在對手眼裡的淡淡身形（不透明度），要看得出來但不搶眼 */
  const PLANE_LIFT = 2.4;      /* 空投機機身比它的影子（投下道具的那一列）高幾格，不擋住視線 */
  const PLANE_ALPHA = 0.88;    /* 機身稍微透明，蓋到人物時還看得出底下 */
  const SHADOW_DROP = 0.34;   /* 原本影子在判定中心下方的距離，人物圖本身的腳大約就在這裡 */   /* 炸彈要跟人物差不多大，人物站在同一格才不會把它整顆蓋住 */

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.T = 0; this.dpr = 1;
      this.view = null; this.themeId = -1; this.tiles = null;
      this.statics = null; this.staticVer = -1; this.prevGrid = null;
      this.sprites = new Map(); this.itemImgs = new Map(); this.bombImg = null; this.loading = new Set();
      this.parts = []; this.pos = new Map(); this.deaths = new Map(); this.shake = 0;
      this.last = 0; this.dirty = true; this.snapSeq = 0; this.drops = [];
    }

    /** 一格的 CSS 像素邊長：整張地圖剛好塞進可用空間的最大整數（至少 12），不設上限，格子數越少每格越大 */
    static tileCss(availW, availH, w, h) { return Math.max(12, Math.floor(Math.min(availW / w, availH / h))); }

    /** 依可用空間算出格子大小並調整畫布；回傳實際 CSS 尺寸 */
    fit(availW, availH, w, h) {
      const dpr = Math.min(3, root.devicePixelRatio || 1);
      const tCss = Renderer.tileCss(availW, availH, w, h);
      const T = Math.round(tCss * dpr);
      if (T !== this.T || dpr !== this.dpr || this.canvas.width !== w * T) {
        this.T = T; this.dpr = dpr;
        this.canvas.width = w * T; this.canvas.height = h * T;
        this.tiles = null; this.statics = null; this.vig = null; this.preT = 0; this.gen = (this.gen || 0) + 1; this.sprites.clear(); this.itemImgs.clear(); this.bombImg = null; this.loading.clear();
      }
      const cssW = w * T / dpr, cssH = h * T / dpr;
      this.canvas.style.width = cssW + 'px'; this.canvas.style.height = cssH + 'px';
      return { w: cssW, h: cssH, tile: T / dpr };
    }

    markSnap() { this.snapSeq++; }

    reset() {
      this.parts = []; this.pos.clear(); this.deaths.clear(); this.prevGrid = null; this.staticVer = -1; this.statics = null; this.tiles = null; this.themeId = -1; this.shake = 0; this.drops = [];
    }

    /* ----- 圖片快取（SVG → 依格子大小點陣化一次） ----- */
    loadSprite(key, svg, size) {
      if (this.sprites.has(key)) return this.sprites.get(key);
      if (this.loading.has(key)) return null;
      this.loading.add(key);
      const gen = this.gen;
      Art.svgImage(svg, img => {
        if (gen !== this.gen) return;   /* 格子大小已經變了：舊尺寸的圖丟掉，不然人物會一直卡在舊大小 */
        const c = document.createElement('canvas'); c.width = c.height = size;
        c.getContext('2d').drawImage(img, 0, 0, size, size);
        this.sprites.set(key, c); this.loading.delete(key); this.dirty = true;
      });
      return null;
    }
    animalSprite(animal, facing, frame) {
      const got = this.loadSprite(animal + '|' + facing + '|' + frame, Art.animalSVG(animal, facing, frame), Math.round(this.T * SPRITE.animal));
      if (got) return got;
      /* 還沒畫好時用同角色已有的圖頂著，避免人物整個消失造成閃爍 */
      for (const k of [animal + '|' + facing + '|0', animal + '|down|0', animal + '|left|0', animal + '|up|0']) { const c = this.sprites.get(k); if (c) return c; }
      return null;
    }
    /** 一次把所有隊員的 3 個方向 × 3 個步伐畫好，走動時就不會臨時載入 */
    preload(view) {
      if (this.preT === this.T) return;
      this.preT = this.T;
      for (const p of view.players) for (const f of ['down', 'up', 'left']) for (const fr of [0, 1, 2]) this.animalSprite(p.animal, f, fr);
      this.bombSprite(); this.planeSprite();
      for (const t of R.ITEM_TYPES) this.itemSprite(t);
    }
    itemSprite(type) { return this.loadSprite('item|' + type, Art.itemSVG(type), Math.round(this.T * SPRITE.item)); }
    planeSprite() { return this.loadSprite('plane', Art.planeSVG(), Math.round(this.T * SPRITE.plane)); }
    bombSprite() { return this.loadSprite('bomb', Art.bombSVG(), Math.round(this.T * SPRITE.bomb)); }

    ensureStatic(view) {
      const T = this.T;
      if (!this.tiles || this.themeId !== view.themeId) {
        this.tiles = Art.buildTileset(T, view.themeId); this.themeId = view.themeId; this.staticVer = -1;
      }
      if (this.staticVer !== view.gridVer || !this.statics) {
        /* 軟磚消失 → 噴碎片 */
        if (this.prevGrid && this.prevGrid.length === view.grid.length) {
          for (let i = 0; i < view.grid.length; i++) if (this.prevGrid[i] === 2 && view.grid[i] === 0) this.burst((i % view.w) + 0.5, ((i / view.w) | 0) + 0.5, this.tiles.theme.particle, 7, 'chip');
        }
        this.prevGrid = view.grid.slice();
        const c = this.statics || document.createElement('canvas');
        c.width = view.w * T; c.height = view.h * T;
        const g = c.getContext('2d');
        const at = (x, y) => (x < 0 || y < 0 || x >= view.w || y >= view.h) ? 1 : view.grid[y * view.w + x];
        const isEdge = (x, y) => x === 0 || y === 0 || x === view.w - 1 || y === view.h - 1;
        /* 第一層：地板與外框 */
        for (let y = 0; y < view.h; y++) for (let x = 0; x < view.w; x++) {
          if (isEdge(x, y)) g.drawImage(this.tiles.border, x * T, y * T);
          else g.drawImage((x + y) % 2 ? this.tiles.floorB : this.tiles.floorA, x * T, y * T);
        }
        const fab = this.tiles.theme && this.tiles.theme.id === 7;
        if (fab) {
          Art.drawFabFloor(g, T, view, at, isEdge);
          /* 外牆標誌：日月光標誌嵌在白色圓牌上，沿四邊每隔一格一枚 */
          if (!this.logoImg && root.ASE_LOGO) { this.logoImg = new Image(); this.logoImg.onload = () => { this.logoReady = true; this.staticVer = -1; }; this.logoImg.src = root.ASE_LOGO; }
          if (this.logoReady) {
            const put = (x, y) => {
              const cx = (x + 0.5) * T, cy = (y + 0.5) * T, r = T * 0.4;
              g.fillStyle = '#fffdf2'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
              g.lineWidth = Math.max(1.5, T * 0.04); g.strokeStyle = '#ffd84d'; g.stroke();
              g.drawImage(this.logoImg, cx - r * 0.78, cy - r * 0.78, r * 1.56, r * 1.56);
            };
            for (let x = 1; x < view.w - 1; x += 2) { put(x, 0); put(x, view.h - 1); }
            for (let y = 1; y < view.h - 1; y += 2) { put(0, y); put(view.w - 1, y); }
          }
        }
        /* 地圖機關：畫在地板上、磚塊底下（軟磚炸掉才看得到）；草叢的前排葉子與輸送帶的流動箭頭每幀另外畫 */
        this.fxList = { grass: [], belt: [] };
        const fxT = this.tiles.fx;
        if (view.fx && fxT) {
          for (let y = 1; y < view.h - 1; y++) for (let x = 1; x < view.w - 1; x++) {
            const v = view.fx[y * view.w + x];
            if (!v || at(x, y) === 1) continue;
            if (v === R.FX_GRASS) { if (fxT.grassBack) { g.drawImage(fxT.grassBack, x * T, y * T); this.fxList.grass.push({ x, y }); } }
            else if (v === R.FX_SLOW) { if (fxT.slow) g.drawImage(fxT.slow, x * T, y * T); }
            else if (v === R.FX_SPIKE) { if (fxT.spike) g.drawImage(fxT.spike, x * T, y * T); }
            else if (R.isBelt(v) && fxT.belt) {
              /* 轉角（前一格的方向跟這一格不同）用彎曲的圖，直的用直的圖 */
              const inCode = R.beltIn(view.fx, view.w, x, y), turn = Art.beltTurn(v, inCode);
              g.drawImage(turn ? fxT.beltCorner[turn < 0 ? 1 : 0][inCode - R.FX_BELT] : fxT.belt[v - R.FX_BELT], x * T, y * T);
              this.fxList.belt.push({ x, y, code: v, inCode });
            }
          }
        }
        /* 第二層：牆體在地板上的投影（右下方光源）與外框內側陰影 */
        for (let y = 1; y < view.h - 1; y++) for (let x = 1; x < view.w - 1; x++) {
          if (at(x, y) !== 0) continue;
          const below = at(x, y - 1) !== 0 && !isEdge(x, y - 1), left = at(x - 1, y) !== 0 && !isEdge(x - 1, y);
          const top = isEdge(x, y - 1), side = isEdge(x - 1, y);
          if (below || top) { const gr = g.createLinearGradient(0, y * T, 0, y * T + T * 0.34); gr.addColorStop(0, top ? 'rgba(10,8,30,0.32)' : 'rgba(10,8,30,0.26)'); gr.addColorStop(1, 'rgba(10,8,30,0)'); g.fillStyle = gr; g.fillRect(x * T, y * T, T, T * 0.34); }
          if (left || side) { const gr = g.createLinearGradient(x * T, 0, x * T + T * 0.26, 0); gr.addColorStop(0, side ? 'rgba(10,8,30,0.26)' : 'rgba(10,8,30,0.18)'); gr.addColorStop(1, 'rgba(10,8,30,0)'); g.fillStyle = gr; g.fillRect(x * T, y * T, T * 0.26, T); }
        }
        /* 第三層：硬牆與軟磚 */
        for (let y = 1; y < view.h - 1; y++) for (let x = 1; x < view.w - 1; x++) {
          const v = at(x, y);
          if (v === 1 && fab) {
            const fc = document.createElement('canvas'); fc.width = T; fc.height = T;
            Art.drawFabHard(fc.getContext('2d'), T, { l: at(x - 1, y) === 1 && x - 1 > 0, r: at(x + 1, y) === 1 && x + 1 < view.w - 1, u: at(x, y - 1) === 1 && y - 1 > 0, d: at(x, y + 1) === 1 && y + 1 < view.h - 1, alt: (x + y) % 2 === 1 });
            g.drawImage(fc, x * T, y * T);
          } else if (v === 1) { const hv = this.tiles.hardV; g.drawImage(hv[Art.variantIndex(view.seed, x, y, hv.length)], x * T, y * T); }
          else if (v === 2) { const sv = this.tiles.softV; g.drawImage(sv[Art.variantIndex(view.seed + 5, x, y, sv.length)], x * T, y * T); }
        }
        this.statics = c; this.staticVer = view.gridVer;
      }
    }

    /* ----- 粒子與事件 ----- */
    burst(x, y, color, n, kind) {
      const T = this.T;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = (0.6 + Math.random() * 2.2) * T;
        this.parts.push({ x: x * T, y: y * T, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - T * 0.8, life: 0.45 + Math.random() * 0.35, max: 0.8, color, size: T * (0.06 + Math.random() * 0.06), kind: kind || 'dot', rot: Math.random() * 6 });
      }
    }
    consume(events, opts) {
      if (!events) return;
      const calm = opts && opts.reduceMotion;
      for (const e of events) {
        if (e.t === 'boom') { if (!calm) this.shake = Math.max(this.shake, 0.18); this.burst(e.x + 0.5, e.y + 0.5, '#ffb12e', calm ? 3 : 10, 'dot'); }
        else if (e.t === 'airdrop') { this.burst(e.x + 0.5, e.y + 0.5, '#ffe9a0', calm ? 4 : 12, 'star'); this.burst(e.x + 0.5, e.y + 0.5, '#ffffff', calm ? 2 : 6, 'dot'); }
        else if (e.t === 'item') this.burst(e.x + 0.5, e.y + 0.5, '#fff3a0', calm ? 3 : 9, 'star');
        else if (e.t === 'die') this.burst(e.x, e.y, '#fff3a0', calm ? 4 : 14, 'star');
        else if (e.t === 'place') this.burst(e.x + 0.5, e.y + 0.8, '#ffffff66', 4, 'dot');
        else if (e.t === 'spike') this.burst(e.x + 0.5, e.y + 0.5, '#ffffff', calm ? 3 : 8, 'star');
        else if (e.t === 'sky') this.drops.push({ x: e.x, y: e.y, t: 0 });   /* 空襲：炸彈從天上掉下來的動畫 */
      }
    }

    /* ----- 主繪製 ----- */
    draw(view, o) {
      o = o || {};
      const now = performance.now() / 1000;
      const dt = Math.min(0.1, this.last ? now - this.last : 0.016);
      this.last = now;
      const ctx = this.ctx, T = this.T;
      if (!T || !view) return;
      this.preload(view);
      this.ensureStatic(view);
      const W = view.w * T, H = view.h * T;

      ctx.save();
      ctx.clearRect(0, 0, W, H);
      if (this.shake > 0 && !o.reduceMotion) {
        const m = this.shake * T * 0.18;
        ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
        this.shake = Math.max(0, this.shake - dt);
      }
      ctx.drawImage(this.statics, 0, 0);

      /* 輸送帶：箭頭順著帶子方向流動（速度跟玩家被推的速度一致）；上面還蓋著軟磚的格子不畫 */
      const fxl = this.fxList, fxs = this.tiles.fx;
      if (fxl && fxl.belt.length && fxs.style.belt) {
        const ph = o.reduceMotion ? 0.3 : (now * R.BELT_SPEED * 2) % 1;
        for (const b of fxl.belt) {
          if (view.grid[b.y * view.w + b.x] !== 0) continue;
          ctx.save(); ctx.translate(b.x * T, b.y * T); Art.drawBeltArrows(ctx, T, fxs.style.belt, b.code, ph, b.inCode); ctx.restore();
        }
      }

      /* 草叢裡的炸彈本體誰都看不到（seen 是看得到的），但火力線的危險預警照樣要畫，才有機會閃躲 */
      const seen = view.bombs.filter(b => !R.bombHiddenInGrass(view, b));

      /* 危險預警：即將爆炸的格子先亮紅色斜紋，越接近爆炸越明顯 */
      if (view.bombs.length) {
        const danger = new Map();
        for (const b of view.bombs) {
          const left = Math.max(0, b.t);
          if (left > 1.7) continue;
          const mark = (x, y) => { const k = y * view.w + x; const o0 = danger.get(k); if (o0 == null || left < o0) danger.set(k, left); };
          mark(b.cx, b.cy);
          for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            for (let i = 1; i <= (b.range || 1); i++) {
              const x = b.cx + d[0] * i, y = b.cy + d[1] * i;
              if (x < 0 || y < 0 || x >= view.w || y >= view.h) break;
              const gv = view.grid[y * view.w + x];
              if (gv === 1) break;
              mark(x, y);
              if (gv === 2) break;
            }
          }
        }
        const blink = o.reduceMotion ? 1 : 0.75 + 0.25 * Math.sin(now * 14);
        for (const [k, left] of danger) {
          const x = k % view.w, y = (k / view.w) | 0;
          const a = (0.14 + 0.34 * (1 - Math.min(left, 1.7) / 1.7)) * blink;
          ctx.save();
          ctx.beginPath(); ctx.rect(x * T + 1, y * T + 1, T - 2, T - 2); ctx.clip();
          ctx.fillStyle = 'rgba(255,60,60,' + a.toFixed(3) + ')'; ctx.fillRect(x * T, y * T, T, T);
          ctx.strokeStyle = 'rgba(255,255,255,' + (a * 0.9).toFixed(3) + ')'; ctx.lineWidth = Math.max(1.5, T * 0.07);
          ctx.beginPath(); for (let i = -2; i < 5; i++) { ctx.moveTo(x * T + i * T * 0.4, y * T + T); ctx.lineTo(x * T + i * T * 0.4 + T, y * T); } ctx.stroke();
          ctx.restore();
        }
      }

      /* 道具 */
      for (const it of view.itemsOn) {
        const img = this.itemSprite(it.type);
        const cx = (it.cx + 0.5) * T, cy = (it.cy + 0.5) * T;
        const bob = o.reduceMotion ? 0 : Math.sin(now * 4 + it.id) * T * 0.035;
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(cx, cy + T * 0.3, T * 0.22, T * 0.08, 0, 0, 7); ctx.fill();
        { const curse = it.type.indexOf('c_') === 0; const hp = o.reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(now * 3 + it.id);
          const hg = ctx.createRadialGradient(cx, cy, T * 0.1, cx, cy, T * 0.5);
          hg.addColorStop(0, curse ? 'rgba(170,110,255,' + (0.35 + hp * 0.25) + ')' : 'rgba(255,240,150,' + (0.4 + hp * 0.3) + ')'); hg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, cy, T * 0.5, 0, 7); ctx.fill(); }
        if (img) {
          const s = img.width;
          ctx.drawImage(img, cx - s / 2, cy - s / 2 + bob - T * 0.04);
        }
      }

      /* 空襲：炸彈從天上掉下來（落地前這一格的真實炸彈先不畫，只畫掉落中的），地上先出現逐漸變大的預警影子 */
      const DROP_T = 0.45, falling = new Set();
      for (const d of this.drops) d.t += dt;
      this.drops = this.drops.filter(d => d.t < DROP_T);
      const dropBomb = this.bombSprite();
      for (const d of this.drops) {
        falling.add(d.y * view.w + d.x);
        const k = d.t / DROP_T, ease = k * k, cx = (d.x + 0.5) * T, cy = (d.y + 0.5) * T;
        ctx.fillStyle = 'rgba(0,0,0,' + (0.1 + 0.2 * k).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(cx, cy + T * 0.3, T * (0.1 + 0.3 * k), T * (0.04 + 0.1 * k), 0, 0, 7); ctx.fill();
        if (dropBomb) { const s0 = dropBomb.width; ctx.drawImage(dropBomb, cx - s0 / 2, cy - s0 / 2 - T * 0.02 - (1 - ease) * T * 7, s0, s0); }
      }

      /* 炸彈 */
      const bombImg = this.bombSprite();
      for (const b of seen) {
        if (falling.has(b.cy * view.w + b.cx)) continue;
        let px = b.cx + 0.5, py = b.cy + 0.5;
        if (b.sl) { px -= b.sl.dx * (1 - b.sl.prog); py -= b.sl.dy * (1 - b.sl.prog); }
        const left = Math.max(0, b.t);
        const rate = 5 + (R.FUSE - left) * 5;
        const pulse = 1 + (o.reduceMotion ? 0.03 : 0.07) * Math.sin(now * rate);
        const cx = px * T, cy = py * T;
        if (bombImg) {
          const s = bombImg.width * pulse;
          ctx.drawImage(bombImg, cx - s / 2, cy - s / 2 - T * 0.02, s, s);
          if (left < 0.7 && Math.floor(now * 12) % 2 === 0) { ctx.fillStyle = 'rgba(255,90,60,0.35)'; ctx.beginPath(); ctx.arc(cx, cy, s * 0.44, 0, 7); ctx.fill(); }
          /* 引信火花 */
          ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.arc(cx + s * 0.2, cy - s * 0.42, T * (0.06 + 0.03 * Math.sin(now * 30)), 0, 7); ctx.fill();
        }
      }

      /* 火焰 */
      const fl = new Map();
      for (const f of view.flames) fl.set(f.cy * view.w + f.cx, f);
      for (const f of view.flames) {
        const k = Math.max(0.35, Math.min(1, f.t / (R.FLAME_T * 0.6)));
        const cx = (f.cx + 0.5) * T, cy = (f.cy + 0.5) * T;
        const flick = o.reduceMotion ? 1 : 0.92 + 0.08 * Math.sin(now * 40 + f.cx * 3 + f.cy);
        const r = T * 0.4 * k * flick;
        { ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const fg = ctx.createRadialGradient(cx, cy, T * 0.05, cx, cy, T * 0.75 * k);
          fg.addColorStop(0, 'rgba(255,170,60,0.55)'); fg.addColorStop(1, 'rgba(255,90,20,0)');
          ctx.fillStyle = fg; ctx.fillRect(cx - T, cy - T, T * 2, T * 2); ctx.restore(); }
        const arms = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const layers = [['#ff6a2c', 1], ['#ffb12e', 0.74], ['#fff3a0', 0.42]];
        for (const [col, sc] of layers) {
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(cx, cy, r * sc, 0, 7); ctx.fill();
          for (const [dx, dy] of arms) {
            if (!fl.has((f.cy + dy) * view.w + (f.cx + dx))) continue;
            const w = r * sc * 1.9;
            ctx.fillRect(dx ? cx : cx - w / 2, dy ? cy : cy - w / 2, dx ? dx * T : w, dy ? dy * T : w);
          }
        }
      }

      /* 玩家（由上到下排序，下面的蓋住上面的） */
      this._arrow = null;
      const list = view.players.slice().sort((a, b) => (a.ry != null ? a.ry : a.y) - (b.ry != null ? b.ry : b.y));
      for (const p of list) this.drawPlayer(ctx, view, p, now, dt, o);
      /* 草叢的前排葉子蓋在人物（與炸彈、火焰）下半身上：站進去就被遮住一半 */
      if (fxl && fxl.grass.length && fxs.grassFront) {
        for (const c of fxl.grass) if (view.grid[c.y * view.w + c.x] === 0) ctx.drawImage(fxs.grassFront, c.x * T, c.y * T);
      }

      /* 人物站在炸彈上（剛放下還沒走開）時，再把炸彈以 25% 不透明度疊在人物上面（BOMB_OVER_ALPHA）：人物看得清楚，炸彈的輪廓也淡淡浮在上面，不會被整個藏起來 */
      if (bombImg) {
        for (const b of seen) {
          const bx = b.cx + 0.5, by = b.cy + 0.5;
          if (!view.players.some(p => p.alive && !p.hidden && Math.abs(p.x - bx) < 0.7 && Math.abs(p.y - by) < 0.7)) continue;
          let px = bx, py = by;
          if (b.sl) { px -= b.sl.dx * (1 - b.sl.prog); py -= b.sl.dy * (1 - b.sl.prog); }
          const pulse = 1 + (o.reduceMotion ? 0.03 : 0.07) * Math.sin(now * (5 + (R.FUSE - Math.max(0, b.t)) * 5));
          const s = bombImg.width * pulse, cx = px * T, cy = py * T;
          ctx.globalAlpha = SPRITE.bombOverAlpha;
          ctx.drawImage(bombImg, cx - s / 2, cy - s / 2 - T * 0.02, s, s);
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.arc(cx + s * 0.2, cy - s * 0.42, T * (0.06 + 0.03 * Math.sin(now * 30)), 0, 7); ctx.fill();
        }
      }

      /* 粒子 */
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const q = this.parts[i];
        q.life -= dt; if (q.life <= 0) { this.parts.splice(i, 1); continue; }
        q.vy += T * 5 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += dt * 8;
        ctx.globalAlpha = Math.min(1, q.life / 0.3);
        ctx.fillStyle = q.color;
        if (q.kind === 'star') { shapePath(ctx, 'star', q.x, q.y, q.size * 1.4); ctx.fill(); }
        else if (q.kind === 'chip') { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillRect(-q.size, -q.size * 0.7, q.size * 2, q.size * 1.4); ctx.restore(); }
        else { ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
      }

      /* 倒數 */
      if (view.phase === 'countdown') {
        const n = Math.ceil(view.countdown);
        const frac = view.countdown - Math.floor(view.countdown);
        const sc = 1 + (1 - frac) * 0.0 + (frac) * 0.25;
        ctx.save();
        ctx.fillStyle = 'rgba(40,20,70,0.28)'; ctx.fillRect(0, 0, W, H);
        ctx.translate(W / 2, H / 2); ctx.scale(sc, sc);
        ctx.font = '900 ' + Math.round(T * 4) + 'px "Baloo 2","Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = T * 0.28; ctx.strokeStyle = '#5a2d8c'; ctx.lineJoin = 'round'; ctx.strokeText(String(n), 0, 0);
        ctx.fillStyle = '#fff6b0'; ctx.fillText(String(n), 0, 0);
        ctx.restore();
      }
      /* 空投機：飛過整張地圖（地面有影子），機身在最上層 */
      if (view.plane && view.phase === 'play') {
        const pi = this.planeSprite();
        if (pi) {
          const target = view.plane.x;
          if (!this.pl || this.pl.dir !== view.plane.dir || Math.abs(this.pl.x - target) > 2.5) this.pl = { x: target, dir: view.plane.dir };
          this.pl.x += (target + view.plane.dir * R.PLANE_SPEED * 0.04 - this.pl.x) * Math.min(1, dt * 12);
          const px = this.pl.x * T, gy = (view.plane.row + 0.5) * T, sw = pi.width, sh = pi.height;
          /* 機身飛得高：比地上的影子（投下道具的那一列）高 PLANE_LIFT 格，才不會蓋住下面的人、炸彈與道具；上排的列不夠高就貼著畫面上緣 */
          const by = Math.max(sh * 0.5, gy - PLANE_LIFT * T);
          ctx.save();
          ctx.translate(px, gy);
          if (view.plane.dir < 0) ctx.scale(-1, 1);
          ctx.globalAlpha = 0.16; ctx.fillStyle = '#000';          /* 飛得高，地上的影子小一點、淡一點 */
          ctx.drawImage(pi, -sw * 0.4, -sh * 0.4 + T * 0.1, sw * 0.8, sh * 0.8);
          ctx.restore();
          ctx.save();
          ctx.translate(px, by);
          if (view.plane.dir < 0) ctx.scale(-1, 1);
          ctx.globalAlpha = PLANE_ALPHA;
          const bob = o.reduceMotion ? 0 : Math.sin(now * 9) * T * 0.03;
          ctx.drawImage(pi, -sw / 2, -sh / 2 + bob);
          ctx.restore();
        }
      } else this.pl = null;
      if (this._arrow && view.phase === 'countdown') {
        const { ax, tip, aw, ah, sh } = this._arrow;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(ax, tip); ctx.lineTo(ax + aw / 2, tip - ah); ctx.lineTo(ax + aw * 0.2, tip - ah); ctx.lineTo(ax + aw * 0.2, tip - ah - sh);
        ctx.lineTo(ax - aw * 0.2, tip - ah - sh); ctx.lineTo(ax - aw * 0.2, tip - ah); ctx.lineTo(ax - aw / 2, tip - ah); ctx.closePath();
        ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, T * 0.09); ctx.strokeStyle = '#17122b'; ctx.stroke();
        ctx.fillStyle = '#ffe03d'; ctx.fill();
        ctx.restore();
      }
      if (view.phase === 'play' && view.time < 0.9) {
        const k = view.time / 0.9;
        ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.translate(W / 2, H / 2); ctx.scale(0.8 + k * 0.5, 0.8 + k * 0.5);
        ctx.font = '900 ' + Math.round(T * 3) + 'px "Baloo 2","Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = T * 0.3; ctx.strokeStyle = '#17122b'; ctx.lineJoin = 'round'; ctx.strokeText('GO!', 0, 0);
        ctx.fillStyle = '#ffe03d'; ctx.fillText('GO!', 0, 0); ctx.restore();
      }
      if (!this.vig || this.vig.w !== W) {
        const v = document.createElement('canvas'); v.width = W; v.height = H; const vg = v.getContext('2d');
        const gr = vg.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
        gr.addColorStop(0, 'rgba(10,8,30,0)'); gr.addColorStop(1, 'rgba(10,8,30,0.28)'); vg.fillStyle = gr; vg.fillRect(0, 0, W, H);
        v.w = W; this.vig = v;
      }
      ctx.drawImage(this.vig, 0, 0);
      /* 時間快到：外圈紅光 */
      if (view.phase === 'play' && view.timeLimit > 0 && view.timeLimit - view.time <= 15 && !o.reduceMotion) {
        const a = 0.12 + 0.1 * Math.sin(now * 6);
        ctx.strokeStyle = 'rgba(255,60,60,' + a + ')'; ctx.lineWidth = T * 0.35; ctx.strokeRect(0, 0, W, H);
      }
      ctx.restore();
      this.dirty = false;
    }

    drawPlayer(ctx, view, p, now, dt, o) {
      const T = this.T;
      const mine = o.selfPos && p.slot === o.selfSlot ? o.selfPos : null;
      /* 位置平滑 */
      let st = this.pos.get(p.slot);
      if (!st) { st = { x: p.x, y: p.y }; this.pos.set(p.slot, st); }
      if (mine) {
        /* 線上的自己：用本機預測的位置，按鍵立刻有反應（伺服器快照只拿來校正） */
        st.x = mine.x; st.y = mine.y; st.buf = null;
      } else if (o.mode === 'smooth') {
        /* 線上：固定延遲 0.07 秒（約兩個 30 次/秒的快照間隔）、在收到的快照之間內插。不外插（不會穿牆），快照到達時間抖動也被延遲吸收，所以不會忽快忽慢 */
        if (!st.buf) st.buf = [{ t: now, x: p.x, y: p.y }];
        if (st.seq !== this.snapSeq) {
          st.seq = this.snapSeq;
          const last = st.buf[st.buf.length - 1];
          if (Math.hypot(p.x - last.x, p.y - last.y) > 1.8) st.buf = [{ t: now - 1, x: p.x, y: p.y }];
          st.buf.push({ t: now, x: p.x, y: p.y });
          while (st.buf.length > 2 && st.buf[1].t < now - 0.6) st.buf.shift();
        }
        const rt = now - 0.07, bf = st.buf;
        if (rt <= bf[0].t) { st.x = bf[0].x; st.y = bf[0].y; }
        else if (rt >= bf[bf.length - 1].t) { st.x = bf[bf.length - 1].x; st.y = bf[bf.length - 1].y; }
        else {
          let i = 0; while (i < bf.length - 2 && bf[i + 1].t <= rt) i++;
          const q = (rt - bf[i].t) / Math.max(0.001, bf[i + 1].t - bf[i].t);
          st.x = bf[i].x + (bf[i + 1].x - bf[i].x) * q; st.y = bf[i].y + (bf[i + 1].y - bf[i].y) * q;
        }
      } else { st.x = p.rx != null ? p.rx : p.x; st.y = p.ry != null ? p.ry : p.y; }
      if (!st.lastX) { st.lastX = st.x; st.lastY = st.y; }
      const speed = Math.hypot(st.x - st.lastX, st.y - st.lastY) / Math.max(dt, 0.001);
      st.lastX = st.x; st.lastY = st.y;
      const mv = o.mode === 'smooth' ? speed > 0.6 : !!p.moving;
      if (mv) st.mv = now;
      st.moving = now - (st.mv || -9) < 0.14;         // 停下後再撐 0.14 秒，貼牆磨蹭時不會一直切換站姿／走路
      const moving = !!st.moving && p.alive;

      /* 隱身：還活著的玩家看不到別人的隱身玩家（線上時伺服器根本沒送位置）；自己、觀戰者、已淘汰的人看得到，畫成半透明 */
      const selfP = o.selfSlot != null ? view.players.find(q => q.slot === o.selfSlot) : null;
      const ghostOn = p.alive && p.ghostT > 0;
      /* 隱身：還活著的對手只看得到淡淡的身形（沒有名牌、護盾等細節）；自己、觀戰者、淘汰者看到的是半透明 */
      const ghostFaint = p.hidden || (ghostOn && p.slot !== o.selfSlot && selfP && selfP.alive);
      /* 草叢：站在草叢裡的活人誰都看不到（對手、觀戰、淘汰的、連自己，沒有例外） */
      const grassHid = p.alive && R.hiddenInGrass(view, p);
      if (grassHid) return;      /* 人物、影子、自己的光圈、名牌都不畫 */
      const faint = p.alive && ghostFaint;

      let death = 0;
      if (!p.alive) {
        let d = this.deaths.get(p.slot);
        if (d == null) { d = now; this.deaths.set(p.slot, d); }
        death = (now - d) / 0.9;
        if (death >= 1) return;
      } else if (this.deaths.has(p.slot)) this.deaths.delete(p.slot);

      const cx = Math.round(st.x * T), cyHit = Math.round(st.y * T);
      /* 人物圖往上提 lift，讓腳下的影子、光圈落在判定中心（cyHit）附近；身體、頭上的東西、名牌都跟著提，用 cy 當「身體中心」 */
      const lift = T * (SHADOW_DROP - SPRITE.foot), cy = cyHit - lift;
      const facing = FACE[mine ? mine.dir : p.dir] || 'down';
      if (moving) st.ph = (st.ph || 0) + dt * 9; else st.ph = 0;
      const frame = moving ? [1, 0, 2, 0][Math.floor(st.ph) % 4] : 0;
      const spr = this.animalSprite(p.animal, facing, frame);
      const color = R.SLOT_COLORS[p.slot % 8];
      let alpha = p.alive && p.invuln > 0 && Math.floor(now * 12) % 2 === 0 ? 0.45 : 1;
      if (ghostOn) alpha = Math.min(alpha, 0.4);
      if (faint) alpha = SPRITE.ghostFaint * (o.reduceMotion ? 1 : 0.82 + 0.18 * Math.sin(now * 5 + p.slot));   /* 微微閃爍，像空氣扭曲 */

      ctx.save();
      /* 影子與自己的光環 */
      if (p.alive) {
        ctx.fillStyle = faint ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(cx, cyHit + T * SPRITE.foot, T * 0.3, T * 0.1, 0, 0, 7); ctx.fill();
        if (o.selfSlot === p.slot) {
          const pulse = o.reduceMotion ? 0 : Math.sin(now * 5) * 0.04;
          ctx.lineWidth = Math.max(2, T * 0.07); ctx.strokeStyle = color; ctx.globalAlpha = 0.95;
          ctx.beginPath(); ctx.ellipse(cx, cyHit + T * (SPRITE.foot - 0.01), T * (0.42 + pulse), T * (0.16 + pulse * 0.4), 0, 0, 7); ctx.stroke();
          ctx.fillStyle = color; ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1;
        }
      }
      ctx.globalAlpha = alpha * (death ? 1 - death : 1);
      const bob = moving && !o.reduceMotion ? -Math.abs(Math.sin(st.ph * Math.PI / 1)) * T * 0.035 : 0;
      ctx.translate(cx, cy - T * 0.07 + bob - death * T * 0.5);
      if (death) { ctx.rotate(death * 9); ctx.scale(1 - death * 0.7, 1 - death * 0.7); }
      if (p.dir === 'R') ctx.scale(-1, 1);
      if (spr) ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
      ctx.restore();

      if (!p.alive || faint) return;
      /* 護盾 */
      if (p.shield) {
        const g = ctx.createRadialGradient(cx - T * 0.1, cy - T * 0.25, T * 0.05, cx, cy - T * 0.05, T * 0.55);
        g.addColorStop(0, 'rgba(255,255,255,0.65)'); g.addColorStop(0.7, 'rgba(255,224,110,0.28)'); g.addColorStop(1, 'rgba(255,200,60,0.5)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy - T * 0.04, T * 0.52, 0, 7); ctx.fill();
        ctx.lineWidth = Math.max(1.5, T * 0.04); ctx.strokeStyle = 'rgba(255,200,60,0.9)'; ctx.stroke();
      }
      /* 詛咒 */
      if (p.curse) {
        const img = this.itemSprite(p.curse.type);
        if (img) { const s = img.width * 0.55; ctx.drawImage(img, cx + T * 0.2, cy - T * 0.72 + Math.sin(now * 6) * T * 0.03, s, s); }
        ctx.strokeStyle = 'rgba(150,90,220,0.7)'; ctx.lineWidth = Math.max(2, T * 0.05); ctx.setLineDash([T * 0.1, T * 0.1]);
        ctx.beginPath(); ctx.arc(cx, cy, T * 0.46, now * 2, now * 2 + 5.2); ctx.stroke(); ctx.setLineDash([]);
      }
      /* 超人標誌：金色光環＋頭上的徽章，最後 3 秒閃爍提醒快結束了 */
      if (p.superT > 0 && (p.superT > 3 || Math.floor(now * 8) % 2 === 0)) {
        const img = this.itemSprite('super');
        if (img) { const s = img.width * 0.55; ctx.drawImage(img, cx - T * 0.2 - s, cy - T * 0.72 + Math.sin(now * 6 + 1) * T * 0.03, s, s); }
        ctx.strokeStyle = 'rgba(255,206,60,0.9)'; ctx.lineWidth = Math.max(2, T * 0.06);
        ctx.beginPath(); ctx.arc(cx, cy, T * 0.5 + (o.reduceMotion ? 0 : Math.sin(now * 7) * T * 0.02), 0, 7); ctx.stroke();
      }
      /* 倒數期間：在自己頭上標一個往下的箭頭（出生點每局隨機，開局先認出自己） */
      if (view.phase === 'countdown' && o.selfSlot != null && p.slot === o.selfSlot && p.alive) {
        const bob = o.reduceMotion ? 0 : Math.abs(Math.sin(now * 6)) * T * 0.1;
        const aw = T * 0.6, ah = T * 0.5, sh = T * 0.26;
        const ax = cx, tip = Math.max(cy - T * 0.58 - bob, ah + sh + T * 0.04);      /* 人物往上提之後，上排出生點的箭頭不要被畫面上緣切掉 */
        this._arrow = { ax, tip, aw, ah, sh };
      }
      /* 暱稱（倒數時自己頭上改放箭頭，避免上排出生點被畫面邊緣切掉） */
      if (o.names !== false && !(view.phase === 'countdown' && o.selfSlot != null && p.slot === o.selfSlot)) {
        const label = p.kind === 'ai' && p.level && root.AI ? p.name + '·' + root.AI.LEVELS[p.level].name : p.name;
        const fs = Math.max(10, Math.round(T * 0.26));
        ctx.font = '800 ' + fs + 'px "Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(label).width;
        const shape = o.colorAssist ? R.SHAPES[p.slot % 8] : null;
        const padX = T * 0.12, extra = shape ? fs * 1.1 : fs * 0.7;
        const bw = tw + padX * 2 + extra, bh = fs * 1.35;
        /* 貼邊的玩家：名牌往內推，不要超出地圖被裁掉 */
        const edge = T * 0.08;
        const bx = Math.max(edge, Math.min(view.w * T - bw - edge, cx - bw / 2)), by = cy - T * 0.62 - bh;
        ctx.fillStyle = 'rgba(40,24,70,0.72)'; Art.rr(ctx, bx, by, bw, bh, bh / 2); ctx.fill();
        ctx.fillStyle = color;
        const dotX = bx + padX + fs * 0.35, dotY = by + bh / 2;
        if (shape) { shapePath(ctx, shape, dotX, dotY, fs * 0.38); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#fff'; ctx.stroke(); }
        else { ctx.beginPath(); ctx.arc(dotX, dotY, fs * 0.28, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(label, bx + padX + extra - fs * 0.05, by + bh / 2 + 1);
      }
    }
  }

  Renderer.SPRITE = SPRITE;
  root.Renderer = Renderer;
  root.RenderShapes = { shapePath };
})(typeof self !== 'undefined' ? self : this);
