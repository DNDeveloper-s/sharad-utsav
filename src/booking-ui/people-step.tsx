import { ADULT_FROM_AGE, CHILD_FROM_AGE } from "@/domain/age";
import { PRODUCTS } from "@/domain/catalog";
import { FESTIVAL_DAYS, isFestivalDay } from "@/domain/festival";
import { Card, DayChecks, inputClass, secondaryButton, TextField } from "./fields";
import { dayLabel, usd } from "./format";
import { toggleDay, type EntryKind, type FormAction, type FormState, type PersonForm } from "./form";

const TICKETS: { kind: EntryKind; label: string; note: string }[] = [
  { kind: "day-pass", label: "Day Pass", note: "Choose the days. Priced per day." },
  { kind: "all-day-pass", label: "All-Day Pass", note: "All 5 days, one price." },
  { kind: "family-pass", label: "Family Pass", note: "One day. Up to 2 adults and 2 children share one pass." },
  { kind: "none", label: "Free entry", note: `Children under ${CHILD_FROM_AGE} only.` },
];

type Props = { form: FormState; dispatch: (action: FormAction) => void };

export function PeopleStep({ form, dispatch }: Props) {
  const { booker, attendees } = form;
  const canAddBooker =
    booker.fullName.trim() !== "" &&
    !attendees.some((person) => person.fullName === booker.fullName && person.dateOfBirth === booker.dateOfBirth);

  return (
    <Card title="Who is coming?">
      <p>Add everyone who is coming, including children. We work out adult or child prices from each date of birth.</p>
      <PriceTable />

      {attendees.map((person, index) => (
        <Person key={person.id} person={person} number={index + 1} dispatch={dispatch} />
      ))}

      <div className="flex flex-wrap gap-3">
        {canAddBooker && (
          <button
            type="button"
            className={secondaryButton}
            onClick={() =>
              dispatch({
                type: "addPerson",
                prefill: { fullName: booker.fullName, dateOfBirth: booker.dateOfBirth, phone: booker.phone },
              })
            }
          >
            Add myself ({booker.fullName.trim()})
          </button>
        )}
        <button type="button" className={secondaryButton} onClick={() => dispatch({ type: "addPerson" })}>
          {attendees.length === 0 ? "Add a person" : "Add another person"}
        </button>
      </div>
    </Card>
  );
}

function PriceTable() {
  const cell = "border-t border-gold/30 py-2 pr-3";
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr>
          <th className="py-2 pr-3">Ticket</th>
          <th className="py-2 pr-3">Adult ({ADULT_FROM_AGE}+)</th>
          <th className="py-2 pr-3">
            Child ({CHILD_FROM_AGE} to {ADULT_FROM_AGE - 1})
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className={cell}>Day Pass, per day</td>
          <td className={cell}>{usd(PRODUCTS["day-pass-adult"].unitPrice)}</td>
          <td className={cell}>{usd(PRODUCTS["day-pass-child"].unitPrice)}</td>
        </tr>
        <tr>
          <td className={cell}>All-Day Pass, all 5 days</td>
          <td className={cell}>{usd(PRODUCTS["all-day-pass-adult"].unitPrice)}</td>
          <td className={cell}>{usd(PRODUCTS["all-day-pass-child"].unitPrice)}</td>
        </tr>
        <tr>
          <td className={cell}>Family Pass, one day</td>
          <td className={cell} colSpan={2}>
            {usd(PRODUCTS["family-pass"].unitPrice)} for up to 2 adults and 2 children
          </td>
        </tr>
        <tr>
          <td className={cell}>Under {CHILD_FROM_AGE}</td>
          <td className={cell} colSpan={2}>
            Free
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function Person({ person, number, dispatch }: { person: PersonForm; number: number; dispatch: Props["dispatch"] }) {
  const update = (patch: Partial<Omit<PersonForm, "id">>) => dispatch({ type: "updatePerson", id: person.id, patch });
  const name = person.fullName.trim() || `Person ${number}`;

  return (
    <fieldset className="space-y-4 rounded-lg border border-gold p-4">
      <legend className="px-2 font-semibold text-heading">{name}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Full name" value={person.fullName} onChange={(fullName) => update({ fullName })} />
        <TextField label="Date of birth" type="date" value={person.dateOfBirth} onChange={(dateOfBirth) => update({ dateOfBirth })} />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-heading">Ticket</legend>
        {TICKETS.map((ticket) => (
          <label key={ticket.kind} className="flex min-h-11 items-start gap-3 rounded-lg border border-gold bg-white p-3 text-primary-dark">
            <input
              type="radio"
              className="mt-1"
              name={`ticket-${person.id}`}
              checked={person.entryKind === ticket.kind}
              // Free entry hides the extras, so clear them too or they would be sent unseen.
              onChange={() =>
                update(ticket.kind === "none" ? { entryKind: "none", dinnerDays: [], garbaDays: [] } : { entryKind: ticket.kind })
              }
            />
            <span>
              <span className="font-semibold">{ticket.label}</span>
              <span className="block text-sm">{ticket.note}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {person.entryKind === "day-pass" && (
        <DayChecks legend="Which days?" days={person.days} onToggle={(day) => update({ days: toggleDay(person.days, day) })} />
      )}

      {person.entryKind === "family-pass" && (
        <label className="block space-y-1">
          <span className="text-sm font-medium text-heading">Which day?</span>
          <select
            className={inputClass}
            value={person.familyDay}
            onChange={(event) => {
              const day = event.target.value;
              if (isFestivalDay(day)) update({ familyDay: day });
            }}
          >
            {FESTIVAL_DAYS.map((day) => (
              <option key={day} value={day}>
                {dayLabel(day)}
              </option>
            ))}
          </select>
          <span className="block text-xs">Everyone on a Family Pass for the same day shares one pass.</span>
        </label>
      )}

      {person.entryKind !== "none" && (
        <>
          <TextField
            label="Phone (optional)"
            type="tel"
            hint="Only for adults. Leave empty for children."
            value={person.phone}
            onChange={(phone) => update({ phone })}
          />
          <DayChecks
            legend={`Dinner plate, ${usd(PRODUCTS["dinner-plate"].unitPrice)} each. Tick the days.`}
            days={person.dinnerDays}
            onToggle={(day) => update({ dinnerDays: toggleDay(person.dinnerDays, day) })}
          />
          <DayChecks
            legend={`Garba Workshop, ${usd(PRODUCTS["garba-workshop"].unitPrice)} each. Only on these days.`}
            days={person.garbaDays}
            available={PRODUCTS["garba-workshop"].availableDays}
            onToggle={(day) => update({ garbaDays: toggleDay(person.garbaDays, day) })}
          />
        </>
      )}

      <button type="button" className={secondaryButton} onClick={() => dispatch({ type: "removePerson", id: person.id })}>
        Remove {name}
      </button>
    </fieldset>
  );
}
