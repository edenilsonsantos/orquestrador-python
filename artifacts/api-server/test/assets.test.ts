import { beforeAll, describe, expect, it } from "vitest";
import { ListAssetsResponse, UpdateAssetResponse } from "@workspace/api-zod";
import { api } from "./helpers/http";
import { resetAndSeed, type SeededIds } from "./helpers/seed";

let ids: SeededIds;

beforeAll(async () => {
  ids = await resetAndSeed();
});

describe("assets endpoints response shape", () => {
  it("GET /api/assets returns valid list items with masked secret values", async () => {
    const res = await api.get("/api/assets");
    expect(res.status).toBe(200);
    const parsed = ListAssetsResponse.parse(res.body);
    expect(parsed.length).toBeGreaterThan(0);

    const credential = parsed.find((a) => a.id === ids.credentialAssetId);
    expect(credential).toBeDefined();
    expect(credential?.value).toBe("••••••••");
    expect(credential?.value).not.toContain("super-secret-password");

    const apiKey = parsed.find((a) => a.id === ids.apiKeyAssetId);
    expect(apiKey).toBeDefined();
    expect(apiKey?.value).not.toBe("sk-1234567890abcdef");
    expect(apiKey?.value).toContain("••••");

    const text = parsed.find((a) => a.id === ids.textAssetId);
    expect(text).toBeDefined();
    expect(text?.value).toBe("plain visible text");
  });

  it("POST /api/assets creates an asset with a valid masked shape", async () => {
    const res = await api.post("/api/assets").send({
      name: "Created Credential",
      type: "credential",
      username: "creator",
      value: "another-secret",
    });
    expect(res.status).toBe(201);
    const parsed = UpdateAssetResponse.parse(res.body);
    expect(parsed.name).toBe("Created Credential");
    expect(parsed.value).toBe("••••••••");
  });

  it("PATCH /api/assets/:id updates and returns a valid masked shape", async () => {
    const res = await api
      .patch(`/api/assets/${ids.textAssetId}`)
      .send({ name: "Renamed Text Asset", value: "updated visible text" });
    expect(res.status).toBe(200);
    const parsed = UpdateAssetResponse.parse(res.body);
    expect(parsed.name).toBe("Renamed Text Asset");
    expect(parsed.value).toBe("updated visible text");
  });
});
