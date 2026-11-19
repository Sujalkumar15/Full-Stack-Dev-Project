import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { createAccountRegistration } from '../src/auth/registration.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp({
  cookieSecret: 'integration-cookie-secret-that-is-long-enough',
  frontendOrigin: 'http://localhost:5175',
  nodeEnv: 'test',
});

const runId = randomUUID().slice(0, 8);
const workspacePrefix = `M2 ${runId}`;
const password = 'correct horse battery staple';
const emails = {
  owner: `owner-${runId}@example.test`,
  member: `member-${runId}@example.test`,
  guest: `guest-${runId}@example.test`,
  outsider: `outsider-${runId}@example.test`,
  rollback: `rollback-${runId}@example.test`,
};

const ownerAgent = request.agent(app);
const memberAgent = request.agent(app);
const guestAgent = request.agent(app);
const outsiderAgent = request.agent(app);

let ownerId = '';
let memberId = '';
let guestId = '';
let workspaceId = '';
let outsiderWorkspaceId = '';
let rootPageId = '';
let childPageId = '';
let restrictedPageId = '';
let outsiderPageId = '';

async function register(agent: ReturnType<typeof request.agent>, email: string, name: string) {
  return agent.post('/api/auth/register').send({ email, name, password }).expect(201);
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  const testWorkspaces = await prisma.workspace.findMany({
    where: { name: { startsWith: workspacePrefix } },
    select: { id: true },
  });
  const testWorkspaceIds = testWorkspaces.map((workspace) => workspace.id);
  await prisma.pagePermission.deleteMany({
    where: { workspaceId: { in: testWorkspaceIds } },
  });
  await prisma.workspace.deleteMany({
    where: { id: { in: testWorkspaceIds } },
  });
  await prisma.user.deleteMany({
    where: { email: { in: Object.values(emails) } },
  });
  await prisma.$disconnect();
});

describe.sequential('authentication, workspaces, and pages', () => {
  it('registers users with opaque hashed sessions and returns the current user', async () => {
    const ownerResponse = await register(ownerAgent, emails.owner, 'Owner User');
    const memberResponse = await register(memberAgent, emails.member, 'Member User');
    const guestResponse = await register(guestAgent, emails.guest, 'Guest User');
    await register(outsiderAgent, emails.outsider, 'Outsider User');

    ownerId = ownerResponse.body.user.id as string;
    memberId = memberResponse.body.user.id as string;
    guestId = guestResponse.body.user.id as string;

    expect(ownerResponse.body.user).not.toHaveProperty('passwordHash');
    expect(ownerResponse.body).not.toHaveProperty('token');
    expect(ownerResponse.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(ownerResponse.headers['set-cookie']?.[0]).toContain('SameSite=Lax');

    const session = await prisma.session.findFirstOrThrow({ where: { userId: ownerId } });
    expect(session.tokenHash).toMatch(/^[a-f0-9]{64}$/);

    const currentUser = await ownerAgent.get('/api/auth/me').expect(200);
    expect(currentUser.body.user).toMatchObject({ id: ownerId, email: emails.owner });
  });

  it('rejects duplicate registration without leaving partial records', async () => {
    const before = {
      memberships: await prisma.workspaceMember.count({ where: { userId: ownerId } }),
      sessions: await prisma.session.count({ where: { userId: ownerId } }),
      users: await prisma.user.count({ where: { email: emails.owner } }),
      workspaces: await prisma.workspace.count({ where: { ownerId } }),
    };

    const duplicate = await request(app)
      .post('/api/auth/register')
      .send({ email: emails.owner.toUpperCase(), name: 'Duplicate Owner', password })
      .expect(409);
    expect(duplicate.body.error).toMatchObject({
      code: 'REGISTRATION_FAILED',
      message: 'Unable to create this account.',
    });

    expect({
      memberships: await prisma.workspaceMember.count({ where: { userId: ownerId } }),
      sessions: await prisma.session.count({ where: { userId: ownerId } }),
      users: await prisma.user.count({ where: { email: emails.owner } }),
      workspaces: await prisma.workspace.count({ where: { ownerId } }),
    }).toEqual(before);
  });

  it('rolls back the user when nested session creation fails', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: emails.owner },
      select: { passwordHash: true },
    });
    const existingSession = await prisma.session.findFirstOrThrow({
      where: { userId: ownerId },
      select: { expiresAt: true, tokenHash: true },
    });

    await expect(
      createAccountRegistration(
        prisma,
        { email: emails.rollback, name: 'Rollback User' },
        owner.passwordHash!,
        {
          expiresAt: existingSession.expiresAt,
          token: 'unused-test-token',
          tokenHash: existingSession.tokenHash,
        },
      ),
    ).rejects.toMatchObject({ code: 'P2002' });

    expect(await prisma.user.findUnique({ where: { email: emails.rollback } })).toBeNull();
  });

  it('uses generic login errors and validates authentication input', async () => {
    const invalidInput = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', name: 'A', password: 'short' })
      .expect(400);
    expect(invalidInput.body.error.code).toBe('VALIDATION_ERROR');

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: emails.owner, password: 'incorrect password' })
      .expect(401);
    const missingUser = await request(app)
      .post('/api/auth/login')
      .send({ email: `missing-${runId}@example.test`, password })
      .expect(401);
    expect(wrongPassword.body.error).toMatchObject({
      code: missingUser.body.error.code,
      message: missingUser.body.error.message,
    });
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('revokes the current session on logout and allows a fresh login', async () => {
    await ownerAgent.post('/api/auth/logout').expect(204);
    await ownerAgent.get('/api/auth/me').expect(401);
    expect(await prisma.session.count({ where: { userId: ownerId } })).toBe(0);

    const login = await ownerAgent
      .post('/api/auth/login')
      .send({ email: emails.owner, password })
      .expect(200);
    expect(login.body.user.id).toBe(ownerId);
  });

  it('creates, lists, reads, and renames an owned workspace', async () => {
    const created = await ownerAgent
      .post('/api/workspaces')
      .send({ name: `${workspacePrefix} Primary` })
      .expect(201);
    workspaceId = created.body.workspace.id as string;
    expect(created.body.workspace.role).toBe('OWNER');

    const listed = await ownerAgent.get('/api/workspaces').expect(200);
    expect(listed.body.workspaces).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: workspaceId, role: 'OWNER' })]),
    );

    await outsiderAgent.get(`/api/workspaces/${workspaceId}`).expect(404);
    const renamed = await ownerAgent
      .patch(`/api/workspaces/${workspaceId}`)
      .send({ name: `${workspacePrefix} Renamed` })
      .expect(200);
    expect(renamed.body.workspace.name).toBe(`${workspacePrefix} Renamed`);
  });

  it('enforces membership administration and workspace roles', async () => {
    const addedMember = await ownerAgent
      .post(`/api/workspaces/${workspaceId}/members`)
      .send({ email: emails.member, role: 'MEMBER' })
      .expect(201);
    expect(addedMember.body.member).toMatchObject({
      role: 'MEMBER',
      user: { email: emails.member, name: 'Member User' },
    });
    expect(addedMember.body.member.user).not.toHaveProperty('passwordHash');
    await ownerAgent
      .post(`/api/workspaces/${workspaceId}/members`)
      .send({ email: emails.guest, role: 'GUEST' })
      .expect(201);

    const members = await memberAgent.get(`/api/workspaces/${workspaceId}/members`).expect(200);
    expect(members.body.members).toHaveLength(3);
    await outsiderAgent.get(`/api/workspaces/${workspaceId}/members`).expect(404);

    await memberAgent
      .patch(`/api/workspaces/${workspaceId}`)
      .send({ name: 'Unauthorized rename' })
      .expect(403);
    await memberAgent
      .post(`/api/workspaces/${workspaceId}/members`)
      .send({ email: emails.outsider, role: 'MEMBER' })
      .expect(403);
    await memberAgent
      .patch(`/api/workspaces/${workspaceId}/members/${guestId}`)
      .send({ role: 'MEMBER' })
      .expect(403);
    await memberAgent.delete(`/api/workspaces/${workspaceId}/members/${guestId}`).expect(403);
  });

  it('creates hierarchical pages and supports update, archive, and restore', async () => {
    const root = await ownerAgent
      .post(`/api/workspaces/${workspaceId}/pages`)
      .send({ title: 'Project notes', visibility: 'WORKSPACE' })
      .expect(201);
    rootPageId = root.body.page.id as string;

    const child = await ownerAgent
      .post(`/api/workspaces/${workspaceId}/pages`)
      .send({ title: 'Decisions', parentId: rootPageId })
      .expect(201);
    childPageId = child.body.page.id as string;
    expect(child.body.page.parentId).toBe(rootPageId);

    const updated = await ownerAgent
      .patch(`/api/workspaces/${workspaceId}/pages/${childPageId}`)
      .send({ title: 'Architecture decisions', sortOrder: 2048 })
      .expect(200);
    expect(updated.body.page).toMatchObject({ title: 'Architecture decisions', sortOrder: 2048 });

    const pages = await memberAgent.get(`/api/workspaces/${workspaceId}/pages`).expect(200);
    expect(pages.body.pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: rootPageId }),
        expect.objectContaining({ id: childPageId, parentId: rootPageId }),
      ]),
    );

    await ownerAgent.post(`/api/workspaces/${workspaceId}/pages/${rootPageId}/archive`).expect(200);
    const activePages = await ownerAgent.get(`/api/workspaces/${workspaceId}/pages`).expect(200);
    expect(activePages.body.pages).toHaveLength(0);

    const archivedPages = await ownerAgent
      .get(`/api/workspaces/${workspaceId}/pages?includeArchived=true`)
      .expect(200);
    expect(archivedPages.body.pages).toHaveLength(2);

    await ownerAgent.post(`/api/workspaces/${workspaceId}/pages/${rootPageId}/restore`).expect(200);
  });

  it('denies restricted pages by default and honors guest permission levels', async () => {
    const restricted = await ownerAgent
      .post(`/api/workspaces/${workspaceId}/pages`)
      .send({ title: 'Leadership plan', visibility: 'RESTRICTED' })
      .expect(201);
    restrictedPageId = restricted.body.page.id as string;

    await guestAgent.get(`/api/workspaces/${workspaceId}/pages/${restrictedPageId}`).expect(404);
    const guestPages = await guestAgent.get(`/api/workspaces/${workspaceId}/pages`).expect(200);
    expect(guestPages.body.pages).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: restrictedPageId })]),
    );

    await ownerAgent
      .put(`/api/workspaces/${workspaceId}/pages/${restrictedPageId}/permissions/${guestId}`)
      .send({ access: 'READ' })
      .expect(200);
    await guestAgent.get(`/api/workspaces/${workspaceId}/pages/${restrictedPageId}`).expect(200);
    await guestAgent
      .patch(`/api/workspaces/${workspaceId}/pages/${restrictedPageId}`)
      .send({ title: 'Forbidden rename' })
      .expect(404);

    await ownerAgent
      .put(`/api/workspaces/${workspaceId}/pages/${restrictedPageId}/permissions/${guestId}`)
      .send({ access: 'EDIT' })
      .expect(200);
    const renamed = await guestAgent
      .patch(`/api/workspaces/${workspaceId}/pages/${restrictedPageId}`)
      .send({ title: 'Guest-visible plan' })
      .expect(200);
    expect(renamed.body.page.title).toBe('Guest-visible plan');

    const guestChild = await guestAgent
      .post(`/api/workspaces/${workspaceId}/pages`)
      .send({ title: 'Guest child', parentId: restrictedPageId })
      .expect(201);
    expect(guestChild.body.page.access).toBe('EDIT');
    await guestAgent
      .put(
        `/api/workspaces/${workspaceId}/pages/${guestChild.body.page.id}/permissions/${memberId}`,
      )
      .send({ access: 'READ' })
      .expect(404);

    await guestAgent.delete(`/api/workspaces/${workspaceId}/pages/${restrictedPageId}`).expect(404);
  });

  it('prevents cross-workspace access and parent relationships', async () => {
    const workspace = await outsiderAgent
      .post('/api/workspaces')
      .send({ name: `${workspacePrefix} Outsider` })
      .expect(201);
    outsiderWorkspaceId = workspace.body.workspace.id as string;
    const page = await outsiderAgent
      .post(`/api/workspaces/${outsiderWorkspaceId}/pages`)
      .send({ title: 'Outsider page' })
      .expect(201);
    outsiderPageId = page.body.page.id as string;

    await ownerAgent
      .get(`/api/workspaces/${outsiderWorkspaceId}/pages/${outsiderPageId}`)
      .expect(404);
    await ownerAgent.get(`/api/workspaces/${outsiderWorkspaceId}/members`).expect(404);
    await ownerAgent
      .post(`/api/workspaces/${outsiderWorkspaceId}/members`)
      .send({ email: emails.guest, role: 'MEMBER' })
      .expect(404);
    await ownerAgent
      .post(`/api/workspaces/${workspaceId}/pages`)
      .send({ title: 'Invalid child', parentId: outsiderPageId })
      .expect(404);
    await outsiderAgent.get(`/api/workspaces/${workspaceId}/pages/${rootPageId}`).expect(404);
  });

  it('rejects and removes expired sessions', async () => {
    await prisma.session.updateMany({
      where: { user: { email: emails.outsider } },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await outsiderAgent.get('/api/auth/me').expect(401);
    expect(await prisma.session.count({ where: { user: { email: emails.outsider } } })).toBe(0);
  });

  it('rejects invalid workspace and page input', async () => {
    await ownerAgent.post('/api/workspaces').send({ name: 'x' }).expect(400);
    await ownerAgent
      .post(`/api/workspaces/${workspaceId}/pages`)
      .send({ title: '   ' })
      .expect(400);
    await ownerAgent
      .patch(`/api/workspaces/${workspaceId}/pages/${rootPageId}`)
      .send({})
      .expect(400);
  });

  it('deletes page subtrees without affecting other pages', async () => {
    await ownerAgent.delete(`/api/workspaces/${workspaceId}/pages/${rootPageId}`).expect(204);
    await ownerAgent.get(`/api/workspaces/${workspaceId}/pages/${rootPageId}`).expect(404);
    await ownerAgent.get(`/api/workspaces/${workspaceId}/pages/${childPageId}`).expect(404);
    await ownerAgent.get(`/api/workspaces/${workspaceId}/pages/${restrictedPageId}`).expect(200);
  });

  it('never trusts client-provided ownership or role fields', async () => {
    const response = await memberAgent
      .post('/api/workspaces')
      .send({ name: `${workspacePrefix} Member-owned`, ownerId, role: 'OWNER' })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: memberId, workspace: { name: { startsWith: workspacePrefix } } },
    });
    expect(memberships.every((membership) => membership.role !== 'OWNER')).toBe(true);
  });
});
