/* ===== locales.js — 炸彈小隊 字典（繁體中文 zh-Hant / English en） =====
 * 英文遊戲名：Bomb Squad
 *
 * L(key, 中文, English) 同時寫入兩份字典，所以兩邊的 key 一定一致（tests/i18n.js 會再驗一次）。
 * 中文內容與原本畫面上的文案完全相同；{name}、{n} 這類佔位符由 I18N.t(key, {name, n}) 取代。
 * 玩家輸入的暱稱與聊天內容不翻譯。
 */
(function (root) {
  'use strict';
  var zh = {}, en = {};
  function L(k, z, e) { zh[k] = z; en[k] = e; }

  /* ---------- 通用 ---------- */
  L('meta.title', "炸彈小隊｜免費線上多人炸彈對戰", 'Bomb Squad');
  L('meta.desc', "免費線上炸彈對戰，放炸彈炸開磚塊、拾取道具，在連鎖爆炸中閃躲求生。單機挑戰不同難度電腦，或建立多人房間邀朋友較勁，支援觀戰與邀請連結，免下載，手機平板可玩。", 'A cute bomber game: play solo against the computer or online with room codes, spectators and invite links. Drop bombs, blast bricks, grab items and be the last squad leader standing!');
  L('lang.switchTo', '切換成 English', 'Switch to Traditional Chinese');
  L('lang.label', '語言', 'Language');
  L('lang.zh', '繁體中文', '繁體中文');
  L('lang.en', 'English', 'English');
  L('common.cancel', '取消', 'Cancel');
  L('common.ok', '確定', 'OK');
  L('common.close', '關閉', 'Close');
  L('common.back', '返回', 'Back');
  L('common.done', '完成', 'Done');
  L('common.select', '請選擇', 'Select…');
  L('ui.dec', '{label} 減少', '{label}: decrease');
  L('ui.inc', '{label} 增加', '{label}: increase');
  L('noscript', '炸彈小隊需要開啟 JavaScript 才能玩。', 'Bomb Squad needs JavaScript to play.');
  L('lobbyLink.text', '← 回遊戲大廳', '← Game Lobby');
  L('lobbyLink.aria', '回遊戲大廳', 'Back to game lobby');
  L('settings.open', '設定', 'Settings');

  /* ---------- 首頁 ---------- */
  L('home.title', '炸彈小隊', 'Bomb Squad');
  L('home.sub', '放炸彈、炸磚塊、撿道具，當最後的小隊長！', 'Drop bombs, blast bricks, grab items and be the last squad leader!');
  L('home.menu', '主選單', 'Main menu');
  L('home.solo', '一個人玩', 'Play Solo');
  L('home.online', '跟別人玩', 'Play Online');
  L('home.help', '怎麼玩', 'How to Play');
  L('home.cast', '角色介紹', 'Characters');
  L('home.recSolo', '單機 {w} 勝／{p} 場', 'Solo {w} wins / {p} games');
  L('home.recOnline', '線上 {w} 勝／{p} 場', 'Online {w} wins / {p} games');
  L('home.record', '本機戰績：{s}', 'Local record: {s}');

  /* ---------- 角色介紹 ---------- */
  L('cast.title', '角色介紹', 'Characters');
  L('cast.note', '每隻的開場能力都在 1～2 之間：火力或炸彈多的，跑得就慢一點。撿道具能升級，但每隻的上限不一樣（深色是開場、淺色是最多能升到哪；跑速的「+6 次」是最多能加速幾次），三項上限加起來每隻都一樣多，沒有誰全面比較強，挑喜歡的玩法就好。',
    'Every character starts with 1 to 2 in each stat: more fire or bombs means slower running. Items can upgrade you, but each character has different caps (dark bar = start, light bar = the most you can reach; the "+6" on speed is how many boosts you can collect). All three caps add up to the same total for everyone, so nobody is strictly better. Just pick the style you like!');
  L('cast.fire', '火力', 'Fire');
  L('cast.bomb', '炸彈', 'Bombs');
  L('cast.speed', '跑速', 'Speed');
  L('cast.fast', '快', 'Fast');
  L('cast.mid', '中', 'Mid');
  L('cast.slow', '慢', 'Slow');
  L('cast.tiles', '{a}→{b} 格', '{a}→{b} tiles');
  L('cast.bombs', '{a}→{b} 顆', '{a}→{b} bombs');
  L('cast.boosts', '{s} +{n} 次', '{s} +{n} boosts');
  L('cast.startSolo', '開始單機練習', 'Solo Practice');
  L('cast.home', '回首頁', 'Home');

  /* ---------- 教學 ---------- */
  L('help.title', '怎麼玩', 'How to Play');
  L('help.goal', '目標', 'Goal');
  L('help.goal1', '在方格地圖上放炸彈，炸開軟磚、撿道具、把對手炸出局。場上只剩你一個，就是勝利者！', 'Place bombs on the grid, blast soft bricks, grab items and knock your rivals out. The last one standing wins!');
  L('help.goal2', '時間到還有好幾人活著時，擊倒對手最多的人獲勝，同分就是平手。', 'If time runs out with several players alive, whoever knocked out the most rivals wins. A tie is a draw.');
  L('help.goal3', '遊戲超過 2 分 30 秒會開始空襲：每 2 秒就有炸彈從天上掉到隨機空格，3 秒後爆炸、火力橫掃到牆邊；每過 10 秒每次多掉 1 顆（2:40 起 2 顆、2:50 起 3 顆，最多 3 顆）。空襲炸死人不算擊倒。',
    'After 2:30 an air raid begins: every 2 seconds a bomb drops onto a random empty tile and explodes 3 seconds later, with flames reaching all the way to the walls. Every 10 seconds one more drops per wave (2 from 2:40, 3 from 2:50, max 3). Deaths from air raids do not count as KOs.');
  L('help.controls', '操作', 'Controls');
  L('help.kbd', '電腦鍵盤：', 'Computer keyboard:');
  L('help.move', '移動　', 'Move ');
  L('help.or', ' 或 ', ' or ');
  L('help.arrows', '方向鍵', 'Arrows');
  L('help.placeBomb', '放炸彈 ', 'Bomb ');
  L('help.space', '空白鍵', 'Space');
  L('help.touch', '平板與手機：左下角搖桿移動、右下角粉紅按鈕放炸彈（設定裡可以換左右手）。', 'Tablet and phone: use the joystick at the bottom left to move and the pink button at the bottom right to drop bombs (you can swap sides in Settings).');
  L('help.blast', '炸彈怎麼炸', 'How Bombs Blast');
  L('help.s1', '放下炸彈約 3 秒後爆炸，往上下左右噴出火焰，長度就是你的「火力」。', 'A bomb explodes about 3 seconds after you place it, shooting flames up, down, left and right. The flame length is your "Fire".');
  L('help.s2', '火焰被硬牆擋住；碰到軟磚會把它炸掉，並且在那裡停下。', 'Flames stop at hard walls. They blow up a soft brick and stop right there.');
  L('help.s3', '火焰碰到別的炸彈會立刻引爆它，形成連鎖爆炸！火焰不會被炸彈擋住，連鎖時每個方向以火力最長的那顆為準。', 'Flames set off any other bomb they touch, causing a chain reaction! Bombs do not block flames, and in a chain each direction uses the bomb with the longest fire.');
  L('help.s4', '剛放下炸彈時可以走開，離開後它就變成障礙物。', 'You can walk away from a bomb you just placed. Once you leave, it becomes an obstacle.');
  L('help.s5', '被火焰碰到就出局，自己的炸彈也一樣，小心逃生。', 'Touch a flame and you are out, even your own. Run for cover!');
  L('help.items', '道具', 'Items');
  L('help.items1', '炸開軟磚有機會掉出道具；每隔 45 秒還會有空投機飛過地圖，投下 1～2 個好道具。圓形是好道具，帶尖刺的紫色外框是詛咒，會限時捉弄你。出局時，身上一半的強化道具會噴出來。',
    'Blasting soft bricks can drop items, and every 45 seconds a cargo plane flies over and drops 1 to 2 good items. Round items are good; purple spiky ones are curses that mess with you for a while. When you are knocked out, half of your power-ups pop out.');
  L('help.figAria', '爆炸示意圖：炸彈往上下左右噴出火焰，遇到硬牆停下，炸掉第一塊軟磚', 'Blast diagram: the bomb shoots flames up, down, left and right, stopping at the hard wall and blowing up the first soft brick');
  L('help.figHard', '硬牆', 'Hard wall');
  L('help.figSoft', '軟磚', 'Soft brick');

  /* ---------- 角色與暱稱 ---------- */
  L('profile.nickname', '暱稱', 'Nickname');
  L('profile.placeholder', '幫自己取個名字（最多 10 字）', 'Pick a name (max 10 characters)');
  L('profile.animal', '角色', 'Character');
  L('profile.choose', '選擇角色', 'Choose a character');
  L('name.auto', '{adj}{animal}', '{adj} {animal}');
  var ADJ = [['快樂', 'Happy'], ['勇敢', 'Brave'], ['調皮', 'Cheeky'], ['害羞', 'Shy'], ['閃亮', 'Shiny'], ['軟綿綿', 'Fluffy'], ['圓滾滾', 'Chubby'], ['機靈', 'Clever'], ['呆萌', 'Goofy'], ['活潑', 'Lively']];
  ADJ.forEach(function (a, i) { L('name.adj' + i, a[0], a[1]); });

  /* ---------- 單機設定 / 規則 ---------- */
  L('solo.title', '一個人玩', 'Solo Play');
  L('solo.you', '你的角色', 'Your Character');
  L('solo.cpu', '電腦對手', 'Computer Rivals');
  L('solo.count', '數量', 'Count');
  L('solo.countLabel', '電腦數量', 'Number of computers');
  L('solo.levelAll', '電腦難度', 'Computer level');
  L('solo.detail', '逐一調整角色與難度', 'Customize each rival');
  L('solo.collapse', '收起', 'Collapse');
  L('solo.cpuN', '電腦 {n}', 'CPU {n}');
  L('solo.cpuTitle', '電腦 {n}・{lv}', 'CPU {n} · {lv}');
  L('solo.cpuAnimal', '電腦 {n} 角色', 'CPU {n} character');
  L('solo.cpuLevel', '電腦 {n} 難度', 'CPU {n} level');
  L('solo.rules', '規則', 'Rules');
  L('solo.start', '開始遊戲', 'Start Game');
  L('rules.time', '時間', 'Time');
  L('rules.timeLimit', '時間限制', 'Time limit');
  L('rules.items', '道具', 'Items');
  L('rules.map', '地圖', 'Map');
  L('rules.min', '{n} 分', '{n} min');
  L('rules.noLimit', '不限時', 'No limit');
  L('rules.itemNone', '無道具', 'No items');
  L('rules.itemOn', '有道具', 'Items');
  L('rules.itemCurse', '道具＋詛咒', 'Items + curses');
  L('rules.layoutSuffix', '{l}版型', '{l} layout');
  L('rules.fab', '產線', 'Assembly line');

  /* ---------- 難度 / 版型 ---------- */
  L('level.toddler', '幼幼班', 'Toddler');
  L('level.easy', '簡單', 'Easy');
  L('level.normal', '普通', 'Normal');
  L('level.hard', '困難', 'Hard');
  L('level.myth', '神話', 'Mythic');
  L('level.hint.toddler', '亂走、很少放炸彈', 'Wanders, rarely bombs');
  L('level.hint.easy', '會躲炸彈、偶爾追人', 'Dodges bombs, sometimes chases');
  L('level.hint.normal', '會追人、會連鎖', 'Chases and chains bombs');
  L('level.hint.hard', '會設陷阱、反應最快', 'Sets traps, fast reflexes');
  L('level.hint.myth', '幾乎不失誤、追得最緊', 'Almost never slips, chases hard');
  L('level.power', '強度 {n}・{hint}', 'Power {n} · {hint}');
  L('layout.random', '隨機', 'Random');
  L('layout.classic', '經典', 'Classic');
  L('layout.open', '空曠', 'Open');
  L('layout.dense', '密集', 'Dense');
  L('layout.fab', '產線', 'Assembly line');
  L('layout.hint.random', '每局抽一種版型', 'A new layout every match');
  L('layout.hint.classic', '硬牆一組一組散落', 'Hard walls in scattered groups');
  L('layout.hint.open', '硬牆很少，空間大', 'Few walls, lots of room');
  L('layout.hint.dense', '硬牆多，巷戰多', 'Many walls, tight alleys');

  /* ---------- 角色 ---------- */
  L('animal.cat.name', '小貓', 'Kitty');
  L('animal.cat.role', '均衡型', 'Balanced');
  L('animal.cat.intro', '身手靈巧、貓步輕快，火力能練到 10、炸彈能帶 9 顆，樣樣都不差。', 'Nimble and light-footed. Fire can reach 10 and it can carry 9 bombs. Good at everything.');
  L('animal.dog.name', '小狗', 'Puppy');
  L('animal.dog.role', '炸彈型', 'Bomber');
  L('animal.dog.intro', '最愛挖洞埋東西，開場就有 2 顆炸彈，最多能帶 10 顆。', 'Loves digging and burying things. Starts with 2 bombs and can carry up to 10.');
  L('animal.bunny.name', '小兔', 'Bunny');
  L('animal.bunny.role', '速度型', 'Speedster');
  L('animal.bunny.intro', '跑得飛快，還能加速 8 次越跑越快！但火力和炸彈的上限比別隻低一些。', 'Super fast, with 8 speed boosts to get even faster! But its fire and bomb caps are a bit lower than the others.');
  L('animal.bear.name', '小熊', 'Bear');
  L('animal.bear.role', '火力型', 'Firepower');
  L('animal.bear.intro', '力氣大，開場火力就有 2 格，最遠能噴到 12 格！', 'Strong! Starts with 2 tiles of fire and can blast as far as 12 tiles!');
  L('animal.panda.name', '熊貓', 'Panda');
  L('animal.panda.role', '力量型', 'Powerhouse');
  L('animal.panda.intro', '圓滾滾的實力派，開場火力、炸彈都是 2，火力能練到 11，可惜跑不太動。', 'A chubby heavyweight. Starts with 2 fire and 2 bombs, and fire can reach 11, but it is not very quick on its feet.');
  L('animal.fox.name', '狐狸', 'Fox');
  L('animal.fox.role', '陷阱型', 'Trapper');
  L('animal.fox.intro', '狡猾愛佈陷阱，開場 2 顆炸彈，腳程也還能練得很快。', 'Sly and fond of traps. Starts with 2 bombs and can still get very fast.');
  L('animal.frog.name', '青蛙', 'Frog');
  L('animal.frog.role', '遠攻型', 'Long-range');
  L('animal.frog.intro', '舌頭長長，火力 2 格起跳，蹦蹦跳跳也能加速 7 次。', 'Long tongue, starts with 2 tiles of fire, and hops its way to 7 speed boosts.');
  L('animal.penguin.name', '企鵝', 'Penguin');
  L('animal.penguin.role', '重砲型', 'Heavy');
  L('animal.penguin.intro', '搖搖擺擺跑得慢，但開場火力、炸彈都是 2，炸彈能帶到 10 顆。', 'Waddles slowly, but starts with 2 fire and 2 bombs and can carry up to 10 bombs.');
  L('animal.chick.name', '小雞', 'Chick');
  L('animal.chick.role', '游擊型', 'Skirmisher');
  L('animal.chick.intro', '小小一隻跑得飛快，炸彈能帶到 10 顆到處丟，可惜火力上限只有 8。', 'Tiny and fast. Can carry up to 10 bombs to toss around, but fire tops out at 8.');

  /* ---------- 主題 ---------- */
  var THEMES = [['糖果樂園', 'Candy Land'], ['海底世界', 'Undersea'], ['太空站', 'Space Station'], ['森林', 'Forest'], ['沙漠', 'Desert'], ['雪地', 'Snowfield'], ['競技場', 'Arena'], ['日月光廠房', 'ASE Fab'], ['礦山', 'Mine'], ['地下墓穴', 'Catacombs'], ['火山', 'Volcano'], ['聖誕小鎮', 'Christmas Town'], ['遊樂園', 'Theme Park']];
  THEMES.forEach(function (th, i) { L('theme.' + i, th[0], th[1]); });
  L('theme.random', '隨機', 'Random');
  L('theme.random.hint', '每局換一個主題', 'A new theme every match');

  /* ---------- 道具 ---------- */
  L('item.fire', '火力 +1', 'Fire +1');
  L('item.bomb', '炸彈 +1', 'Bomb +1');
  L('item.speed', '加速', 'Speed up');
  L('item.kick', '踢炸彈', 'Bomb kick');
  L('item.shield', '護盾', 'Shield');
  L('item.c_slow', '遲緩詛咒', 'Slow curse');
  L('item.c_auto', '手滑詛咒', 'Butterfingers curse');
  L('item.c_short', '短火詛咒', 'Short-flame curse');
  L('item.ghost', '隱身', 'Invisibility');
  L('item.super', '超人標誌', 'Super badge');
  L('item.ultra', '大力藥丸', 'Power pill');
  L('item.c_flip', '方向顛倒詛咒', 'Reverse curse');
  L('item.desc.fire', '爆炸往外多延伸 1 格（上限 8～12 格，看角色）', 'Explosions reach 1 tile farther (cap 8 to 12 tiles, depending on the character)');
  L('item.desc.bomb', '可以同時放的炸彈多 1 顆（上限 7～10 顆，看角色）', 'Place 1 more bomb at a time (cap 7 to 10 bombs, depending on the character)');
  L('item.desc.speed', '跑得更快（能加速 5～8 次，看角色）', 'Run faster (5 to 8 boosts, depending on the character)');
  L('item.desc.kick', '走向炸彈就能把它踢著滑走，直到撞到東西', 'Walk into a bomb to kick it sliding until it hits something');
  L('item.desc.shield', '擋掉一次爆炸，之後有 1 秒無敵', 'Blocks one explosion, then 1 second of invincibility');
  L('item.desc.c_slow', '6 秒內只能慢慢走', 'You can only walk slowly for 6 seconds');
  L('item.desc.c_auto', '8 秒內會自己一直放炸彈', 'You keep dropping bombs by yourself for 8 seconds');
  L('item.desc.c_short', '8 秒內爆炸只剩 1 格長', 'Explosions are only 1 tile long for 8 seconds');
  L('item.desc.ghost', '8 秒內對手只看得到你淡淡的身形（電腦對手完全看不到你；你自己會變半透明）；炸彈和火焰照常有效', 'For 8 seconds rivals only see a faint outline of you (computer rivals cannot see you at all, and you turn semi-transparent). Bombs and flames work as usual.');
  L('item.desc.super', '8 秒內火力、炸彈數、跑速都變成你這隻角色的最高值', 'For 8 seconds your fire, bomb count and speed all jump to your character\'s maximum');
  L('item.desc.ultra', '火力直接升到你這隻角色的最高值（不會消失）', 'Fire instantly rises to your character\'s maximum (permanent)');
  L('item.desc.c_flip', '8 秒內上下左右操作顛倒', 'Your controls are reversed for 8 seconds');

  /* ---------- 對戰 HUD / 聊天 ---------- */
  L('game.chat', '聊天室', 'Chat');
  L('game.chatPlaceholder', '輸入訊息…', 'Type a message…');
  L('game.chatAria', '聊天訊息', 'Chat message');
  L('game.send', '送出', 'Send');
  L('game.specTag', '（觀戰）', ' (spectator)');
  L('quick.0', '快跑！', 'Run!');
  L('quick.1', '小心炸彈', 'Watch the bomb');
  L('quick.2', '好險', 'Phew!');
  L('quick.3', '再來一局', 'Again!');
  L('quick.4', 'GG', 'GG');
  L('game.canvas', '對戰地圖', 'Battle map');
  L('game.timeLeft', '剩餘時間', 'Time left');
  L('game.playerStatus', '玩家狀態', 'Player status');
  L('game.spectating', '觀戰中', 'Spectating');
  L('game.closeSide', '收合資訊欄', 'Close info panel');
  L('game.pauseMenu', '暫停選單', 'Pause menu');
  L('game.leaveMatch', '離開對局', 'Leave match');
  L('game.side', '對局', 'Match');
  L('game.sideAria', '對局資訊與聊天室', 'Match info and chat');
  L('game.openSide', '展開資訊欄與聊天室', 'Open info panel and chat');
  L('game.sideTitle', '資訊欄', 'Info');
  L('game.ping', '連線延遲', 'Connection latency');
  L('game.mapInfo', '地圖資訊', 'Map info');
  L('game.mapTitle', '地圖：{th}／{lay}', 'Map: {th} / {lay}');
  L('game.stick', '移動搖桿', 'Move joystick');
  L('game.rotate', '請橫向遊玩', 'Please rotate to landscape');
  L('game.bomb', '放炸彈', 'Place bomb');
  L('game.ready', '準備！', 'Get ready!');
  L('game.cpu', '電腦', 'CPU');
  L('game.cpuLevel', '電腦・{lv}', 'CPU · {lv}');
  L('game.player', '玩家', 'Player');
  L('game.left', '・已離場', ' · Left');
  L('game.out', '・已淘汰', ' · Out');
  L('game.you', '（你）', ' (you)');
  L('game.killsTitle', '擊倒數', 'KO count');
  L('game.kills', '擊倒 {n}', 'KOs {n}');
  L('game.fire', '火力', 'Fire');
  L('game.bombs', '炸彈', 'Bombs');
  L('game.speed', '速度', 'Speed');
  L('game.kick', '踢炸彈', 'Kick');
  L('game.shield', '護盾', 'Shield');
  L('game.yes', '有', 'Yes');
  L('game.no', '無', 'No');
  L('game.buff', '{name}・{s} 秒', '{name} · {s}s');
  L('game.eliminated', '淘汰', 'Out');
  L('game.leftShort', '已離場', 'Left');
  L('game.ff', '快轉', 'Fast-forward');
  L('game.ffOff', '恢復速度', 'Normal speed');

  /* ---------- 暫停 / 結算 ---------- */
  L('pause.title', '暫停', 'Paused');
  L('pause.textOnline', '線上對局不會暫停，其他人還在繼續。', 'Online matches do not pause. Everyone else keeps playing.');
  L('pause.text', '遊戲已暫停。', 'The game is paused.');
  L('pause.leave', '離開房間', 'Leave room');
  L('pause.resume', '繼續', 'Resume');
  L('pause.toRoom', '回房間', 'Back to setup');
  L('pause.restart', '重新開始', 'Restart');
  L('leave.title', '離開房間？', 'Leave room?');
  L('leave.text', '離開後會回到線上大廳。', 'You will return to the online lobby.');
  L('leave.ok', '離開', 'Leave');
  L('result.draw', '平手！', 'Draw!');
  L('result.drawTimeout', '時間到，擊倒數相同', 'Time is up, same number of KOs');
  L('result.drawBoom', '最後的人同時被炸到了', 'The last players blew up together');
  L('result.youWin', '你贏了！', 'You win!');
  L('result.youWinTime', '時間到，你擊倒最多！', 'Time is up and you have the most KOs!');
  L('result.youWinLast', '你是最後的倖存者！', 'You are the last one standing!');
  L('result.nameWins', '{name} 獲勝！', '{name} wins!');
  L('result.mostKos', '時間到，擊倒數最多', 'Time is up, most KOs');
  L('result.lastOne', '最後的倖存者', 'Last one standing');
  L('result.lose', '這次輸了…', 'You lost this time…');
  L('result.loseTime', '{name} 擊倒最多，贏了這局', '{name} had the most KOs and won');
  L('result.loseLast', '{name} 是最後的倖存者', '{name} was the last one standing');
  L('result.record', '本機戰績：{w} 勝／{p} 場', 'Local record: {w} wins / {p} games');
  L('result.you', '（你）', ' (you)');
  L('result.length', '這局共 {m} 分 {s} 秒', 'Match length: {m} min {s} s');
  L('result.backRoom', '回房間', 'Back to setup');
  L('result.again', '再來一局', 'Play again');
  L('result.leave', '離開房間', 'Leave room');
  L('result.toRoom', '回到房間', 'Back to room');
  L('result.aria', '對局結果', 'Match result');

  /* ---------- 設定彈窗 ---------- */
  L('settings.title', '設定', 'Settings');
  L('settings.sound', '聲音', 'Sound');
  L('settings.bgm', '背景音樂', 'Music');
  L('settings.sfx', '音效', 'Sound effects');
  L('settings.bgmVol', '音樂音量', 'Music volume');
  L('settings.sfxVol', '音效音量', 'Effects volume');
  L('settings.controls', '操作與輔助', 'Controls & Assist');
  L('settings.touch', '觸控按鍵', 'Touch controls');
  L('settings.auto', '自動', 'Auto');
  L('settings.show', '顯示', 'Show');
  L('settings.hide', '隱藏', 'Hide');
  L('settings.stick', '搖桿位置', 'Joystick side');
  L('settings.left', '左手邊', 'Left');
  L('settings.touchScale', '操作鈕大小', 'Control size');
  L('settings.touchOpacity', '操作鈕透明度', 'Control opacity');
  L('settings.right', '右手邊', 'Right');
  L('settings.vibrate', '震動', 'Vibration');
  L('settings.calm', '減少動態', 'Reduce motion');
  L('settings.assist', '形狀輔助', 'Shape assist');
  L('settings.assistNote', '形狀輔助：在暱稱旁加上圓、三角、星星等形狀，不只靠顏色分辨玩家。', 'Shape assist: adds shapes such as circles, triangles and stars next to names, so players are not told apart by color alone.');
  L('settings.reset', '恢復預設', 'Reset');
  L('settings.resetDone', '已恢復預設設定', 'Settings reset to defaults');

  /* ---------- 地圖選擇 ---------- */
  L('map.pick', '選擇地圖', 'Choose map');
  L('map.tapChange', '{l}版型・點一下更換', '{l} layout · tap to change');
  L('map.reroll', '換一張', 'Reroll');
  L('map.theme', '主題', 'Theme');
  L('map.layout', '版型', 'Layout');
  L('map.themeGroup', '地圖主題', 'Map theme');
  L('map.layoutGroup', '地圖版型', 'Map layout');
  L('map.previewAria', '地圖預覽：{shown}，{l}版型', 'Map preview: {shown}, {l} layout');
  L('map.bigTitle', '{th}・{l}版型', '{th} · {l} layout');
  L('map.fabNote', '日月光廠房固定使用「產線」版型（橫向機台排排站，一定有輸送帶），不受上面的版型選項影響。', 'ASE Fab always uses the "Assembly line" layout (rows of machines with conveyor belts) and ignores the layout options above.');
  L('map.sub.any', '這只是其中一種可能，每局都會重新抽。', 'This is just one possibility. A new one is drawn every match.');
  L('map.sub.one', '預覽只是其中一張，每局的硬牆與軟磚位置都不一樣。', 'This is just one preview. Walls and bricks land differently every match.');
  L('map.apply', '套用', 'Apply');
  L('map.fxTitle', '地圖機關', 'Map gimmicks');
  L('map.fxIntro', '每個主題最多有 1 種專屬機關（競技場沒有），機關不多，免得干擾你自己的操作；有機關的主題，每張圖約 {keep}% 會出現，位置依 seed 隨機分布並避開出生點周圍。',
    'Each theme has at most 1 signature gimmick (the Arena has none). They are kept few so they do not get in your way. On themes with a gimmick, about {keep}% of maps include it, placed randomly away from the spawn points.');
  L('map.fxChip', '{th}：{fx}', '{th}: {fx}');
  L('map.noFx', '{th}：沒有機關', '{th}: no gimmick');
  L('map.noFxText', '單純的比賽場地，只有硬牆、軟磚和道具。', 'A plain arena with just hard walls, soft bricks and items.');
  L('map.fxOf', '{th}的機關：{fx}', '{th} gimmick: {fx}');
  L('map.fxAlso', '（{name}）', ' ({name})');
  L('map.fxChance', '這個主題每張圖約 {keep}% 會出現機關（也可能這一張沒有）；預覽換一張可以看到不同的配置。', 'About {keep}% of maps in this theme have the gimmick (this one might not). Reroll the preview to see other setups.');
  L('fx.grass.name', '草叢', 'Tall grass');
  L('fx.grass.l1', '躲進草叢，其他人（電腦也一樣）就完全看不到你，連你放在草叢裡的炸彈也看不到（但炸彈的火力線警示還是看得到；空襲的炸彈不受影響，永遠看得到）；沒有例外，貼在旁邊、你自己、淘汰後或觀戰的人也都看不到。',
    'Hide in the grass and nobody (computers included) can see you, or the bombs you place inside it (the flame warning lines are still visible; air-raid bombs are unaffected and always visible). No exceptions: players right next to you, you yourself, eliminated players and spectators cannot see inside either.');
  L('fx.grass.l2', '草叢只放在走道格（左右都是硬牆，或上下都是硬牆），所以裡面的炸彈只會沿著一條直線炸。小圖放 1／3／5 格，大圖放 3／5 格；彼此不相連，開局就看得見，不蓋軟磚。',
    'Grass only appears in corridor tiles (hard walls on both left and right, or both above and below), so bombs inside only blast along one straight line. Small maps get 1/3/5 tiles, big maps 3/5. They never touch each other, are visible from the start and are not covered by bricks.');
  L('fx.belt.name', '輸送帶', 'Conveyor belt');
  L('fx.belt.l1', '頭尾相連、形狀不規則的環形輸送帶：踩上去會被順著帶子一路繞圈帶走，停在上面的炸彈也會被載走。',
    'An irregular looping conveyor belt: step on it and you are carried around the loop. Bombs resting on it are carried away too.');
  L('fx.belt.l2', '炸彈前面有人或障礙就停住，離開帶子就停下。四個角落各一圈，可以和軟磚疊在一起，磚炸掉才露出來。',
    'A bomb stops if a player or obstacle is in front, and stops once it leaves the belt. There is one loop in each corner, and it can sit under soft bricks until they blow up.');
  L('fx.slow.name', '緩速格', 'Slow tile');
  L('fx.slow.l1', '踩上去速度只剩一半，離開就恢復；格子右下角有蝸牛記號。', 'Your speed is halved while you stand on it and returns to normal when you leave. A snail mark sits in the bottom right corner.');
  L('fx.slow.l2', '小圖放 1／3／5 格，大圖放 3／5 格；一格一格散開、不會相連，可以和軟磚疊在一起，磚炸掉才露出來。',
    'Small maps get 1/3/5 tiles, big maps 3/5. They are spread out and never touch, and can sit under soft bricks until they blow up.');
  L('fx.spike.name', '尖刺', 'Spikes');
  L('fx.spike.l1', '固定的尖刺，不會傷人；但炸彈放在上面、或被踢到（滑到）上面，會當場爆炸。', 'Fixed spikes that do not hurt people, but a bomb placed on them, or kicked (slid) onto them, explodes on the spot.');
  L('fx.spike.l2', '小圖放 1／3／5 個，大圖放 3／5 個；一個一個散開、不會相連，開局就看得見，不蓋軟磚；空投與空襲也不會落在上面。',
    'Small maps get 1/3/5, big maps 3/5. They are spread out and never touch, visible from the start and never under bricks. Airdrops and air raids never land on them.');
  var FXN = [[0, '糖漿', 'Syrup'], [1, '洋流', 'Ocean current'], [2, '磁浮輸送帶', 'Maglev belt'], [3, '草叢', 'Tall grass'], [4, '流沙', 'Quicksand'], [5, '積雪', 'Deep snow'], [7, '產線輸送帶', 'Assembly belt'], [8, '石筍', 'Stalagmites'], [9, '骨刺', 'Bone spikes'], [10, '黑曜石刺', 'Obsidian spikes'], [11, '聖誕樹叢', 'Christmas bushes'], [12, '旋轉輸送台', 'Spinning belt']];
  FXN.forEach(function (x) { L('fxn.' + x[0], x[1], x[2]); });

  /* ---------- 連線狀態 ---------- */
  L('net.badConfig', '伺服器設定有誤', 'Server setup error');
  L('net.unset', '尚未設定伺服器', 'No server set');
  L('net.open', '已連線', 'Connected');
  L('net.waking', '伺服器睡醒中…', 'Server waking up…');
  L('net.offline', '連不上伺服器', 'Cannot reach server');
  L('net.retrying', '重新連線中…', 'Reconnecting…');
  L('net.idle', '未連線', 'Not connected');
  L('net.connecting', '連線中…', 'Connecting…');
  L('net.bannerWaking', '伺服器正在睡醒，約需 30～60 秒…（已等 {s} 秒）', 'The server is waking up, about 30 to 60 seconds… ({s}s so far)');
  L('net.bannerConnecting', '連線中…', 'Connecting…');
  L('net.bannerRetrying', '連線中斷，正在重新連線…', 'Connection lost, reconnecting…');
  L('net.bannerOffline', '連不上伺服器，稍後自動重試', 'Cannot reach the server, retrying soon');
  L('cfg.err.badUrl', 'server URL 必須是 http/https 開頭的絕對網址', 'The server URL must be an absolute http/https address');
  L('cfg.err.mixed', '頁面走 https 時不接受 http 的 server URL（瀏覽器會擋混合內容）', 'An http server URL is not accepted on an https page (browsers block mixed content)');

  /* ---------- 線上大廳 / 房間 ---------- */
  L('online.reason.invalid', '這個邀請連結無效，請向房主要一條新的。', 'This invite link is not valid. Ask the host for a new one.');
  L('online.reason.revoked', '房主已經撤銷這個邀請連結。', 'The host has revoked this invite link.');
  L('online.reason.expired', '這個邀請連結已經過期。', 'This invite link has expired.');
  L('online.reason.closed', '這個房間已經結束了。', 'This room has ended.');
  L('online.reason.banned', '你已被請出這個房間。', 'You have been removed from this room.');
  L('online.reason.spec_full', '觀戰席已經滿了。', 'The spectator seats are full.');
  L('online.phase.lobby', '等待中', 'Waiting');
  L('online.phase.playing', '對戰中', 'Playing');
  L('online.phase.finished', '已結束', 'Finished');
  L('lobby.title', '線上大廳', 'Online Lobby');
  L('lobby.onlineCount', '目前在線：{count} 人', 'Online now: {count}');
  L('lobby.me', '我', 'Me');
  L('lobby.start', '開始', 'Start');
  L('lobby.rooms', '房間列表', 'Rooms');
  L('lobby.canJoin', '可以加入或觀戰', 'Join or watch');
  L('lobby.gotIt', '知道了', 'Got it');
  L('lobby.profileHint', '你在線上的暱稱與角色', 'Your online name and character');
  L('lobby.edit', '修改', 'Edit');
  L('lobby.quick', '快速加入', 'Quick Join');
  L('lobby.create', '建立房間', 'Create Room');
  L('lobby.emptyConnect', '連線後會顯示目前的房間。', 'Rooms will show up once you are connected.');
  L('lobby.emptyNoServer', '沒有設定線上伺服器，這個版本只能玩單機。', 'No online server is set up, so this version can only play solo.');
  L('lobby.emptyList', '現在沒有房間。按「快速加入」或「建立房間」開第一間吧！', 'No rooms yet. Tap "Quick Join" or "Create Room" to open the first one!');
  L('room.code', '代號 {id}', 'Code {id}');
  L('room.count', '{n}/{max} 人', '{n}/{max} players');
  L('room.watching', '觀戰 {n}', 'Watching {n}');
  L('room.host', '房主 {name}', 'Host {name}');
  L('room.minutes', '{n} 分鐘', '{n} min');
  L('room.join', '加入', 'Join');
  L('room.watch', '觀戰', 'Watch');
  L('room.defaultName', '{name}的房間', '{name}\'s room');
  L('invite.aria', '邀請', 'Invite');
  L('invite.badTitle', '這個邀請不能用', 'This invite does not work');
  L('invite.badText', '邀請連結無法使用。', 'This invite link cannot be used.');
  L('invite.backLobby', '回到大廳', 'Back to lobby');
  L('invite.checking', '正在確認邀請…', 'Checking invite…');
  L('invite.checkingOn', '稍等一下，正在向伺服器確認房間。', 'One moment, checking the room with the server.');
  L('invite.checkingOff', '等待連上伺服器…（免費主機睡著時要 30～60 秒）', 'Waiting for the server… (a sleeping free host takes 30 to 60 seconds)');
  L('invite.skip', '不加入', 'No thanks');
  L('invite.title', '你被邀請加入「{name}」', 'You are invited to "{name}"');
  L('invite.whyStarted', '（對局已經開始）', ' (match already started)');
  L('invite.whyFull', '（席位已滿）', ' (seats are full)');
  L('invite.asSpec', '以觀戰者加入{why}', 'Join as spectator{why}');
  L('invite.asPlayer', '以玩家加入', 'Join as player');
  L('invite.note', '確認暱稱後才會進房間。', 'Confirm your name to enter the room.');
  L('invite.noteSpec', '觀戰者看得到整場比賽，也能聊天。', ' Spectators can watch the whole match and chat.');
  L('invite.goSpec', '進去觀戰', 'Watch');
  L('invite.goPlay', '加入遊戲', 'Join game');
  L('online.noServer', '還沒設定線上伺服器', 'No online server yet');
  L('online.noServerText', '這個網頁沒有設定 server URL。部署時請把 GAME_SERVER_URL 設成後端的 https 網址（詳見 README），現在只能玩單機。', 'This page has no server URL set. When deploying, set GAME_SERVER_URL to the backend https address (see the README). Only solo play is available for now.');
  L('online.playSolo', '改玩單機', 'Play solo');
  L('online.myProfile', '我的暱稱與角色', 'My name & character');
  L('create.title', '建立房間', 'Create Room');
  L('create.name', '房間名稱', 'Room name');
  L('create.max', '人數上限', 'Max players');
  L('create.players', '{n} 人', '{n} players');
  L('create.placeholder', '{name}的房間', '{name}\'s room');
  L('create.note', '建立後可以加電腦、調整地圖與時間，再用邀請連結叫朋友來。', 'After creating the room you can add computers, set the map and time, then invite friends with a link.');
  L('create.ok', '建立', 'Create');
  L('room.title', '房間', 'Room');
  L('room.entering', '進入房間中…', 'Entering room…');
  L('room.syncing', '正在同步房間資料…', 'Syncing room data…');
  L('room.leaveAria', '離開房間', 'Leave room');
  L('room.seats', '玩家席位', 'Seats');
  L('room.chat', '聊天室', 'Chat');
  L('room.rules', '規則', 'Rules');
  L('room.empty', '空位', 'Empty');
  L('room.addAi', '加電腦', 'Add CPU');
  L('room.remove', '移除 {name}', 'Remove {name}');
  L('room.cpu', '電腦', 'CPU');
  L('room.seatAnimal', '{name} 角色', '{name} character');
  L('room.seatLevel', '{name} 難度', '{name} level');
  L('room.hostTag', '房主', 'Host');
  L('room.youTag', '你', 'You');
  L('room.ready', '準備好了', 'Ready');
  L('room.notReady', '未準備', 'Not ready');
  L('room.offline', '斷線中', 'Offline');
  L('room.kick', '請出 {name}', 'Kick {name}');
  L('room.kickTitle', '請出 {name}？', 'Kick {name}?');
  L('room.kickText', '被請出的人無法再加入這個房間。', 'A kicked player cannot rejoin this room.');
  L('room.kickOk', '請出', 'Kick');
  L('room.specSeats', '觀戰席', 'Spectators');
  L('room.noSpec', '沒有人在觀戰。觀戰者可以看整場比賽並聊天，不佔玩家席位。', 'Nobody is watching. Spectators can watch the whole match and chat without using a player seat.');
  L('room.specYou', '（你）', ' (you)');
  L('room.youHost', '你是房主', 'You are the host');
  L('room.youPlayer', '你是玩家', 'You are a player');
  L('room.youSpec', '你是觀戰者', 'You are a spectator');
  L('room.playing', '對局進行中…', 'Match in progress…');
  L('room.finishedHost', '這局結束了，準備好就再來一局。', 'The match is over. Start another round when you are ready.');
  L('room.finishedGuest', '這局結束了，等房主開下一局。', 'The match is over. Waiting for the host to start the next round.');
  L('room.again', '再來一局', 'Play again');
  L('room.whyFew', '至少要 2 位玩家，可以加電腦。', 'At least 2 players are needed. You can add CPUs.');
  L('room.whyReady', '還有玩家沒按「準備好」。', 'Some players have not pressed "Ready" yet.');
  L('room.startGame', '開始遊戲', 'Start Game');
  L('room.unready', '取消準備', 'Not ready');
  L('room.imReady', '我準備好了', 'I\'m ready');
  L('room.toSpec', '改為觀戰', 'Spectate');
  L('room.sit', '加入對戰', 'Join match');
  L('room.seatsFull', '席位已滿', 'Seats full');
  L('room.noSit', '對局開始後無法換成玩家。', 'You cannot become a player once the match has started.');
  L('room.invite', '邀請朋友', 'Invite friends');
  L('room.leave', '離開房間', 'Leave room');
  L('room.players', '人數', 'Players');
  L('room.maxPlayers', '人數上限', 'Max players');
  L('room.nPlayers', '{n} 人', '{n} players');
  L('room.onlyHost', '只有房主可以調整設定。', 'Only the host can change settings.');
  L('inv.title', '邀請朋友', 'Invite Friends');
  L('inv.note', '連結只對這個房間有效，房間關閉、被撤銷或 24 小時後就失效。朋友打開後要先確認暱稱才會進房。', 'The link only works for this room and expires when the room closes, is revoked, or after 24 hours. Friends confirm their name before entering.');
  L('inv.who', '對方身分', 'Invitee role');
  L('inv.player', '玩家', 'Player');
  L('inv.spectator', '觀戰者', 'Spectator');
  L('inv.make', '產生連結', 'Create link');
  L('inv.none', '還沒有有效的邀請連結。選好身分後按「產生連結」。', 'No active invite links yet. Choose a role, then tap "Create link".');
  L('inv.specLink', '觀戰連結', 'Spectator link');
  L('inv.playerLink', '玩家連結', 'Player link');
  L('inv.copy', '複製', 'Copy');
  L('inv.share', '分享', 'Share');
  L('inv.copied', '已複製連結', 'Link copied');
  L('inv.copyFail', '複製失敗，請長按連結手動複製', 'Copy failed. Long-press the link to copy it.');
  L('inv.shareText', '一起來玩炸彈小隊！', 'Come play Bomb Squad with me!');
  L('inv.shareTitle', '炸彈小隊', 'Bomb Squad');
  L('inv.revokeAll', '撤銷全部連結', 'Revoke all');
  L('inv.revokeTitle', '撤銷所有邀請連結？', 'Revoke all invite links?');
  L('inv.revokeText', '之前發出去的連結都會失效。', 'All links you shared will stop working.');
  L('inv.revokeOk', '撤銷', 'Revoke');
  L('online.roomEnded', '房間已經結束了', 'The room has ended');
  L('online.joinFailed', '無法加入這個房間', 'Cannot join this room');
  L('online.closedDefault', '房間已經關閉了', 'The room was closed');
  L('online.kickedDefault', '你被請出房間了', 'You were removed from the room');
  L('online.kickedNotice', '你被房主請出房間了', 'The host removed you from the room');
  L('online.errorDefault', '發生錯誤', 'Something went wrong');
  L('online.replaced', '這個帳號在別處開啟了，這裡已中斷', 'This account was opened elsewhere, so this tab was disconnected');
  L('online.replacedBanner', '已在其他視窗開啟，這個視窗不再連線', 'Opened in another window; this window is no longer connected');

  /* ---------- 伺服器回傳的代碼訊息（server 仍附中文 text 當後備） ---------- */
  L('srv.err.banned', '你已被請出這個房間', 'You have been removed from this room');
  L('srv.err.spec_full', '觀戰席已滿', 'The spectator seats are full');
  L('srv.err.full', '席位已滿', 'The seats are full');
  L('srv.err.max', '目前已有 {n} 個席位有人，人數上限不能再低了', '{n} seats are already taken, so the limit cannot go lower');
  L('srv.err.taken', '這個角色已經有玩家在用了', 'Another player is already using this character');
  L('srv.err.few', '至少要有 2 位玩家（可以加電腦）', 'At least 2 players are needed (you can add CPUs)');
  L('srv.err.notready', '還有 {n} 位玩家沒按「準備好」', '{n} player(s) have not pressed "Ready" yet');
  L('srv.sys.joined', '{name} 加入了房間', '{name} joined the room');
  L('srv.sys.watching', '{name} 開始觀戰', '{name} started watching');
  L('srv.sys.created', '{name} 建立了房間', '{name} created the room');
  L('srv.sys.sat', '{name} 加入對戰', '{name} joined the match');
  L('srv.sys.to_spec', '{name} 改為觀戰', '{name} switched to watching');
  L('srv.sys.revoked', '房主撤銷了所有邀請連結', 'The host revoked all invite links');
  L('srv.sys.rematch', '回到房間，準備下一局', 'Back in the room, get ready for the next round');
  L('srv.sys.left', '{name} 離開了房間', '{name} left the room');
  L('srv.sys.left_timeout', '{name} 斷線太久，已離開', '{name} was disconnected too long and left');
  L('srv.sys.left_kicked', '{name} 被請出房間', '{name} was removed from the room');
  L('srv.sys.left_spec', '{name} 不再觀戰', '{name} stopped watching');
  L('srv.sys.new_host', '{name} 成為新房主', '{name} is the new host');
  L('srv.closed.room_empty', '房間已經沒有玩家，自動關閉了', 'The room has no players left and closed automatically');
  L('srv.closed.kicked', '你被房主請出房間了', 'The host removed you from the room');
  L('srv.note.note_playing', '對局進行中，先以觀戰者身分加入', 'A match is in progress, so you joined as a spectator');
  L('srv.note.note_full', '席位已滿，先以觀戰者身分加入', 'The seats are full, so you joined as a spectator');
  L('srv.note.note_quick', '目前沒有可加入的房間，幫你開了一間', 'No open rooms right now, so we made one for you');

  if (root.I18N) {
    root.I18N.register('zh-Hant', zh);
    root.I18N.register('en', en);
    /* 把資料表裡的文字欄位（動物名、主題名…）改成依目前語言取字的存取器；原本的中文留作後備。 */
    root.I18N.defineText = function (obj, field, key) {
      var orig = obj[field];
      Object.defineProperty(obj, field, {
        get: function () { return root.I18N.t(key, null, orig); },
        set: function (v) { orig = v; },
        enumerable: true, configurable: true
      });
    };
  }
  /* 給測試用（Node 載入時） */
  if (typeof module !== 'undefined' && module.exports) module.exports = { zh: zh, en: en };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));

// 由繁體中文介面字典轉換；動態參數（暱稱、分數等）維持原值。
(function (root) {
  var hans = {
    "meta.title": "炸弹小队｜免费线上多人炸弹对战",
    "meta.desc": "免费线上炸弹对战，放炸弹炸开砖块、拾取道具，在连锁爆炸中闪躲求生。单机挑战不同难度电脑，或建立多人房间邀朋友较劲，支援观战与邀请连结，免下载，手机平板可玩。",
    "lang.switchTo": "切换成 English",
    "lang.label": "语言",
    "lang.zh": "繁体中文",
    "lang.en": "English",
    "common.cancel": "取消",
    "common.ok": "确定",
    "common.close": "关闭",
    "common.back": "返回",
    "common.done": "完成",
    "common.select": "请选择",
    "ui.dec": "{label} 减少",
    "ui.inc": "{label} 增加",
    "noscript": "炸弹小队需要开启 JavaScript 才能玩。",
    "lobbyLink.text": "← 回游戏大厅",
    "lobbyLink.aria": "回游戏大厅",
    "settings.open": "设定",
    "home.title": "炸弹小队",
    "home.sub": "放炸弹、炸砖块、捡道具，当最后的小队长！",
    "home.menu": "主选单",
    "home.solo": "一个人玩",
    "home.online": "跟别人玩",
    "home.help": "怎么玩",
    "home.cast": "角色介绍",
    "home.recSolo": "单机 {w} 胜／{p} 场",
    "home.recOnline": "线上 {w} 胜／{p} 场",
    "home.record": "本机战绩：{s}",
    "cast.title": "角色介绍",
    "cast.note": "每只的开场能力都在 1～2 之间：火力或炸弹多的，跑得就慢一点。捡道具能升级，但每只的上限不一样（深色是开场、浅色是最多能升到哪；跑速的「+6 次」是最多能加速几次），三项上限加起来每只都一样多，没有谁全面比较强，挑喜欢的玩法就好。",
    "cast.fire": "火力",
    "cast.bomb": "炸弹",
    "cast.speed": "跑速",
    "cast.fast": "快",
    "cast.mid": "中",
    "cast.slow": "慢",
    "cast.tiles": "{a}→{b} 格",
    "cast.bombs": "{a}→{b} 颗",
    "cast.boosts": "{s} +{n} 次",
    "cast.startSolo": "开始单机练习",
    "cast.home": "回首页",
    "help.title": "怎么玩",
    "help.goal": "目标",
    "help.goal1": "在方格地图上放炸弹，炸开软砖、捡道具、把对手炸出局。场上只剩你一个，就是胜利者！",
    "help.goal2": "时间到还有好几人活着时，击倒对手最多的人获胜，同分就是平手。",
    "help.goal3": "游戏超过 2 分 30 秒会开始空袭：每 2 秒就有炸弹从天上掉到随机空格，3 秒后爆炸、火力横扫到墙边；每过 10 秒每次多掉 1 颗（2:40 起 2 颗、2:50 起 3 颗，最多 3 颗）。空袭炸死人不算击倒。",
    "help.controls": "操作",
    "help.kbd": "电脑键盘：",
    "help.move": "移动　",
    "help.or": " 或 ",
    "help.arrows": "方向键",
    "help.placeBomb": "放炸弹 ",
    "help.space": "空白键",
    "help.touch": "平板与手机：左下角摇杆移动、右下角粉红按钮放炸弹（设定里可以换左右手）。",
    "help.blast": "炸弹怎么炸",
    "help.s1": "放下炸弹约 3 秒后爆炸，往上下左右喷出火焰，长度就是你的「火力」。",
    "help.s2": "火焰被硬墙挡住；碰到软砖会把它炸掉，并且在那里停下。",
    "help.s3": "火焰碰到别的炸弹会立刻引爆它，形成连锁爆炸！火焰不会被炸弹挡住，连锁时每个方向以火力最长的那颗为准。",
    "help.s4": "刚放下炸弹时可以走开，离开后它就变成障碍物。",
    "help.s5": "被火焰碰到就出局，自己的炸弹也一样，小心逃生。",
    "help.items": "道具",
    "help.items1": "炸开软砖有机会掉出道具；每隔 45 秒还会有空投机飞过地图，投下 1～2 个好道具。圆形是好道具，带尖刺的紫色外框是诅咒，会限时捉弄你。出局时，身上一半的强化道具会喷出来。",
    "help.figAria": "爆炸示意图：炸弹往上下左右喷出火焰，遇到硬墙停下，炸掉第一块软砖",
    "help.figHard": "硬墙",
    "help.figSoft": "软砖",
    "profile.nickname": "暱称",
    "profile.placeholder": "帮自己取个名字（最多 10 字）",
    "profile.animal": "角色",
    "profile.choose": "选择角色",
    "name.auto": "{adj}{animal}",
    "name.adj0": "快乐",
    "name.adj1": "勇敢",
    "name.adj2": "调皮",
    "name.adj3": "害羞",
    "name.adj4": "闪亮",
    "name.adj5": "软绵绵",
    "name.adj6": "圆滚滚",
    "name.adj7": "机灵",
    "name.adj8": "呆萌",
    "name.adj9": "活泼",
    "solo.title": "一个人玩",
    "solo.you": "你的角色",
    "solo.cpu": "电脑对手",
    "solo.count": "数量",
    "solo.countLabel": "电脑数量",
    "solo.levelAll": "电脑难度",
    "solo.detail": "逐一调整角色与难度",
    "solo.collapse": "收起",
    "solo.cpuN": "电脑 {n}",
    "solo.cpuTitle": "电脑 {n}・{lv}",
    "solo.cpuAnimal": "电脑 {n} 角色",
    "solo.cpuLevel": "电脑 {n} 难度",
    "solo.rules": "规则",
    "solo.start": "开始游戏",
    "rules.time": "时间",
    "rules.timeLimit": "时间限制",
    "rules.items": "道具",
    "rules.map": "地图",
    "rules.min": "{n} 分",
    "rules.noLimit": "不限时",
    "rules.itemNone": "无道具",
    "rules.itemOn": "有道具",
    "rules.itemCurse": "道具＋诅咒",
    "rules.layoutSuffix": "{l}版型",
    "rules.fab": "产线",
    "level.toddler": "幼幼班",
    "level.easy": "简单",
    "level.normal": "普通",
    "level.hard": "困难",
    "level.myth": "神话",
    "level.hint.toddler": "乱走、很少放炸弹",
    "level.hint.easy": "会躲炸弹、偶尔追人",
    "level.hint.normal": "会追人、会连锁",
    "level.hint.hard": "会设陷阱、反应最快",
    "level.hint.myth": "几乎不失误、追得最紧",
    "level.power": "强度 {n}・{hint}",
    "layout.random": "随机",
    "layout.classic": "经典",
    "layout.open": "空旷",
    "layout.dense": "密集",
    "layout.fab": "产线",
    "layout.hint.random": "每局抽一种版型",
    "layout.hint.classic": "硬墙一组一组散落",
    "layout.hint.open": "硬墙很少，空间大",
    "layout.hint.dense": "硬墙多，巷战多",
    "animal.cat.name": "小猫",
    "animal.cat.role": "均衡型",
    "animal.cat.intro": "身手灵巧、猫步轻快，火力能练到 10、炸弹能带 9 颗，样样都不差。",
    "animal.dog.name": "小狗",
    "animal.dog.role": "炸弹型",
    "animal.dog.intro": "最爱挖洞埋东西，开场就有 2 颗炸弹，最多能带 10 颗。",
    "animal.bunny.name": "小兔",
    "animal.bunny.role": "速度型",
    "animal.bunny.intro": "跑得飞快，还能加速 8 次越跑越快！但火力和炸弹的上限比别只低一些。",
    "animal.bear.name": "小熊",
    "animal.bear.role": "火力型",
    "animal.bear.intro": "力气大，开场火力就有 2 格，最远能喷到 12 格！",
    "animal.panda.name": "熊猫",
    "animal.panda.role": "力量型",
    "animal.panda.intro": "圆滚滚的实力派，开场火力、炸弹都是 2，火力能练到 11，可惜跑不太动。",
    "animal.fox.name": "狐狸",
    "animal.fox.role": "陷阱型",
    "animal.fox.intro": "狡猾爱布陷阱，开场 2 颗炸弹，脚程也还能练得很快。",
    "animal.frog.name": "青蛙",
    "animal.frog.role": "远攻型",
    "animal.frog.intro": "舌头长长，火力 2 格起跳，蹦蹦跳跳也能加速 7 次。",
    "animal.penguin.name": "企鹅",
    "animal.penguin.role": "重砲型",
    "animal.penguin.intro": "摇摇摆摆跑得慢，但开场火力、炸弹都是 2，炸弹能带到 10 颗。",
    "animal.chick.name": "小鸡",
    "animal.chick.role": "游击型",
    "animal.chick.intro": "小小一只跑得飞快，炸弹能带到 10 颗到处丢，可惜火力上限只有 8。",
    "theme.0": "糖果乐园",
    "theme.1": "海底世界",
    "theme.2": "太空站",
    "theme.3": "森林",
    "theme.4": "沙漠",
    "theme.5": "雪地",
    "theme.6": "竞技场",
    "theme.7": "日月光厂房",
    "theme.8": "矿山",
    "theme.9": "地下墓穴",
    "theme.10": "火山",
    "theme.11": "圣诞小镇",
    "theme.12": "游乐园",
    "theme.random": "随机",
    "theme.random.hint": "每局换一个主题",
    "item.fire": "火力 +1",
    "item.bomb": "炸弹 +1",
    "item.speed": "加速",
    "item.kick": "踢炸弹",
    "item.shield": "护盾",
    "item.c_slow": "迟缓诅咒",
    "item.c_auto": "手滑诅咒",
    "item.c_short": "短火诅咒",
    "item.ghost": "隐身",
    "item.super": "超人标志",
    "item.ultra": "大力药丸",
    "item.c_flip": "方向颠倒诅咒",
    "item.desc.fire": "爆炸往外多延伸 1 格（上限 8～12 格，看角色）",
    "item.desc.bomb": "可以同时放的炸弹多 1 颗（上限 7～10 颗，看角色）",
    "item.desc.speed": "跑得更快（能加速 5～8 次，看角色）",
    "item.desc.kick": "走向炸弹就能把它踢着滑走，直到撞到东西",
    "item.desc.shield": "挡掉一次爆炸，之后有 1 秒无敌",
    "item.desc.c_slow": "6 秒内只能慢慢走",
    "item.desc.c_auto": "8 秒内会自己一直放炸弹",
    "item.desc.c_short": "8 秒内爆炸只剩 1 格长",
    "item.desc.ghost": "8 秒内对手只看得到你淡淡的身形（电脑对手完全看不到你；你自己会变半透明）；炸弹和火焰照常有效",
    "item.desc.super": "8 秒内火力、炸弹数、跑速都变成你这只角色的最高值",
    "item.desc.ultra": "火力直接升到你这只角色的最高值（不会消失）",
    "item.desc.c_flip": "8 秒内上下左右操作颠倒",
    "game.chat": "聊天室",
    "game.chatPlaceholder": "输入讯息…",
    "game.chatAria": "聊天讯息",
    "game.send": "送出",
    "game.specTag": "（观战）",
    "quick.0": "快跑！",
    "quick.1": "小心炸弹",
    "quick.2": "好险",
    "quick.3": "再来一局",
    "quick.4": "GG",
    "game.canvas": "对战地图",
    "game.timeLeft": "剩余时间",
    "game.playerStatus": "玩家状态",
    "game.spectating": "观战中",
    "game.closeSide": "收合资讯栏",
    "game.pauseMenu": "暂停选单",
    "game.leaveMatch": "离开对局",
    "game.side": "对局",
    "game.sideAria": "对局资讯与聊天室",
    "game.openSide": "展开资讯栏与聊天室",
    "game.sideTitle": "资讯栏",
    "game.ping": "连线延迟",
    "game.mapInfo": "地图资讯",
    "game.mapTitle": "地图：{th}／{lay}",
    "game.stick": "移动摇杆",
    "game.rotate": "请横向游玩",
    "game.bomb": "放炸弹",
    "game.ready": "准备！",
    "game.cpu": "电脑",
    "game.cpuLevel": "电脑・{lv}",
    "game.player": "玩家",
    "game.left": "・已离场",
    "game.out": "・已淘汰",
    "game.you": "（你）",
    "game.killsTitle": "击倒数",
    "game.kills": "击倒 {n}",
    "game.fire": "火力",
    "game.bombs": "炸弹",
    "game.speed": "速度",
    "game.kick": "踢炸弹",
    "game.shield": "护盾",
    "game.yes": "有",
    "game.no": "无",
    "game.buff": "{name}・{s} 秒",
    "game.eliminated": "淘汰",
    "game.leftShort": "已离场",
    "game.ff": "快转",
    "game.ffOff": "恢复速度",
    "pause.title": "暂停",
    "pause.textOnline": "线上对局不会暂停，其他人还在继续。",
    "pause.text": "游戏已暂停。",
    "pause.leave": "离开房间",
    "pause.resume": "继续",
    "pause.toRoom": "回房间",
    "pause.restart": "重新开始",
    "leave.title": "离开房间？",
    "leave.text": "离开后会回到线上大厅。",
    "leave.ok": "离开",
    "result.draw": "平手！",
    "result.drawTimeout": "时间到，击倒数相同",
    "result.drawBoom": "最后的人同时被炸到了",
    "result.youWin": "你赢了！",
    "result.youWinTime": "时间到，你击倒最多！",
    "result.youWinLast": "你是最后的幸存者！",
    "result.nameWins": "{name} 获胜！",
    "result.mostKos": "时间到，击倒数最多",
    "result.lastOne": "最后的幸存者",
    "result.lose": "这次输了…",
    "result.loseTime": "{name} 击倒最多，赢了这局",
    "result.loseLast": "{name} 是最后的幸存者",
    "result.record": "本机战绩：{w} 胜／{p} 场",
    "result.you": "（你）",
    "result.length": "这局共 {m} 分 {s} 秒",
    "result.backRoom": "回房间",
    "result.again": "再来一局",
    "result.leave": "离开房间",
    "result.toRoom": "回到房间",
    "result.aria": "对局结果",
    "settings.title": "设定",
    "settings.sound": "声音",
    "settings.bgm": "背景音乐",
    "settings.sfx": "音效",
    "settings.bgmVol": "音乐音量",
    "settings.sfxVol": "音效音量",
    "settings.controls": "操作与辅助",
    "settings.touch": "触控按键",
    "settings.auto": "自动",
    "settings.show": "显示",
    "settings.hide": "隐藏",
    "settings.stick": "摇杆位置",
    "settings.left": "左手边",
    "settings.touchScale": "操作钮大小",
    "settings.touchOpacity": "操作钮透明度",
    "settings.right": "右手边",
    "settings.vibrate": "震动",
    "settings.calm": "减少动态",
    "settings.assist": "形状辅助",
    "settings.assistNote": "形状辅助：在暱称旁加上圆、三角、星星等形状，不只靠颜色分辨玩家。",
    "settings.reset": "恢复预设",
    "settings.resetDone": "已恢复预设设定",
    "map.pick": "选择地图",
    "map.tapChange": "{l}版型・点一下更换",
    "map.reroll": "换一张",
    "map.theme": "主题",
    "map.layout": "版型",
    "map.themeGroup": "地图主题",
    "map.layoutGroup": "地图版型",
    "map.previewAria": "地图预览：{shown}，{l}版型",
    "map.bigTitle": "{th}・{l}版型",
    "map.fabNote": "日月光厂房固定使用「产线」版型（横向机台排排站，一定有输送带），不受上面的版型选项影响。",
    "map.sub.any": "这只是其中一种可能，每局都会重新抽。",
    "map.sub.one": "预览只是其中一张，每局的硬墙与软砖位置都不一样。",
    "map.apply": "套用",
    "map.fxTitle": "地图机关",
    "map.fxIntro": "每个主题最多有 1 种专属机关（竞技场没有），机关不多，免得干扰你自己的操作；有机关的主题，每张图约 {keep}% 会出现，位置依 seed 随机分布并避开出生点周围。",
    "map.fxChip": "{th}：{fx}",
    "map.noFx": "{th}：没有机关",
    "map.noFxText": "单纯的比赛场地，只有硬墙、软砖和道具。",
    "map.fxOf": "{th}的机关：{fx}",
    "map.fxAlso": "（{name}）",
    "map.fxChance": "这个主题每张图约 {keep}% 会出现机关（也可能这一张没有）；预览换一张可以看到不同的配置。",
    "fx.grass.name": "草丛",
    "fx.grass.l1": "躲进草丛，其他人（电脑也一样）就完全看不到你，连你放在草丛里的炸弹也看不到（但炸弹的火力线警示还是看得到；空袭的炸弹不受影响，永远看得到）；没有例外，贴在旁边、你自己、淘汰后或观战的人也都看不到。",
    "fx.grass.l2": "草丛只放在走道格（左右都是硬墙，或上下都是硬墙），所以里面的炸弹只会沿着一条直线炸。小图放 1／3／5 格，大图放 3／5 格；彼此不相连，开局就看得见，不盖软砖。",
    "fx.belt.name": "输送带",
    "fx.belt.l1": "头尾相连、形状不规则的环形输送带：踩上去会被顺着带子一路绕圈带走，停在上面的炸弹也会被载走。",
    "fx.belt.l2": "炸弹前面有人或障碍就停住，离开带子就停下。四个角落各一圈，可以和软砖叠在一起，砖炸掉才露出来。",
    "fx.slow.name": "缓速格",
    "fx.slow.l1": "踩上去速度只剩一半，离开就恢复；格子右下角有蜗牛记号。",
    "fx.slow.l2": "小图放 1／3／5 格，大图放 3／5 格；一格一格散开、不会相连，可以和软砖叠在一起，砖炸掉才露出来。",
    "fx.spike.name": "尖刺",
    "fx.spike.l1": "固定的尖刺，不会伤人；但炸弹放在上面、或被踢到（滑到）上面，会当场爆炸。",
    "fx.spike.l2": "小图放 1／3／5 个，大图放 3／5 个；一个一个散开、不会相连，开局就看得见，不盖软砖；空投与空袭也不会落在上面。",
    "fxn.0": "糖浆",
    "fxn.1": "洋流",
    "fxn.2": "磁浮输送带",
    "fxn.3": "草丛",
    "fxn.4": "流沙",
    "fxn.5": "积雪",
    "fxn.7": "产线输送带",
    "fxn.8": "石笋",
    "fxn.9": "骨刺",
    "fxn.10": "黑曜石刺",
    "fxn.11": "圣诞树丛",
    "fxn.12": "旋转输送台",
    "net.badConfig": "伺服器设定有误",
    "net.unset": "尚未设定伺服器",
    "net.open": "已连线",
    "net.waking": "伺服器睡醒中…",
    "net.offline": "连不上伺服器",
    "net.retrying": "重新连线中…",
    "net.idle": "未连线",
    "net.connecting": "连线中…",
    "net.bannerWaking": "伺服器正在睡醒，约需 30～60 秒…（已等 {s} 秒）",
    "net.bannerConnecting": "连线中…",
    "net.bannerRetrying": "连线中断，正在重新连线…",
    "net.bannerOffline": "连不上伺服器，稍后自动重试",
    "cfg.err.badUrl": "server URL 必须是 http/https 开头的绝对网址",
    "cfg.err.mixed": "页面走 https 时不接受 http 的 server URL（浏览器会挡混合内容）",
    "online.reason.invalid": "这个邀请连结无效，请向房主要一条新的。",
    "online.reason.revoked": "房主已经撤销这个邀请连结。",
    "online.reason.expired": "这个邀请连结已经过期。",
    "online.reason.closed": "这个房间已经结束了。",
    "online.reason.banned": "你已被请出这个房间。",
    "online.reason.spec_full": "观战席已经满了。",
    "online.phase.lobby": "等待中",
    "online.phase.playing": "对战中",
    "online.phase.finished": "已结束",
    "lobby.title": "线上大厅",
    "lobby.onlineCount": "当前在线：{count} 人",
    "lobby.me": "我",
    "lobby.start": "开始",
    "lobby.rooms": "房间列表",
    "lobby.canJoin": "可以加入或观战",
    "lobby.gotIt": "知道了",
    "lobby.profileHint": "你在线上的暱称与角色",
    "lobby.edit": "修改",
    "lobby.quick": "快速加入",
    "lobby.create": "建立房间",
    "lobby.emptyConnect": "连线后会显示目前的房间。",
    "lobby.emptyNoServer": "没有设定线上伺服器，这个版本只能玩单机。",
    "lobby.emptyList": "现在没有房间。按「快速加入」或「建立房间」开第一间吧！",
    "room.code": "代号 {id}",
    "room.count": "{n}/{max} 人",
    "room.watching": "观战 {n}",
    "room.host": "房主 {name}",
    "room.minutes": "{n} 分钟",
    "room.join": "加入",
    "room.watch": "观战",
    "room.defaultName": "{name}的房间",
    "invite.aria": "邀请",
    "invite.badTitle": "这个邀请不能用",
    "invite.badText": "邀请连结无法使用。",
    "invite.backLobby": "回到大厅",
    "invite.checking": "正在确认邀请…",
    "invite.checkingOn": "稍等一下，正在向伺服器确认房间。",
    "invite.checkingOff": "等待连上伺服器…（免费主机睡着时要 30～60 秒）",
    "invite.skip": "不加入",
    "invite.title": "你被邀请加入「{name}」",
    "invite.whyStarted": "（对局已经开始）",
    "invite.whyFull": "（席位已满）",
    "invite.asSpec": "以观战者加入{why}",
    "invite.asPlayer": "以玩家加入",
    "invite.note": "确认暱称后才会进房间。",
    "invite.noteSpec": "观战者看得到整场比赛，也能聊天。",
    "invite.goSpec": "进去观战",
    "invite.goPlay": "加入游戏",
    "online.noServer": "还没设定线上伺服器",
    "online.noServerText": "这个网页没有设定 server URL。部署时请把 GAME_SERVER_URL 设成后端的 https 网址（详见 README），现在只能玩单机。",
    "online.playSolo": "改玩单机",
    "online.myProfile": "我的暱称与角色",
    "create.title": "建立房间",
    "create.name": "房间名称",
    "create.max": "人数上限",
    "create.players": "{n} 人",
    "create.placeholder": "{name}的房间",
    "create.note": "建立后可以加电脑、调整地图与时间，再用邀请连结叫朋友来。",
    "create.ok": "建立",
    "room.title": "房间",
    "room.entering": "进入房间中…",
    "room.syncing": "正在同步房间资料…",
    "room.leaveAria": "离开房间",
    "room.seats": "玩家席位",
    "room.chat": "聊天室",
    "room.rules": "规则",
    "room.empty": "空位",
    "room.addAi": "加电脑",
    "room.remove": "移除 {name}",
    "room.cpu": "电脑",
    "room.seatAnimal": "{name} 角色",
    "room.seatLevel": "{name} 难度",
    "room.hostTag": "房主",
    "room.youTag": "你",
    "room.ready": "准备好了",
    "room.notReady": "未准备",
    "room.offline": "断线中",
    "room.kick": "请出 {name}",
    "room.kickTitle": "请出 {name}？",
    "room.kickText": "被请出的人无法再加入这个房间。",
    "room.kickOk": "请出",
    "room.specSeats": "观战席",
    "room.noSpec": "没有人在观战。观战者可以看整场比赛并聊天，不占玩家席位。",
    "room.specYou": "（你）",
    "room.youHost": "你是房主",
    "room.youPlayer": "你是玩家",
    "room.youSpec": "你是观战者",
    "room.playing": "对局进行中…",
    "room.finishedHost": "这局结束了，准备好就再来一局。",
    "room.finishedGuest": "这局结束了，等房主开下一局。",
    "room.again": "再来一局",
    "room.whyFew": "至少要 2 位玩家，可以加电脑。",
    "room.whyReady": "还有玩家没按「准备好」。",
    "room.startGame": "开始游戏",
    "room.unready": "取消准备",
    "room.imReady": "我准备好了",
    "room.toSpec": "改为观战",
    "room.sit": "加入对战",
    "room.seatsFull": "席位已满",
    "room.noSit": "对局开始后无法换成玩家。",
    "room.invite": "邀请朋友",
    "room.leave": "离开房间",
    "room.players": "人数",
    "room.maxPlayers": "人数上限",
    "room.nPlayers": "{n} 人",
    "room.onlyHost": "只有房主可以调整设定。",
    "inv.title": "邀请朋友",
    "inv.note": "连结只对这个房间有效，房间关闭、被撤销或 24 小时后就失效。朋友打开后要先确认暱称才会进房。",
    "inv.who": "对方身分",
    "inv.player": "玩家",
    "inv.spectator": "观战者",
    "inv.make": "产生连结",
    "inv.none": "还没有有效的邀请连结。选好身分后按「产生连结」。",
    "inv.specLink": "观战连结",
    "inv.playerLink": "玩家连结",
    "inv.copy": "复制",
    "inv.share": "分享",
    "inv.copied": "已复制连结",
    "inv.copyFail": "复制失败，请长按连结手动复制",
    "inv.shareText": "一起来玩炸弹小队！",
    "inv.shareTitle": "炸弹小队",
    "inv.revokeAll": "撤销全部连结",
    "inv.revokeTitle": "撤销所有邀请连结？",
    "inv.revokeText": "之前发出去的连结都会失效。",
    "inv.revokeOk": "撤销",
    "online.roomEnded": "房间已经结束了",
    "online.joinFailed": "无法加入这个房间",
    "online.closedDefault": "房间已经关闭了",
    "online.kickedDefault": "你被请出房间了",
    "online.kickedNotice": "你被房主请出房间了",
    "online.errorDefault": "发生错误",
    "online.replaced": "这个帐号在别处开启了，这里已中断",
    "online.replacedBanner": "已在其他视窗开启，这个视窗不再连线",
    "srv.err.banned": "你已被请出这个房间",
    "srv.err.spec_full": "观战席已满",
    "srv.err.full": "席位已满",
    "srv.err.max": "目前已有 {n} 个席位有人，人数上限不能再低了",
    "srv.err.taken": "这个角色已经有玩家在用了",
    "srv.err.few": "至少要有 2 位玩家（可以加电脑）",
    "srv.err.notready": "还有 {n} 位玩家没按「准备好」",
    "srv.sys.joined": "{name} 加入了房间",
    "srv.sys.watching": "{name} 开始观战",
    "srv.sys.created": "{name} 建立了房间",
    "srv.sys.sat": "{name} 加入对战",
    "srv.sys.to_spec": "{name} 改为观战",
    "srv.sys.revoked": "房主撤销了所有邀请连结",
    "srv.sys.rematch": "回到房间，准备下一局",
    "srv.sys.left": "{name} 离开了房间",
    "srv.sys.left_timeout": "{name} 断线太久，已离开",
    "srv.sys.left_kicked": "{name} 被请出房间",
    "srv.sys.left_spec": "{name} 不再观战",
    "srv.sys.new_host": "{name} 成为新房主",
    "srv.closed.room_empty": "房间已经没有玩家，自动关闭了",
    "srv.closed.kicked": "你被房主请出房间了",
    "srv.note.note_playing": "对局进行中，先以观战者身分加入",
    "srv.note.note_full": "席位已满，先以观战者身分加入",
    "srv.note.note_quick": "目前没有可加入的房间，帮你开了一间"
  };
  if (root.I18N) root.I18N.register('zh-Hans', hans);
  if (typeof module === 'object' && module.exports) module.exports['zh-Hans'] = hans;
})(typeof window !== 'undefined' ? window : globalThis);

/* Server outage translations (shared by the custom notice component). */
(function (root) {
  root.ServerOutageMessages = {
    'zh-Hant': ['線上暫時無法連線', '請稍後重試，期間可繼續遊玩單機版。', '知道了'],
    'zh-Hans': ['线上暂时无法连线', '请稍后重试，期间可继续游玩单机版。', '知道了'],
    en: ['Online unavailable', 'Please try again later. You can keep playing offline.', 'Got it']
  };
})(typeof window !== 'undefined' ? window : globalThis);
