import { z } from "zod";

export const workspaceParamsSchema = z.object({
  workspaceId: z.uuid("Invalid workspace identifier"),
});
