DELIMITER //

DROP PROCEDURE IF EXISTS sp_paginated_orders //
CREATE PROCEDURE sp_paginated_orders(IN p_page INT, IN p_limit INT)
BEGIN
  DECLARE v_offset INT;
  SET v_offset = (GREATEST(p_page, 1) - 1) * GREATEST(p_limit, 1);
  SELECT o.id, o.user_id, o.total, o.status, o.created_at, u.name AS user_name
  FROM orders o
  JOIN users u ON u.id = o.user_id
  ORDER BY o.created_at DESC
  LIMIT v_offset, p_limit;
END //

DROP PROCEDURE IF EXISTS sp_user_order_stats //
CREATE PROCEDURE sp_user_order_stats(IN p_userId INT)
BEGIN
  SELECT
    u.id AS user_id,
    u.name AS user_name,
    COUNT(o.id) AS order_count,
    COALESCE(SUM(o.total), 0) AS total_spent,
    COALESCE(AVG(o.total), 0) AS avg_order
  FROM users u
  LEFT JOIN orders o ON o.user_id = u.id
  WHERE u.id = p_userId
  GROUP BY u.id, u.name;
END //


DROP PROCEDURE IF EXISTS sp_product_revenue //
CREATE PROCEDURE sp_product_revenue(IN p_productId INT)
BEGIN
  SELECT
    p.id AS product_id,
    p.name AS product_name,
    COALESCE(SUM(oi.qty), 0) AS total_qty,
    COALESCE(SUM(oi.qty * oi.unit_price), 0) AS revenue
  FROM products p
  LEFT JOIN order_items oi ON oi.product_id = p.id
  WHERE p.id = p_productId
  GROUP BY p.id, p.name;
END //

DELIMITER ;
