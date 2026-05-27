#!/usr/bin/env bash
set -euo pipefail

DEPLOY=false
if [[ "${1:-}" == "--deploy" ]]; then
  DEPLOY=true
elif [[ "${1:-}" != "" ]]; then
  echo "Usage: $0 [--deploy]" >&2
  exit 2
fi

require_clean_worktree() {
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Working tree is not clean. Commit or stash changes before syncing." >&2
    git status --short
    exit 1
  fi
}

require_branch() {
  local expected="$1"
  local current
  current="$(git branch --show-current)"
  if [[ "$current" != "$expected" ]]; then
    git switch "$expected"
  fi
}

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

require_clean_worktree

git fetch upstream main
git fetch origin

require_branch main
git merge --ff-only upstream/main
git push origin main

require_branch my-changes
git merge main
git push origin my-changes

if [[ "$DEPLOY" == true ]]; then
  docker build -t sub2api-custom:latest \
    --build-arg GOPROXY=https://goproxy.cn,direct \
    --build-arg GOSUMDB=sum.golang.google.cn \
    -f Dockerfile .

  docker compose --project-directory . \
    -f deploy/docker-compose.local.yml \
    -f docker-compose.override.yml \
    up -d --no-deps --force-recreate sub2api

  docker ps --filter name=sub2api
  curl -fsS http://127.0.0.1:8081/health >/dev/null
  echo "Deploy complete and health check passed."
else
  echo "Sync complete. Run with --deploy to rebuild and restart sub2api."
fi
