import { ReactNode, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Check } from 'lucide-react-native';

import SlotTrigger from '@/components/SlotTrigger';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { useCardSpendAuthorization } from '@/hooks/useCardSpendAuthorization';

interface AuthorizeSpendActionProps {
  /** The circular action rendered in the card's action row. */
  trigger: ReactNode;
}

/** Trim a decimal soUSD string to two places for display. */
const formatSoUsd = (value: string | undefined): string => {
  const parsed = Number.parseFloat(value ?? '0');
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
};

/**
 * The Wirex cardholder's equivalent of "Add funds": authorizing the card to spend
 * from savings, rather than moving money onto it.
 *
 * A Wirex card holds no balance. Wirex pays the merchant from its own account and
 * our backend takes the soUSD from the user's Safe afterwards — so their savings
 * balance *is* their card balance, and the only thing they need to do once is give
 * permission for it to be taken. That permission is an ERC-20 allowance, which is
 * why this sheet explains a limit rather than asking for an amount.
 *
 * Once granted the action shows as done and is disabled. It comes back by itself
 * when the allowance is spent — nothing here tracks that, the backend reads the
 * remaining allowance straight off the chain.
 */
const AuthorizeSpendAction = ({ trigger }: AuthorizeSpendActionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { authorization, isAuthorized, isAuthorizing, error, authorize } =
    useCardSpendAuthorization();

  const limit = formatSoUsd(authorization?.allowanceLimit);
  const remaining = formatSoUsd(authorization?.allowanceRemaining);
  const balance = formatSoUsd(authorization?.balance);

  const handleAuthorize = async () => {
    try {
      // False means the user dismissed the signature prompt — no allowance was
      // granted, so saying "authorized" would be a lie. Leave the sheet open so
      // they can try again, and say nothing.
      if (!(await authorize())) return;
      Toast.show({
        type: 'success',
        text1: 'Card spending authorized',
        text2: `Your card can now spend up to ${limit} soUSD from savings.`,
        props: { badgeText: '' },
      });
      setIsOpen(false);
    } catch {
      // `error` from the hook renders in the sheet; the user stays here to retry.
    }
  };

  return (
    <>
      {/* SlotTrigger, not DialogTrigger asChild: the trigger is a CircleAction whose
          own padding/label styling is applied on its root Pressable, and the asChild
          Slot chain drops those classes (the same reason WalletActions drives the
          card deposit modal this way). SlotTrigger clones and merges onPress
          instead, leaving the element's styling intact. */}
      <SlotTrigger onPress={() => setIsOpen(true)}>{trigger}</SlotTrigger>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="border-0 bg-[#1C1C1C] sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-white">
              {isAuthorized ? 'Card spending is on' : 'Authorize card spending'}
            </DialogTitle>
            <DialogDescription className="text-base leading-tight text-[#ACACAC]">
              {isAuthorized
                ? `Your card spends straight from savings. ${remaining} soUSD of the ${limit} soUSD ` +
                  'you authorized is still available — you can authorize more once it runs out.'
                : `Your savings are your card balance. Authorize once and your card can spend up to ` +
                  `${limit} soUSD from your ${balance} soUSD savings — nothing moves until you pay ` +
                  'with the card.'}
            </DialogDescription>
          </DialogHeader>

          <View className="mt-2 gap-3 rounded-2xl bg-[#252525] p-4">
            <Row label="Spending limit" value={`${limit} soUSD`} />
            {isAuthorized && <Row label="Remaining" value={`${remaining} soUSD`} />}
            <Row label="Savings balance" value={`${balance} soUSD`} />
          </View>

          {error ? <Text className="mt-3 text-sm text-red-400">{error}</Text> : null}

          {isAuthorized ? (
            <View className="mt-5 flex-row items-center justify-center gap-2">
              <Check size={18} color="#94F27F" />
              <Text className="text-base font-bold text-[#94F27F]">Authorized</Text>
            </View>
          ) : (
            <Button
              variant="brand"
              className="mt-5 h-12 w-full rounded-xl border-0"
              disabled={isAuthorizing}
              onPress={handleAuthorize}
            >
              {isAuthorizing ? (
                <ActivityIndicator size="small" color="black" />
              ) : (
                <Text className="text-base font-bold text-black">Authorize {limit} soUSD</Text>
              )}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.row}>
    <Text className="text-sm text-[#ACACAC]">{label}</Text>
    <Text className="text-sm font-semibold text-white">{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});

export default AuthorizeSpendAction;
