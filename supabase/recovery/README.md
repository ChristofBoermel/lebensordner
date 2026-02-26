# Recovery Runbook

## Files
- `schema_audit.sql`: baseline missing-object audit.
- `post_restore_verifier.sql`: deep verifier (FKs/indexes/triggers/policies/grants/functions).
- `../migrations/20260226000003_restore_core_schema_baseline.sql`: baseline restore migration.
- `run_recovery.ps1`: runs the full flow and writes outputs.

## Run
From repo root (`D:\Projects\Lebensordner`):

```powershell
powershell -ExecutionPolicy Bypass -File .\supabase\recovery\run_recovery.ps1
```

If your DB container/user/dbname differ:

```powershell
powershell -ExecutionPolicy Bypass -File .\supabase\recovery\run_recovery.ps1 `
  -Container "supabase-db" `
  -DbUser "postgres" `
  -DbName "postgres"
```

## Ubuntu Server Run
SSH into your Ubuntu server, then from repo root:

```bash
chmod +x ./supabase/recovery/run_recovery.sh
./supabase/recovery/run_recovery.sh
```

If container/user/db differ:

```bash
./supabase/recovery/run_recovery.sh supabase-db postgres postgres
```

If `docker` requires sudo on your server:

```bash
sudo ./supabase/recovery/run_recovery.sh supabase-db postgres postgres
```

## Share Back
From the generated `supabase/recovery/output-<timestamp>/` folder, share:
- `02_schema_audit_before.out.txt`
- `03_restore_baseline.err.txt` (if non-empty)
- `04_schema_audit_after.out.txt`
- `05_post_restore_verifier.out.txt`
