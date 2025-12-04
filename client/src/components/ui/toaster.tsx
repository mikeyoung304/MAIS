import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      expand={true}
      richColors
      closeButton
      duration={4000}
      gap={12}
      toastOptions={{
        classNames: {
          toast: 'bg-white border shadow-elevation-3 rounded-xl p-4 min-w-[360px]',
          title: 'text-neutral-900 font-semibold text-base',
          description: 'text-neutral-600 text-sm mt-1',
          actionButton:
            'bg-macon-navy text-white hover:bg-macon-navy-dark rounded-lg font-semibold px-4 py-2',
          cancelButton:
            'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 rounded-lg font-medium px-4 py-2',
          closeButton:
            'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 rounded-full transition-colors',
          success: 'border-success-300 bg-success-50 [&>svg]:text-success-600',
          error: 'border-danger-300 bg-danger-50 [&>svg]:text-danger-600',
          warning: 'border-warning-300 bg-warning-50 [&>svg]:text-warning-600',
          info: 'border-macon-navy/30 bg-macon-navy-50 [&>svg]:text-macon-navy',
        },
      }}
    />
  );
}
