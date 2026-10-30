/* ===== app.js — 畫面切換、首頁、教學、單機設定、設定彈窗、結算 ===== */
(function (root) {
  'use strict';
  const { h, btn, seg, stepper, toggle, volume, avatar, keycap, toast, modal } = root.UI;
  const R = root.Rules, Art = root.Art, AI = root.AI;
  const $ = id => document.getElementById(id);

  const tr = (k, p) => root.I18N.t(k, p);
  /* 選項的 label／hint 都是 getter：每次建立畫面時依目前語言取字（字典在 locales.js） */
  const LAYOUT_OPTS = ['random', 'classic', 'open', 'dense'].map(v => ({ v, get label() { return tr('layout.' + v); } }));
  const TIME_OPTS = [120, 180, 300].map(v => ({ v, get label() { return tr('rules.min', { n: v / 60 }); } })).concat([{ v: 0, get label() { return tr('rules.noLimit'); } }]);
  const THEME_OPTS = [{ v: -1, get label() { return tr('theme.random'); } }].concat(Art.THEMES.map(t => ({ v: t.id, get label() { return t.name; } })));
  const LEVEL_OPTS = AI.LEVEL_ORDER.map(k => ({ v: k, get label() { return AI.LEVELS[k].name; } }));
  /* 下拉裡每一級都標出強度值（0～100，見 ai.js 的等級權重表），方便比較級距 */
  const LEVEL_DD = AI.LEVEL_ORDER.map(k => ({ v: k, get label() { return AI.LEVELS[k].name; }, get hint() { return tr('level.power', { n: Math.round(AI.power(AI.LEVELS[k])), hint: tr('level.hint.' + k) }); } }));
  /** 角色下拉選項；exclude 是別人（真人）已經在用、不能選的角色 */
  const animalOptions = exclude => Art.ANIMAL_IDS.filter(id => !(exclude || []).includes(id)).map(id => ({ v: id, label: Art.ANIMALS[id].name, hint: Art.ANIMALS[id].role }));
  const ADJ_N = 10;     /* 形容詞字典 name.adj0～9；自動暱稱只記編號，切換語言時跟著換 */

  const App = {
    store: root.Store.load(),
    screen: null, params: null, game: null, el: null,
    rooms: [], room: null, me: null, chatLog: [], chatSubs: new Set(),
    invite: null, screens: {}, onlineHooks: {}
  };
  root.App = App;

  function autoName(adj) { return tr('name.auto', { adj: tr('name.adj' + adj), animal: Art.ANIMALS[App.store.animal in Art.ANIMALS ? App.store.animal : 'cat'].name }); }
  function randomName() { return autoName(Math.floor(Math.random() * ADJ_N)); }
  function myName() { return (App.store.nickname || '').trim() || autoName(App.autoAdj != null ? App.autoAdj : (App.autoAdj = Math.floor(Math.random() * ADJ_N))); }
  function save() { root.Store.save(App.store); }
  function applySettings() {
    root.Sound.apply({ bgm: App.store.bgm, bgmVol: App.store.bgmVol, sfx: App.store.sfx, sfxVol: App.store.sfxVol });
    document.body.classList.toggle('calm', !!App.store.reduceMotion);
  }

  /* ---------- 畫面切換 ---------- */
  function clear() {
    if (App.game) { App.game.destroy(); App.game = null; }
    App.el.textContent = '';
  }
  function focusables() { return Array.from(App.el.querySelectorAll('button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')); }
  function go(name, params, opt) {
    if (root.ServerOutage) root.ServerOutage.setScreen(name);
    let focusIdx = -1;
    if (opt && opt.keepFocus && App.el.contains(document.activeElement)) focusIdx = focusables().indexOf(document.activeElement);
    clear();
    App.screen = name; App.params = params || null;
    const needNet = name === 'lobby' || name === 'room' || (name === 'game' && App.onlineGame);
    if (!needNet && !App.room) root.Net.close();
    const fn = App.screens[name];
    if (!fn) throw new Error('unknown screen: ' + name);
    const el = fn(params || {});
    if (el) { el.setAttribute('data-screen', name); App.el.appendChild(el); }
    /* 「← 回遊戲大廳」只在首頁出現，對戰與其他畫面不擋操作 */
    const lobbyLink = document.getElementById('lobby-home-link');
    if (lobbyLink) lobbyLink.hidden = name !== 'home';
    root.Sound.music(name === 'game' ? 'battle' : 'menu');
    if (focusIdx >= 0) { const f = focusables()[focusIdx]; if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ } }
    else if (!(opt && opt.quiet)) { const t = App.el.querySelector('h1,h2'); if (t) { t.setAttribute('tabindex', '-1'); try { t.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ } } }
    return el;
  }
  App.go = go;
  App.rerender = function () { if (App.screen === 'lobby' || App.screen === 'room') go(App.screen, App.params, { quiet: true, keepFocus: true }); };

  function screenBox(cls, kids) { return h('main', { class: 'screen ' + (cls || '') }, kids); }
  function topbar(title, backFn, extra) {
    return h('div', { class: 'topbar' }, backFn ? root.UI.iconBtn('back', tr('common.back'), backFn) : null, h('h2', null, title), extra);
  }

  /* ---------- 首頁 ---------- */
  App.screens.home = function () {
    const cast = Art.ANIMAL_IDS.map(id => avatar(id, 70));
    const st = App.store.stats;
    const sline = [];
    if (st.solo) sline.push(tr('home.recSolo', { w: st.solo.win, p: st.solo.play }));
    if (st.online) sline.push(tr('home.recOnline', { w: st.online.win, p: st.online.play }));
    return screenBox('home center', [
      h('div', { class: 'hero' },
        h('h1', { class: 'hero-title', 'aria-label': tr('home.title') }, Array.from(tr('home.title')).map(c => h('span', { 'aria-hidden': 'true' }, c === ' ' ? '\u00a0' : c))),
        h('p', { class: 'hero-sub' }, tr('home.sub')),
        h('div', { class: 'hero-cast' }, cast.slice(0, 4), h('img', { class: 'hero-bomb', alt: '', src: Art.svgUrl(Art.bombSVG()) }), cast.slice(4))),
      h('nav', { class: 'home-menu', 'aria-label': tr('home.menu') },
        btn(tr('home.tutorial'), { cls: 'btn-mint btn-lg btn-block', icon: 'flag', iconSize: 28, onClick: () => go('missions') }),
        btn(tr('home.solo'), { cls: 'btn-pink btn-lg btn-block', icon: 'robot', iconSize: 28, onClick: () => go('solo') }),
        btn(tr('home.online'), { cls: 'btn-sky btn-lg btn-block', icon: 'user', iconSize: 28, onClick: () => go('lobby') }),
        btn(tr('home.help'), { cls: 'btn-sun btn-lg btn-block', icon: 'help', iconSize: 28, onClick: () => go('help') }),
        btn(tr('home.cast'), { cls: 'btn-grape btn-lg btn-block', icon: 'paw', iconSize: 28, onClick: () => go('cast') })),
      sline.length ? h('p', { class: 'home-foot' }, tr('home.record', { s: sline.join('　') })) : null
    ]);
  };

  /* ---------- 角色介紹：每隻的定位、個性、開場能力與上限（深色是開場，淺色是撿道具最多能升到哪） ---------- */
  App.screens.cast = function () {
    const SPD = { 2: tr('cast.fast'), 1.5: tr('cast.mid'), 1: tr('cast.slow') };
    const stat = (item, label, start, cap, scale, text) => h('div', { class: 'cast-stat' },
      h('img', { alt: '', src: Art.svgUrl(Art.itemSVG(item)) }),
      h('span', null, label),
      h('span', { class: 'cast-bar', 'aria-hidden': 'true' },
        h('i', { class: 'cap', style: { width: Math.round(cap / scale * 100) + '%' } }),
        h('i', { style: { width: Math.round(start / scale * 100) + '%' } })),
      h('b', null, text));
    const cards = Art.ANIMAL_IDS.map(id => {
      const a = Art.ANIMALS[id], st = R.statsOf(id), mx = st.max;
      /* 跑速的長條用實際格／秒畫，開場快的加速次數少、慢的也一樣有上限 */
      const v0 = R.speedOf({ animal: id, speedLvl: 0 }), v1 = R.speedOf({ animal: id, speedLvl: mx.speed });
      return h('article', { class: 'cast-card' },
        avatar(id, 64),
        h('div', null, h('h3', null, a.name, h('span', { class: 'pill gray' }, a.role)), h('p', { class: 'muted small' }, a.intro)),
        h('div', { class: 'cast-stats' },
          stat('fire', tr('cast.fire'), st.fire, mx.fire, 12, tr('cast.tiles', { a: st.fire, b: mx.fire })),
          stat('bomb', tr('cast.bomb'), st.bomb, mx.bomb, 10, tr('cast.bombs', { a: st.bomb, b: mx.bomb })),
          stat('speed', tr('cast.speed'), v0, v1, 8, tr('cast.boosts', { s: SPD[st.speed], n: mx.speed }))));
    });
    return screenBox('', h('div', { class: 'wrap' },
      topbar(tr('cast.title'), () => go('home')),
      h('section', { class: 'card' },
        h('p', { class: 'muted small cast-note' }, tr('cast.note')),
        h('div', { class: 'cast-grid' }, cards)),
      h('div', { class: 'row', style: { justifyContent: 'center' } },
        btn(tr('cast.startSolo'), { cls: 'btn-pink btn-lg', onClick: () => go('solo') }),
        btn(tr('cast.home'), { cls: 'btn-ghost btn-lg', onClick: () => go('home') }))));
  };

  /* ---------- 教學（靜態圖文） ---------- */
  function blastFigure() {
    const cell = (x, y, fill, extra) => '<rect x="' + (x * 44 + 4) + '" y="' + (y * 44 + 4) + '" width="40" height="40" rx="9" fill="' + fill + '"' + (extra || '') + '/>';
    let s = '<svg class="help-fig" viewBox="0 0 228 228" role="img" aria-label="' + tr('help.figAria') + '">';
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) s += cell(x, y, (x + y) % 2 ? '#ffdbeb' : '#ffeaf4');
    s += cell(2, 0, '#ff9f45') + cell(2, 1, '#ff9f45') + cell(0, 2, '#ff9f45') + cell(1, 2, '#ff9f45') + cell(3, 2, '#ff9f45') + cell(2, 3, '#ff9f45') + cell(2, 2, '#ffd24d');
    s += cell(4, 2, '#d3438a') + '<rect x="180" y="92" width="40" height="40" rx="9" fill="#ff8fc4" stroke="#8a2d5e" stroke-width="3"/>';
    s += cell(2, 4, '#e6a65a') + '<path d="M104 190 l20 20 M124 190 l-20 20" stroke="#7a4a2a" stroke-width="4" stroke-linecap="round"/>';
    s += '<circle cx="114" cy="114" r="17" fill="#2f2a4d"/><path d="M114 97 q4 -9 12 -10" stroke="#c9a46a" stroke-width="4" fill="none" stroke-linecap="round"/>';
    s += '<text x="196" y="86" font-size="13" font-weight="800" fill="#6a2d8c" text-anchor="middle">' + tr('help.figHard') + '</text><text x="114" y="224" font-size="13" font-weight="800" fill="#7a4a2a" text-anchor="middle">' + tr('help.figSoft') + '</text></svg>';
    return h('div', { html: s });
  }
  App.screens.help = function () {
    const items = R.ITEM_TYPES.map(t => h('div', { class: 'item-row' }, h('img', { alt: '', src: Art.svgUrl(Art.itemSVG(t)) }), h('span', null, h('b', null, Art.ITEM_NAMES[t]), h('span', { class: 'muted small' }, Art.ITEM_DESC[t]))));
    return screenBox('', h('div', { class: 'wrap' },
      topbar(tr('help.title'), () => go('home')),
      h('div', { class: 'help-grid' },
        h('section', { class: 'card' }, h('h3', null, tr('help.goal')),
          h('p', null, tr('help.goal1')),
          h('p', { class: 'muted small', style: { marginTop: '6px' } }, tr('help.goal2')),
          h('p', { class: 'muted small', style: { marginTop: '6px' } }, tr('help.goal3'))),
        h('section', { class: 'card' }, h('h3', null, tr('help.controls')),
          h('p', null, tr('help.kbd')),
          h('p', { style: { margin: '6px 0' } }, tr('help.move'), keycap('W'), keycap('A'), keycap('S'), keycap('D'), tr('help.or'), keycap(tr('help.arrows'), 'wide')),
          h('p', { style: { margin: '6px 0' } }, tr('help.placeBomb'), keycap(tr('help.space'), 'wide'), tr('help.or'), keycap('Enter', 'wide')),
          h('p', { class: 'muted' }, tr('help.touch')))),
      h('section', { class: 'card' }, h('h3', null, tr('help.blast')),
        h('div', { class: 'row gap-lg' },
          h('div', { class: 'grow', style: { flexBasis: '260px' } }, blastFigure()),
          h('ol', { class: 'steps grow', style: { flexBasis: '260px' } },
            [1, 2, 3, 4, 5].map(n => h('li', null, tr('help.s' + n)))))),
      h('section', { class: 'card' }, h('h3', null, tr('help.items')),
        h('p', { class: 'muted small', style: { marginBottom: '8px' } }, tr('help.items1')),
        h('div', { class: 'item-list' }, items)),
      h('div', { class: 'row', style: { justifyContent: 'center' } },
        btn(tr('cast.startSolo'), { cls: 'btn-pink btn-lg', onClick: () => go('solo') }),
        btn(tr('cast.home'), { cls: 'btn-ghost btn-lg', onClick: () => go('home') }))));
  };

  /* ---------- 角色與暱稱 ---------- */
  App.profileEditor = function (o) {
    o = o || {};
    const st = App.store;
    const input = h('input', {
      class: 'text-input', type: 'text', maxlength: 10, value: st.nickname || '', placeholder: tr('profile.placeholder'), 'aria-label': tr('profile.nickname'), autocomplete: 'off', enterkeyhint: 'done',
      onInput: () => { st.nickname = input.value; save(); o.onChange && o.onChange(); }
    });
    const btns = Art.ANIMAL_IDS.map(id => h('button', {
      type: 'button', role: 'radio', class: 'animal-opt', 'aria-checked': st.animal === id ? 'true' : 'false', 'aria-label': Art.ANIMALS[id].name,
      onClick: () => {
        if (root.Sound) root.Sound.sfx('click');
        st.animal = id; save(); btns.forEach(b => b.setAttribute('aria-checked', b.dataset.id === id ? 'true' : 'false')); o.onChange && o.onChange();
      }
    }, avatar(id, 52), Art.ANIMALS[id].name));
    btns.forEach((b, i) => { b.dataset.id = Art.ANIMAL_IDS[i]; });
    return {
      el: h('div', null,
        h('div', { class: 'field' }, h('span', { class: 'label' }, tr('profile.nickname')), h('div', { class: 'ctl', style: { justifyContent: 'stretch' } }, input)),
        h('div', { class: 'field' }, h('span', { class: 'label' }, tr('profile.animal')), h('div', { class: 'ctl', style: { justifyContent: 'stretch' } }, h('div', { class: 'animal-grid', role: 'radiogroup', 'aria-label': tr('profile.choose'), style: { width: '100%' } }, btns)))),
      input
    };
  };

  /* ---------- 單機設定 ---------- */
  /** 單機電腦的角色：沿用上次選的，去掉重複和玩家自己的角色，不夠 7 隻再隨機補 */
  function aiAnimals() {
    const st = App.store, so = st.solo;
    const out = [];
    for (const a of Array.isArray(so.animals) ? so.animals : []) if (Art.ANIMALS[a] && a !== st.animal && !out.includes(a)) out.push(a);
    for (const a of pickAnimals(7, st.animal)) if (out.length < 7 && !out.includes(a)) out.push(a);
    so.animals = out;
    return out;
  }
  function pickAnimals(n, exclude) {
    const pool = Art.ANIMAL_IDS.filter(a => a !== exclude);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, n);
  }
  /* ---------- 精簡規則面板（單機與線上房間共用）：時間、道具、地圖主題三項，版型收在「更多」 ---------- */
  const ITEM_MODE_OPTS = [{ v: 'none', get label() { return tr('rules.itemNone'); } }, { v: 'items', get label() { return tr('rules.itemOn'); } }, { v: 'curses', get label() { return tr('rules.itemCurse'); } }];
  const itemMode = r => (!r.items ? 'none' : r.curses ? 'curses' : 'items');
  const itemPatch = v => ({ items: v !== 'none', curses: v === 'curses' });
  function rulesPanel(rules, set) {
    const f = (label, ctl) => h('div', { class: 'field' }, h('span', { class: 'label' }, label), h('div', { class: 'ctl' }, ctl));
    return h('div', { class: 'rules-panel' },
      f(tr('rules.time'), seg({ label: tr('rules.timeLimit'), options: TIME_OPTS, value: rules.timeLimit, onChange: v => set({ timeLimit: v }) })),
      f(tr('rules.items'), seg({ label: tr('rules.items'), options: ITEM_MODE_OPTS, value: itemMode(rules), onChange: v => set(itemPatch(v)) })),
      h('div', { class: 'field field-map' }, h('span', { class: 'label' }, tr('rules.map')),
        h('div', { class: 'ctl' }, root.MapPick.mapButton({ theme: rules.theme, layout: rules.layout, onChange: set }))));
  }
  function rulesSummary(r) {
    const pick = (opts, v) => { const o = opts.find(x => x.v === v); return o ? o.label : ''; };
    return [pick(TIME_OPTS, r.timeLimit), pick(ITEM_MODE_OPTS, itemMode(r)), pick(THEME_OPTS, r.theme), tr('rules.layoutSuffix', { l: r.theme === root.Rules.FAB_THEME ? tr('layout.fab') : pick(LAYOUT_OPTS, r.layout) })];
  }

  App.screens.solo = function () {
    const st = App.store, so = st.solo;
    const prof = App.profileEditor({ onChange: () => paintRows() });
    const rows = h('div', { class: 'ai-rows', hidden: false });
    let anim = aiAnimals();
    const face = h('div', { class: 'ai-faces' });
    const countCtl = stepper({ label: tr('solo.countLabel'), min: 1, max: 7, value: so.levels.length, onChange: v => {
      while (so.levels.length < v) so.levels.push(so.levels[so.levels.length - 1] || 'normal');
      so.levels.length = v; save(); paintRows();
    } });
    const allSeg = seg({ label: tr('solo.levelAll'), cls: 'small', options: LEVEL_OPTS, value: so.levels.every(l => l === so.levels[0]) ? so.levels[0] : null, onChange: v => {
      so.levels = so.levels.map(() => v);
      if (v === 'toddler') so.curses = false;
      save(); paintRows();
      if (v === 'toddler') paintPanel();   /* 規則面板的「道具」也要跟著改成不含詛咒 */
    } });
    const sizeNote = h('span', { class: 'pill gray' });
    const detailBtn = h('button', { type: 'button', class: 'more-btn', 'aria-expanded': App.aiDetail ? 'true' : 'false', onClick: () => {
      App.aiDetail = !App.aiDetail; rows.hidden = !App.aiDetail; detailBtn.setAttribute('aria-expanded', App.aiDetail ? 'true' : 'false'); detailBtn.firstChild.textContent = App.aiDetail ? tr('solo.collapse') : tr('solo.detail');
    } }, h('span', null, App.aiDetail ? tr('solo.collapse') : tr('solo.detail')), h('i', { 'aria-hidden': 'true' }));
    function paintRows() {
      { const z = R.sizeFor(1 + so.levels.length); sizeNote.textContent = z.w + '×' + z.h; }
      anim = aiAnimals();
      rows.textContent = ''; face.textContent = '';
      face.appendChild(h('span', { class: 'face me' }, avatar(st.animal, 40)));
      so.levels.forEach((lv, i) => {
        const a = anim[i];
        face.appendChild(h('span', { class: 'face', title: tr('solo.cpuTitle', { n: i + 1, lv: AI.LEVELS[lv].name }) }, avatar(a, 40)));
        rows.appendChild(h('div', { class: 'ai-row' },
          h('div', { class: 'ai-row-head' }, avatar(a, 36), h('span', { class: 'name' }, tr('solo.cpuN', { n: i + 1 }))),
          h('div', { class: 'ai-row-picks' },
            root.UI.dropdown({ label: tr('solo.cpuAnimal', { n: i + 1 }), cls: 'lvl', options: animalOptions([st.animal]), value: a, onChange: v => {
              /* 選到別台電腦正在用的角色就互換，避免重複 */
              const j = anim.indexOf(v);
              if (j >= 0) anim[j] = anim[i];
              anim[i] = v; so.animals = anim; save(); paintRows();
            } }),
            root.UI.dropdown({
              label: tr('solo.cpuLevel', { n: i + 1 }),
              cls: 'lvl',
              options: LEVEL_DD,
              value: lv,
              onChange: v => {
                so.levels[i] = v; save();
                allSeg.setValue(so.levels.every(l => l === so.levels[0]) ? so.levels[0] : null);
                paintFaces();
              }
            }))));
      });
      allSeg.setValue(so.levels.every(l => l === so.levels[0]) ? so.levels[0] : null);
      countCtl.setValue(so.levels.length);
    }
    function paintFaces() { face.querySelectorAll('.face:not(.me)').forEach((el, i) => { el.title = tr('solo.cpuTitle', { n: i + 1, lv: AI.LEVELS[so.levels[i]].name }); }); }
    paintRows();
    const f = (label, ctl) => h('div', { class: 'field' }, h('span', { class: 'label' }, label), h('div', { class: 'ctl' }, ctl));
    const panelBox = h('div');
    const paintPanel = () => { panelBox.textContent = ''; panelBox.appendChild(rulesPanel(so, patch => { Object.assign(so, patch); save(); })); };
    paintPanel();

    return screenBox('', h('div', { class: 'wrap' },
      topbar(tr('solo.title'), () => go('home')),
      h('div', { class: 'room-grid' },
        h('div', { style: { display: 'grid', gap: '14px' } },
          h('section', { class: 'card' }, h('h3', null, tr('solo.you')), prof.el),
          h('section', { class: 'card' }, h('h3', null, tr('solo.cpu'), sizeNote), face,
            f(tr('solo.count'), countCtl), rows)),
        h('div', { style: { display: 'grid', gap: '14px', alignContent: 'start' } },
          h('section', { class: 'card' }, h('h3', null, tr('solo.rules')), panelBox))),
      h('div', { class: 'sticky-cta' }, btn(tr('solo.start'), { cls: 'btn-pink btn-lg btn-block', icon: 'play', iconSize: 26, onClick: () => App.startSolo() }))));
  };

  /* ---------- 新手教學：關卡列表（前一關拿到星星才解鎖下一關）、開局、結果 ---------- */
  App.screens.missions = function () {
    const M = root.Missions, stars = App.store.missions || {};
    const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);
    const cards = M.MISSIONS.map(m => {
      const locked = !M.unlocked(m.id, stars), n = stars[m.id] | 0;
      const card = h('button', { type: 'button', class: 'card mission-card' + (locked ? ' locked' : '') + (n ? ' done' : ''), disabled: locked,
        'aria-label': tr('mission.level', { n: m.id }) + ' ' + tr('mission.' + m.id + '.title') + (locked ? '，' + tr('mission.locked') : '，' + tr('mission.stars', { n })) },
        h('span', { class: 'mission-no', 'aria-hidden': 'true' }, String(m.id)),
        h('span', { class: 'mission-txt' }, h('b', null, tr('mission.' + m.id + '.title')), h('small', null, locked ? tr('mission.locked') : tr('mission.' + m.id + '.goal'))),
        h('span', { class: 'mission-stars', 'aria-hidden': 'true' }, starText(n)));
      if (!locked) card.addEventListener('click', () => { root.Sound.sfx('click'); App.startMission(m.id); });
      return card;
    });
    return screenBox('', h('div', { class: 'wrap' },
      topbar(tr('mission.title'), () => go('home')),
      h('p', { class: 'muted' }, tr('home.tutorialDesc')),
      h('div', { class: 'mission-grid' }, cards)));
  };
  App.startMission = function (id) {
    const run = root.Missions.create(id, { animal: App.store.animal, name: myName(), foeName: Art.ANIMALS.bear.name, AI });
    if (!run) { go('missions'); return; }
    App.onlineGame = false;
    go('game', { kind: 'solo', state: run.state, brains: run.brains, info: R.startInfo(run.state), mission: run });
  };
  App.missionResult = function (run, r) {
    const M = root.Missions, id = run.id, win = r.status === 'win';
    if (win && r.stars > (App.store.missions[id] | 0)) { App.store.missions[id] = r.stars; save(); }     /* 只存一次，重建彈窗（切換語言）不會重複 */
    const next = M.MISSIONS.find(m => m.id === id + 1);
    const spec = () => ({
      title: null, aria: tr('mission.title'),
      content: h('div', { class: 'big-result', 'data-result-share': '' },
        h('div', { class: 'head' }, win ? tr('mission.win') : tr('mission.fail.' + (r.reason || 'dead'))),
        win ? h('div', { class: 'mission-stars big', 'aria-label': tr('mission.stars', { n: r.stars }) }, '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars)) : null,
        win && !next ? h('p', { class: 'muted' }, tr('mission.allDone')) : null),
      actions: [
        btn(tr('mission.back'), { cls: 'btn-ghost', onClick: () => { m.close(true); go('missions'); } }),
        btn(tr('mission.retry'), { cls: 'btn-sun', onClick: () => { m.close(true); App.startMission(id); } }),
        win && next ? btn(tr('mission.next'), { cls: 'btn-pink', onClick: () => { m.close(true); App.startMission(next.id); } }) : null
      ].filter(Boolean)
    });
    const m = modal(Object.assign({ dismissible: false, cls: 'dialog-sm', rebuild: spec }, spec()));
    return m;
  };

  /* ---------- 單機開局 ---------- */
  App.startSolo = function () {
    const st = App.store, so = st.solo;
    const animals = aiAnimals();
    const players = [{ slot: 0, name: myName(), animal: st.animal, kind: 'human' }];
    so.levels.forEach((lv, i) => players.push({ slot: i + 1, name: Art.ANIMALS[animals[i]].name, animal: animals[i], kind: 'ai', level: lv }));
    const seed = Math.floor(Math.random() * 4294967296) >>> 0;
    const state = R.createGame({ seed, players, layout: so.layout, themeId: so.theme, timeLimit: so.timeLimit, items: so.items, curses: so.curses });
    const brains = {};
    players.forEach(p => { if (p.kind === 'ai') brains[p.slot] = AI.createBrain(p.level, seed + p.slot * 977); });
    App.onlineGame = false;
    go('game', { kind: 'solo', state, brains, info: R.startInfo(state) });
  };

  /* ---------- 對戰畫面 ---------- */
  App.screens.game = function (p) {
    const solo = p.kind === 'solo';
    App.mission = p.mission ? { id: p.mission.id } : null;
    const gs = new root.GameScreen({
      kind: p.kind, info: p.info, slot: solo ? 0 : p.slot, settings: App.store,
      state: p.state, brains: p.brains, mission: p.mission || null, onMissionEnd: r => App.missionResult(p.mission, r),
      send: msg => root.Net.send(msg),
      chat: solo ? null : { send: t => root.Net.send({ type: 'chat', text: t }), list: () => App.chatLog, sub: fn => { App.chatSubs.add(fn); return () => App.chatSubs.delete(fn); } },
      onEsc: () => App.openMenu(),
      onResult: (result, players) => p.mission ? null : App.showResult({ result, players: players.map(q => ({ slot: q.slot, name: q.name, animal: q.animal, kind: q.kind, level: q.level, kills: q.kills, alive: q.alive })), slot: 0, kind: 'solo' })
    });
    App.game = gs;
    return gs.root;
  };

  App.openMenu = function () {
    if (root.UI.modalOpen()) return;
    const online = App.onlineGame;
    const spec = () => ({
      title: tr('pause.title'),
      content: h('p', { class: 'dialog-text' }, online ? tr('pause.textOnline') : tr('pause.text')),
      actions: online
        ? [btn(tr('pause.leave'), { cls: 'btn-pink', onClick: () => { m.close(true); App.confirmLeave(); } }), btn(tr('pause.resume'), { cls: 'btn-mint', onClick: () => m.close() })]
        : App.mission ? [btn(tr('pause.toMissions'), { cls: 'btn-ghost', onClick: () => { m.close(true); go('missions'); } }), btn(tr('pause.restart'), { cls: 'btn-sun', onClick: () => { m.close(true); App.startMission(App.mission.id); } }), btn(tr('pause.resume'), { cls: 'btn-mint', onClick: () => m.close() })]
        : [btn(tr('pause.toRoom'), { cls: 'btn-ghost', onClick: () => { m.close(true); go('solo'); } }), btn(tr('pause.restart'), { cls: 'btn-sun', onClick: () => { m.close(true); App.startSolo(); } }), btn(tr('pause.resume'), { cls: 'btn-mint', onClick: () => m.close() })]
    });
    const m = modal(Object.assign({ cls: 'dialog-sm', rebuild: spec }, spec()));
  };
  App.confirmLeave = function () {
    root.UI.confirmBox({ title: () => tr('leave.title'), text: () => tr('leave.text'), ok: () => tr('leave.ok'), danger: true, onOk: () => App.leaveRoom() });
  };
  App.leaveRoom = function () {
    root.Net.send({ type: 'leave' });
    App.room = null; App.onlineGame = false; App.chatLog = [];
    go('lobby');
  };

  /* ---------- 結算 ---------- */
  App.showResult = function (o) {
    const { result, players } = o;
    const byslot = {}; players.forEach(p => { byslot[p.slot] = p; });
    const me = o.slot != null ? byslot[o.slot] : null;
    const w = result.winner;
    let rec = null;
    if (o.slot != null) rec = root.Store.record(App.store, o.kind === 'solo' ? 'solo' : 'online', w === o.slot);   /* 只記一次，重建彈窗（切換語言）不會重複計 */
    const kills = {}; result.kills.forEach(k => { kills[k[0]] = k[1]; });
    const spec = () => {
      let head, sub;
      const wn = w != null && byslot[w] ? Art.playerName(byslot[w]) : '';
      if (w == null) { head = tr('result.draw'); sub = result.timeout ? tr('result.drawTimeout') : tr('result.drawBoom'); }
      else if (w === o.slot) { head = tr('result.youWin'); sub = result.reason === 'time' ? tr('result.youWinTime') : tr('result.youWinLast'); }
      else if (o.slot == null) { head = tr('result.nameWins', { name: wn }); sub = result.reason === 'time' ? tr('result.mostKos') : tr('result.lastOne'); }
      else { head = tr('result.lose'); sub = result.reason === 'time' ? tr('result.loseTime', { name: wn }) : tr('result.loseLast', { name: wn }); }
      const rank = h('div', { class: 'rank' }, result.ranking.map((slot, i) => {
        const p = byslot[slot]; if (!p) return null;
        return h('div', { class: 'rank-row' + (slot === w ? ' win' : '') },
          h('span', { class: 'no' }, String(i + 1)), avatar(p.animal, 38),
          h('span', { class: 'nm' }, Art.playerName(p) + (slot === o.slot ? tr('result.you') : '') + (p.kind === 'ai' && p.level ? '・' + AI.LEVELS[p.level].name : '')),
          h('span', { class: 'kills' }, tr('game.kills', { n: kills[slot] || 0 })));
      }));
      const mins = Math.floor(result.time / 60), secs = Math.floor(result.time % 60);
      const body = h('div', { class: 'big-result', 'data-result-share': '' }, h('div', { class: 'head' }, head), h('p', { class: 'muted' }, sub), rank,
        h('p', { class: 'muted small', style: { marginTop: '10px', textAlign: 'center' } }, tr('result.length', { m: mins, s: secs }) + (rec ? '　' + tr('result.record', { w: rec.win, p: rec.play }) : '')));
      let actions;
      if (o.kind === 'solo') {
        actions = [btn(tr('result.backRoom'), { cls: 'btn-ghost', onClick: () => { m.close(true); go('solo'); } }), btn(tr('result.again'), { cls: 'btn-pink', onClick: () => { m.close(true); App.startSolo(); } })];
      } else {
        const host = App.room && App.room.you && App.room.you.host;
        actions = [btn(tr('result.leave'), { cls: 'btn-ghost', onClick: () => { m.close(true); App.leaveRoom(); } }),
          btn(host ? tr('result.again') : tr('result.toRoom'), { cls: 'btn-pink', onClick: () => { m.close(true); if (host) root.Net.send({ type: 'rematch' }); go('room'); } })];
      }
      return { title: null, aria: tr('result.aria'), content: body, actions };
    };
    const m = modal(Object.assign({ dismissible: false, cls: 'dialog-lg', rebuild: spec }, spec()));
    App.resultModal = m;
    return m;
  };

  /* ---------- 設定彈窗 ---------- */
  App.openSettings = function () {
    if (App.settingsOpen) return;
    const st = App.store;
    const spec = () => {
      const bgmVol = volume({ label: tr('settings.bgmVol'), value: st.bgmVol, disabled: !st.bgm, onChange: v => { st.bgmVol = v; save(); applySettings(); } });
      const sfxVol = volume({ label: tr('settings.sfxVol'), value: st.sfxVol, disabled: !st.sfx, onChange: v => { st.sfxVol = v; save(); applySettings(); root.Sound.sfx('item'); } });
      const bgmSw = toggle({ label: tr('settings.bgm'), value: st.bgm, onChange: v => { st.bgm = v; save(); applySettings(); bgmVol.setDisabled(!v); } });
      const sfxSw = toggle({ label: tr('settings.sfx'), value: st.sfx, onChange: v => { st.sfx = v; save(); applySettings(); sfxVol.setDisabled(!v); if (v) root.Sound.sfx('item'); } });
      const vibSw = toggle({ label: tr('settings.vibrate'), value: st.vibrate, onChange: v => { st.vibrate = v; save(); if (v && navigator.vibrate) try { navigator.vibrate(40); } catch (e) { /* 忽略 */ } } });
      const calmSw = toggle({ label: tr('settings.calm'), value: st.reduceMotion, onChange: v => { st.reduceMotion = v; save(); applySettings(); } });
      const assistSw = toggle({ label: tr('settings.assist'), value: st.colorAssist, onChange: v => { st.colorAssist = v; save(); } });
      const touchSeg = seg({ label: tr('settings.touch'), options: [{ v: 'auto', label: tr('settings.auto') }, { v: 'on', label: tr('settings.show') }, { v: 'off', label: tr('settings.hide') }], value: st.touchMode, onChange: v => { st.touchMode = v; save(); App.game && App.game.layout(); } });
      const sideSeg = seg({ label: tr('settings.stick'), options: [{ v: 'left', label: tr('settings.left') }, { v: 'right', label: tr('settings.right') }], value: st.stickSide, onChange: v => { st.stickSide = v; save(); App.game && App.game.layout(); } });
      const scaleSeg = seg({ label: tr('settings.touchScale'), cls: 'small', options: [0.8, 0.9, 1, 1.1, 1.2, 1.3].map(v => ({ v, label: '×' + v })), value: st.touchScale, onChange: v => { st.touchScale = v; save(); App.game && App.game.layout(); } });
      const opacitySeg = seg({ label: tr('settings.touchOpacity'), cls: 'small', options: [0.3, 0.45, 0.6, 0.8].map(v => ({ v, label: Math.round(v * 100) + '%' })), value: st.touchOpacity, onChange: v => { st.touchOpacity = v; save(); App.game && App.game.layout(); } });
      const f = (label, ctl, hint) => h('div', { class: 'field' }, h('span', { class: 'label' }, label, hint ? h('span', { class: 'muted small' }, hint) : null), h('div', { class: 'ctl' }, ctl));
      const body = h('div', null,
        h('h3', { style: { margin: '4px 0' } }, tr('settings.sound')),
        f(tr('settings.bgm'), [bgmSw, bgmVol]), f(tr('settings.sfx'), [sfxSw, sfxVol]),
        h('h3', { style: { margin: '10px 0 4px' } }, tr('settings.controls')),
        f(tr('settings.touch'), touchSeg), f(tr('settings.stick'), sideSeg),
        f(tr('settings.touchScale'), scaleSeg), f(tr('settings.touchOpacity'), opacitySeg),
        navigator.vibrate ? f(tr('settings.vibrate'), vibSw) : null,
        f(tr('settings.calm'), calmSw), f(tr('settings.assist'), assistSw),
        h('p', { class: 'muted small' }, tr('settings.assistNote')));
      return {
        title: tr('settings.title'), content: body,
        actions: [btn(tr('settings.reset'), { cls: 'btn-ghost', onClick: () => { root.Store.resetSettings(st); applySettings(); App.game && App.game.layout(); m.close(true); App.settingsOpen = false; toast(tr('settings.resetDone')); App.openSettings(); } }), btn(tr('common.done'), { cls: 'btn-mint', onClick: () => m.close() })]
      };
    };
    const m = modal(Object.assign({ cls: 'dialog-lg', rebuild: spec, onClose: () => { App.settingsOpen = false; } }, spec()));
    App.settingsOpen = true;
    const origClose = m.close;
    m.close = function (silent) { App.settingsOpen = false; origClose(silent); };
  };

  /* ---------- 連線狀態橫幅 ---------- */
  App.banner = function (text, busy) {
    const b = $('banner');
    b.textContent = '';
    if (!text) return;
    b.appendChild(h('div', { class: 'banner' }, busy ? h('span', { class: 'spin', html: Art.icon('refresh', 18) }) : null, text));
  };

  /* ---------- 返回鍵（Android／瀏覽器） ---------- */
  function onBack() {
    if (root.UI.modalOpen()) { root.UI.closeTopModal(); return true; }
    switch (App.screen) {
      case 'help': case 'cast': case 'solo': go('home'); return true;
      case 'lobby': go('home'); return true;
      case 'room': App.confirmLeave(); return true;
      case 'game': App.openMenu(); return true;
    }
    return false;
  }

  /* ---------- 啟動 ---------- */
  App.boot = function () {
    App.el = $('app');
    const gear = $('gear');
    gear.innerHTML = Art.icon('gear', 26);
    /* 語言切換鈕放在設定鈕旁（樣式見 style.css 的 .lang-toggle） */
    root.I18N.mountToggle({ after: gear });
    const lobbyLink = $('lobby-home-link');
    const lobbyBase = lobbyLink ? lobbyLink.getAttribute('href') : '';
    const syncChrome = () => { if (lobbyLink) lobbyLink.setAttribute('href', root.I18N.withLang(lobbyBase)); };
    syncChrome();
    /* 切換語言：目前畫面重繪（對戰中只更新文字，不重開一局）；已開的彈窗由 ui.js 重建 */
    root.I18N.onChange(() => {
      syncChrome();
      if (App.refreshBanner) App.refreshBanner();
      if (App.screen === 'game') { if (App.game && App.game.relang) App.game.relang(); }
      else if (App.screen) go(App.screen, App.params, { quiet: true, keepFocus: true });
    });
    gear.addEventListener('click', () => { root.Sound.sfx('click'); App.openSettings(); });
    const unlock = () => { root.Sound.unlock(); };
    document.addEventListener('pointerdown', unlock, { once: false, passive: true });
    document.addEventListener('keydown', unlock, { passive: true });
    applySettings();
    history.replaceState({ g: 0 }, '');
    history.pushState({ g: 1 }, '');
    root.addEventListener('popstate', () => {
      if (App.screen === 'home' && !root.UI.modalOpen()) return;
      onBack();
      history.pushState({ g: 1 }, '');
    });
    if (root.Net && root.Net.onStatus && root.OnlineGlue) root.OnlineGlue.init();
    const q = new URLSearchParams(location.search);
    if (q.get('room') && q.get('invite')) {
      App.invite = { room: String(q.get('room')).toUpperCase().slice(0, 8), token: String(q.get('invite')).slice(0, 40), info: null, error: null };
      go('lobby');
    } else go('home');
  };

  App.util = { tr, LEVEL_DD, animalOptions, rulesPanel, rulesSummary, itemMode, myName, randomName, save, applySettings, topbar, screenBox, LAYOUT_OPTS, TIME_OPTS, THEME_OPTS, LEVEL_OPTS };

  document.addEventListener('DOMContentLoaded', () => App.boot());
})(typeof self !== 'undefined' ? self : this);
