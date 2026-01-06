/**
 * Tests for reminder scheduler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import cron from 'node-cron';
import type { Container } from '../src/di';
import type { ReminderService } from '../src/services/reminder.service';
import type { PrismaClient } from '../src/generated/prisma/client';

// Mock node-cron
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn(),
    validate: vi.fn(() => true),
  },
}));

describe('Scheduler', () => {
  let mockContainer: Container;
  let mockReminderService: ReminderService;
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock reminder service
    mockReminderService = {
      processOverdueReminders: vi.fn().mockResolvedValue({
        processed: 5,
        failed: 0,
        bookings: [],
      }),
    } as any;

    // Create mock prisma client
    mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        { id: 'tenant-1', slug: 'test-tenant-1' },
        { id: 'tenant-2', slug: 'test-tenant-2' },
      ]),
    };

    // Create mock container
    mockContainer = {
      services: {
        reminder: mockReminderService,
      },
      prisma: mockPrisma,
    } as any;
  });

  it('should validate the cron schedule', async () => {
    const { initializeScheduler } = await import('../src/scheduler');

    initializeScheduler(mockContainer, '0 9 * * *');

    expect(cron.validate).toHaveBeenCalledWith('0 9 * * *');
  });

  it('should register a cron job with the correct schedule', async () => {
    const { initializeScheduler } = await import('../src/scheduler');

    initializeScheduler(mockContainer, '0 9 * * *');

    expect(cron.schedule).toHaveBeenCalledWith('0 9 * * *', expect.any(Function));
  });

  it('should use default schedule if invalid schedule provided', async () => {
    const { initializeScheduler } = await import('../src/scheduler');

    // Mock validate to return false for custom schedule, true for default
    vi.mocked(cron.validate).mockReturnValueOnce(false).mockReturnValueOnce(true);

    initializeScheduler(mockContainer, 'invalid-cron');

    // Should fall back to default schedule
    expect(cron.schedule).toHaveBeenCalledWith('0 9 * * *', expect.any(Function));
  });

  it('should handle missing prisma client gracefully', async () => {
    const { initializeScheduler } = await import('../src/scheduler');

    const containerWithoutPrisma = {
      ...mockContainer,
      prisma: undefined,
    };

    initializeScheduler(containerWithoutPrisma);

    // Should still register the cron job (which will skip processing when it runs)
    expect(cron.schedule).toHaveBeenCalled();
  });
});
