import { beforeEach, describe, expect, it } from "vitest";
import { myFamilyOn11Nov } from "@/domain/test-builders";
import { cancelBooking, payBooking, releaseExpiredHolds } from "./booking-status";
import { createBooking } from "./bookings";
import type { Db } from "./db";
import { createTestDb } from "./test-db";

const NOW = new Date("2026-10-28T15:00:00Z");
const minutesLater = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

// Books the family with SEVA10 and returns the booking id.
async function bookFamily(key = "key-1"): Promise<string> {
  const result = await createBooking(db, myFamilyOn11Nov({ promoCode: "SEVA10" }), key, NOW);
  if (result.kind !== "created") throw new Error(`could not book: ${result.kind}`);
  return result.booking.bookingId;
}

async function snapshot() {
  const stock = await db.query("SELECT remaining FROM product_stock WHERE product_id = 'family-pass'");
  const uses = await db.query("SELECT used_count FROM promo_usage WHERE code = 'SEVA10'");
  return { familyPasses: stock.rows[0]?.remaining, sevaUses: uses.rows[0]?.used_count };
}

async function statusOf(bookingId: string): Promise<unknown> {
  const { rows } = await db.query("SELECT status FROM bookings WHERE id = $1", [bookingId]);
  return rows[0]?.status;
}

const fresh = { familyPasses: 95, sevaUses: 0 };
const held = { familyPasses: 94, sevaUses: 1 };

describe("paying", () => {
  it("confirms the booking and keeps the stock taken", async () => {
    const id = await bookFamily();
    expect(await payBooking(db, id, "success", minutesLater(5))).toEqual({ kind: "paid" });
    expect(await statusOf(id)).toBe("confirmed");
    expect(await snapshot()).toEqual(held);
  });

  it("is harmless to do twice", async () => {
    const id = await bookFamily();
    await payBooking(db, id, "success", minutesLater(5));
    expect(await payBooking(db, id, "success", minutesLater(6))).toEqual({ kind: "paid" });
  });

  it("gives the stock and the promo use back when the payment is declined", async () => {
    const id = await bookFamily();
    expect(await payBooking(db, id, "decline", minutesLater(5))).toEqual({ kind: "declined" });
    expect(await statusOf(id)).toBe("payment_failed");
    expect(await snapshot()).toEqual(fresh);
  });

  it("is refused after the 15 minutes, and the hold is let go", async () => {
    const id = await bookFamily();
    expect(await payBooking(db, id, "success", minutesLater(16))).toEqual({ kind: "expired" });
    expect(await statusOf(id)).toBe("expired");
    expect(await snapshot()).toEqual(fresh);
  });

  it("can't revive a booking that already failed", async () => {
    const id = await bookFamily();
    await payBooking(db, id, "decline", minutesLater(5));
    expect(await payBooking(db, id, "success", minutesLater(6))).toEqual({
      kind: "not-payable",
      status: "payment_failed",
    });
  });

  it("says not found for an unknown or badly formed id", async () => {
    expect(await payBooking(db, "8f1c2d3e-1111-4222-8333-944455556666", "success", NOW)).toEqual({ kind: "not-found" });
    expect(await payBooking(db, "not-a-uuid", "success", NOW)).toEqual({ kind: "not-found" });
  });
});

describe("cancelling (going back to edit)", () => {
  it("gives everything back straight away", async () => {
    const id = await bookFamily();
    expect(await cancelBooking(db, id)).toEqual({ kind: "cancelled" });
    expect(await snapshot()).toEqual(fresh);
  });

  it("gives things back only once, however many times it is called", async () => {
    const id = await bookFamily();
    await cancelBooking(db, id);
    expect(await cancelBooking(db, id)).toEqual({ kind: "cancelled" });
    await releaseExpiredHolds(db, minutesLater(60));
    expect(await snapshot()).toEqual(fresh);
  });

  it("can't cancel a paid booking (no refunds in this version)", async () => {
    const id = await bookFamily();
    await payBooking(db, id, "success", minutesLater(5));
    expect(await cancelBooking(db, id)).toEqual({ kind: "not-cancellable", status: "confirmed" });
    expect(await snapshot()).toEqual(held);
  });
});

describe("the scheduled cleanup", () => {
  it("lets go of holds older than 15 minutes, and only those", async () => {
    const oldId = await bookFamily("key-old");
    const newer = await createBooking(db, myFamilyOn11Nov(), "key-new", minutesLater(10));

    expect(await releaseExpiredHolds(db, minutesLater(16))).toBe(1);
    expect(await statusOf(oldId)).toBe("expired");
    expect(newer.kind === "created" && (await statusOf(newer.booking.bookingId))).toBe("pending_payment");
  });

  it("finds nothing to do the second time", async () => {
    await bookFamily();
    expect(await releaseExpiredHolds(db, minutesLater(16))).toBe(1);
    expect(await releaseExpiredHolds(db, minutesLater(17))).toBe(0);
    expect(await snapshot()).toEqual(fresh);
  });

  it("doesn't give anything back a second time after a declined payment", async () => {
    const id = await bookFamily();
    await payBooking(db, id, "decline", minutesLater(5));
    expect(await releaseExpiredHolds(db, minutesLater(16))).toBe(0);
    expect(await snapshot()).toEqual(fresh);
  });
});
