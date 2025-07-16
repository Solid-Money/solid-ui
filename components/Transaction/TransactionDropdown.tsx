import * as React from 'react';
import { Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUpRight, EllipsisVertical } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Text } from '@/components/ui/text';

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
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon' className='w-6 opacity-60'>
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent insets={contentInsets} className='w-38 bg-card border-none rounded-xl'>
        <DropdownMenuItem
          className='h-10 web:cursor-pointer rounded-lg'
          onPress={() => {
            if (url) Linking.openURL(url);
          }}
        >
          <ArrowUpRight color='white' />
          <Text>View transaction</Text>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default TransactionDropdown;
