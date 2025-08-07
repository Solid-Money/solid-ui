import { useCallback, useMemo } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { Currency } from '@cryptoalgebra/fuse-sdk';
import { ChevronDown } from 'lucide-react-native';
import CurrencyLogo from '../CurrencyLogo';
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
      <View className="flex flex-row items-center gap-3">
        <CurrencyLogo currency={currentCurrency} size={24} />
        <Text className="text-sm font-bold text-white flex-1">{buttonText}</Text>
        <ChevronDown className="text-white" />
      </View>
    ),
    [currentCurrency, buttonText],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className={`bg-accent h-12 px-4 rounded-full text-white flex items-center ${className}`}
          disabled={disabled}
          accessibilityLabel={`Select token. Currently selected: ${buttonText}`}
          accessibilityHint="Opens token selection dialog"
        >
          {buttonContent}
        </Button>
      </DialogTrigger>
      <DialogContent className="md:gap-8 md:max-w-sm">
        <View className="gap-2 md:gap-4">
          <DialogTitle>Select Token</DialogTitle>
          <SwapTokenSelector
            onSelect={handleTokenClick}
            otherCurrency={otherCurrency}
            showNativeToken={showNativeToken}
          />
        </View>
      </DialogContent>
    </Dialog>
  );
};

export default SwapTokenSelectorModal;
