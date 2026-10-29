import { z } from "zod";

// The page's only door to the server. Every answer is checked with Zod
// before the screen uses it, so a changed API shows up here and not as a blank screen.

const issueSchema = z.object({ code: z.string(), field: z.string(), message: z.string() });
export type Issue = z.infer<typeof issueSchema>;

const quoteSchema = z.object({
  bookable: z.boolean(),
  issues: z.array(issueSchema),
  lines: z.array(
    z.object({
      name: z.string(),
      attendeeId: z.string().nullable(),
      day: z.string().nullable(),
      quantity: z.number(),
      total: z.number(),
    }),
  ),
  subtotal: z.number(),
  discount: z.number(),
  total: z.number(),
  promo: z.object({ status: z.string(), message: z.string().nullable() }),
  hints: z.array(z.object({ message: z.string() })),
});
export type QuoteView = z.infer<typeof quoteSchema>;

const heldSchema = z.object({
  bookingId: z.string(),
  status: z.string(),
  total: z.number(),
  expiresAt: z.string().nullable(),
});
export type HeldBooking = z.infer<typeof heldSchema>;

const errorSchema = z.object({ error: z.object({ message: z.string(), issues: z.array(issueSchema).optional() }) });

const PROBLEM = "Something went wrong on our side. Please try again in a moment.";
const OFFLINE = "We couldn't reach the server. Please check your connection and try again.";

async function send(url: string, init: RequestInit): Promise<{ ok: boolean; body: unknown } | null> {
  try {
    const response = await fetch(url, init);
    return { ok: response.ok, body: await response.json().catch(() => null) };
  } catch {
    return null; // offline, or the request was cancelled
  }
}

function errorMessage(body: unknown): string {
  const parsed = errorSchema.safeParse(body);
  return parsed.success ? parsed.data.error.message : PROBLEM;
}

const post = (body: string, headers: Record<string, string> = {}): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body,
});

export type QuoteResult = { quote: QuoteView | null; issues: Issue[]; failed: boolean };

// The live price. A form that is not valid yet comes back as a 400 with the problems.
export async function fetchQuote(body: string, signal: AbortSignal): Promise<QuoteResult> {
  const answer = await send("/api/quote", { ...post(body), signal });
  const quote = quoteSchema.safeParse(answer?.body);
  if (answer?.ok && quote.success) return { quote: quote.data, issues: quote.data.issues, failed: false };

  const problem = errorSchema.safeParse(answer?.body);
  if (problem.success && problem.data.error.issues) {
    return { quote: null, issues: problem.data.error.issues, failed: false };
  }
  return { quote: null, issues: [], failed: true };
}

export type CreateResult = { kind: "held"; booking: HeldBooking } | { kind: "error"; message: string };

export async function createBooking(body: string, idempotencyKey: string): Promise<CreateResult> {
  const answer = await send("/api/bookings", post(body, { "Idempotency-Key": idempotencyKey }));
  if (!answer) return { kind: "error", message: OFFLINE };

  const held = heldSchema.safeParse(answer.body);
  return answer.ok && held.success
    ? { kind: "held", booking: held.data }
    : { kind: "error", message: errorMessage(answer.body) };
}

export type PayResult = { kind: "confirmed" } | { kind: "declined" | "error"; message: string };

export async function payBooking(bookingId: string, outcome: "success" | "decline"): Promise<PayResult> {
  const answer = await send(`/api/bookings/${bookingId}/payment`, post(JSON.stringify({ outcome })));
  if (!answer) return { kind: "error", message: OFFLINE };

  const status = z.object({ status: z.string(), message: z.string().optional() }).safeParse(answer.body);
  if (answer.ok && status.success) {
    return status.data.status === "confirmed"
      ? { kind: "confirmed" }
      : { kind: "declined", message: status.data.message ?? PROBLEM };
  }
  return { kind: "error", message: errorMessage(answer.body) };
}

export async function cancelBooking(bookingId: string): Promise<{ ok: boolean; message: string }> {
  const answer = await send(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
  if (!answer) return { ok: false, message: OFFLINE };
  return { ok: answer.ok, message: answer.ok ? "" : errorMessage(answer.body) };
}
