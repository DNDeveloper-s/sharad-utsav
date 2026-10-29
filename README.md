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

## Status

The rules, prices, database and API are built and tested. The booking screen is next.
