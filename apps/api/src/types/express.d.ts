import type { MembershipRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        email: string;
        displayName: string | null;
        createdAt: Date;
      };
      workspaceAccess?: {
        membershipId: string;
        role: MembershipRole;
        workspace: {
          id: string;
          name: string;
          slug: string;
          createdAt: Date;
          updatedAt: Date;
        };
      };
    }
  }
}

export {};
