/* 多點觸控實測（選用，只需要本機 Chrome／Edge，不需要 playwright）：
 * 用無頭瀏覽器開單機對局（手機橫放 844×390），在頁面裡派送不同 pointerId 的 Pointer Events，驗證
 *   1. 按住搖桿時同時按放炸彈鍵，兩邊都有效、互不中斷；
 *   2. 第二根手指按在搖桿上不會搶走原本的手指；別根手指放開不會讓搖桿或炸彈鍵誤放開；
 *   3. pointercancel、visibilitychange、blur、pagehide 之後方向、搖桿外觀、炸彈鍵都完整重置；
 *   4. 方向箭頭只有按住的方向亮起。
 * 用法：node scripts/touch-check.js            找不到瀏覽器時略過並結束碼 0 */
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
if (!chrome) { console.log('找不到 Chrome／Edge，略過多點觸控實測（可用 CHROME 環境變數指定路徑）'); process.exit(0); }

const PUBLIC = path.join(__dirname, '..', 'public');
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : ' FAIL ') + m); if (!c) fails++; };

function pageHtml() {
  const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  const probe = `<script>
    (function () {
      const out = document.createElement('pre'); out.id = 'touch-out'; document.body.appendChild(out);
      const res = [];
      const t = function (name, cond) { res.push([name, !!cond]); };
      setTimeout(function () {
        try {
          App.store.solo.levels = ['normal']; App.store.solo.theme = 6; App.store.solo.layout = 'classic';
          App.store.touchMode = 'on'; App.store.stickSide = 'left';
          App.startSolo();
          setTimeout(function () {
            try {
              const g = App.game, stick = document.querySelector('.stick'), bombBtn = document.querySelector('.bomb-btn');
              let bombs = 0; const realPress = g.pressBomb.bind(g); g.pressBomb = function () { bombs++; return realPress(); };
              const ev = function (el, type, id, dx, dy) {
                const r = stick.getBoundingClientRect(), b = el.getBoundingClientRect();
                const x = el === stick ? r.left + r.width / 2 + dx : b.left + b.width / 2, y = el === stick ? r.top + r.height / 2 + dy : b.top + b.height / 2;
                el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: true }));
              };
              const on = function (c) { return stick.querySelector('.arrow.' + c).classList.contains('on'); };
              const R = stick.getBoundingClientRect().width / 2 * 0.8;

              ev(stick, 'pointerdown', 1, R, 0);
              t('搖桿按下 → 方向 R', g.stickDir === 'R');
              t('按住的方向箭頭亮起，其餘不亮', on('r') && !on('u') && !on('d') && !on('l'));
              ev(bombBtn, 'pointerdown', 2, 0, 0);
              t('按住搖桿時放炸彈鍵有效（pressBomb 被呼叫 1 次）', bombs === 1);
              t('放炸彈鍵沒有中斷搖桿（方向仍是 R）', g.stickDir === 'R' && bombBtn.classList.contains('down'));
              ev(stick, 'pointerdown', 3, -R, 0); ev(stick, 'pointermove', 3, -R, 0);
              t('第二根手指按在搖桿上被忽略（方向沒被搶走）', g.stickDir === 'R');
              ev(stick, 'pointerup', 3, -R, 0);
              t('第二根手指放開不會讓搖桿放開', g.stickDir === 'R' && stick.classList.contains('down'));
              ev(bombBtn, 'pointerdown', 7, 0, 0);
              t('炸彈鍵已被一根手指按住時，另一根手指的按下不重複觸發', bombs === 1);
              ev(bombBtn, 'pointerup', 99, 0, 0);
              t('別根手指放開不會讓炸彈鍵誤放開', bombBtn.classList.contains('down'));
              ev(bombBtn, 'pointerup', 2, 0, 0);
              t('自己的手指放開 → 炸彈鍵放開，搖桿仍維持', !bombBtn.classList.contains('down') && g.stickDir === 'R');
              ev(stick, 'pointermove', 1, 0, -R);
              t('同一根手指移到上方 → 方向 U、箭頭換成 u', g.stickDir === 'U' && on('u') && !on('r'));
              ev(stick, 'pointercancel', 1, 0, 0);
              t('pointercancel 後方向、箭頭、中心鈕、按下狀態都清掉', g.stickDir == null && g.dir == null && !on('u') && g.knob.style.transform === '' && !stick.classList.contains('down'));

              ev(stick, 'pointerdown', 5, R, 0); ev(bombBtn, 'pointerdown', 6, 0, 0);
              t('重新按住搖桿與炸彈鍵', g.stickDir === 'R' && bombBtn.classList.contains('down') && bombs === 2);
              Object.defineProperty(document, 'visibilityState', { configurable: true, get: function () { return 'hidden'; } });
              document.dispatchEvent(new Event('visibilitychange'));
              t('頁面隱藏（visibilitychange）後完整重置', g.stickDir == null && g.dir == null && !bombBtn.classList.contains('down') && g.knob.style.transform === '' && !on('r'));
              Object.defineProperty(document, 'visibilityState', { configurable: true, get: function () { return 'visible'; } });

              ev(stick, 'pointerdown', 8, 0, R);
              t('重置後可以再用新的手指按搖桿（不殘留舊的 pointerId）', g.stickDir === 'D');
              window.dispatchEvent(new Event('blur'));
              t('視窗失去焦點（blur）後方向清掉', g.stickDir == null && g.dir == null);
              ev(stick, 'pointerdown', 9, -R, 0); ev(bombBtn, 'pointerdown', 10, 0, 0);
              window.dispatchEvent(new Event('pagehide'));
              t('pagehide 後方向與炸彈鍵都重置', g.stickDir == null && !bombBtn.classList.contains('down'));
              ev(bombBtn, 'pointerdown', 11, 0, 0);
              t('重置後炸彈鍵可以再按', bombs === 4);
              ev(bombBtn, 'pointerup', 11, 0, 0);
            } catch (e) { res.push(['例外：' + (e && e.stack || e), false]); }
            out.textContent = JSON.stringify(res);
          }, 1200);
        } catch (e) { out.textContent = JSON.stringify([['啟動失敗：' + (e && e.stack || e), false]]); }
      }, 300);
    })();
  <\/script>`;
  return html.replace('</body>', probe + '</body>').replace(/(src|href)="(?!https?:|data:)([^"]+)"/g, (m, a, u) => a + '="' + path.join(PUBLIC, u.replace(/\?.*$/, '')).replace(/\\/g, '/') + '"');
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bomb-touch-'));
const file = path.join(tmp, 'touch.html');
fs.writeFileSync(file, pageHtml());
console.log('多點觸控（手機橫放 844×390）');
let res = null;
for (let attempt = 0; attempt < 4 && !res; attempt++) {
  const args = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--window-size=844,390', '--virtual-time-budget=9000',
    '--user-data-dir=' + path.join(tmp, 'prof' + attempt), '--dump-dom', 'file:///' + file.replace(/\\/g, '/')];
  const dom = spawnSync(chrome, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  const m = /<pre id="touch-out">([\s\S]*?)<\/pre>/.exec(dom.stdout || '');
  try { res = JSON.parse((m ? m[1] : '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')); } catch (e) { res = null; }
  if (res && !res.length) res = null;
}
if (!res) ok(false, '量測失敗：沒有輸出');
else for (const [name, pass] of res) ok(pass, name);
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
console.log(fails ? `\n${fails} 項失敗` : '\n全部通過');
process.exit(fails ? 1 : 0);
