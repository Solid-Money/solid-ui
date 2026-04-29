import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Toast from 'react-native-toast-message';

import ApiKeyList from '@/components/Agent/ApiKeyList';
import ApiKeyRevealModal from '@/components/Agent/ApiKeyRevealModal';
import IntegrationSnippet from '@/components/Agent/IntegrationSnippet';
import CopyToClipboard from '@/components/CopyToClipboard';
import PageLayout from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import {
  useAgentApiKeys,
  useAgentBalance,
  useAgentDeposited,
  useAgentQuery,
  useGenerateAgentApiKey,
  useProvisionAgent,
  useRevokeAgentApiKey,
} from '@/hooks/useAgent';
import { eclipseAddress } from '@/lib/utils';

const formatUsdc = (raw?: bigint) => {
  if (raw === undefined) return '—';
  const value = Number(raw) / 1_000_000;
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export default function AgentPage() {
  const agentQuery = useAgentQuery();
  const provision = useProvisionAgent();
  const apiKeysQuery = useAgentApiKeys();
  const generateApiKey = useGenerateAgentApiKey();
  const revokeApiKey = useRevokeAgentApiKey();

  const agent = agentQuery.data;
  const isProvisioned = !!agent?.agentEoaAddress;

  const balanceQuery = useAgentBalance(agent?.agentEoaAddress);
  const depositedQuery = useAgentDeposited(isProvisioned);
  const hasDeposited = depositedQuery.data ?? false;

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
      <View className="mx-auto w-full max-w-3xl gap-6 px-4 py-6 md:py-10">
        <View className="gap-1">
          <Text className="text-3xl font-semibold md:text-5xl">Agent Wallet</Text>
          <Text className="text-base text-muted-foreground">Your Solid Wallet is now Agentic</Text>
        </View>

        {agentQuery.isLoading ? (
          <View className="items-center py-12">
            <ActivityIndicator />
          </View>
        ) : !isProvisioned ? (
          <View className="items-center rounded-2xl border border-white/5 bg-[#1C1C1C] px-6 pb-8 pt-10">
            <Text className="mt-2 text-center text-2xl font-bold text-white">
              Set up your agent
            </Text>
            <Text className="my-3 text-center text-base leading-tight text-[#ACACAC]">
              We&apos;ll create a new EOA under your existing Turnkey wallet that can sign x402
              payments on Base. Start earning yield on idle USDC in your agent wallet.
            </Text>
            <Button
              className="mt-4 w-full"
              onPress={handleProvision}
              disabled={provision.isPending}
            >
              <Text>{provision.isPending ? 'Setting up…' : 'Set up Agent'}</Text>
            </Button>
          </View>
        ) : (
          <>
            <View className="flex-row items-center justify-between gap-3 rounded-twice border border-border bg-card p-4">
              <Text className="text-base font-medium">Human</Text>
              <Switch checked={hasDeposited} onCheckedChange={() => {}} disabled />
              <Text className="text-base font-medium">Agent</Text>
            </View>

            <View className="gap-3 rounded-twice border border-border bg-card p-5">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-sm text-muted-foreground">Agent wallet address</Text>
                <CopyToClipboard text={agent.agentEoaAddress!} />
              </View>
              <Text className="font-mono text-sm" selectable>
                {eclipseAddress(agent.agentEoaAddress!, 8, 6)}
              </Text>
              <View className="mt-2 gap-1">
                <Text className="text-xs uppercase text-muted-foreground">
                  USDC balance on Base
                </Text>
                {balanceQuery.isLoading ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Text className="text-2xl font-semibold">{formatUsdc(balanceQuery.data)}</Text>
                )}
              </View>
              <Button
                variant="secondary"
                onPress={() =>
                  Toast.show({
                    type: 'info',
                    text1: 'Deposit flow coming soon',
                    text2: 'Bridge USDC to the agent EOA on Base from the Solid app.',
                    props: { badgeText: 'Soon' },
                  })
                }
              >
                <Text>Deposit USD</Text>
              </Button>
            </View>

            <View className="gap-3 rounded-twice border border-border bg-card p-5">
              <View className="flex-row items-center justify-between">
                <View className="gap-1">
                  <Text className="text-lg font-semibold">API Keys</Text>
                  <Text className="text-xs text-muted-foreground">
                    Authenticate AI tools that pay through your agent wallet.
                  </Text>
                </View>
                <Button size="sm" onPress={handleGenerate} disabled={generateApiKey.isPending}>
                  <Text>{generateApiKey.isPending ? 'Generating…' : 'Generate API key'}</Text>
                </Button>
              </View>
              <ApiKeyList
                apiKeys={apiKeysQuery.data}
                isLoading={apiKeysQuery.isLoading}
                onRevoke={id => revokeApiKey.mutate(id)}
                revokingId={revokeApiKey.isPending ? (revokeApiKey.variables as string) : undefined}
              />
            </View>

            <View className="gap-3 rounded-twice border border-border bg-card p-5">
              <Text className="text-lg font-semibold">How to use</Text>
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
