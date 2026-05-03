import { View } from 'react-native';

import CopyToClipboard from '@/components/CopyToClipboard';
import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

type Props = {
  open: boolean;
  onClose: () => void;
  apiKey: string | null;
};

const MODAL_STATE: ModalState = { name: 'agent-api-key-reveal', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

const ApiKeyRevealModal = ({ open, onClose, apiKey }: Props) => {
  return (
    <ResponsiveModal
      currentModal={MODAL_STATE}
      previousModal={CLOSE_STATE}
      isOpen={open}
      onOpenChange={isOpen => !isOpen && onClose()}
      trigger={null}
      title="Your new API key"
      contentKey="agent-api-key-reveal"
      shouldAnimate={false}
    >
      <View className="gap-4">
        <Text className="text-base text-muted-foreground">
          This is the only time you&apos;ll see the full key. Copy it now and store it securely. If
          you lose it, generate a new one.
        </Text>
        {apiKey ? (
          <View className="flex-row items-center justify-between gap-2 rounded-xl bg-[#262626] p-3">
            <Text className="flex-1 break-all font-mono text-xs text-white" selectable>
              {apiKey}
            </Text>
            <CopyToClipboard text={apiKey} />
          </View>
        ) : null}
        <Button variant="brand" className="h-14 rounded-2xl" onPress={onClose}>
          <Text className="text-base font-bold">I&apos;ve saved it</Text>
        </Button>
      </View>
    </ResponsiveModal>
  );
};

export default ApiKeyRevealModal;
