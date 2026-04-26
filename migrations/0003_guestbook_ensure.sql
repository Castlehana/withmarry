-- 일부 배포에서 0002가 적용되지 않았을 때 방명록 테이블·인덱스 보장 (CREATE IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS guestbook_entries (
  id TEXT PRIMARY KEY NOT NULL,
  wedding_id TEXT NOT NULL,
  side TEXT NOT NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_guestbook_wedding_created ON guestbook_entries (wedding_id, created_at DESC);
