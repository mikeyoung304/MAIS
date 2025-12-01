import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PackageFormData } from "../hooks/usePackageForm";
import type { SegmentDto } from "@macon/contracts";

/** Tier levels for the 3-tier pricing model */
const TIER_OPTIONS = [
  { value: "budget", label: "Budget (Essential)", order: 0 },
  { value: "middle", label: "Middle (Popular)", order: 1 },
  { value: "luxury", label: "Luxury (Premium)", order: 2 },
] as const;

interface OrganizationSectionProps {
  form: PackageFormData;
  setForm: (form: PackageFormData) => void;
  segments: SegmentDto[];
  isLoadingSegments: boolean;
  isSaving: boolean;
  /** When true, segment selection is required (2+ segments exist) */
  requireSegment?: boolean;
}

/**
 * OrganizationSection Component
 *
 * Handles the tier/segment organization fields for the package form:
 * - Segment (customer type) dropdown
 * - Tier Level dropdown (Budget/Middle/Luxury)
 *
 * The groupingOrder is automatically set based on tier selection:
 * - Budget = 0, Middle = 1, Luxury = 2
 */
export function OrganizationSection({
  form,
  setForm,
  segments,
  isLoadingSegments,
  isSaving,
  requireSegment = false,
}: OrganizationSectionProps) {
  /**
   * Handle tier selection - also sets the groupingOrder automatically
   */
  const handleTierChange = (value: string) => {
    if (value === "none") {
      setForm({ ...form, grouping: "", groupingOrder: "" });
    } else {
      const tier = TIER_OPTIONS.find(t => t.value === value);
      setForm({
        ...form,
        grouping: value,
        groupingOrder: tier ? String(tier.order) : "",
      });
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-white/10">
      <h3 className="text-lg font-medium text-white/90">Organization</h3>

      {/* Segment Dropdown */}
      <div className="space-y-2">
        <Label htmlFor="segmentId" className="text-white/90">
          Customer Segment {requireSegment && <span className="text-red-400">*</span>}
        </Label>
        <Select
          value={form.segmentId || "none"}
          onValueChange={(value) =>
            setForm({ ...form, segmentId: value === "none" ? "" : value })
          }
          disabled={isSaving || isLoadingSegments}
        >
          <SelectTrigger
            id="segmentId"
            className={`bg-macon-navy-900 border-white/20 text-white h-12 ${
              requireSegment && !form.segmentId ? "border-red-400/50" : ""
            }`}
          >
            <SelectValue placeholder={requireSegment ? "Select a segment (required)" : "Select a segment (optional)"} />
          </SelectTrigger>
          <SelectContent>
            {!requireSegment && <SelectItem value="none">None (Root level)</SelectItem>}
            {segments.map((seg) => (
              <SelectItem key={seg.id} value={seg.id}>
                {seg.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-white/50">
          {requireSegment
            ? "Package must be assigned to a segment"
            : "Which customer type is this package for?"}
        </p>
      </div>

      {/* Tier Level Dropdown */}
      <div className="space-y-2">
        <Label htmlFor="grouping" className="text-white/90">
          Pricing Tier
        </Label>
        <Select
          value={form.grouping || "none"}
          onValueChange={handleTierChange}
          disabled={isSaving}
        >
          <SelectTrigger
            id="grouping"
            className="bg-macon-navy-900 border-white/20 text-white h-12"
          >
            <SelectValue placeholder="Select a tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not a tier package</SelectItem>
            {TIER_OPTIONS.map((tier) => (
              <SelectItem key={tier.value} value={tier.value}>
                {tier.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-white/50">
          Tier packages appear in the 3-tier pricing display on your storefront
        </p>
      </div>

      {/* Tier Info Banner */}
      {form.grouping && TIER_OPTIONS.some(t => t.value === form.grouping) && (
        <div className="p-3 bg-macon-orange/10 border border-macon-orange/20 rounded-lg">
          <p className="text-sm text-white/80">
            <span className="font-medium text-macon-orange">Tip:</span>{" "}
            {form.grouping === "budget" && "Budget tier should be your most affordable option - the entry point for price-conscious customers."}
            {form.grouping === "middle" && "Middle tier is highlighted as 'Most Popular' - this should be your best value for most customers."}
            {form.grouping === "luxury" && "Luxury tier should be your premium offering - maximum features and personalization."}
          </p>
        </div>
      )}
    </div>
  );
}
