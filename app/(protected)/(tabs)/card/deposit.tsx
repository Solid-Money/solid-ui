import { useRouter } from 'expo-router';
import { ArrowLeft, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Address, formatUnits } from 'viem';

import Navbar from '@/components/Navbar';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useDimension } from '@/hooks/useDimension';
import useSend from '@/hooks/useSend';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import getTokenIcon from '@/lib/getTokenIcon';
import { Status } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import Toast from 'react-native-toast-message';

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

const DepositToCard = () => {
  const router = useRouter();
  const { isScreenMedium } = useDimension();
  const { ethereumTokens, fuseTokens } = useWalletTokens();
  const { data: cardDetails } = useCardDetails();
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);

  // Filter for stablecoins only (USDC for now)
  const stablecoins = useMemo(() => {
    const combined = [...ethereumTokens, ...fuseTokens];
    return combined
      .filter(
        token =>
          token.contractTickerSymbol === 'USDC' ||
          token.contractTickerSymbol === 'USDT' ||
          token.contractTickerSymbol === 'DAI',
      )
      .sort((a, b) => {
        const balanceA = Number(formatUnits(BigInt(a.balance || '0'), a.contractDecimals));
        const balanceUSD_A = balanceA * (a.quoteRate || 0);

        const balanceB = Number(formatUnits(BigInt(b.balance || '0'), b.contractDecimals));
        const balanceUSD_B = balanceB * (b.quoteRate || 0);

        return balanceUSD_B - balanceUSD_A; // Descending order
      });
  }, [ethereumTokens, fuseTokens]);

  // Auto-select first available stablecoin
  React.useEffect(() => {
    if (stablecoins.length > 0 && !selectedToken) {
      setSelectedToken(stablecoins[0]);
    }
  }, [stablecoins, selectedToken]);

  const handleNumberPress = (number: string) => {
    if (number === '.' && amount.includes('.')) return;
    if (amount === '0' && number !== '.') {
      setAmount(number);
    } else {
      setAmount(prev => prev + number);
    }
  };

  const handleBackspace = () => {
    setAmount(prev => prev.slice(0, -1));
  };

  const handleMaxPress = () => {
    if (selectedToken) {
      const balance = Number(
        formatUnits(BigInt(selectedToken.balance || '0'), selectedToken.contractDecimals),
      );
      setAmount(balance.toString());
    }
  };

  const { send, sendStatus, resetSendStatus } = useSend({
    tokenAddress: selectedToken?.contractAddress as any,
    tokenDecimals: selectedToken?.contractDecimals || 18,
    chainId: selectedToken?.chainId || 1,
  });

  const handleContinue = async () => {
    if (!selectedToken || !amount || !cardDetails?.funding_instructions) return;

    try {
      const fundingAddress = cardDetails.funding_instructions.address as Address;
      const transaction = await send(amount, fundingAddress);
      Toast.show({
        type: 'success',
        text1: 'Card deposit initiated',
        text2: `${amount} ${selectedToken.contractTickerSymbol} sent to card`,
        props: {
          link: `https://etherscan.io/tx/${transaction.transactionHash}`,
          linkText: 'View on Etherscan',
          image: getTokenIcon({
            logoUrl: selectedToken.logoUrl,
            tokenSymbol: selectedToken.contractTickerSymbol,
            size: 24,
          }),
        },
      });

      // Reset form after successful deposit
      setTimeout(() => {
        setAmount('');
        resetSendStatus();
        router.back();
      }, 2000);
    } catch (error) {
      console.error('Deposit failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Deposit failed',
        text2: 'Please try again',
      });
    }
  };

  const availableBalance = selectedToken
    ? Number(formatUnits(BigInt(selectedToken.balance || '0'), selectedToken.contractDecimals))
    : 0;

  const isValidAmount = amount && Number(amount) > 0 && Number(amount) <= availableBalance;
  const isDepositing = sendStatus === Status.PENDING;

  const keypadNumbers = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', 'backspace'],
  ];

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      {isScreenMedium && <Navbar />}

      <View className="flex-1 px-4 py-8">
        <View className="max-w-md mx-auto w-full h-full">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-8">
            <Pressable onPress={() => router.back()} className="web:hover:opacity-70">
              <ArrowLeft color="white" />
            </Pressable>
            <Text className="text-xl md:text-2xl font-semibold text-center">Deposit to card</Text>
            <View className="w-6" />
          </View>

          {/* Token Selection */}
          <View className="bg-card rounded-xl p-4 mb-6">
            <View className="flex-row items-center justify-between">
              {selectedToken ? (
                <>
                  <RenderTokenIcon
                    tokenIcon={getTokenIcon({
                      logoUrl: selectedToken.logoUrl,
                      tokenSymbol: selectedToken.contractTickerSymbol,
                      size: 32,
                    })}
                    size={32}
                  />
                  <View className="flex-1 ml-3">
                    <Text className="text-white font-medium">
                      {selectedToken.contractTickerSymbol}
                    </Text>
                    <Text className="text-muted-foreground text-sm">
                      {selectedToken.contractName}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-white text-sm">
                      {formatNumber(availableBalance)} available
                    </Text>
                    <Pressable onPress={handleMaxPress}>
                      <Text className="text-primary text-sm font-medium">Max</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text className="text-muted-foreground">No stablecoins available</Text>
              )}
            </View>
          </View>

          <Text className="text-center text-muted-foreground font-medium mb-4">
            Only stablecoins allowed to deposit to card
          </Text>

          {/* Amount Display */}
          <View className="justify-center items-center my-16">
            <Text className="text-6xl md:text-5xl font-bold text-white mb-2">
              {amount || '0'} {selectedToken?.contractTickerSymbol || 'USDC'}
            </Text>
          </View>

          {/* Virtual Keypad */}
          <View className="mb-6">
            {keypadNumbers.map((row, rowIndex) => (
              <View key={rowIndex} className="flex-row justify-around mb-4">
                {row.map(key => (
                  <Pressable
                    key={key}
                    onPress={() => {
                      if (key === 'backspace') {
                        handleBackspace();
                      } else {
                        handleNumberPress(key);
                      }
                    }}
                    className="w-20 h-20 items-center justify-center web:hover:bg-card rounded-full"
                  >
                    {key === 'backspace' ? (
                      <X size={24} color="white" />
                    ) : (
                      <Text className="text-3xl font-medium text-white">{key}</Text>
                    )}
                  </Pressable>
                ))}
              </View>
            ))}
          </View>

          {/* Continue Button */}
          <Button
            variant="brand"
            className="rounded-xl"
            size="lg"
            onPress={handleContinue}
            disabled={!isValidAmount || isDepositing}
          >
            <Text className="font-semibold">{isDepositing ? 'Depositing...' : 'Continue'}</Text>
            {isDepositing && <ActivityIndicator color="gray" size="small" />}
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default DepositToCard;
