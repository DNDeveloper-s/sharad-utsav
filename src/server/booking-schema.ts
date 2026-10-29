import { z } from "zod";
import type { BookingRequest } from "@/domain/booking";
import { FESTIVAL_DAYS } from "@/domain/festival";
import { fail, ok, type Result } from "@/domain/result";

// The door check: is the request well formed? Names filled in, a real-looking
// email, sensible numbers, nothing repeated. Whether the booking is *allowed*
// is the domain's job (validateBooking) and happens after this.
//
// Each rule carries one of our codes as its message, so we can turn Zod's
// errors into the same { code, field } shape the domain uses.

const SHAPE_CODES = [
  "NAME_INVALID",
  "EMAIL_INVALID",
  "PHONE_INVALID",
  "ATTENDEE_COUNT_INVALID",
  "DUPLICATE_ATTENDEE_ID",
  "DUPLICATE_DAY",
  "DUPLICATE_FAMILY_PASS_ID",
  "DANDIYA_QUANTITY_INVALID",
] as const;

// INVALID_FIELD covers anything without its own code, like a wrong type.
export type ShapeIssueCode = (typeof SHAPE_CODES)[number] | "INVALID_FIELD";

export type ShapeIssue = { code: ShapeIssueCode; field: string };

const MAX_ATTENDEES = 20;
const MAX_DANDIYA_PAIRS = 20; // the brief only says "any reasonable quantity"

const noRepeats = (values: readonly string[]) => new Set(values).size === values.length;

const name = z.string().trim().min(1, "NAME_INVALID").max(100, "NAME_INVALID");

// Loose on purpose: strict patterns end up rejecting real international numbers.
const phone = z
  .string()
  .trim()
  .refine((value) => {
    const digits = value.replace(/\D/g, "").length;
    return /^[\d\s()+-]+$/.test(value) && digits >= 7 && digits <= 15;
  }, "PHONE_INVALID");

const day = z.enum(FESTIVAL_DAYS);
const days = z.array(day).refine(noRepeats, "DUPLICATE_DAY");
const id = z.string().trim().min(1).max(64);

const entry = z.discriminatedUnion("type", [
  // A tuple with a rest item is "at least one day", matching the domain type.
  z.object({ type: z.literal("day-pass"), days: z.tuple([day], day).refine(noRepeats, "DUPLICATE_DAY") }),
  z.object({ type: z.literal("all-day-pass") }),
  z.object({ type: z.literal("family-pass"), familyPassId: id }),
  z.object({ type: z.literal("none") }),
]);

const attendee = z.object({
  id,
  fullName: name,
  dateOfBirth: z.string().trim().max(20), // the age rules check it properly
  entry,
  dinnerDays: days,
  garbaDays: days,
  phone: phone.optional(),
});

const bookingRequestSchema = z.object({
  booker: z.object({
    fullName: name,
    email: z.string().trim().pipe(z.email("EMAIL_INVALID")),
    phone,
    dateOfBirth: z.string().trim().max(20),
  }),
  attendees: z
    .array(attendee)
    .min(1, "ATTENDEE_COUNT_INVALID")
    .max(MAX_ATTENDEES, "ATTENDEE_COUNT_INVALID")
    .refine((list) => noRepeats(list.map((person) => person.id)), "DUPLICATE_ATTENDEE_ID"),
  familyPasses: z
    .array(z.object({ id, day }))
    .max(MAX_ATTENDEES)
    .refine((list) => noRepeats(list.map((pass) => pass.id)), "DUPLICATE_FAMILY_PASS_ID"),
  dandiyaPairs: z
    .number("DANDIYA_QUANTITY_INVALID")
    .int("DANDIYA_QUANTITY_INVALID")
    .min(0, "DANDIYA_QUANTITY_INVALID")
    .max(MAX_DANDIYA_PAIRS, "DANDIYA_QUANTITY_INVALID"),
  promoCode: z.string().trim().max(40).optional(),
});

function isShapeIssueCode(value: string): value is ShapeIssueCode {
  return SHAPE_CODES.some((code) => code === value);
}

// Zod says "attendees.2.fullName". The screen wants "attendees.a3.fullName",
// the attendee's own id, so it still points at the right person after edits.
function fieldFor(path: PropertyKey[], body: unknown): string {
  const [first, index, ...rest] = path;
  if (first === "attendees" && typeof index === "number" && isRecord(body) && Array.isArray(body.attendees)) {
    const person: unknown = body.attendees[index];
    if (isRecord(person) && typeof person.id === "string") {
      return ["attendees", person.id, ...rest].map(String).join(".");
    }
  }
  return path.map(String).join(".");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseBookingRequest(body: unknown): Result<BookingRequest, ShapeIssue[]> {
  const parsed = bookingRequestSchema.safeParse(body);
  if (parsed.success) return ok(parsed.data);

  return fail(
    parsed.error.issues.map((issue) => ({
      code: isShapeIssueCode(issue.message) ? issue.message : "INVALID_FIELD",
      field: fieldFor(issue.path, body),
    })),
  );
}
