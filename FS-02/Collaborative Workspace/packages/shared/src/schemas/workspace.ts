import { z } from 'zod';

import { emailSchema, userSchema } from './auth.js';
import { uuidSchema } from './identifiers.js';
import { workspaceRoles } from '../types/permissions.js';

export const workspaceRoleSchema = z.enum(workspaceRoles);
export const workspaceNameSchema = z.string().trim().min(2).max(80);

export const createWorkspaceRequestSchema = z
  .object({
    name: workspaceNameSchema,
  })
  .strict();

export const updateWorkspaceRequestSchema = createWorkspaceRequestSchema;

const assignableWorkspaceRoleSchema = z.enum(['ADMIN', 'MEMBER', 'GUEST']);

export const addWorkspaceMemberRequestSchema = z
  .object({
    email: emailSchema,
    role: assignableWorkspaceRoleSchema,
  })
  .strict();

export const updateWorkspaceMemberRequestSchema = z
  .object({
    role: assignableWorkspaceRoleSchema,
  })
  .strict();

export const workspaceSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  slug: z.string(),
  ownerId: uuidSchema,
  role: workspaceRoleSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const workspaceMemberSchema = z.object({
  role: workspaceRoleSchema,
  joinedAt: z.string().datetime(),
  user: userSchema,
});

export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceRequestSchema>;
export type UpdateWorkspaceRequest = z.infer<typeof updateWorkspaceRequestSchema>;
export type AddWorkspaceMemberRequest = z.infer<typeof addWorkspaceMemberRequestSchema>;
export type UpdateWorkspaceMemberRequest = z.infer<typeof updateWorkspaceMemberRequestSchema>;
export type WorkspaceSummary = z.infer<typeof workspaceSchema>;
export type WorkspaceMemberSummary = z.infer<typeof workspaceMemberSchema>;
