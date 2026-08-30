CREATE TABLE credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('token','basic','app-password','ssh-key')),
  encrypted_payload TEXT NOT NULL,
  key_version INTEGER NOT NULL,
  display_hint TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX credentials_user_idx ON credentials(user_id);

CREATE TABLE connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_url TEXT,
  external_url TEXT,
  lfs_url TEXT,
  credential_id TEXT REFERENCES credentials(id) ON DELETE RESTRICT,
  allow_private_network INTEGER NOT NULL DEFAULT 0 CHECK (allow_private_network IN (0,1)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  product TEXT,
  product_version TEXT,
  edition TEXT,
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  capabilities_observed_at INTEGER,
  last_test_at INTEGER,
  last_test_status TEXT,
  safe_error_code TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, normalized_name)
);
CREATE INDEX connections_user_idx ON connections(user_id);

CREATE TABLE namespaces (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  full_path TEXT NOT NULL,
  normalized_path TEXT NOT NULL,
  kind TEXT NOT NULL,
  display_json TEXT NOT NULL DEFAULT '{}',
  access_level TEXT,
  observed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(connection_id, external_id),
  UNIQUE(connection_id, normalized_path)
);
CREATE INDEX namespaces_connection_idx ON namespaces(connection_id);

CREATE TABLE remote_repositories (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  namespace_id TEXT REFERENCES namespaces(id) ON DELETE SET NULL,
  external_id TEXT,
  name TEXT NOT NULL,
  full_path TEXT NOT NULL,
  normalized_full_path TEXT NOT NULL,
  web_url TEXT,
  fetch_url TEXT NOT NULL,
  push_url TEXT NOT NULL,
  default_branch TEXT,
  visibility TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  fork INTEGER NOT NULL DEFAULT 0,
  hints_json TEXT NOT NULL DEFAULT '{}',
  discovery_state TEXT NOT NULL DEFAULT 'observed',
  last_observed_at INTEGER NOT NULL,
  adapter_schema_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(connection_id, external_id),
  UNIQUE(connection_id, normalized_full_path)
);
CREATE INDEX remote_repositories_connection_path_idx ON remote_repositories(connection_id, normalized_full_path);

CREATE TABLE mirror_pairs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  side_a_connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE RESTRICT,
  side_b_connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL CHECK (direction IN ('one-way','two-way')),
  state TEXT NOT NULL CHECK (state IN ('draft','enabled','paused')),
  selection_policy_json TEXT NOT NULL,
  namespace_policy_json TEXT NOT NULL,
  content_policy_json TEXT NOT NULL,
  metadata_policy_json TEXT NOT NULL,
  safety_policy_json TEXT NOT NULL,
  schedule_policy_json TEXT NOT NULL,
  capability_snapshot_json TEXT NOT NULL DEFAULT '{}',
  validation_status TEXT NOT NULL DEFAULT 'pending',
  next_run_at INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK(side_a_connection_id <> side_b_connection_id)
);
CREATE INDEX mirror_pairs_user_state_next_idx ON mirror_pairs(user_id, state, next_run_at);

CREATE TABLE repository_routes (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES mirror_pairs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  side_a_repository_id TEXT NOT NULL REFERENCES remote_repositories(id) ON DELETE RESTRICT,
  side_b_repository_id TEXT REFERENCES remote_repositories(id) ON DELETE RESTRICT,
  planned_namespace TEXT NOT NULL,
  planned_name TEXT NOT NULL,
  policy_overrides_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK(status IN ('discovered','planned','ready','syncing','synced','conflict','blocked','failed','ignored','missing','archived')),
  last_successful_run_id TEXT,
  safe_error_code TEXT,
  warning_summary TEXT,
  generation INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(pair_id, side_a_repository_id),
  UNIQUE(pair_id, side_b_repository_id)
);
CREATE INDEX repository_routes_pair_status_idx ON repository_routes(pair_id, status, updated_at);
CREATE INDEX repository_routes_user_idx ON repository_routes(user_id);

CREATE TABLE route_endpoints (
  route_id TEXT NOT NULL REFERENCES repository_routes(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('A','B')),
  connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE RESTRICT,
  remote_repository_id TEXT REFERENCES remote_repositories(id) ON DELETE SET NULL,
  canonical_full_path TEXT NOT NULL,
  web_url TEXT,
  fetch_url TEXT NOT NULL,
  push_url TEXT NOT NULL,
  provider_identity TEXT,
  verified_at INTEGER,
  PRIMARY KEY(route_id, side)
);

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pair_id TEXT REFERENCES mirror_pairs(id) ON DELETE SET NULL,
  route_id TEXT REFERENCES repository_routes(id) ON DELETE SET NULL,
  trigger TEXT NOT NULL CHECK(trigger IN ('manual','schedule','retry','recovery','conflict-resolution')),
  kind TEXT NOT NULL CHECK(kind IN ('discover','preview','provision','sync','cleanup','metadata')),
  state TEXT NOT NULL CHECK(state IN ('queued','running','awaiting-approval','conflicted','succeeded','partial','failed','cancelled','interrupted')),
  idempotency_key TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  progress_total INTEGER NOT NULL DEFAULT 0,
  progress_completed INTEGER NOT NULL DEFAULT 0,
  requested_at INTEGER NOT NULL,
  started_at INTEGER,
  heartbeat_at INTEGER,
  completed_at INTEGER,
  safe_error_code TEXT,
  safe_error_summary TEXT,
  cancellation_requested_at INTEGER,
  UNIQUE(user_id, idempotency_key)
);
CREATE INDEX runs_user_state_requested_idx ON runs(user_id, state, requested_at);

CREATE TABLE run_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  route_id TEXT REFERENCES repository_routes(id) ON DELETE SET NULL,
  step_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','succeeded','failed','cancelled','interrupted')),
  checkpoint_json TEXT NOT NULL DEFAULT '{}',
  lease_owner TEXT,
  lease_expires_at INTEGER,
  fencing_token INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  started_at INTEGER,
  heartbeat_at INTEGER,
  completed_at INTEGER,
  safe_error_code TEXT,
  warning_json TEXT,
  UNIQUE(run_id, step_order)
);
CREATE INDEX run_steps_claim_idx ON run_steps(state, next_attempt_at, lease_expires_at);
CREATE INDEX run_steps_route_idx ON run_steps(route_id, state);

CREATE TABLE events (
  cursor INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  resource_ids_json TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX events_user_cursor_idx ON events(user_id, cursor);
CREATE INDEX events_expiry_idx ON events(expires_at);

CREATE TABLE leases (
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  fencing_token INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  heartbeat_at INTEGER NOT NULL,
  PRIMARY KEY(resource_type, resource_id)
);

CREATE TABLE ref_baselines (
  route_id TEXT NOT NULL REFERENCES repository_routes(id) ON DELETE CASCADE,
  ref_name TEXT NOT NULL,
  side_a_oid TEXT,
  side_b_oid TEXT,
  object_kind TEXT,
  generation INTEGER NOT NULL,
  successful_run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(route_id, ref_name)
);

CREATE TABLE ref_observations (
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  route_id TEXT NOT NULL REFERENCES repository_routes(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK(side IN ('A','B')),
  ref_name TEXT NOT NULL,
  object_id TEXT NOT NULL,
  peeled_object_id TEXT,
  observed_at INTEGER NOT NULL,
  PRIMARY KEY(run_id, route_id, side, ref_name)
);
CREATE INDEX ref_observations_route_run_ref_idx ON ref_observations(route_id, run_id, ref_name);

CREATE TABLE conflicts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route_id TEXT NOT NULL REFERENCES repository_routes(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  ref_name TEXT NOT NULL,
  kind TEXT NOT NULL,
  baseline_a TEXT,
  baseline_b TEXT,
  current_a TEXT,
  current_b TEXT,
  state TEXT NOT NULL DEFAULT 'open',
  resolution TEXT,
  resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at INTEGER,
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX conflicts_user_state_created_idx ON conflicts(user_id, state, created_at);

CREATE TABLE backup_artifacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route_id TEXT NOT NULL REFERENCES repository_routes(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  protected_side TEXT NOT NULL CHECK(protected_side IN ('A','B')),
  relative_path TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  digest TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);
CREATE INDEX backup_artifacts_user_idx ON backup_artifacts(user_id);

CREATE TABLE metadata_mappings (
  route_id TEXT NOT NULL REFERENCES repository_routes(id) ON DELETE CASCADE,
  component TEXT NOT NULL,
  source_identity TEXT NOT NULL,
  target_identity TEXT NOT NULL,
  provenance TEXT NOT NULL,
  digest TEXT NOT NULL,
  version INTEGER NOT NULL,
  synced_at INTEGER NOT NULL,
  PRIMARY KEY(route_id, component, source_identity)
);

CREATE TABLE rate_limits (
  connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  limit_value INTEGER,
  remaining INTEGER,
  reset_at INTEGER,
  retry_at INTEGER,
  status TEXT,
  observed_at INTEGER NOT NULL,
  PRIMARY KEY(connection_id, category)
);
