import { Router } from "express";
import { validateRequest } from "../../middleware/validate-request.js";
import { createIssue, deleteIssue, getIssue, listIssues, updateIssue } from "../issues/issue.controller.js";
import { createIssueSchema, issueParamsSchema, projectIssuesParamsSchema, updateIssueSchema } from "../issues/issue.schemas.js";
import { createProject, deleteProject, getProject, listProjects, updateProject } from "../projects/project.controller.js";
import { createProjectSchema, projectParamsSchema, updateProjectSchema } from "../projects/project.schemas.js";
import { requireWorkspaceMembership, requireWorkspaceRoles } from "./workspace-access.middleware.js";
import { listWorkspaceMembers } from "./workspace-members.controller.js";
import { getWorkspace, listWorkspaces } from "./workspace.controller.js";
import { workspaceParamsSchema } from "./workspace.schemas.js";

export const workspaceRouter = Router();

workspaceRouter.get("/", listWorkspaces);
workspaceRouter.get(
  "/:workspaceId",
  validateRequest({ params: workspaceParamsSchema }),
  requireWorkspaceMembership,
  getWorkspace,
);

workspaceRouter.get(
  "/:workspaceId/members",
  validateRequest({ params: workspaceParamsSchema }),
  requireWorkspaceMembership,
  listWorkspaceMembers,
);

workspaceRouter.post(
  "/:workspaceId/projects",
  validateRequest({ params: workspaceParamsSchema, body: createProjectSchema }),
  requireWorkspaceMembership,
  requireWorkspaceRoles("OWNER", "ADMIN"),
  createProject,
);
workspaceRouter.get(
  "/:workspaceId/projects",
  validateRequest({ params: workspaceParamsSchema }),
  requireWorkspaceMembership,
  listProjects,
);
workspaceRouter.get(
  "/:workspaceId/projects/:projectId",
  validateRequest({ params: projectParamsSchema }),
  requireWorkspaceMembership,
  getProject,
);
workspaceRouter.patch(
  "/:workspaceId/projects/:projectId",
  validateRequest({ params: projectParamsSchema, body: updateProjectSchema }),
  requireWorkspaceMembership,
  requireWorkspaceRoles("OWNER", "ADMIN"),
  updateProject,
);
workspaceRouter.delete(
  "/:workspaceId/projects/:projectId",
  validateRequest({ params: projectParamsSchema }),
  requireWorkspaceMembership,
  requireWorkspaceRoles("OWNER", "ADMIN"),
  deleteProject,
);

workspaceRouter.post(
  "/:workspaceId/projects/:projectId/issues",
  validateRequest({ params: projectIssuesParamsSchema, body: createIssueSchema }),
  requireWorkspaceMembership,
  requireWorkspaceRoles("OWNER", "ADMIN", "MEMBER"),
  createIssue,
);
workspaceRouter.get(
  "/:workspaceId/projects/:projectId/issues",
  validateRequest({ params: projectIssuesParamsSchema }),
  requireWorkspaceMembership,
  listIssues,
);
workspaceRouter.get(
  "/:workspaceId/projects/:projectId/issues/:issueId",
  validateRequest({ params: issueParamsSchema }),
  requireWorkspaceMembership,
  getIssue,
);
workspaceRouter.patch(
  "/:workspaceId/projects/:projectId/issues/:issueId",
  validateRequest({ params: issueParamsSchema, body: updateIssueSchema }),
  requireWorkspaceMembership,
  requireWorkspaceRoles("OWNER", "ADMIN", "MEMBER"),
  updateIssue,
);
workspaceRouter.delete(
  "/:workspaceId/projects/:projectId/issues/:issueId",
  validateRequest({ params: issueParamsSchema }),
  requireWorkspaceMembership,
  requireWorkspaceRoles("OWNER", "ADMIN"),
  deleteIssue,
);
