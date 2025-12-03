import { Plus, Loader2, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ANIMATION_TRANSITION } from "@/lib/animation-constants";

interface BlackoutFormProps {
  newBlackoutDate: string;
  setNewBlackoutDate: (date: string) => void;
  newBlackoutReason: string;
  setNewBlackoutReason: (reason: string) => void;
  isAdding: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

/**
 * BlackoutForm Component
 *
 * Form for adding new blackout dates with optional reason
 * Design: Matches landing page aesthetic with sage accents
 */
export function BlackoutForm({
  newBlackoutDate,
  setNewBlackoutDate,
  newBlackoutReason,
  setNewBlackoutReason,
  isAdding,
  onSubmit
}: BlackoutFormProps) {
  return (
    <div className="bg-surface-alt rounded-2xl border border-sage-light/20 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-sage/10 rounded-xl flex items-center justify-center">
          <CalendarPlus className="w-5 h-5 text-sage" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-serif text-xl font-bold text-text-primary">Add Blackout Date</h2>
          <p className="text-sm text-text-muted">Block a date from accepting bookings</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 space-y-2">
          <Label htmlFor="blackoutDate" className="text-text-primary text-sm font-medium">
            Date
          </Label>
          <Input
            id="blackoutDate"
            type="date"
            value={newBlackoutDate}
            onChange={(e) => setNewBlackoutDate(e.target.value)}
            className="bg-white border-sage-light/30 text-text-primary focus:border-sage focus:ring-sage/20 h-11 rounded-xl"
            required
            disabled={isAdding}
          />
        </div>
        <div className="flex-1 space-y-2">
          <Label htmlFor="blackoutReason" className="text-text-primary text-sm font-medium">
            Reason <span className="text-text-muted font-normal">(optional)</span>
          </Label>
          <Input
            id="blackoutReason"
            type="text"
            value={newBlackoutReason}
            onChange={(e) => setNewBlackoutReason(e.target.value)}
            placeholder="Holiday, maintenance, etc."
            className="bg-white border-sage-light/30 text-text-primary placeholder:text-text-muted/50 focus:border-sage focus:ring-sage/20 h-11 rounded-xl"
            disabled={isAdding}
          />
        </div>
        <div className="flex items-end">
          <Button
            type="submit"
            className={`bg-sage hover:bg-sage-hover text-white h-11 px-6 rounded-full shadow-soft hover:shadow-medium ${ANIMATION_TRANSITION.HOVER}`}
            disabled={isAdding}
          >
            {isAdding ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                Add Date
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}