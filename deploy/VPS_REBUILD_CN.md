# Ubuntu VPS 重新构建与恢复

这份文档用于把本机导出的迁移包上传到 Ubuntu VPS 后，使用 Codex 在服务器上重新构建并恢复 Sub2API。

## 适用场景

- 你已经把 `sub2api-vps-migration-*.tar.gz` 上传到 VPS
- VPS 系统是 Ubuntu
- 你希望在 VPS 上重新构建镜像，而不是直接搬运本机镜像
- 你的本机和 VPS 架构可能不同，例如本机 `arm64`，VPS `amd64`

## 迁移包内容

迁移包里通常包含：

- `.env`
- `deploy/docker-compose.local.yml`
- `docker-compose.override.yml`
- `data/`
- `redis_data/`
- `migration/sub2api.dump`
- 源码

## 1. 安装基础环境

在 VPS 上先装 Docker 和常用工具：

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin tar gzip nginx
sudo systemctl enable --now docker
```

确认 Docker 可用：

```bash
docker version
docker compose version
```

## 2. 上传并解压

假设你把文件上传到 `/opt/`：

```bash
sudo mkdir -p /opt/sub2api
sudo tar xzf /opt/sub2api-vps-migration-20260527.tar.gz -C /opt/sub2api
cd /opt/sub2api
```

## 3. 用 Codex 重新构建镜像

在项目根目录执行：

```bash
docker build -t sub2api-custom:latest -f Dockerfile .
```

说明：

- 这里使用仓库根目录的 `Dockerfile`
- 如果 VPS 是 `amd64`，会直接构建出适配 VPS 的镜像
- 如果你不想自己手动构建，也可以让 Codex 直接执行这条命令

## 4. 启动数据库和 Redis

先启动依赖服务：

```bash
docker compose --env-file .env -f deploy/docker-compose.local.yml -f docker-compose.override.yml up -d postgres redis
```

等待几十秒后检查状态：

```bash
docker ps
```

## 5. 恢复数据库

把本机导出的逻辑备份导入到 PostgreSQL：

```bash
cat migration/sub2api.dump | docker exec -i sub2api-postgres pg_restore \
  -U sub2api \
  -d sub2api \
  --clean \
  --if-exists
```

如果这是全新环境，一般可以直接导入。

## 6. 启动应用

```bash
docker compose --env-file .env -f deploy/docker-compose.local.yml -f docker-compose.override.yml up -d
```

查看日志：

```bash
docker logs -f sub2api
```

健康检查：

```bash
curl http://127.0.0.1:8081/health
```

## 7. 可选：Nginx 反代

如果你要用域名访问，建议让 Nginx 反代到 `127.0.0.1:8081`。

注意要加：

```nginx
underscores_in_headers on;
```

一个最小配置示例：

```nginx
server {
    listen 80;
    server_name api.example.com;

    underscores_in_headers on;

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

然后执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 8. 可选：Caddy 反代

如果你想省掉手动申请证书的步骤，可以直接用 Caddy。

`/etc/caddy/Caddyfile` 示例：

```caddy
api.example.com {
    reverse_proxy 127.0.0.1:8081
}
```

然后执行：

```bash
sudo systemctl restart caddy
```

## 9. 常见检查项

```bash
docker ps
docker logs --tail=200 sub2api
docker logs --tail=200 sub2api-postgres
docker logs --tail=200 sub2api-redis
```

如果登录状态异常，优先检查 `.env` 里的这些值是否保持不变：

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `TOTP_ENCRYPTION_KEY`
- `ADMIN_PASSWORD`
