import { parseUnits, zeroAddress } from 'viem';

import { SEND_MODAL } from '@/constants/modals';
import { TokenBalance, TokenType } from '@/lib/types';
import { SwapReceipt } from '@/store/swapStore';
import { useSendStore } from '@/store/useSendStore';

/** The coin a swap just delivered, as Send knows a balance. */
export function receivedToken(receipt: SwapReceipt): TokenBalance {
  const { toAsset } = receipt;
  let balance = '0';
  try {
    balance = parseUnits(String(receipt.toAmount), toAsset.decimals).toString();
  } catch {
    // An amount Send can't read starts it empty; it reads the wallet anyway.
  }
  return {
    contractTickerSymbol: toAsset.symbol,
    contractName: toAsset.name,
    contractAddress: toAsset.isNative ? zeroAddress : toAsset.address,
    balance,
    contractDecimals: toAsset.decimals,
    type: toAsset.isNative ? TokenType.NATIVE : TokenType.ERC20,
    chainId: toAsset.chainId,
    logoUrl: toAsset.logoURI,
  };
}

/** Opens Send on the coin the swap delivered, at the recipient step. */
export function openSendWithReceived(receipt: SwapReceipt) {
  const token = receivedToken(receipt);
  const send = useSendStore.getState();
  send.setSelectedToken(token);
  send.setCurrentTokenAddress(token.contractAddress);
  send.setModal(SEND_MODAL.OPEN_SEND_SEARCH);
}
