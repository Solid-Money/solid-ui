import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { BankAccountDetailsView } from '@/components/DepositOption/VirtualAccountDetails/BankAccountDetailsView';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Country } from '@/constants/countries';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useConfirmResidence } from '@/hooks/useConfirmResidence';
import { useActivateWirexBankAccount, useWirexBankOverview } from '@/hooks/useWirexBankAccounts';
import { useWirexWalletLink } from '@/hooks/useWirexWalletLink';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { WirexBankAccountType, WirexBankRailStatusDto } from '@/lib/types/wirex-bank';
import { cn } from '@/lib/utils';
import { useCountryStore } from '@/store/useCountryStore';
import { useDepositStore } from '@/store/useDepositStore';
import { useKycStore } from '@/store/useKycStore';

import {
  detailRows,
  RAIL_PRESENTATION,
  selectActiveRail,
  unavailableRail,
  unavailableReason,
  visibleRails as pickVisibleRails,
} from './railPresentation';
import { WirexResidenceStep } from './WirexResidenceStep';

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
  const router = useRouter();
  const setModal = useDepositStore(state => state.setModal);
  const countrySource = useCountryStore(state => state.countryInfo?.source);
  const [selected, setSelected] = useState<WirexBankAccountType | null>(initialAccountType ?? null);
  const [isAskingResidence, setIsAskingResidence] = useState(false);
  const { confirmResidence: confirmResidenceCountry, isConfirming: isConfirmingResidence } =
    useConfirmResidence();

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
      {
        provider: 'wirex',
        rail: activeRail.accountType,
        capability_status: activeRail.capabilityStatus,
        activation_path: activeRail.activationPath,
        is_pending: activeRail.isPending,
      },
    );
  }, [activeRail, isLoading]);

  /**
   * A Wirex user with nothing they can open. Shown with Wirex's own reason
   * rather than a generic line, and tracked with it, so a stuck user can be
   * explained from analytics as well as from the server's `[WirexVA]` log.
   */
  const closedRail = useMemo(
    () =>
      overview?.isWirexUser && overview.provider === 'wirex' && !overview.kycRequired
        ? unavailableRail(overview)
        : null,
    [overview],
  );
  const closedStatus = closedRail?.capabilityStatus;
  const closedType = closedRail?.accountType;
  useEffect(() => {
    if (isLoading || !closedType) return;
    track(TRACKING_EVENTS.VIRTUAL_ACCOUNT_UNAVAILABLE, {
      provider: 'wirex',
      rail: closedType,
      capability_status: closedStatus,
    });
  }, [closedStatus, closedType, isLoading]);

  /**
   * Start activation down whichever path the capability calls for.
   *
   * Wirex rejects the wrong one with a 400 — the plain call when the capability
   * wants wallet verification, and vice versa — so the path is read off the
   * rail rather than assumed.
   */
  const handleActivate = useCallback(() => {
    if (!activeRail) return;
    const context = {
      provider: 'wirex',
      rail: activeRail.accountType,
      activation_path: activeRail.activationPath,
    };
    track(TRACKING_EVENTS.VIRTUAL_ACCOUNT_APPLY_PRESSED, context);

    // Both outcomes are tracked with the rail Wirex left behind, so a user who
    // pressed the button and is still without an IBAN shows why.
    const tracked = (rail: WirexBankRailStatusDto | null | undefined, error?: unknown) =>
      track(
        rail
          ? TRACKING_EVENTS.VIRTUAL_ACCOUNT_CREATED
          : TRACKING_EVENTS.VIRTUAL_ACCOUNT_CREATION_FAILED,
        {
          ...context,
          ...(rail && {
            capability_status: rail.capabilityStatus,
            is_pending: rail.isPending,
            can_receive: !!rail.account?.canReceive,
          }),
          ...(error !== undefined && {
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      );

    if (activeRail.activationPath === 'walletLink') {
      void walletLink.link().then(({ rail, error }) => tracked(rail, error ?? undefined));
      return;
    }

    activate.mutate(activeRail.accountType, {
      onSuccess: rail => tracked(rail),
      onError: error => tracked(null, error),
    });
  }, [activeRail, activate, walletLink]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <ActivityIndicator />
      </View>
    );
  }

  /**
   * Send the user into Sumsub for the virtual account.
   *
   * `kycFlow` is what tells the session which product asked, and it decides two
   * things the card flow gets wrong here: the backend gates the Wirex claim on
   * the bank country lists rather than the card list, and the user is returned
   * to this screen afterwards instead of a card page.
   *
   * The deposit modal is closed first — the KYC screen is a route, and leaving a
   * modal open over it strands the user behind it on return.
   */
  function startVerification() {
    track(TRACKING_EVENTS.VIRTUAL_ACCOUNT_KYC_REQUIRED, { provider: 'wirex' });
    useKycStore.getState().setKycFlow('va');
    setModal(DEPOSIT_MODAL.CLOSE);
    router.push(path.SUMSUB_KYC as never);
  }

  /**
   * The server picked Wirex from where the app thinks the user is, and Sumsub
   * will not start on that guess. Asked only until the user has named their
   * country by hand — that answer is what the session is sent.
   */
  const needsResidence = !!overview?.residenceRequired && countrySource !== 'manual';

  function handleVerifyPress() {
    if (needsResidence) {
      setIsAskingResidence(true);
      return;
    }
    startVerification();
  }

  /**
   * Record where they live, then re-ask routing on it: an IBAN country goes on
   * to Sumsub, anywhere else gets the Rain account pitch instead.
   */
  async function confirmResidence(country: Country) {
    const routed = await confirmResidenceCountry(country);
    if (!routed) return;
    setIsAskingResidence(false);
    if (routed === 'wirex') {
      startVerification();
      return;
    }
    setModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_APPLY);
  }

  if (isAskingResidence) {
    return <WirexResidenceStep onConfirm={confirmResidence} isConfirming={isConfirmingResidence} />;
  }

  // Wirex serves this user's country but they have never verified. The button
  // starts that, rather than offering "Try again" on a lookup that is not
  // failing — refetching would return the same answer forever.
  if (overview?.kycRequired) {
    return (
      <View className="flex-1 items-center justify-center gap-4 py-12">
        <Text className="text-center text-base text-white">
          Verify your identity to open your euro account.
        </Text>
        <Text className="px-8 text-center text-sm text-white/60">
          You will need a photo ID and a proof of address. It is the same check as the Solid card,
          so you only do it once.
        </Text>
        <Button className="h-12 rounded-2xl px-6" onPress={handleVerifyPress}>
          <Text className="text-base font-bold text-black">Verify identity</Text>
        </Button>
      </View>
    );
  }

  // A Wirex user Wirex will not open an account for yet: say why, in Wirex's
  // terms, instead of "No bank accounts are available". The status can change
  // on Wirex's side (support finishing a verification level), so the check
  // stays one tap away.
  if (closedRail) {
    return (
      <View className="flex-1">
        <RailPlaceholder rail={closedRail} onActivate={handleActivate} isActivating={false} />
        <Button
          variant="outline"
          className="mx-auto mb-6 h-12 rounded-2xl px-6"
          onPress={() => void refetch()}
        >
          <Text className="text-base font-semibold text-white">Check again</Text>
        </Button>
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
