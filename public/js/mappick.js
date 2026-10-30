/* ===== mappick.js — 地圖選擇：按鈕＋彈出視窗（單機設定與線上房間共用） =====
 * 視窗裡有一張即時預覽（用真的地圖產生器和該主題的磚塊畫出來，可以「換一張」）、
 * 主題卡片（每張都是縮圖）和版型選項；按「套用」才會寫回設定。
 */
(function (root) {
  'use strict';
  const { h, btn, modal } = root.UI;
  const R = root.Rules, Art = root.Art;

  const tr = (k, p) => root.I18N.t(k, p);
  /* 名稱與說明是 getter：每次讀取都依目前語言取字（字典在 locales.js） */
  const LAYOUTS = ['random', 'classic', 'open', 'dense'].map(v => ({ v, get label() { return tr('layout.' + v); }, get hint() { return tr('layout.hint.' + v); } }));
  const THEMES = [{ v: -1, get name() { return tr('theme.random'); }, get hint() { return tr('theme.random.hint'); } }].concat(Art.THEMES.map(t => ({ v: t.id, get name() { return t.name; } })));
  const themeName = v => (THEMES.find(t => t.v === v) || THEMES[0]).name;
  const layoutName = v => (v === 'fab' ? tr('layout.fab') : (LAYOUTS.find(l => l.v === v) || LAYOUTS[0]).label);     /* 產線版型只有日月光廠房主題有，不在選項裡 */

  const tileCache = {};
  function tiles(themeId, T) {
    const k = themeId + '|' + T;
    return tileCache[k] || (tileCache[k] = Art.buildTileset(T, themeId));
  }

  /** 把一張真的地圖畫進 canvas；主題 -1（隨機）時由 seed 挑一個主題 */
  function paintMap(canvas, themeId, layout, seed, T, size) {
    const tid = themeId < 0 ? seed % R.THEME_COUNT : themeId;
    const lay = tid === R.FAB_THEME ? 'fab' : (layout === 'random' || layout === 'fab' ? R.RANDOM_LAYOUTS[seed % R.RANDOM_LAYOUTS.length] : layout);
    const sz = size || R.sizeFor(1), w = sz.w, hh = sz.h;      /* 預覽用小圖（≤4 人）的長方形尺寸 */
    const grid = R.generateMap(seed, w, hh, lay);
    const fx = R.generateFx(seed, w, hh, grid, tid, lay);
    const ts = tiles(tid, T);
    canvas.width = w * T; canvas.height = hh * T;
    const g = canvas.getContext('2d');
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === hh - 1;
      g.drawImage(edge ? ts.border : ((x + y) % 2 ? ts.floorB : ts.floorA), x * T, y * T);
      const v = grid[y * w + x], f = fx[y * w + x];
      if (f && v !== 1 && !edge) {      /* 地圖機關（預覽也畫出來，軟磚疊在上面） */
        let img = f === R.FX_GRASS ? ts.fx.grassBack : f === R.FX_SLOW ? ts.fx.slow : f === R.FX_SPIKE ? ts.fx.spike : ts.fx.belt && ts.fx.belt[f - R.FX_BELT];
        if (R.isBelt(f) && ts.fx.beltCorner) { const inC = R.beltIn(fx, w, x, y), turn = Art.beltTurn(f, inC); if (turn) img = ts.fx.beltCorner[turn < 0 ? 1 : 0][inC - R.FX_BELT]; }
        if (img) g.drawImage(img, x * T, y * T);
      }
      if (v === 1 && !edge) g.drawImage(ts.hardV[Art.variantIndex(seed, x, y, ts.hardV.length)], x * T, y * T);
      else if (v === 2) g.drawImage(ts.softV[Art.variantIndex(seed + 5, x, y, ts.softV.length)], x * T, y * T);
    }
    return canvas;
  }

  /** 「隨機」主題的縮圖：彩色拼貼加問號 */
  function paintRandom(canvas, T) {
    const sz = R.sizeFor(1), cw = sz.w, ch = sz.h;
    canvas.width = cw * T; canvas.height = ch * T;
    const g = canvas.getContext('2d');
    const cols = Art.THEMES.map(t => t.floorA);
    const bars = ['#ff8fc4', '#7fe3ff', '#ffe03d', '#8be08a', '#b99bff', '#ff9a3c'];
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      g.fillStyle = cols[(x * 3 + y * 5) % cols.length]; g.fillRect(x * T, y * T, T, T);
      if ((x * 7 + y * 11) % 5 === 0) { g.fillStyle = bars[(x + y) % bars.length]; g.fillRect(x * T + 1, y * T + 1, T - 2, T - 2); }
    }
    g.fillStyle = 'rgba(23,18,43,.55)'; g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = '#ffe03d'; g.strokeStyle = '#17122b'; g.lineWidth = T * 0.5; g.lineJoin = 'round';
    g.font = '900 ' + Math.round(canvas.height * 0.7) + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeText('?', canvas.width / 2, canvas.height / 2 + T); g.fillText('?', canvas.width / 2, canvas.height / 2 + T);
    return canvas;
  }

  /* 各種機關的白話說明（選地圖時顯示）；數字跟 rules.js 的規則一致 */
  const fxInfo = kind => ({ name: tr('fx.' + kind + '.name'), lines: [tr('fx.' + kind + '.l1'), tr('fx.' + kind + '.l2')] });
  /* 每個主題專屬的機關名稱（一個主題最多 1 種，競技場沒有） */
  const fxName = tid => tr('fxn.' + tid);
  const fxKind = tid => (R.THEME_FX[tid] || [])[0] || null;

  /** 機關示意圖：兩格並排（輸送帶畫上流動箭頭，草叢畫上前排葉子） */
  function paintFxIcon(cv, tid) {
    const T = 40, kind = fxKind(tid), ts = tiles(tid, T), f = ts.fx;
    cv.width = T * 2; cv.height = T;
    const g = cv.getContext('2d');
    for (let k = 0; k < 2; k++) {
      g.drawImage(k ? ts.floorB : ts.floorA, k * T, 0);
      const img = kind === 'grass' ? f.grassBack : kind === 'slow' ? f.slow : kind === 'spike' ? f.spike : f.belt && f.belt[3];
      if (img) g.drawImage(img, k * T, 0);
      if (kind === 'belt' && f.style.belt) { g.save(); g.translate(k * T, 0); Art.drawBeltArrows(g, T, f.style.belt, 7, 0.3); g.restore(); }
      if (kind === 'grass' && f.grassFront) g.drawImage(f.grassFront, k * T, 0);
    }
  }

  const THUMB_T = 8, BIG_T = 18, THUMB_SEED = 7;

  /** 設定面板上的「地圖」按鈕：縮圖＋名稱＋版型，點了打開選擇視窗 */
  function mapButton(o) {
    let cur = { theme: o.theme, layout: o.layout };
    const thumb = h('canvas', { class: 'map-thumb', 'aria-hidden': 'true' });
    const name = h('b', null), sub = h('small', null);
    const b = h('button', { type: 'button', class: 'map-btn', 'aria-haspopup': 'dialog', 'aria-label': tr('map.pick'), disabled: o.disabled,
      onClick: () => { if (root.Sound) root.Sound.sfx('click'); open(); } },
      thumb, h('span', { class: 'map-btn-txt' }, name, sub), h('i', { class: 'map-btn-go', 'aria-hidden': 'true' }));
    const paint = () => {
      if (cur.theme < 0) paintRandom(thumb, THUMB_T); else paintMap(thumb, cur.theme, cur.layout, THUMB_SEED, THUMB_T);
      name.textContent = themeName(cur.theme);
      sub.textContent = tr('map.tapChange', { l: layoutName(cur.theme === R.FAB_THEME ? 'fab' : cur.layout) });
    };
    function open() {
      mapPicker({ theme: cur.theme, layout: cur.layout, onApply: v => { cur = v; paint(); o.onChange && o.onChange({ theme: v.theme, layout: v.layout }); } });
    }
    paint();
    b.setValue = v => { cur = { theme: v.theme, layout: v.layout }; paint(); };
    return b;
  }

  /** 選擇視窗：上方預覽、中間主題卡片、下方版型；套用才生效。切換語言時整個內容重建（目前選的主題、版型、預覽 seed 保留） */
  function mapPicker(o) {
    let theme = o.theme, layout = o.layout === 'fab' ? 'random' : o.layout, seed = 1 + Math.floor(Math.random() * 900);
    let big, bigTitle, bigSub, fabNote, fxBox, themeBtns, layoutBtns;
    const syncTheme = () => themeBtns.forEach((b, i) => b.setAttribute('aria-checked', THEMES[i].v === theme ? 'true' : 'false'));
    const syncLayout = () => layoutBtns.forEach((b, i) => b.setAttribute('aria-checked', LAYOUTS[i].v === layout ? 'true' : 'false'));

    /* 機關說明：選了主題就講這個主題的機關；選「隨機」就列出每個主題各有什麼 */
    function paintFx() {
      fxBox.textContent = '';
      const keep = Math.round(R.FX_KEEP * 100);
      if (theme < 0) {
        const chips = Art.THEMES.filter(x => fxKind(x.id)).map(x => h('span', { class: 'map-fx-chip' }, tr('map.fxChip', { th: x.name, fx: fxName(x.id) })));
        fxBox.append(h('div', { class: 'map-fx-body' },
          h('b', null, tr('map.fxTitle')),
          h('span', null, tr('map.fxIntro', { keep })),
          h('div', { class: 'map-fx-chips' }, chips)));
        return;
      }
      const kind = fxKind(theme), nm = themeName(theme);
      if (!kind) {
        fxBox.append(h('div', { class: 'map-fx-body' }, h('b', null, tr('map.noFx', { th: nm })), h('span', null, tr('map.noFxText'))));
        return;
      }
      const info = fxInfo(kind), ico = h('canvas', { class: 'map-fx-ico', 'aria-hidden': 'true' });
      paintFxIcon(ico, theme);
      fxBox.append(ico, h('div', { class: 'map-fx-body' },
        h('b', null, tr('map.fxOf', { th: nm, fx: fxName(theme) }) + (fxName(theme) === info.name ? '' : tr('map.fxAlso', { name: info.name }))),
        info.lines.map(l => h('span', null, l)),
        h('small', { class: 'muted' }, tr('map.fxChance', { keep }))));
    }

    function paintBig() {
      paintFx();
      paintMap(big, theme, layout, seed, BIG_T);
      const shown = theme < 0 ? Art.THEMES[seed % R.THEME_COUNT].name : themeName(theme);
      const fabNow = theme === R.FAB_THEME;
      big.setAttribute('aria-label', tr('map.previewAria', { shown, l: layoutName(fabNow ? 'fab' : layout) }));
      bigTitle.textContent = tr('map.bigTitle', { th: themeName(theme), l: layoutName(fabNow ? 'fab' : layout) });
      fabNote.style.display = fabNow ? '' : 'none';
      layoutBtns.forEach(b => { b.style.opacity = fabNow ? '0.45' : ''; });
      bigSub.textContent = (theme < 0 || layout === 'random' ? tr('map.sub.any') : tr('map.sub.one'));
    }

    const build = () => {
      big = h('canvas', { class: 'map-big', role: 'img' });
      bigTitle = h('b', { class: 'map-big-title' }); bigSub = h('span', { class: 'muted small' });
      const reroll = btn(tr('map.reroll'), { cls: 'btn-sky btn-sm', icon: 'refresh', iconSize: 18, onClick: () => { seed = 1 + Math.floor(Math.random() * 900); paintBig(); } });
      themeBtns = THEMES.map(t => {
        const cv = h('canvas', { class: 'map-card-cv', 'aria-hidden': 'true' });
        if (t.v < 0) paintRandom(cv, THUMB_T); else paintMap(cv, t.v, 'classic', THUMB_SEED, THUMB_T);
        return h('button', { type: 'button', role: 'radio', class: 'map-card', 'aria-checked': t.v === theme ? 'true' : 'false', 'aria-label': t.name,
          onClick: () => { if (root.Sound) root.Sound.sfx('click'); theme = t.v; syncTheme(); paintBig(); } },
          cv, h('span', { class: 'map-card-name' }, t.name), h('i', { class: 'map-card-ok', 'aria-hidden': 'true' }));
      });
      layoutBtns = LAYOUTS.map(l => h('button', { type: 'button', role: 'radio', class: 'map-lay', 'aria-checked': l.v === layout ? 'true' : 'false',
        onClick: () => { if (root.Sound) root.Sound.sfx('click'); layout = l.v; syncLayout(); paintBig(); } },
        h('b', null, l.label), h('small', null, l.hint)));
      fabNote = h('p', { class: 'muted small' }, tr('map.fabNote'));
      fxBox = h('div', { class: 'map-fx' });
      const content = h('div', { class: 'map-pick' },
        h('div', { class: 'map-preview' }, big, h('div', { class: 'map-preview-bar' }, h('div', null, bigTitle, h('br'), bigSub), reroll)),
        fxBox,
        h('h3', { class: 'map-h' }, tr('map.theme')),
        h('div', { class: 'map-grid', role: 'radiogroup', 'aria-label': tr('map.themeGroup') }, themeBtns),
        h('h3', { class: 'map-h' }, tr('map.layout')),
        h('div', { class: 'map-lays', role: 'radiogroup', 'aria-label': tr('map.layoutGroup') }, layoutBtns),
        fabNote);
      return {
        title: tr('map.pick'), content,
        actions: [btn(tr('common.cancel'), { cls: 'btn-ghost', onClick: () => m.close() }),
          btn(tr('map.apply'), { cls: 'btn-mint', icon: 'check', iconSize: 20, onClick: () => { m.close(true); o.onApply && o.onApply({ theme, layout }); } })]
      };
    };
    const spec = build();
    const m = modal({ cls: 'dialog-lg map-dialog', title: spec.title, content: spec.content, actions: spec.actions,
      rebuild: () => { const s2 = build(); setTimeout(paintBig, 0); return s2; } });
    paintBig();
    return m;
  }

  root.MapPick = { mapButton, mapPicker, themeName, layoutName, LAYOUTS, THEMES };
})(typeof self !== 'undefined' ? self : this);
