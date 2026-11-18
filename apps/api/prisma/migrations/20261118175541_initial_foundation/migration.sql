-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'GUEST');

-- CreateEnum
CREATE TYPE "PageVisibility" AS ENUM ('WORKSPACE', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "PageAccess" AS ENUM ('READ', 'COMMENT', 'EDIT', 'MANAGE');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "password_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("workspace_id","user_id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "parent_id" UUID,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "visibility" "PageVisibility" NOT NULL DEFAULT 'WORKSPACE',
    "sort_order" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "last_edited_by_id" UUID,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_permissions" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "access" "PageAccess" NOT NULL,
    "granted_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yjs_documents" (
    "page_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "snapshot" BYTEA NOT NULL,
    "state_vector" BYTEA,
    "snapshot_seq" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yjs_documents_pkey" PRIMARY KEY ("page_id")
);

-- CreateTable
CREATE TABLE "yjs_updates" (
    "id" BIGSERIAL NOT NULL,
    "workspace_id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "update" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yjs_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "parent_id" UUID,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "anchor_start" BYTEA,
    "anchor_end" BYTEA,
    "quoted_text" TEXT,
    "status" "CommentStatus" NOT NULL DEFAULT 'OPEN',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT,
    "snapshot" BYTEA NOT NULL,
    "state_vector" BYTEA,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspaces_owner_id_idx" ON "workspaces"("owner_id");

-- CreateIndex
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members"("user_id");

-- CreateIndex
CREATE INDEX "workspace_members_workspace_id_role_idx" ON "workspace_members"("workspace_id", "role");

-- CreateIndex
CREATE INDEX "pages_workspace_id_parent_id_sort_order_idx" ON "pages"("workspace_id", "parent_id", "sort_order");

-- CreateIndex
CREATE INDEX "pages_workspace_id_archived_at_idx" ON "pages"("workspace_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "pages_workspace_id_id_key" ON "pages"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "page_permissions_workspace_id_user_id_idx" ON "page_permissions"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "page_permissions_workspace_id_page_id_user_id_key" ON "page_permissions"("workspace_id", "page_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "yjs_documents_workspace_id_page_id_key" ON "yjs_documents"("workspace_id", "page_id");

-- CreateIndex
CREATE INDEX "yjs_updates_workspace_id_page_id_id_idx" ON "yjs_updates"("workspace_id", "page_id", "id");

-- CreateIndex
CREATE INDEX "comments_workspace_id_page_id_created_at_idx" ON "comments"("workspace_id", "page_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_workspace_id_parent_id_idx" ON "comments"("workspace_id", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "comments_workspace_id_id_key" ON "comments"("workspace_id", "id");

-- CreateIndex
CREATE INDEX "document_versions_workspace_id_page_id_created_at_idx" ON "document_versions"("workspace_id", "page_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_workspace_id_page_id_version_key" ON "document_versions"("workspace_id", "page_id", "version");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_workspace_id_parent_id_fkey" FOREIGN KEY ("workspace_id", "parent_id") REFERENCES "pages"("workspace_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_workspace_id_created_by_id_fkey" FOREIGN KEY ("workspace_id", "created_by_id") REFERENCES "workspace_members"("workspace_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_workspace_id_last_edited_by_id_fkey" FOREIGN KEY ("workspace_id", "last_edited_by_id") REFERENCES "workspace_members"("workspace_id", "user_id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_permissions" ADD CONSTRAINT "page_permissions_workspace_id_page_id_fkey" FOREIGN KEY ("workspace_id", "page_id") REFERENCES "pages"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_permissions" ADD CONSTRAINT "page_permissions_workspace_id_user_id_fkey" FOREIGN KEY ("workspace_id", "user_id") REFERENCES "workspace_members"("workspace_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_permissions" ADD CONSTRAINT "page_permissions_workspace_id_granted_by_id_fkey" FOREIGN KEY ("workspace_id", "granted_by_id") REFERENCES "workspace_members"("workspace_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yjs_documents" ADD CONSTRAINT "yjs_documents_workspace_id_page_id_fkey" FOREIGN KEY ("workspace_id", "page_id") REFERENCES "pages"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yjs_updates" ADD CONSTRAINT "yjs_updates_workspace_id_page_id_fkey" FOREIGN KEY ("workspace_id", "page_id") REFERENCES "yjs_documents"("workspace_id", "page_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_workspace_id_page_id_fkey" FOREIGN KEY ("workspace_id", "page_id") REFERENCES "pages"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_workspace_id_author_id_fkey" FOREIGN KEY ("workspace_id", "author_id") REFERENCES "workspace_members"("workspace_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_workspace_id_parent_id_fkey" FOREIGN KEY ("workspace_id", "parent_id") REFERENCES "comments"("workspace_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_workspace_id_page_id_fkey" FOREIGN KEY ("workspace_id", "page_id") REFERENCES "pages"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_workspace_id_created_by_id_fkey" FOREIGN KEY ("workspace_id", "created_by_id") REFERENCES "workspace_members"("workspace_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
