import { beforeAll, describe, expect, it } from "vitest";
import {
  ListApiKeysResponse,
  ListApiKeysResponseItem,
} from "@workspace/api-zod";
import { api } from "./helpers/http";
import { resetAndSeed, type SeededIds } from "./helpers/seed";

let ids: SeededIds;

beforeAll(async () => {
  ids = await resetAndSeed();
});

describe("api-keys endpoints response shape", () => {
  it("GET /api/api-keys returns valid list items without the secret hash", async () => {
    const res = await api.get("/api/api-keys");
    expect(res.status).toBe(200);
    const parsed = ListApiKeysResponse.parse(res.body);
    expect(parsed.length).toBeGreaterThan(0);
    const key = parsed.find((k) => k.id === ids.apiKeyId);
    expect(key).toBeDefined();
    expect(key?.name).toBe("Seed API Key");
    expect(key?.revoked).toBe(false);
    expect((key as Record<string, unknown>).keyHash).toBeUndefined();
  });

  it("POST /api/api-keys creates a key, returns the plaintext once, and a valid shape", async () => {
    const res = await api.post("/api/api-keys").send({ name: "Created Key" });
    expect(res.status).toBe(201);
    expect(typeof res.body.key).toBe("string");
    expect(res.body.key.length).toBeGreaterThan(0);
    const { key, ...rest } = res.body;
    const parsed = ListApiKeysResponseItem.parse(rest);
    expect(parsed.name).toBe("Created Key");
    expect(parsed.revoked).toBe(false);
    expect((rest as Record<string, unknown>).keyHash).toBeUndefined();
  });

  it("DELETE /api/api-keys/:id revokes the key", async () => {
    const res = await api.delete(`/api/api-keys/${ids.apiKeyId}`);
    expect(res.status).toBe(204);
    const list = await api.get("/api/api-keys");
    const parsed = ListApiKeysResponse.parse(list.body);
    const revoked = parsed.find((k) => k.id === ids.apiKeyId);
    expect(revoked?.revoked).toBe(true);
  });
});
