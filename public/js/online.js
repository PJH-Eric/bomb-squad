/* ===== online.js — 線上大廳、房間、邀請連結，以及把伺服器訊息接到畫面上 =====
 * 伺服器位置一律從 Config / Net 取得，這裡不寫任何網址。
 */
(function (root) {
  'use strict';
  const { h, btn, seg, stepper, toggle, avatar, toast, modal } = root.UI;
  const Art = root.Art, AI = root.AI, Net = root.Net;
  const App = root.App;
  const U = App.util;

  const tr = (k, p, f) => root.I18N.t(k, p, f);
  /** 邀請連結失敗原因（伺服器回代碼）；沒有對應代碼就用通用說明 */
  const reasonText = code => tr('online.reason.' + code, null, null) || tr('invite.badText');
  const phaseText = ph => tr('online.phase.' + ph, null, null) || ph;
  /** 伺服器訊息：有代碼就依目前語言翻譯（prefix + code），沒有就用伺服器附的文字 */
  function srv(prefix, code, args, fallback) {
    if (code) { const s = tr(prefix + code, args || null, null); if (s != null) return s; }
    return fallback;
  }
  /** config.js 的錯誤訊息（設定錯誤）依錯誤型態翻譯 */
  function cfgError(C) {
    const e = String(C.error || '');
    return /https/.test(e) && /http/.test(e) && /混合|mixed/i.test(e) ? tr('cfg.err.mixed') : tr('cfg.err.badUrl');
  }
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
    if (C.status === 'invalid') return { cls: 'bad', text: tr('net.badConfig') };
    if (s === 'unset' || C.status === 'unset') return { cls: 'bad', text: tr('net.unset') };
    if (s === 'open') return { cls: '', text: tr('net.open') };
    if (s === 'waking') return { cls: 'warn', text: tr('net.waking') };
    if (s === 'offline') return { cls: 'bad', text: tr('net.offline') };
    if (s === 'retrying') return { cls: 'warn', text: tr('net.retrying') };
    if (s === 'idle') return { cls: 'bad', text: tr('net.idle') };
    return { cls: 'warn', text: tr('net.connecting') };
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
        ui.noticeBox.appendChild(h('div', { class: 'card notice' }, h('p', null, App.lobbyNotice()),
          h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '8px' } }, btn(tr('lobby.gotIt'), { cls: 'btn-mint btn-sm', onClick: () => { App.lobbyNotice = null; ui.paintNotice(); } }))));
      }
    };
    ui.paintProfile = () => repaint(ui.profileBox, box => {
      box.appendChild(h('div', { class: 'row', style: { alignItems: 'center', gap: '12px' } },
        avatar(App.store.animal, 52),
        h('div', { class: 'grow' }, h('b', null, U.myName()), h('div', { class: 'muted small' }, tr('lobby.profileHint'))),
        btn(tr('lobby.edit'), { cls: 'btn-sky btn-sm', onClick: () => editProfile() })));
    });
    ui.paintActions = () => repaint(ui.actionBox, box => {
      const ok = online();
      box.appendChild(h('div', { class: 'row', style: { gap: '10px' } },
        btn(tr('lobby.quick'), { cls: 'btn-pink btn-lg grow', icon: 'play', iconSize: 24, disabled: !ok, onClick: () => Net.send(Object.assign({ type: 'quick', roomName: tr('room.defaultName', { name: U.myName() }) }, profile())) }),
        btn(tr('lobby.create'), { cls: 'btn-sun btn-lg grow', icon: 'plus', iconSize: 24, disabled: !ok, onClick: () => createRoomModal() })));
    });
    ui.paintList = () => repaint(ui.listBox, box => {
      const list = App.rooms || [];
      if (!online()) { box.appendChild(h('div', { class: 'empty-box' }, C.status === 'ok' ? tr('lobby.emptyConnect') : tr('lobby.emptyNoServer'))); return; }
      if (!list.length) { box.appendChild(h('div', { class: 'empty-box' }, tr('lobby.emptyList'))); return; }
      for (const r of list) {
        const sets = r.settings || {};
        box.appendChild(h('div', { class: 'room-item' },
          h('div', { class: 'info' },
            h('div', { class: 'name' }, r.name),
            h('div', { class: 'chips', style: { marginTop: '4px' } },
              h('span', { class: 'pill gray' }, tr('room.code', { id: r.id })),
              h('span', { class: 'pill ' + (r.phase === 'lobby' ? 'mint' : 'pink') }, phaseText(r.phase)),
              h('span', { class: 'pill' }, tr('room.count', { n: r.players, max: r.max })),
              r.spectators ? h('span', { class: 'pill gray' }, tr('room.watching', { n: r.spectators })) : null,
              h('span', { class: 'pill gray' }, tr('room.host', { name: r.host })),
              h('span', { class: 'pill gray' }, sets.timeLimit ? tr('room.minutes', { n: sets.timeLimit / 60 }) : tr('rules.noLimit')))),
          h('div', { class: 'row', style: { gap: '8px' } },
            r.joinable ? btn(tr('room.join'), { cls: 'btn-mint btn-sm', onClick: () => joinRoom(r.id, 'player') }) : null,
            btn(tr('room.watch'), { cls: 'btn-sky btn-sm', icon: 'eye', iconSize: 18, onClick: () => joinRoom(r.id, 'spectator') }))));
      }
    });
    ui.paintInvite = () => {
      const inv = App.invite;
      ui.inviteBox.textContent = '';
      if (!inv) return;
      const card = h('section', { class: 'invite-card', 'aria-label': tr('invite.aria') });
      const drop = () => { App.invite = null; clearInviteUrl(); ui.paintInvite(); };
      if (inv.error) {
        card.append(h('h3', null, tr('invite.badTitle')), h('p', null, reasonText(inv.error)),
          h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '10px' } }, btn(tr('invite.backLobby'), { cls: 'btn-mint', onClick: drop })));
      } else if (!inv.info) {
        card.append(h('h3', null, tr('invite.checking')), h('p', { class: 'muted' }, online() ? tr('invite.checkingOn') : tr('invite.checkingOff')),
          h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '10px' } }, btn(tr('invite.skip'), { cls: 'btn-ghost btn-sm', onClick: drop })));
      } else {
        const i = inv.info;
        const spec = i.willSpectate;
        let why = '';
        if (spec && i.role !== 'spectator') why = i.phase !== 'lobby' ? tr('invite.whyStarted') : tr('invite.whyFull');
        const prof = App.profileEditor({});
        card.append(
          h('h3', null, tr('invite.title', { name: i.name })),
          h('div', { class: 'chips', style: { margin: '6px 0 10px' } },
            h('span', { class: 'pill gray' }, tr('room.code', { id: i.room })), h('span', { class: 'pill' }, tr('room.count', { n: i.players, max: i.max })),
            h('span', { class: 'pill ' + (spec ? 'sun' : 'mint') }, spec ? tr('invite.asSpec', { why }) : tr('invite.asPlayer'))),
          h('p', { class: 'muted small', style: { marginBottom: '8px' } }, tr('invite.note') + (spec ? tr('invite.noteSpec') : '')),
          prof.el,
          h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '10px', marginTop: '10px' } },
            btn(tr('invite.skip'), { cls: 'btn-ghost', onClick: drop }),
            btn(spec ? tr('invite.goSpec') : tr('invite.goPlay'), { cls: 'btn-pink', disabled: !online() || inv.joining, onClick: () => {
              inv.joining = true;
              Net.send({ type: 'join', room: i.room, token: inv.token, name: U.myName(), animal: App.store.animal });
              ui.paintInvite();
            } })));
      }
      ui.inviteBox.appendChild(card);
    };

    const unsetNote = (C.status !== 'ok')
      ? h('section', { class: 'card' }, h('h3', null, tr('online.noServer')),
        h('p', { class: 'muted' }, C.status === 'invalid' ? cfgError(C) : tr('online.noServerText')),
        h('div', { class: 'row', style: { marginTop: '8px' } }, btn(tr('online.playSolo'), { cls: 'btn-pink', onClick: () => App.go('solo') })))
      : null;

    const el = U.screenBox('', h('div', { class: 'wrap' },
      U.topbar(tr('lobby.title'), () => App.go('home'), ui.statusBox),
      unsetNote, ui.noticeBox, ui.inviteBox,
      h('div', { class: 'room-grid' },
        h('div', { style: { display: 'grid', gap: '14px' } },
          h('section', { class: 'card' }, h('h3', null, tr('lobby.me')), ui.profileBox),
          h('section', { class: 'card' }, h('h3', null, tr('lobby.start')), ui.actionBox)),
        h('section', { class: 'card' }, h('h3', null, tr('lobby.rooms'), h('span', { class: 'pill gray', style: { marginLeft: '8px' } }, tr('lobby.canJoin'))), ui.listBox))));
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
    const spec = () => ({ title: tr('online.myProfile'), content: App.profileEditor({}).el, actions: [btn(tr('common.done'), { cls: 'btn-mint', onClick: () => m.close() })] });
    const m = modal(Object.assign({ cls: 'dialog-lg', rebuild: spec,
      onClose: () => { Net.setProfile(profile()); Net.send(Object.assign({ type: 'profile' }, profile())); if (App.lobbyUI && App.screen === 'lobby') App.lobbyUI.paintProfile(); } }, spec()));
  }

  function createRoomModal() {
    let max = 4, nameIn = null, typed = '';
    const spec = () => {
      if (nameIn) typed = nameIn.value;       /* 切換語言重建時保留已輸入的房名 */
      const dflt = tr('create.placeholder', { name: U.myName() });
      nameIn = h('input', { class: 'text-input', type: 'text', maxlength: 10, value: typed, placeholder: dflt, 'aria-label': tr('create.name'), autocomplete: 'off', 'data-autofocus': '1' });
      const st = stepper({ label: tr('create.max'), min: 2, max: 8, value: max, fmt: v => tr('create.players', { n: v }), onChange: v => { max = v; } });
      return { title: tr('create.title'),
        content: h('div', null, field(tr('create.name'), nameIn), field(tr('create.max'), st),
          h('p', { class: 'muted small' }, tr('create.note'))),
        actions: [btn(tr('common.cancel'), { cls: 'btn-ghost', onClick: () => m.close() }),
          btn(tr('create.ok'), { cls: 'btn-pink', onClick: () => { m.close(true); Net.send(Object.assign({ type: 'create', roomName: nameIn.value.trim() || dflt, max }, profile())); } })] };
    };
    const m = modal(Object.assign({ cls: 'dialog-sm', rebuild: spec }, spec()));
  }

  /* ================= 房間 ================= */
  App.screens.room = function () {
    App.onlineGame = false;
    const ui = App.roomUI = {};
    ui.titleEl = h('h2', null, tr('room.title'));
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
        ui.titleEl.textContent = tr('room.entering');
        ui.seatsBox.textContent = ''; ui.seatsBox.appendChild(h('div', { class: 'empty-box' }, tr('room.syncing')));
        ui.actBox.textContent = ''; ui.setBox.textContent = ''; ui.specBox.textContent = '';
        return;
      }
      ui.titleEl.textContent = r.name;
      ui.codeEl.textContent = '';
      ui.codeEl.append(h('span', { class: 'pill gray' }, tr('room.code', { id: r.id })), ' ', h('span', { class: 'pill ' + (r.phase === 'lobby' ? 'mint' : 'pink') }, phaseText(r.phase)));
      repaint(ui.seatsBox, paintSeats);
      repaint(ui.specBox, paintSpectators);
      repaint(ui.actBox, paintActions);
      repaint(ui.setBox, paintSettings);
    };

    const el = U.screenBox('', h('div', { class: 'wrap' },
      h('div', { class: 'topbar' }, root.UI.iconBtn('back', tr('room.leaveAria'), () => App.confirmLeave()),
        h('div', { class: 'room-head' }, ui.titleEl, ui.codeEl)),
      h('div', { class: 'room-grid' },
        h('div', { style: { display: 'grid', gap: '14px' } },
          h('section', { class: 'card' }, h('h3', null, tr('room.seats')), ui.seatsBox),
          ui.specBox,
          h('section', { class: 'card' }, h('h3', null, tr('room.chat')), ui.chat.el)),
        h('div', { style: { display: 'grid', gap: '14px' } },
          h('section', { class: 'card' }, ui.actBox),
          h('section', { class: 'card' }, h('h3', null, tr('room.rules')), ui.setBox)))));
    ui.paint();
    Net.open(profile());
    return el;
  };

  function paintSeats(box) {
    const r = App.room, you = r.you, host = you.host, lobby = r.phase === 'lobby';
    for (const s of r.seats) {
      if (s.kind === 'empty') {
        box.appendChild(h('div', { class: 'seat empty' }, h('div', { class: 'seat-line' }, h('span', { class: 'seat-name' }, tr('room.empty')),
          host && lobby ? btn(tr('room.addAi'), { cls: 'btn-sky btn-sm', icon: 'robot', iconSize: 18, onClick: () => Net.send({ type: 'addai', level: App.aiAddLevel }) }) : null)));
        continue;
      }
      const isAi = s.kind === 'ai', mine = s.i === you.seat;
      if (isAi) {
        /* 電腦席位：第一行頭像、名字、移除鈕；角色與難度兩個下拉各佔一半排在第二行，窄欄也不會擠出去 */
        const canEdit = host && lobby, sname = Art.playerName(s);
        box.appendChild(h('div', { class: 'seat ai' },
          h('div', { class: 'seat-line' }, avatar(s.animal, 38), h('span', { class: 'seat-name' }, sname),
            canEdit ? root.UI.iconBtn('trash', tr('room.remove', { name: sname }), () => Net.send({ type: 'removeai', seat: s.i }), 'sm')
              : h('span', { class: 'pill gray' }, AI.LEVELS[s.level] ? AI.LEVELS[s.level].name : tr('room.cpu'))),
          canEdit ? h('div', { class: 'seat-pick' },
            root.UI.dropdown({ label: tr('room.seatAnimal', { name: sname }), cls: 'lvl sm', options: U.animalOptions(r.seats.filter(o => o.kind === 'human').map(o => o.animal)), value: s.animal, onChange: v => Net.send({ type: 'aiAnimal', seat: s.i, animal: v }) }),
            root.UI.dropdown({ label: tr('room.seatLevel', { name: sname }), cls: 'lvl sm', options: U.LEVEL_DD, value: s.level, onChange: v => Net.send({ type: 'aiLevel', seat: s.i, level: v }) })) : null));
        continue;
      }
      const tags = h('div', { class: 'seat-tags' });
      if (s.i === r.hostSeat) tags.appendChild(h('span', { class: 'pill sun' }, tr('room.hostTag')));
      if (mine) tags.appendChild(h('span', { class: 'pill' }, tr('room.youTag')));
      if (s.i !== r.hostSeat && lobby) tags.appendChild(h('span', { class: 'pill ' + (s.ready ? 'mint' : 'gray') }, s.ready ? tr('room.ready') : tr('room.notReady')));
      if (!s.connected) tags.appendChild(h('span', { class: 'pill pink' }, tr('room.offline')));
      const kick = host && !mine && lobby
        ? root.UI.iconBtn('kick', tr('room.kick', { name: s.name }), () => root.UI.confirmBox({ title: () => tr('room.kickTitle', { name: s.name }), text: () => tr('room.kickText'), ok: () => tr('room.kickOk'), danger: true, onOk: () => Net.send({ type: 'kick', seat: s.i }) }), 'sm')
        : null;
      box.appendChild(h('div', { class: 'seat' + (mine ? ' me' : '') },
        h('div', { class: 'seat-line' }, avatar(s.animal, 38), h('span', { class: 'seat-name' }, s.name), kick), tags));
    }
  }

  function paintSpectators(box) {
    const r = App.room;
    const list = r.spectators || [];
    const card = h('section', { class: 'card' }, h('h3', null, tr('room.specSeats'), h('span', { class: 'pill gray', style: { marginLeft: '8px' } }, list.length + '/' + r.specCap)));
    if (!list.length) card.appendChild(h('p', { class: 'muted small' }, tr('room.noSpec')));
    else card.appendChild(h('div', { class: 'chips' }, list.map(s => h('span', { class: 'pill' + (s.pid === r.you.pid ? '' : ' gray') }, s.name + (s.pid === r.you.pid ? tr('room.specYou') : '')))));
    box.appendChild(card);
  }

  function paintActions(box) {
    const r = App.room, you = r.you, lobby = r.phase === 'lobby';
    const filled = r.seats.filter(s => s.kind !== 'empty').length;
    const free = filled < r.max;
    box.appendChild(h('h3', null, you.role === 'player' ? (you.host ? tr('room.youHost') : tr('room.youPlayer')) : tr('room.youSpec')));
    const rows = h('div', { style: { display: 'grid', gap: '10px' } });
    if (r.phase === 'playing') {
      rows.appendChild(h('p', { class: 'muted' }, tr('room.playing')));
    } else if (r.phase === 'finished') {
      rows.appendChild(h('p', { class: 'muted' }, you.host ? tr('room.finishedHost') : tr('room.finishedGuest')));
      if (you.host) rows.appendChild(btn(tr('room.again'), { cls: 'btn-pink btn-lg btn-block', icon: 'play', iconSize: 24, onClick: () => Net.send({ type: 'rematch' }) }));
    } else if (you.role === 'player' && you.host) {
      const why = filled < 2 ? tr('room.whyFew') : (!r.canStart ? tr('room.whyReady') : '');
      rows.appendChild(btn(tr('room.startGame'), { cls: 'btn-pink btn-lg btn-block', icon: 'play', iconSize: 24, disabled: !r.canStart, onClick: () => Net.send({ type: 'start' }) }));
      if (why) rows.appendChild(h('p', { class: 'muted small' }, why));
    } else if (you.role === 'player') {
      const me = r.seats[you.seat];
      rows.appendChild(btn(me.ready ? tr('room.unready') : tr('room.imReady'), { cls: me.ready ? 'btn-ghost btn-lg btn-block' : 'btn-mint btn-lg btn-block', icon: 'check', iconSize: 24, onClick: () => Net.send({ type: 'ready', value: !me.ready }) }));
      rows.appendChild(btn(tr('room.toSpec'), { cls: 'btn-ghost btn-block', icon: 'eye', iconSize: 20, onClick: () => Net.send({ type: 'watch' }) }));
    } else {
      rows.appendChild(btn(free ? tr('room.sit') : tr('room.seatsFull'), { cls: 'btn-mint btn-lg btn-block', icon: 'play', iconSize: 24, disabled: !free || !lobby, onClick: () => Net.send({ type: 'sit' }) }));
      if (!lobby) rows.appendChild(h('p', { class: 'muted small' }, tr('room.noSit')));
    }
    if (you.host && r.phase !== 'playing') rows.appendChild(btn(tr('room.invite'), { cls: 'btn-sky btn-block', icon: 'link', iconSize: 20, onClick: () => openInviteModal() }));
    rows.appendChild(btn(tr('room.leave'), { cls: 'btn-ghost btn-block', onClick: () => App.confirmLeave() }));
    box.appendChild(rows);
  }

  function paintSettings(box) {
    const r = App.room, s = r.settings, host = r.you.host && r.phase === 'lobby';
    const send = patch => Net.send({ type: 'settings', patch });
    const filled = r.seats.filter(x => x.kind !== 'empty').length;
    if (host) {
      box.append(
        field(tr('room.players'), stepper({ label: tr('room.maxPlayers'), min: Math.max(2, filled), max: 8, value: r.max, fmt: v => tr('room.nPlayers', { n: v }), onChange: v => send({ max: v }) })),
        U.rulesPanel(s, send));
    } else {
      box.appendChild(h('div', { class: 'chips rules-sum' }, [tr('room.nPlayers', { n: r.max })].concat(U.rulesSummary(s)).map(t => h('span', { class: 'pill gray' }, t))));
      if (!r.you.host) box.appendChild(h('p', { class: 'muted small', style: { marginTop: '8px' } }, tr('room.onlyHost')));
    }
  }

  /* ---------- 邀請連結（房主） ---------- */
  function openInviteModal() {
    if (App.inviteModal && !App.inviteModal.closed) return;
    let role = 'player', list = null;
    const paint = () => repaint(list, box => {
      const invs = (App.room && App.room.invites) || [];
      if (!invs.length) { box.appendChild(h('p', { class: 'muted small' }, tr('inv.none'))); return; }
      for (const iv of invs) {
        const url = inviteLink(iv.token);
        box.appendChild(h('div', null,
          h('div', { class: 'small', style: { fontWeight: '800', marginBottom: '4px' } }, iv.role === 'spectator' ? tr('inv.specLink') : tr('inv.playerLink')),
          h('div', { class: 'link-box' }, h('code', null, url),
            btn(tr('inv.copy'), { cls: 'btn-sky btn-sm', icon: 'copy', iconSize: 16, onClick: () => { const p = root.UI.copyText(url); Promise.resolve(p).then(ok => toast(ok ? tr('inv.copied') : tr('inv.copyFail'))); } }),
            navigator.share ? btn(tr('inv.share'), { cls: 'btn-mint btn-sm', onClick: () => { navigator.share({ title: tr('inv.shareTitle'), text: tr('inv.shareText'), url }).catch(() => {}); } }) : null)));
      }
    });
    const build = () => {
      list = h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: '8px', marginTop: '10px' } });
      return { title: tr('inv.title'),
        content: h('div', null,
          h('p', { class: 'muted small' }, tr('inv.note')),
          field(tr('inv.who'), seg({ label: tr('inv.who'), options: [{ v: 'player', label: tr('inv.player') }, { v: 'spectator', label: tr('inv.spectator') }], value: role, onChange: v => { role = v; } })),
          btn(tr('inv.make'), { cls: 'btn-pink', icon: 'link', iconSize: 20, onClick: () => Net.send({ type: 'invite', role }) }),
          list),
        actions: [btn(tr('inv.revokeAll'), { cls: 'btn-ghost', onClick: () => root.UI.confirmBox({ title: () => tr('inv.revokeTitle'), text: () => tr('inv.revokeText'), ok: () => tr('inv.revokeOk'), danger: true, onOk: () => Net.send({ type: 'revoke' }) }) }),
          btn(tr('common.done'), { cls: 'btn-mint', onClick: () => m.close() })] };
    };
    const m = modal(Object.assign({ cls: 'dialog-lg', onClose: () => { App.inviteModal = null; }, rebuild: () => { const s = build(); paint(); return s; } }, build()));
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

  /** 連線狀態橫幅；切換語言時也呼叫它，文字換成新語言 */
  App.refreshBanner = function () {
    const s = App.netStatus, inOnline = App.screen === 'lobby' || App.screen === 'room' || (App.screen === 'game' && App.onlineGame);
    if (App.replacedBanner) { App.banner(tr('online.replacedBanner')); return; }
    if (!inOnline) { App.banner(''); return; }
    if (s === 'waking') App.banner(tr('net.bannerWaking', { s: App.netDetail || 0 }), true);
    else if (s === 'connecting') App.banner(tr('net.bannerConnecting'), true);
    else if (s === 'retrying') App.banner(tr('net.bannerRetrying'), true);
    else if (s === 'offline') App.banner(tr('net.bannerOffline'), true);
    else App.banner('');
  };

  function init() {
    Net.onStatus((s, detail) => {
      App.netStatus = s;
      const inOnline = App.screen === 'lobby' || App.screen === 'room' || (App.screen === 'game' && App.onlineGame);
      if (!inOnline) { App.banner(''); return; }
      App.netDetail = detail;
      App.refreshBanner();
      if (App.lobbyUI && App.screen === 'lobby') { App.lobbyUI.paintStatus(); App.lobbyUI.paintList(); App.lobbyUI.paintInvite(); }
      if (s === 'open') askInvite();
    });

    Net.on('welcome', m => {
      App.me = { pid: m.pid, name: m.name, animal: m.animal };
      App.room = m.room || null;
      /* 斷線太久（或伺服器重啟）回來時房間已經沒了：關閉通知是在離線時送的，收不到，這裡補上 */
      if (!m.room && (App.screen === 'room' || (App.screen === 'game' && App.onlineGame))) {
        App.lobbyNotice = () => tr('online.roomEnded'); toast(App.lobbyNotice(), 4200); leaveToLobby(); return;
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
      if (m.note) toast(srv('srv.note.', m.noteCode, null, m.note), 4000);
      if (App.screen !== 'game') App.go('room');
    });
    Net.on('joinFailed', m => {
      if (App.invite && App.invite.joining) { App.invite.joining = false; App.invite.error = m.reason; }
      else toast(m.reason && tr('online.reason.' + m.reason, null, null) || tr('online.joinFailed'), 3600);
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
      const txt = srv('srv.closed.', m.code, null, m.text || tr('online.closedDefault'));
      App.lobbyNotice = () => srv('srv.closed.', m.code, null, m.text || tr('online.closedDefault'));
      toast(txt, 4200);
      if (App.screen === 'lobby' && App.lobbyUI) App.lobbyUI.paintNotice();
    });
    Net.on('kicked', m => { toast(tr('online.kickedDefault'), 4200); App.lobbyNotice = () => tr('online.kickedNotice'); });
    Net.on('error', m => toast(srv('srv.err.', m.code, m.args, m.text || tr('online.errorDefault')), 3600));
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
      toast(tr('online.replaced'), 5000);
      App.replacedBanner = true;
      App.banner(tr('online.replacedBanner'));
    });
  }

  root.OnlineGlue = { init };
})(typeof self !== 'undefined' ? self : this);
