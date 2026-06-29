import { createHash, randomBytes } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { db, apiKeysTable } from "@workspace/db";

const API_KEY_PREFIX = "pyo_";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; keyPrefix: string; keyHash: string } {
  const key = API_KEY_PREFIX + randomBytes(24).toString("hex");
  return {
    key,
    keyPrefix: key.slice(0, 12),
    keyHash: hashApiKey(key),
  };
}

function extractApiKey(req: Request): string | null {
  const header = req.header("x-api-key");
  if (header && header.trim()) return header.trim();
  const auth = req.header("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return null;
}

export async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const provided = extractApiKey(req);
  if (!provided) {
    res.status(401).json({ error: "API key ausente. Envie no cabeçalho X-API-Key." });
    return;
  }
  const hash = hashApiKey(provided);
  const [match] = await db
    .select()
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.keyHash, hash), eq(apiKeysTable.revoked, false)));
  if (!match) {
    res.status(401).json({ error: "API key inválida ou revogada." });
    return;
  }
  await db.update(apiKeysTable).set({ lastUsedAt: new Date() }).where(eq(apiKeysTable.id, match.id));
  next();
}
