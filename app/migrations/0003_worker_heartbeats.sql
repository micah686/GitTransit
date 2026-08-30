CREATE TABLE worker_heartbeats (
  worker_id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  heartbeat_at INTEGER NOT NULL,
  stopped_at INTEGER
);
CREATE INDEX worker_heartbeats_active_idx ON worker_heartbeats(stopped_at, heartbeat_at);
