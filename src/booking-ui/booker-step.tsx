import { Card, TextField } from "./fields";
import type { BookerForm, FormAction } from "./form";

export function BookerStep({ booker, dispatch }: { booker: BookerForm; dispatch: (action: FormAction) => void }) {
  const field = (name: keyof BookerForm) => ({
    value: booker[name],
    onChange: (value: string) => dispatch({ type: "setBooker", field: name, value }),
  });

  return (
    <Card title="Your details">
      <p>You are the person paying. The volunteers will use these details if they need to reach you.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Full name" autoComplete="name" {...field("fullName")} />
        <TextField label="Email" type="email" autoComplete="email" {...field("email")} />
        <TextField label="Phone" type="tel" autoComplete="tel" {...field("phone")} />
        <TextField label="Date of birth" type="date" hint="The person paying must be 18 or older." {...field("dateOfBirth")} />
      </div>
    </Card>
  );
}
