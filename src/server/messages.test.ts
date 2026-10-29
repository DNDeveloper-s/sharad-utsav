import { describe, expect, it } from "vitest";
import { cents } from "@/domain/money";
import { hintMessage, promoMessage, withMessage } from "./messages";

describe("friendly messages", () => {
  it("say sold out, or how many are left", () => {
    const soldOut = { code: "STOCK_INSUFFICIENT", field: "x", params: { productId: "all-day-pass-adult", requested: 1, remaining: 0 } } as const;
    const fewLeft = { code: "STOCK_INSUFFICIENT", field: "x", params: { productId: "garba-workshop", requested: 3, remaining: 2 } } as const;
    expect(withMessage(soldOut).message).toBe("All-Day Pass – Adult is sold out.");
    expect(withMessage(fewLeft).message).toBe("Only 2 left of Garba Workshop.");
  });

  it("name the day the way people say it", () => {
    const closed = { code: "DAY_ALREADY_STARTED", field: "x", params: { day: "2026-11-11" } } as const;
    expect(withMessage(closed).message).toBe("Booking for Wed 11 Nov has closed.");
  });

  it("explain each promo outcome", () => {
    expect(promoMessage({ status: "none" })).toBeNull();
    expect(promoMessage({ status: "rejected", code: "EXPIRED5", reason: "PROMO_EXPIRED" })).toBe("EXPIRED5 has expired.");
    expect(promoMessage({ status: "no-effect", code: "KIDSFREE", reason: "NO_CHILD_TICKETS" })).toContain("no");
  });

  it("show the Family Pass saving in dollars", () => {
    const hint = { code: "FAMILY_PASS_COSTS_MORE", familyPassId: "fp1", familyPassPrice: cents(4000), dayPassesPrice: cents(3800) } as const;
    expect(hintMessage(hint)).toBe("Day Passes would cost $2.00 less than the Family Pass for these people.");
  });
});
