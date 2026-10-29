-- Starting numbers from the brief. Safe to run more than once: it never
-- overwrites live numbers. A test checks these match catalog.ts and promo-codes.ts.

INSERT INTO product_stock (product_id, remaining) VALUES
  ('day-pass-adult', 380),
  ('day-pass-child', 260),
  ('all-day-pass-adult', 0),
  ('all-day-pass-child', 140),
  ('family-pass', 95),
  ('dandiya-sticks', 900),
  ('dinner-plate', 1700),
  ('garba-workshop', 2)
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO promo_usage (code, used_count) VALUES
  ('SEVA10', 0),
  ('FLAT20', 0),
  ('KIDSFREE', 0),
  ('EXPIRED5', 0),
  ('MAXEDOUT', 100)
ON CONFLICT (code) DO NOTHING;
