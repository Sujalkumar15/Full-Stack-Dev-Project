import type { Server as HttpServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

import type { PageAccess, PrismaClient, User } from '@prisma/client';
import { WebSocketServer } from 'ws';

import { prisma } from '../lib/prisma.js';
import { requirePageAccess } from '../permissions/page.js';
import { registerCollaborationController, type CollaborationConnectionController } from './hub.js';
import { createCollaborationIdentity } from './identity.js';
import { YjsPostgresPersistence } from './persistence.js';
import { CollaborationRoom, type CollaborationConnection } from './room.js';
import { verifyCollaborationToken, type CollaborationTokenClaims } from './token.js';

const pagePathPattern = /^\/api\/collaboration\/([0-9a-f-]{36})$/i;
interface AuthorizedConnection {
  claims: CollaborationTokenClaims;
  access: PageAccess;
  user: User;
}

export interface CollaborationServerOptions {
  tokenSecret: string;
  frontendOrigin: string;
  compactionUpdateThreshold?: number;
  roomCleanupDelayMilliseconds?: number;
  permissionRevalidationMilliseconds?: number;
}

class CollaborationRoomManager {
  private readonly persistence: YjsPostgresPersistence;
  private readonly rooms = new Map<string, CollaborationRoom>();
  private readonly roomLoads = new Map<string, Promise<CollaborationRoom>>();
  private readonly cleanupTimers = new Map<string, NodeJS.Timeout>();
  private readonly compactionTimer: NodeJS.Timeout;

  constructor(
    database: PrismaClient,
    private readonly compactionUpdateThreshold: number,
    private readonly cleanupDelayMilliseconds: number,
  ) {
    this.persistence = new YjsPostgresPersistence(database);
    this.compactionTimer = setInterval(
      () => {
        for (const room of this.rooms.values()) {
          void room.flushAndCompact().catch((error: unknown) => {
            console.error('Periodic Yjs compaction failed.', error);
          });
        }
      },
      5 * 60 * 1_000,
    );
    this.compactionTimer.unref();
  }

  async prepare(workspaceId: string, pageId: string): Promise<CollaborationRoom> {
    const cleanupTimer = this.cleanupTimers.get(pageId);
    if (cleanupTimer) {
      clearTimeout(cleanupTimer);
      this.cleanupTimers.delete(pageId);
    }
    return this.getOrLoadRoom(workspaceId, pageId);
  }

  connect(connection: CollaborationConnection, room: CollaborationRoom): void {
    const cleanupTimer = this.cleanupTimers.get(connection.pageId);
    if (cleanupTimer) {
      clearTimeout(cleanupTimer);
      this.cleanupTimers.delete(connection.pageId);
    }
    room.addConnection(connection);
  }

  scheduleRelease(room: CollaborationRoom): void {
    if (room.connectionCount > 0 || this.cleanupTimers.has(room.pageId)) return;
    const timer = setTimeout(() => {
      this.cleanupTimers.delete(room.pageId);
      if (room.connectionCount > 0 || this.rooms.get(room.pageId) !== room) return;
      this.rooms.delete(room.pageId);
      void room
        .destroy()
        .catch((error: unknown) => console.error('Yjs room cleanup failed.', error));
    }, this.cleanupDelayMilliseconds);
    timer.unref();
    this.cleanupTimers.set(room.pageId, timer);
  }

  async shutdown(): Promise<void> {
    clearInterval(this.compactionTimer);
    for (const timer of this.cleanupTimers.values()) clearTimeout(timer);
    this.cleanupTimers.clear();
    await Promise.all(Array.from(this.rooms.values(), (room) => room.destroy()));
    this.rooms.clear();
    this.roomLoads.clear();
  }

  private async getOrLoadRoom(workspaceId: string, pageId: string): Promise<CollaborationRoom> {
    const existing = this.rooms.get(pageId);
    if (existing) return existing;
    const pending = this.roomLoads.get(pageId);
    if (pending) return pending;

    const load = this.persistence
      .loadDocument(workspaceId, pageId)
      .then(
        ({ document, pendingUpdateCount }) =>
          new CollaborationRoom(
            workspaceId,
            pageId,
            document,
            this.persistence,
            pendingUpdateCount,
            this.compactionUpdateThreshold,
          ),
      )
      .then((room) => {
        this.rooms.set(pageId, room);
        return room;
      })
      .finally(() => this.roomLoads.delete(pageId));
    this.roomLoads.set(pageId, load);
    return load;
  }
}

export class CollaborationServer implements CollaborationConnectionController {
  private readonly websocketServer = new WebSocketServer({ noServer: true, maxPayload: 1_000_000 });
  private readonly roomManager: CollaborationRoomManager;
  private readonly connections = new Map<CollaborationConnection, CollaborationRoom>();
  private readonly revalidationTimer: NodeJS.Timeout;
  private shuttingDown = false;
  private readonly handleUpgradeBound: (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => void;

  constructor(
    private readonly httpServer: HttpServer,
    private readonly database: PrismaClient,
    private readonly options: CollaborationServerOptions,
  ) {
    this.roomManager = new CollaborationRoomManager(
      database,
      options.compactionUpdateThreshold ?? 100,
      options.roomCleanupDelayMilliseconds ?? 30_000,
    );
    this.handleUpgradeBound = (request, socket, head) => {
      void this.handleUpgrade(request, socket, head);
    };
    httpServer.on('upgrade', this.handleUpgradeBound);
    this.revalidationTimer = setInterval(() => {
      void this.revalidateAllConnections();
    }, options.permissionRevalidationMilliseconds ?? 60_000);
    this.revalidationTimer.unref();
    registerCollaborationController(this);
  }

  closeSessionConnections(sessionId: string): void {
    for (const connection of this.connections.keys()) {
      if (connection.sessionId === sessionId) {
        connection.socket.close(4401, 'Session revoked.');
      }
    }
  }

  async revalidateWorkspaceConnections(workspaceId: string): Promise<void> {
    const relevantConnections = Array.from(this.connections.keys()).filter(
      (connection) => connection.workspaceId === workspaceId,
    );
    await Promise.all(
      relevantConnections.map((connection) => this.revalidateConnection(connection)),
    );
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    registerCollaborationController(null);
    clearInterval(this.revalidationTimer);
    this.httpServer.off('upgrade', this.handleUpgradeBound);
    for (const connection of this.connections.keys()) {
      connection.socket.close(1012, 'Server is shutting down.');
    }
    await this.roomManager.shutdown();
    this.connections.clear();
    await new Promise<void>((resolve) => this.websocketServer.close(() => resolve()));
  }

  private async handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void> {
    if (this.shuttingDown) {
      socket.destroy();
      return;
    }
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const pathMatch = pagePathPattern.exec(url.pathname);
    if (!pathMatch) {
      socket.destroy();
      return;
    }
    const pageId = pathMatch[1]!;
    const origin = request.headers.origin;
    if (origin && origin !== this.options.frontendOrigin) {
      this.acceptAndClose(request, socket, head, 4403, 'Origin is not allowed.');
      return;
    }
    const token = url.searchParams.get('token');
    if (!token || token.length > 4096) {
      this.acceptAndClose(request, socket, head, 4401, 'Collaboration token is required.');
      return;
    }
    const claims = verifyCollaborationToken(token, this.options.tokenSecret);
    if (!claims || claims.pageId !== pageId) {
      this.acceptAndClose(request, socket, head, 4401, 'Collaboration token is invalid.');
      return;
    }

    const authorization = await this.authorizeClaims(claims);
    if (!authorization) {
      this.acceptAndClose(request, socket, head, 4403, 'Page access is unavailable.');
      return;
    }

    let room: CollaborationRoom;
    try {
      room = await this.roomManager.prepare(claims.workspaceId, claims.pageId);
    } catch (error: unknown) {
      console.error('Unable to load collaboration room.', error);
      this.acceptAndClose(request, socket, head, 1011, 'Unable to load collaboration room.');
      return;
    }

    this.websocketServer.handleUpgrade(request, socket, head, (websocket) => {
      const connection: CollaborationConnection = {
        socket: websocket,
        sessionId: claims.sessionId,
        userId: claims.userId,
        workspaceId: claims.workspaceId,
        pageId: claims.pageId,
        access: authorization.access,
        identity: createCollaborationIdentity(authorization.user),
        awarenessClientIds: new Set(),
      };
      try {
        this.roomManager.connect(connection, room);
        this.connections.set(connection, room);
        websocket.once('close', () => {
          this.connections.delete(connection);
          this.roomManager.scheduleRelease(room);
        });
      } catch (error: unknown) {
        console.error('Unable to join collaboration room.', error);
        websocket.close(1011, 'Unable to join collaboration room.');
      }
    });
  }

  private acceptAndClose(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    code: number,
    reason: string,
  ): void {
    this.websocketServer.handleUpgrade(request, socket, head, (websocket) => {
      websocket.close(code, reason);
    });
  }

  private async authorizeClaims(
    claims: CollaborationTokenClaims,
  ): Promise<AuthorizedConnection | null> {
    const session = await this.database.session.findUnique({
      where: { id: claims.sessionId },
      include: { user: true },
    });
    if (
      !session ||
      session.userId !== claims.userId ||
      session.expiresAt <= new Date() ||
      !session.user
    ) {
      return null;
    }
    const page = await this.database.page.findUnique({
      where: { workspaceId_id: { workspaceId: claims.workspaceId, id: claims.pageId } },
      select: { archivedAt: true },
    });
    if (!page || page.archivedAt) return null;

    try {
      const access = await requirePageAccess(
        claims.workspaceId,
        claims.pageId,
        claims.userId,
        'READ',
      );
      return { claims, access, user: session.user };
    } catch {
      return null;
    }
  }

  private async revalidateConnection(connection: CollaborationConnection): Promise<void> {
    const claims: CollaborationTokenClaims = {
      v: 1,
      jti: '00000000-0000-4000-8000-000000000000',
      iat: 0,
      exp: 0,
      userId: connection.userId,
      sessionId: connection.sessionId,
      workspaceId: connection.workspaceId,
      pageId: connection.pageId,
      access: connection.access,
    };
    const authorization = await this.authorizeClaims(claims);
    if (!authorization) {
      connection.socket.close(4403, 'Page permission was revoked.');
      return;
    }
    if (authorization.access !== connection.access) {
      connection.socket.close(4403, 'Page permission changed.');
      return;
    }
    const room = this.connections.get(connection);
    room?.updateConnectionAccess(connection, authorization.access);
  }

  private async revalidateAllConnections(): Promise<void> {
    await Promise.all(
      Array.from(this.connections.keys(), (connection) => this.revalidateConnection(connection)),
    );
  }
}

export function createCollaborationServer(
  httpServer: HttpServer,
  options: CollaborationServerOptions,
): CollaborationServer {
  return new CollaborationServer(httpServer, prisma, options);
}
