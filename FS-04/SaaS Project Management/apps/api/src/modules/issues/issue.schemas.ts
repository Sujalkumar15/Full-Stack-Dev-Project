import { z } from "zod";

export const issueParamsSchema = z.object({
  workspaceId: z.uuid("Invalid workspace identifier"),
  projectId: z.uuid("Invalid project identifier"),
  issueId: z.uuid("Invalid issue identifier"),
});

export const projectIssuesParamsSchema = issueParamsSchema.omit({ issueId: true });

export const issueStatusSchema = z.enum(["TODO", "IN_PROGRESS", "DONE"]);
export const issuePrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

export const createIssueSchema = z.object({
  title: z.string().trim().min(2, "Issue title must be at least 2 characters").max(180),
  description: z.string().trim().max(10_000).optional().nullable(),
  status: issueStatusSchema.default("TODO"),
  priority: issuePrioritySchema.default("MEDIUM"),
  assigneeMembershipId: z.uuid("Invalid assignee identifier").optional().nullable(),
  sprintId: z.uuid("Invalid sprint identifier").optional().nullable(),
});

export const updateIssueSchema = z
  .object({
    title: z.string().trim().min(2, "Issue title must be at least 2 characters").max(180).optional(),
    description: z.string().trim().max(10_000).optional().nullable(),
    status: issueStatusSchema.optional(),
    priority: issuePrioritySchema.optional(),
    assigneeMembershipId: z.uuid("Invalid assignee identifier").optional().nullable(),
    sprintId: z.uuid("Invalid sprint identifier").optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one issue field is required");

export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;
