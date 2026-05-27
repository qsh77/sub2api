#!/bin/sh
set -eu

cd /Users/caixin/77code-server/sub2api

echo "== Docker containers =="
/usr/local/bin/docker compose --project-directory . -f deploy/docker-compose.local.yml -f docker-compose.override.yml ps

echo
echo "== Cloudflare tunnel =="
/opt/homebrew/bin/cloudflared tunnel info 77code

echo
echo "== Local health =="
/usr/bin/curl -fsS http://127.0.0.1:8081/health
echo

echo
echo "== Public health =="
/usr/bin/curl -fsSI --max-time 15 https://77code.cc | sed -n '1,12p'
