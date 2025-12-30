import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { formatUnits } from 'viem';

import DepositModal from '@/components/Deposit/DepositModal';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import SendModal from '@/components/Send/SendModal';
import StakeModal from '@/components/Stake/StakeModal';
import { TransactionCredenzaTrigger } from '@/components/Transaction/TransactionCredenza';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Text } from '@/components/ui/text';
import UnstakeModal from '@/components/Unstake/UnstakeModal';
import WithdrawModal from '@/components/Withdraw/WithdrawModal';
import getTokenIcon from '@/lib/getTokenIcon';
import { TokenBalance } from '@/lib/types';
import { cn, formatNumber, isSoUSDEthereum, isSoUSDFuse, isUSDCEthereum } from '@/lib/utils';

import { DESKTOP_COLUMNS } from './columns';

interface TokenRowProps {
  token: TokenBalance;
  index: number;
  totalCount: number;
  onPress: () => void;
}

const TokenRow = memo(
  ({ token, index, totalCount, onPress }: TokenRowProps) => {
    const balance = Number(formatUnits(BigInt(token.balance || '0'), token.contractDecimals));
    const balanceUSD = balance * (token.quoteRate || 0);

    const tokenIcon = getTokenIcon({
      logoUrl: token.logoUrl,
      tokenSymbol: token.contractTickerSymbol,
      size: 34,
    });

    const isFirst = index === 0;
    const isLast = index === totalCount - 1;

    return (
      <Pressable
        className={cn(
          'flex-row bg-card active:bg-secondary items-center border-border/40 border-b',
          isFirst && 'rounded-t-twice',
          isLast && 'rounded-b-twice border-0',
        )}
        onPress={onPress}
      >
        {/* Asset Column */}
        <View className="p-6" style={{ width: DESKTOP_COLUMNS[0].width }}>
          <View className="flex-row items-center gap-4">
            <View className="flex-row items-center gap-2">
              <RenderTokenIcon tokenIcon={tokenIcon} size={34} />
              <View className="items-start">
                <Text className="font-bold text-base">
                  {token.contractTickerSymbol || 'Unknown'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Balance Column */}
        <View className="p-6" style={{ width: DESKTOP_COLUMNS[1].width }}>
          <View className="items-start">
            <Text className="font-bold text-base">
              {formatNumber(balance)} {token.contractTickerSymbol}
            </Text>
            <Text className="text-sm text-muted-foreground">${formatNumber(balanceUSD, 2)}</Text>
          </View>
        </View>

        {/* Price Column */}
        <View className="p-6" style={{ width: DESKTOP_COLUMNS[2].width }}>
          <View className="items-start">
            <Text className="font-bold text-base">${formatNumber(token.quoteRate || 0, 2)}</Text>
          </View>
        </View>

        {/* Action Column */}
        <View className="p-6" style={{ width: DESKTOP_COLUMNS[3].width }}>
          <View className="flex-row items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger>
                <TransactionCredenzaTrigger />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-card border-none rounded-xl p-1 min-w-[12rem]"
              >
                <View className="gap-2">
                  {!isSoUSDEthereum(token.contractAddress) && <SendModal token={token} />}
                  {isSoUSDFuse(token.contractAddress) ? (
                    <UnstakeModal />
                  ) : (
                    isSoUSDEthereum(token.contractAddress) && (
                      <>
                        <WithdrawModal />
                        <StakeModal />
                      </>
                    )
                  )}
                  {isUSDCEthereum(token.contractAddress) && <DepositModal />}
                </View>
              </DropdownMenuContent>
            </DropdownMenu>
          </View>
        </View>
      </Pressable>
    );
  },
  (prev, next) =>
    prev.token.contractAddress === next.token.contractAddress &&
    prev.token.balance === next.token.balance &&
    prev.token.quoteRate === next.token.quoteRate &&
    prev.index === next.index &&
    prev.totalCount === next.totalCount,
);

TokenRow.displayName = 'TokenRow';

export default TokenRow;
