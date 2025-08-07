import { Token, WNATIVE } from '@cryptoalgebra/fuse-sdk';

import { ChainsId } from './chains';
import { STABLECOINS_TOKENS } from './tokens';

type ChainTokenList = {
    readonly [chainId: number]: Token[];
};

export const WNATIVE_EXTENDED: { [chainId: number]: Token } = {
    ...WNATIVE,
};

const WNATIVE_ONLY: ChainTokenList = Object.fromEntries(
    Object.entries(WNATIVE_EXTENDED).map(([key, value]) => [key, [value]])
);

export const BASES_TO_CHECK_TRADES_AGAINST: ChainTokenList = {
    ...WNATIVE_ONLY,
    [ChainsId.Fuse]: [...WNATIVE_ONLY[ChainsId.Fuse], ...Object.values(STABLECOINS_TOKENS)],
};

export const VOLTAGE_FINANCE_API_ROUTER = 'https://router.voltage.finance/swap/v1/quote';
