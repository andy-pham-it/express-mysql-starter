import DataLoader from "dataloader";
import { pool } from "../db/pool";

export const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
    email: String!
  }

  type Order {
    id: ID!
    userId: Int!
    total: Float!
    status: String!
    createdAt: String!
    user: User
  }

  type UserOrderStats {
    userId: ID!
    userName: String!
    orderCount: Int!
    totalSpent: Float!
    avgOrder: Float!
  }

  type Product {
    id: ID!
    name: String!
    price: Float!
  }

  type OrderItem {
    orderId: ID!
    productId: ID!
    qty: Int!
    unitPrice: Float!
    product: Product
  }

  type ProductRevenue {
    productId: ID!
    productName: String!
    totalQty: Int!
    revenue: Float!
  }

  type Query {
    orders(page: Int = 1, limit: Int = 10): [Order!]!
    order(id: ID!): Order
    userOrderStats(userId: ID!): UserOrderStats
    productRevenue(productId: ID!): ProductRevenue
  }

  type Order {
    items: [OrderItem!]!
  }
`;

// DataLoader batches nested user lookups → avoids N+1 (one query per set of user_ids).
export function createItemLoader() {
  return new DataLoader<number, any[]>(async (orderIds) => {
    const [rows]: any = await pool.query(
      `SELECT oi.order_id, oi.order_id AS orderId, oi.product_id, oi.product_id AS productId,
              oi.qty, oi.unit_price, oi.unit_price AS unitPrice, p.name AS product_name
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id IN (?)`,
      [Array.from(new Set(orderIds))]
    );
    const byOrder = new Map<number, any[]>();
    for (const r of rows) {
      const list = byOrder.get(r.order_id) ?? [];
      list.push(r);
      byOrder.set(r.order_id, list);
    }
    return orderIds.map((id) => byOrder.get(id) ?? []);
  });
}

export function createProductLoader() {
  return new DataLoader<number, any>(async (ids) => {
    const [rows]: any = await pool.query(`SELECT id, name, price FROM products WHERE id IN (?)`, [
      Array.from(new Set(ids)),
    ]);
    const byId = new Map(rows.map((r: any) => [r.id, r]));
    return ids.map((id) => byId.get(id) ?? null);
  });
}

export function createUserLoader() {
  return new DataLoader<number, any>(async (ids) => {
    const [rows]: any = await pool.query(`SELECT id, name, email FROM users WHERE id IN (?)`, [
      Array.from(new Set(ids)),
    ]);
    const byId = new Map(rows.map((r: any) => [r.id, r]));
    return ids.map((id) => byId.get(id) ?? null);
  });
}

export const resolvers = {
  Query: {
    orders: async (_: any, args: { page?: number; limit?: number }) => {
      const page = Math.max(1, args.page ?? 1);
      const limit = Math.min(100, Math.max(1, args.limit ?? 10));
      const offset = (page - 1) * limit;
      const [rows]: any = await pool.query(
        `SELECT id, user_id AS userId, total, status, created_at AS createdAt
         FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      return rows;
    },
    order: async (_: any, args: { id: string }) => {
      const [rows]: any = await pool.query(
        `SELECT id, user_id AS userId, total, status, created_at AS createdAt
         FROM orders WHERE id = ?`,
        [args.id]
      );
      return rows[0] ?? null;
    },
    productRevenue: async (_: any, args: { productId: string }) => {
      const [rows]: any = await pool.query(`CALL sp_product_revenue(?)`, [args.productId]);
      const r = rows[0]?.[0];
      if (!r) return null;
      return {
        productId: r.product_id,
        productName: r.product_name,
        totalQty: Number(r.total_qty),
        revenue: Number(r.revenue),
      };
    },
    userOrderStats: async (_: any, args: { userId: string }) => {
      const [rows]: any = await pool.query(`CALL sp_user_order_stats(?)`, [args.userId]);
      const r = rows[0]?.[0];
      if (!r) return null;
      return {
        userId: r.user_id,
        userName: r.user_name,
        orderCount: Number(r.order_count),
        totalSpent: Number(r.total_spent),
        avgOrder: Number(r.avg_order),
      };
    },
  },
  Order: {
    user: (parent: any, _: any, ctx: { userLoader: ReturnType<typeof createUserLoader> }) =>
      ctx.userLoader.load(Number(parent.userId ?? parent.user_id)),
    items: (parent: any, _: any, ctx: { itemLoader: ReturnType<typeof createItemLoader> }) =>
      ctx.itemLoader.load(Number(parent.id)),
  },
  OrderItem: {
    product: (parent: any, _: any, ctx: { productLoader: ReturnType<typeof createProductLoader> }) =>
      ctx.productLoader.load(Number(parent.product_id)),
  },
};
