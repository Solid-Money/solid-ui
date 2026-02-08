import React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';

interface DiscardChangesDialogProps {
  visible: boolean;
  onDiscard: () => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog shown when user attempts to close the Send modal
 * with unsaved transaction details (amount, address, token, or name).
 * Follows fintech industry standards (Venmo, PayPal, Coinbase) for preventing
 * accidental data loss.
 */
const DiscardChangesDialog: React.FC<DiscardChangesDialogProps> = ({
  visible,
  onDiscard,
  onCancel,
}) => {
  return (
    <Dialog open={visible} onOpenChange={open => !open && onCancel()}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Discard changes?</DialogTitle>
        </DialogHeader>

        <DialogDescription className="text-base text-muted-foreground">
          You have unsaved transaction details. Are you sure you want to discard them?
        </DialogDescription>

        <DialogFooter className="mt-4 flex-row gap-3">
          <Button variant="secondary" className="flex-1 rounded-xl border-0" onPress={onCancel}>
            <Text className="font-semibold">Keep editing</Text>
          </Button>
          <Button variant="destructive" className="flex-1 rounded-xl border-0" onPress={onDiscard}>
            <Text className="font-semibold text-white">Discard</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DiscardChangesDialog;
