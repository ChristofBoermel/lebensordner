# Admin Bootstrap + Monitoring Activation Runbook

## Scope

One-time production activation after registration fix and alert provisioning are deployed.

Environment:
- App: `https://lebensordner.org`
- Grafana: `https://grafana.lebensordner.org`
- Server path: `/opt/lebensordner/app/deploy`

## Preconditions

- Registration is working at `/registrieren`.
- T2 monitoring changes are merged and available on `main`.
- You have SSH access to the production server.
- `deploy/.env` on server contains valid `GRAFANA_ADMIN_PASSWORD`.

## A) Bootstrap First Admin Account

1. Register your real operator account at `https://lebensordner.org/registrieren`.
2. Confirm the GoTrue email and complete onboarding at `/onboarding`.
3. Promote your account to admin on the server:

```bash
docker exec -i supabase-db psql -U postgres -d postgres \
  -c "UPDATE profiles SET role = 'admin' WHERE email = 'your@email.de';"
```

4. Verify the role update:

```bash
docker exec -i supabase-db psql -U postgres -d postgres \
  -c "SELECT email, role FROM profiles WHERE email = 'your@email.de';"
```

Expected: `role = admin`.

5. Open `https://lebensordner.org/admin` and confirm the dashboard loads.

## B) Create Telegram Bot + Chat ID

1. In Telegram, open `@BotFather`.
2. Run `/newbot` and copy the bot token.
3. Send any message to your new bot once.
4. Open:
   - `https://api.telegram.org/bot<TOKEN>/getUpdates`
5. Copy `chat.id` from the response.

## C) Activate Monitoring Config in Production

1. Ensure T2 changes are merged to `main` and deployment completed.
2. On the server, set Telegram vars in `/opt/lebensordner/app/deploy/.env`:

```env
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_CHAT_ID=<chat-id>
```

3. Pull and restart:

```bash
cd /opt/lebensordner/app/deploy
docker compose pull
docker compose up -d
```

4. Verify `postgres-exporter` is running:

```bash
docker compose ps postgres-exporter
```

5. Verify Prometheus target is healthy:
- Open `http://localhost:9090/targets` (SSH tunnel if needed)
- `job="postgres"` must be `UP`

## D) Verify Grafana Alerting End-to-End

1. Sign in at `https://grafana.lebensordner.org` with:
   - user: `admin`
   - password: `GRAFANA_ADMIN_PASSWORD` from server `.env`
2. Check **Alerting -> Contact points**:
   - `Telegram` exists (provisioned/read-only)
3. Check **Alerting -> Notification policies**:
   - default receiver is `Telegram`
4. Check **Alerting -> Alert rules**:
   - group `Lebensordner Alerts` exists with 4 rules:
   - `App Down`
   - `Worker Down`
   - `DB Down`
   - `TLS Expiry`
5. Perform a fire/resolve test:

```bash
cd /opt/lebensordner/app/deploy
docker compose stop worker
# wait >= 5 minutes for Worker Down to fire
docker compose start worker
```

Expected:
- Telegram receives `Worker Down` firing notification.
- Telegram receives resolved notification after worker restart.

## E) Closeout

After successful verification:
- Update `docs/ops/go-live-checklist.md` items for Admin Bootstrap and Monitoring.
- Keep `TELEGRAM_BOT_TOKEN` private and rotate immediately if exposed.
