# Telegram Bot Webhook Setup (One-Time)

## Overview

The Telegram bot webhook must be registered once so Telegram knows to forward `callback_query` events to `POST /api/webhooks/telegram-bot`. When a Grafana alert fires, the bot sends an interactive message to the configured chat; when the user taps a button (e.g. "Create Issue"), Telegram delivers the `callback_query` to this webhook. This is a manual, one-time operation — it does **not** need to be repeated on every deploy.

## Prerequisites

- The T2 (Grafana Alert Webhook Handler) and T3 (Telegram Bot Callback Handler) endpoints must be deployed and the URL `https://lebensordner.org/api/webhooks/telegram-bot` must be live before running the registration command.
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are already configured in `deploy/.env` (existing vars).
- `TELEGRAM_WEBHOOK_SECRET` must be set in `deploy/.env` before registration — Telegram will include this value in the `X-Telegram-Bot-Api-Secret-Token` header on every callback delivery so the handler can authenticate the request.

## Registration Command

Replace `{TELEGRAM_BOT_TOKEN}` and `{TELEGRAM_WEBHOOK_SECRET}` with the actual values from `deploy/.env`.

```
GET https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/setWebhook?url=https://lebensordner.org/api/webhooks/telegram-bot&secret_token={TELEGRAM_WEBHOOK_SECRET}
```

A successful response looks like:

```json
{"ok": true, "result": true, "description": "Webhook was set"}
```

## Verification Command

```
GET https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getWebhookInfo
```

The response should show:

- `url`: `"https://lebensordner.org/api/webhooks/telegram-bot"`
- `has_custom_certificate`: `false`

Example successful response:

```json
{
  "ok": true,
  "result": {
    "url": "https://lebensordner.org/api/webhooks/telegram-bot",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

## When to Re-Run

- Only if the production domain changes (i.e., the webhook URL changes).
- Only if `TELEGRAM_WEBHOOK_SECRET` is rotated — the `secret_token` parameter must match the value currently set in `deploy/.env`.
- Do **not** re-run on every deploy — it is not needed and risks a brief gap in webhook delivery during the re-registration window.

## See Also

- [Deploy Runbook](./deploy-runbook.md) — standard deployment procedure.
