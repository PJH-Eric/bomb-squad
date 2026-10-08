/* 火線判定調教表：一條直線的火線（橫向或直向，一格寬）從角色的「右邊／左邊／上方／下方」經過時，
 * 角色的判定中心離火線中心多近（單位：格）就會被炸。用 rules.js 的實際判定（R.step）逐步移動角色找出邊界，
 * 所以調整 rules.js 的半身參數（HALF_BODY、SIDE_*、FEET_*、BODY_*）之後，跑這支就能看到每個方向的邊界變成多少。
 *   node scripts/flame-tuning.js
 * 角色的「判定中心」＝ p.x、p.y；人物圖往上提，所以火線從上方經過時「頭」先碰到，從下方經過時「腳」先碰到。 */
'use strict';
const R = require('../public/js/rules.js');

/** 在 (x, y) 放一個角色，另外放一顆炸彈讓火線從指定方向經過，回傳這一步有沒有被炸死 */
function hit(dir, offset) {
  const players = [0, 1, 2].map(i => ({ slot: i, name: 'P', animal: 'cat', kind: 'human' }));
  const s = R.createGame({ seed: 11, players, layout: 'classic', countdown: 0, timeLimit: 0, fx: false });
  for (let y = 1; y < s.h - 1; y++) for (let x = 1; x < s.w - 1; x++) s.grid[y * s.w + x] = 0;
  s.phase = 'play';
  s.players[1].x = 1.5; s.players[1].y = s.h - 1.5; s.players[2].x = s.w - 1.5; s.players[2].y = 1.5;
  const px = 8.5, py = 6.5;                                 /* 角色的判定中心（放在地圖中間，離炸彈夠遠，只有一條火線經過） */
  s.players[0].x = px; s.players[0].y = py;
  /* 火線中心離角色 offset 格：right＝直火在右邊、left＝直火在左邊、above＝橫火在上方、below＝橫火在下方 */
  let bx, by, range = 6;
  if (dir === 'right' || dir === 'left') { bx = Math.floor(px + (dir === 'right' ? 1 : -1) * offset); by = 1; }
  else { bx = 1; by = Math.floor(py + (dir === 'below' ? 1 : -1) * offset); }
  /* 用「火線中心 = 格子中心」：把角色位置微調成小數，使 offset 精確 */
  if (dir === 'right') { s.players[0].x = bx + 0.5 - offset; }
  else if (dir === 'left') { s.players[0].x = bx + 0.5 + offset; }
  else if (dir === 'below') { s.players[0].y = by + 0.5 - offset; }
  else { s.players[0].y = by + 0.5 + offset; }
  /* 直火：炸彈在最上排，射程往下；橫火：炸彈在最左邊，射程往右，都要夠長才碰得到角色所在的位置 */
  if (dir === 'right' || dir === 'left') s.bombs.push({ id: 1, owner: 1, cx: bx, cy: 1, t: 0, range: 12, pass: [], sl: null });
  else s.bombs.push({ id: 1, owner: 1, cx: 1, cy: by, t: 0, range: 12, pass: [], sl: null });
  R.step(s, {}, R.DT);
  return !s.players[0].alive;
}

/** 從遠（安全）往近掃，找「剛好開始被炸」的離火線中心距離（二分搜尋，精度 0.005 格） */
function boundary(dir) {
  let safe = 1.6, danger = 0;
  if (hit(dir, safe) || !hit(dir, danger)) return null;
  for (let i = 0; i < 24; i++) { const mid = (safe + danger) / 2; if (hit(dir, mid)) danger = mid; else safe = mid; }
  return (safe + danger) / 2;
}

if (require.main === module) {
  const names = { right: '火線從右邊經過（直火在角色右側）', left: '火線從左邊經過（直火在角色左側）', above: '火線從上方經過（橫火在角色上方，頭先碰到）', below: '火線從下方經過（橫火在角色下方，腳先碰到）' };
  console.log('每個方向：火線中心離角色判定中心 ≤ 這個距離（格）就被炸；格子正中間（距離 1.0 以上）都是安全的');
  for (const d of ['right', 'left', 'above', 'below']) {
    const b = boundary(d);
    console.log('  ' + (names[d] + '：').padEnd(32, '　') + (b == null ? '掃描失敗' : b.toFixed(3) + ' 格'));
  }
  console.log('參數：HALF_BODY=' + R.HALF_BODY + (R.SIDE_LEFT != null ? ' SIDE_LEFT=' + R.SIDE_LEFT + ' SIDE_RIGHT=' + R.SIDE_RIGHT : '') + ' FEET_REACH=' + R.FEET_REACH + ' FEET_HIT=' + R.FEET_HIT + ' BODY_UP=' + R.BODY_UP + ' BODY_DOWN=' + R.BODY_DOWN + ' HALF=' + R.HALF);
}
module.exports = { hit, boundary };
