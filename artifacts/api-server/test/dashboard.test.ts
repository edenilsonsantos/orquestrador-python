import { beforeAll, describe, expect, it } from "vitest";
import {
  GetDashboardSummaryResponse,
  GetJobStatsResponse,
  GetQueueHealthResponse,
  GetRecentJobsResponse,
} from "@workspace/api-zod";
import { api } from "./helpers/http";
import { resetAndSeed, type SeededIds } from "./helpers/seed";

let ids: SeededIds;

beforeAll(async () => {
  ids = await resetAndSeed();
});

describe("dashboard endpoints response shape", () => {
  it("GET /api/dashboard/summary returns a valid summary", async () => {
    const res = await api.get("/api/dashboard/summary");
    expect(res.status).toBe(200);
    const parsed = GetDashboardSummaryResponse.parse(res.body);
    expect(parsed.machinesTotal).toBeGreaterThanOrEqual(1);
    expect(parsed.pendingItems).toBe(1);
  });

  it("GET /api/dashboard/job-stats returns valid daily stats", async () => {
    const res = await api.get("/api/dashboard/job-stats");
    expect(res.status).toBe(200);
    const parsed = GetJobStatsResponse.parse(res.body);
    expect(parsed.length).toBe(7);
  });

  it("GET /api/dashboard/queue-health returns valid per-queue health", async () => {
    const res = await api.get("/api/dashboard/queue-health");
    expect(res.status).toBe(200);
    const parsed = GetQueueHealthResponse.parse(res.body);
    const queue = parsed.find((q) => q.queueId === ids.queueId);
    expect(queue).toBeDefined();
    expect(queue?.queueName).toBe("Test Queue");
    expect(queue?.pending).toBe(1);
  });

  it("GET /api/dashboard/recent-jobs returns valid jobs with joined names", async () => {
    const res = await api.get("/api/dashboard/recent-jobs");
    expect(res.status).toBe(200);
    const parsed = GetRecentJobsResponse.parse(res.body);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed[0].projectName).toBe("Test Project");
  });
});
