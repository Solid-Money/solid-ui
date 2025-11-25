import { useCallback, useMemo } from 'react';
import { View } from 'react-native';

import CurrencyLogo from '@/components/CurrencyLogo';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { Currency } from '@cryptoalgebra/fuse-sdk';
import { ChevronDown } from 'lucide-react-native';
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
        <Text className="text-sm font-bold text-white">{buttonText}</Text>
        <ChevronDown className="text-white" />
      </View>
    ),
    [currentCurrency, buttonText],
  );

  return (
    <ResponsiveDialog
      open={open ?? false}
      onOpenChange={setOpen ?? (() => {})}
      title="Select Token"
      contentClassName="md:gap-8 md:max-w-md"
      trigger={
        <Button
          className={cn(
            'bg-accent h-10 px-3 rounded-full text-white flex items-center active:bg-accent web:hover:bg-accent',
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
    </ResponsiveDialog>
  );
};

export default SwapTokenSelectorModal;
