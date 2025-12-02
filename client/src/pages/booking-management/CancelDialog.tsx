/**
 * Cancel Dialog Component
 * Allows customers to cancel their booking with confirmation
 */

import { useState } from 'react';
import { XCircle, AlertTriangle, Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface CancelDialogProps {
  totalCents: number;
  isCancelling: boolean;
  onCancel: (reason?: string) => Promise<boolean>;
  disabled?: boolean;
}

/**
 * Format cents to dollars
 */
function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function CancelDialog({
  totalCents,
  isCancelling,
  onCancel,
  disabled = false,
}: CancelDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const handleCancel = async () => {
    const success = await onCancel(reason || undefined);
    if (success) {
      setOpen(false);
      setReason('');
      setConfirmText('');
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setReason('');
      setConfirmText('');
    }
  };

  const canConfirm = confirmText.toLowerCase() === 'cancel';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          disabled={disabled}
        >
          <XCircle className="w-4 h-4" />
          Cancel Booking
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-macon-navy-800 border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Cancel Your Booking
          </DialogTitle>
          <DialogDescription className="text-white/60">
            This action cannot be undone. Your booking will be cancelled and a
            refund will be processed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Warning Box */}
          <div className="bg-red-900/20 rounded-lg p-4 border border-red-500/30">
            <h4 className="font-medium text-red-300 mb-2">
              What happens when you cancel:
            </h4>
            <ul className="text-sm text-red-200/80 space-y-1 list-disc list-inside">
              <li>Your booking will be permanently cancelled</li>
              <li>
                A refund of {formatMoney(totalCents)} will be processed within
                5-10 business days
              </li>
              <li>Your date will be released for other bookings</li>
              <li>You will receive a confirmation email</li>
            </ul>
          </div>

          {/* Reason (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-white">
              Reason for cancellation (optional)
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Let us know why you're cancelling..."
              className="bg-macon-navy-700 border-white/20 text-white min-h-[80px]"
              maxLength={500}
            />
            <p className="text-xs text-white/40">
              {reason.length}/500 characters
            </p>
          </div>

          {/* Confirmation Input */}
          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-white">
              Type <span className="font-mono text-red-400">cancel</span> to
              confirm
            </Label>
            <input
              id="confirm"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type 'cancel' here"
              className="w-full px-3 py-2 rounded-md bg-macon-navy-700 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-red-500/50"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            Keep Booking
          </Button>
          <Button
            onClick={handleCancel}
            disabled={isCancelling || !canConfirm}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700"
          >
            {isCancelling ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cancelling...
              </>
            ) : (
              'Confirm Cancellation'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
