"use client";

import { useEffect, useState } from "react";
import { fetchQuote, type QuoteResult } from "./api";

const WAIT_MS = 400; // let the family finish typing before we ask

// The live price for the form as it is right now. `loading` is true from the
// moment the form changes until the server has answered for that exact form.
export function useQuote(body: string): { result: QuoteResult | null; loading: boolean } {
  const [answer, setAnswer] = useState<{ body: string; result: QuoteResult } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const result = await fetchQuote(body, controller.signal);
      if (!controller.signal.aborted) setAnswer({ body, result });
    }, WAIT_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [body]);

  return { result: answer?.result ?? null, loading: answer?.body !== body };
}
