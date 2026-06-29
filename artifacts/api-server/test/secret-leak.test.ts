import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ListAssetsResponse,
  UpdateAssetResponse,
  ListApiKeysResponse,
  ListApiKeysResponseItem,
} from "@workspace/api-zod";
import { api } from "./helpers/http";
import { resetAndSeed, type SeededIds } from "./helpers/seed";

let ids: SeededIds;

// Raw secret material seeded by resetAndSeed(). None of these strings may ever
// appear verbatim in any assets or api-keys response.
const RAW_CREDENTIAL_VALUE = "super-secret-password";
const RAW_API_KEY_ASSET_VALUE = "sk-1234567890abcdef";

// Documented mask formats (mirror of maskValue in routes/assets.ts).
const CREDENTIAL_MASK = "••••••••";
function expectedApiKeyMask(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "••••" + value.slice(-2);
  return value.slice(0, 4) + "••••••••" + value.slice(-4);
}

// Recursively collect the JSON paths of any property literally named "keyHash".
function findKeyHashPaths(value: unknown, path = "$"): string[] {
  const hits: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...findKeyHashPaths(v, `${path}[${i}]`)));
  } else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === "keyHash") hits.push(`${path}.${key}`);
      hits.push(...findKeyHashPaths(child, `${path}.${key}`));
    }
  }
  return hits;
}

function assertNoSecretMaterial(label: string, body: unknown, forbidden: string[]): void {
  expect(findKeyHashPaths(body), `${label} must not contain a keyHash field`).toEqual([]);
  const haystack = JSON.stringify(body);
  for (const secret of forbidden) {
    expect(haystack.includes(secret), `${label} must not contain raw secret "${secret}"`).toBe(false);
  }
}

beforeAll(async () => {
  ids = await resetAndSeed();
});

describe("secret values never leak through the API", () => {
  it("GET /api/assets never exposes raw credential/api_key values or keyHash", async () => {
    const res = await api.get("/api/assets");
    expect(res.status).toBe(200);
    ListAssetsResponse.parse(res.body);

    assertNoSecretMaterial("GET /api/assets", res.body, [
      RAW_CREDENTIAL_VALUE,
      RAW_API_KEY_ASSET_VALUE,
    ]);

    const credential = res.body.find((a: { id: number }) => a.id === ids.credentialAssetId);
    expect(credential.value).toBe(CREDENTIAL_MASK);

    const apiKeyAsset = res.body.find((a: { id: number }) => a.id === ids.apiKeyAssetId);
    expect(apiKeyAsset.value).toBe(expectedApiKeyMask(RAW_API_KEY_ASSET_VALUE));
  });

  it("POST /api/assets masks credential values and never echoes the raw secret", async () => {
    const rawValue = "raw-credential-should-never-leak";
    const res = await api.post("/api/assets").send({
      name: "Leak Test Credential",
      type: "credential",
      username: "leak-tester",
      value: rawValue,
    });
    expect(res.status).toBe(201);
    const parsed = UpdateAssetResponse.parse(res.body);

    assertNoSecretMaterial("POST /api/assets (credential)", res.body, [rawValue]);
    expect(parsed.value).toBe(CREDENTIAL_MASK);
  });

  it("POST /api/assets masks api_key values and hides the secret middle", async () => {
    const rawValue = "rawaMIDDLESECRETXYZDDLE";
    const res = await api.post("/api/assets").send({
      name: "Leak Test Api Key",
      type: "api_key",
      value: rawValue,
    });
    expect(res.status).toBe(201);
    const parsed = UpdateAssetResponse.parse(res.body);

    assertNoSecretMaterial("POST /api/assets (api_key)", res.body, [
      rawValue,
      "MIDDLESECRETXYZ",
    ]);
    expect(parsed.value).toBe(expectedApiKeyMask(rawValue));
  });

  it("PATCH /api/assets/:id re-masks updated secret values", async () => {
    const rawValue = "patched-secret-must-not-leak";
    const res = await api
      .patch(`/api/assets/${ids.credentialAssetId}`)
      .send({ type: "credential", value: rawValue });
    expect(res.status).toBe(200);
    const parsed = UpdateAssetResponse.parse(res.body);

    assertNoSecretMaterial("PATCH /api/assets/:id", res.body, [rawValue]);
    expect(parsed.value).toBe(CREDENTIAL_MASK);
  });

  it("GET /api/api-keys never exposes keyHash or seeded secret material", async () => {
    const res = await api.get("/api/api-keys");
    expect(res.status).toBe(200);
    ListApiKeysResponse.parse(res.body);

    assertNoSecretMaterial("GET /api/api-keys", res.body, [
      ids.apiKeyPlaintext,
      createHash("sha256").update(ids.apiKeyPlaintext).digest("hex"),
    ]);
  });

  it("POST /api/api-keys returns the plaintext once but never the hash or keyHash field", async () => {
    const res = await api.post("/api/api-keys").send({ name: "Leak Test Key" });
    expect(res.status).toBe(201);

    expect(typeof res.body.key).toBe("string");
    expect(res.body.key.length).toBeGreaterThan(0);

    const createdKeyHash = createHash("sha256").update(res.body.key).digest("hex");
    assertNoSecretMaterial("POST /api/api-keys", res.body, [createdKeyHash]);

    const { key, ...rest } = res.body;
    ListApiKeysResponseItem.parse(rest);
  });
});
