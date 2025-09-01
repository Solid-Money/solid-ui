import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { formatUnits } from 'viem';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { Text } from '@/components/ui/text';
import getTokenIcon from '@/lib/getTokenIcon';
import { cn, formatNumber } from '@/lib/utils';

interface TokenBalance {
  contractTickerSymbol: string;
  contractName: string;
  contractAddress: string;
  balance: string;
  quoteRate?: number;
  logoUrl?: string;
  contractDecimals: number;
  type: string;
  verified?: boolean;
  chainId: number;
}

interface TokenSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokens: TokenBalance[];
  onSelectToken: (token: TokenBalance) => void;
  selectedToken: TokenBalance | null;
}

const TokenSelectorModal: React.FC<TokenSelectorModalProps> = ({
  isOpen,
  onClose,
  tokens,
  onSelectToken,
  selectedToken,
}) => {
  const handleTokenSelect = (token: TokenBalance) => {
    onSelectToken(token);
    onClose();
  };

  return (
    <ResponsiveDialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      title="Select an asset"
      contentClassName="md:gap-8 md:max-w-md py-8"
      titleClassName="text-white text-2xl font-semibold text-center"
    >
      <View className="gap-2">
        <Text className="text-muted-foreground font-medium">Tokens in your wallet</Text>
        <ScrollView className="md:h-[50vh]" showsVerticalScrollIndicator={false}>
          <View className="gap-2">
            {tokens.map(token => {
              const balance = Number(
                formatUnits(BigInt(token.balance) || 0n, token.contractDecimals),
              );
              const balanceUSD = balance * (token.quoteRate || 0);
              const isSelected =
                selectedToken?.contractAddress === token.contractAddress &&
                selectedToken?.chainId === token.chainId;

              return (
                <Pressable
                  key={`${token.contractAddress}-${token.chainId}`}
                  className={cn(
                    'bg-accent rounded-2xl px-4 py-4 flex-row items-center justify-between web:hover:bg-accent/50',
                    isSelected && 'border border-green-500',
                  )}
                  onPress={() => handleTokenSelect(token)}
                >
                  <View className="flex-row items-center gap-3 flex-1">
                    <RenderTokenIcon
                      tokenIcon={getTokenIcon({
                        logoUrl: token.logoUrl,
                        tokenSymbol: token.contractTickerSymbol,
                        size: 40,
                      })}
                      size={40}
                    />
                    <View className="flex-1">
                      <Text className="text-white text-lg font-semibold">
                        {token.contractTickerSymbol}
                      </Text>
                      <Text className="text-gray-400 text-sm">
                        {token.contractTickerSymbol} on {token.chainId === 1 ? 'Ethereum' : 'Fuse'}
                      </Text>
                    </View>
                  </View>

                  <View className="items-end">
                    <Text className="text-white text-xl font-semibold">
                      ${formatNumber(balanceUSD, 2)}
                    </Text>
                    <Text className="text-gray-400 text-sm">{formatNumber(balance, 2)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </ResponsiveDialog>
  );
};

export default TokenSelectorModal;
