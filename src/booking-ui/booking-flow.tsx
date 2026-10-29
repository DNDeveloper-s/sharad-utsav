"use client";

import { useEffect, useReducer, useState } from "react";
import { withMessage } from "@/server/messages"; // plain code with no server-only imports, so the page can share the wording
import type { Issue } from "./api";
import { BookerStep } from "./booker-step";
import { Checkout } from "./checkout";
import { ExtrasStep } from "./extras-step";
import { primaryButton, secondaryButton } from "./fields";
import { dayLabel, usd } from "./format";
import {
  bookerAgeIssue,
  buildRequest,
  formReducer,
  initialForm,
  isBlocked,
  LAST_STEP,
  stepOfField,
  type FormState,
} from "./form";
import { PeopleStep } from "./people-step";
import { QuoteSummary } from "./quote-summary";
import { useQuote } from "./use-quote";

const STEP_TITLES = ["Your details", "Who is coming", "Extras", "Review and pay"];

// Problems come with a field like "attendees.a2.dateOfBirth". Say who it is about.
function who(field: string, form: FormState): string {
  const [area, id] = field.split(".");
  if (area === "booker") return "You: ";
  if (area === "familyPasses" && id) return `Family Pass on ${dayLabel(id.replace("family-", ""))}: `;
  if (area !== "attendees" || !id) return "";
  const index = form.attendees.findIndex((person) => person.id === id);
  const person = form.attendees[index];
  return person ? `${person.fullName.trim() || `Person ${index + 1}`}: ` : "";
}

export function BookingFlow() {
  const [form, dispatch] = useReducer(formReducer, initialForm);
  // Checked on the click, not while rendering: /book is prerendered, so a date read there would be the build date.
  const [ageCheck, setAgeCheck] = useState<{ dateOfBirth: string; issue: Issue } | null>(null);
  const body = JSON.stringify(buildRequest(form));
  const { result, loading } = useQuote(body);

  // Each step starts at its top. Braces matter: newer browsers return a Promise from scrollTo, and React rejects that.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [form.step]);

  const serverIssues: Issue[] = result?.issues ?? [];
  const ageIssue = ageCheck?.dateOfBirth === form.booker.dateOfBirth ? ageCheck.issue : null;
  const issues =
    ageIssue && !serverIssues.some((issue) => issue.field === ageIssue.field) ? [ageIssue, ...serverIssues] : serverIssues;

  function next() {
    const local = form.step === 0 ? bookerAgeIssue(form.booker.dateOfBirth, new Date()) : null;
    setAgeCheck(local && { dateOfBirth: form.booker.dateOfBirth, issue: withMessage(local) });
    dispatch({ type: "next", blocked: local !== null || isBlocked(form.step, issues) });
  }
  const quote = result?.quote ?? null;
  const shown = issues.filter((issue) => stepOfField(issue.field) <= form.step);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-10 sm:px-8">
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold sm:text-5xl">Book your tickets</h1>
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {STEP_TITLES.map((title, index) => (
            <li key={title} aria-current={index === form.step ? "step" : undefined} className={index === form.step ? "font-semibold text-bright-gold" : "text-white/70"}>
              {index + 1}. {title}
            </li>
          ))}
        </ol>
      </header>

      {form.step === 0 && <BookerStep booker={form.booker} dispatch={dispatch} />}
      {form.step === 1 && <PeopleStep form={form} dispatch={dispatch} />}
      {form.step === 2 && <ExtrasStep form={form} dispatch={dispatch} promoMessage={quote?.promo.message ?? null} />}
      {form.step === LAST_STEP && (quote ? <QuoteSummary quote={quote} nameOf={(id) => form.attendees.find((person) => person.id === id)?.fullName} /> : <p>Working out your price…</p>)}

      {(form.showErrors || form.step === LAST_STEP) && shown.length > 0 && (
        <div role="alert" className="rounded-lg border border-error bg-cream p-4 text-error-on-light">
          <p className="font-semibold">Please fix this before you carry on:</p>
          <ul className="list-disc pl-5">
            {shown.map((issue, index) => (
              <li key={index}>
                {who(issue.field, form)}
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result?.failed && <p role="alert">We couldn&apos;t work out your price just now. Please check your connection.</p>}

      <footer className="space-y-4">
        {quote && (
          <p aria-live="polite" className="text-lg">
            Total so far: <strong>{usd(quote.total)}</strong>
          </p>
        )}
        {form.step < LAST_STEP ? (
          <div className="flex gap-3">
            {form.step > 0 && (
              <button type="button" className={`${secondaryButton} text-white`} onClick={() => dispatch({ type: "back" })}>
                Back
              </button>
            )}
            <button
              type="button"
              className={primaryButton}
              disabled={loading} // wait for the answer about the form as it is now
              onClick={next}
            >
              Next: {STEP_TITLES[form.step + 1]}
            </button>
          </div>
        ) : (
          <Checkout
            body={body}
            total={quote?.total ?? 0}
            canReserve={quote?.bookable === true}
            waiting={loading}
            onBack={() => dispatch({ type: "back" })}
          />
        )}
      </footer>
    </main>
  );
}
