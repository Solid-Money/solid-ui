import React, { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Address } from 'viem';
import Toast from 'react-native-toast-message';

import { TotpVerificationModalContent } from '@/components/TotpVerificationModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useSend from '@/hooks/useSend';
import { track } from '@/lib/analytics';
import getTokenIcon from '@/lib/getTokenIcon';
import { Status, TokenType } from '@/lib/types';
import { cn, eclipseAddress, formatNumber } from '@/lib/utils';
import { getChain } from '@/lib/wagmi';
import { useSendStore } from '@/store/useSendStore';
import { verifyTotp } from '@/lib/api';

const SendTotpVerification: React.FC = () => {
  const { selectedToken, amount, address, name, setTransaction, setModal } = useSendStore();

  const { send, sendStatus } = useSend({
    tokenAddress: selectedToken?.contractAddress as any,
    tokenDecimals: selectedToken?.contractDecimals || 18,
    tokenSymbol: selectedToken?.contractTickerSymbol || 'TOKEN',
    chainId: selectedToken?.chainId || 1,
    tokenType: selectedToken?.type || TokenType.ERC20,
    skipTotpCheck: true, // TOTP already verified in this step
  });

  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string>('');

  const handleVerify = useCallback(
    async (code: string) => {
      if (!selectedToken || !amount || !address) return;

      setIsVerifying(true);
      setError('');

      try {
        // Verify TOTP code
        await verifyTotp(code, 'transaction');

        // TOTP verified, proceed with send
        track(TRACKING_EVENTS.SEND_PAGE_TRANSACTION_INITIATED, {
          token_symbol: selectedToken.contractTickerSymbol,
          token_address: selectedToken.contractAddress,
          chain_id: selectedToken.chainId,
          amount: amount.toString(),
          to_address: address,
          source: 'send_modal',
        });

        const transaction = await send(amount.toString(), address as Address);
        setTransaction({
          amount: Number(amount),
          address: address,
        });

        track(TRACKING_EVENTS.SEND_PAGE_TRANSACTION_COMPLETED, {
          token_symbol: selectedToken.contractTickerSymbol,
          amount: amount.toString(),
          transaction_hash: transaction.transactionHash,
          source: 'send_modal',
        });

        setModal(SEND_MODAL.OPEN_TRANSACTION_STATUS);

        Toast.show({
          type: 'success',
          text1: 'Send transaction completed',
          text2: `${amount} ${selectedToken?.contractTickerSymbol}`,
          props: {
            link: `${getChain(selectedToken?.chainId)?.blockExplorers?.default.url}/tx/${transaction.transactionHash}`,
            linkText: eclipseAddress(transaction.transactionHash),
            image: getTokenIcon({
              logoUrl: selectedToken?.logoUrl,
              tokenSymbol: selectedToken?.contractTickerSymbol,
              size: 24,
            }),
          },
        });
      } catch (err: any) {
        console.error('TOTP verification or send failed:', err);
        const errorMessage =
          err.status === 401
            ? 'Invalid code. Please try again.'
            : err.message || 'Failed to verify. Please try again.';
        setError(errorMessage);
        throw err;
      } finally {
        setIsVerifying(false);
      }
    },
    [selectedToken, amount, address, send, setTransaction, setModal],
  );

  const handleCancel = useCallback(() => {
    setModal(SEND_MODAL.OPEN_REVIEW);
  }, [setModal]);

  if (!selectedToken || !amount || !address) {
    return (
      <View className="items-center">
        <Text className="text-base font-medium max-w-64 text-center">
          Missing or invalid information. Please go back and fill all fields.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-6">
      <View className="items-center gap-2">
        <Text className="text-2xl font-semibold text-center text-white">
          Verify Two-Factor Authentication
        </Text>
        <Text className="text-[#ACACAC] text-center font-medium text-base max-w-xs opacity-70">
          Enter the 6-digit code from your authenticator app to complete sending{' '}
          {formatNumber(Number(amount))} {selectedToken.contractTickerSymbol} to{' '}
          {name || eclipseAddress(address)}.
        </Text>
      </View>

      {error && (
        <View className="p-2.5 border border-red-300 rounded-2xl">
          <Text className="text-red-400 text-sm text-center">{error}</Text>
        </View>
      )}

      <TotpVerificationModalContent onVerify={handleVerify} onCancel={handleCancel} />

      {sendStatus === Status.PENDING && (
        <View className="items-center gap-2">
          <ActivityIndicator size="small" color="#94F27F" />
          <Text className="text-sm opacity-70">Sending transaction...</Text>
        </View>
      )}
    </View>
  );
};

export default SendTotpVerification;

