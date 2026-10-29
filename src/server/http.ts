// Every error the API sends has the same shape:
// { error: { code, message, issues? } }, where each issue is { code, field, message, params? }.

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "BOOKING_NOT_ALLOWED"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "SOLD_OUT"
  | "PROMO_USED_UP"
  | "BOOKING_NOT_FOUND"
  | "BOOKING_EXPIRED"
  | "BOOKING_CLOSED"
  | "UNAUTHORIZED";

export function errorResponse(status: number, code: ApiErrorCode, message: string, extra: object = {}): Response {
  return Response.json({ error: { code, message, ...extra } }, { status });
}

// Gives back the parsed body, or null when it isn't JSON at all.
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
