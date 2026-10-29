# Test cases

The situations I thought were worth checking, and what the app does in each.
"Checked by" says how I know: a unit test (`pnpm test`), a test against the in-memory database, a check by hand in the browser, or "not checked yet".

## Ages

| Case | What the app does | Checked by |
|---|---|---|
| Age 4, 5, 11, 12 | Under 5 is free, 5 to 11 is a child, 12 and up is an adult | unit test |
| Date of birth in the future | Refused: "This date of birth is in the future." | unit test |
| Date of birth over 120 years ago | Refused as a probable typo. Exactly 120 is allowed. | unit test |
| `2026-02-30`, `2026-13-01`, `12/03/1994`, empty | Refused: "Please enter a real date of birth." | unit test |
| 29 Feb birthday in a year with no 29 Feb | Gets older on 1 Mar | unit test |
| Birthday during the festival (turns 12 on 12 Nov) | Still a child all week. Age is counted on 10 Nov. | unit test |
| Baby born after the festival started | Age 0, not minus 1 | unit test |
| Booker turns 18 tomorrow | Refused. Turned 18 today or yesterday is fine. | unit test |
| Booker is 18 on the festival start but not today | Refused. The booker is measured on the booking day. | unit test |
| Adult ticket for a 7-year-old | Cannot be asked. The browser never says adult or child. | by design (the request has no such field) |
| Nobody in the group is 18 or more | Refused: "At least one person coming needs to be 18 or older." | unit test |

## Tickets and days

| Case | What the app does | Checked by |
|---|---|---|
| Child under 5 with a ticket | Refused. No ticket needed. | unit test |
| Child under 5 with dinner or Garba | Refused. They share a parent's plate. | unit test |
| Person aged 5 or more with no ticket | Refused: "Everyone aged 5 or older needs a ticket." | unit test |
| Day Pass for 3 days | Price is 3 times the day price. It uses one unit of stock. | unit test |
| All-Day Pass, adult (sold out) | "Sold out". Adults can pick 5 Day Passes instead. | unit test |
| All-Day Pass after day 1 started | Refused. Day Passes still work. | unit test |
| A day that has started (Texas time) | Refused: "Booking for Wed 11 Nov has closed." | unit test |
| Midnight in UTC, still the day before in Texas | Counts as the day before | unit test |
| Day Pass with no days chosen | Refused by TypeScript and by the server | compile error, unit test |
| Same day picked twice | Refused, so nothing is charged twice | unit test |
| A day outside 10 to 14 Nov | Refused | unit test |

## Family Pass

| Case | What the app does | Checked by |
|---|---|---|
| 2 adults + 2 children | Allowed. $40 once. | unit test |
| 3 adults, or 3 children | Refused: "A Family Pass covers up to 2 adults." | unit test |
| Children only | Refused. It needs an adult (12 or older). | unit test |
| A pass that nobody is on | Refused | unit test |
| A toddler on the pass | Takes no place | unit test |
| Day Passes would cost less ($38 vs $40) | Shown as a hint. The choice is not changed. | unit test |
| KIDSFREE with a Family Pass | The Family Pass price does not change | unit test |

## Extras

| Case | What the app does | Checked by |
|---|---|---|
| Garba on 12 Nov | Refused. It only runs on 11 and 13 Nov. | unit test |
| Dinner on a day the person has no ticket for | Refused | unit test |
| Garba: 3 places asked, 2 left | "Only 2 left of Garba Workshop." | unit test |
| Garba: last 2 places sold, then another family | "Sold out" | database test |
| Two families shown the last place, both press reserve | One gets it. The other gets "sold out" and keeps nothing. | database test. **Not tested with two real connections.** |
| Dandiya quantity -1, 2.5 or 21 | Refused | unit test |

## Promo codes

| Case | What the app does | Checked by |
|---|---|---|
| `seva10` or ` SEVA10 ` | Works. Letter case and spaces do not matter. | unit test |
| SEVA10 | 10% off everything, rounded to the cent | unit test |
| FLAT20 on a $15 booking | Total is $0, not minus $5. The booking confirms straight away. | unit test, database test |
| KIDSFREE | Frees child Day Passes and child All-Day Passes only | unit test |
| KIDSFREE with no child tickets | Accepted, says it did nothing | unit test |
| EXPIRED5 | "EXPIRED5 has expired." The booking is blocked until it is removed. | unit test |
| MAXEDOUT | "...has been used as many times as it can be." | unit test, database test |
| `HELLO` | "We don't recognise that code." | unit test |
| A promo use held by an unpaid booking that expires | The use is given back | database test |

## Money

| Case | What the app does | Checked by |
|---|---|---|
| Decimals like 0.1 + 0.2 | All money is whole cents, so `$146.70000000000002` cannot happen | unit test |
| The browser sends a price | Ignored. The server prices everything. | unit test |
| A discount bigger than the booking | The total stops at $0 | unit test |
| The sample family from DESIGN.md | $187.00, and $168.30 with SEVA10 | unit test |

## Booking, payment and holds

| Case | What the app does | Checked by |
|---|---|---|
| Reserve twice with the same `Idempotency-Key` | Same booking back, stock taken once | database test |
| Reserve with no `Idempotency-Key` | 400 | read in the code only. **Not tested.** |
| Pay twice | The second one does nothing | database test |
| Pay after the 15 minutes | Refused. The hold is released as expired. | database test |
| Declined payment | Stock and promo use are given back | database test |
| Pay a booking that already failed | Refused. Nothing is brought back. | database test |
| Cancel an unpaid booking | Everything is given back, once | database test |
| Cancel a paid booking | Refused (no refunds in this version) | database test |
| Unknown or badly formed booking id | Not found | database test |
| Holds older than 15 minutes | Released by the scheduler, and before every new booking | database test. **The cron job on production is not checked yet.** |
| A booking made at 9am still there at 9pm | It is saved in Postgres, not in memory | by design. **Not checked on the live site yet.** |

## The screen

| Case | What the app does | Checked by |
|---|---|---|
| Fill the 4 steps, reserve, pay | Goes to the confirmation page | by hand, on a Neon dev database |
| Booker under 18 | Stopped on step 1 with a message | unit test (age check) |
| Remove a person | The list stays right, and errors still point at the right person | unit test (form reducer) |
| Change the booking after reserving | "Change my booking" gives the held tickets back first | **not checked yet** |
| Countdown reaches zero | Should say the hold ended | **not checked yet** |
| "Test a failed payment" button | Should show the message and let the family try again | **not checked yet** |
| Family Pass, end to end | Should reserve, pay and confirm | **not checked yet** |
| Phone width | Should work | **not checked yet** |
| Network goes away while the price loads | Shows "We couldn't work out your price" | unit test (API client). **Not tried on the live site.** |
| Refresh in the middle of checkout | The form is lost. The tickets stay held for 15 minutes. | known gap (see README) |

## Cases I did not think of, or left out

- A booking for more than 20 people. It is refused, but I am not sure 20 is the right limit.
- A third adult who wants to join the Family Pass on the same day. They need a second pass, which I do not support.
- Peak traffic. I did not do any load test.
