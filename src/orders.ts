import { Router, Request, Response } from "express";
import { ah } from "./http";
import { pool } from "./db/pool";

export const ordersRouter = Router();

function parsePaging(req: Request) {
  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 10) || 10));
  return { page, limit, offset: (page - 1) * limit };
}

ordersRouter.get("/", ah(async (req: Request, res: Response) => {
  const { page, limit, offset } = parsePaging(req);
  const [rows] = await pool.query(
    `SELECT o.id, o.user_id, o.total, o.status, o.created_at, u.name AS user_name
     FROM orders o JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  res.json({ page, limit, data: rows });
}));

ordersRouter.get("/:id", ah(async (req: Request, res: Response) => {
  const [rows]: any = await pool.query(
    `SELECT o.id, o.user_id, o.total, o.status, o.created_at, u.name AS user_name
     FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Order not found" });
  const [items]: any = await pool.query(
    `SELECT oi.order_id, oi.product_id, oi.qty, oi.unit_price, p.name AS product_name
     FROM order_items oi JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`,
    [req.params.id]
  );
  res.json({ ...rows[0], items });
}));

ordersRouter.post("/", ah(async (req: Request, res: Response) => {
  const { userId, total, status, items } = req.body ?? {};
  if (!userId || total == null) {
    return res.status(400).json({ error: "userId and total are required" });
  }
  if (items !== undefined && !Array.isArray(items)) {
    return res.status(400).json({ error: "items must be an array" });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [users]: any = await conn.query(`SELECT id FROM users WHERE id = ?`, [userId]);
    if (!users.length) {
      await conn.rollback();
      return res.status(400).json({ error: "userId does not exist" });
    }
    const [result]: any = await conn.query(
      `INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)`,
      [userId, total, status ?? "pending"]
    );
    const orderId = result.insertId;
    if (items?.length) {
      for (const it of items) {
        const [prod]: any = await conn.query(`SELECT price FROM products WHERE id = ?`, [it.productId]);
        if (!prod.length) {
          await conn.rollback();
          return res.status(400).json({ error: `productId ${it.productId} does not exist` });
        }
        await conn.query(
          `INSERT INTO order_items (order_id, product_id, qty, unit_price) VALUES (?, ?, ?, ?)`,
          [orderId, it.productId, it.qty ?? 1, prod[0].price]
        );
      }
    }
    await conn.commit();
    res.status(201).json({ id: orderId, userId, total, status: status ?? "pending", itemCount: items?.length ?? 0 });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: "Failed to create order" });
  } finally {
    conn.release();
  }
}));

ordersRouter.put("/:id", ah(async (req: Request, res: Response) => {
  const { total, status } = req.body ?? {};
  const [result]: any = await pool.query(
    `UPDATE orders SET total = COALESCE(?, total), status = COALESCE(?, status) WHERE id = ?`,
    [total ?? null, status ?? null, req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: "Order not found" });
  res.json({ id: Number(req.params.id), total, status });
}));

ordersRouter.delete("/:id", ah(async (req: Request, res: Response) => {
  const [result]: any = await pool.query(`DELETE FROM orders WHERE id = ?`, [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: "Order not found" });
  res.status(204).send();
}));
