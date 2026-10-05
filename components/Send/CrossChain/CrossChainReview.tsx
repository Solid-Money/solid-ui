import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Control } from 'react-hook-form';
import { ActivityIndicator, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Info } from 'lucide-react-native';
import { Address } from 'viem';
import { fuse } from 'viem/chains';
import { useShallow } from 'zustand/react/shallow';

import ContractAddressWarning from '@/components/Send/ContractAddressWarning';
import SaveContact from '@/components/Send/SaveContact';
import { Button } from '@/components/ui/button';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivity } from '@/hooks/useActivity';
import { AddressBookFormData, useAddressBook } from '@/hooks/useAddressBook';
import useCrossChainSend, { CrossChainSendQuoteExpiredError } from '@/hooks/useCrossChainSend';
import { useCrossChainSendConfig } from '@/hooks/useCrossChainSendConfig';
import { useCrossChainSendQuote } from '@/hooks/useCrossChainSendQuote';
import { useIsContract } from '@/hooks/useIsContract';
import useSend from '@/hooks/useSend';
import { useTotp } from '@/hooks/useTotp';
import { track } from '@/lib/analytics';
import { Status, TokenType, TransactionStatus, TransactionType } from '@/lib/types';
import { CrossChainSendQuote } from '@/lib/types/cross-chain-send';
import { cn, eclipseAddress, formatNumber } from '@/lib/utils';
import {
  formatLD,
  getCrossChainSendToken,
  getExchangeDisplayName,
  isOwnWallet,
} from '@/lib/utils/cross-chain-send';
import { useSendStore } from '@/store/useSendStore';

import { BRAND, DetailCard, DetailRowSpec } from './shared';

const ValueSkeleton = () => <Skeleton className="h-4 w-24 rounded-md bg-white/10" />;

/**
 * Screen 4 of the cross-chain send: the final numbers, re-priced every 30s so
 * the voucher the backend signs matches what the user confirmed. A same-chain
 * (Fuse) destination is an ordinary send and takes the existing path.
 */
const CrossChainReview: React.FC = () => {
  const {
    selectedToken,
    amount,
    address,
    name,
    exchange: exchangeId,
    destinationChainId,
    setTransaction,
    setModal,
    setName,
    setCrossChainQuote,
  } = useSendStore(
    useShallow(state => ({
      selectedToken: state.selectedToken,
      amount: state.amount,
      address: state.address,
      name: state.name,
      exchange: state.exchange,
      destinationChainId: state.destinationChainId,
      setTransaction: state.setTransaction,
      setModal: state.setModal,
      setName: state.setName,
      setCrossChainQuote: state.setCrossChainQuote,
    })),
  );
  const { getExchange, getNetwork } = useCrossChainSendConfig();
  const { activities, refetchAll } = useActivity();

  const token = getCrossChainSendToken(selectedToken);
  const displayToken = token ?? 'USDC';
  const exchange = getExchange(exchangeId);
  const network = getNetwork(destinationChainId);
  const ownWallet = isOwnWallet(exchangeId);
  const exchangeName = getExchangeDisplayName(exchange, exchangeId);
  const isFuseDestination = destinationChainId === fuse.id;
  const depositNetworkLabel =
    (token && exchange?.networks[token]?.find(n => n.chainId === destinationChainId))
      ?.depositNetworkLabel ?? network?.name;

  const {
    quote: liveQuote,
    isLoading: isQuoteLoading,
    errorMessage: quoteError,
    refetch: refetchQuote,
  } = useCrossChainSendQuote({
    token,
    dstChainId: destinationChainId,
    amount,
    enabled: !isFuseDestination,
    debounceMs: 0,
    refetchInterval: 30 * 1000,
  });

  // A `requote` from the backend replaces the shown numbers until the next
  // scheduled re-price lands.
  const [requoted, setRequoted] = useState<CrossChainSendQuote | null>(null);
  useEffect(() => {
    setRequoted(null);
  }, [liveQuote]);
  const quote = requoted ?? liveQuote;

  const crossChain = useCrossChainSend();
  const sameChain = useSend({
    tokenAddress: selectedToken?.contractAddress as Address,
    tokenDecimals: selectedToken?.contractDecimals || 6,
    tokenSymbol: selectedToken?.contractTickerSymbol || displayToken,
    chainId: selectedToken?.chainId || fuse.id,
    tokenType: selectedToken?.type || TokenType.ERC20,
  });
  const sendStatus = isFuseDestination ? sameChain.sendStatus : crossChain.sendStatus;
  const isSendLoading = sendStatus === Status.PENDING;

  const { isContract } = useIsContract({
    address: address as Address | undefined,
    chainId: destinationChainId ?? undefined,
    enabled: !!address && destinationChainId !== null,
  });

  const {
    control: nameControl,
    watch: watchName,
    handleAddContact,
    errors: nameErrors,
    hasSkipped2fa,
  } = useAddressBook({
    defaultAddress: address || '',
    defaultName: name || '',
    defaultExchange: exchangeId ?? undefined,
    defaultChainId: destinationChainId ?? undefined,
    defaultToken: token ?? undefined,
    optionalName: true,
    onSuccess: () => {
      // Stay on the review; the contact is a side effect of sending.
    },
  });
  const { isVerified: isTotpVerified } = useTotp();
  const showSkip2fa = isTotpVerified && !hasSkipped2fa;
  const isContact = !name || showSkip2fa;

  const isFirstSendToDestination = useMemo(
    () =>
      !activities.some(
        activity =>
          activity.type === TransactionType.CROSS_CHAIN_SEND &&
          activity.status === TransactionStatus.SUCCESS &&
          activity.toAddress?.toLowerCase() === address.toLowerCase() &&
          Number(activity.metadata?.dstChainId) === destinationChainId,
      ),
    [activities, address, destinationChainId],
  );

  const saveContactIfAsked = useCallback(async () => {
    const nameValue = watchName('name');
    const skip2fa = watchName('skip2fa');
    if ((nameValue && nameValue.trim()) || skip2fa) {
      try {
        await handleAddContact();
        setName(nameValue?.trim() || '');
      } catch (err) {
        console.error('Failed to add to contacts:', err);
      }
    }
  }, [watchName, handleAddContact, setName]);

  const handleSameChainSend = useCallback(async () => {
    if (!selectedToken || !amount || !address) return;
    try {
      track(TRACKING_EVENTS.SEND_PAGE_TRANSACTION_INITIATED, {
        token_symbol: selectedToken.contractTickerSymbol,
        token_address: selectedToken.contractAddress,
        chain_id: selectedToken.chainId,
        amount,
        to_address: address,
        source: 'cross_chain_send_fuse',
      });
      const transaction = await sameChain.send(amount, address as Address);
      setTransaction({ amount: Number(amount), address: address as Address });
      track(TRACKING_EVENTS.SEND_PAGE_TRANSACTION_COMPLETED, {
        token_symbol: selectedToken.contractTickerSymbol,
        amount,
        transaction_hash: transaction.transactionHash,
        source: 'cross_chain_send_fuse',
      });
      refetchAll();
      setModal(SEND_MODAL.OPEN_TRANSACTION_STATUS);
    } catch (err) {
      console.error('Send failed:', err);
      track(TRACKING_EVENTS.SEND_PAGE_TRANSACTION_FAILED, {
        token_symbol: selectedToken.contractTickerSymbol,
        amount,
        error: String(err),
        source: 'cross_chain_send_fuse',
      });
      Toast.show({ type: 'error', text1: 'Error while sending', props: { badgeText: 'Onchain' } });
    }
  }, [selectedToken, amount, address, sameChain, setTransaction, refetchAll, setModal]);

  const handleCrossChainSend = useCallback(async () => {
    if (
      !selectedToken ||
      !token ||
      !quote ||
      !address ||
      !exchangeId ||
      destinationChainId === null
    )
      return;
    try {
      const result = await crossChain.send({
        token,
        tokenAddress: selectedToken.contractAddress as Address,
        dstChainId: destinationChainId,
        networkName: network?.name ?? String(destinationChainId),
        recipient: address as Address,
        exchange: exchangeId,
        amount,
        quote,
      });
      if (result.status === 'requote') {
        setRequoted(result.quote);
        setCrossChainQuote(result.quote);
        Toast.show({
          type: 'info',
          text1: 'Quote updated',
          text2: 'Check the new numbers and confirm again.',
        });
        return;
      }
      refetchAll();
    } catch (err) {
      if (err instanceof CrossChainSendQuoteExpiredError) {
        refetchQuote();
      }
      // Other failures were already toasted by the hook.
    }
  }, [
    selectedToken,
    token,
    quote,
    address,
    exchangeId,
    destinationChainId,
    crossChain,
    network?.name,
    amount,
    setCrossChainQuote,
    refetchAll,
    refetchQuote,
  ]);

  const handleSend = useCallback(async () => {
    await saveContactIfAsked();
    if (isFuseDestination) {
      await handleSameChainSend();
    } else {
      await handleCrossChainSend();
    }
  }, [saveContactIfAsked, isFuseDestination, handleSameChainSend, handleCrossChainSend]);

  if (!selectedToken || !amount || !address || !exchangeId || destinationChainId === null) {
    return (
      <View className="items-center">
        <Text className="max-w-64 text-center text-base font-medium">
          Missing or invalid information. Please go back and fill all fields.
        </Text>
      </View>
    );
  }

  const value = (text: string, className?: string) => (
    <Text className={cn('shrink text-right text-base font-medium text-white', className)}>
      {text}
    </Text>
  );
  const quoted = (text: (q: CrossChainSendQuote) => string, className?: string) =>
    quote && !quoteError ? value(text(quote), className) : <ValueSkeleton />;

  const toLabel = ownWallet
    ? eclipseAddress(address as Address)
    : `${name || exchangeName} · ${eclipseAddress(address as Address)}`;

  const rows: DetailRowSpec[] = [
    { key: 'to', label: 'To', value: value(toLabel) },
    { key: 'network', label: 'Receive on', value: value(network?.name ?? '') },
    ...(isFuseDestination
      ? []
      : [
          {
            key: 'fee',
            label: 'Fee',
            value: quoted(q => `${formatLD(q.totalFeeLD)} ${displayToken}`),
          },
          {
            key: 'min',
            label: 'Min. receive',
            value: quoted(q => `${formatLD(q.minAmountLD)} ${displayToken}`),
          },
        ]),
    {
      key: 'gas',
      label: 'Gas',
      value: <Text className="text-base font-medium text-brand">Paid by Solid</Text>,
    },
    {
      key: 'receive',
      label: 'They receive',
      value: isFuseDestination
        ? value(`${formatNumber(Number(amount))} ${displayToken}`, 'font-semibold')
        : quoted(q => `${formatLD(q.amountReceivedLD)} ${displayToken}`, 'font-semibold'),
    },
    ...(isFuseDestination
      ? []
      : [
          {
            key: 'eta',
            label: 'Arrives in',
            value: quoted(q => `About ${q.etaMinutes} min`),
          },
        ]),
  ];

  const canSend =
    !isSendLoading && (isFuseDestination || (!!quote && !quoteError && !isQuoteLoading));

  return (
    <View className="flex-1 justify-between gap-8">
      <View className="gap-5">
        <View className="items-center gap-2">
          <Text className="text-sm text-white/70">You send</Text>
          <Text className="text-[40px] font-semibold leading-[48px] text-white">
            {formatNumber(Number(amount))} {displayToken}
          </Text>
          <View className="flex-row items-center gap-2">
            <View className="rounded-full bg-[#333] px-3 py-1">
              <Text className="text-sm text-white/70">Fuse</Text>
            </View>
            <Text className="text-sm text-white/70">→</Text>
            <View className="rounded-full bg-[rgba(148,242,127,0.16)] px-3 py-1">
              <Text className="text-sm text-brand">{network?.name}</Text>
            </View>
          </View>
        </View>

        {quoteError ? <Text className="text-center text-sm text-red-400">{quoteError}</Text> : null}

        <DetailCard rows={rows} />

        <View className="flex-row gap-3 rounded-[15px] border border-[rgba(148,242,127,0.35)] bg-[rgba(148,242,127,0.08)] px-4 py-[14px]">
          <Info size={20} color={BRAND} />
          <View className="flex-1 gap-1">
            <Text className="text-[15px] font-medium leading-5 text-white">
              {ownWallet
                ? `Make sure your wallet is on ${network?.name} before you look for the funds.`
                : `In ${exchangeName}, pick ${depositNetworkLabel} as the deposit network for ${displayToken}.`}
            </Text>
            {isFirstSendToDestination ? (
              <Text className="text-sm leading-[18px] text-white/70">
                First time sending to this address on {network?.name}.
              </Text>
            ) : null}
          </View>
        </View>

        {isContract ? <ContractAddressWarning chainName={network?.name ?? 'this network'} /> : null}

        {isContact ? (
          <SaveContact
            control={nameControl as Control<AddressBookFormData>}
            errors={nameErrors}
            showSkip2fa={showSkip2fa}
            name={name}
          />
        ) : null}
      </View>

      <Button
        variant="brand"
        className="h-12 rounded-full"
        size="lg"
        onPress={handleSend}
        disabled={!canSend}
      >
        <Text className="text-base font-bold">
          {isSendLoading ? 'Sending' : `Send ${formatNumber(Number(amount))} ${displayToken}`}
        </Text>
        {isSendLoading ? <ActivityIndicator color="black" /> : null}
      </Button>

      {isFuseDestination ? sameChain.totpModal : crossChain.totpModal}
    </View>
  );
};

export default CrossChainReview;
