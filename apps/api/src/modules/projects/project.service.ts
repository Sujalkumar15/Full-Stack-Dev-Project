import { Prisma } from "@prisma/client";
import { AppError } from "../../errors/app-error.js";
import { prisma } from "../../lib/prisma.js";
import type { CreateProjectInput, UpdateProjectInput } from "./project.schemas.js";

const projectSelect = {
  id: true,
  workspaceId: true,
  name: true,
  key: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { issues: true } },
} satisfies Prisma.ProjectSelect;

function projectResponse(project: Prisma.ProjectGetPayload<{ select: typeof projectSelect }>) {
  const { _count, ...data } = project;
  return { ...data, issueCount: _count.issues };
}

export async function createProject(workspaceId: string, input: CreateProjectInput) {
  try {
    const project = await prisma.project.create({
      data: {
        workspaceId,
        name: input.name,
        key: input.key,
        description: input.description || null,
      },
      select: projectSelect,
    });
    return projectResponse(project);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "A project with this key already exists in the workspace", "PROJECT_KEY_EXISTS");
    }
    throw error;
  }
}

export async function listProjects(workspaceId: string) {
  const projects = await prisma.project.findMany({
    where: { workspaceId },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    select: projectSelect,
  });
  return projects.map(projectResponse);
}

export async function findProject(workspaceId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: projectSelect,
  });
  if (!project) throw new AppError(404, "Project not found", "PROJECT_NOT_FOUND");
  return projectResponse(project);
}

export async function updateProject(workspaceId: string, projectId: string, input: UpdateProjectInput) {
  await findProject(workspaceId, projectId);
  try {
    const project = await prisma.project.update({
      where: { workspaceId_id: { workspaceId, id: projectId } },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.key !== undefined ? { key: input.key } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
      },
      select: projectSelect,
    });
    return projectResponse(project);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "A project with this key already exists in the workspace", "PROJECT_KEY_EXISTS");
    }
    throw error;
  }
}

export async function deleteProject(workspaceId: string, projectId: string) {
  await findProject(workspaceId, projectId);
  await prisma.project.delete({ where: { workspaceId_id: { workspaceId, id: projectId } } });
}
