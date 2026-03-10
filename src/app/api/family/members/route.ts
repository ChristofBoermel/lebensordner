import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import {
  getTierFromSubscription,
  allowsFamilyDownloads,
  getTierDisplayInfo,
} from "@/lib/subscription-tiers";
import { canTrustedPersonPerformAction } from "@/lib/security/trusted-person-access";
import { emitStructuredError } from "@/lib/errors/structured-logger";
import { resolveAuthenticatedUser } from "@/lib/auth/resolve-authenticated-user";

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

      const [{ data: profiles }, { data: shareRows }] = await Promise.all([
        adminClient
          .from("profiles")
          .select("id, full_name, email, subscription_status, stripe_price_id")
          .in("id", userIds),
        adminClient
          .from("document_share_tokens")
          .select("owner_id, trusted_person_id, document_id, expires_at")
          .in("owner_id", userIds)
          .in("trusted_person_id", incomingLinks.map((link) => link.id))
          .is("revoked_at", null),
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
              viewOnly: tierDisplay.viewOnly,
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
      const { data: shareRows, error: shareError } = await adminClient
        .from("document_share_tokens")
        .select("trusted_person_id, document_id, expires_at")
        .eq("owner_id", user.id)
        .in("trusted_person_id", outgoingLinks.map((link) => link.id))
        .is("revoked_at", null);

      if (shareError) {
        emitStructuredError({
          error_type: "api",
          error_message: `Error fetching outgoing share rows: ${shareError.message}`,
          endpoint: "/api/family/members",
        });
      } else {
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
