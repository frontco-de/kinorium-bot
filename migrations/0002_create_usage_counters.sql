CREATE TABLE IF NOT EXISTS usage_stats (bucket TEXT NOT NULL, event TEXT NOT NULL CHECK (event IN ('api_call', 'sent_result')), count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (bucket, event));
CREATE TABLE IF NOT EXISTS user_activity (bucket TEXT NOT NULL, user_id INTEGER NOT NULL, PRIMARY KEY (bucket, user_id));
