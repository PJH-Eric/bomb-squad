/* ===== art.js — 手繪向量美術（全部是程式產生的 SVG／Canvas 路徑，沒有 emoji、沒有外部圖檔） =====
 *
 *   Art.animalSVG(id, facing, frame)  炸彈小隊隊員（九種小動物，各有不同頭型、五官與尾巴，脖子上的領巾是隊伍色）
 *   Art.itemSVG(type)                 道具圖示：強化是圓形、詛咒是帶刺的紫色外框，形狀就能分辨
 *   Art.bombSVG()                     炸彈
 *   Art.icon(name)                    介面小圖示（currentColor）
 *   Art.buildTileset(T, themeId)      六套地圖主題的地板／硬牆／軟磚／外框
 */
(function (root) {
  'use strict';

  /* 每隻動物的頭型、身材、配色都不同，縮小在格子裡也能靠輪廓分辨；accent 是領巾（隊伍色） */
  const ANIMALS = {
    cat:     { name: '小貓', role: '均衡型', intro: '身手靈巧、貓步輕快，火力能練到 10、炸彈能帶 9 顆，樣樣都不差。', body: '#b8bfd3', dark: '#7f88a6', belly: '#f4f5fb', stripe: '#5f6884', earIn: '#ffa8c3', nose: '#ff7f9f', accent: '#ff4f8b', head: [17, 15, 24], bw: 22 },
    dog:     { name: '小狗', role: '炸彈型', intro: '最愛挖洞埋東西，開場就有 2 顆炸彈，最多能帶 10 顆。', body: '#f6d9a8', dark: '#d9a86a', belly: '#fffaf0', earCol: '#8a5530', spot: '#b9773f', nose: '#2a1f2a', accent: '#2f86e6', head: [17, 15, 24], bw: 24 },
    bunny:   { name: '小兔', role: '速度型', intro: '跑得飛快，還能加速 8 次越跑越快！但火力和炸彈的上限比別隻低一些。', body: '#ffe6f1', dark: '#e9b7cf', belly: '#ffffff', earIn: '#ff9cc4', nose: '#ff6f9a', accent: '#a35cff', head: [15.5, 14.5, 27], bw: 22 },
    bear:    { name: '小熊', role: '火力型', intro: '力氣大，開場火力就有 2 格，最遠能噴到 12 格！', body: '#a8703f', dark: '#7a4b25', belly: '#f1d3a6', earIn: '#e3b582', nose: '#2a1f2a', accent: '#2fbf63', head: [18.5, 16, 24], bw: 28 },
    panda:   { name: '熊貓', role: '力量型', intro: '圓滾滾的實力派，開場火力、炸彈都是 2，火力能練到 11，可惜跑不太動。', body: '#ffffff', dark: '#d6d6e2', belly: '#ffffff', limb: '#2d2d36', nose: '#2d2d36', accent: '#ff9a1f', head: [18, 15.5, 24], bw: 26 },
    fox:     { name: '狐狸', role: '陷阱型', intro: '狡猾愛佈陷阱，開場 2 顆炸彈，腳程也還能練得很快。', body: '#ff8a3a', dark: '#d9601c', belly: '#fff6ea', earIn: '#3a2a2a', nose: '#2a1f2a', accent: '#18b9d6', head: [17, 14.5, 25], bw: 22 },
    frog:    { name: '青蛙', role: '遠攻型', intro: '舌頭長長，火力 2 格起跳，蹦蹦跳跳也能加速 7 次。', body: '#72d56c', dark: '#3fa847', belly: '#e6fbb8', nose: '#2f7a38', accent: '#ffcf2e', head: [21, 12.5, 30], bw: 30 },
    penguin: { name: '企鵝', role: '重砲型', intro: '搖搖擺擺跑得慢，但開場火力、炸彈都是 2，炸彈能帶到 10 顆。', body: '#3f4a72', dark: '#232a48', belly: '#ffffff', beak: '#ffb43b', accent: '#ff5545' },
    chick:   { name: '小雞', role: '游擊型', intro: '小小一隻跑得飛快，炸彈能帶到 10 顆到處丟，可惜火力上限只有 8。', body: '#ffdc4a', dark: '#eaa51c', belly: '#fff6c4', paw: '#ff9a2e', beak: '#ff9a2e', accent: '#3d47c9', head: [16, 14.5, 25], bw: 24 }
  };
  const ANIMAL_IDS = Object.keys(ANIMALS);

  const f1 = n => Math.round(n * 10) / 10;
  const INK = '#2a1f3d';
  /** 小工具：el('ellipse', { cx: 1, stroke_width: 2 }) → <ellipse cx="1" stroke-width="2"/> */
  function el(tag, o) {
    let s = '<' + tag;
    for (const k in o) if (o[k] != null) s += ' ' + k.replace(/_/g, '-') + '="' + (typeof o[k] === 'number' ? f1(o[k]) : o[k]) + '"';
    return s + '/>';
  }
  const ell = (cx, cy, rx, ry, fill, o) => el('ellipse', Object.assign({ cx, cy, rx, ry, fill }, o));
  const line = (d, stroke, w, o) => el('path', Object.assign({ d, fill: 'none', stroke, stroke_width: w, stroke_linecap: 'round', stroke_linejoin: 'round' }, o));
  /* 有黑色外框的粗線條（尾巴、領巾帶子）：先畫粗的墨色，再疊細的本色 */
  const tube = (d, col, w) => line(d, INK, w + 2.6) + line(d, col, w);
  const OUT = { stroke: INK, stroke_width: 2.4 };

  function eye(x, y, k) {
    k = k || 1;
    return ell(x, y, 2.8 * k, 3.7 * k, '#1d1630') + el('circle', { cx: x - 0.9 * k, cy: y - 1.4 * k, r: 1.15 * k, fill: '#fff' });
  }
  const blush = (x, y) => ell(x, y, 2.6, 1.6, '#ff8fb0', { opacity: 0.6 });

  /* ---------- 動物：各部位 ---------- */
  function feet(v) {
    const a = v.a, col = a.paw || a.limb || a.dark, st = v.step;
    const y = up => (up ? 55.5 : 58);
    if (v.side) {
      return ell(v.hx + 8 - st * 3, y(st === -1), 6.4, 4.2, col, OUT) + ell(v.hx - 1 + st * 3, y(st === 1), 6.4, 4.2, col, OUT);
    }
    const dx = v.id === 'frog' ? 11 : 7.5;
    let s = ell(32 - dx, y(st === 1), v.id === 'frog' ? 7.5 : 6.4, 4.2, col, OUT) + ell(32 + dx, y(st === -1), v.id === 'frog' ? 7.5 : 6.4, 4.2, col, OUT);
    if (v.id === 'frog' && !v.back) {
      for (const sx of [-1, 1]) {
        const fx = 32 + sx * dx, fy = y(sx === -1 ? st === 1 : st === -1);
        s += line('M' + f1(fx - 2.5) + ' ' + f1(fy + 1) + ' v2.6 M' + f1(fx + 2.5) + ' ' + f1(fy + 1) + ' v2.6', a.dark, 1.4);
      }
    }
    return s;
  }
  function body(v) {
    const a = v.a;
    if (v.side) {
      const bx = v.hx - 7;
      return el('rect', Object.assign({ x: bx, y: 38, width: 20, height: 19, rx: 9, fill: 'url(#b' + v.uid + ')' }, OUT)) +
        ell(bx + 6, 49, 4.5, 5.5, a.belly);
    }
    const bw = a.bw, top = v.id === 'frog' ? 41 : 38;
    let s = el('rect', Object.assign({ x: 32 - bw / 2, y: top, width: bw, height: 57 - top, rx: 9, fill: 'url(#b' + v.uid + ')' }, OUT));
    if (!v.back) s += ell(32, 49.5, bw / 2 - 5, 5.6, a.belly);
    return s;
  }
  function arms(v) {
    const a = v.a, sw = v.step * 2.4, col = a.limb || 'url(#b' + v.uid + ')';
    if (v.side) return ell(v.hx + 3, f1(47 + sw), 4.2, 6, col, Object.assign({ transform: 'rotate(' + (-v.step * 14) + ' ' + (v.hx + 3) + ' 43)' }, OUT));
    const ax = a.bw / 2 + 1;
    return ell(32 - ax, f1(46.5 - sw * 0.5), 4.2, 6.2, col, Object.assign({ transform: 'rotate(22 ' + (32 - ax) + ' 46)' }, OUT)) +
      ell(32 + ax, f1(46.5 + sw * 0.5), 4.2, 6.2, col, Object.assign({ transform: 'rotate(-22 ' + (32 + ax) + ' 46)' }, OUT));
  }
  /** 領巾（隊伍色）：脖子一圈，前面打結；側面／背面看得到飄起來的兩條帶子 */
  function scarf(v, neckY, half) {
    const ac = v.a.accent, cx = v.side ? v.hx + 3 : 32;
    const flap = v.step * 1.5;
    let s = '';
    if (v.side) s += tube('M' + (cx + 8) + ' ' + (neckY + 1) + ' q6 ' + f1(1 + flap) + ' 10 ' + f1(4 - flap) + ' M' + (cx + 8) + ' ' + (neckY + 1) + ' q5 ' + f1(4 + flap) + ' 7 ' + f1(8 - flap), ac, 3.2);
    else if (v.back) s += tube('M32 ' + (neckY + 1) + ' l-3 ' + f1(8 + flap) + ' M32 ' + (neckY + 1) + ' l3.5 ' + f1(7.5 - flap), ac, 3.4);
    s += tube('M' + f1(cx - half) + ' ' + neckY + ' Q' + cx + ' ' + (neckY + 4.5) + ' ' + f1(cx + half) + ' ' + neckY, ac, 4.4);
    if (!v.back && !v.side) s += el('path', { d: 'M' + (cx + 4) + ' ' + (neckY + 2) + ' l4.5 6 l-6 0.6 z', fill: ac, stroke: INK, stroke_width: 1.8, stroke_linejoin: 'round' });
    return s;
  }
  /** 尾巴：(x, y) 是接在身體上的點，dir 1 往右長 */
  function tail(v, x, y) {
    const a = v.a, w = v.step * 1.5;
    switch (v.id) {
      case 'cat': return tube('M' + x + ' ' + y + ' C' + (x + 10) + ' ' + (y + 2) + ' ' + (x + 13) + ' ' + (y - 9) + ' ' + f1(x + 8 + w) + ' ' + (y - 17), a.body, 5) +
        line('M' + (x + 9) + ' ' + (y - 2) + ' l3 -1 M' + (x + 11) + ' ' + (y - 8) + ' l3 0', a.stripe, 1.8);
      case 'dog': return tube('M' + x + ' ' + y + ' Q' + (x + 8) + ' ' + (y - 2) + ' ' + f1(x + 7 + w * 2) + ' ' + (y - 11), a.body, 5);
      case 'fox':
        /* 蓬鬆大尾巴＋白色尾尖：以 (x, y) 為原點畫，再整體放大 */
        return '<g transform="translate(' + x + ' ' + y + ') scale(1.3)">' +
          el('path', Object.assign({ d: 'M0 4 C16 8 ' + f1(20 + w) + ' -10 ' + f1(11 + w) + ' -20 C8 -16 9 -8 5 -5 C3 -3 0 -3 0 -3 Z', fill: a.body, stroke_linejoin: 'round' }, OUT, { stroke_width: 1.9 })) +
          el('path', { d: 'M' + f1(11 + w) + ' -20 C9 -17 8.5 -13 9 -11 Q' + f1(14 + w) + ' -11 ' + f1(16.5 + w) + ' -13 C' + f1(15.5 + w) + ' -16 ' + f1(14 + w) + ' -18 ' + f1(11 + w) + ' -20 Z', fill: a.belly, stroke: INK, stroke_width: 1.3, stroke_linejoin: 'round' }) + '</g>';
      case 'chick': return v.back || v.side ? el('path', Object.assign({ d: 'M' + (x - 3) + ' ' + (y + 2) + ' L' + (x + 5) + ' ' + (y - 4) + ' L' + (x + 3) + ' ' + (y + 1) + ' L' + (x + 7) + ' ' + y + ' L' + (x + 1) + ' ' + (y + 5) + ' Z', fill: a.body, stroke_linejoin: 'round' }, OUT, { stroke_width: 2 })) : '';
      case 'bunny': return v.back || v.side ? el('circle', Object.assign({ cx: x, cy: y, r: 5.2, fill: '#fff' }, OUT)) : '';
      case 'bear': case 'panda': return v.back || v.side ? el('circle', Object.assign({ cx: x, cy: y, r: 3.4, fill: v.id === 'panda' ? a.limb : a.body }, OUT)) : '';
    }
    return '';
  }
  /** 耳朵：behind=true 的畫在頭後面；狗的垂耳要蓋在頭上，另外畫 */
  function ears(v) {
    const a = v.a, hx = v.hx, hy = v.hy, top = hy - v.ry;
    if (v.id === 'chick') {
      const cx = v.side ? hx + 2 : hx;
      return [[-32, -4.2, 1.5], [0, 0, 0], [32, 4.2, 1.5]].map(([rot, dx, dy]) =>
        ell(cx + dx, top - 3 + dy, 2.4, 5.6, a.body, Object.assign({ transform: 'rotate(' + rot + ' ' + (cx + dx) + ' ' + (top + 2 + dy) + ')' }, OUT, { stroke_width: 2 }))).join('');
    }
    const pos = v.side ? [[hx + 2, 1], [hx + 8, 1]] : [[hx - 11, -1], [hx + 11, 1]];
    let s = '';
    for (const [x, sx] of pos) {
      switch (v.id) {
        case 'cat': {
          const d = 'M' + (x - 7 * sx) + ' ' + (top + 7) + ' L' + (x + 1 * sx) + ' ' + (top - 8) + ' L' + (x + 7 * sx) + ' ' + (top + 5) + ' Z';
          s += el('path', Object.assign({ d, fill: a.body, stroke_linejoin: 'round' }, OUT));
          if (!v.back) s += el('path', { d: 'M' + (x - 3.5 * sx) + ' ' + (top + 5) + ' L' + (x + 0.8 * sx) + ' ' + (top - 3) + ' L' + (x + 3.5 * sx) + ' ' + (top + 4) + ' Z', fill: a.earIn });
          break;
        }
        case 'fox': {
          const d = 'M' + (x - 8 * sx) + ' ' + (top + 8) + ' L' + (x + 2 * sx) + ' ' + (top - 11) + ' L' + (x + 8 * sx) + ' ' + (top + 6) + ' Z';
          s += el('path', Object.assign({ d, fill: a.body, stroke_linejoin: 'round' }, OUT));
          s += el('path', { d: 'M' + (x - 1.4 * sx) + ' ' + (top - 4.5) + ' L' + (x + 2 * sx) + ' ' + (top - 11) + ' L' + (x + 4.6 * sx) + ' ' + (top - 3.5) + ' Z', fill: a.earIn, stroke: INK, stroke_width: 1.2, stroke_linejoin: 'round' });
          if (!v.back) s += el('path', { d: 'M' + (x - 4 * sx) + ' ' + (top + 6) + ' L' + (x - 0.6 * sx) + ' ' + (top - 2) + ' L' + (x + 4 * sx) + ' ' + (top + 5) + ' Z', fill: a.belly });
          break;
        }
        case 'bunny': {
          const rot = (v.side ? 14 : sx * 10) + (sx > 0 && !v.side ? 8 : 0);
          s += ell(x * 0.55 + hx * 0.45, top - 10, 5.2, 13.5, a.body, Object.assign({ transform: 'rotate(' + rot + ' ' + f1(x * 0.55 + hx * 0.45) + ' ' + (top + 2) + ')' }, OUT));
          if (!v.back) s += ell(x * 0.55 + hx * 0.45, top - 9, 2.5, 9.5, a.earIn, { transform: 'rotate(' + rot + ' ' + f1(x * 0.55 + hx * 0.45) + ' ' + (top + 2) + ')' });
          break;
        }
        case 'bear': case 'panda': {
          const ex = x + 2 * sx * (v.side ? 0 : 1);
          s += el('circle', Object.assign({ cx: ex, cy: top + 3, r: 6.4, fill: a.limb || a.body }, OUT));
          if (!a.limb && !v.back) s += el('circle', { cx: ex, cy: top + 3.4, r: 3.2, fill: a.earIn });
          break;
        }
      }
    }
    return s;
  }
  function dogEars(v) {
    const a = v.a, hx = v.hx, hy = v.hy, sw = v.step * 1.2;
    const one = (x, sx) => el('path', Object.assign({ d: 'M' + (x - 2 * sx) + ' ' + (hy - 13) + ' C' + (x + 9 * sx) + ' ' + (hy - 13) + ' ' + f1(x + 10 * sx) + ' ' + f1(hy + 5 + sw) + ' ' + f1(x + 6 * sx) + ' ' + f1(hy + 9 + sw) +
      ' C' + (x + 2 * sx) + ' ' + f1(hy + 12 + sw) + ' ' + (x - 1 * sx) + ' ' + (hy + 4) + ' ' + (x - 3 * sx) + ' ' + (hy - 4) + ' Z', fill: a.earCol, stroke_linejoin: 'round' }, OUT));
    if (v.side) return one(hx + 3, 1);
    return one(hx - 11, -1) + one(hx + 11, 1);
  }
  function headShape(v) {
    const { hx, hy, rx, ry } = v;
    const fill = 'url(#h' + v.uid + ')';
    if (v.id === 'fox' && !v.side) {
      /* 狐狸：兩頰往外蓬、下巴尖 */
      return el('path', Object.assign({ d: 'M' + (hx - rx) + ' ' + (hy + 2) + ' C' + (hx - rx) + ' ' + f1(hy - ry * 1.3) + ' ' + (hx + rx) + ' ' + f1(hy - ry * 1.3) + ' ' + (hx + rx) + ' ' + (hy + 2) +
        ' L' + (hx + rx + 3.5) + ' ' + (hy + 8) + ' Q' + (hx + 8) + ' ' + (hy + ry + 1) + ' ' + hx + ' ' + (hy + ry + 1) + ' Q' + (hx - 8) + ' ' + (hy + ry + 1) + ' ' + (hx - rx - 3.5) + ' ' + (hy + 8) + ' Z', fill, stroke_linejoin: 'round' }, OUT, { stroke_width: 2.6 }));
    }
    return ell(hx, hy, rx, ry, fill, Object.assign({}, OUT, { stroke_width: 2.6 }));
  }
  const shine = v => line('M' + (v.hx - v.rx + 5) + ' ' + (v.hy - v.ry * 0.45) + ' Q' + (v.hx - v.rx * 0.5) + ' ' + f1(v.hy - v.ry + 1.8) + ' ' + (v.hx - 1) + ' ' + f1(v.hy - v.ry + 1.4), '#fff', 2.6, { opacity: 0.7 });

  function faceFront(v) {
    const a = v.a, hx = v.hx, hy = v.hy;
    const ey = hy + 1;
    let s = '';
    switch (v.id) {
      case 'cat':
        s += line('M' + hx + ' ' + (hy - 14) + ' v4 M' + (hx - 4.5) + ' ' + (hy - 13) + ' l1 3.5 M' + (hx + 4.5) + ' ' + (hy - 13) + ' l-1 3.5', a.stripe, 2);
        s += eye(hx - 6.5, ey) + eye(hx + 6.5, ey);
        s += el('path', { d: 'M' + (hx - 1.8) + ' ' + (hy + 4.6) + ' h3.6 l-1.8 2.2 z', fill: a.nose, stroke: a.nose, stroke_width: 0.8, stroke_linejoin: 'round' });
        s += line('M' + (hx - 3.4) + ' ' + (hy + 7.4) + ' Q' + (hx - 1.7) + ' ' + (hy + 9.4) + ' ' + hx + ' ' + (hy + 7) + ' Q' + (hx + 1.7) + ' ' + (hy + 9.4) + ' ' + (hx + 3.4) + ' ' + (hy + 7.4), INK, 1.3);
        s += line('M' + (hx - 9) + ' ' + (hy + 5) + ' l-9 -2 M' + (hx - 9) + ' ' + (hy + 7.5) + ' l-9 1.5 M' + (hx + 9) + ' ' + (hy + 5) + ' l9 -2 M' + (hx + 9) + ' ' + (hy + 7.5) + ' l9 1.5', INK, 1.1, { opacity: 0.7 });
        s += blush(hx - 10.5, hy + 5) + blush(hx + 10.5, hy + 5);
        break;
      case 'dog':
        s += ell(hx + 6.5, ey, 5.2, 5.6, a.spot);
        s += eye(hx - 6.5, ey) + eye(hx + 6.5, ey);
        s += ell(hx, hy + 8, 8, 5.6, a.belly, { stroke: a.dark, stroke_width: 1.2 });
        s += el('path', { d: 'M' + (hx - 1.6) + ' ' + (hy + 10) + ' h3.2 v3 a1.6 1.6 0 0 1 -3.2 0 z', fill: '#ff7f9f', stroke: INK, stroke_width: 1 });
        s += line('M' + (hx - 3.5) + ' ' + (hy + 9.4) + ' Q' + hx + ' ' + (hy + 11.4) + ' ' + (hx + 3.5) + ' ' + (hy + 9.4), INK, 1.3);
        s += ell(hx, hy + 5.4, 3.6, 2.6, a.nose) + ell(hx - 1, hy + 4.6, 1.1, 0.7, '#fff', { opacity: 0.8 });
        break;
      case 'bunny':
        s += eye(hx - 6, ey, 1.05) + eye(hx + 6, ey, 1.05);
        s += ell(hx, hy + 5, 2, 1.5, a.nose);
        s += line('M' + hx + ' ' + (hy + 6.4) + ' v1.4 M' + (hx - 2.6) + ' ' + (hy + 8) + ' Q' + hx + ' ' + (hy + 9.4) + ' ' + (hx + 2.6) + ' ' + (hy + 8), INK, 1.2);
        s += el('rect', { x: hx - 2.2, y: hy + 8.4, width: 4.4, height: 3.4, rx: 0.8, fill: '#fff', stroke: INK, stroke_width: 1 }) + line('M' + hx + ' ' + (hy + 8.6) + ' v3', INK, 0.8);
        s += ell(hx - 10, hy + 5, 3.2, 2, '#ff8fb0', { opacity: 0.75 }) + ell(hx + 10, hy + 5, 3.2, 2, '#ff8fb0', { opacity: 0.75 });
        break;
      case 'bear':
        s += eye(hx - 7.5, hy - 1, 0.9) + eye(hx + 7.5, hy - 1, 0.9);
        s += ell(hx, hy + 6.5, 8, 6, a.belly, { stroke: a.dark, stroke_width: 1.2 });
        s += el('path', { d: 'M' + (hx - 3.2) + ' ' + (hy + 3.6) + ' h6.4 l-3.2 3.4 z', fill: a.nose, stroke: a.nose, stroke_width: 1.4, stroke_linejoin: 'round' });
        s += line('M' + hx + ' ' + (hy + 7) + ' v2 M' + (hx - 2.8) + ' ' + (hy + 10) + ' Q' + hx + ' ' + (hy + 11.5) + ' ' + (hx + 2.8) + ' ' + (hy + 10), INK, 1.3);
        s += blush(hx - 12, hy + 5) + blush(hx + 12, hy + 5);
        break;
      case 'panda':
        for (const sx of [-1, 1]) {
          s += ell(hx + sx * 6.5, ey + 0.5, 4.6, 5.8, a.limb, { transform: 'rotate(' + (sx * -28) + ' ' + (hx + sx * 6.5) + ' ' + (ey + 0.5) + ')' });
          s += el('circle', { cx: hx + sx * 6.5 + sx * 0.6, cy: ey, r: 2.3, fill: '#fff' }) + el('circle', { cx: hx + sx * 6.5 + sx * 0.6, cy: ey + 0.3, r: 1.3, fill: '#1d1630' });
        }
        s += ell(hx, hy + 6, 2.4, 1.7, a.nose);
        s += line('M' + (hx - 2.6) + ' ' + (hy + 8.6) + ' Q' + hx + ' ' + (hy + 10.4) + ' ' + (hx + 2.6) + ' ' + (hy + 8.6), INK, 1.3);
        s += blush(hx - 12, hy + 6) + blush(hx + 12, hy + 6);
        break;
      case 'fox':
        s += el('path', { d: 'M' + (hx - v.rx - 3) + ' ' + (hy + 8) + ' Q' + (hx - 9) + ' ' + (hy + 1) + ' ' + (hx - 3) + ' ' + (hy + 5) + ' L' + hx + ' ' + (hy + 7) + ' L' + (hx + 3) + ' ' + (hy + 5) + ' Q' + (hx + 9) + ' ' + (hy + 1) + ' ' + (hx + v.rx + 3) + ' ' + (hy + 8) +
          ' Q' + (hx + 8) + ' ' + (hy + v.ry) + ' ' + hx + ' ' + (hy + v.ry) + ' Q' + (hx - 8) + ' ' + (hy + v.ry) + ' ' + (hx - v.rx - 3) + ' ' + (hy + 8) + ' Z', fill: a.belly });
        /* 瞇瞇的狐狸眼 */
        s += el('path', { d: 'M' + (hx - 9.5) + ' ' + (hy - 0.5) + ' Q' + (hx - 6) + ' ' + (hy - 3.5) + ' ' + (hx - 2.8) + ' ' + (hy - 0.8) + ' Q' + (hx - 6) + ' ' + (hy + 2.6) + ' ' + (hx - 9.5) + ' ' + (hy - 0.5) + ' Z', fill: '#1d1630' });
        s += el('path', { d: 'M' + (hx + 9.5) + ' ' + (hy - 0.5) + ' Q' + (hx + 6) + ' ' + (hy - 3.5) + ' ' + (hx + 2.8) + ' ' + (hy - 0.8) + ' Q' + (hx + 6) + ' ' + (hy + 2.6) + ' ' + (hx + 9.5) + ' ' + (hy - 0.5) + ' Z', fill: '#1d1630' });
        s += el('circle', { cx: hx - 6.6, cy: hy - 1, r: 0.9, fill: '#fff' }) + el('circle', { cx: hx + 5.4, cy: hy - 1, r: 0.9, fill: '#fff' });
        s += ell(hx, hy + 7.2, 2.2, 1.6, a.nose);
        s += line('M' + (hx - 2.6) + ' ' + (hy + 9.6) + ' Q' + hx + ' ' + (hy + 11) + ' ' + (hx + 2.6) + ' ' + (hy + 9.6), INK, 1.2);
        break;
      case 'chick':
        s += eye(hx - 6.5, hy, 1.05) + eye(hx + 6.5, hy, 1.05);
        s += el('path', { d: 'M' + (hx - 3.6) + ' ' + (hy + 4.4) + ' L' + hx + ' ' + (hy + 2) + ' L' + (hx + 3.6) + ' ' + (hy + 4.4) + ' L' + hx + ' ' + (hy + 8.4) + ' Z', fill: a.beak, stroke: INK, stroke_width: 1.3, stroke_linejoin: 'round' });
        s += line('M' + (hx - 3.6) + ' ' + (hy + 4.4) + ' H' + (hx + 3.6), INK, 1);
        s += blush(hx - 10.5, hy + 5) + blush(hx + 10.5, hy + 5);
        break;
      case 'frog':
        s += line('M' + (hx - 12) + ' ' + (hy + 2) + ' Q' + hx + ' ' + (hy + 10.5) + ' ' + (hx + 12) + ' ' + (hy + 2), a.nose, 2.2);
        s += el('circle', { cx: hx - 2.2, cy: hy - 2, r: 0.9, fill: a.nose }) + el('circle', { cx: hx + 2.2, cy: hy - 2, r: 0.9, fill: a.nose });
        s += blush(hx - 14, hy + 3) + blush(hx + 14, hy + 3);
        break;
    }
    return s;
  }
  function faceSide(v) {
    const a = v.a, hx = v.hx, hy = v.hy, L = hx - v.rx;   /* L：臉的最左緣 */
    let s = '';
    switch (v.id) {
      case 'cat':
        s += line('M' + (hx - 3) + ' ' + (hy - 14) + ' v4 M' + (hx + 2) + ' ' + (hy - 14) + ' v4', a.stripe, 2);
        s += eye(hx - 7, hy + 1);
        s += el('path', { d: 'M' + (L - 0.5) + ' ' + (hy + 3.6) + ' l3 0.4 l-2 2 z', fill: a.nose });
        s += line('M' + (L + 4) + ' ' + (hy + 6) + ' l-9 -1.5 M' + (L + 4) + ' ' + (hy + 8) + ' l-9 1.5', INK, 1.1, { opacity: 0.7 });
        s += blush(hx - 3, hy + 5.5);
        break;
      case 'dog':
        s += ell(L + 1, hy + 6.5, 7, 5, a.belly, OUT);
        s += ell(L - 4.5, hy + 4.4, 3, 2.3, a.nose);
        s += el('path', { d: 'M' + (L - 1) + ' ' + (hy + 10.5) + ' h3 v3 a1.5 1.5 0 0 1 -3 0 z', fill: '#ff7f9f', stroke: INK, stroke_width: 1 });
        s += ell(hx - 5.5, hy, 4.6, 5, a.spot) + eye(hx - 6, hy);
        break;
      case 'bunny':
        s += eye(hx - 6, hy + 1, 1.05);
        s += ell(L + 0.6, hy + 4, 1.8, 1.4, a.nose);
        s += el('rect', { x: L + 1.2, y: hy + 7, width: 2.6, height: 3.2, rx: 0.6, fill: '#fff', stroke: INK, stroke_width: 1 });
        s += ell(hx - 2, hy + 5.5, 3, 2, '#ff8fb0', { opacity: 0.75 });
        break;
      case 'bear':
        s += ell(L + 1.5, hy + 6, 6.5, 4.8, a.belly, OUT);
        s += ell(L - 2.6, hy + 4, 2.6, 2, a.nose);
        s += eye(hx - 6, hy - 1, 0.9) + blush(hx, hy + 6);
        break;
      case 'panda':
        s += ell(hx - 7, hy + 1.5, 4.4, 5.6, a.limb, { transform: 'rotate(20 ' + (hx - 7) + ' ' + (hy + 1.5) + ')' });
        s += el('circle', { cx: hx - 7.6, cy: hy + 1, r: 2.2, fill: '#fff' }) + el('circle', { cx: hx - 8, cy: hy + 1.3, r: 1.2, fill: '#1d1630' });
        s += ell(L + 0.6, hy + 5.5, 2, 1.6, a.nose) + blush(hx - 1, hy + 7);
        break;
      case 'fox':
        s += el('path', Object.assign({ d: 'M' + (L + 5) + ' ' + (hy + 0.5) + ' L' + (L - 8) + ' ' + (hy + 6.5) + ' L' + (L + 6) + ' ' + (hy + 11) + ' Z', fill: a.belly, stroke_linejoin: 'round' }, OUT, { stroke_width: 2 }));
        s += ell(L - 7.5, hy + 6.4, 2, 1.6, a.nose);
        s += el('path', { d: 'M' + (hx - 10) + ' ' + (hy - 0.5) + ' Q' + (hx - 7) + ' ' + (hy - 3.5) + ' ' + (hx - 3.5) + ' ' + (hy - 1) + ' Q' + (hx - 7) + ' ' + (hy + 2.4) + ' ' + (hx - 10) + ' ' + (hy - 0.5) + ' Z', fill: '#1d1630' });
        s += el('circle', { cx: hx - 7.4, cy: hy - 1, r: 0.9, fill: '#fff' });
        break;
      case 'chick':
        s += eye(hx - 6.5, hy, 1.05);
        s += el('path', { d: 'M' + (L + 2) + ' ' + (hy + 1.5) + ' L' + (L - 6) + ' ' + (hy + 4) + ' L' + (L + 2) + ' ' + (hy + 6.5) + ' Z', fill: a.beak, stroke: INK, stroke_width: 1.3, stroke_linejoin: 'round' });
        s += blush(hx - 1.5, hy + 5.5);
        break;
      case 'frog':
        s += line('M' + (L + 1) + ' ' + (hy + 2.5) + ' Q' + (hx - 8) + ' ' + (hy + 8) + ' ' + (hx + 2) + ' ' + (hy + 6), a.nose, 2.2);
        s += el('circle', { cx: L + 2, cy: hy - 2, r: 0.9, fill: a.nose }) + blush(hx - 2, hy + 2);
        break;
    }
    return s;
  }
  /** 青蛙頭頂的兩顆凸眼 */
  function frogEyes(v) {
    const pos = v.side ? [[v.hx + 4, false], [v.hx - 6, true]] : [[v.hx - 10.5, true], [v.hx + 10.5, true]];
    let s = '';
    for (const [x, open] of pos) {
      const y = v.hy - 10;
      s += el('circle', Object.assign({ cx: x, cy: y, r: 7, fill: 'url(#h' + v.uid + ')' }, OUT));
      if (open && !v.back) {
        s += el('circle', { cx: x - (v.side ? 1.5 : 0), cy: y, r: 4.8, fill: '#fff', stroke: INK, stroke_width: 1 });
        s += ell(x - (v.side ? 2.6 : 0), y + 0.4, 2.6, 3.3, '#1d1630') + el('circle', { cx: x - (v.side ? 3.4 : 0.9), cy: y - 1, r: 1, fill: '#fff' });
      }
    }
    return s;
  }

  function critter(v) {
    const a = v.a;
    let s = '';
    /* 尾巴：正面時從身體右後方露出來，側面在身後，背面最後才畫（蓋在背上，不會被頭擋住） */
    const tailAt = v.side ? [v.hx + 12, 50] : v.back ? [32, 51] : [32 + a.bw / 2 - 1, 52];
    if (!v.back) s += tail(v, tailAt[0], tailAt[1]);
    s += feet(v) + body(v);
    s += arms(v);
    s += scarf(v, v.hy + v.ry - 0.5, v.side ? 8 : a.bw / 2 - 1);
    if (v.id !== 'dog') s += ears(v);
    s += headShape(v) + shine(v);
    if (v.id === 'frog') s += frogEyes(v);
    if (v.back) {
      if (v.id === 'cat') s += line('M' + (v.hx - 6) + ' ' + (v.hy - 10) + ' l2 5 M' + v.hx + ' ' + (v.hy - 12) + ' v6 M' + (v.hx + 6) + ' ' + (v.hy - 10) + ' l-2 5', a.stripe, 2.2);
      s += tail(v, tailAt[0], tailAt[1]);
    } else s += v.side ? faceSide(v) : faceFront(v);
    if (v.id === 'dog') s += dogEars(v);
    return s;
  }

  /** 企鵝沒有分開的頭和身體：一顆蛋形，白臉白肚 */
  function penguin(v) {
    const a = v.a, sw = v.step * 3, st = v.step;
    const fy = up => (up ? 55.5 : 58);
    const fill = 'url(#h' + v.uid + ')';
    let s = '';
    if (v.side) {
      s += ell(35 - st * 3, fy(st === -1), 6.4, 3.6, a.beak, OUT) + ell(27 + st * 3, fy(st === 1), 6.4, 3.6, a.beak, OUT);
      s += ell(31, 36, 15.5, 21.5, fill, Object.assign({}, OUT, { stroke_width: 2.6 }));
      s += ell(24, 43, 7.5, 12, a.belly) + ell(23.5, 27, 7, 6.2, a.belly);
      s += el('path', { d: 'M17.5 28.5 L9.5 31 L17.5 33.5 Z', fill: a.beak, stroke: INK, stroke_width: 1.5, stroke_linejoin: 'round' });
      s += eye(22, 26.5) + blush(26, 31);
      s += scarf(v, 37, 13);
      s += ell(36, f1(43 + sw * 0.6), 4.2, 9.5, a.dark, Object.assign({ transform: 'rotate(' + f1(18 - st * 10) + ' 36 36)' }, OUT));
      return s;
    }
    s += ell(24.5, fy(st === 1), 6.4, 3.8, a.beak, OUT) + ell(39.5, fy(st === -1), 6.4, 3.8, a.beak, OUT);
    s += ell(13.5, f1(41 - sw * 0.5), 4.2, 10, a.dark, Object.assign({ transform: 'rotate(28 13.5 34)' }, OUT));
    s += ell(50.5, f1(41 + sw * 0.5), 4.2, 10, a.dark, Object.assign({ transform: 'rotate(-28 50.5 34)' }, OUT));
    s += ell(32, 36, 18, 21.5, fill, Object.assign({}, OUT, { stroke_width: 2.6 }));
    s += line('M19 26 Q22 16.5 31 15', '#fff', 2.6, { opacity: 0.55 });
    if (!v.back) {
      s += ell(32, 45, 12, 11.5, a.belly);
      s += el('path', { d: 'M32 33 C28 22 18 22 19 30 C19.5 35 26 37 32 37 C38 37 44.5 35 45 30 C46 22 36 22 32 33 Z', fill: a.belly });
      s += eye(26, 28.5) + eye(38, 28.5);
      s += el('path', { d: 'M28.6 31.5 L35.4 31.5 L32 36 Z', fill: a.beak, stroke: INK, stroke_width: 1.4, stroke_linejoin: 'round' });
      s += blush(21.5, 33) + blush(42.5, 33);
    }
    s += scarf(v, 38.5, 14.5);
    return s;
  }

  /** 炸彈小隊隊員（各種小動物）。facing: 'down'（正面）| 'up'（背面）| 'left'（側面，向右時由畫面鏡射）；frame: 0 站 1 左腳 2 右腳 */
  function animalSVG(id, facing, frame) {
    if (!ANIMALS[id]) id = 'cat';
    const a = ANIMALS[id];
    const v = { id, a, uid: id + facing + frame, step: frame === 1 ? 1 : frame === 2 ? -1 : 0, side: facing === 'left', back: facing === 'up' };
    v.hx = v.side ? (a.head ? 30 : 28) : 32;
    if (a.head) { v.rx = a.head[0]; v.ry = a.head[1]; v.hy = a.head[2]; }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>' +
      '<linearGradient id="b' + v.uid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + a.body + '"/><stop offset="1" stop-color="' + a.dark + '"/></linearGradient>' +
      '<radialGradient id="h' + v.uid + '" cx="0.35" cy="0.28" r="0.85"><stop offset="0" stop-color="#ffffff" stop-opacity="0.6"/><stop offset="0.35" stop-color="' + a.body + '"/><stop offset="1" stop-color="' + a.dark + '"/></radialGradient>' +
      '</defs><g transform="translate(3.2 4.4) scale(0.9)">' + (id === 'penguin' ? penguin(v) : critter(v)) + '</g></svg>';
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
    c_short: { bg1: '#b79adf', bg2: '#6f4aa3' },
    c_flip:  { bg1: '#b79adf', bg2: '#6f4aa3' },
    ghost:   { bg1: '#8fe8d4', bg2: '#25a58d' },
    super:   { bg1: '#ff8a8a', bg2: '#d62839' },
    ultra:   { bg1: '#ff9ccf', bg2: '#d3438a' }
  };
  const ITEM_NAMES = {
    fire: '火力 +1', bomb: '炸彈 +1', speed: '加速', kick: '踢炸彈', shield: '護盾',
    c_slow: '遲緩詛咒', c_auto: '手滑詛咒', c_short: '短火詛咒',
    ghost: '隱身', super: '超人標誌', ultra: '大力藥丸', c_flip: '方向顛倒詛咒'
  };
  const ITEM_DESC = {
    fire: '爆炸往外多延伸 1 格（上限 8～12 格，看角色）',
    bomb: '可以同時放的炸彈多 1 顆（上限 7～10 顆，看角色）',
    speed: '跑得更快（能加速 5～8 次，看角色）',
    kick: '走向炸彈就能把它踢著滑走，直到撞到東西',
    shield: '擋掉一次爆炸，之後有 1 秒無敵',
    c_slow: '8 秒內只能慢慢走',
    c_auto: '8 秒內會自己一直放炸彈',
    c_short: '8 秒內爆炸只剩 1 格長',
    ghost: '8 秒內對手只看得到你淡淡的身形（電腦對手完全看不到你；你自己會變半透明）；炸彈和火焰照常有效',
    super: '15 秒內火力、炸彈數、跑速都變成你這隻角色的最高值',
    ultra: '火力直接升到你這隻角色的最高值（不會消失）',
    c_flip: '8 秒內上下左右操作顛倒'
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
      case 'ghost': return '<path d="M14 39 V23 a10 10 0 0 1 20 0 V39 l-3.3 -3.2 l-3.3 3.2 l-3.4 -3.2 l-3.4 3.2 l-3.3 -3.2 z" fill="#fff"/><circle cx="20" cy="24" r="2.6" fill="#1f8f7a"/><circle cx="28" cy="24" r="2.6" fill="#1f8f7a"/><path d="M21 30 q3 2.4 6 0" fill="none" stroke="#1f8f7a" stroke-width="2" stroke-linecap="round"/><path d="M36 11 l1.2 3 l3 1.2 l-3 1.2 l-1.2 3 l-1.2 -3 l-3 -1.2 l3 -1.2 z" fill="#fff6d8"/>';
      case 'super': return '<path d="M24 8 L39 15 L36 33 L24 41 L12 33 L9 15 Z" fill="#ffd84d" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M29.5 18 Q24 14.5 19.5 18.5 Q16.5 22 22 24.5 Q29.5 27 27 31.5 Q23 35 18 31.5" fill="none" stroke="#d62839" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>';
      case 'ultra': return '<g transform="rotate(-42 24 24)"><rect x="8" y="16" width="32" height="16" rx="8" fill="#fff"/><path d="M24 16 H32 a8 8 0 0 1 0 16 H24 Z" fill="#5a2aa8"/><rect x="12" y="18.6" width="11" height="3" rx="1.5" fill="#ffd0e6"/></g><path d="M36 9 l1.4 3.6 l3.6 1.4 l-3.6 1.4 l-1.4 3.6 l-1.4 -3.6 l-3.6 -1.4 l3.6 -1.4 z" fill="#fff6d8"/>';
      case 'c_flip': return '<path d="M17 36 V14 M11.5 20 L17 13.5 L22.5 20" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M31 12 V34 M25.5 28 L31 34.5 L36.5 28" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>';
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

  /** 空投機：卡通小飛機（由上往下看，機頭朝右），尾翼一抹品牌綠 */
  function planeSVG() {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">' +
      '<path d="M44 40 L22 8 L36 8 L66 38Z" fill="#e9eef7" stroke="#1d2b5c" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M44 40 L22 72 L36 72 L66 42Z" fill="#e9eef7" stroke="#1d2b5c" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M10 40 L4 22 L16 26 L28 36Z" fill="#17a35a" stroke="#1d2b5c" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M10 40 L4 58 L16 54 L28 44Z" fill="#17a35a" stroke="#1d2b5c" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M6 40 Q6 30 24 29 L86 29 Q112 32 114 40 Q112 48 86 51 L24 51 Q6 50 6 40Z" fill="#ffffff" stroke="#1d2b5c" stroke-width="3.5" stroke-linejoin="round"/>' +
      '<path d="M8 40 Q8 34 20 33 L86 33 Q108 35 111 40 Q108 45 86 47 L20 47 Q8 46 8 40Z" fill="#f6f8fd"/>' +
      '<rect x="40" y="35" width="20" height="10" rx="3" fill="#ef6a47" opacity="0.9"/>' +
      '<path d="M82 33 Q98 33 104 40 Q98 47 82 47Z" fill="#7fd6ff" stroke="#1d2b5c" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M86 36 Q94 36 98 39" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="114" cy="40" r="4" fill="#ffd84d" stroke="#1d2b5c" stroke-width="2"/>' +
      '<rect x="62" y="10" width="4" height="9" rx="2" fill="#ffd84d" stroke="#1d2b5c" stroke-width="1.5"/>' +
      '<rect x="62" y="61" width="4" height="9" rx="2" fill="#ffd84d" stroke="#1d2b5c" stroke-width="1.5"/>' +
      '</svg>';
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
    paw: '<ellipse cx="12" cy="16" rx="4.5" ry="3.6"/><circle cx="6" cy="10.5" r="1.9"/><circle cx="9.6" cy="6.6" r="1.9"/><circle cx="14.4" cy="6.6" r="1.9"/><circle cx="18" cy="10.5" r="1.9"/>',
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
    { id: 7, name: '日月光廠房', floorA: '#f6f1df', floorB: '#ece6cc', hard: ['#2b3d73', '#16224a'], hardPat: 'machine', soft: ['#f07d5a', '#c4492c'], softPat: 'wafer', border: ['#12803f', '#0b4a2a'], bg: '#16224a', particle: '#ffd84d' },
    { id: 8, name: '礦山', floorA: '#e0d0b8', floorB: '#d3c1a6', hard: ['#9a8d82', '#574d45'], hardPat: 'stone', soft: ['#d9964f', '#98602c'], softPat: 'crate', border: ['#7a5a3a', '#463220'], bg: '#463220', particle: '#d9964f' },
    { id: 9, name: '地下墓穴', floorA: '#544866', floorB: '#4a3f5c', hard: ['#9a97b0', '#514e6a'], hardPat: 'pillar', soft: ['#e0d6ae', '#aa9c6a'], softPat: 'pot', border: ['#2f2742', '#1a1428'], bg: '#1a1428', particle: '#e0d6ae' },
    { id: 10, name: '火山', floorA: '#6a4440', floorB: '#5d3a37', hard: ['#7a6a68', '#352a2a'], hardPat: 'stone', soft: ['#ff9a4a', '#c4501c'], softPat: 'brick', border: ['#8a2a1a', '#4a120a'], bg: '#2a0e0a', particle: '#ff9a4a' },
    { id: 11, name: '聖誕小鎮', floorA: '#eaf6ee', floorB: '#dcefe3', hard: ['#e85a5a', '#a02424'], hardPat: 'stripes', soft: ['#4fb86a', '#2a7a40'], softPat: 'present', border: ['#1f7a45', '#124a2a'], bg: '#124a2a', particle: '#ffd24d' },
    { id: 12, name: '遊樂園', floorA: '#fff4cc', floorB: '#ffe9ac', hard: ['#7fd0ff', '#2a8ad0'], hardPat: 'stripes', soft: ['#ff8fc4', '#d84a8b'], softPat: 'cake', border: ['#ff5a8a', '#b02060'], bg: '#b02060', particle: '#ffd24d' }
  ];

  /* 每個主題各有幾種「不能炸」與「能炸」的東西，一張地圖裡會混著出現（由 seed 與座標決定，連線雙方看到的一樣）。
   * 前面的比較常見；shape: round 是圓形的東西；c 是這種東西自己的顏色。能不能炸只看第一眼的形狀與裂紋，規則不變。 */
  const VARIANTS = [
    { hard: [{ pat: 'stripes' }, { pat: 'gumdrop', shape: 'round', c: ['#b99bff', '#7a3fcf'] }, { pat: 'swirl', shape: 'round', c: ['#7fe3ff', '#2fa6d6'] }],
      soft: [{ pat: 'cookie' }, { pat: 'cake', c: ['#ffe9f2', '#f2a0c8'] }, { pat: 'donut', shape: 'round', c: ['#ffc88a', '#d98a45'] }] },
    { hard: [{ pat: 'coral' }, { pat: 'urchin', shape: 'round', c: ['#9a6fe0', '#5a3aa8'] }, { pat: 'wave', c: ['#4fd0c0', '#1f8f86'] }],
      soft: [{ pat: 'shell' }, { pat: 'bubble', shape: 'round', c: ['#e2f8ff', '#7fcff0'] }, { pat: 'kelp', c: ['#a5ec92', '#4ea244'] }] },
    { hard: [{ pat: 'rivet' }, { pat: 'solar', c: ['#5a78d8', '#2c3f94'] }, { pat: 'asteroid', shape: 'round', c: ['#8a8fa8', '#4a4e66'] }],
      soft: [{ pat: 'crate' }, { pat: 'barrel', shape: 'round', c: ['#ffbf75', '#d98339'] }, { pat: 'cargo', c: ['#8fd6ff', '#3f95c9'] }] },
    { hard: [{ pat: 'stump' }, { pat: 'rock', shape: 'round', c: ['#b5b8b0', '#6f736c'] }, { pat: 'logs', c: ['#b88650', '#7a5128'] }],
      soft: [{ pat: 'bush' }, { pat: 'mushroom', shape: 'round', c: ['#ff8a8a', '#d94a4a'] }, { pat: 'hay', c: ['#f5dc7a', '#c9a43a'] }] },
    { hard: [{ pat: 'stone' }, { pat: 'cactus', shape: 'round', c: ['#6fcf6a', '#3a8f3e'] }, { pat: 'pyramid', c: ['#f0c070', '#b9822c'] }],
      soft: [{ pat: 'brick' }, { pat: 'pot', shape: 'round', c: ['#e8a070', '#b8643a'] }, { pat: 'crate', c: ['#e0b070', '#a8742c'] }] },
    { hard: [{ pat: 'ice' }, { pat: 'icecrystal', c: ['#c8f0ff', '#6cc2e6'] }, { pat: 'igloo', shape: 'round', c: ['#ffffff', '#9ec9dc'] }],
      soft: [{ pat: 'snow' }, { pat: 'present', c: ['#ff8aa0', '#d84a6a'] }, { pat: 'snowball', shape: 'round', c: ['#ffffff', '#bfdcec'] }] },
    { hard: [{ pat: 'steel' }, { pat: 'pillar', c: ['#d9dce3', '#8a90a0'] }, { pat: 'tire', shape: 'round', c: ['#4a4f5c', '#1f2230'] }],
      soft: [{ pat: 'redbrick' }, { pat: 'barrel', shape: 'round', c: ['#4aa0e8', '#2a68b0'] }, { pat: 'hay', c: ['#f5dc7a', '#c9a43a'] }] },
    { hard: [{ pat: 'machine' }],   /* 廠房的硬牆是依相鄰格拼成的機台，另外畫 */
      soft: [{ pat: 'wafer' }, { pat: 'carton', c: ['#e8c392', '#b08050'] }, { pat: 'foup', c: ['#d8ecf8', '#7fb0d0'] }] },
    { hard: [{ pat: 'stone' }, { pat: 'rock', shape: 'round', c: ['#a9a39a', '#5f5a53'] }, { pat: 'logs', c: ['#a8805a', '#664a2c'] }],
      soft: [{ pat: 'crate' }, { pat: 'barrel', shape: 'round', c: ['#b0a090', '#6c5e50'] }, { pat: 'cargo', c: ['#f0b24a', '#b27a20'] }] },
    { hard: [{ pat: 'pillar' }, { pat: 'rock', shape: 'round', c: ['#8f8ca8', '#4a4764'] }, { pat: 'stone', c: ['#b0acc4', '#605c7a'] }],
      soft: [{ pat: 'pot', shape: 'round' }, { pat: 'crate', c: ['#efe6c0', '#b8aa78'] }, { pat: 'barrel', shape: 'round', c: ['#8a6f5a', '#53402f'] }] },
    { hard: [{ pat: 'stone' }, { pat: 'rock', shape: 'round', c: ['#8a7a78', '#3c3030'] }, { pat: 'pillar', c: ['#5a4e4e', '#251d1d'] }],
      soft: [{ pat: 'brick' }, { pat: 'pot', shape: 'round', c: ['#ff8a4a', '#c4501c'] }, { pat: 'barrel', shape: 'round', c: ['#c04a2a', '#7a2a14'] }] },
    { hard: [{ pat: 'stripes' }, { pat: 'igloo', shape: 'round', c: ['#ffffff', '#a8c8d8'] }, { pat: 'logs', c: ['#c08850', '#7a4a28'] }],
      soft: [{ pat: 'present' }, { pat: 'present', c: ['#7fb8ff', '#3a70c8'] }, { pat: 'snowball', shape: 'round', c: ['#ffffff', '#bfdcec'] }] },
    { hard: [{ pat: 'stripes' }, { pat: 'swirl', shape: 'round', c: ['#ffd24d', '#d99a00'] }, { pat: 'gumdrop', shape: 'round', c: ['#9be88a', '#3a9a3a'] }],
      soft: [{ pat: 'cake' }, { pat: 'donut', shape: 'round', c: ['#ffc88a', '#d98a45'] }, { pat: 'present', c: ['#ffd24d', '#d9a000'] }] }
  ];
  const VARIANT_WEIGHTS = [4, 2, 2];

  /** 這一格用第幾種：座標加 seed 雜湊出來的，不用亂數，所以同一張圖永遠長一樣 */
  function variantIndex(seed, x, y, count) {
    if (count <= 1) return 0;
    let n = (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663) ^ Math.imul((seed | 0) + 7, 83492791)) >>> 0;
    n = Math.imul(n ^ (n >>> 15), 2246822519) >>> 0; n ^= n >>> 13;
    let r = (n >>> 0) % VARIANT_WEIGHTS.slice(0, count).reduce((a, b) => a + b, 0);
    for (let i = 0; i < count; i++) { r -= VARIANT_WEIGHTS[i]; if (r < 0) return i; }
    return 0;
  }

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
  function blockPath(ctx, x, y, w, h, r, shape) {
    if (shape === 'round') { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 7); } else rr(ctx, x, y, w, h, r);
  }
  function drawHard(ctx, T, th, v) {
    v = v || { pat: th.hardPat };
    const col = v.c || th.hard, shape = v.shape;
    const m = T * 0.06, h = T - m * 2, depth = T * 0.16;
    ctx.save();
    blockPath(ctx, m, m + depth * 0.5, h, h - depth * 0.5, T * 0.16, shape); ctx.fillStyle = col[1]; ctx.fill();
    blockPath(ctx, m, m, h, h - depth, T * 0.16, shape);
    ctx.fillStyle = lin(ctx, m, m + h, col[0], col[1]); ctx.fill();
    ctx.lineWidth = Math.max(2, T * 0.06); ctx.strokeStyle = 'rgba(30,20,50,0.55)'; ctx.stroke();
    ctx.clip();
    const x0 = m, y0 = m, w = h, hh = h - depth;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = Math.max(1.5, T * 0.04);
    const dot = (px, py, r) => { ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); };
    switch (v.pat) {
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
      case 'gumdrop':   /* 軟糖：白色糖粒 */
        for (const [cx, cy] of [[0.28, 0.3], [0.62, 0.24], [0.74, 0.55], [0.4, 0.58], [0.25, 0.78], [0.62, 0.8]]) dot(x0 + cx * w, y0 + cy * hh, T * 0.04);
        break;
      case 'swirl':     /* 棒棒糖：螺旋 */
        ctx.lineWidth = T * 0.07; ctx.beginPath();
        for (let i = 0; i <= 40; i++) { const a = i * 0.45, r = i * w * 0.0105; ctx[i ? 'lineTo' : 'moveTo'](x0 + w / 2 + Math.cos(a) * r, y0 + hh / 2 + Math.sin(a) * r); }
        ctx.stroke(); break;
      case 'urchin':    /* 海膽：放射刺 */
        ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.moveTo(x0 + w / 2 + Math.cos(a) * w * 0.14, y0 + hh / 2 + Math.sin(a) * hh * 0.14); ctx.lineTo(x0 + w / 2 + Math.cos(a) * w * 0.42, y0 + hh / 2 + Math.sin(a) * hh * 0.42); }
        ctx.stroke(); dot(x0 + w / 2, y0 + hh / 2, T * 0.07); break;
      case 'wave':      /* 海浪岩：波紋 */
        for (let r = 0; r < 3; r++) { ctx.beginPath(); for (let i = 0; i <= 8; i++) { const px = x0 + w * i / 8, py = y0 + hh * (0.3 + r * 0.22) + Math.sin(i * 1.6) * hh * 0.05; ctx[i ? 'lineTo' : 'moveTo'](px, py); } ctx.stroke(); }
        break;
      case 'solar':     /* 太陽能板：格線 */
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.strokeRect(x0 + w * 0.1, y0 + hh * 0.18, w * 0.8, hh * 0.64);
        ctx.beginPath(); for (let i = 1; i < 3; i++) { ctx.moveTo(x0 + w * (0.1 + i * 0.8 / 3), y0 + hh * 0.18); ctx.lineTo(x0 + w * (0.1 + i * 0.8 / 3), y0 + hh * 0.82); }
        ctx.moveTo(x0 + w * 0.1, y0 + hh * 0.5); ctx.lineTo(x0 + w * 0.9, y0 + hh * 0.5); ctx.stroke(); break;
      case 'asteroid':  /* 隕石：坑洞 */
        ctx.fillStyle = 'rgba(30,30,60,0.35)';
        for (const [cx, cy, r] of [[0.34, 0.34, 0.11], [0.64, 0.5, 0.14], [0.38, 0.68, 0.08], [0.68, 0.24, 0.06]]) dot(x0 + cx * w, y0 + cy * hh, r * T);
        break;
      case 'rock':      /* 大石頭：裂痕與苔蘚 */
        ctx.beginPath(); ctx.moveTo(x0 + w * 0.25, y0 + hh * 0.3); ctx.lineTo(x0 + w * 0.45, y0 + hh * 0.5); ctx.lineTo(x0 + w * 0.38, y0 + hh * 0.78); ctx.moveTo(x0 + w * 0.45, y0 + hh * 0.5); ctx.lineTo(x0 + w * 0.78, y0 + hh * 0.42); ctx.stroke();
        ctx.fillStyle = 'rgba(90,170,80,0.55)'; dot(x0 + w * 0.72, y0 + hh * 0.72, T * 0.09); dot(x0 + w * 0.3, y0 + hh * 0.18, T * 0.06); break;
      case 'logs':      /* 疊木頭：三根橫木與年輪端面 */
        ctx.beginPath(); for (let r = 1; r < 3; r++) { ctx.moveTo(x0, y0 + hh * r / 3); ctx.lineTo(x0 + w, y0 + hh * r / 3); } ctx.stroke();
        for (let r = 0; r < 3; r++) { ctx.beginPath(); ctx.arc(x0 + w * 0.2, y0 + hh * (r + 0.5) / 3, hh * 0.1, 0, 7); ctx.stroke(); }
        break;
      case 'cactus':    /* 仙人掌：直條紋與刺 */
        ctx.beginPath(); for (const cx of [0.3, 0.5, 0.7]) { ctx.moveTo(x0 + w * cx, y0 + hh * 0.12); ctx.lineTo(x0 + w * cx, y0 + hh * 0.9); } ctx.stroke();
        ctx.lineWidth = T * 0.03; ctx.beginPath(); for (const [cx, cy] of [[0.4, 0.3], [0.6, 0.5], [0.4, 0.7], [0.6, 0.25]]) { ctx.moveTo(x0 + w * cx - T * 0.04, y0 + hh * cy - T * 0.03); ctx.lineTo(x0 + w * cx + T * 0.04, y0 + hh * cy + T * 0.03); } ctx.stroke(); break;
      case 'pyramid':   /* 金字塔石階 */
        ctx.beginPath(); ctx.moveTo(x0 + w * 0.5, y0 + hh * 0.12); ctx.lineTo(x0 + w * 0.9, y0 + hh * 0.88); ctx.lineTo(x0 + w * 0.1, y0 + hh * 0.88); ctx.closePath();
        ctx.moveTo(x0 + w * 0.4, y0 + hh * 0.32); ctx.lineTo(x0 + w * 0.6, y0 + hh * 0.32); ctx.moveTo(x0 + w * 0.3, y0 + hh * 0.52); ctx.lineTo(x0 + w * 0.7, y0 + hh * 0.52); ctx.moveTo(x0 + w * 0.2, y0 + hh * 0.7); ctx.lineTo(x0 + w * 0.8, y0 + hh * 0.7); ctx.stroke(); break;
      case 'icecrystal': /* 冰晶：雪花 */
        ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.moveTo(x0 + w / 2 + Math.cos(a) * w * 0.36, y0 + hh / 2 + Math.sin(a) * hh * 0.36); ctx.lineTo(x0 + w / 2 - Math.cos(a) * w * 0.36, y0 + hh / 2 - Math.sin(a) * hh * 0.36); }
        ctx.stroke(); break;
      case 'igloo':     /* 冰屋：磚縫 */
        ctx.beginPath(); for (let r = 1; r < 4; r++) { ctx.moveTo(x0, y0 + hh * r / 4); ctx.lineTo(x0 + w, y0 + hh * r / 4); }
        for (let r = 0; r < 4; r++) for (let c = 1; c < 3; c++) { const px = x0 + w * (c / 3 + (r % 2 ? 0.16 : -0.1)); ctx.moveTo(px, y0 + hh * r / 4); ctx.lineTo(px, y0 + hh * (r + 1) / 4); }
        ctx.stroke(); break;
      case 'pillar':    /* 水泥柱：直槽與上下箍 */
        ctx.beginPath(); for (const cx of [0.3, 0.5, 0.7]) { ctx.moveTo(x0 + w * cx, y0 + hh * 0.22); ctx.lineTo(x0 + w * cx, y0 + hh * 0.82); } ctx.stroke();
        ctx.fillStyle = 'rgba(40,50,70,0.4)'; ctx.fillRect(x0, y0 + hh * 0.12, w, hh * 0.08); ctx.fillRect(x0, y0 + hh * 0.82, w, hh * 0.08); break;
      case 'tire':      /* 輪胎堆：同心圈 */
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; for (const r of [0.36, 0.24]) { ctx.beginPath(); ctx.arc(x0 + w / 2, y0 + hh / 2, r * w, 0, 7); ctx.stroke(); }
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; dot(x0 + w / 2, y0 + hh / 2, w * 0.12); break;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x0, y0, w, hh * 0.22);
    ctx.restore();
  }

  /** 軟磚：淺色、圓潤、有裂紋與小點，一看就是「可以炸」 */
  function drawSoft(ctx, T, th, v) {
    v = v || { pat: th.softPat };
    const col = v.c || th.soft, shape = v.shape;
    const m = T * 0.1, s = T - m * 2;
    ctx.save();
    blockPath(ctx, m, m + T * 0.05, s, s, T * 0.2, shape); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();
    blockPath(ctx, m, m, s, s, T * 0.2, shape);
    ctx.fillStyle = lin(ctx, m, m + s, col[0], col[1]); ctx.fill();
    ctx.lineWidth = Math.max(1.5, T * 0.04); ctx.strokeStyle = col[1]; ctx.stroke();
    ctx.clip();
    ctx.strokeStyle = 'rgba(120,70,30,0.45)'; ctx.fillStyle = 'rgba(120,70,30,0.45)'; ctx.lineWidth = Math.max(1.2, T * 0.035);
    const x0 = m, y0 = m;
    const sdot = (px, py, r) => { ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); };
    switch (v.pat) {
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
      case 'cake':      /* 蛋糕：奶油滴落、櫻桃 */
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + s, y0);
        for (let i = 5; i >= 0; i--) ctx.lineTo(x0 + s * (i / 5), y0 + s * (i % 2 ? 0.3 : 0.4));
        ctx.fill(); ctx.fillStyle = '#e8384f'; sdot(x0 + s * 0.5, y0 + s * 0.22, T * 0.07); ctx.fillStyle = 'rgba(160,80,110,0.5)'; ctx.fillRect(x0, y0 + s * 0.62, s, T * 0.035); break;
      case 'donut':     /* 甜甜圈：中間的洞與糖珠 */
        ctx.fillStyle = 'rgba(120,70,30,0.55)'; sdot(x0 + s / 2, y0 + s / 2, s * 0.16);
        for (const [cx, cy, c] of [[0.3, 0.3, '#ff6b9a'], [0.7, 0.34, '#4aa8ff'], [0.34, 0.72, '#ffe03d'], [0.72, 0.7, '#7be0a0']]) { ctx.fillStyle = c; sdot(x0 + s * cx, y0 + s * cy, T * 0.035); }
        break;
      case 'bubble':    /* 泡泡：高光與小泡 */
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x0 + s / 2, y0 + s / 2, s * 0.3, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; sdot(x0 + s * 0.7, y0 + s * 0.7, T * 0.05); sdot(x0 + s * 0.3, y0 + s * 0.74, T * 0.03); break;
      case 'kelp':      /* 海帶：彎曲的葉脈 */
        ctx.strokeStyle = 'rgba(20,90,50,0.5)'; for (const cx of [0.3, 0.55, 0.78]) { ctx.beginPath(); for (let i = 0; i <= 6; i++) { const py = y0 + s * i / 6, px = x0 + s * cx + Math.sin(i * 1.4 + cx * 9) * s * 0.07; ctx[i ? 'lineTo' : 'moveTo'](px, py); } ctx.stroke(); }
        break;
      case 'barrel':    /* 木桶／油桶：上下箍 */
        ctx.fillStyle = 'rgba(40,30,20,0.45)'; ctx.fillRect(x0, y0 + s * 0.22, s, s * 0.09); ctx.fillRect(x0, y0 + s * 0.69, s, s * 0.09);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.moveTo(x0 + s * 0.3, y0 + s * 0.34); ctx.lineTo(x0 + s * 0.3, y0 + s * 0.66); ctx.stroke(); break;
      case 'cargo':     /* 貨櫃：斜紋警示 */
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = T * 0.07; ctx.beginPath(); for (let i = -2; i < 5; i++) { ctx.moveTo(x0 + i * s * 0.3, y0 + s); ctx.lineTo(x0 + i * s * 0.3 + s, y0); } ctx.stroke(); break;
      case 'mushroom':  /* 紅菇：白點 */
        ctx.fillStyle = '#fff'; for (const [cx, cy, r] of [[0.3, 0.32, 0.09], [0.62, 0.26, 0.07], [0.7, 0.58, 0.1], [0.36, 0.64, 0.07]]) sdot(x0 + s * cx, y0 + s * cy, r * s); break;
      case 'hay':       /* 乾草捆：橫向草紋與綑繩 */
        ctx.strokeStyle = 'rgba(150,110,30,0.55)'; ctx.beginPath(); for (let r = 1; r < 6; r++) { ctx.moveTo(x0 + s * 0.05, y0 + s * r / 6); ctx.lineTo(x0 + s * 0.95, y0 + s * (r / 6 + (r % 2 ? 0.02 : -0.02))); } ctx.stroke();
        ctx.strokeStyle = 'rgba(120,70,30,0.7)'; ctx.lineWidth = T * 0.05; ctx.beginPath(); ctx.moveTo(x0 + s * 0.3, y0); ctx.lineTo(x0 + s * 0.3, y0 + s); ctx.moveTo(x0 + s * 0.7, y0); ctx.lineTo(x0 + s * 0.7, y0 + s); ctx.stroke(); break;
      case 'pot':       /* 陶罐：兩圈花紋 */
        ctx.strokeStyle = 'rgba(90,40,20,0.55)'; ctx.beginPath(); ctx.moveTo(x0 + s * 0.12, y0 + s * 0.3); ctx.lineTo(x0 + s * 0.88, y0 + s * 0.3); ctx.moveTo(x0 + s * 0.12, y0 + s * 0.7); ctx.lineTo(x0 + s * 0.88, y0 + s * 0.7);
        for (let i = 0; i < 6; i++) { ctx.moveTo(x0 + s * (0.2 + i * 0.12), y0 + s * 0.5); ctx.lineTo(x0 + s * (0.26 + i * 0.12), y0 + s * 0.42); ctx.lineTo(x0 + s * (0.32 + i * 0.12), y0 + s * 0.5); }
        ctx.stroke(); break;
      case 'present':   /* 禮物盒：十字緞帶與蝴蝶結 */
        ctx.fillStyle = '#ffe03d'; ctx.fillRect(x0 + s * 0.42, y0, s * 0.16, s); ctx.fillRect(x0, y0 + s * 0.42, s, s * 0.16);
        ctx.strokeStyle = '#d9a900'; ctx.lineWidth = T * 0.04; ctx.beginPath(); ctx.arc(x0 + s * 0.4, y0 + s * 0.36, s * 0.1, 0, 7); ctx.arc(x0 + s * 0.6, y0 + s * 0.36, s * 0.1, 0, 7); ctx.stroke(); break;
      case 'snowball':  /* 雪球：疊起來的雪團陰影 */
        ctx.strokeStyle = 'rgba(80,130,160,0.4)'; ctx.beginPath(); ctx.arc(x0 + s * 0.4, y0 + s * 0.35, s * 0.2, Math.PI * 0.9, Math.PI * 1.9); ctx.stroke();
        ctx.fillStyle = 'rgba(80,130,160,0.25)'; sdot(x0 + s * 0.68, y0 + s * 0.68, s * 0.1); break;
      case 'carton':    /* 紙箱：封箱膠帶與箭頭 */
        ctx.fillStyle = 'rgba(255,230,160,0.75)'; ctx.fillRect(x0 + s * 0.4, y0, s * 0.2, s * 0.42);
        ctx.strokeStyle = 'rgba(90,50,20,0.6)'; ctx.beginPath(); ctx.moveTo(x0 + s * 0.25, y0 + s * 0.78); ctx.lineTo(x0 + s * 0.25, y0 + s * 0.58); ctx.moveTo(x0 + s * 0.17, y0 + s * 0.65); ctx.lineTo(x0 + s * 0.25, y0 + s * 0.57); ctx.lineTo(x0 + s * 0.33, y0 + s * 0.65); ctx.stroke(); break;
      case 'foup':      /* 晶圓傳送盒：透明視窗與把手 */
        ctx.fillStyle = 'rgba(30,60,100,0.3)'; ctx.fillRect(x0 + s * 0.14, y0 + s * 0.3, s * 0.72, s * 0.42);
        ctx.strokeStyle = 'rgba(30,60,100,0.6)'; ctx.beginPath(); for (let i = 1; i < 4; i++) { ctx.moveTo(x0 + s * 0.14, y0 + s * (0.3 + i * 0.105)); ctx.lineTo(x0 + s * 0.86, y0 + s * (0.3 + i * 0.105)); } ctx.stroke();
        ctx.fillStyle = '#17a35a'; ctx.fillRect(x0 + s * 0.34, y0 + s * 0.12, s * 0.32, s * 0.08); break;
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


  /* ---------- 日月光廠房：貼近真實的機台與無塵室地面 ---------- */
  /** 半導體機台：同一排相連的格子畫成一台連續的機台（控制面板、散熱孔、三色警示燈）；直向相連的是晶圓盒自動倉儲 */
  function drawFabHard(ctx, T, n) {
    const l = n.l, r = n.r, u = n.u, d = n.d;
    const x0 = l ? 0 : T * 0.07, x1 = r ? T : T * 0.93, y0 = u ? 0 : T * 0.08, y1 = d ? T : T * 0.92;
    const depth = d ? 0 : T * 0.14;
    ctx.save();
    /* 側面（立體感） */
    ctx.fillStyle = '#0d1636'; ctx.fillRect(x0, y0 + T * 0.1, x1 - x0, y1 - y0 - T * 0.1);
    /* 機身 */
    const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#3a4f8f'); g.addColorStop(1, '#1d2b5c');
    ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0 - depth);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x0, y0, x1 - x0, T * 0.07);
    ctx.strokeStyle = 'rgba(8,14,40,0.8)'; ctx.lineWidth = Math.max(1.5, T * 0.04);
    ctx.beginPath();
    if (!u) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); }
    if (!d) { ctx.moveTo(x0, y1 - depth); ctx.lineTo(x1, y1 - depth); }
    if (!l) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y1 - depth); }
    if (!r) { ctx.moveTo(x1, y0); ctx.lineTo(x1, y1 - depth); }
    ctx.stroke();
    const bh = y1 - y0 - depth, w = x1 - x0;
    const horiz = l || r, vert = (u || d) && !horiz;
    if (vert) {
      /* 晶圓盒倉儲：一格格的 FOUP 插槽 */
      ctx.fillStyle = 'rgba(8,14,40,0.55)';
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) ctx.fillRect(x0 + w * (0.14 + j * 0.4), y0 + bh * (0.1 + i * 0.29), w * 0.34, bh * 0.22);
      ctx.fillStyle = '#7fe0a8'; ctx.fillRect(x0 + w * 0.44, y0 + bh * 0.03, w * 0.12, bh * 0.04);
    } else if (n.alt) {
      /* 散熱／維修面板 */
      ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(x0 + w * 0.12, y0 + bh * 0.2, w * 0.76, bh * 0.58);
      ctx.strokeStyle = 'rgba(8,14,40,0.55)'; ctx.lineWidth = Math.max(1, T * 0.03);
      for (let i = 0; i < 4; i++) { const yy = y0 + bh * (0.3 + i * 0.12); ctx.beginPath(); ctx.moveTo(x0 + w * 0.2, yy); ctx.lineTo(x0 + w * 0.8, yy); ctx.stroke(); }
      ctx.fillStyle = '#ffd84d'; ctx.fillRect(x0 + w * 0.12, y0 + bh * 0.84, w * 0.76, bh * 0.05);
    } else {
      /* 控制螢幕 */
      ctx.fillStyle = '#0b1530'; ctx.fillRect(x0 + w * 0.14, y0 + bh * 0.2, w * 0.72, bh * 0.4);
      ctx.strokeStyle = '#7ff0b0'; ctx.lineWidth = Math.max(1.2, T * 0.035); ctx.beginPath();
      ctx.moveTo(x0 + w * 0.2, y0 + bh * 0.5); ctx.lineTo(x0 + w * 0.36, y0 + bh * 0.34); ctx.lineTo(x0 + w * 0.52, y0 + bh * 0.46); ctx.lineTo(x0 + w * 0.7, y0 + bh * 0.28); ctx.lineTo(x0 + w * 0.8, y0 + bh * 0.36); ctx.stroke();
      ctx.fillStyle = '#17a35a'; ctx.beginPath(); ctx.arc(x0 + w * 0.3, y0 + bh * 0.76, T * 0.045, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd84d'; ctx.beginPath(); ctx.arc(x0 + w * 0.5, y0 + bh * 0.76, T * 0.045, 0, 7); ctx.fill();
      ctx.fillStyle = '#ef6a47'; ctx.beginPath(); ctx.arc(x0 + w * 0.7, y0 + bh * 0.76, T * 0.045, 0, 7); ctx.fill();
    }
    /* 三色警示燈塔：每台機台最左端一座 */
    if (horiz && !l || (!horiz && !vert)) {
      const tx = x0 + (horiz ? w * 0.09 : w * 0.5), ty = y0 + T * 0.27;
      ctx.fillStyle = '#c8cedd'; ctx.fillRect(tx - T * 0.02, ty - T * 0.02, T * 0.04, T * 0.05);
      [['#ef6a47', 0], ['#ffd84d', 1], ['#17c46a', 2]].forEach(([c, i]) => { ctx.fillStyle = c; rr(ctx, tx - T * 0.05, ty - T * 0.02 - (i + 1) * T * 0.06, T * 0.1, T * 0.055, T * 0.02); ctx.fill(); });
    }
    ctx.restore();
  }

  /** 無塵室地面細節：透氣地板孔洞、機台周圍黃色安全線、主走道綠色導引線與天車軌道 */
  function drawFabFloor(g, T, view, at, isEdge) {
    const W = view.w, H = view.h, cx = (W - 1) / 2, cy = (H - 1) / 2;
    g.save();
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (at(x, y) === 1) continue;
      const px = x * T, py = y * T;
      /* 透氣孔洞地板 */
      g.fillStyle = 'rgba(30,45,87,0.1)';
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(px + T * (0.25 + i * 0.25), py + T * (0.25 + j * 0.25), T * 0.025, 0, 7); g.fill(); }
      /* 機台周圍的黃色安全線 */
      g.fillStyle = 'rgba(255,200,40,0.9)';
      const hw = Math.max(2, T * 0.06);
      if (at(x, y - 1) === 1 && !isEdge(x, y - 1)) g.fillRect(px, py + T * 0.04, T, hw);
      if (at(x, y + 1) === 1 && !isEdge(x, y + 1)) g.fillRect(px, py + T - hw - T * 0.04, T, hw);
      if (at(x - 1, y) === 1 && !isEdge(x - 1, y)) g.fillRect(px + T * 0.04, py, hw, T);
      if (at(x + 1, y) === 1 && !isEdge(x + 1, y)) g.fillRect(px + T - hw - T * 0.04, py, hw, T);
    }
    /* 主走道：綠色導引線＋天車（OHT）軌道 */
    g.strokeStyle = 'rgba(23,163,90,0.55)'; g.lineWidth = Math.max(2, T * 0.06); g.setLineDash([T * 0.22, T * 0.14]);
    g.beginPath(); g.moveTo(T * 1.2, (cy + 0.5) * T); g.lineTo((W - 1.2) * T, (cy + 0.5) * T); g.moveTo((cx + 0.5) * T, T * 1.2); g.lineTo((cx + 0.5) * T, (H - 1.2) * T); g.stroke();
    g.setLineDash([]);
    g.strokeStyle = 'rgba(120,130,160,0.35)'; g.lineWidth = Math.max(1.5, T * 0.035);
    for (const o of [-0.12, 0.12]) { g.beginPath(); g.moveTo(T, (cy + 0.5 + o) * T); g.lineTo((W - 1) * T, (cy + 0.5 + o) * T); g.stroke(); }
    g.restore();
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
      hardV: (VARIANTS[th.id] || VARIANTS[0]).hard.map(v => make(x => drawHard(x, T, th, v))),
      softV: (VARIANTS[th.id] || VARIANTS[0]).soft.map(v => make(x => drawSoft(x, T, th, v))),
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
    ANIMALS, ANIMAL_IDS, THEMES, VARIANTS, variantIndex, ITEM_NAMES, ITEM_DESC,
    animalSVG, itemSVG, bombSVG, planeSVG, icon, buildTileset, drawHard, drawSoft, drawFloor, drawBorder, drawFabHard, drawFabFloor, svgImage, svgUrl, rr
  };
})(typeof self !== 'undefined' ? self : this);
