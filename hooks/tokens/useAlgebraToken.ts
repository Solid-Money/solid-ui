import { ADDRESS_ZERO, ExtendedNative, Token } from '@cryptoalgebra/fuse-sdk';
import { useMemo } from 'react';
import { useReadContracts } from 'wagmi';

// import { DEFAULT_CHAIN_ID, DEFAULT_NATIVE_NAME, DEFAULT_NATIVE_SYMBOL } from '@/constants/default-chain-id';
import { Address, erc20Abi } from 'viem';
import { fuse } from 'viem/chains';
import { useAllTokens } from './useAllTokens';

export function useAlgebraToken(address: Address | undefined) {
    if (!address) {
        return;
    }
    const isNativeToken = address === ADDRESS_ZERO;

    const { tokens, isLoading: useAllTokensLoading } = useAllTokens();
    const token = address ? tokens.find((token) => token.address.toLowerCase() === address.toLowerCase()) : undefined;

    const { data, error, isLoading } = useReadContracts({
        contracts: [
            {
                address: address,
                abi: erc20Abi,
                functionName: 'symbol',
            },
            {
                address: address,
                abi: erc20Abi,
                functionName: 'name',
            },

            {
                address: address,
                abi: erc20Abi,
                functionName: 'decimals',
            },
        ],
    });

    return useMemo(() => {
        if (!address) return;

        if (isNativeToken) {
            return ExtendedNative.onChain(fuse.id, fuse.nativeCurrency.symbol, fuse.nativeCurrency.name);
        }

        if (token) {
            return new Token(fuse.id, token.address, Number(token.decimals), token.symbol, token.name);
        }

        if (isLoading || !data || error) {
            return undefined;
        }

        const [symbol, name, decimals] = data.map((item) => item.result as string);

        return new Token(fuse.id, address, parseInt(decimals), symbol, name); // TODO: check if decimals is a number
    }, [address, data, error, isLoading, token, useAllTokensLoading]);
}
