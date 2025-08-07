import { ContractConfig, defineConfig } from '@wagmi/cli';
import { actions, react } from '@wagmi/cli/plugins';

import {
    ALGEBRA_ROUTER
} from '@/constants/addresses';
import {
    algebraBasePluginABI,
    algebraPoolABI,
    algebraRouterABI,
    pegSwapABI,
    wNativeABI,
} from '@/lib/abis';

const contracts: ContractConfig[] = [
    {
        abi: algebraPoolABI,
        name: 'AlgebraPool',
    },
    {
        abi: algebraBasePluginABI,
        name: 'AlgebraBasePlugin',
    },
    {
        address: ALGEBRA_ROUTER,
        abi: algebraRouterABI,
        name: 'AlgebraRouter',
    },
    {
        abi: wNativeABI,
        name: 'WrappedNative',
    },
    {
        abi: pegSwapABI,
        name: 'PegSwap',
    },
];

export default defineConfig({
    out: 'generated/wagmi.ts',
    contracts,
    plugins: [
        actions({
        }),
        react({
        }),
    ],
});
