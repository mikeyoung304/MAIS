import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CreateServiceButtonProps {
  onClick: () => void;
}

export function CreateServiceButton({ onClick }: CreateServiceButtonProps) {
  return (
    <Button onClick={onClick} className="bg-macon-orange hover:bg-macon-orange/90 text-white">
      <Plus className="w-5 h-5 mr-2" />
      Create New Service
    </Button>
  );
}
