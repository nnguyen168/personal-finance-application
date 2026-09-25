import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/db";
import { requireAuth } from "@/lib/auth";
import { createSession } from "@/lib/bank/enablebanking";
import { syncAccount } from "@/lib/sync";

/** The bank redirects here after she approves access in the CCF app. */
export async function GET(request: NextRequest) {
  await requireAuth();
  const params = request.nextUrl.searchParams;
  const back = (query: string) => NextResponse.redirect(new URL(`/accounts?${query}`, request.url));

  const jar = await cookies();
  const expected = jar.get("hearth_bank_state")?.value;
  jar.delete("hearth_bank_state");

  if (params.get("error")) {
    return back(`bank_error=${encodeURIComponent(params.get("error_description") ?? params.get("error")!)}`);
  }
  const code = params.get("code");
  if (!code || !expected || params.get("state") !== expected) {
    return back("bank_error=The+connection+request+expired.+Please+try+again.");
  }

  try {
    const session = await createSession(code);
    const ids: number[] = [];
    for (const acc of session.accounts) {
      const iban = acc.account_id?.iban ?? acc.account_id?.other?.identification ?? "";
      const values = {
        name: acc.name || acc.product || acc.details || `${session.aspsp.name} account`,
        institution: session.aspsp.name,
        ibanSuffix: iban ? iban.slice(-4) : null,
        currency: acc.currency ?? "EUR",
        provider: "enablebanking",
        externalId: acc.uid,
        sessionId: session.session_id,
        consentExpiresAt: session.access?.valid_until ?? null,
        lastSyncError: null,
      };
      // Re-connecting the same IBAN keeps its history and just refreshes the link.
      const existing = db
        .select()
        .from(schema.accounts)
        .all()
        .find((a) => a.provider === "enablebanking" && a.institution === values.institution && a.ibanSuffix === values.ibanSuffix && !!values.ibanSuffix);
      if (existing) {
        db.update(schema.accounts).set(values).where(eq(schema.accounts.id, existing.id)).run();
        ids.push(existing.id);
      } else {
        const row = db.insert(schema.accounts).values(values).returning({ id: schema.accounts.id }).get();
        ids.push(row.id);
      }
    }
    let added = 0;
    for (const id of ids) added += (await syncAccount(id).catch(() => ({ added: 0 }))).added;
    return back(`connected=${ids.length}&added=${added}`);
  } catch (e) {
    return back(`bank_error=${encodeURIComponent(e instanceof Error ? e.message : String(e))}`);
  }
}
