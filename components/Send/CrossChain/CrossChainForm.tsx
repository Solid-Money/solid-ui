import React, { useCallback, useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { Address, formatUnits, parseUnits } from 'viem';
import { fuse, mainnet } from 'viem/chains';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import TooltipPopover from '@/components/Tooltip';
import { Button } from '@/components/ui/button';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCrossChainSendConfig } from '@/hooks/useCrossChainSendConfig';
import { useCrossChainSendQuote } from '@/hooks/useCrossChainSendQuote';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { track } from '@/lib/analytics';
import getTokenIcon from '@/lib/getTokenIcon';
import { cn, eclipseAddress, formatNumber } from '@/lib/utils';
import {
  CROSS_CHAIN_SEND_DECIMALS,
  formatLD,
  getCrossChainSendToken,
  getExchangeDisplayName,
  getExchangeInitial,
} from '@/lib/utils/cross-chain-send';
import { useSendStore } from '@/store/useSendStore';

import { Chip, DetailCard, DetailRowSpec, Divider, LetterAvatar, NetworkIcon } from './shared';

const FEE_TOOLTIP =
  'Stargate bridge fee plus the LayerZero message fee, both taken from the amount you send.';

const QuoteValueSkeleton = () => <Skeleton className="h-4 w-24 rounded-md bg-white/10" />;

/**
 * Screen 3 of the cross-chain send: the amount, with the live quote under it.
 * The destination summary sits on top so the user can hop back to change the
 * exchange or the network without losing the amount.
 */
const CrossChainForm: React.FC = () => {
  const {
    selectedToken,
    amount,
    address,
    name,
    exchange: exchangeId,
    destinationChainId,
    setAmount,
    setModal,
  } = useSendStore(
    useShallow(state => ({
      selectedToken: state.selectedToken,
      amount: state.amount,
      address: state.address,
      name: state.name,
      exchange: state.exchange,
      destinationChainId: state.destinationChainId,
      setAmount: state.setAmount,
      setModal: state.setModal,
    })),
  );
  const { config, getExchange, getNetwork, getRoute } = useCrossChainSendConfig();
  const { fuseTokens, isLoading } = useWalletTokens();

  const token = getCrossChainSendToken(selectedToken);
  const exchange = getExchange(exchangeId);
  const network = getNetwork(destinationChainId);
  const route = getRoute(token, destinationChainId);
  const isFuseDestination = destinationChainId === fuse.id;
  const displayToken = token ?? 'USDC';

  // The store's snapshot of the token goes stale after a send; the wallet
  // tokens poll (see SendForm's `liveToken`).
  const liveToken = useMemo(() => {
    if (!selectedToken) return null;
    const fresh = fuseTokens.find(
      t => t.contractAddress.toLowerCase() === selectedToken.contractAddress.toLowerCase(),
    );
    return fresh ?? selectedToken;
  }, [selectedToken, fuseTokens]);

  const balanceWei = useMemo(() => {
    if (!liveToken) return 0n;
    try {
      return BigInt(liveToken.balance || '0');
    } catch {
      return 0n;
    }
  }, [liveToken]);
  const balanceAmount = Number(formatUnits(balanceWei, CROSS_CHAIN_SEND_DECIMALS));

  const schema = useMemo(
    () =>
      z.object({
        amount: z
          .string()
          .refine(val => val !== '' && !isNaN(Number(val)), {
            error: 'Please enter a valid amount',
          })
          .refine(
            val => {
              try {
                return parseUnits(val, CROSS_CHAIN_SEND_DECIMALS) > 0n;
              } catch {
                return false;
              }
            },
            { error: 'Amount must be greater than 0' },
          )
          .refine(
            val => {
              try {
                return parseUnits(val, CROSS_CHAIN_SEND_DECIMALS) <= balanceWei;
              } catch {
                return false;
              }
            },
            { error: `Available balance is ${formatNumber(balanceAmount)} ${displayToken}` },
          ),
      }),
    [balanceWei, balanceAmount, displayToken],
  );

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    trigger,
  } = useForm({
    resolver: zodResolver(schema),
    mode: Platform.OS === 'web' ? 'onChange' : undefined,
    defaultValues: { amount },
  });

  useEffect(() => {
    if (amount) setValue('amount', amount);
  }, [amount, setValue]);

  // Limits the backend would reject: say which one, with the number.
  const limitError = useMemo(() => {
    if (!config || !amount || isFuseDestination) return null;
    let amountLD: bigint;
    try {
      amountLD = parseUnits(amount, CROSS_CHAIN_SEND_DECIMALS);
    } catch {
      return null;
    }
    if (amountLD <= 0n) return null;
    const min = BigInt(
      destinationChainId === mainnet.id
        ? config.limits.perSendMinEthereum
        : config.limits.perSendMin,
    );
    if (amountLD < min) return `Minimum is ${formatLD(min.toString())} ${displayToken}`;
    const max = BigInt(config.limits.perSendMax);
    if (amountLD > max) return `Maximum is ${formatLD(max.toString())} ${displayToken} per send`;
    if (route && BigInt(route.maxAmountLD) < amountLD) {
      return `Up to ${formatLD(route.maxAmountLD)} ${displayToken} right now on ${network?.name ?? 'this network'}`;
    }
    return null;
  }, [config, amount, isFuseDestination, destinationChainId, displayToken, route, network?.name]);

  const {
    quote,
    isLoading: isQuoteLoading,
    errorMessage: quoteError,
  } = useCrossChainSendQuote({
    token,
    dstChainId: destinationChainId,
    amount,
    enabled: !isFuseDestination && isValid && !limitError,
  });

  const handleAmountChange = useCallback(
    (value: string) => {
      setAmount(value);
      setValue('amount', value);
    },
    [setAmount, setValue],
  );

  const handleMaxPress = useCallback(() => {
    if (balanceWei === 0n) return;
    // Format from the BigInt so the string round-trips through parseUnits exactly.
    const maxAmount = formatUnits(balanceWei, CROSS_CHAIN_SEND_DECIMALS);
    setAmount(maxAmount);
    setValue('amount', maxAmount);
    trigger('amount');
  }, [balanceWei, setAmount, setValue, trigger]);

  const handleTokenSelectorPress = useCallback(() => {
    track(TRACKING_EVENTS.SEND_PAGE_TOKEN_SELECTOR_OPENED, {
      source: 'cross_chain_send',
      current_token: displayToken,
    });
    setModal(SEND_MODAL.OPEN_TOKEN_SELECTOR);
  }, [setModal, displayToken]);

  const onSubmit = useCallback(
    (data: { amount: string }) => {
      setAmount(data.amount.toString());
      setModal(SEND_MODAL.OPEN_CROSS_CHAIN_REVIEW);
    },
    [setAmount, setModal],
  );

  const inlineError = (errors.amount?.message as string | undefined) || limitError || quoteError;
  const quoteReady = isFuseDestination || (!!quote && !quoteError);
  const canReview = !!selectedToken && isValid && !limitError && quoteReady && !isQuoteLoading;

  const quoteRows = useMemo((): DetailRowSpec[] => {
    const value = (text: string, strong = false) => (
      <Text
        className={cn('text-right text-base text-white', strong ? 'font-semibold' : 'font-medium')}
      >
        {text}
      </Text>
    );
    const pending = () => (isQuoteLoading || !quote || quoteError ? <QuoteValueSkeleton /> : null);
    const gasRow: DetailRowSpec = {
      key: 'gas',
      label: 'Gas',
      value: <Text className="text-base font-medium text-brand">Paid by Solid</Text>,
    };

    if (isFuseDestination) {
      return [
        {
          key: 'receive',
          label: 'They receive',
          value: value(`${amount ? formatNumber(Number(amount)) : '0'} ${displayToken}`, true),
        },
        gasRow,
      ];
    }

    const hideValues = !!quoteError;
    return [
      {
        key: 'receive',
        label: 'They receive',
        value: hideValues
          ? value('—')
          : (pending() ?? value(`${formatLD(quote?.amountReceivedLD)} ${displayToken}`, true)),
      },
      {
        key: 'fee',
        label: (
          <View className="flex-row items-center gap-1.5">
            <Text className="text-base text-white/70">Fee</Text>
            <TooltipPopover text={FEE_TOOLTIP} analyticsContext="cross_chain_send_fee" />
          </View>
        ),
        value: hideValues
          ? value('—')
          : (pending() ?? value(`${formatLD(quote?.totalFeeLD)} ${displayToken}`)),
      },
      {
        key: 'min',
        label: 'Min. receive',
        value: hideValues
          ? value('—')
          : (pending() ?? value(`${formatLD(quote?.minAmountLD)} ${displayToken}`)),
      },
      gasRow,
      {
        key: 'eta',
        label: 'Arrives in',
        value: hideValues
          ? value('—')
          : (pending() ?? value(`About ${quote?.etaMinutes ?? network?.etaMinutes ?? '–'} min`)),
      },
    ];
  }, [
    isFuseDestination,
    amount,
    displayToken,
    quote,
    quoteError,
    isQuoteLoading,
    network?.etaMinutes,
  ]);

  return (
    <View className="flex-1 justify-between gap-8">
      <View className="gap-5">
        <View className="overflow-hidden rounded-[15px] bg-card">
          <Pressable
            className="flex-row items-center gap-[13px] px-[18px] py-[14px] web:hover:bg-card-hover"
            onPress={() => setModal(SEND_MODAL.OPEN_CROSS_CHAIN_DESTINATION)}
          >
            <LetterAvatar letter={getExchangeInitial(exchange, exchangeId)} />
            <View className="flex-1 gap-0.5">
              <Text className="text-lg font-semibold leading-[22px] text-white">
                {name || getExchangeDisplayName(exchange, exchangeId)}
              </Text>
              <Text className="text-sm leading-[18px] text-white/70">
                {address ? eclipseAddress(address as Address) : ''}
              </Text>
            </View>
            <ChevronRight size={20} color="white" />
          </Pressable>
          <Divider />
          <Pressable
            className="flex-row items-center gap-[13px] px-[18px] py-[14px] web:hover:bg-card-hover"
            onPress={() => setModal(SEND_MODAL.OPEN_CROSS_CHAIN_NETWORK)}
          >
            <NetworkIcon networkKey={network?.key} />
            <View className="flex-1 gap-0.5">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-lg font-semibold leading-[22px] text-white">
                  Receive on {network?.name ?? '…'}
                </Text>
                {network && !isFuseDestination ? (
                  <Chip label={`~${network.etaMinutes} min`} />
                ) : null}
              </View>
              <Text className="text-sm leading-[18px] text-brand">Change network</Text>
            </View>
            <ChevronRight size={20} color="white" />
          </Pressable>
        </View>

        <View className="items-center gap-3 py-2">
          <Controller
            control={control}
            name="amount"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className="w-full text-center text-[64px] font-semibold leading-[72px] text-white web:focus:outline-none"
                placeholder="0"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={value}
                onChangeText={text => {
                  onChange(text);
                  handleAmountChange(text);
                }}
                onBlur={onBlur}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            )}
          />
          <Pressable
            className="h-[45px] flex-row items-center gap-1.5 rounded-full bg-card px-3 web:hover:bg-card-hover"
            onPress={handleTokenSelectorPress}
          >
            <RenderTokenIcon
              tokenIcon={getTokenIcon({
                logoUrl: selectedToken?.logoUrl,
                tokenSymbol: selectedToken?.contractTickerSymbol,
                size: 26,
              })}
              size={26}
            />
            <Text className="text-base font-medium text-white">{displayToken}</Text>
            <ChevronDown size={18} color="white" />
          </Pressable>
          <View className="flex-row items-center gap-2">
            <Text className="text-sm text-white/70">
              {isLoading && balanceWei === 0n
                ? '…'
                : `${formatNumber(balanceAmount)} ${displayToken} available on Fuse`}
            </Text>
            {balanceWei > 0n ? (
              <Pressable
                onPress={handleMaxPress}
                hitSlop={6}
                className="rounded-[18px] bg-[rgba(148,242,127,0.16)] px-2 pb-[3px] pt-[2px]"
              >
                <Text className="text-sm leading-4 text-brand">Max</Text>
              </Pressable>
            ) : null}
          </View>
          {inlineError ? (
            <Text className="text-center text-sm text-red-400">{inlineError}</Text>
          ) : null}
        </View>

        <DetailCard rows={quoteRows} />
      </View>

      <Button
        variant="brand"
        className="h-12 rounded-full"
        size="lg"
        onPress={handleSubmit(onSubmit)}
        disabled={!canReview}
      >
        <Text className="text-base font-bold">Review</Text>
      </Button>
    </View>
  );
};

export default CrossChainForm;
