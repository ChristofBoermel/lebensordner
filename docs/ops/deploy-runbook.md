# Deploy Runbook

## Scope

Production deploy for self-hosted Lebensordner on `/opt/lebensordner/app/deploy`.

Related runbooks:
- `docs/ops/admin-bootstrap-monitoring-runbook.md` (one-time admin bootstrap + Telegram alert activation)

## Standard Deploy (GitHub Actions)

1. Merge to `main`.
2. Open GitHub Actions -> `Deploy`.
3. Confirm:
   - `build-and-push` green
   - `deploy` green
   - `smoke-check` green (runs `scripts/ops/verify-deploy.sh` on server)

Automated post-deploy verification covers:
- Server is on the expected commit SHA (no git drift)
- Core + monitoring containers are running (and healthy when healthchecks exist)
- `nextjs` + `worker` images are GHCR images
- Public endpoints: apex, `api/health`, `www` redirect, Grafana, Studio
- Grafana provisioning parse errors in logs
- Prometheus target health for `lebensordner-app`, `postgres`, `redis`, `caddy`

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
# Resolve Kong key-auth placeholders from deploy .env before recreate
ANON=$(grep '^ANON_KEY=' .env | cut -d= -f2-)
SVC=$(grep '^SERVICE_ROLE_KEY=' .env | cut -d= -f2-)
git show HEAD:deploy/supabase/kong.yml > /tmp/kong-template.yml
sed -e "s|\${SUPABASE_ANON_KEY}|$ANON|g" \
    -e "s|\${SUPABASE_SERVICE_KEY}|$SVC|g" \
    /tmp/kong-template.yml > /tmp/kong-resolved.yml
cp /tmp/kong-resolved.yml supabase/kong.yml
grep -q '\${SUPABASE_ANON_KEY}\|\${SUPABASE_SERVICE_KEY}' supabase/kong.yml && echo "ERROR: unresolved placeholders" && exit 1

# Kong reads declarative config on startup only. Recreate to load new keys.
docker compose up -d --no-deps --force-recreate kong
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
