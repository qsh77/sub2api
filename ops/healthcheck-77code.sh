#!/bin/sh
set -eu

PROJECT_DIR="/Users/caixin/77code-server/sub2api"
DOCKER="/usr/local/bin/docker"
CURL="/usr/bin/curl"
LAUNCHCTL="/bin/launchctl"
CLOUDFLARED="/opt/homebrew/bin/cloudflared"
LOG="/tmp/77code-healthcheck.log"
CLOUDFLARED_AGENT="/Users/caixin/Library/LaunchAgents/com.cloudflare.cloudflared.plist"
CLOUDFLARED_LABEL="gui/$(id -u)/com.cloudflare.cloudflared"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG"
}

cd "$PROJECT_DIR"

if ! "$DOCKER" info >/dev/null 2>&1; then
  log "Docker is unavailable; invoking start script"
  /Users/caixin/77code-server/sub2api/ops/start-77code.sh || true
  exit 0
fi

if ! "$CURL" -fsS --max-time 5 http://127.0.0.1:8081/health >/dev/null 2>&1; then
  log "Local health failed; restarting containers"
  "$DOCKER" compose --project-directory . -f deploy/docker-compose.local.yml -f docker-compose.override.yml up -d
fi

if ! pgrep -f "cloudflared tunnel --config /Users/caixin/.cloudflared/config.yml run 77code" >/dev/null 2>&1; then
  log "cloudflared tunnel is not running; reloading LaunchAgent"
  "$LAUNCHCTL" unload "$CLOUDFLARED_AGENT" >/dev/null 2>&1 || true
  "$LAUNCHCTL" load "$CLOUDFLARED_AGENT" >/dev/null 2>&1 || true
fi

if ! "$CLOUDFLARED" tunnel info 77code 2>/tmp/77code-cloudflared-info.err | grep -q "CONNECTOR ID"; then
  log "cloudflared has no active connector; restarting LaunchAgent"
  "$LAUNCHCTL" kickstart -k "$CLOUDFLARED_LABEL" >/dev/null 2>&1 || {
    "$LAUNCHCTL" unload "$CLOUDFLARED_AGENT" >/dev/null 2>&1 || true
    "$LAUNCHCTL" load "$CLOUDFLARED_AGENT" >/dev/null 2>&1 || true
  }
fi

if ! "$CURL" -fsSI --max-time 10 https://77code.cc >/dev/null 2>&1; then
  log "Public health failed for https://77code.cc"
fi
