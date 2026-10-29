import type { BookingRequest } from "./booking";
import type { DateParts } from "./calendar";
import type { ProductId } from "./catalog";
import { subtractCents, sumCents, ZERO_CENTS, type Cents } from "./money";
import { entryProductFor, priceBooking, stockNeeded, type PriceLine } from "./pricing";
import { applyPromo, type PromoOutcome } from "./promo";
import { validateBooking, type BookingIssue, type ValidBooking } from "./validate-booking";

// The page's live price and the final booking both go through this one
// function, so the two can never disagree.

export type QuoteContext = {
  today: DateParts;
  remainingStock: Record<ProductId, number>;
  promoUsedCounts: Record<string, number>;
};

export type StockIssue = {
  code: "STOCK_INSUFFICIENT";
  field: string;
  params: { productId: ProductId; requested: number; remaining: number };
};

export type QuoteHint = {
  code: "FAMILY_PASS_COSTS_MORE";
  familyPassId: string;
  familyPassPrice: Cents;
  dayPassesPrice: Cents;
};

export type Quote = {
  bookable: boolean;
  booking: ValidBooking | null;
  issues: (BookingIssue | StockIssue)[];
  lines: PriceLine[];
  subtotal: Cents;
  discount: Cents;
  total: Cents;
  promo: PromoOutcome;
  hints: QuoteHint[];
};

export function quoteBooking(request: BookingRequest, context: QuoteContext): Quote {
  const checked = validateBooking(request, context.today);
  if (!checked.ok) {
    return {
      bookable: false,
      booking: null,
      issues: checked.error,
      lines: [],
      subtotal: ZERO_CENTS,
      discount: ZERO_CENTS,
      total: ZERO_CENTS,
      promo: { status: "none" }, // checked once the booking itself is valid
      hints: [],
    };
  }

  const booking = checked.value;
  const { lines, subtotal } = priceBooking(booking);
  const issues = checkStock(lines, context.remainingStock);
  const promo = applyPromo(booking.promoCode, lines, subtotal, {
    today: context.today,
    usedCounts: context.promoUsedCounts,
  });
  const discount = promo.status === "applied" ? promo.discount : ZERO_CENTS;

  return {
    // A code that doesn't work blocks the booking until it's fixed or removed.
    // Otherwise the family would pay more than the price they expected.
    bookable: issues.length === 0 && promo.status !== "rejected",
    booking,
    issues,
    lines,
    subtotal,
    discount,
    total: subtractCents(subtotal, discount),
    promo,
    hints: familyPassHints(booking),
  };
}

// An early, friendly warning. The real guarantee is the database update when
// the booking is created, which can't oversell even if two people pay at once.
function checkStock(lines: PriceLine[], remaining: Record<ProductId, number>): StockIssue[] {
  const issues: StockIssue[] = [];
  for (const [productId, requested] of stockNeeded(lines)) {
    if (requested > remaining[productId]) {
      issues.push({
        code: "STOCK_INSUFFICIENT",
        field: `products.${productId}`,
        params: { productId, requested, remaining: remaining[productId] },
      });
    }
  }
  return issues;
}

// Tells the family when Day Passes would cost less than their Family Pass
// (e.g. 2 adults + 1 child: $38 vs $40). We never switch it for them.
function familyPassHints(booking: ValidBooking): QuoteHint[] {
  const familyPassPrice = entryProductFor("one-day", "family").unitPrice;

  return booking.familyPasses.flatMap((pass): QuoteHint[] => {
    const members = booking.attendees.filter(
      (attendee) => attendee.entry.type === "family-pass" && attendee.entry.familyPassId === pass.id,
    );
    const dayPassesPrice = sumCents(
      members.map((member) =>
        member.band === "under-5" ? ZERO_CENTS : entryProductFor("chosen-days", member.band).unitPrice,
      ),
    );

    if (dayPassesPrice >= familyPassPrice) return [];
    return [{ code: "FAMILY_PASS_COSTS_MORE", familyPassId: pass.id, familyPassPrice, dayPassesPrice }];
  });
}
