import { cancelBooking } from "@/server/booking-status";
import { getDb } from "@/server/db";
import { errorResponse } from "@/server/http";

// Called when the family goes back to edit before paying, so their old hold
// doesn't block anyone (or their own new booking) from the last places.
export async function POST(_request: Request, context: RouteContext<"/api/bookings/[id]/cancel">) {
  const { id } = await context.params;
  const result = await cancelBooking(getDb(), id);
  switch (result.kind) {
    case "cancelled":
      return Response.json({ status: "cancelled" });
    case "not-found":
      return errorResponse(404, "BOOKING_NOT_FOUND", "We couldn't find that booking.");
    case "not-cancellable":
      return errorResponse(409, "BOOKING_CLOSED", "This booking can't be cancelled here.");
  }
}
