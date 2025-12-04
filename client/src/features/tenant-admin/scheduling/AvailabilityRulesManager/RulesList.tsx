import { Trash2, Loader2, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AvailabilityRuleDto, ServiceDto } from './types';
import { DAYS_OF_WEEK, DAY_COLORS } from './types';
import { formatTime } from './utils';

interface RulesListProps {
  rules: AvailabilityRuleDto[];
  services: ServiceDto[];
  isLoading: boolean;
  onDeleteClick: (rule: AvailabilityRuleDto) => void;
}

/**
 * RulesList Component
 *
 * Displays availability rules grouped by day of week
 */
export function RulesList({ rules, services, isLoading, onDeleteClick }: RulesListProps) {
  // Create a map of service IDs to service names
  const serviceMap = new Map(services.map((s) => [s.id, s.name]));

  // Group rules by day of week
  const rulesByDay = DAYS_OF_WEEK.map((day, dayIndex) => {
    const dayRules = rules
      .filter((rule) => rule.dayOfWeek === dayIndex)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return { day, dayIndex, rules: dayRules };
  });

  if (isLoading) {
    return (
      <Card className="p-6 bg-macon-navy-800 border-white/20">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-white/60" />
        </div>
      </Card>
    );
  }

  if (rules.length === 0) {
    return (
      <Card className="p-6 bg-macon-navy-800 border-white/20">
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-white/40" aria-hidden="true" />
          <p className="text-lg text-white/70">No availability rules set</p>
          <p className="text-sm text-white/50 mt-2">
            Add rules to define when your services are available
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-macon-navy-800 border-white/20">
      <h2 className="text-2xl font-semibold mb-6 text-white">Availability Schedule</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rulesByDay.map(({ day, dayIndex, rules: dayRules }) => (
          <div key={dayIndex} className="space-y-2">
            {/* Day Header */}
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white">{day}</h3>
              <Badge variant="outline" className={`text-xs ${DAY_COLORS[dayIndex]}`}>
                {dayRules.length} {dayRules.length === 1 ? 'rule' : 'rules'}
              </Badge>
            </div>

            {/* Rules for this day */}
            <div className="space-y-2">
              {dayRules.length === 0 ? (
                <div className="p-3 bg-macon-navy-900 border border-white/10 rounded text-white/50 text-sm">
                  No availability
                </div>
              ) : (
                dayRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-3 bg-macon-navy-900 border border-white/10 rounded hover:bg-macon-navy-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {/* Time Range */}
                        <div className="text-white font-medium text-sm">
                          {formatTime(rule.startTime)} - {formatTime(rule.endTime)}
                        </div>

                        {/* Service Name */}
                        <div className="text-white/60 text-xs mt-1">
                          {rule.serviceId
                            ? serviceMap.get(rule.serviceId) || 'Unknown Service'
                            : 'All Services'}
                        </div>

                        {/* Effective Dates */}
                        {rule.effectiveTo && (
                          <div className="text-white/50 text-xs mt-1">
                            Until {new Date(rule.effectiveTo).toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      {/* Delete Button */}
                      <Button
                        onClick={() => onDeleteClick(rule)}
                        variant="outline"
                        size="sm"
                        className="border-red-700 text-red-300 hover:bg-red-900/20 h-7 w-7 p-0"
                        aria-label={`Delete rule for ${day} ${formatTime(rule.startTime)} - ${formatTime(rule.endTime)}`}
                        title="Delete rule"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
