import { describe, expect, it } from "vitest";
import { PRODUCTS } from "./catalog";
import { PROMO_CODES } from "./promo-codes";

// These tests copy the brief's tables, so a typo in a price or in the
// stock numbers is caught here and not by a family at checkout.

describe("catalog", () => {
  it("stores every product under its own id", () => {
    for (const [key, product] of Object.entries(PRODUCTS)) {
      expect(product.id).toBe(key);
    }
  });

  it("has the prices from the brief, in cents", () => {
    expect(PRODUCTS["day-pass-adult"].unitPrice).toBe(1500);
    expect(PRODUCTS["day-pass-child"].unitPrice).toBe(800);
    expect(PRODUCTS["all-day-pass-adult"].unitPrice).toBe(6000);
    expect(PRODUCTS["all-day-pass-child"].unitPrice).toBe(3000);
    expect(PRODUCTS["family-pass"].unitPrice).toBe(4000);
    expect(PRODUCTS["dandiya-sticks"].unitPrice).toBe(500);
    expect(PRODUCTS["dinner-plate"].unitPrice).toBe(1200);
    expect(PRODUCTS["garba-workshop"].unitPrice).toBe(2000);
  });

  it("starts with the stock from the brief", () => {
    expect(PRODUCTS["day-pass-adult"].startingStock).toBe(380);
    expect(PRODUCTS["day-pass-child"].startingStock).toBe(260);
    expect(PRODUCTS["all-day-pass-adult"].startingStock).toBe(0); // sold out
    expect(PRODUCTS["all-day-pass-child"].startingStock).toBe(140);
    expect(PRODUCTS["family-pass"].startingStock).toBe(95);
    expect(PRODUCTS["dandiya-sticks"].startingStock).toBe(900);
    expect(PRODUCTS["dinner-plate"].startingStock).toBe(1700);
    expect(PRODUCTS["garba-workshop"].startingStock).toBe(2); // almost gone
  });

  it("covers 2 adults and 2 children on a Family Pass", () => {
    expect(PRODUCTS["family-pass"].covers).toEqual({ maxAdults: 2, maxChildren: 2 });
  });

  it("runs Garba on 11 and 13 Nov only, and dinner on all five days", () => {
    expect(PRODUCTS["garba-workshop"].availableDays).toEqual(["2026-11-11", "2026-11-13"]);
    expect(PRODUCTS["dinner-plate"].availableDays).toHaveLength(5);
  });
});

describe("promo codes", () => {
  it("has the five codes, each written in capitals and only once", () => {
    const codes = PROMO_CODES.map((promo) => promo.code);
    expect(codes).toEqual(["SEVA10", "FLAT20", "KIDSFREE", "EXPIRED5", "MAXEDOUT"]);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("has EXPIRED5 ended in September and MAXEDOUT with no uses left", () => {
    const expired = PROMO_CODES.find((promo) => promo.code === "EXPIRED5");
    const maxedOut = PROMO_CODES.find((promo) => promo.code === "MAXEDOUT");
    expect(expired?.validUntil).toBe("2026-09-30");
    expect(maxedOut?.startingUsedCount).toBe(maxedOut?.maxUses);
  });
});
