import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Address, formatUnits } from 'viem';

import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useActivity } from '@/hooks/useActivity';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useDimension } from '@/hooks/useDimension';
import useSend from '@/hooks/useSend';
import useUser from '@/hooks/useUser';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { Status, TokenBalance, TokenType, TransactionStatus, TransactionType } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

const DepositToCard = () => {
  const router = useRouter();
  const { isScreenMedium } = useDimension();
  const { ethereumTokens } = useWalletTokens();
  const { data: cardDetails } = useCardDetails();
  const { createActivity, updateActivity } = useActivity();
  const { user } = useUser();
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);

  // Get USDC on Ethereum only
  const stablecoins = useMemo(() => {
    return ethereumTokens.filter(
      token => token.contractTickerSymbol === 'USDC' && token.chainId === 1,
    );
  }, [ethereumTokens]);

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
    tokenSymbol: selectedToken?.contractTickerSymbol || 'TOKEN',
    chainId: selectedToken?.chainId || 1,
    tokenType: selectedToken?.type || TokenType.ERC20,
  });

  const handleContinue = async () => {
    if (!selectedToken || !amount || !cardDetails?.funding_instructions || !user) {
      return;
    }

    try {
      const fundingAddress = cardDetails.funding_instructions.address as Address;

      console.warn('[Card Deposit] Creating activity...');

      // Create activity event for card deposit (stays PENDING until Bridge processes it)
      const clientTxId = await createActivity({
        type: TransactionType.CARD_TRANSACTION,
        title: `Card Deposit`,
        shortTitle: `Card Deposit`,
        amount,
        symbol: selectedToken.contractTickerSymbol,
        chainId: selectedToken.chainId,
        fromAddress: user.safeAddress,
        toAddress: fundingAddress,
        status: TransactionStatus.PENDING, // Explicitly set to PENDING
        metadata: {
          description: `Deposit ${amount} ${selectedToken.contractTickerSymbol} to card`,
          processingStatus: 'sending',
        },
      });

      console.warn('[Card Deposit] Activity created:', clientTxId);

      // Send the transaction
      const transaction = await send(amount, fundingAddress);

      // Update activity with transaction hash, but keep it PENDING
      // It will only go to SUCCESS when Bridge processes it
      await updateActivity(clientTxId, {
        status: TransactionStatus.PENDING, // Explicitly keep as PENDING
        hash: transaction.transactionHash,
        url: `https://etherscan.io/tx/${transaction.transactionHash}`,
        metadata: {
          txHash: transaction.transactionHash,
          processingStatus: 'awaiting_bridge',
        },
      });

      Toast.show({
        type: 'success',
        text1: 'Card deposit initiated',
        text2: `${amount} ${selectedToken.contractTickerSymbol} sent to card`,
        props: {
          link: `https://etherscan.io/tx/${transaction.transactionHash}`,
          linkText: 'View on Etherscan',
          image: require('@/assets/images/usdc-4x.png'),
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
                  <Image
                    source={require('@/assets/images/usdc-4x.png')}
                    style={{ width: 42, height: 42 }}
                  />
                  <View className="flex-1 ml-3">
                    <Text className="text-white font-bold text-lg">
                      {selectedToken.contractTickerSymbol}
                    </Text>
                    <Text className="text-[#ACACAC] font-medium">{selectedToken.contractName}</Text>
                  </View>
                  <View className="flex-row items-center gap-4">
                    <Text className=" text-[#ACACAC] font-medium">
                      {formatNumber(availableBalance)} available
                    </Text>
                    <Pressable
                      onPress={handleMaxPress}
                      className="bg-[#4D4D4D] px-3 py-1 rounded-xl"
                    >
                      <Text className="text-primary font-bold">Max</Text>
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
                      <Image
                        source={require('@/assets/images/backspace.png')}
                        style={{ width: 34, height: 25 }}
                      />
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
            <Text className="font-bold">{isDepositing ? 'Depositing...' : 'Continue'}</Text>
            {isDepositing && <ActivityIndicator color="gray" size="small" />}
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default DepositToCard;
