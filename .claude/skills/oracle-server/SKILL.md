---
name: oracle-server
description: 維護炸彈小隊放在 Oracle Cloud 的線上伺服器（bomb-squad.duckdns.org）：把 GitHub main 的最新程式更新到 Oracle VM 並驗證，以及檢查 DuckDNS 網域是否還指向 VM。使用者說「更新伺服器」「部署到 Oracle」「伺服器程式更新」「檢查 DuckDNS／網域」「伺服器連不上」或推了新的伺服器程式之後使用。
---

# Oracle 伺服器維護（炸彈小隊）

前端在 GitHub Pages，`GAME_SERVER_URL` 指向 Oracle VM。Oracle **不會**在推送到 GitHub 後自動部署，伺服器程式改了就要用這份流程更新。

## 固定資料

| 項目 | 值 |
|---|---|
| 網域 | `bomb-squad.duckdns.org`（DuckDNS 子網域 `bomb-squad`） |
| VM 公用 IP | `168.138.203.154` |
| SSH | `ssh -i "/c/Eric/AI Agent/ssh-key-2026-10-02.key" -o BatchMode=yes -o ConnectTimeout=15 ubuntu@168.138.203.154` |
| 程式位置 | VM 上的 `/opt/bomb-squad`（systemd 服務 `bomb-squad`，Caddy 負責 HTTPS） |
| 架設／更新腳本 | `deploy/oracle/setup.sh`（重複執行即更新） |
| 允許的前端 | `https://pjh-eric.github.io` |

IP 或網域若跟使用者說的不同，以使用者為準並更新這張表。

## A. 更新伺服器程式

1. **確認要部署的程式已在 GitHub**：VM 是從 GitHub `main` 拉程式，不是從本機。
   ```bash
   git fetch -q && git status -sb | head -1     # 要看到 main...origin/main 且沒有 ahead
   ```
   有沒推送的 commit：先問使用者要不要推（推送屬於對外動作）。只有前端（`public/`）的改動不需要更新 Oracle，Pages 會自己部署。
2. **先測本機**：`npm test` 要全部通過再部署。
3. **在 VM 上執行腳本**（會 `git pull`、重啟服務）：
   ```bash
   ssh -i "/c/Eric/AI Agent/ssh-key-2026-10-02.key" -o BatchMode=yes -o ConnectTimeout=15 ubuntu@168.138.203.154 \
     'curl -fsSL https://raw.githubusercontent.com/PJH-Eric/bomb-squad/main/deploy/oracle/setup.sh -o setup.sh && sudo bash setup.sh bomb-squad.duckdns.org'
   ```
   成功時最後一行是「完成！遊戲伺服器已啟動。」。
4. **驗證**（三項都要過才算完成）：
   ```bash
   curl -s https://bomb-squad.duckdns.org/health                       # {"ok":true,...}，uptime 應該很小（剛重啟）
   SERVER=https://bomb-squad.duckdns.org node scripts/online-check.js  # 11 項全部通過
   ```
   再量 WebSocket 來回延遲（ping/pong 20 次取中位數）；目前基準約 42 ms，明顯變慢要回報。
5. **回報**：部署了哪個 commit（`ssh ... 'sudo -u bomb git -C /opt/bomb-squad log --oneline -1'`；程式目錄屬於 `bomb` 使用者，直接用 ubuntu 跑 git 會被 safe.directory 擋）、health、online-check、延遲。

注意：重啟服務會清掉記憶體中的房間，正在玩的人會被斷線。有人在線上時（`curl -s https://bomb-squad.duckdns.org/api/presence` 的 `players` > 0）先跟使用者確認再更新。

## B. 檢查 DuckDNS 網域

1. **網域還指向 VM 嗎**：
   ```bash
   nslookup bomb-squad.duckdns.org 8.8.8.8      # Address 要是 168.138.203.154
   ```
2. **伺服器有回應嗎**：`curl -s -m 10 https://bomb-squad.duckdns.org/health`
3. 依結果判斷：

| 狀況 | 原因 | 處理 |
|---|---|---|
| 解析到正確 IP、health 正常 | 一切正常 | 回報即可 |
| 查不到網域（NXDOMAIN） | DuckDNS 網域被刪或帳號失效 | 請使用者登入 https://www.duckdns.org/ 重新建立 `bomb-squad`，IP 填 VM 公用 IP |
| 解析到別的 IP | VM 換了公用 IP，或 DuckDNS 被改 | 到 Oracle Console 看 VM 目前的 Public IP；請使用者在 DuckDNS 更新 IP，並更新本檔的固定資料 |
| IP 正確但 health 沒回應 | VM 或服務問題 | SSH 進去看 `sudo systemctl status bomb-squad caddy --no-pager` 與 `sudo journalctl -u bomb-squad -n 50 --no-pager`；SSH 也連不上就請使用者在 Oracle Console 確認 VM 是 Running |

DuckDNS 的 token 是使用者的祕密：不要寫進 repo 或本檔。若使用者想讓 VM 自動回報 IP（順便保持網域活躍），請使用者自己把 token 提供在當下對話中，再在 VM 上用 crontab 設定每 5 分鐘呼叫一次 `https://www.duckdns.org/update?domains=bomb-squad&token=<TOKEN>&ip=`，token 只存在 VM 上。

## 不要做的事

- 不要在 VM 上直接改 `/opt/bomb-squad` 的程式：下次更新會被 `git pull` 覆蓋或卡住。改程式一律在本機改、推到 GitHub、再用 A 流程更新。
- 不要把 SSH 私鑰複製進 repo 或印出內容。
- 刪除 VM、換 IP、改 GitHub 的 `GAME_SERVER_URL` 都要先問使用者。
