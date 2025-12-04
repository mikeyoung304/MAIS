/**
 * Reschedule Dialog Component
 * Allows customers to reschedule their booking to a new date
 */

import { useState } from 'react';
import { Calendar, ArrowRight, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/lib/utils';

interface RescheduleDialogProps {
  currentDate: string;
  isRescheduling: boolean;
  onReschedule: (newDate: string) => Promise<boolean>;
  disabled?: boolean;
}

/**
 * Get minimum selectable date (tomorrow)
 */
function getMinDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

export function RescheduleDialog({
  currentDate,
  isRescheduling,
  onReschedule,
  disabled = false,
}: RescheduleDialogProps) {
  const [open, setOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleReschedule = async () => {
    setError(null);

    if (!newDate) {
      setError('Please select a new date');
      return;
    }

    if (newDate === currentDate) {
      setError('Please select a different date');
      return;
    }

    const success = await onReschedule(newDate);
    if (success) {
      setOpen(false);
      setNewDate('');
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setNewDate('');
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-white/20 text-white hover:bg-white/10"
          disabled={disabled}
        >
          <Calendar className="w-4 h-4" />
          Reschedule
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-macon-navy-800 border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl">Reschedule Your Booking</DialogTitle>
          <DialogDescription className="text-white/60">
            Choose a new date for your event. The original date will be released for other bookings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Date Display */}
          <div className="bg-macon-navy-700 rounded-lg p-4">
            <p className="text-sm text-white/60 mb-1">Current Date</p>
            <p className="text-lg font-medium">{formatDate(currentDate)}</p>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowRight className="w-6 h-6 text-white/40" />
          </div>

          {/* New Date Input */}
          <div className="space-y-2">
            <Label htmlFor="newDate" className="text-white">
              New Date
            </Label>
            <Input
              id="newDate"
              type="date"
              value={newDate}
              onChange={(e) => {
                setNewDate(e.target.value);
                setError(null);
              }}
              min={getMinDate()}
              className="bg-macon-navy-700 border-white/20 text-white"
            />
            {newDate && <p className="text-sm text-macon-gold">{formatDate(newDate)}</p>}
          </div>

          {/* Error Message */}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleReschedule}
            disabled={isRescheduling || !newDate}
            className="bg-macon-gold text-macon-navy hover:bg-macon-gold/90"
          >
            {isRescheduling ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Rescheduling...
              </>
            ) : (
              'Confirm Reschedule'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
