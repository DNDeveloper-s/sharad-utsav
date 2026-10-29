import { quoteBooking } from "@/domain/quote";
import { parseBookingRequest } from "@/server/booking-schema";
import { loadQuoteContext } from "@/server/bookings";
import { getDb } from "@/server/db";
import { errorResponse, readJson } from "@/server/http";
import { presentQuote, withMessage } from "@/server/messages";

// The live price while the family fills in the form. Saves nothing.
export async function POST(request: Request) {
  const parsed = parseBookingRequest(await readJson(request));
  if (!parsed.ok) {
    return errorResponse(400, "INVALID_REQUEST", "Please check the highlighted fields.", {
      issues: parsed.error.map(withMessage),
    });
  }

  const quote = quoteBooking(parsed.value, await loadQuoteContext(getDb(), new Date()));
  return Response.json(presentQuote(quote));
}
