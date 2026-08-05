import { View } from 'react-native';
import { ArrowDown, ArrowUp } from 'lucide-react-native';

import HomeSwap from '@/assets/images/home-swap';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import { TokenIcon, TransactionType } from '@/lib/types';
import { cn } from '@/lib/utils';

export type ActivityBadge = 'incoming' | 'send' | 'swap';

const INCOMING_BADGE_TYPES = new Set<TransactionType>([
  TransactionType.RECEIVE,
  TransactionType.DEPOSIT,
  TransactionType.BRIDGE_DEPOSIT,
  TransactionType.BORROW_AND_DEPOSIT_TO_CARD,
  TransactionType.CARD_DEPOSIT,
  TransactionType.CARD_TRANSACTION,
  TransactionType.FUND,
  TransactionType.BRIDGE_TRANSFER,
  TransactionType.BANK_TRANSFER,
  TransactionType.MERCURYO_TRANSACTION,
  TransactionType.RESCUE_TOKEN,
]);

const OUTGOING_BADGE_TYPES = new Set<TransactionType>([
  TransactionType.SEND,
  TransactionType.UNSTAKE,
  TransactionType.WITHDRAW,
  TransactionType.FAST_WITHDRAW,
  TransactionType.REPAY_AND_WITHDRAW_COLLATERAL,
  TransactionType.WITHDRAW_COLLATERAL,
]);

type ActivityTokenIconProps = {
  tokenIcon: TokenIcon;
  size: number;
  badge?: ActivityBadge;
  variant: 'detail' | 'list';
};

export const getActivityBadge = (type?: TransactionType): ActivityBadge | undefined => {
  if (type && INCOMING_BADGE_TYPES.has(type)) return 'incoming';
  if (type && OUTGOING_BADGE_TYPES.has(type)) return 'send';
  if (
    type === TransactionType.SWAP ||
    type === TransactionType.WRAP ||
    type === TransactionType.UNWRAP
  ) {
    return 'swap';
  }
  return undefined;
};

/** Token icon with the transaction badge used in activity lists and details. */
export default function ActivityTokenIcon({
  tokenIcon,
  size,
  badge,
  variant,
}: ActivityTokenIconProps) {
  const isList = variant === 'list';
  const arrowSize = isList ? 12 : 18;
  const swapSize = isList ? 14 : 20;

  return (
    <View className="relative">
      <RenderTokenIcon tokenIcon={tokenIcon} size={size} />
      {badge && (
        <View
          className={cn(
            'absolute items-center justify-center rounded-full border-[#1C1C1C] bg-white',
            isList ? 'h-5 w-5 border-2' : 'h-[34px] w-[34px] border-[3px]',
          )}
          style={isList ? { left: -5, top: -2 } : { left: -9, top: -3 }}
        >
          {badge === 'incoming' && <ArrowDown size={arrowSize} color="#000000" strokeWidth={2.5} />}
          {badge === 'send' && <ArrowUp size={arrowSize} color="#000000" strokeWidth={2.5} />}
          {badge === 'swap' && (
            <HomeSwap width={swapSize} height={swapSize} viewBox="0 0 29 28" stroke="#000000" />
          )}
        </View>
      )}
    </View>
  );
}
