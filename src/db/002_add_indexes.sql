-- Composite index for the user feed. Applied after recording the baseline EXPLAIN.
-- NOTE: MySQL 8.0 does not support IF NOT EXISTS for CREATE INDEX.
CREATE INDEX idx_orders_user_created ON orders (user_id, created_at);
