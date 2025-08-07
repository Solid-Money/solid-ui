import { useEffect, useState } from 'react';

import { TokenListItem } from '@/lib/types/tokens';

const VOLTAGE_SWAP_DEFAULT_TOKEN_LIST_URL =
    'https://raw.githubusercontent.com/voltfinance/swap-default-token-list/master/build/voltage-swap-default.tokenlist.json';

export function useFetchTokenList() {
    const [tokenList, setTokenList] = useState<TokenListItem[] | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        async function fetchTokenList() {
            try {
                const response = await fetch(VOLTAGE_SWAP_DEFAULT_TOKEN_LIST_URL);
                if (!response.ok) {
                    throw new Error('Failed to fetch token list');
                }
                const data = await response.json();
                const tokenList = data.tokens;
                setTokenList(tokenList);
            } catch (err) {
                setError(err as Error);
            } finally {
                setLoading(false);
            }
        }

        if (!tokenList) {
            fetchTokenList();
        }
    }, [tokenList]);

    return { tokenList, loading, error };
}
