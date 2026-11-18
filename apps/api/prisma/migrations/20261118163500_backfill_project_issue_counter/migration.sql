-- Preserve issue numbering for any projects populated before counters were introduced.
UPDATE "projects" AS project
SET "issueCounter" = COALESCE((
  SELECT MAX(issue."number")
  FROM "issues" AS issue
  WHERE issue."workspaceId" = project."workspaceId"
    AND issue."projectId" = project."id"
), 0);
