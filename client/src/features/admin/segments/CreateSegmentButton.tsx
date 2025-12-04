import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CreateSegmentButtonProps {
  onClick: () => void;
}

/**
 * CreateSegmentButton Component
 * Design: Matches landing page aesthetic with sage accents
 */
export function CreateSegmentButton({ onClick }: CreateSegmentButtonProps) {
  return (
    <Button
      onClick={onClick}
      className="bg-sage hover:bg-sage-hover text-white rounded-full px-6 h-11 shadow-soft hover:shadow-medium transition-all duration-300 group"
    >
      <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
      Create Segment
    </Button>
  );
}
