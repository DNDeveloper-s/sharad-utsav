// Small shared types that the other domain files use.

// A calendar date written as "YYYY-MM-DD", for example "2026-11-10".
// This type only checks the shape. Whether it is a real date
// (no 30 Feb) is checked later, when we read a date of birth.
export type CalendarDate = `${number}-${number}-${number}`;

// A list that always has at least one item.
// We use it for "days", so a Day Pass with zero days cannot even be written down.
export type NonEmptyArray<T> = [T, ...T[]];
