export type MembershipRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  membershipId: string;
  role: MembershipRole;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  workspaceName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string | null;
  issueCount: number;
  createdAt: string;
  updatedAt: string;
}

export type IssueStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type IssuePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface WorkspaceMember {
  membershipId: string;
  userId: string;
  displayName: string | null;
  email: string;
  role: MembershipRole;
}

export interface Issue {
  id: string;
  workspaceId: string;
  projectId: string;
  sprintId: string | null;
  reporterMembershipId: string;
  assigneeMembershipId: string | null;
  number: number;
  identifier: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  project: { key: string; name: string };
  sprint: { id: string; name: string } | null;
  assignee: { membershipId: string; displayName: string | null; email: string } | null;
  createdAt: string;
  updatedAt: string;
}
