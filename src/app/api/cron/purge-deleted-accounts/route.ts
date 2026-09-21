import { NextRequest, NextResponse } from "next/server";
import {
  listExpiredDeletedAccounts,
  purgeDeletedAccount,
} from "@/lib/accountDeletion";

/**
 * Nightly hard delete of accounts whose 14-day undo window has passed.
 * Scheduled by vercel.json; Vercel calls it with `Authorization: Bearer
 * $CRON_SECRET`, so the route is inert until that env var is set on the
 * project. Lives in the app rather than pg_cron because the person's files
 * can only be removed through the Storage API.
 *
 * Each account is handled independently: one failure is logged and left for
 * the next run rather than aborting the batch.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ids = await listExpiredDeletedAccounts();
  let purged = 0;
  const failed: string[] = [];

  for (const id of ids) {
    try {
      if (await purgeDeletedAccount(id)) purged += 1;
    } catch (err) {
      console.error(`purge-deleted-accounts: ${id} failed`, err);
      failed.push(id);
    }
  }

  return NextResponse.json({ expired: ids.length, purged, failed });
}
