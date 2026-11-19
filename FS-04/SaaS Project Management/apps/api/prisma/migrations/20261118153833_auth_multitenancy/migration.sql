/*
  Warnings:

  - Added the required column `passwordHash` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "passwordHash" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "memberships_userId_isActive_idx" ON "memberships"("userId", "isActive");
