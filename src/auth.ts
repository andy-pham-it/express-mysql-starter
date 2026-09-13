import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Demo keeps GET public; write operations require JWT.
  if (req.method === "GET") return next();
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }
  try {
    jwt.verify(header.slice(7), SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Demo login: accepts any username, returns a signed token for Postman testing.
export function loginHandler(req: Request, res: Response) {
  const { username } = req.body ?? {};
  if (!username) return res.status(400).json({ error: "username required" });
  const token = jwt.sign({ sub: username }, SECRET, { expiresIn: "2h" });
  res.json({ token });
}
