-- CreateIndex
-- Composite index on (tenantId, googleEventId) for Booking
-- Makes Google Calendar webhook callbacks O(1) instead of O(n) table scans
-- tenantId is the leading column for multi-tenant isolation alignment
CREATE INDEX "Booking_tenantId_googleEventId_idx" ON "Booking"("tenantId", "googleEventId");
