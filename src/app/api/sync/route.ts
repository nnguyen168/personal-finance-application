import { NextResponse, type NextRequest } from "next/server";
import { syncAll } from "@/lib/sync";

/**
 * Scheduled sync, e.g. from cron every few hours:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<your-app>/api/sync
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await syncAll();
  return NextResponse.json(result, { status: result.errors.length ? 207 : 200 });
}
