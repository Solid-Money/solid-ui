import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Address, formatUnits } from 'viem';

import PageLayout from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivity } from '@/hooks/useActivity';
import { useCardDetails } from '@/hooks/useCardDetails';
import useSend from '@/hooks/useSend';
import useUser from '@/hooks/useUser';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { Status, TokenBalance, TokenType, TransactionStatus, TransactionType } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

const DepositToCard = () => {
  const router = useRouter();
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
      // Track card deposit started
      track(TRACKING_EVENTS.CARD_DEPOSIT_STARTED, {
        amount: Number(amount),
        token_symbol: selectedToken.contractTickerSymbol,
        chain_id: selectedToken.chainId,
      });

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
          tokenAddress: selectedToken.contractAddress,
        },
      });

      console.warn('[Card Deposit] Activity created:', clientTxId);

      // Send the transaction
      const transaction = await send(amount, fundingAddress);

      // Track transaction sent
      track(TRACKING_EVENTS.CARD_DEPOSIT_TRANSACTION_SENT, {
        amount: Number(amount),
        token_symbol: selectedToken.contractTickerSymbol,
        chain_id: selectedToken.chainId,
        tx_hash: transaction.transactionHash,
      });

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
          image: getAsset('images/usdc-4x.png'),
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

      // Track deposit failed
      track(TRACKING_EVENTS.CARD_DEPOSIT_FAILED, {
        amount: Number(amount),
        token_symbol: selectedToken?.contractTickerSymbol,
        chain_id: selectedToken?.chainId,
        error_message: error instanceof Error ? error.message : String(error),
      });

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
    <PageLayout desktopOnly contentClassName="px-4 py-8">
      <View className="mx-auto h-full w-full max-w-md">
        {/* Header */}
        <View className="mb-8 flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} className="web:hover:opacity-70">
            <ArrowLeft color="white" />
          </Pressable>
          <Text className="text-center text-xl font-semibold md:text-2xl">Deposit to card</Text>
          <View className="w-6" />
        </View>

        {/* Token Selection */}
        <View className="mb-6 rounded-xl bg-card p-4">
          <View className="flex-row items-center justify-between">
            {selectedToken ? (
              <>
                <Image source={getAsset('images/usdc-4x.png')} style={{ width: 42, height: 42 }} />
                <View className="ml-3 flex-1">
                  <Text className="text-lg font-bold text-white">
                    {selectedToken.contractTickerSymbol}
                  </Text>
                  <Text className="font-medium text-[#ACACAC]">{selectedToken.contractName}</Text>
                </View>
                <View className="flex-row items-center gap-4">
                  <Text className=" text-base font-medium text-[#ACACAC]">
                    {formatNumber(availableBalance)} available
                  </Text>
                  <Pressable onPress={handleMaxPress} className="rounded-xl bg-[#4D4D4D] px-3 py-1">
                    <Text className="text-base font-bold text-primary">Max</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text className="text-base text-muted-foreground">No stablecoins available</Text>
            )}
          </View>
        </View>

        <Text className="mb-4 text-center text-base font-medium text-muted-foreground">
          Only stablecoins allowed to deposit to card
        </Text>

        {/* Amount Display */}
        <View className="my-16 items-center justify-center">
          <Text className="mb-2 text-6xl font-bold text-white md:text-5xl">
            {amount || '0'} {selectedToken?.contractTickerSymbol || 'USDC'}
          </Text>
        </View>

        {/* Virtual Keypad */}
        <View className="mb-6">
          {keypadNumbers.map((row, rowIndex) => (
            <View key={rowIndex} className="mb-4 flex-row justify-around">
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
                  className="h-20 w-20 items-center justify-center rounded-full web:hover:bg-card"
                >
                  {key === 'backspace' ? (
                    <Image
                      source={getAsset('images/backspace.png')}
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
          <Text className="text-base font-bold">{isDepositing ? 'Depositing...' : 'Continue'}</Text>
          {isDepositing && <ActivityIndicator color="gray" size="small" />}
        </Button>
      </View>
    </PageLayout>
  );
};

export default DepositToCard;
