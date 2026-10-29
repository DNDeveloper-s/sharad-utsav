import { isProductId, PRODUCTS } from "@/domain/catalog";
import { FESTIVAL_DAY_LABELS, isFestivalDay } from "@/domain/festival";
import { formatUsd, subtractCents } from "@/domain/money";
import type { PromoOutcome } from "@/domain/promo";
import type { Quote, QuoteHint } from "@/domain/quote";
import type { ShapeIssue } from "./booking-schema";

// The rules return codes; this is the one place that turns them into words.
// Short, plain, and saying what to do next. Never blaming the person.

type Params = Record<string, string | number> | undefined;
type IssueCode = Quote["issues"][number]["code"] | ShapeIssue["code"];

function day(params: Params): string {
  const value = params?.day;
  return typeof value === "string" && isFestivalDay(value) ? FESTIVAL_DAY_LABELS[value] : "that day";
}

function productName(params: Params): string {
  const id = params?.productId;
  return typeof id === "string" && isProductId(id) ? PRODUCTS[id].displayName : "This item";
}

const ISSUE_MESSAGES: Record<IssueCode, (params: Params) => string> = {
  // The form
  NAME_INVALID: () => "Please enter a name (up to 100 letters).",
  EMAIL_INVALID: () => "Please enter an email address like name@example.com.",
  PHONE_INVALID: () => "Please enter a phone number with 7 to 15 digits.",
  ATTENDEE_COUNT_INVALID: () => "A booking can have 1 to 20 people.",
  DUPLICATE_ATTENDEE_ID: () => "Something went wrong with the list of people. Please refresh the page.",
  DUPLICATE_DAY: () => "The same day is picked twice.",
  DUPLICATE_FAMILY_PASS_ID: () => "Something went wrong with the Family Passes. Please refresh the page.",
  DANDIYA_QUANTITY_INVALID: () => "Please choose between 0 and 20 pairs.",
  INVALID_FIELD: () => "Please check this field.",

  // Ages
  DOB_INVALID: () => "Please enter a real date of birth.",
  DOB_IN_FUTURE: () => "This date of birth is in the future.",
  DOB_IMPLAUSIBLE: () => "Please check this date of birth. It looks like a typo.",
  BOOKER_UNDER_18: () => "The person paying needs to be 18 or older.",
  NO_ADULT_IN_GROUP: () => "At least one person coming needs to be 18 or older.",
  DUPLICATE_PERSON: () => "This person is already on the list.",

  // Tickets and days
  TICKET_REQUIRED: () => "Everyone aged 5 or older needs a ticket.",
  NO_TICKET_UNDER_5: () => "Children under 5 come free. No ticket needed.",
  NO_EXTRAS_UNDER_5: () => "Children under 5 share a parent's plate, so they don't need dinner or Garba.",
  DAY_ALREADY_STARTED: (p) => `Booking for ${day(p)} has closed.`,
  ALL_DAY_PASS_CLOSED: () => "The All-Day Pass is no longer on sale because the festival has started. Day Passes are still available.",

  // Family Pass
  FAMILY_PASS_NOT_FOUND: () => "This person is on a Family Pass that isn't in the booking.",
  FAMILY_PASS_UNUSED: () => "Nobody is on this Family Pass yet.",
  FAMILY_PASS_NEEDS_ADULT: () => "A Family Pass needs at least one adult (12 or older).",
  FAMILY_PASS_TOO_MANY_ADULTS: (p) => `A Family Pass covers up to ${String(p?.max ?? 2)} adults.`,
  FAMILY_PASS_TOO_MANY_CHILDREN: (p) => `A Family Pass covers up to ${String(p?.max ?? 2)} children.`,

  // Extras and stock
  EXTRA_NOT_OFFERED_THAT_DAY: (p) => `${productName(p)} isn't on ${day(p)}.`,
  EXTRA_NOT_ON_ATTENDING_DAY: (p) => `${productName(p)} on ${day(p)} needs a ticket for that day too.`,
  STOCK_INSUFFICIENT: (p) =>
    p?.remaining === 0 ? `${productName(p)} is sold out.` : `Only ${String(p?.remaining)} left of ${productName(p)}.`,
};

export function withMessage<T extends { code: IssueCode; params?: Params }>(issue: T) {
  return { ...issue, message: ISSUE_MESSAGES[issue.code](issue.params) };
}

export function promoMessage(promo: PromoOutcome): string | null {
  switch (promo.status) {
    case "none":
      return null;
    case "applied":
      return `${promo.code} applied.`;
    case "no-effect":
      return `${promo.code} makes child tickets free, but there are none in this booking.`;
    case "rejected":
      if (promo.reason === "PROMO_EXPIRED") return `${promo.code} has expired.`;
      if (promo.reason === "PROMO_USED_UP") return `${promo.code} has been used as many times as it can be.`;
      return "We don't recognise that code. Please check the spelling.";
  }
}

export function hintMessage(hint: QuoteHint): string {
  const saving = formatUsd(subtractCents(hint.familyPassPrice, hint.dayPassesPrice));
  return `Day Passes would cost ${saving} less than the Family Pass for these people.`;
}

// A quote ready for the browser: every code gets its words, every line its name.
// Money stays in whole cents.
export function presentQuote(quote: Quote) {
  return {
    bookable: quote.bookable,
    issues: quote.issues.map(withMessage),
    lines: quote.lines.map((line) => ({ ...line, name: PRODUCTS[line.productId].displayName })),
    subtotal: quote.subtotal,
    discount: quote.discount,
    total: quote.total,
    promo: { ...quote.promo, message: promoMessage(quote.promo) },
    hints: quote.hints.map((hint) => ({ ...hint, message: hintMessage(hint) })),
  };
}
