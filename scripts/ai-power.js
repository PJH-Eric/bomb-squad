/* 電腦等級強度表：印出每個等級每個參數的值、對強度的貢獻、總強度，以及跟目標（LEVEL_POWER）的差距。
 * 用法：node scripts/ai-power.js            印出目前的等級表
 *       node scripts/ai-power.js 60         另外印出「依目標強度 60 算出的參數」（scaleToPower），調整難度時拿來參考
 * 調整難度的流程：改 ai.js 的 LEVEL_POWER（級距）→ 用 scaleToPower 算出參數 → 寫回 LEVELS → 跑 npm test。
 * 權重本身是實測校準出來的（scripts/ai-weights.js），不要憑感覺改。 */
'use strict';
const AI = require('../public/js/ai.js');

const keys = Object.keys(AI.POWER_WEIGHTS);
const fmt = (v, d) => (typeof v === 'boolean' ? (v ? '是' : '否') : Number(v).toFixed(d == null ? 2 : d));
const pad = (s, n) => String(s).padStart(n);
console.log('參數'.padEnd(26) + '權重 ' + AI.LEVEL_ORDER.map(k => pad(AI.LEVELS[k].name, 12)).join(''));
for (const f of keys) {
  const W = AI.POWER_WEIGHTS[f];
  const cells = AI.LEVEL_ORDER.map(k => {
    const raw = W.flag ? !!AI.LEVELS[k][f] : (AI.LEVELS[k][f] == null ? 0 : AI.LEVELS[k][f]);
    const c = AI.powerBreakdown(AI.LEVELS[k])[f];
    return pad(fmt(raw, f === 'chase' || f === 'itemRange' ? 0 : 2) + '(' + c.toFixed(1) + ')', 12);
  });
  console.log((f + ' ' + W.label).padEnd(26) + pad(W.w, 4) + ' ' + cells.join(''));
}
console.log('-'.repeat(26 + 5 + 12 * AI.LEVEL_ORDER.length));
console.log('強度值'.padEnd(31) + AI.LEVEL_ORDER.map(k => pad(AI.power(AI.LEVELS[k]).toFixed(1), 12)).join(''));
console.log('目標'.padEnd(31) + AI.LEVEL_ORDER.map(k => pad(AI.LEVEL_POWER[k], 12)).join(''));
console.log('級距（與上一級的差）'.padEnd(25) + AI.LEVEL_ORDER.map((k, i) => pad(i ? (AI.LEVEL_POWER[k] - AI.LEVEL_POWER[AI.LEVEL_ORDER[i - 1]]) : '-', 12)).join(''));

if (process.argv[2]) {
  const t = +process.argv[2];
  console.log('\n依目標強度 ' + t + ' 算出的參數（以各等級目前的參數為起點）：');
  for (const k of AI.LEVEL_ORDER) {
    const c = AI.scaleToPower(AI.LEVELS[k], t);
    console.log('  ' + AI.LEVELS[k].name.padEnd(4) + ' 強度 ' + AI.power(c).toFixed(1) + '  ' + keys.filter(f => !AI.POWER_WEIGHTS[f].flag).map(f => f + ':' + c[f]).join(' '));
  }
}
