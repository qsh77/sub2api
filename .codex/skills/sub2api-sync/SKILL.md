---
name: sub2api-sync
description: Use this skill in this repository when asked to sync Sub2API with upstream, update the my-changes branch, or deploy the running Docker Compose service without losing local changes or data.
---

# Sub2API Sync And Deploy

This repository is a fork-based deployment:

- `upstream` is `https://github.com/Wei-Shaw/sub2api.git`.
- `origin` is `git@github.com:qsh77/sub2api.git`.
- `main` tracks upstream and should stay clean.
- `my-changes` is the long-lived custom branch used for deployment.
- Production runs Docker Compose from this repo using `deploy/docker-compose.local.yml` plus `docker-compose.override.yml`.
- The app image is local-only: `sub2api-custom:latest`.

## Rules

- Do not run `git reset --hard`, `git checkout --`, or `docker compose down -v` for this workflow.
- Do not deploy from `main`; deploy from `my-changes`.
- Keep database backups and local data out of Git. `migration/*.dump`, `migration/*.tar.gz`, `postgres_data/`, and `redis_data/` are ignored.
- If Git merge conflicts appear, stop and resolve them before building or deploying.
- For production deployment, prefer restarting only `sub2api`; leave Postgres and Redis running.

## Standard Workflow

Use the bundled script from the repository root:

```bash
.codex/skills/sub2api-sync/bin/update-sub2api.sh
```

This syncs `main` from `upstream/main`, pushes `origin/main`, merges `main` into `my-changes`, and pushes `origin/my-changes`.

To also rebuild and restart production:

```bash
.codex/skills/sub2api-sync/bin/update-sub2api.sh --deploy
```

The deploy step runs:

```bash
docker build -t sub2api-custom:latest \
  --build-arg GOPROXY=https://goproxy.cn,direct \
  --build-arg GOSUMDB=sum.golang.google.cn \
  -f Dockerfile .

docker compose --project-directory . \
  -f deploy/docker-compose.local.yml \
  -f docker-compose.override.yml \
  up -d --no-deps --force-recreate sub2api
```

## Verification

After deploy, check:

```bash
docker ps
docker logs --tail 100 sub2api
curl -fsS http://127.0.0.1:8081/health
```

Expected service shape:

- `sub2api` uses image `sub2api-custom:latest`.
- `sub2api-postgres` and `sub2api-redis` remain running.
- App data is mounted from `/opt/sub2api/data`.
