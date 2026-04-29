import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useLocalSearchParams } from 'expo-router';
import { KeyRound, Plus } from 'lucide-react-native';

import ApiKeyList from '@/components/Agent/ApiKeyList';
import ApiKeyRevealModal from '@/components/Agent/ApiKeyRevealModal';
import IntegrationSnippet from '@/components/Agent/IntegrationSnippet';
import CopyToClipboard from '@/components/CopyToClipboard';
import PageLayout from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  useAgentApiKeys,
  useAgentBalance,
  useAgentQuery,
  useGenerateAgentApiKey,
  useProvisionAgent,
  useRevokeAgentApiKey,
} from '@/hooks/useAgent';
import { useDimension } from '@/hooks/useDimension';
import { isProduction } from '@/lib/config';
import { eclipseAddress } from '@/lib/utils';

const formatUsdc = (raw?: bigint) => {
  if (raw === undefined) return '—';
  const value = Number(raw) / 1_000_000;
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Render-state override for visual debugging. Pass via query param:
 *   /agent?status=loading
 *   /agent?status=not_provisioned
 *   /agent?status=provisioned
 *   /agent?status=deposited        (provisioned + non-zero balance)
 *
 * Disabled in production builds — the param is ignored when isProduction.
 */
type AgentStatusOverride = 'loading' | 'not_provisioned' | 'provisioned' | 'deposited';
const VALID_OVERRIDES: AgentStatusOverride[] = [
  'loading',
  'not_provisioned',
  'provisioned',
  'deposited',
];
const DEMO_AGENT_ADDRESS = '0x0000000000000000000000000000000000000000';
const DEMO_BALANCE_USDC = 12_345_670n; // $12.34

const handleDepositComingSoon = () =>
  Toast.show({
    type: 'info',
    text1: 'Deposit flow coming soon',
    text2: 'Will mirror borrow-against-savings: Aave borrow USDC on Fuse + Stargate to Base.',
    props: { badgeText: 'Soon' },
  });

export default function AgentPage() {
  const { status } = useLocalSearchParams<{ status?: string }>();
  const { isScreenMedium } = useDimension();
  const statusOverride: AgentStatusOverride | undefined =
    !isProduction && VALID_OVERRIDES.includes(status as AgentStatusOverride)
      ? (status as AgentStatusOverride)
      : undefined;

  const agentQuery = useAgentQuery();
  const provision = useProvisionAgent();
  const apiKeysQuery = useAgentApiKeys();
  const generateApiKey = useGenerateAgentApiKey();
  const revokeApiKey = useRevokeAgentApiKey();

  const liveAgent = agentQuery.data;
  const liveIsProvisioned = !!liveAgent?.agentEoaAddress;

  // Derived view-model: the override wins when set, otherwise we use live
  // backend data. Keeping the live hooks running unconditionally so the
  // override can be toggled on/off without remounting.
  const isLoading =
    statusOverride === 'loading' || (statusOverride === undefined && agentQuery.isLoading);
  const isProvisioned =
    statusOverride === 'provisioned' ||
    statusOverride === 'deposited' ||
    (statusOverride === undefined && liveIsProvisioned);
  const agentEoaAddress: string | undefined =
    statusOverride === 'provisioned' || statusOverride === 'deposited'
      ? DEMO_AGENT_ADDRESS
      : liveAgent?.agentEoaAddress;

  const balanceQuery = useAgentBalance(agentEoaAddress);
  const balance =
    statusOverride === 'deposited' || statusOverride === 'provisioned'
      ? DEMO_BALANCE_USDC
      : balanceQuery.data;
  const balanceLoading = statusOverride === undefined ? balanceQuery.isLoading : false;

  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const handleProvision = async () => {
    try {
      await provision.mutateAsync();
    } catch {
      // useProvisionAgent shows its own error toast.
    }
  };

  const handleGenerate = async () => {
    try {
      const result = await generateApiKey.mutateAsync(undefined);
      setRevealedKey(result.key);
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Failed to generate API key',
        props: { badgeText: 'Error' },
      });
    }
  };

  return (
    <PageLayout showNavbar scrollable>
      <View
        className={
          isProvisioned
            ? 'mx-auto w-full max-w-5xl gap-6 px-4 py-6 md:py-10'
            : 'mx-auto w-full max-w-lg gap-6 px-4 pt-8'
        }
      >
        {isLoading ? (
          <View className="items-center py-12">
            <ActivityIndicator color="white" />
          </View>
        ) : !isProvisioned ? (
          <View className="items-center rounded-2xl bg-[#1C1C1C] px-6 pb-8 pt-10">
            {/* Placeholder for hero artwork — keep the height stable so the
                later swap to a real Image doesn't shift the layout. */}
            <View className="mb-6 h-[268px] w-full rounded-xl bg-white/5" />
            <Text className="mt-2 text-center text-2xl font-bold text-white">
              Set up your Agent Wallet
            </Text>
            <Text className="my-3 text-center text-base leading-tight text-[#ACACAC]">
              We&apos;ll create a new EOA under your existing Turnkey wallet that can sign x402
              payments on Base. Start earning yield on idle USDC in your agent wallet.
            </Text>
            <Button
              variant="brand"
              onPress={handleProvision}
              disabled={provision.isPending}
              className="mt-6 h-12 w-full rounded-xl"
            >
              <Text className="text-base font-bold text-primary-foreground">
                {provision.isPending ? 'Setting up…' : 'Set up Agent Wallet'}
              </Text>
            </Button>
          </View>
        ) : (
          <>
            <ProvisionedHeader
              isScreenMedium={isScreenMedium}
              isGenerating={generateApiKey.isPending}
              onDeposit={handleDepositComingSoon}
              onGenerateApiKey={handleGenerate}
            />

            {/* Wallet + API keys side-by-side on desktop, stacked on mobile */}
            <View className="flex-col gap-6 md:flex-row">
              <View className="flex-1">
                <WalletAddressCard
                  address={agentEoaAddress}
                  balance={balance}
                  balanceLoading={balanceLoading}
                />
              </View>
              <View className="flex-1">
                <ApiKeysCard
                  apiKeys={apiKeysQuery.data}
                  isLoading={apiKeysQuery.isLoading}
                  onRevoke={id => revokeApiKey.mutate(id)}
                  revokingId={
                    revokeApiKey.isPending ? (revokeApiKey.variables as string) : undefined
                  }
                />
              </View>
            </View>

            <View className="w-full rounded-2xl bg-[#1C1C1C] p-6">
              <Text className="mb-3 text-lg font-semibold">How to use</Text>
              <IntegrationSnippet />
            </View>
          </>
        )}

        <ApiKeyRevealModal
          open={!!revealedKey}
          onClose={() => setRevealedKey(null)}
          apiKey={revealedKey}
        />
      </View>
    </PageLayout>
  );
}

interface ProvisionedHeaderProps {
  isScreenMedium: boolean;
  isGenerating: boolean;
  onDeposit: () => void;
  onGenerateApiKey: () => void;
}

function ProvisionedHeader({
  isScreenMedium,
  isGenerating,
  onDeposit,
  onGenerateApiKey,
}: ProvisionedHeaderProps) {
  if (isScreenMedium) {
    return (
      <View className="flex-row items-end justify-between">
        <View className="gap-1">
          <Text className="text-5xl font-semibold">Agent Wallet</Text>
          <Text className="text-base text-muted-foreground">Your Solid Wallet is now Agentic</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Button
            variant="secondary"
            className="h-12 rounded-xl border-0 bg-[#303030] px-6"
            onPress={onGenerateApiKey}
            disabled={isGenerating}
          >
            <View className="flex-row items-center gap-2">
              {isGenerating ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <KeyRound size={18} color="white" />
              )}
              <Text className="text-base font-bold text-white">
                {isGenerating ? 'Generating…' : 'Generate API key'}
              </Text>
            </View>
          </Button>
          <Button className="h-12 rounded-xl border-0 bg-[#94F27F] px-6" onPress={onDeposit}>
            <View className="flex-row items-center gap-2">
              <Plus size={22} color="black" />
              <Text className="text-base font-bold text-black">Deposit</Text>
            </View>
          </Button>
        </View>
      </View>
    );
  }

  // Mobile: title above, circular action buttons below — same shape as
  // the spendable-balance hero on /card/details.
  return (
    <View className="gap-6">
      <View className="gap-1">
        <Text className="text-3xl font-semibold">Agent Wallet</Text>
        <Text className="text-base text-muted-foreground">Your Solid Wallet is now Agentic</Text>
      </View>
      <View className="flex-row items-center justify-around">
        <CircleAction icon={<Plus size={24} color="black" />} label="Deposit" onPress={onDeposit} />
        <CircleAction
          icon={
            isGenerating ? (
              <ActivityIndicator color="white" />
            ) : (
              <KeyRound size={22} color="white" />
            )
          }
          label="Generate key"
          onPress={onGenerateApiKey}
          variant="dark"
          disabled={isGenerating}
        />
      </View>
    </View>
  );
}

interface CircleActionProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  variant?: 'brand' | 'dark';
  disabled?: boolean;
}

function CircleAction({ icon, label, onPress, variant = 'brand', disabled }: CircleActionProps) {
  return (
    <View className="flex-1 items-center">
      <Pressable
        onPress={disabled ? undefined : onPress}
        className={`h-14 w-14 items-center justify-center rounded-full web:hover:opacity-80 ${
          variant === 'brand' ? 'bg-[#94F27F]' : 'bg-[#303030]'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        {icon}
      </Pressable>
      <Text className="mt-2 text-sm text-[#BFBFBF]">{label}</Text>
    </View>
  );
}

interface WalletAddressCardProps {
  address?: string;
  balance?: bigint;
  balanceLoading: boolean;
}

function WalletAddressCard({ address, balance, balanceLoading }: WalletAddressCardProps) {
  return (
    <View className="h-full gap-4 rounded-2xl bg-[#1C1C1C] p-6">
      <View>
        <Text className="text-sm text-white/60">USDC balance on Base</Text>
        {balanceLoading ? (
          <ActivityIndicator size="small" color="white" className="mt-2 self-start" />
        ) : (
          <Text className="text-[40px] font-semibold leading-tight text-white">
            {formatUsdc(balance)}
          </Text>
        )}
      </View>
      <View>
        <Text className="text-sm text-white/60">Agent wallet address</Text>
        <View className="mt-1 flex-row items-center gap-2">
          <Text className="font-mono text-base text-white" selectable>
            {address ? eclipseAddress(address, 8, 6) : ''}
          </Text>
          <CopyToClipboard text={address ?? ''} />
        </View>
      </View>
    </View>
  );
}

interface ApiKeysCardProps {
  apiKeys: Parameters<typeof ApiKeyList>[0]['apiKeys'];
  isLoading: boolean;
  onRevoke: (id: string) => void;
  revokingId?: string;
}

function ApiKeysCard({ apiKeys, isLoading, onRevoke, revokingId }: ApiKeysCardProps) {
  return (
    <View className="h-full gap-3 rounded-2xl bg-[#1C1C1C] p-6">
      <View className="gap-1">
        <Text className="text-lg font-semibold text-white">API Keys</Text>
        <Text className="text-sm text-white/60">
          Authenticate AI tools that pay through your agent wallet.
        </Text>
      </View>
      <ApiKeyList
        apiKeys={apiKeys}
        isLoading={isLoading}
        onRevoke={onRevoke}
        revokingId={revokingId}
      />
    </View>
  );
}
