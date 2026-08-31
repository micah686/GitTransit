CREATE TABLE notification_endpoints (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('ntfy','apprise','gotify','webhook')),
  url TEXT NOT NULL,
  encrypted_config TEXT NOT NULL,
  event_filters_json TEXT NOT NULL DEFAULT '["run.failed","run.partial","run.conflicted"]',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  last_test_at INTEGER,
  last_test_status TEXT,
  safe_error_code TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id,name)
);
CREATE INDEX notification_endpoints_user_enabled_idx ON notification_endpoints(user_id,enabled);

CREATE TABLE notification_deliveries (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL REFERENCES notification_endpoints(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_cursor INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('queued','delivering','delivered','failed')),
  attempt INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  claimed_by TEXT,
  lease_expires_at INTEGER,
  delivered_at INTEGER,
  safe_error_code TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(endpoint_id,event_cursor)
);
CREATE INDEX notification_deliveries_claim_idx
  ON notification_deliveries(state,next_attempt_at,lease_expires_at);
CREATE INDEX notification_deliveries_user_created_idx
  ON notification_deliveries(user_id,created_at);
