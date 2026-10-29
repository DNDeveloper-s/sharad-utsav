import { cents, type Cents } from "./money";
import { FESTIVAL_DAYS, type FestivalDay } from "./festival";
import type { NonEmptyArray } from "./types";

// Everything the temple sells. Each product is described by what it IS
// (who it is for, which days it covers, how it is priced), not by its name.
// That way, renaming a ticket can never break a rule.
//
// Prices live only here on the server side. The browser never sends a price.

// ---------- Entry tickets: a person buys exactly one kind ----------

type EntryProductBase = {
  kind: "entry";
  displayName: string; // only for showing to people, no rule reads it
  unitPrice: Cents;
  startingStock: number; // used once, to fill the database. Live stock is kept in the database.
};

// Pay per person, per day. The person picks which days.
export type DayPassProduct = EntryProductBase & {
  id: "day-pass-adult" | "day-pass-child";
  audience: "adult" | "child";
  validity: "chosen-days";
  pricingBasis: "per-person-per-day";
};

// One flat price, always all 5 days.
export type AllDayPassProduct = EntryProductBase & {
  id: "all-day-pass-adult" | "all-day-pass-child";
  audience: "adult" | "child";
  validity: "all-days";
  pricingBasis: "flat";
};

// One flat price for a group, one single day.
export type FamilyPassProduct = EntryProductBase & {
  id: "family-pass";
  audience: "family";
  validity: "one-day";
  pricingBasis: "flat";
  covers: { maxAdults: number; maxChildren: number };
};

export type EntryProduct = DayPassProduct | AllDayPassProduct | FamilyPassProduct;

// ---------- Extras ----------

type ExtraProductBase = {
  kind: "extra";
  displayName: string;
  unitPrice: Cents;
  startingStock: number;
};

// A souvenir that belongs to the whole booking, not to a day or a person.
export type BookingExtra = ExtraProductBase & {
  id: "dandiya-sticks";
  attachesTo: "booking";
};

// Belongs to one person on one day, and only on the days listed.
export type PersonDayExtra = ExtraProductBase & {
  id: "dinner-plate" | "garba-workshop";
  attachesTo: "person-day";
  availableDays: NonEmptyArray<FestivalDay>;
};

export type ExtraProduct = BookingExtra | PersonDayExtra;

export type Product = EntryProduct | ExtraProduct;
export type ProductId = Product["id"];

// ---------- The actual catalog ----------

// "satisfies" checks that every product has the right shape (and that we
// did not forget one), while TypeScript still remembers each exact value.
export const PRODUCTS = {
  "day-pass-adult": {
    id: "day-pass-adult",
    kind: "entry",
    displayName: "Day Pass – Adult",
    audience: "adult",
    validity: "chosen-days",
    pricingBasis: "per-person-per-day",
    unitPrice: cents(1500),
    startingStock: 380,
  },
  "day-pass-child": {
    id: "day-pass-child",
    kind: "entry",
    displayName: "Day Pass – Child",
    audience: "child",
    validity: "chosen-days",
    pricingBasis: "per-person-per-day",
    unitPrice: cents(800),
    startingStock: 260,
  },
  "all-day-pass-adult": {
    id: "all-day-pass-adult",
    kind: "entry",
    displayName: "All-Day Pass – Adult",
    audience: "adult",
    validity: "all-days",
    pricingBasis: "flat",
    unitPrice: cents(6000),
    startingStock: 0, // sold out on purpose
  },
  "all-day-pass-child": {
    id: "all-day-pass-child",
    kind: "entry",
    displayName: "All-Day Pass – Child",
    audience: "child",
    validity: "all-days",
    pricingBasis: "flat",
    unitPrice: cents(3000),
    startingStock: 140,
  },
  "family-pass": {
    id: "family-pass",
    kind: "entry",
    displayName: "Family Pass",
    audience: "family",
    validity: "one-day",
    pricingBasis: "flat",
    unitPrice: cents(4000),
    startingStock: 95,
    covers: { maxAdults: 2, maxChildren: 2 },
  },
  "dandiya-sticks": {
    id: "dandiya-sticks",
    kind: "extra",
    displayName: "Dandiya Sticks (pair)",
    attachesTo: "booking",
    unitPrice: cents(500),
    startingStock: 900,
  },
  "dinner-plate": {
    id: "dinner-plate",
    kind: "extra",
    displayName: "Dinner Plate",
    attachesTo: "person-day",
    availableDays: [...FESTIVAL_DAYS], // every day
    unitPrice: cents(1200),
    startingStock: 1700,
  },
  "garba-workshop": {
    id: "garba-workshop",
    kind: "extra",
    displayName: "Garba Workshop",
    attachesTo: "person-day",
    availableDays: ["2026-11-11", "2026-11-13"], // only these two days
    unitPrice: cents(2000),
    startingStock: 2, // almost sold out on purpose
  },
} satisfies Record<ProductId, Product>;

// For ids read from outside, like a database row.
export function isProductId(value: string): value is ProductId {
  return value in PRODUCTS;
}

// Builds a value for every product, for example the live stock level of each.
// Listing the ids here means TypeScript complains if a new product is missed.
export function productRecord<T>(valueFor: (id: ProductId) => T): Record<ProductId, T> {
  return {
    "day-pass-adult": valueFor("day-pass-adult"),
    "day-pass-child": valueFor("day-pass-child"),
    "all-day-pass-adult": valueFor("all-day-pass-adult"),
    "all-day-pass-child": valueFor("all-day-pass-child"),
    "family-pass": valueFor("family-pass"),
    "dandiya-sticks": valueFor("dandiya-sticks"),
    "dinner-plate": valueFor("dinner-plate"),
    "garba-workshop": valueFor("garba-workshop"),
  };
}
