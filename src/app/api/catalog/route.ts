import { connection } from "next/server";
import { PRODUCTS } from "@/domain/catalog";
import { FESTIVAL_DAY_LABELS, FESTIVAL_DAYS, FESTIVAL_INFO } from "@/domain/festival";
import { loadQuoteContext } from "@/server/bookings";
import { getDb } from "@/server/db";

// Everything the page needs to draw the booking form, with live stock.
export async function GET() {
  await connection(); // stock changes, so never build this ahead of time

  const { remainingStock } = await loadQuoteContext(getDb(), new Date());
  return Response.json({
    festival: FESTIVAL_INFO,
    days: FESTIVAL_DAYS.map((day) => ({ day, label: FESTIVAL_DAY_LABELS[day] })),
    // startingStock only seeds the database, so it isn't sent; `remaining` is the live number.
    products: Object.values(PRODUCTS).map(({ startingStock, ...product }) => ({
      ...product,
      remaining: remainingStock[product.id],
    })),
  });
}
