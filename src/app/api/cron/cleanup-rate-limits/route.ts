import { NextResponse } from "next/server";
import { cleanupExpiredLimits } from "@/lib/security/rate-limit";

// Validate required environment variables at module load
const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET) {
  console.error("[CRON] CRITICAL: CRON_SECRET not configured");
}

export async function GET(request: Request) {
  // Fail-closed: CRON_SECRET must be set
  if (!CRON_SECRET) {
    console.error("[CRON] Request rejected: CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Cron endpoint not configured" },
      { status: 500 },
    );
  }

  // Check authorization: either Bearer token or Vercel cron header
  const authHeader = request.headers.get("authorization");
  const vercelCronHeader = request.headers.get("x-vercel-cron");

  const isAuthorizedByBearer = authHeader === `Bearer ${CRON_SECRET}`;
  const isAuthorizedByVercel = vercelCronHeader === "1";

  if (!isAuthorizedByBearer && !isAuthorizedByVercel) {
    console.warn("[CRON] Unauthorized request attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    deleted: 0,
    errors: [] as string[],
  };

  try {
    console.log("[CRON] Starting rate limit cleanup");

    const deleted = await cleanupExpiredLimits();
    results.deleted = deleted;

    console.log(`[CRON] Deleted ${deleted} expired rate limit entries`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (error: any) {
    console.error(`[CRON] Rate limit cleanup failed: ${error.message}`);
    results.errors.push(`Cleanup error: ${error.message}`);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        ...results,
      },
      { status: 500 },
    );
  }
}
