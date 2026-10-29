import { z } from "zod";
import { isProductId, PRODUCTS } from "@/domain/catalog";
import { FESTIVAL_DAY_LABELS, isFestivalDay } from "@/domain/festival";
import { bookingStatus, isBookingId } from "./bookings";
import type { Db } from "./db";

// The confirmation. It shows each person's age band, not their date of
// birth: the family knows their birthdays, and the link may get forwarded.

const bookingRows = z.array(
  z.object({
    id: z.string(),
    status: bookingStatus,
    booker_name: z.string(),
    booker_email: z.string(),
    promo_code: z.string().nullable(),
    subtotal_cents: z.number(),
    discount_cents: z.number(),
    total_cents: z.number(),
    expires_at: z.date().nullable(),
  }),
);

const attendeeRows = z.array(
  z.object({
    attendee_id: z.string(),
    full_name: z.string(),
    age_band: z.string(),
    entry_type: z.string(),
    attending_days: z.array(z.string()),
  }),
);

const lineRows = z.array(
  z.object({
    product_id: z.string(),
    attendee_id: z.string().nullable(),
    day: z.string().nullable(),
    quantity: z.number(),
    line_total_cents: z.number(),
  }),
);

const dayLabel = (day: string) => (isFestivalDay(day) ? FESTIVAL_DAY_LABELS[day] : day);
const productName = (id: string) => (isProductId(id) ? PRODUCTS[id].displayName : id);

export async function readBooking(db: Db, bookingId: string) {
  if (!isBookingId(bookingId)) return null;

  const bookingQuery = await db.query(
    `SELECT id, status, booker_name, booker_email, promo_code, subtotal_cents, discount_cents, total_cents, expires_at
     FROM bookings WHERE id = $1`,
    [bookingId],
  );
  const [booking] = bookingRows.parse(bookingQuery.rows);
  if (!booking) return null;

  const attendeeQuery = await db.query(
    `SELECT attendee_id, full_name, age_band, entry_type, attending_days
     FROM attendees WHERE booking_id = $1 ORDER BY attendee_id`,
    [bookingId],
  );
  const lineQuery = await db.query(
    `SELECT product_id, attendee_id, day, quantity, line_total_cents
     FROM booking_lines WHERE booking_id = $1 ORDER BY id`,
    [bookingId],
  );
  const attendees = attendeeRows.parse(attendeeQuery.rows);
  const lines = lineRows.parse(lineQuery.rows);

  return {
    bookingId: booking.id,
    status: booking.status,
    booker: { name: booking.booker_name, email: booking.booker_email },
    attendees: attendees.map((person) => ({
      id: person.attendee_id,
      name: person.full_name,
      ageBand: person.age_band,
      ticket: person.entry_type,
      days: person.attending_days.map(dayLabel),
    })),
    lines: lines.map((line) => ({
      name: productName(line.product_id),
      attendeeId: line.attendee_id,
      day: line.day === null ? null : dayLabel(line.day),
      quantity: line.quantity,
      total: line.line_total_cents,
    })),
    promoCode: booking.promo_code,
    subtotal: booking.subtotal_cents,
    discount: booking.discount_cents,
    total: booking.total_cents,
    expiresAt: booking.expires_at?.toISOString() ?? null,
  };
}
