/* 線上端對端檢查：真的啟動 server.js，用 Node 內建 WebSocket 連線，驗證房間、邀請、觀戰、對局與零真人自動關閉。
 * 指定 SERVER 就改測那台（例如 Cloudflare 版或已部署的網址）：SERVER=http://127.0.0.1:8787 node scripts/online-check.js */
'use strict';
const { createServer } = require('../server.js');
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
/* 測遠端伺服器時等久一點（來回延遲可能數百毫秒） */
const SLOW = process.env.SERVER ? 4 : 1;
const wait = ms => new Promise(r => setTimeout(r, ms * SLOW));

function client(base, key, name) {
  const ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws');
  const c = { ws, msgs: [], room: null };
  ws.onmessage = e => { const m = JSON.parse(e.data); c.msgs.push(m); if (m.type === 'room') c.room = m.room; if (m.type === 'welcome') c.room = m.room; };
  c.open = new Promise(res => { ws.onopen = () => { ws.send(JSON.stringify({ type: 'hello', key, name, animal: 'cat' })); res(); }; });
  c.send = m => ws.send(JSON.stringify(m));
  c.last = t => { for (let i = c.msgs.length - 1; i >= 0; i--) if (c.msgs[i].type === t) return c.msgs[i]; return null; };
  c.count = t => c.msgs.filter(m => m.type === t).length;
  return c;
}

(async () => {
  let server = null, base = (process.env.SERVER || '').replace(/\/+$/, '');
  if (!base) {
    server = createServer({ allowOrigin: '*' }).server;
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    base = 'http://127.0.0.1:' + server.address().port;
  }
  /* 每次用不同的 key，重複測同一台遠端伺服器也不會撞到上次的身分 */
  const tag = Date.now().toString(36);
  const res = await fetch(base + '/health');
  ok(res.ok && (await res.json()).ok, '/health 正常');

  const A = client(base, tag + '-key-a-0001', '甲'), B = client(base, tag + '-key-b-0001', '乙'), S = client(base, tag + '-key-s-0001', '觀');
  await Promise.all([A.open, B.open, S.open]); await wait(200);
  ok(A.last('welcome') && A.last('rooms'), '連線後收到 welcome 與房間列表');
  A.send({ type: 'create', roomName: '測試房', max: 4, name: '甲', animal: 'cat' }); await wait(200);
  ok(A.room && A.room.you.host, '建立房間後成為房主');
  const id = A.room.id;
  A.send({ type: 'invite', role: 'player' }); A.send({ type: 'invite', role: 'spectator' }); await wait(200);
  const invs = A.msgs.filter(m => m.type === 'invite');
  const [pTok, sTok] = [invs[0].token, invs[1].token];
  B.send({ type: 'inviteInfo', room: id, token: pTok }); await wait(150);
  ok(B.last('inviteInfo').ok === true && !B.room, '查詢邀請不會自動入房');
  B.send({ type: 'join', room: id, token: pTok, name: '乙', animal: 'dog' }); await wait(200);
  ok(B.room && B.room.you.role === 'player', '邀請 token 決定玩家身分');
  S.send({ type: 'join', room: id, token: sTok, name: '觀', as: 'player' }); await wait(200);
  ok(S.room && S.room.you.role === 'spectator', '觀戰 token 即使要求 as=player 仍是觀戰者');
  B.send({ type: 'ready', value: true }); A.send({ type: 'addai', level: 'hard' }); await wait(200);
  A.send({ type: 'start' }); await wait(1500);
  ok(A.count('snap') > 5 && S.count('snap') > 5 && B.count('snap') > 5, '三人都收到伺服器快照（玩家＋觀戰）');
  ok(A.last('start').slot != null && S.last('start').slot == null, '觀戰者沒有操作席位');
  A.send({ type: 'input', dir: 'R' }); A.send({ type: 'bomb' }); await wait(300);
  A.send({ type: 'revoke' }); await wait(150);
  const C = client(base, tag + '-key-c-0001', '丙'); await C.open; await wait(100);
  C.send({ type: 'join', room: id, token: pTok, name: '丙' }); await wait(150);
  ok(C.last('joinFailed') && C.last('joinFailed').reason === 'revoked', '撤銷後的邀請不能用');
  A.send({ type: 'leave' }); await wait(150);
  B.send({ type: 'leave' }); await wait(300);
  ok(S.last('closed') && !S.room, '真人全數離開 → 觀戰者收到 closed，房間關閉');
  C.send({ type: 'join', room: id, as: 'spectator' }); await wait(150);
  ok(C.last('joinFailed') && C.last('joinFailed').reason === 'closed', '已關閉的房間無法重新進入');
  for (const x of [A, B, S, C]) x.ws.close();
  if (server) server.close(); await wait(100);
  console.log(fails ? '\n失敗 ' + fails + ' 項' : '\n全部通過');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
