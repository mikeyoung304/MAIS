/**
 * Type definitions for AvailabilityRulesManager
 */

import type { AvailabilityRuleDto, ServiceDto } from '@macon/contracts';

export type { AvailabilityRuleDto, ServiceDto };

export interface AvailabilityRulesManagerProps {
  rules: AvailabilityRuleDto[];
  services: ServiceDto[];
  isLoading: boolean;
  onRulesChange: () => void;
}

export interface RuleFormData {
  serviceId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
}

export const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const DAY_COLORS = [
  'bg-purple-100 border-purple-300 text-purple-900 dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-300', // Sunday
  'bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300', // Monday
  'bg-green-100 border-green-300 text-green-900 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300', // Tuesday
  'bg-yellow-100 border-yellow-300 text-yellow-900 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-300', // Wednesday
  'bg-orange-100 border-orange-300 text-orange-900 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-300', // Thursday
  'bg-red-100 border-red-300 text-red-900 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300', // Friday
  'bg-indigo-100 border-indigo-300 text-indigo-900 dark:bg-indigo-900/20 dark:border-indigo-700 dark:text-indigo-300', // Saturday
] as const;
