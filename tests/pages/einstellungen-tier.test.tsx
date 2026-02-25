import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import EinstellungenPage from "@/app/(dashboard)/einstellungen/page";
import {
  STRIPE_PRICE_PREMIUM_MONTHLY,
  STRIPE_PRICE_BASIC_MONTHLY,
} from "../fixtures/stripe";
import { setMockProfile, resetMockProfile } from "../mocks/supabase";
import { createSupabaseMock } from "../mocks/supabase-client";

let mockSeniorMode = false;

vi.mock("@/components/theme/theme-provider", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
    resolvedTheme: "light",
    fontSize: "normal",
    setFontSize: vi.fn(),
    seniorMode: mockSeniorMode,
    setSeniorMode: vi.fn((value: boolean) => {
      mockSeniorMode = value;
    }),
  }),
}));

vi.mock("@/components/theme/theme-toggle", () => ({
  ThemeToggle: () => null,
}));

vi.mock("@/components/auth/two-factor-setup", () => ({
  TwoFactorSetup: () => null,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/vault/VaultContext", () => ({
  useVault: () => ({
    isSetUp: false,
    isUnlocked: false,
    masterKey: null,
    setup: vi.fn(),
    unlock: vi.fn(),
    unlockWithRecovery: vi.fn(),
    lock: vi.fn(),
  }),
}));

const { client: einstellungenClient, getUser: einstellungenGetUser, single: einstellungenSingle } = createSupabaseMock()

einstellungenGetUser.mockResolvedValue({
  data: { user: { id: "test-user-id", email: "test@example.com" } },
  error: null,
})
einstellungenSingle.mockImplementation(async () => {
  const { mockProfileData } = await import("../mocks/supabase-state")
  return { data: mockProfileData, error: null }
})

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => einstellungenClient,
}));

describe("Einstellungen Tier Display", () => {
  beforeEach(() => {
    resetMockProfile();
    mockSeniorMode = false;
  });

  it("shows current tier name", async () => {
    setMockProfile({
      subscription_status: "active",
      stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY,
      storage_used: 26214400,
    } as any);

    render(<EinstellungenPage />);

    await screen.findByText("Einstellungen");
    await waitFor(() => {
      expect(
        screen.getAllByText(/Basis|Premium|Kostenlos/).length,
      ).toBeGreaterThan(0);
    });
  });

  it("shows storage usage progress", async () => {
    setMockProfile({
      subscription_status: "active",
      stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY,
      storage_used: 26214400,
    } as any);

    render(<EinstellungenPage />);

    await screen.findByText("Speicherplatz");
    expect(screen.getByText("5.0%")).toBeInTheDocument();
  });

  it("shows tier limits and upgrade prompts for free/basic users", async () => {
    setMockProfile({
      subscription_status: null,
      stripe_price_id: null,
      storage_used: 1048576,
    } as any);

    render(<EinstellungenPage />);

    await screen.findByText("Speicherplatz");
    expect(screen.getByText(/verfügbar/i)).toBeInTheDocument();
    expect(screen.getByText(/Upgrade/i)).toBeInTheDocument();
  });

  it("shows premium badge for premium users", async () => {
    setMockProfile({
      subscription_status: "active",
      stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY,
      storage_used: 1048576,
    } as any);

    render(<EinstellungenPage />);

    await screen.findByText("Einstellungen");
    expect(screen.getByText("Premium")).toBeInTheDocument();
  });

  it("renders tier badge and upgrade prompt in the senior payment card", async () => {
    mockSeniorMode = true;
    setMockProfile({
      subscription_status: null,
      stripe_price_id: null,
      storage_used: 1048576,
    } as any);

    render(<EinstellungenPage />);

    await screen.findByText("Zahlung & Tarif");
    expect(screen.getByText("Kostenlos")).toBeInTheDocument();

    const pricingLink = screen.getByRole("link", { name: /Zahlung & Tarif/i });
    expect(pricingLink).toHaveAttribute("href", "/abo");
  });

  it("shows tier limits and storage progress details for basic users", async () => {
    setMockProfile({
      subscription_status: "active",
      stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY,
      storage_used: 125 * 1024 * 1024,
    } as any);

    render(<EinstellungenPage />);

    await screen.findByText("Speicherplatz");
    expect(screen.getByText("125.0 MB verwendet")).toBeInTheDocument();
    expect(
      screen.getByText(/von 500 MB verfügbar \(Basis\)/),
    ).toBeInTheDocument();
    expect(screen.getByText("25.0%")).toBeInTheDocument();
  });

  it("updates tier info after subscription changes", async () => {
    setMockProfile({
      subscription_status: "active",
      stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY,
      storage_used: 1048576,
    } as any);

    const { rerender } = render(<EinstellungenPage />);

    await screen.findByText("Einstellungen");

    setMockProfile({
      subscription_status: "active",
      stripe_price_id: STRIPE_PRICE_PREMIUM_MONTHLY,
      storage_used: 1048576,
    } as any);

    rerender(<EinstellungenPage />);

    await waitFor(() => {
      expect(screen.getByText("Premium")).toBeInTheDocument();
    });
  });

  it("renders security activity after storage info", async () => {
    setMockProfile({
      subscription_status: "active",
      stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY,
      storage_used: 1048576,
    } as any);

    render(<EinstellungenPage />);

    await screen.findByText("Speicherplatz");

    const headings = screen.getAllByRole("heading");
    const storageIndex = headings.findIndex(
      (heading) => heading.textContent?.includes("Speicherplatz"),
    );
    const datenschutzIndex = headings.findIndex(
      (heading) => heading.textContent?.includes("Datenschutz"),
    );
    const securityIndex = headings.findIndex(
      (heading) => heading.textContent?.includes("Sicherheit & Aktivität"),
    );

    expect(storageIndex).toBeGreaterThan(-1);
    expect(datenschutzIndex).toBeGreaterThan(-1);
    expect(securityIndex).toBeGreaterThan(-1);
    expect(storageIndex).toBeLessThan(datenschutzIndex);
    expect(datenschutzIndex).toBeLessThan(securityIndex);
    expect(securityIndex).toBeGreaterThan(storageIndex);
  });

  it("renders Datenschutz card between Speicherplatz and Sicherheit & Aktivität", async () => {
    setMockProfile({
      subscription_status: "active",
      stripe_price_id: STRIPE_PRICE_BASIC_MONTHLY,
      storage_used: 1048576,
    } as any);

    render(<EinstellungenPage />);

    await screen.findByText("Speicherplatz");

    const headings = screen.getAllByRole("heading");
    const storageIndex = headings.findIndex(
      (heading) => heading.textContent?.includes("Speicherplatz"),
    );
    const datenschutzIndex = headings.findIndex(
      (heading) => heading.textContent?.includes("Datenschutz"),
    );
    const securityIndex = headings.findIndex(
      (heading) => heading.textContent?.includes("Sicherheit & Aktivität"),
    );

    expect(datenschutzIndex).toBeGreaterThan(storageIndex);
    expect(datenschutzIndex).toBeLessThan(securityIndex);
  });
});
