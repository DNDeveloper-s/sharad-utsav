import { z } from "zod";
import { bookingStatus, isBookingId, type BookingStatus } from "./bookings";
import type { Db } from "./db";

type ReleaseReason = "payment_failed" | "expired" | "cancelled";

// Gives a waiting booking's stock and promo use back, exactly once.
// Only the request that actually moves the booking out of "pending_payment"
// gives things back. So if a declined payment and the scheduler arrive at the
// same moment, the second one finds nothing to do.
async function release(tx: Db, bookingId: string, reason: ReleaseReason): Promise<boolean> {
  const moved = await tx.query(
    "UPDATE bookings SET status = $2 WHERE id = $1 AND status = 'pending_payment' RETURNING promo_code",
    [bookingId, reason],
  );
  const row = moved.rows[0];
  if (!row) return false;

  await tx.query(
    `UPDATE product_stock AS stock SET remaining = stock.remaining + held.units
     FROM (SELECT product_id, sum(stock_units)::int AS units FROM booking_lines
           WHERE booking_id = $1 GROUP BY product_id) AS held
     WHERE stock.product_id = held.product_id`,
    [bookingId],
  );
  if (typeof row.promo_code === "string") {
    await tx.query("UPDATE promo_usage SET used_count = used_count - 1 WHERE code = $1 AND used_count > 0", [
      row.promo_code,
    ]);
  }
  return true;
}

const lockedRows = z.array(z.object({ status: bookingStatus, expires_at: z.date().nullable() }));

// FOR UPDATE makes a second request for the same booking wait its turn.
async function lockBooking(tx: Db, bookingId: string) {
  const { rows } = await tx.query("SELECT status, expires_at FROM bookings WHERE id = $1 FOR UPDATE", [bookingId]);
  return lockedRows.parse(rows)[0] ?? null;
}

export type PaymentResult =
  | { kind: "paid" }
  | { kind: "declined" }
  | { kind: "expired" }
  | { kind: "not-found" }
  | { kind: "not-payable"; status: BookingStatus };

// Payment is simulated: the page says whether it worked.
export async function payBooking(
  db: Db,
  bookingId: string,
  outcome: "success" | "decline",
  now: Date,
): Promise<PaymentResult> {
  if (!isBookingId(bookingId)) return { kind: "not-found" };

  return db.transaction(async (tx) => {
    const booking = await lockBooking(tx, bookingId);
    if (!booking) return { kind: "not-found" };
    if (booking.status === "confirmed") return { kind: "paid" }; // paying twice is harmless
    if (booking.status !== "pending_payment") return { kind: "not-payable", status: booking.status };

    if (booking.expires_at && booking.expires_at <= now) {
      await release(tx, bookingId, "expired");
      return { kind: "expired" };
    }
    if (outcome === "decline") {
      await release(tx, bookingId, "payment_failed");
      return { kind: "declined" };
    }

    await tx.query("UPDATE bookings SET status = 'confirmed', expires_at = NULL WHERE id = $1", [bookingId]);
    return { kind: "paid" };
  });
}

export type CancelResult = { kind: "cancelled" } | { kind: "not-found" } | { kind: "not-cancellable"; status: BookingStatus };

// For "go back and edit" before paying. Paid bookings can't be cancelled
// here (no refunds in this version).
export async function cancelBooking(db: Db, bookingId: string): Promise<CancelResult> {
  if (!isBookingId(bookingId)) return { kind: "not-found" };

  return db.transaction(async (tx) => {
    const booking = await lockBooking(tx, bookingId);
    if (!booking) return { kind: "not-found" };
    if (booking.status === "cancelled") return { kind: "cancelled" };
    if (await release(tx, bookingId, "cancelled")) return { kind: "cancelled" };
    return { kind: "not-cancellable", status: booking.status };
  });
}

const idRows = z.array(z.object({ id: z.string() }));

// Run by the scheduler every few minutes, and at the start of each new booking.
export async function releaseExpiredHolds(db: Db, now: Date): Promise<number> {
  const { rows } = await db.query(
    "SELECT id FROM bookings WHERE status = 'pending_payment' AND expires_at <= $1",
    [now.toISOString()],
  );

  let released = 0;
  for (const { id } of idRows.parse(rows)) {
    if (await db.transaction((tx) => release(tx, id, "expired"))) released += 1;
  }
  return released;
}
