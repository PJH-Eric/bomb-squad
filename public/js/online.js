/* ===== online.js — 線上大廳、房間、邀請連結，以及把伺服器訊息接到畫面上 =====
 * 伺服器位置一律從 Config / Net 取得，這裡不寫任何網址。
 */
(function (root) {
  'use strict';
  const { h, btn, seg, stepper, toggle, avatar, toast, modal } = root.UI;
  const Art = root.Art, AI = root.AI, Net = root.Net;
  const App = root.App;
  const U = App.util;

  const REASONS = {
    invalid: '這個邀請連結無效，請向房主要一條新的。',
    revoked: '房主已經撤銷這個邀請連結。',
    expired: '這個邀請連結已經過期。',
    closed: '這個房間已經結束了。',
    banned: '你已被請出這個房間。',
    spec_full: '觀戰席已經滿了。'
  };
  const PHASE = { lobby: '等待中', playing: '對戰中', finished: '已結束' };
  const FOCUS_SEL = 'button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';

  App.aiAddLevel = App.aiAddLevel || 'normal';
  App.chatReset = new Set();
  App.netStatus = 'idle';
  App.lobbyUI = null;
  App.roomUI = null;
  App.inviteModal = null;

  /* ---------- 小工具 ---------- */
  const profile = () => ({ name: U.myName(), animal: App.store.animal });
  const online = () => Net.connected;
  function repaint(box, build) {
    const act = document.activeElement;
    let idx = -1;
    if (act && box.contains(act)) idx = Array.from(box.querySelectorAll(FOCUS_SEL)).indexOf(act);
    box.textContent = '';
    build(box);
    if (idx >= 0) { const f = box.querySelectorAll(FOCUS_SEL)[idx]; if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ } }
  }
  function field(label, ctl) { return h('div', { class: 'field' }, h('span', { class: 'label' }, label), h('div', { class: 'ctl' }, ctl)); }
  function inviteLink(tok) {
    const u = new URL(location.href);
    u.search = ''; u.hash = '';
    const p = new URLSearchParams();
    p.set('room', App.room.id); p.set('invite', tok);
    if (root.Config && root.Config.source === 'query' && root.Config.serverUrl) p.set('server', root.Config.serverUrl);
    return u.toString() + '?' + p.toString();
  }
  /** 只拿掉邀請參數；?server= 要留著，不然重新整理就連不到同一台伺服器 */
  function clearInviteUrl() {
    try {
      const u = new URL(location.href);
      if (!u.searchParams.has('room') && !u.searchParams.has('invite')) return;
      u.searchParams.delete('room'); u.searchParams.delete('invite');
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    } catch (e) { /* 忽略 */ }
  }
  function statusInfo() {
    const s = App.netStatus, C = root.Config || {};
    if (C.status === 'invalid') return { cls: 'bad', text: '伺服器設定有誤' };
    if (s === 'unset' || C.status === 'unset') return { cls: 'bad', text: '尚未設定伺服器' };
    if (s === 'open') return { cls: '', text: '已連線' };
    if (s === 'waking') return { cls: 'warn', text: '伺服器睡醒中…' };
    if (s === 'offline') return { cls: 'bad', text: '連不上伺服器' };
    if (s === 'retrying') return { cls: 'warn', text: '重新連線中…' };
    if (s === 'idle') return { cls: 'bad', text: '未連線' };
    return { cls: 'warn', text: '連線中…' };
  }
  function statusPill() {
    const si = statusInfo();
    return h('span', { class: 'status ' + si.cls, role: 'status' }, h('i'), si.text);
  }

  /* ================= 大廳 ================= */
  App.screens.lobby = function () {
    App.onlineGame = false;
    const ui = App.lobbyUI = {};
    const C = root.Config || {};

    ui.statusBox = h('span', { class: 'lobby-status' });
    ui.inviteBox = h('div');
    ui.noticeBox = h('div');
    ui.profileBox = h('div');
    ui.actionBox = h('div');
    ui.listBox = h('div', { class: 'room-list', 'aria-live': 'polite' });

    ui.paintStatus = () => { ui.statusBox.textContent = ''; ui.statusBox.appendChild(statusPill()); ui.paintActions(); };
    ui.paintNotice = () => {
      ui.noticeBox.textContent = '';
      if (App.lobbyNotice) {
        ui.noticeBox.appendChild(h('div', { class: 'card notice' }, h('p', null, App.lobbyNotice),
          h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '8px' } }, btn('知道了', { cls: 'btn-mint btn-sm', onClick: () => { App.lobbyNotice = ''; ui.paintNotice(); } }))));
      }
    };
    ui.paintProfile = () => repaint(ui.profileBox, box => {
      box.appendChild(h('div', { class: 'row', style: { alignItems: 'center', gap: '12px' } },
        avatar(App.store.animal, 52),
        h('div', { class: 'grow' }, h('b', null, U.myName()), h('div', { class: 'muted small' }, '你在線上的暱稱與角色')),
        btn('修改', { cls: 'btn-sky btn-sm', onClick: () => editProfile() })));
    });
    ui.paintActions = () => repaint(ui.actionBox, box => {
      const ok = online();
      box.appendChild(h('div', { class: 'row', style: { gap: '10px' } },
        btn('快速加入', { cls: 'btn-pink btn-lg grow', icon: 'play', iconSize: 24, disabled: !ok, onClick: () => Net.send(Object.assign({ type: 'quick' }, profile())) }),
        btn('建立房間', { cls: 'btn-sun btn-lg grow', icon: 'plus', iconSize: 24, disabled: !ok, onClick: () => createRoomModal() })));
    });
    ui.paintList = () => repaint(ui.listBox, box => {
      const list = App.rooms || [];
      if (!online()) { box.appendChild(h('div', { class: 'empty-box' }, C.status === 'ok' ? '連線後會顯示目前的房間。' : '沒有設定線上伺服器，這個版本只能玩單機。')); return; }
      if (!list.length) { box.appendChild(h('div', { class: 'empty-box' }, '現在沒有房間。按「快速加入」或「建立房間」開第一間吧！')); return; }
      for (const r of list) {
        const sets = r.settings || {};
        box.appendChild(h('div', { class: 'room-item' },
          h('div', { class: 'info' },
            h('div', { class: 'name' }, r.name),
            h('div', { class: 'chips', style: { marginTop: '4px' } },
              h('span', { class: 'pill gray' }, '代號 ' + r.id),
              h('span', { class: 'pill ' + (r.phase === 'lobby' ? 'mint' : 'pink') }, PHASE[r.phase] || r.phase),
              h('span', { class: 'pill' }, r.players + '/' + r.max + ' 人'),
              r.spectators ? h('span', { class: 'pill gray' }, '觀戰 ' + r.spectators) : null,
              h('span', { class: 'pill gray' }, '房主 ' + r.host),
              h('span', { class: 'pill gray' }, sets.timeLimit ? (sets.timeLimit / 60) + ' 分鐘' : '不限時'))),
          h('div', { class: 'row', style: { gap: '8px' } },
            r.joinable ? btn('加入', { cls: 'btn-mint btn-sm', onClick: () => joinRoom(r.id, 'player') }) : null,
            btn('觀戰', { cls: 'btn-sky btn-sm', icon: 'eye', iconSize: 18, onClick: () => joinRoom(r.id, 'spectator') }))));
      }
    });
    ui.paintInvite = () => {
      const inv = App.invite;
      ui.inviteBox.textContent = '';
      if (!inv) return;
      const card = h('section', { class: 'invite-card', 'aria-label': '邀請' });
      const drop = () => { App.invite = null; clearInviteUrl(); ui.paintInvite(); };
      if (inv.error) {
        card.append(h('h3', null, '這個邀請不能用'), h('p', null, REASONS[inv.error] || '邀請連結無法使用。'),
          h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '10px' } }, btn('回到大廳', { cls: 'btn-mint', onClick: drop })));
      } else if (!inv.info) {
        card.append(h('h3', null, '正在確認邀請…'), h('p', { class: 'muted' }, online() ? '稍等一下，正在向伺服器確認房間。' : '等待連上伺服器…（免費主機睡著時要 30～60 秒）'),
          h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '10px' } }, btn('不加入', { cls: 'btn-ghost btn-sm', onClick: drop })));
      } else {
        const i = inv.info;
        const spec = i.willSpectate;
        let why = '';
        if (spec && i.role !== 'spectator') why = i.phase !== 'lobby' ? '（對局已經開始）' : '（席位已滿）';
        const prof = App.profileEditor({});
        card.append(
          h('h3', null, '你被邀請加入「' + i.name + '」'),
          h('div', { class: 'chips', style: { margin: '6px 0 10px' } },
            h('span', { class: 'pill gray' }, '代號 ' + i.room), h('span', { class: 'pill' }, i.players + '/' + i.max + ' 人'),
            h('span', { class: 'pill ' + (spec ? 'sun' : 'mint') }, spec ? '以觀戰者加入' + why : '以玩家加入')),
          h('p', { class: 'muted small', style: { marginBottom: '8px' } }, '確認暱稱後才會進房間。' + (spec ? '觀戰者看得到整場比賽，也能聊天。' : '')),
          prof.el,
          h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '10px', marginTop: '10px' } },
            btn('不加入', { cls: 'btn-ghost', onClick: drop }),
            btn(spec ? '進去觀戰' : '加入遊戲', { cls: 'btn-pink', disabled: !online() || inv.joining, onClick: () => {
              inv.joining = true;
              Net.send({ type: 'join', room: i.room, token: inv.token, name: U.myName(), animal: App.store.animal });
              ui.paintInvite();
            } })));
      }
      ui.inviteBox.appendChild(card);
    };

    const unsetNote = (C.status !== 'ok')
      ? h('section', { class: 'card' }, h('h3', null, '還沒設定線上伺服器'),
        h('p', { class: 'muted' }, C.status === 'invalid' ? C.error : '這個網頁沒有設定 server URL。部署時請把 GAME_SERVER_URL 設成後端的 https 網址（詳見 README），現在只能玩單機。'),
        h('div', { class: 'row', style: { marginTop: '8px' } }, btn('改玩單機', { cls: 'btn-pink', onClick: () => App.go('solo') })))
      : null;

    const el = U.screenBox('', h('div', { class: 'wrap' },
      U.topbar('線上大廳', () => App.go('home'), ui.statusBox),
      unsetNote, ui.noticeBox, ui.inviteBox,
      h('div', { class: 'room-grid' },
        h('div', { style: { display: 'grid', gap: '14px' } },
          h('section', { class: 'card' }, h('h3', null, '我'), ui.profileBox),
          h('section', { class: 'card' }, h('h3', null, '開始'), ui.actionBox)),
        h('section', { class: 'card' }, h('h3', null, '房間列表', h('span', { class: 'pill gray', style: { marginLeft: '8px' } }, '可以加入或觀戰')), ui.listBox))));
    ui.paintStatus(); ui.paintNotice(); ui.paintProfile(); ui.paintList(); ui.paintInvite();
    Net.open(profile());
    if (App.invite && !App.invite.info && !App.invite.error && online()) askInvite();
    return el;
  };

  function askInvite() {
    const inv = App.invite;
    if (inv && !inv.info && !inv.error) Net.send({ type: 'inviteInfo', room: inv.room, token: inv.token });
  }
  function joinRoom(id, as) { Net.send({ type: 'join', room: id, as, name: U.myName(), animal: App.store.animal }); }

  function editProfile() {
    const prof = App.profileEditor({});
    const m = modal({ title: '我的暱稱與角色', content: prof.el, cls: 'dialog-lg',
      actions: [btn('完成', { cls: 'btn-mint', onClick: () => m.close() })],
      onClose: () => { Net.setProfile(profile()); Net.send(Object.assign({ type: 'profile' }, profile())); if (App.lobbyUI && App.screen === 'lobby') App.lobbyUI.paintProfile(); } });
  }

  function createRoomModal() {
    let max = 4;
    const nameIn = h('input', { class: 'text-input', type: 'text', maxlength: 10, placeholder: U.myName() + '的房間', 'aria-label': '房間名稱', autocomplete: 'off', 'data-autofocus': '1' });
    const st = stepper({ label: '人數上限', min: 2, max: 8, value: max, fmt: v => v + ' 人', onChange: v => { max = v; } });
    const m = modal({ title: '建立房間', cls: 'dialog-sm',
      content: h('div', null, field('房間名稱', nameIn), field('人數上限', st),
        h('p', { class: 'muted small' }, '建立後可以加電腦、調整地圖與時間，再用邀請連結叫朋友來。')),
      actions: [btn('取消', { cls: 'btn-ghost', onClick: () => m.close() }),
        btn('建立', { cls: 'btn-pink', onClick: () => { m.close(true); Net.send(Object.assign({ type: 'create', roomName: nameIn.value.trim(), max }, profile())); } })] });
  }

  /* ================= 房間 ================= */
  App.screens.room = function () {
    App.onlineGame = false;
    const ui = App.roomUI = {};
    ui.titleEl = h('h2', null, '房間');
    ui.codeEl = h('span', { class: 'room-meta' });
    ui.seatsBox = h('div', { class: 'seats' });
    ui.specBox = h('div');
    ui.actBox = h('div');
    ui.setBox = h('div');
    ui.chat = root.createChat({ send: t => Net.send({ type: 'chat', text: t }) });
    ui.chat.set(App.chatLog || []);
    const push = m => { if (!ui.chat.el.isConnected) { App.chatSubs.delete(push); App.chatReset.delete(reset); return; } ui.chat.push(m); };
    const reset = list => { if (ui.chat.el.isConnected) ui.chat.set(list); };
    App.chatSubs.add(push); App.chatReset.add(reset);

    ui.paint = () => {
      const r = App.room;
      if (!r) {
        ui.titleEl.textContent = '進入房間中…';
        ui.seatsBox.textContent = ''; ui.seatsBox.appendChild(h('div', { class: 'empty-box' }, '正在同步房間資料…'));
        ui.actBox.textContent = ''; ui.setBox.textContent = ''; ui.specBox.textContent = '';
        return;
      }
      ui.titleEl.textContent = r.name;
      ui.codeEl.textContent = '';
      ui.codeEl.append(h('span', { class: 'pill gray' }, '代號 ' + r.id), ' ', h('span', { class: 'pill ' + (r.phase === 'lobby' ? 'mint' : 'pink') }, PHASE[r.phase] || r.phase));
      repaint(ui.seatsBox, paintSeats);
      repaint(ui.specBox, paintSpectators);
      repaint(ui.actBox, paintActions);
      repaint(ui.setBox, paintSettings);
    };

    const el = U.screenBox('', h('div', { class: 'wrap' },
      h('div', { class: 'topbar' }, root.UI.iconBtn('back', '離開房間', () => App.confirmLeave()),
        h('div', { class: 'room-head' }, ui.titleEl, ui.codeEl)),
      h('div', { class: 'room-grid' },
        h('div', { style: { display: 'grid', gap: '14px' } },
          h('section', { class: 'card' }, h('h3', null, '玩家席位'), ui.seatsBox),
          ui.specBox,
          h('section', { class: 'card' }, h('h3', null, '聊天室'), ui.chat.el)),
        h('div', { style: { display: 'grid', gap: '14px' } },
          h('section', { class: 'card' }, ui.actBox),
          h('section', { class: 'card' }, h('h3', null, '規則'), ui.setBox)))));
    ui.paint();
    Net.open(profile());
    return el;
  };

  function paintSeats(box) {
    const r = App.room, you = r.you, host = you.host, lobby = r.phase === 'lobby';
    for (const s of r.seats) {
      if (s.kind === 'empty') {
        box.appendChild(h('div', { class: 'seat empty' }, h('div', { class: 'seat-line' }, h('span', { class: 'seat-name' }, '空位'),
          host && lobby ? btn('加電腦', { cls: 'btn-sky btn-sm', icon: 'robot', iconSize: 18, onClick: () => Net.send({ type: 'addai', level: App.aiAddLevel }) }) : null)));
        continue;
      }
      const isAi = s.kind === 'ai', mine = s.i === you.seat;
      if (isAi) {
        /* 電腦席位：第一行頭像、名字、移除鈕；角色與難度兩個下拉各佔一半排在第二行，窄欄也不會擠出去 */
        const canEdit = host && lobby;
        box.appendChild(h('div', { class: 'seat ai' },
          h('div', { class: 'seat-line' }, avatar(s.animal, 38), h('span', { class: 'seat-name' }, s.name),
            canEdit ? root.UI.iconBtn('trash', '移除 ' + s.name, () => Net.send({ type: 'removeai', seat: s.i }), 'sm')
              : h('span', { class: 'pill gray' }, AI.LEVELS[s.level] ? AI.LEVELS[s.level].name : '電腦')),
          canEdit ? h('div', { class: 'seat-pick' },
            root.UI.dropdown({ label: s.name + ' 角色', cls: 'lvl sm', options: U.animalOptions(r.seats.filter(o => o.kind === 'human').map(o => o.animal)), value: s.animal, onChange: v => Net.send({ type: 'aiAnimal', seat: s.i, animal: v }) }),
            root.UI.dropdown({ label: s.name + ' 難度', cls: 'lvl sm', options: U.LEVEL_DD, value: s.level, onChange: v => Net.send({ type: 'aiLevel', seat: s.i, level: v }) })) : null));
        continue;
      }
      const tags = h('div', { class: 'seat-tags' });
      if (s.i === r.hostSeat) tags.appendChild(h('span', { class: 'pill sun' }, '房主'));
      if (mine) tags.appendChild(h('span', { class: 'pill' }, '你'));
      if (s.i !== r.hostSeat && lobby) tags.appendChild(h('span', { class: 'pill ' + (s.ready ? 'mint' : 'gray') }, s.ready ? '準備好了' : '未準備'));
      if (!s.connected) tags.appendChild(h('span', { class: 'pill pink' }, '斷線中'));
      const kick = host && !mine && lobby
        ? root.UI.iconBtn('kick', '請出 ' + s.name, () => root.UI.confirmBox({ title: '請出 ' + s.name + '？', text: '被請出的人無法再加入這個房間。', ok: '請出', danger: true, onOk: () => Net.send({ type: 'kick', seat: s.i }) }), 'sm')
        : null;
      box.appendChild(h('div', { class: 'seat' + (mine ? ' me' : '') },
        h('div', { class: 'seat-line' }, avatar(s.animal, 38), h('span', { class: 'seat-name' }, s.name), kick), tags));
    }
  }

  function paintSpectators(box) {
    const r = App.room;
    const list = r.spectators || [];
    const card = h('section', { class: 'card' }, h('h3', null, '觀戰席', h('span', { class: 'pill gray', style: { marginLeft: '8px' } }, list.length + '/' + r.specCap)));
    if (!list.length) card.appendChild(h('p', { class: 'muted small' }, '沒有人在觀戰。觀戰者可以看整場比賽並聊天，不佔玩家席位。'));
    else card.appendChild(h('div', { class: 'chips' }, list.map(s => h('span', { class: 'pill' + (s.pid === r.you.pid ? '' : ' gray') }, s.name + (s.pid === r.you.pid ? '（你）' : '')))));
    box.appendChild(card);
  }

  function paintActions(box) {
    const r = App.room, you = r.you, lobby = r.phase === 'lobby';
    const filled = r.seats.filter(s => s.kind !== 'empty').length;
    const free = filled < r.max;
    box.appendChild(h('h3', null, you.role === 'player' ? (you.host ? '你是房主' : '你是玩家') : '你是觀戰者'));
    const rows = h('div', { style: { display: 'grid', gap: '10px' } });
    if (r.phase === 'playing') {
      rows.appendChild(h('p', { class: 'muted' }, '對局進行中…'));
    } else if (r.phase === 'finished') {
      rows.appendChild(h('p', { class: 'muted' }, you.host ? '這局結束了，準備好就再來一局。' : '這局結束了，等房主開下一局。'));
      if (you.host) rows.appendChild(btn('再來一局', { cls: 'btn-pink btn-lg btn-block', icon: 'play', iconSize: 24, onClick: () => Net.send({ type: 'rematch' }) }));
    } else if (you.role === 'player' && you.host) {
      const why = filled < 2 ? '至少要 2 位玩家，可以加電腦。' : (!r.canStart ? '還有玩家沒按「準備好」。' : '');
      rows.appendChild(btn('開始遊戲', { cls: 'btn-pink btn-lg btn-block', icon: 'play', iconSize: 24, disabled: !r.canStart, onClick: () => Net.send({ type: 'start' }) }));
      if (why) rows.appendChild(h('p', { class: 'muted small' }, why));
    } else if (you.role === 'player') {
      const me = r.seats[you.seat];
      rows.appendChild(btn(me.ready ? '取消準備' : '我準備好了', { cls: me.ready ? 'btn-ghost btn-lg btn-block' : 'btn-mint btn-lg btn-block', icon: 'check', iconSize: 24, onClick: () => Net.send({ type: 'ready', value: !me.ready }) }));
      rows.appendChild(btn('改為觀戰', { cls: 'btn-ghost btn-block', icon: 'eye', iconSize: 20, onClick: () => Net.send({ type: 'watch' }) }));
    } else {
      rows.appendChild(btn(free ? '加入對戰' : '席位已滿', { cls: 'btn-mint btn-lg btn-block', icon: 'play', iconSize: 24, disabled: !free || !lobby, onClick: () => Net.send({ type: 'sit' }) }));
      if (!lobby) rows.appendChild(h('p', { class: 'muted small' }, '對局開始後無法換成玩家。'));
    }
    if (you.host && r.phase !== 'playing') rows.appendChild(btn('邀請朋友', { cls: 'btn-sky btn-block', icon: 'link', iconSize: 20, onClick: () => openInviteModal() }));
    rows.appendChild(btn('離開房間', { cls: 'btn-ghost btn-block', onClick: () => App.confirmLeave() }));
    box.appendChild(rows);
  }

  function paintSettings(box) {
    const r = App.room, s = r.settings, host = r.you.host && r.phase === 'lobby';
    const send = patch => Net.send({ type: 'settings', patch });
    const filled = r.seats.filter(x => x.kind !== 'empty').length;
    if (host) {
      box.append(
        field('人數', stepper({ label: '人數上限', min: Math.max(2, filled), max: 8, value: r.max, fmt: v => v + ' 人', onChange: v => send({ max: v }) })),
        U.rulesPanel(s, send));
    } else {
      box.appendChild(h('div', { class: 'chips rules-sum' }, [r.max + ' 人'].concat(U.rulesSummary(s)).map(t => h('span', { class: 'pill gray' }, t))));
      if (!r.you.host) box.appendChild(h('p', { class: 'muted small', style: { marginTop: '8px' } }, '只有房主可以調整設定。'));
    }
  }

  /* ---------- 邀請連結（房主） ---------- */
  function openInviteModal() {
    if (App.inviteModal && !App.inviteModal.closed) return;
    let role = 'player';
    const list = h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: '8px', marginTop: '10px' } });
    const paint = () => repaint(list, box => {
      const invs = (App.room && App.room.invites) || [];
      if (!invs.length) { box.appendChild(h('p', { class: 'muted small' }, '還沒有有效的邀請連結。選好身分後按「產生連結」。')); return; }
      for (const iv of invs) {
        const url = inviteLink(iv.token);
        box.appendChild(h('div', null,
          h('div', { class: 'small', style: { fontWeight: '800', marginBottom: '4px' } }, iv.role === 'spectator' ? '觀戰連結' : '玩家連結'),
          h('div', { class: 'link-box' }, h('code', null, url),
            btn('複製', { cls: 'btn-sky btn-sm', icon: 'copy', iconSize: 16, onClick: () => { const p = root.UI.copyText(url); Promise.resolve(p).then(ok => toast(ok ? '已複製連結' : '複製失敗，請長按連結手動複製')); } }),
            navigator.share ? btn('分享', { cls: 'btn-mint btn-sm', onClick: () => { navigator.share({ title: '炸彈小隊', text: '一起來玩炸彈小隊！', url }).catch(() => {}); } }) : null)));
      }
    });
    const m = modal({ title: '邀請朋友', cls: 'dialog-lg',
      content: h('div', null,
        h('p', { class: 'muted small' }, '連結只對這個房間有效，房間關閉、被撤銷或 24 小時後就失效。朋友打開後要先確認暱稱才會進房。'),
        field('對方身分', seg({ label: '對方身分', options: [{ v: 'player', label: '玩家' }, { v: 'spectator', label: '觀戰者' }], value: role, onChange: v => { role = v; } })),
        btn('產生連結', { cls: 'btn-pink', icon: 'link', iconSize: 20, onClick: () => Net.send({ type: 'invite', role }) }),
        list),
      actions: [btn('撤銷全部連結', { cls: 'btn-ghost', onClick: () => root.UI.confirmBox({ title: '撤銷所有邀請連結？', text: '之前發出去的連結都會失效。', ok: '撤銷', danger: true, onOk: () => Net.send({ type: 'revoke' }) }) }),
        btn('完成', { cls: 'btn-mint', onClick: () => m.close() })],
      onClose: () => { App.inviteModal = null; } });
    m.refresh = paint;
    App.inviteModal = m;
    paint();
  }

  /* ================= 伺服器訊息 ================= */
  function leaveToLobby() {
    root.UI.closeAllModals();
    App.room = null; App.onlineGame = false; App.chatLog = []; App.mySlot = null;
    if (App.screen === 'room' || App.screen === 'game') App.go('lobby');
  }

  function init() {
    Net.onStatus((s, detail) => {
      App.netStatus = s;
      const inOnline = App.screen === 'lobby' || App.screen === 'room' || (App.screen === 'game' && App.onlineGame);
      if (!inOnline) { App.banner(''); return; }
      if (s === 'waking') App.banner('伺服器正在睡醒，約需 30～60 秒…（已等 ' + (detail || 0) + ' 秒）', true);
      else if (s === 'connecting') App.banner('連線中…', true);
      else if (s === 'retrying') App.banner('連線中斷，正在重新連線…', true);
      else if (s === 'offline') App.banner('連不上伺服器，稍後自動重試', true);
      else App.banner('');
      if (App.lobbyUI && App.screen === 'lobby') { App.lobbyUI.paintStatus(); App.lobbyUI.paintList(); App.lobbyUI.paintInvite(); }
      if (s === 'open') askInvite();
    });

    Net.on('welcome', m => {
      App.me = { pid: m.pid, name: m.name, animal: m.animal };
      App.room = m.room || null;
      /* 斷線太久（或伺服器重啟）回來時房間已經沒了：關閉通知是在離線時送的，收不到，這裡補上 */
      if (!m.room && (App.screen === 'room' || (App.screen === 'game' && App.onlineGame))) {
        App.lobbyNotice = '房間已經結束了'; toast(App.lobbyNotice, 4200); leaveToLobby(); return;
      }
      if (m.room && App.screen === 'lobby' && m.room.phase !== 'playing') App.go('room');
      else if (m.room && App.screen === 'room') App.roomUI && App.roomUI.paint();
      askInvite();
    });
    Net.on('rooms', m => {
      App.rooms = m.rooms || [];
      if (App.lobbyUI && App.screen === 'lobby') App.lobbyUI.paintList();
    });
    Net.on('room', m => {
      App.room = m.room || null;
      if (!App.room) { if (App.screen === 'room' || (App.screen === 'game' && App.onlineGame)) leaveToLobby(); return; }
      if (App.screen === 'room') App.roomUI && App.roomUI.paint();
      else if (App.screen === 'lobby' && App.room.phase !== 'playing') App.go('room');
      if (App.inviteModal && !App.inviteModal.closed) App.inviteModal.refresh();
    });
    Net.on('joined', m => {
      App.invite = null; clearInviteUrl();
      if (m.note) toast(m.note, 4000);
      if (App.screen !== 'game') App.go('room');
    });
    Net.on('joinFailed', m => {
      if (App.invite && App.invite.joining) { App.invite.joining = false; App.invite.error = m.reason; }
      else toast(REASONS[m.reason] || '無法加入這個房間', 3600);
      if (App.lobbyUI && App.screen === 'lobby') App.lobbyUI.paintInvite();
    });
    Net.on('inviteInfo', m => {
      if (!App.invite) return;
      if (m.ok) App.invite.info = m; else App.invite.error = m.reason;
      if (App.lobbyUI && App.screen === 'lobby') App.lobbyUI.paintInvite();
    });
    Net.on('invite', () => { if (App.inviteModal && !App.inviteModal.closed) App.inviteModal.refresh(); });
    Net.on('chatlog', m => {
      App.chatLog = (m.msgs || []).slice();
      App.chatReset.forEach(fn => fn(App.chatLog));
    });
    Net.on('chat', m => {
      App.chatLog.push(m.m);
      if (App.chatLog.length > 80) App.chatLog.shift();
      App.chatSubs.forEach(fn => fn(m.m));
    });
    Net.on('closed', m => {
      App.lobbyNotice = m.text || '房間已經關閉了';
      toast(App.lobbyNotice, 4200);
      if (App.screen === 'lobby' && App.lobbyUI) App.lobbyUI.paintNotice();
    });
    Net.on('kicked', m => { toast(m.text || '你被請出房間了', 4200); App.lobbyNotice = m.text || '你被房主請出房間了'; });
    Net.on('error', m => toast(m.text || '發生錯誤', 3600));
    Net.on('start', m => {
      root.UI.closeAllModals();
      App.onlineGame = true; App.mySlot = m.slot;
      App.go('game', { kind: 'online', info: m.game, slot: m.slot });
    });
    Net.on('snap', m => { if (App.game && App.onlineGame && App.game.onSnap) App.game.onSnap(m.s); });
    Net.on('result', m => {
      if (!App.onlineGame) return;
      if (App.resultModal && !App.resultModal.closed) return;
      App.showResult({ result: m.result, players: m.players, slot: App.mySlot == null ? null : App.mySlot, kind: 'online' });
    });
    Net.on('replaced', () => {
      toast('這個帳號在別處開啟了，這裡已中斷', 5000);
      App.banner('已在其他視窗開啟，這個視窗不再連線');
    });
  }

  root.OnlineGlue = { init };
})(typeof self !== 'undefined' ? self : this);
