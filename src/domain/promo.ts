import { compareDates, mustParseCalendarDate, type DateParts } from "./calendar";
import { PRODUCTS } from "./catalog";
import { cents, percentOf, sumCents, type Cents } from "./money";
import type { PriceLine } from "./pricing";
import { PROMO_CODES, type PromoCode } from "./promo-codes";
import { fail, ok, type Result } from "./result";

export type PromoRejection = "PROMO_NOT_FOUND" | "PROMO_EXPIRED" | "PROMO_USED_UP";

export type PromoOutcome =
  | { status: "none" }
  | { status: "applied"; code: string; discount: Cents }
  | { status: "no-effect"; code: string; reason: "NO_CHILD_TICKETS" }
  | { status: "rejected"; code: string; reason: PromoRejection };

export type PromoContext = {
  today: DateParts;
  // Live counts from the database (including uses held by unpaid bookings).
  // A code that's missing here falls back to its seed count.
  usedCounts: Record<string, number>;
};

export function normalizePromoCode(typed: string): string {
  return typed.trim().toUpperCase();
}

export function findUsablePromo(code: string, context: PromoContext): Result<PromoCode, PromoRejection> {
  const promo = PROMO_CODES.find((candidate) => candidate.code === code);
  if (!promo) return fail("PROMO_NOT_FOUND");

  // validUntil is the last day it works, not the first day it doesn't.
  if (promo.validUntil !== null && compareDates(context.today, mustParseCalendarDate(promo.validUntil)) > 0) {
    return fail("PROMO_EXPIRED");
  }

  const used = context.usedCounts[promo.code] ?? promo.startingUsedCount;
  if (promo.maxUses !== null && used >= promo.maxUses) return fail("PROMO_USED_UP");

  return ok(promo);
}

// KIDSFREE only covers tickets a child holds on their own. The Family Pass is
// one flat price with no child part to take off, and a dinner isn't a ticket.
function isStandaloneChildTicket(line: PriceLine): boolean {
  const product = PRODUCTS[line.productId];
  return product.kind === "entry" && product.audience === "child";
}

function discountFor(promo: PromoCode, lines: PriceLine[], subtotal: Cents): Cents {
  const { effect } = promo;
  switch (effect.type) {
    case "percent-off-booking":
      return percentOf(subtotal, effect.percent);
    case "amount-off-booking":
      return cents(Math.min(effect.amount, subtotal)); // the total stops at $0
    case "free-child-tickets":
      return sumCents(lines.filter(isStandaloneChildTicket).map((line) => line.total));
  }
}

export function applyPromo(
  typedCode: string | null,
  lines: PriceLine[],
  subtotal: Cents,
  context: PromoContext,
): PromoOutcome {
  const code = normalizePromoCode(typedCode ?? "");
  if (code === "") return { status: "none" };

  const found = findUsablePromo(code, context);
  if (!found.ok) return { status: "rejected", code, reason: found.error };
  const promo = found.value;

  if (promo.effect.type === "free-child-tickets" && !lines.some(isStandaloneChildTicket)) {
    return { status: "no-effect", code, reason: "NO_CHILD_TICKETS" };
  }

  return { status: "applied", code, discount: discountFor(promo, lines, subtotal) };
}
