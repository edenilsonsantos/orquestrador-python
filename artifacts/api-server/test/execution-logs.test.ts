import { beforeAll, describe, expect, it } from "vitest";
import {
  ListExecutionLogsResponse,
  ListExecutionLogsResponseItem,
} from "@workspace/api-zod";
import { api } from "./helpers/http";
import { resetAndSeed, type SeededIds } from "./helpers/seed";

let ids: SeededIds;

beforeAll(async () => {
  ids = await resetAndSeed();
});

describe("execution-logs endpoints response shape", () => {
  it("GET /api/execution-logs returns valid list items", async () => {
    const res = await api.get("/api/execution-logs");
    expect(res.status).toBe(200);
    const parsed = ListExecutionLogsResponse.parse(res.body);
    expect(parsed.length).toBeGreaterThan(0);
    const log = parsed.find((l) => l.id === ids.executionLogId);
    expect(log).toBeDefined();
    expect(log?.id_execucao).toBe(ids.executionLogExecucao);
    expect(log?.vm).toBe("seed-vm");
    expect(log?.fila).toBe("seed-fila");
  });

  it("GET /api/execution-logs?id_execucao filters and keeps a valid shape", async () => {
    const res = await api.get(
      `/api/execution-logs?id_execucao=${ids.executionLogExecucao}`,
    );
    expect(res.status).toBe(200);
    const parsed = ListExecutionLogsResponse.parse(res.body);
    expect(parsed.length).toBeGreaterThan(0);
    expect(
      parsed.every((l) => l.id_execucao === ids.executionLogExecucao),
    ).toBe(true);
  });

  it("POST /api/execution-logs ingests a log with a valid shape when authenticated", async () => {
    const res = await api
      .post("/api/execution-logs")
      .set("x-api-key", ids.apiKeyPlaintext)
      .send({
        id_execucao: 99,
        id_automacao: ids.automationId,
        vm: "ingest-vm",
        fila: "ingest-fila",
        fields: { ok: true },
      });
    expect(res.status).toBe(201);
    const parsed = ListExecutionLogsResponseItem.parse(res.body);
    expect(parsed.id_execucao).toBe(99);
    expect(parsed.vm).toBe("ingest-vm");
  });

  it("POST /api/execution-logs rejects requests without an API key", async () => {
    const res = await api.post("/api/execution-logs").send({
      id_execucao: 100,
      id_automacao: ids.automationId,
      vm: "no-auth-vm",
      fila: "no-auth-fila",
    });
    expect(res.status).toBe(401);
  });
});
