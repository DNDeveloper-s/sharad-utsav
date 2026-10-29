-- Product and promo DEFINITIONS (prices, rules, limits) live in the code:
-- src/domain/catalog.ts and src/domain/promo-codes.ts.
-- The database only keeps what changes: live stock, promo usage and bookings.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS product_stock (
  product_id text PRIMARY KEY,
  remaining  integer NOT NULL CHECK (remaining >= 0)
);

-- Counts uses that are paid or held by a booking waiting for payment.
CREATE TABLE IF NOT EXISTS promo_usage (
  code       text PRIMARY KEY,
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0)
);

CREATE TABLE IF NOT EXISTS bookings (
  id              uuid PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE, -- a second click on Pay finds this row instead of making a new one
  status          text NOT NULL CHECK (status IN ('pending_payment', 'confirmed', 'payment_failed', 'expired', 'cancelled')),
  booker_name     text NOT NULL,
  booker_email    text NOT NULL,
  booker_phone    text NOT NULL,
  booker_dob      text NOT NULL, -- kept as "YYYY-MM-DD" text, so no time zone can shift it
  promo_code      text,          -- set only when a use of the code is held for this booking
  subtotal_cents  integer NOT NULL,
  discount_cents  integer NOT NULL,
  total_cents     integer NOT NULL,
  expires_at      timestamptz,   -- when an unpaid booking lets go of its stock
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_waiting_for_payment ON bookings (expires_at) WHERE status = 'pending_payment';

-- The door list.
CREATE TABLE IF NOT EXISTS attendees (
  booking_id     uuid NOT NULL REFERENCES bookings (id),
  attendee_id    text NOT NULL, -- the id the page gave this person, like "a3"
  full_name      text NOT NULL,
  date_of_birth  text NOT NULL,
  age_band       text NOT NULL CHECK (age_band IN ('under-5', 'child', 'adult')),
  entry_type     text NOT NULL CHECK (entry_type IN ('day-pass', 'all-day-pass', 'family-pass', 'none')),
  family_pass_id text,
  attending_days text[] NOT NULL,
  phone          text,
  PRIMARY KEY (booking_id, attendee_id)
);

-- What was sold, at the price paid that day. Same shape as PriceLine in pricing.ts.
CREATE TABLE IF NOT EXISTS booking_lines (
  id               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id       uuid NOT NULL REFERENCES bookings (id),
  product_id       text NOT NULL,
  attendee_id      text,
  family_pass_id   text,
  day              text,
  quantity         integer NOT NULL CHECK (quantity > 0),
  unit_price_cents integer NOT NULL,
  line_total_cents integer NOT NULL,
  stock_units      integer NOT NULL CHECK (stock_units >= 0)
);
