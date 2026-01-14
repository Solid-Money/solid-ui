import { Pressable, View } from 'react-native';
import { AlertCircle, Bell, BellOff, CheckCircle, Loader2 } from 'lucide-react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useWebhookStatus } from '@/hooks/useWebhookStatus';
import { cn } from '@/lib/utils';

type WebhookStatusProps = {
  /** Whether to show the compact version (badge only) */
  compact?: boolean;
  /** Additional class names */
  className?: string;
};

/**
 * Component to display and manage webhook subscription status.
 *
 * Shows:
 * - Green check when registered ("Real-time notifications active")
 * - Yellow alert when not registered with "Enable" button
 * - Loading and error states
 */
export default function WebhookStatus({ compact = false, className }: WebhookStatusProps) {
  const { isLoading, isSubscribing, isRegistered, registeredChainCount, error, subscribe } =
    useWebhookStatus({ autoSubscribe: true });

  // Loading state
  if (isLoading) {
    if (compact) {
      return (
        <Badge variant="secondary" className={className}>
          <Loader2 size={12} className="animate-spin text-muted-foreground" />
        </Badge>
      );
    }

    return (
      <View className={cn('flex-row items-center gap-2', className)}>
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
        <Text className="text-sm text-muted-foreground">Checking notifications...</Text>
      </View>
    );
  }

  // Error state
  if (error && !isRegistered) {
    if (compact) {
      return (
        <Badge variant="destructive" className={className}>
          <AlertCircle size={12} color="#fff" />
        </Badge>
      );
    }

    return (
      <View className={cn('flex-row items-center gap-2', className)}>
        <AlertCircle size={16} color="#ef4444" />
        <Text className="text-sm text-destructive">Notification setup failed</Text>
        <Button variant="ghost" size="sm" onPress={() => subscribe()} disabled={isSubscribing}>
          <Text className="text-sm">Retry</Text>
        </Button>
      </View>
    );
  }

  // Registered state
  if (isRegistered) {
    if (compact) {
      return (
        <Badge variant="brand" className={className}>
          <Bell size={12} color="#22c55e" />
        </Badge>
      );
    }

    return (
      <View className={cn('flex-row items-center gap-2', className)}>
        <CheckCircle size={16} color="#22c55e" />
        <Text className="text-sm text-muted-foreground">
          Real-time notifications active
          {registeredChainCount > 0 && ` (${registeredChainCount} chains)`}
        </Text>
      </View>
    );
  }

  // Not registered state
  if (compact) {
    return (
      <Pressable onPress={() => subscribe()} disabled={isSubscribing} className="active:opacity-70">
        <Badge variant="secondary" className={className}>
          <BellOff size={12} color="#eab308" />
        </Badge>
      </Pressable>
    );
  }

  return (
    <View className={cn('flex-row items-center gap-2', className)}>
      <BellOff size={16} color="#eab308" />
      <Text className="text-sm text-muted-foreground">Notifications disabled</Text>
      <Button variant="secondary" size="sm" onPress={() => subscribe()} disabled={isSubscribing}>
        {isSubscribing ? (
          <Loader2 size={14} className="animate-spin" color="#fff" />
        ) : (
          <Text className="text-sm">Enable</Text>
        )}
      </Button>
    </View>
  );
}
