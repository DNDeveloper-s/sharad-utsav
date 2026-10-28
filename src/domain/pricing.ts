import type { ValidAttendee } from "./attendee-rules";
import { PRODUCTS, type EntryProduct, type Product, type ProductId } from "./catalog";
import type { FestivalDay } from "./festival";
import { multiplyCents, sumCents, type Cents } from "./money";
import type { ValidBooking } from "./validate-booking";

// Same shape as the booking_lines table, so a saved booking keeps the price
// that was actually paid, even if the catalog price changes later.
export type PriceLine = {
  productId: ProductId;
  attendeeId: string | null;
  familyPassId: string | null;
  day: FestivalDay | null;
  quantity: number;
  unitPrice: Cents;
  total: Cents;
  stockUnits: number;
};

export type PricedBooking = {
  lines: PriceLine[];
  subtotal: Cents;
};

const ALL_PRODUCTS: Product[] = Object.values(PRODUCTS);
const ENTRY_PRODUCTS = ALL_PRODUCTS.filter((product): product is EntryProduct => product.kind === "entry");

// Looks a ticket up by what it is, so renaming "Day Pass – Child" breaks nothing.
export function entryProductFor(
  validity: EntryProduct["validity"],
  audience: EntryProduct["audience"],
): EntryProduct {
  const product = ENTRY_PRODUCTS.find((p) => p.validity === validity && p.audience === audience);
  if (!product) throw new Error(`The catalog has no "${validity}" ticket for "${audience}"`);
  return product;
}

function quantityFor(product: EntryProduct, days: number): number {
  return product.pricingBasis === "per-person-per-day" ? days : 1;
}

function priceLine(
  product: Product,
  quantity: number,
  stockUnits: number,
  where: { attendeeId?: string; familyPassId?: string; day?: FestivalDay },
): PriceLine {
  return {
    productId: product.id,
    attendeeId: where.attendeeId ?? null,
    familyPassId: where.familyPassId ?? null,
    day: where.day ?? null,
    quantity,
    unitPrice: product.unitPrice,
    total: multiplyCents(product.unitPrice, quantity),
    stockUnits,
  };
}

function entryLine(attendee: ValidAttendee): PriceLine | null {
  if (attendee.band === "under-5") return null;

  // `band` was worked out on the server from the date of birth, so the browser
  // has no say in whether someone pays the adult or the child price.
  const { entry, band } = attendee;
  switch (entry.type) {
    case "family-pass":
      return null; // paid once, on the pass
    case "day-pass": {
      const product = entryProductFor("chosen-days", band);
      // One unit of stock per person, however many days they pick.
      return priceLine(product, quantityFor(product, entry.days.length), 1, { attendeeId: attendee.id });
    }
    case "all-day-pass": {
      const product = entryProductFor("all-days", band);
      return priceLine(product, quantityFor(product, 1), 1, { attendeeId: attendee.id });
    }
  }
}

export function priceBooking(booking: ValidBooking): PricedBooking {
  const lines: PriceLine[] = [];

  for (const attendee of booking.attendees) {
    const line = entryLine(attendee);
    if (line) lines.push(line);
  }

  const familyPass = entryProductFor("one-day", "family");
  for (const pass of booking.familyPasses) {
    lines.push(priceLine(familyPass, 1, 1, { familyPassId: pass.id, day: pass.day }));
  }

  for (const attendee of booking.attendees) {
    for (const day of attendee.dinnerDays) {
      lines.push(priceLine(PRODUCTS["dinner-plate"], 1, 1, { attendeeId: attendee.id, day }));
    }
    for (const day of attendee.garbaDays) {
      lines.push(priceLine(PRODUCTS["garba-workshop"], 1, 1, { attendeeId: attendee.id, day }));
    }
  }

  if (booking.dandiyaPairs > 0) {
    const pairs = booking.dandiyaPairs;
    lines.push(priceLine(PRODUCTS["dandiya-sticks"], pairs, pairs, {}));
  }

  return { lines, subtotal: sumCents(lines.map((line) => line.total)) };
}
