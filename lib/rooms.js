/* ===== lib/rooms.js — 房間、席位、觀戰、邀請、聊天、權威對局（純邏輯，不碰網路） =====
 *
 * 伺服器（server.js）只負責把 WebSocket 訊息丟進 hub.handle()，
 * hub 透過 emit(key, msg) 把回應送出去；所以整個房間流程可以不開網路直接測。
 *
 * 房間生命週期以「實體玩家」為準：
 *   - 至少一位真人坐在席位上才保留房間（電腦席位與觀戰者都不算）
 *   - 真人降到 0 → 立刻關閉：邀請失效、對局計時器與電腦停止、廣播 closed、從大廳移除
 *   - 已關閉的房間不會因為重新連線而復活
 */
'use strict';

const Rules = require('../public/js/rules.js');
const AI = require('../public/js/ai.js');

const ANIMALS = ['cat', 'dog', 'bunny', 'bear', 'panda', 'fox', 'frog', 'penguin'];
const ANIMAL_NAMES = { cat: '小貓', dog: '小狗', bunny: '小兔', bear: '小熊', panda: '熊貓', fox: '狐狸', frog: '青蛙', penguin: '企鵝' };
const ADJ = ['快樂', '勇敢', '調皮', '害羞', '閃亮', '軟綿綿', '圓滾滾', '機靈', '呆萌', '活潑'];
const TIME_LIMITS = [0, 120, 180, 300];
const LAYOUTS = ['random', 'classic', 'open', 'dense', 'fab'];
const AI_LEVELS = AI.LEVEL_ORDER;
const GRACE_MS = 30000;        /* 斷線超過 30 秒直接判定離場，不做 AI 接管 */
const SPEC_CAP = 20;
const MAX_CHAT = 60;
const STEP_MS = Rules.DT * 1000;
const SNAP_EVERY = 3;          /* 每 3 個 tick 廣播一次快照（20 次/秒） */
const CLOSED_KEEP_MS = 3600 * 1000;
const INVITE_MAX_MS = 24 * 3600 * 1000;

function cleanName(raw, fallback) {
  let s = String(raw == null ? '' : raw).replace(/[\u0000-\u001f\u007f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim();
  s = Array.from(s).slice(0, 10).join('');
  return s || fallback || '';
}
function cleanText(raw) {
  return Array.from(String(raw == null ? '' : raw).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim()).slice(0, MAX_CHAT).join('');
}
const inList = (v, list) => list.indexOf(v) >= 0;

function createHub(opt) {
  opt = opt || {};
  const now = opt.now || (() => Date.now());
  const emitOut = opt.emit || (() => {});
  const onRoomsChanged = opt.onRoomsChanged || (() => {});
  const rnd = opt.random || Math.random;

  const persons = new Map();     /* key → person */
  const byPid = new Map();       /* pid → person */
  const rooms = new Map();       /* id → room */
  const closed = new Map();      /* id → { reason, at } */
  let pidSeq = 1;
  let lobbyDirty = false;

  /* ---------- 工具 ---------- */
  const emit = (key, msg) => emitOut(key, msg);
  function randomName() { return ADJ[Math.floor(rnd() * ADJ.length)] + ANIMAL_NAMES[ANIMALS[Math.floor(rnd() * ANIMALS.length)]]; }
  function token() { let t = ''; while (t.length < 12) t += Math.floor(rnd() * 36).toString(36); return t; }
  function roomId() {
    for (let i = 0; i < 50; i++) {
      let id = '';
      for (let k = 0; k < 4; k++) id += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(rnd() * 24)];
      if (!rooms.has(id) && !closed.has(id)) return id;
    }
    return 'R' + Date.now().toString(36).slice(-3).toUpperCase();
  }
  function err(key, code, text) { emit(key, { type: 'error', code, text }); }
  function dirty() { lobbyDirty = true; }

  const humanSeats = r => r.seats.filter(s => s.kind === 'human');
  const filled = r => r.seats.filter(s => s.kind !== 'empty');
  const seatOf = (r, key) => r.seats.findIndex(s => s.kind === 'human' && s.key === key);
  function members(r) {
    const out = humanSeats(r).map(s => s.key);
    for (const k of r.spectators) out.push(k);
    return out;
  }
  function broadcast(r, msg, except) {
    for (const k of members(r)) if (k !== except) emit(k, msg);
  }
  function takenAnimals(r, exceptSeat) {
    const set = new Set();
    r.seats.forEach((s, i) => { if (s.kind !== 'empty' && i !== exceptSeat) set.add(s.animal); });
    return set;
  }
  function freeAnimal(r, want, exceptSeat) {
    const taken = takenAnimals(r, exceptSeat);
    if (inList(want, ANIMALS) && !taken.has(want)) return want;
    const open = ANIMALS.filter(a => !taken.has(a));
    return open.length ? open[Math.floor(rnd() * open.length)] : ANIMALS[0];
  }

  /* ---------- 檢視 ---------- */
  function publicRoom(r) {
    return {
      id: r.id, name: r.name, phase: r.phase, max: r.maxPlayers,
      players: filled(r).length, humans: humanSeats(r).length, spectators: r.spectators.length,
      host: r.seats[r.hostSeat] ? r.seats[r.hostSeat].name : '',
      settings: r.settings, full: filled(r).length >= r.maxPlayers,
      joinable: r.phase === 'lobby' && filled(r).length < r.maxPlayers
    };
  }
  function listRooms() {
    return Array.from(rooms.values()).sort((a, b) => b.createdAt - a.createdAt).map(publicRoom);
  }
  function roomView(r, key) {
    const mySeat = seatOf(r, key);
    const isHost = mySeat >= 0 && mySeat === r.hostSeat;
    const humansReady = humanSeats(r).every((s, _i, arr) => s.ready || r.seats.indexOf(s) === r.hostSeat);
    const view = {
      id: r.id, name: r.name, phase: r.phase, max: r.maxPlayers, settings: r.settings, hostSeat: r.hostSeat,
      seats: r.seats.map((s, i) => ({
        i, kind: s.kind, name: s.name || '', animal: s.animal || null, level: s.level || null,
        ready: !!s.ready, connected: s.kind === 'human' ? !!(persons.get(s.key) && persons.get(s.key).connected) : true,
        pid: s.kind === 'human' ? persons.get(s.key).pid : null
      })),
      spectators: r.spectators.map(k => { const p = persons.get(k); return { pid: p.pid, name: p.name }; }),
      specCap: SPEC_CAP,
      you: { pid: persons.get(key).pid, role: mySeat >= 0 ? 'player' : 'spectator', seat: mySeat, host: isHost },
      canStart: r.phase === 'lobby' && filled(r).length >= 2 && humansReady
    };
    if (isHost) view.invites = Array.from(r.invites.entries()).filter(([, v]) => !v.revoked).map(([t, v]) => ({ token: t, role: v.role }));
    return view;
  }
  function pushRoom(r) {
    for (const k of members(r)) emit(k, { type: 'room', room: roomView(r, k) });
    dirty();
  }
  function sys(r, text) {
    const m = { pid: 0, name: '', text, role: 'sys', t: now() };
    r.chat.push(m); if (r.chat.length > 50) r.chat.shift();
    broadcast(r, { type: 'chat', m });
  }

  /* ---------- 人 ---------- */
  function connect(key, hello) {
    let p = persons.get(key);
    if (!p) {
      p = { key, pid: pidSeq++, name: '', animal: 'cat', connected: true, dcAt: 0, roomId: null, sub: true, chatAt: 0 };
      persons.set(key, p); byPid.set(p.pid, p);
    }
    p.connected = true; p.dcAt = 0;
    if (hello) {
      p.name = cleanName(hello.name, p.name || randomName());
      if (inList(hello.animal, ANIMALS)) p.animal = hello.animal;
    }
    if (!p.name) p.name = randomName();
    const r = p.roomId ? rooms.get(p.roomId) : null;
    if (p.roomId && !r) p.roomId = null;
    emit(key, { type: 'welcome', key, pid: p.pid, name: p.name, animal: p.animal, room: r ? roomView(r, key) : null });
    if (r) {
      emit(key, { type: 'chatlog', msgs: r.chat.slice(-40) });
      if (r.game) sendGameState(r, key);
      pushRoom(r);
    } else {
      p.sub = true;
      emit(key, { type: 'rooms', rooms: listRooms() });
    }
    return p;
  }
  function disconnect(key) {
    const p = persons.get(key);
    if (!p || !p.connected) return;
    p.connected = false; p.dcAt = now();
    const r = p.roomId ? rooms.get(p.roomId) : null;
    if (r) pushRoom(r);
  }

  /* ---------- 房間 ---------- */
  function newRoom(host, nameOpt, max) {
    const id = roomId();
    const r = {
      id, name: cleanName(nameOpt, host.name + '的房間') || (host.name + '的房間'), phase: 'lobby', maxPlayers: max || 4,
      seats: [], hostSeat: 0, spectators: [], invites: new Map(), chat: [], banned: new Set(), game: null,
      settings: { timeLimit: 180, layout: 'random', theme: 6, items: true, curses: true },
      createdAt: now()
    };
    for (let i = 0; i < r.maxPlayers; i++) r.seats.push({ kind: 'empty' });
    rooms.set(id, r);
    return r;
  }
  function sit(r, p, i) {
    r.seats[i] = { kind: 'human', key: p.key, name: p.name, animal: freeAnimal(r, p.animal, i), ready: false };
    p.roomId = r.id; p.sub = false;
  }
  function leaveRoom(key, reason) {
    const p = persons.get(key);
    if (!p || !p.roomId) return;
    const r = rooms.get(p.roomId);
    p.roomId = null; p.sub = true;
    if (!r) return;
    const i = seatOf(r, key);
    const si = r.spectators.indexOf(key);
    if (si >= 0) r.spectators.splice(si, 1);
    if (i >= 0) {
      if (r.game && (r.phase === 'playing')) {
        const slot = r.game.slotOf.get(key);
        if (slot != null) { Rules.removePlayer(r.game.state, slot); r.game.slotOf.delete(key); }
      }
      r.seats[i] = { kind: 'empty' };
      if (r.hostSeat === i) reassignHost(r);
    }
    emit(key, { type: 'room', room: null });
    emit(key, { type: 'rooms', rooms: listRooms() });
    if (humanSeats(r).length === 0) { closeRoom(r, '房間已經沒有玩家，自動關閉了'); return; }
    if (i >= 0) sys(r, p.name + (reason === 'timeout' ? ' 斷線太久，已離開' : reason === 'kicked' ? ' 被請出房間' : ' 離開了房間'));
    else sys(r, p.name + ' 不再觀戰');
    pushRoom(r);
  }
  function reassignHost(r) {
    const next = r.seats.findIndex(s => s.kind === 'human');
    if (next >= 0) { r.hostSeat = next; r.seats[next].ready = false; sys(r, r.seats[next].name + ' 成為新房主'); }
  }
  function closeRoom(r, text) {
    if (!rooms.has(r.id)) return;
    for (const v of r.invites.values()) v.revoked = true;
    r.game = null; r.phase = 'closed';
    const ids = members(r);
    rooms.delete(r.id);
    closed.set(r.id, { reason: text, at: now() });
    for (const k of ids) {
      const p = persons.get(k);
      if (p) { p.roomId = null; p.sub = true; }
      emit(k, { type: 'closed', text, room: r.id });
      emit(k, { type: 'room', room: null });
      emit(k, { type: 'rooms', rooms: listRooms() });
    }
    dirty();
  }

  /* ---------- 邀請 ---------- */
  function checkInvite(roomIdIn, tok) {
    const r = rooms.get(String(roomIdIn || '').toUpperCase());
    if (!r) {
      const c = closed.get(String(roomIdIn || '').toUpperCase());
      return { ok: false, reason: c ? 'closed' : 'invalid' };
    }
    const inv = r.invites.get(String(tok || ''));
    if (!inv) return { ok: false, reason: 'invalid' };
    if (inv.revoked) return { ok: false, reason: 'revoked' };
    if (now() - inv.created > INVITE_MAX_MS) return { ok: false, reason: 'expired' };
    return { ok: true, room: r, inv };
  }

  /* ---------- 加入 ---------- */
  function joinRoom(p, r, want, info) {
    if (p.roomId && p.roomId !== r.id) leaveRoom(p.key);
    if (p.roomId === r.id) { pushRoom(r); return; }
    if (r.banned.has(p.key)) { err(p.key, 'banned', '你已被請出這個房間'); return; }
    let role = want === 'spectator' ? 'spectator' : 'player';
    let note = '';
    if (role === 'player') {
      if (r.phase !== 'lobby') { role = 'spectator'; note = '對局進行中，先以觀戰者身分加入'; }
      else if (filled(r).length >= r.maxPlayers) { role = 'spectator'; note = '席位已滿，先以觀戰者身分加入'; }
    }
    if (role === 'spectator' && r.spectators.length >= SPEC_CAP) { err(p.key, 'spec_full', '觀戰席已滿'); return; }
    if (info) {
      p.name = cleanName(info.name, p.name || randomName());
      if (inList(info.animal, ANIMALS)) p.animal = info.animal;
    }
    if (role === 'player') {
      sit(r, p, r.seats.findIndex(s => s.kind === 'empty'));
    } else {
      r.spectators.push(p.key); p.roomId = r.id; p.sub = false;
    }
    emit(p.key, { type: 'joined', room: r.id, role, note });
    emit(p.key, { type: 'chatlog', msgs: r.chat.slice(-40) });
    sys(r, p.name + (role === 'player' ? ' 加入了房間' : ' 開始觀戰'));
    pushRoom(r);
    if (r.game) sendGameState(r, p.key);
  }

  /* ---------- 對局 ---------- */
  function startGame(r) {
    const occ = [];
    r.seats.forEach((s, i) => { if (s.kind !== 'empty') occ.push(i); });
    const slotOf = new Map();
    const players = occ.map((si, n) => {
      const s = r.seats[si];
      if (s.kind === 'human') slotOf.set(s.key, n);
      return { slot: n, name: s.name, animal: s.animal, kind: s.kind, level: s.level || null };
    });
    const seed = Math.floor(rnd() * 4294967296) >>> 0;
    const st = r.settings;
    const state = Rules.createGame({
      seed, players, layout: st.layout, themeId: st.theme, timeLimit: st.timeLimit, items: st.items, curses: st.curses
    });
    const brains = new Map();
    players.forEach((p, n) => { if (p.kind === 'ai') brains.set(n, AI.createBrain(p.level, seed + n * 101)); });
    const inputs = {};
    players.forEach((p, n) => { inputs[n] = { dir: null, bomb: false }; });
    r.game = { state, brains, inputs, slotOf, acc: 0, steps: 0, lastGrid: -1, pendingEvents: [], lastTick: now(), over: false };
    r.phase = 'playing';
    for (const s of r.seats) if (s.kind === 'human') s.ready = false;
    for (const k of members(r)) sendGameState(r, k);
    pushRoom(r);
  }
  function sendGameState(r, key) {
    const g = r.game;
    if (!g) return;
    const slot = g.slotOf.has(key) ? g.slotOf.get(key) : null;
    emit(key, { type: 'start', game: Rules.startInfo(g.state), slot });
    emit(key, { type: 'snap', s: Rules.snapshot(g.state, true) });
  }
  function stepRoom(r, t) {
    const g = r.game;
    if (!g) return;
    g.acc += t - g.lastTick; g.lastTick = t;
    if (g.acc > 250) g.acc = 250;
    let n = 0;
    while (g.acc >= STEP_MS && n++ < 6) {
      g.acc -= STEP_MS;
      const s = g.state;
      for (const [slot, brain] of g.brains) {
        const p = s.players[slot];
        const o = AI.think(brain, s, p, Rules.DT);
        g.inputs[slot].dir = o.dir; if (o.bomb) g.inputs[slot].bomb = true;
      }
      Rules.step(s, g.inputs, Rules.DT);
      if (s.events.length) for (const e of s.events) g.pendingEvents.push(e);
      g.steps++;
      if (g.steps % SNAP_EVERY === 0 || s.phase === 'over' && s.endHold <= 0) {
        const withGrid = g.lastGrid !== s.gridVer;
        g.lastGrid = s.gridVer;
        const snap = Rules.snapshot(s, withGrid);
        snap.e = g.pendingEvents; g.pendingEvents = [];
        broadcast(r, { type: 'snap', s: snap });
      }
      if (s.phase === 'over' && s.endHold <= 0) { finishGame(r); return; }
    }
  }
  function finishGame(r) {
    const g = r.game;
    if (!g) return;
    r.phase = 'finished';
    const res = g.state.result;
    broadcast(r, { type: 'result', result: res, players: g.state.players.map(p => ({ slot: p.slot, name: p.name, animal: p.animal, kind: p.kind, level: p.level, kills: p.kills, alive: p.alive })) });
    r.game = null;
    pushRoom(r);
  }

  /* ---------- 訊息分派 ---------- */
  function handle(key, msg) {
    const p = persons.get(key);
    if (!p || !msg || typeof msg !== 'object') return;
    const r = p.roomId ? rooms.get(p.roomId) : null;
    const seat = r ? seatOf(r, key) : -1;
    const isHost = r && seat >= 0 && seat === r.hostSeat;

    switch (msg.type) {
      case 'input': {
        if (!r || !r.game || seat < 0) return;
        const slot = r.game.slotOf.get(key);
        if (slot == null) return;
        r.game.inputs[slot].dir = inList(msg.dir, ['U', 'D', 'L', 'R']) ? msg.dir : null;
        return;
      }
      case 'bomb': {
        if (!r || !r.game || seat < 0) return;
        const slot = r.game.slotOf.get(key);
        if (slot != null) r.game.inputs[slot].bomb = true;
        return;
      }
      case 'ping': emit(key, { type: 'pong', t: msg.t }); return;
      case 'profile': {
        p.name = cleanName(msg.name, p.name);
        if (inList(msg.animal, ANIMALS)) p.animal = msg.animal;
        if (r && seat >= 0 && r.phase === 'lobby') {
          r.seats[seat].name = p.name;
          r.seats[seat].animal = freeAnimal(r, msg.animal || p.animal, seat);
          pushRoom(r);
        }
        return;
      }
      case 'lobbySub': p.sub = !r; emit(key, { type: 'rooms', rooms: listRooms() }); return;
      case 'create': {
        if (r) leaveRoom(key);
        p.name = cleanName(msg.name, p.name || randomName());
        if (inList(msg.animal, ANIMALS)) p.animal = msg.animal;
        const max = Math.max(2, Math.min(8, parseInt(msg.max, 10) || 4));
        const nr = newRoom(p, msg.roomName, max);
        sit(nr, p, 0); nr.hostSeat = 0;
        emit(key, { type: 'joined', room: nr.id, role: 'player', note: '' });
        sys(nr, p.name + ' 建立了房間');
        pushRoom(nr);
        return;
      }
      case 'quick': {
        if (r) leaveRoom(key);
        p.name = cleanName(msg.name, p.name || randomName());
        if (inList(msg.animal, ANIMALS)) p.animal = msg.animal;
        const open = Array.from(rooms.values()).filter(x => x.phase === 'lobby' && filled(x).length < x.maxPlayers && !x.banned.has(key))
          .sort((a, b) => humanSeats(b).length - humanSeats(a).length || a.createdAt - b.createdAt);
        if (open.length) joinRoom(p, open[0], 'player', null);
        else {
          const nr = newRoom(p, null, 4);
          sit(nr, p, 0); nr.hostSeat = 0;
          emit(key, { type: 'joined', room: nr.id, role: 'player', note: '目前沒有可加入的房間，幫你開了一間' });
          sys(nr, p.name + ' 建立了房間');
          pushRoom(nr);
        }
        return;
      }
      case 'inviteInfo': {
        const c = checkInvite(msg.room, msg.token);
        if (!c.ok) { emit(key, { type: 'inviteInfo', ok: false, reason: c.reason }); return; }
        const rr = c.room;
        emit(key, {
          type: 'inviteInfo', ok: true, room: rr.id, name: rr.name, role: c.inv.role, phase: rr.phase,
          players: filled(rr).length, max: rr.maxPlayers, full: filled(rr).length >= rr.maxPlayers,
          willSpectate: c.inv.role === 'spectator' || rr.phase !== 'lobby' || filled(rr).length >= rr.maxPlayers
        });
        return;
      }
      case 'join': {
        const id = String(msg.room || '').toUpperCase();
        let want = msg.as === 'spectator' ? 'spectator' : 'player';
        let rr = rooms.get(id);
        if (msg.token != null && msg.token !== '') {
          const c = checkInvite(id, msg.token);
          if (!c.ok) { emit(key, { type: 'joinFailed', reason: c.reason }); return; }
          rr = c.room; want = c.inv.role;      /* 角色由邀請 token 決定，改暱稱改不了權限 */
        }
        if (!rr) { emit(key, { type: 'joinFailed', reason: closed.has(id) ? 'closed' : 'invalid' }); return; }
        joinRoom(p, rr, want, { name: msg.name, animal: msg.animal });
        return;
      }
    }

    if (!r) return;
    switch (msg.type) {
      case 'leave': leaveRoom(key); return;
      case 'chat': {
        const text = cleanText(msg.text);
        if (!text || now() - p.chatAt < 450) return;
        p.chatAt = now();
        const m = { pid: p.pid, name: p.name, text, role: seat >= 0 ? 'player' : 'spectator', t: now() };
        r.chat.push(m); if (r.chat.length > 50) r.chat.shift();
        broadcast(r, { type: 'chat', m });
        return;
      }
      case 'ready': {
        if (seat < 0 || r.phase !== 'lobby' || isHost) return;
        r.seats[seat].ready = !!msg.value;
        pushRoom(r); return;
      }
      case 'sit': {
        if (seat >= 0 || r.phase !== 'lobby') return;
        const i = r.seats.findIndex(s => s.kind === 'empty');
        if (i < 0) { err(key, 'full', '席位已滿'); return; }
        r.spectators.splice(r.spectators.indexOf(key), 1);
        sit(r, p, i);
        sys(r, p.name + ' 加入對戰');
        pushRoom(r); return;
      }
      case 'watch': {
        if (seat < 0 || r.phase !== 'lobby' || isHost) return;
        if (r.spectators.length >= SPEC_CAP) { err(key, 'spec_full', '觀戰席已滿'); return; }
        r.seats[seat] = { kind: 'empty' };
        r.spectators.push(key);
        sys(r, p.name + ' 改為觀戰');
        pushRoom(r); return;
      }
      case 'invite': {
        if (!isHost) return;
        const role = msg.role === 'spectator' ? 'spectator' : 'player';
        const t = token();
        r.invites.set(t, { role, created: now(), revoked: false });
        emit(key, { type: 'invite', room: r.id, token: t, role });
        pushRoom(r); return;
      }
      case 'revoke': {
        if (!isHost) return;
        for (const v of r.invites.values()) v.revoked = true;
        sys(r, '房主撤銷了所有邀請連結');
        pushRoom(r); return;
      }
      case 'settings': {
        if (!isHost || r.phase !== 'lobby') return;
        const patch = msg.patch || {};
        const st = r.settings;
        if (patch.max != null) {
          const m = Math.max(2, Math.min(8, parseInt(patch.max, 10) || r.maxPlayers));
          const occ = r.seats.filter(s => s.kind !== 'empty');
          if (m < occ.length) { err(key, 'max', '目前已有 ' + occ.length + ' 個席位有人，人數上限不能再低了'); return; }
          if (m !== r.maxPlayers) {
            const hostObj = r.seats[r.hostSeat];
            const keep = occ.slice();
            r.seats = keep.concat(new Array(m - keep.length).fill(0).map(() => ({ kind: 'empty' })));
            r.hostSeat = keep.indexOf(hostObj);
            r.maxPlayers = m;
          }
        }
        if (patch.timeLimit != null && inList(patch.timeLimit, TIME_LIMITS)) st.timeLimit = patch.timeLimit;
        if (patch.layout != null && inList(patch.layout, LAYOUTS)) st.layout = patch.layout;
        if (patch.theme != null && patch.theme >= -1 && patch.theme < Rules.THEME_COUNT) st.theme = patch.theme | 0;
        if (patch.items != null) st.items = !!patch.items;
        if (patch.curses != null) st.curses = !!patch.curses;
        if (patch.name != null) r.name = cleanName(patch.name, r.name);
        for (const s of r.seats) if (s.kind === 'human') s.ready = false;
        pushRoom(r); return;
      }
      case 'addai': {
        if (!isHost || r.phase !== 'lobby') return;
        const i = r.seats.findIndex(s => s.kind === 'empty');
        if (i < 0) { err(key, 'full', '席位已滿'); return; }
        const level = inList(msg.level, AI_LEVELS) ? msg.level : 'normal';
        const animal = freeAnimal(r, null, i);
        r.seats[i] = { kind: 'ai', name: ANIMAL_NAMES[animal], animal, level, ready: true };
        pushRoom(r); return;
      }
      case 'aiLevel': {
        if (!isHost || r.phase !== 'lobby') return;
        const s = r.seats[msg.seat | 0];
        if (s && s.kind === 'ai' && inList(msg.level, AI_LEVELS)) { s.level = msg.level; pushRoom(r); }
        return;
      }
      case 'removeai': {
        if (!isHost || r.phase !== 'lobby') return;
        const s = r.seats[msg.seat | 0];
        if (s && s.kind === 'ai') { r.seats[msg.seat | 0] = { kind: 'empty' }; pushRoom(r); }
        return;
      }
      case 'kick': {
        if (!isHost) return;
        let target = null;
        if (msg.pid != null) target = byPid.get(msg.pid | 0);
        else if (msg.seat != null && r.seats[msg.seat | 0] && r.seats[msg.seat | 0].kind === 'human') target = persons.get(r.seats[msg.seat | 0].key);
        if (!target || target.key === key || target.roomId !== r.id) return;
        r.banned.add(target.key);
        emit(target.key, { type: 'kicked', text: '你被房主請出房間了' });
        leaveRoom(target.key, 'kicked');
        return;
      }
      case 'start': {
        if (!isHost || r.phase !== 'lobby') return;
        if (filled(r).length < 2) { err(key, 'few', '至少要有 2 位玩家（可以加電腦）'); return; }
        const wait = humanSeats(r).filter((s, _i) => r.seats.indexOf(s) !== r.hostSeat && !s.ready);
        if (wait.length) { err(key, 'notready', '還有 ' + wait.length + ' 位玩家沒按「準備好」'); return; }
        startGame(r); return;
      }
      case 'rematch': {
        if (!isHost || r.phase !== 'finished') return;
        r.phase = 'lobby';
        for (const s of r.seats) if (s.kind === 'human') s.ready = false;
        sys(r, '回到房間，準備下一局');
        pushRoom(r); return;
      }
    }
  }

  /* ---------- 週期工作 ---------- */
  function tick() {
    const t = now();
    for (const r of Array.from(rooms.values())) {
      if (r.game) stepRoom(r, t);
    }
    for (const p of Array.from(persons.values())) {
      if (!p.connected && p.dcAt && t - p.dcAt > GRACE_MS) {
        if (p.roomId) leaveRoom(p.key, 'timeout');
        persons.delete(p.key); byPid.delete(p.pid);
      }
    }
    for (const [id, c] of closed) if (t - c.at > CLOSED_KEEP_MS) closed.delete(id);
    if (lobbyDirty) {
      lobbyDirty = false;
      const list = listRooms();
      for (const p of persons.values()) if (p.sub && p.connected && !p.roomId) emit(p.key, { type: 'rooms', rooms: list });
      onRoomsChanged(list);
    }
  }

  return {
    connect, disconnect, handle, tick, listRooms, roomView,
    stats() {
      let players = 0;
      for (const p of persons.values()) if (p.connected) players++;
      return { players, rooms: rooms.size };
    },
    /* 測試用 */ _rooms: rooms, _persons: persons, _closed: closed, GRACE_MS, SPEC_CAP
  };
}

module.exports = { createHub, cleanName, cleanText, ANIMALS, ANIMAL_NAMES };
