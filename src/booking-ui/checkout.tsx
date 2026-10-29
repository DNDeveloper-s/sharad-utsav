"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cancelBooking, createBooking, payBooking, type HeldBooking } from "./api";
import { primaryButton, secondaryButton } from "./fields";
import { usd } from "./format";

type Props = {
  body: string; // the form as JSON, exactly what the quote was made from
  total: number;
  canReserve: boolean;
  waiting: boolean; // a newer price is on its way
  onBack: () => void;
};

function useSecondsLeft(expiresAt: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  return expiresAt ? Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000)) : null;
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export function Checkout({ body, total, canReserve, waiting, onBack }: Props) {
  const router = useRouter();
  // One key per checkout attempt. A double click, or a retry after a bad connection,
  // gets the same booking back. A changed form gets a new key.
  const attempt = useRef<{ key: string; body: string } | null>(null);
  const [held, setHeld] = useState<HeldBooking | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const secondsLeft = useSecondsLeft(held?.expiresAt ?? null);

  const finished = (bookingId: string) => router.push(`/bookings/${bookingId}`);

  async function reserve() {
    if (attempt.current?.body !== body) attempt.current = { key: crypto.randomUUID(), body };
    setBusy(true);
    setMessage(null);
    const result = await createBooking(body, attempt.current.key);
    setBusy(false);

    if (result.kind === "error") return setMessage(result.message);
    if (result.booking.status === "confirmed") return finished(result.booking.bookingId); // a $0 booking needs no payment
    setHeld(result.booking);
  }

  async function pay(outcome: "success" | "decline") {
    if (!held) return;
    setBusy(true);
    const result = await payBooking(held.bookingId, outcome);
    if (result.kind === "confirmed") return finished(held.bookingId);

    setBusy(false);
    setMessage(result.message);
    if (result.kind === "declined") release(); // the server let the tickets go
  }

  function release() {
    setHeld(null);
    attempt.current = null;
  }

  async function changeBooking() {
    if (held) {
      setBusy(true);
      await cancelBooking(held.bookingId); // frees the tickets now, not in 15 minutes
      setBusy(false);
    }
    release();
    onBack();
  }

  if (held && secondsLeft === 0) {
    return (
      <div className="space-y-4">
        <p role="alert">The 15 minutes ran out, so the tickets were released. Please book again.</p>
        <button type="button" className={primaryButton} onClick={changeBooking}>
          Start again
        </button>
      </div>
    );
  }

  if (held) {
    return (
      <div className="space-y-4">
        <p role="timer">
          Your tickets are held for <strong>{clock(secondsLeft ?? 0)}</strong>. Please pay before the time runs out.
        </p>
        {message && <p role="alert">{message}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" className={primaryButton} disabled={busy} onClick={() => pay("success")}>
            Pay {usd(total)}
          </button>
          <button type="button" className={`${secondaryButton} text-white`} disabled={busy} onClick={changeBooking}>
            Change my booking
          </button>
        </div>
        <p className="text-sm text-white/70">
          This is a practice payment. No money is taken.{" "}
          <button type="button" className="underline" disabled={busy} onClick={() => pay("decline")}>
            Test a failed payment
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && <p role="alert">{message}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={`${secondaryButton} text-white`} onClick={onBack}>
          Back
        </button>
        <button type="button" className={primaryButton} disabled={!canReserve || waiting || busy} onClick={reserve}>
          {busy ? "Holding your tickets…" : "Continue to payment"}
        </button>
      </div>
      <p className="text-sm text-white/70">
        {canReserve
          ? "We hold your tickets for 15 minutes while you pay."
          : "This booking can't go ahead yet. Please see the notes above."}
      </p>
    </div>
  );
}
