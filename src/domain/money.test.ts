import { describe, expect, it } from "vitest";
import {
  addCents,
  cents,
  formatUsd,
  multiplyCents,
  percentOf,
  subtractCents,
  sumCents,
  ZERO_CENTS,
} from "./money";

describe("cents", () => {
  it("accepts whole amounts, including zero", () => {
    expect(cents(0)).toBe(0);
    expect(cents(1470)).toBe(1470);
  });

  it("refuses decimals, so dollars cannot sneak in", () => {
    expect(() => cents(14.7)).toThrow();
  });

  it("refuses negative and not-a-number values", () => {
    expect(() => cents(-1)).toThrow();
    expect(() => cents(Number.NaN)).toThrow();
    expect(() => cents(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("adding and multiplying", () => {
  it("adds without floating point surprises", () => {
    // In plain dollars, 0.1 + 0.2 is 0.30000000000000004.
    expect(addCents(cents(10), cents(20))).toBe(30);
  });

  it("multiplies a price by a quantity", () => {
    expect(multiplyCents(cents(1470), 10)).toBe(14700);
    expect(multiplyCents(cents(1500), 0)).toBe(0);
  });

  it("refuses a quantity that is not a whole number", () => {
    expect(() => multiplyCents(cents(1500), 1.5)).toThrow();
    expect(() => multiplyCents(cents(1500), -1)).toThrow();
  });

  it("sums a list, and an empty list is zero", () => {
    expect(sumCents([cents(4000), cents(3600), cents(2000), cents(1000)])).toBe(10600);
    expect(sumCents([])).toBe(ZERO_CENTS);
  });
});

describe("subtracting", () => {
  it("subtracts normally", () => {
    expect(subtractCents(cents(10600), cents(1060))).toBe(9540);
  });

  it("throws if the answer would be below zero, because that means a discount bug", () => {
    expect(() => subtractCents(cents(1000), cents(2000))).toThrow();
  });
});

describe("percentOf", () => {
  it("takes 10 percent of a round amount", () => {
    expect(percentOf(cents(10600), 10)).toBe(1060);
  });

  it("rounds half a cent up", () => {
    expect(percentOf(cents(1235), 10)).toBe(124); // 123.5 cents
  });

  it("rounds below half a cent down", () => {
    expect(percentOf(cents(1234), 10)).toBe(123); // 123.4 cents
  });

  it("handles 0 and 100 percent", () => {
    expect(percentOf(cents(5000), 0)).toBe(0);
    expect(percentOf(cents(5000), 100)).toBe(5000);
  });

  it("refuses odd percents", () => {
    expect(() => percentOf(cents(1000), 10.5)).toThrow();
    expect(() => percentOf(cents(1000), -5)).toThrow();
    expect(() => percentOf(cents(1000), 101)).toThrow();
  });
});

describe("formatUsd", () => {
  it("shows dollars with two decimals", () => {
    expect(formatUsd(cents(1470))).toBe("$14.70");
    expect(formatUsd(cents(9540))).toBe("$95.40");
    expect(formatUsd(cents(0))).toBe("$0.00");
  });

  it("adds a thousands separator", () => {
    expect(formatUsd(cents(123450))).toBe("$1,234.50");
  });
});
