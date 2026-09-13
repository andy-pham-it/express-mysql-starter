import express from "express";
import dotenv from "dotenv";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { typeDefs, resolvers, createUserLoader, createItemLoader, createProductLoader } from "./graphql/schema";
import { ordersRouter } from "./orders";
import { authMiddleware, loginHandler } from "./auth";

dotenv.config();

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "express-mysql-starter" });
});

app.post("/api/login", loginHandler);
app.use("/api/orders", authMiddleware, ordersRouter);

async function start() {
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  app.use(
    "/graphql",
    expressMiddleware(server, {
      context: async () => ({
        userLoader: createUserLoader(),
        itemLoader: createItemLoader(),
        productLoader: createProductLoader(),
      }),
    })
  );

  app.use((req, res) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  });

  app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

  const PORT = Number(process.env.PORT ?? 3001);
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
    console.log(`GraphQL playground at http://localhost:${PORT}/graphql`);
  });
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});

export default app;
