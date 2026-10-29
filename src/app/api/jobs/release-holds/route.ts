import { releaseExpiredHolds } from "@/server/booking-status";
import { getDb } from "@/server/db";
import { errorResponse } from "@/server/http";

// Called every 5 minutes by an outside scheduler (cron-job.org), with the secret.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("Authorization") !== `Bearer ${secret}`) {
    return errorResponse(401, "UNAUTHORIZED", "Not allowed.");
  }

  const released = await releaseExpiredHolds(getDb(), new Date());
  return Response.json({ released });
}
