/* ===== touchlayout.js — 觸控操作版面（純計算，不碰 DOM，瀏覽器與測試共用） =====
 * 依裝置分四類：手機直放／橫放、平板直放／橫放：
 *   手機直放：格子太小，回傳 rotate（遮罩「請橫向遊玩」），由 game.js 擋住畫面。
 *   手機橫放：固定 overlay，搖桿與放炸彈鍵半透明疊在棋盤上（不縮小、不留位置），棋盤用整個可用區。
 *   平板橫放：bars，操作區放在棋盤上下的留白；留白不夠時最多蓋到最下方外牆圈，不蓋可玩格。
 *   平板直放：bottom，地圖在上、控制鈕在底部。
 * 搖桿與放炸彈鍵的大小依螢幕高度等比例，再乘上設定裡的倍率（scale，可超出上下限）。
 */
(function (root) {
  'use strict';

  const BOTTOM = 24;      /* 平板直放時控制鈕離底部（不含安全區）的距離 */
  const GAP = 12;         /* 平板直放時控制鈕與地圖之間的空隙 */
  const EDGE = { 'phone-l': 20, 'tablet-l': 32, 'tablet-p': 32, 'phone-p': 20 };   /* 控制鈕離螢幕邊緣（不含安全區）；平板加大，避開系統手勢 */
  const STICK_RATIO = 0.32, BOMB_RATIO = 0.23;     /* 橫放：直徑 = 螢幕高度 × 比例，再套上下限 */
  const MIN_STICK = 120, MAX_STICK = 172, MIN_BOMB = 86, MAX_BOMB = 116;
  const KNOB_RATIO = 0.42;                          /* 中心鈕直徑 / 搖桿直徑 */
  const SCALE_MIN = 0.8, SCALE_MAX = 1.3, OPACITY_MIN = 0.2, OPACITY_MAX = 1;
  const OPACITY_IDLE = 0.45, OPACITY_DOWN = 0.8;    /* 預設透明度：平時、按住 */

  /* 直放平板沿用舊尺寸 */
  const PORTRAIT = {
    'phone-p': { stick: 150, knob: 64, bomb: 100 },
    'tablet-p': { stick: 196, knob: 84, bomb: 128 }
  };

  /* 手機的短邊小於 560px；平板與以上算平板。 */
  function deviceClass(vw, vh) {
    const kind = Math.min(vw, vh) < 560 ? 'phone' : 'tablet';
    const landscape = vw > vh;
    return { kind, landscape, key: kind + (landscape ? '-l' : '-p') };
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function cleanScale(v) { v = Number(v); return Number.isFinite(v) ? clamp(v, SCALE_MIN, SCALE_MAX) : 1; }

  /** 控制鈕大小（CSS 像素，直徑）；scale 是設定頁的倍率，直接乘上去，所以可以超出預設的上下限 */
  function sizes(vw, vh, scale) {
    const dc = deviceClass(vw, vh), k = cleanScale(scale);
    let s;
    if (dc.landscape) {
      s = { stick: clamp(Math.round(vh * STICK_RATIO), MIN_STICK, MAX_STICK), bomb: clamp(Math.round(vh * BOMB_RATIO), MIN_BOMB, MAX_BOMB) };
      s.knob = Math.round(s.stick * KNOB_RATIO);
    } else s = Object.assign({}, PORTRAIT[dc.key]);
    return { stick: Math.round(s.stick * k), bomb: Math.round(s.bomb * k), knob: Math.round(s.knob * k) };
  }

  /**
   * o：{ vw, vh 視窗大小；availW, availH 還沒留控制鈕位置時，給地圖的可用空間；mapW, mapH 格數；touch 是否顯示觸控鈕；
   *      scale 控制鈕倍率（預設 1）；tile(availW, availH, w, h) 算格子大小的函式（遊戲裡傳 Renderer.tileCss）；
   *      player 是不是玩家（觀戰者直放不擋，預設 true） }
   * 回傳：{ mode: 'none'|'rotate'|'bottom'|'bars'|'overlay', gutter 左右各留多少, bottom 底部多留多少, edge 控制鈕離邊緣, sizes, tile 最後的格子大小 }
   */
  function plan(o) {
    const dc = deviceClass(o.vw, o.vh), s = sizes(o.vw, o.vh, o.scale), edge = EDGE[dc.key];
    const free = o.tile(o.availW, o.availH, o.mapW, o.mapH);
    const base = { gutter: 0, bottom: 0, edge, sizes: s, tile: free };
    if (dc.key === 'phone-p' && o.player !== false) return Object.assign(base, { mode: 'rotate' });
    if (!o.touch) return Object.assign(base, { mode: 'none' });
    if (!dc.landscape) {
      const bottom = s.stick + BOTTOM + GAP;
      return Object.assign(base, { mode: 'bottom', bottom, tile: o.tile(o.availW, o.availH - bottom, o.mapW, o.mapH) });
    }
    if (dc.kind === 'phone') return Object.assign(base, { mode: 'overlay' });
    /* 平板橫放：控制鈕靠下方兩角；找最小的底部保留 b，讓控制鈕最多只蓋到棋盤最下方的外牆圈（一格高）。
       棋盤在可用區內置中，下方留白 = (availH − b − 棋盤高) / 2 + b */
    const need = s.stick + edge;       /* 控制鈕頂端離螢幕底部的距離（不含安全區） */
    for (let b = 0; b <= need; b++) {
      const t = o.tile(o.availW, o.availH - b, o.mapW, o.mapH);
      const below = (o.availH - b - t * o.mapH) / 2 + b;
      if (below + t >= need) return Object.assign(base, { mode: 'bars', bottom: b, tile: t });
    }
    return Object.assign(base, { mode: 'bars', bottom: need, tile: o.tile(o.availW, o.availH - need, o.mapW, o.mapH) });
  }

  root.TouchLayout = {
    BOTTOM, GAP, EDGE, STICK_RATIO, BOMB_RATIO, MIN_STICK, MAX_STICK, MIN_BOMB, MAX_BOMB, KNOB_RATIO,
    SCALE_MIN, SCALE_MAX, OPACITY_MIN, OPACITY_MAX, OPACITY_IDLE, OPACITY_DOWN, cleanScale, deviceClass, sizes, plan
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.TouchLayout;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
