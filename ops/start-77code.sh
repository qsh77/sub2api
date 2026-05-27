#!/bin/sh
set -eu

PROJECT_DIR="/Users/caixin/77code-server/sub2api"
DOCKER="/usr/local/bin/docker"
OPEN="/usr/bin/open"
LOG="/tmp/77code-start.log"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG"
}

cd "$PROJECT_DIR"

if ! "$DOCKER" info >/dev/null 2>&1; then
  log "Docker engine is not ready; opening Docker Desktop"
  "$OPEN" -ga Docker || true
fi

i=0
while ! "$DOCKER" info >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 90 ]; then
    log "Docker engine did not become ready within 180s"
    exit 1
  fi
  sleep 2
done

log "Starting 77code containers"
"$DOCKER" compose --project-directory . -f deploy/docker-compose.local.yml -f docker-compose.override.yml up -d
log "Containers started"
