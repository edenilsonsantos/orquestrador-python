import { beforeAll, describe, expect, it } from "vitest";
import {
  ListQueuesResponse,
  GetQueueResponse,
  UpdateQueueResponse,
  ListQueueItemsResponse,
  GetQueueItemResponse,
  UpdateQueueItemResponse,
  DequeueItemResponse,
} from "@workspace/api-zod";
import { api } from "./helpers/http";
import { resetAndSeed, type SeededIds } from "./helpers/seed";

let ids: SeededIds;

beforeAll(async () => {
  ids = await resetAndSeed();
});

describe("queues endpoints response shape", () => {
  it("GET /api/queues returns valid list items with counters", async () => {
    const res = await api.get("/api/queues");
    expect(res.status).toBe(200);
    const parsed = ListQueuesResponse.parse(res.body);
    expect(parsed.length).toBeGreaterThan(0);
    const queue = parsed.find((q) => q.id === ids.queueId);
    expect(queue).toBeDefined();
    expect(queue?.pendingCount).toBe(1);
    expect(queue?.completedCount).toBe(1);
    expect(queue?.errorCount).toBe(1);
  });

  it("GET /api/queues/:id returns a valid queue", async () => {
    const res = await api.get(`/api/queues/${ids.queueId}`);
    expect(res.status).toBe(200);
    const parsed = GetQueueResponse.parse(res.body);
    expect(parsed.id).toBe(ids.queueId);
  });

  it("POST /api/queues creates a valid queue", async () => {
    const res = await api.post("/api/queues").send({
      name: "Created Queue",
      priority: 2,
      maxConcurrency: 1,
      maxRetries: 3,
      retryIntervalSeconds: 300,
      projectId: ids.projectId,
    });
    expect(res.status).toBe(201);
    const parsed = GetQueueResponse.parse(res.body);
    expect(parsed.name).toBe("Created Queue");
    expect(parsed.pendingCount).toBe(0);
  });

  it("PATCH /api/queues/:id updates and returns a valid shape", async () => {
    const res = await api
      .patch(`/api/queues/${ids.queueId}`)
      .send({ status: "paused" });
    expect(res.status).toBe(200);
    const parsed = UpdateQueueResponse.parse(res.body);
    expect(parsed.status).toBe("paused");
  });
});

describe("queue-items endpoints response shape", () => {
  it("GET /api/queues/:id/items returns valid items with joined names", async () => {
    const res = await api.get(`/api/queues/${ids.queueId}/items`);
    expect(res.status).toBe(200);
    const parsed = ListQueueItemsResponse.parse(res.body);
    expect(parsed.length).toBeGreaterThan(0);
    const item = parsed.find((i) => i.id === ids.queueItemDoneId);
    expect(item).toBeDefined();
    expect(item?.queueName).toBe("Test Queue");
    expect(item?.machineName).toBe("seed-machine");
  });

  it("GET /api/queues/:id/items filters by status", async () => {
    const res = await api
      .get(`/api/queues/${ids.queueId}/items`)
      .query({ status: "new" });
    expect(res.status).toBe(200);
    const parsed = ListQueueItemsResponse.parse(res.body);
    expect(parsed.every((i) => i.status === "new")).toBe(true);
  });

  it("GET /api/queue-items/:id returns a valid item", async () => {
    const res = await api.get(`/api/queue-items/${ids.queueItemDoneId}`);
    expect(res.status).toBe(200);
    const parsed = GetQueueItemResponse.parse(res.body);
    expect(parsed.id).toBe(ids.queueItemDoneId);
    expect(parsed.queueName).toBe("Test Queue");
  });

  it("POST /api/queues/:id/items enqueues with a valid shape", async () => {
    const res = await api
      .post(`/api/queues/${ids.queueId}/items`)
      .send({ reference: "ref-created", priority: "normal" });
    expect(res.status).toBe(201);
    const parsed = GetQueueItemResponse.parse(res.body);
    expect(parsed.reference).toBe("ref-created");
    expect(parsed.status).toBe("new");
    expect(parsed.queueName).toBe("Test Queue");
  });

  it("PATCH /api/queue-items/:id updates with a valid shape", async () => {
    const res = await api
      .patch(`/api/queue-items/${ids.queueItemNewId}`)
      .send({ status: "successful", output: JSON.stringify({ ok: true }) });
    expect(res.status).toBe(200);
    const parsed = UpdateQueueItemResponse.parse(res.body);
    expect(parsed.status).toBe("successful");
    expect(parsed.queueName).toBe("Test Queue");
  });

  it("POST /api/queues/:id/dequeue claims an item with a valid shape", async () => {
    const res = await api
      .post(`/api/queues/${ids.queueId}/dequeue`)
      .set("X-Agent-Machine", ids.machineName)
      .set("Authorization", `Bearer ${ids.machineToken}`)
      .send({});
    expect(res.status).toBe(200);
    const parsed = DequeueItemResponse.parse(res.body);
    expect(parsed.status).toBe("in_progress");
    expect(parsed.machineName).toBe("seed-machine");
  });
});
