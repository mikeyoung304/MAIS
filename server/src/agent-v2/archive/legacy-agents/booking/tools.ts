/**
 * Booking Agent Tools
 *
 * These tools power the customer-facing Booking Agent.
 * All tools are scoped by tenantId for multi-tenant isolation.
 *
 * Trust Tiers:
 * - T1: Read operations (get_services, check_availability, etc.)
 * - T3: Write operations (create_booking - requires explicit confirmation)
 */

import { z } from 'zod';
import { logger } from '../../../lib/core/logger.js';

// Tool parameter schemas
export const GetServicesParams = z.object({
  tenantId: z.string().describe('The tenant ID to fetch services for'),
  category: z.string().optional().describe('Optional category filter'),
  activeOnly: z.boolean().default(true).describe('Only return active services'),
});

export const GetServiceDetailsParams = z.object({
  tenantId: z.string().describe('The tenant ID'),
  serviceId: z.string().describe('The service ID to get details for'),
});

export const CheckAvailabilityParams = z.object({
  tenantId: z.string().describe('The tenant ID'),
  serviceId: z.string().describe('The service to check availability for'),
  startDate: z.string().describe('Start date for availability window (ISO format)'),
  endDate: z.string().describe('End date for availability window (ISO format)'),
});

export const GetBusinessInfoParams = z.object({
  tenantId: z.string().describe('The tenant ID'),
});

export const AnswerFaqParams = z.object({
  tenantId: z.string().describe('The tenant ID'),
  question: z.string().describe('The customer question to answer'),
});

export const RecommendPackageParams = z.object({
  tenantId: z.string().describe('The tenant ID'),
  preferences: z
    .object({
      budget: z.enum(['low', 'medium', 'high']).optional(),
      occasion: z.string().optional(),
      groupSize: z.number().optional(),
    })
    .describe('Customer preferences for recommendation'),
});

export const CreateBookingParams = z.object({
  tenantId: z.string().describe('The tenant ID'),
  serviceId: z.string().describe('The service to book'),
  customerId: z.string().describe('The customer ID'),
  scheduledAt: z.string().describe('The appointment time (ISO format)'),
  notes: z.string().optional().describe('Optional booking notes'),
});

// Tool result types
export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number; // minutes
  category?: string;
  active: boolean;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
}

export interface BusinessInfo {
  name: string;
  description: string;
  location: string;
  phone?: string;
  email?: string;
  hours: Record<string, string>;
}

export interface FaqAnswer {
  answer: string;
  confidence: number;
  source: 'faq' | 'inferred';
}

export interface PackageRecommendation {
  serviceId: string;
  serviceName: string;
  reason: string;
  price: number;
  matchScore: number;
}

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  confirmationCode?: string;
  error?: string;
}

/**
 * Booking Agent Tool Implementations
 *
 * These are the actual tool functions that will be called by the agent.
 * Each function receives parameters and a context object with tenant info.
 */
export class BookingAgentTools {
  constructor(
    private prisma: any, // PrismaClient - typed properly when integrated
    private tenantService: any // TenantService for business info
  ) {}

  /**
   * T1: Get all services for a tenant
   */
  async getServices(params: z.infer<typeof GetServicesParams>): Promise<Service[]> {
    const { tenantId, category, activeOnly } = params;

    logger.debug({ tenantId, category, activeOnly }, 'getServices called');

    // CRITICAL: Always filter by tenantId
    const where: any = { tenantId };
    if (activeOnly) where.active = true;
    if (category) where.category = category;

    const services = await this.prisma.service.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        duration: true,
        category: true,
        active: true,
      },
      orderBy: { displayOrder: 'asc' },
    });

    return services;
  }

  /**
   * T1: Get detailed info about a specific service
   */
  async getServiceDetails(
    params: z.infer<typeof GetServiceDetailsParams>
  ): Promise<Service | null> {
    const { tenantId, serviceId } = params;

    logger.debug({ tenantId, serviceId }, 'getServiceDetails called');

    // CRITICAL: Verify service belongs to tenant
    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
        tenantId, // Multi-tenant isolation
      },
    });

    if (!service) {
      logger.warn({ tenantId, serviceId }, 'Service not found or wrong tenant');
      return null;
    }

    return service;
  }

  /**
   * T1: Check availability for a service
   */
  async checkAvailability(params: z.infer<typeof CheckAvailabilityParams>): Promise<TimeSlot[]> {
    const { tenantId, serviceId, startDate, endDate } = params;

    logger.debug({ tenantId, serviceId, startDate, endDate }, 'checkAvailability called');

    // Get existing bookings in the date range
    const existingBookings = await this.prisma.booking.findMany({
      where: {
        tenantId, // Multi-tenant isolation
        serviceId,
        scheduledAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
      select: {
        scheduledAt: true,
        service: { select: { duration: true } },
      },
    });

    // Get tenant's business hours
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessHours: true },
    });

    // Generate available slots (simplified - real implementation would be more complex)
    const slots: TimeSlot[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    // This is a simplified implementation
    // Real implementation would:
    // 1. Parse business hours
    // 2. Account for service duration
    // 3. Check for conflicts with existing bookings
    // 4. Handle buffer time between appointments

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      // Generate slots for each day (9am - 5pm as example)
      for (let hour = 9; hour < 17; hour++) {
        const slotStart = new Date(d);
        slotStart.setHours(hour, 0, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setHours(hour + 1, 0, 0, 0);

        // Check if slot conflicts with existing bookings
        const isBooked = existingBookings.some(
          (booking: { scheduledAt: Date | string; service: { duration: number } }) => {
            const bookingTime = new Date(booking.scheduledAt);
            return bookingTime.getTime() === slotStart.getTime();
          }
        );

        slots.push({
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          available: !isBooked,
        });
      }
    }

    return slots.slice(0, 20); // Limit to 20 slots to avoid overwhelming the agent
  }

  /**
   * T1: Get business information
   */
  async getBusinessInfo(
    params: z.infer<typeof GetBusinessInfoParams>
  ): Promise<BusinessInfo | null> {
    const { tenantId } = params;

    logger.debug({ tenantId }, 'getBusinessInfo called');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        businessName: true,
        description: true,
        location: true,
        phone: true,
        email: true,
        businessHours: true,
      },
    });

    if (!tenant) return null;

    return {
      name: tenant.businessName,
      description: tenant.description || '',
      location: tenant.location || '',
      phone: tenant.phone,
      email: tenant.email,
      hours: (tenant.businessHours as Record<string, string>) || {},
    };
  }

  /**
   * T1: Answer a customer FAQ
   */
  async answerFaq(params: z.infer<typeof AnswerFaqParams>): Promise<FaqAnswer> {
    const { tenantId, question } = params;

    logger.debug({ tenantId, question: question.substring(0, 50) }, 'answerFaq called');

    // Look for matching FAQ in tenant's FAQ database
    const faqs = await this.prisma.faq.findMany({
      where: { tenantId },
    });

    // Simple keyword matching (real implementation would use embeddings/semantic search)
    const questionLower = question.toLowerCase();
    const matchingFaq = faqs.find(
      (faq: any) =>
        questionLower.includes(faq.question.toLowerCase()) ||
        faq.keywords?.some((kw: string) => questionLower.includes(kw.toLowerCase()))
    );

    if (matchingFaq) {
      return {
        answer: matchingFaq.answer,
        confidence: 0.9,
        source: 'faq',
      };
    }

    // No direct match - agent will need to infer from context
    return {
      answer:
        "I don't have a specific answer for that, but let me help you based on what I know about the business.",
      confidence: 0.5,
      source: 'inferred',
    };
  }

  /**
   * T1: Recommend a package based on preferences
   */
  async recommendPackage(
    params: z.infer<typeof RecommendPackageParams>
  ): Promise<PackageRecommendation[]> {
    const { tenantId, preferences } = params;

    logger.debug({ tenantId, preferences }, 'recommendPackage called');

    const services = await this.prisma.service.findMany({
      where: {
        tenantId,
        active: true,
      },
      orderBy: { price: 'asc' },
    });

    // Simple recommendation logic (real implementation would be smarter)
    const recommendations: PackageRecommendation[] = services
      .map((service: any) => {
        let matchScore = 0.5; // Base score

        // Budget matching
        if (preferences.budget) {
          const avgPrice =
            services.reduce((sum: number, s: any) => sum + s.price, 0) / services.length;
          if (preferences.budget === 'low' && service.price < avgPrice * 0.7) matchScore += 0.2;
          if (
            preferences.budget === 'medium' &&
            service.price >= avgPrice * 0.7 &&
            service.price <= avgPrice * 1.3
          )
            matchScore += 0.2;
          if (preferences.budget === 'high' && service.price > avgPrice * 1.3) matchScore += 0.2;
        }

        // Occasion matching (if service tags exist)
        if (preferences.occasion && service.tags?.includes(preferences.occasion)) {
          matchScore += 0.3;
        }

        return {
          serviceId: service.id,
          serviceName: service.name,
          reason: `Based on your ${preferences.budget || 'specified'} budget preference`,
          price: service.price,
          matchScore,
        };
      })
      .sort((a: PackageRecommendation, b: PackageRecommendation) => b.matchScore - a.matchScore)
      .slice(0, 3); // Top 3 recommendations

    return recommendations;
  }

  /**
   * T3: Create a booking (requires explicit confirmation)
   *
   * IMPORTANT: This is a T3 operation. The agent must show the booking
   * details to the customer and get explicit confirmation before calling this.
   */
  async createBooking(params: z.infer<typeof CreateBookingParams>): Promise<BookingResult> {
    const { tenantId, serviceId, customerId, scheduledAt, notes } = params;

    logger.info({ tenantId, serviceId, customerId, scheduledAt }, 'createBooking called');

    try {
      // Verify service belongs to tenant
      const service = await this.prisma.service.findFirst({
        where: { id: serviceId, tenantId },
      });

      if (!service) {
        return {
          success: false,
          error: 'Service not found',
        };
      }

      // Check for double-booking (with advisory lock in real implementation)
      const existingBooking = await this.prisma.booking.findFirst({
        where: {
          tenantId,
          serviceId,
          scheduledAt: new Date(scheduledAt),
          status: { in: ['CONFIRMED', 'PENDING'] },
        },
      });

      if (existingBooking) {
        return {
          success: false,
          error: 'This time slot is no longer available',
        };
      }

      // Create the booking
      const booking = await this.prisma.booking.create({
        data: {
          tenantId,
          serviceId,
          customerId,
          scheduledAt: new Date(scheduledAt),
          notes,
          status: 'PENDING',
          totalPrice: service.price,
        },
      });

      // Generate confirmation code
      const confirmationCode = `BK-${booking.id.substring(0, 8).toUpperCase()}`;

      logger.info({ bookingId: booking.id, confirmationCode, tenantId }, 'Booking created');

      return {
        success: true,
        bookingId: booking.id,
        confirmationCode,
      };
    } catch (error) {
      logger.error({ error, tenantId, serviceId }, 'Failed to create booking');
      return {
        success: false,
        error: 'Failed to create booking. Please try again.',
      };
    }
  }
}

/**
 * Tool definitions for ADK registration
 *
 * These define the tools that will be available to the Booking Agent
 * in the Vertex AI Agent Builder.
 */
export const BOOKING_AGENT_TOOL_DEFINITIONS = [
  {
    name: 'get_services',
    description:
      'Get all available services for this business. Returns a list of services with names, descriptions, prices, and durations.',
    parameters: GetServicesParams,
    trustTier: 'T1',
  },
  {
    name: 'get_service_details',
    description:
      'Get detailed information about a specific service including full description and pricing.',
    parameters: GetServiceDetailsParams,
    trustTier: 'T1',
  },
  {
    name: 'check_availability',
    description:
      'Check available time slots for a service within a date range. Returns a list of available and unavailable slots.',
    parameters: CheckAvailabilityParams,
    trustTier: 'T1',
  },
  {
    name: 'get_business_info',
    description:
      'Get general business information including name, location, contact details, and hours of operation.',
    parameters: GetBusinessInfoParams,
    trustTier: 'T1',
  },
  {
    name: 'answer_faq',
    description:
      'Answer a customer question using the business FAQ database. Returns the answer and confidence level.',
    parameters: AnswerFaqParams,
    trustTier: 'T1',
  },
  {
    name: 'recommend_package',
    description:
      'Recommend services based on customer preferences like budget, occasion, and group size.',
    parameters: RecommendPackageParams,
    trustTier: 'T1',
  },
  {
    name: 'create_booking',
    description:
      'Create a new booking for a service. IMPORTANT: Always show booking details and get explicit customer confirmation before calling this.',
    parameters: CreateBookingParams,
    trustTier: 'T3',
  },
];
