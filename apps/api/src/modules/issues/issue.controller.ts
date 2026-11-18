import type { Request, RequestHandler } from "express";
import { AppError } from "../../errors/app-error.js";
import type { CreateIssueInput, UpdateIssueInput } from "./issue.schemas.js";
import * as issueService from "./issue.service.js";

function access(request: Request) {
  if (!request.workspaceAccess) throw new AppError(500, "Workspace authorization was not initialized", "AUTHORIZATION_STATE_MISSING");
  return request.workspaceAccess;
}

export const createIssue: RequestHandler = async (request, response) => {
  const workspace = access(request);
  const issue = await issueService.createIssue(
    workspace.workspace.id,
    request.params.projectId as string,
    workspace.membershipId,
    request.body as CreateIssueInput,
  );
  response.status(201).json({ data: { issue } });
};

export const listIssues: RequestHandler = async (request, response) => {
  const issues = await issueService.listIssues(access(request).workspace.id, request.params.projectId as string);
  response.status(200).json({ data: { issues } });
};

export const getIssue: RequestHandler = async (request, response) => {
  const issue = await issueService.findIssue(access(request).workspace.id, request.params.projectId as string, request.params.issueId as string);
  response.status(200).json({ data: { issue } });
};

export const updateIssue: RequestHandler = async (request, response) => {
  const issue = await issueService.updateIssue(
    access(request).workspace.id,
    request.params.projectId as string,
    request.params.issueId as string,
    request.body as UpdateIssueInput,
  );
  response.status(200).json({ data: { issue } });
};

export const deleteIssue: RequestHandler = async (request, response) => {
  await issueService.deleteIssue(access(request).workspace.id, request.params.projectId as string, request.params.issueId as string);
  response.status(204).send();
};
