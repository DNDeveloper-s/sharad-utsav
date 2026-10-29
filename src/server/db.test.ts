import { describe, expect, it } from "vitest";
import { PRODUCTS } from "@/domain/catalog";
import { PROMO_CODES } from "@/domain/promo-codes";
import { createTestDb } from "./test-db";

describe("schema.sql and seed.sql", () => {
  it("start every product with the stock in catalog.ts", async () => {
    const db = await createTestDb();
    const { rows } = await db.query("SELECT product_id, remaining FROM product_stock");
    const stock = Object.fromEntries(rows.map((row) => [row.product_id, row.remaining]));
    const expected = Object.fromEntries(Object.values(PRODUCTS).map((p) => [p.id, p.startingStock]));
    expect(stock).toEqual(expected);
  });

  it("start every promo code with the usage in promo-codes.ts", async () => {
    const db = await createTestDb();
    const { rows } = await db.query("SELECT code, used_count FROM promo_usage");
    const usage = Object.fromEntries(rows.map((row) => [row.code, row.used_count]));
    const expected = Object.fromEntries(PROMO_CODES.map((p) => [p.code, p.startingUsedCount]));
    expect(usage).toEqual(expected);
  });

  it("never lets stock go below zero, even if the code forgets to check", async () => {
    const db = await createTestDb();
    await expect(
      db.query("UPDATE product_stock SET remaining = remaining - 3 WHERE product_id = 'garba-workshop'"),
    ).rejects.toThrow();
  });

  it("rolls back everything in a transaction when one step fails", async () => {
    const db = await createTestDb();
    await expect(
      db.transaction(async (tx) => {
        await tx.query("UPDATE product_stock SET remaining = 0 WHERE product_id = 'dinner-plate'");
        throw new Error("something went wrong");
      }),
    ).rejects.toThrow();

    const { rows } = await db.query("SELECT remaining FROM product_stock WHERE product_id = 'dinner-plate'");
    expect(rows[0]?.remaining).toBe(1700);
  });

  it("can run the seed twice without changing live numbers", async () => {
    const db = await createTestDb();
    await db.query("UPDATE product_stock SET remaining = 1 WHERE product_id = 'garba-workshop'");
    await db.query("INSERT INTO product_stock (product_id, remaining) VALUES ('garba-workshop', 2) ON CONFLICT (product_id) DO NOTHING");
    const { rows } = await db.query("SELECT remaining FROM product_stock WHERE product_id = 'garba-workshop'");
    expect(rows[0]?.remaining).toBe(1);
  });
});
