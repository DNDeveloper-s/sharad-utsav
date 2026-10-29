# Sharad Utsav 2026 — Festival Booking

Live site: https://sharad-utsav-three.vercel.app/

A booking page for the Sharad Utsav festival (10–14 Nov 2026, Radha Krishna Temple, Allen, Texas).
The plan and the reasons behind it are in [DESIGN.md](DESIGN.md).

## Run it locally

You need Node 20 or newer, pnpm, and a Postgres database (a free [Neon](https://neon.tech) database is fine).

1. Copy `.env.example` to `.env.local` and fill in the values (see below).
2. Create the tables and the starting stock. Both files are safe to run more than once:

   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   ```

   ```bash
   psql "$DATABASE_URL" -f db/seed.sql
   ```

   (Or paste the two files into the Neon SQL editor.)
3. Start the app:

   ```bash
   pnpm install
   ```

   ```bash
   pnpm dev
   ```

   Then open http://localhost:3000.

The tests don't need a database: they use an in-memory Postgres (PGlite) with the same `schema.sql` and `seed.sql`.

## Environment variables

Set these in `.env.local` for local work, and in Vercel under Project → Settings → Environment Variables.

| Name | What it is for |
|---|---|
| `DATABASE_URL` | The Postgres connection string. On Vercel use Neon's **pooled** connection string. Use a different Neon branch for Preview and Production, so testing a preview can't use up real stock. |
| `CRON_SECRET` | A long random string. The scheduler sends it to `/api/jobs/release-holds`, so nobody else can call that route. |

## Useful commands

| Command | What it does |
|---|---|
| `pnpm dev` | Start the app in development |
| `pnpm build` | Make the production build (the same one Vercel runs) |
| `pnpm test` | Run the tests once |
| `pnpm typecheck` | Check the TypeScript types |
| `pnpm lint` | Check the code style |

## API

All money is in whole cents (`1500` is $15.00). The server works out every price itself; it never takes a price from the browser.

| Method | Path | Sends | Gets back |
|---|---|---|---|
| GET | `/api/catalog` | — | `festival`, `days` (with labels), `products` (price in cents, live `remaining`) |
| POST | `/api/quote` | a booking request (below) | `bookable`, `issues[]`, `lines[]`, `subtotal`, `discount`, `total`, `promo`, `hints[]`. Saves nothing. |
| POST | `/api/bookings` | a booking request + `Idempotency-Key` header | `201` `{ bookingId, status, total, expiresAt }`. The same key again gives `200` and the same booking. |
| POST | `/api/bookings/{id}/payment` | `{ "outcome": "success" \| "decline" }` (simulated payment) | `{ status: "confirmed" }` or `{ status: "payment_failed", message }` |
| POST | `/api/bookings/{id}/cancel` | — | `{ status: "cancelled" }`. Gives the held tickets back. |
| GET | `/api/bookings/{id}` | — | the confirmation: booker, people with age band and days, lines, totals, status |
| POST | `/api/jobs/release-holds` | `Authorization: Bearer <CRON_SECRET>` | `{ released }`: how many unpaid bookings older than 15 minutes were let go |

**A booking request:**

```json
{
  "booker": { "fullName": "Saurabh", "email": "saurabh@example.com", "phone": "+1 214 555 0100", "dateOfBirth": "1994-03-12" },
  "attendees": [
    { "id": "a1", "fullName": "Saurabh", "dateOfBirth": "1994-03-12", "entry": { "type": "family-pass", "familyPassId": "fp1" }, "dinnerDays": ["2026-11-11"], "garbaDays": [] },
    { "id": "a2", "fullName": "Harsh", "dateOfBirth": "2015-06-15", "entry": { "type": "family-pass", "familyPassId": "fp1" }, "dinnerDays": [], "garbaDays": [] },
    { "id": "a3", "fullName": "Suraj", "dateOfBirth": "1998-01-05", "entry": { "type": "day-pass", "days": ["2026-11-11", "2026-11-12"] }, "dinnerDays": [], "garbaDays": [] },
    { "id": "a4", "fullName": "Samskriti", "dateOfBirth": "2023-04-20", "entry": { "type": "none" }, "dinnerDays": [], "garbaDays": [] }
  ],
  "familyPasses": [{ "id": "fp1", "day": "2026-11-11" }],
  "dandiyaPairs": 2,
  "promoCode": "SEVA10"
}
```

There is no "adult" or "child" in the request: the server works it out from the date of birth.

**Errors** always look like `{ "error": { "code", "message", "issues"? } }`. Each issue is `{ code, field, message, params? }`, and `field` names the person by their id, like `attendees.a3.dateOfBirth`.

| Status | When |
|---|---|
| 400 | The request isn't well formed (`INVALID_REQUEST`, `IDEMPOTENCY_KEY_REQUIRED`) |
| 401 | The scheduler route was called without the right secret |
| 404 | No booking with that id |
| 409 | Someone took the last place first (`SOLD_OUT`), the promo code ran out (`PROMO_USED_UP`), the 15 minutes ran out (`BOOKING_EXPIRED`), or the booking is already closed (`BOOKING_CLOSED`) |
| 422 | The booking breaks a festival rule (`BOOKING_NOT_ALLOWED`). The body includes the full quote with every issue. |

## Holding tickets while people pay

Creating a booking takes the stock (and the promo use, for codes with a limit) straight away, in one database transaction, and holds it for 15 minutes. It is given back if the payment is declined, the booking is cancelled, or the time runs out. An outside scheduler (cron-job.org) calls `/api/jobs/release-holds` every 5 minutes, and every new booking also clears old holds first, so stock is right even if the scheduler is late.

## Decisions I made

The brief left some cases open. This is what I decided, and why. The longer thinking is in [DESIGN.md](DESIGN.md), which I did not change after I started.

| Case | What the app does | Why |
|---|---|---|
| **Children under 5** | They are on the list at $0. No ticket, no days, no extras. They do not take a Family Pass place. | The brief says free and no ticket. The door still needs to know who is inside. They share a parent's plate, so no dinner. If the committee disagrees, it is one rule. |
| **A family that does not fit 2 adults + 2 children** | The Family Pass is refused if it has a 3rd adult or 3rd child. The others buy Day Passes. If Day Passes would be cheaper than the pass, the quote says so. | I do not want to change what a person chose without telling them. A hint is enough. |
| **All-Day Pass after day 1 starts** | Not sold. Day Passes still are. | "All 5 days" is not true any more, and I do not want to charge for days that are gone. |
| **A birthday during the festival** | Age is counted on 10 Nov for the whole week. | One person gets one ticket type for the whole festival. It is simple and a bit generous. |
| **A day that already started** | It cannot be booked. "Now" is the time in Texas (America/Chicago). | Simple, and the time zone cannot move the day by mistake. |
| **Dinner or Garba on a day the person is not coming** | Refused. Garba is only on 11 and 13 Nov. | You cannot eat dinner at a festival you did not attend. |
| **KIDSFREE** | Only frees a child's own Day Pass or All-Day Pass. Not the Family Pass, not a child's dinner. With no child tickets it is accepted but says it did nothing. | The Family Pass is one flat price. There is no child part to take off. |
| **Promo codes** | One per booking, any letter case. FLAT20 never takes the total below $0. A code that is expired or used up blocks the booking until it is fixed or removed. | A silent full price would surprise the person. |
| **Garba "2 left"** | 2 places in total, not 2 per day. | Selling a workshop twice is worse than selling too few. |
| **Day Pass stock** | One unit per person, however many days. | "380 left" reads like a ticket count. |
| **Booker under 18** | Not allowed, even to book for younger brothers or sisters. | The brief says the person paying must be 18 or more. It feels strict, but I follow the brief. |
| **The same person twice** | Same name and same date of birth is refused. Twins have different names, so they are fine. | It is almost surely a click mistake. |
| **Who is an adult or a child** | Only the server decides, from the date of birth. | Nobody can ask for an adult ticket for a 7-year-old. |
| **Stock and holds** | Stock and promo use are taken when the booking is created and held for 15 minutes. | If I waited for payment, two people could both pay for the last place. |
| **Clicking Pay or Reserve twice** | Same `Idempotency-Key`, same booking. Pay on a paid booking changes nothing. | A double click must never charge or book twice. |
| **A total of $0** | Confirmed straight away, with no hold. | Nothing to pay, so nothing to wait for. |

## What is unfinished

Stated plainly.

- **Payment is fake.** There is a "Pay" and a "Test a failed payment" button. No Stripe, no emails, no refunds. A paid booking cannot be cancelled.
- **Two people booking the last place at the same moment** is protected by one database update, but I have only tested it on a single in-memory connection. I did not run a real two-at-once test on Neon.
- **No automated browser tests.** I checked the happy path by hand (reserve, countdown, pay, confirmation). I have not yet tested decline, cancel, the countdown reaching zero, a Family Pass payment, or a phone layout by hand on the live site.
- **A refresh loses the form and the hold.** The tickets are still held for 15 minutes, but the page forgets the booking.
- **Errors are one list at the top of the step**, not next to each field.
- **The quote endpoint answers 400 while the form is still empty.** It shows as red in the browser console. It does no harm.
- **Stock is not shown on the form.** The quote says "sold out" or "only 2 left" after you choose.
- **One Family Pass per day per booking.** Three adults or three children on the same day get an error and must use Day Passes for some people.
- **Per-day capacity, same-day booking, proof of age and an admin screen** are not built. They are in DESIGN.md under "Not doing".
- **I have not done a full accessibility check.** Labels and the keyboard work, but I did not test with a screen reader.
