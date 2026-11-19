import { useCallback, useEffect, useState } from "react";
import { ApiError, apiRequest } from "../lib/api";
import type { Project, Workspace } from "../types/api";

export function useWorkspaceData(workspaceId: string) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setError("");
    try {
      const [workspaceResponse, projectsResponse] = await Promise.all([
        apiRequest<{ data: { workspace: Workspace } }>(`/workspaces/${workspaceId}`),
        apiRequest<{ data: { projects: Project[] } }>(`/workspaces/${workspaceId}/projects`),
      ]);
      setWorkspace(workspaceResponse.data.workspace);
      setProjects(projectsResponse.data.projects);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to load this workspace.");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { workspace, projects, setProjects, isLoading, error, reload: load };
}
