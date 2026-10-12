import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import SwapAssetLogo from '@/components/Swap/SwapAssetLogo';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SwapAsset } from '@/lib/types/lifi-swap';
import { cn } from '@/lib/utils';

import SwapTokenSelector from './SwapTokenSelector';

interface SwapTokenSelectorModalProps {
  open?: boolean;
  setOpen?: (open: boolean) => void;
  onSelect: (asset: SwapAsset) => void;
  currentAsset: SwapAsset | undefined;
  otherAsset: SwapAsset | undefined;
  showNativeToken?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const SwapTokenSelectorModal = ({
  open,
  setOpen,
  onSelect,
  currentAsset,
  otherAsset,
  showNativeToken = true,
  disabled = false,
  placeholder = 'Select token',
  className = '',
}: SwapTokenSelectorModalProps) => {
  const currentModal: ModalState = { name: 'tokenSelector', number: 1 };
  const previousModal: ModalState = { name: 'close', number: 0 };
  const isOpen = open ?? false;
  const handleTokenClick = useCallback(
    (asset: SwapAsset) => {
      onSelect(asset);
      setOpen?.(false);
    },
    [onSelect, setOpen],
  );

  const buttonText = useMemo(() => {
    if (currentAsset?.symbol) {
      return currentAsset.symbol;
    }
    return placeholder;
  }, [currentAsset?.symbol, placeholder]);

  const buttonContent = useMemo(
    () => (
      <View className="flex flex-row items-center gap-1">
        <SwapAssetLogo asset={currentAsset} size={24} />
        <Text className="ml-1 text-lg font-semibold text-white">{buttonText}</Text>
        <ChevronDown className="text-white" />
      </View>
    ),
    [currentAsset, buttonText],
  );

  return (
    <ResponsiveModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={isOpen}
      onOpenChange={setOpen ?? (() => {})}
      title="Select Token"
      contentClassName="md:gap-8 md:max-w-md"
      contentKey="token-selector"
      disableScroll
      trigger={
        <Button
          className={cn(
            'flex h-10 items-center rounded-full bg-accent px-3 py-6 text-white active:bg-accent web:hover:bg-accent',
            className,
          )}
          disabled={disabled}
          accessibilityLabel={`Select token. Currently selected: ${buttonText}`}
          accessibilityHint="Opens token selection dialog"
        >
          {buttonContent}
        </Button>
      }
    >
      <View className="gap-2 md:gap-4">
        <SwapTokenSelector
          onSelect={handleTokenClick}
          otherAsset={otherAsset}
          showNativeToken={showNativeToken}
        />
      </View>
    </ResponsiveModal>
  );
};

export default SwapTokenSelectorModal;
