import * as React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TransactionType } from '@/lib/types';
import {
  pressTransactionCredenzaContent,
  TransactionCancelContent,
  TransactionCredenzaContent,
  TransactionCredenzaTrigger,
} from './TransactionCredenza';

type TransactionDropdownProps = {
  url?: string;
  showCancelButton?: boolean;
  onCancelWithdraw?: () => void;
  type?: TransactionType;
  onPress?: () => void;
};

const TransactionDropdown = ({
  url,
  showCancelButton,
  onCancelWithdraw,
  type,
  onPress,
}: TransactionDropdownProps) => {
  const insets = useSafeAreaInsets();
  const contentInsets = {
    top: insets.top,
    bottom: insets.bottom,
    left: 12,
    right: 12,
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <TransactionCredenzaTrigger />
      </DropdownMenuTrigger>
      <DropdownMenuContent insets={contentInsets} className="w-38 rounded-xl border-0 border-none bg-card">
        <DropdownMenuItem
          className="h-10 rounded-lg web:cursor-pointer"
          onPress={() => {
            if (type === TransactionType.BANK_TRANSFER && onPress) {
              onPress();
            } else if (url) {
              pressTransactionCredenzaContent(url);
            }
          }}
        >
          <TransactionCredenzaContent
            text={type === TransactionType.BANK_TRANSFER ? 'View details' : 'View transaction'}
          />
        </DropdownMenuItem>
        {showCancelButton && (
          <DropdownMenuItem
            className="h-10 rounded-lg web:cursor-pointer"
            onPress={onCancelWithdraw}
          >
            <TransactionCancelContent />
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default TransactionDropdown;
