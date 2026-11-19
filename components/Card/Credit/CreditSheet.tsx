import { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { base, fuse } from 'viem/chains';

import {
  AssetView,
  BreakdownView,
  LoanPickerView,
  SheetBody,
  SheetHeader,
  UnlockPickerView,
  type UnlockSource,
  UnlockView,
} from '@/components/Card/Credit/CreditSheetViews';
import { assetName, joinNames } from '@/components/Card/Credit/creditUi';
import { explorerTxUrl, type LoanRepay, useLoanRepay } from '@/components/Card/Credit/useLoanRepay';
import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';
import RepaySheetContent from '@/components/Card/NewCardDetails/SpendMode/RepaySheetContent';
import { Text } from '@/components/ui/text';
import { showErrorToast } from '@/lib/errors';
import { eclipseAddress } from '@/lib/utils';

import type { CreditDetails } from '@/components/Card/Credit/useCreditDetails';
import type { CardSheetPresentation } from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet.types';
import type { CardRepayChainId } from '@/hooks/useCardRepay';
import type { useCollateralUnlock } from '@/hooks/useCollateralUnlock';
import type { UnlockQuote } from '@/lib/creditRisk';
import type { ReactNode } from 'react';
import type { Address } from 'viem';

/** A step in the Credit page's sheet. Each is about one loan, or one asset in one loan. */
export type CreditSheetRoute =
  /** F: which loan to repay, only with debt on both chains. */
  | { view: 'pick-loan' }
  /** The repay step, optionally opened on one source ("Pay down with Bitcoin") or at MAX. */
  | { view: 'repay'; chainId: number; sourceId?: string; full?: boolean }
  /** N: what backs a loan with several assets. */
  | { view: 'breakdown'; chainId: number }
  /** G: one asset, on one instance. */
  | { view: 'asset'; chainId: number; token: Address }
  /** P: which asset to unlock from a loan holding several. */
  | { view: 'pick-asset'; chainId: number }
  /** H: unlocking part of one asset while the loan stays open. */
  | { view: 'unlock'; chainId: number; token: Address };

type UnlockApi = ReturnType<typeof useCollateralUnlock>;

const TITLES: Record<Exclude<CreditSheetRoute['view'], 'repay'>, string> = {
  'pick-loan': 'Repay which loan?',
  breakdown: 'What backs this loan',
  asset: '',
  'pick-asset': 'Unlock from this loan',
  unlock: '',
};

const routeKey = (route: CreditSheetRoute) => JSON.stringify(route);

const sameToken = (a: Address, b: Address) => a.toLowerCase() === b.toLowerCase();

interface CreditSheetProps {
  stack: CreditSheetRoute[];
  onStackChange: (stack: CreditSheetRoute[]) => void;
  details: CreditDetails;
  unlocks: Record<number, UnlockApi>;
}

/**
 * The Credit page's one sheet: every action on a loan or an asset, as steps that slide in and
 * back out — never two sheets stacked, which on native leaves two to back out of.
 */
const CreditSheet = ({ stack, onStackChange, details, unlocks }: CreditSheetProps) => {
  const isOpen = stack.length > 0;
  const route = stack[stack.length - 1];
  const hasLoanOn = (chainId: number) => details.loans.some(loan => loan.chainId === chainId);

  // Repay state is read only while the sheet is open, for the instances with a loan; the unlock
  // step reads its cash sources from it too.
  const fuseRepay = useLoanRepay(fuse.id, isOpen && hasLoanOn(fuse.id));
  const baseRepay = useLoanRepay(base.id, isOpen && hasLoanOn(base.id));
  const repays: Record<number, LoanRepay> = { [fuse.id]: fuseRepay, [base.id]: baseRepay };

  const push = useCallback(
    (next: CreditSheetRoute) => onStackChange([...stack, next]),
    [onStackChange, stack],
  );
  const back = useCallback(() => onStackChange(stack.slice(0, -1)), [onStackChange, stack]);
  const close = useCallback(() => onStackChange([]), [onStackChange]);

  // Each opening is a session. A signature that lands after its sheet was dismissed — and maybe
  // a new action opened — must not close what the cardholder is looking at now.
  const session = useRef(0);
  useEffect(() => {
    if (isOpen) session.current += 1;
  }, [isOpen]);
  const closeIfStill = useCallback(
    (started: number) => {
      if (session.current === started) close();
    },
    [close],
  );

  const submitUnlock = useCallback(
    async (
      chainId: number,
      token: Address,
      { quote, source }: { quote: UnlockQuote; source: UnlockSource | null },
    ) => {
      const started = session.current;
      const result = await unlocks[chainId]
        .request({
          token,
          amount: quote.amount,
          repay: !source
            ? { kind: 'none' }
            : source.kind === 'wallet'
              ? { kind: 'wallet', sourceId: source.id }
              : { kind: 'collateral', token: source.asset.token },
          confirmedRepayUsd: quote.repayUsd,
        })
        .catch(() => null);
      if (!result) return;
      const minutes = Math.max(
        1,
        Math.round((details.positions[chainId]?.params.collateralWithdrawDelay ?? 300) / 60),
      );
      const link = explorerTxUrl(chainId)(result.transactionHash);
      Toast.show({
        type: 'success',
        text1: `Unlocking ${assetName(quote.asset)}`,
        text2: `Ready to finish in about ${minutes} minutes.`,
        props: link ? { link, linkText: eclipseAddress(result.transactionHash) } : undefined,
      });
      closeIfStill(started);
    },
    [closeIfStill, details.positions, unlocks],
  );

  const render = (topPadding: number, presentation: CardSheetPresentation) => {
    if (!route) return null;

    if (route.view === 'repay') {
      const repay = repays[route.chainId];
      return (
        <RepaySheetContent
          state={repay.state}
          isLoading={repay.isLoading}
          isError={repay.isError}
          onRetry={repay.onRetry}
          onRepay={async request => {
            const started = session.current;
            const repaid = await repay.onRepay(request);
            if (repaid) closeIfStill(started);
            return repaid;
          }}
          isRepaying={repay.isRepaying}
          error={repay.error}
          onClearError={repay.onClearError}
          onBack={back}
          onDismiss={close}
          topPadding={topPadding}
          presentation={presentation}
          preferredSourceId={route.sourceId}
          startAtMax={route.full}
        />
      );
    }

    const loan =
      'chainId' in route
        ? details.loans.find(candidate => candidate.chainId === route.chainId)
        : undefined;
    const position = 'chainId' in route ? details.positions[route.chainId] : undefined;
    const unlock = 'chainId' in route ? unlocks[route.chainId] : undefined;
    const tenderNames = (chainId: number) =>
      joinNames([
        ...new Set(
          (repays[chainId]?.state?.sources ?? [])
            .filter(source => source.kind === 'wallet')
            .map(source => source.displaySymbol),
        ),
      ]).replace(' and ', ' or ') || 'cash';

    let title = TITLES[route.view];
    let body: ReactNode = null;

    switch (route.view) {
      case 'pick-loan':
        body = (
          <LoanPickerView
            loans={details.loans}
            format={details.format}
            onContinue={chainId => push({ view: 'repay', chainId })}
          />
        );
        break;
      case 'breakdown':
        body = loan ? (
          <BreakdownView
            loan={loan}
            format={details.format}
            onAsset={token => push({ view: 'asset', chainId: route.chainId, token })}
            onPayDown={token =>
              push({ view: 'repay', chainId: route.chainId, sourceId: `collateral:${token}` })
            }
            onRepay={() => push({ view: 'repay', chainId: route.chainId })}
          />
        ) : null;
        break;
      case 'asset': {
        const holding = position?.collateral.find(asset => sameToken(asset.token, route.token));
        title = holding ? assetName(holding) : 'Asset';
        body = holding ? (
          <AssetView
            holding={holding}
            loan={loan}
            format={details.format}
            now={details.now}
            tenderNames={tenderNames(route.chainId)}
            onUnlock={() => push({ view: 'unlock', chainId: route.chainId, token: route.token })}
            onPayDown={() =>
              push({ view: 'repay', chainId: route.chainId, sourceId: `collateral:${route.token}` })
            }
            onRepay={() => push({ view: 'repay', chainId: route.chainId })}
            onUnlockAll={async () => {
              if (!loan || !unlock) return;
              const started = session.current;
              const done = await unlock
                .withdrawAll(loan.assets.map(asset => asset.token))
                // The asset view has no error line of its own; a dismissed prompt resolves, so
                // only a real failure reaches this.
                .catch(error => {
                  void showErrorToast(error, { action: 'card_unlock' });
                  return null;
                });
              if (done) {
                Toast.show({
                  type: 'success',
                  text1: 'Unlocked',
                  text2: 'Everything locked is back in your wallet.',
                });
                closeIfStill(started);
              }
            }}
            isUnlockingAll={Boolean(unlock?.isWithdrawingAll)}
          />
        ) : (
          <Text className="text-center text-white/60">This asset isn’t held here anymore.</Text>
        );
        break;
      }
      case 'pick-asset':
        body =
          loan && position ? (
            <UnlockPickerView
              position={position}
              loan={loan}
              now={details.now}
              format={details.format}
              onPick={token => push({ view: 'unlock', chainId: route.chainId, token })}
            />
          ) : null;
        break;
      case 'unlock': {
        const asset = loan?.assets.find(candidate => sameToken(candidate.token, route.token));
        title = asset ? `Unlock ${assetName(asset)}` : 'Unlock';
        body =
          loan && position && asset && unlock ? (
            <UnlockView
              position={position}
              loan={loan}
              asset={asset}
              repayState={repays[route.chainId]?.state ?? null}
              isRepayLoading={Boolean(repays[route.chainId]?.isLoading)}
              isRepayError={Boolean(repays[route.chainId]?.isError)}
              onRetryRepay={() => repays[route.chainId]?.onRetry()}
              now={details.now}
              format={details.format}
              error={unlock.error}
              isSubmitting={unlock.isRequesting}
              onSubmit={input => void submitUnlock(route.chainId, route.token, input)}
              onRepayInFull={() => push({ view: 'repay', chainId: route.chainId, full: true })}
            />
          ) : (
            <Text className="text-center text-white/60">Nothing of this is locked anymore.</Text>
          );
        break;
      }
    }

    return (
      <SheetBody presentation={presentation} topPadding={topPadding}>
        <SheetHeader
          title={title}
          onBack={stack.length > 1 ? back : undefined}
          onClose={close}
          presentation={presentation}
        />
        {body}
      </SheetBody>
    );
  };

  return (
    <CardBottomSheet
      isOpen={isOpen}
      onOpenChange={open => (open ? undefined : close())}
      contentKey="credit-actions"
      designTop={36}
      designBottom={40}
      scrollable
    >
      {({ topPadding, presentation = 'sheet' }) => (
        <View style={{ overflow: 'hidden' }}>
          {route ? (
            <Animated.View key={routeKey(route)} entering={FadeIn.duration(180)}>
              {render(topPadding, presentation)}
            </Animated.View>
          ) : null}
        </View>
      )}
    </CardBottomSheet>
  );
};

export type { CardRepayChainId };
export default CreditSheet;
