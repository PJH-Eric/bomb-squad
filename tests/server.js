/* ===== tests/server.js — 伺服器防呆：靜態檔路徑、WebSocket 封包上限與格式錯誤、hello key、斷線放開按鍵 =====
 * 用法：node tests/server.js（會在隨機埠啟動 server.js，用原始 TCP 送 frame）
 */
'use strict';
const net = require('net');
const crypto = require('crypto');
const { createServer } = require('../server.js');
const { createHub } = require('../lib/rooms.js');

let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

/** 客戶端 frame（一定要加遮罩）；lenOverride 用來謊報長度 */
function mframe(op, payload, fin, lenOverride) {
  const p = Buffer.from(payload);
  const len = lenOverride != null ? lenOverride : p.length;
  let h;
  if (len < 126) { h = Buffer.alloc(2); h[1] = 0x80 | len; }
  else if (len < 65536) { h = Buffer.alloc(4); h[1] = 0x80 | 126; h.writeUInt16BE(len, 2); }
  else { h = Buffer.alloc(10); h[1] = 0x80 | 127; h.writeUInt32BE(Math.floor(len / 4294967296), 2); h.writeUInt32BE(len >>> 0, 6); }
  h[0] = (fin === false ? 0 : 0x80) | op;
  const mask = crypto.randomBytes(4);
  for (let i = 0; i < p.length; i++) p[i] ^= mask[i % 4];
  return Buffer.concat([h, mask, p]);
}
/** 原始 TCP 的 WebSocket 客戶端：只解析伺服器送來的文字訊息 */
function connect(port) {
  return new Promise(res => {
    const s = net.connect(port, '127.0.0.1', () => s.write('GET /ws HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n'));
    let buf = Buffer.alloc(0), up = false;
    s.msgs = []; s.gone = false;
    s.on('data', c => {
      buf = Buffer.concat([buf, c]);
      if (!up) { const i = buf.indexOf('\r\n\r\n'); if (i < 0) return; up = true; buf = buf.slice(i + 4); res(s); }
      while (buf.length >= 2) {
        let len = buf[1] & 0x7f, off = 2;
        if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { if (buf.length < 10) return; len = buf.readUInt32BE(6); off = 10; }
        if (buf.length < off + len) return;
        if ((buf[0] & 0xf) === 1) s.msgs.push(JSON.parse(buf.slice(off, off + len).toString()));
        buf = buf.slice(off + len);
      }
    });
    s.on('close', () => { s.gone = true; });
    s.on('error', () => {});
    s.json = o => s.write(mframe(1, JSON.stringify(o)));
    s.has = t => s.msgs.some(m => m.type === t);
  });
}
function rawGet(port, p) {
  return new Promise(res => {
    const s = net.connect(port, '127.0.0.1', () => s.write('GET ' + p + ' HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'));
    let d = ''; s.on('data', c => { d += c; }); s.on('close', () => res(d.split('\r\n')[0])); s.on('error', () => res('ERR'));
  });
}

(async () => {
  const { server, hub } = createServer({ allowOrigin: '*' });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  console.log('\n靜態檔');
  ok(/ 400 /.test(await rawGet(port, '/index.html%00.js')), '網址含 %00 回 400');
  ok(/ 200 /.test(await rawGet(port, '/health')), '送過 %00 之後伺服器還活著');
  ok(/ 403 /.test(await rawGet(port, '/../server.js')), '../ 跳出 public 回 403');
  ok(/ 403 /.test(await rawGet(port, '/../public-x/a.txt')), '名稱以 public 開頭的旁邊資料夾也回 403');

  const pres = await (await fetch('http://127.0.0.1:' + port + '/api/presence')).json();
  ok(pres.gameId === 'bomb-squad' && ['online', 'players', 'spectators', 'lobby', 'rooms'].every(k => Number.isInteger(pres[k]) && pres[k] >= 0) && !isNaN(Date.parse(pres.updatedAt)),
    '/api/presence 符合遊戲大廳的統一格式');

  console.log('\nWebSocket');
  const big = await connect(port);
  big.json({ type: 'hello', key: 'big-frame-01', name: 'A' }); await wait(100);
  big.write(mframe(1, 'x', true, 2 ** 33));   /* 謊稱 8GB 的 frame */
  await wait(200);
  ok(big.gone, '超過大小上限的 frame 直接斷線');

  const frag = await connect(port);
  frag.json({ type: 'hello', key: 'frag-flood-1', name: 'B' }); await wait(100);
  const chunk = 'x'.repeat(30000);
  for (let i = 0; i < 4; i++) frag.write(mframe(i ? 0 : 1, chunk, false));
  await wait(200);
  ok(frag.gone, '分段累計超過上限也斷線');

  const orphan = await connect(port);
  orphan.json({ type: 'hello', key: 'orphan-cont1', name: 'D' }); await wait(100);
  orphan.write(mframe(0, JSON.stringify({ type: 'create', roomName: '不該出現', max: 4 })));
  await wait(200);
  ok(orphan.gone && !hub.listRooms().some(r => r.name === '不該出現'), '沒有開頭的續傳 frame 不會被當成訊息');

  const bad = await connect(port);
  bad.json({ type: 'hello', key: '........', name: 'C' }); await wait(150);
  ok(!bad.has('welcome'), '只有怪字元的 key 不會被接受');
  bad.destroy();

  const good = await connect(port);
  good.json({ type: 'hello', key: 'good-key-01', name: 'G' }); await wait(150);
  ok(good.has('welcome'), '正常的 key 會收到 welcome');
  good.destroy();

  console.log('\n房間');
  let t = 1000;
  const h = createHub({ now: () => t, emit() {} });
  h.connect('host-key-01', { name: '甲' }); h.connect('guest-key-1', { name: '乙' });
  h.handle('host-key-01', { type: 'create', roomName: '房', max: 4 });
  const room = h.listRooms()[0];
  h.handle('guest-key-1', { type: 'join', room: room.id, as: 'player' });
  h.handle('guest-key-1', { type: 'ready', value: true });
  h.handle('host-key-01', { type: 'start' });
  const g = h._rooms.get(room.id).game;
  const slot = g.slotOf.get('guest-key-1');
  h.handle('guest-key-1', { type: 'input', dir: 'L', dir2: 'U' });
  ok(g.inputs[slot].dir === 'L' && g.inputs[slot].dir2 === 'U', '線上輸入會帶第二方向（提早轉彎）');
  h.handle('guest-key-1', { type: 'input', dir: 'L', dir2: 'X' });
  ok(g.inputs[slot].dir2 === null, '不合法的第二方向會被忽略');
  h.handle('guest-key-1', { type: 'input', dir: 'L', dir2: 'U' });
  h.disconnect('guest-key-1');
  ok(g && g.inputs[slot].dir === null && g.inputs[slot].dir2 === null, '斷線後放開方向鍵，角色不會自己一直走');
  h.connect('lobby-key-01', { name: '丙' });
  h.connect('spec-key-001', { name: '丁' });
  h.handle('spec-key-001', { type: 'join', room: room.id, as: 'spectator' });
  const st = h.stats();
  ok(st.online === 3 && st.players === 1 && st.spectators === 1 && st.lobby === 1 && st.rooms === 1,
    '在線人數分類正確（斷線的不算、玩家／觀戰／大廳分開）：' + JSON.stringify(st));

  server.close();
  console.log(fails ? '\n' + fails + ' 項失敗' : '\n全部通過');
  process.exit(fails ? 1 : 0);
})();
