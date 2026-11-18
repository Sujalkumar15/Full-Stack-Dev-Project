import { Prisma } from "@prisma/client";
import { AppError } from "../../errors/app-error.js";
import { prisma } from "../../lib/prisma.js";
import type { CreateIssueInput, UpdateIssueInput } from "./issue.schemas.js";

const issueSelect = {
  id: true,
  workspaceId: true,
  projectId: true,
  sprintId: true,
  reporterMembershipId: true,
  assigneeMembershipId: true,
  number: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { key: true, name: true } },
  sprint: { select: { id: true, name: true } },
  assignee: {
    select: {
      id: true,
      user: { select: { displayName: true, email: true } },
    },
  },
} satisfies Prisma.IssueSelect;

type IssuePayload = Prisma.IssueGetPayload<{ select: typeof issueSelect }>;

function issueResponse(issue: IssuePayload) {
  return {
    ...issue,
    identifier: `${issue.project.key}-${issue.number}`,
    assignee: issue.assignee
      ? {
          membershipId: issue.assignee.id,
          displayName: issue.assignee.user.displayName,
          email: issue.assignee.user.email,
        }
      : null,
  };
}

async function assertRelationships(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  projectId: string,
  assigneeMembershipId: string | null | undefined,
  sprintId: string | null | undefined,
) {
  if (assigneeMembershipId) {
    const assignee = await tx.membership.findFirst({
      where: { id: assigneeMembershipId, workspaceId, isActive: true },
      select: { id: true },
    });
    if (!assignee) throw new AppError(404, "Assignee not found", "ASSIGNEE_NOT_FOUND");
  }

  if (sprintId) {
    const sprint = await tx.sprint.findFirst({
      where: { id: sprintId, workspaceId, projectId },
      select: { id: true },
    });
    if (!sprint) throw new AppError(404, "Sprint not found", "SPRINT_NOT_FOUND");
  }
}

async function assertProject(tx: Prisma.TransactionClient, workspaceId: string, projectId: string) {
  const project = await tx.project.findFirst({ where: { id: projectId, workspaceId }, select: { id: true } });
  if (!project) throw new AppError(404, "Project not found", "PROJECT_NOT_FOUND");
}

export async function createIssue(
  workspaceId: string,
  projectId: string,
  reporterMembershipId: string,
  input: CreateIssueInput,
) {
  return prisma.$transaction(async (tx) => {
    await assertProject(tx, workspaceId, projectId);
    await assertRelationships(tx, workspaceId, projectId, input.assigneeMembershipId, input.sprintId);

    const project = await tx.project.update({
      where: { workspaceId_id: { workspaceId, id: projectId } },
      data: { issueCounter: { increment: 1 } },
      select: { issueCounter: true },
    });

    const issue = await tx.issue.create({
      data: {
        workspaceId,
        projectId,
        reporterMembershipId,
        number: project.issueCounter,
        title: input.title,
        description: input.description || null,
        status: input.status,
        priority: input.priority,
        assigneeMembershipId: input.assigneeMembershipId || null,
        sprintId: input.sprintId || null,
      },
      select: issueSelect,
    });
    return issueResponse(issue);
  });
}

export async function listIssues(workspaceId: string, projectId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId }, select: { id: true } });
  if (!project) throw new AppError(404, "Project not found", "PROJECT_NOT_FOUND");
  const issues = await prisma.issue.findMany({
    where: { workspaceId, projectId, status: { in: ["TODO", "IN_PROGRESS", "DONE"] } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: issueSelect,
  });
  return issues.map(issueResponse);
}

export async function findIssue(workspaceId: string, projectId: string, issueId: string) {
  const issue = await prisma.issue.findFirst({
    where: { id: issueId, workspaceId, projectId },
    select: issueSelect,
  });
  if (!issue) throw new AppError(404, "Issue not found", "ISSUE_NOT_FOUND");
  return issueResponse(issue);
}

export async function updateIssue(
  workspaceId: string,
  projectId: string,
  issueId: string,
  input: UpdateIssueInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.issue.findFirst({
      where: { id: issueId, workspaceId, projectId },
      select: { id: true },
    });
    if (!existing) throw new AppError(404, "Issue not found", "ISSUE_NOT_FOUND");
    await assertRelationships(tx, workspaceId, projectId, input.assigneeMembershipId, input.sprintId);

    const issue = await tx.issue.update({
      where: { workspaceId_id: { workspaceId, id: issueId } },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.assigneeMembershipId !== undefined ? { assigneeMembershipId: input.assigneeMembershipId } : {}),
        ...(input.sprintId !== undefined ? { sprintId: input.sprintId } : {}),
      },
      select: issueSelect,
    });
    return issueResponse(issue);
  });
}

export async function deleteIssue(workspaceId: string, projectId: string, issueId: string) {
  await findIssue(workspaceId, projectId, issueId);
  await prisma.issue.delete({ where: { workspaceId_id: { workspaceId, id: issueId } } });
}
