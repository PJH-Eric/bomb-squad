/* ===== game.js — 對戰畫面控制（單機與線上共用）：畫布、輸入、左側資訊欄、聊天室、觸控按鍵 ===== */
(function (root) {
  'use strict';
  const { h, avatar, keycap } = root.UI;
  const R = root.Rules, Art = root.Art;
  const tr = (k, p, f) => root.I18N.t(k, p, f);
  const QUICK_N = 5;     /* 聊天快捷語字典 quick.0～4（按下時送出當下語言的文字） */
  /** 聊天室訊息的系統文字：伺服器帶 code 就依目前語言翻譯，沒有（舊訊息）就用原本的中文 */
  function sysText(m) {
    if (m.code) { const s = tr('srv.sys.' + m.code, m.args || null, null); if (s != null) return s; }
    return m.text;
  }

  /* ---------- 聊天室元件（房間與對戰共用） ---------- */
  function createChat(o) {
    const log = h('div', { class: 'chat-log', role: 'log', 'aria-live': 'polite', 'aria-label': tr('game.chat') });
    const input = h('input', { class: 'text-input', type: 'text', maxlength: 60, placeholder: tr('game.chatPlaceholder'), 'aria-label': tr('game.chatAria'), enterkeyhint: 'send' });
    const send = () => {
      const t = input.value.trim();
      if (!t) return;
      o.send(t); input.value = '';
    };
    const form = h('form', { class: 'chat-form', onSubmit: e => { e.preventDefault(); send(); } }, input,
      h('button', { type: 'submit', class: 'btn btn-sky btn-sm' }, tr('game.send')));
    const quickBtns = () => Array.from({ length: QUICK_N }, (_, i) => h('button', { type: 'button', onClick: () => o.send(tr('quick.' + i)) }, tr('quick.' + i)));
    const quick = o.quick === false ? null : h('div', { class: 'quick-chat' }, quickBtns());
    const el = h('div', { class: 'chat-box' }, log, form, quick);
    function line(m) {
      if (m.role === 'sys') return h('div', { class: 'msg sys' }, sysText(m));
      return h('div', { class: 'msg ' + (m.role === 'spectator' ? 'spec' : '') }, h('b', null, m.name + (m.role === 'spectator' ? tr('game.specTag') : '')), m.text);
    }
    function set(list) {
      log.textContent = '';
      for (const m of list) log.appendChild(line(m));
      log.scrollTop = log.scrollHeight;
    }
    function push(m) {
      const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 24;
      log.appendChild(line(m));
      while (log.children.length > 80) log.removeChild(log.firstChild);
      if (stick) log.scrollTop = log.scrollHeight;
    }
    /** 切換語言：更新標籤、快捷語，並用目前的訊息列表重畫（系統訊息會換成新語言） */
    function relang(list) {
      log.setAttribute('aria-label', tr('game.chat'));
      input.setAttribute('placeholder', tr('game.chatPlaceholder')); input.setAttribute('aria-label', tr('game.chatAria'));
      form.querySelector('button').textContent = tr('game.send');
      if (quick) { quick.textContent = ''; quickBtns().forEach(b => quick.appendChild(b)); }
      if (list) set(list);
    }
    return { el, set, push, input, relang };
  }

  /* ---------- 對戰畫面 ---------- */
  class GameScreen {
    /**
     * cfg: { kind:'solo'|'online', info (開局資料 startInfo), slot (自己的席位，觀戰為 null),
     *        settings (Store 物件，即時讀取), onEsc(), onResult(result, players), send(msg)（線上）,
     *        state（單機：Rules 狀態）, brains（單機：slot→brain）, chat（{send,list,sub}，線上） }
     */
    constructor(cfg) {
      this.cfg = cfg;
      this.kind = cfg.kind;
      this.slot = cfg.slot;
      this.settings = cfg.settings;
      this.alive = true;
      this.keys = [];
      this.dir = null; this.dir2 = null; this.sentDir = null;
      this.acc = 0; this.last = 0; this.ff = false;
      this.hudSig = ''; this.sumSig = ''; this.hudAt = 0;
      this.unread = 0; this.resultAt = 0; this.resultDone = false;
      this.mission = cfg.mission || null; this.missionEnd = null;      /* 新手教學：關卡物件（update 判斷過關）與結束狀態 */
      if (this.kind === 'solo') {
        this.state = cfg.state; this.view = cfg.state;
        this.inputs = {};
        for (const p of this.state.players) { this.inputs[p.slot] = { dir: null, bomb: false }; p.rx = p.x; p.ry = p.y; p.px = p.x; p.py = p.y; }
      } else {
        this.view = R.viewFromStart(cfg.info);
      }
      this.build();
      this.bind();
      if (root.GameAnalytics && this.slot != null && !this.mission) {
        const levels = this.view.players.filter(p => p.kind === 'ai').map(p => p.level);
        root.GameAnalytics.start({
          mode: this.kind, players: this.view.players.length,
          difficulty: levels.length ? (levels.every(level => level === levels[0]) ? levels[0] : 'mixed') : undefined
        }, this.kind === 'online' ? this.view.seed : null);
      }
      this.layout();
      this.raf = requestAnimationFrame(t => this.loop(t));
    }

    /* ----- DOM ----- */
    build() {
      const s = this.settings, info = this.cfg.info;
      this.canvas = h('canvas', { 'aria-label': tr('game.canvas'), role: 'img' });
      this.board = h('div', { class: 'board' }, this.canvas);
      this.rend = new root.Renderer(this.canvas);

      this.timerEl = h('div', { class: 'hud-timer', 'aria-label': tr('game.timeLeft') }, '--:--');
      this.chipsEl = h('div', { class: 'hud-chips' });

      this.sumEl = h('div', { class: 'summary', role: 'list', 'aria-label': tr('game.playerStatus') });
      this.statsEl = h('div', { class: 'mystats' });
      this.curseEl = h('div', { class: 'curse-bar', hidden: true });
      this.buffEl = h('div', { class: 'curse-bar buff-bar', hidden: true });
      this.keysEl = h('div', { hidden: true });
      this.specEl = h('div', { class: 'pill gray', hidden: true }, tr('game.spectating'));

      const closeBtn = root.UI.iconBtn('back', tr('game.closeSide'), () => this.setSide(false), 'sm');
      const online = this.kind === 'online';
      const exitLabel = online ? tr('game.leaveMatch') : tr('game.pauseMenu');
      this.sideTitle = h('h3', null, tr('game.side'));
      this.exitIn = root.UI.iconBtn(online ? 'close' : 'pause', exitLabel, () => this.cfg.onEsc && this.cfg.onEsc(), 'sm exit-in');
      this.closeSideBtn = closeBtn;
      this.sideHead = h('div', { class: 'side-head' }, this.sideTitle, this.exitIn, closeBtn);
      this.exitBtn = root.UI.iconBtn(online ? 'close' : 'pause', exitLabel, () => this.cfg.onEsc && this.cfg.onEsc(), 'exit-btn');
      this.mapEl = this.buildMapInfo();
      this.side = h('aside', { class: 'game-side', 'aria-label': tr('game.sideAria') }, this.sideHead, this.mapEl, this.sumEl, this.statsEl, this.buffEl, this.curseEl, this.specEl);

      if (this.kind === 'online' && this.cfg.chat) {
        this.chat = createChat({ send: t => this.cfg.chat.send(t) });
        this.chat.set(this.cfg.chat.list());
        const wrap = h('div', { class: 'side-chat' }, this.chat.el);
        this.side.appendChild(wrap);
        this.chatSub = this.cfg.chat.sub(m => {
          this.chat.push(m);
          if (this.sideClosed() && m.role !== 'sys') { this.unread++; this.paintBadge(); }
        });
      }

      this.badge = h('span', { class: 'badge', hidden: true });
      this.toggle = h('button', { type: 'button', class: 'icon-btn side-toggle', 'aria-label': tr('game.openSide'), title: tr('game.sideTitle'), onClick: () => this.setSide(true) },
        h('span', { html: Art.icon('list', 22) }), this.badge);

      /* 上方資訊欄：保留獨立空間，不蓋棋盤（位置與大小由 layout() 依棋盤算）。左：側欄開關、選單／暫停；中：計時與玩家頭像；右：線上延遲（右上角另有全域的語言與設定鈕） */
      this.pingEl = online ? h('div', { class: 'ping', role: 'status', 'aria-label': tr('game.ping') }, '-- ms') : null;
      this.hud = h('div', { class: 'hud' },
        h('div', { class: 'hud-l' }, this.toggle, this.exitBtn),
        h('div', { class: 'hud-c' }, this.timerEl, this.chipsEl),
        h('div', { class: 'hud-r' }, this.pingEl));
      this.main = h('div', { class: 'game-main' }, this.board, this.hud);
      if (this.mission) this.buildMissionBar();
      this.ghost = h('div', { class: 'ghost-msg', hidden: true });
      this.main.appendChild(this.ghost);
      this.touchEl = null;
      if (this.slot != null) this.buildTouch();
      /* 手機直放：擋住畫面請玩家轉橫（觀戰者不擋）；玩家照常在場上，轉橫後立刻可以操作 */
      this.rotateEl = h('div', { class: 'rotate-mask', role: 'alert', hidden: true }, h('span', { class: 'rotate-ico', html: Art.icon('rotate', 56) }), h('p', null, tr('game.rotate')));
      this.root = h('div', { class: 'game' }, this.side, this.main, this.rotateEl);
      /* 滑鼠／觸控點完按鈕就放掉焦點：不然暫停→繼續後焦點回到暫停鈕，按空白鍵會再開一次選單而不是放炸彈（鍵盤 Tab 過去的照常可按） */
      this.root.addEventListener('pointerup', e => { const b = e.target.closest && e.target.closest('button'); if (b) b.blur(); });
      /* 所有裝置的側欄（計分板、聊天室）預設收起、點開從左側滑出，棋盤才能用滿整個畫面 */
      this.root.classList.add('side-closed');
      this.applyTheme();
    }

    /** 「對局」標題下面一行：目前地圖的主題・版型（放不下的部分用刪節號，完整內容在滑過時顯示） */
    buildMapInfo() {
      const v = this.view, th = Art.THEMES[v.themeId] || Art.THEMES[0];
      const layout = tr('rules.layoutSuffix', { l: R.LAYOUT_NAMES[v.layout] || '' });
      return h('div', { class: 'map-info', 'aria-label': tr('game.mapInfo'), title: tr('game.mapTitle', { th: th.name, lay: layout }) }, th.name + '・' + layout);
    }

    /* ----- 新手教學 ----- */
    /** 畫面下方的任務列：目標、進度，開局前幾秒多顯示提示 */
    buildMissionBar() {
      this.mTitle = h('b', { class: 'mission-bar-title' }); this.mGoal = h('span', { class: 'mission-bar-goal' });
      this.mProg = h('span', { class: 'mission-bar-prog' }); this.mHint = h('div', { class: 'mission-bar-hint' });
      this.missionEl = h('div', { class: 'mission-bar', role: 'status' }, h('div', { class: 'mission-bar-row' }, this.mTitle, this.mGoal, this.mProg), this.mHint);
      this.main.appendChild(this.missionEl);
      this.paintMission(null);
    }
    paintMission(r) {
      if (!this.mission) return;
      const id = this.mission.id;
      this.mTitle.textContent = tr('mission.level', { n: id }) + '・' + tr('mission.' + id + '.title');
      this.mGoal.textContent = tr('mission.' + id + '.goal'); this.mHint.textContent = tr('mission.hint') + '：' + tr('mission.' + id + '.hint');
      if (r && r.progress) this.mProg.textContent = tr('mission.progress.' + r.progress.k, { n: r.progress.n, max: r.progress.max });
    }
    /** 每個畫面格呼叫一次：判斷過關或失敗；結束後停住畫面，稍等一下再顯示結果（讓玩家看到最後一幕） */
    tickMission(evs) {
      const s = this.state, r = this.mission.update(s, evs);
      this.lastMission = r;
      this.paintMission(r);
      this.missionEl.classList.toggle('show-hint', s.phase !== 'play' || s.time < 4);
      if (r.status === 'play' || this.missionEnd) return;
      this.missionEnd = r;
      if (root.Sound) root.Sound.sfx(r.status === 'win' ? 'win' : 'lose');
      setTimeout(() => { if (this.alive && this.cfg.onMissionEnd) this.cfg.onMissionEnd(r); }, r.status === 'win' ? 700 : 1200);
    }

    /** 切換語言：對戰畫面不重建（不然會重開一局），只把文字與標籤換成新語言 */
    relang() {
      const online = this.kind === 'online';
      const exitLabel = online ? tr('game.leaveMatch') : tr('game.pauseMenu');
      const lab = (el, text) => { if (el) { el.setAttribute('aria-label', text); if (el.hasAttribute('title')) el.setAttribute('title', text); } };
      this.canvas.setAttribute('aria-label', tr('game.canvas'));
      this.timerEl.setAttribute('aria-label', tr('game.timeLeft'));
      this.sumEl.setAttribute('aria-label', tr('game.playerStatus'));
      this.specEl.textContent = tr('game.spectating');
      this.sideTitle.textContent = tr('game.side');
      lab(this.closeSideBtn, tr('game.closeSide')); lab(this.exitIn, exitLabel); lab(this.exitBtn, exitLabel);
      this.side.setAttribute('aria-label', tr('game.sideAria'));
      this.toggle.setAttribute('aria-label', tr('game.openSide')); this.toggle.setAttribute('title', tr('game.sideTitle'));
      if (this.pingEl) this.pingEl.setAttribute('aria-label', tr('game.ping'));
      this.rotateEl.querySelector('p').textContent = tr('game.rotate');
      if (this.mission) this.paintMission(this.lastMission || null);
      if (this.stick) this.stick.setAttribute('aria-label', tr('game.stick'));
      for (const [dir, button] of Object.entries(this.directionButtons || {})) button.setAttribute('aria-label', tr('game.direction.' + dir));
      if (this.bombBtn) this.bombBtn.setAttribute('aria-label', tr('game.bomb'));
      const mapEl = this.buildMapInfo(); this.mapEl.replaceWith(mapEl); this.mapEl = mapEl;
      if (this.chat) this.chat.relang(this.cfg.chat.list());
      if (this.ffBtn) this.ffBtn.textContent = this.ff ? tr('game.ffOff') : tr('game.ff');
      this.hudSig = ''; this.hudAt = -1;      /* 下一格重畫玩家列、能力、計時等文字 */
    }

    applyTheme() {
      const th = Art.THEMES[this.view.themeId] || Art.THEMES[0];
      this.root.style.setProperty('--stage', th.bg);
    }

    buildTouch() {
      const st = this.settings;
      this.directionButtons = {};
      this.stick = h('div', { class: 'stick', role: 'group', 'aria-label': tr('game.stick') },
        ...[['U', 'u', '▲'], ['D', 'd', '▼'], ['L', 'l', '◀'], ['R', 'r', '▶']].map(([dir, cls, glyph]) => {
          const button = h('button', { type: 'button', class: 'direction-key ' + cls, 'aria-label': tr('game.direction.' + dir), 'aria-pressed': 'false' }, glyph);
          this.directionButtons[dir] = button;
          return button;
        }));
      this.bombBtn = h('button', { type: 'button', class: 'bomb-btn', 'aria-label': tr('game.bomb') },
        h('img', { alt: '', src: Art.svgUrl(Art.bombSVG()) }));
      this.touchEl = h('div', { class: 'touch' + (st.stickSide === 'right' ? ' flip' : ''), 'aria-hidden': 'false' }, this.stick, this.bombBtn);
      this.main.appendChild(this.touchEl);

      /* 方向鍵與炸彈各自記錄手指，支援同時移動與放炸彈。 */
      let bombId = null;
      const held = new Map();
      const paintDirections = () => {
        const dirs = [...held.values()];
        this.stickDir = dirs.length ? dirs[dirs.length - 1] : null;
        this.stickDir2 = dirs.slice(0, -1).reverse().find(d => (d === 'L' || d === 'R') !== (this.stickDir === 'L' || this.stickDir === 'R')) || null;
        for (const [dir, button] of Object.entries(this.directionButtons)) {
          const down = dirs.includes(dir);
          button.classList.toggle('on', down);
          button.setAttribute('aria-pressed', String(down));
        }
        this.refreshDir();
      };
      for (const [dir, button] of Object.entries(this.directionButtons)) {
        button.addEventListener('pointerdown', e => {
          e.preventDefault();
          if (UI_open() || held.has(e.pointerId)) return;
          held.set(e.pointerId, dir);
          try { button.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
          paintDirections();
        });
        const release = e => {
          if (held.get(e.pointerId) !== dir) return;
          held.delete(e.pointerId); paintDirections();
        };
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(ev, release);
        button.addEventListener('keydown', e => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault(); e.stopPropagation();
          if (UI_open()) return;
          held.set('key-' + dir, dir); paintDirections();
        });
        const releaseKey = () => { held.delete('key-' + dir); paintDirections(); };
        button.addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); releaseKey(); } });
        button.addEventListener('blur', releaseKey);
      }
      this.bombBtn.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (bombId !== null) return;
        bombId = e.pointerId; this.bombBtn.classList.add('down');
        try { this.bombBtn.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
        this.pressBomb();
      });
      const bombUp = e => { if (e.pointerId !== bombId) return; bombId = null; this.bombBtn.classList.remove('down'); };
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) this.bombBtn.addEventListener(ev, bombUp);
      this.bombBtn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.pressBomb(); } });
      /* 切到別的 App、頁面隱藏、失去焦點：完整重置（方向、記錄的手指、方向鍵外觀、炸彈鍵），不會殘留往一個方向跑 */
      this.resetTouch = () => {
        held.clear(); bombId = null;
        this.bombBtn.classList.remove('down'); paintDirections();
      };
    }

    touchVisible() {
      const m = this.settings.touchMode;
      if (this.slot == null) return false;
      if (m === 'on') return true;
      if (m === 'off') return false;
      return !!(root.matchMedia && root.matchMedia('(pointer: coarse)').matches);
    }

    /* ----- 輸入 ----- */
    bind() {
      this.onKeyDown = e => {
        if (UI_open()) return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
        const k = e.key;
        if (k === 'Escape') { e.preventDefault(); this.cfg.onEsc && this.cfg.onEsc(); return; }
        const d = { ArrowUp: 'U', w: 'U', W: 'U', ArrowDown: 'D', s: 'D', S: 'D', ArrowLeft: 'L', a: 'L', A: 'L', ArrowRight: 'R', d: 'R', D: 'R' }[k];
        if (d) {
          e.preventDefault();
          const i = this.keys.indexOf(d); if (i >= 0) this.keys.splice(i, 1);
          this.keys.push(d); this.refreshDir();
          return;
        }
        if (k === ' ' || k === 'Enter' || k === 'j' || k === 'J' || k === 'z' || k === 'Z') {
          if (t && t.tagName === 'BUTTON' && (k === ' ' || k === 'Enter')) return;
          e.preventDefault();
          if (!e.repeat) this.pressBomb();
        }
      };
      this.onKeyUp = e => {
        const d = { ArrowUp: 'U', w: 'U', W: 'U', ArrowDown: 'D', s: 'D', S: 'D', ArrowLeft: 'L', a: 'L', A: 'L', ArrowRight: 'R', d: 'R', D: 'R' }[e.key];
        if (!d) return;
        const i = this.keys.indexOf(d); if (i >= 0) this.keys.splice(i, 1);
        this.refreshDir();
      };
      this.onBlur = () => { this.keys = []; if (this.resetTouch) this.resetTouch(); else { this.stickDir = null; this.stickDir2 = null; this.refreshDir(); } };
      this.onHidden = () => { if (document.visibilityState === 'hidden') this.onBlur(); };
      this.onResize = () => this.layout();
      document.addEventListener('keydown', this.onKeyDown);
      document.addEventListener('keyup', this.onKeyUp);
      root.addEventListener('blur', this.onBlur);
      root.addEventListener('pagehide', this.onBlur);
      document.addEventListener('visibilitychange', this.onHidden);
      root.addEventListener('resize', this.onResize);
      root.addEventListener('orientationchange', this.onResize);
      if (root.ResizeObserver) { this.ro = new ResizeObserver(() => this.layout()); this.ro.observe(this.main); }
    }

    refreshDir() {
      const d = this.keys.length ? this.keys[this.keys.length - 1] : (this.stickDir || null);
      /* 第二方向：鍵盤取「還按著、跟目前方向垂直」的最近一個鍵；搖桿取斜推時的次要軸 */
      const horiz = k => k === 'L' || k === 'R';
      let d2 = null;
      if (this.keys.length) { for (let i = this.keys.length - 2; i >= 0; i--) if (horiz(this.keys[i]) !== horiz(d)) { d2 = this.keys[i]; break; } }
      else d2 = this.stickDir2 || null;
      if (d === this.dir && d2 === this.dir2) return;
      this.dir = d; this.dir2 = d2;
      if (this.kind === 'solo' && this.slot != null) { this.inputs[this.slot].dir = d; this.inputs[this.slot].dir2 = d2; }
      else if (this.kind === 'online' && this.slot != null) {
        const sig = d + '/' + d2;
        if (sig !== this.sentDir) { this.sentDir = sig; this.cfg.send({ type: 'input', dir: d, dir2: d2 }); }
      }
    }
    pressBomb() {
      if (this.slot == null || this.view.phase !== 'play') return;
      const me = this.view.players.find(p => p.slot === this.slot);
      if (!me || !me.alive) return;
      if (this.kind === 'solo') this.inputs[this.slot].bomb = true;
      else this.cfg.send({ type: 'bomb' });
    }

    /* ----- 版面 ----- */
    sideClosed() { return this.root.classList.contains('side-closed'); }
    setSide(open) {
      this.root.classList.toggle('side-closed', !open);
      if (open) { this.unread = 0; this.paintBadge(); if (this.chat) setTimeout(() => { this.chat.el.querySelector('.chat-log').scrollTop = 1e9; }, 0); }
      this.layout();
    }
    paintBadge() {
      this.badge.hidden = this.unread <= 0;
      this.badge.textContent = this.unread > 9 ? '9+' : String(this.unread);
    }
    layout() {
      if (!this.main || !this.root.isConnected) return;
      const portrait = root.innerHeight > root.innerWidth;
      const showTouch = this.touchVisible();
      if (this.touchEl) this.touchEl.hidden = !showTouch;
      this.main.classList.toggle('has-touch', showTouch);
      this.main.classList.toggle('portrait', portrait);
      this.touchEl && this.touchEl.classList.toggle('flip', this.settings.stickSide === 'right');
      /* 控制鈕大小與位置依裝置（手機／平板 × 直放／橫放）決定，見 touchlayout.js */
      const TL = root.TouchLayout;
      this.main.style.setProperty('--gut', '0px'); this.main.style.setProperty('--gut-b', '0px');
      const cs = getComputedStyle(this.main);
      const pad = (a) => parseFloat(cs[a]) || 0;
      const baseW = this.main.clientWidth - pad('paddingLeft') - pad('paddingRight');
      const baseH = this.main.clientHeight - pad('paddingTop') - pad('paddingBottom');
      if (baseW < 40 || baseH < 40) return;
      const plan = TL.plan({ vw: root.innerWidth, vh: root.innerHeight, availW: baseW, availH: baseH, mapW: this.view.w, mapH: this.view.h, touch: showTouch, scale: this.settings.touchScale, player: this.slot != null, tile: root.Renderer.tileCss });
      const rs = this.root.style;
      rs.setProperty('--stick', plan.sizes.stick + 'px'); rs.setProperty('--knob', plan.sizes.knob + 'px'); rs.setProperty('--bomb', plan.sizes.bomb + 'px'); rs.setProperty('--edge', plan.edge + 'px');
      const op = Number(this.settings.touchOpacity);
      const idle = Number.isFinite(op) ? Math.max(TL.OPACITY_MIN, Math.min(TL.OPACITY_MAX, op)) : TL.OPACITY_IDLE;
      rs.setProperty('--tc-op', String(idle)); rs.setProperty('--tc-op-down', String(Math.max(idle, TL.OPACITY_DOWN)));
      this.main.style.setProperty('--gut', plan.gutter + 'px'); this.main.style.setProperty('--gut-b', plan.bottom + 'px');
      if (this.touchEl) this.touchEl.dataset.mode = plan.mode;
      this.rotateEl.hidden = plan.mode !== 'rotate';
      this.root.classList.toggle('rotate-block', plan.mode === 'rotate');
      this.touchPlan = plan;
      const availW = baseW - 2 * plan.gutter, availH = baseH - plan.bottom;
      if (availW < 40 || availH < 40) return;
      this.rend.fit(availW, availH, this.view.w, this.view.h);
      this.rend.dirty = true;
      this.placeHud();
    }

    /** 把資訊欄放在棋盤上方保留區；右上角的語言與設定鈕也貼著棋盤右緣 */
    placeHud() {
      const mr = this.main.getBoundingClientRect(), br = this.board.getBoundingClientRect();
      if (!br.width) return;
      const hh = 36;
      const top = Math.round(br.top - 46);
      const ms = this.main.style;
      ms.setProperty('--hud-h', hh + 'px');
      ms.setProperty('--hud-x', Math.round(br.left - mr.left) + 'px'); ms.setProperty('--hud-y', Math.round(top - mr.top) + 'px'); ms.setProperty('--hud-w', Math.round(br.width) + 'px');
      const de = document.documentElement.style;
      de.setProperty('--hud-h', hh + 'px'); de.setProperty('--hud-top', top + 'px'); de.setProperty('--hud-r', Math.round(root.innerWidth - br.right) + 'px');
      document.body.classList.add('in-game');
    }

    /* ----- 每格畫面 ----- */
    loop(t) {
      if (!this.alive) return;
      const now = t / 1000;
      let dt = this.last ? Math.min(0.1, now - this.last) : 0.016;
      this.last = now;
      if (this.kind === 'solo') this.stepSolo(dt); else this.predict(dt, now);
      this.rend.draw(this.view, {
        selfSlot: this.slot, mode: this.kind === 'solo' ? 'given' : 'smooth', selfPos: this.pred || null,
        colorAssist: this.settings.colorAssist, reduceMotion: this.settings.reduceMotion
      });
      this.updateHud(now);
      this.raf = requestAnimationFrame(tt => this.loop(tt));
    }

    stepSolo(dt) {
      const s = this.state;
      if (root.UI.modalOpen()) return;                 /* 開著彈窗（設定、選單）就暫停 */
      if (this.missionEnd) return;                     /* 教學關已經過關或失敗：畫面停住，等結果彈窗 */
      const me = this.slot != null ? s.players.find(p => p.slot === this.slot) : null;
      const dead = me && !me.alive && s.phase === 'play';
      this.acc += dt * (this.ff && dead ? 3 : 1);
      const evs = [];
      let guard = 0;
      while (this.acc >= R.DT && guard++ < 12) {
        for (const p of s.players) { p.px = p.x; p.py = p.y; }
        for (const p of s.players) {
          const br = this.cfg.brains[p.slot];
          if (br) {
            const o = root.AI.think(br, s, p, R.DT);
            this.inputs[p.slot].dir = o.dir; if (o.bomb) this.inputs[p.slot].bomb = true;
          }
        }
        R.step(s, this.inputs, R.DT);
        for (const e of s.events) evs.push(e);
        this.acc -= R.DT;
        if (s.phase === 'over' && s.endHold <= 0) break;
      }
      const a = Math.max(0, Math.min(1, this.acc / R.DT));
      for (const p of s.players) { p.rx = p.px + (p.x - p.px) * a; p.ry = p.py + (p.y - p.py) * a; }
      if (evs.length) this.handleEvents(evs);
      if (this.mission) { this.tickMission(evs); return; }
      if (s.phase === 'over' && !this.resultDone) {
        this.resultAt += dt;
        if (s.endHold <= 0 || this.resultAt > 2.5) { this.resultDone = true; this.cfg.onResult && this.cfg.onResult(s.result, s.players); }
      }
    }

    /* 線上：自己的角色在本機先走（同一套 Rules 碰撞），伺服器快照到了再校正。
       * 快照描述的是大約一個來回延遲之前的自己，所以拿本機「那個時間點」的位置來比，差太多才拉回來。 */
    predict(dt, now) {
      const v = this.view;
      const me = this.slot != null ? v.players.find(p => p.slot === this.slot) : null;
      if (!me || !me.alive || v.phase !== 'play') { this.pred = null; return; }
      if (!this.pred) this.pred = { x: me.x, y: me.y, dir: me.dir, acc: 0, hist: [], pass: new Set(), seen: new Set() };
      const pr = this.pred;
      const pm = { slot: me.slot, animal: me.animal, x: pr.x, y: pr.y, dir: pr.dir, moving: false, alive: true, curse: me.curse, speedLvl: me.speedLvl, superT: me.superT, kick: me.kick };
      /* 炸彈「可穿過」：剛出現時自己還站在上面就能走出來，離開那格後變實心（跟伺服器規則一樣） */
      for (const b of v.bombs) {
        if (!pr.seen.has(b.id)) { pr.seen.add(b.id); if (R.overlapsCell(pm, b.cx, b.cy)) pr.pass.add(b.id); }
      }
      pr.acc += dt;
      let n = 0;
      while (pr.acc >= R.DT && n++ < 8) {
        pr.acc -= R.DT;
        const bombs = v.bombs.map(b => ({ id: b.id, cx: b.cx, cy: b.cy, sl: b.sl, pass: pr.pass.has(b.id) ? [me.slot] : [] }));
        const tmp = { w: v.w, h: v.h, grid: v.grid, fx: v.fx, bombs, players: [pm], events: [] };
        R.movePlayer(tmp, pm, this.dir, R.DT);
        if (this.dir2 && this.dir2 !== this.dir && !pm.moving) R.movePlayer(tmp, pm, this.dir2, R.DT);
        R.conveyPlayer(tmp, pm, R.DT);
        for (const b of v.bombs) if (pr.pass.has(b.id) && !R.overlapsCell(pm, b.cx, b.cy)) pr.pass.delete(b.id);
      }
      pr.x = pm.x; pr.y = pm.y; pr.dir = pm.dir;
      pr.hist.push({ t: now, x: pr.x, y: pr.y });
      while (pr.hist.length > 2 && pr.hist[0].t < now - 2) pr.hist.shift();
    }
    reconcile() {
      const pr = this.pred;
      const me = pr && this.view.players.find(p => p.slot === this.slot);
      if (!pr || !me) return;
      if (!me.alive) { this.pred = null; return; }
      const now = performance.now() / 1000;
      const at = now - ((root.Net && root.Net.rtt) || 0.15) - 0.017;   /* 快照平均晚半個廣播間隔（30 次/秒） */
      const hs = pr.hist;
      let hx = pr.x, hy = pr.y;
      for (let i = hs.length - 1; i >= 0; i--) if (hs[i].t <= at) { hx = hs[i].x; hy = hs[i].y; break; }
      const ex = me.x - hx, ey = me.y - hy, err = Math.hypot(ex, ey);
      if (err > 1.5) { pr.x = me.x; pr.y = me.y; pr.hist = []; return; }   /* 被踢、被擋、傳送之類：直接對齊 */
      if (err < 0.04) return;
      const k = 0.3, cx = ex * k, cy = ey * k;
      pr.x += cx; pr.y += cy;
      for (const q of hs) { q.x += cx; q.y += cy; }
    }

    /* 線上：套用伺服器快照 */
    onSnap(snap) {
      const was = this.view.gridVer;
      R.applySnapshot(this.view, snap);
      this.reconcile();
      this.rend.markSnap();
      if (this.view.gridVer !== was) this.rend.dirty = true;
      this.handleEvents(snap.e || []);
    }

    handleEvents(evs) {
      const S = root.Sound, st = this.settings;
      this.rend.consume(evs, { reduceMotion: st.reduceMotion });
      for (const e of evs) {
        switch (e.t) {
          case 'place': S.sfx('place'); break;
          case 'boom': S.sfx('boom'); break;
          case 'brk': S.sfx('brk'); break;
          case 'plane': S.sfx('plane'); break;
          case 'airdrop': S.sfx('airdrop'); break;
          case 'sky': S.sfx('place'); break;
          case 'item':
            if (e.slot === this.slot) { S.sfx(e.type.indexOf('c_') === 0 ? 'curse' : 'item'); if (e.type.indexOf('c_') === 0) this.vibrate(80); }
            break;
          case 'shield': S.sfx('shield'); if (e.slot === this.slot) this.vibrate(60); break;
          case 'kick': S.sfx('kick'); break;
          case 'die': S.sfx('die'); if (e.slot === this.slot) this.vibrate(220); break;
          case 'count': S.sfx('count'); break;
          case 'go': S.sfx('go'); S.music('battle'); break;
          case 'over': {
            const w = e.winner;
            if (root.GameAnalytics && this.slot != null) root.GameAnalytics.end({ result: w == null ? 'draw' : (w === this.slot ? 'win' : 'lose') });
            S.sfx(w == null ? 'draw' : (w === this.slot ? 'win' : (this.slot == null ? 'win' : 'lose')));
            break;
          }
        }
      }
    }
    vibrate(ms) { if (this.settings.vibrate && root.navigator && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* 忽略 */ } } }

    /* ----- HUD 與左側 Summary ----- */
    updateHud(now) {
      if (now - this.hudAt < 0.1) return;
      this.hudAt = now;
      const v = this.view;
      if (this.pingEl) {
        const ms = root.Net && root.Net.connected && root.Net.rtt ? Math.round(root.Net.rtt * 1000) : null;
        const txt = ms == null ? '-- ms' : ms + ' ms';
        /* 燈號：≤30 綠、31～99 橙、≥100 紅 */
        const cls = 'ping' + (ms == null ? '' : ms <= 30 ? ' good' : ms < 100 ? ' mid' : ' bad');
        if (this.pingEl.textContent !== txt) this.pingEl.textContent = txt;
        if (this.pingEl.className !== cls) this.pingEl.className = cls;
      }
      /* 計時 */
      let txt;
      if (v.phase === 'countdown') txt = tr('game.ready');
      else if (v.timeLimit > 0) {
        const left = Math.max(0, v.timeLimit - v.time);
        txt = Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0');
        this.timerEl.classList.toggle('low', left <= 15 && v.phase === 'play');
      } else {
        txt = Math.floor(v.time / 60) + ':' + String(Math.floor(v.time % 60)).padStart(2, '0');
        this.timerEl.classList.remove('low');
      }
      if (this.timerEl.textContent !== txt) this.timerEl.textContent = txt;

      const me = this.slot != null ? v.players.find(p => p.slot === this.slot) : null;
      const sig = v.players.map(p => [p.slot, p.alive ? 1 : 0, p.kills, p.fire, p.maxBombs, p.speedLvl, p.kick ? 1 : 0, p.shield ? 1 : 0, p.curse ? p.curse.type + Math.ceil(p.curse.t) : '', Math.ceil(p.ghostT || 0), Math.ceil(p.superT || 0)].join(',')).join('|') + '|' + (me ? me.alive : '');
      if (sig === this.hudSig) return;
      this.hudSig = sig;

      this.chipsEl.textContent = '';
      for (const p of v.players) {
        this.chipsEl.appendChild(h('span', { class: 'hud-chip' + (p.alive ? '' : ' dead') + (p.slot === this.slot ? ' me' : ''), style: { borderColor: p.slot === this.slot ? '' : 'transparent' } },
          avatar(p.animal, 24), h('span', { class: 'kills' }, String(p.kills))));
      }
      this.sumEl.textContent = '';
      for (const p of v.players) {
        const lvl = p.kind === 'ai' && p.level ? root.AI.LEVELS[p.level].name : '';
        const who = lvl ? tr('game.cpuLevel', { lv: lvl }) : (p.kind === 'ai' ? tr('game.cpu') : tr('game.player'));
        this.sumEl.appendChild(h('div', { class: 'sum-row' + (p.slot === this.slot ? ' me' : '') + (p.alive ? '' : ' dead'), role: 'listitem' },
          h('span', { class: 'sum-dot', style: { background: R.SLOT_COLORS[p.slot % 8] } }),
          avatar(p.animal, 32),
          h('span', { class: 'nm' }, Art.playerName(p) + (p.slot === this.slot ? tr('game.you') : ''), h('small', null, who + (p.alive ? '' : (p.left ? tr('game.left') : tr('game.out'))))),
          h('span', { class: 'kills', title: tr('game.killsTitle') }, tr('game.kills', { n: p.kills }))));
      }
      this.specEl.hidden = this.slot != null;
      this.statsEl.hidden = !me;
      if (me) {
        const tile = (type, val, label, on) => h('div', { class: 'stat' + (on === false ? ' off' : '') }, h('img', { alt: '', src: Art.svgUrl(Art.itemSVG(type)) }), String(val), h('small', null, label));
        this.statsEl.textContent = '';
        this.statsEl.append(
          tile('fire', R.fireOf(me), tr('game.fire')), tile('bomb', R.maxBombsOf(me), tr('game.bombs')), tile('speed', R.speedLvlOf(me) + 1, tr('game.speed')),
          tile('kick', me.kick ? tr('game.yes') : tr('game.no'), tr('game.kick'), me.kick), tile('shield', me.shield ? tr('game.yes') : tr('game.no'), tr('game.shield'), me.shield));
        const buffs = [];
        if (me.alive && me.ghostT > 0) buffs.push(tr('game.buff', { name: Art.ITEM_NAMES.ghost, s: Math.ceil(me.ghostT) }));
        if (me.alive && me.superT > 0) buffs.push(tr('game.buff', { name: Art.ITEM_NAMES.super, s: Math.ceil(me.superT) }));
        this.buffEl.hidden = !buffs.length; this.buffEl.textContent = buffs.join('　');
        if (me.curse) { this.curseEl.hidden = false; this.curseEl.textContent = tr('game.buff', { name: Art.ITEM_NAMES[me.curse.type], s: Math.ceil(me.curse.t) }); } else this.curseEl.hidden = true;
        if (!me.alive) {
          this.ghost.hidden = false; this.ghost.textContent = me.left ? tr('game.leftShort') : tr('game.eliminated');
          if (this.kind === 'solo' && v.phase === 'play') {
            this.ghost.textContent = tr('game.eliminated');
            if (!this.ffBtn) { this.ffBtn = h('button', { type: 'button', class: 'btn btn-sun btn-sm', style: { marginLeft: '10px', pointerEvents: 'auto' }, onClick: () => { this.ff = !this.ff; this.ffBtn.textContent = this.ff ? tr('game.ffOff') : tr('game.ff'); } }, this.ff ? tr('game.ffOff') : tr('game.ff')); this.ghost.style.pointerEvents = 'auto'; }
            this.ghost.appendChild(this.ffBtn);
          }
        } else this.ghost.hidden = true;
      } else { this.curseEl.hidden = true; this.buffEl.hidden = true; this.ghost.hidden = true; }
    }

    destroy() {
      this.alive = false;
      cancelAnimationFrame(this.raf);
      document.removeEventListener('keydown', this.onKeyDown);
      document.removeEventListener('keyup', this.onKeyUp);
      root.removeEventListener('blur', this.onBlur);
      root.removeEventListener('pagehide', this.onBlur);
      document.removeEventListener('visibilitychange', this.onHidden);
      for (const k of ['--hud-top', '--hud-r', '--hud-h']) document.documentElement.style.removeProperty(k);
      document.body.classList.remove('in-game');
      root.removeEventListener('resize', this.onResize);
      root.removeEventListener('orientationchange', this.onResize);
      if (this.ro) this.ro.disconnect();
      if (this.chatSub) this.chatSub();
      this.root.remove();
    }
  }

  function UI_open() { return root.UI.modalOpen(); }

  root.GameScreen = GameScreen;
  root.createChat = createChat;
})(typeof self !== 'undefined' ? self : this);
