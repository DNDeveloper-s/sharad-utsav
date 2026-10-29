import { randomUUID } from "node:crypto";
import { z } from "zod";
import { todayIn } from "@/domain/calendar";
import { productRecord, type ProductId } from "@/domain/catalog";
import { FESTIVAL_TIME_ZONE } from "@/domain/festival";
import { stockNeeded } from "@/domain/pricing";
import { PROMO_CODES } from "@/domain/promo-codes";
import { quoteBooking, type Quote, type QuoteContext } from "@/domain/quote";
import type { ValidBooking } from "@/domain/validate-booking";
import { parseBookingRequest, type ShapeIssue } from "./booking-schema";
import type { Db } from "./db";

export const HOLD_MINUTES = 15;

export const bookingStatus = z.enum(["pending_payment", "confirmed", "payment_failed", "expired", "cancelled"]);
export type BookingStatus = z.infer<typeof bookingStatus>;

export type BookingSummary = {
  bookingId: string;
  status: BookingStatus;
  total: number;
  expiresAt: string | null;
};

export type CreateBookingResult =
  | { kind: "created"; booking: BookingSummary; repeated: boolean }
  | { kind: "invalid"; issues: ShapeIssue[] }
  | { kind: "not-bookable"; quote: Quote }
  | { kind: "sold-out"; productId: ProductId }
  | { kind: "promo-used-up"; code: string };

// Booking ids are random UUIDs, so nobody can guess someone else's confirmation.
export function isBookingId(value: string): boolean {
  return z.uuid().safeParse(value).success;
}

const stockRows = z.array(z.object({ product_id: z.string(), remaining: z.number() }));
const usageRows = z.array(z.object({ code: z.string(), used_count: z.number() }));

export async function loadQuoteContext(db: Db, now: Date): Promise<QuoteContext> {
  const stock = stockRows.parse((await db.query("SELECT product_id, remaining FROM product_stock")).rows);
  const usage = usageRows.parse((await db.query("SELECT code, used_count FROM promo_usage")).rows);
  const remaining = new Map(stock.map((row) => [row.product_id, row.remaining]));

  return {
    today: todayIn(FESTIVAL_TIME_ZONE, now),
    remainingStock: productRecord((id) => remaining.get(id) ?? 0), // no row means nothing to sell
    promoUsedCounts: Object.fromEntries(usage.map((row) => [row.code, row.used_count])),
  };
}

const summaryRows = z.array(
  z.object({ id: z.string(), status: bookingStatus, total_cents: z.number(), expires_at: z.date().nullable() }),
);

async function findByIdempotencyKey(db: Db, key: string): Promise<BookingSummary | null> {
  const { rows } = await db.query(
    "SELECT id, status, total_cents, expires_at FROM bookings WHERE idempotency_key = $1",
    [key],
  );
  const row = summaryRows.parse(rows)[0];
  if (!row) return null;
  return { bookingId: row.id, status: row.status, total: row.total_cents, expiresAt: row.expires_at?.toISOString() ?? null };
}

// Thrown inside the transaction to undo everything and report why.
class Rollback extends Error {
  constructor(readonly result: CreateBookingResult) {
    super(result.kind);
  }
}

// Two clicks with the same key raced past the first check; the database kept one.
class DuplicateKey extends Error {}

export async function createBooking(
  db: Db,
  body: unknown,
  idempotencyKey: string,
  now: Date,
): Promise<CreateBookingResult> {
  // A second click on Pay sends the same key: hand back the same booking.
  const existing = await findByIdempotencyKey(db, idempotencyKey);
  if (existing) return { kind: "created", booking: existing, repeated: true };

  const parsed = parseBookingRequest(body);
  if (!parsed.ok) return { kind: "invalid", issues: parsed.error };

  // Price it again from our own data. Nothing the browser says about money is used.
  const quote = quoteBooking(parsed.value, await loadQuoteContext(db, now));
  if (!quote.bookable || !quote.booking) return { kind: "not-bookable", quote };
  const booking = quote.booking;

  try {
    const saved = await db.transaction((tx) => saveBooking(tx, quote, booking, idempotencyKey, now));
    return { kind: "created", booking: saved, repeated: false };
  } catch (error) {
    if (error instanceof Rollback) return error.result;
    if (error instanceof DuplicateKey) {
      const winner = await findByIdempotencyKey(db, idempotencyKey);
      if (winner) return { kind: "created", booking: winner, repeated: true };
    }
    throw error;
  }
}

// Saves the booking and takes its stock and promo use, all in one transaction.
// Exported so tests can hand it an out-of-date quote and check the database still says no.
export async function saveBooking(
  tx: Db,
  quote: Quote,
  booking: ValidBooking,
  idempotencyKey: string,
  now: Date,
): Promise<BookingSummary> {
  const bookingId = randomUUID();
  const free = quote.total === 0;
  const status: BookingStatus = free ? "confirmed" : "pending_payment";
  const expiresAt = free ? null : new Date(now.getTime() + HOLD_MINUTES * 60_000);
  const heldPromo = quote.promo.status === "applied" ? quote.promo.code : null;

  const inserted = await tx.query(
    `INSERT INTO bookings (id, idempotency_key, status, booker_name, booker_email, booker_phone, booker_dob,
       promo_code, subtotal_cents, discount_cents, total_cents, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [
      bookingId,
      idempotencyKey,
      status,
      booking.booker.fullName,
      booking.booker.email,
      booking.booker.phone,
      booking.booker.dateOfBirth,
      heldPromo,
      quote.subtotal,
      quote.discount,
      quote.total,
      expiresAt?.toISOString() ?? null,
    ],
  );
  if (inserted.rowCount === 0) throw new DuplicateKey();

  // "remaining >= $2" is what stops two people buying the last Garba place.
  // Postgres makes the second update wait for the first, then checks again.
  for (const [productId, units] of stockNeeded(quote.lines)) {
    const taken = await tx.query(
      "UPDATE product_stock SET remaining = remaining - $2 WHERE product_id = $1 AND remaining >= $2",
      [productId, units],
    );
    if (taken.rowCount === 0) throw new Rollback({ kind: "sold-out", productId });
  }

  if (heldPromo) {
    const limit = PROMO_CODES.find((promo) => promo.code === heldPromo)?.maxUses ?? null;
    const held = await tx.query(
      "UPDATE promo_usage SET used_count = used_count + 1 WHERE code = $1 AND ($2::int IS NULL OR used_count < $2)",
      [heldPromo, limit],
    );
    if (held.rowCount === 0) throw new Rollback({ kind: "promo-used-up", code: heldPromo });
  }

  for (const person of booking.attendees) {
    await tx.query(
      `INSERT INTO attendees (booking_id, attendee_id, full_name, date_of_birth, age_band, entry_type,
         family_pass_id, attending_days, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        bookingId,
        person.id,
        person.fullName,
        person.dateOfBirth,
        person.band,
        person.entry.type,
        person.entry.type === "family-pass" ? person.entry.familyPassId : null,
        person.attendingDays,
        person.phone,
      ],
    );
  }

  for (const line of quote.lines) {
    await tx.query(
      `INSERT INTO booking_lines (booking_id, product_id, attendee_id, family_pass_id, day, quantity,
         unit_price_cents, line_total_cents, stock_units)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [bookingId, line.productId, line.attendeeId, line.familyPassId, line.day, line.quantity, line.unitPrice, line.total, line.stockUnits],
    );
  }

  return { bookingId, status, total: quote.total, expiresAt: expiresAt?.toISOString() ?? null };
}
