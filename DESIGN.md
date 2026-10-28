# Design Note — Sharad Utsav 2026 Booking

_Written 28 Oct 2026, before any code. Not edited afterwards._

## 0. In short

A family books tickets and extras for 5 days, pays, and gets a confirmation the door volunteers can trust. The risk is the rules: ages, ticket types, day-specific extras, promo codes and limited stock all change the amount. So every rule and price lives in one small domain module (no React, no database code), used by the server for both quotes and bookings. The browser only says what the family wants and shows what the server answers.

## 1. Modelling

**Money.** Whole cents everywhere ($14.70 is `1470`), with a `Cents` type. Only the UI shows "$". A % discount is rounded once, to the nearest cent.

**Dates and ages.** Festival days are strings (`"2026-11-10"` to `"2026-11-14"`), typed as a union of those 5. I ask for **date of birth** and measure age on **10 Nov**. Birthdays can fall inside the 5 days, and I want one ticket type per person for the whole week. A volunteer can also check a date of birth against an ID. The cost is more data about kids. The booker must be 18+ on the **booking date**, because they pay now. I compare year, month and day numbers, not JS `Date`, which can show the 9th instead of the 10th in Texas.

**People.** One **booker** (name, email, phone, date of birth) and a list of **attendees** (name, date of birth, optional phone for adults). An "I'm attending too" checkbox saves retyping. Kids have no contact fields, because the booker is their contact.

**Tickets.** Products are described by attributes (days, pricing, audience, stock), not names, so renaming a ticket cannot break a rule. The browser **never sends "adult" or "child"**. It sends the kind of entry (day pass with days, all-day, family pass, or none), and the server decides adult or child from the date of birth. So "adult ticket for a 7-year-old" cannot be requested. The Family Pass belongs to the **booking**, and attendees point to it.

**Extras.** Dinner and Garba belong to an **attendee and a day**, only for people aged 5 or more. Dandiya belongs to the **booking**. Delete a person and their extras go too.

**Stock and promo codes.** Postgres on Neon, because Vercel functions keep no memory between requests. One unit is: a Day Pass per person however many days (*not sure*: real capacity is per day, but "380 left" reads like a ticket count), a Family Pass per pass, a plate per dinner, a seat per Garba place. Creating a booking runs one transaction with `UPDATE … SET remaining = remaining - n WHERE remaining >= n` for every line, and it rolls back if any line fails. A promo code with a maximum use is held the same way (`used_count + 1 … WHERE used_count < max_uses`). I do not wait for payment to count it, because two people could both pass the check and both pay for the last use. Stock and promo use go back if payment fails, the hold ends, or the customer cancels. The release is `UPDATE bookings SET status = 'expired' WHERE id = $1 AND status = 'pending_payment'`. Only the request that changes the row gives things back, so nothing goes back twice.

## 2. Endpoints

| Method | Path | Sends | Gets back |
|---|---|---|---|
| GET | `/api/catalog` | — | event, days, products (price in cents, remaining) |
| POST | `/api/quote` | `BookingRequest` (+ `promoCode`) | `lines[]`, `subtotal`, `discount`, `total`, `promo`, `errors[]`, `hints[]`. Saves nothing. |
| POST | `/api/bookings` | `BookingRequest` + `Idempotency-Key` header | `bookingId` (random UUID), `status`, `total`, `expiresAt` |
| POST | `/api/bookings/:id/payment` | `{ outcome: "success" \| "decline" }` | `status`: `confirmed` / `payment_failed` |
| POST | `/api/bookings/:id/cancel` | — | `status`: `cancelled` |
| GET | `/api/bookings/:id` | — | confirmation: booker, attendees, tickets, extras, amount paid |
| POST | `/api/jobs/release-holds` | secret in a header | number of bookings released |

**Errors:** `{ error: { code, message, field? } }`. 400 is bad input, 422 a broken rule, 409 a stock problem. The domain returns codes, and the API turns them into friendly text.

**Double click:** one idempotency key per checkout attempt, unique in the bookings table. A second request gets the same booking back and takes nothing twice.

**Payment:** simulated only, because I have limited time. One `status` column is enough. Stock and promo use are held for 15 minutes. A $0 booking (FLAT20 on a small order) confirms right away, with no hold. The server always recalculates the quote and never takes an amount from the client.

**Cancel:** if the customer goes back to edit after checkout, the page calls cancel. Without it, their old hold could take the last Garba place and their new booking would say sold out. If they close the tab, the hold just ends.

**Cleanup:** a free outside scheduler (cron-job.org or GitHub Actions) calls `release-holds` every 5 minutes, because the free Vercel cron is too slow. I expect more cleanup jobs later, and one scheduler is cleaner. The booking request also runs the same function first, as a safety net. It is safe to run twice.

**Privacy:** the confirmation shows names and birth dates, so booking ids are random UUIDs that nobody can guess.

## 3. Tricky cases

(price) means it changes what someone pays.

1. **Birthday during the festival** (price): age is fixed on 10 Nov. If Harsh (11 now) turned 12 on 12 Nov, he still pays the child price all week. Generous, but fine for a temple.
2. **Toddlers**: no ticket, but they still come through the door. Samskriti (3) is an attendee at $0, with no days and no extras, and she takes no Family Pass place. A child under 5 eats from a parent's plate. If the committee disagrees, it is one rule to change.
3. **Family does not fit 2+2** (price): my family is 5 adults, Harsh and Samskriti. A Family Pass covers up to 2 adults and 2 children (at least 1 adult, one day). Saurabh, Ayushi and Harsh could take it ($40), and the other three adults buy Day Passes. But those three on Day Passes cost 15 + 15 + 8 = $38, so the quote shows a hint. I do not switch their choice silently.
4. **All-Day Adult sold out**: shown as sold out. Adults can still pick all 5 days with Day Passes ($75).
5. **All-Day Pass after day 1 starts** (price): not sold. It means "all 5 days", and selling it at $60 for 3 remaining days would overcharge ($45 on Day Passes). No special code, because it is the same rule as case 9. Selling at full price would be simpler, but I do not want to charge for days that are gone.
6. **Extras on days not attended**: rejected. Garba is only on 11 and 13 Nov.
7. **Garba "2 left"**: per session or total? Not clear. I use 2 total, because overselling a workshop is worse. I might change this.
8. **Promo codes** (price): one per booking, not case-sensitive, applies to the whole booking including extras.
   - FLAT20: the total cannot go below $0.
   - KIDSFREE: only standalone child tickets (child Day Pass, child All-Day Pass). Not the Family Pass, which is one flat price with no child price inside it. With no child tickets, it is accepted but says it did nothing.
   - EXPIRED5 and MAXEDOUT: each has its own clear message.
   - Codes are checked again when the booking is created, and the use is held then.
9. **Day already started**: cannot be booked (America/Chicago time, with "now" passed in for tests).
10. **No adult at all**: at least one attendee must be 18+.
11. **Nonsense date of birth**: strict `YYYY-MM-DD`, a real date, not in the future, not over 120 years.
12. **29 Feb birthdays**: like any date. In a non-leap year the person gets older on 1 Mar, which comparing month and day numbers does with no special code. It cannot change a result in November, but a test pins it.

**Not decided yet:**
- A 16-year-old booking for younger siblings. The brief says booker is 18+, so no. It feels harsh, but I follow the brief.
- Kids coming on a day when the only adult is not. I leave this to the volunteers.

## 4. Not doing (on purpose)

- Accounts or login. A guest booking with an id is enough.
- Real emails. A confirmation page instead.
- Admin screen for prices and stock. Seeded data.
- Edit or refund after paying.
- Per-day venue capacity.
- Stripe. A real payment would add a payments table and a webhook.
- Proof of age. Date of birth and the volunteer at the door are the check.
