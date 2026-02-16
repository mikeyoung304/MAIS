-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "guestCount" INTEGER;

-- AlterTable
ALTER TABLE "Tier" ADD COLUMN     "displayPriceCents" INTEGER,
ADD COLUMN     "maxGuests" INTEGER,
ADD COLUMN     "scalingRules" JSONB;

-- CreateIndex
CREATE INDEX "Tier_tenantId_maxGuests_idx" ON "Tier"("tenantId", "maxGuests");
