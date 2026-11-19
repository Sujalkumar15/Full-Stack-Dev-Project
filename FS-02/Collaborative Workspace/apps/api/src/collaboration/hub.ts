export interface CollaborationConnectionController {
  closeSessionConnections(sessionId: string): void;
  revalidateWorkspaceConnections(workspaceId: string): Promise<void>;
}

let activeController: CollaborationConnectionController | null = null;

export function registerCollaborationController(
  controller: CollaborationConnectionController | null,
): void {
  activeController = controller;
}

export function closeCollaborationSession(sessionId: string): void {
  activeController?.closeSessionConnections(sessionId);
}

export async function revalidateWorkspaceConnections(workspaceId: string): Promise<void> {
  await activeController?.revalidateWorkspaceConnections(workspaceId);
}
