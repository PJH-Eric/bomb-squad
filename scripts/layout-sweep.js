/* 全畫面版面掃描：多尺寸 × 每個畫面／彈窗／下拉，偵測溢出、超出父層、橫向捲動、文字被裁切、被迫換行。
 * 用法：node scripts/layout-sweep.js [baseUrl]（需先啟動伺服器；NODE_PATH 指向 playwright） */
const pw = require('playwright'); const path = require('path'); const fs = require('fs');
const BASE = process.argv[2] || 'http://localhost:3120';
const SHOTS = '/tmp/shots/sweep'; fs.mkdirSync(SHOTS, { recursive: true });
const VIEWS = [['手機直向', 360, 740, true], ['手機直向大', 430, 932, true], ['手機橫向', 844, 390, true], ['平板直向', 820, 1180, true], ['平板橫向', 1180, 820, true], ['桌機', 1440, 900, false]];
const wait = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const log = [];
const detect = page => page.evaluate(() => {
  const out = []; const W = innerWidth;
  const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  const nm = e => (e.className && e.className.baseVal === undefined ? '.' + String(e.className).trim().split(/\s+/).slice(0, 2).join('.') : e.tagName.toLowerCase()) + '「' + (e.textContent || '').trim().slice(0, 8) + '」';
  if (document.documentElement.scrollWidth > W + 1) out.push('整頁橫向溢出 ' + document.documentElement.scrollWidth + '>' + W);
  if (document.documentElement.scrollHeight > innerHeight + 1 && getComputedStyle(document.body).overflow === 'visible') out.push('整頁出現原生垂直捲動');
  const scope = document.querySelectorAll('.screen *, .dialog *, .pop-layer *, .game-root *');
  scope.forEach(e => {
    if (!vis(e) || e.closest('canvas') || e.tagName === 'CANVAS' || e.closest('svg') && e.tagName !== 'svg') return;
    if (e.closest('.sc-track,.sc-thumb,.sc-bar')) return;
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    if (cs.position === 'fixed' && !e.closest('.dialog')) return;
    // 超出視窗
    if (r.right > W + 1 || r.left < -1) { if (!e.closest('.scroll-x,.seg,.chips,.quick-chat,.ai-faces,.seat-actions')) out.push('超出視窗 ' + nm(e) + ' ' + Math.round(r.left) + '~' + Math.round(r.right)); }
    // 超出最近的容器卡片
    const box = e.parentElement && e.parentElement.closest('.card,.dialog-body,.seat,.room-item,.field,.invite-card,.ai-row');
    if (box && box !== e && cs.position !== 'absolute' && cs.position !== 'fixed') {
      const b = box.getBoundingClientRect();
      if (r.right > b.right + 2 || r.left < b.left - 2) { if (!e.closest('.seg,.chips,.quick-chat,.ai-faces,.seat-actions,.dd-list,.scroll-x')) out.push('超出父層 ' + nm(e) + ' → ' + nm(box) + ' (' + Math.round(r.right - b.right) + 'px)'); }
    }
    // 文字被裁切（非省略號）
    if ((cs.overflowX === 'hidden') && e.scrollWidth > e.clientWidth + 2 && cs.textOverflow !== 'ellipsis' && e.children.length === 0 && e.textContent.trim()) out.push('文字被裁切 ' + nm(e));
    // 橫向捲動（使用者不喜歡橫向操作）
    if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && e.scrollWidth > e.clientWidth + 2) out.push('橫向可捲動 ' + nm(e));
  });
  const sel = '.btn-label,.seg-btn,.pill,.hud-chip,.field > .label,.seat-name,kbd,.status,.hud-timer,.topbar h2,.card > h3,.dialog-title,.sum-row .kills';
  document.querySelectorAll(sel).forEach(el => { if (!vis(el) || !el.textContent.trim()) return; if (el.getClientRects().length > 1) out.push('多行 ' + nm(el)); else { const cs = getComputedStyle(el), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3, r = el.getBoundingClientRect(); if (cs.display !== 'inline' && r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) > lh * 1.7 && cs.whiteSpace !== 'nowrap') out.push('折行 ' + nm(el)); } });
  return [...new Set(out)];
});
async function check(page, v, name) {
  const o = await detect(page);
  await page.screenshot({ path: path.join(SHOTS, v[0] + '-' + name + '.png') });
  if (o.length) { fails++; log.push('✗ [' + v[0] + '] ' + name + '\n    ' + o.slice(0, 6).join('\n    ')); } else log.push('✓ [' + v[0] + '] ' + name);
}
const click = (p, t) => p.getByRole('button', { name: t }).first().click();
(async () => {
  const browser = await pw.chromium.launch();
  const errors = [];
  // 另一位房主先開一間房，讓大廳列表有內容
  const hostCtx = await browser.newContext({ viewport: { width: 1000, height: 800 } }); const H = await hostCtx.newPage();
  H.on('pageerror', e => errors.push('H ' + e.message));
  await H.goto(BASE); await click(H, '跟別人玩'); await wait(1000); await click(H, '建立房間'); await wait(300); await click(H, '建立'); await wait(800);
  for (const v of VIEWS) {
    const ctx = await browser.newContext({ viewport: { width: v[1], height: v[2] }, hasTouch: v[3], isMobile: v[3] }); const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(v[0] + ' ' + e.message)); p.on('console', m => m.type() === 'error' && errors.push(v[0] + ' console ' + m.text()));
    await p.goto(BASE); await wait(500); await check(p, v, '首頁');
    await p.getByText('怎麼玩').first().click(); await wait(300); await check(p, v, '怎麼玩'); await click(p, /返回|首頁/).catch(() => p.goBack()); await wait(300);
    await click(p, '一個人玩'); await wait(400); await check(p, v, '單人設定');
    await p.getByText('更多設定').first().click(); await wait(200); await check(p, v, '單人設定-更多');
    await p.locator('.dd-btn, .dd-trigger, [aria-haspopup="listbox"]').first().click().catch(() => {}); await wait(250); await check(p, v, '單人-下拉展開'); await p.keyboard.press('Escape'); await wait(150);
    await p.locator('button[aria-label*="設定"]').first().click().catch(() => {}); await wait(300); await check(p, v, '全域設定彈窗'); await p.keyboard.press('Escape'); await wait(200);
    await click(p, '開始遊戲'); await wait(4800); await check(p, v, '單人對戰');
    await p.keyboard.press('Escape'); await wait(300); await check(p, v, '暫停彈窗');
    await click(p, '繼續').catch(() => {}); await wait(200);
    await p.evaluate(() => { const g = App.game; if (g) g.destroy(); }); await p.goto(BASE); await wait(500);
    await click(p, '跟別人玩'); await wait(1500); await check(p, v, '大廳(含房間列表)');
    await click(p, '建立房間'); await wait(300); await check(p, v, '建立房間彈窗'); await click(p, '建立'); await wait(800);
    await click(p, '加電腦'); await wait(200); await click(p, '加電腦').catch(() => {}); await wait(300); await check(p, v, '房間(房主+電腦)');
    await click(p, '邀請朋友'); await wait(300); await click(p, '產生連結'); await wait(400); await check(p, v, '邀請彈窗'); await click(p, '完成'); await wait(200);
    await p.locator('.dd-btn, [aria-haspopup="listbox"]').first().click().catch(() => {}); await wait(250); await check(p, v, '房間-下拉展開'); await p.keyboard.press('Escape');
    await ctx.close();
  }
  console.log(log.join('\n')); console.log(errors.length ? '\n錯誤：\n' + errors.join('\n') : '\n沒有 console 錯誤');
  console.log(fails ? '\n' + fails + ' 處有問題' : '\n全部通過'); await browser.close(); process.exit(fails || errors.length ? 1 : 0);
})();
