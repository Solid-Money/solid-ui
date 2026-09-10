import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { router } from 'expo-router';
import { Eye } from 'lucide-react-native';

import EditSpendLimitStep, {
  SpendLimitField,
} from '@/components/Card/NewCardDetails/EditSpendLimitStep';
import ManageCardStep from '@/components/Card/NewCardDetails/ManageCardStep';
import SpendingLimitsStep from '@/components/Card/NewCardDetails/SpendingLimitsStep';
import ResponsiveModal from '@/components/ResponsiveModal';
import { Text } from '@/components/ui/text';
import { formatUsd, onChainToUsd, usdToOnChain } from '@/constants/cardSpendModule';
import { DigitalWalletType } from '@/constants/digital-wallet';
import { CARD_WITHDRAW_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import {
  CardSpendRegistrationSource,
  useCardSpendRegistration,
} from '@/hooks/useCardSpendRegistration';
import { useWirexThreeDs } from '@/hooks/useWirexThreeDs';
import { useCardWithdrawStore } from '@/store/useCardWithdrawStore';

/** Where in the sheet the user is. */
type SheetStep = 'root' | 'limits' | 'edit';

/**
 * Depth of each step, which is all `ResponsiveModal` needs to animate the right way
 * round. `close` is the resting value, and is what suppresses the animation on the
 * first render after opening.
 */
const STEP_DEPTH: Record<SheetStep | 'close', number> = { close: 0, root: 1, limits: 2, edit: 3 };

interface ManageCardSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * What opened the sheet. Reported on the registration funnel, and `card_reveal` also
   * decides whether the sheet explains itself: that entry point went looking for the card
   * number and got this instead.
   */
  source?: CardSpendRegistrationSource;
  /**
   * Opens the add-to-wallet guide on the wallet named. Owned by the pane above, because
   * that guide is its own dialog and two portalled sheets cannot be open at once.
   */
  onAddToWallet?: (wallet: DigitalWalletType) => void;
  canWithdraw?: boolean;
}

/**
 * Managing a Wirex card backed by `SolidCashModule`: its spending limits, the wallet
 * guide, and the 3DS approvals queue.
 *
 * ## What the user is agreeing to
 *
 * A Wirex card holds no balance. Wirex pays the merchant and our backend debits the
 * user's Safe afterwards — USDC first, then USDT, then soUSD — so what they hold *is*
 * their card balance. To make that possible they enable a Safe module and register
 * spending limits: one signature covering both, because `registerSafe` and
 * `Safe.enableModule` each require the Safe itself as sender.
 *
 * This is a bigger grant than the ERC-20 allowance flow it replaced, so
 * `CardSpendConsentNotice` says so plainly wherever the next press signs it.
 *
 * ## Why there is no separate setup screen
 *
 * There used to be one, offering four preset caps and its own consent copy, and it was
 * the first thing a cardholder without the module saw. It has gone: an unregistered Safe
 * simply has caps of zero, so the limits screen shows $0 and naming a daily limit there is
 * the press that registers the Safe and enables the module. Setting a limit and changing
 * one are the same question, and asking it on two screens meant two places for the copy,
 * the validation and the ceilings to drift apart.
 *
 * The rolling windows reset on a timezone offset that is written once and has no setter,
 * so it is read from the device rather than asked for — a permanent answer to a question
 * the user cannot usefully answer.
 *
 * ## Why a limit change reads as one thing
 *
 * The contract still treats the two directions differently — lowering a cap shrinks the
 * module's authority and lands immediately, while raising one only *arms*, maturing after
 * `limitRaiseDelay` — but that delay is configured at zero, so a raise is in force by the
 * next block. There is therefore nothing to warn about and no wait to explain, and the
 * sheet says a limit changed because it did. If ops ever sets a non-zero delay, this is
 * the copy that has to come back: see `pendingIncrease` and `cancelPendingIncrease` on
 * {@link useCardSpendRegistration}, which stay in place for exactly that.
 *
 * ## Why it is controlled from outside
 *
 * Two things open this sheet: the card action row's "Manage"/"Set up" button, and a
 * blocked "Show details" tap — the card's numbers are worth nothing while the module
 * cannot debit the Safe. So the open state and the single instance live on the pane above
 * both, which is also what keeps the sheet reachable when the action row hides its button
 * and a blocked reveal still needs somewhere to send the user.
 */
const ManageCardSheet = ({
  isOpen,
  onOpenChange,
  source = 'spending_sheet',
  onAddToWallet,
  canWithdraw = false,
}: ManageCardSheetProps) => {
  // One piece of state so the step and the step it came from can never disagree about
  // which way the sheet is travelling.
  const [nav, setNav] = useState<{ step: SheetStep; from: SheetStep | 'close' }>({
    step: 'root',
    from: 'close',
  });
  const [editField, setEditField] = useState<SpendLimitField>('daily');
  const {
    isAvailable,
    registration,
    isRegistered,
    isPaused,
    isRegistering,
    isUpdatingLimit,
    isDisabling,
    isLoading: isLoadingRegistration,
    refetch,
    limit,
    error,
    register,
    updateLimit,
    disable,
  } = useCardSpendRegistration();
  // Read here as well as on the action row: the count is what makes an approvals queue
  // worth a row, and a challenge whose push never arrived is otherwise invisible.
  const { requests: threeDsRequests } = useWirexThreeDs();
  const setWithdrawModal = useCardWithdrawStore(state => state.setModal);

  const isBusy = isRegistering || isUpdatingLimit || isDisabling;
  // Registration is permanent and module consent is not, so these two are independent and
  // the sheet needs both: the first decides whether there are stored caps to move, the
  // second whether the card can actually spend.
  const isRegisteredOnChain = registration?.registeredOnChain === true;
  const isModuleEnabled = registration?.moduleEnabled === true;

  const goTo = useCallback(
    (next: SheetStep) => setNav(current => ({ step: next, from: current.step })),
    [],
  );

  const closeSheet = useCallback(() => {
    onOpenChange(false);
    setNav({ step: 'root', from: 'close' });
  }, [onOpenChange]);

  /**
   * The caps to render the limits screens from, or null while the one on-chain read is
   * still in flight or has failed.
   *
   * Deliberately not gated on being registered: an unregistered Safe's caps are zeros,
   * and those zeros are exactly what the limits screen shows before setup.
   */
  const liveLimit = registration ? limit : null;
  const step: SheetStep = liveLimit ? nav.step : 'root';

  const handleConfirmLimit = async (next: { dailyLimitUsd: number; monthlyLimitUsd: number }) => {
    // Whichever row was edited is the number to name back.
    const changed = editField === 'daily' ? next.dailyLimitUsd : next.monthlyLimitUsd;
    const period = editField === 'daily' ? 'a day' : 'a month';

    try {
      if (!isRegisteredOnChain) {
        // Nothing is stored yet, so this is not an edit: `registerSafe` writes both caps
        // and `enableModule` turns the module on, batched into the one signature.
        if (!(await register(next.dailyLimitUsd, source, next.monthlyLimitUsd))) return;
        Toast.show({
          type: 'success',
          text1: 'Card spending is set up',
          text2: `Your card can spend up to ${formatUsd(
            usdToOnChain(next.dailyLimitUsd),
          )} a day from savings.`,
          props: { badgeText: '' },
        });
        goTo('limits');
        return;
      }

      // Only the edited cap. The other half of `next` is the stored value untouched, so
      // sending it would be a no-op — but leaving it out is what tells the hook which cap
      // the user was working on, and that decides which one a refusal names.
      const result = await updateLimit(
        editField === 'daily'
          ? { dailyLimitUsd: next.dailyLimitUsd }
          : { monthlyLimitUsd: next.monthlyLimitUsd },
      );
      // Null means the signature prompt was dismissed and the caps did not move.
      if (!result) return;
      Toast.show({
        type: 'success',
        text1: editField === 'daily' ? 'Daily limit updated' : 'Monthly limit updated',
        text2: `Your card can spend up to ${formatUsd(usdToOnChain(changed))} ${period}.`,
        props: { badgeText: '' },
      });
      // Back to the limits screen rather than out of the sheet: the change is visible
      // there, which is the confirmation that matters more than the toast.
      goTo('limits');
    } catch {
      // `error` from the hook renders in the sheet; the user stays here to retry.
    }
  };

  /**
   * Put the module back on a Safe that registered and then revoked.
   *
   * The stored caps are untouched by a revocation, so nothing is being chosen here and
   * `register` sends only `enableModule` — the daily figure it takes is ignored on this
   * path (`registerSafe` would revert `AlreadyRegistered`) and is passed for the funnel.
   */
  const handleEnable = async () => {
    if (!liveLimit) return;
    try {
      // False means the user dismissed the signature prompt — nothing was enabled, so
      // saying spending is back on would be a lie. Leave the sheet open and say nothing.
      if (!(await register(onChainToUsd(liveLimit.dailyLimitUsd), source))) return;
      Toast.show({
        type: 'success',
        text1: 'Card spending re-enabled',
        text2: `Your card can spend up to ${formatUsd(liveLimit.dailyLimitUsd)} a day again.`,
        props: { badgeText: '' },
      });
    } catch {
      // `error` from the hook renders in the sheet; the user stays here to retry.
    }
  };

  const handleDisable = async () => {
    try {
      // False means the signature prompt was dismissed — the module is still enabled and
      // the card still spends, so the sheet stays as it was.
      if (!(await disable())) return;
      Toast.show({
        type: 'success',
        text1: 'Card spending is off',
        text2: 'Your card will decline until you turn it back on. Your limits are saved.',
        props: { badgeText: '' },
      });
    } catch {
      // `error` from the hook renders in the sheet; the user stays here to retry.
    }
  };

  // Both of these hand the user to something else, and this sheet is portalled — left
  // open it would float over whatever it sent them to.
  const handleApprovals = () => {
    closeSheet();
    router.push(path.CARD_3DS);
  };

  const handleAddToWallet = (wallet: DigitalWalletType) => {
    closeSheet();
    onAddToWallet?.(wallet);
  };

  const handleWithdraw = () => {
    closeSheet();
    setWithdrawModal(CARD_WITHDRAW_MODAL.OPEN_FORM);
  };

  const openEdit = (field: SpendLimitField) => {
    setEditField(field);
    goTo('edit');
  };

  const title =
    step === 'limits'
      ? 'Spending limits'
      : step === 'edit'
        ? `Edit ${editField} card limit`
        : 'Manage card';

  const goBack =
    step === 'limits' ? () => goTo('root') : step === 'edit' ? () => goTo('limits') : undefined;

  return (
    <ResponsiveModal
      currentModal={{ name: step, number: STEP_DEPTH[step] }}
      previousModal={{ name: nav.from, number: STEP_DEPTH[nav.from] }}
      isOpen={isOpen}
      onOpenChange={open => {
        if (open) onOpenChange(true);
        else closeSheet();
      }}
      trigger={null}
      title={title}
      contentKey={step}
      compactHeader
      showBackButton={goBack !== undefined}
      onBackPress={goBack}
      contentClassName="md:max-w-[420px]"
    >
      <View className="gap-4">
        {isAvailable && isPaused ? (
          <View className="rounded-2xl bg-[#2A2119] p-4">
            <Text className="text-sm text-[#E8A33D]">
              Card spending is paused on your account right now. Please contact support.
            </Text>
          </View>
        ) : null}

        {/* Everything below is one on-chain read, and a blocked reveal is sent here — so
            neither waiting for that read nor failing it may leave the user staring at a
            disabled button with nothing to act on. */}
        {isAvailable && isLoadingRegistration ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator size="small" color="#ACACAC" />
            <Text className="text-sm text-[#ACACAC]">Checking your card spending…</Text>
          </View>
        ) : null}

        {isAvailable && !registration && !isLoadingRegistration ? (
          <View className="flex-row items-center gap-3 rounded-2xl bg-[#2A2119] p-4">
            <Text className="flex-1 text-sm text-[#E8A33D]">
              Could not read your card spending settings.
            </Text>
            <Pressable onPress={() => void refetch()}>
              <Text className="text-sm font-semibold text-white underline">Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {isAvailable && error ? <Text className="text-sm text-red-400">{error}</Text> : null}

        {/* Why the user is looking at a card sheet when they asked for their card number.
            Only while that is still the reason: once spending is on, the reveal works. */}
        {isAvailable && source === 'card_reveal' && !isRegistered ? (
          <View className="flex-row gap-2 rounded-2xl bg-[#252525] p-4">
            <Eye size={18} color="#94F27F" style={styles.noticeIcon} />
            <Text className="flex-1 text-sm leading-snug text-[#ACACAC]">
              Your card number, expiry and security code stay hidden until the card can spend. Set a
              daily limit to see them — until then every payment would be declined anyway.
            </Text>
          </View>
        ) : null}

        {liveLimit && registration && step === 'limits' ? (
          <SpendingLimitsStep
            limit={liveLimit}
            isRegisteredOnChain={isRegisteredOnChain}
            isModuleEnabled={isModuleEnabled}
            isPaused={isPaused}
            isEnabling={isRegistering}
            isDisabling={isDisabling}
            isBusy={isBusy}
            onEditDaily={() => openEdit('daily')}
            onEditMonthly={() => openEdit('monthly')}
            onEnable={handleEnable}
            onDisable={handleDisable}
          />
        ) : liveLimit && registration && step === 'edit' ? (
          <EditSpendLimitStep
            field={editField}
            limit={liveLimit}
            ceilings={registration}
            willEnableSpending={!isRegisteredOnChain}
            isSubmitting={isRegistering || isUpdatingLimit}
            onConfirm={handleConfirmLimit}
          />
        ) : (
          <ManageCardStep
            onEditLimit={() => goTo('limits')}
            onAddToWallet={handleAddToWallet}
            onApprovals={handleApprovals}
            approvalsCount={threeDsRequests.length}
            showSpendControls={isAvailable}
            onWithdraw={canWithdraw ? handleWithdraw : undefined}
          />
        )}
      </View>
    </ResponsiveModal>
  );
};

const styles = StyleSheet.create({
  noticeIcon: { marginTop: 1 },
});

export default ManageCardSheet;
