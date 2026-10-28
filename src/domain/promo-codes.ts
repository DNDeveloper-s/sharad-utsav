import { cents, type Cents } from "./money";
import type { CalendarDate } from "./types";

// What a promo code does to a booking. Only the shape is here.
// The maths (how 10% is worked out, what happens to the Family Pass) comes later.
export type PromoEffect =
  | { type: "percent-off-booking"; percent: number }
  | { type: "amount-off-booking"; amount: Cents }
  | { type: "free-child-tickets" }; // only stand-alone child tickets, not the Family Pass

export type PromoCode = {
  code: string; // always capitals. What the person types is matched ignoring case.
  effect: PromoEffect;
  validUntil: CalendarDate | null; // last day it works. null means it never expires.
  maxUses: number | null; // null means unlimited
  startingUsedCount: number; // how many uses are already taken when we fill the database
};

// The brief only says EXPIRED5 and MAXEDOUT are real codes that cannot be used,
// so what they would have given does not matter. I gave them simple values.
export const PROMO_CODES: readonly PromoCode[] = [
  {
    code: "SEVA10",
    effect: { type: "percent-off-booking", percent: 10 },
    validUntil: null,
    maxUses: null,
    startingUsedCount: 0,
  },
  {
    code: "FLAT20",
    effect: { type: "amount-off-booking", amount: cents(2000) },
    validUntil: null,
    maxUses: null,
    startingUsedCount: 0,
  },
  {
    code: "KIDSFREE",
    effect: { type: "free-child-tickets" },
    validUntil: null,
    maxUses: null,
    startingUsedCount: 0,
  },
  {
    code: "EXPIRED5",
    effect: { type: "percent-off-booking", percent: 5 },
    validUntil: "2026-09-30", // ended last month
    maxUses: null,
    startingUsedCount: 0,
  },
  {
    code: "MAXEDOUT",
    effect: { type: "amount-off-booking", amount: cents(1000) },
    validUntil: null,
    maxUses: 100,
    startingUsedCount: 100, // every use is already taken
  },
];
