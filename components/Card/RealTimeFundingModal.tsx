import { useCallback, useEffect, useRef, useState } from 'react';
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

import type { RainRtfApprovalProgress } from '@/hooks/useRainRealTimeFunding';

const MODAL_BACKGROUND = '#111111';
const DESKTOP_MODAL_WIDTH = 512;
const DESKTOP_MODAL_HEIGHT = 720;

/**
 * "Base", "Base and Arbitrum", "Base, Arbitrum and Plasma".
 *
 * `Intl.ListFormat` would be the right tool and is not reliably present on
 * Hermes, so this is the short hand-rolled version rather than a polyfill for
 * three strings.
 */
const formatList = (items: string[]): string => {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
};

interface RealTimeFundingModalProps {
  isOpen: boolean;
  status: RainRtfStatus | undefined;
  /** The chain the flow starts on — the first still owing approvals. */
  chain: RainRtfChain | undefined;
  /**
   * How many allowances are being granted, and how many signatures that
   * costs. The two differ whenever a chain carries more than one asset or
   * spender, and both are quoted so no prompt comes as a surprise.
   */
  work: {
    approvals: number;
    signatures: number;
    chainNames: string[];
    assetSymbols: string[];
  };
  /** Which network is being signed right now, while `isApproving`. */
  progress?: RainRtfApprovalProgress;
  isApproving: boolean;
  error?: string;
  onClose: () => void;
  /** Resolves true once every chain is authorized; false on dismissal. */
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
  work,
  progress,
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

  // The work figures ride along on the view event but must not re-fire it.
  // A background refetch that changes the count by one is not a second view,
  // and depending on them directly would report one every time the status
  // query settles. A ref keeps the effect's dependencies honest instead of
  // silencing the lint rule — which the React Compiler then refuses to
  // optimise around.
  const workRef = useRef(work);
  workRef.current = work;

  // Reset the acknowledgement every time the modal opens. A checkbox that
  // remembers a previous session's tick would let a second approval through
  // without the cardholder reading anything — which is precisely the consent
  // this screen exists to collect.
  useEffect(() => {
    if (!isOpen) return;
    setAgreed(false);
    track(TRACKING_EVENTS.CARD_RTF_APPROVE_VIEWED, {
      chain_id: chain?.chainId,
      approval_count: workRef.current.approvals,
      signature_count: workRef.current.signatures,
    });
  }, [chain?.chainId, isOpen]);

  const handleApprove = useCallback(async () => {
    if (!status || !agreed) return;
    // Closes only on success. A failure leaves the modal up with the error in
    // place, because the next thing the cardholder needs is the retry — and a
    // modal that closes on failure sends them back to a row that still says
    // "Approve" with no explanation of what just happened.
    if (await onApprove(status.terms.version)) onClose();
  }, [agreed, onApprove, onClose, status]);

  const assets = chain?.assets ?? [];
  // Every asset whose balance read back as exactly zero. Worth saying; an
  // unreadable balance is not, and must never be rendered as if it were a
  // balance of nothing.
  const emptyAssets = assets.filter(
    asset => formatTokenAmount(asset.walletBalance, asset.tokenDecimals) === '0',
  );
  const networkCount = work.chainNames.length;

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
                {networkCount > 0
                  ? `Let your card draw from your wallet on ${formatList(work.chainNames)} at the moment you spend, instead of topping your card up first.`
                  : 'Let your card draw funds from your wallet at the moment you spend.'}
              </Text>
            </View>

            <View className="gap-4 rounded-[20px] bg-[#1A1A1A] p-4">
              <Bullet
                icon={<Wallet color="#94F27F" size={16} />}
                title="Funds stay in your wallet"
                body="Each purchase pulls exactly the amount of that purchase. Nothing is moved before you spend."
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
                  <Text className="text-[13px] text-muted-foreground">
                    {networkCount > 1 ? 'Networks' : 'Network'}
                  </Text>
                  <Text className="text-[13px] font-medium text-white">
                    {formatList(work.chainNames)}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-[13px] text-muted-foreground">
                    {work.assetSymbols.length > 1 ? 'Assets' : 'Asset'}
                  </Text>
                  {/* Across every network being approved, not just the first.
                      The Networks row above lists them all, and naming only
                      one chain's assets beside it would read as the whole
                      list while being a subset of it. */}
                  <Text className="text-[13px] font-medium text-white">
                    {formatList(work.assetSymbols)}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-[13px] text-muted-foreground">Allowance</Text>
                  <Text className="text-[13px] font-medium text-white">Unlimited</Text>
                </View>
                {/* Per asset, because a balance is per asset: a wallet holding
                    USDC and no EURC is funded for one and empty for the other,
                    and one combined figure would hide that entirely. */}
                {assets.map(asset => {
                  const balance = formatTokenAmount(asset.walletBalance, asset.tokenDecimals);
                  if (balance === null) return null;
                  return (
                    <View
                      key={asset.tokenAddress}
                      className="flex-row items-center justify-between"
                    >
                      <Text className="text-[13px] text-muted-foreground">
                        {asset.symbol} balance
                      </Text>
                      <Text className="text-[13px] font-medium text-white">
                        {balance} {asset.symbol}
                      </Text>
                    </View>
                  );
                })}
                {/* The two figures that are easy to conflate and must not be.
                    An allowance is per (token, spender), so the count is a
                    product — today two per network, and more as Rain adds
                    assets — while signatures are one per network because a
                    user operation cannot span chains. Saying both is what
                    stops a second wallet prompt coming as a surprise. */}
                {work.approvals > 1 || work.signatures > 1 ? (
                  <Text className="pt-1 text-[12px] leading-[16px] text-muted-foreground">
                    {work.approvals} approvals, batched into{' '}
                    {work.signatures === 1
                      ? 'a single signature'
                      : `${work.signatures} signatures — one per network`}
                    .
                  </Text>
                ) : null}
              </View>
            ) : null}

            {emptyAssets.length > 0 ? (
              <Text className="text-[13px] leading-[18px] text-amber-400">
                Your wallet holds no {formatList(emptyAssets.map(asset => asset.symbol))} on{' '}
                {chain?.name} yet. You can approve now — purchases will work once you add funds.
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
            {/* Which network is being signed, while the flow walks them. Without
                it, a cardholder on three chains sees three wallet prompts with
                no way to tell them apart or know how many are left — which
                reads as the app having failed and retried. */}
            {isApproving && progress && progress.total > 1 ? (
              <Text className="pb-3 text-center text-[13px] text-muted-foreground">
                Approving on {progress.chainName} — network {progress.step} of {progress.total}
              </Text>
            ) : null}
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
