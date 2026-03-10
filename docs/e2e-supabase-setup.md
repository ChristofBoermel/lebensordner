# E2E Supabase Setup

## Recommendation
Use a completely new hosted Supabase project for browser E2E and staging.

Do not point the smoke suite at:
- production,
- your self-hosted server Supabase,
- or an old hosted project that contains historical real data or unclear schema drift.

## Short Answer On Reusing Your Old Hosted Project
You can reuse the old hosted Supabase project only if all of the following are true:
- it contains no real user data you care about,
- you are comfortable deleting and recreating users/documents/storage objects in it,
- its schema exactly matches the current app,
- its storage buckets and RLS behavior match the current app,
- and you are willing to treat it as disposable going forward.

If any of that is uncertain, create a new project.

Recommended default:
- create a fresh project named something like `lebensordner-e2e` or `lebensordner-staging`.

Reason:
- the Playwright smoke suite creates and deletes auth users,
- seeds trusted-person relationships,
- seeds vault keys,
- uploads and deletes storage objects,
- and relies on a clean, predictable schema.

That is safer in a fresh isolated project than in an old environment with unknown leftovers.

## What This E2E Project Is For
This project should be used for:
- local smoke E2E runs,
- PR CI smoke runs,
- manual browser debugging of seeded flows.

This project should not be used for:
- production traffic,
- manual long-lived test accounts,
- or anything where seeded cleanup would be risky.

## Step By Step: Create A New Hosted Supabase Project
1. Go to the Supabase dashboard.
2. Click `New project`.
3. Choose your organization.
4. Name it:
   - `lebensordner-e2e`, or
   - `lebensordner-staging`
5. Set a strong database password and save it.
6. Choose the region closest to your CI/users if possible.
7. Create the project and wait until provisioning completes.

## Step By Step: Copy The Required Keys
After the project is ready:

1. Open `Project Settings`.
2. Open `API`.
3. Copy these values:
   - `Project URL`
   - `anon public key`
   - `service_role key`

You will use them for:
- local `.env.local`
- GitHub Actions secrets for the smoke lane later

## Step By Step: Apply Your Current Schema
The E2E project must match the current app schema.

Recommended:
1. Link your project with the Supabase CLI.
2. Push or apply your current migrations to the new project.
3. Verify the key tables exist:
   - `profiles`
   - `documents`
   - `trusted_persons`
   - `subcategories`
   - `user_vault_keys`
   - `document_relationship_keys`
   - `document_share_tokens`

If you already have a migration workflow in the repo, use that exact path rather than hand-creating tables.

## Step By Step: Create Required Storage Buckets
The document upload smoke tests need the storage bucket your app uses.

At minimum create:
- `documents`

If the app uses other buckets in your environment, create those too as needed.

## Step By Step: Configure Local `.env.local`
Use this template and replace the real E2E Supabase values.

```env
# App base URL
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000

# Dedicated E2E / staging Supabase project
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-E2E-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_E2E_ANON_KEY
SUPABASE_URL=https://YOUR-E2E-PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_E2E_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_E2E_SERVICE_ROLE_KEY

# Security / app boot
ENCRYPTION_KEY=YOUR_64_CHAR_HEX_KEY
CRON_SECRET=dev-e2e-cron-secret
NEXT_PUBLIC_TURNSTILE_SITE_KEY=dev-turnstile-site-key
TURNSTILE_SECRET_KEY=dev-turnstile-secret-key

# Redis
REDIS_URL=redis://localhost:6379

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_placeholder
STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_PRICE_BASIC_MONTHLY=price_basic_monthly_e2e
STRIPE_PRICE_BASIC_YEARLY=price_basic_yearly_e2e
STRIPE_PRICE_PREMIUM_MONTHLY=price_premium_monthly_e2e
STRIPE_PRICE_PREMIUM_YEARLY=price_premium_yearly_e2e
STRIPE_PRICE_ID=price_premium_monthly_e2e

# Email / analytics placeholders
RESEND_API_KEY=re_placeholder
NEXT_PUBLIC_POSTHOG_KEY=phc_placeholder
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com

# Optional
NEXT_PUBLIC_PRIVACY_POLICY_VERSION=v1.0.0
E2E_RUN_ID=local
```

## Which Values Must Be Real
These must be real:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY`

## Which Values Can Be Placeholders Initially
These can be placeholders for the current smoke suite:
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- Turnstile values if the covered E2E flows do not hit those protected forms

For best parity, you can still use your real Stripe price IDs from production.

## Should You Copy Your Old Hosted Supabase Into Local `.env.local`?
Only if that hosted project is now intentionally repurposed as disposable staging/E2E.

Do not do that if:
- it still contains historical real data,
- you are not sure it has the current schema,
- or you may later confuse it with production-like environments.

## Best Practice For Your Situation
Because you are a solo developer, the safest and lowest-maintenance option is:
1. create one fresh hosted Supabase project,
2. name it clearly as E2E/staging,
3. migrate it to current schema,
4. point local smoke tests and CI smoke tests at it,
5. never reuse production credentials there.

That gives you:
- safe destructive automation,
- predictable cleanup,
- fewer “is this environment safe?” mistakes,
- and simpler future debugging.

## First Validation After Setup
Once the project and `.env.local` are ready, run:

```bash
npm run type-check
npm run test:e2e:smoke -- --list
npm run test:e2e:smoke
```

## Notes
- The new smoke harness creates fresh users and data automatically.
- You do not need to manually create long-lived E2E accounts.
- If a test run crashes, a few seeded records may remain behind; that is another reason to keep this project isolated.
