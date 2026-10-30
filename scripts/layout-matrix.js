/* 多裝置版面矩陣（選用，只需要本機 Chrome／Edge，不需要 playwright）：
 * 各種手機／平板／桌機尺寸 × 2、4、8 人，量實際版面並檢查：
 *   棋盤完整在畫面內、頁面沒有橫向捲動；資訊欄各塊（選單、計時、頭像、延遲、語言與設定鈕）不互相重疊、頭像沒被切掉；
 *   搖桿與炸彈鈕在畫面內且不蓋可玩格（手機橫向允許半透明疊上）；手機直向遮罩；桌機不顯示搖桿。
 * 用法：node scripts/layout-matrix.js [篩選字串]     全部通過結束碼 0，有失敗結束碼 1（每行列出失敗原因）。 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CANDIDATES = [process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const chrome = CANDIDATES.find(p => fs.existsSync(p));
if (!chrome) { console.log('找不到 Chrome／Edge，略過'); process.exit(0); }

const PUBLIC = path.join(__dirname, '..', 'public');
/* [名稱, 視窗寬, 視窗高, 觸控]：寬高是「頁面可視區」，無頭 Chrome 的視窗要再加上外框（約 18×96） */
const VIEWS = [
  ['iPhone SE 橫', 667, 375, 'on'], ['小 Android 橫', 740, 360, 'on'], ['iPhone 14 橫', 844, 390, 'on'], ['iPhone Pro Max 橫', 932, 430, 'on'],
  ['手機直', 504, 700, 'on'], ['iPad mini 直', 768, 1024, 'on'], ['iPad 直', 820, 1180, 'on'],
  ['iPad mini 橫', 1024, 768, 'on'], ['iPad 橫', 1180, 820, 'on'], ['iPad Pro 橫', 1366, 1024, 'on'],
  ['小筆電', 1024, 600, 'auto'], ['桌機 720p', 1280, 720, 'auto'], ['桌機 900p', 1440, 900, 'auto'], ['桌機 1080p', 1920, 1080, 'auto']
];
const COUNTS = [2, 4, 8];
const filter = process.argv[2] || '';

function pageFor(n, touchMode, spectator) {
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  const probe = `<script>
    (function () {
      const out = document.createElement('pre'); out.id = 'm-out'; out.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none'; document.body.appendChild(out);
      setTimeout(function () {
        try {
          App.store.solo.levels = new Array(${n - 1}).fill('normal'); App.store.solo.theme = 6; App.store.solo.layout = 'classic';
          App.store.touchMode = '${touchMode}'; App.store.stickSide = 'left';
          App.startSolo();
          setTimeout(function () {
            try {
              const R = function (q) { const e = typeof q === 'string' ? document.querySelector(q) : q; if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (!b.width || cs.display === 'none' || cs.visibility === 'hidden') return null; return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
              const g = App.game, c = R('.board canvas');
              const chips = Array.prototype.map.call(document.querySelectorAll('.hud-chip'), R);
              const hc = document.querySelector('.hud-c');
              document.getElementById('m-out').textContent = JSON.stringify({
                vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
                w: g.view.w, h: g.view.h, canvas: c, tile: c ? c.w / g.view.w : 0, mode: g.touchPlan && g.touchPlan.mode,
                hud: R('.hud'), toggle: R('.side-toggle'), exit: R('.exit-btn'), timer: R('.hud-timer'), chips: chips, ping: R('.ping'),
                lang: R('.language-controls > .lang-toggle'), gear: R('.language-controls > .gear'),
                chipsClip: hc ? hc.scrollWidth > hc.clientWidth + 1 : false, chipsBox: R('.hud-chips'), hudC: R(hc),
                stick: R('.stick'), bomb: R('.bomb-btn'), touchShown: !!document.querySelector('.touch') && !document.querySelector('.touch').hidden,
                rotate: !!R('.rotate-mask'), sideClosed: document.querySelector('.game').classList.contains('side-closed')
              });
            } catch (e) { document.getElementById('m-out').textContent = JSON.stringify({ error: String(e && e.stack || e) }); }
          }, 2500);
        } catch (e) { out.textContent = JSON.stringify({ error: String(e && e.stack || e) }); }
      }, 300);
    })();
  <\/script>`;
  return html.replace('</body>', probe + '</body>').replace(/(src|href)="(?!https?:|data:)([^"]+)"/g, (m, a, u) => a + '="' + path.join(PUBLIC, u.replace(/\?.*$/, '')).replace(/\\/g, '/') + '"');
}

const overlap = (a, b, pad) => a && b && a.l < b.r - (pad || 0) && b.l < a.r - (pad || 0) && a.t < b.b - (pad || 0) && b.t < a.b - (pad || 0);

function check(name, n, d) {
  const f = [];
  if (!d || d.error) return ['量測失敗 ' + (d && d.error || '沒有輸出')];
  const landscape = d.vw > d.vh, phone = Math.min(d.vw, d.vh) < 560;
  if (d.sw > d.vw + 1) f.push(`頁面橫向捲動 ${d.sw}>${d.vw}`);
  if (d.sh > d.vh + 1) f.push(`頁面垂直捲動 ${d.sh}>${d.vh}`);
  const cv = d.canvas;
  if (!cv) return f.concat('沒有棋盤');
  if (cv.l < -0.5 || cv.t < -0.5 || cv.r > d.vw + 0.5 || cv.b > d.vh + 0.5) f.push(`棋盤超出畫面 ${Math.round(cv.w)}×${Math.round(cv.h)}／${d.vw}×${d.vh}`);
  if (d.tile < 12) f.push(`格子只有 ${d.tile.toFixed(1)}px`);
  if (!d.sideClosed) f.push('側欄沒有預設收起');
  /* 資訊欄各塊 */
  const parts = { 選單: d.toggle, 暫停: d.exit, 計時: d.timer, 延遲: d.ping, 語言: d.lang, 設定: d.gear };
  const names = Object.keys(parts).filter(k => parts[k]);
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) if (overlap(parts[names[i]], parts[names[j]], 1)) f.push(`資訊欄「${names[i]}」與「${names[j]}」重疊`);
  d.chips.forEach((c, i) => {
    if (!c) return;
    for (const k of names) if (overlap(c, parts[k], 1)) f.push(`頭像 ${i + 1} 與「${k}」重疊`);
    if (d.hudC && (c.l < d.hudC.l - 1 || c.r > d.hudC.r + 1)) f.push(`頭像 ${i + 1} 超出資訊欄中間區`);
    d.chips.forEach((o, j) => { if (j > i && overlap(c, o, 1)) f.push(`頭像 ${i + 1} 與 ${j + 1} 重疊`); });
  });
  if (d.chipsClip) f.push('頭像列被切掉（內容比容器寬）');
  const wall = Math.max(d.tile, 26);
  for (const k of names) { const p = parts[k]; if (p.t < cv.t - 1 || p.b > cv.t + wall + 1) f.push(`資訊欄「${k}」不在上方外牆圈內`); if (p.r > d.vw + 0.5 || p.l < -0.5) f.push(`資訊欄「${k}」超出畫面左右`); }
  /* 手機直向 */
  if (phone && !landscape) { if (!d.rotate) f.push('手機直向沒有遮罩'); return f; }
  if (d.rotate) f.push('不該出現轉向遮罩');
  /* 操作鈕 */
  if (!d.touchShown) { if (d.stick) f.push('不顯示觸控時搖桿仍可見'); return f; }
  if (!d.stick || !d.bomb) return f.concat('沒有搖桿或炸彈鈕');
  for (const [k, b] of [['搖桿', d.stick], ['炸彈鈕', d.bomb]]) if (b.l < -0.5 || b.t < -0.5 || b.r > d.vw + 0.5 || b.b > d.vh + 0.5) f.push(`${k}超出畫面`);
  if (overlap(d.stick, d.bomb, 0)) f.push('搖桿與炸彈鈕重疊');
  if (landscape && !phone) { const play = cv.b - d.tile; for (const [k, b] of [['搖桿', d.stick], ['炸彈鈕', d.bomb]]) if (b.t < play - 1 && overlap(b, cv, 0)) f.push(`平板橫向${k}蓋到可玩格（頂 ${Math.round(b.t)}，可玩區底 ${Math.round(play)}）`); }
  if (!landscape) for (const [k, b] of [['搖桿', d.stick], ['炸彈鈕', d.bomb]]) if (b.t < cv.b - 1) f.push(`平板直向${k}蓋到棋盤`);
  return f;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bomb-matrix-'));
let total = 0, failed = 0;
for (const [name, vw, vh, touch] of VIEWS) for (const n of COUNTS) {
  const label = `${name} ${vw}×${vh} ${n}人`;
  if (filter && !label.includes(filter)) continue;
  const file = path.join(tmp, `m-${n}-${touch}.html`);
  fs.writeFileSync(file, pageFor(n, touch));
  let d = null;
  for (let attempt = 0; attempt < 4 && !d; attempt++) {
    const args = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', `--window-size=${vw + 18},${vh + 96}`, '--virtual-time-budget=8000',
      '--user-data-dir=' + path.join(tmp, `p-${vw}-${vh}-${n}-${attempt}`), '--dump-dom', 'file:///' + file.replace(/\\/g, '/')];
    const r = spawnSync(chrome, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
    const m = /<pre id="m-out"[^>]*>([\s\S]*?)<\/pre>/.exec(r.stdout || '');
    try { d = JSON.parse((m ? m[1] : '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')); } catch (e) { d = null; }
    if (d && !d.error && (d.mode === undefined || d.tile < 12 || !d.hud)) d = null;      /* 版面還沒排完（沒有 plan、格子異常小）就重量 */
  }
  const f = check(name, n, d);
  total++;
  if (f.length) { failed++; console.log(' FAIL ' + label + (d && d.vw ? `（實際視窗 ${d.vw}×${d.vh}，每格 ${d.tile.toFixed(1)}px，${d.mode || '-'}）` : '') + '\n        - ' + f.join('\n        - ')); }
  else console.log('  ok  ' + label + `（每格 ${d.tile.toFixed(1)}px，${d.mode || '-'}）`);
}
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
console.log(failed ? `\n${failed}／${total} 組失敗` : `\n${total} 組全部通過`);
process.exit(failed ? 1 : 0);
