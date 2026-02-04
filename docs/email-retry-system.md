# Email Retry System

This document describes the email timeout handling and retry mechanism implemented for invitation emails.

## Overview

The email retry system prevents long request delays when sending invitation emails. Instead of blocking the user request while waiting for the email provider (Resend), the system uses a timeout-based approach with background retry processing.

## Timeout Behavior

- **Default Timeout**: 10 seconds (configurable via `DEFAULT_EMAIL_TIMEOUT_MS`)
- When an email send attempt exceeds the timeout, the request returns success immediately
- The email is automatically queued for background retry

### Response Behavior

| Email Status | User Message | HTTP Status |
|--------------|--------------|-------------|
| Sent successfully | "Einladung wurde gesendet" | 200 |
| Timed out | "Einladung wird gesendet" | 200 |
| Failed | "Einladung wird gesendet" | 200 |

The invitation link is always valid regardless of email delivery status.

## Retry Queue Mechanism

### Exponential Backoff

Failed emails are retried with exponential backoff:

| Retry # | Delay |
|---------|-------|
| 0 | 5 minutes |
| 1 | 10 minutes |
| 2 | 20 minutes |
| 3 | 40 minutes |
| 4 | 80 minutes |
| 5+ | Marked as permanently failed |

Maximum delay is capped at 24 hours.

### Queue Processing

- **Cron Schedule**: Every 5 minutes (`*/5 * * * *`)
- **Batch Size**: 50 items per run
- **Endpoint**: `GET /api/cron/process-email-queue`

## Database Schema

### trusted_persons (additional columns)

| Column | Type | Description |
|--------|------|-------------|
| email_sent_at | TIMESTAMPTZ | Timestamp of successful email delivery |
| email_error | TEXT | Last error message |
| email_retry_count | INTEGER | Number of retry attempts |
| email_status | TEXT | Current status: pending, sending, sent, failed |

### email_retry_queue

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| trusted_person_id | UUID | FK to trusted_persons |
| retry_count | INTEGER | Current retry attempt |
| last_error | TEXT | Error from last attempt |
| next_retry_at | TIMESTAMPTZ | Next retry scheduled time |
| created_at | TIMESTAMPTZ | Queue entry creation time |
| status | TEXT | pending, processing, completed, failed |

## API Endpoints

### POST /api/trusted-person/invite

Sends invitation email with timeout handling.

**Request:**
```json
{
  "trustedPersonId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "invitationLink": "https://...",
  "message": "Einladung wurde gesendet"
}
```

### GET /api/trusted-person/invite-status

Check email delivery status for frontend polling.

**Query Parameters:**
- `trustedPersonId`: UUID of the trusted person

**Response:**
```json
{
  "status": "sent",
  "sentAt": "2024-01-01T12:00:00Z",
  "error": null,
  "retryCount": 0,
  "invitationStatus": "sent"
}
```

### GET /api/cron/process-email-queue

Background processor for retry queue (called by cron).

**Authorization:** Bearer token with CRON_SECRET

**Response:**
```json
{
  "success": true,
  "timestamp": "2024-01-01T12:00:00Z",
  "processed": 5,
  "succeeded": 4,
  "failed": 1,
  "permanently_failed": 0,
  "errors": []
}
```

## Monitoring

### Log Events

All events are logged in JSON format for monitoring:

- `email_send_attempt` - Every email send attempt with duration
- `invitation_email_sent` - Successful delivery
- `invitation_email_timeout` - Timeout occurred
- `invitation_email_failed` - Send failed
- `email_queued_for_retry` - Added to retry queue
- `email_retry_succeeded` - Retry successful
- `email_retry_scheduled` - Next retry scheduled
- `email_retry_permanently_failed` - Max retries exceeded

### Example Log Entry

```json
{
  "event": "email_send_attempt",
  "to": "user@example.com",
  "subject": "Max hat Sie als Vertrauensper...",
  "duration_ms": 2345,
  "success": true,
  "timed_out": false,
  "error": null,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Troubleshooting

### Email Not Delivered

1. Check `email_status` in `trusted_persons` table
2. Check `email_retry_queue` for pending retries
3. Review logs for error messages

### Queue Not Processing

1. Verify cron job is running (`/api/cron/process-email-queue`)
2. Check `CRON_SECRET` environment variable
3. Review queue items with `status = 'pending'` and past `next_retry_at`

### Permanently Failed Emails

1. Check `email_error` for the root cause
2. Common issues:
   - Invalid email address
   - Resend API quota exceeded
   - Network connectivity issues
3. Manual intervention may be required to resend

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| RESEND_API_KEY | Resend API key | Yes |
| CRON_SECRET | Secret for cron job auth | Recommended |
| NEXT_PUBLIC_APP_URL | Base URL for invitation links | Yes |
| SUPABASE_SERVICE_ROLE_KEY | Supabase admin access | Yes |

### Constants

Located in `src/lib/email/resend-service.ts`:

- `DEFAULT_EMAIL_TIMEOUT_MS`: 10000 (10 seconds)
- `MAX_RETRY_ATTEMPTS`: 5
