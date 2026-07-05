-- CreateEnum
CREATE TYPE "species" AS ENUM ('COW', 'BUFFALO', 'BULL_OX', 'GOAT', 'SHEEP');

-- CreateEnum
CREATE TYPE "sex" AS ENUM ('FEMALE', 'MALE');

-- CreateEnum
CREATE TYPE "listing_status" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'SOLD', 'REJECTED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "language_pref" AS ENUM ('MR', 'EN');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'BANNED');

-- CreateEnum
CREATE TYPE "interest_type" AS ENUM ('CALL', 'WHATSAPP', 'INTEREST');

-- CreateEnum
CREATE TYPE "report_reason" AS ENUM ('FAKE', 'SOLD_ALREADY', 'WRONG_INFO', 'SPAM', 'ILLEGAL', 'OTHER');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('SMS', 'INAPP');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "moderation_action" AS ENUM ('APPROVE', 'REJECT', 'BAN', 'UNBAN', 'RESOLVE_REPORT', 'DISMISS_REPORT', 'AUTO_HIDE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firebase_uid" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_farmer" BOOLEAN NOT NULL DEFAULT true,
    "is_buyer" BOOLEAN NOT NULL DEFAULT true,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "district_id" TEXT,
    "taluka" TEXT,
    "village" TEXT,
    "language_pref" "language_pref" NOT NULL DEFAULT 'MR',
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_mr" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'MH',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breeds" (
    "id" TEXT NOT NULL,
    "species" "species" NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_mr" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "breeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "species" "species" NOT NULL,
    "breed_id" TEXT,
    "description" TEXT,
    "sex" "sex",
    "age_months" INTEGER,
    "weight_kg" INTEGER,
    "milk_yield_lpd" DECIMAL(4,1),
    "lactation_number" INTEGER,
    "is_pregnant" BOOLEAN,
    "is_vaccinated" BOOLEAN,
    "price_inr" INTEGER,
    "negotiable" BOOLEAN NOT NULL DEFAULT true,
    "district_id" TEXT,
    "taluka" TEXT,
    "village" TEXT,
    "status" "listing_status" NOT NULL DEFAULT 'DRAFT',
    "rejection_reason" TEXT,
    "declaration_accepted" BOOLEAN NOT NULL DEFAULT false,
    "declaration_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "sold_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_of_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_images" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "r2_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "user_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("user_id","listing_id")
);

-- CreateTable
CREATE TABLE "interest_events" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "type" "interest_type" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interest_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "reason" "report_reason" NOT NULL,
    "details" TEXT,
    "status" "report_status" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "status" "notification_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_log" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "listing_id" TEXT,
    "user_id" TEXT,
    "action" "moderation_action" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_district_idx" ON "users"("district_id");

-- CreateIndex
CREATE UNIQUE INDEX "districts_name_en_key" ON "districts"("name_en");

-- CreateIndex
CREATE UNIQUE INDEX "breeds_species_name_key" ON "breeds"("species", "name_en");

-- CreateIndex
CREATE INDEX "listings_search_idx" ON "listings"("status", "species", "district_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "listings_status_created_idx" ON "listings"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "listings_status_district_idx" ON "listings"("status", "district_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "listings_status_species_idx" ON "listings"("status", "species", "created_at" DESC);

-- CreateIndex
CREATE INDEX "listings_status_breed_idx" ON "listings"("status", "breed_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "listings_status_price_idx" ON "listings"("status", "price_inr");

-- CreateIndex
CREATE INDEX "listings_seller_idx" ON "listings"("seller_id", "status");

-- CreateIndex
CREATE INDEX "listings_expiry_idx" ON "listings"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "listing_images_r2_key_key" ON "listing_images"("r2_key");

-- CreateIndex
CREATE INDEX "listing_images_listing_idx" ON "listing_images"("listing_id", "sort_order");

-- CreateIndex
CREATE INDEX "favorites_user_recent_idx" ON "favorites"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "favorites_listing_idx" ON "favorites"("listing_id");

-- CreateIndex
CREATE INDEX "interest_events_listing_idx" ON "interest_events"("listing_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "interest_events_buyer_idx" ON "interest_events"("buyer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reports_listing_status_idx" ON "reports"("listing_id", "status");

-- CreateIndex
CREATE INDEX "reports_reporter_idx" ON "reports"("reporter_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reports_status_created_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_status_idx" ON "notifications"("user_id", "status");

-- CreateIndex
CREATE INDEX "notifications_user_recent_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_dispatch_idx" ON "notifications"("status", "created_at");

-- CreateIndex
CREATE INDEX "notifications_purge_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "moderation_log_listing_idx" ON "moderation_log"("listing_id");

-- CreateIndex
CREATE INDEX "moderation_log_user_idx" ON "moderation_log"("user_id");

-- CreateIndex
CREATE INDEX "moderation_log_action_idx" ON "moderation_log"("action", "created_at" DESC);

-- CreateIndex
CREATE INDEX "moderation_log_recent_idx" ON "moderation_log"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_breed_id_fkey" FOREIGN KEY ("breed_id") REFERENCES "breeds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_duplicate_of_id_fkey" FOREIGN KEY ("duplicate_of_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_images" ADD CONSTRAINT "listing_images_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interest_events" ADD CONSTRAINT "interest_events_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interest_events" ADD CONSTRAINT "interest_events_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
