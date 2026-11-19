import ApplePayCircle from '@/assets/images/apple-pay-circle';
import GooglePayCircle from '@/assets/images/google-pay-circle';

import type { WalletTopUpMethod } from '@/lib/types/wallet-topup';

/**
 * The wallet's mark on its dark disc — the same ones the home "Add to Apple Pay"
 * and "Add to Google Wallet" prompts use — at the size of the row it sits in.
 */
const WalletTopUpIcon = ({ method, size }: { method: WalletTopUpMethod; size: number }) =>
  method === 'apple_pay' ? (
    <ApplePayCircle width={size} height={size} />
  ) : (
    <GooglePayCircle size={size} />
  );

export default WalletTopUpIcon;
