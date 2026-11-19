export const workspaceRoles = ['OWNER', 'ADMIN', 'MEMBER', 'GUEST'] as const;
export type WorkspaceRole = (typeof workspaceRoles)[number];

export const pageAccessLevels = ['READ', 'COMMENT', 'EDIT', 'MANAGE'] as const;
export type PageAccessLevel = (typeof pageAccessLevels)[number];
