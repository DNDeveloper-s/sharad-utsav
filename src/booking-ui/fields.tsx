import type { ReactNode } from "react";
import { FESTIVAL_DAYS, type FestivalDay } from "@/domain/festival";
import { dayLabel } from "./format";

export const inputClass =
  "min-h-11 w-full rounded-lg border border-gold bg-white px-3 text-primary-dark";

export const primaryButton =
  "min-h-12 rounded-full bg-primary px-8 font-semibold text-primary-dark transition-colors hover:bg-bright-gold disabled:opacity-50";

export const secondaryButton =
  "min-h-12 rounded-full border border-gold px-6 font-semibold text-heading transition-colors hover:bg-white/60";

export function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel" | "date" | "number";
  hint?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-heading">{props.label}</span>
      <input
        className={inputClass}
        type={props.type ?? "text"}
        value={props.value}
        autoComplete={props.autoComplete}
        onChange={(event) => props.onChange(event.target.value)}
      />
      {props.hint && <span className="block text-xs">{props.hint}</span>}
    </label>
  );
}

export function DayChecks(props: {
  legend: string;
  days: readonly FestivalDay[]; // the days the person has ticked
  available?: readonly FestivalDay[];
  onToggle: (day: FestivalDay) => void;
}) {
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium text-heading">{props.legend}</legend>
      <div className="flex flex-wrap gap-2">
        {(props.available ?? FESTIVAL_DAYS).map((day) => (
          <label key={day} className="flex min-h-11 items-center gap-2 rounded-lg border border-gold bg-white px-3 text-primary-dark">
            <input type="checkbox" checked={props.days.includes(day)} onChange={() => props.onToggle(day)} />
            {dayLabel(day)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Card(props: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-5 rounded-2xl bg-cream p-5 text-primary-text sm:p-6">
      <h2 className="text-2xl font-semibold text-heading">{props.title}</h2>
      {props.children}
    </section>
  );
}
