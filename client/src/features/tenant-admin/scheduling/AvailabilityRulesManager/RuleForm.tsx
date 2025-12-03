import { Loader2, X, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RuleFormData, ServiceDto } from "./types";
import { DAYS_OF_WEEK } from "./types";
import { formatTime, generateTimeOptions } from "./utils";

interface RuleFormProps {
  ruleForm: RuleFormData;
  services: ServiceDto[];
  isSaving: boolean;
  error: string | null;
  onFormChange: (form: RuleFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

/**
 * RuleForm Component
 *
 * Form for creating a new availability rule
 */
export function RuleForm({
  ruleForm,
  services,
  isSaving,
  error,
  onFormChange,
  onSubmit,
  onCancel,
}: RuleFormProps) {
  const timeOptions = generateTimeOptions();

  return (
    <Card className="p-6 bg-macon-navy-800 border-white/20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-white">Add Availability Rule</h2>
        <Button
          onClick={onCancel}
          variant="outline"
          size="sm"
          className="border-white/20 text-white/90 hover:bg-macon-navy-700"
        >
          <X className="w-4 h-4 mr-1" />
          Cancel
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded text-red-300 text-sm">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Service Selection */}
        <div>
          <Label htmlFor="serviceId" className="text-white/90 text-base">
            Service (optional)
          </Label>
          <Select
            value={ruleForm.serviceId ?? "all"}
            onValueChange={(value) =>
              onFormChange({ ...ruleForm, serviceId: value === "all" ? null : value })
            }
            disabled={isSaving}
          >
            <SelectTrigger className="bg-macon-navy-900 border-white/20 text-white focus:border-white/30 h-11">
              <SelectValue placeholder="Select service" />
            </SelectTrigger>
            <SelectContent className="bg-macon-navy-900 border-white/20">
              <SelectItem value="all" className="text-white">
                All Services
              </SelectItem>
              {services.map((service) => (
                <SelectItem key={service.id} value={service.id} className="text-white">
                  {service.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-white/50 mt-1">
            Leave as "All Services" to apply to all services
          </p>
        </div>

        {/* Day of Week */}
        <div>
          <Label htmlFor="dayOfWeek" className="text-white/90 text-base">
            Day of Week
          </Label>
          <Select
            value={ruleForm.dayOfWeek.toString()}
            onValueChange={(value) =>
              onFormChange({ ...ruleForm, dayOfWeek: parseInt(value, 10) })
            }
            disabled={isSaving}
          >
            <SelectTrigger className="bg-macon-navy-900 border-white/20 text-white focus:border-white/30 h-11">
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent className="bg-macon-navy-900 border-white/20">
              {DAYS_OF_WEEK.map((day, index) => (
                <SelectItem key={index} value={index.toString()} className="text-white">
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Time Range */}
        <div className="grid grid-cols-2 gap-4">
          {/* Start Time */}
          <div>
            <Label htmlFor="startTime" className="text-white/90 text-base">
              Start Time
            </Label>
            <Select
              value={ruleForm.startTime}
              onValueChange={(value) => onFormChange({ ...ruleForm, startTime: value })}
              disabled={isSaving}
            >
              <SelectTrigger className="bg-macon-navy-900 border-white/20 text-white focus:border-white/30 h-11">
                <SelectValue placeholder="Select start time" />
              </SelectTrigger>
              <SelectContent className="bg-macon-navy-900 border-white/20 max-h-60">
                {timeOptions.map((time) => (
                  <SelectItem key={time} value={time} className="text-white">
                    {formatTime(time)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* End Time */}
          <div>
            <Label htmlFor="endTime" className="text-white/90 text-base">
              End Time
            </Label>
            <Select
              value={ruleForm.endTime}
              onValueChange={(value) => onFormChange({ ...ruleForm, endTime: value })}
              disabled={isSaving}
            >
              <SelectTrigger className="bg-macon-navy-900 border-white/20 text-white focus:border-white/30 h-11">
                <SelectValue placeholder="Select end time" />
              </SelectTrigger>
              <SelectContent className="bg-macon-navy-900 border-white/20 max-h-60">
                {timeOptions.map((time) => (
                  <SelectItem key={time} value={time} className="text-white">
                    {formatTime(time)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Effective Date Range */}
        <div className="grid grid-cols-2 gap-4">
          {/* Effective From */}
          <div>
            <Label htmlFor="effectiveFrom" className="text-white/90 text-base">
              Effective From
            </Label>
            <Input
              id="effectiveFrom"
              type="date"
              value={ruleForm.effectiveFrom || ""}
              onChange={(e) => onFormChange({ ...ruleForm, effectiveFrom: e.target.value })}
              className="bg-macon-navy-900 border-white/20 text-white focus:border-white/30 h-11"
              disabled={isSaving}
            />
          </div>

          {/* Effective To */}
          <div>
            <Label htmlFor="effectiveTo" className="text-white/90 text-base">
              Effective To (optional)
            </Label>
            <Input
              id="effectiveTo"
              type="date"
              value={ruleForm.effectiveTo || ""}
              onChange={(e) =>
                onFormChange({ ...ruleForm, effectiveTo: e.target.value || null })
              }
              className="bg-macon-navy-900 border-white/20 text-white focus:border-white/30 h-11"
              placeholder="Leave blank for indefinite"
              disabled={isSaving}
            />
            <p className="text-sm text-white/50 mt-1">Leave blank for no end date</p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            className="bg-macon-navy hover:bg-macon-navy-dark text-lg h-11 px-6"
            disabled={isSaving}
          >
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isSaving ? "Creating..." : "Create Rule"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
