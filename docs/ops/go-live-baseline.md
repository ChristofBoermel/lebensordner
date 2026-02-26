  # Go-Live Baseline Snapshot

  ## Release Metadata

  - Date (UTC): 2026-02-26T04:04:00Z
  - Commit SHA: 05728b94ac6fd3ac71621c8ee5645ee5f6792ad2
  - GitHub Actions run URL: https://github.com/ChristofBoermel/lebensordner/actions/runs/22425860986
  - Operator: Chris

  ## Deployed Images

  - nextjs image: ghcr.io/christofboermel/lebensordner/nextjs:latest
  - worker image: ghcr.io/christofboermel/lebensordner/worker:latest

  ## Runtime Status

  - `docker compose ps` summary: nextjs/worker/caddy/redis/db/kong up; nextjs healthy; redis/db/kong healthy
  - `nextjs` health: healthy
  - `worker` status: up
  - `caddy` status: up

  ## Public Checks

  - `curl -I https://lebensordner.org`: 200
  - `curl -I https://www.lebensordner.org`: 200

  ## Logs (last 100 lines)

  - nextjs: startup successful, no critical errors
  - worker: workers started, queue jobs registered
  - caddy: TLS active for lebensordner.org + www.lebensordner.org, no active cert errors

  ## Rollback Readiness

  - Previous known-good nextjs SHA: 1e61e99
  - Previous known-good worker SHA: 1e61e99
  - Rollback drill status: Not executed yet

  ## Backup and Restore

  - Last successful backup: Not validated yet
  - Last successful restore test: Not validated yet