-- CreateEnum
CREATE TYPE "feedback_type" AS ENUM ('PROBLEM', 'SUGGESTION', 'OTHER');

-- CreateEnum
CREATE TYPE "feedback_status" AS ENUM ('NEW', 'SEEN', 'DONE');

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "type" "feedback_type" NOT NULL,
    "message" TEXT NOT NULL,
    "contact" TEXT,
    "user_id" TEXT,
    "path" TEXT,
    "status" "feedback_status" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_status_created_idx" ON "feedback"("status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
