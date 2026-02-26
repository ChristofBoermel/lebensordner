# Deploy Runbook

## Scope

Production deploy for self-hosted Lebensordner on `/opt/lebensordner/app/deploy`.

## Standard Deploy (GitHub Actions)

1. Merge to `main`.
2. Open GitHub Actions -> `Deploy`.
3. Confirm:
   - `build-and-push` green
   - `deploy` green

## Post-Deploy Verification (Server)

```bash
cd /opt/lebensordner/app/deploy
docker compose ps
docker inspect $(docker compose ps -q nextjs) --format '{{.Config.Image}}'
docker inspect $(docker compose ps -q worker) --format '{{.Config.Image}}'
curl -I https://lebensordner.org
curl -I https://www.lebensordner.org
docker compose logs --tail=100 nextjs worker caddy
```

Expected:
- `nextjs` image: `ghcr.io/christofboermel/lebensordner/nextjs:latest`
- `worker` image: `ghcr.io/christofboermel/lebensordner/worker:latest`
- apex returns `200`
- `www` returns `308` to apex

## Fast Manual Refresh (Server)

```bash
cd /opt/lebensordner/app/deploy
docker compose pull
docker compose up -d
```

## Rollback by SHA (Primary)

1. Pick known-good SHA tags from GHCR.
2. Pin images in `deploy/docker-compose.yml`:
   - `ghcr.io/christofboermel/lebensordner/nextjs:<sha>`
   - `ghcr.io/christofboermel/lebensordner/worker:<sha>`
3. Commit and push to `main`.
4. Wait for `Deploy` workflow.
5. Re-run post-deploy verification.

## Emergency Server-Side Rollback (Temporary)

If GitHub pipeline is unavailable:

```bash
cd /opt/lebensordner/app/deploy
docker pull ghcr.io/christofboermel/lebensordner/nextjs:<sha>
docker pull ghcr.io/christofboermel/lebensordner/worker:<sha>
# then temporarily edit docker-compose.yml image tags and redeploy
docker compose up -d --force-recreate nextjs worker
```

After incident, sync the rollback state back to git.

## Common Failure Checks

- `docker/login-action` error `Password required`:
  - ensure workflow uses `github.token` and job `environment: Production`
- GHCR push `permission_denied`:
  - confirm workflow permissions include `packages: write`
- `www` TLS failures:
  - confirm Caddy host includes `www.lebensordner.org`
  - check Caddy domain list in logs
