/**
 * Email Provider Port — Email notification integration
 */

/**
 * Email Provider - Email notifications
 */
export interface EmailProvider {
  sendEmail(input: { to: string; subject: string; html: string }): Promise<void>;
}
