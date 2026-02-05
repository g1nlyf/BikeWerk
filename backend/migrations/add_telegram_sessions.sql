CREATE TABLE IF NOT EXISTS tg_sessions (
  user_id BIGINT PRIMARY KEY,
  order_id TEXT,
  last_context TEXT,
  sentiment_score FLOAT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
