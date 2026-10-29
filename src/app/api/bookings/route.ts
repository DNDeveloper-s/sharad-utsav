import { PRODUCTS } from "@/domain/catalog";
import { releaseExpiredHolds } from "@/server/booking-status";
import { createBooking } from "@/server/bookings";
import { getDb } from "@/server/db";
import { errorResponse, readJson } from "@/server/http";
import { presentQuote, withMessage } from "@/server/messages";

// Creates the booking and holds its tickets for 15 minutes while they pay.
// The page makes one Idempotency-Key per checkout, so a double click is safe.
export async function POST(request: Request) {
  const key = request.headers.get("Idempotency-Key")?.trim() ?? "";
  if (key === "" || key.length > 100) {
    return errorResponse(400, "IDEMPOTENCY_KEY_REQUIRED", "Missing Idempotency-Key header.");
  }

  const db = getDb();
  const now = new Date();
  await releaseExpiredHolds(db, now); // so stock is right even if the scheduler is late

  const result = await createBooking(db, await readJson(request), key, now);
  switch (result.kind) {
    case "created":
      return Response.json(result.booking, { status: result.repeated ? 200 : 201 });
    case "invalid":
      return errorResponse(400, "INVALID_REQUEST", "Please check the highlighted fields.", {
        issues: result.issues.map(withMessage),
      });
    case "not-bookable":
      return errorResponse(422, "BOOKING_NOT_ALLOWED", "This booking can't go ahead yet. Please see the notes below.", {
        quote: presentQuote(result.quote),
      });
    case "sold-out":
      return errorResponse(
        409,
        "SOLD_OUT",
        `Sorry, someone has just booked the last of ${PRODUCTS[result.productId].displayName}. Please change your booking.`,
      );
    case "promo-used-up":
      return errorResponse(409, "PROMO_USED_UP", `${result.code} has just reached its limit. Please remove it and try again.`);
  }
}
