import { Pressable, View } from 'react-native';
import { ChevronRight, Info } from 'lucide-react-native';

import CountUp from '@/components/CountUp';
import DepositOnItsWayRows from '@/components/Earn/DepositOnItsWayRows';
import { EarnChip } from '@/components/Earn/EarnChips';
import YieldIcon from '@/components/Earn/YieldIcon';
import { formatYieldAmount, yieldProductName } from '@/components/Earn/yieldProducts';
import HeaderHelpButton from '@/components/Navbar/HeaderHelpButton';
import { BackButton } from '@/components/ui/back-button';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { type DepositOnItsWay, hasDepositMoving } from '@/lib/deposit/depositOnItsWay';
import { yieldEstimate } from '@/lib/portfolio';
import { VaultType } from '@/lib/types';
import { getVaultCurrencySymbol, isEurVault } from '@/lib/vaultCurrency';

import SavingsFundedActions from './SavingsFundedActions';
import SimulateSavingsCard from './SimulateSavingsCard';
import StartEarningButton from './StartEarningButton';
import VaultApyHistoryCard from './VaultApyHistoryCard';
import YieldBenefitsCard from './YieldBenefitsCard';
import YieldShareCard from './YieldShareCard';

const BALANCE_STYLE = {
  fontSize: 45,
  fontWeight: '600',
  fontFamily: 'MonaSans_600SemiBold',
  color: '#ffffff',
} as const;

/** Each product's own wording for the no-funds intro: dollars stay dollars, ETH stays ETH. */
const INTRO: Record<VaultType, string> = {
  [VaultType.USDC]:
    'On your dollars. Interest is added all the time, and you can withdraw whenever you want.',
  [VaultType.ETH]: 'On your ETH. Interest is added all the time, and you keep your ETH exposure.',
  [VaultType.FUSE]: 'On your FUSE. Interest is added all the time, and it counts toward your tier.',
  [VaultType.EUR]:
    'On your euros. Yield is coming soon; until then your EURC is held and shown in euros, and you can withdraw it whenever you want.',
};

const HowItWorksRow = ({ onPress }: { onPress: () => void }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel="How it works"
    onPress={onPress}
    className="mx-4 flex-row items-center gap-[14px] rounded-[20px] bg-[#1C1C1C] p-4 active:opacity-80"
  >
    <View className="h-10 w-10 items-center justify-center rounded-full bg-white/10">
      <Info size={20} strokeWidth={1.75} color="#ffffff" />
    </View>
    <View className="min-w-0 flex-1 gap-[2px]">
      <Text className="text-[16px] font-semibold leading-[23px] text-white">How it works</Text>
      <Text className="text-[14px] leading-5 text-white/60">
        Strategies, fees, withdrawals and FAQ
      </Text>
    </View>
    <ChevronRight size={16} strokeWidth={1.6} color="rgba(255,255,255,0.35)" />
  </Pressable>
);

/**
 * Every amount here is in the product's own currency — euros for EUR Yield, which is never
 * converted to dollars, dollars otherwise — whatever its prop name says. `debtUsd` is the
 * exception: card credit is always dollars.
 */
export interface YieldProductViewProps {
  vaultType: VaultType;
  /** Space above the header row: the safe-area inset plus the navbar's 16px. */
  topInset: number;
  isLoading: boolean;
  isFunded: boolean;
  balanceUsd: number;
  /** Undefined while the rate loads. */
  apy: number | undefined;
  interestUsd: number;
  isInterestLoading: boolean;
  /** Interest added over the last 30 days; undefined while it can't be worked out. */
  past30Usd: number | undefined;
  walletShares: number;
  walletUsd: number | undefined;
  escrowedShares: number;
  escrowedUsd: number | undefined;
  debtUsd: number | undefined;
  /** Native units per share, for the "1 soUSD = $1.0830" line. */
  exchangeRate: number | undefined;
  onOpenHelp: () => void;
  onOpenWallet?: () => void;
  onOpenCredit?: () => void;
  /** Deposits into this product that haven't reached it yet, one row each under the balance. */
  depositsOnItsWay?: DepositOnItsWay[];
}

/**
 * Figma 28443:4811 (funded) and 28501:5004 (no funds): what one product holds, earns and
 * is held as. Data comes in as props so the page can be checked with any balance.
 */
export default function YieldProductView({
  vaultType,
  topInset,
  isLoading,
  isFunded,
  balanceUsd,
  apy,
  interestUsd,
  isInterestLoading,
  past30Usd,
  walletShares,
  walletUsd,
  escrowedShares,
  escrowedUsd,
  debtUsd,
  exchangeRate,
  onOpenHelp,
  onOpenWallet,
  onOpenCredit,
  depositsOnItsWay = [],
}: YieldProductViewProps) {
  const name = yieldProductName(vaultType);
  // Nothing in it yet, but the first deposit is on its way: it takes Start earning's place.
  const isFirstDepositMoving = !isFunded && hasDepositMoving(depositsOnItsWay);
  const isEur = isEurVault(vaultType);
  const formatAmount = (value: number | undefined) => formatYieldAmount(value, vaultType);
  const apyLabel = apy ? `${apy.toFixed(1)}%` : undefined;
  // Per day once that reaches a cent, else per month, as on Assets: a small balance would
  // otherwise read "+$0.00 today".
  const rate = Math.max(apy ?? 0, 0) / 100;
  const estimate = yieldEstimate((balanceUsd * rate) / 365, (balanceUsd * rate) / 12);

  const footer = (
    <Text className="mx-4 text-center text-[13px] leading-[18px] text-white/40">
      {isFunded
        ? 'APY is after fees. It is variable and not guaranteed.'
        : "APY is after fees. It is variable and not guaranteed, and the projection uses today's rate."}
    </Text>
  );

  return (
    <View className="mx-auto w-full max-w-[419px] pb-[140px] web:md:max-w-[40rem]">
      <View className="flex-row items-center justify-between px-4" style={{ paddingTop: topInset }}>
        <BackButton fallbackHref="/earn" variant="header" />
        <HeaderHelpButton accessibilityLabel={`How ${name} works`} onPress={onOpenHelp} />
      </View>

      {isLoading ? (
        <View className="mt-6 items-center gap-3 px-4">
          <Skeleton className="h-6 w-40 rounded-full bg-white/10" />
          <Skeleton className="h-[54px] w-56 rounded-xl bg-white/10" />
          <Skeleton className="mt-6 h-[50px] w-full rounded-full bg-white/10" />
        </View>
      ) : isFunded ? (
        <View className="mt-6 gap-6">
          <View className="items-center gap-2 px-4">
            <View className="flex-row items-center gap-2">
              <YieldIcon vaultType={vaultType} size={24} ringColor="#111111" />
              <Text className="text-[16px] font-medium leading-5 text-white/70">{name}</Text>
              {apyLabel ? <EarnChip tone="positive" label={`${apyLabel} APY`} /> : null}
            </View>
            <CountUp
              prefix={getVaultCurrencySymbol(vaultType)}
              count={balanceUsd}
              decimalPlaces={2}
              animateOnMount={false}
              classNames={{ wrapper: 'text-foreground' }}
              styles={{
                wholeText: BALANCE_STYLE,
                decimalText: BALANCE_STYLE,
                decimalSeparator: BALANCE_STYLE,
              }}
            />
            {estimate ? (
              <View className="rounded-full bg-[#1C1C1C] px-[14px] py-[7px]">
                <Text className="text-[16px] leading-5 text-[#94F27F]">
                  +{formatAmount(estimate.amount)} {estimate.period === 'day' ? 'today' : 'a month'}
                </Text>
              </View>
            ) : null}
          </View>

          <DepositOnItsWayRows deposits={depositsOnItsWay} className="mx-4" />

          <SavingsFundedActions vaultType={vaultType} />

          <View className="mx-4 flex-row rounded-[20px] bg-[#1C1C1C] py-[18px]">
            <View className="flex-1 px-5">
              <Text className="text-[15px] leading-5 text-white/60">Interest earned</Text>
              {isInterestLoading ? (
                <Skeleton className="mt-2 h-7 w-24 rounded-md bg-white/10" />
              ) : (
                <Text className="mt-1 text-[24px] font-semibold leading-8 text-white">
                  {formatAmount(interestUsd)}
                </Text>
              )}
              <Text className="mt-1 text-[14px] leading-5 text-white/50">Since you started</Text>
            </View>
            <View className="w-px bg-white/10" />
            <View className="flex-1 px-5">
              <Text className="text-[15px] leading-5 text-white/60">Past 30 days</Text>
              {past30Usd === undefined ? (
                <Skeleton className="mt-2 h-7 w-20 rounded-md bg-white/10" />
              ) : (
                <Text className="mt-1 text-[24px] font-semibold leading-8 text-[#94F27F]">
                  +{formatAmount(past30Usd)}
                </Text>
              )}
              <Text className="mt-1 text-[14px] leading-5 text-white/50">
                Added to your balance
              </Text>
            </View>
          </View>

          <VaultApyHistoryCard vaultType={vaultType} />

          <View className="mx-4">
            <YieldShareCard
              vaultType={vaultType}
              walletShares={walletShares}
              walletUsd={walletUsd}
              escrowedShares={escrowedShares}
              escrowedUsd={escrowedUsd}
              debtUsd={debtUsd}
              exchangeRate={exchangeRate}
              onOpenWallet={onOpenWallet}
              onOpenCredit={onOpenCredit}
            />
          </View>

          <SimulateSavingsCard vaultType={vaultType} apy={apy} initialPrincipal={balanceUsd} />

          <HowItWorksRow onPress={onOpenHelp} />

          {footer}
        </View>
      ) : isFirstDepositMoving ? (
        <View className="mt-6 gap-6">
          <View className="items-center gap-3 px-4">
            <View className="flex-row items-center gap-2">
              <YieldIcon vaultType={vaultType} size={24} ringColor="#111111" />
              <Text className="text-[16px] font-medium leading-5 text-white/70">{name}</Text>
            </View>
            <Text className="max-w-[340px] text-center text-[36px] font-semibold leading-[44px] text-white">
              Your first deposit is on its way
            </Text>
            <Text className="max-w-[340px] text-center text-[15px] leading-[22px] text-white/60">
              {apyLabel
                ? `It starts earning ${apyLabel} a year as soon as it lands.`
                : 'It starts earning as soon as it lands.'}
            </Text>
          </View>

          <DepositOnItsWayRows deposits={depositsOnItsWay} className="mx-4" />

          <SimulateSavingsCard vaultType={vaultType} apy={apy} />

          <View className="mx-4">
            <YieldBenefitsCard vaultType={vaultType} />
          </View>

          <VaultApyHistoryCard vaultType={vaultType} />

          <HowItWorksRow onPress={onOpenHelp} />

          {footer}
        </View>
      ) : (
        <View className="mt-6 gap-6">
          <View className="items-center gap-3 px-4">
            <View className="flex-row items-center gap-2">
              <YieldIcon vaultType={vaultType} size={24} ringColor="#111111" />
              <Text className="text-[16px] font-medium leading-5 text-white/70">{name}</Text>
            </View>
            {apyLabel ? (
              <Text className="text-center text-[36px] font-semibold leading-[44px] text-white">
                Earn <Text className="text-[36px] font-semibold text-[#94F27F]">{apyLabel}</Text> a
                year
              </Text>
            ) : isEur ? (
              // No rate to wait for: soEURC does not earn yet, so no skeleton that never resolves.
              <Text className="text-center text-[36px] font-semibold leading-[44px] text-white">
                Save in euros
              </Text>
            ) : (
              <Skeleton className="h-11 w-64 rounded-xl bg-white/10" />
            )}
            <Text className="max-w-[340px] text-center text-[15px] leading-[22px] text-white/60">
              {INTRO[vaultType]}
            </Text>
          </View>

          {/* Only a first deposit that didn't go through reaches here. */}
          <DepositOnItsWayRows deposits={depositsOnItsWay} className="mx-4" />

          <StartEarningButton vaultType={vaultType} />

          <SimulateSavingsCard vaultType={vaultType} apy={apy} />

          <View className="mx-4">
            <YieldBenefitsCard vaultType={vaultType} />
          </View>

          <VaultApyHistoryCard vaultType={vaultType} />

          <HowItWorksRow onPress={onOpenHelp} />

          {footer}
        </View>
      )}
    </View>
  );
}
