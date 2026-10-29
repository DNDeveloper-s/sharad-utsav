import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { usd } from "@/booking-ui/format";
import { getDb } from "@/server/db";
import { readBooking } from "@/server/read-booking";

// The link is the only key to this page, so keep it out of search engines.
export const metadata: Metadata = { title: "Your booking | Sharad Utsav 2026", robots: { index: false } };

const TICKET_LABELS: Record<string, string> = {
  "day-pass": "Day Pass",
  "all-day-pass": "All-Day Pass",
  "family-pass": "Family Pass",
  none: "No ticket needed",
};

const HEADINGS: Record<string, string> = {
  confirmed: "You're booked!",
  pending_payment: "Waiting for payment",
  payment_failed: "Payment didn't go through",
  expired: "This booking has expired",
  cancelled: "This booking was cancelled",
};

// Reading params and the database must happen inside Suspense, or the build can't prerender the page shell.
export default function BookingPage(props: PageProps<"/bookings/[id]">) {
  return (
    <Suspense fallback={<p className="px-5 py-10 text-center sm:px-8">Loading your booking…</p>}>
      <Booking params={props.params} />
    </Suspense>
  );
}

async function Booking({ params }: { params: PageProps<"/bookings/[id]">["params"] }) {
  await connection(); // the status changes, so never build this ahead of time
  const { id } = await params;
  const booking = await readBooking(getDb(), id);
  if (!booking) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-10 sm:px-8">
      <h1 className="text-4xl font-semibold sm:text-5xl">{HEADINGS[booking.status] ?? "Your booking"}</h1>

      <section className="space-y-5 rounded-2xl bg-cream p-5 text-primary-text sm:p-6">
        <p>
          Booked by {booking.booker.name}. Show this page, or your booking number, at the door.
          <br />
          <span className="font-mono text-sm break-all">Booking number: {booking.bookingId}</span>
        </p>

        <h2 className="text-2xl font-semibold text-heading">People</h2>
        <ul className="space-y-1">
          {booking.attendees.map((person) => (
            <li key={person.id}>
              <strong>{person.name}</strong> ({person.ageBand.replace("-", " ")}): {TICKET_LABELS[person.ticket] ?? person.ticket}
              {person.days.length > 0 && `, ${person.days.join(", ")}`}
            </li>
          ))}
        </ul>

        <h2 className="text-2xl font-semibold text-heading">What you bought</h2>
        <ul className="divide-y divide-gold/30">
          {booking.lines.map((line, index) => (
            <li key={index} className="flex justify-between gap-4 py-2">
              <span>
                {line.name}
                {line.attendeeId && ` for ${booking.attendees.find((person) => person.id === line.attendeeId)?.name ?? "a guest"}`}
                {line.day && `, ${line.day}`}
                {line.quantity > 1 && ` × ${line.quantity}`}
              </span>
              <span>{usd(line.total)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{usd(booking.subtotal)}</dd>
          </div>
          {booking.discount > 0 && (
            <div className="flex justify-between">
              <dt>Discount{booking.promoCode && ` (${booking.promoCode})`}</dt>
              <dd>-{usd(booking.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-lg font-semibold text-heading">
            <dt>{booking.status === "confirmed" ? "Paid" : "Total"}</dt>
            <dd>{usd(booking.total)}</dd>
          </div>
        </dl>
      </section>

      {booking.status !== "confirmed" && (
        <Link href="/book" className="inline-flex min-h-12 items-center rounded-full bg-primary px-8 font-semibold text-primary-dark hover:bg-bright-gold">
          Book again
        </Link>
      )}
    </main>
  );
}
