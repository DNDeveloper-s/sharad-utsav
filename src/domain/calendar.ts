// Working with calendar dates (a day, with no time and no time zone).
//
// We do NOT use JavaScript's Date for birthdays. new Date("2019-05-10") means
// midnight in UTC, which can show up as 9 May in Texas. Instead we split the
// date into three plain numbers and compare those.

export type DateParts = { year: number; month: number; day: number };

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

// Reads "YYYY-MM-DD" and gives back the three numbers.
// Gives back null if it is not exactly that shape, or not a real date (like 30 Feb).
export function parseCalendarDate(input: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;

  return { year, month, day };
}

// For dates written in our own code, like the festival start.
// If one of them is wrong, that is a bug in the code, so we stop loudly.
export function mustParseCalendarDate(input: string): DateParts {
  const parts = parseCalendarDate(input);
  if (!parts) throw new Error(`Not a real date: ${input}`);
  return parts;
}

// Negative if a is earlier than b, zero if the same day, positive if later.
export function compareDates(a: DateParts, b: DateParts): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

// How many full years old someone is on a given day.
//
// We only compare month and day to see if the birthday has come yet.
// That also handles 29 Feb with no special code: in a year that has no 29 Feb,
// 28 Feb is "before" the birthday and 1 Mar is "after" it.
export function ageOn(dateOfBirth: DateParts, onDate: DateParts): number {
  const birthdayReached =
    onDate.month > dateOfBirth.month ||
    (onDate.month === dateOfBirth.month && onDate.day >= dateOfBirth.day);

  const years = onDate.year - dateOfBirth.year;
  return birthdayReached ? years : years - 1;
}

// "What is today's date in this time zone?"
// The server runs in UTC, but the temple is in Texas. Around midnight those
// are different days, so we ask for the date in the temple's time zone.
// We pass "now" in, so tests can pick any moment they like.
export function todayIn(timeZone: string, now: Date): DateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);

  const pick = (type: "year" | "month" | "day"): number => {
    const found = parts.find((part) => part.type === type);
    if (!found) throw new Error(`Could not read the ${type} for time zone ${timeZone}`);
    return Number(found.value);
  };

  return { year: pick("year"), month: pick("month"), day: pick("day") };
}
