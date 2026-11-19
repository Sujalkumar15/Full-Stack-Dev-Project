import { z } from "zod";

const projectKeySchema = z
  .string()
  .trim()
  .min(2, "Project key must be at least 2 characters")
  .max(10, "Project key must be at most 10 characters")
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z][A-Z0-9]*$/, "Project key must begin with a letter and use only letters and numbers"));

export const projectParamsSchema = z.object({
  workspaceId: z.uuid("Invalid workspace identifier"),
  projectId: z.uuid("Invalid project identifier"),
});

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters").max(80),
  key: projectKeySchema,
  description: z.string().trim().max(1000).optional().nullable(),
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2, "Project name must be at least 2 characters").max(80).optional(),
    key: projectKeySchema.optional(),
    description: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one project field is required");

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
