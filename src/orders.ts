import { Router, Request, Response } from "express";
import { pool } from "./db/pool";

export const ordersRouter = Router();

function parsePaging(req: Request) {
  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 10) || 10));
  return { page, limit, offset: (page - 1) * limit };
}

ordersRouter.get("/", async (req: Request, res: Response) => {
  const { page, limit, offset } = parsePaging(req);
  const [rows] = await pool.query(
    `SELECT o.id, o.user_id, o.total, o.status, o.created_at, u.name AS user_name
     FROM orders o JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  res.json({ page, limit, data: rows });
});

ordersRouter.get("/:id", async (req: Request, res: Response) => {
  const [rows]: any = await pool.query(
    `SELECT o.id, o.user_id, o.total, o.status, o.created_at, u.name AS user_name
     FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Order not found" });
  res.json(rows[0]);
});

ordersRouter.post("/", async (req: Request, res: Response) => {
  const { userId, total, status } = req.body ?? {};
  if (!userId || total == null) {
    return res.status(400).json({ error: "userId and total are required" });
  }
  const conn = await pool.getConnection();
  try {
    // Transaction demo (Todo 7): BEGIN → validate user → insert → COMMIT, ROLLBACK on error.
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
    await conn.commit();
    res.status(201).json({ id: result.insertId, userId, total, status: status ?? "pending" });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: "Failed to create order" });
  } finally {
    conn.release();
  }
});

ordersRouter.put("/:id", async (req: Request, res: Response) => {
  const { total, status } = req.body ?? {};
  const [result]: any = await pool.query(
    `UPDATE orders SET total = COALESCE(?, total), status = COALESCE(?, status) WHERE id = ?`,
    [total ?? null, status ?? null, req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: "Order not found" });
  res.json({ id: Number(req.params.id), total, status });
});

ordersRouter.delete("/:id", async (req: Request, res: Response) => {
  const [result]: any = await pool.query(`DELETE FROM orders WHERE id = ?`, [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: "Order not found" });
  res.status(204).send();
});
