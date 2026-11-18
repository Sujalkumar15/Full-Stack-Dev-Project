import type { RequestHandler } from "express";
import { AppError } from "../../errors/app-error.js";
import type { CreateProjectInput, UpdateProjectInput } from "./project.schemas.js";
import * as projectService from "./project.service.js";

function workspaceId(request: Parameters<RequestHandler>[0]) {
  if (!request.workspaceAccess) throw new AppError(500, "Workspace authorization was not initialized", "AUTHORIZATION_STATE_MISSING");
  return request.workspaceAccess.workspace.id;
}

export const createProject: RequestHandler = async (request, response) => {
  const project = await projectService.createProject(workspaceId(request), request.body as CreateProjectInput);
  response.status(201).json({ data: { project } });
};

export const listProjects: RequestHandler = async (request, response) => {
  const projects = await projectService.listProjects(workspaceId(request));
  response.status(200).json({ data: { projects } });
};

export const getProject: RequestHandler = async (request, response) => {
  const project = await projectService.findProject(workspaceId(request), request.params.projectId as string);
  response.status(200).json({ data: { project } });
};

export const updateProject: RequestHandler = async (request, response) => {
  const project = await projectService.updateProject(workspaceId(request), request.params.projectId as string, request.body as UpdateProjectInput);
  response.status(200).json({ data: { project } });
};

export const deleteProject: RequestHandler = async (request, response) => {
  await projectService.deleteProject(workspaceId(request), request.params.projectId as string);
  response.status(204).send();
};
