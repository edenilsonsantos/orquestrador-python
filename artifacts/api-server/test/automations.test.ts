import { beforeAll, describe, expect, it } from "vitest";
import {
  ListAutomationsResponse,
  GetAutomationResponse,
  UpdateAutomationResponse,
  GetRecentJobsResponseItem,
} from "@workspace/api-zod";
import { api } from "./helpers/http";
import { resetAndSeed, type SeededIds } from "./helpers/seed";

let ids: SeededIds;

beforeAll(async () => {
  ids = await resetAndSeed();
});

describe("automations endpoints response shape", () => {
  it("GET /api/automations returns valid list items with joined project name", async () => {
    const res = await api.get("/api/automations");
    expect(res.status).toBe(200);
    const parsed = ListAutomationsResponse.parse(res.body);
    expect(parsed.length).toBeGreaterThan(0);
    const automation = parsed.find((a) => a.id === ids.automationId);
    expect(automation).toBeDefined();
    expect(automation?.name).toBe("Test Automation");
    expect(automation?.projectName).toBe("Test Project");
  });

  it("GET /api/automations?projectId filters and keeps a valid shape", async () => {
    const res = await api.get(`/api/automations?projectId=${ids.projectId}`);
    expect(res.status).toBe(200);
    const parsed = ListAutomationsResponse.parse(res.body);
    expect(parsed.every((a) => a.projectId === ids.projectId)).toBe(true);
  });

  it("GET /api/automations/:id returns a valid automation with joined project name", async () => {
    const res = await api.get(`/api/automations/${ids.automationId}`);
    expect(res.status).toBe(200);
    const parsed = GetAutomationResponse.parse(res.body);
    expect(parsed.id).toBe(ids.automationId);
    expect(parsed.projectName).toBe("Test Project");
  });

  it("POST /api/automations creates an automation with a valid shape", async () => {
    const res = await api.post("/api/automations").send({
      projectId: ids.projectId,
      name: "Created Automation",
      entrypoint: "run.py",
    });
    expect(res.status).toBe(201);
    const parsed = GetAutomationResponse.parse(res.body);
    expect(parsed.name).toBe("Created Automation");
    expect(parsed.projectName).toBe("Test Project");
  });

  it("PATCH /api/automations/:id updates and returns a valid shape", async () => {
    const res = await api
      .patch(`/api/automations/${ids.automationId}`)
      .send({ name: "Renamed Automation", active: false });
    expect(res.status).toBe(200);
    const parsed = UpdateAutomationResponse.parse(res.body);
    expect(parsed.name).toBe("Renamed Automation");
    expect(parsed.active).toBe(false);
    expect(parsed.projectName).toBe("Test Project");
  });

  it("POST /api/automations/:id/jobs starts a job with a valid joined shape", async () => {
    const res = await api
      .post(`/api/automations/${ids.automationId}/jobs`)
      .send({ queueId: ids.queueId, machineId: ids.machineId });
    expect(res.status).toBe(201);
    const parsed = GetRecentJobsResponseItem.parse(res.body);
    expect(parsed.automationId).toBe(ids.automationId);
    expect(parsed.projectId).toBe(ids.projectId);
    expect(parsed.status).toBe("pending");
    expect(typeof parsed.automationName).toBe("string");
    expect(parsed.automationName?.length).toBeGreaterThan(0);
    expect(parsed.projectName).toBe("Test Project");
  });
});
