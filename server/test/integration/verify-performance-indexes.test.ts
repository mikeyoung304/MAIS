import { describe, test, expect } from 'vitest';
import { getTestPrisma } from '../helpers/global-prisma';

describe('Performance Indexes Migration (TODO-275)', () => {
  // Use singleton to prevent connection pool exhaustion
  const prisma = getTestPrisma();

  test('should verify all three performance indexes exist', async () => {
    // Query pg_indexes to verify index existence
    const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'Booking'
      AND (
        indexname = 'Booking_tenantId_bookingType_startTime_endTime_idx' OR
        indexname = 'Booking_tenantId_serviceId_startTime_idx' OR
        indexname = 'Booking_tenantId_bookingType_startTime_status_idx'
      )
      ORDER BY indexname;
    `;

    // Should have exactly 3 indexes
    expect(indexes).toHaveLength(3);

    // Verify each index by name
    const indexNames = indexes.map((i) => i.indexname);
    expect(indexNames).toContain('Booking_tenantId_bookingType_startTime_endTime_idx');
    expect(indexNames).toContain('Booking_tenantId_serviceId_startTime_idx');
    expect(indexNames).toContain('Booking_tenantId_bookingType_startTime_status_idx');
  });

  test('should verify indexes are B-tree type', async () => {
    const indexDefs = await prisma.$queryRaw<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'Booking'
      AND indexname IN (
        'Booking_tenantId_bookingType_startTime_endTime_idx',
        'Booking_tenantId_serviceId_startTime_idx',
        'Booking_tenantId_bookingType_startTime_status_idx'
      );
    `;

    // All indexes should use BTREE
    for (const idx of indexDefs) {
      expect(idx.indexdef).toContain('btree');
    }
  });

  test('should verify timeslot availability index covers correct columns', async () => {
    const indexDef = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef
      FROM pg_indexes
      WHERE tablename = 'Booking'
      AND indexname = 'Booking_tenantId_bookingType_startTime_endTime_idx';
    `;

    expect(indexDef).toHaveLength(1);
    expect(indexDef[0].indexdef).toContain('tenantId');
    expect(indexDef[0].indexdef).toContain('bookingType');
    expect(indexDef[0].indexdef).toContain('startTime');
    expect(indexDef[0].indexdef).toContain('endTime');
  });

  test('should verify service-specific index covers correct columns', async () => {
    const indexDef = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef
      FROM pg_indexes
      WHERE tablename = 'Booking'
      AND indexname = 'Booking_tenantId_serviceId_startTime_idx';
    `;

    expect(indexDef).toHaveLength(1);
    expect(indexDef[0].indexdef).toContain('tenantId');
    expect(indexDef[0].indexdef).toContain('serviceId');
    expect(indexDef[0].indexdef).toContain('startTime');
  });

  test('should verify pagination index covers correct columns', async () => {
    const indexDef = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef
      FROM pg_indexes
      WHERE tablename = 'Booking'
      AND indexname = 'Booking_tenantId_bookingType_startTime_status_idx';
    `;

    expect(indexDef).toHaveLength(1);
    expect(indexDef[0].indexdef).toContain('tenantId');
    expect(indexDef[0].indexdef).toContain('bookingType');
    expect(indexDef[0].indexdef).toContain('startTime');
    expect(indexDef[0].indexdef).toContain('status');
  });
});
