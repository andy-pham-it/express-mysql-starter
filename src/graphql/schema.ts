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

  type Query {
    orders(page: Int = 1, limit: Int = 10): [Order!]!
    order(id: ID!): Order
    userOrderStats(userId: ID!): UserOrderStats
  }
`;

// DataLoader batches nested user lookups → avoids N+1 (one query per set of user_ids).
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
  },
};
