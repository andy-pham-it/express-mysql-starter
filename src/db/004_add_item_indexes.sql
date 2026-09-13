-- Todo: owns the covering index for the revenue GROUP BY (second EXPLAIN case).
-- Lets MySQL answer sp_product_revenue from the index alone (Using index).
-- NOTE: MySQL 8.0 does not support IF NOT EXISTS for CREATE INDEX.
CREATE INDEX idx_items_product_cover ON order_items (product_id, qty, unit_price);
