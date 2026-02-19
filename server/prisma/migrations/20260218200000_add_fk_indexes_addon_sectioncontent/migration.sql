-- AddOn: standalone FK index on segmentId for Segment deletion/update constraint checks
CREATE INDEX "AddOn_segmentId_idx" ON "AddOn"("segmentId");

-- SectionContent: standalone FK index on segmentId for Segment deletion/update constraint checks
CREATE INDEX "SectionContent_segmentId_idx" ON "SectionContent"("segmentId");
