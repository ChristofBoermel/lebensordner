# Go-Live Checklist (Self-Hosted)

Use this checklist before marking production as fully live.

## 1) Deployment Pipeline

- [ ] `Deploy` workflow triggers on push to `main`.
- [ ] `build-and-push` job publishes:
  - [ ] `ghcr.io/christofboermel/lebensordner/nextjs:latest`
  - [ ] `ghcr.io/christofboermel/lebensordner/nextjs:<commit-sha>`
  - [ ] `ghcr.io/christofboermel/lebensordner/worker:latest`
  - [ ] `ghcr.io/christofboermel/lebensordner/worker:<commit-sha>`
- [ ] `deploy` job is green and runs `docker compose pull && docker compose up -d`.

## 2) Runtime Health

- [ ] `nextjs`, `worker`, `caddy`, `redis`, `db`, `kong` are running (`docker compose ps`).
- [ ] `nextjs` and `worker` use GHCR images, not local `deploy-*` images.
- [ ] App health endpoint is healthy (`/api/health` from container healthcheck).

## 3) Domain and TLS

- [ ] `https://lebensordner.org` returns `200`.
- [ ] `https://www.lebensordner.org` returns `308` redirect to apex.
- [ ] Caddy TLS domains include:
  - [ ] `lebensordner.org`
  - [ ] `www.lebensordner.org`
  - [ ] `studio.lebensordner.org`
  - [ ] `grafana.lebensordner.org`
- [ ] No recurring TLS issuance errors in Caddy logs.

## 4) Secrets and Config

- [ ] All required GitHub `Production` environment secrets exist.
- [ ] Server `deploy/.env` has required runtime values (no blank required keys).
- [ ] `STRIPE_WEBHOOK_SECRET` is set and webhook test succeeds.
- [ ] Any secret exposed in chat/logs has been rotated.

## 5) Backups and Recovery

- [ ] Manual DB backup completed and file validated.
- [ ] Restore test succeeded to disposable target.
- [ ] Last successful restore timestamp recorded.

## 6) Admin Bootstrap

- [ ] Operator account registered at `/registrieren`.
- [ ] Operator email confirmation completed and onboarding reached `/dashboard`.
- [ ] Operator account promoted to admin in `profiles.role`.
- [ ] `/admin` is accessible for the promoted account.

## 7) Monitoring and Alerts

- [ ] Grafana/Prometheus/Loki/Promtail are up.
- [ ] `postgres-exporter` container is running.
- [ ] Prometheus target `job="postgres"` is `UP`.
- [ ] Alerts exist for:
  - [ ] app down
  - [ ] worker down
  - [ ] DB down
  - [ ] TLS expiry threshold
- [ ] Telegram contact point exists and default notification policy routes to `Telegram`.
- [ ] Alert routing tested via Worker Down fire + resolve messages in Telegram.

## 8) Rollback Readiness

- [ ] Previous known-good SHA tags identified for nextjs + worker.
- [ ] Rollback by SHA procedure tested once.
- [ ] Rollback execution time recorded.

## 9) Final Gate

- [ ] Two consecutive successful deploys from `main`.
- [ ] No critical errors across app/worker/caddy logs for 24h.
- [ ] Runbooks are committed and linked for operators.
