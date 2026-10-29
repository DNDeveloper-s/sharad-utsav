import { getDb } from "@/server/db";
import { errorResponse } from "@/server/http";
import { readBooking } from "@/server/read-booking";

// The confirmation. Anyone with the link can see it, which is why the id is a random UUID.
export async function GET(_request: Request, context: RouteContext<"/api/bookings/[id]">) {
  const { id } = await context.params;
  const booking = await readBooking(getDb(), id);
  if (!booking) return errorResponse(404, "BOOKING_NOT_FOUND", "We couldn't find that booking.");
  return Response.json(booking);
}
