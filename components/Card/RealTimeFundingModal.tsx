import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Infinity as InfinityIcon, ShieldCheck, Wallet, X } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Underline } from '@/components/ui/underline';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDimension } from '@/hooks/useDimension';
import { track } from '@/lib/analytics';
import { RainRtfChain, RainRtfStatus } from '@/lib/types';
import { formatTokenAmount } from '@/lib/utils/realTimeFunding';

const MODAL_BACKGROUND = '#111111';
const DESKTOP_MODAL_WIDTH = 512;
const DESKTOP_MODAL_HEIGHT = 720;

interface RealTimeFundingModalProps {
  isOpen: boolean;
  status: RainRtfStatus | undefined;
  chain: RainRtfChain | undefined;
  isApproving: boolean;
  error?: string;
  onClose: () => void;
  /** Resolves true once the authorization is recorded; false on dismissal. */
  onApprove: (termsVersion: string) => Promise<boolean>;
}

const Bullet = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) => (
  <View className="flex-row gap-3">
    <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-[#1C1C1C]">
      {icon}
    </View>
    <View className="flex-1 gap-0.5">
      <Text className="text-[15px] font-semibold text-white">{title}</Text>
      <Text className="text-[13px] leading-[18px] text-muted-foreground">{body}</Text>
    </View>
  </View>
);

/**
 * The Real-Time Funding approval — what is being granted, to whom, and the
 * terms that authorize it.
 *
 * ## Why this is a modal and not just a button
 *
 * The approval it collects is an **unlimited** (`uint256` max) ERC-20
 * allowance on the cardholder's own wallet. That is a large thing to ask for,
 * and Rain requires the Real-Time Funding Terms to be presented and explicitly
 * acknowledged before it is granted — a partner-compliance requirement, not a
 * nicety. A one-tap "Approve" on the card row would satisfy neither the
 * requirement nor the cardholder.
 *
 * So the modal does three things, in this order: says plainly what the
 * allowance lets Rain do, says that it is unlimited and revocable, and takes
 * the acknowledgement. The approve button stays disabled until the checkbox is
 * ticked, and the checkbox is the thing recorded.
 *
 * ## The terms text comes from the backend
 *
 * Deliberately not a constant in this file. What is displayed and what is
 * stored against the consent must be the same string — a consent record
 * pointing at wording the app never showed is not a record of anything — and
 * legal moves this text without shipping an app release. The version rides
 * along so an old build records the wording it actually displayed.
 *
 * Uses React Native's native `Modal` (its own OS-level window) rather than the
 * shared Dialog, so it reliably covers the card pane and tab bar — the same
 * reason `SpendModeHelpModal` does.
 */
const RealTimeFundingModal = ({
  isOpen,
  status,
  chain,
  isApproving,
  error,
  onClose,
  onApprove,
}: RealTimeFundingModalProps) => {
  const insets = useSafeAreaInsets();
  const { isScreenMedium } = useDimension();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktopPopup = Platform.OS === 'web' && isScreenMedium;
  const modalWidth = isDesktopPopup ? Math.min(DESKTOP_MODAL_WIDTH, windowWidth - 32) : windowWidth;
  const modalHeight = Math.min(DESKTOP_MODAL_HEIGHT, windowHeight - 32);

  const [agreed, setAgreed] = useState(false);

  // Reset the acknowledgement every time the modal opens. A checkbox that
  // remembers a previous session's tick would let a second approval through
  // without the cardholder reading anything — which is precisely the consent
  // this screen exists to collect.
  useEffect(() => {
    if (!isOpen) return;
    setAgreed(false);
    track(TRACKING_EVENTS.CARD_RTF_APPROVE_VIEWED, { chain_id: chain?.chainId });
  }, [chain?.chainId, isOpen]);

  const handleApprove = useCallback(async () => {
    if (!status || !agreed) return;
    // Closes only on success. A failure leaves the modal up with the error in
    // place, because the next thing the cardholder needs is the retry — and a
    // modal that closes on failure sends them back to a row that still says
    // "Approve" with no explanation of what just happened.
    if (await onApprove(status.terms.version)) onClose();
  }, [agreed, onApprove, onClose, status]);

  const pendingSpenders = chain?.spenders.filter(spender => !spender.isApproved) ?? [];
  const walletBalance =
    chain && chain.walletBalance !== null
      ? formatTokenAmount(chain.walletBalance, chain.tokenDecimals)
      : null;
  // Zero is worth saying; "could not read the chain" is not, and must not be
  // rendered as if it were a balance of nothing.
  const showsEmptyWalletNotice = walletBalance === '0';

  return (
    <Modal
      visible={isOpen}
      animationType={isDesktopPopup ? 'fade' : 'slide'}
      transparent={isDesktopPopup}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        className={`flex-1 ${isDesktopPopup ? 'items-center justify-center p-4' : ''}`}
        style={{ backgroundColor: isDesktopPopup ? 'rgba(0, 0, 0, 0.8)' : MODAL_BACKGROUND }}
      >
        <View
          className={isDesktopPopup ? 'overflow-hidden rounded-[32px]' : 'flex-1'}
          style={{
            width: isDesktopPopup ? modalWidth : '100%',
            height: isDesktopPopup ? modalHeight : '100%',
            paddingTop: isDesktopPopup ? 0 : insets.top,
            backgroundColor: MODAL_BACKGROUND,
          }}
        >
          <View className="flex-row items-center justify-end p-4">
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              onPress={onClose}
              className="h-[44px] w-[44px] items-center justify-center rounded-full bg-[#2A2A2A] transition-all active:scale-95 active:opacity-80 web:hover:bg-secondary-hover"
            >
              <X color="#ffffff" size={20} />
            </Pressable>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 20 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="gap-2">
              <Text className="text-[26px] font-semibold leading-[32px] text-white">
                Approve Real-Time Funding
              </Text>
              <Text className="text-[15px] leading-[21px] text-muted-foreground">
                {chain
                  ? `Let your card draw ${chain.assetSymbol} from your wallet on ${chain.name} at the moment you spend, instead of topping your card up first.`
                  : 'Let your card draw funds from your wallet at the moment you spend.'}
              </Text>
            </View>

            <View className="gap-4 rounded-[20px] bg-[#1A1A1A] p-4">
              <Bullet
                icon={<Wallet color="#94F27F" size={16} />}
                title="Funds stay in your wallet"
                body={
                  chain
                    ? `Each purchase pulls exactly the amount of that purchase in ${chain.assetSymbol}. Nothing is moved before you spend.`
                    : 'Each purchase pulls exactly the amount of that purchase. Nothing is moved before you spend.'
                }
              />
              <Bullet
                icon={<InfinityIcon color="#94F27F" size={16} />}
                title="Unlimited allowance"
                body="You approve an unlimited spending allowance so you never have to re-approve mid-purchase. It is a permission, not a transfer — no funds move until you spend."
              />
              <Bullet
                icon={<ShieldCheck color="#94F27F" size={16} />}
                title="Revocable at any time"
                body="You can revoke this permission on-chain yourself, or by contacting Solid support. Your card stops drawing from your wallet as soon as you do."
              />
            </View>

            {chain ? (
              <View className="gap-2 rounded-[20px] bg-[#1A1A1A] p-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[13px] text-muted-foreground">Network</Text>
                  <Text className="text-[13px] font-medium text-white">{chain.name}</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-[13px] text-muted-foreground">Asset</Text>
                  <Text className="text-[13px] font-medium text-white">{chain.assetSymbol}</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-[13px] text-muted-foreground">Allowance</Text>
                  <Text className="text-[13px] font-medium text-white">Unlimited</Text>
                </View>
                {walletBalance !== null ? (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[13px] text-muted-foreground">Wallet balance</Text>
                    <Text className="text-[13px] font-medium text-white">
                      {walletBalance} {chain.assetSymbol}
                    </Text>
                  </View>
                ) : null}
                {/* Two spenders while Rain migrates its collateral contracts to the
                    reversal-enabled version. Surfaced as a count rather than as
                    addresses: the cardholder needs to know it is one signature
                    covering more than one approval, not which contracts they are. */}
                {pendingSpenders.length > 1 ? (
                  <Text className="pt-1 text-[12px] leading-[16px] text-muted-foreground">
                    This approves {pendingSpenders.length} Rain contracts in a single signature.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {showsEmptyWalletNotice ? (
              <Text className="text-[13px] leading-[18px] text-amber-400">
                Your wallet holds no {chain?.assetSymbol} on {chain?.name} yet. You can approve now
                — purchases will work once you add funds.
              </Text>
            ) : null}

            {status ? (
              <Text className="text-[12px] leading-[17px] text-muted-foreground">
                {status.terms.body}
              </Text>
            ) : null}

            <Pressable
              className="flex-row items-start gap-3 rounded-2xl bg-[#1C1C1C] px-4 py-4"
              onPress={() => setAgreed(previous => !previous)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              accessibilityLabel={status?.terms.consentLabel ?? 'Authorize Real-Time Funding'}
            >
              <View
                className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
                  agreed ? 'border-[#94F27F] bg-[#94F27F]' : 'border-gray-500 bg-transparent'
                }`}
              >
                {agreed ? <Check size={14} color="#000" /> : null}
              </View>
              <Text className="flex-1 text-sm leading-5 text-white">
                I authorize transfers according to the{' '}
                <Underline
                  inline
                  textClassName="text-sm font-bold text-white"
                  borderColor="rgba(255, 255, 255, 1)"
                  onPress={() => {
                    if (status?.terms.url) void Linking.openURL(status.terms.url);
                  }}
                >
                  Real-Time Funding Terms
                </Underline>
                .
              </Text>
            </Pressable>

            {error ? <Text className="text-center text-sm text-red-400">{error}</Text> : null}
          </ScrollView>

          <View
            className="px-5"
            style={{ paddingBottom: (isDesktopPopup ? 0 : insets.bottom) + 16 }}
          >
            <Button
              className="h-14 w-full rounded-full"
              style={{ backgroundColor: agreed && !isApproving ? '#94F27F' : '#3A3A3A' }}
              disabled={!agreed || isApproving || !chain}
              onPress={handleApprove}
            >
              {isApproving ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text className="text-base font-semibold text-black">Approve</Text>
              )}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default RealTimeFundingModal;
