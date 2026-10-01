/* 瀏覽器煙霧測試（選用）：需要另外安裝 playwright，專案本身沒有依賴。
 * 用法：node server.js 另開一個終端機，再執行 BASE=http://localhost:3120 node scripts/browser-check.js
 * 會檢查：各畫面沒有 console 錯誤、手機／平板／桌機直橫向沒有水平溢出、單機可開局、線上建房＋邀請＋觀戰。
 * 截圖輸出到 SHOTS 目錄（預設 ./shots，已被 .gitignore 忽略）。 */
'use strict';
const fs = require('fs');
const path = require('path');
let pw;
try { pw = require('playwright'); } catch (e) { console.error('找不到 playwright：npm i -D playwright（只用於這支檢查）'); process.exit(2); }
const BASE = process.env.BASE || 'http://localhost:3120';
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const VIEWS = [
  ['phone-p', 390, 844, true], ['phone-l', 844, 390, true],
  ['tablet-p', 820, 1180, true], ['tablet-l', 1180, 820, true], ['desktop', 1440, 900, false]
];
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : ' FAIL ') + m); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

async function mkPage(browser, v, errors, tag) {
  const ctx = await browser.newContext({ viewport: { width: v[1], height: v[2] }, hasTouch: v[3], isMobile: v[3] });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(tag + ' console: ' + m.text()); });
  page.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));
  return { ctx, page };
}
/* 水平溢出：文件本身、.screen 捲動容器，以及任何超出視窗右緣的卡片／欄位都算 */
const overflow = page => page.evaluate(() => {
  let o = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  document.querySelectorAll('.screen, .dialog-body').forEach(e => { o = Math.max(o, e.scrollWidth - e.clientWidth); });
  document.querySelectorAll('.card, .field, .invite-card, .dialog, .seat, .room-item').forEach(e => { if (e.offsetParent) o = Math.max(o, Math.ceil(e.getBoundingClientRect().right - innerWidth)); });
  return o;
});
/* 找出「不該換行卻換行」的控制項：按鈕、標籤、膠囊、鍵帽、欄位（標籤與控制項被擠成上下兩塊） */
const wraps = page => page.evaluate(() => {
  const out = [];
  const sel = '.btn-label,.seg-btn,.pill,.hud-chip,.field > .label,.seat-name,.stat small,kbd,.status,.hud-timer,.topbar h2,.card > h3,.dialog-title,.quick-chat button,.sum-row .kills';
  document.querySelectorAll(sel).forEach(el => {
    if (!el.offsetParent || !el.textContent.trim()) return;
    const cs = getComputedStyle(el);
    if (el.getClientRects().length > 1) { out.push('多行 ' + el.className + ' 「' + el.textContent.trim().slice(0, 12) + '」'); return; }
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
    const r = el.getBoundingClientRect();
    if (cs.display !== 'inline' && r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) > lh * 1.7 && cs.whiteSpace !== 'nowrap') out.push('折行 ' + el.className + ' 「' + el.textContent.trim().slice(0, 12) + '」');
  });
  document.querySelectorAll('.field').forEach(f => {
    if (!f.offsetParent) return;
    const l = f.querySelector(':scope > .label'), c = f.querySelector(':scope > .ctl');
    if (l && c && c.getBoundingClientRect().top - l.getBoundingClientRect().top > 14) out.push('欄位上下堆疊 「' + l.textContent.trim().slice(0, 10) + '」');
  });
  return out;
});
const click = (page, text) => page.getByRole('button', { name: text }).first().click();

(async () => {
  const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const errors = [];
  for (const v of VIEWS) {
    console.log('== ' + v[0]);
    const { ctx, page } = await mkPage(browser, v, errors, v[0]);
    await page.goto(BASE); await wait(500);
    ok(await overflow(page) <= 1, '首頁沒有水平溢出');
    { const w = await wraps(page); ok(w.length === 0, '首頁沒有被迫換行的控制項' + (w.length ? ' → ' + w.slice(0, 6).join('；') : '')); }
    await page.screenshot({ path: path.join(SHOTS, v[0] + '-home.png') });
    await click(page, '怎麼玩'); await wait(300);
    ok(await overflow(page) <= 1, '教學沒有水平溢出');
    await page.screenshot({ path: path.join(SHOTS, v[0] + '-help.png') });
    await click(page, '返回'); await wait(200);
    await click(page, '一個人玩'); await wait(300);
    ok(await overflow(page) <= 1, '單機設定沒有水平溢出');
    { const w = await wraps(page); ok(w.length === 0, '單機設定沒有被迫換行的控制項' + (w.length ? ' → ' + w.slice(0, 6).join('；') : '')); }
    await page.screenshot({ path: path.join(SHOTS, v[0] + '-solo.png') });
    await click(page, '開始遊戲'); await wait(4500);
    const cv = await page.evaluate(() => { const c = document.querySelector('canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return { w: r.width, h: r.height, vw: innerWidth, vh: innerHeight }; });
    ok(cv && cv.w > 200 && cv.h > 200, '對戰畫布有尺寸 ' + JSON.stringify(cv));
    ok(await overflow(page) <= 1, '對戰沒有水平溢出');
    { const w = await wraps(page); ok(w.length === 0, '對戰沒有被迫換行的控制項' + (w.length ? ' → ' + w.slice(0, 6).join('；') : '')); }
    await page.screenshot({ path: path.join(SHOTS, v[0] + '-game.png') });
    await page.keyboard.press('Escape'); await wait(300);
    await page.screenshot({ path: path.join(SHOTS, v[0] + '-pause.png') });
    await click(page, '繼續'); await wait(300);
    await page.locator('#gear').click(); await wait(300);
    { const w = await wraps(page); ok(w.length === 0, '設定彈窗沒有被迫換行的控制項' + (w.length ? ' → ' + w.slice(0, 6).join('；') : '')); }
    await page.screenshot({ path: path.join(SHOTS, v[0] + '-settings.png') });
    await ctx.close();
  }

  console.log('== 線上：房主＋受邀玩家＋觀戰');
  const V = VIEWS[3];
  const A = await mkPage(browser, V, errors, 'A'), B = await mkPage(browser, V, errors, 'B'), S = await mkPage(browser, VIEWS[4], errors, 'S');
  await A.page.goto(BASE); await click(A.page, '跟別人玩'); await wait(1200);
  ok(await A.page.getByText('已連線').count() > 0, '大廳顯示已連線');
  await A.page.screenshot({ path: path.join(SHOTS, 'lobby.png') });
  await click(A.page, '建立房間'); await wait(300); await click(A.page, '建立'); await wait(800);
  ok(await A.page.getByText('你是房主').count() > 0, '建立後成為房主');
  await click(A.page, '加電腦'); await wait(300);
  await click(A.page, '邀請朋友'); await wait(300);
  await click(A.page, '產生連結'); await wait(500);
  const url1 = await A.page.locator('.link-box code').first().textContent();
  ok(/room=/.test(url1) && /invite=/.test(url1), '產生玩家邀請連結 ' + url1);
  await A.page.getByRole('radio', { name: '觀戰者' }).click();
  await click(A.page, '產生連結'); await wait(500);
  const codes = await A.page.locator('.link-box code').allTextContents();
  const url2 = codes.find(c => c !== url1 && /invite=/.test(c));
  ok(!!url2, '產生觀戰邀請連結');
  await A.page.screenshot({ path: path.join(SHOTS, 'invite-modal.png') });
  await click(A.page, '完成'); await wait(300);

  await B.page.goto(url1); await wait(1500);
  ok(await B.page.getByText('你被邀請加入').count() > 0, '受邀者先看到邀請卡，不會自動入房');
  await B.page.screenshot({ path: path.join(SHOTS, 'invite-landing.png') });
  await B.page.locator('.invite-card input.text-input').fill('小明');
  await click(B.page, '加入遊戲'); await wait(1000);
  ok(await B.page.getByText('你是玩家').count() > 0, '受邀者以玩家加入');
  await click(B.page, '我準備好了'); await wait(500);

  await S.page.goto(url2); await wait(1500);
  await click(S.page, '進去觀戰'); await wait(1000);
  ok(await S.page.getByText('你是觀戰者').count() > 0, '觀戰連結以觀戰者加入');
  await A.page.screenshot({ path: path.join(SHOTS, 'room-host.png') });
  await S.page.screenshot({ path: path.join(SHOTS, 'room-spec.png') });

  await click(A.page, '開始遊戲'); await wait(5000);
  ok(await A.page.locator('canvas').count() > 0 && await S.page.locator('canvas').count() > 0, '對局開始，玩家與觀戰者都進入對戰畫面');
  await A.page.keyboard.press('Space'); await wait(800);
  await A.page.screenshot({ path: path.join(SHOTS, 'online-game-host.png') });
  await S.page.screenshot({ path: path.join(SHOTS, 'online-game-spec.png') });
  await B.page.screenshot({ path: path.join(SHOTS, 'online-game-guest.png') });

  console.log('== 零真人自動關閉');
  await A.page.keyboard.press('Escape'); await wait(300); await click(A.page, '離開房間'); await wait(300);
  await A.page.getByRole('button', { name: '離開' }).last().click(); await wait(800);
  await B.page.keyboard.press('Escape'); await wait(300); await click(B.page, '離開房間'); await wait(300);
  await B.page.getByRole('button', { name: '離開' }).last().click(); await wait(1200);
  ok(await S.page.getByText('回到大廳').count() + await S.page.getByText('線上大廳').count() > 0, '真人都離開後觀戰者被送回大廳');
  await S.page.screenshot({ path: path.join(SHOTS, 'closed-spec.png') });
  for (const x of [A, B, S]) await x.ctx.close();

  await browser.close();
  console.log(errors.length ? '\nconsole 錯誤：\n' + errors.join('\n') : '\n沒有 console 錯誤');
  ok(errors.length === 0, 'console 無錯誤');
  console.log(fails ? '失敗 ' + fails + ' 項' : '全部通過');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
