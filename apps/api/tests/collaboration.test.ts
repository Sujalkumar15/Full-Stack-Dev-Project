import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import * as encoding from 'lib0/encoding';
import request from 'supertest';
import { WebSocket as NodeWebSocket } from 'ws';
import { WebsocketProvider } from 'y-websocket';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { CollaborationServer } from '../src/collaboration/server.js';
import { prisma } from '../src/lib/prisma.js';

const cookieSecret = 'collaboration-integration-secret-that-is-long-enough';
const frontendOrigin = 'http://localhost:5175';
const app = createApp({ cookieSecret, frontendOrigin, nodeEnv: 'test' });
const ownerAgent = request.agent(app);
const readerAgent = request.agent(app);
const runId = randomUUID().slice(0, 8);
const workspaceName = `M3 ${runId}`;
const password = 'correct horse battery staple';
const ownerEmail = `collaboration-owner-${runId}@example.test`;
const readerEmail = `collaboration-reader-${runId}@example.test`;

let httpServer: Server;
let collaborationServer: CollaborationServer;
let websocketBaseUrl = '';
let ownerId = '';
let readerId = '';
let workspaceId = '';
let pageId = '';
const liveProviders: WebsocketProvider[] = [];
let durableUpdate = new Uint8Array();

interface CollaborationCredentials {
  token: string;
  access: 'READ' | 'COMMENT' | 'EDIT' | 'MANAGE';
  user: { id: string; name: string; avatarUrl: string | null; color: string };
}

function startCollaborationServer() {
  collaborationServer = new CollaborationServer(httpServer, prisma, {
    tokenSecret: cookieSecret,
    frontendOrigin,
    compactionUpdateThreshold: 100,
    roomCleanupDelayMilliseconds: 25,
    permissionRevalidationMilliseconds: 60_000,
  });
}

function waitFor(condition: () => boolean, message: string, timeout = 5_000): Promise<void> {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (condition()) {
        resolve();
        return;
      }
      if (Date.now() - startedAt >= timeout) {
        reject(new Error(`Timed out waiting for ${message}.`));
        return;
      }
      setTimeout(check, 20);
    };
    check();
  });
}

async function collaborationCredentials(
  agent: ReturnType<typeof request.agent>,
): Promise<CollaborationCredentials> {
  const response = await agent
    .post(`/api/workspaces/${workspaceId}/pages/${pageId}/collaboration-token`)
    .expect(200);
  return response.body as CollaborationCredentials;
}

function connectDocument(token: string): { document: Y.Doc; provider: WebsocketProvider } {
  const document = new Y.Doc();
  const provider = new WebsocketProvider(websocketBaseUrl, pageId, document, {
    params: { token },
    WebSocketPolyfill: NodeWebSocket as unknown as typeof WebSocket,
    disableBc: true,
    maxBackoffTime: 250,
  });
  liveProviders.push(provider);
  return { document, provider };
}

async function closeProvider(provider: WebsocketProvider, document: Y.Doc): Promise<void> {
  provider.shouldConnect = false;
  provider.destroy();
  document.destroy();
  const index = liveProviders.indexOf(provider);
  if (index >= 0) liveProviders.splice(index, 1);
}

beforeAll(async () => {
  await prisma.$connect();
  httpServer = createServer(app);
  startCollaborationServer();
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address() as AddressInfo;
  websocketBaseUrl = `ws://127.0.0.1:${address.port}/api/collaboration`;

  const ownerRegistration = await ownerAgent
    .post('/api/auth/register')
    .send({ email: ownerEmail, name: 'Collaboration Owner', password })
    .expect(201);
  const readerRegistration = await readerAgent
    .post('/api/auth/register')
    .send({ email: readerEmail, name: 'Read Only User', password })
    .expect(201);
  ownerId = ownerRegistration.body.user.id as string;
  readerId = readerRegistration.body.user.id as string;

  const workspace = await ownerAgent
    .post('/api/workspaces')
    .send({ name: workspaceName })
    .expect(201);
  workspaceId = workspace.body.workspace.id as string;
  await ownerAgent
    .post(`/api/workspaces/${workspaceId}/members`)
    .send({ email: readerEmail, role: 'GUEST' })
    .expect(201);
  const page = await ownerAgent
    .post(`/api/workspaces/${workspaceId}/pages`)
    .send({ title: 'Collaborative document', visibility: 'RESTRICTED' })
    .expect(201);
  pageId = page.body.page.id as string;
  await ownerAgent
    .put(`/api/workspaces/${workspaceId}/pages/${pageId}/permissions/${readerId}`)
    .send({ access: 'READ' })
    .expect(200);
});

afterAll(async () => {
  for (const provider of liveProviders.splice(0)) {
    provider.shouldConnect = false;
    provider.destroy();
    provider.doc.destroy();
  }
  await collaborationServer.shutdown();
  await new Promise<void>((resolve, reject) => {
    httpServer.close((error) => (error ? reject(error) : resolve()));
  });
  const workspace = await prisma.workspace.findFirst({
    where: { name: workspaceName },
    select: { id: true },
  });
  if (workspace) {
    await prisma.documentVersion.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.workspace.delete({ where: { id: workspace.id } });
  }
  await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, readerEmail] } } });
  await prisma.$disconnect();
});

describe.sequential('authenticated Yjs collaboration', () => {
  it('issues short-lived page-scoped credentials with server-derived identity', async () => {
    await request(app)
      .post(`/api/workspaces/${workspaceId}/pages/${pageId}/collaboration-token`)
      .expect(401);
    const credentials = await collaborationCredentials(ownerAgent);
    expect(credentials.access).toBe('MANAGE');
    expect(credentials.user).toMatchObject({ id: ownerId, name: 'Collaboration Owner' });
    expect(credentials.token.split('.')).toHaveLength(2);

    const wrongPageId = randomUUID();
    const socket = new NodeWebSocket(
      `${websocketBaseUrl}/${wrongPageId}?token=${credentials.token}`,
    );
    const closeCode = await new Promise<number>((resolve, reject) => {
      socket.once('close', (code) => resolve(code));
      socket.once('error', reject);
    });
    expect(closeCode).toBe(4401);
  });

  it('synchronizes Yjs updates and persists accepted binary updates before broadcast', async () => {
    const firstCredentials = await collaborationCredentials(ownerAgent);
    const secondCredentials = await collaborationCredentials(ownerAgent);
    const first = connectDocument(firstCredentials.token);
    const second = connectDocument(secondCredentials.token);
    await waitFor(() => first.provider.synced && second.provider.synced, 'both editors to sync');

    first.provider.awareness.setLocalStateField('user', {
      id: readerId,
      name: 'Spoofed User',
      color: '#000000',
    });
    await waitFor(
      () =>
        Array.from(second.provider.awareness.getStates().values()).some(
          (state) => (state.user as { id?: string } | undefined)?.id === ownerId,
        ),
      'sanitized awareness identity',
    );
    expect(
      Array.from(second.provider.awareness.getStates().values()).some(
        (state) => (state.user as { id?: string } | undefined)?.id === readerId,
      ),
    ).toBe(false);

    first.document.getText('integration').insert(0, 'Durable collaboration');
    durableUpdate = Y.encodeStateAsUpdate(first.document);
    await waitFor(
      () => second.document.getText('integration').toString() === 'Durable collaboration',
      'the remote update',
    );
    await waitFor(
      () => second.document.getText('integration').toString() === 'Durable collaboration',
      'the persisted broadcast',
    );
    const updateCount = await prisma.yjsUpdate.count({ where: { workspaceId, pageId } });
    expect(updateCount).toBeGreaterThan(0);

    await closeProvider(first.provider, first.document);
    await closeProvider(second.provider, second.document);
  }, 15_000);

  it('allows READ users to receive updates but rejects their document writes', async () => {
    const credentials = await collaborationCredentials(readerAgent);
    expect(credentials.access).toBe('READ');
    const reader = connectDocument(credentials.token);
    await waitFor(() => reader.provider.synced, 'the read-only client to sync');
    expect(reader.document.getText('integration').toString()).toBe('Durable collaboration');

    const closed = new Promise<number>((resolve) => {
      reader.provider.once('connection-close', (event: CloseEvent | null) => {
        reader.provider.shouldConnect = false;
        resolve(event?.code ?? 0);
      });
    });
    reader.document.getText('integration').insert(0, 'Forbidden ');
    expect(await closed).toBe(4403);

    const owner = connectDocument((await collaborationCredentials(ownerAgent)).token);
    await waitFor(() => owner.provider.synced, 'the verification client to sync');
    expect(owner.document.getText('integration').toString()).toBe('Durable collaboration');
    await closeProvider(reader.provider, reader.document);
    await closeProvider(owner.provider, owner.document);
  }, 15_000);

  it('invalidates a live connection when page permission is revoked', async () => {
    const reader = connectDocument((await collaborationCredentials(readerAgent)).token);
    await waitFor(() => reader.provider.synced, 'the reader connection');
    const closed = new Promise<number>((resolve) => {
      reader.provider.once('connection-close', (event: CloseEvent | null) => {
        reader.provider.shouldConnect = false;
        resolve(event?.code ?? 0);
      });
    });
    await ownerAgent
      .delete(`/api/workspaces/${workspaceId}/pages/${pageId}/permissions/${readerId}`)
      .expect(204);
    expect(await closed).toBe(4403);
    await closeProvider(reader.provider, reader.document);
    await readerAgent
      .post(`/api/workspaces/${workspaceId}/pages/${pageId}/collaboration-token`)
      .expect(404);
  }, 15_000);

  it('compacts safely on shutdown and restores the Y.Doc after a server restart', async () => {
    await collaborationServer.shutdown();
    const persisted = await prisma.yjsDocument.findUniqueOrThrow({ where: { pageId } });
    expect(persisted.snapshot.length).toBeGreaterThan(0);
    expect(persisted.snapshotSeq).toBeGreaterThan(0n);
    expect(await prisma.yjsUpdate.count({ where: { workspaceId, pageId } })).toBe(0);
    expect(await prisma.documentVersion.count({ where: { workspaceId, pageId } })).toBeGreaterThan(
      0,
    );

    startCollaborationServer();
    const restored = connectDocument((await collaborationCredentials(ownerAgent)).token);
    await waitFor(() => restored.provider.synced, 'the restored document to sync');
    expect(restored.document.getText('integration').toString()).toBe('Durable collaboration');

    const duplicateMessage = encoding.createEncoder();
    encoding.writeVarUint(duplicateMessage, 0);
    syncProtocol.writeUpdate(duplicateMessage, durableUpdate);
    restored.provider.ws?.send(encoding.toUint8Array(duplicateMessage));
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(await prisma.yjsUpdate.count({ where: { workspaceId, pageId } })).toBe(0);
    await closeProvider(restored.provider, restored.document);
  }, 15_000);
});
