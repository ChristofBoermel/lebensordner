import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import {
  getTierFromSubscription,
  allowsFamilyDownloads,
  getTierDisplayInfo,
} from "@/lib/subscription-tiers";
import { canTrustedPersonPerformAction } from "@/lib/security/trusted-person-access";
import { emitStructuredError, emitStructuredWarn } from "@/lib/errors/structured-logger";
import { resolveAuthenticatedUser } from "@/lib/auth/resolve-authenticated-user";
import {
  isLegacyShareTokenSchemaError,
  withLegacyShareTokenDefaults,
} from "@/lib/security/share-token-compat";

const getSupabaseAdmin = () =>
  createClient(
    process.env['SUPABASE_URL']!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

interface FamilyMember {
  id: string;
  name: string;
  email: string;
  relationship: string;
  direction: "incoming" | "outgoing"; // incoming = they added me, outgoing = I added them
  linkedAt: string | null;
  docsCount?: number;
  sharedDocsCount: number;
  hasSharedDocuments: boolean;
  canViewSharedDocuments: boolean;
  canDownloadSharedDocuments: boolean;
  tier?: {
    id: string;
    name: string;
    color: string;
    badge: string;
    canDownload: boolean;
    viewOnly: boolean;
  };
}

type ShareCountRow = {
  owner_id?: string;
  trusted_person_id: string;
  document_id: string;
  expires_at?: string | null;
  revoked_at?: string | null;
};

async function fetchIncomingShareRows(
  adminClient: ReturnType<typeof getSupabaseAdmin>,
  ownerIds: string[],
  trustedPersonIds: string[],
): Promise<ShareCountRow[]> {
  let data: ShareCountRow[] | null = null;
  let error: { message: string; code?: string | null; details?: string | null; hint?: string | null } | null = null;

  {
    const result = await adminClient
      .from("document_share_tokens")
      .select("owner_id, trusted_person_id, document_id, expires_at")
      .in("owner_id", ownerIds)
      .in("trusted_person_id", trustedPersonIds)
      .is("revoked_at", null);

    data = (result.data ?? null) as ShareCountRow[] | null;
    error = result.error;
  }

  if (isLegacyShareTokenSchemaError(error)) {
    emitStructuredWarn({
      event_type: "api",
      event_message: "[Family Members API] Falling back to legacy share-token schema for incoming share counts",
      endpoint: "/api/family/members",
      metadata: {
        operation: "incoming_share_counts",
        code: error?.code ?? null,
        message: error?.message ?? null,
      },
    });

    const legacyResult = await adminClient
      .from("document_share_tokens")
      .select("owner_id, trusted_person_id, document_id")
      .in("owner_id", ownerIds)
      .in("trusted_person_id", trustedPersonIds);

    data = (legacyResult.data ?? null) as ShareCountRow[] | null;
    error = legacyResult.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ShareCountRow[]).map((row) => withLegacyShareTokenDefaults(row));
}

async function fetchOutgoingShareRows(
  adminClient: ReturnType<typeof getSupabaseAdmin>,
  ownerId: string,
  trustedPersonIds: string[],
): Promise<ShareCountRow[]> {
  let data: ShareCountRow[] | null = null;
  let error: { message: string; code?: string | null; details?: string | null; hint?: string | null } | null = null;

  {
    const result = await adminClient
      .from("document_share_tokens")
      .select("trusted_person_id, document_id, expires_at")
      .eq("owner_id", ownerId)
      .in("trusted_person_id", trustedPersonIds)
      .is("revoked_at", null);

    data = (result.data ?? null) as ShareCountRow[] | null;
    error = result.error;
  }

  if (isLegacyShareTokenSchemaError(error)) {
    emitStructuredWarn({
      event_type: "api",
      event_message: "[Family Members API] Falling back to legacy share-token schema for outgoing share counts",
      endpoint: "/api/family/members",
      metadata: {
        operation: "outgoing_share_counts",
        code: error?.code ?? null,
        message: error?.message ?? null,
      },
    });

    const legacyResult = await adminClient
      .from("document_share_tokens")
      .select("trusted_person_id, document_id")
      .eq("owner_id", ownerId)
      .in("trusted_person_id", trustedPersonIds);

    data = (legacyResult.data ?? null) as ShareCountRow[] | null;
    error = legacyResult.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ShareCountRow[]).map((row) => withLegacyShareTokenDefaults(row));
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const user = await resolveAuthenticatedUser(
      supabase,
      request,
      "/api/family/members"
    );

    if (!user) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const adminClient = getSupabaseAdmin();

    // Get people who added me as their trusted person (I can see their documents)
    const { data: incomingLinks, error: inError } = await adminClient
      .from("trusted_persons")
      .select(
        `
        id,
        user_id,
        name,
        relationship,
        access_level,
        invitation_accepted_at
      `,
      )
      .eq("linked_user_id", user.id)
      .eq("invitation_status", "accepted")
      .eq("is_active", true);

    if (inError) {
      emitStructuredError({
        error_type: "api",
        error_message: `Error fetching incoming links: ${inError.message}`,
        endpoint: "/api/family/members",
      });
    }

    // Get profiles and document counts for incoming links in batch
    let incomingMembers: FamilyMember[] = [];
    if (incomingLinks && incomingLinks.length > 0) {
      const userIds = incomingLinks.map((link) => link.user_id);

      const [{ data: profiles }, shareRows] = await Promise.all([
        adminClient
          .from("profiles")
          .select("id, full_name, email, subscription_status, stripe_price_id")
          .in("id", userIds),
        fetchIncomingShareRows(
          adminClient,
          userIds,
          incomingLinks.map((link) => link.id),
        ),
      ]);

      const profileMap = new Map<
        string,
        typeof profiles extends (infer T)[] | null ? T : never
      >();
      for (const p of profiles || []) {
        profileMap.set(p.id, p);
      }

      const activeShareKeys = new Set<string>();
      const nowMs = Date.now();
      for (const row of shareRows || []) {
        const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : null;
        if (expiresAtMs !== null && (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs)) {
          continue;
        }
        activeShareKeys.add(`${row.owner_id}:${row.trusted_person_id}:${row.document_id}`);
      }

      const shareCountMap = new Map<string, number>();
      for (const link of incomingLinks) {
        let count = 0;
        for (const shareKey of activeShareKeys) {
          if (shareKey.startsWith(`${link.user_id}:${link.id}:`)) {
            count += 1;
          }
        }
        shareCountMap.set(link.id, count);
      }

      incomingMembers = incomingLinks
        .map((link) => {
          const profile = profileMap.get(link.user_id);
          if (!profile) return null;

          const ownerTier = getTierFromSubscription(
            profile.subscription_status || null,
            profile.stripe_price_id || null,
          );
          const tierDisplay = getTierDisplayInfo(ownerTier);
          const ownerAllowsView = ownerTier.id !== "free";
          const ownerAllowsDownload = allowsFamilyDownloads(ownerTier);
          const ownerIsViewOnly = ownerTier.id === "free";
          const sharedDocsCount = shareCountMap.get(link.id) ?? 0;
          const hasSharedDocuments = sharedDocsCount > 0;
          const canViewSharedDocuments =
            hasSharedDocuments
            && ownerAllowsView
            && canTrustedPersonPerformAction(link.access_level, "view");
          const canDownloadSharedDocuments =
            hasSharedDocuments
            && ownerAllowsDownload
            && canTrustedPersonPerformAction(link.access_level, "download");

          return {
            id: link.user_id,
            name: profile.full_name || profile.email.split("@")[0],
            email: profile.email,
            relationship: link.relationship,
            direction: "incoming" as const,
            linkedAt: link.invitation_accepted_at,
            docsCount: sharedDocsCount,
            sharedDocsCount,
            hasSharedDocuments,
            canViewSharedDocuments,
            canDownloadSharedDocuments,
            tier: {
              id: ownerTier.id,
              name: tierDisplay.name,
              color: tierDisplay.color,
              badge: tierDisplay.badge,
              canDownload: ownerAllowsDownload,
              viewOnly: ownerIsViewOnly,
            },
          };
        })
        .filter((m) => m !== null) as FamilyMember[];
    }

    // Get people I added as trusted persons who have accepted
    const { data: outgoingLinks, error: outError } = await adminClient
      .from("trusted_persons")
      .select(
        `
        id,
        linked_user_id,
        name,
        email,
        relationship,
        access_level,
        invitation_accepted_at
      `,
      )
      .eq("user_id", user.id)
      .eq("invitation_status", "accepted")
      .eq("is_active", true)
      .not("linked_user_id", "is", null);

    if (outError) {
      emitStructuredError({
        error_type: "api",
        error_message: `Error fetching outgoing links: ${outError.message}`,
        endpoint: "/api/family/members",
      });
    }

      let outgoingShareCountMap = new Map<string, number>();
    if (outgoingLinks && outgoingLinks.length > 0) {
      try {
        const shareRows = await fetchOutgoingShareRows(
          adminClient,
          user.id,
          outgoingLinks.map((link) => link.id),
        );

        const nowMs = Date.now();
        const activeShareKeys = new Set<string>();
        for (const row of shareRows || []) {
          const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : null;
          if (expiresAtMs !== null && (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs)) {
            continue;
          }
          activeShareKeys.add(`${row.trusted_person_id}:${row.document_id}`);
        }

        for (const link of outgoingLinks) {
          let count = 0;
          for (const shareKey of activeShareKeys) {
            if (shareKey.startsWith(`${link.id}:`)) {
              count += 1;
            }
          }
          outgoingShareCountMap.set(link.id, count);
        }
      } catch (error: any) {
        emitStructuredError({
          error_type: "api",
          error_message: `Error fetching outgoing share rows: ${error?.message ?? String(error)}`,
          endpoint: "/api/family/members",
        });
      }
    }

    const outgoingMembers: FamilyMember[] = (outgoingLinks || []).map((link) => {
      const sharedDocsCount = outgoingShareCountMap.get(link.id) ?? 0;
      const hasSharedDocuments = sharedDocsCount > 0;
      return {
        id: link.linked_user_id!,
        name: link.name,
        email: link.email,
        relationship: link.relationship,
        direction: "outgoing" as const,
        linkedAt: link.invitation_accepted_at,
        docsCount: sharedDocsCount,
        sharedDocsCount,
        hasSharedDocuments,
        canViewSharedDocuments:
          hasSharedDocuments && canTrustedPersonPerformAction(link.access_level, "view"),
        canDownloadSharedDocuments:
          hasSharedDocuments && canTrustedPersonPerformAction(link.access_level, "download"),
      };
    });

    // Combine and deduplicate (someone might be both incoming and outgoing)
    const memberMap = new Map<string, FamilyMember>();

    for (const member of [...incomingMembers, ...outgoingMembers]) {
      const existing = memberMap.get(member.id);
      if (!existing) {
        memberMap.set(member.id, member);
      } else if (
        member.direction === "incoming" &&
        existing.direction === "outgoing"
      ) {
        // If they added me as well, mark them as bidirectional (keep incoming as it gives me access)
        memberMap.set(member.id, { ...member, direction: "incoming" });
      }
    }

    const members = Array.from(memberMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "de"),
    );

    return NextResponse.json({ members });
  } catch (error: any) {
    emitStructuredError({
      error_type: "api",
      error_message: `Family members error: ${error?.message ?? String(error)}`,
      endpoint: "/api/family/members",
      stack: error?.stack,
    });
    return NextResponse.json(
      { error: error.message || "Serverfehler" },
      { status: 500 },
    );
  }
}
