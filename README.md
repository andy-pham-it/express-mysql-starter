# express-mysql-starter

Express.js + MySQL 8.0 + GraphQL demo built for a MERN JD (stored procedures + query optimization + GraphQL).

## Quickstart

> Requires **Node.js 22+** (LTS) and Docker.

```bash
cp .env.example .env
docker compose up -d                  # MySQL 8.0 on :3307
npm install
npm run db:migrate && npm run db:seed # needs mysql client installed
npm run dev                           # API on :3001
```

## What it proves

| Requirement | Where |
|---|---|
| REST CRUD + pagination + JWT | `src/orders.ts`, `src/auth.ts` |
| Stored procedures | `src/db/procedures.sql` (`sp_paginated_orders`, `sp_user_order_stats`, `sp_product_revenue`) |
| Query optimization + EXPLAIN | `src/db/002_add_indexes.sql`, `src/db/004_add_item_indexes.sql`, `docs/mysql-optimization.md` |
| Transactions | `POST /api/orders` (BEGIN/COMMIT/ROLLBACK, incl. items[]) |
| GraphQL + N+1 fix | `src/graphql/schema.ts` (Apollo 4 + user/item/product DataLoaders, 2-level nesting) |
| Catalog (many-to-many) | `src/db/003_add_products.sql` (`products` + `order_items` junction) |

## Why no ORM?

Deliberate choice, not a gap. This repo exists to demonstrate **stored procedures,
`EXPLAIN ANALYZE` optimization and hand-tuned indexes**. An ORM would hide exactly
the layer being showcased. Raw `mysql2` keeps every query visible and auditable.
For a production app of this shape I would reach for **Drizzle**: lightweight,
SQL-like, no hidden queries.

## Try it

```bash
curl localhost:3001/health
curl "localhost:3001/api/orders?page=1&limit=5"
TOKEN=$(curl -s -X POST localhost:3001/api/login -H 'Content-Type: application/json' -d '{"username":"andy"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -X POST localhost:3001/api/orders -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"userId":1,"total":100}'
curl -X POST localhost:3001/graphql -H 'Content-Type: application/json' -d '{"query":"{ orders(page:1, limit:2){ id total user { name } } }"}'
curl "localhost:3001/api/orders/1"   # order detail with nested items
curl -X POST localhost:3001/graphql -H 'Content-Type: application/json' -d '{"query":"{ order(id:1){ id total items { qty unitPrice product { name price } } } productRevenue(productId:1){ productName totalQty revenue } }"}'
```

## Auth scope

Reads (`GET /api/orders`, the GraphQL endpoint) are public so the demo is easy to
try. Writes (`POST`/`PUT`/`DELETE /api/orders`) need a Bearer token from `/api/login`.
