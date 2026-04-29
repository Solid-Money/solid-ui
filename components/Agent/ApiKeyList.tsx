import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { AgentApiKeySummary } from '@/lib/types';

type Props = {
  apiKeys: AgentApiKeySummary[] | undefined;
  isLoading: boolean;
  onRevoke: (id: string) => void;
  revokingId?: string;
};

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
};

const ApiKeyList = ({ apiKeys, isLoading, onRevoke, revokingId }: Props) => {
  if (isLoading) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator />
      </View>
    );
  }

  const active = (apiKeys ?? []).filter(k => !k.revokedAt);
  if (active.length === 0) {
    return (
      <Text className="text-sm text-muted-foreground">
        No API keys yet. Generate one to start integrating with your AI tool.
      </Text>
    );
  }

  return (
    <View className="gap-2">
      {active.map(k => (
        <View
          key={k.id}
          className="flex-row items-center justify-between gap-2 rounded-twice border border-border bg-background p-3"
        >
          <View className="flex-1 gap-0.5">
            <Text className="font-mono text-sm">sk_solid_live_•••••{k.prefix}</Text>
            <Text className="text-xs text-muted-foreground">
              {k.name ? `${k.name} · ` : ''}created {formatDate(k.createdAt)}
              {k.lastUsedAt ? ` · last used ${formatDate(k.lastUsedAt)}` : ''}
            </Text>
          </View>
          <Button
            variant="ghost"
            size="sm"
            disabled={revokingId === k.id}
            onPress={() => onRevoke(k.id)}
          >
            <Text className="text-sm">{revokingId === k.id ? 'Revoking…' : 'Revoke'}</Text>
          </Button>
        </View>
      ))}
    </View>
  );
};

export default ApiKeyList;
