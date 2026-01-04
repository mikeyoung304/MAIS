'use client';

import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StageProps } from '../types';

/**
 * Mock calendar data - January 2025
 */
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const CALENDAR_DATES = [
  [null, null, 1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10, 11, 12],
  [13, 14, 15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24, 25, 26],
];

const AVAILABLE_DATES = [9, 10, 14, 16, 17, 23, 24];
const SELECTED_DATE = 9;

const TIME_SLOTS = ['10:00 AM', '2:00 PM', '4:00 PM'];
const SELECTED_TIME = '2:00 PM';

/**
 * CalendarStage - Date and time selection view
 *
 * Shows a calendar with available dates highlighted and time slots
 * below. This is the second step after choosing a package.
 */
export function CalendarStage({ active }: StageProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 p-3 transition-all duration-500 overflow-hidden',
        active ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'
      )}
    >
      {/* Header with back button */}
      <div className="flex items-center gap-2 mb-3">
        <button className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center">
          <ChevronLeft className="w-3 h-3 text-text-muted" />
        </button>
        <div className="flex-1">
          <p className="text-[11px] font-semibold text-text-primary">Essential Package</p>
          <p className="text-[9px] text-sage">$275 • 4 sessions</p>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-neutral-800/50 rounded-xl p-2.5 mb-2.5">
        {/* Month header */}
        <div className="flex items-center justify-between mb-2">
          <button className="p-0.5">
            <ChevronLeft className="w-3 h-3 text-text-muted" />
          </button>
          <span className="text-[10px] font-medium text-text-primary">January 2025</span>
          <button className="p-0.5">
            <ChevronRight className="w-3 h-3 text-text-muted" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS.map((day, i) => (
            <div key={i} className="text-center text-[8px] text-text-muted font-medium">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="space-y-1">
          {CALENDAR_DATES.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map((date, dayIndex) => {
                const isAvailable = date && AVAILABLE_DATES.includes(date);
                const isSelected = date === SELECTED_DATE;

                return (
                  <div
                    key={dayIndex}
                    className={cn(
                      'aspect-square flex items-center justify-center rounded-md text-[9px] transition-all',
                      !date && 'opacity-0',
                      date && !isAvailable && 'text-neutral-600',
                      isAvailable &&
                        !isSelected &&
                        'text-text-primary bg-sage/10 hover:bg-sage/20 cursor-pointer',
                      isSelected && 'bg-sage text-white font-semibold ring-2 ring-sage/30'
                    )}
                  >
                    {date}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Time slots */}
      <div className="mb-2.5">
        <p className="text-[9px] text-text-muted mb-1.5">Available Times for Thu, Jan 9</p>
        <div className="flex gap-1.5">
          {TIME_SLOTS.map((time) => {
            const isSelected = time === SELECTED_TIME;
            return (
              <button
                key={time}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all',
                  isSelected
                    ? 'bg-sage text-white'
                    : 'bg-neutral-800 text-text-primary hover:bg-neutral-700'
                )}
              >
                {time}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selection summary */}
      <div className="bg-sage/10 border border-sage/20 rounded-lg p-2 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium text-text-primary">Thursday, January 9</p>
          <p className="text-[9px] text-sage">2:00 PM • Essential Package</p>
        </div>
        <button className="flex items-center gap-1 bg-sage text-white px-2.5 py-1 rounded-full text-[9px] font-medium">
          <Check className="w-2.5 h-2.5" />
          Continue
        </button>
      </div>
    </div>
  );
}
