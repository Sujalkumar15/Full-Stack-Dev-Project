import { createHash } from 'node:crypto';

import { Prisma, type PrismaClient } from '@prisma/client';
import * as Y from 'yjs';

export interface LoadedYjsDocument {
  document: Y.Doc;
  pendingUpdateCount: number;
}

export class YjsPostgresPersistence {
  constructor(private readonly database: PrismaClient) {}

  async loadDocument(workspaceId: string, pageId: string): Promise<LoadedYjsDocument> {
    const record = await this.database.yjsDocument.upsert({
      where: { pageId },
      create: {
        pageId,
        workspaceId,
        snapshot: Buffer.alloc(0),
      },
      update: {},
    });
    const updates = await this.database.yjsUpdate.findMany({
      where: {
        workspaceId,
        pageId,
        id: { gt: record.snapshotSeq },
      },
      orderBy: { id: 'asc' },
    });

    const document = new Y.Doc();
    if (record.snapshot.length > 0) {
      Y.applyUpdate(document, new Uint8Array(record.snapshot), 'postgres-snapshot');
    }
    for (const update of updates) {
      Y.applyUpdate(document, new Uint8Array(update.update), 'postgres-update');
    }
    return { document, pendingUpdateCount: updates.length };
  }

  async persistUpdate(workspaceId: string, pageId: string, update: Uint8Array): Promise<boolean> {
    const bytes = Buffer.from(update);
    const updateHash = createHash('sha256').update(bytes).digest('hex');
    try {
      await this.database.yjsUpdate.create({
        data: { workspaceId, pageId, update: bytes, updateHash },
      });
      return true;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }

  async compactDocument(
    workspaceId: string,
    pageId: string,
    preferredAuthorId?: string,
  ): Promise<boolean> {
    return this.database.$transaction(
      async (transaction) => {
        await transaction.$queryRaw<Array<{ lock: string }>>`
          SELECT pg_advisory_xact_lock(hashtext(${pageId}))::text AS lock
        `;

        const record = await transaction.yjsDocument.findUniqueOrThrow({ where: { pageId } });
        const updates = await transaction.yjsUpdate.findMany({
          where: { workspaceId, pageId, id: { gt: record.snapshotSeq } },
          orderBy: { id: 'asc' },
        });
        if (updates.length === 0) return false;

        const compactedDocument = new Y.Doc();
        if (record.snapshot.length > 0) {
          Y.applyUpdate(compactedDocument, new Uint8Array(record.snapshot), 'compaction-snapshot');
        }
        for (const update of updates) {
          Y.applyUpdate(compactedDocument, new Uint8Array(update.update), 'compaction-update');
        }

        const snapshot = Buffer.from(Y.encodeStateAsUpdate(compactedDocument));
        const stateVector = Buffer.from(Y.encodeStateVector(compactedDocument));
        const watermark = updates.at(-1)!.id;
        const page = await transaction.page.findUniqueOrThrow({
          where: { workspaceId_id: { workspaceId, id: pageId } },
          select: { createdById: true, lastEditedById: true },
        });
        const authorCandidates = [preferredAuthorId, page.lastEditedById, page.createdById].filter(
          (value): value is string => Boolean(value),
        );
        const author = await transaction.workspaceMember.findFirst({
          where: { workspaceId, userId: { in: authorCandidates } },
          select: { userId: true },
        });
        const maximumVersion = await transaction.documentVersion.aggregate({
          where: { workspaceId, pageId },
          _max: { version: true },
        });

        await transaction.yjsDocument.update({
          where: { pageId },
          data: { snapshot, stateVector, snapshotSeq: watermark },
        });
        if (author) {
          await transaction.documentVersion.create({
            data: {
              workspaceId,
              pageId,
              version: (maximumVersion._max.version ?? 0) + 1,
              label: 'Automatic collaboration snapshot',
              snapshot,
              stateVector,
              createdById: author.userId,
            },
          });
        }
        await transaction.yjsUpdate.deleteMany({
          where: { workspaceId, pageId, id: { lte: watermark } },
        });
        compactedDocument.destroy();
        return true;
      },
      { isolationLevel: 'Serializable', timeout: 30_000 },
    );
  }
}
