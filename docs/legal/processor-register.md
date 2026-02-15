# Auftragsverarbeiter-Register (Art. 28 DSGVO)

**Verantwortlicher:** Christof Boermel, Lehmbrookweg 2, 22159 Hamburg

**Datum:** 14. Februar 2026

**Version:** 1.0

| Processor | Purpose | Data Processed | Location | DPA Status | DPA Date | Sub-Processors |
|-----------|---------|----------------|----------|------------|----------|----------------|
| **Supabase Inc.** | Datenbank, Authentifizierung, Speicherung | Alle Benutzerdaten (Profile, Gesundheitsdaten, Dokumente, Audit-Logs) | EU (Frankfurt) | ✅ Unterzeichnet | 2026-02-14 | AWS EU (Frankfurt) |
| **Stripe Inc.** | Zahlungsabwicklung | E-Mail, Stripe Customer ID, Abonnementstatus | EU (Dublin) | ✅ Unterzeichnet | 2026-02-14 | Siehe Stripe Sub-Processor Liste |
| **Resend Inc.** | E-Mail-Versand | E-Mail-Adressen, Namen, Nachrichteninhalte | USA | ⏳ In Bearbeitung | - | Siehe Resend Sub-Processor Liste |
| **PostHog Inc.** | Webanalyse (opt-in) | Pseudonymisierte Benutzer-ID, Seitenaufrufe, Klicks, Browser-Info | EU | ✅ Unterzeichnet | 2026-02-14 | Siehe PostHog Sub-Processor Liste |
| **Cloudflare Inc.** | CAPTCHA (Turnstile) | IP-Adresse (temporär), Browser-Fingerprint | EU | ✅ Unterzeichnet | 2026-02-14 | Siehe Cloudflare Sub-Processor Liste |
| **Vercel Inc.** | Hosting, CDN | Alle Daten (in transit) | EU (Frankfurt) | ⏳ In Bearbeitung | - | AWS EU (Frankfurt) |

## DPA-Status-Legende
- ✅ Unterzeichnet: DPA vollständig unterzeichnet und archiviert
- ⏳ In Bearbeitung: DPA-Anfrage gestellt, Unterzeichnung ausstehend
- ❌ Fehlend: DPA noch nicht angefordert

## Sub-Processor-Details
- **Supabase:** AWS EU (Frankfurt) für Datenbank, Storage, Compute
- **Stripe:** Vollständige Liste unter https://stripe.com/legal/service-providers
- **Resend:** Vollständige Liste unter https://resend.com/legal/subprocessors
- **PostHog:** Vollständige Liste unter https://posthog.com/docs/privacy/subprocessors
- **Cloudflare:** Vollständige Liste unter https://www.cloudflare.com/cloudflare-customer-dpa/
- **Vercel:** AWS EU (Frankfurt) für Hosting

## DPA-Ablage
- Unterzeichnete DPAs werden extern gespeichert (nicht in Git)
- Zugriff: Nur Verantwortlicher (Christof Boermel)
- Aufbewahrungsfrist: Vertragslaufzeit + 3 Jahre

## Review-Zeitplan
- Jährliche Überprüfung aller DPAs
- Bei Hinzufügen neuer Prozessoren: Sofortige DPA-Anforderung
- Bei Änderung von Sub-Prozessoren: Benachrichtigung durch Hauptprozessor

## Hinweise
- Resend und Vercel: DPA-Anfragen am 14.02.2026 gestellt, Unterzeichnung erwartet innerhalb 5 Werktagen
- Alle Prozessoren nutzen EU-Regionen oder SCCs (Resend)
- Keine Datenübermittlung in Drittländer ohne angemessene Garantien
