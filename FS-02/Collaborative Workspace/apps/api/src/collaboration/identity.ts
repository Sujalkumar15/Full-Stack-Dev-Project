import { createHash } from 'node:crypto';

import type { User } from '@prisma/client';

import type { CollaborationIdentity } from './room.js';

const colorPalette = [
  '#059669',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#0891b2',
  '#4f46e5',
  '#65a30d',
];

export function createCollaborationIdentity(user: User): CollaborationIdentity {
  const colorIndex = createHash('sha256').update(user.id).digest()[0]! % colorPalette.length;
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    color: colorPalette[colorIndex]!,
  };
}
