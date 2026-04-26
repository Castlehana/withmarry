-- 참석 여부 (RSVP) 제출
CREATE TABLE IF NOT EXISTS rsvp_submissions (
  id TEXT PRIMARY KEY NOT NULL,
  wedding_id TEXT NOT NULL,
  side TEXT NOT NULL,
  name TEXT NOT NULL,
  attend TEXT NOT NULL,
  meal TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rsvp_wedding_created ON rsvp_submissions (wedding_id, created_at DESC);
