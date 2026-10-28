// Rules can fail in expected ways, like someone typing a wrong date of birth.
// That is normal input, not a crash, so we return the answer in a small box
// that says either "ok, here is the value" or "no, here is the error code".
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function fail<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
