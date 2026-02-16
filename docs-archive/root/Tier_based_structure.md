# Aufgabe: Tier-basierte Zugriffssteuerung für alle Features implementieren

## Kontext

Aktuell können Nutzer Features sehen/nutzen, die nicht zu ihrem Tier gehören.
Beispiel: BASIC-User sehen das Familien-Dashboard, obwohl das nur für PREMIUM ist.

**Ziel:** Saubere Zugriffssteuerung auf Client- UND Server-Seite implementieren.

## Tier-Struktur (zur Erinnerung)

### FREE

- ✓ 10 Dokumente
- ✓ 3 Ordner
- ✓ 1 vertraute Person
- ✓ Notfallkontakte (unbegrenzt)
- ✗ Erinnerungen bei Ablauf
- ✗ Eigene Kategorien
- ✗ SMS-Benachrichtigungen
- ✗ Familien-Dashboard

### BASIC

- ✓ 50 Dokumente
- ✓ 10 Ordner
- ✓ 3 vertraute Personen
- ✓ Erinnerungen bei Ablauf
- ✓ Eigene Kategorien (5 Stück)
- ✗ SMS-Benachrichtigungen
- ✗ Familien-Dashboard

### PREMIUM

- ✓ Unbegrenzte Dokumente
- ✓ Unbegrenzte Ordner
- ✓ 5 vertraute Personen
- ✓ Erinnerungen bei Ablauf
- ✓ Unbegrenzte eigene Kategorien
- ✓ SMS-Benachrichtigungen
- ✓ Familien-Dashboard

---

## Phase 1: Zentrale Tier-Logik erstellen

### 1. Tier-Utility-Funktionen

**Erstelle `/lib/tiers.ts`** (oder erweitere wenn schon vorhanden):

```typescript
export type SubscriptionTier = "FREE" | "BASIC" | "PREMIUM";

export interface TierLimits {
  maxDocuments: number | null; // null = unbegrenzt
  maxFolders: number | null;
  maxTrustedPersons: number;
  maxCustomCategories: number | null;
  features: {
    expiryReminders: boolean;
    smsNotifications: boolean;
    familyDashboard: boolean;
    customCategories: boolean;
  };
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  FREE: {
    maxDocuments: 10,
    maxFolders: 3,
    maxTrustedPersons: 1,
    maxCustomCategories: 0,
    features: {
      expiryReminders: false,
      smsNotifications: false,
      familyDashboard: false,
      customCategories: false,
    },
  },
  BASIC: {
    maxDocuments: 50,
    maxFolders: 10,
    maxTrustedPersons: 3,
    maxCustomCategories: 5,
    features: {
      expiryReminders: true,
      smsNotifications: false,
      familyDashboard: false,
      customCategories: true,
    },
  },
  PREMIUM: {
    maxDocuments: null, // unbegrenzt
    maxFolders: null,
    maxTrustedPersons: 5,
    maxCustomCategories: null,
    features: {
      expiryReminders: true,
      smsNotifications: true,
      familyDashboard: true,
      customCategories: true,
    },
  },
};

// Helper-Funktionen
export function hasFeatureAccess(
  tier: SubscriptionTier,
  feature: keyof TierLimits["features"],
): boolean {
  return TIER_LIMITS[tier].features[feature];
}

export function canAddMore(
  tier: SubscriptionTier,
  resourceType: "documents" | "folders" | "trustedPersons" | "customCategories",
  currentCount: number,
): boolean {
  const limits = TIER_LIMITS[tier];

  let limit: number | null;
  switch (resourceType) {
    case "documents":
      limit = limits.maxDocuments;
      break;
    case "folders":
      limit = limits.maxFolders;
      break;
    case "trustedPersons":
      limit = limits.maxTrustedPersons;
      break;
    case "customCategories":
      limit = limits.maxCustomCategories;
      break;
  }

  // null = unbegrenzt
  if (limit === null) return true;

  return currentCount < limit;
}

export function getRemainingSlots(
  tier: SubscriptionTier,
  resourceType: "documents" | "folders" | "trustedPersons" | "customCategories",
  currentCount: number,
): number | null {
  const limits = TIER_LIMITS[tier];

  let limit: number | null;
  switch (resourceType) {
    case "documents":
      limit = limits.maxDocuments;
      break;
    case "folders":
      limit = limits.maxFolders;
      break;
    case "trustedPersons":
      limit = limits.maxTrustedPersons;
      break;
    case "customCategories":
      limit = limits.maxCustomCategories;
      break;
  }

  if (limit === null) return null; // unbegrenzt

  return Math.max(0, limit - currentCount);
}

export function getRequiredTierForFeature(
  feature: keyof TierLimits["features"],
): SubscriptionTier {
  // Gibt niedrigsten Tier zurück, der Feature hat
  if (TIER_LIMITS.BASIC.features[feature]) return "BASIC";
  if (TIER_LIMITS.PREMIUM.features[feature]) return "PREMIUM";
  return "FREE";
}
```

**Tasks:**

- [ ] Erstelle/erweitere `/lib/tiers.ts`
- [ ] Exportiere alle Helper-Funktionen
- [ ] Füge JSDoc-Kommentare hinzu

---

### 2. Server-seitige Middleware für geschützte Routen

**Erstelle `/lib/auth/tier-guard.ts`:**

```typescript
import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { hasFeatureAccess } from "@/lib/tiers";
import type { SubscriptionTier } from "@/lib/tiers";

export async function requireFeature(
  feature:
    | "familyDashboard"
    | "smsNotifications"
    | "expiryReminders"
    | "customCategories",
) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Hole User-Tier aus Datenbank
  const { data: profile } = await supabase
    .from("users")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const tier = (profile?.subscription_tier || "FREE") as SubscriptionTier;

  if (!hasFeatureAccess(tier, feature)) {
    // Redirect zu Upgrade-Seite mit Kontext
    redirect(`/einstellungen/tarife?required=${feature}&tier=${tier}`);
  }

  return { user, tier };
}

export async function getUserTier() {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  return (profile?.subscription_tier || "FREE") as SubscriptionTier;
}
```

**Tasks:**

- [ ] Erstelle Middleware
- [ ] Teste mit verschiedenen Tiers
- [ ] Prüfe Redirect-Logik

---

## Phase 2: Routen schützen

### 3. Familien-Dashboard (nur PREMIUM)

**Datei: `/app/familie/dashboard/page.tsx`** (oder wo auch immer das liegt)

```typescript
import { requireFeature } from '@/lib/auth/tier-guard';

export default async function FamilyDashboardPage() {
  // Diese Zeile blockiert Nicht-PREMIUM-User
  await requireFeature('familyDashboard');

  // Rest des Components...
  return (
    <div>
      {/* Dein Familien-Dashboard */}
    </div>
  );
}
```

**Tasks:**

- [ ] Finde Familien-Dashboard-Route
- [ ] Füge `requireFeature()` hinzu
- [ ] Teste mit FREE/BASIC User (sollten redirected werden)
- [ ] Teste mit PREMIUM User (sollte funktionieren)

---

### 4. Navigation verstecken für nicht-verfügbare Features

**Datei: `/components/navigation.tsx`** (oder Main-Nav-Component)

**Beispiel:**

```typescript
'use client';

import { useUser } from '@/hooks/useUser'; // Dein bestehender User-Hook
import { hasFeatureAccess } from '@/lib/tiers';

export function Navigation() {
  const { user, tier } = useUser(); // Anpassen an deine Auth-Logik

  const showFamilyDashboard = tier && hasFeatureAccess(tier, 'familyDashboard');

  return (
    <nav>
      <NavLink href="/start">Start</NavLink>
      <NavLink href="/unterlagen">Unterlagen</NavLink>
      <NavLink href="/notfall">Notfall</NavLink>
      <NavLink href="/familie">Familie</NavLink>

      {/* Familien-Dashboard nur für PREMIUM */}
      {showFamilyDashboard && (
        <NavLink href="/familie/dashboard">
          Familien-Dashboard
        </NavLink>
      )}

      <NavLink href="/einstellungen">Einstellungen</NavLink>
    </nav>
  );
}
```

**Alternativ: Mit Badge "Premium" anzeigen statt verstecken:**

```typescript
<NavLink href="/familie/dashboard">
  Familien-Dashboard
  {!showFamilyDashboard && (
    <span className="ml-2 text-xs bg-yellow-500 text-white px-2 py-1 rounded">
      Premium
    </span>
  )}
</NavLink>
```

**Tasks:**

- [ ] Finde Navigation-Component
- [ ] Implementiere bedingte Anzeige
- [ ] Entscheide: Verstecken ODER mit Badge markieren?
- [ ] Teste mit allen Tiers

---

### 5. UI-Features bedingt anzeigen

#### A) Dokumente-Upload (Limit-Check)

**Datei: `/components/document-upload.tsx`** oder `/app/unterlagen/page.tsx`

```typescript
'use client';

import { useUser } from '@/hooks/useUser';
import { canAddMore, getRemainingSlots } from '@/lib/tiers';
import { UpgradeModal } from '@/components/UpgradeModal';
import { useState } from 'react';

export function DocumentUploadButton({ currentDocumentCount }: { currentDocumentCount: number }) {
  const { tier } = useUser();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const canUpload = tier && canAddMore(tier, 'documents', currentDocumentCount);
  const remaining = tier && getRemainingSlots(tier, 'documents', currentDocumentCount);

  const handleClick = () => {
    if (!canUpload) {
      setShowUpgradeModal(true);
      return;
    }

    // Normaler Upload-Flow
    // ...
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg text-lg"
      >
        + Dokument hinzufügen
      </button>

      {remaining !== null && remaining <= 2 && (
        <p className="text-sm text-gray-600 mt-2">
          Noch {remaining} von {tier && TIER_LIMITS[tier].maxDocuments} Dokumenten verfügbar
        </p>
      )}

      {showUpgradeModal && (
        <UpgradeModal
          feature="documents"
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </>
  );
}
```

**Tasks:**

- [ ] Finde Upload-Component
- [ ] Implementiere Limit-Check
- [ ] Zeige Warning bei 80% Auslastung
- [ ] Verhindere Upload bei Limit
- [ ] Zeige Upgrade-Modal

---

#### B) Ordner erstellen (Limit-Check)

**Ähnliche Logik wie bei Dokumenten:**

```typescript
export function CreateFolderButton({ currentFolderCount }: { currentFolderCount: number }) {
  const { tier } = useUser();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const canCreate = tier && canAddMore(tier, 'folders', currentFolderCount);

  const handleClick = () => {
    if (!canCreate) {
      setShowUpgradeModal(true);
      return;
    }

    // Normaler Create-Flow
  };

  return (
    <>
      <button onClick={handleClick}>
        + Neuer Ordner
      </button>

      {showUpgradeModal && (
        <UpgradeModal
          feature="folders"
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </>
  );
}
```

**Tasks:**

- [ ] Finde Ordner-Erstellung
- [ ] Implementiere analog zu Dokumenten

---

#### C) Vertraute Personen einladen (Limit-Check)

```typescript
export function InviteTrustedPersonButton({ currentCount }: { currentCount: number }) {
  const { tier } = useUser();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const canInvite = tier && canAddMore(tier, 'trustedPersons', currentCount);

  const handleClick = () => {
    if (!canInvite) {
      setShowUpgradeModal(true);
      return;
    }

    // Einladungs-Flow
  };

  return (
    <>
      <button onClick={handleClick}>
        + Person einladen
      </button>

      {showUpgradeModal && (
        <UpgradeModal
          feature="trustedPersons"
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </>
  );
}
```

**Tasks:**

- [ ] Implementiere Limit-Check für vertraute Personen

---

#### D) Ablaufdatum-Erinnerungen (Feature-Gate)

**Datei: Wo auch immer Ablaufdatum gesetzt wird**

```typescript
export function ExpiryDateField() {
  const { tier } = useUser();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const hasReminders = tier && hasFeatureAccess(tier, 'expiryReminders');

  return (
    <div>
      <label>Ablaufdatum (optional)</label>
      <input
        type="date"
        // ...
      />

      {!hasReminders && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm">
            💡 Mit Basic/Premium erinnern wir Sie automatisch,
            bevor Dokumente ablaufen.
          </p>
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="text-blue-600 underline text-sm mt-1"
          >
            Mehr erfahren
          </button>
        </div>
      )}

      {showUpgradeModal && (
        <UpgradeModal
          feature="expiryReminders"
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </div>
  );
}
```

**Tasks:**

- [ ] Finde Ablaufdatum-Input
- [ ] Zeige Info-Box für FREE-User
- [ ] Optional: Deaktiviere Input komplett für FREE

---

#### E) Eigene Kategorien (nur BASIC/PREMIUM)

**Beispiel:**

```typescript
export function CustomCategoryManager() {
  const { tier } = useUser();
  const [categories, setCategories] = useState([]);

  const canCreateCustomCategories = tier && hasFeatureAccess(tier, 'customCategories');
  const canAddMore = tier && canAddMore(tier, 'customCategories', categories.length);

  if (!canCreateCustomCategories) {
    return (
      <div className="p-4 bg-gray-50 border rounded">
        <p className="text-lg mb-2">Eigene Kategorien</p>
        <p className="text-gray-600 mb-4">
          Mit eigenen Kategorien können Sie Dokumente nach
          Ihren Wünschen sortieren.
        </p>
        <button className="bg-blue-600 text-white px-6 py-3 rounded-lg">
          Jetzt freischalten (ab Basic)
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Normale Kategorie-Verwaltung */}
      <button disabled={!canAddMore}>
        + Kategorie hinzufügen
      </button>
    </div>
  );
}
```

**Tasks:**

- [ ] Finde Kategorie-Feature
- [ ] Gate hinter BASIC/PREMIUM
- [ ] Zeige Upgrade-Option für FREE

---

## Phase 3: Server-seitige API-Absicherung

### 6. API-Routes schützen

**Wichtig:** Client-seitige Checks sind nur UX, NICHT Sicherheit!

**Beispiel: `/app/api/documents/upload/route.ts`**

```typescript
import { createServerClient } from "@/lib/supabase/server";
import { canAddMore } from "@/lib/tiers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Hole User-Tier
  const { data: profile } = await supabase
    .from("users")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const tier = profile?.subscription_tier || "FREE";

  // Hole aktuelle Dokumenten-Anzahl
  const { count } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Prüfe Limit
  if (!canAddMore(tier, "documents", count || 0)) {
    return NextResponse.json(
      {
        error: "Document limit reached",
        tier,
        limit: TIER_LIMITS[tier].maxDocuments,
        current: count,
      },
      { status: 403 },
    );
  }

  // Upload erlauben
  // ... Rest der Upload-Logik
}
```

**Tasks:**

- [ ] Finde alle API-Routes die Ressourcen anlegen
- [ ] Implementiere Tier-Checks:
  - [ ] `/api/documents/upload`
  - [ ] `/api/folders/create`
  - [ ] `/api/trusted-persons/invite`
  - [ ] `/api/categories/create`
- [ ] Teste mit curl/Postman (sollte 403 bei Limit zurückgeben)

---

### 7. Server Actions absichern (falls verwendet)

**Beispiel: Server Action in `/app/actions/documents.ts`**

```typescript
"use server";

import { createServerClient } from "@/lib/supabase/server";
import { canAddMore, TIER_LIMITS } from "@/lib/tiers";
import { revalidatePath } from "next/cache";

export async function uploadDocument(formData: FormData) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Tier-Check
  const { data: profile } = await supabase
    .from("users")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  const tier = profile?.subscription_tier || "FREE";

  const { count } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (!canAddMore(tier, "documents", count || 0)) {
    return {
      success: false,
      error: "LIMIT_REACHED",
      tier,
      limit: TIER_LIMITS[tier].maxDocuments,
    };
  }

  // Upload durchführen
  // ...

  revalidatePath("/unterlagen");
  return { success: true };
}
```

**Tasks:**

- [ ] Finde alle Server Actions
- [ ] Implementiere Tier-Checks
- [ ] Gib sinnvolle Error-Messages zurück

---

## Phase 4: RLS (Row Level Security) in Supabase

### 8. Datenbank-Policies erweitern

**Ziel:** Auch auf DB-Ebene sicherstellen, dass Limits eingehalten werden

**Beispiel-Policy für `documents`-Tabelle:**

```sql
-- Policy: User kann nur hochladen wenn unter Limit
CREATE POLICY "users_can_insert_documents_within_tier_limit"
ON documents
FOR INSERT
TO authenticated
WITH CHECK (
  (
    -- Hole User-Tier
    SELECT subscription_tier FROM users WHERE id = auth.uid()
  ) = 'PREMIUM'
  OR
  (
    -- Zähle vorhandene Dokumente
    SELECT COUNT(*) FROM documents WHERE user_id = auth.uid()
  ) < (
    -- Hole Limit basierend auf Tier
    SELECT
      CASE
        WHEN (SELECT subscription_tier FROM users WHERE id = auth.uid()) = 'BASIC'
        THEN 50
        ELSE 10 -- FREE
      END
  )
);
```

**Tasks:**

- [ ] Prüfe bestehende RLS-Policies
- [ ] Erweitere um Tier-Checks (oder erstelle neue)
- [ ] Teste direkt in Supabase SQL-Editor
- [ ] Dokumentiere alle Policies

---

## Phase 5: User-Feedback & Error-Handling

### 9. Senioren-freundliche Error-Messages

**Erstelle `/components/TierLimitReachedMessage.tsx`:**

```typescript
interface Props {
  resourceType: 'documents' | 'folders' | 'trustedPersons';
  currentTier: SubscriptionTier;
  currentCount: number;
}

export function TierLimitReachedMessage({
  resourceType,
  currentTier,
  currentCount
}: Props) {
  const limit = TIER_LIMITS[currentTier][
    `max${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}`
  ];

  const messages = {
    documents: {
      title: 'Maximale Anzahl erreicht',
      text: `Sie haben bereits ${currentCount} von ${limit} Dokumenten hochgeladen.`,
      solution: 'Mit Basic können Sie 50 Dokumente sichern, mit Premium unbegrenzt viele.',
    },
    folders: {
      title: 'Maximale Anzahl an Ordnern erreicht',
      text: `Sie haben bereits ${currentCount} von ${limit} Ordnern erstellt.`,
      solution: 'Mit Basic können Sie 10 Ordner nutzen, mit Premium unbegrenzt viele.',
    },
    trustedPersons: {
      title: 'Maximale Anzahl an Personen erreicht',
      text: `Sie können aktuell ${limit} vertraute Person einladen.`,
      solution: 'Mit Basic können Sie 3 Personen einladen, mit Premium bis zu 5.',
    },
  };

  const msg = messages[resourceType];

  return (
    <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6">
      <div className="flex items-start gap-4">
        <span className="text-4xl">⚠️</span>
        <div>
          <h3 className="text-xl font-semibold mb-2">{msg.title}</h3>
          <p className="text-lg mb-3">{msg.text}</p>
          <p className="text-lg mb-4">{msg.solution}</p>
          <Link
            href="/einstellungen/tarife"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg text-lg"
          >
            Tarife vergleichen
          </Link>
        </div>
      </div>
    </div>
  );
}
```

**Tasks:**

- [ ] Erstelle Component
- [ ] Nutze in allen Limit-Reached-Scenarios
- [ ] Teste Texte mit Senioren-Perspektive

---

## Phase 6: Testing & Validation

### 10. Test-Checkliste

**Für jedes Feature einzeln testen:**

#### Dokumente:

- [ ] FREE-User kann max. 10 Dokumente hochladen
- [ ] Beim 11. Versuch: Upgrade-Modal erscheint
- [ ] BASIC-User kann max. 50 hochladen
- [ ] PREMIUM-User kann unbegrenzt hochladen
- [ ] API-Route blockt bei Limit (403)
- [ ] DB-Policy verhindert INSERT bei Limit

#### Ordner:

- [ ] FREE: Max. 3 Ordner
- [ ] BASIC: Max. 10 Ordner
- [ ] PREMIUM: Unbegrenzt
- [ ] Upgrade-Modal bei Limit

#### Vertraute Personen:

- [ ] FREE: Max. 1 Person
- [ ] BASIC: Max. 3 Personen
- [ ] PREMIUM: Max. 5 Personen

#### Features:

- [ ] Familien-Dashboard nur für PREMIUM sichtbar
- [ ] FREE-User werden redirected wenn sie /familie/dashboard aufrufen
- [ ] Erinnerungen nur für BASIC/PREMIUM
- [ ] SMS nur für PREMIUM
- [ ] Eigene Kategorien nur für BASIC/PREMIUM

---

### 11. Test-User anlegen

**Script zum schnellen Testen:**

```typescript
// /scripts/create-test-users.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Nur für Scripts!
);

async function createTestUsers() {
  const users = [
    { email: "test-free@example.com", tier: "FREE" },
    { email: "test-basic@example.com", tier: "BASIC" },
    { email: "test-premium@example.com", tier: "PREMIUM" },
  ];

  for (const user of users) {
    // User anlegen
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: "TestPasswort123!",
      email_confirm: true,
    });

    if (data.user) {
      // Tier setzen
      await supabase
        .from("users")
        .update({ subscription_tier: user.tier })
        .eq("id", data.user.id);

      console.log(`✓ Created ${user.tier}: ${user.email}`);
    }
  }
}

createTestUsers();
```

**Tasks:**

- [ ] Erstelle Test-User für jeden Tier
- [ ] Teste mit jedem User alle Features
- [ ] Dokumentiere Bugs

---

## Phase 7: Upgrade-Flow optimieren

### 12. Kontextuelle Upgrade-Seite

**Datei: `/app/einstellungen/tarife/page.tsx`**

**Wenn User von Feature-Gate kommt:**

```typescript
export default function TarifeSeite({
  searchParams
}: {
  searchParams: { required?: string; tier?: string }
}) {
  const requiredFeature = searchParams.required;
  const currentTier = searchParams.tier;

  return (
    <div>
      {requiredFeature && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            {getFeatureTitle(requiredFeature)}
          </h2>
          <p className="text-lg mb-4">
            {getFeatureDescription(requiredFeature)}
          </p>
          <p className="text-lg">
            Dieses Feature ist ab{' '}
            <strong>{getRequiredTierName(requiredFeature)}</strong>{' '}
            verfügbar.
          </p>
        </div>
      )}

      {/* Normale Pricing-Tabelle */}
      <PricingTable highlightTier={getRequiredTierForFeature(requiredFeature)} />
    </div>
  );
}

function getFeatureTitle(feature: string) {
  const titles = {
    familyDashboard: 'Familien-Dashboard',
    smsNotifications: 'SMS-Benachrichtigungen',
    expiryReminders: 'Automatische Erinnerungen',
    // ...
  };
  return titles[feature] || 'Premium-Feature';
}

function getFeatureDescription(feature: string) {
  const descriptions = {
    familyDashboard: 'Ihre Familie kann gemeinsam auf wichtige Dokumente zugreifen und im Notfall schnell handeln.',
    // ...
  };
  return descriptions[feature] || '';
}
```

**Tasks:**

- [ ] Erweitere Tarife-Seite um Query-Params
- [ ] Zeige kontextuelle Info-Box
- [ ] Highlighte passenden Tier

---

## Zusammenfassung: Was am Ende funktionieren muss

### Client-Seite:

✅ Navigation zeigt nur erlaubte Features
✅ Buttons zeigen Upgrade-Modal bei Limit
✅ Feature-Gates blockieren UI-Elemente
✅ Remaining-Slots-Anzeige funktioniert
✅ Senioren-freundliche Error-Messages

### Server-Seite:

✅ API-Routes prüfen Tier-Limits
✅ Server Actions prüfen Tier-Limits
✅ Geschützte Seiten redirecten bei fehlendem Zugriff

### Datenbank:

✅ RLS-Policies erzwingen Limits
✅ User-Tier ist korrekt gespeichert

### UX:

✅ Upgrade-Flow ist klar und nicht frustrierend
✅ User versteht immer, warum etwas blockiert ist
✅ Upgrade-Optionen sind immer sichtbar

---

## Arbeitsweise

1. **Starte mit Analyse:**
   - Zeige mir alle Dateien, die Tier-Checks brauchen
   - Liste alle Features auf, die gegated werden müssen

2. **Implementiere schrittweise:**
   - Erst zentrale Tier-Logik (`/lib/tiers.ts`)
   - Dann Server-Guards
   - Dann Client-Guards
   - Dann API-Absicherung
   - Zuletzt DB-Policies

3. **Nach jeder Phase:**
   - Teste mit allen 3 Tiers
   - Dokumentiere was funktioniert
   - Fixe Bugs sofort

4. **Am Ende:**
   - Gesamttest mit Test-Usern
   - Checkliste abhaken
   - Zusammenfassung aller Änderungen

---

## Wichtige Hinweise

### Senioren-UX beachten:

- ❌ NICHT: Rote Fehler-Boxen
- ✅ STATTDESSEN: Freundliche Upgrade-Hinweise
- ❌ NICHT: "Access Denied"
- ✅ STATTDESSEN: "Dieses Feature ist ab Basic verfügbar"

### Keine Dark Patterns:

- Immer klar kommunizieren, warum etwas blockiert ist
- Upgrade-Option immer zeigen, nie verstecken
- User nie "trappen" (z.B. erst hochladen lassen, dann blockieren)

### Performance:

- Tier-Checks cachen wo möglich
- Nicht bei jedem Klick DB-Abfrage
- User-Tier in Client-State halten (React Context?)

---

## Start

Beginne mit:

1. Zeige mir die aktuelle User-/Profile-Struktur
2. Zeige mir wie Tier aktuell gespeichert wird
3. Dann erstellen wir `/lib/tiers.ts`

Los geht's!
