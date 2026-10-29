import { PRODUCTS } from "@/domain/catalog";
import { Card, TextField } from "./fields";
import { usd } from "./format";
import type { FormAction, FormState } from "./form";

type Props = { form: FormState; dispatch: (action: FormAction) => void; promoMessage: string | null };

export function ExtrasStep({ form, dispatch, promoMessage }: Props) {
  return (
    <Card title="Extras and promo code">
      <TextField
        label={`How many pairs of Dandiya sticks? (${usd(PRODUCTS["dandiya-sticks"].unitPrice)} a pair)`}
        hint="For the whole group. Leave at 0 if you don't need any."
        type="number"
        value={String(form.dandiyaPairs)}
        onChange={(value) => dispatch({ type: "setDandiyaPairs", value: Math.max(0, Math.trunc(Number(value)) || 0) })}
      />
      <TextField
        label="Promo code (optional)"
        value={form.promoCode}
        hint="One code per booking."
        onChange={(value) => dispatch({ type: "setPromoCode", value })}
      />
      {promoMessage && <p role="status" className="font-medium text-heading">{promoMessage}</p>}
    </Card>
  );
}
