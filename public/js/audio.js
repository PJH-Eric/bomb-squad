/* ===== audio.js — 即時合成的音效與背景音樂（沒有外部音檔，授權單純） =====
 * 要換成正式音檔時：保留 Sound.sfx(name) / Sound.music(mode) 這兩個介面，內部改成播放檔案即可。
 * 瀏覽器要等第一次點擊／觸碰才能出聲，Sound.unlock() 由 app.js 在第一次手勢時呼叫。
 */
(function (root) {
  'use strict';
  let ctx = null, master = null, bgmGain = null, sfxGain = null, noiseBuf = null;
  let cfg = { bgm: true, bgmVol: 0.5, sfx: true, sfxVol: 0.8 };
  let mode = null, timer = 0, nextT = 0, step = 0;
  const lastAt = {};

  function ensure() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    bgmGain = ctx.createGain(); bgmGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.connect(master);
    const len = ctx.sampleRate * 1;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    apply(cfg);
    return ctx;
  }
  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
    if (c && mode && !timer) startLoop();
  }
  function apply(next) {
    if (next) cfg = Object.assign(cfg, next);
    if (!ctx) return;
    bgmGain.gain.setTargetAtTime(cfg.bgm ? cfg.bgmVol * 0.45 : 0, ctx.currentTime, 0.05);
    sfxGain.gain.setTargetAtTime(cfg.sfx ? cfg.sfxVol : 0, ctx.currentTime, 0.02);
  }

  function tone(freq, t0, dur, type, vol, dest, slideTo) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(t0, dur, vol, f0, f1, type, dest) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type || 'lowpass';
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfxGain);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  }

  const SFX = {
    click(t) { tone(760, t, 0.07, 'sine', 0.22, null, 520); },
    place(t) { tone(560, t, 0.14, 'sine', 0.4, null, 240); noise(t, 0.04, 0.12, 3000, 1500, 'highpass'); },
    boom(t) { noise(t, 0.55, 0.9, 2200, 90, 'lowpass'); tone(110, t, 0.45, 'sine', 0.7, null, 40); },
    brk(t) { noise(t, 0.14, 0.35, 5000, 1200, 'highpass'); },
    item(t) { [660, 880, 1320].forEach((f, i) => tone(f, t + i * 0.06, 0.14, 'triangle', 0.34)); },
    curse(t) { tone(330, t, 0.4, 'sawtooth', 0.22, null, 110); tone(250, t + 0.05, 0.4, 'square', 0.12, null, 90); },
    shield(t) { tone(500, t, 0.25, 'sine', 0.35, null, 1300); noise(t, 0.12, 0.2, 4000, 8000, 'highpass'); },
    kick(t) { tone(220, t, 0.12, 'triangle', 0.5, null, 90); },
    die(t) { tone(640, t, 0.55, 'square', 0.25, null, 80); noise(t, 0.2, 0.25, 1600, 300, 'lowpass'); },
    count(t) { tone(880, t, 0.12, 'sine', 0.4); },
    go(t) { tone(1320, t, 0.25, 'triangle', 0.45); tone(1760, t + 0.08, 0.35, 'triangle', 0.35); },
    win(t) { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.11, 0.24, 'triangle', 0.4)); },
    lose(t) { [440, 392, 349, 294].forEach((f, i) => tone(f, t + i * 0.16, 0.3, 'sine', 0.35)); },
    draw(t) { [523, 523, 392].forEach((f, i) => tone(f, t + i * 0.14, 0.26, 'triangle', 0.35)); },
    join(t) { tone(660, t, 0.1, 'sine', 0.25); tone(880, t + 0.08, 0.14, 'sine', 0.25); },
    chat(t) { tone(980, t, 0.06, 'sine', 0.15); }
  };
  function sfx(name) {
    if (!cfg.sfx || !ensure() || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const minGap = name === 'boom' || name === 'brk' ? 0.05 : 0.02;
    if (lastAt[name] && now - lastAt[name] < minGap) return;
    lastAt[name] = now;
    if (SFX[name]) SFX[name](now + 0.005);
  }

  /* ---------- 背景音樂：音樂盒風的五聲音階，主旋律固定、戰鬥版速度加快 ---------- */
  const PENT = [0, 2, 4, 7, 9];
  const degree = d => PENT[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5);
  const hz = (semi, base) => (base || 261.63) * Math.pow(2, semi / 12);
  const MELODY = {
    menu: [4, null, 5, null, 7, null, 5, null, 6, null, 4, null, 2, null, null, null,
           4, null, 5, null, 7, null, 9, null, 8, null, 7, null, 5, null, null, null,
           7, null, 8, null, 9, null, 8, null, 7, null, 5, null, 4, null, null, null,
           2, null, 4, null, 5, null, 4, null, 2, null, 0, null, 0, null, null, null],
    battle: [7, null, 7, 9, 8, null, 7, null, 5, null, 5, 7, 6, null, 4, null,
             7, null, 7, 9, 10, null, 9, null, 8, null, 7, 5, 6, null, 7, null,
             9, null, 9, 8, 7, null, 5, null, 4, null, 5, 7, 5, null, null, null,
             2, 4, 5, 7, 5, 4, 2, 4, 0, null, 2, null, 0, null, null, null]
  };
  const BASS = {
    menu: [0, 0, 0, 0, 3, 3, 3, 3, 4, 4, 4, 4, 2, 2, 2, 2],
    battle: [0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 4, 4, 2, 2]
  };
  function schedule() {
    if (!ctx || !mode) return;
    const bpm = mode === 'battle' ? 140 : 108;
    const sixteenth = 60 / bpm / 4;
    while (nextT < ctx.currentTime + 0.35) {
      const mel = MELODY[mode], i = step % mel.length;
      const n = mel[i];
      if (n != null) {
        const f = hz(degree(n), 523.25 / 2);
        tone(f, nextT, 0.5, 'sine', 0.5, bgmGain);
        tone(f * 2, nextT, 0.22, 'sine', 0.12, bgmGain);
      }
      if (i % 4 === 0) {
        const b = BASS[mode][Math.floor(i / 4) % BASS[mode].length];
        tone(hz(degree(b), 130.8), nextT, sixteenth * 3.6, 'triangle', 0.42, bgmGain);
      }
      if (mode === 'battle' ? i % 2 === 1 : i % 8 === 4) noise(nextT, 0.04, 0.1, 9000, 6000, 'highpass', bgmGain);
      nextT += sixteenth; step++;
    }
  }
  function startLoop() {
    clearInterval(timer);
    if (!ensure()) return;
    nextT = ctx.currentTime + 0.05; step = 0;
    timer = setInterval(schedule, 90);
  }
  function music(next) {
    if (next === mode) return;
    mode = next;
    clearInterval(timer); timer = 0;
    if (!mode) return;
    if (ctx && ctx.state === 'running') startLoop();
  }

  root.Sound = { unlock, apply, sfx, music, get ready() { return !!ctx && ctx.state === 'running'; } };
})(typeof self !== 'undefined' ? self : this);
