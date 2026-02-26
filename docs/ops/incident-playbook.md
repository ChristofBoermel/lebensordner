# Incident Playbook

## P1: Website Down

Symptoms:
- `https://lebensordner.org` not reachable or returns 5xx

Immediate actions:
1. Check container status:
   ```bash
   cd /opt/lebensordner/app/deploy
   docker compose ps
   ```
2. Check logs:
   ```bash
   docker compose logs --tail=200 nextjs worker caddy
   ```
3. Restart app tier:
   ```bash
   docker compose up -d --force-recreate nextjs worker caddy
   ```
4. Verify:
   ```bash
   curl -I https://lebensordner.org
   ```

If still failing, execute rollback by SHA.

## P1: Deploy Broke Production

1. Identify last known-good SHA for:
   - `nextjs`
   - `worker`
2. Pin SHA tags in compose and redeploy.
3. Validate app health and domain responses.
4. Open follow-up issue for root cause.

## P1: TLS/Domain Failure

1. Confirm DNS (`A`/`CNAME`) points to server.
2. Check Caddy managed domains:
   ```bash
   docker compose logs --tail=200 caddy | grep -Ei "automatic TLS certificate management|domains|error"
   ```
3. Validate Caddy config:
   ```bash
   docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile
   ```
4. Restart Caddy:
   ```bash
   docker compose restart caddy
   ```

## P1: Stripe Webhooks Failing

1. Confirm runtime env:
   ```bash
   cd /opt/lebensordner/app/deploy
   grep -n "^STRIPE_WEBHOOK_SECRET=" .env
   ```
2. Recreate app service:
   ```bash
   docker compose up -d --force-recreate nextjs
   ```
3. Send Stripe test webhook and check app logs.

## Post-Incident

- Record timeline, root cause, and remediation.
- Add missing alert or runbook step.
- If emergency server hotfix was applied, reconcile back to git.
