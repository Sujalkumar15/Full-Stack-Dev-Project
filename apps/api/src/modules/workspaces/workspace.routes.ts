import { Router } from "express";
import { validateRequest } from "../../middleware/validate-request.js";
import { requireWorkspaceMembership } from "./workspace-access.middleware.js";
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
