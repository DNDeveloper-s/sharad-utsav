// Money is always whole cents: $14.70 is stored as 1470.
// With plain dollars, JavaScript can give 146.70000000000002. With cents it cannot.
//
// "Cents" is a number with a label stuck on it. A normal number does not fit
// in a Cents slot, so we cannot mix up dollars, cents and quantities by mistake.
export type Cents = number & { readonly __brand: "Cents" };

// The only way to make a Cents. It refuses decimals and negative amounts,
// so every Cents in the app has already passed this check.
export function cents(amount: number): Cents {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error(`Money must be a whole number of cents, zero or more. Got: ${amount}`);
  }
  // This is the one place we use a cast. It is safe because of the check above.
  return amount as Cents;
}

export const ZERO_CENTS = cents(0);

export function addCents(a: Cents, b: Cents): Cents {
  return cents(a + b);
}

// Throws if the answer would be below zero. If that ever happens it means
// our discount logic has a bug, and we want to hear about it loudly.
export function subtractCents(a: Cents, b: Cents): Cents {
  return cents(a - b);
}

export function multiplyCents(price: Cents, quantity: number): Cents {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`Quantity must be a whole number, zero or more. Got: ${quantity}`);
  }
  return cents(price * quantity);
}

export function sumCents(amounts: readonly Cents[]): Cents {
  return amounts.reduce((total, amount) => addCents(total, amount), ZERO_CENTS);
}

// Takes a whole-number percent of an amount, for example 10% of $11.80.
// If the answer falls between two cents, we round half up: 123.5 becomes 124.
export function percentOf(amount: Cents, percent: number): Cents {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new Error(`Percent must be a whole number from 0 to 100. Got: ${percent}`);
  }
  return cents(Math.round((amount * percent) / 100));
}

const usdFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// Only the screen should call this. Everywhere else we keep cents.
export function formatUsd(amount: Cents): string {
  return usdFormat.format(amount / 100);
}
