# Secrets Matrix

This file defines where each secret must live.

## GitHub Actions: Environment `Production`

Required by `.github/workflows/deploy.yml`:

- `SSH_HOST`
- `SSH_USER`
- `SSH_PRIVATE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `ENCRYPTION_KEY`
- `CRON_SECRET`

Notes:
- Workflow currently uses `github.token` for GHCR login.
- `GHCR_TOKEN` is optional and not required for current flow.

## Server Runtime: `deploy/.env`

Required at runtime by `deploy/docker-compose.yml`:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `ANON_KEY`
- `SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `ENCRYPTION_KEY`
- `CRON_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `TURNSTILE_SECRET_KEY`
- `REDIS_URL`
- `REDIS_PASSWORD`
- `NEXT_PUBLIC_APP_URL`
- `DOMAIN`
- `GRAFANA_ADMIN_PASSWORD`
- `METRICS_SECRET` — runtime only; not a build arg, not needed in GitHub Actions

## Rotation Policy (Minimum)

- Rotate immediately if exposed in chat/logs/screenshots.
- Rotate Stripe webhook secret after any accidental disclosure.
- Record rotation date and owner in your team notes.
