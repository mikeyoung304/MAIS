import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CreateRuleButtonProps {
  onClick: () => void;
}

/**
 * CreateRuleButton Component
 *
 * Button to trigger creation of a new availability rule
 */
export function CreateRuleButton({ onClick }: CreateRuleButtonProps) {
  return (
    <Button onClick={onClick} className="bg-macon-navy hover:bg-macon-navy-dark text-lg h-12 px-6">
      <Plus className="w-5 h-5 mr-2" />
      Add Availability Rule
    </Button>
  );
}
