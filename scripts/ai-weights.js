/* 電腦等級權重校準工具：逐一把每個參數調到「最強」或「最弱」，其他維持基準，讓它跟三個基準電腦對打，
 * 比較實際成績，算出每個參數「真正」影響強度的程度，換成權重（總和 100）。
 *
 * 用法：node scripts/ai-weights.js [每組局數=40] [每局秒數=100]
 *   結果的「建議權重」可以貼回 public/js/ai.js 的 POWER_WEIGHTS（w 欄位）。這支很慢（幾百局模擬），平常不用跑；
 *   調難度時改 LEVEL_POWER 目標＋用 scaleToPower 算參數就好。
 *
 * 成績 A = （自己擊倒數 − 對手平均擊倒數）＋（對手平均被淘汰率 − 自己被淘汰率）。同一批 seed 與出生順序，所以變體之間可以直接比。 */
'use strict';
const R = require('../public/js/rules.js');
const AI = require('../public/js/ai.js');

const GAMES = +(process.argv[2] || 40), SECS = +(process.argv[3] || 100);
/* 基準：調整前的「困難」。變體只改一個參數，其餘不動 */
const BASE = { name: '基準', interval: 0.19, bombProb: 1, hunt: 1, chase: 9, chain: true, react: 0.78, notice: 0.26, itemRange: 14, itemProb: 0.84, wander: 0.08, sloppy: 0.09, curseOk: false, trap: true, margin: 0.1 };

function arena(focal) {
  let kills = 0, opp = 0, dead = 0, oppDead = 0;
  for (let g = 0; g < GAMES; g++) {
    const seed = 3000 + g, slot = g % 4;                       /* 自己的出生位置輪流換 */
    const players = [0, 1, 2, 3].map(i => ({ slot: i, name: 'AI' + i, animal: 'cat', kind: 'ai', level: 'hard' }));
    const s = R.createGame({ seed, players, layout: 'random', countdown: 0, timeLimit: SECS });
    const brains = players.map((p, i) => AI.createBrain('hard', seed * 31 + i, i === slot ? focal : BASE));
    const inputs = {};
    for (let t = 0; s.phase !== 'over' && t < (SECS + 5) * 60; t++) {
      s.players.forEach((p, k) => { const o = AI.think(brains[k], s, p, R.DT); inputs[p.slot] = inputs[p.slot] || { dir: null, bomb: false }; inputs[p.slot].dir = o.dir; if (o.bomb) inputs[p.slot].bomb = true; });
      R.step(s, inputs, R.DT);
    }
    s.players.forEach((p, i) => {
      if (i === slot) { kills += p.kills; if (!p.alive) dead++; } else { opp += p.kills / 3; if (!p.alive) oppDead += 1 / 3; }
    });
  }
  return (kills - opp) / GAMES + (oppDead - dead) / GAMES;
}

const keys = Object.keys(AI.POWER_WEIGHTS);
const base = arena(BASE);
console.log('基準自己對自己的成績 A =', base.toFixed(3), '（理論上接近 0，差多少就是雜訊大小）\n');
const rows = [];
for (const k of keys) {
  const { worst, best } = AI.POWER_WEIGHTS[k];
  const mk = v => Object.assign({}, BASE, { [k]: AI.POWER_WEIGHTS[k].flag ? !!v : v });
  const a = arena(mk(best)), b = arena(mk(worst));
  rows.push({ k, best: a, worst: b, delta: a - b });
  console.log(k.padEnd(10), AI.POWER_WEIGHTS[k].label.padEnd(18), '最強', a.toFixed(3).padStart(7), ' 最弱', b.toFixed(3).padStart(7), ' 差', (a - b).toFixed(3).padStart(7));
}
const pos = rows.map(r => Math.max(0.02, r.delta));
const sum = pos.reduce((x, y) => x + y, 0);
console.log('\n建議權重（依實測影響程度，總和 100，下限 2）：');
rows.forEach((r, i) => console.log('  ' + r.k.padEnd(10) + ' w: ' + Math.max(2, Math.round(pos[i] / sum * 100)) + '    （目前 ' + AI.POWER_WEIGHTS[r.k].w + '）'));
