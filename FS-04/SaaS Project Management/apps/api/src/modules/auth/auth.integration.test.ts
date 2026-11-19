import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import express from "express";
import request, { type Response } from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate } from "../../middleware/authenticate.js";
import { errorHandler } from "../../middleware/error-handler.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { requireWorkspaceMembership, requireWorkspaceRoles } from "../workspaces/workspace-access.middleware.js";
import { workspaceParamsSchema } from "../workspaces/workspace.schemas.js";

const suffix = randomUUID().slice(0, 8);
const passwordA = "SecurePass!42";
const passwordB = "AnotherPass!57";
const accountA = {
  name: "Alpha Owner",
  email: `alpha-${suffix}@example.test`,
  password: passwordA,
  workspaceName: `Alpha Workspace ${suffix}`,
};
const accountB = {
  name: "Beta Owner",
  email: `beta-${suffix}@example.test`,
  password: passwordB,
  workspaceName: `Beta Workspace ${suffix}`,
};

const agentA = request.agent(app);
const agentB = request.agent(app);
let userAId = "";
let userBId = "";
let workspaceAId = "";
let workspaceBId = "";
let cookieA = "";
let cookieB = "";

function getCookie(response: Response): string {
  const header = response.headers["set-cookie"];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) throw new Error("Expected an authentication cookie");
  return value.split(";", 1)[0] ?? "";
}

const roleTestApp = express();
roleTestApp.use(cookieParser());
roleTestApp.get(
  "/workspaces/:workspaceId/admin-only",
  authenticate,
  validateRequest({ params: workspaceParamsSchema }),
  requireWorkspaceMembership,
  requireWorkspaceRoles("OWNER", "ADMIN"),
  (_request, response) => response.status(204).send(),
);
roleTestApp.use(errorHandler);

afterAll(async () => {
  const workspaceIds = [workspaceAId, workspaceBId].filter(Boolean);
  const userIds = [userAId, userBId].filter(Boolean);
  if (workspaceIds.length) await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("authentication and tenant isolation", () => {
  it("registers a user, workspace, and OWNER membership in one flow", async () => {
    const response = await agentA.post("/api/auth/register").send(accountA);

    expect(response.status).toBe(201);
    expect(response.body.data.user).toMatchObject({ email: accountA.email, displayName: accountA.name });
    expect(response.body.data.workspace).toMatchObject({ name: accountA.workspaceName, role: "OWNER" });
    expect(response.headers["set-cookie"]?.join(";")).toContain("HttpOnly");
    expect(response.headers["set-cookie"]?.join(";")).toContain("SameSite=Lax");

    userAId = response.body.data.user.id as string;
    workspaceAId = response.body.data.workspace.id as string;
    cookieA = getCookie(response);

    const storedUser = await prisma.user.findUniqueOrThrow({ where: { id: userAId } });
    expect(storedUser.passwordHash).not.toBe(passwordA);
    expect(await bcrypt.compare(passwordA, storedUser.passwordHash)).toBe(true);
    const membership = await prisma.membership.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId: workspaceAId, userId: userAId } },
    });
    expect(membership).toMatchObject({ role: "OWNER", isActive: true });
  });

  it("rejects duplicate email registration", async () => {
    const response = await request(app).post("/api/auth/register").send({ ...accountA, workspaceName: "Duplicate" });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("creates a second isolated user and workspace", async () => {
    const response = await agentB.post("/api/auth/register").send(accountB);
    expect(response.status).toBe(201);
    userBId = response.body.data.user.id as string;
    workspaceBId = response.body.data.workspace.id as string;
    cookieB = getCookie(response);
    expect(workspaceBId).not.toBe(workspaceAId);
  });

  it("rejects an invalid login without revealing which credential failed", async () => {
    const response = await request(app).post("/api/auth/login").send({ email: accountA.email, password: "IncorrectPass!9" });
    expect(response.status).toBe(401);
    expect(response.body.error).toEqual({ code: "INVALID_CREDENTIALS", message: "Invalid email or password" });
  });

  it("logs in successfully and issues an HttpOnly cookie", async () => {
    const response = await agentA.post("/api/auth/login").send({ email: accountA.email, password: passwordA });
    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(accountA.email);
    cookieA = getCookie(response);
    expect(response.headers["set-cookie"]?.join(";")).toContain("HttpOnly");
  });

  it("never exposes a password hash from auth or workspace endpoints", async () => {
    const me = await agentA.get("/api/auth/me");
    const workspaces = await agentA.get("/api/workspaces");
    expect(me.status).toBe(200);
    expect(workspaces.status).toBe(200);
    expect(JSON.stringify([me.body, workspaces.body])).not.toMatch(/password(?:Hash|_hash)?/i);
  });

  it("logs out by clearing the cookie and rejects the cleared session", async () => {
    const logout = await agentA.post("/api/auth/logout");
    expect(logout.status).toBe(200);
    expect(logout.headers["set-cookie"]?.join(";")).toContain("saas_session=;");
    expect((await agentA.get("/api/auth/me")).status).toBe(401);

    const login = await agentA.post("/api/auth/login").send({ email: accountA.email, password: passwordA });
    cookieA = getCookie(login);
  });

  it("rejects unauthenticated workspace access", async () => {
    expect((await request(app).get("/api/workspaces")).status).toBe(401);
    expect((await request(app).get(`/api/workspaces/${workspaceAId}`)).status).toBe(401);
  });

  it("returns only active memberships and derives workspace role from the database", async () => {
    const list = await request(app).get("/api/workspaces").set("Cookie", cookieA);
    const details = await request(app).get(`/api/workspaces/${workspaceAId}`).set("Cookie", cookieA);
    expect(list.status).toBe(200);
    expect(list.body.data.workspaces).toHaveLength(1);
    expect(list.body.data.workspaces[0]).toMatchObject({ id: workspaceAId, role: "OWNER" });
    expect(details.status).toBe(200);
    expect(details.body.data.workspace).toMatchObject({ id: workspaceAId, role: "OWNER" });
  });

  it("rejects cross-tenant access even when a foreign userId or role is supplied", async () => {
    const aToB = await request(app).get(`/api/workspaces/${workspaceBId}?userId=${userBId}&role=OWNER`).set("Cookie", cookieA);
    const bToA = await request(app).get(`/api/workspaces/${workspaceAId}?userId=${userAId}&role=OWNER`).set("Cookie", cookieB);
    expect(aToB.status).toBe(404);
    expect(bToA.status).toBe(404);
    expect(aToB.body.error.code).toBe("WORKSPACE_NOT_FOUND");
    expect(bToA.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("enforces database-derived role authorization", async () => {
    await prisma.membership.create({ data: { workspaceId: workspaceAId, userId: userBId, role: "VIEWER" } });

    const viewerAttempt = await request(roleTestApp)
      .get(`/workspaces/${workspaceAId}/admin-only?role=OWNER`)
      .set("Cookie", cookieB)
      .set("x-workspace-role", "OWNER");
    expect(viewerAttempt.status).toBe(403);
    expect(viewerAttempt.body.error.code).toBe("FORBIDDEN");

    await prisma.membership.update({
      where: { workspaceId_userId: { workspaceId: workspaceAId, userId: userBId } },
      data: { role: "ADMIN" },
    });
    const adminAttempt = await request(roleTestApp).get(`/workspaces/${workspaceAId}/admin-only`).set("Cookie", cookieB);
    expect(adminAttempt.status).toBe(204);
  });

  it("excludes deactivated memberships from tenant access", async () => {
    await prisma.membership.update({
      where: { workspaceId_userId: { workspaceId: workspaceAId, userId: userBId } },
      data: { isActive: false, deactivatedAt: new Date() },
    });
    const response = await request(app).get(`/api/workspaces/${workspaceAId}`).set("Cookie", cookieB);
    expect(response.status).toBe(404);
  });
});
