import React, { ReactNode, useCallback } from 'react';
import { ScrollView } from 'react-native';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useDimension } from '@/hooks/useDimension';
import { cn } from '@/lib/utils';

export interface ResponsiveDialogProps {
  // Modal state management
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // Content
  trigger?: ReactNode;
  title?: string;
  children: ReactNode;

  // Styling
  contentClassName?: string;
  titleClassName?: string;
}

const ResponsiveDialog = ({
  open,
  onOpenChange,
  trigger,
  title,
  children,
  contentClassName,
  titleClassName,
}: ResponsiveDialogProps) => {
  const { isScreenMedium } = useDimension();

  // Prevent page scroll when modal closes by stopping focus restoration to trigger
  const handleCloseAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={cn(
          'p-4 md:max-w-md md:p-8',
          contentClassName,
          !isScreenMedium ? 'mt-8 w-screen max-w-full justify-start' : '',
        )}
        onCloseAutoFocus={handleCloseAutoFocus}
      >
        {title && (
          <DialogHeader className={titleClassName}>
            <DialogTitle className="text-2xl font-semibold">{title}</DialogTitle>
          </DialogHeader>
        )}
        <ScrollView className="max-h-[80vh]" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </DialogContent>
    </Dialog>
  );
};

export default ResponsiveDialog;
