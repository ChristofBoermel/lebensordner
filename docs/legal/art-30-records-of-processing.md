# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO)

**Verantwortlicher:** Christof Boermel, Lehmbrookweg 2, 22159 Hamburg

**Datum:** 14. Februar 2026

**Version:** 1.0

## Verarbeitungstätigkeit 1: Benutzerkontenverwaltung
- **Zweck:** Plattformbereitstellung, Authentifizierung
- **Betroffene Personen:** Registrierte Benutzer
- **Datenkategorien:** Name, E-Mail, Passwort-Hash, optional (Telefon, Adresse, Geburtsdatum verschlüsselt)
- **Empfänger:** Supabase Inc., Vercel Inc.
- **Drittländer:** Nein (EU Frankfurt)
- **Speicherdauer:** Bis Kontolöschung
- **Sicherheitsmaßnahmen:** TLS 1.3, AES-256-GCM, RLS, 2FA, Audit-Logging
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. a DSGVO

## Verarbeitungstätigkeit 2: Gesundheitsdatenspeicherung
- **Zweck:** Notfallinformationen für Vertrauenspersonen
- **Betroffene Personen:** Benutzer mit Gesundheitsdaten
- **Datenkategorien:** Diagnosen, Medikamente, Allergien, Blutgruppe, Notfallkontakte (Art. 9 DSGVO)
- **Empfänger:** Supabase Inc., autorisierte Vertrauenspersonen
- **Drittländer:** Nein (EU Frankfurt)
- **Speicherdauer:** Bis Kontolöschung
- **Sicherheitsmaßnahmen:** AES-256-GCM, RLS, Audit-Logging, IP-Pseudonymisierung
- **Rechtsgrundlage:** Art. 9 Abs. 2 lit. a DSGVO (Ausdrückliche Einwilligung)

## Verarbeitungstätigkeit 3: Dokumentenspeicherung
- **Zweck:** Verwaltung von Vollmachten, Patientenverfügungen
- **Betroffene Personen:** Benutzer mit Dokumenten
- **Datenkategorien:** Dateien (PDF, Bilder), Metadaten (Titel, Kategorie, Ablaufdatum)
- **Empfänger:** Supabase Inc., autorisierte Vertrauenspersonen
- **Drittländer:** Nein (EU Frankfurt)
- **Speicherdauer:** Bis Kontolöschung oder manuelle Löschung
- **Sicherheitsmaßnahmen:** TLS 1.3, Supabase Storage Encryption, RLS, Audit-Logging
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. a DSGVO

## Verarbeitungstätigkeit 4: Zahlungsabwicklung
- **Zweck:** Abonnementzahlungen
- **Betroffene Personen:** Benutzer mit kostenpflichtigem Abo
- **Datenkategorien:** E-Mail, Stripe Customer ID, Abonnementstatus
- **Empfänger:** Stripe Inc.
- **Drittländer:** Nein (Stripe EU Dublin)
- **Speicherdauer:** Bis Kontolöschung (Customer als gelöscht markiert)
- **Sicherheitsmaßnahmen:** Keine Kreditkartendaten gespeichert, verschlüsselte Stripe API, Webhook-Signaturverifizierung
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)

## Verarbeitungstätigkeit 5: Sicherheitsprotokollierung
- **Zweck:** Sicherheitsüberwachung, Betrugsprävention, Audit-Trail
- **Betroffene Personen:** Alle Benutzer
- **Datenkategorien:** Benutzer-ID, Ereignistyp, pseudonymisierte IP (letztes Oktett maskiert), User-Agent, Zeitstempel
- **Empfänger:** Supabase Inc.
- **Drittländer:** Nein (EU Frankfurt)
- **Speicherdauer:** 90 Tage (bei Kontolöschung: Benutzer-ID entfernt, Logs anonymisiert)
- **Sicherheitsmaßnahmen:** IP-Pseudonymisierung, Anonymisierung bei Löschung, Service-Role-only Schreibzugriff, Tamper-Resistant
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. f DSGVO (Berechtigtes Interesse)

## Verarbeitungstätigkeit 6: Webanalyse (PostHog)
- **Zweck:** Websitenutzung analysieren zur Plattformverbesserung
- **Betroffene Personen:** Benutzer mit Analyse-Cookies-Einwilligung
- **Datenkategorien:** Benutzer-ID (pseudonymisiert), Seitenaufrufe, Klicks, Browser-Informationen
- **Empfänger:** PostHog Inc.
- **Drittländer:** Nein (PostHog EU)
- **Speicherdauer:** Bei Kontolöschung Löschungsanfrage an PostHog API
- **Sicherheitsmaßnahmen:** Opt-In, Pseudonymisierung, automatische Löschungsanfrage
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)

## Verarbeitungstätigkeit 7: E-Mail-Versand
- **Zweck:** Einladungen, Erinnerungen, Sicherheitsbenachrichtigungen
- **Betroffene Personen:** Benutzer und Vertrauenspersonen
- **Datenkategorien:** E-Mail-Adresse, Name, Nachrichteninhalt
- **Empfänger:** Resend Inc.
- **Drittländer:** Ja, USA (Standardvertragsklauseln Art. 46 Abs. 2 lit. c DSGVO)
- **Speicherdauer:** Sofort nach Versand (keine Speicherung bei Resend)
- **Sicherheitsmaßnahmen:** TLS-Verschlüsselung, Retry-Mechanismus, keine dauerhafte Speicherung
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) / Art. 6 Abs. 1 lit. f DSGVO (Sicherheitsbenachrichtigungen)
