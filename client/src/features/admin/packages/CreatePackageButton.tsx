import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CreatePackageButtonProps {
  onClick: () => void;
}

export function CreatePackageButton({ onClick }: CreatePackageButtonProps) {
  return (
    <div className="flex justify-end">
      <Button
        onClick={onClick}
        className="bg-macon-navy hover:bg-macon-navy-dark text-lg h-12 px-6"
      >
        <Plus className="w-5 h-5 mr-2" />
        Create Package
      </Button>
    </div>
  );
}
