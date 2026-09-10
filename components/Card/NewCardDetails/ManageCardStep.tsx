import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ArrowDownLeft } from 'lucide-react-native';

import {
  AppleWalletRowIcon,
  ApprovalsRowIcon,
  EditLimitRowIcon,
  RowChevronIcon,
} from '@/components/Card/NewCardDetails/icons';
import { Text } from '@/components/ui/text';
import { DEVICE_DIGITAL_WALLET, DigitalWalletType } from '@/constants/digital-wallet';

interface ManageRowProps {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  /**
   * Count to show beside the label. Rendered inline rather than as a corner badge,
   * because a row has no corner to hang one on.
   */
  count?: number;
}

/**
 * One row of the manage-card list (Figma 25601:2421).
 *
 * Same geometry as `CardLinksList` — 26 left, a 27pt icon slot, the label at x=66 — so
 * the two lists on the card surface read as one control, on a lighter card because this
 * one sits inside a sheet rather than on the screen background.
 */
const ManageRow = ({ icon, label, onPress, count }: ManageRowProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={count ? `${label}, ${count} waiting` : label}
    onPress={onPress}
    style={styles.row}
    className="flex-row items-center web:hover:bg-white/5"
  >
    <View style={styles.iconSlot}>{icon}</View>
    <Text className="text-[16px] font-medium text-white">{label}</Text>
    {count ? (
      <View style={styles.count} className="ml-2 bg-brand">
        <Text className="text-[11px] font-semibold text-black">{count > 9 ? '9+' : count}</Text>
      </View>
    ) : null}
    <View className="flex-1" />
    <RowChevronIcon />
  </Pressable>
);

interface ManageCardStepProps {
  onEditLimit: () => void;
  /** Passed the wallet this device actually has, so the guide opens on its own tab. */
  onAddToWallet: (wallet: DigitalWalletType) => void;
  onApprovals: () => void;
  /** 3DS challenges waiting on an answer. A merchant is holding each one. */
  approvalsCount: number;
  showSpendControls?: boolean;
  onWithdraw?: () => void;
}

/**
 * The manage-card menu (Figma 25601:2360): the root of the card-spending sheet once
 * spending is set up.
 *
 * It exists because three unrelated things were competing for room in the card screen's
 * action row — the spending limits, the wallet guide, and the 3DS approvals queue — and
 * only the first two are things a cardholder does often enough to earn a circle each.
 * Approvals in particular is a queue that is empty almost all the time, so it lives here
 * and the count comes forward on the "Manage" circle when it is not.
 */
const ManageCardStep = ({
  onEditLimit,
  onAddToWallet,
  onApprovals,
  approvalsCount,
  showSpendControls = true,
  onWithdraw,
}: ManageCardStepProps) => {
  // A phone can only provision into its own wallet, so the row names that one. Desktop
  // web has neither; the guide covers both there and Apple is the design's label.
  const wallet = DEVICE_DIGITAL_WALLET ?? DigitalWalletType.Apple;

  return (
    <View className="overflow-hidden rounded-twice bg-[#2B2B2B]">
      {showSpendControls ? (
        <>
          <ManageRow icon={<EditLimitRowIcon />} label="Edit limit" onPress={onEditLimit} />
          <View style={styles.divider} />
        </>
      ) : null}
      <ManageRow
        icon={<AppleWalletRowIcon />}
        label={wallet === DigitalWalletType.Google ? 'Add to Google Wallet' : 'Add to Apple Wallet'}
        onPress={() => onAddToWallet(wallet)}
      />
      {showSpendControls ? (
        <>
          <View style={styles.divider} />
          <ManageRow
            icon={<ApprovalsRowIcon />}
            label="Approvals"
            count={approvalsCount}
            onPress={onApprovals}
          />
        </>
      ) : null}
      {onWithdraw ? (
        <>
          <View style={styles.divider} />
          <ManageRow
            icon={<ArrowDownLeft size={24} color="white" />}
            label="Withdraw"
            onPress={onWithdraw}
          />
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  // 26 + a 27pt icon slot + 13 puts the label at x=66, where Figma has it.
  row: { paddingLeft: 26, paddingRight: 24, paddingVertical: 25 },
  iconSlot: { alignItems: 'center', marginRight: 13, width: 27 },
  divider: { backgroundColor: 'rgba(255, 255, 255, 0.1)', height: 1 },
  count: {
    alignItems: 'center',
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 4,
  },
});

export default ManageCardStep;
