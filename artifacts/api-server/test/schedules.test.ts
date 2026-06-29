import { beforeAll, describe, expect, it } from "vitest";
import {
  ListSchedulesResponse,
  GetScheduleResponse,
  UpdateScheduleResponse,
  ToggleScheduleResponse,
} from "@workspace/api-zod";
import { api } from "./helpers/http";
import { resetAndSeed, type SeededIds } from "./helpers/seed";

let ids: SeededIds;

beforeAll(async () => {
  ids = await resetAndSeed();
});

describe("schedules endpoints response shape", () => {
  it("GET /api/schedules returns valid list items with joined names", async () => {
    const res = await api.get("/api/schedules");
    expect(res.status).toBe(200);
    const parsed = ListSchedulesResponse.parse(res.body);
    expect(parsed.length).toBeGreaterThan(0);
    const cron = parsed.find((s) => s.id === ids.cronScheduleId);
    expect(cron).toBeDefined();
    expect(cron?.automationName).toBe("Test Automation");
    expect(cron?.queueName).toBe("Test Queue");
    expect(cron?.targetMachineName).toBe("seed-machine");
  });

  it("GET /api/schedules/:id returns a valid schedule", async () => {
    const res = await api.get(`/api/schedules/${ids.cronScheduleId}`);
    expect(res.status).toBe(200);
    const parsed = GetScheduleResponse.parse(res.body);
    expect(parsed.id).toBe(ids.cronScheduleId);
    expect(parsed.automationName).toBe("Test Automation");
  });

  it("POST /api/schedules creates a schedule with a valid shape", async () => {
    const res = await api.post("/api/schedules").send({
      name: "Created Schedule",
      automationId: ids.automationId,
      queueId: ids.queueId,
      triggerType: "cron",
      cronExpression: "*/5 * * * *",
    });
    expect(res.status).toBe(201);
    const parsed = GetScheduleResponse.parse(res.body);
    expect(parsed.name).toBe("Created Schedule");
    expect(parsed.automationName).toBe("Test Automation");
  });

  it("PATCH /api/schedules/:id updates and returns a valid shape", async () => {
    const res = await api
      .patch(`/api/schedules/${ids.cronScheduleId}`)
      .send({ name: "Renamed Schedule" });
    expect(res.status).toBe(200);
    const parsed = UpdateScheduleResponse.parse(res.body);
    expect(parsed.name).toBe("Renamed Schedule");
    expect(parsed.queueName).toBe("Test Queue");
  });

  it("POST /api/schedules/:id/toggle toggles and returns a valid shape", async () => {
    const res = await api
      .post(`/api/schedules/${ids.cronScheduleId}/toggle`)
      .send({ enabled: false });
    expect(res.status).toBe(200);
    const parsed = ToggleScheduleResponse.parse(res.body);
    expect(parsed.enabled).toBe(false);
  });
});
