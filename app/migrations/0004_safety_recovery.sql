CREATE TABLE destructive_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route_id TEXT NOT NULL REFERENCES repository_routes(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL REFERENCES run_steps(id) ON DELETE CASCADE,
  plan_digest TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','approved','rejected','invalidated','applied','expired')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  decided_at INTEGER,
  applied_at INTEGER,
  UNIQUE(run_id, step_id)
);
CREATE INDEX destructive_plans_user_state_idx ON destructive_plans(user_id,state,created_at);

CREATE TABLE maintenance_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  dry_run INTEGER NOT NULL CHECK(dry_run IN (0,1)),
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX maintenance_runs_user_created_idx ON maintenance_runs(user_id,created_at);
