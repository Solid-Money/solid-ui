import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { BankAccountDetailsView } from '@/components/DepositOption/VirtualAccountDetails/BankAccountDetailsView';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useActivateWirexBankAccount, useWirexBankOverview } from '@/hooks/useWirexBankAccounts';
import { useWirexWalletLink } from '@/hooks/useWirexWalletLink';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { WirexBankAccountType, WirexBankRailStatusDto } from '@/lib/types/wirex-bank';
import { cn } from '@/lib/utils';

import {
  detailRows,
  RAIL_PRESENTATION,
  selectActiveRail,
  unavailableReason,
  visibleRails as pickVisibleRails,
} from './railPresentation';

/** EUR / USD segmented control, shown only when the user has both rails. */
const RailSwitcher = ({
  rails,
  selected,
  onSelect,
}: {
  rails: WirexBankRailStatusDto[];
  selected: WirexBankAccountType;
  onSelect: (accountType: WirexBankAccountType) => void;
}) => (
  <View style={styles.switcher} className="mt-5 flex-row self-center rounded-full bg-card">
    {rails.map(rail => {
      const isSelected = rail.accountType === selected;
      return (
        <Pressable
          key={rail.accountType}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          onPress={() => onSelect(rail.accountType)}
          style={styles.switcherOption}
          className={cn('rounded-full', isSelected && 'bg-white/10')}
        >
          <Text
            className={cn('text-[15px] font-medium', isSelected ? 'text-white' : 'text-white/50')}
          >
            {RAIL_PRESENTATION[rail.accountType].label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

/**
 * What to show for a rail that has no requisites yet.
 *
 * Three distinct states, and conflating them is the failure mode worth avoiding:
 * "activate" is a button, "provisioning" is a wait with no action, and
 * "unavailable" is a dead end that must not offer either.
 */
const RailPlaceholder = ({
  rail,
  onActivate,
  isActivating,
}: {
  rail: WirexBankRailStatusDto;
  onActivate: () => void;
  isActivating: boolean;
}) => {
  const { label } = RAIL_PRESENTATION[rail.accountType];

  if (rail.isPending) {
    return (
      <View className="flex-1 items-center justify-center gap-4 py-16">
        <ActivityIndicator />
        <Text className="text-center text-base text-white">Setting up your {label} account</Text>
        <Text className="max-w-[280px] text-center text-sm text-white/60">
          Your bank details usually arrive within a few minutes. You can close this and come back.
        </Text>
      </View>
    );
  }

  if (rail.canActivate) {
    // The wallet-link path raises a passkey prompt to prove wallet ownership to
    // Wirex's external provider, so the button says so rather than promising
    // details that a signature stands between the user and.
    const needsSignature = rail.activationPath === 'walletLink';

    return (
      <View className="flex-1 items-center justify-center gap-4 py-16">
        <Text className="text-center text-lg font-medium text-white">Open a {label} account</Text>
        <Text className="max-w-[300px] text-center text-sm text-white/60">
          {RAIL_PRESENTATION[rail.accountType].blurb}.
          {needsSignature ? ' You will be asked to confirm with your wallet.' : ''}
        </Text>
        <Button
          variant="brand"
          className="mt-2 h-12 rounded-full border-0 px-8"
          onPress={onActivate}
          disabled={isActivating}
        >
          {isActivating ? (
            <ActivityIndicator color="#000" />
          ) : needsSignature ? (
            <Text className="text-base font-semibold text-black">Verify wallet</Text>
          ) : (
            <Text className="text-base font-semibold text-black">Get {label} details</Text>
          )}
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center gap-3 py-16">
      <Text className="text-center text-base text-white">
        {label} accounts aren&apos;t available for you yet
      </Text>
      <Text className="max-w-[300px] text-center text-sm text-white/60">
        {unavailableReason(rail.capabilityStatus, label)}
      </Text>
    </View>
  );
};

export interface WirexBankAccountDetailsProps {
  /** Which rail to open on. Defaults to the first one with real requisites. */
  initialAccountType?: WirexBankAccountType;
  /** Rendered under the details card — the "Send" entry point, when there is one. */
  renderFooter?: (rail: WirexBankRailStatusDto) => React.ReactNode;
}

/**
 * The user's Wirex bank details — a EUR SEPA IBAN, a USD ACH account, or both.
 *
 * Renders through {@link BankAccountDetailsView}, the same shell the Rain USD
 * virtual account uses, so the two are visually identical; only the flag, the
 * copy and the rows differ.
 */
export const WirexBankAccountDetails = ({
  initialAccountType,
  renderFooter,
}: WirexBankAccountDetailsProps = {}) => {
  const { data: overview, isLoading, refetch } = useWirexBankOverview();
  const activate = useActivateWirexBankAccount();
  const walletLink = useWirexWalletLink();
  const [selected, setSelected] = useState<WirexBankAccountType | null>(initialAccountType ?? null);

  /** Rails worth showing at all — an unavailable one with no account is noise. */
  const visibleRails = useMemo(() => pickVisibleRails(overview), [overview]);

  /**
   * The rail on screen: the user's choice, else the first with usable
   * requisites, else the first visible one. Preferring a receivable rail means
   * a user with one live account and one still provisioning opens on the live
   * one.
   */
  const activeRail = useMemo(
    () => selectActiveRail(visibleRails, selected),
    [selected, visibleRails],
  );

  useEffect(() => {
    if (isLoading || !activeRail) return;
    track(
      activeRail.account?.canReceive
        ? TRACKING_EVENTS.VIRTUAL_ACCOUNT_DETAILS_VIEWED
        : TRACKING_EVENTS.VIRTUAL_ACCOUNT_DETAILS_LOAD_FAILED,
      { provider: 'wirex', rail: activeRail.accountType },
    );
  }, [activeRail, isLoading]);

  /**
   * Start activation down whichever path the capability calls for.
   *
   * Wirex rejects the wrong one with a 400 — the plain call when the capability
   * wants wallet verification, and vice versa — so the path is read off the
   * rail rather than assumed.
   */
  const handleActivate = useCallback(() => {
    if (!activeRail) return;
    track(TRACKING_EVENTS.VIRTUAL_ACCOUNT_APPLY_PRESSED, {
      provider: 'wirex',
      rail: activeRail.accountType,
      activation_path: activeRail.activationPath,
    });

    if (activeRail.activationPath === 'walletLink') {
      void walletLink.link();
      return;
    }

    activate.mutate(activeRail.accountType);
  }, [activeRail, activate, walletLink]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <ActivityIndicator />
      </View>
    );
  }

  // No Wirex customer, or no rail this user could ever open — either way there
  // is nothing here, and the caller decides where to send them next.
  if (!overview?.isWirexUser || !activeRail) {
    return (
      <View className="flex-1 items-center justify-center gap-4 py-12">
        <Text className="text-center text-base text-white">
          {overview?.isWirexUser
            ? 'No bank accounts are available for you yet.'
            : 'Complete identity verification to open a bank account.'}
        </Text>
        <Button className="h-12 rounded-2xl px-6" onPress={() => void refetch()}>
          <Text className="text-base font-bold text-black">Try again</Text>
        </Button>
      </View>
    );
  }

  // The wallet-link hook explains its own failures (a wrong wallet, a cancelled
  // passkey prompt); plain activation has no such detail to offer.
  const activationError =
    walletLink.error ?? (activate.isError ? 'Could not open the account. Please try again.' : null);

  const presentation = RAIL_PRESENTATION[activeRail.accountType];
  const switcher =
    visibleRails.length > 1 ? (
      <RailSwitcher rails={visibleRails} selected={activeRail.accountType} onSelect={setSelected} />
    ) : null;

  // Requisites not issued yet — the switcher stays so the user can reach their
  // other rail without backing out.
  if (!activeRail.account?.canReceive) {
    return (
      <View className="flex-1">
        {switcher}
        <RailPlaceholder
          rail={activeRail}
          onActivate={handleActivate}
          isActivating={activate.isPending || walletLink.isLinking}
        />
        {activationError ? (
          <Text className="px-6 pb-4 text-center text-sm text-red-400">{activationError}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <BankAccountDetailsView
      flag={getAsset(presentation.flag)}
      title={presentation.title}
      blurb={presentation.blurb}
      rows={detailRows(activeRail)}
      header={switcher}
      footer={renderFooter?.(activeRail)}
      // The field name says whether the user is being paid or setting up a
      // standing order; the value itself is never sent.
      onCopyField={field =>
        track(TRACKING_EVENTS.VIRTUAL_ACCOUNT_DETAIL_COPIED, {
          field,
          provider: 'wirex',
          rail: activeRail.accountType,
        })
      }
    />
  );
};

const styles = StyleSheet.create({
  switcher: { padding: 4 },
  switcherOption: { paddingHorizontal: 26, paddingVertical: 8 },
});
