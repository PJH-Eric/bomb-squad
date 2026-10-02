#!/usr/bin/env bash
# ===== deploy/oracle/setup.sh — 在 Oracle Cloud（Ubuntu）上架設炸彈小隊伺服器 =====
#
# 用法（在 VM 上，以 ubuntu 使用者執行）：
#   curl -fsSL https://raw.githubusercontent.com/PJH-Eric/bomb-squad/main/deploy/oracle/setup.sh -o setup.sh
#   sudo bash setup.sh 你的網域.duckdns.org [允許的前端網址]
#
# 會做的事（重複執行也安全，之後要更新程式就再跑一次）：
#   1. 安裝 Node.js 22、git、Caddy（自動申請 HTTPS 憑證）
#   2. 把專案 clone 到 /opt/bomb-squad，用 systemd 常駐（當掉自動重啟、開機自動啟動）
#   3. Caddy 把 https://你的網域 轉給 Node（WebSocket 也一起轉）
#   4. 打開 VM 內建防火牆的 80／443 埠（Oracle 的 Ubuntu 映像預設會擋）
set -euo pipefail

DOMAIN="${1:-}"
ORIGIN="${2:-https://pjh-eric.github.io}"
REPO="https://github.com/PJH-Eric/bomb-squad.git"
APP=/opt/bomb-squad
PORT=3120

if [ -z "$DOMAIN" ]; then
  echo "用法：sudo bash setup.sh 你的網域.duckdns.org [允許的前端網址]" >&2
  exit 1
fi
if [ "$(id -u)" -ne 0 ]; then
  echo "請用 sudo 執行" >&2
  exit 1
fi
export DEBIAN_FRONTEND=noninteractive

echo "== 1/5 安裝套件"
apt-get update -y
apt-get install -y git curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https iptables-persistent
NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"; fi
if [ "$NODE_MAJOR" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

echo "== 2/5 下載／更新程式"
id bomb >/dev/null 2>&1 || useradd --system --home-dir "$APP" --shell /usr/sbin/nologin bomb
if [ -d "$APP/.git" ]; then
  sudo -u bomb git -C "$APP" pull --ff-only
else
  mkdir -p "$APP"
  chown bomb:bomb "$APP"
  sudo -u bomb git clone "$REPO" "$APP"
fi

echo "== 3/5 設定常駐服務"
cat > /etc/systemd/system/bomb-squad.service <<EOF
[Unit]
Description=Bomb Squad game server
After=network-online.target
Wants=network-online.target

[Service]
User=bomb
WorkingDirectory=$APP
Environment=PORT=$PORT
Environment=GAME_ALLOWED_ORIGIN=$ORIGIN
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable bomb-squad
systemctl restart bomb-squad

echo "== 4/5 設定 HTTPS（Caddy）"
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
  encode gzip
  reverse_proxy 127.0.0.1:$PORT
}
EOF
systemctl enable caddy
systemctl restart caddy

echo "== 5/5 打開防火牆 80／443"
for p in 80 443; do
  iptables -C INPUT -p tcp --dport "$p" -m state --state NEW -j ACCEPT 2>/dev/null \
    || iptables -I INPUT -p tcp --dport "$p" -m state --state NEW -j ACCEPT
done
netfilter-persistent save

sleep 2
echo
if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null; then
  echo "完成！遊戲伺服器已啟動。"
  echo "  健康檢查：https://$DOMAIN/health （憑證第一次申請要等幾十秒）"
  echo "  GitHub 的 GAME_SERVER_URL 請設成：https://$DOMAIN"
else
  echo "伺服器沒有回應，請看紀錄：sudo journalctl -u bomb-squad -n 50" >&2
  exit 1
fi
