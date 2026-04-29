import { View } from 'react-native';

import CopyToClipboard from '@/components/CopyToClipboard';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';

type Props = {
  open: boolean;
  onClose: () => void;
  apiKey: string | null;
};

const ApiKeyRevealModal = ({ open, onClose, apiKey }: Props) => {
  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Your new API key</DialogTitle>
          <DialogDescription>
            This is the only time you&apos;ll see the full key. Copy it now and store it securely.
            If you lose it, generate a new one.
          </DialogDescription>
        </DialogHeader>
        {apiKey ? (
          <View className="gap-3">
            <View className="flex-row items-center justify-between gap-2 rounded-twice border border-border bg-background p-3">
              <Text className="flex-1 break-all font-mono text-xs" selectable>
                {apiKey}
              </Text>
              <CopyToClipboard text={apiKey} />
            </View>
            <Button onPress={onClose}>
              <Text>I&apos;ve saved it</Text>
            </Button>
          </View>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default ApiKeyRevealModal;
