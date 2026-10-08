/* ===== mappick.js — 地圖選擇：按鈕＋彈出視窗（單機設定與線上房間共用） =====
 * 視窗裡有一張即時預覽（用真的地圖產生器和該主題的磚塊畫出來，可以「換一張」）、
 * 主題卡片（每張都是縮圖）和版型選項；按「套用」才會寫回設定。
 */
(function (root) {
  'use strict';
  const { h, btn, modal } = root.UI;
  const R = root.Rules, Art = root.Art;

  const LAYOUTS = [
    { v: 'random', label: '隨機', hint: '每局抽一種版型' },
    { v: 'classic', label: '經典', hint: '硬牆一組一組散落' },
    { v: 'open', label: '空曠', hint: '硬牆很少，空間大' },
    { v: 'dense', label: '密集', hint: '硬牆多，巷戰多' },
    { v: 'fab', label: '產線', hint: '橫向機台排排站' }
  ];
  const THEMES = [{ v: -1, name: '隨機', hint: '每局換一個主題' }].concat(Art.THEMES.map(t => ({ v: t.id, name: t.name })));
  const themeName = v => (THEMES.find(t => t.v === v) || THEMES[0]).name;
  const layoutName = v => (LAYOUTS.find(l => l.v === v) || LAYOUTS[0]).label;

  const tileCache = {};
  function tiles(themeId, T) {
    const k = themeId + '|' + T;
    return tileCache[k] || (tileCache[k] = Art.buildTileset(T, themeId));
  }

  /** 把一張真的地圖畫進 canvas；主題 -1（隨機）時由 seed 挑一個主題 */
  function paintMap(canvas, themeId, layout, seed, T, size) {
    const tid = themeId < 0 ? seed % R.THEME_COUNT : themeId;
    const lay = layout === 'random' ? R.RANDOM_LAYOUTS[seed % R.RANDOM_LAYOUTS.length] : layout;
    const w = size ? size.w : 15, hh = size ? size.h : 13;
    const grid = R.generateMap(seed, w, hh, lay);
    const fx = R.generateFx(seed, w, hh, grid, tid);
    const ts = tiles(tid, T);
    canvas.width = w * T; canvas.height = hh * T;
    const g = canvas.getContext('2d');
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === hh - 1;
      g.drawImage(edge ? ts.border : ((x + y) % 2 ? ts.floorB : ts.floorA), x * T, y * T);
      const v = grid[y * w + x], f = fx[y * w + x];
      if (f && v !== 1 && !edge) {      /* 地圖機關（預覽也畫出來，軟磚疊在上面） */
        const img = f === R.FX_GRASS ? ts.fx.grassBack : f === R.FX_SLOW ? ts.fx.slow : f === R.FX_SPIKE ? ts.fx.spike : ts.fx.belt && ts.fx.belt[f - R.FX_BELT];
        if (img) g.drawImage(img, x * T, y * T);
      }
      if (v === 1 && !edge) g.drawImage(ts.hardV[Art.variantIndex(seed, x, y, ts.hardV.length)], x * T, y * T);
      else if (v === 2) g.drawImage(ts.softV[Art.variantIndex(seed + 5, x, y, ts.softV.length)], x * T, y * T);
    }
    return canvas;
  }

  /** 「隨機」主題的縮圖：彩色拼貼加問號 */
  function paintRandom(canvas, T) {
    canvas.width = 15 * T; canvas.height = 13 * T;
    const g = canvas.getContext('2d');
    const cols = Art.THEMES.map(t => t.floorA);
    const bars = ['#ff8fc4', '#7fe3ff', '#ffe03d', '#8be08a', '#b99bff', '#ff9a3c'];
    for (let y = 0; y < 13; y++) for (let x = 0; x < 15; x++) {
      g.fillStyle = cols[(x * 3 + y * 5) % cols.length]; g.fillRect(x * T, y * T, T, T);
      if ((x * 7 + y * 11) % 5 === 0) { g.fillStyle = bars[(x + y) % bars.length]; g.fillRect(x * T + 1, y * T + 1, T - 2, T - 2); }
    }
    g.fillStyle = 'rgba(23,18,43,.55)'; g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = '#ffe03d'; g.strokeStyle = '#17122b'; g.lineWidth = T * 0.5; g.lineJoin = 'round';
    g.font = '900 ' + Math.round(canvas.height * 0.7) + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeText('?', canvas.width / 2, canvas.height / 2 + T); g.fillText('?', canvas.width / 2, canvas.height / 2 + T);
    return canvas;
  }

  const THUMB_T = 8, BIG_T = 18, THUMB_SEED = 7;

  /** 設定面板上的「地圖」按鈕：縮圖＋名稱＋版型，點了打開選擇視窗 */
  function mapButton(o) {
    let cur = { theme: o.theme, layout: o.layout };
    const thumb = h('canvas', { class: 'map-thumb', 'aria-hidden': 'true' });
    const name = h('b', null), sub = h('small', null);
    const b = h('button', { type: 'button', class: 'map-btn', 'aria-haspopup': 'dialog', 'aria-label': '選擇地圖', disabled: o.disabled,
      onClick: () => { if (root.Sound) root.Sound.sfx('click'); open(); } },
      thumb, h('span', { class: 'map-btn-txt' }, name, sub), h('i', { class: 'map-btn-go', 'aria-hidden': 'true' }));
    const paint = () => {
      if (cur.theme < 0) paintRandom(thumb, THUMB_T); else paintMap(thumb, cur.theme, cur.layout, THUMB_SEED, THUMB_T);
      name.textContent = themeName(cur.theme);
      sub.textContent = layoutName(cur.layout) + '版型・點一下更換';
    };
    function open() {
      mapPicker({ theme: cur.theme, layout: cur.layout, onApply: v => { cur = v; paint(); o.onChange && o.onChange({ theme: v.theme, layout: v.layout }); } });
    }
    paint();
    b.setValue = v => { cur = { theme: v.theme, layout: v.layout }; paint(); };
    return b;
  }

  /** 選擇視窗：上方預覽、中間主題卡片、下方版型；套用才生效 */
  function mapPicker(o) {
    let theme = o.theme, layout = o.layout, seed = 1 + Math.floor(Math.random() * 900);
    const big = h('canvas', { class: 'map-big', role: 'img' });
    const bigTitle = h('b', { class: 'map-big-title' }), bigSub = h('span', { class: 'muted small' });
    const reroll = btn('換一張', { cls: 'btn-sky btn-sm', icon: 'refresh', iconSize: 18, onClick: () => { seed = 1 + Math.floor(Math.random() * 900); paintBig(); } });

    const themeBtns = THEMES.map(t => {
      const cv = h('canvas', { class: 'map-card-cv', 'aria-hidden': 'true' });
      if (t.v < 0) paintRandom(cv, THUMB_T); else paintMap(cv, t.v, 'classic', THUMB_SEED, THUMB_T);
      const b = h('button', { type: 'button', role: 'radio', class: 'map-card', 'aria-checked': t.v === theme ? 'true' : 'false', 'aria-label': t.name,
        onClick: () => { if (root.Sound) root.Sound.sfx('click'); theme = t.v; syncTheme(); paintBig(); } },
        cv, h('span', { class: 'map-card-name' }, t.name), h('i', { class: 'map-card-ok', 'aria-hidden': 'true' }));
      return b;
    });
    const syncTheme = () => themeBtns.forEach((b, i) => b.setAttribute('aria-checked', THEMES[i].v === theme ? 'true' : 'false'));

    const layoutBtns = LAYOUTS.map(l => h('button', { type: 'button', role: 'radio', class: 'map-lay', 'aria-checked': l.v === layout ? 'true' : 'false',
      onClick: () => { if (root.Sound) root.Sound.sfx('click'); layout = l.v; syncLayout(); paintBig(); } },
      h('b', null, l.label), h('small', null, l.hint)));
    const syncLayout = () => layoutBtns.forEach((b, i) => b.setAttribute('aria-checked', LAYOUTS[i].v === layout ? 'true' : 'false'));

    function paintBig() {
      paintMap(big, theme, layout, seed, BIG_T);
      const shown = theme < 0 ? Art.THEMES[seed % R.THEME_COUNT].name : themeName(theme);
      big.setAttribute('aria-label', '地圖預覽：' + shown + '，' + layoutName(layout) + '版型');
      bigTitle.textContent = themeName(theme) + '・' + layoutName(layout) + '版型';
      bigSub.textContent = (theme < 0 || layout === 'random' ? '這只是其中一種可能，每局都會重新抽。' : '預覽只是其中一張，每局的硬牆與軟磚位置都不一樣。');
    }

    const m = modal({ title: '選擇地圖', cls: 'dialog-lg map-dialog',
      content: h('div', { class: 'map-pick' },
        h('div', { class: 'map-preview' }, big, h('div', { class: 'map-preview-bar' }, h('div', null, bigTitle, h('br'), bigSub), reroll)),
        h('h3', { class: 'map-h' }, '主題'),
        h('div', { class: 'map-grid', role: 'radiogroup', 'aria-label': '地圖主題' }, themeBtns),
        h('h3', { class: 'map-h' }, '版型'),
        h('div', { class: 'map-lays', role: 'radiogroup', 'aria-label': '地圖版型' }, layoutBtns)),
      actions: [btn('取消', { cls: 'btn-ghost', onClick: () => m.close() }),
        btn('套用', { cls: 'btn-mint', icon: 'check', iconSize: 20, onClick: () => { m.close(true); o.onApply && o.onApply({ theme, layout }); } })] });
    paintBig();
    return m;
  }

  root.MapPick = { mapButton, mapPicker, themeName, layoutName, LAYOUTS, THEMES };
})(typeof self !== 'undefined' ? self : this);
