import { beforeAll, describe, expect, it } from "vitest";
import { api } from "./helpers/http";
import { resetAndSeed, type SeededIds } from "./helpers/seed";

let ids: SeededIds;

beforeAll(async () => {
  ids = await resetAndSeed();
});

function expectError(body: unknown): void {
  expect(body).toStrictEqual({ error: expect.any(String) });
}

// ── PROJECTS ────────────────────────────────────────────────────────────────

describe("projects error paths", () => {
  it("POST /api/projects → 400 when name is missing", async () => {
    const res = await api.post("/api/projects").send({ category: "backend" });
    expect(res.status).toBe(400);
    expectError(res.body);
  });

  it("POST /api/projects → 400 when category is missing", async () => {
    const res = await api.post("/api/projects").send({ name: "No Category" });
    expect(res.status).toBe(400);
    expectError(res.body);
  });

  it("POST /api/projects → 400 when body is empty", async () => {
    const res = await api.post("/api/projects").send({});
    expect(res.status).toBe(400);
    expectError(res.body);
  });

  it("GET /api/projects/:id → 404 for unknown id", async () => {
    const res = await api.get("/api/projects/999999");
    expect(res.status).toBe(404);
    expectError(res.body);
  });

  it("PATCH /api/projects/:id → 404 for unknown id", async () => {
    const res = await api.patch("/api/projects/999999").send({ name: "Ghost" });
    expect(res.status).toBe(404);
    expectError(res.body);
  });

  it("PATCH /api/projects/:id → 400 when name is the wrong type", async () => {
    const res = await api
      .patch(`/api/projects/${ids.projectId}`)
      .send({ name: 999 });
    expect(res.status).toBe(400);
    expectError(res.body);
  });
});

// ── AUTOMATIONS ─────────────────────────────────────────────────────────────

describe("automations error paths", () => {
  it("POST /api/automations → 400 when projectId is missing", async () => {
    const res = await api
      .post("/api/automations")
      .send({ name: "No Project" });
    expect(res.status).toBe(400);
    expectError(res.body);
  });

  it("POST /api/automations → 400 when name is missing", async () => {
    const res = await api
      .post("/api/automations")
      .send({ projectId: ids.projectId });
    expect(res.status).toBe(400);
    expectError(res.body);
  });

  it("POST /api/automations → 400 when body is empty", async () => {
    const res = await api.post("/api/automations").send({});
    expect(res.status).toBe(400);
    expectError(res.body);
  });

  it("GET /api/automations/:id → 404 for unknown id", async () => {
    const res = await api.get("/api/automations/999999");
    expect(res.status).toBe(404);
    expectError(res.body);
  });

  it("PATCH /api/automations/:id → 404 for unknown id", async () => {
    const res = await api
      .patch("/api/automations/999999")
      .send({ name: "Ghost" });
    expect(res.status).toBe(404);
    expectError(res.body);
  });

  it("PATCH /api/automations/:id → 400 when active is not a boolean", async () => {
    const res = await api
      .patch(`/api/automations/${ids.automationId}`)
      .send({ active: "yes" });
    expect(res.status).toBe(400);
    expectError(res.body);
  });

  it("POST /api/automations/:id/jobs → 404 for unknown automation id", async () => {
    const res = await api
      .post("/api/automations/999999/jobs")
      .send({});
    expect(res.status).toBe(404);
    expectError(res.body);
  });
});

// ── ASSETS ──────────────────────────────────────────────────────────────────

describe("assets error paths", () => {
  it("POST /api/assets → 400 when name is missing", async () => {
    const res = await api
      .post("/api/assets")
      .send({ type: "text", value: "hello" });
    expect(res.status).toBe(400);
    expectError(res.body);
  });

  it("POST /api/assets → 400 when type is missing", async () => {
    const res = await api
      .post("/api/assets")
      .send({ name: "No Type", value: "hello" });
    expect(res.status).toBe(400);
    expectError(res.body);
  });

  it("POST /api/assets → 400 when value is missing", async () => {
    const res = await api
      .post("/api/assets")
      .send({ name: "No Value", type: "text" });
    expect(res.status).toBe(400);
    expectError(res.body);
  });

  it("POST /api/assets → 400 when type is an invalid enum value", async () => {
    const res = await api
      .post("/api/assets")
      .send({ name: "Bad Type", type: "nonsense", value: "x" });
    expect(res.status).toBe(400);
    expectError(res.body);
  });

  it("PATCH /api/assets/:id → 404 for unknown id", async () => {
    const res = await api
      .patch("/api/assets/999999")
      .send({ name: "Ghost Asset" });
    expect(res.status).toBe(404);
    expectError(res.body);
  });

  it("PATCH /api/assets/:id → 400 when type is an invalid enum value", async () => {
    const res = await api
      .patch(`/api/assets/${ids.textAssetId}`)
      .send({ type: "nonsense" });
    expect(res.status).toBe(400);
    expectError(res.body);
  });
});

// ── QUEUES ──────────────────────────────────────────────────────────────────

describe("queues error paths", () => {
  it("POST /api/queues → 400 when name is missing", async () => {
    const res = await api.post("/api/queues").send({
      priority: 1,
      maxConcurrency: 1,
      maxRetries: 3,
      retryIntervalSeconds: 300,
      projectId: ids.projectId,
    });
    expect(res.status).toBe(400);
    expectError(res.body);
  });

  it("POST /api/queues → 400 when required numeric fields are missing", async () => {
    const res = await api.post("/api/queues").send({ name: "Incomplete Queue" });
    expect(res.status).toBe(400);
    expectError(res.body);
  });

  it("GET /api/queues/:id → 404 for unknown id", async () => {
    const res = await api.get("/api/queues/999999");
    expect(res.status).toBe(404);
    expectError(res.body);
  });

  it("PATCH /api/queues/:id → 404 for unknown id", async () => {
    const res = await api.patch("/api/queues/999999").send({ status: "paused" });
    expect(res.status).toBe(404);
    expectError(res.body);
  });

  it("PATCH /api/queues/:id → 400 when priority is the wrong type", async () => {
    const res = await api
      .patch(`/api/queues/${ids.queueId}`)
      .send({ priority: "high" });
    expect(res.status).toBe(400);
    expectError(res.body);
  });

  it("POST /api/queues/:id/items → 404 when queue does not exist", async () => {
    const res = await api
      .post("/api/queues/999999/items")
      .send({ priority: "normal" });
    expect(res.status).toBe(404);
    expectError(res.body);
  });

  it("GET /api/queue-items/:id → 404 for unknown id", async () => {
    const res = await api.get("/api/queue-items/999999");
    expect(res.status).toBe(404);
    expectError(res.body);
  });

  it("PATCH /api/queue-items/:id → 404 for unknown id", async () => {
    const res = await api
      .patch("/api/queue-items/999999")
      .send({ status: "successful" });
    expect(res.status).toBe(404);
    expectError(res.body);
  });
});

// ── SCHEDULES ───────────────────────────────────────────────────────────────

describe("schedules error paths", () => {
  it("POST /api/schedules → 400 when name is missing", async () => {
    const res = await api
      .post("/api/schedules")
      .send({ triggerType: "cron", cronExpression: "* * * * *" });
    expect(res.status).toBe(400);
    expectError(res.body);
  });

  it("POST /api/schedules → 400 when triggerType is missing", async () => {
    const res = await api
      .post("/api/schedules")
      .send({ name: "No Trigger" });
    expect(res.status).toBe(400);
    expectError(res.body);
  });

  it("POST /api/schedules → 400 when body is empty", async () => {
    const res = await api.post("/api/schedules").send({});
    expect(res.status).toBe(400);
    expectError(res.body);
  });

  it("GET /api/schedules/:id → 404 for unknown id", async () => {
    const res = await api.get("/api/schedules/999999");
    expect(res.status).toBe(404);
    expectError(res.body);
  });

  it("PATCH /api/schedules/:id → 404 for unknown id", async () => {
    const res = await api
      .patch("/api/schedules/999999")
      .send({ name: "Ghost Schedule" });
    expect(res.status).toBe(404);
    expectError(res.body);
  });

  it("PATCH /api/schedules/:id → 400 when enabled is not a boolean", async () => {
    const res = await api
      .patch(`/api/schedules/${ids.scheduleId}`)
      .send({ enabled: "yes" });
    expect(res.status).toBe(400);
    expectError(res.body);
  });

  it("POST /api/schedules/:id/toggle → 404 for unknown id", async () => {
    const res = await api
      .post("/api/schedules/999999/toggle")
      .send({ enabled: false });
    expect(res.status).toBe(404);
    expectError(res.body);
  });

  it("POST /api/schedules/:id/toggle → 400 when enabled field is missing", async () => {
    const res = await api
      .post(`/api/schedules/${ids.scheduleId}/toggle`)
      .send({});
    expect(res.status).toBe(400);
    expectError(res.body);
  });

  it("POST /api/schedules/:id/toggle → 400 when enabled is not a boolean", async () => {
    const res = await api
      .post(`/api/schedules/${ids.scheduleId}/toggle`)
      .send({ enabled: "yes" });
    expect(res.status).toBe(400);
    expectError(res.body);
  });
});
