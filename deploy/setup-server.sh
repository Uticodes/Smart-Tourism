#!/usr/bin/env bash
# Sets up (or updates) Discover Abuja on an Ubuntu 24.04 server.
# deploy.sh runs this for you; to run it by hand on the server:
#   bash ~/smart-tourism/deploy/setup-server.sh discoverabuja.duckdns.org
#
# Safe to run again: it never wipes the database, the uploads or server/.env.
set -euo pipefail

DOMAIN="${1:?Usage: setup-server.sh <domain>}"
APP_DIR="$HOME/smart-tourism"
WEB_DIR=/var/www/discover-abuja
CRED_FILE="$HOME/discover-abuja-credentials.txt"
DB_NAME=smart_tourism
DB_USER=tourism

step() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*"; exit 1; }

[ "$(id -u)" -ne 0 ] || fail "Run this as the ubuntu user, not with sudo."
[ -d "$APP_DIR/server" ] && [ -d "$APP_DIR/client" ] || fail "Project not found in $APP_DIR. Run deploy.sh from your Mac."

# ---------------------------------------------------------------- packages
step "Installing system packages (nginx, MySQL, certbot)"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  nginx mysql-server build-essential python3 curl ca-certificates rsync openssl \
  certbot python3-certbot-nginx

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  step "Installing Node.js 24 LTS"
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "Node $(node -v), npm $(npm -v)"

# ---------------------------------------------------------------- database
step "Preparing MySQL"
sudo systemctl enable --now mysql

if [ ! -f "$APP_DIR/server/.env" ]; then
  DB_PASS=$(openssl rand -hex 24)
  JWT_SECRET=$(openssl rand -hex 48)
  ADMIN_PASS="Admin-$(openssl rand -hex 5)"
  USER_PASS="Tourist-$(openssl rand -hex 5)"

  sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

  umask 077
  cat > "$APP_DIR/server/.env" <<ENV
NODE_ENV=production
PORT=4000
CLIENT_ORIGIN=https://${DOMAIN}
TRUST_PROXY=1

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_NAME=${DB_NAME}

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=1d

SEED_ADMIN_EMAIL=admin@smarttourism.test
SEED_ADMIN_PASSWORD=${ADMIN_PASS}
SEED_USER_PASSWORD=${USER_PASS}
ENV

  cat > "$CRED_FILE" <<CRED
Discover Abuja — live demo accounts (https://${DOMAIN})
Admin:    admin@smarttourism.test    / ${ADMIN_PASS}
Tourists: amina@smarttourism.test    / ${USER_PASS}
          chinedu@smarttourism.test  / ${USER_PASS}
CRED
  umask 022
  echo "Created server/.env and $CRED_FILE"
else
  echo "server/.env already exists — keeping it."
fi

# ---------------------------------------------------------------- API
step "Installing API dependencies"
cd "$APP_DIR/server"
npm ci --omit=dev --no-audit --no-fund
mkdir -p uploads logs

HAS_TABLES=$(sudo mysql -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}' AND table_name='Attractions'")
if [ "$HAS_TABLES" = "0" ]; then
  step "Creating tables and loading the attractions"
  npm run db:setup
else
  echo "Database already set up — leaving the data alone."
fi

step "Running the API as a service"
sudo tee /etc/systemd/system/discover-abuja-api.service >/dev/null <<UNIT
[Unit]
Description=Discover Abuja API
After=network.target mysql.service
Requires=mysql.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${APP_DIR}/server
Environment=NODE_ENV=production
ExecStart=$(command -v node) src/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable discover-abuja-api >/dev/null
sudo systemctl restart discover-abuja-api

# ---------------------------------------------------------------- client
step "Building the web app"
cd "$APP_DIR/client"
grep -q '^VITE_GOOGLE_MAPS_BROWSER_KEY=.\+' .env 2>/dev/null \
  || echo "WARNING: client/.env has no VITE_GOOGLE_MAPS_BROWSER_KEY — maps will not load."
npm ci --no-audit --no-fund
npm run build
sudo mkdir -p "$WEB_DIR"
sudo rsync -a --delete dist/ "$WEB_DIR/"

# ---------------------------------------------------------------- nginx
step "Configuring nginx"
sudo tee /etc/nginx/sites-available/discover-abuja >/dev/null <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name __DOMAIN__;

    root /var/www/discover-abuja;
    index index.html;

    # Up to 3 photos of 5 MB each per report.
    client_max_body_size 20m;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # React Router: every other path loads the app.
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX
sudo sed -i "s/__DOMAIN__/${DOMAIN}/" /etc/nginx/sites-available/discover-abuja
sudo ln -sf /etc/nginx/sites-available/discover-abuja /etc/nginx/sites-enabled/discover-abuja
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# ---------------------------------------------------------------- HTTPS
if ! sudo test -d "/etc/letsencrypt/live/${DOMAIN}"; then
  step "Getting a free HTTPS certificate"
  sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
    --register-unsafely-without-email --redirect
else
  step "HTTPS certificate already present"
  sudo certbot install --nginx --cert-name "$DOMAIN" --redirect --non-interactive >/dev/null 2>&1 || true
  sudo systemctl reload nginx
fi

# ---------------------------------------------------------------- check
step "Checking the live site"
sleep 2
if curl -fsS "https://${DOMAIN}/api/health"; then
  printf '\n\n\033[1;32mDone. Open https://%s\033[0m\n' "$DOMAIN"
  [ -f "$CRED_FILE" ] && { echo; cat "$CRED_FILE"; }
else
  echo
  echo "The health check failed. Recent API log:"
  sudo journalctl -u discover-abuja-api -n 30 --no-pager
  exit 1
fi
