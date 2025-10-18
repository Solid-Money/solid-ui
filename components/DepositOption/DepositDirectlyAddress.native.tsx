import { Image } from 'expo-image';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useEffect } from 'react';
import CopyToClipboard from '@/components/CopyToClipboard';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useDepositStore } from '@/store/useDepositStore';
import { useDirectDepositSessionPolling } from '@/hooks/useDirectDepositSession';
import { eclipseAddress } from '@/lib/utils';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import useUser from '@/hooks/useUser';

const DepositDirectlyAddress = () => {
  const { user } = useUser();
  const { directDepositSession, setModal, clearDirectDepositSession } = useDepositStore();

  // Poll for session status updates
  const { session } = useDirectDepositSessionPolling(directDepositSession.sessionId, true);

  // Track status changes
  useEffect(() => {
    if (session?.status === 'detected') {
      track(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        session_id: session.sessionId,
        status: 'detected',
      });
    } else if (session?.status === 'completed') {
      track(TRACKING_EVENTS.DEPOSIT_COMPLETED, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        session_id: session.sessionId,
        amount: session.detectedAmount,
        transaction_hash: session.transactionHash,
      });
    } else if (session?.status === 'failed') {
      track(TRACKING_EVENTS.DEPOSIT_ERROR, {
        user_id: user?.userId,
        safe_address: user?.safeAddress,
        session_id: session.sessionId,
        status: 'failed',
      });
    }
  }, [
    session?.status,
    session?.sessionId,
    session?.detectedAmount,
    session?.transactionHash,
    user,
  ]);

  const handleDone = () => {
    setModal(DEPOSIT_MODAL.CLOSE);
    clearDirectDepositSession();
  };

  // Get network info
  const chainId = directDepositSession.chainId || 1;
  const network = BRIDGE_TOKENS[chainId];

  // Map status to display text
  const getStatusText = () => {
    switch (session?.status || directDepositSession.status) {
      case 'pending':
        return 'Waiting for transfer';
      case 'detected':
        return 'Transfer detected';
      case 'processing':
        return 'Processing deposit...';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'expired':
        return 'Session expired';
      default:
        return 'Waiting for transfer';
    }
  };

  const isCompleted =
    session?.status === 'completed' || directDepositSession.status === 'completed';
  const isExpired = session?.status === 'expired' || directDepositSession.status === 'expired';

  // TODO: Calculate estimated time based on chainId
  const estimatedTime = chainId === 1 ? '5 minutes' : '30 minutes';

  return (
    <View className="flex items-center justify-center gap-6 px-4">
      {/* Title Text */}
      <Text className="text-xl font-semibold text-center">
        Transfer USDC to this {network?.name || 'Ethereum'} address
      </Text>

      {/* QR Code and Address */}
      <View className="bg-primary/10 rounded-xl w-full max-w-md">
        <View className="justify-center items-center px-4 pt-14 pb-4 border-border/50">
          <View className="rounded-xl bg-white p-4">
            <QRCode value={directDepositSession.walletAddress || ''} size={200} />
          </View>
        </View>

        <View className="flex-col items-center justify-center gap-2">
          {/* Network Badge */}
          <View className="flex-row items-center gap-1.5 bg-primary/20 px-3 py-1.5 mt-4 rounded-full">
            <Image source={network?.icon} style={{ width: 20, height: 20 }} contentFit="contain" />
            <Text className="text-lg font-medium">{network?.name} network</Text>
          </View>

          {/* Divider */}
          <View className="w-full h-[1px] bg-[#303030] mt-4" />

          {/* Address */}
          <View className="flex-row items-center gap-2 mb-4 mt-2">
            <Text className="text-base">
              {directDepositSession.walletAddress
                ? eclipseAddress(directDepositSession.walletAddress, 6, 6)
                : ''}
            </Text>
            <CopyToClipboard
              text={directDepositSession.walletAddress || ''}
              className="text-primary"
            />
          </View>
        </View>
      </View>

      {/* Info Section */}
      {!isExpired && (
        <View className="bg-primary/10 rounded-xl p-4 w-full max-w-md gap-y-3">
          {/* APY - TODO: Replace with actual value */}
          <View className="flex-row justify-between items-center">
            <Text className="text-muted-foreground">APY</Text>
            <Text className="text-primary font-semibold">
              {session?.apy || directDepositSession.apy || '4.50'}%
            </Text>
          </View>

          {/* Min Deposit - TODO: Replace with actual value */}
          <View className="flex-row justify-between items-center">
            <Text className="text-muted-foreground">Min deposit</Text>
            <Text className="font-medium">
              {'< '}
              {session?.minDeposit || directDepositSession.minDeposit || '0.0001'} USDC
            </Text>
          </View>

          {/* Max Deposit - TODO: Replace with actual value */}
          <View className="flex-row justify-between items-center">
            <Text className="text-muted-foreground">Max deposit</Text>
            <Text className="font-medium">
              {session?.maxDeposit || directDepositSession.maxDeposit || '500,000'} USDC
            </Text>
          </View>

          {/* Estimated Time - TODO: Calculate based on chainId */}
          <View className="flex-row justify-between items-center">
            <Text className="text-muted-foreground">Estimated time</Text>
            <Text className="font-medium">{estimatedTime}</Text>
          </View>

          {/* Status */}
          <View className="flex-row justify-between items-center">
            <Text className="text-muted-foreground">Status</Text>
            <Text
              className={`font-medium ${
                isCompleted
                  ? 'text-green-500'
                  : session?.status === 'failed'
                    ? 'text-red-500'
                    : 'text-yellow-500'
              }`}
            >
              {getStatusText()}
            </Text>
          </View>

          {/* Fee - TODO: Replace with actual value */}
          <View className="flex-row justify-between items-center">
            <Text className="text-muted-foreground">Fee</Text>
            <Text className="font-medium">
              {session?.fee || directDepositSession.fee || '2.3'} USDC
            </Text>
          </View>
        </View>
      )}

      {/* Expired Message */}
      {isExpired && (
        <View className="bg-red-500/10 rounded-xl p-4 w-full max-w-md">
          <Text className="text-red-500 text-center font-medium">
            Session expired. Please create a new deposit session.
          </Text>
        </View>
      )}

      {/* Done Button */}
      <Button
        onPress={handleDone}
        disabled={!isCompleted && !isExpired}
        className={`w-full max-w-md ${
          isCompleted || isExpired ? 'bg-green-500' : 'bg-gray-500 opacity-50'
        }`}
      >
        <Text className={`font-bold ${isCompleted || isExpired ? 'text-white' : 'text-gray-400'}`}>
          Done
        </Text>
      </Button>
    </View>
  );
};

export default DepositDirectlyAddress;
