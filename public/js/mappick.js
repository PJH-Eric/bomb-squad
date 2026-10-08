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

  /* 各種機關的白話說明（選地圖時顯示）；數字跟 rules.js 的規則一致 */
  const FX_INFO = {
    grass: { name: '草叢', lines: [
      '躲進草叢，其他人（電腦也一樣）就完全看不到你，連你放在草叢裡的炸彈也看不到（但炸彈的火力線警示還是看得到）；沒有例外，貼在旁邊、你自己、淘汰後或觀戰的人也都看不到。',
      '草叢只放在死路格（四邊有三邊是硬牆），所以裡面的炸彈只會往一個方向炸。每張圖最多 2～8 格，開局就看得見，不蓋軟磚。'] },
    belt: { name: '輸送帶', lines: [
      '頭尾相連、形狀不規則的環形輸送帶：踩上去會被順著帶子一路繞圈帶走，停在上面的炸彈也會被載走。',
      '炸彈前面有人或障礙就停住，離開帶子就停下。四個角落各一圈，可以和軟磚疊在一起，磚炸掉才露出來。'] },
    slow: { name: '緩速格', lines: [
      '踩上去速度只剩 6 成，離開就恢復；格子右下角有蝸牛記號。',
      '每個角落各一小塊，可以和軟磚疊在一起，磚炸掉才露出來。'] },
    spike: { name: '尖刺', lines: [
      '固定的尖刺，不會傷人；但炸彈放在上面、或被踢到（滑到）上面，會當場爆炸。',
      '每張圖只有 2～8 個，開局就看得見，不蓋軟磚；空投與空襲也不會落在上面。'] }
  };
  /* 每個主題專屬的機關名稱（一個主題最多 1 種，競技場沒有） */
  const FX_NAME = { 0: '糖漿', 1: '洋流', 2: '磁浮輸送帶', 3: '草叢', 4: '流沙', 5: '積雪', 7: '產線輸送帶', 8: '石筍', 9: '骨刺', 10: '黑曜石刺', 11: '聖誕樹叢', 12: '旋轉輸送台' };
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

    /* 機關說明：選了主題就講這個主題的機關；選「隨機」就列出每個主題各有什麼 */
    const fxBox = h('div', { class: 'map-fx' });
    function paintFx() {
      fxBox.textContent = '';
      const keep = Math.round(R.FX_KEEP * 100);
      if (theme < 0) {
        const chips = Art.THEMES.filter(x => fxKind(x.id)).map(x => h('span', { class: 'map-fx-chip' }, x.name + '：' + FX_NAME[x.id]));
        fxBox.append(h('div', { class: 'map-fx-body' },
          h('b', null, '地圖機關'),
          h('span', null, '每個主題最多有 1 種專屬機關（競技場沒有），機關不多，免得干擾你自己的操作；有機關的主題，每張圖約 ' + keep + '% 會出現，位置左右上下對稱，對每個出生點都公平。'),
          h('div', { class: 'map-fx-chips' }, chips)));
        return;
      }
      const kind = fxKind(theme), nm = themeName(theme);
      if (!kind) {
        fxBox.append(h('div', { class: 'map-fx-body' }, h('b', null, nm + '：沒有機關'), h('span', null, '單純的比賽場地，只有硬牆、軟磚和道具。')));
        return;
      }
      const info = FX_INFO[kind], ico = h('canvas', { class: 'map-fx-ico', 'aria-hidden': 'true' });
      paintFxIcon(ico, theme);
      fxBox.append(ico, h('div', { class: 'map-fx-body' },
        h('b', null, nm + '的機關：' + FX_NAME[theme] + (FX_NAME[theme] === info.name ? '' : '（' + info.name + '）')),
        info.lines.map(l => h('span', null, l)),
        h('small', { class: 'muted' }, '這個主題每張圖約 ' + keep + '% 會出現機關（也可能這一張沒有）；預覽換一張可以看到不同的配置。')));
    }

    function paintBig() {
      paintFx();
      paintMap(big, theme, layout, seed, BIG_T);
      const shown = theme < 0 ? Art.THEMES[seed % R.THEME_COUNT].name : themeName(theme);
      big.setAttribute('aria-label', '地圖預覽：' + shown + '，' + layoutName(layout) + '版型');
      bigTitle.textContent = themeName(theme) + '・' + layoutName(layout) + '版型';
      bigSub.textContent = (theme < 0 || layout === 'random' ? '這只是其中一種可能，每局都會重新抽。' : '預覽只是其中一張，每局的硬牆與軟磚位置都不一樣。');
    }

    const m = modal({ title: '選擇地圖', cls: 'dialog-lg map-dialog',
      content: h('div', { class: 'map-pick' },
        h('div', { class: 'map-preview' }, big, h('div', { class: 'map-preview-bar' }, h('div', null, bigTitle, h('br'), bigSub), reroll)),
        fxBox,
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
