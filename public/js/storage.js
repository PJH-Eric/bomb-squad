/* ===== storage.js — 本機設定與戰績（只存在這台裝置，不上傳） ===== */
(function (root) {
  'use strict';
  const KEY = 'bomb-squad';
  const SETTING_DEFAULTS = {
    bgm: true, bgmVol: 0.5,
    sfx: true, sfxVol: 0.8,
    vibrate: true,
    reduceMotion: false,
    colorAssist: false,      /* 暱稱旁用形狀區分玩家，不只靠顏色 */
    touchMode: 'auto',       /* auto 觸控裝置才顯示／on 一律顯示／off 不顯示 */
    stickSide: 'left'        /* 搖桿放左手或右手邊 */
  };
  const SOLO_DEFAULTS = {
    levels: ['easy', 'normal', 'hard'],   /* 每個電腦各自的難度（最多 7 個） */
    layout: 'random', theme: 6, timeLimit: 180, items: true, curses: true
  };
  const DEFAULTS = Object.assign({
    nickname: '',
    animal: 'cat',
    solo: Object.assign({}, SOLO_DEFAULTS),
    stats: {}              /* { solo: {play, win}, online: {play, win} } */
  }, SETTING_DEFAULTS);

  function load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
    const data = Object.assign({}, DEFAULTS, raw || {});
    data.solo = Object.assign({}, SOLO_DEFAULTS, (raw && raw.solo) || {});
    if (!Array.isArray(data.solo.levels) || !data.solo.levels.length) data.solo.levels = SOLO_DEFAULTS.levels.slice();
    data.stats = Object.assign({}, (raw && raw.stats) || {});
    if (!raw || !raw.animal) {
      const ids = ['cat', 'dog', 'bunny', 'bear', 'panda', 'fox', 'frog', 'penguin'];
      data.animal = ids[Math.floor(Math.random() * ids.length)];
      save(data);
    }
    return data;
  }
  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 無痕模式等，忽略 */ }
  }
  function resetSettings(data) {
    Object.assign(data, SETTING_DEFAULTS);
    save(data);
    return data;
  }
  function record(data, bucket, win) {
    const s = data.stats[bucket] || { play: 0, win: 0 };
    s.play++;
    if (win) s.win++;
    data.stats[bucket] = s;
    save(data);
    return s;
  }
  root.Store = { load, save, resetSettings, record, DEFAULTS, SETTING_DEFAULTS, SOLO_DEFAULTS, KEY };
})(typeof self !== 'undefined' ? self : this);
