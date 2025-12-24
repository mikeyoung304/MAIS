/**
 * DateSelectionStep Component (Step 1)
 *
 * Displays a calendar for selecting an event date.
 * Unavailable dates are disabled in the picker.
 */

import React from 'react';
import { DayPicker } from 'react-day-picker';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Calendar, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { DateSelectionStepProps } from './types';
import 'react-day-picker/style.css';

const DateSelectionStep = React.memo(
  ({ selectedDate, onDateSelect, unavailableDates, isLoadingDates }: DateSelectionStepProps) => {
    return (
      <Card className="border-neutral-200 shadow-elevation-1">
        <CardHeader>
          <CardTitle className="text-2xl font-heading">
            <Calendar className="inline-block w-6 h-6 mr-2 text-macon-orange" />
            Choose Your Date
          </CardTitle>
          <p className="text-neutral-500 text-base mt-1">Select the date for your event</p>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            {isLoadingDates ? (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="w-8 h-8 text-macon-orange animate-spin" />
                <p className="mt-2 text-neutral-500">Loading available dates...</p>
              </div>
            ) : (
              <DayPicker
                mode="single"
                selected={selectedDate || undefined}
                onSelect={onDateSelect}
                disabled={[{ before: new Date() }, ...unavailableDates]}
                className="border border-neutral-300 rounded-xl p-4 bg-white"
                modifiersStyles={{
                  selected: {
                    backgroundColor: '#F97316', // macon-orange
                    color: 'white',
                  },
                }}
              />
            )}
          </div>
          {selectedDate && (
            <p className="text-center mt-4 text-lg font-medium text-neutral-900">
              Selected: {formatDate(selectedDate)}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }
);

DateSelectionStep.displayName = 'DateSelectionStep';

export default DateSelectionStep;
