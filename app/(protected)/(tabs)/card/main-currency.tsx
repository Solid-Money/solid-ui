import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';

import AddEurcBanner from '@/components/Card/MainCurrency/AddEurcBanner';
import CurrencyOptionCard from '@/components/Card/MainCurrency/CurrencyOptionCard';
import EurcApprovalSheet from '@/components/Card/MainCurrency/EurcApprovalSheet';
import {
  MAIN_CURRENCY_LABEL,
  mainCurrencyLines,
} from '@/components/Card/MainCurrency/mainCurrencyCopy';
import PageLayout from '@/components/PageLayout';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { BASE_SPEND_DEPLOYMENT } from '@/constants/spendModuleDeployments';
import useCardSpendableBalanceUSD from '@/hooks/useCardSpendableBalance';
import { useEuroSpendEnablement } from '@/hooks/useEuroSpendEnablement';
import { useHoldsBaseEuros, useMainCurrency } from '@/hooks/useMainCurrency';
import { showErrorToast } from '@/lib/errors';
import { usdToEur } from '@/lib/utils/cardCurrency';
import { useDepositStore } from '@/store/useDepositStore';

import type { MainCurrency } from '@/lib/types';

const CURRENCIES: MainCurrency[] = ['USD', 'EUR'];

const formatBalance = (value: number, currency: MainCurrency) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Main currency (Figma 29236:9724, 29236:9984, 29236:10246, 29236:10508). Wirex cards only.
 *
 * The cardholder picks the currency their balance shows in and that a purchase in a third
 * currency is paid from first. Euro and dollar shops are not affected — each is paid in its own
 * currency first — so this is the one choice that replaced "Enable euro spending", which sounded
 * like it did this and did nothing without EURC.
 *
 * The first switch to Euro turns EURC on for the card: a one-time passkey approval, after which
 * the choice is saved. Every switch after that is instant. Switching back to dollars leaves EURC
 * on, so euro shops keep being paid from it.
 */
export default function MainCurrencyScreen() {
  const router = useRouter();
  const { mainCurrency: saved, usdPerEur, save, isSaving } = useMainCurrency();
  const euro = useEuroSpendEnablement();
  const holdsBaseEuros = useHoldsBaseEuros();
  const { data: totalUsd } = useCardSpendableBalanceUSD();
  const setWalletDeposit = useDepositStore(state => state.setWalletDeposit);
  const setDepositModal = useDepositStore(state => state.setModal);

  // The card on screen. Follows the saved choice until the cardholder taps one, so a page opened
  // before the card details land does not stay on dollars once they say euro.
  const [picked, setPicked] = useState<MainCurrency>();
  const selected = picked ?? saved;
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);

  // A saved switch lands the page back on "nothing to change", and the button goes.
  useEffect(() => {
    if (picked === saved) setPicked(undefined);
  }, [picked, saved]);

  const balanceIn = (currency: MainCurrency) => {
    if (currency === 'USD') return formatBalance(totalUsd, 'USD');
    return usdPerEur ? formatBalance(usdToEur(totalUsd, usdPerEur), 'EUR') : '—';
  };

  const commit = async (currency: MainCurrency) => {
    try {
      await save(currency);
      Toast.show({
        type: 'success',
        text1: `${MAIN_CURRENCY_LABEL[currency]} is your main currency`,
        props: { badgeText: '' },
      });
    } catch (error) {
      void showErrorToast(error, { action: 'card_settings' });
    }
  };

  const handleSwitch = () => {
    if (selected === 'EUR' && !euro.isEnabled) {
      euro.clearError();
      setIsApprovalOpen(true);
      return;
    }
    void commit(selected);
  };

  const handleApprove = async () => {
    try {
      // False when the passkey prompt was dismissed: nothing is saved and the sheet closes, with
      // Euro still picked so the cardholder can try again.
      const enabled = await euro.enableAsync('main_currency');
      if (!enabled) {
        setIsApprovalOpen(false);
        return;
      }
      setIsApprovalOpen(false);
      await commit('EUR');
    } catch {
      // The sheet shows `euro.error` in place of its description; nothing was saved.
    }
  };

  const handleAddEurc = () => {
    setWalletDeposit({
      symbol: 'EURC',
      chainId: BASE_SPEND_DEPLOYMENT.chainId,
      isChangingToken: false,
    });
    setDepositModal(DEPOSIT_MODAL.OPEN_PUBLIC_ADDRESS);
    router.push(path.DEPOSIT);
  };

  const isBusy = isSaving || euro.isEnabling;

  return (
    <PageLayout desktopOnly scrollable={false}>
      <View className="mx-auto w-full max-w-[600px] flex-1">
        <View style={styles.header}>
          <BackButton variant="header" fallbackHref={path.CARD_DETAILS} />
          <Text className="text-[20px] font-semibold text-white">Main currency</Text>
          {/* Balances the back button so the title sits on the centre line. */}
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text className="text-center text-[24px] font-medium text-white">
            Which currency do you use most?
          </Text>
          <Text className="mt-2 text-center text-[16px] text-white/60">
            You can change it anytime.
          </Text>

          <View style={styles.options}>
            {CURRENCIES.map(currency => (
              <CurrencyOptionCard
                key={currency}
                currency={currency}
                balance={balanceIn(currency)}
                selected={selected === currency}
                lines={mainCurrencyLines(currency, euro.isEnabled)}
                onPress={() => setPicked(currency)}
              />
            ))}
          </View>

          {holdsBaseEuros ? null : (
            <View style={styles.banner}>
              <AddEurcBanner onAddEurc={handleAddEurc} />
            </View>
          )}
        </ScrollView>

        {selected !== saved ? (
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${MAIN_CURRENCY_LABEL[selected]}`}
              accessibilityState={{ disabled: isBusy, busy: isBusy }}
              disabled={isBusy}
              onPress={handleSwitch}
              className="bg-white transition-all active:scale-95 active:opacity-80 disabled:opacity-60"
              style={styles.switchButton}
            >
              {isSaving ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text className="text-[16px] font-semibold text-black">
                  Switch to {MAIN_CURRENCY_LABEL[selected]}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </View>

      <EurcApprovalSheet
        isOpen={isApprovalOpen}
        onOpenChange={setIsApprovalOpen}
        onApprove={handleApprove}
        isApproving={euro.isEnabling}
        error={euro.error}
      />
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  // Figma: the 44pt back button 18 from the edge, the title on its centre line.
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  headerSpacer: { width: 44 },
  // Figma: the question starts 136 down the frame (33 under the header), 17 from either edge.
  content: { paddingBottom: 24, paddingHorizontal: 17, paddingTop: 33 },
  options: { gap: 12, marginTop: 28 },
  banner: { marginTop: 16 },
  // Figma: the button ends 40 above the frame's bottom, 34 of which is the home-indicator inset
  // PageLayout already keeps.
  footer: { paddingBottom: 6, paddingHorizontal: 18, paddingTop: 12 },
  switchButton: {
    alignItems: 'center',
    borderRadius: 100,
    height: 50,
    justifyContent: 'center',
  },
});
