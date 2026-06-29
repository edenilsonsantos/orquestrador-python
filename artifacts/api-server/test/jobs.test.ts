import { beforeAll, describe, expect, it } from "vitest";
import {
  ListJobsResponse,
  GetJobResponse,
  StopJobResponse,
} from "@workspace/api-zod";
import { api } from "./helpers/http";
import { resetAndSeed, type SeededIds } from "./helpers/seed";

let ids: SeededIds;

beforeAll(async () => {
  ids = await resetAndSeed();
});

describe("jobs endpoints response shape", () => {
  it("GET /api/jobs returns valid list items with joined names", async () => {
    const res = await api.get("/api/jobs");
    expect(res.status).toBe(200);
    const parsed = ListJobsResponse.parse(res.body);
    expect(parsed.length).toBeGreaterThan(0);
    const job = parsed.find((j) => j.id === ids.jobId);
    expect(job).toBeDefined();
    expect(job?.projectName).toBe("Test Project");
    expect(job?.automationName).toBe("Test Automation");
    expect(job?.queueName).toBe("Test Queue");
    expect(job?.machineName).toBe("seed-machine");
  });

  it("GET /api/jobs supports filtering and keeps a valid shape", async () => {
    const res = await api.get("/api/jobs").query({ status: "successful" });
    expect(res.status).toBe(200);
    const parsed = ListJobsResponse.parse(res.body);
    expect(parsed.every((j) => j.status === "successful")).toBe(true);
  });

  it("GET /api/jobs/:id returns a valid job", async () => {
    const res = await api.get(`/api/jobs/${ids.jobId}`);
    expect(res.status).toBe(200);
    const parsed = GetJobResponse.parse(res.body);
    expect(parsed.id).toBe(ids.jobId);
    expect(parsed.projectName).toBe("Test Project");
  });

  it("POST /api/jobs/:id/retry returns a valid job shape", async () => {
    const res = await api.post(`/api/jobs/${ids.jobId}/retry`);
    expect(res.status).toBe(201);
    // Retry returns the same job shape as a get.
    const parsed = GetJobResponse.parse(res.body);
    expect(parsed.attempt).toBeGreaterThanOrEqual(2);
    expect(parsed.projectName).toBe("Test Project");
  });

  it("POST /api/jobs/:id/stop returns a valid job shape", async () => {
    const res = await api.post(`/api/jobs/${ids.jobId}/stop`);
    expect(res.status).toBe(200);
    const parsed = StopJobResponse.parse(res.body);
    expect(parsed.status).toBe("stopped");
    expect(parsed.machineName).toBe("seed-machine");
  });
});
