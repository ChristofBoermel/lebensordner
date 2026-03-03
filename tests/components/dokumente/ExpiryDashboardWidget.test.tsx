import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpiryDashboardWidget } from "@/components/dokumente/ExpiryDashboardWidget";
import type { Document } from "@/types/database";

function createDocument(
  overrides: Partial<Document> & { id: string; title: string; expiry_date: string | null },
): Document {
  return {
    id: overrides.id,
    user_id: "user-1",
    created_at: "2026-01-01T00:00:00.000Z",
    title: overrides.title,
    file_name: `${overrides.title}.pdf`,
    file_path: "/documents/file.pdf",
    file_type: "application/pdf",
    file_size: 1024,
    category: "identitaet",
    subcategory_id: null,
    custom_category_id: null,
    notes: null,
    metadata: {},
    tags: [],
    reminder_days_before: null,
    reminder_enabled: false,
    reminder_watcher_id: null,
    file_iv: null,
    notes_encrypted: null,
    wrapped_dek: null,
    is_encrypted: false,
    uploaded_via: "web",
    expiry_date: overrides.expiry_date,
    extra_security_enabled: false,
    ...overrides,
  };
}

describe("ExpiryDashboardWidget", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-03T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when no documents expire in the next 90 days", () => {
    render(
      <ExpiryDashboardWidget
        documents={[
          createDocument({ id: "a", title: "Alt", expiry_date: "2025-12-01" }),
          createDocument({ id: "b", title: "Fern", expiry_date: "2026-08-01" }),
          createDocument({ id: "c", title: "Kein Datum", expiry_date: null }),
        ]}
        onOpenDocument={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("heading", { name: /Bald ablaufende Dokumente/i }),
    ).not.toBeInTheDocument();
  });

  it("groups expiring documents and calls open handler", async () => {
    const onOpenDocument = vi.fn();
    const user = userEvent.setup();
    const soonDoc = createDocument({
      id: "soon",
      title: "Reisepass",
      expiry_date: "2026-03-06",
      category: "identitaet",
    });

    render(
      <ExpiryDashboardWidget
        documents={[
          soonDoc,
          createDocument({
            id: "month",
            title: "KFZ",
            expiry_date: "2026-03-25",
            category: "versicherungen",
          }),
          createDocument({
            id: "later",
            title: "Mietvertrag",
            expiry_date: "2026-05-01",
            category: "vertraege",
          }),
        ]}
        onOpenDocument={onOpenDocument}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Bald ablaufende Dokumente/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("🔴 Diese Woche")).toBeInTheDocument();
    expect(screen.getByText("🟠 Diesen Monat")).toBeInTheDocument();
    expect(screen.getByText("🟡 Bald")).toBeInTheDocument();
    expect(screen.getByText("Reisepass")).toBeInTheDocument();
    expect(screen.getByText("3 Tage")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Öffnen" })[0]);
    expect(onOpenDocument).toHaveBeenCalledWith(soonDoc);
  });
});
