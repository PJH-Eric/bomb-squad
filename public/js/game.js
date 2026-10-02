/* ===== game.js — 對戰畫面控制（單機與線上共用）：畫布、輸入、左側資訊欄、聊天室、觸控按鍵 ===== */
(function (root) {
  'use strict';
  const { h, avatar, keycap } = root.UI;
  const R = root.Rules, Art = root.Art;
  const QUICK = ['快跑！', '小心炸彈', '好險', '再來一局', 'GG'];

  /* ---------- 聊天室元件（房間與對戰共用） ---------- */
  function createChat(o) {
    const log = h('div', { class: 'chat-log', role: 'log', 'aria-live': 'polite', 'aria-label': '聊天室' });
    const input = h('input', { class: 'text-input', type: 'text', maxlength: 60, placeholder: '輸入訊息…', 'aria-label': '聊天訊息', enterkeyhint: 'send' });
    const send = () => {
      const t = input.value.trim();
      if (!t) return;
      o.send(t); input.value = '';
    };
    const form = h('form', { class: 'chat-form', onSubmit: e => { e.preventDefault(); send(); } }, input,
      h('button', { type: 'submit', class: 'btn btn-sky btn-sm' }, '送出'));
    const quick = o.quick === false ? null : h('div', { class: 'quick-chat' }, QUICK.map(q => h('button', { type: 'button', onClick: () => o.send(q) }, q)));
    const el = h('div', { class: 'chat-box' }, log, form, quick);
    function line(m) {
      if (m.role === 'sys') return h('div', { class: 'msg sys' }, m.text);
      return h('div', { class: 'msg ' + (m.role === 'spectator' ? 'spec' : '') }, h('b', null, m.name + (m.role === 'spectator' ? '（觀戰）' : '')), m.text);
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
    return { el, set, push, input };
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
      if (this.kind === 'solo') {
        this.state = cfg.state; this.view = cfg.state;
        this.inputs = {};
        for (const p of this.state.players) { this.inputs[p.slot] = { dir: null, bomb: false }; p.rx = p.x; p.ry = p.y; p.px = p.x; p.py = p.y; }
      } else {
        this.view = R.viewFromStart(cfg.info);
      }
      this.build();
      this.bind();
      this.layout();
      this.raf = requestAnimationFrame(t => this.loop(t));
    }

    /* ----- DOM ----- */
    build() {
      const s = this.settings, info = this.cfg.info;
      this.canvas = h('canvas', { 'aria-label': '對戰地圖', role: 'img' });
      this.board = h('div', { class: 'board' }, this.canvas);
      this.rend = new root.Renderer(this.canvas);

      this.timerEl = h('div', { class: 'hud-timer', 'aria-label': '剩餘時間' }, '--:--');
      this.chipsEl = h('div', { class: 'hud-chips' });
      this.hud = h('div', { class: 'hud' }, this.timerEl, this.chipsEl);

      this.sumEl = h('div', { class: 'summary', role: 'list', 'aria-label': '玩家狀態' });
      this.statsEl = h('div', { class: 'mystats' });
      this.curseEl = h('div', { class: 'curse-bar', hidden: true });
      this.keysEl = h('div', { hidden: true });
      this.specEl = h('div', { class: 'pill gray', hidden: true }, '觀戰中');

      const closeBtn = root.UI.iconBtn('back', '收合資訊欄', () => this.setSide(false), 'sm');
      const online = this.kind === 'online';
      const exitLabel = online ? '離開對局' : '暫停選單';
      this.sideHead = h('div', { class: 'side-head' }, h('h3', null, '對局'), root.UI.iconBtn(online ? 'close' : 'pause', exitLabel, () => this.cfg.onEsc && this.cfg.onEsc(), 'sm exit-in'), closeBtn);
      this.exitBtn = root.UI.iconBtn(online ? 'close' : 'pause', exitLabel, () => this.cfg.onEsc && this.cfg.onEsc(), 'exit-btn');
      this.side = h('aside', { class: 'game-side', 'aria-label': '對局資訊與聊天室' }, this.sideHead, this.sumEl, this.statsEl, this.curseEl, this.specEl);

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
      this.toggle = h('button', { type: 'button', class: 'icon-btn side-toggle on-wide', 'aria-label': '展開資訊欄與聊天室', title: '資訊欄', onClick: () => this.setSide(true) },
        h('span', { html: Art.icon('list', 22) }), this.badge);

      this.main = h('div', { class: 'game-main' }, this.board, this.hud);
      this.ghost = h('div', { class: 'ghost-msg', hidden: true });
      this.main.appendChild(this.ghost);
      this.touchEl = null;
      if (this.slot != null) this.buildTouch();
      /* 線上：右上角（設定鈕下方）顯示來回延遲 */
      this.pingEl = online ? h('div', { class: 'ping', role: 'status', 'aria-label': '連線延遲' }, '-- ms') : null;
      this.root = h('div', { class: 'game' }, this.side, this.main, this.toggle, this.exitBtn, this.pingEl);
      /* 滑鼠／觸控點完按鈕就放掉焦點：不然暫停→繼續後焦點回到暫停鈕，按空白鍵會再開一次選單而不是放炸彈（鍵盤 Tab 過去的照常可按） */
      this.root.addEventListener('pointerup', e => { const b = e.target.closest && e.target.closest('button'); if (b) b.blur(); });
      const narrow = root.innerWidth < 860 || root.innerHeight > root.innerWidth;
      if (narrow) this.root.classList.add('side-closed');
      this.applyTheme();
    }

    applyTheme() {
      const th = Art.THEMES[this.view.themeId] || Art.THEMES[0];
      this.root.style.setProperty('--stage', th.bg);
    }

    buildTouch() {
      const st = this.settings;
      this.knob = h('span', { class: 'knob' });
      this.stick = h('div', { class: 'stick', role: 'group', 'aria-label': '移動搖桿' },
        h('span', { class: 'arrow u' }), h('span', { class: 'arrow d' }), h('span', { class: 'arrow l' }), h('span', { class: 'arrow r' }), this.knob);
      this.bombBtn = h('button', { type: 'button', class: 'bomb-btn', 'aria-label': '放炸彈' },
        h('img', { alt: '', src: Art.svgUrl(Art.bombSVG()) }));
      this.touchEl = h('div', { class: 'touch' + (st.stickSide === 'right' ? ' flip' : ''), 'aria-hidden': 'false' }, this.stick, this.bombBtn);
      this.main.appendChild(this.touchEl);

      let activeId = null;
      const update = e => {
        const r = this.stick.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let dx = e.clientX - cx, dy = e.clientY - cy;
        const rad = r.width / 2, dist = Math.hypot(dx, dy);
        const lim = rad * 0.55;
        const k = dist > lim ? lim / dist : 1;
        this.knob.style.transform = 'translate(' + dx * k + 'px,' + dy * k + 'px)';
        let d = null, d2 = null;
        if (dist > rad * 0.24) {
          const ax = Math.abs(dx), ay = Math.abs(dy);
          const cur = this.stickDir;
          if (cur === 'L' || cur === 'R') d = ay > ax * 1.3 ? (dy > 0 ? 'D' : 'U') : (dx > 0 ? 'R' : 'L');
          else if (cur === 'U' || cur === 'D') d = ax > ay * 1.3 ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U');
          else d = ax > ay ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U');
          /* 斜推（次要軸至少主軸的 45%）：被擋住時沿次要軸走，貼著牆推也能滑到路口 */
          if (d === 'L' || d === 'R') { if (ay > ax * 0.45) d2 = dy > 0 ? 'D' : 'U'; }
          else if (ax > ay * 0.45) d2 = dx > 0 ? 'R' : 'L';
        }
        this.stickDir = d; this.stickDir2 = d2; this.refreshDir();
      };
      this.stick.addEventListener('pointerdown', e => { activeId = e.pointerId; this.stick.setPointerCapture(e.pointerId); update(e); e.preventDefault(); });
      this.stick.addEventListener('pointermove', e => { if (e.pointerId === activeId) update(e); });
      const end = e => { if (e.pointerId !== activeId) return; activeId = null; this.stickDir = null; this.stickDir2 = null; this.knob.style.transform = ''; this.refreshDir(); };
      this.stick.addEventListener('pointerup', end); this.stick.addEventListener('pointercancel', end);
      this.bombBtn.addEventListener('pointerdown', e => { e.preventDefault(); this.bombBtn.classList.add('down'); this.pressBomb(); });
      const up = () => this.bombBtn.classList.remove('down');
      this.bombBtn.addEventListener('pointerup', up); this.bombBtn.addEventListener('pointercancel', up); this.bombBtn.addEventListener('pointerleave', up);
      this.bombBtn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.pressBomb(); } });
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
      this.onBlur = () => { this.keys = []; this.stickDir = null; this.stickDir2 = null; this.refreshDir(); };
      this.onResize = () => this.layout();
      document.addEventListener('keydown', this.onKeyDown);
      document.addEventListener('keyup', this.onKeyUp);
      root.addEventListener('blur', this.onBlur);
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
      const cs = getComputedStyle(this.main);
      const pad = (a) => parseFloat(cs[a]) || 0;
      const portrait = root.innerHeight > root.innerWidth;
      const showTouch = this.touchVisible();
      if (this.touchEl) this.touchEl.hidden = !showTouch;
      this.main.classList.toggle('has-touch', showTouch);
      this.main.classList.toggle('portrait', portrait);
      this.touchEl && this.touchEl.classList.toggle('flip', this.settings.stickSide === 'right');
      const cs2 = getComputedStyle(this.main);
      const availW = this.main.clientWidth - pad('paddingLeft') - pad('paddingRight');
      const availH = this.main.clientHeight - parseFloat(cs2.paddingTop) - parseFloat(cs2.paddingBottom);
      if (availW < 40 || availH < 40) return;
      this.rend.fit(availW, availH, this.view.w, this.view.h);
      this.rend.dirty = true;
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
      const pm = { slot: me.slot, x: pr.x, y: pr.y, dir: pr.dir, moving: false, alive: true, curse: me.curse, speedLvl: me.speedLvl, kick: me.kick };
      /* 炸彈「可穿過」：剛出現時自己還站在上面就能走出來，離開那格後變實心（跟伺服器規則一樣） */
      for (const b of v.bombs) {
        if (!pr.seen.has(b.id)) { pr.seen.add(b.id); if (R.overlapsCell(pm, b.cx, b.cy)) pr.pass.add(b.id); }
      }
      pr.acc += dt;
      let n = 0;
      while (pr.acc >= R.DT && n++ < 8) {
        pr.acc -= R.DT;
        const bombs = v.bombs.map(b => ({ id: b.id, cx: b.cx, cy: b.cy, sl: b.sl, pass: pr.pass.has(b.id) ? [me.slot] : [] }));
        const tmp = { w: v.w, h: v.h, grid: v.grid, bombs, players: [pm], events: [] };
        R.movePlayer(tmp, pm, this.dir, R.DT);
        if (this.dir2 && this.dir2 !== this.dir && !pm.moving) R.movePlayer(tmp, pm, this.dir2, R.DT);
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
      const at = now - ((root.Net && root.Net.rtt) || 0.15) - 0.03;   /* 快照平均晚半個廣播間隔 */
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
        /* 燈號：<30 綠、30～99 橙、≥100 紅 */
        const cls = 'ping' + (ms == null ? '' : ms < 30 ? ' good' : ms < 100 ? ' mid' : ' bad');
        if (this.pingEl.textContent !== txt) this.pingEl.textContent = txt;
        if (this.pingEl.className !== cls) this.pingEl.className = cls;
      }
      /* 計時 */
      let txt;
      if (v.phase === 'countdown') txt = '準備！';
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
      const sig = v.players.map(p => [p.slot, p.alive ? 1 : 0, p.kills, p.fire, p.maxBombs, p.speedLvl, p.kick ? 1 : 0, p.shield ? 1 : 0, p.curse ? p.curse.type + Math.ceil(p.curse.t) : ''].join(',')).join('|') + '|' + (me ? me.alive : '');
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
        this.sumEl.appendChild(h('div', { class: 'sum-row' + (p.slot === this.slot ? ' me' : '') + (p.alive ? '' : ' dead'), role: 'listitem' },
          h('span', { class: 'sum-dot', style: { background: R.SLOT_COLORS[p.slot % 8] } }),
          avatar(p.animal, 32),
          h('span', { class: 'nm' }, p.name + (p.slot === this.slot ? '（你）' : ''), h('small', null, (lvl ? '電腦・' + lvl : (p.kind === 'ai' ? '電腦' : '玩家')) + (p.alive ? '' : (p.left ? '・已離場' : '・已淘汰')))),
          h('span', { class: 'kills', title: '擊倒數' }, '擊倒 ' + p.kills)));
      }
      this.specEl.hidden = this.slot != null;
      this.statsEl.hidden = !me;
      if (me) {
        const tile = (type, val, label, on) => h('div', { class: 'stat' + (on === false ? ' off' : '') }, h('img', { alt: '', src: Art.svgUrl(Art.itemSVG(type)) }), String(val), h('small', null, label));
        this.statsEl.textContent = '';
        this.statsEl.append(
          tile('fire', me.fire, '火力'), tile('bomb', me.maxBombs, '炸彈'), tile('speed', me.speedLvl + 1, '速度'),
          tile('kick', me.kick ? '有' : '無', '踢炸彈', me.kick), tile('shield', me.shield ? '有' : '無', '護盾', me.shield));
        if (me.curse) { this.curseEl.hidden = false; this.curseEl.textContent = Art.ITEM_NAMES[me.curse.type] + '・' + Math.ceil(me.curse.t) + ' 秒'; } else this.curseEl.hidden = true;
        if (!me.alive) {
          this.ghost.hidden = false; this.ghost.textContent = me.left ? '已離場' : '淘汰';
          if (this.kind === 'solo' && v.phase === 'play') {
            this.ghost.textContent = '淘汰';
            if (!this.ffBtn) { this.ffBtn = h('button', { type: 'button', class: 'btn btn-sun btn-sm', style: { marginLeft: '10px', pointerEvents: 'auto' }, onClick: () => { this.ff = !this.ff; this.ffBtn.textContent = this.ff ? '恢復速度' : '快轉'; } }, '快轉'); this.ghost.style.pointerEvents = 'auto'; }
            this.ghost.appendChild(this.ffBtn);
          }
        } else this.ghost.hidden = true;
      } else { this.curseEl.hidden = true; this.ghost.hidden = true; }
    }

    destroy() {
      this.alive = false;
      cancelAnimationFrame(this.raf);
      document.removeEventListener('keydown', this.onKeyDown);
      document.removeEventListener('keyup', this.onKeyUp);
      root.removeEventListener('blur', this.onBlur);
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
