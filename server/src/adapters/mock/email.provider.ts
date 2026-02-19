/**
 * Mock Email Provider
 *
 * In-memory implementation of EmailProvider for testing and local development.
 */

import type { EmailProvider } from '../../lib/ports';
import { logger } from '../../lib/core/logger';

export class MockEmailProvider implements EmailProvider {
  async sendEmail(input: { to: string; subject: string; html: string }): Promise<void> {
    logger.debug(
      {
        to: input.to,
        subject: input.subject,
        bodyPreview: input.html.substring(0, 100),
      },
      'Mock email sent'
    );
  }
}
