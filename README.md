# 炸彈小隊

可愛街機風的炸彈人遊戲（原創角色與名稱）。單機＋四段 AI、線上房間、觀戰、邀請連結；響應式 PWA，平板觸控優先，也支援滑鼠與鍵盤。零依賴（只需要 Node.js 22 以上）。

## 玩法與模式

- 經典炸彈規則：放炸彈、炸軟磚、撿道具、連鎖爆炸，最後存活者獲勝；時間到則擊倒數最多者獲勝，同分平手。
- 單機：1～7 個電腦，難度 幼幼班／簡單／普通／困難／神話（AI 行為不同，不只是名字；神話是最強，幾乎不失誤）。
- 線上：2～8 人 FFA、房間列表、快速加入、建立房間、房主設定、加電腦、玩家／觀戰者、邀請連結（可撤銷）、聊天室。
- 地圖隨機生成（經典／空曠／密集／產線版型：硬牆一組一組隨機散落，4 向鏡像對稱並保證連通，軟磚至少填滿 88%，約一半的地圖中央硬牆會換成軟磚），13 套主題（含「競技場」與「日月光廠房」，後者隨機版型時固定用「產線」版型），每個主題各有 2～3 種可破壞／不可破壞的外觀；房間與單機都用「選擇地圖」視窗挑主題與版型。

## 本機執行

```bash
node server.js          # http://localhost:3120
```

Windows 可雙擊 `start-game.bat`。同一個 Wi-Fi 的平板／手機開終端機顯示的區網網址即可。

## 測試

```bash
npm test                # 規則、AI、房間、真實 WebSocket 端對端
node tests/verify.js    # 規則核心＋AI 完整對局＋AI 難度階梯
node tests/layout.js    # 版面：地圖尺寸、對稱連通、出生點、軟磚填充率、格子與人物大小、觸控操作版面（手機／平板 × 直放／橫放）
node tests/rooms.js     # 房間生命週期（假時鐘）
node tests/server.js    # 伺服器防呆：靜態檔路徑、WebSocket 封包上限、斷線放開按鍵
node scripts/online-check.js
```

電腦等級強度表：`node scripts/ai-power.js` 印出每一級每個參數的值、對強度的貢獻與總強度（0～100）、跟目標級距（ai.js 的 LEVEL_POWER：30／42／55／69／84）的差距；`node scripts/ai-power.js 60` 另外印出依目標強度算出的參數。權重是實測校準的（`node scripts/ai-weights.js`，很慢，平常不用跑）：決策間隔與逃生機率合起來佔 6 成。調難度的流程：改 LEVEL_POWER → scaleToPower 算參數 → 寫回 LEVELS → `npm test`。

實機版面量測（選用，只需要本機 Chrome／Edge）：`npm run layout:check`，在各種裝置尺寸下開單機對局，量每格大小並截圖到 `shots/`。

瀏覽器煙霧測試（選用，需自行安裝 playwright）：先啟動 server，再 `node scripts/browser-check.js`，會檢查各尺寸直橫向無水平溢出、單機開局、線上邀請／觀戰／自動關閉，並輸出截圖到 `shots/`。

## 部署（GitHub Pages ＋ Render／Oracle Cloud／Cloudflare Workers／Cloud Run）

1. **後端（Render）**：用 `render.yaml` 建立 Web Service（免費方案，區域選 Singapore，台灣連線延遲最低；建立後無法改區域），啟動指令 `node server.js`，健康檢查 `/health`。環境變數 `GAME_ALLOWED_ORIGIN` 填前端網址，例如 `https://帳號.github.io`。
2. **前端（GitHub Pages）**：Settings → Pages 選 GitHub Actions；Settings → Variables 新增 `GAME_SERVER_URL`＝Render 的 https 網址。推到 `main` 後 `.github/workflows/pages.yml` 會跑測試、注入網址並部署 `public/`。
3. 也可臨時用網址參數：`https://前端/?server=https://後端`。

| 變數 | 位置 | 說明 |
|---|---|---|
| `PORT` | 後端 | 預設 3120（Cloud Run 會自動設成 8080） |
| `GAME_ALLOWED_ORIGIN` | 後端 | 允許的前端 origin，逗號分隔 |
| `GAME_SERVER_URL` | Pages Variable | 前端連線位置，唯一入口是 `public/js/config.js` |

Render 免費方案閒置會休眠，首次連線約 30～60 秒，畫面會顯示喚醒提示；房間只存在記憶體，重啟即消失。

## 部署後端到 Cloudflare Workers（免費、不用信用卡）

`cloudflare/worker.js` 是 Cloudflare 版伺服器：房間與對局一樣用 `lib/rooms.js`，只把連線層換成 Durable Object。全站一個 Durable Object 持有所有房間（等同 Node 版的單一行程），第一次建立時指定亞太區。設定在 `wrangler.toml`。

```bash
npx wrangler@4 login     # 第一次：開瀏覽器登入 Cloudflare
npm run cf:deploy        # 部署（之後每次更新也是這行）
```

部署完會印出 `https://bomb-squad.<你的子網域>.workers.dev`（目前是 https://bomb-squad.duck911527.workers.dev）。打開 `/health` 會看到 `{"ok":true,"runtime":"cloudflare","colo":"…"}`；接著把 GitHub 的 `GAME_SERVER_URL` 改成這個網址，重新跑一次 Pages 部署。

- 允許的前端網址在 `wrangler.toml` 的 `GAME_ALLOWED_ORIGIN`（預設 `https://pjh-eric.github.io`）。
- 本機試跑：`npm run cf:dev` 會在 `http://127.0.0.1:8787` 啟動；用 `SERVER=http://127.0.0.1:8787 node scripts/online-check.js` 跑完整線上流程檢查（也可以把 `SERVER` 換成已部署的網址）。
- 免費方案只能用 SQLite 版 Durable Object（`wrangler.toml` 已設定）；每天有請求數與執行時間額度，朋友間遊玩通常用不完，以 Cloudflare 公告為準。
- 房間只存在記憶體：重新部署或 Cloudflare 回收 Durable Object 時房間會消失（跟 Render 重啟一樣）。

## 部署後端到 Oracle Cloud 永久免費 VM（東京／大阪，不休眠）

1. 建立 VM：映像選 **Ubuntu 22.04 或 24.04**；規格選 Always Free（`VM.Standard.A1.Flex` 1 OCPU／6 GB，或 `VM.Standard.E2.1.Micro`）；下載 SSH 私鑰；記下公用 IP。
2. 開雲端防火牆：VM 的子網路 → Security List → Add Ingress Rules，來源 `0.0.0.0/0`、TCP 目的埠 `80,443`。
3. 申請免費網域：到 [DuckDNS](https://www.duckdns.org/) 建一個子網域（例如 `bomb-squad-tw.duckdns.org`），IP 填 VM 的公用 IP。
4. SSH 進 VM 執行（會裝 Node.js 22、Caddy 自動 HTTPS、systemd 常駐、打開 VM 內的 80／443）：

```bash
curl -fsSL https://raw.githubusercontent.com/PJH-Eric/bomb-squad/main/deploy/oracle/setup.sh -o setup.sh
sudo bash setup.sh bomb-squad-tw.duckdns.org
```

5. 打開 `https://你的網域/health` 確認後，把 GitHub 的 `GAME_SERVER_URL` 改成 `https://你的網域`，重新跑 Pages 部署。

更新程式：SSH 進去再跑一次 `sudo bash setup.sh 你的網域`。看紀錄：`sudo journalctl -u bomb-squad -f`。

## 部署後端到 Cloud Run（台灣機房，延遲最低）

Render 最近的機房在新加坡；Google Cloud Run 有台灣機房 `asia-east1`（彰化），台灣玩家延遲可降到約 10～20 ms。專案根目錄的 `Dockerfile` 就是給它用的。

**事前準備（只做一次）**

1. 到 [Google Cloud Console](https://console.cloud.google.com/) 建立專案並綁定帳單（Cloud Run 有每月免費額度，但仍要信用卡）。
2. 建議到「帳單 → 預算與快訊」設一個小額預算（例如 NT$30）並開啟 email 通知，避免意外收費。
3. 安裝 [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)，然後登入並選專案：

```bash
gcloud auth login
gcloud config set project 你的專案ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

**部署（之後每次更新也是這一行）**：在專案根目錄執行

```bash
gcloud run deploy bomb-squad --source . --region asia-east1 --allow-unauthenticated --max-instances 1 --min-instances 0 --cpu 1 --memory 512Mi --timeout 3600 --session-affinity --set-env-vars GAME_ALLOWED_ORIGIN=https://帳號.github.io
```

完成後會印出 `https://bomb-squad-xxxx.asia-east1.run.app`，打開 `/health` 看到 `{"ok":true,...}` 就成功了。接著把 GitHub 的 `GAME_SERVER_URL` 改成這個網址，重新跑一次 Pages 部署。

**參數為什麼這樣設**

| 參數 | 原因 |
|---|---|
| `--max-instances 1` | 房間存在記憶體裡，開兩台的話玩家會被分到不同機器、看不到彼此的房間 |
| `--min-instances 0` | 沒人玩時縮到 0 台不計費；第一個人連線時冷啟動約數秒 |
| `--timeout 3600` | WebSocket 單次連線最長 60 分鐘，到時會斷線，遊戲會自動重連 |
| `--session-affinity` | 重連時盡量回到同一台 |

費用：只有在有玩家連線時才計費，免費額度約等於 1 vCPU 每月運轉 50 小時；對外流量從亞洲送出不在免費額度內，但這個遊戲的資料量很小。實際以 Google 的 [Cloud Run 價格](https://cloud.google.com/run/pricing) 為準。

## 假設與規則細節

- 2～8 人混戰、無隊伍；≤4 人用 17×13 地圖，5～8 人用 19×15（格子數多、走位空間大）。
- 空襲（突然死亡）：遊戲超過 2 分 30 秒後，每 2 秒從天上掉一批炸彈到隨機空格（不會掉在磚牆、人腳下），2:30 起每批 1 顆、2:40 起 2 顆、2:50 起 3 顆，最多 3 顆；炸彈落地 3 秒後爆炸，火力橫掃到牆邊（遇軟磚照樣停），不屬於任何玩家、炸死人不算擊倒。參數在 rules.js 的 SKY_*。
- 地圖機關（rules.js 的 `generateFx`、`THEME_FX`；外觀在 art.js 的 `FX_STYLE`，依主題換風格）：整局固定、四向鏡像、不放在出生點旁，存在 `state.fx`（和 `grid` 分開，開局資料 `startInfo.fx` 帶給客戶端）。只有適合的主題才有機關（競技場沒有），而且每個主題最多 1 種（`THEME_FX` 一行改一個），有機關的主題每張圖有 70% 機率出現，份量也刻意壓低（輸送帶每個角落只有一圈 6～10 格的小環，草叢、緩速格各一小塊），免得干擾玩家自己的操作：
  - 草叢：躲在裡面、離你 1.6 格以外的對手（含電腦）只看得到淡淡身形，貼近就現形；
  - 輸送帶：頭尾相連的不規則環形，站上去被順著帶子推、一路繞圈（1.6 格／秒），放在上面的炸彈也會被載著走（沿著環轉彎，被擋住就停，離開帶子就停），箭頭會流動；
  - 緩速格：糖漿、泥巴、流沙、積雪、碎石、蜘蛛網、火山灰，走過去只剩 0.6 倍速度；
  - 尖刺：固定、不傷人；炸彈放在上面、或被踢到上面會當場爆炸（歸放炸彈的人）。小圖 2～6 個、大圖 4～8 個，開局不蓋軟磚；空襲不會掉在尖刺上。
  草叢和尖刺開局不蓋軟磚；輸送帶、緩速格可以和軟磚疊在一起，磚炸掉那一格才露出那一格的機關。`createGame({ fx: false })` 可以關掉機關。
- 觸控操作版面（public/js/touchlayout.js）：依手機／平板、直放／橫放決定搖桿與炸彈鈕大小；直放放在地圖下方，橫放放在地圖左右兩側（只壓到最外圈邊牆，不擋格子），兩側不夠放時控制鈕會先縮小，實在放不下才半透明疊在地圖邊緣；觸控裝置預設收起資訊欄。
- 斷線寬限 30 秒，超時視為離場，不做 AI 接管；觀戰上限 20 人。
- 邀請 token 隨房間存在，最長 24 小時，可由房主撤銷；角色由 token 決定，改暱稱不會改變權限。
- 房間以「真人玩家」為準：真人降到 0（只剩電腦或觀戰者）立即關閉並通知，已關閉的房間不會復活。
- 線上：自己的角色在本機預測移動（伺服器快照校正），其他玩家以 0.07 秒延遲內插；伺服器 30 Hz 廣播快照。
- 音樂與音效是程式即時合成，沒有外部音檔。

## 還需要正式資產

目前所有美術是程式產生的向量圖、音訊是合成音。要上架等級的成品，需要：正式角色與道具插畫（或授權素材）、背景音樂與音效檔（授權清楚）、PWA 多尺寸圖示。
