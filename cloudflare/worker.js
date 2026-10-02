/* ===== cloudflare/worker.js — Cloudflare Workers 版伺服器（Durable Object） =====
 *
 * 跟 server.js 做一樣的事，只是跑在 Cloudflare 上：
 *   - 房間、對局、電腦全部沿用 lib/rooms.js（純邏輯，不碰網路），規則不會跟 Node 版漂移
 *   - 全站只有一個 Durable Object「lobby」持有所有房間（等同 Node 版的單一行程），
 *     第一次建立時指定亞太區，台灣玩家延遲較低
 *   - 前端仍放在 GitHub Pages，這裡只提供 /ws、/health、/api/presence
 *
 * 環境變數：GAME_ALLOWED_ORIGIN（允許的前端 origin，逗號分隔；留空或 * 代表不限制）
 */
import { DurableObject } from 'cloudflare:workers';
import rooms from '../lib/rooms.js';

const { createHub } = rooms;
const LOBBY = 'lobby';
const MAX_TEXT = 4000;           /* 跟 server.js 一樣：單一訊息上限 */
const HELLO_MS = 5000;           /* 連上後 5 秒內沒 hello 就斷 */
const IDLE_MS = 45000;           /* 45 秒沒收到任何訊息就斷（客戶端每 2 秒會 ping） */

function allowList(env) {
  const raw = String(env.GAME_ALLOWED_ORIGIN || '*').trim();
  if (!raw || raw === '*') return null;
  return raw.split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
}
function originOk(env, origin) {
  const list = allowList(env);
  return !list || !origin || list.indexOf(String(origin).replace(/\/+$/, '')) >= 0;
}
function cors(env, req, headers) {
  const origin = req.headers.get('Origin');
  const list = allowList(env);
  if (origin && originOk(env, origin)) headers.set('Access-Control-Allow-Origin', list ? origin : '*');
  headers.set('Vary', 'Origin');
  return headers;
}
function json(env, req, data, status) {
  const headers = cors(env, req, new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }));
  return new Response(JSON.stringify(data), { status: status || 200, headers });
}
function lobby(env) {
  const id = env.HUB.idFromName(LOBBY);
  return env.HUB.get(id, { locationHint: 'apac' });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, req, new Headers()) });
    if (url.pathname === '/health') return json(env, req, { ok: true, game: 'bomb-squad', runtime: 'cloudflare', colo: req.cf && req.cf.colo });
    if (url.pathname === '/api/presence') return json(env, req, Object.assign({ gameId: 'bomb-squad' }, await lobby(env).stats(), { updatedAt: new Date().toISOString() }));
    if (url.pathname === '/ws') {
      if ((req.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') return new Response('expected websocket', { status: 426 });
      if (!originOk(env, req.headers.get('Origin'))) return new Response('forbidden', { status: 403 });
      return lobby(env).fetch(req);
    }
    if (url.pathname === '/') return new Response('炸彈小隊 Cloudflare 伺服器運作中。前端請開 GitHub Pages。', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    return new Response('找不到頁面', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
};

/** 全站唯一的大廳：持有 hub（所有房間）與所有 WebSocket */
export class GameHub extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sockets = new Map();      /* key → WebSocket */
    this.conns = new Set();        /* 所有連線（含還沒 hello 的） */
    this.timer = 0;
    this.hub = createHub({
      emit: (key, msg) => {
        const ws = this.sockets.get(key);
        if (ws) { try { ws.send(JSON.stringify(msg)); } catch (e) { /* 已斷 */ } }
      }
    });
  }

  stats() { return this.hub.stats(); }

  /* 有連線或有房間時才跑 60 Hz 的對局迴圈；都沒有就停掉，讓 Durable Object 可以休息 */
  ensureTick() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.hub.tick();
      const t = Date.now();
      for (const c of this.conns) if (t - c.lastSeen > (c.key ? IDLE_MS : HELLO_MS)) this.drop(c, 1001, 'idle');
      if (!this.conns.size && !this.hub.roomCount()) { clearInterval(this.timer); this.timer = 0; }
    }, 16);
  }

  drop(c, code, reason) {
    if (c.closed) return;
    c.closed = true;
    this.conns.delete(c);
    try { c.ws.close(code || 1000, reason || ''); } catch (e) { /* 已斷 */ }
    if (c.key && this.sockets.get(c.key) === c.ws) { this.sockets.delete(c.key); this.hub.disconnect(c.key); }
  }

  async fetch() {
    const pair = new WebSocketPair();
    const client = pair[0], ws = pair[1];
    ws.accept();
    const c = { ws, key: null, lastSeen: Date.now(), closed: false };
    this.conns.add(c);
    this.ensureTick();

    ws.addEventListener('message', ev => {
      c.lastSeen = Date.now();
      const text = typeof ev.data === 'string' ? ev.data : '';
      if (!text || text.length > MAX_TEXT) return;
      let msg = null;
      try { msg = JSON.parse(text); } catch (e) { return; }
      if (!msg || typeof msg.type !== 'string') return;
      if (!c.key) {
        if (msg.type !== 'hello' || typeof msg.key !== 'string' || !/^[\w-]{8,64}$/.test(msg.key)) return;
        c.key = msg.key;
        const old = this.sockets.get(c.key);
        if (old && old !== ws) {
          try { old.send(JSON.stringify({ type: 'replaced' })); } catch (e) { /* 已斷 */ }
          for (const o of this.conns) if (o.ws === old) { o.key = null; this.drop(o, 4000, 'replaced'); }
        }
        this.sockets.set(c.key, ws);
        this.hub.connect(c.key, msg);
        return;
      }
      try { this.hub.handle(c.key, msg); } catch (e) { console.error('[hub] handle error:', e && e.message); }
    });
    ws.addEventListener('close', () => this.drop(c));
    ws.addEventListener('error', () => this.drop(c));

    return new Response(null, { status: 101, webSocket: client });
  }
}
