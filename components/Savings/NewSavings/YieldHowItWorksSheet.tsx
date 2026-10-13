import { Fragment } from 'react';
import { Modal, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import CopyToClipboard from '@/components/CopyToClipboard';
import { yieldProductName, yieldVault } from '@/components/Earn/yieldProducts';
import { Text } from '@/components/ui/text';
import { CHAIN_NAMES } from '@/constants/chains';
import { useDimension } from '@/hooks/useDimension';
import { VaultType } from '@/lib/types';
import { eclipseAddress, formatNumber } from '@/lib/utils';

import VaultFaqCard from './VaultFaqCard';
import VaultStrategyBreakdownCard from './VaultStrategyBreakdownCard';
import YieldBenefitsCard from './YieldBenefitsCard';

const SHEET_BACKGROUND = '#1C1C1C';
const CARD = 'bg-[#282828]';

type Detail = { label: string; value: string; copy?: string };

/**
 * Facts we can stand behind per product. The 10% performance fee, Veda and the
 * withdrawal time are known for USD Yield; ETH and FUSE Yield only show what is.
 */
const productDetails = (type: VaultType): Detail[] => {
  const vault = yieldVault(type);
  const minimum = Number(vault.minimumAmount);
  const minimumLabel = !Number.isFinite(minimum)
    ? undefined
    : type === VaultType.USDC
      ? `$${formatNumber(minimum, 2, 0)}`
      : `${formatNumber(minimum, 4, 0)} ${type === VaultType.ETH ? 'ETH' : 'FUSE'}`;
  return [
    ...(type === VaultType.USDC ? [{ label: 'Fee', value: '10% of interest earned' }] : []),
    { label: 'APY shown', value: 'After fees' },
    ...(type === VaultType.USDC ? [{ label: 'Withdrawals', value: 'Usually within minutes' }] : []),
    ...(minimumLabel ? [{ label: 'Minimum deposit', value: minimumLabel }] : []),
    ...(type === VaultType.USDC ? [{ label: 'Built with', value: 'Veda' }] : []),
    // The share token has its own contract on each network it lives on, so each gets a row
    // that says which network it is ("soUSD on Ethereum", "soUSD on Fuse").
    ...vault.vaults.map(network => ({
      label: `${vault.vaultToken} on ${CHAIN_NAMES[network.chainId] ?? `chain ${network.chainId}`}`,
      value: eclipseAddress(network.address),
      copy: network.address,
    })),
  ];
};

interface YieldHowItWorksSheetProps {
  vaultType: VaultType;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Figma 28444:4861 — "How USD Yield works": why it, where the money is (today's Breakdown
 * card), the details and the questions, behind one tap from the product page.
 *
 * A native Modal rather than the card sheets: it is long and scrolls, and those size to
 * their content.
 */
const YieldHowItWorksSheet = ({ vaultType, isOpen, onClose }: YieldHowItWorksSheetProps) => {
  const insets = useSafeAreaInsets();
  const { isScreenMedium } = useDimension();
  const { height } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && isScreenMedium;
  const name = yieldProductName(vaultType);
  const details = productDetails(vaultType);

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType={isDesktop ? 'fade' : 'slide'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        className={isDesktop ? 'flex-1 items-center justify-center p-4' : 'flex-1 justify-end'}
        style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      >
        <Pressable
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={onClose}
          className="absolute inset-0"
        />
        <View
          className={isDesktop ? 'w-full max-w-[480px] rounded-[32px]' : 'w-full rounded-t-[40px]'}
          style={{
            backgroundColor: SHEET_BACKGROUND,
            maxHeight: isDesktop ? height - 32 : height - insets.top - 24,
            overflow: 'hidden',
          }}
        >
          {!isDesktop && (
            <View className="items-center pt-[15px]">
              <View className="h-[5px] w-[73px] rounded-full bg-white/20" />
            </View>
          )}
          <View className="flex-row items-center justify-between gap-3 px-5 pb-2 pt-4">
            <Text className="min-w-0 flex-1 text-[22px] font-semibold leading-7 text-white">
              How {name} works
            </Text>
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full bg-[#2A2A2A] active:opacity-80"
            >
              <X size={18} color="#ffffff" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: (isDesktop ? 0 : insets.bottom) + 24 }}
          >
            <View className="gap-6 px-5 pt-3">
              <YieldBenefitsCard vaultType={vaultType} className={CARD} />

              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[16px] leading-5 text-white/50">Where your money is</Text>
                  <Text className="text-[14px] leading-5 text-white/35">Updated today</Text>
                </View>
                <VaultStrategyBreakdownCard vaultType={vaultType} className={`mx-0 ${CARD}`} />
              </View>

              <View className="gap-3">
                <Text className="text-[16px] leading-5 text-white/50">Details</Text>
                <View className={`overflow-hidden rounded-[18px] ${CARD}`}>
                  {details.map((detail, index) => (
                    <Fragment key={detail.label}>
                      {index > 0 && <View className="h-px bg-white/[0.08]" />}
                      <View className="flex-row items-center justify-between gap-3 px-4 py-[14px]">
                        <Text className="text-[15px] leading-5 text-white/60">{detail.label}</Text>
                        <View className="flex-row items-center gap-2">
                          <Text
                            className={
                              detail.copy
                                ? 'text-[15px] font-medium leading-5 text-[#94F27F]'
                                : 'text-[15px] font-medium leading-5 text-white'
                            }
                          >
                            {detail.value}
                          </Text>
                          {detail.copy ? <CopyToClipboard text={detail.copy} size={14} /> : null}
                        </View>
                      </View>
                    </Fragment>
                  ))}
                </View>
              </View>

              <VaultFaqCard
                vaultType={vaultType}
                title="Questions"
                className="mx-0"
                cardClassName={CARD}
              />

              <Text className="text-center text-[13px] leading-[18px] text-white/40">
                APY is variable and not guaranteed. Onchain strategies carry smart contract risk.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default YieldHowItWorksSheet;
