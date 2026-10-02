# 炸彈小隊

可愛街機風的炸彈人遊戲（原創角色與名稱）。單機＋四段 AI、線上房間、觀戰、邀請連結；響應式 PWA，平板觸控優先，也支援滑鼠與鍵盤。零依賴（只需要 Node.js 22 以上）。

## 玩法與模式

- 經典炸彈規則：放炸彈、炸軟磚、撿道具、連鎖爆炸，最後存活者獲勝；時間到則擊倒數最多者獲勝，同分平手。
- 單機：1～7 個電腦，難度 幼幼班／簡單／普通／困難（AI 行為不同，不只是名字）。
- 線上：2～8 人 FFA、房間列表、快速加入、建立房間、房主設定、加電腦、玩家／觀戰者、邀請連結（可撤銷）、聊天室。
- 地圖隨機生成（經典／空曠／密集版型，4 向鏡像對稱並保證連通），8 套主題（含「競技場」與「日月光廠房」，後者隨機版型時固定用「產線」版型）。

## 本機執行

```bash
node server.js          # http://localhost:3120
```

Windows 可雙擊 `start-game.bat`。同一個 Wi-Fi 的平板／手機開終端機顯示的區網網址即可。

## 測試

```bash
npm test                # 規則、AI、房間、真實 WebSocket 端對端
node tests/verify.js    # 規則核心＋AI 完整對局＋AI 難度階梯
node tests/rooms.js     # 房間生命週期（假時鐘）
node tests/server.js    # 伺服器防呆：靜態檔路徑、WebSocket 封包上限、斷線放開按鍵
node scripts/online-check.js
```

瀏覽器煙霧測試（選用，需自行安裝 playwright）：先啟動 server，再 `node scripts/browser-check.js`，會檢查各尺寸直橫向無水平溢出、單機開局、線上邀請／觀戰／自動關閉，並輸出截圖到 `shots/`。

## 部署（GitHub Pages ＋ Render）

1. **後端（Render）**：用 `render.yaml` 建立 Web Service（免費方案），啟動指令 `node server.js`，健康檢查 `/health`。環境變數 `GAME_ALLOWED_ORIGIN` 填前端網址，例如 `https://帳號.github.io`。
2. **前端（GitHub Pages）**：Settings → Pages 選 GitHub Actions；Settings → Variables 新增 `GAME_SERVER_URL`＝Render 的 https 網址。推到 `main` 後 `.github/workflows/pages.yml` 會跑測試、注入網址並部署 `public/`。
3. 也可臨時用網址參數：`https://前端/?server=https://後端`。

| 變數 | 位置 | 說明 |
|---|---|---|
| `PORT` | 後端 | 預設 3120 |
| `GAME_ALLOWED_ORIGIN` | 後端 | 允許的前端 origin，逗號分隔 |
| `GAME_SERVER_URL` | Pages Variable | 前端連線位置，唯一入口是 `public/js/config.js` |

Render 免費方案閒置會休眠，首次連線約 30～60 秒，畫面會顯示喚醒提示；房間只存在記憶體，重啟即消失。

## 假設與規則細節

- 2～8 人混戰、無隊伍；≤4 人用 15×13 地圖，5～8 人用 17×15。
- 斷線寬限 30 秒，超時視為離場，不做 AI 接管；觀戰上限 20 人。
- 邀請 token 隨房間存在，最長 24 小時，可由房主撤銷；角色由 token 決定，改暱稱不會改變權限。
- 房間以「真人玩家」為準：真人降到 0（只剩電腦或觀戰者）立即關閉並通知，已關閉的房間不會復活。
- 線上不做客戶端預測，只做內插；伺服器 20 Hz 廣播快照。
- 音樂與音效是程式即時合成，沒有外部音檔。

## 還需要正式資產

目前所有美術是程式產生的向量圖、音訊是合成音。要上架等級的成品，需要：正式角色與道具插畫（或授權素材）、背景音樂與音效檔（授權清楚）、PWA 多尺寸圖示。
