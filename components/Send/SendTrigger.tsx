import React from 'react';
import { ArrowUpRight } from 'lucide-react-native';
import { Address } from 'viem';
import { useShallow } from 'zustand/react/shallow';

import { Button, buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { TokenBalance, TokenType } from '@/lib/types';
import { useSendStore } from '@/store/useSendStore';

interface SendTriggerProps {
  token?: TokenBalance;
  tokenAddress?: Address;
  tokenDecimals?: number;
  tokenSymbol?: string;
  chainId?: number;
  tokenType?: TokenType;
  onPress?: () => void;
}

const SendTrigger: React.FC<SendTriggerProps> = ({
  token,
  tokenAddress,
  tokenDecimals,
  tokenSymbol,
  chainId,
  tokenType,
  onPress,
}) => {
  const { setSelectedToken, setModal, setCurrentTokenAddress } = useSendStore(
    useShallow(state => ({
      setSelectedToken: state.setSelectedToken,
      setModal: state.setModal,
      setCurrentTokenAddress: state.setCurrentTokenAddress,
    })),
  );

  const handlePress = () => {
    if (token) {
      setSelectedToken(token);
      setCurrentTokenAddress(token.contractAddress);
      track(TRACKING_EVENTS.SEND_MODAL_OPENED, {
        token_symbol: token.contractTickerSymbol,
        token_address: token.contractAddress,
        chain_id: token.chainId,
      });
    } else if (tokenAddress && chainId && tokenDecimals && tokenSymbol) {
      const tokenFromProps: TokenBalance = {
        contractAddress: tokenAddress,
        contractDecimals: tokenDecimals,
        contractTickerSymbol: tokenSymbol,
        contractName: tokenSymbol,
        chainId: chainId,
        type: tokenType ?? TokenType.ERC20,
        balance: '0',
        logoUrl: undefined,
        quoteRate: 0,
      };
      setSelectedToken(tokenFromProps);
      setCurrentTokenAddress(tokenAddress);
      track(TRACKING_EVENTS.SEND_MODAL_OPENED, {
        token_symbol: tokenSymbol,
        token_address: tokenAddress,
        chain_id: chainId,
      });
    }

    setModal(SEND_MODAL.OPEN_SEND_SEARCH);
    onPress?.();
  };

  return (
    <Button
      variant="outline"
      className={buttonVariants({
        variant: 'secondary',
        className: 'gap-4 rounded-xl border-0 md:h-12 md:pr-6',
      })}
      onPress={handlePress}
    >
      <ArrowUpRight color="white" />
      <Text className="font-bold">Send</Text>
    </Button>
  );
};

export default SendTrigger;
