#!/usr/bin/env bash
# Uploads the project from your Mac to the Oracle server and sets it up.
# Run from the project folder:
#   bash deploy/deploy.sh
# Run it again any time you change the code; the live database is kept.
set -euo pipefail

DOMAIN="${DOMAIN:-discoverabuja.duckdns.org}"
KEY="${KEY:-$HOME/.ssh/oracle-discover-abuja.key}"
HOST="ubuntu@${DOMAIN}"

cd "$(dirname "$0")/.."
[ -f "$KEY" ] || { echo "SSH key not found at $KEY"; exit 1; }
[ -f client/.env ] || { echo "client/.env is missing (it holds the Google Maps key)."; exit 1; }

echo "==> Uploading project to ${HOST}"
rsync -az --delete -e "ssh -i ${KEY}" \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'client/dist' \
  --exclude 'server/.env' \
  --exclude 'server/uploads' \
  --exclude 'server/logs' \
  --exclude 'server/evaluation/results' \
  --exclude '_to_delete' \
  --exclude '.agents' \
  --exclude 'AGENTS.md' \
  --exclude 'CLAUDE.md' \
  --exclude 'no-co-author.md' \
  --exclude '.DS_Store' \
  ./ "${HOST}:smart-tourism/"

echo "==> Running setup on the server"
ssh -i "$KEY" -t "$HOST" "bash ~/smart-tourism/deploy/setup-server.sh ${DOMAIN}"
