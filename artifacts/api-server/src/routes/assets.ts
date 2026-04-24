import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, assetsTable } from "@workspace/db";
import { CreateAssetBody, UpdateAssetBody, UpdateAssetResponse as AssetSchema, ListAssetsResponse } from "@workspace/api-zod";
import { serialize } from "../utils/serialize";

const router: IRouter = Router();

function maskValue(type: string, value: string): string {
  if (type === "credential") {
    return value ? "••••••••" : "";
  }
  if (type === "api_key") {
    if (!value) return "";
    if (value.length <= 8) return "••••" + value.slice(-2);
    return value.slice(0, 4) + "••••••••" + value.slice(-4);
  }
  return value;
}

function presentAsset(a: typeof assetsTable.$inferSelect) {
  return {
    ...a,
    value: maskValue(a.type, a.value),
  };
}

router.get("/assets", async (_req, res): Promise<void> => {
  const assets = await db.select().from(assetsTable).orderBy(assetsTable.name);
  const masked = assets.map(presentAsset);
  res.json(ListAssetsResponse.parse(serialize(masked)));
});

router.post("/assets", async (req, res): Promise<void> => {
  const parsed = CreateAssetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!["credential", "api_key", "text"].includes(parsed.data.type)) {
    res.status(400).json({ error: "Invalid type. Use credential, api_key, or text." });
    return;
  }
  try {
    const [asset] = await db.insert(assetsTable).values(parsed.data).returning();
    res.status(201).json(AssetSchema.parse(serialize(presentAsset(asset))));
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? "Failed to create asset" });
  }
});

router.patch("/assets/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateAssetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.type !== undefined && !["credential", "api_key", "text"].includes(parsed.data.type)) {
    res.status(400).json({ error: "Invalid type. Use credential, api_key, or text." });
    return;
  }
  const [asset] = await db.update(assetsTable).set(parsed.data).where(eq(assetsTable.id, id)).returning();
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  res.json(AssetSchema.parse(serialize(presentAsset(asset))));
});

router.delete("/assets/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [asset] = await db.delete(assetsTable).where(eq(assetsTable.id, id)).returning();
  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
