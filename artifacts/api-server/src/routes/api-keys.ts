import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, apiKeysTable } from "@workspace/db";
import { CreateApiKeyBody, ListApiKeysResponse } from "@workspace/api-zod";
import { serialize } from "../utils/serialize";
import { generateApiKey } from "../lib/api-key-auth";

const router: IRouter = Router();

function presentApiKey(k: typeof apiKeysTable.$inferSelect) {
  const { keyHash, ...rest } = k;
  return rest;
}

router.get("/api-keys", async (_req, res): Promise<void> => {
  const keys = await db.select().from(apiKeysTable).orderBy(apiKeysTable.createdAt);
  res.json(ListApiKeysResponse.parse(serialize(keys.map(presentApiKey))));
});

router.post("/api-keys", async (req, res): Promise<void> => {
  const parsed = CreateApiKeyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { key, keyPrefix, keyHash } = generateApiKey();
  const [created] = await db
    .insert(apiKeysTable)
    .values({ name: parsed.data.name, keyPrefix, keyHash })
    .returning();
  res.status(201).json(serialize({ ...presentApiKey(created), key }));
});

router.delete("/api-keys/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [updated] = await db
    .update(apiKeysTable)
    .set({ revoked: true })
    .where(eq(apiKeysTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "API key not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
