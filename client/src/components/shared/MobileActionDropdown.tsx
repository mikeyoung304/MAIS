import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { type LucideIcon } from "lucide-react";

interface ActionItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
}

interface MobileActionDropdownProps {
  actions: ActionItem[];
  className?: string;
}

/**
 * MobileActionDropdown Component
 *
 * A reusable mobile action dropdown menu for list items.
 * Displays a three-dot menu on small screens, replacing desktop action buttons.
 *
 * @param actions - Array of action items to display in the dropdown
 * @param className - Optional additional CSS classes
 */
export function MobileActionDropdown({ actions, className = "" }: MobileActionDropdownProps) {
  return (
    <div className={`sm:hidden ${className}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="text-text-muted" aria-label="Open actions menu">
            <MoreVertical className="w-4 h-4" aria-hidden="true" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-white border-sage-light/20">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <DropdownMenuItem
                key={index}
                onClick={action.onClick}
                disabled={action.disabled}
                className={action.variant === "danger" ? "text-danger-600" : "text-text-primary"}
              >
                {Icon && <Icon className="w-4 h-4 mr-2" aria-hidden="true" />}
                {action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
