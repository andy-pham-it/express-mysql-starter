# MySQL Optimization: EXPLAIN before/after composite index

Query under test (baseline first, optimized after the new index):

```sql
SELECT * FROM orders WHERE user_id = 1 ORDER BY created_at DESC LIMIT 5;
```

Dataset: 120 rows in `orders`, 10 users. MySQL 8.0 (Docker).

## Before: only single-column index `idx_orders_user (user_id)`

```
-> Limit: 5 row(s)
    -> Sort: orders.created_at DESC, limit input to 5 row(s) per chunk
        -> Index lookup on orders using idx_orders_user (user_id=1)
```

Problem: the single-column index finds the 12 rows for the user, but MySQL must
**sort them by `created_at`** (filesort) before applying LIMIT. Cost grows with
rows-per-user: O(n log n) sort on every page load.

## After: composite index `idx_orders_user_created (user_id, created_at)`

Migration: `src/db/002_add_indexes.sql`

```sql
CREATE INDEX idx_orders_user_created ON orders (user_id, created_at);
```

```
-> Limit: 5 row(s)
    -> Index lookup on orders using idx_orders_user_created (user_id=1) (reverse)
```

Result: the **Sort step is gone**. The composite index stores each user's rows
already ordered by `created_at`, so MySQL does a backward index scan and reads
only 5 rows. Complexity drops to O(log n + limit).

## Stored procedures

- `sp_paginated_orders(p_page, p_limit)`: paginated order feed with user join.
  Verify: `CALL sp_paginated_orders(1, 5);` → 5 rows.
- `sp_user_order_stats(p_userId)`: per-user count/sum/avg in one round trip.
  Verify: `CALL sp_user_order_stats(1);` → `order_count=12, total_spent=6264.00`.
- Inspect: `SHOW CREATE PROCEDURE sp_paginated_orders;`

## Interview one-liner

> "My order feed did a filesort on every page. I added a composite index on
> (user_id, created_at), EXPLAIN confirmed the Sort step disappeared, and the
> query now reads only the LIMIT rows via backward index scan."

## Case 2: covering index for the revenue GROUP BY

Query under test (`sp_product_revenue`):

```sql
SELECT p.id, SUM(oi.qty * oi.unit_price) FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
WHERE p.id = 1 GROUP BY p.id;
```

Dataset: 20 products, 120 order_items. Migrations: `003_add_products.sql` (tables), `004_add_item_indexes.sql` (index).

### Before: only the FK auto-index `fk_items_product (product_id)`

```
id  table  type   key                 rows  Extra
1   oi     ref    fk_items_product    6     NULL
```

MySQL finds the 6 rows via the FK index but must read `qty`/`unit_price`
from the table heap (no `Extra` flag = table lookups).

### After: covering index `idx_items_product_cover (product_id, qty, unit_price)`

```sql
CREATE INDEX idx_items_product_cover ON order_items (product_id, qty, unit_price);
```

```
id  table  type   key                        rows  Extra
1   oi     ref    idx_items_product_cover    6     Using index
```

`Using index` = index-only scan: the SUM is answered from the index without
touching the table. Same pattern as case 1: design the index to cover the
query, confirm with EXPLAIN.

- `sp_product_revenue(p_productId)`: revenue/qty per product in one round trip.
  Verify: `CALL sp_product_revenue(1);` → `total_qty=6, revenue=75.00`.
