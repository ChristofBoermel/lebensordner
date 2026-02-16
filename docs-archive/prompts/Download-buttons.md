Erweitere die bestehende Dokument-UI für Family Members um Download-Funktionalität.

REGELN
- Diese Logik gilt NUR im Family-Kontext
- Owner-Downloads bleiben unverändert

BASIC OWNER
- Download-Buttons sichtbar, aber disabled
- Tooltip/Text: "Download mit Premium verfügbar"
- KEINE API-Calls beim Klick

PREMIUM OWNER
- Einzel-Download erlaubt (Signed URL)
- ZIP-Download erlaubt (bestehende ZIP-Logik aus Export-Bereich wiederverwenden)

TECHNIK
- Downloads ausschließlich über API-Routen
- Nutzung der bestehenden ZIP-Implementierung
- Streaming bei ZIP-Erstellung (keine großen Buffers)
- Kurze Signed-URL-TTLs

UX
- Klarer Disabled-State
- Ladefeedback (Skeleton statt Spinner)
- ZIP-Download nur bei Multi-Select sichtbar

LIEFERE:
- API-Routen-Skizze
- UI-State-Matrix (Basic vs Premium)
- Performance-Optimierungen
