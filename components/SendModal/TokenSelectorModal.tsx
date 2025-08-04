import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { formatUnits } from 'viem';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md mx-auto p-8">
        <View className="gap-8">
          <DialogTitle className="text-white text-2xl font-semibold text-center">
            Select an asset
          </DialogTitle>

          <View>
            <Text className="text-gray-400 text-base mb-6">Tokens in your wallet</Text>
            <ScrollView className="max-h-80" showsVerticalScrollIndicator={false}>
              <View className="px-2 gap-3">
                {tokens.map((token, index) => {
                  const balance = Number(formatUnits(BigInt(token.balance) || 0n, token.contractDecimals));
                  const balanceUSD = balance * (token.quoteRate || 0);
                  const isSelected = selectedToken?.contractAddress === token.contractAddress &&
                    selectedToken?.chainId === token.chainId;

                  return (
                    <Pressable
                      key={`${token.contractAddress}-${token.chainId}`}
                      className={cn(
                        "bg-zinc-800 rounded-2xl px-4 py-4 flex-row items-center justify-between",
                        isSelected && "border border-green-500"
                      )}
                      onPress={() => handleTokenSelect(token)}
                    >
                      <View className="flex-row items-center gap-3 flex-1">
                        <RenderTokenIcon
                          tokenIcon={getTokenIcon({
                            logoUrl: token.logoUrl,
                            tokenSymbol: token.contractTickerSymbol,
                            size: 40
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
                        <Text className="text-gray-400 text-sm">
                          {formatNumber(balance, 2)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </DialogContent>
    </Dialog>
  );
};

export default TokenSelectorModal;