import deepMerge from 'lodash.merge';
import { Address } from 'viem';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import mmkvStorage from '@/lib/mmvkStorage';
import { TokenListItem } from '@/lib/types/tokens';

interface ImportedTokens {
    [chain: number]: TokenListItem[];
}

interface TokensState {
    importedTokens: ImportedTokens;
    actions: {
        importToken: (address: Address, symbol: string, name: string, decimals: number, chainId: number) => void;
    };
}

export const useTokensState = create(
    persist<TokensState>(
        (set, get) => ({
            importedTokens: {},
            actions: {
                importToken: (address, symbol, name, decimals, chainId) => {
                    const { importedTokens } = get();

                    set({
                        importedTokens: {
                            ...importedTokens,
                            [chainId]: {
                                ...importedTokens[chainId],
                                [address]: {
                                    address,
                                    symbol,
                                    name,
                                    decimals,
                                },
                            },
                        },
                    });
                },
            },
        }),
        {
            name: 'tokens-storage',
            storage: createJSONStorage(() => mmkvStorage('tokens-storage')),
            merge: (persistedState, currentState) => deepMerge(currentState, persistedState),
        }
    )
);
