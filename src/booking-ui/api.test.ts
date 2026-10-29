import { afterEach, describe, expect, it, vi } from "vitest";
import { createBooking, fetchQuote, payBooking } from "./api";

function answerWith(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

afterEach(() => vi.unstubAllGlobals());

const signal = new AbortController().signal;

describe("fetchQuote", () => {
  it("turns a 400 into a list of problems and no price", async () => {
    const issue = { code: "NAME_INVALID", field: "booker.fullName", message: "Please enter a name (up to 100 letters)." };
    answerWith(400, { error: { code: "INVALID_REQUEST", message: "Please check the highlighted fields.", issues: [issue] } });

    expect(await fetchQuote("{}", signal)).toEqual({ quote: null, issues: [issue], failed: false });
  });

  it("says failed when the server is not reachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchQuote("{}", signal)).toEqual({ quote: null, issues: [], failed: true });
  });

  it("says failed when the answer has the wrong shape", async () => {
    answerWith(200, { total: "free" });
    expect((await fetchQuote("{}", signal)).failed).toBe(true);
  });
});

describe("createBooking", () => {
  it("sends the idempotency key as a header", async () => {
    answerWith(201, { bookingId: "b1", status: "pending_payment", total: 1500, expiresAt: "2026-11-01T10:00:00.000Z" });
    await createBooking("{}", "key-1");

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get("Idempotency-Key")).toBe("key-1");
  });

  it("passes on the server's friendly message when it is sold out", async () => {
    answerWith(409, { error: { code: "SOLD_OUT", message: "Sorry, someone has just booked the last one." } });
    expect(await createBooking("{}", "key-1")).toEqual({
      kind: "error",
      message: "Sorry, someone has just booked the last one.",
    });
  });
});

describe("payBooking", () => {
  it("tells a decline apart from a confirmation", async () => {
    answerWith(200, { status: "payment_failed", message: "The payment didn't go through." });
    expect(await payBooking("b1", "decline")).toEqual({ kind: "declined", message: "The payment didn't go through." });

    answerWith(200, { status: "confirmed" });
    expect(await payBooking("b1", "success")).toEqual({ kind: "confirmed" });
  });
});
