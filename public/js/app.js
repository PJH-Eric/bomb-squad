/* ===== app.js — 畫面切換、首頁、教學、單機設定、設定彈窗、結算 ===== */
(function (root) {
  'use strict';
  const { h, btn, seg, stepper, toggle, volume, avatar, keycap, toast, modal } = root.UI;
  const R = root.Rules, Art = root.Art, AI = root.AI;
  const $ = id => document.getElementById(id);

  const LAYOUT_OPTS = [{ v: 'random', label: '隨機' }, { v: 'classic', label: '經典' }, { v: 'open', label: '空曠' }, { v: 'dense', label: '密集' }, { v: 'fab', label: '產線' }];
  const TIME_OPTS = [{ v: 120, label: '2 分' }, { v: 180, label: '3 分' }, { v: 300, label: '5 分' }, { v: 0, label: '不限時' }];
  const THEME_OPTS = [{ v: -1, label: '隨機' }].concat(Art.THEMES.map(t => ({ v: t.id, label: t.name })));
  const THEME_DD = [{ v: -1, label: '隨機', swatch: 'linear-gradient(135deg,#ff8fc4,#7fe3ff,#ffe03d)' }].concat(Art.THEMES.map(t => ({ v: t.id, label: t.name, swatch: 'linear-gradient(135deg,' + t.floorA + ' 0 50%,' + t.hard[1] + ' 50% 100%)' })));
  const LEVEL_OPTS = AI.LEVEL_ORDER.map(k => ({ v: k, label: AI.LEVELS[k].name }));
  const LEVEL_HINT = { toddler: '亂走、很少放炸彈', easy: '會躲炸彈、偶爾追人', normal: '會追人、會連鎖', hard: '會設陷阱、反應最快' };
  const LEVEL_DD = AI.LEVEL_ORDER.map(k => ({ v: k, label: AI.LEVELS[k].name, hint: LEVEL_HINT[k] }));
  /** 角色下拉選項；exclude 是別人（真人）已經在用、不能選的角色 */
  const animalOptions = exclude => Art.ANIMAL_IDS.filter(id => !(exclude || []).includes(id)).map(id => ({ v: id, label: Art.ANIMALS[id].name, hint: Art.ANIMALS[id].role }));
  const ADJ = ['快樂', '勇敢', '調皮', '害羞', '閃亮', '軟綿綿', '圓滾滾', '機靈', '呆萌', '活潑'];

  const App = {
    store: root.Store.load(),
    screen: null, params: null, game: null, el: null,
    rooms: [], room: null, me: null, chatLog: [], chatSubs: new Set(),
    invite: null, screens: {}, onlineHooks: {}
  };
  root.App = App;

  function randomName() { return ADJ[Math.floor(Math.random() * ADJ.length)] + Art.ANIMALS[App.store.animal in Art.ANIMALS ? App.store.animal : 'cat'].name; }
  function myName() { return (App.store.nickname || '').trim() || (App.autoAdj || (App.autoAdj = ADJ[Math.floor(Math.random() * ADJ.length)])) + Art.ANIMALS[App.store.animal in Art.ANIMALS ? App.store.animal : 'cat'].name; }
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
    let focusIdx = -1;
    if (opt && opt.keepFocus && App.el.contains(document.activeElement)) focusIdx = focusables().indexOf(document.activeElement);
    clear();
    App.screen = name; App.params = params || null;
    const needNet = name === 'lobby' || name === 'room' || (name === 'game' && App.onlineGame);
    if (!needNet && !App.room) root.Net.close();
    const fn = App.screens[name];
    if (!fn) throw new Error('沒有這個畫面：' + name);
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
    return h('div', { class: 'topbar' }, backFn ? root.UI.iconBtn('back', '返回', backFn) : null, h('h2', null, title), extra);
  }

  /* ---------- 首頁 ---------- */
  App.screens.home = function () {
    const cast = Art.ANIMAL_IDS.map(id => avatar(id, 70));
    const st = App.store.stats;
    const sline = [];
    if (st.solo) sline.push('單機 ' + st.solo.win + ' 勝／' + st.solo.play + ' 場');
    if (st.online) sline.push('線上 ' + st.online.win + ' 勝／' + st.online.play + ' 場');
    return screenBox('home center', [
      h('div', { class: 'hero' },
        h('h1', { class: 'hero-title', 'aria-label': '炸彈小隊' }, Array.from('炸彈小隊').map(c => h('span', { 'aria-hidden': 'true' }, c))),
        h('p', { class: 'hero-sub' }, '放炸彈、炸磚塊、撿道具，當最後的小隊長！'),
        h('div', { class: 'hero-cast' }, cast.slice(0, 4), h('img', { class: 'hero-bomb', alt: '', src: Art.svgUrl(Art.bombSVG()) }), cast.slice(4))),
      h('nav', { class: 'home-menu', 'aria-label': '主選單' },
        btn('一個人玩', { cls: 'btn-pink btn-lg btn-block', icon: 'robot', iconSize: 28, onClick: () => go('solo') }),
        btn('跟別人玩', { cls: 'btn-sky btn-lg btn-block', icon: 'user', iconSize: 28, onClick: () => go('lobby') }),
        btn('怎麼玩', { cls: 'btn-sun btn-lg btn-block', icon: 'help', iconSize: 28, onClick: () => go('help') }),
        btn('角色介紹', { cls: 'btn-grape btn-lg btn-block', icon: 'paw', iconSize: 28, onClick: () => go('cast') })),
      sline.length ? h('p', { class: 'home-foot' }, '本機戰績：' + sline.join('　')) : null
    ]);
  };

  /* ---------- 角色介紹：每隻的定位、個性、開場能力與上限（深色是開場，淺色是撿道具最多能升到哪） ---------- */
  App.screens.cast = function () {
    const SPD = { 2: '快', 1.5: '中', 1: '慢' };
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
          stat('fire', '火力', st.fire, mx.fire, 9, st.fire + '→' + mx.fire + ' 格'),
          stat('bomb', '炸彈', st.bomb, mx.bomb, 8, st.bomb + '→' + mx.bomb + ' 顆'),
          stat('speed', '跑速', v0, v1, 7.4, SPD[st.speed] + ' +' + mx.speed + ' 次')));
    });
    return screenBox('', h('div', { class: 'wrap' },
      topbar('角色介紹', () => go('home')),
      h('section', { class: 'card' },
        h('p', { class: 'muted small cast-note' }, '每隻的開場能力都在 1～2 之間：火力或炸彈多的，跑得就慢一點。撿道具能升級，但每隻的上限不一樣（深色是開場、淺色是最多能升到哪；跑速的「+5 次」是最多能加速幾次），三項上限加起來每隻都一樣多，沒有誰全面比較強，挑喜歡的玩法就好。'),
        h('div', { class: 'cast-grid' }, cards)),
      h('div', { class: 'row', style: { justifyContent: 'center' } },
        btn('開始單機練習', { cls: 'btn-pink btn-lg', onClick: () => go('solo') }),
        btn('回首頁', { cls: 'btn-ghost btn-lg', onClick: () => go('home') }))));
  };

  /* ---------- 教學（靜態圖文） ---------- */
  function blastFigure() {
    const cell = (x, y, fill, extra) => '<rect x="' + (x * 44 + 4) + '" y="' + (y * 44 + 4) + '" width="40" height="40" rx="9" fill="' + fill + '"' + (extra || '') + '/>';
    let s = '<svg class="help-fig" viewBox="0 0 228 228" role="img" aria-label="爆炸示意圖：炸彈往上下左右噴出火焰，遇到硬牆停下，炸掉第一塊軟磚">';
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) s += cell(x, y, (x + y) % 2 ? '#ffdbeb' : '#ffeaf4');
    s += cell(2, 0, '#ff9f45') + cell(2, 1, '#ff9f45') + cell(0, 2, '#ff9f45') + cell(1, 2, '#ff9f45') + cell(3, 2, '#ff9f45') + cell(2, 3, '#ff9f45') + cell(2, 2, '#ffd24d');
    s += cell(4, 2, '#d3438a') + '<rect x="180" y="92" width="40" height="40" rx="9" fill="#ff8fc4" stroke="#8a2d5e" stroke-width="3"/>';
    s += cell(2, 4, '#e6a65a') + '<path d="M104 190 l20 20 M124 190 l-20 20" stroke="#7a4a2a" stroke-width="4" stroke-linecap="round"/>';
    s += '<circle cx="114" cy="114" r="17" fill="#2f2a4d"/><path d="M114 97 q4 -9 12 -10" stroke="#c9a46a" stroke-width="4" fill="none" stroke-linecap="round"/>';
    s += '<text x="196" y="86" font-size="13" font-weight="800" fill="#6a2d8c" text-anchor="middle">硬牆</text><text x="114" y="224" font-size="13" font-weight="800" fill="#7a4a2a" text-anchor="middle">軟磚</text></svg>';
    return h('div', { html: s });
  }
  App.screens.help = function () {
    const items = R.ITEM_TYPES.map(t => h('div', { class: 'item-row' }, h('img', { alt: '', src: Art.svgUrl(Art.itemSVG(t)) }), h('span', null, h('b', null, Art.ITEM_NAMES[t]), h('span', { class: 'muted small' }, Art.ITEM_DESC[t]))));
    return screenBox('', h('div', { class: 'wrap' },
      topbar('怎麼玩', () => go('home')),
      h('div', { class: 'help-grid' },
        h('section', { class: 'card' }, h('h3', null, '目標'),
          h('p', null, '在方格地圖上放炸彈，炸開軟磚、撿道具、把對手炸出局。場上只剩你一個，就是勝利者！'),
          h('p', { class: 'muted small', style: { marginTop: '6px' } }, '時間到還有好幾人活著時，擊倒對手最多的人獲勝，同分就是平手。')),
        h('section', { class: 'card' }, h('h3', null, '操作'),
          h('p', null, '電腦鍵盤：'),
          h('p', { style: { margin: '6px 0' } }, '移動　', keycap('W'), keycap('A'), keycap('S'), keycap('D'), ' 或 ', keycap('方向鍵', 'wide')),
          h('p', { style: { margin: '6px 0' } }, '放炸彈 ', keycap('空白鍵', 'wide'), ' 或 ', keycap('Enter', 'wide')),
          h('p', { class: 'muted' }, '平板與手機：左下角搖桿移動、右下角粉紅按鈕放炸彈（設定裡可以換左右手）。'))),
      h('section', { class: 'card' }, h('h3', null, '炸彈怎麼炸'),
        h('div', { class: 'row gap-lg' },
          h('div', { class: 'grow', style: { flexBasis: '260px' } }, blastFigure()),
          h('ol', { class: 'steps grow', style: { flexBasis: '260px' } },
            h('li', null, '放下炸彈約 3 秒後爆炸，往上下左右噴出火焰，長度就是你的「火力」。'),
            h('li', null, '火焰被硬牆擋住；碰到軟磚會把它炸掉，並且在那裡停下。'),
            h('li', null, '火焰碰到別的炸彈會立刻引爆它，形成連鎖爆炸！'),
            h('li', null, '剛放下炸彈時可以走開，離開後它就變成障礙物。'),
            h('li', null, '被火焰碰到就出局，自己的炸彈也一樣，小心逃生。')))),
      h('section', { class: 'card' }, h('h3', null, '道具'),
        h('p', { class: 'muted small', style: { marginBottom: '8px' } }, '炸開軟磚有機會掉出道具；每隔 45 秒還會有空投機飛過地圖，投下 1～2 個好道具。圓形是好道具，帶尖刺的紫色外框是詛咒，會限時捉弄你。出局時，身上一半的強化道具會噴出來。'),
        h('div', { class: 'item-list' }, items)),
      h('div', { class: 'row', style: { justifyContent: 'center' } },
        btn('開始單機練習', { cls: 'btn-pink btn-lg', onClick: () => go('solo') }),
        btn('回首頁', { cls: 'btn-ghost btn-lg', onClick: () => go('home') }))));
  };

  /* ---------- 角色與暱稱 ---------- */
  App.profileEditor = function (o) {
    o = o || {};
    const st = App.store;
    const input = h('input', {
      class: 'text-input', type: 'text', maxlength: 10, value: st.nickname || '', placeholder: '幫自己取個名字（最多 10 字）', 'aria-label': '暱稱', autocomplete: 'off', enterkeyhint: 'done',
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
        h('div', { class: 'field' }, h('span', { class: 'label' }, '暱稱'), h('div', { class: 'ctl', style: { justifyContent: 'stretch' } }, input)),
        h('div', { class: 'field' }, h('span', { class: 'label' }, '角色'), h('div', { class: 'ctl', style: { justifyContent: 'stretch' } }, h('div', { class: 'animal-grid', role: 'radiogroup', 'aria-label': '選擇角色', style: { width: '100%' } }, btns)))),
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
  const ITEM_MODE_OPTS = [{ v: 'none', label: '無道具' }, { v: 'items', label: '有道具' }, { v: 'curses', label: '道具＋詛咒' }];
  const itemMode = r => (!r.items ? 'none' : r.curses ? 'curses' : 'items');
  const itemPatch = v => ({ items: v !== 'none', curses: v === 'curses' });
  function rulesPanel(rules, set) {
    const f = (label, ctl) => h('div', { class: 'field' }, h('span', { class: 'label' }, label), h('div', { class: 'ctl' }, ctl));
    return h('div', { class: 'rules-panel' },
      f('時間', seg({ label: '時間限制', options: TIME_OPTS, value: rules.timeLimit, onChange: v => set({ timeLimit: v }) })),
      f('道具', seg({ label: '道具', options: ITEM_MODE_OPTS, value: itemMode(rules), onChange: v => set(itemPatch(v)) })),
      h('div', { class: 'field field-map' }, h('span', { class: 'label' }, '地圖'),
        h('div', { class: 'ctl' }, root.MapPick.mapButton({ theme: rules.theme, layout: rules.layout, onChange: set }))));
  }
  function rulesSummary(r) {
    const pick = (opts, v) => { const o = opts.find(x => x.v === v); return o ? o.label : ''; };
    return [pick(TIME_OPTS, r.timeLimit), pick(ITEM_MODE_OPTS, itemMode(r)), pick(THEME_OPTS, r.theme), pick(LAYOUT_OPTS, r.layout) + '版型'];
  }

  App.screens.solo = function () {
    const st = App.store, so = st.solo;
    const prof = App.profileEditor({ onChange: () => paintRows() });
    const rows = h('div', { class: 'ai-rows', hidden: false });
    let anim = aiAnimals();
    const face = h('div', { class: 'ai-faces' });
    const countCtl = stepper({ label: '電腦數量', min: 1, max: 7, value: so.levels.length, onChange: v => {
      while (so.levels.length < v) so.levels.push(so.levels[so.levels.length - 1] || 'normal');
      so.levels.length = v; save(); paintRows();
    } });
    const allSeg = seg({ label: '電腦難度', cls: 'small', options: LEVEL_OPTS, value: so.levels.every(l => l === so.levels[0]) ? so.levels[0] : null, onChange: v => {
      so.levels = so.levels.map(() => v);
      if (v === 'toddler') so.curses = false;
      save(); paintRows();
      if (v === 'toddler') paintPanel();   /* 規則面板的「道具」也要跟著改成不含詛咒 */
    } });
    const sizeNote = h('span', { class: 'pill gray' });
    const detailBtn = h('button', { type: 'button', class: 'more-btn', 'aria-expanded': App.aiDetail ? 'true' : 'false', onClick: () => {
      App.aiDetail = !App.aiDetail; rows.hidden = !App.aiDetail; detailBtn.setAttribute('aria-expanded', App.aiDetail ? 'true' : 'false'); detailBtn.firstChild.textContent = App.aiDetail ? '收起' : '逐一調整角色與難度';
    } }, h('span', null, App.aiDetail ? '收起' : '逐一調整角色與難度'), h('i', { 'aria-hidden': 'true' }));
    function paintRows() {
      sizeNote.textContent = (1 + so.levels.length) <= 4 ? '15×13' : '17×15';
      anim = aiAnimals();
      rows.textContent = ''; face.textContent = '';
      face.appendChild(h('span', { class: 'face me' }, avatar(st.animal, 40)));
      so.levels.forEach((lv, i) => {
        const a = anim[i];
        face.appendChild(h('span', { class: 'face', title: '電腦 ' + (i + 1) + '・' + AI.LEVELS[lv].name }, avatar(a, 40)));
        rows.appendChild(h('div', { class: 'ai-row' }, avatar(a, 36), h('span', { class: 'name' }, '電腦 ' + (i + 1)),
          root.UI.dropdown({ label: '電腦 ' + (i + 1) + ' 角色', cls: 'lvl', options: animalOptions([st.animal]), value: a, onChange: v => {
            /* 選到別台電腦正在用的角色就互換，避免重複 */
            const j = anim.indexOf(v);
            if (j >= 0) anim[j] = anim[i];
            anim[i] = v; so.animals = anim; save(); paintRows();
          } }),
          root.UI.dropdown({ label: '電腦 ' + (i + 1) + ' 難度', cls: 'lvl', options: LEVEL_DD, value: lv, onChange: v => { so.levels[i] = v; save(); allSeg.setValue(so.levels.every(l => l === so.levels[0]) ? so.levels[0] : null); paintFaces(); } })));
      });
      allSeg.setValue(so.levels.every(l => l === so.levels[0]) ? so.levels[0] : null);
      countCtl.setValue(so.levels.length);
    }
    function paintFaces() { face.querySelectorAll('.face:not(.me)').forEach((el, i) => { el.title = '電腦 ' + (i + 1) + '・' + AI.LEVELS[so.levels[i]].name; }); }
    paintRows();
    const f = (label, ctl) => h('div', { class: 'field' }, h('span', { class: 'label' }, label), h('div', { class: 'ctl' }, ctl));
    const panelBox = h('div');
    const paintPanel = () => { panelBox.textContent = ''; panelBox.appendChild(rulesPanel(so, patch => { Object.assign(so, patch); save(); })); };
    paintPanel();

    return screenBox('', h('div', { class: 'wrap' },
      topbar('一個人玩', () => go('home')),
      h('div', { class: 'room-grid' },
        h('div', { style: { display: 'grid', gap: '14px' } },
          h('section', { class: 'card' }, h('h3', null, '你的角色'), prof.el),
          h('section', { class: 'card' }, h('h3', null, '電腦對手', sizeNote), face,
            f('數量', countCtl), rows)),
        h('div', { style: { display: 'grid', gap: '14px', alignContent: 'start' } },
          h('section', { class: 'card' }, h('h3', null, '規則'), panelBox))),
      h('div', { class: 'sticky-cta' }, btn('開始遊戲', { cls: 'btn-pink btn-lg btn-block', icon: 'play', iconSize: 26, onClick: () => App.startSolo() }))));
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
    const gs = new root.GameScreen({
      kind: p.kind, info: p.info, slot: solo ? 0 : p.slot, settings: App.store,
      state: p.state, brains: p.brains,
      send: msg => root.Net.send(msg),
      chat: solo ? null : { send: t => root.Net.send({ type: 'chat', text: t }), list: () => App.chatLog, sub: fn => { App.chatSubs.add(fn); return () => App.chatSubs.delete(fn); } },
      onEsc: () => App.openMenu(),
      onResult: (result, players) => App.showResult({ result, players: players.map(q => ({ slot: q.slot, name: q.name, animal: q.animal, kind: q.kind, level: q.level, kills: q.kills, alive: q.alive })), slot: 0, kind: 'solo' })
    });
    App.game = gs;
    return gs.root;
  };

  App.openMenu = function () {
    if (root.UI.modalOpen()) return;
    const online = App.onlineGame;
    const m = modal({
      title: '暫停', cls: 'dialog-sm',
      content: h('p', { class: 'dialog-text' }, online ? '線上對局不會暫停，其他人還在繼續。' : '遊戲已暫停。'),
      actions: online
        ? [btn('離開房間', { cls: 'btn-pink', onClick: () => { m.close(true); App.confirmLeave(); } }), btn('繼續', { cls: 'btn-mint', onClick: () => m.close() })]
        : [btn('回首頁', { cls: 'btn-ghost', onClick: () => { m.close(true); go('home'); } }), btn('重新開始', { cls: 'btn-sun', onClick: () => { m.close(true); App.startSolo(); } }), btn('繼續', { cls: 'btn-mint', onClick: () => m.close() })]
    });
  };
  App.confirmLeave = function () {
    root.UI.confirmBox({ title: '離開房間？', text: '離開後會回到線上大廳。', ok: '離開', danger: true, onOk: () => App.leaveRoom() });
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
    let head, sub;
    if (w == null) { head = '平手！'; sub = result.timeout ? '時間到，擊倒數相同' : '最後的人同時被炸到了'; }
    else if (w === o.slot) { head = '你贏了！'; sub = result.reason === 'time' ? '時間到，你擊倒最多！' : '你是最後的倖存者！'; }
    else if (o.slot == null) { head = byslot[w].name + ' 獲勝！'; sub = result.reason === 'time' ? '時間到，擊倒數最多' : '最後的倖存者'; }
    else { head = '這次輸了…'; sub = byslot[w].name + (result.reason === 'time' ? ' 擊倒最多，贏了這局' : ' 是最後的倖存者'); }
    if (o.slot != null && !o.recorded) {
      const s = root.Store.record(App.store, o.kind === 'solo' ? 'solo' : 'online', w === o.slot);
      o.statLine = '本機戰績：' + s.win + ' 勝／' + s.play + ' 場';
    }
    const kills = {}; result.kills.forEach(k => { kills[k[0]] = k[1]; });
    const rank = h('div', { class: 'rank' }, result.ranking.map((slot, i) => {
      const p = byslot[slot]; if (!p) return null;
      return h('div', { class: 'rank-row' + (slot === w ? ' win' : '') },
        h('span', { class: 'no' }, String(i + 1)), avatar(p.animal, 38),
        h('span', { class: 'nm' }, p.name + (slot === o.slot ? '（你）' : '') + (p.kind === 'ai' && p.level ? '・' + AI.LEVELS[p.level].name : '')),
        h('span', { class: 'kills' }, '擊倒 ' + (kills[slot] || 0)));
    }));
    const mins = Math.floor(result.time / 60), secs = Math.floor(result.time % 60);
    const body = h('div', { class: 'big-result' }, h('div', { class: 'head' }, head), h('p', { class: 'muted' }, sub), rank,
      h('p', { class: 'muted small', style: { marginTop: '10px', textAlign: 'center' } }, '這局共 ' + mins + ' 分 ' + secs + ' 秒' + (o.statLine ? '　' + o.statLine : '')));
    let actions;
    if (o.kind === 'solo') {
      actions = [btn('回首頁', { cls: 'btn-ghost', onClick: () => { m.close(true); go('home'); } }), btn('再來一局', { cls: 'btn-pink', onClick: () => { m.close(true); App.startSolo(); } })];
    } else {
      const host = App.room && App.room.you && App.room.you.host;
      actions = [btn('離開房間', { cls: 'btn-ghost', onClick: () => { m.close(true); App.leaveRoom(); } }),
        btn(host ? '再來一局' : '回到房間', { cls: 'btn-pink', onClick: () => { m.close(true); if (host) root.Net.send({ type: 'rematch' }); go('room'); } })];
    }
    const m = modal({ title: null, aria: '對局結果', content: body, actions, dismissible: false, cls: 'dialog-lg' });
    App.resultModal = m;
    return m;
  };

  /* ---------- 設定彈窗 ---------- */
  App.openSettings = function () {
    if (App.settingsOpen) return;
    const st = App.store;
    const bgmVol = volume({ label: '音樂音量', value: st.bgmVol, disabled: !st.bgm, onChange: v => { st.bgmVol = v; save(); applySettings(); } });
    const sfxVol = volume({ label: '音效音量', value: st.sfxVol, disabled: !st.sfx, onChange: v => { st.sfxVol = v; save(); applySettings(); root.Sound.sfx('item'); } });
    const bgmSw = toggle({ label: '背景音樂', value: st.bgm, onChange: v => { st.bgm = v; save(); applySettings(); bgmVol.setDisabled(!v); } });
    const sfxSw = toggle({ label: '音效', value: st.sfx, onChange: v => { st.sfx = v; save(); applySettings(); sfxVol.setDisabled(!v); if (v) root.Sound.sfx('item'); } });
    const vibSw = toggle({ label: '震動', value: st.vibrate, onChange: v => { st.vibrate = v; save(); if (v && navigator.vibrate) try { navigator.vibrate(40); } catch (e) { /* 忽略 */ } } });
    const calmSw = toggle({ label: '減少動態', value: st.reduceMotion, onChange: v => { st.reduceMotion = v; save(); applySettings(); } });
    const assistSw = toggle({ label: '形狀輔助', value: st.colorAssist, onChange: v => { st.colorAssist = v; save(); } });
    const touchSeg = seg({ label: '觸控按鍵', options: [{ v: 'auto', label: '自動' }, { v: 'on', label: '顯示' }, { v: 'off', label: '隱藏' }], value: st.touchMode, onChange: v => { st.touchMode = v; save(); App.game && App.game.layout(); } });
    const sideSeg = seg({ label: '搖桿位置', options: [{ v: 'left', label: '左手邊' }, { v: 'right', label: '右手邊' }], value: st.stickSide, onChange: v => { st.stickSide = v; save(); App.game && App.game.layout(); } });
    const f = (label, ctl, hint) => h('div', { class: 'field' }, h('span', { class: 'label' }, label, hint ? h('span', { class: 'muted small' }, hint) : null), h('div', { class: 'ctl' }, ctl));
    const body = h('div', null,
      h('h3', { style: { margin: '4px 0' } }, '聲音'),
      f('背景音樂', [bgmSw, bgmVol]), f('音效', [sfxSw, sfxVol]),
      h('h3', { style: { margin: '10px 0 4px' } }, '操作與輔助'),
      f('觸控按鍵', touchSeg), f('搖桿位置', sideSeg),
      navigator.vibrate ? f('震動', vibSw) : null,
      f('減少動態', calmSw), f('形狀輔助', assistSw),
      h('p', { class: 'muted small' }, '形狀輔助：在暱稱旁加上圓、三角、星星等形狀，不只靠顏色分辨玩家。'));
    const m = modal({
      title: '設定', content: body, cls: 'dialog-lg',
      actions: [btn('恢復預設', { cls: 'btn-ghost', onClick: () => { root.Store.resetSettings(st); applySettings(); App.game && App.game.layout(); m.close(true); App.settingsOpen = false; toast('已恢復預設設定'); App.openSettings(); } }), btn('完成', { cls: 'btn-mint', onClick: () => m.close() })],
      onClose: () => { App.settingsOpen = false; }
    });
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

  App.util = { LEVEL_DD, animalOptions, rulesPanel, rulesSummary, itemMode, myName, randomName, save, applySettings, topbar, screenBox, LAYOUT_OPTS, TIME_OPTS, THEME_OPTS, LEVEL_OPTS };

  document.addEventListener('DOMContentLoaded', () => App.boot());
})(typeof self !== 'undefined' ? self : this);
