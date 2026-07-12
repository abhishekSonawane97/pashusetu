-- CreateTable
CREATE TABLE "otp_challenges" (
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "send_count" INTEGER NOT NULL DEFAULT 1,
    "window_start" TIMESTAMP(3) NOT NULL,
    "last_sent_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("phone")
);

-- CreateTable
CREATE TABLE "otp_ip_throttle" (
    "ip" TEXT NOT NULL,
    "send_count" INTEGER NOT NULL DEFAULT 1,
    "window_start" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otp_ip_throttle_pkey" PRIMARY KEY ("ip")
);

-- CreateIndex
CREATE INDEX "otp_challenges_expiry_idx" ON "otp_challenges"("expires_at");
