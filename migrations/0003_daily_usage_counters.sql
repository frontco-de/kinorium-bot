CREATE TABLE IF NOT EXISTS usage_stats_daily (day TEXT NOT NULL, event TEXT NOT NULL CHECK (event IN ('api_call', 'sent_result')), count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, event));
INSERT INTO usage_stats_daily (day, event, count) SELECT substr(bucket, 1, 10), event, SUM(count) FROM usage_stats GROUP BY substr(bucket, 1, 10), event;
DROP TABLE usage_stats;
ALTER TABLE usage_stats_daily RENAME TO usage_stats;
CREATE TABLE IF NOT EXISTS user_activity_daily (day TEXT NOT NULL, user_id INTEGER NOT NULL, PRIMARY KEY (day, user_id));
INSERT OR IGNORE INTO user_activity_daily (day, user_id) SELECT substr(bucket, 1, 10), user_id FROM user_activity;
DROP TABLE user_activity;
ALTER TABLE user_activity_daily RENAME TO user_activity;
