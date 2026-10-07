/* ===== touchlayout.js — 觸控操作版面（純計算，不碰 DOM，瀏覽器與測試共用） =====
 * 依裝置分四類：手機直放／橫放、平板直放／橫放，各自決定搖桿與炸彈鈕的大小，
 * 並決定控制鈕放哪裡：
 *   直放：地圖在上、控制鈕在底部，按控制鈕大小留出底部空間（不再寫死 210／190px）。
 *   橫放：控制鈕放在地圖左右兩側的空位（只會壓到最外圈的邊牆，不擋可玩的格子）；只有放兩側會讓格子縮水超過 15% 時，
 *         才退回「半透明疊在地圖邊緣」。
 */
(function (root) {
  'use strict';

  const EDGE = 20;        /* 控制鈕離螢幕邊緣 */
  const GAP = 12;         /* 控制鈕與地圖之間的空隙 */
  const BOTTOM = 24;      /* 直放時控制鈕離底部（不含安全區）的距離 */
  const MIN_KEEP = 0.85;  /* 橫放兩側留位後，格子至少要保有原本的 85%，否則改疊在地圖上 */
  const OVERLAP = 0.8;
  const SHRINK = [1, 0.9, 0.8, 0.72];   /* 橫放兩側空位不夠時，控制鈕依序縮到這些比例再試 */
  const MIN_STICK = 120, MIN_BOMB = 86; /* 再小手指就不好按了 */    /* 控制鈕可以壓進地圖最外圈那一格邊牆（不是可玩的格子），最多壓進這麼多格 */

  /* 手機的短邊小於 560px；平板與以上算平板。尺寸是 CSS 像素，直徑／邊長 */
  const SIZES = {
    'phone-p': { stick: 150, knob: 64, bomb: 100 },
    'phone-l': { stick: 124, knob: 52, bomb: 88 },
    'tablet-p': { stick: 196, knob: 84, bomb: 128 },
    'tablet-l': { stick: 172, knob: 72, bomb: 116 }
  };

  function deviceClass(vw, vh) {
    const kind = Math.min(vw, vh) < 560 ? 'phone' : 'tablet';
    const landscape = vw > vh;
    return { kind, landscape, key: kind + (landscape ? '-l' : '-p') };
  }

  function sizes(vw, vh) { return Object.assign({}, SIZES[deviceClass(vw, vh).key]); }

  /**
   * o：{ vw, vh 視窗大小；availW, availH 還沒留控制鈕位置時，給地圖的可用空間；mapW, mapH 格數；touch 是否顯示觸控鈕；
   *      tile(availW, availH, w, h) 算格子大小的函式（遊戲裡傳 Renderer.tileCss，才不會兩邊算法不一致） }
   * 回傳：{ mode: 'none'|'bottom'|'gutter'|'overlay', gutter 左右各留多少, bottom 底部多留多少, sizes, tile 最後的格子大小 }
   */
  function plan(o) {
    const s = sizes(o.vw, o.vh), dc = deviceClass(o.vw, o.vh);
    const free = o.tile(o.availW, o.availH, o.mapW, o.mapH);
    if (!o.touch) return { mode: 'none', gutter: 0, bottom: 0, sizes: s, tile: free };
    if (!dc.landscape) {
      const bottom = s.stick + BOTTOM + GAP;
      return { mode: 'bottom', gutter: 0, bottom, sizes: s, tile: o.tile(o.availW, o.availH - bottom, o.mapW, o.mapH) };
    }
    /* 兩側要放得下控制鈕，但鈕可以壓在邊牆上，所以只需留「鈕寬 − 約一格」。
       控制鈕先用標準大小；兩側放了讓格子縮太多，就把鈕縮小一點再試（搖桿最小 MIN_STICK、炸彈鈕最小 MIN_BOMB）。
       對每個大小，從 0 往上找最小的兩側空位 g，使得 g 加上（留了 g 之後的）一格寬 × OVERLAP 剛好放得下鈕 */
    for (const k of SHRINK) {
      const sk = { stick: Math.max(MIN_STICK, Math.round(s.stick * k)), bomb: Math.max(MIN_BOMB, Math.round(s.bomb * k)), knob: 0 };
      sk.knob = Math.round(sk.stick * s.knob / s.stick);
      const need = Math.max(sk.stick, sk.bomb) + EDGE + GAP;
      for (let gutter = 0; gutter <= need; gutter++) {
        const tileG = o.tile(o.availW - 2 * gutter, o.availH, o.mapW, o.mapH);
        if (gutter + tileG * OVERLAP < need) continue;
        if (tileG >= free * MIN_KEEP) return { mode: 'gutter', gutter, bottom: 0, sizes: sk, tile: tileG, need };
        break;     /* 放得下但格子縮太多：換更小的鈕再試 */
      }
    }
    /* 兩側怎麼放都會讓格子縮太多：控制鈕疊在地圖邊緣，用最小的鈕、半透明（由 CSS 的 .overlay 處理），少擋一點 */
    const k = SHRINK[SHRINK.length - 1], st = Math.max(MIN_STICK, Math.round(s.stick * k));
    return { mode: 'overlay', gutter: 0, bottom: 0, sizes: { stick: st, bomb: Math.max(MIN_BOMB, Math.round(s.bomb * k)), knob: Math.round(st * s.knob / s.stick) }, tile: free };
  }

  root.TouchLayout = { SIZES, EDGE, GAP, BOTTOM, MIN_KEEP, OVERLAP, SHRINK, MIN_STICK, MIN_BOMB, deviceClass, sizes, plan };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.TouchLayout;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
