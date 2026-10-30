/* 版面實測（選用）注意：Chrome 無頭模式的視窗寬度最低約 500px，所以「手機直放」實際是用約 504px 寬量的，截圖會被裁成 390px；
 * 判斷以腳本印出的視窗尺寸為準。
 *
 * 說明：用本機 Chrome／Edge 無頭模式，在各種裝置尺寸下開單機對局，量實際格子大小、
 * 確認地圖沒有超出畫面、人物比一格略大，並截圖到 SHOTS（預設 ./shots，已被 .gitignore 忽略）。
 * 用法：node scripts/layout-check.js            （不需要先啟動伺服器，直接讀 public/）
 *       CHROME="C:/path/to/chrome.exe" node scripts/layout-check.js
 * 找不到瀏覽器時會跳過並結束碼 0（它只是補充 tests/layout.js 的純邏輯測試）。 */
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
if (!chrome) { console.log('找不到 Chrome／Edge，略過實機版面檢查（可用 CHROME 環境變數指定路徑）'); process.exit(0); }

const PUBLIC = path.join(__dirname, '..', 'public');
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
/* [名稱, 寬, 高, 觸控設定]：桌機用 auto（沒有觸控螢幕就不顯示搖桿），其餘一律顯示才量得到搖桿與炸彈鈕 */
const VIEWS = [['phone-p', 390, 844, 'on'], ['phone-l', 844, 390, 'on'], ['tablet-p', 820, 1180, 'on'], ['tablet-l', 1180, 820, 'on'], ['desktop', 1440, 900, 'auto']];
const OLD = { 2: [17, 13], 8: [19, 15] };      /* 改版前的格數，拿來比較每格縮了多少 */
const NEW = { 2: [21, 11], 8: [25, 13] };
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : ' FAIL ') + m); if (!c) fails++; };

/** 測試頁：複製 index.html，結尾加一段腳本開單機對局（n 個電腦），量完把結果寫進 #layout-out */
function pageFor(n, touchMode) {
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  const probe = `<script>
    (function () {
      const out = document.createElement('pre'); out.id = 'layout-out'; document.body.appendChild(out);
      setTimeout(function () {
        try {
          App.store.solo.levels = new Array(${n - 1}).fill('normal');
          App.store.solo.theme = 6; App.store.solo.layout = 'classic';
          App.store.touchMode = '${touchMode}'; App.store.stickSide = 'left';
          App.startSolo();
          let tries = 0;
          const measure = setInterval(function () {
            const c = document.querySelector('.board canvas'), m = document.querySelector('.game-main');
            if (!c || !m || !App.game) { if (++tries < 60) return; }
            const v = App.game.view, r = c.getBoundingClientRect();
            if (r.width <= 300 && r.height <= 150 && ++tries < 60) return;      /* 還是預設 300×150 畫布＝排版還沒跑完，再等 */
            clearInterval(measure);
            const cs = getComputedStyle(m), pad = function (k) { return parseFloat(cs[k]) || 0; };
            const rect = function (q) { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, w: b.width, h: b.height }; };
            out.textContent = JSON.stringify({ w: v.w, h: v.h, cw: r.width, ch: r.height, tile: r.width / v.w,
              availW: m.clientWidth - pad('paddingLeft') - pad('paddingRight'), availH: m.clientHeight - pad('paddingTop') - pad('paddingBottom'),
              left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw: innerWidth, vh: innerHeight, spr: App.game.rend.constructor.SPRITE,
              stick: rect('.stick'), bomb: rect('.bomb-btn'), hud: rect('.hud'), gear: rect('.gear'), lang: rect('.lang-toggle'), toggle: rect('.side-toggle'),
              touchShown: !!document.querySelector('.touch') && !document.querySelector('.touch').hidden,
              rotateShown: !!document.querySelector('.rotate-mask') && !document.querySelector('.rotate-mask').hidden,
              plan: App.game.touchPlan && { mode: App.game.touchPlan.mode, gutter: App.game.touchPlan.gutter, bottom: App.game.touchPlan.bottom },
              sideClosed: document.querySelector('.game').classList.contains('side-closed') });
          }, 100);
        } catch (e) { out.textContent = JSON.stringify({ error: String(e && e.stack || e) }); }
      }, 300);
    })();
  <\/script>`;
  return html.replace('</body>', probe + '</body>').replace(/(src|href)="(?!https?:|data:)([^"]+)"/g, (m, a, u) => a + '="' + path.join(PUBLIC, u.replace(/\?.*$/, '')).replace(/\\/g, '/') + '"');
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bomb-layout-'));
for (const n of [2, 8]) {
  console.log(`\n${n} 人對局`);
  for (const [name, w, h, touchMode] of VIEWS) {
    const file = path.join(tmp, 'p' + n + touchMode + '.html');
    fs.writeFileSync(file, pageFor(n, touchMode));
    const shot = path.join(SHOTS, `layout-${n}p-${name}.png`);
    const base = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', `--window-size=${w},${h}`, '--virtual-time-budget=9000', '--user-data-dir=' + path.join(tmp, 'prof-' + n + name)];
    spawnSync(chrome, base.concat(['--screenshot=' + shot, 'file:///' + file.replace(/\\/g, '/')]), { encoding: 'utf8' });
    let d = null;
    for (let attempt = 0; attempt < 5 && !d; attempt++) {     /* 無頭瀏覽器偶爾在量測前就結束，最多重試 5 次（每次用獨立的設定資料夾，免得互相卡住） */
      const own = base.slice(0, -1).concat(['--user-data-dir=' + path.join(tmp, 'prof-' + n + name + '-' + attempt)]);
      const dom = spawnSync(chrome, own.concat(['--dump-dom', 'file:///' + file.replace(/\\/g, '/')]), { encoding: 'utf8', maxBuffer: 1 << 26 });
      const m = /<pre id="layout-out">([\s\S]*?)<\/pre>/.exec(dom.stdout || '');
      try { d = JSON.parse((m ? m[1] : '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')); } catch (e) { d = null; }
      if (d && !d.error && d.cw <= 300 && d.ch <= 150) d = null;   /* 量到還沒排版的預設 300×150 畫布，不算數，重量 */
    }
    if (!d || d.error) { ok(false, `${name} ${w}×${h}：量測失敗 ${d && d.error || '沒有輸出'}`); continue; }
    const [ow, oh] = OLD[n], oldTile = Math.floor(Math.min(d.availW / ow, d.availH / oh));   /* 同樣的可用空間，塞舊的格數會是多大 */
    ok(d.w === NEW[n][0] && d.h === NEW[n][1], `${name} ${n} 人：地圖 ${d.w}×${d.h}`);
    ok(d.left >= -0.5 && d.top >= -0.5 && d.right <= d.vw + 0.5 && d.bottom <= d.vh + 0.5, `${name}：地圖完整在畫面內（${Math.round(d.cw)}×${Math.round(d.ch)}／視窗 ${d.vw}×${d.vh}）`);
    ok(d.tile >= 12 && d.tile >= oldTile * 0.55, `${name}：每格 ${d.tile.toFixed(1)}px，最初的格數約 ${oldTile}px（${Math.round((d.tile / oldTile - 1) * 100)}%）`);
    /* 資訊欄：整列在棋盤最上面那圈外牆裡（不蓋可玩格），語言與設定鈕貼著棋盤右上角，且側欄所有裝置預設收起 */
    ok(d.sideClosed, `${name}：側欄預設收起`);
    if (d.hud) {
      ok(d.hud.left >= d.left - 1 && d.hud.right <= d.right + 1 && d.hud.top >= d.top - 1 && d.hud.bottom <= d.top + Math.max(d.tile, 26) + 1,
        `${name}：資訊欄在上方外牆圈內（高 ${Math.round(d.hud.h)}px，每格 ${d.tile.toFixed(1)}px）`);
      ok(d.gear && d.lang && d.gear.right <= d.right + 1 && d.gear.top >= d.top - 1 && d.gear.bottom <= d.top + Math.max(d.tile, 26) + 1 && d.lang.right <= d.gear.left + 1,
        `${name}：語言鈕與設定鈕在資訊欄右側 gear=${JSON.stringify(d.gear && [Math.round(d.gear.left), Math.round(d.gear.right), Math.round(d.gear.top), Math.round(d.gear.bottom)])} lang=${JSON.stringify(d.lang && [Math.round(d.lang.left), Math.round(d.lang.right)])} board=${Math.round(d.right)},${Math.round(d.top)}`);
    }
    if (name === 'phone-p') {
      ok(d.rotateShown, `${name}：手機直放顯示「請橫向遊玩」遮罩`);
    } else {
      ok(!d.rotateShown, `${name}：沒有轉向遮罩`);
    }
    /* 觸控操作版面：控制鈕在畫面內；手機橫放 overlay 不縮小；平板橫放最多蓋到最下方外牆圈；直放在地圖下方；桌機不顯示 */
    if (name === 'desktop') {
      ok(!d.touchShown, `${name}：桌機不顯示搖桿與放炸彈鍵`);
    } else if (d.stick && d.bomb && name !== 'phone-p') {
      const inView = b => b.left >= -0.5 && b.top >= -0.5 && b.right <= d.vw + 0.5 && b.bottom <= d.vh + 0.5;
      ok(inView(d.stick) && inView(d.bomb), `${name}：搖桿與炸彈鈕都在畫面內`);
      if (name === 'phone-l') {
        ok(d.plan.mode === 'overlay' && Math.abs(d.stick.w - Math.max(120, Math.min(172, Math.round(d.vh * 0.32)))) <= 1 && Math.abs(d.bomb.w - Math.max(86, Math.min(116, Math.round(d.vh * 0.23)))) <= 1,
          `${name}：手機橫放固定 overlay，搖桿 ${Math.round(d.stick.w)}px、炸彈鈕 ${Math.round(d.bomb.w)}px（不縮小）`);
      } else if (name === 'tablet-l') {
        ok(d.plan.mode === 'bars' && d.stick.w >= 171 && d.bomb.w >= 115, `${name}：平板橫放搖桿 ${Math.round(d.stick.w)}px、炸彈鈕 ${Math.round(d.bomb.w)}px（模式 ${d.plan.mode}）`);
        ok(d.stick.top >= d.bottom - d.tile - 1 && d.bomb.top >= d.bottom - d.tile - 1, `${name}：控制鈕最多蓋到最下方外牆圈，不蓋可玩格（地圖底 ${Math.round(d.bottom)}，搖桿頂 ${Math.round(d.stick.top)}）`);
      } else if (d.vw <= d.vh) {
        ok(d.stick.top >= d.bottom - 1 && d.bomb.top >= d.bottom - 1, `${name}：直放控制鈕在地圖下方（地圖底 ${Math.round(d.bottom)}，搖桿頂 ${Math.round(d.stick.top)}）`);
      }
    }
    ok(d.tile * d.spr.animal <= d.tile * 1.2, `${name}：人物 ${(d.tile * d.spr.animal).toFixed(0)}px，道具 ${(d.tile * d.spr.item).toFixed(0)}px，炸彈 ${(d.tile * d.spr.bomb).toFixed(0)}px`);
  }
}
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
console.log(fails ? `\n${fails} 項失敗` : `\n全部通過（截圖在 ${SHOTS}）`);
process.exit(fails ? 1 : 0);
