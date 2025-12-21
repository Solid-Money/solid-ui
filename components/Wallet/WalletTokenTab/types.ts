import { DimensionValue } from 'react-native';

import { TokenBalance } from '@/lib/types';

export interface TokenListProps {
  tokens: TokenBalance[];
}

export interface TokenItemProps {
  token: TokenBalance;
  index: number;
  isLast: boolean;
  onPress: () => void;
}

export interface Column {
  key: string;
  label: string;
  width: DimensionValue;
}
