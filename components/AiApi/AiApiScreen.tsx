import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, router } from 'expo-router';

import LazyDepositOptionModal from '@/components/DepositOption/LazyDepositOptionModal';
import PageLayout from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useAiApiOverview } from '@/hooks/useAiApi';
import { track } from '@/lib/analytics';
import { useAiApiRevealStore } from '@/store/useAiApiRevealStore';
import { useDepositStore } from '@/store/useDepositStore';

import AiApiCreateKeySheet from './AiApiCreateKeySheet';
import AiApiDashboard from './AiApiDashboard';
import AiApiHeader, { AiApiInfoButton } from './AiApiHeader';
import AiApiIntro from './AiApiIntro';
import AiApiKeySheet, { type AiApiKeySheetView } from './AiApiKeySheet';

import type { AiApiKey } from '@/lib/types/ai-api';

const LoadingState = () => (
  <View className="gap-3 px-4">
    <Skeleton className="h-[120px] w-full rounded-[20px] bg-card" />
    <Skeleton className="h-[150px] w-full rounded-[20px] bg-card" />
    <Skeleton className="h-[200px] w-full rounded-[20px] bg-card" />
  </View>
);

/**
 * The AI API, reached from its card in "Your tier benefits": what it is until
 * the user has a key (Figma 2), then their keys, spend and cashback (Figma 6).
 *
 * The new key is never kept in this screen's state or in the route: it goes
 * from the create sheet to the key-ready screen through an in-memory store
 * that screen clears when it closes.
 */
export default function AiApiScreen() {
  const { data: overview, isLoading, isError, refetch, isRefetching } = useAiApiOverview();
  const reveal = useAiApiRevealStore(state => state.reveal);
  const setDepositModal = useDepositStore(state => state.setModal);
  const setWalletDeposit = useDepositStore(state => state.setWalletDeposit);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isKeySheetOpen, setIsKeySheetOpen] = useState(false);
  const [keySheetView, setKeySheetView] = useState<AiApiKeySheetView>('details');
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  /** "How it works" from the dashboard: the intro again, over the dashboard. */
  const [isIntroOpen, setIsIntroOpen] = useState(false);

  // Read from the latest overview, so the sheet shows a rename or a new limit
  // as soon as it is saved, and closes if the key is gone.
  const selectedKey = overview?.keys.find(key => key.id === selectedKeyId) ?? null;

  const openKey = (key: AiApiKey, view: AiApiKeySheetView = 'details') => {
    setSelectedKeyId(key.id);
    setKeySheetView(view);
    setIsKeySheetOpen(true);
  };

  const openCreate = () => {
    track(TRACKING_EVENTS.AI_API_GET_KEY_PRESSED, { key_count: overview?.keys.length ?? 0 });
    setIsCreateOpen(true);
  };

  const openSetup = () => {
    setIsKeySheetOpen(false);
    router.push(path.AI_API_SETUP);
  };

  const handleCreated = (secret: string, name: string) => {
    setIsCreateOpen(false);
    setIsIntroOpen(false);
    reveal(secret, name);
    router.push(path.AI_API_KEY);
  };

  let body;
  if (isLoading) {
    body = <LoadingState />;
  } else if (isError || !overview) {
    body = (
      <View className="items-center gap-4 px-4 py-12">
        <Text className="text-center text-[15px] text-white/60">
          We couldn’t load your AI API right now.
        </Text>
        <Button
          variant="secondary"
          onPress={() => refetch()}
          disabled={isRefetching}
          className="h-12 rounded-full px-6"
        >
          {isRefetching ? <ActivityIndicator size="small" color="white" /> : null}
          <Text className="text-[16px] font-bold text-white">Try again</Text>
        </Button>
      </View>
    );
  } else if (!overview.available && overview.keys.length === 0) {
    // Only reachable from a stale link: the Rewards card that opens this
    // screen is hidden for anyone it isn't open to.
    return <Redirect href={path.REWARDS} />;
  } else {
    const hasKeys = overview.keys.length > 0;
    const canCreateKey = overview.available && overview.keys.length < overview.maxKeys;
    body =
      !hasKeys || isIntroOpen ? (
        <AiApiIntro
          cashbackRate={overview.cashbackRate}
          cashbackTier={overview.cashbackTier}
          cashbackMonthlyCapUsd={overview.cashbackMonthlyCapUsd}
          settlementDays={overview.cashbackSettlementDays}
          modelCount={overview.models.length}
          ctaLabel={hasKeys ? 'New key' : 'Get API key'}
          onCta={canCreateKey ? openCreate : undefined}
        />
      ) : (
        <AiApiDashboard
          overview={overview}
          canCreateKey={canCreateKey}
          onOpenKey={openKey}
          onNewKey={openCreate}
          onOpenSetup={openSetup}
          onOpenHowItWorks={() => setIsIntroOpen(true)}
          onAddFunds={() => {
            // Straight to the address that funds AI API charges — USDC on the
            // billing chain, Base — rather than the deposit chooser, whose
            // default lands money in savings, which a charge cannot draw on.
            setWalletDeposit({
              symbol: 'USDC',
              chainId: overview.billing.chainId,
              isChangingToken: false,
            });
            setDepositModal(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
          }}
        />
      );
  }

  const showsDashboard = !!overview?.keys.length && !isIntroOpen;

  return (
    <PageLayout
      desktopOnly
      onRefresh={() => refetch()}
      refreshing={isRefetching && !isLoading}
      additionalContent={
        overview ? (
          <>
            <AiApiCreateKeySheet
              isOpen={isCreateOpen}
              onOpenChange={setIsCreateOpen}
              limitOptions={overview.limitOptionsUsd}
              maxLimitUsd={overview.maxMonthlyLimitUsd}
              cashbackRate={overview.cashbackRate}
              walletBalanceUsd={overview.billing.walletBalanceUsd}
              billingTokens={overview.billing.billingTokens}
              onCreated={handleCreated}
            />
            <AiApiKeySheet
              isOpen={isKeySheetOpen}
              onOpenChange={setIsKeySheetOpen}
              view={keySheetView}
              onViewChange={setKeySheetView}
              apiKey={selectedKey}
              limitOptions={overview.limitOptionsUsd}
              maxLimitUsd={overview.maxMonthlyLimitUsd}
              resetsAt={overview.month.resetsAt}
              onOpenSetupGuide={openSetup}
            />
            <LazyDepositOptionModal trigger={null} />
          </>
        ) : null
      }
    >
      <View className="mx-auto w-full max-w-lg gap-4 pb-32 pt-6 md:py-12">
        <AiApiHeader
          title="AI API"
          onBack={isIntroOpen && overview?.keys.length ? () => setIsIntroOpen(false) : undefined}
          right={showsDashboard ? <AiApiInfoButton onPress={() => setIsIntroOpen(true)} /> : null}
        />
        {body}
      </View>
    </PageLayout>
  );
}
