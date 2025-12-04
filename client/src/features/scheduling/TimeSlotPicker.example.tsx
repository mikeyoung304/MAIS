/**
 * Example usage of TimeSlotPicker component
 *
 * This file demonstrates how to integrate TimeSlotPicker into a booking flow.
 * DO NOT import this file in production code - it's for reference only.
 */

import { useState } from 'react';
import { TimeSlotPicker } from './TimeSlotPicker';

export function BookingFlowExample() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<{
    startTime: Date;
    endTime: Date;
  }>();

  // This would come from your service selection step
  const serviceId = 'service_123';

  const handleSlotSelect = (slot: { startTime: Date; endTime: Date }) => {
    setSelectedSlot(slot);
    console.log('Selected slot:', {
      start: slot.startTime.toISOString(),
      end: slot.endTime.toISOString(),
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Book Your Appointment</h1>

      {/* Step 1: Date Selection (you would use DatePicker here) */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Step 1: Select a Date</h2>
        {/* DatePicker component would go here */}
        <p className="text-neutral-600">Current date: {selectedDate.toLocaleDateString()}</p>
      </div>

      {/* Step 2: Time Slot Selection */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Step 2: Select a Time</h2>
        <TimeSlotPicker
          serviceId={serviceId}
          selectedDate={selectedDate}
          onSelect={handleSlotSelect}
          selectedSlot={selectedSlot}
        />
      </div>

      {/* Step 3: Confirmation */}
      {selectedSlot && (
        <div className="mt-8 p-6 bg-neutral-50 rounded-lg border border-neutral-200">
          <h2 className="text-xl font-semibold mb-4">Your Selection</h2>
          <div className="space-y-2">
            <p>
              <strong>Date:</strong> {selectedDate.toLocaleDateString('en-US')}
            </p>
            <p>
              <strong>Time:</strong>{' '}
              {selectedSlot.startTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </p>
          </div>
          <button className="mt-4 px-6 py-2 bg-macon-orange text-white rounded-lg hover:bg-opacity-90 transition-colors">
            Confirm Booking
          </button>
        </div>
      )}
    </div>
  );
}
