/**
 * Postmark email adapter
 */

import * as path from 'path';
import * as fs from 'fs';
import type { EmailProvider } from '../lib/ports';
import { logger } from '../lib/core/logger';

export class PostmarkMailAdapter implements EmailProvider {
  constructor(private cfg: { serverToken?: string; fromEmail: string }) {}

  async sendEmail(input: { to: string; subject: string; html: string }): Promise<void> {
    if (!this.cfg.serverToken) {
      // file sink fallback
      const dir = path.join(process.cwd(), 'tmp', 'emails');
      await fs.promises.mkdir(dir, { recursive: true });
      const fname = `${Date.now()}_${input.to.replace(/[^a-z0-9@._-]/gi, '_')}.eml`;
      const raw = `From: ${this.cfg.fromEmail}\nTo: ${input.to}\nSubject: ${input.subject}\n\n${input.html}`;
      await fs.promises.writeFile(path.join(dir, fname), raw, 'utf8');
      logger.info(
        { to: input.to, file: path.join('tmp', 'emails', fname) },
        'Email written to file sink'
      );
      return;
    }

    // Real Postmark send
    const resp = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': this.cfg.serverToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        From: this.cfg.fromEmail,
        To: input.to,
        Subject: input.subject,
        HtmlBody: input.html,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      logger.error({ status: resp.status, text }, 'Postmark send failed');
      throw new Error('MailSendFailed');
    }
  }

  async sendBookingConfirm(
    to: string,
    payload: {
      eventDate: string;
      packageTitle: string;
      totalCents: number;
      addOnTitles: string[];
    }
  ): Promise<void> {
    const subject = `Your micro-wedding is booked for ${payload.eventDate}`;
    const body = [
      `Hi,`,
      ``,
      `You're confirmed!`,
      `Date: ${payload.eventDate}`,
      `Package: ${payload.packageTitle}`,
      `Add-ons: ${payload.addOnTitles.join(', ') || 'None'}`,
      `Total: ${(payload.totalCents / 100).toFixed(2)}`,
      ``,
      `We'll be in touch with details.`,
    ].join('\n');

    if (!this.cfg.serverToken) {
      // file sink fallback
      const dir = path.join(process.cwd(), 'tmp', 'emails');
      await fs.promises.mkdir(dir, { recursive: true });
      const fname = `${Date.now()}_${to.replace(/[^a-z0-9@._-]/gi, '_')}.eml`;
      const raw = `From: ${this.cfg.fromEmail}\nTo: ${to}\nSubject: ${subject}\n\n${body}`;
      await fs.promises.writeFile(path.join(dir, fname), raw, 'utf8');
      logger.info(
        { to, file: path.join('tmp', 'emails', fname) },
        'Email written to file sink'
      );
      return;
    }

    // Real Postmark send
    const resp = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': this.cfg.serverToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        From: this.cfg.fromEmail,
        To: to,
        Subject: subject,
        TextBody: body,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      logger.error({ status: resp.status, text }, 'Postmark send failed');
      throw new Error('MailSendFailed');
    }
  }

  async sendPasswordReset(to: string, resetToken: string, resetUrl: string): Promise<void> {
    const subject = 'Reset your password';
    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">Password Reset Request</h2>
            <p>You recently requested to reset your password for your account. Click the button below to reset it.</p>
            <div style="margin: 30px 0;">
              <a href="${resetUrl}"
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              Or copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
            </p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              <strong>This link will expire in 1 hour.</strong>
            </p>
            <p style="color: #666; font-size: 14px;">
              If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
              This is an automated message, please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;

    const textBody = [
      'Password Reset Request',
      '',
      'You recently requested to reset your password for your account.',
      '',
      'Reset your password by visiting this link:',
      resetUrl,
      '',
      'This link will expire in 1 hour.',
      '',
      "If you didn't request a password reset, you can safely ignore this email.",
      'Your password will not be changed.',
    ].join('\n');

    if (!this.cfg.serverToken) {
      // file sink fallback
      const dir = path.join(process.cwd(), 'tmp', 'emails');
      await fs.promises.mkdir(dir, { recursive: true });
      const fname = `${Date.now()}_${to.replace(/[^a-z0-9@._-]/gi, '_')}.eml`;
      const raw = `From: ${this.cfg.fromEmail}\nTo: ${to}\nSubject: ${subject}\n\n${textBody}`;
      await fs.promises.writeFile(path.join(dir, fname), raw, 'utf8');
      logger.info(
        { to, file: path.join('tmp', 'emails', fname) },
        'Password reset email written to file sink'
      );
      return;
    }

    // Real Postmark send
    const resp = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': this.cfg.serverToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        From: this.cfg.fromEmail,
        To: to,
        Subject: subject,
        HtmlBody: htmlBody,
        TextBody: textBody,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      logger.error({ status: resp.status, text }, 'Postmark password reset send failed');
      throw new Error('MailSendFailed');
    }
  }

  /**
   * Send booking reminder email
   *
   * Sent 7 days before the event date to remind customers of their upcoming booking.
   * Includes a manage booking link for reschedule/cancel options.
   */
  async sendBookingReminder(
    to: string,
    payload: {
      coupleName: string;
      eventDate: string;
      packageTitle: string;
      daysUntilEvent: number;
      manageUrl: string;
    }
  ): Promise<void> {
    const formattedDate = new Date(payload.eventDate + 'T00:00:00Z').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const subject = `Reminder: Your event is coming up on ${formattedDate}`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1e3a5f;">Your Event is Coming Up!</h2>
            <p>Hi ${payload.coupleName},</p>
            <p>This is a friendly reminder that your event is just <strong>${payload.daysUntilEvent} days away</strong>!</p>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1e3a5f;">Event Details</h3>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Package:</strong> ${payload.packageTitle}</p>
            </div>

            <p>Need to make any changes? You can manage your booking online:</p>
            <div style="margin: 30px 0;">
              <a href="${payload.manageUrl}"
                 style="background-color: #c9a961; color: #1e3a5f; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                Manage Your Booking
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              Or copy and paste this link into your browser:<br>
              <a href="${payload.manageUrl}" style="color: #1e3a5f; word-break: break-all;">${payload.manageUrl}</a>
            </p>

            <p style="margin-top: 30px;">We're looking forward to seeing you!</p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
              This is an automated reminder. If you have questions, please contact us.
            </p>
          </div>
        </body>
      </html>
    `;

    const textBody = [
      `Your Event is Coming Up!`,
      ``,
      `Hi ${payload.coupleName},`,
      ``,
      `This is a friendly reminder that your event is just ${payload.daysUntilEvent} days away!`,
      ``,
      `Event Details:`,
      `Date: ${formattedDate}`,
      `Package: ${payload.packageTitle}`,
      ``,
      `Need to make any changes? Manage your booking here:`,
      payload.manageUrl,
      ``,
      `We're looking forward to seeing you!`,
    ].join('\n');

    if (!this.cfg.serverToken) {
      // file sink fallback
      const dir = path.join(process.cwd(), 'tmp', 'emails');
      await fs.promises.mkdir(dir, { recursive: true });
      const fname = `${Date.now()}_reminder_${to.replace(/[^a-z0-9@._-]/gi, '_')}.eml`;
      const raw = `From: ${this.cfg.fromEmail}\nTo: ${to}\nSubject: ${subject}\n\n${textBody}`;
      await fs.promises.writeFile(path.join(dir, fname), raw, 'utf8');
      logger.info(
        { to, file: path.join('tmp', 'emails', fname) },
        'Booking reminder email written to file sink'
      );
      return;
    }

    // Real Postmark send
    const resp = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': this.cfg.serverToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        From: this.cfg.fromEmail,
        To: to,
        Subject: subject,
        HtmlBody: htmlBody,
        TextBody: textBody,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      logger.error({ status: resp.status, text }, 'Postmark booking reminder send failed');
      throw new Error('MailSendFailed');
    }
  }
}
