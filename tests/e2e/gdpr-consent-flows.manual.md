# GDPR Consent E2E Manual Checklist

> Hinweis: Diese Flows sind jetzt automatisch in `tests/e2e/gdpr-consent-flows.test.ts` abgedeckt.
> Dieses Dokument bleibt als lebende Referenz und sollte bei UI-/Flow-Änderungen aktualisiert werden.
> Für lokale Runs müssen die `E2E_*`-Testnutzer sowie Supabase-Service-Keys gesetzt sein.

## Health Consent Grant Flow
1. Sign in with a user that has `health_data_consent_granted = false`.
2. Navigate to `/notfall`.
3. Confirm a consent modal is shown and the protected Notfall content is blocked/blurred.
4. Decline consent.
5. Confirm you are redirected to the dashboard and Notfall content is still not accessible.
6. Return to `/notfall`.
7. Accept consent.
8. Confirm the consent modal closes and the Notfall content becomes visible.
9. Confirm the consent is persisted:
   - Settings shows the Gesundheitsdaten-Einwilligung toggle enabled.
   - A record exists in `consent_history` (or the consent API) for health consent grant.

## Privacy Policy Update Flow
1. Ensure the user has an outdated policy consent version (lower than `CONSENT_VERSION`).
2. Sign in.
3. Confirm you are redirected to `/policy-update`.
4. Verify the accept button is disabled until:
   - The policy text is scrolled to the bottom.
   - The confirmation checkbox is checked.
5. Accept the updated policy.
6. Confirm you are redirected to the dashboard.
7. Attempt to access dashboard routes before accepting (repeat with a second user) and confirm access is blocked until policy acceptance.
8. Confirm the consent record is stored with the latest `CONSENT_VERSION`.

## Health Consent Withdrawal Flow
1. Start with a user that has `health_data_consent_granted = true`.
2. Open Einstellungen and locate the Gesundheitsdaten-Einwilligung toggle.
3. Toggle consent off.
4. Confirm the withdrawal dialog appears.
5. Verify the dialog requires the checkbox confirmation for data deletion.
6. Cancel the dialog.
7. Confirm the toggle remains enabled and no withdrawal API call is made.
8. Toggle consent off again.
9. Confirm the checkbox and submit withdrawal.
10. Confirm the withdrawal API is called with `confirmed = true`.
11. Confirm the toggle updates to disabled and a success toast appears.
12. Confirm access to `/notfall` is gated again and the consent modal is shown.

## Automated Coverage Notes
- Tests prüfen UI-Zustände, Redirects, API-Calls und Supabase-DB-Einträge (consent_ledger + profiles).
- Edge-Cases sind automatisiert: Abbrechen-Dialoge, fehlgeschlagene API-Calls.
