import { z } from "zod";
import { payBooking } from "@/server/booking-status";
import { getDb } from "@/server/db";
import { errorResponse, readJson } from "@/server/http";

const paymentSchema = z.object({ outcome: z.enum(["success", "decline"]) });

// A simulated payment: the page says whether it went through.
export async function POST(request: Request, context: RouteContext<"/api/bookings/[id]/payment">) {
  const { id } = await context.params;
  const parsed = paymentSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return errorResponse(400, "INVALID_REQUEST", 'Send { "outcome": "success" } or { "outcome": "decline" }.');
  }

  const result = await payBooking(getDb(), id, parsed.data.outcome, new Date());
  switch (result.kind) {
    case "paid":
      return Response.json({ status: "confirmed" });
    case "declined":
      return Response.json({
        status: "payment_failed",
        message: "The payment didn't go through, so the tickets were released. Please try booking again.",
      });
    case "expired":
      return errorResponse(409, "BOOKING_EXPIRED", "The 15 minutes to pay ran out, so the tickets were released. Please book again.");
    case "not-found":
      return errorResponse(404, "BOOKING_NOT_FOUND", "We couldn't find that booking.");
    case "not-payable":
      return errorResponse(409, "BOOKING_CLOSED", "This booking can no longer be paid. Please book again.");
  }
}
