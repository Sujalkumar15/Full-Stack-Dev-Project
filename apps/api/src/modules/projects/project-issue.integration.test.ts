import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { prisma } from "../../lib/prisma.js";

const suffix = randomUUID().slice(0, 8);
const accountA = {
  name: "Atlas Owner",
  email: `atlas-${suffix}@example.test`,
  password: "SecurePass!42",
  workspaceName: `Atlas Workspace ${suffix}`,
};
const accountB = {
  name: "Beacon Owner",
  email: `beacon-${suffix}@example.test`,
  password: "SecurePass!57",
  workspaceName: `Beacon Workspace ${suffix}`,
};

const agentA = request.agent(app);
const agentB = request.agent(app);
let userAId = "";
let userBId = "";
let workspaceAId = "";
let workspaceBId = "";
let membershipAId = "";
let membershipBId = "";
let projectAId = "";
let projectBId = "";
let issueAId = "";
let foreignSprintId = "";

afterAll(async () => {
  const workspaceIds = [workspaceAId, workspaceBId].filter(Boolean);
  const userIds = [userAId, userBId].filter(Boolean);
  if (workspaceIds.length) await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("project and issue tenant APIs", () => {
  it("creates two independent authenticated tenants", async () => {
    const [registrationA, registrationB] = await Promise.all([
      agentA.post("/api/auth/register").send(accountA),
      agentB.post("/api/auth/register").send(accountB),
    ]);
    expect(registrationA.status).toBe(201);
    expect(registrationB.status).toBe(201);

    userAId = registrationA.body.data.user.id as string;
    userBId = registrationB.body.data.user.id as string;
    workspaceAId = registrationA.body.data.workspace.id as string;
    workspaceBId = registrationB.body.data.workspace.id as string;
    membershipAId = registrationA.body.data.workspace.membershipId as string;
    membershipBId = registrationB.body.data.workspace.membershipId as string;
  });

  it("rejects unauthenticated project and issue requests", async () => {
    expect((await request(app).get(`/api/workspaces/${workspaceAId}/projects`)).status).toBe(401);
    expect((await request(app).post(`/api/workspaces/${workspaceAId}/projects/${randomUUID()}/issues`).send({ title: "No session" })).status).toBe(401);
  });

  it("validates project requests", async () => {
    const response = await agentA.post(`/api/workspaces/${workspaceAId}/projects`).send({ name: "A", key: "bad key" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates, lists, reads, and updates projects within each workspace", async () => {
    const createdA = await agentA.post(`/api/workspaces/${workspaceAId}/projects`).send({
      name: "Atlas Delivery",
      key: "atl",
      description: "Core delivery work",
    });
    const createdB = await agentB.post(`/api/workspaces/${workspaceBId}/projects`).send({
      name: "Beacon Launch",
      key: "BCN",
    });
    expect(createdA.status).toBe(201);
    expect(createdA.body.data.project).toMatchObject({ key: "ATL", issueCount: 0 });
    expect(createdB.status).toBe(201);
    projectAId = createdA.body.data.project.id as string;
    projectBId = createdB.body.data.project.id as string;

    const list = await agentA.get(`/api/workspaces/${workspaceAId}/projects`);
    const details = await agentA.get(`/api/workspaces/${workspaceAId}/projects/${projectAId}`);
    const updated = await agentA.patch(`/api/workspaces/${workspaceAId}/projects/${projectAId}`).send({
      name: "Atlas Product Delivery",
      description: "Updated delivery scope",
    });
    expect(list.status).toBe(200);
    expect(list.body.data.projects).toHaveLength(1);
    expect(details.body.data.project.id).toBe(projectAId);
    expect(updated.body.data.project).toMatchObject({ name: "Atlas Product Delivery", description: "Updated delivery scope" });
  });

  it("returns tenant-safe 404 responses for cross-workspace project access", async () => {
    const aToB = await agentA.get(`/api/workspaces/${workspaceBId}/projects/${projectBId}`);
    const bToA = await agentB.patch(`/api/workspaces/${workspaceAId}/projects/${projectAId}`).send({ name: "Intrusion" });
    expect(aToB.status).toBe(404);
    expect(aToB.body.error.code).toBe("WORKSPACE_NOT_FOUND");
    expect(bToA.status).toBe(404);
    expect(bToA.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("enforces project role authorization from database membership", async () => {
    await prisma.membership.create({ data: { workspaceId: workspaceAId, userId: userBId, role: "VIEWER" } });
    const response = await agentB.post(`/api/workspaces/${workspaceAId}/projects`).send({ name: "Forbidden", key: "NO" });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("validates issue requests and rejects cross-workspace relationships", async () => {
    const invalid = await agentA.post(`/api/workspaces/${workspaceAId}/projects/${projectAId}/issues`).send({ title: "x", priority: "CRITICAL" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");

    foreignSprintId = (await prisma.sprint.create({
      data: { workspaceId: workspaceBId, projectId: projectBId, name: "Foreign sprint" },
      select: { id: true },
    })).id;

    const foreignAssignee = await agentA.post(`/api/workspaces/${workspaceAId}/projects/${projectAId}/issues`).send({
      title: "Cross tenant assignee",
      assigneeMembershipId: membershipBId,
    });
    const foreignSprint = await agentA.post(`/api/workspaces/${workspaceAId}/projects/${projectAId}/issues`).send({
      title: "Cross tenant sprint",
      sprintId: foreignSprintId,
    });
    expect(foreignAssignee.status).toBe(404);
    expect(foreignAssignee.body.error.code).toBe("ASSIGNEE_NOT_FOUND");
    expect(foreignSprint.status).toBe(404);
    expect(foreignSprint.body.error.code).toBe("SPRINT_NOT_FOUND");
  });

  it("creates, lists, reads, and updates an issue with a stable identifier", async () => {
    const created = await agentA.post(`/api/workspaces/${workspaceAId}/projects/${projectAId}/issues`).send({
      title: "Ship the Kanban board",
      description: "Persist status transitions",
      priority: "HIGH",
      assigneeMembershipId: membershipAId,
    });
    expect(created.status).toBe(201);
    expect(created.body.data.issue).toMatchObject({ identifier: "ATL-1", status: "TODO", priority: "HIGH" });
    issueAId = created.body.data.issue.id as string;

    const list = await agentA.get(`/api/workspaces/${workspaceAId}/projects/${projectAId}/issues`);
    const details = await agentA.get(`/api/workspaces/${workspaceAId}/projects/${projectAId}/issues/${issueAId}`);
    expect(list.status).toBe(200);
    expect(list.body.data.issues).toHaveLength(1);
    expect(details.body.data.issue.assignee.membershipId).toBe(membershipAId);

    const updated = await agentA.patch(`/api/workspaces/${workspaceAId}/projects/${projectAId}/issues/${issueAId}`).send({
      title: "Ship the production Kanban board",
      description: "Optimistic updates with rollback",
      priority: "URGENT",
      status: "IN_PROGRESS",
      assigneeMembershipId: null,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.issue).toMatchObject({
      title: "Ship the production Kanban board",
      status: "IN_PROGRESS",
      priority: "URGENT",
      assignee: null,
    });

    const persisted = await prisma.issue.findUniqueOrThrow({ where: { id: issueAId } });
    expect(persisted.status).toBe("IN_PROGRESS");
  });

  it("prevents VIEWER members from mutating issues", async () => {
    const update = await agentB
      .patch(`/api/workspaces/${workspaceAId}/projects/${projectAId}/issues/${issueAId}`)
      .send({ status: "DONE" });
    const removal = await agentB.delete(`/api/workspaces/${workspaceAId}/projects/${projectAId}/issues/${issueAId}`);
    expect(update.status).toBe(403);
    expect(update.body.error.code).toBe("FORBIDDEN");
    expect(removal.status).toBe(403);
    expect(removal.body.error.code).toBe("FORBIDDEN");
  });

  it("prevents foreign project and issue reads after workspace membership checks", async () => {
    const wrongProject = await agentA.get(`/api/workspaces/${workspaceAId}/projects/${projectBId}`);
    const wrongIssue = await agentB.get(`/api/workspaces/${workspaceBId}/projects/${projectBId}/issues/${issueAId}`);
    expect(wrongProject.status).toBe(404);
    expect(wrongProject.body.error.code).toBe("PROJECT_NOT_FOUND");
    expect(wrongIssue.status).toBe(404);
    expect(wrongIssue.body.error.code).toBe("ISSUE_NOT_FOUND");
  });

  it("deletes issues and projects without affecting another tenant", async () => {
    expect((await agentA.delete(`/api/workspaces/${workspaceAId}/projects/${projectAId}/issues/${issueAId}`)).status).toBe(204);
    expect((await agentA.delete(`/api/workspaces/${workspaceAId}/projects/${projectAId}`)).status).toBe(204);
    expect((await agentA.get(`/api/workspaces/${workspaceAId}/projects/${projectAId}`)).status).toBe(404);
    expect((await agentB.get(`/api/workspaces/${workspaceBId}/projects/${projectBId}`)).status).toBe(200);
  });
});
