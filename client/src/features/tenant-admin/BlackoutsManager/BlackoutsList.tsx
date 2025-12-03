import { Trash2, Loader2, CalendarOff, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import type { BlackoutDto } from "./types";
import { ANIMATION_TRANSITION } from "@/lib/animation-constants";

interface BlackoutsListProps {
  blackouts: BlackoutDto[];
  isLoading: boolean;
  onDeleteClick: (blackout: BlackoutDto) => void;
}

/**
 * BlackoutsList Component
 *
 * Displays blackout dates in an elegant card list
 * Design: Matches landing page aesthetic with sage accents
 */
export function BlackoutsList({ blackouts, isLoading, onDeleteClick }: BlackoutsListProps) {
  // Sort blackouts by date (upcoming first, then past)
  const sortedBlackouts = [...blackouts].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingBlackouts = sortedBlackouts.filter(b => new Date(b.date) >= today);
  const pastBlackouts = sortedBlackouts.filter(b => new Date(b.date) < today);

  if (isLoading) {
    return (
      <div className="bg-surface-alt rounded-2xl border border-sage-light/20 p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-sage" aria-hidden="true" />
        <p className="text-text-muted mt-3">Loading blackout dates...</p>
      </div>
    );
  }

  if (blackouts.length === 0) {
    return (
      <EmptyState
        icon={CalendarOff}
        title="No blackout dates set"
        description="Add dates when you're unavailable for bookings. These dates will be blocked from your calendar."
      />
    );
  }

  const BlackoutCard = ({ blackout, isPast }: { blackout: BlackoutDto; isPast: boolean }) => {
    const date = new Date(blackout.date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNumber = date.getDate();
    const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    return (
      <div
        className={`group flex items-center gap-4 p-4 rounded-xl border ${ANIMATION_TRANSITION.DEFAULT} ${
          isPast
            ? "bg-surface-alt/50 border-sage-light/10 opacity-60"
            : "bg-surface-alt border-sage-light/20 hover:border-sage-light/40 hover:shadow-soft"
        }`}
      >
        {/* Date Display */}
        <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
          isPast ? "bg-text-muted/5" : "bg-sage/10"
        }`}>
          <span className={`text-xs font-medium uppercase ${isPast ? "text-text-muted" : "text-sage"}`}>
            {dayName}
          </span>
          <span className={`font-serif text-2xl font-bold ${isPast ? "text-text-muted" : "text-text-primary"}`}>
            {dayNumber}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isPast ? "text-text-muted" : "text-text-primary"}`}>
              {monthYear}
            </span>
            {isPast && (
              <span className="text-xs text-text-muted bg-text-muted/10 px-2 py-0.5 rounded-full">
                Past
              </span>
            )}
          </div>
          <p className={`text-sm mt-0.5 ${isPast ? "text-text-muted/70" : "text-text-muted"}`}>
            {blackout.reason || "No reason provided"}
          </p>
        </div>

        {/* Delete Button */}
        <Button
          onClick={() => onDeleteClick(blackout)}
          variant="ghost"
          size="sm"
          className={`text-text-muted hover:text-danger-600 hover:bg-danger-50 ${ANIMATION_TRANSITION.COLORS} opacity-0 group-hover:opacity-100`}
          aria-label={`Delete blackout date: ${date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`}
        >
          <Trash2 className="w-4 h-4" aria-label="Delete" />
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Upcoming Blackouts */}
      {upcomingBlackouts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sage" aria-hidden="true" />
            <h3 className="text-sm font-medium text-text-primary">
              Upcoming ({upcomingBlackouts.length})
            </h3>
          </div>
          <div className="space-y-2">
            {upcomingBlackouts.map((blackout) => (
              <BlackoutCard key={blackout.id} blackout={blackout} isPast={false} />
            ))}
          </div>
        </div>
      )}

      {/* Past Blackouts */}
      {pastBlackouts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarOff className="w-4 h-4 text-text-muted" aria-hidden="true" />
            <h3 className="text-sm font-medium text-text-muted">
              Past ({pastBlackouts.length})
            </h3>
          </div>
          <div className="space-y-2">
            {pastBlackouts.map((blackout) => (
              <BlackoutCard key={blackout.id} blackout={blackout} isPast={true} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}