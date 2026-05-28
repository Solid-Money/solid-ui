import { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Address, encodeFunctionData, erc20Abi, formatEther, formatUnits } from 'viem';
import { mainnet } from 'viem/chains';
import { useBalance, useReadContract } from 'wagmi';

import Wallet from '@/assets/images/wallet';
import PageLayout from '@/components/PageLayout';
import TooltipPopover from '@/components/Tooltip';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import useRescueToken from '@/hooks/useRescueToken';
import useUser from '@/hooks/useUser';
import { getAsset } from '@/lib/assets';
import { ADDRESSES } from '@/lib/config';
import { Status } from '@/lib/types';
import { cn, eclipseAddress, formatNumber } from '@/lib/utils';
import { publicClient } from '@/lib/wagmi';

const USDC_DECIMALS = 6;
// Fallback gas units for a standard USDC transfer when on-chain estimation is unavailable
// (e.g. user has 0 USDC and estimateContractGas reverts).
const FALLBACK_USDC_TRANSFER_GAS = 65_000n;

const GAS_INFO_TEXT =
  'ETH is required to pay network fees to transfer your stuck tokens out. ' +
  "If you don't have enough ETH, reach out to the Solid team and we can top up " +
  'your wallet with the gas needed to recover your tokens.';

export default function RescueToken() {
  const router = useRouter();
  const { user } = useUser();
  const { rescue, status } = useRescueToken();

  const eoaAddress = user?.walletAddress as Address | undefined;
  const safeAddress = user?.safeAddress as Address | undefined;

  const { data: usdcBalance, isLoading: isUsdcLoading } = useReadContract({
    abi: erc20Abi,
    address: ADDRESSES.ethereum.usdc,
    functionName: 'balanceOf',
    args: eoaAddress ? [eoaAddress] : undefined,
    chainId: mainnet.id,
    query: { enabled: !!eoaAddress },
  });

  const { data: ethBalance, isLoading: isEthLoading } = useBalance({
    address: eoaAddress,
    chainId: mainnet.id,
    query: { enabled: !!eoaAddress },
  });

  const { data: gasCostWei, isLoading: isGasLoading } = useQuery({
    queryKey: [
      'rescue-token-gas',
      mainnet.id,
      eoaAddress,
      safeAddress,
      usdcBalance?.toString(),
    ],
    queryFn: async () => {
      if (!eoaAddress || !safeAddress) return 0n;
      const client = publicClient(mainnet.id);
      const fees = await client.estimateFeesPerGas();
      const gasPrice = fees.maxFeePerGas || fees.gasPrice || (await client.getGasPrice());

      let gasUnits = FALLBACK_USDC_TRANSFER_GAS;
      if (usdcBalance && usdcBalance > 0n) {
        try {
          gasUnits = await client.estimateGas({
            account: eoaAddress,
            to: ADDRESSES.ethereum.usdc,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'transfer',
              args: [safeAddress, usdcBalance],
            }),
          });
        } catch {
          gasUnits = FALLBACK_USDC_TRANSFER_GAS;
        }
      }

      return gasUnits * gasPrice;
    },
    enabled: !!eoaAddress && !!safeAddress,
    staleTime: 30 * 1000,
    gcTime: 60 * 1000,
  });

  const usdcAmount = useMemo(
    () => (usdcBalance ? Number(formatUnits(usdcBalance, USDC_DECIMALS)) : 0),
    [usdcBalance],
  );
  const ethAmount = useMemo(
    () => (ethBalance ? Number(formatEther(ethBalance.value)) : 0),
    [ethBalance],
  );
  const gasEthAmount = useMemo(
    () => (gasCostWei ? Number(formatEther(gasCostWei)) : 0),
    [gasCostWei],
  );

  const hasUsdc = (usdcBalance ?? 0n) > 0n;
  const hasEnoughEth =
    !!gasCostWei && !!ethBalance && ethBalance.value >= gasCostWei;
  const isRescuing = status === Status.PENDING;
  const isDisabled =
    isRescuing ||
    isUsdcLoading ||
    isEthLoading ||
    isGasLoading ||
    !hasUsdc ||
    !hasEnoughEth;

  const getButtonText = () => {
    if (isRescuing) return 'Rescuing...';
    if (!hasUsdc) return 'No USDC to rescue';
    if (!hasEnoughEth) return 'Insufficient ETH for gas';
    return 'Rescue tokens';
  };

  const handleRescue = async () => {
    if (!usdcBalance || usdcBalance <= 0n) return;
    try {
      const txHash = await rescue(usdcBalance);
      Toast.show({
        type: 'success',
        text1: 'Tokens rescued',
        text2: `${formatNumber(usdcAmount)} USDC sent to your Solid wallet`,
        props: {
          link: `https://etherscan.io/tx/${txHash}`,
          linkText: eclipseAddress(txHash),
          image: { type: 'image', source: getAsset('images/usdc-4x.png') },
        },
      });
      router.replace(path.HOME);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Rescue failed',
        text2: err instanceof Error ? err.message : 'Please try again',
        props: { badgeText: '' },
      });
    }
  };

  return (
    <PageLayout desktopOnly contentClassName="pb-10">
      <View className="mx-auto w-full max-w-lg px-4 pt-8">
        <View className="flex-row items-center justify-between">
          <BackButton onPress={() => router.replace(path.HOME)} />
          <Text className="text-center text-xl font-semibold text-white md:text-2xl">
            Rescue tokens
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View className="mb-10 mt-8">
          <View className="rounded-2xl border border-white/5 bg-[#1C1C1C] px-6 pb-8 pt-10">
            <Text className="text-center text-2xl font-bold text-white">
              Recover stuck USDC
            </Text>
            <Text className="mb-6 mt-3 text-center text-base leading-tight text-[#ACACAC]">
              USDC was sent to your signer wallet on Ethereum by mistake. Sign with your
              passkey to move it into your Solid wallet.
            </Text>

            <View className="gap-4">
              <BalanceRow
                label="Stuck balance"
                isLoading={isUsdcLoading}
                value={
                  <View className="flex-row items-center gap-2">
                    <Image
                      source={getAsset('images/usdc-4x.png')}
                      alt="USDC"
                      style={{ width: 28, height: 28 }}
                    />
                    <Text className="text-lg font-semibold text-white">
                      {formatNumber(usdcAmount)} USDC
                    </Text>
                  </View>
                }
              />

              <DestinationRow safeAddress={safeAddress} />

              <BalanceRow
                label={
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-base font-medium text-white opacity-70">
                      Required ETH gas
                    </Text>
                    <TooltipPopover
                      text={GAS_INFO_TEXT}
                      side="top"
                      analyticsContext="rescue_token_gas_tooltip"
                    />
                  </View>
                }
                isLoading={isGasLoading}
                value={
                  <View className="items-end">
                    <View className="flex-row items-center gap-2">
                      <Image
                        source={getAsset('images/eth.png')}
                        alt="ETH"
                        style={{ width: 20, height: 20 }}
                      />
                      <Text className="text-base font-semibold text-white">
                        {formatNumber(gasEthAmount, 6, 6)} ETH
                      </Text>
                    </View>
                    <Text
                      className={cn(
                        'text-sm',
                        hasEnoughEth ? 'opacity-50' : 'text-red-400',
                      )}
                    >
                      {isEthLoading ? '—' : `Balance: ${formatNumber(ethAmount, 6, 6)} ETH`}
                    </Text>
                  </View>
                }
              />
            </View>

            <Button
              variant="brand"
              onPress={handleRescue}
              disabled={isDisabled}
              className="mt-8 h-14 w-full rounded-2xl"
            >
              {isRescuing && <ActivityIndicator color="black" />}
              <Text className="text-base font-bold text-primary-foreground">
                {getButtonText()}
              </Text>
            </Button>
          </View>
        </View>
      </View>
    </PageLayout>
  );
}

function BalanceRow({
  label,
  value,
  isLoading,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  isLoading?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between rounded-2xl bg-accent p-4">
      {typeof label === 'string' ? (
        <Text className="text-base font-medium text-white opacity-70">{label}</Text>
      ) : (
        label
      )}
      {isLoading ? <Skeleton className="h-6 w-24 rounded-md" /> : value}
    </View>
  );
}

function DestinationRow({ safeAddress }: { safeAddress?: Address }) {
  return (
    <View className="flex-row items-center justify-between rounded-2xl bg-accent p-4">
      <Text className="text-base font-medium text-white opacity-70">To</Text>
      <View className="flex-row items-center gap-2">
        <Wallet />
        <View className="items-end">
          <Text className="text-base font-semibold text-white">Solid wallet</Text>
          <Text className="text-xs text-white opacity-50">
            {safeAddress ? eclipseAddress(safeAddress, 6, 6) : ''}
          </Text>
        </View>
      </View>
    </View>
  );
}
