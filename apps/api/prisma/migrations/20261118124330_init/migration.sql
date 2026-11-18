-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "IssuePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SprintStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprints" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "status" "SprintStatus" NOT NULL DEFAULT 'PLANNED',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "sprintId" UUID,
    "reporterMembershipId" UUID NOT NULL,
    "assigneeMembershipId" UUID,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "IssueStatus" NOT NULL DEFAULT 'BACKLOG',
    "priority" "IssuePriority" NOT NULL DEFAULT 'MEDIUM',
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "issueId" UUID NOT NULL,
    "authorMembershipId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "projectId" UUID,
    "issueId" UUID,
    "actorMembershipId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "memberships_userId_idx" ON "memberships"("userId");

-- CreateIndex
CREATE INDEX "memberships_workspaceId_role_idx" ON "memberships"("workspaceId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_workspaceId_userId_key" ON "memberships"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_workspaceId_id_key" ON "memberships"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "projects_workspaceId_createdAt_idx" ON "projects"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "projects_workspaceId_key_key" ON "projects"("workspaceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "projects_workspaceId_id_key" ON "projects"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "sprints_workspaceId_projectId_status_idx" ON "sprints"("workspaceId", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sprints_workspaceId_projectId_id_key" ON "sprints"("workspaceId", "projectId", "id");

-- CreateIndex
CREATE INDEX "issues_workspaceId_status_idx" ON "issues"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "issues_workspaceId_assigneeMembershipId_status_idx" ON "issues"("workspaceId", "assigneeMembershipId", "status");

-- CreateIndex
CREATE INDEX "issues_projectId_sprintId_idx" ON "issues"("projectId", "sprintId");

-- CreateIndex
CREATE INDEX "issues_reporterMembershipId_idx" ON "issues"("reporterMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "issues_workspaceId_projectId_number_key" ON "issues"("workspaceId", "projectId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "issues_workspaceId_id_key" ON "issues"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "comments_workspaceId_issueId_createdAt_idx" ON "comments"("workspaceId", "issueId", "createdAt");

-- CreateIndex
CREATE INDEX "comments_authorMembershipId_idx" ON "comments"("authorMembershipId");

-- CreateIndex
CREATE INDEX "activity_logs_workspaceId_createdAt_idx" ON "activity_logs"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_workspaceId_entityType_entityId_idx" ON "activity_logs"("workspaceId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "activity_logs_projectId_idx" ON "activity_logs"("projectId");

-- CreateIndex
CREATE INDEX "activity_logs_issueId_idx" ON "activity_logs"("issueId");

-- CreateIndex
CREATE INDEX "activity_logs_actorMembershipId_idx" ON "activity_logs"("actorMembershipId");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_workspaceId_projectId_fkey" FOREIGN KEY ("workspaceId", "projectId") REFERENCES "projects"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_workspaceId_projectId_fkey" FOREIGN KEY ("workspaceId", "projectId") REFERENCES "projects"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_reporterMembershipId_fkey" FOREIGN KEY ("reporterMembershipId") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_assigneeMembershipId_fkey" FOREIGN KEY ("assigneeMembershipId") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_workspaceId_issueId_fkey" FOREIGN KEY ("workspaceId", "issueId") REFERENCES "issues"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorMembershipId_fkey" FOREIGN KEY ("authorMembershipId") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actorMembershipId_fkey" FOREIGN KEY ("actorMembershipId") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
