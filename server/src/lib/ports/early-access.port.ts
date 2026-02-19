/**
 * Early Access Port — Early access request persistence for waitlist signups
 */

/**
 * Early Access Request entity
 */
export interface EarlyAccessRequest {
  id: string;
  email: string;
  source: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Early Access Repository - Early access request persistence
 * Used for homepage waitlist signups
 */
export interface EarlyAccessRepository {
  /**
   * Upsert early access request (creates or updates timestamp if exists)
   * Returns the request and whether it was newly created
   */
  upsert(email: string, source: string): Promise<{ request: EarlyAccessRequest; isNew: boolean }>;
}
