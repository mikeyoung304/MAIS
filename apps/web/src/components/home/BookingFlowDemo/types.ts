/**
 * BookingFlowDemo Types
 *
 * Shared types for the animated booking flow demonstration
 */

export type Stage = 'storefront' | 'calendar' | 'checkout' | 'confirmation';

export interface StageProps {
  active: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
}

export const STAGE_DURATION: Record<Stage, number> = {
  storefront: 5000, // 5s - Browse packages
  calendar: 4500, // 4.5s - Pick date/time
  checkout: 4000, // 4s - Complete payment
  confirmation: 7000, // 7s - Session Space showcase (key differentiator)
};

export const STAGES: Stage[] = ['storefront', 'calendar', 'checkout', 'confirmation'];

export const STAGE_LABELS: Record<Stage, string> = {
  storefront: 'Browse',
  calendar: 'Schedule',
  checkout: 'Pay',
  confirmation: 'Session Space',
};
