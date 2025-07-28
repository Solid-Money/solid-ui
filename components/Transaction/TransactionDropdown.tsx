import * as React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  pressTransactionCredenzaContent,
  TransactionCredenzaContent,
  TransactionCredenzaTrigger
} from './TransactionCredenza';

type TransactionDropdownProps = {
  url?: string;
}

const TransactionDropdown = ({ url }: TransactionDropdownProps) => {
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
      <DropdownMenuContent insets={contentInsets} className='w-38 bg-card border-none rounded-xl'>
        <DropdownMenuItem
          className='h-10 web:cursor-pointer rounded-lg'
          onPress={() => pressTransactionCredenzaContent(url)}
        >
          <TransactionCredenzaContent />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default TransactionDropdown;
