CREATE TABLE route_reconciliation_state (
  route_id TEXT PRIMARY KEY REFERENCES repository_routes(id) ON DELETE CASCADE,
  initialized INTEGER NOT NULL DEFAULT 0 CHECK(initialized IN (0,1)),
  generation INTEGER NOT NULL DEFAULT 0,
  successful_run_id TEXT REFERENCES runs(id) ON DELETE RESTRICT,
  updated_at INTEGER NOT NULL
);
CREATE TABLE two_way_plans (
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  route_id TEXT NOT NULL REFERENCES repository_routes(id) ON DELETE CASCADE,
  plan_digest TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('planned','awaiting-approval','conflicted','blocked','partial','verified')),
  applied_sides_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(run_id,route_id)
);
CREATE INDEX conflicts_route_state_idx ON conflicts(route_id,state,created_at);
CREATE UNIQUE INDEX conflicts_run_route_ref_idx ON conflicts(run_id,route_id,ref_name);
CREATE UNIQUE INDEX backup_artifacts_run_side_path_idx ON backup_artifacts(run_id,protected_side,relative_path);
