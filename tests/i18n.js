/* ===== tests/i18n.js — 字典完整性檢查 =====
 * 用法：node tests/i18n.js
 * 檢查：1) zh-Hant 與 en 的 key 完全相同　2) 每個 key 的 {佔位符} 兩邊一致
 *       3) 原始碼（t／tr／I18N.t／data-i18n*）用到的 key 都在字典裡　4) 動態 key 的前綴至少有一個字典項目
 *       5) 伺服器（lib/rooms.js）送出的訊息代碼都有對應翻譯　6) 英文字典沒有混入中文
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { zh, en } = require('../public/js/locales.js');

const root = path.join(__dirname, '..');
let passed = 0;
const failed = [];
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failed.push(name); console.log('  ✗ ' + name + '\n      ' + (e && e.message)); }
}
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const holders = s => (String(s).match(/\{(\w+)\}/g) || []).sort().join(',');
const zhKeys = Object.keys(zh), enKeys = Object.keys(en);
const dictHas = k => Object.prototype.hasOwnProperty.call(zh, k);

console.log('\n字典');
test('zh-Hant 與 en 的 key 集合相同', () => {
  const a = zhKeys.filter(k => !(k in en)), b = enKeys.filter(k => !(k in zh));
  if (a.length || b.length) throw new Error('只在 zh：' + a.join(', ') + '；只在 en：' + b.join(', '));
});
test('每個 key 的 {佔位符} 兩邊一致', () => {
  const bad = zhKeys.filter(k => k in en && holders(zh[k]) !== holders(en[k]));
  if (bad.length) throw new Error(bad.map(k => k + '（' + holders(zh[k]) + ' vs ' + holders(en[k]) + '）').join('；'));
});
test('字典值都是非空字串', () => {
  const bad = zhKeys.filter(k => typeof zh[k] !== 'string' || !zh[k].trim() || typeof en[k] !== 'string' || !en[k].trim());
  if (bad.length) throw new Error(bad.join(', '));
});
test('英文字典沒有混入中文（語言名稱除外）', () => {
  const ok = new Set(['lang.zh']);
  const bad = enKeys.filter(k => !ok.has(k) && /[一-鿿　-〿＀-￯]/.test(en[k]));
  if (bad.length) throw new Error(bad.join(', '));
});

console.log('\n原始碼用到的 key');
const files = fs.readdirSync(path.join(root, 'public/js')).filter(f => f.endsWith('.js') && f !== 'locales.js' && f !== 'i18n.js').map(f => 'public/js/' + f)
  .concat(['public/index.html', 'lib/rooms.js', 'server.js']);
const used = new Map();       /* key → 檔案 */
const prefixes = new Map();   /* 動態 key 前綴 → 檔案 */
for (const f of files) {
  if (!fs.existsSync(path.join(root, f))) continue;
  const src = read(f);
  let m;
  const callRe = /(?:\bI18N\.t|\bt|\btr)\(\s*'([\w.]+)'\s*([,)+])/g;
  while ((m = callRe.exec(src))) { if (m[2] === '+') prefixes.set(m[1], f); else used.set(m[1], f); }
  const dynRe = /(?:\bI18N\.t|\bt|\btr)\(\s*'([\w.]*\.)'\s*\+/g;
  while ((m = dynRe.exec(src))) prefixes.set(m[1], f);
  const attrRe = /data-i18n(?:-html|-title|-content)?="([\w.]+)"/g;
  while ((m = attrRe.exec(src))) used.set(m[1], f);
  const multiRe = /data-i18n-attr="([^"]+)"/g;
  while ((m = multiRe.exec(src))) m[1].split(';').forEach(p => { const k = (p.split('=')[1] || '').trim(); if (k) used.set(k, f); });
}
test('t()／data-i18n 用到的 key 都存在字典（共 ' + used.size + ' 個）', () => {
  const miss = Array.from(used.keys()).filter(k => !dictHas(k));
  if (miss.length) throw new Error(miss.map(k => k + '（' + used.get(k) + '）').join('；'));
});
test('動態 key 的前綴（如 layout.、quick.）至少對得到一個字典項目', () => {
  const miss = Array.from(prefixes.keys()).filter(p => !zhKeys.some(k => k.indexOf(p) === 0));
  if (miss.length) throw new Error(miss.map(k => k + '（' + prefixes.get(k) + '）').join('；'));
});
test('有編號的字典項目不缺號（quick.0～4、name.adj0～9、theme.0～12）', () => {
  const need = [];
  for (let i = 0; i < 5; i++) need.push('quick.' + i);
  for (let i = 0; i < 10; i++) need.push('name.adj' + i);
  for (let i = 0; i < 13; i++) need.push('theme.' + i);
  const miss = need.filter(k => !dictHas(k));
  if (miss.length) throw new Error(miss.join(', '));
});
test('動物、等級、版型、道具的字典都齊全', () => {
  const need = [];
  ['cat', 'dog', 'bunny', 'bear', 'panda', 'fox', 'frog', 'penguin', 'chick'].forEach(a => ['name', 'role', 'intro'].forEach(f => need.push('animal.' + a + '.' + f)));
  ['toddler', 'easy', 'normal', 'hard', 'myth'].forEach(l => { need.push('level.' + l); need.push('level.hint.' + l); });
  ['random', 'classic', 'open', 'dense', 'fab'].forEach(l => need.push('layout.' + l));
  ['fire', 'bomb', 'speed', 'kick', 'shield', 'c_slow', 'c_auto', 'c_short', 'ghost', 'super', 'ultra', 'c_flip'].forEach(i => { need.push('item.' + i); need.push('item.desc.' + i); });
  const miss = need.filter(k => !dictHas(k));
  if (miss.length) throw new Error(miss.join(', '));
});

console.log('\n伺服器訊息代碼');
const srvSrc = read('lib/rooms.js');
test('lib/rooms.js 的 err／closeRoom／noteCode 代碼都有翻譯', () => {
  const miss = [];
  let m;
  const errRe = /\berr\(\s*[\w.]+\s*,\s*'(\w+)'/g;
  while ((m = errRe.exec(srvSrc))) if (!dictHas('srv.err.' + m[1])) miss.push('srv.err.' + m[1]);
  const closeRe = /closeRoom\(\s*\w+\s*,\s*'[^']*'\s*,\s*'(\w+)'/g;
  while ((m = closeRe.exec(srvSrc))) if (!dictHas('srv.closed.' + m[1])) miss.push('srv.closed.' + m[1]);
  const noteRe = /noteCode(?:\s*=|:)\s*'(\w+)'/g;
  while ((m = noteRe.exec(srvSrc))) if (!dictHas('srv.note.' + m[1])) miss.push('srv.note.' + m[1]);
  const kickRe = /code:\s*'(\w+)'/g;
  while ((m = kickRe.exec(srvSrc))) if (m[1] !== 'kicked' && !dictHas('srv.err.' + m[1])) miss.push('code ' + m[1]);
  if (miss.length) throw new Error(Array.from(new Set(miss)).join(', '));
});
test('lib/rooms.js 的系統訊息代碼（sys）都有翻譯', () => {
  const miss = [];
  const lines = srvSrc.split('\n').filter(l => /\bsys\(/.test(l) && !/function sys/.test(l));
  for (const l of lines) {
    const codes = (l.match(/'([a-z_]+)'/g) || []).map(s => s.slice(1, -1)).filter(c => !['player', 'spectator', 'timeout', 'kicked'].includes(c));
    if (!codes.length || !codes.every(c => dictHas('srv.sys.' + c))) miss.push(l.trim().slice(0, 90));
  }
  if (miss.length) throw new Error(miss.join('\n      '));
});
test('字典的 srv.sys.* 代碼都在伺服器出現過', () => {
  const orphan = zhKeys.filter(k => k.indexOf('srv.sys.') === 0).filter(k => srvSrc.indexOf("'" + k.slice(8) + "'") < 0);
  if (orphan.length) throw new Error(orphan.join(', '));
});

console.log('\n' + passed + ' 項通過' + (failed.length ? '，' + failed.length + ' 項失敗：\n  - ' + failed.join('\n  - ') : ''));
if (failed.length) process.exit(1);
