import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Currency } from '@cryptoalgebra/fuse-sdk';
import { ChevronDown } from 'lucide-react-native';

import CurrencyLogo from '@/components/CurrencyLogo';
import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

import SwapTokenSelector from './SwapTokenSelector';

interface SwapTokenSelectorModalProps {
  open?: boolean;
  setOpen?: (open: boolean) => void;
  onSelect: (token: Currency) => void;
  currentCurrency: Currency | null | undefined;
  otherCurrency: Currency | null | undefined;
  showNativeToken?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const SwapTokenSelectorModal = ({
  open,
  setOpen,
  onSelect,
  currentCurrency,
  otherCurrency,
  showNativeToken = true,
  disabled = false,
  placeholder = 'Select token',
  className = '',
}: SwapTokenSelectorModalProps) => {
  const currentModal: ModalState = { name: 'tokenSelector', number: 1 };
  const previousModal: ModalState = { name: 'close', number: 0 };
  const isOpen = open ?? false;
  const handleTokenClick = useCallback(
    (token: Currency) => {
      onSelect(token);
      setOpen?.(false);
    },
    [onSelect, setOpen],
  );

  const buttonText = useMemo(() => {
    if (currentCurrency?.symbol) {
      return currentCurrency.symbol;
    }
    return placeholder;
  }, [currentCurrency?.symbol, placeholder]);

  const buttonContent = useMemo(
    () => (
      <View className="flex flex-row items-center gap-1">
        <CurrencyLogo currency={currentCurrency} size={24} />
        <Text className="native:text-lg text-lg font-semibold text-white">{buttonText}</Text>
        <ChevronDown className="text-white" />
      </View>
    ),
    [currentCurrency, buttonText],
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
          otherCurrency={otherCurrency}
          showNativeToken={showNativeToken}
        />
      </View>
    </ResponsiveModal>
  );
};

export default SwapTokenSelectorModal;
