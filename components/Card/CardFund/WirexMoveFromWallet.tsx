import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { Address, formatUnits, parseUnits } from 'viem';

import CardFundGroup from '@/components/Card/CardFund/CardFundGroup';
import CardFundRow from '@/components/Card/CardFund/CardFundRow';
import {
  CARD_FUND_DESTINATION_TYPE,
  CARD_FUND_ESTIMATED_TIME,
  getCardFundRoutes,
  getCardFundTokenIcon,
} from '@/components/Card/CardFund/constants';
import Max from '@/components/Max';
import NeedHelp from '@/components/NeedHelp';
import { Button } from '@/components/ui/button';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import {
  CARD_SPENDABLE_ASSETS,
  describeCardSpendableAssets,
} from '@/constants/cardSpendableAssets';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useBalances } from '@/hooks/useBalances';
import useSend from '@/hooks/useSend';
import { track } from '@/lib/analytics';
import { createDirectDepositSession } from '@/lib/api';
import { Status, TokenType } from '@/lib/types';
import { cn, formatNumber, withRefreshToken } from '@/lib/utils';
import { getMovableHoldings, MovableHolding } from '@/lib/utils/cardFundMove';

const TOKEN_ICON_STYLE = { width: 36, height: 36, borderRadius: 18 };

/** The holdings this cardholder could make spendable, richest first. */
export const useMovableHoldings = (): { holdings: MovableHolding[]; isLoading: boolean } => {
  const { tokens, isLoading } = useBalances();

  const holdings = useMemo(
    () => getMovableHoldings(tokens, getCardFundRoutes(), CARD_SPENDABLE_ASSETS),
    [tokens],
  );

  return { holdings, isLoading };
};

const chainName = (chainId: number): string => BRIDGE_TOKENS[chainId]?.name ?? `Chain ${chainId}`;

/** "12.5 USDC" — the balance in its own token, not converted. */
const holdingLabel = (holding: MovableHolding): string =>
  `${formatNumber(holding.amount, 6, 2)} ${holding.symbol}`;

/**
 * Step 1 of "Move from wallet": which holding to make spendable.
 *
 * Only holdings the card cannot already reach are listed — see
 * `getMovableHoldings`. When there are none the screen says so rather than
 * rendering an empty card, because "nothing to move" and "we could not load your
 * balances" look identical otherwise and only one of them is good news.
 */
export const WirexMoveHoldings = ({
  holdings,
  isLoading,
  onSelect,
}: {
  holdings: MovableHolding[];
  isLoading?: boolean;
  onSelect: (holding: MovableHolding) => void;
}) => {
  if (isLoading) {
    return (
      <View className="gap-y-3">
        <Skeleton className="h-[72px] rounded-[15px]" />
        <Skeleton className="h-[72px] rounded-[15px]" />
      </View>
    );
  }

  if (!holdings.length) {
    return (
      <View className="gap-y-8">
        <View className="gap-y-2 rounded-[15px] bg-card px-[18px] py-5">
          <Text className="text-lg font-semibold leading-tight text-primary">
            Nothing to move right now
          </Text>
          <Text className="text-sm leading-5 text-white/70">
            Your card already spends {describeCardSpendableAssets()}, and that is everything your
            wallet holds on a supported network. To add more, go back and deposit a stablecoin.
          </Text>
        </View>
        <View className="items-center">
          <NeedHelp />
        </View>
      </View>
    );
  }

  return (
    <View className="gap-y-8">
      <CardFundGroup label="In your wallet">
        {holdings.map(holding => (
          <CardFundRow
            key={`${holding.chainId}:${holding.tokenAddress}`}
            icon={
              <Image
                source={getCardFundTokenIcon(holding.symbol)}
                style={TOKEN_ICON_STYLE}
                contentFit="cover"
              />
            }
            title={holdingLabel(holding)}
            chips={[chainName(holding.chainId)]}
            chipsPosition="inline"
            onPress={() => onSelect(holding)}
          />
        ))}
      </CardFundGroup>
      <View className="items-center">
        <NeedHelp />
      </View>
    </View>
  );
};

/**
 * Step 2 of "Move from wallet": how much, then send.
 *
 * The move is one ERC-20 transfer from the cardholder's Safe to their own card
 * deposit address, and the direct-deposit pipeline takes it from there — bridging
 * to Fuse and delivering it to that same Safe as spendable stablecoin. Which is
 * to say this reuses, unchanged, the path every Wirex card deposit already takes;
 * the only new thing is that the app sends the transfer instead of the user
 * pasting an address into another wallet.
 *
 * Deliberately not the Rain mechanic (approve, then `POST /deposit` pulls). That
 * one delivers to Base, and pointing it at Fuse means a new branch in the
 * connect-wallet deposit workflows — three touch points in a money path with its
 * own idempotency rules, for a route that already exists and is already carrying
 * these users' deposits.
 */
export const WirexMoveAmount = ({
  holding,
  onDone,
}: {
  holding: MovableHolding;
  onDone: () => void;
}) => {
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { send, sendStatus, totpModal } = useSend({
    tokenAddress: holding.tokenAddress as Address,
    tokenDecimals: holding.decimals,
    tokenSymbol: holding.symbol,
    chainId: holding.chainId,
    tokenType: TokenType.ERC20,
  });

  // Exact, in the token's own units. The scaled `amount` is a float and 18-decimal
  // USDC/USDT on BNB Chain does not survive one: "Max" has to mean the balance,
  // not a value that rounds a wei above it and reverts.
  const maxValue = useMemo(
    () => formatUnits(BigInt(holding.balance || '0'), holding.decimals),
    [holding],
  );

  const error = useMemo(() => {
    if (!amount) return null;
    let wei: bigint;
    try {
      wei = parseUnits(amount, holding.decimals);
    } catch {
      return 'Enter a valid amount';
    }
    if (wei <= 0n) return 'Enter a valid amount';
    if (wei > BigInt(holding.balance || '0')) {
      return `Amount exceeds your balance (${holdingLabel(holding)} available)`;
    }
    return null;
  }, [amount, holding]);

  const onSubmit = useCallback(async () => {
    if (error || !amount || isSubmitting) return;

    setIsSubmitting(true);
    try {
      track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
        deposit_method: 'wirex_move_from_wallet',
        chain_id: holding.chainId,
        selected_token: holding.symbol,
      });

      // Also what registers the address with the deposit streams, so this has to
      // succeed before the transfer goes out: funds sent to an unwatched address
      // sit there until the stream-sync backstop catches up.
      const session = await withRefreshToken(() =>
        createDirectDepositSession(holding.chainId, holding.symbol, CARD_FUND_DESTINATION_TYPE),
      );

      if (!session?.walletAddress) {
        throw new Error('Could not prepare your card deposit address. Please try again.');
      }

      await send(amount, session.walletAddress as Address);

      Toast.show({
        type: 'success',
        text1: 'Moving to your card',
        text2: `${amount} ${holding.symbol} will be spendable in about ${CARD_FUND_ESTIMATED_TIME.replace('~', '')}.`,
      });
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again';
      // The user backing out of the passkey prompt is a decision, not a failure.
      if (!message.toLowerCase().includes('cancelled')) {
        Toast.show({ type: 'error', text1: 'Move failed', text2: message });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [amount, error, holding, isSubmitting, onDone, send]);

  const isBusy = isSubmitting || sendStatus === Status.PENDING;

  return (
    <View className="gap-y-5">
      <View className="gap-y-2">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium opacity-50">Amount</Text>
          <View className="flex-row items-center gap-2">
            <Text className="font-medium opacity-50">{holdingLabel(holding)}</Text>
            <Max onPress={() => setAmount(maxValue)} disabled={isBusy} />
          </View>
        </View>
        <View
          className={cn(
            'w-full flex-row items-center justify-between gap-4 rounded-2xl bg-accent px-5 py-3',
            error && 'border border-red-500',
          )}
        >
          <TextInput
            keyboardType="decimal-pad"
            className="min-w-0 flex-1 text-2xl font-semibold text-white web:focus:outline-none"
            value={amount}
            placeholder="0.00"
            placeholderTextColor="#666"
            onChangeText={setAmount}
            editable={!isBusy}
          />
          <Text className="text-2xl font-semibold text-foreground">{holding.symbol}</Text>
        </View>
      </View>

      {error ? (
        <Text className="text-sm text-red-500">{error}</Text>
      ) : (
        <Text className="text-sm leading-5 opacity-50">
          Sent from your wallet on {chainName(holding.chainId)} and delivered to your card as
          spendable {holding.symbol}. Takes about {CARD_FUND_ESTIMATED_TIME.replace('~', '')}.
        </Text>
      )}

      <Button
        variant="brand"
        className="h-12 rounded-2xl"
        disabled={isBusy || !amount || !!error}
        onPress={onSubmit}
      >
        {isBusy ? (
          <ActivityIndicator color="black" />
        ) : (
          <Text className="text-base font-bold text-black">Move to card</Text>
        )}
      </Button>

      {totpModal}
    </View>
  );
};
