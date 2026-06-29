import { beforeAll, describe, expect, it } from "vitest";
import {
  ListProjectsResponse,
  GetProjectResponse,
  UpdateProjectResponse,
} from "@workspace/api-zod";
import { api } from "./helpers/http";
import { resetAndSeed, type SeededIds } from "./helpers/seed";

let ids: SeededIds;

beforeAll(async () => {
  ids = await resetAndSeed();
});

describe("projects endpoints response shape", () => {
  it("GET /api/projects returns valid list items", async () => {
    const res = await api.get("/api/projects");
    expect(res.status).toBe(200);
    const parsed = ListProjectsResponse.parse(res.body);
    expect(parsed.length).toBeGreaterThan(0);
    const project = parsed.find((p) => p.id === ids.projectId);
    expect(project).toBeDefined();
    expect(project?.name).toBe("Test Project");
    expect(project?.category).toBe("backend");
  });

  it("GET /api/projects/:id returns a valid project", async () => {
    const res = await api.get(`/api/projects/${ids.projectId}`);
    expect(res.status).toBe(200);
    const parsed = GetProjectResponse.parse(res.body);
    expect(parsed.id).toBe(ids.projectId);
    expect(parsed.name).toBe("Test Project");
  });

  it("POST /api/projects creates a project with a valid shape", async () => {
    const res = await api.post("/api/projects").send({
      name: "Created Project",
      description: "made by test",
      category: "rpa",
    });
    expect(res.status).toBe(201);
    const parsed = GetProjectResponse.parse(res.body);
    expect(parsed.name).toBe("Created Project");
    expect(parsed.category).toBe("rpa");
  });

  it("PATCH /api/projects/:id updates and returns a valid shape", async () => {
    const res = await api
      .patch(`/api/projects/${ids.projectId}`)
      .send({ name: "Renamed Project", status: "inactive" });
    expect(res.status).toBe(200);
    const parsed = UpdateProjectResponse.parse(res.body);
    expect(parsed.name).toBe("Renamed Project");
    expect(parsed.status).toBe("inactive");
  });
});
