import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { entryPoint07Address } from 'viem/account-abstraction';
import { http } from 'wagmi';
import { USER } from './config';
import { getChain } from './wagmi';

export const pimlicoClient = (chainId: number) => {
  const chain = getChain(chainId);
  return createPimlicoClient({
    chain,
    transport: http(USER.pimlicoUrl(chainId)),
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7',
    },
  });
};
