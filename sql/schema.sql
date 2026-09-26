PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  starting_cash_cents INTEGER NOT NULL,
  available_cash_cents INTEGER NOT NULL,
  ramp_business_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_codes (
  team_id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_team_codes_team FOREIGN KEY (team_id) REFERENCES teams(id)
);

-- Explicit mappings prevent an unmapped team from billing a default entity.
CREATE TABLE IF NOT EXISTS team_ramp_entities (
  team_id TEXT PRIMARY KEY REFERENCES teams(id),
  ramp_entity_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  team_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'PARTICIPANT' CHECK (role IN ('PARTICIPANT', 'FACILITATOR')),
  verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_team FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE TABLE IF NOT EXISTS verification_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  purpose TEXT NOT NULL CHECK (purpose IN ('SIGNUP', 'LOGIN')),
  team_id TEXT,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at TEXT,
  created_at INTEGER NOT NULL,
  CONSTRAINT fk_verification_team FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE INDEX IF NOT EXISTS idx_verification_email_created
  ON verification_codes(email, created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN (
    'BILL_CREATING', 'AWAITING_RAMP_REVIEW', 'APPROVED',
    'PAYMENT_PENDING', 'PAID', 'FULFILLED', 'REJECTED',
    'INTEGRATION_ERROR'
  )),
  total_cents INTEGER NOT NULL,
  ramp_bill_id TEXT UNIQUE,
  ramp_status TEXT,
  error_message TEXT,
  paid_at TEXT,
  fulfilled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_team FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE TABLE IF NOT EXISTS order_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  CONSTRAINT fk_order_lines_order FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS order_ramp_sync (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  entity_id TEXT NOT NULL,
  vendor_id TEXT NOT NULL,
  draft_id TEXT UNIQUE,
  create_attempted_at TEXT,
  attachment_uploaded INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ramp_webhook_challenges (
  challenge TEXT PRIMARY KEY,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory (
  team_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (team_id, product_id),
  CONSTRAINT fk_inventory_team FOREIGN KEY (team_id) REFERENCES teams(id)
);

CREATE TABLE IF NOT EXISTS webhook_events (
  ramp_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  business_id TEXT,
  object_id TEXT,
  payload TEXT NOT NULL,
  processed_at TEXT,
  processing_result TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO teams (
  id, slug, name, starting_cash_cents, available_cash_cents
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  'team-croissant',
  'Team Croissant Bakery',
  100000,
  100000
) ON CONFLICT(slug) DO UPDATE SET name = excluded.name;

INSERT INTO team_codes (team_id, code) VALUES (
  '11111111-1111-4111-8111-111111111111',
  'CROISSANT'
) ON CONFLICT(team_id) DO UPDATE SET code = excluded.code;
