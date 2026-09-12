-- Todo 7 owns this index. Applied after baseline EXPLAIN in Todo 6.
-- NOTE: MySQL 8.0 does not support IF NOT EXISTS for CREATE INDEX.
CREATE INDEX idx_orders_user_created ON orders (user_id, created_at);
