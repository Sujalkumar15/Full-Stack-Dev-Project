import type { PageAccess } from '@prisma/client';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { WebSocket } from 'ws';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

import type { YjsPostgresPersistence } from './persistence.js';

const messageSync = 0;
const messageAwareness = 1;
const messageQueryAwareness = 3;
const maximumMessageBytes = 1_000_000;

const canEdit = (access: PageAccess) => access === 'EDIT' || access === 'MANAGE';

interface DeleteSetLike {
  clients: Map<number, Array<{ clock: number; len: number }>>;
}

function deleteSetContains(current: DeleteSetLike, incoming: DeleteSetLike): boolean {
  for (const [clientId, incomingRanges] of incoming.clients) {
    const currentRanges = current.clients.get(clientId) ?? [];
    let currentIndex = 0;
    for (const incomingRange of incomingRanges) {
      let cursor = incomingRange.clock;
      const incomingEnd = incomingRange.clock + incomingRange.len;
      while (
        currentIndex < currentRanges.length &&
        currentRanges[currentIndex]!.clock + currentRanges[currentIndex]!.len <= cursor
      ) {
        currentIndex += 1;
      }
      let rangeIndex = currentIndex;
      while (cursor < incomingEnd) {
        const currentRange = currentRanges[rangeIndex];
        if (!currentRange || currentRange.clock > cursor) return false;
        cursor = Math.max(cursor, currentRange.clock + currentRange.len);
        rangeIndex += 1;
      }
    }
  }
  return true;
}

function updateChangesDocument(document: Y.Doc, update: Uint8Array): boolean {
  const novelUpdate = Y.diffUpdate(update, Y.encodeStateVector(document));
  if (Y.decodeUpdate(novelUpdate).structs.length > 0) return true;
  const incomingDeletes = Y.decodeUpdate(update).ds;
  const existingDeletes = Y.createDeleteSetFromStructStore(document.store);
  return !deleteSetContains(existingDeletes, incomingDeletes);
}

export interface CollaborationIdentity {
  id: string;
  name: string;
  avatarUrl: string | null;
  color: string;
}

export interface CollaborationConnection {
  socket: WebSocket;
  sessionId: string;
  userId: string;
  workspaceId: string;
  pageId: string;
  access: PageAccess;
  identity: CollaborationIdentity;
  awarenessClientIds: Set<number>;
}

function rawDataToBytes(data: WebSocket.RawData): Uint8Array {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data));
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

export class CollaborationRoom {
  private readonly awareness: awarenessProtocol.Awareness;
  private readonly awarenessOwners = new Map<number, CollaborationConnection>();
  private readonly connections = new Set<CollaborationConnection>();
  private queue: Promise<void> = Promise.resolve();
  private updatesSinceCompaction: number;
  private lastEditorUserId: string | undefined;
  private destroyed = false;

  constructor(
    readonly workspaceId: string,
    readonly pageId: string,
    private readonly document: Y.Doc,
    private readonly persistence: YjsPostgresPersistence,
    pendingUpdateCount: number,
    private readonly compactionUpdateThreshold: number,
  ) {
    this.updatesSinceCompaction = pendingUpdateCount;
    this.awareness = new awarenessProtocol.Awareness(document);
    this.awareness.setLocalState(null);
    this.awareness.on(
      'update',
      ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
        const changedClients = added.concat(updated, removed);
        if (changedClients.length === 0) return;
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients),
        );
        this.broadcast(encoding.toUint8Array(encoder));
      },
    );
  }

  get connectionCount(): number {
    return this.connections.size;
  }

  addConnection(connection: CollaborationConnection): void {
    if (this.destroyed) throw new Error('Cannot join a destroyed collaboration room.');
    this.connections.add(connection);

    connection.socket.on('message', (data, isBinary) => {
      if (this.destroyed) return;
      if (!isBinary) {
        connection.socket.close(4400, 'Binary collaboration messages are required.');
        return;
      }
      const bytes = rawDataToBytes(data);
      if (bytes.byteLength > maximumMessageBytes) {
        connection.socket.close(4400, 'Collaboration message is too large.');
        return;
      }
      void this.enqueue(() => this.processMessage(connection, bytes)).catch((error: unknown) => {
        console.error('Collaboration message failed.', error);
        connection.socket.close(1011, 'Collaboration processing failed.');
      });
    });
    connection.socket.once('close', () => this.removeConnection(connection));

    if (canEdit(connection.access)) {
      const syncEncoder = encoding.createEncoder();
      encoding.writeVarUint(syncEncoder, messageSync);
      syncProtocol.writeSyncStep1(syncEncoder, this.document);
      this.send(connection, encoding.toUint8Array(syncEncoder));
    }

    const awarenessClients = Array.from(this.awareness.getStates().keys());
    if (awarenessClients.length > 0) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, messageAwareness);
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, awarenessClients),
      );
      this.send(connection, encoding.toUint8Array(awarenessEncoder));
    }
  }

  updateConnectionAccess(connection: CollaborationConnection, access: PageAccess): void {
    connection.access = access;
  }

  async flushAndCompact(): Promise<void> {
    await this.enqueue(async () => {
      if (this.updatesSinceCompaction > 0) {
        await this.persistence.compactDocument(
          this.workspaceId,
          this.pageId,
          this.lastEditorUserId,
        );
        this.updatesSinceCompaction = 0;
      }
    });
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    await this.queue;
    if (this.updatesSinceCompaction > 0) {
      await this.persistence.compactDocument(this.workspaceId, this.pageId, this.lastEditorUserId);
      this.updatesSinceCompaction = 0;
    }
    for (const connection of this.connections) {
      connection.socket.close(1012, 'Collaboration room is restarting.');
    }
    this.connections.clear();
    this.awareness.destroy();
    this.document.destroy();
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const pending = this.queue.then(task);
    this.queue = pending.catch(() => undefined);
    return pending;
  }

  private async processMessage(
    connection: CollaborationConnection,
    message: Uint8Array,
  ): Promise<void> {
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    if (messageType === messageSync) {
      const syncMessageType = decoding.readVarUint(decoder);
      if (syncMessageType === syncProtocol.messageYjsSyncStep1) {
        const stateVector = decoding.readVarUint8Array(decoder);
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeSyncStep2(encoder, this.document, stateVector);
        this.send(connection, encoding.toUint8Array(encoder));
        return;
      }

      if (
        syncMessageType === syncProtocol.messageYjsSyncStep2 ||
        syncMessageType === syncProtocol.messageYjsUpdate
      ) {
        if (!canEdit(connection.access)) {
          if (syncMessageType === syncProtocol.messageYjsUpdate) {
            connection.socket.close(4403, 'This page is read-only.');
          }
          return;
        }
        const update = decoding.readVarUint8Array(decoder);
        await this.persistAndApplyUpdate(connection, update);
        return;
      }
      throw new Error('Unknown Yjs sync message type.');
    }

    if (messageType === messageAwareness) {
      const update = decoding.readVarUint8Array(decoder);
      const sanitized = this.sanitizeAwarenessUpdate(connection, update);
      if (sanitized) awarenessProtocol.applyAwarenessUpdate(this.awareness, sanitized, connection);
      return;
    }

    if (messageType === messageQueryAwareness) {
      const clients = Array.from(this.awareness.getStates().keys());
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, clients),
      );
      this.send(connection, encoding.toUint8Array(encoder));
      return;
    }

    throw new Error('Unknown collaboration message type.');
  }

  private async persistAndApplyUpdate(
    connection: CollaborationConnection,
    update: Uint8Array,
  ): Promise<void> {
    if (!updateChangesDocument(this.document, update)) return;
    const inserted = await this.persistence.persistUpdate(this.workspaceId, this.pageId, update);
    if (!inserted) {
      Y.applyUpdate(this.document, update, 'duplicate-client-update');
      return;
    }

    Y.applyUpdate(this.document, update, connection);
    this.lastEditorUserId = connection.userId;
    this.updatesSinceCompaction += 1;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    this.broadcast(encoding.toUint8Array(encoder));

    if (this.updatesSinceCompaction >= this.compactionUpdateThreshold) {
      await this.persistence.compactDocument(this.workspaceId, this.pageId, this.lastEditorUserId);
      this.updatesSinceCompaction = 0;
    }
  }

  private sanitizeAwarenessUpdate(
    connection: CollaborationConnection,
    update: Uint8Array,
  ): Uint8Array | null {
    const decoder = decoding.createDecoder(update);
    const entryCount = decoding.readVarUint(decoder);
    const entries: Array<{ clientId: number; clock: number; state: unknown }> = [];

    for (let index = 0; index < entryCount; index += 1) {
      const clientId = decoding.readVarUint(decoder);
      const clock = decoding.readVarUint(decoder);
      const state = JSON.parse(decoding.readVarString(decoder)) as unknown;
      const currentOwner = this.awarenessOwners.get(clientId);

      if (state === null) {
        if (currentOwner !== connection) continue;
        this.awarenessOwners.delete(clientId);
        connection.awarenessClientIds.delete(clientId);
        entries.push({ clientId, clock, state: null });
        continue;
      }
      if (currentOwner && currentOwner !== connection) continue;

      const safeState =
        typeof state === 'object' && !Array.isArray(state)
          ? { ...(state as Record<string, unknown>), user: connection.identity }
          : { user: connection.identity };
      this.awarenessOwners.set(clientId, connection);
      connection.awarenessClientIds.add(clientId);
      entries.push({ clientId, clock, state: safeState });
    }

    if (entries.length === 0) return null;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, entries.length);
    for (const entry of entries) {
      encoding.writeVarUint(encoder, entry.clientId);
      encoding.writeVarUint(encoder, entry.clock);
      encoding.writeVarString(encoder, JSON.stringify(entry.state));
    }
    return encoding.toUint8Array(encoder);
  }

  private removeConnection(connection: CollaborationConnection): void {
    this.connections.delete(connection);
    const clientIds = Array.from(connection.awarenessClientIds);
    for (const clientId of clientIds) this.awarenessOwners.delete(clientId);
    if (clientIds.length > 0) {
      awarenessProtocol.removeAwarenessStates(this.awareness, clientIds, connection);
    }
    connection.awarenessClientIds.clear();
  }

  private broadcast(message: Uint8Array): void {
    for (const connection of this.connections) this.send(connection, message);
  }

  private send(connection: CollaborationConnection, message: Uint8Array): void {
    if (connection.socket.readyState !== WebSocket.OPEN) return;
    if (connection.socket.bufferedAmount > maximumMessageBytes * 4) {
      connection.socket.close(1013, 'Collaboration client is too slow.');
      return;
    }
    connection.socket.send(message, { binary: true });
  }
}
