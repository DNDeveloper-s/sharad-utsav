import type { QuoteView } from "./api";
import { Card } from "./fields";
import { dayLabel, usd } from "./format";

// Every number here comes from the server. The page adds up nothing.
export function QuoteSummary({ quote, nameOf }: { quote: QuoteView; nameOf: (attendeeId: string) => string | undefined }) {
  return (
    <Card title="Your booking">
      <ul className="divide-y divide-gold/30">
        {quote.lines.map((line, index) => (
          <li key={index} className="flex justify-between gap-4 py-2">
            <span>
              {line.name}
              {line.attendeeId && nameOf(line.attendeeId) && ` for ${nameOf(line.attendeeId)}`}
              {line.day && `, ${dayLabel(line.day)}`}
              {line.quantity > 1 && ` × ${line.quantity}`}
            </span>
            <span>{usd(line.total)}</span>
          </li>
        ))}
      </ul>

      <dl className="space-y-1">
        <Row label="Subtotal" amount={quote.subtotal} />
        {quote.discount > 0 && <Row label="Discount" amount={-quote.discount} />}
        <Row label="Total" amount={quote.total} strong />
      </dl>

      {quote.promo.message && <p role="status">{quote.promo.message}</p>}
      {quote.hints.map((hint) => (
        <p key={hint.message} className="rounded-lg border border-gold p-3">
          Tip: {hint.message}
        </p>
      ))}
    </Card>
  );
}

function Row({ label, amount, strong }: { label: string; amount: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "text-lg font-semibold text-heading" : ""}`}>
      <dt>{label}</dt>
      <dd>{amount < 0 ? `-${usd(-amount)}` : usd(amount)}</dd>
    </div>
  );
}
