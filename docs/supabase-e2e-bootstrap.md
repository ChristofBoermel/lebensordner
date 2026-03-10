# Supabase E2E Bootstrap

## Why This Exists
This repo has two migration tracks:
- legacy migrations in `supabase/migration_*.sql`
- newer timestamped migrations in `supabase/migrations/*.sql`

On a fresh hosted Supabase project, `supabase db push` alone is not enough because
the timestamped migrations assume parts of the legacy schema already exist.

## Recommended Bootstrap Order
1. Run the baseline restore SQL:
   - `supabase/migrations/20260226000003_restore_core_schema_baseline.sql`
2. Generate the combined legacy bootstrap SQL:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\ops\build-supabase-legacy-bootstrap.ps1
   ```
3. Open `supabase/legacy-bootstrap.sql`
4. Paste it into the SQL Editor of the new hosted E2E project and run it
5. Then run:
   ```powershell
   supabase db push
   ```

## Which Legacy Migrations Are Included
The helper intentionally includes only the legacy files still needed after the
baseline restore:
- `migration_019_download_tokens.sql`
- `migration_030_download_link_types.sql`
- `migration_033_email_tracking.sql`
- `migration_035_security_foundation.sql`
- `migration_037_performance_and_transactions.sql`
- `migration_038_rpc_security.sql`
- `migration_039_doc_count_rpc.sql`

It does not replay the earlier legacy feature migrations because the baseline
restore already creates most of that core schema, and rerunning those files can
cause duplicate-policy failures on a fresh project.

## If Invitations Fail With `email_retry_queue` Missing
If `/api/trusted-person/invite` fails with an error like:

```text
Could not find the table 'public.email_retry_queue' in the schema cache
```

run this legacy migration once in the hosted E2E project SQL Editor:

- `supabase/migration_033_email_tracking.sql`

That creates the retry queue table used by invitation email fallback handling.

## Safety Notes
- Run this only against the dedicated hosted E2E/staging project.
- Do not run it against production.
- Do not run it against your local self-hosted Supabase unless you intentionally
  want to mutate that environment.
