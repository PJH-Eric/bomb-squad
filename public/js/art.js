/* ===== art.js — 手繪向量美術（全部是程式產生的 SVG／Canvas 路徑，沒有 emoji、沒有外部圖檔） =====
 *
 *   Art.animalSVG(id, facing, frame)  炸彈小隊隊員（圓頭盔＋臉窗＋天線球，頭＋身體＋手＋腳，漸層做立體感）
 *   Art.itemSVG(type)                 道具圖示：強化是圓形、詛咒是帶刺的紫色外框，形狀就能分辨
 *   Art.bombSVG()                     炸彈
 *   Art.icon(name)                    介面小圖示（currentColor）
 *   Art.buildTileset(T, themeId)      六套地圖主題的地板／硬牆／軟磚／外框
 */
(function (root) {
  'use strict';

  const ANIMALS = {
    cat:     { name: '小貓', body: '#ffb86b', dark: '#e88f3b', belly: '#fff0da', ear: 'point', earIn: '#ff9db4', nose: '#ff7f9f', tail: 'cat', stripes: true },
    dog:     { name: '小狗', body: '#e8b87c', dark: '#c58b4d', belly: '#fff4e2', ear: 'floppy', earCol: '#a8693a', nose: '#3a2a2a', muzzle: '#fff4e2', tail: 'dog' },
    bunny:   { name: '小兔', body: '#fff7fb', dark: '#e6cfe0', belly: '#ffe3ef', ear: 'long', earIn: '#ffb3d1', nose: '#ff8aa5', tail: 'puff' },
    bear:    { name: '小熊', body: '#b9824f', dark: '#936235', belly: '#f4dab6', ear: 'round', earIn: '#ebc496', nose: '#3a2a2a', muzzle: '#f4dab6' },
    panda:   { name: '熊貓', body: '#ffffff', dark: '#d9d9e0', belly: '#ffffff', ear: 'round', earCol: '#2d2d36', limb: '#2d2d36', patches: true, nose: '#2d2d36' },
    fox:     { name: '狐狸', body: '#ff8c3f', dark: '#dd6420', belly: '#fff3e6', ear: 'point', earIn: '#3a2a2a', cheeks: '#fff3e6', tail: 'fox', nose: '#3a2a2a' },
    frog:    { name: '青蛙', body: '#72d56c', dark: '#43b04a', belly: '#e0f8b0', ear: 'none', eyesTop: true, nose: null, wide: true },
    penguin: { name: '企鵝', body: '#465176', dark: '#2c3452', belly: '#ffffff', ear: 'none', beak: '#ffb43b', feet: '#ffb43b', penguin: true }
  };
  const ANIMAL_IDS = Object.keys(ANIMALS);

  const f1 = n => Math.round(n * 10) / 10;

  /* ---------- 動物 ---------- */
  function defs(a, id) {
    return '<defs>' +
      '<linearGradient id="b' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + a.body + '"/><stop offset="1" stop-color="' + a.dark + '"/></linearGradient>' +
      '<radialGradient id="h' + id + '" cx="0.35" cy="0.28" r="0.85"><stop offset="0" stop-color="#ffffff" stop-opacity="0.75"/><stop offset="0.35" stop-color="' + a.body + '"/><stop offset="1" stop-color="' + a.dark + '"/></radialGradient>' +
      '</defs>';
  }
  function ear(a, kind, x, y, flip, id) {
    const s = flip ? -1 : 1;
    const col = a.earCol || a.body;
    const inner = a.earIn || '#ffb3c9';
    switch (kind) {
      case 'point':
        return '<path d="M' + (x - 8 * s) + ' ' + (y + 6) + ' L' + (x - 1 * s) + ' ' + (y - 11) + ' L' + (x + 8 * s) + ' ' + (y + 5) + ' Z" fill="' + col + '" stroke="' + a.dark + '" stroke-width="1.4" stroke-linejoin="round"/>' +
          '<path d="M' + (x - 4 * s) + ' ' + (y + 3) + ' L' + (x - 1 * s) + ' ' + (y - 5) + ' L' + (x + 4 * s) + ' ' + (y + 3) + ' Z" fill="' + inner + '"/>';
      case 'floppy':
        return '<ellipse cx="' + (x + 2 * s) + '" cy="' + (y + 6) + '" rx="6" ry="10" transform="rotate(' + (s * 18) + ' ' + x + ' ' + y + ')" fill="' + col + '" stroke="#7a4a26" stroke-width="1.3"/>';
      case 'long':
        return '<ellipse cx="' + x + '" cy="' + (y - 4) + '" rx="5.2" ry="14" transform="rotate(' + (s * 8) + ' ' + x + ' ' + y + ')" fill="' + a.body + '" stroke="' + a.dark + '" stroke-width="1.4"/>' +
          '<ellipse cx="' + x + '" cy="' + (y - 3) + '" rx="2.6" ry="10" transform="rotate(' + (s * 8) + ' ' + x + ' ' + y + ')" fill="' + inner + '"/>';
      case 'round':
        return '<circle cx="' + x + '" cy="' + y + '" r="6.4" fill="' + col + '" stroke="' + (a.earCol ? '#1c1c24' : a.dark) + '" stroke-width="1.3"/>' +
          (a.earCol ? '' : '<circle cx="' + x + '" cy="' + y + '" r="3.2" fill="' + inner + '"/>');
      default: return '';
    }
  }

  /* 小隊配色：頭盔／連身服用動物主色，手套、靴子、天線球用各自的亮色 */
  const ACCENT = { cat: '#ff4f8b', dog: '#2f86e6', bunny: '#a35cff', bear: '#2fbf63', panda: '#ff9a1f', fox: '#18b9d6', frog: '#ffcf2e', penguin: '#ff5545' };
  const INK = '#2a1f3d';

  /** 炸彈小隊隊員（圓頭盔＋臉窗＋天線球的連身裝）。facing: 'down'（正面）| 'up'（背面）| 'left'（側面，向右時由畫面鏡射）；frame: 0 站 1 左腳 2 右腳 */
  function animalSVG(id, facing, frame) {
    const a = ANIMALS[id] || ANIMALS.cat;
    const ac = ACCENT[id] || '#ff4f8b';
    const uid = id + facing + frame;
    const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    const side = facing === 'left', back = facing === 'up';
    const suit = a.penguin ? a.body : a.body;
    let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' + defs(a, uid) +
      '<linearGradient id="a' + uid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="0.3" stop-color="' + ac + '"/><stop offset="1" stop-color="' + ac + '"/></linearGradient>';
    s = s.replace('</defs>', '').replace(/<\/defs>$/, '');
    s += '</defs><g transform="translate(3.8 6.5) scale(0.88)">';

    /* 靴子 */
    const bootY = n => (n ? 55 : 57.5);
    if (side) {
      s += '<ellipse cx="' + (37 - step * 3) + '" cy="' + bootY(step === -1) + '" rx="7" ry="4.6" fill="url(#a' + uid + ')" stroke="' + INK + '" stroke-width="2.4"/>';
      s += '<ellipse cx="' + (27 + step * 3) + '" cy="' + bootY(step === 1) + '" rx="7" ry="4.6" fill="url(#a' + uid + ')" stroke="' + INK + '" stroke-width="2.4"/>';
    } else {
      s += '<ellipse cx="24.5" cy="' + bootY(step === 1) + '" rx="7" ry="4.8" fill="url(#a' + uid + ')" stroke="' + INK + '" stroke-width="2.4"/>';
      s += '<ellipse cx="39.5" cy="' + bootY(step === -1) + '" rx="7" ry="4.8" fill="url(#a' + uid + ')" stroke="' + INK + '" stroke-width="2.4"/>';
    }

    /* 連身服身體 */
    const bx = side ? 22 : 19, bw = side ? 20 : 26;
    s += '<rect x="' + bx + '" y="39" width="' + bw + '" height="17" rx="8" fill="url(#b' + uid + ')" stroke="' + INK + '" stroke-width="2.4"/>';
    s += '<rect x="' + (bx + 1.5) + '" y="49" width="' + (bw - 3) + '" height="3.4" fill="' + ac + '" opacity="0.95"/>';
    if (!back) {
      const cx = side ? 29 : 32;
      s += '<circle cx="' + cx + '" cy="44" r="3.7" fill="#2f2a4d" stroke="' + INK + '" stroke-width="1.2"/><circle cx="' + (cx - 1) + '" cy="43" r="1.1" fill="#fff" opacity="0.8"/>';
    }

    /* 手臂＋手套 */
    const sw = step * 2.4;
    if (side) {
      s += '<circle cx="29.5" cy="' + f1(47 + sw) + '" r="5.2" fill="url(#a' + uid + ')" stroke="' + INK + '" stroke-width="2.4"/>';
    } else {
      s += '<ellipse cx="17" cy="' + f1(45 - sw * 0.5) + '" rx="4.2" ry="6" transform="rotate(20 17 45)" fill="url(#b' + uid + ')" stroke="' + INK + '" stroke-width="2.4"/>';
      s += '<ellipse cx="47" cy="' + f1(45 + sw * 0.5) + '" rx="4.2" ry="6" transform="rotate(-20 47 45)" fill="url(#b' + uid + ')" stroke="' + INK + '" stroke-width="2.4"/>';
      s += '<circle cx="13.5" cy="' + f1(50 - sw) + '" r="5" fill="url(#a' + uid + ')" stroke="' + INK + '" stroke-width="2.4"/>';
      s += '<circle cx="50.5" cy="' + f1(50 + sw) + '" r="5" fill="url(#a' + uid + ')" stroke="' + INK + '" stroke-width="2.4"/>';
    }

    /* 頭盔 */
    const hx = side ? 29 : 32, hy = 25, rx = 20, ry = 17.5;
    if (!a.eyesTop) {
      if (side) s += ear(a, a.ear, hx + 4, hy - 14, false, uid);
      else { s += ear(a, a.ear, hx - 12.5, hy - 11, false, uid); s += ear(a, a.ear, hx + 12.5, hy - 11, true, uid); }
    } else {
      const eyes = side ? [[hx - 6, 9]] : [[hx - 11, 10], [hx + 11, 10]];
      for (const [ex, ey] of eyes) s += '<circle cx="' + ex + '" cy="' + ey + '" r="7.5" fill="url(#h' + uid + ')" stroke="' + INK + '" stroke-width="2.4"/>';
    }
    /* 天線＋球 */
    s += '<path d="M' + hx + ' ' + (hy - ry + 1) + ' L' + hx + ' ' + (hy - ry - 3) + '" stroke="' + INK + '" stroke-width="3.6" stroke-linecap="round"/>' +
      '<circle cx="' + hx + '" cy="' + (hy - ry - 5) + '" r="4.2" fill="' + ac + '" stroke="' + INK + '" stroke-width="2.2"/><circle cx="' + (hx - 1.3) + '" cy="' + (hy - ry - 6.3) + '" r="1.3" fill="#fff" opacity="0.85"/>';
    s += '<ellipse cx="' + hx + '" cy="' + hy + '" rx="' + rx + '" ry="' + ry + '" fill="url(#h' + uid + ')" stroke="' + INK + '" stroke-width="2.6"/>';
    /* 頭盔亮面與下緣色帶 */
    s += '<path d="M' + (hx - 14) + ' ' + (hy - 8) + ' Q' + (hx - 9) + ' ' + (hy - 15) + ' ' + (hx - 1) + ' ' + (hy - 15.5) + '" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.75"/>';
    if (!back) {
      /* 臉窗 */
      const wx = side ? hx - 17 : hx - 13.5, ww = side ? 20 : 27, wy = hy - 6.5, wh = 15.5;
      s += '<rect x="' + wx + '" y="' + wy + '" width="' + ww + '" height="' + wh + '" rx="7.5" fill="#fff0e0" stroke="' + INK + '" stroke-width="2.2"/>';
      s += '<rect x="' + (wx + 2) + '" y="' + (wy + 1.4) + '" width="' + (ww - 4) + '" height="3" rx="1.5" fill="#fff" opacity="0.85"/>';
      const ey = hy + 0.5;
      if (side) {
        const ex = wx + 5.5;
        if (a.patches) s += '<ellipse cx="' + ex + '" cy="' + ey + '" rx="3.7" ry="4.6" transform="rotate(18 ' + ex + ' ' + ey + ')" fill="#2d2d36"/>';
        s += '<ellipse cx="' + ex + '" cy="' + ey + '" rx="2.7" ry="3.6" fill="#1d1630"/><circle cx="' + (ex - 0.8) + '" cy="' + (ey - 1.3) + '" r="1" fill="#fff"/>';
        if (a.beak) s += '<path d="M' + (wx + 1) + ' ' + (ey + 3.5) + ' l-6 2.2 l6 2.2 z" fill="' + a.beak + '" stroke="' + INK + '" stroke-width="1"/>';
        else if (a.nose) s += '<ellipse cx="' + (wx + 1.5) + '" cy="' + (ey + 3.8) + '" rx="2.1" ry="1.7" fill="' + a.nose + '"/>';
      } else {
        const exL = hx - 6, exR = hx + 6;
        if (a.patches) {
          s += '<ellipse cx="' + exL + '" cy="' + ey + '" rx="4.2" ry="5.4" transform="rotate(20 ' + exL + ' ' + ey + ')" fill="#2d2d36"/>';
          s += '<ellipse cx="' + exR + '" cy="' + ey + '" rx="4.2" ry="5.4" transform="rotate(-20 ' + exR + ' ' + ey + ')" fill="#2d2d36"/>';
        }
        s += '<ellipse cx="' + exL + '" cy="' + ey + '" rx="2.8" ry="3.9" fill="#1d1630"/><circle cx="' + (exL - 0.9) + '" cy="' + (ey - 1.5) + '" r="1.15" fill="#fff"/>';
        s += '<ellipse cx="' + exR + '" cy="' + ey + '" rx="2.8" ry="3.9" fill="#1d1630"/><circle cx="' + (exR - 0.9) + '" cy="' + (ey - 1.5) + '" r="1.15" fill="#fff"/>';
        if (a.beak) s += '<path d="M' + (hx - 3.6) + ' ' + (ey + 3.6) + ' L' + hx + ' ' + (ey + 8) + ' L' + (hx + 3.6) + ' ' + (ey + 3.6) + ' Z" fill="' + a.beak + '" stroke="' + INK + '" stroke-width="1"/>';
        else if (a.nose) s += '<ellipse cx="' + hx + '" cy="' + (ey + 4.6) + '" rx="2" ry="1.5" fill="' + a.nose + '"/>';
        else if (a.wide) s += '<path d="M' + (hx - 5) + ' ' + (ey + 5.2) + ' Q' + hx + ' ' + (ey + 8) + ' ' + (hx + 5) + ' ' + (ey + 5.2) + '" fill="none" stroke="#2f7a38" stroke-width="1.8" stroke-linecap="round"/>';
        s += '<ellipse cx="' + (hx - 10.5) + '" cy="' + (ey + 4) + '" rx="2.4" ry="1.6" fill="#ff8fb0" opacity="0.6"/><ellipse cx="' + (hx + 10.5) + '" cy="' + (ey + 4) + '" rx="2.4" ry="1.6" fill="#ff8fb0" opacity="0.6"/>';
      }
    } else {
      /* 背面：頭盔後方的色帶 */
      s += '<path d="M' + (hx - 15) + ' ' + (hy + 6) + ' Q' + hx + ' ' + (hy + 12) + ' ' + (hx + 15) + ' ' + (hy + 6) + '" fill="none" stroke="' + ac + '" stroke-width="3.2" stroke-linecap="round"/>';
    }
    s += '</g></svg>';
    return s;
  }

  /* ---------- 道具 ---------- */
  const ITEM_STYLE = {
    fire:    { bg1: '#ffb24a', bg2: '#ff5a3c' },
    bomb:    { bg1: '#8d7bff', bg2: '#5a46d8' },
    speed:   { bg1: '#7fe3ff', bg2: '#2f9fe8' },
    kick:    { bg1: '#9cf06a', bg2: '#3fb54a' },
    shield:  { bg1: '#ffe27a', bg2: '#f0a81e' },
    c_slow:  { bg1: '#b79adf', bg2: '#6f4aa3' },
    c_auto:  { bg1: '#b79adf', bg2: '#6f4aa3' },
    c_short: { bg1: '#b79adf', bg2: '#6f4aa3' }
  };
  const ITEM_NAMES = {
    fire: '火力 +1', bomb: '炸彈 +1', speed: '加速', kick: '踢炸彈', shield: '護盾',
    c_slow: '遲緩詛咒', c_auto: '手滑詛咒', c_short: '短火詛咒'
  };
  const ITEM_DESC = {
    fire: '爆炸往外多延伸 1 格（最多 8 格）',
    bomb: '可以同時放的炸彈多 1 顆（最多 6 顆）',
    speed: '跑得更快（最多 5 級）',
    kick: '走向炸彈就能把它踢著滑走，直到撞到東西',
    shield: '擋掉一次爆炸，之後有 1 秒無敵',
    c_slow: '8 秒內只能慢慢走',
    c_auto: '8 秒內會自己一直放炸彈',
    c_short: '8 秒內爆炸只剩 1 格長'
  };
  function itemGlyph(type) {
    switch (type) {
      case 'fire': return '<path d="M24 8 C27 15 34 17 34 26 C34 33 29 38 24 38 C19 38 14 33 14 27 C14 22 17 20 18 16 C20 19 21 20 22 20 C22 15 23 11 24 8 Z" fill="#fff6d8" stroke="#fff" stroke-width="1"/><path d="M24 22 C26 26 29 27 29 31 C29 34 27 36 24 36 C21 36 19 34 19 31 C19 28 23 26 24 22 Z" fill="#ff7a3a"/>';
      case 'bomb': return '<circle cx="22" cy="28" r="10.5" fill="#2b2542"/><circle cx="18.5" cy="24.5" r="3" fill="#fff" opacity="0.35"/><path d="M28 19 Q33 14 35 10" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="36" cy="9" r="2.6" fill="#ffd54a"/><path d="M36 20 v8 M32 24 h8" stroke="#fff" stroke-width="3" stroke-linecap="round"/>';
      case 'speed': return '<path d="M10 30 C10 24 14 22 18 22 L24 22 C25 26 28 27 33 28 C36 28.6 38 30 38 33 L38 35 L10 35 Z" fill="#fff"/><path d="M10 35 h28" stroke="#2f9fe8" stroke-width="2.4"/><path d="M12 14 h9 M8 19 h9 M14 9 h7" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0.9"/><path d="M26 20 q6 -6 12 -3 q-3 5 -9 6 z" fill="#fff6d8"/>';
      case 'kick': return '<path d="M14 12 h10 v13 q0 2 2 3 l9 3 q4 1.4 4 5 v1 h-25 z" fill="#fff"/><path d="M14 36 h25" stroke="#3fb54a" stroke-width="2.4"/><path d="M33 13 l7 5 l-7 5 z" fill="#fff6d8"/><path d="M27 18 h6" stroke="#fff6d8" stroke-width="2.4" stroke-linecap="round"/>';
      case 'shield': return '<path d="M24 8 L37 13 V24 C37 32 31 37 24 40 C17 37 11 32 11 24 V13 Z" fill="#fff" stroke="#fff6c8" stroke-width="1.5" stroke-linejoin="round"/><path d="M24 14 L31 17 V24 C31 29 28 32 24 34 Z" fill="#f0a81e"/><path d="M24 14 L17 17 V24 C17 29 20 32 24 34 Z" fill="#ffd54a"/>';
      case 'c_slow': return '<circle cx="21" cy="25" r="9" fill="#fff"/><path d="M21 25 m-5 0 a5 5 0 1 1 5 5 a2.5 2.5 0 1 1 -2.4 -2.5" fill="none" stroke="#6f4aa3" stroke-width="2"/><path d="M12 36 h24 q3 0 3 -3 q0 -4 -4 -4 h-4" fill="#fff"/><path d="M34 29 q0 -6 3 -8 M37 29 q2 -5 5 -6" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/>';
      case 'c_auto': return '<circle cx="24" cy="27" r="8.5" fill="#2b2542"/><path d="M29 20 Q33 16 35 12" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M11 18 a14 14 0 0 1 24 -6 M37 30 a14 14 0 0 1 -24 6" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/><path d="M36 7 v7 h-7 M12 41 v-7 h7" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>';
      case 'c_short': return '<path d="M24 10 C26 15 31 17 31 23 C31 28 28 31 24 31 C20 31 17 28 17 24 C17 20 20 19 21 16 C22 18 23 18 23 18 C23 15 24 13 24 10 Z" fill="#fff6d8"/><path d="M24 34 v8 M19 38 l5 5 l5 -5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    return '';
  }
  function itemSVG(type) {
    const st = ITEM_STYLE[type] || ITEM_STYLE.fire;
    const curse = type.indexOf('c_') === 0;
    let ring;
    if (curse) {
      /* 詛咒：帶尖刺的外框 */
      let d = '';
      const n = 12;
      for (let i = 0; i < n * 2; i++) {
        const ang = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? 19.5 : 23.5;
        d += (i ? 'L' : 'M') + f1(24 + Math.cos(ang) * r) + ' ' + f1(24 + Math.sin(ang) * r);
      }
      ring = '<path d="' + d + 'Z" fill="url(#g' + type + ')" stroke="#3a2466" stroke-width="2" stroke-linejoin="round"/>';
    } else {
      ring = '<circle cx="24" cy="24" r="21.5" fill="url(#g' + type + ')" stroke="#ffffff" stroke-width="3"/><circle cx="24" cy="24" r="21.5" fill="none" stroke="#00000030" stroke-width="1"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><linearGradient id="g' + type + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + st.bg1 + '"/><stop offset="1" stop-color="' + st.bg2 + '"/></linearGradient></defs>' +
      ring + itemGlyph(type) + '</svg>';
  }

  function bombSVG() {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>' +
      '<radialGradient id="bb" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#6b6390"/><stop offset="0.45" stop-color="#2f2a4d"/><stop offset="1" stop-color="#15122a"/></radialGradient></defs>' +
      '<ellipse cx="32" cy="58" rx="18" ry="4" fill="#00000030"/>' +
      '<circle cx="32" cy="38" r="20" fill="url(#bb)" stroke="#0e0b1f" stroke-width="2"/>' +
      '<ellipse cx="24" cy="29" rx="6.5" ry="4.2" transform="rotate(-35 24 29)" fill="#fff" opacity="0.42"/>' +
      '<rect x="27" y="14" width="10" height="7" rx="2.5" fill="#6d6692" stroke="#0e0b1f" stroke-width="1.6"/>' +
      '<path d="M32 14 Q34 7 41 6" fill="none" stroke="#c9a46a" stroke-width="3" stroke-linecap="round"/>' +
      '</svg>';
  }

  /* ---------- 介面小圖示（stroke = currentColor） ---------- */
  const ICONS = {
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M18.5 5.5l-1.9 1.9M7.4 16.6l-1.9 1.9"/>',
    home: '<path d="M4 11.5 12 4l8 7.5V20H4z"/><path d="M10 20v-5h4v5"/>',
    back: '<path d="M14 5 7 12l7 7"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    chat: '<path d="M4 5h16v11H10l-4 4v-4H4z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    crown: '<path d="M4 18 3 8l5 4 4-7 4 7 5-4-1 10z"/>',
    kick: '<path d="M5 12h9M10 7l5 5-5 5"/><path d="M19 4v16"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="M5 12.5 10 17.5 19 7"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    vibrate: '<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M4 8v8M20 8v8"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
    refresh: '<path d="M20 5v5h-5M4 19v-5h5"/><path d="M5.5 9A7.5 7.5 0 0 1 19 10M18.5 15A7.5 7.5 0 0 1 5 14"/>',
    trash: '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/>',
    robot: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 8V4M9 13h.01M15 13h.01M9 16.5h6"/>',
    pause: '<path d="M8.5 5v14M15.5 5v14"/>',
    flag: '<path d="M6 21V4M6 5h11l-2 4 2 4H6"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8"/>'
  };
  function icon(name, size) {
    const z = size || 22;
    return '<svg class="ico" width="' + z + '" height="' + z + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  /* ---------- 地圖主題 ---------- */
  const THEMES = [
    { id: 0, name: '糖果樂園', floorA: '#ffeaf4', floorB: '#ffdbeb', hard: ['#ff8fc4', '#d84a8b'], hardPat: 'stripes', soft: ['#ffe0a8', '#e6a65a'], softPat: 'cookie', border: ['#c96bd8', '#8a3da5'], bg: '#ffc7df', particle: '#ffb36b' },
    { id: 1, name: '海底世界', floorA: '#dcf5ff', floorB: '#c9ecfb', hard: ['#6fb0ee', '#3875c6'], hardPat: 'coral', soft: ['#fff2cf', '#e9c777'], softPat: 'shell', border: ['#3077b8', '#1c4c86'], bg: '#9edcf5', particle: '#fff2cf' },
    { id: 2, name: '太空站', floorA: '#3d466c', floorB: '#353d5f', hard: ['#a7b3d6', '#5d6a94'], hardPat: 'rivet', soft: ['#ffbf75', '#d98339'], softPat: 'crate', border: ['#252b4a', '#151933'], bg: '#252b4a', particle: '#ffbf75' },
    { id: 3, name: '森林', floorA: '#d8f3aa', floorB: '#c9ea97', hard: ['#9a7551', '#624528'], hardPat: 'stump', soft: ['#86d46f', '#4ea244'], softPat: 'bush', border: ['#409148', '#2b6b31'], bg: '#a5dc86', particle: '#7fd16a' },
    { id: 4, name: '沙漠', floorA: '#fdebb9', floorB: '#f7dea4', hard: ['#dd9f5e', '#a96d33'], hardPat: 'stone', soft: ['#f6c870', '#c88f3a'], softPat: 'brick', border: ['#b8763d', '#7f4b22'], bg: '#f3cf86', particle: '#f6c870' },
    { id: 5, name: '雪地', floorA: '#f3fcff', floorB: '#e3f5fb', hard: ['#a2def6', '#5ab2d7'], hardPat: 'ice', soft: ['#ffffff', '#b9d8e6'], softPat: 'snow', border: ['#6eacca', '#437d9b'], bg: '#cdeaf5', particle: '#ffffff' },
    { id: 6, name: '競技場', floorA: '#63b84a', floorB: '#4fa23c', hard: ['#c4cad6', '#6b7488'], hardPat: 'steel', soft: ['#e8794a', '#b84a28'], softPat: 'redbrick', border: ['#59627a', '#2a3042'], bg: '#2a3042', particle: '#ffd24d' },
    { id: 7, name: '日月光廠房', floorA: '#f6f1df', floorB: '#ece6cc', hard: ['#2b3d73', '#16224a'], hardPat: 'machine', soft: ['#f07d5a', '#c4492c'], softPat: 'wafer', border: ['#12803f', '#0b4a2a'], bg: '#16224a', particle: '#ffd84d' }
  ];

  function mkCanvas(w, h) {
    if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    return null;
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function lin(ctx, y0, y1, c0, c1) {
    const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); return g;
  }

  /** 硬牆：厚實、深色粗框、有立體側面，絕對不會被誤認成可炸的軟磚 */
  function drawHard(ctx, T, th) {
    const m = T * 0.06, h = T - m * 2, depth = T * 0.16;
    ctx.save();
    rr(ctx, m, m + depth * 0.5, h, h - depth * 0.5, T * 0.16); ctx.fillStyle = th.hard[1]; ctx.fill();
    rr(ctx, m, m, h, h - depth, T * 0.16);
    ctx.fillStyle = lin(ctx, m, m + h, th.hard[0], th.hard[1]); ctx.fill();
    ctx.lineWidth = Math.max(2, T * 0.06); ctx.strokeStyle = 'rgba(30,20,50,0.55)'; ctx.stroke();
    ctx.clip();
    const x0 = m, y0 = m, w = h, hh = h - depth;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = Math.max(1.5, T * 0.04);
    switch (th.hardPat) {
      case 'stripes':
        ctx.save(); ctx.lineWidth = T * 0.1;
        for (let i = -3; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x0 + i * T * 0.22, y0 + hh); ctx.lineTo(x0 + i * T * 0.22 + hh, y0); ctx.stroke(); }
        ctx.restore(); break;
      case 'coral':
        for (const [cx, cy, r] of [[0.3, 0.32, 0.1], [0.68, 0.28, 0.08], [0.5, 0.55, 0.12], [0.25, 0.65, 0.07], [0.74, 0.62, 0.09]]) { ctx.beginPath(); ctx.arc(x0 + cx * w, y0 + cy * hh, r * T, 0, 7); ctx.stroke(); }
        break;
      case 'rivet':
        for (const [cx, cy] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.74], [0.8, 0.74]]) { ctx.beginPath(); ctx.arc(x0 + cx * w, y0 + cy * hh, T * 0.045, 0, 7); ctx.fill(); }
        ctx.strokeRect(x0 + w * 0.28, y0 + hh * 0.3, w * 0.44, hh * 0.38); break;
      case 'stump':
        for (const r of [0.34, 0.22, 0.1]) { ctx.beginPath(); ctx.arc(x0 + w / 2, y0 + hh / 2, r * T, 0, 7); ctx.stroke(); }
        break;
      case 'stone':
        ctx.beginPath(); ctx.moveTo(x0 + w * 0.2, y0 + hh * 0.3); ctx.lineTo(x0 + w * 0.46, y0 + hh * 0.42); ctx.lineTo(x0 + w * 0.4, y0 + hh * 0.7);
        ctx.moveTo(x0 + w * 0.46, y0 + hh * 0.42); ctx.lineTo(x0 + w * 0.8, y0 + hh * 0.34); ctx.stroke(); break;
      case 'machine': {
        /* 十二芒太陽星：綠／黃配色，半圓點綴（品牌色調的原創圖形） */
        const cx = x0 + w * 0.5, cy = y0 + hh * 0.52, R = w * 0.36, r0 = w * 0.2;
        ctx.beginPath();
        for (let i = 0; i < 24; i++) { const rad = i % 2 ? r0 : R, an = i * Math.PI / 12 - Math.PI / 2; ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(an) * rad, cy + Math.sin(an) * rad); }
        ctx.closePath(); ctx.fillStyle = '#17a35a'; ctx.fill();
        ctx.beginPath(); ctx.arc(cx, cy, r0 * 0.92, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fillStyle = '#ffd84d'; ctx.fill();
        ctx.beginPath(); ctx.arc(cx, cy, r0 * 0.92, -Math.PI / 2, 0); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fillStyle = '#ef6a47'; ctx.fill();
        break;
      }
      case 'steel':
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x0 + w * 0.14, y0 + hh * 0.14, w * 0.72, hh * 0.1);
        ctx.strokeStyle = 'rgba(40,50,70,0.5)'; ctx.strokeRect(x0 + w * 0.2, y0 + hh * 0.3, w * 0.6, hh * 0.46);
        ctx.fillStyle = 'rgba(40,50,70,0.55)';
        for (const [cx, cy] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) { ctx.beginPath(); ctx.arc(x0 + cx * w, y0 + cy * hh, T * 0.04, 0, 7); ctx.fill(); }
        break;
      case 'ice':
        ctx.beginPath(); ctx.moveTo(x0 + w * 0.15, y0 + hh * 0.55); ctx.lineTo(x0 + w * 0.5, y0 + hh * 0.15); ctx.moveTo(x0 + w * 0.3, y0 + hh * 0.8); ctx.lineTo(x0 + w * 0.85, y0 + hh * 0.2); ctx.stroke(); break;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x0, y0, w, hh * 0.22);
    ctx.restore();
  }

  /** 軟磚：淺色、圓潤、有裂紋與小點，一看就是「可以炸」 */
  function drawSoft(ctx, T, th) {
    const m = T * 0.1, s = T - m * 2;
    ctx.save();
    rr(ctx, m, m + T * 0.05, s, s, T * 0.2); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();
    rr(ctx, m, m, s, s, T * 0.2);
    ctx.fillStyle = lin(ctx, m, m + s, th.soft[0], th.soft[1]); ctx.fill();
    ctx.lineWidth = Math.max(1.5, T * 0.04); ctx.strokeStyle = th.soft[1]; ctx.stroke();
    ctx.clip();
    ctx.strokeStyle = 'rgba(120,70,30,0.45)'; ctx.fillStyle = 'rgba(120,70,30,0.45)'; ctx.lineWidth = Math.max(1.2, T * 0.035);
    const x0 = m, y0 = m;
    switch (th.softPat) {
      case 'cookie':
        for (const [cx, cy] of [[0.3, 0.3], [0.65, 0.4], [0.42, 0.68], [0.72, 0.72], [0.25, 0.62]]) { ctx.beginPath(); ctx.arc(x0 + cx * s, y0 + cy * s, T * 0.05, 0, 7); ctx.fillStyle = '#7a4a2a'; ctx.fill(); }
        break;
      case 'shell':
        ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.moveTo(x0 + s / 2, y0 + s * 0.82); ctx.lineTo(x0 + s * (0.15 + i * 0.175), y0 + s * 0.2); } ctx.stroke(); break;
      case 'crate':
        ctx.strokeRect(x0 + s * 0.12, y0 + s * 0.12, s * 0.76, s * 0.76);
        ctx.beginPath(); ctx.moveTo(x0 + s * 0.12, y0 + s * 0.12); ctx.lineTo(x0 + s * 0.88, y0 + s * 0.88); ctx.moveTo(x0 + s * 0.88, y0 + s * 0.12); ctx.lineTo(x0 + s * 0.12, y0 + s * 0.88); ctx.stroke(); break;
      case 'bush':
        ctx.strokeStyle = 'rgba(20,80,30,0.5)';
        for (const [cx, cy, r] of [[0.32, 0.38, 0.17], [0.66, 0.34, 0.15], [0.5, 0.66, 0.19]]) { ctx.beginPath(); ctx.arc(x0 + cx * s, y0 + cy * s, r * s, 0, 7); ctx.stroke(); }
        break;
      case 'brick':
        ctx.beginPath();
        for (let r = 1; r < 3; r++) { ctx.moveTo(x0, y0 + s * r / 3); ctx.lineTo(x0 + s, y0 + s * r / 3); }
        ctx.moveTo(x0 + s * 0.5, y0); ctx.lineTo(x0 + s * 0.5, y0 + s / 3); ctx.moveTo(x0 + s * 0.25, y0 + s / 3); ctx.lineTo(x0 + s * 0.25, y0 + s * 2 / 3);
        ctx.moveTo(x0 + s * 0.75, y0 + s / 3); ctx.lineTo(x0 + s * 0.75, y0 + s * 2 / 3); ctx.moveTo(x0 + s * 0.5, y0 + s * 2 / 3); ctx.lineTo(x0 + s * 0.5, y0 + s);
        ctx.stroke(); break;
      case 'wafer': {
        /* 晶圓盒／紙箱：封箱膠帶＋晶圓圖樣（一看就是可以炸開的箱子） */
        ctx.fillStyle = 'rgba(255,216,77,0.85)'; ctx.fillRect(x0 + s * 0.4, y0, s * 0.2, s);
        const wc = [x0 + s * 0.5, y0 + s * 0.58], wr = s * 0.27;
        ctx.fillStyle = '#cfd9e3'; ctx.beginPath(); ctx.arc(wc[0], wc[1], wr, 0, 7); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.arc(wc[0], wc[1], wr, 0, 7); ctx.clip();
        ctx.strokeStyle = 'rgba(40,70,100,0.55)'; ctx.lineWidth = Math.max(1, T * 0.025); ctx.beginPath();
        for (let i = -3; i <= 3; i++) { ctx.moveTo(wc[0] + i * wr * 0.3, wc[1] - wr); ctx.lineTo(wc[0] + i * wr * 0.3, wc[1] + wr); ctx.moveTo(wc[0] - wr, wc[1] + i * wr * 0.3); ctx.lineTo(wc[0] + wr, wc[1] + i * wr * 0.3); }
        ctx.stroke(); ctx.restore();
        ctx.strokeStyle = 'rgba(70,40,10,0.55)'; ctx.lineWidth = Math.max(1.5, T * 0.04); ctx.beginPath(); ctx.arc(wc[0], wc[1], wr, 0, 7); ctx.stroke();
        break;
      }
      case 'redbrick':
        ctx.strokeStyle = 'rgba(90,25,10,0.6)'; ctx.lineWidth = Math.max(1.5, T * 0.045);
        ctx.beginPath();
        for (let r = 1; r < 4; r++) { ctx.moveTo(x0, y0 + s * r / 4); ctx.lineTo(x0 + s, y0 + s * r / 4); }
        for (let r = 0; r < 4; r++) { const off = r % 2 ? 0.25 : 0.5; ctx.moveTo(x0 + s * off, y0 + s * r / 4); ctx.lineTo(x0 + s * off, y0 + s * (r + 1) / 4); if (r % 2) { ctx.moveTo(x0 + s * 0.75, y0 + s * r / 4); ctx.lineTo(x0 + s * 0.75, y0 + s * (r + 1) / 4); } }
        ctx.stroke(); break;
      case 'snow':
        ctx.strokeStyle = 'rgba(80,130,160,0.45)';
        for (const [cx, cy, r] of [[0.3, 0.55, 0.2], [0.62, 0.42, 0.22], [0.52, 0.72, 0.16]]) { ctx.beginPath(); ctx.arc(x0 + cx * s, y0 + cy * s, r * s, Math.PI, 0); ctx.stroke(); }
        break;
    }
    /* 裂紋：軟磚共通記號 */
    ctx.strokeStyle = 'rgba(80,40,20,0.4)'; ctx.lineWidth = Math.max(1.2, T * 0.03);
    ctx.beginPath(); ctx.moveTo(x0 + s * 0.78, y0 + s * 0.04); ctx.lineTo(x0 + s * 0.68, y0 + s * 0.22); ctx.lineTo(x0 + s * 0.8, y0 + s * 0.3); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x0, y0, s, s * 0.2);
    ctx.restore();
  }

  function drawFloor(ctx, T, th, alt) {
    ctx.fillStyle = alt ? th.floorB : th.floorA; ctx.fillRect(0, 0, T, T);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 0, T, Math.max(1, T * 0.06));
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, T - Math.max(1, T * 0.05), T, Math.max(1, T * 0.05));
    if (th.id === 6) {
      const g = ctx.createLinearGradient(0, 0, T, T); g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0.1)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, T, T);
    }
    if (th.id === 7) {
      /* 暖白地磚：細縫＋綠色導引線（交錯） */
      ctx.strokeStyle = 'rgba(30,45,87,0.14)'; ctx.lineWidth = Math.max(1, T * 0.03); ctx.strokeRect(0.5, 0.5, T - 1, T - 1);
      if (alt) { ctx.fillStyle = 'rgba(23,163,90,0.35)'; ctx.fillRect(T * 0.45, T * 0.14, T * 0.1, T * 0.72); }
    }
    if (th.id === 2) {
      ctx.strokeStyle = 'rgba(150,170,230,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(T * 0.1, T * 0.1, T * 0.8, T * 0.8);
    }
  }
  function drawBorder(ctx, T, th) {
    ctx.fillStyle = lin(ctx, 0, T, th.border[0], th.border[1]); ctx.fillRect(0, 0, T, T);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(0, 0, T, T * 0.18);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = Math.max(1, T * 0.04); ctx.strokeRect(T * 0.05, T * 0.05, T * 0.9, T * 0.9);
    if (th.id === 7) {
      /* 綠牆板：黃色飾帶＋三角齒（太陽星意象） */
      ctx.fillStyle = '#ffd84d'; ctx.fillRect(0, T * 0.44, T, T * 0.12);
      ctx.fillStyle = '#1e2d57';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(T * (i / 3), T * 0.44); ctx.lineTo(T * (i / 3 + 1 / 6), T * 0.2); ctx.lineTo(T * ((i + 1) / 3), T * 0.44); ctx.fill(); }
      ctx.fillStyle = '#ef6a47'; ctx.fillRect(0, T * 0.8, T, T * 0.06);
    }
    if (th.id === 6) {
      ctx.fillStyle = 'rgba(255,214,77,0.9)';
      ctx.fillRect(T * 0.12, T * 0.44, T * 0.76, T * 0.12);
      ctx.fillStyle = 'rgba(20,24,38,0.6)';
      for (const [cx, cy] of [[0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]]) { ctx.beginPath(); ctx.arc(T * cx, T * cy, T * 0.04, 0, 7); ctx.fill(); }
    }
  }

  function buildTileset(T, themeId) {
    const th = THEMES[themeId] || THEMES[0];
    const make = fn => { const c = mkCanvas(T, T); const x = c.getContext('2d'); fn(x); return c; };
    return {
      theme: th,
      floorA: make(x => drawFloor(x, T, th, false)),
      floorB: make(x => drawFloor(x, T, th, true)),
      hard: make(x => drawHard(x, T, th)),
      soft: make(x => drawSoft(x, T, th)),
      border: make(x => drawBorder(x, T, th))
    };
  }

  /** 把 SVG 字串轉成圖片，載入後回呼 */
  function svgImage(svg, cb) {
    const img = new Image();
    img.onload = () => cb && cb(img);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return img;
  }
  function svgUrl(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }

  root.Art = {
    ANIMALS, ANIMAL_IDS, THEMES, ITEM_NAMES, ITEM_DESC,
    animalSVG, itemSVG, bombSVG, icon, buildTileset, svgImage, svgUrl, rr
  };
})(typeof self !== 'undefined' ? self : this);
