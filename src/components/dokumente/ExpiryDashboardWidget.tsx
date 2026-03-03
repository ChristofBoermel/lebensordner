"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DOCUMENT_CATEGORIES, type Document } from "@/types/database";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type ExpiryDashboardWidgetProps = {
  documents: Document[];
  onOpenDocument: (doc: Document) => void;
};

type ExpiryBand = "thisWeek" | "thisMonth" | "soon";

type ExpiryEntry = {
  doc: Document;
  daysRemaining: number;
  band: ExpiryBand;
};

function toStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function getBand(daysRemaining: number): ExpiryBand | null {
  if (daysRemaining < 0 || daysRemaining > 90) return null;
  if (daysRemaining <= 7) return "thisWeek";
  if (daysRemaining <= 30) return "thisMonth";
  return "soon";
}

function getDaysLabel(daysRemaining: number) {
  if (daysRemaining === 0) return "Heute";
  if (daysRemaining === 1) return "1 Tag";
  return `${daysRemaining} Tage`;
}

const BAND_CONFIG: Record<
  ExpiryBand,
  { label: string; colorClass: string; badgeClass: string }
> = {
  thisWeek: {
    label: "🔴 Diese Woche",
    colorClass: "text-red-700",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
  },
  thisMonth: {
    label: "🟠 Diesen Monat",
    colorClass: "text-amber-700",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
  },
  soon: {
    label: "🟡 Bald",
    colorClass: "text-yellow-700",
    badgeClass: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
};

export function ExpiryDashboardWidget({
  documents,
  onOpenDocument,
}: ExpiryDashboardWidgetProps) {
  const today = toStartOfDay(new Date());
  const entries: ExpiryEntry[] = [];

  for (const doc of documents) {
    if (!doc.expiry_date) continue;
    const expiryDate = parseDate(doc.expiry_date);
    if (!expiryDate) continue;

    const daysRemaining = Math.ceil(
      (toStartOfDay(expiryDate).getTime() - today.getTime()) / MS_PER_DAY,
    );
    const band = getBand(daysRemaining);
    if (!band) continue;

    entries.push({ doc, daysRemaining, band });
  }

  const grouped: Record<ExpiryBand, ExpiryEntry[]> = {
    thisWeek: [],
    thisMonth: [],
    soon: [],
  };

  entries
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .forEach((entry) => grouped[entry.band].push(entry));

  const hasEntries =
    grouped.thisWeek.length > 0 ||
    grouped.thisMonth.length > 0 ||
    grouped.soon.length > 0;

  if (!hasEntries) {
    return null;
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-warmgray-900 flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        Bald ablaufende Dokumente
      </h2>
      <Card className="border-warmgray-200">
        <CardContent className="p-4 sm:p-5 space-y-5">
          {(Object.keys(BAND_CONFIG) as ExpiryBand[]).map((band) => {
            const items = grouped[band];
            if (items.length === 0) return null;

            return (
              <div key={band}>
                <p
                  className={`text-xs font-bold uppercase tracking-wider mb-2 ${BAND_CONFIG[band].colorClass}`}
                >
                  {BAND_CONFIG[band].label}
                </p>
                <div className="space-y-2">
                  {items.map(({ doc, daysRemaining }) => (
                    <div
                      key={doc.id}
                      className="rounded-lg border border-warmgray-200 p-3 flex items-center justify-between gap-3 bg-warmgray-50/60"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-warmgray-900 truncate">
                          {doc.title}
                        </p>
                        <p className="text-xs text-warmgray-500 truncate">
                          {DOCUMENT_CATEGORIES[doc.category].name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${BAND_CONFIG[band].badgeClass}`}
                        >
                          {getDaysLabel(daysRemaining)}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenDocument(doc)}
                        >
                          Öffnen
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
