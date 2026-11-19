-- Existing rows remain nullable for a non-destructive migration. Every new update receives
-- a SHA-256 hash from the API, making concurrent client retries idempotent at insertion time.
ALTER TABLE "yjs_updates" ADD COLUMN "update_hash" VARCHAR(64);

CREATE UNIQUE INDEX "yjs_updates_workspace_id_page_id_update_hash_key"
ON "yjs_updates"("workspace_id", "page_id", "update_hash");
