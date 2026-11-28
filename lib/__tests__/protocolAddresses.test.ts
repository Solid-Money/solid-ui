import { ADDRESSES } from '@/lib/config';
import {
  BRIDGE_PAYMASTER_RECIPIENT_ERROR,
  getSystemRecipientError,
  isBridgePaymasterAddress,
  isSolidSystemAddress,
  SOLID_SETTLEMENT_TREASURY,
  SYSTEM_ADDRESS_RECIPIENT_ERROR,
} from '@/lib/protocolAddresses';
import { getRecentSendRecipients } from '@/lib/sendRecipients';
import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';

// jest.mock is hoisted above the imports, so the relayer is set before
// protocolAddresses reads the config.
const RELAYER = '0x9e852a0D1Bd9738d52b90a5E907138575822D69e';

jest.mock('@/lib/config', () => ({
  ...jest.requireActual('@/lib/config'),
  EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS: '0x9e852a0D1Bd9738d52b90a5E907138575822D69e',
}));

const send = (toAddress: string, timestamp: string, chainId = 122): ActivityEvent => ({
  clientTxId: `${toAddress}-${timestamp}`,
  title: 'Send',
  timestamp,
  type: TransactionType.SEND,
  status: TransactionStatus.SUCCESS,
  amount: '1',
  symbol: 'USDT',
  toAddress,
  chainId,
});

describe('Solid system addresses', () => {
  it('treats the relayer and the settlement treasury as system addresses, whatever the casing', () => {
    for (const address of [RELAYER, SOLID_SETTLEMENT_TREASURY]) {
      expect(isSolidSystemAddress(address)).toBe(true);
      expect(isSolidSystemAddress(address.toLowerCase())).toBe(true);
      expect(isSolidSystemAddress(address.toUpperCase().replace('0X', '0x'))).toBe(true);
    }
  });

  it('still counts the BridgePaymasters, and keeps their own message', () => {
    expect(isSolidSystemAddress(ADDRESSES.fuse.bridgePaymasterAddress)).toBe(true);
    expect(getSystemRecipientError(ADDRESSES.ethereum.bridgePaymasterAddress)).toBe(
      BRIDGE_PAYMASTER_RECIPIENT_ERROR,
    );
  });

  it('does not widen the paymaster check itself', () => {
    expect(isBridgePaymasterAddress(RELAYER)).toBe(false);
    expect(isBridgePaymasterAddress(SOLID_SETTLEMENT_TREASURY)).toBe(false);
  });

  it('explains why the relayer and treasury cannot be recipients', () => {
    expect(getSystemRecipientError(RELAYER)).toBe(SYSTEM_ADDRESS_RECIPIENT_ERROR);
    expect(getSystemRecipientError(SOLID_SETTLEMENT_TREASURY)).toBe(SYSTEM_ADDRESS_RECIPIENT_ERROR);
  });

  it('lets an ordinary wallet through', () => {
    const wallet = '0x158e1A979f7106Fc3d17cbf089F30297e66ACF76';
    expect(isSolidSystemAddress(wallet)).toBe(false);
    expect(getSystemRecipientError(wallet)).toBeNull();
    expect(getSystemRecipientError(undefined)).toBeNull();
    expect(getSystemRecipientError('')).toBeNull();
  });

  it('never offers the relayer or treasury as a recent recipient', () => {
    // A deposit from a wallet is indexed as a plain "Send USDT" to the relayer,
    // and a card settlement as a "Send USDC.E" to the treasury.
    const recipients = getRecentSendRecipients(
      [
        send(RELAYER.toLowerCase(), '300', 56),
        send(SOLID_SETTLEMENT_TREASURY, '250'),
        send('0xabc', '100'),
      ],
      [],
    );
    expect(recipients.map(recipient => recipient.walletAddress)).toEqual(['0xabc']);
  });
});
