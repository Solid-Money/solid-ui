import { ADDRESS_ZERO, Currency, ExtendedNative, WNATIVE } from '@cryptoalgebra/fuse-sdk';
import { Address } from 'viem';
// import { DEFAULT_CHAIN_ID, DEFAULT_NATIVE_NAME, DEFAULT_NATIVE_SYMBOL } from '@/constants/default-chain-id';

import { useAlgebraToken } from '@/hooks/tokens/useAlgebraToken';
import { fuse } from 'viem/chains';

export function useCurrency(address: Address | undefined, withNative?: boolean): Currency | ExtendedNative | undefined {
    const isWNative = address?.toLowerCase() === WNATIVE[fuse.id].address.toLowerCase();
    const isNative = address === ADDRESS_ZERO;

    const token = useAlgebraToken(isNative || isWNative ? ADDRESS_ZERO : address);

    // Native token as a currency
    const fuseToken = ExtendedNative.onChain(fuse.id, fuse.nativeCurrency.symbol, fuse.nativeCurrency.name);

    if (withNative) {
        return isNative || isWNative ? fuseToken : token;
    }

    if (isWNative) {
        return fuseToken.wrapped;
    }

    return isNative ? fuseToken : token;
}
