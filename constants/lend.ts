import { ReactNode } from 'react';
import { Address } from 'viem';

export type MarketDataType = {
    v3?: boolean;
    marketTitle: string;
    // the network the market operates on
    chainId: number;
    enabledFeatures?: {
        liquiditySwap?: boolean;
        staking?: boolean;
        governance?: boolean;
        faucet?: boolean;
        collateralRepay?: boolean;
        incentives?: boolean;
        permissions?: boolean;
        debtSwitch?: boolean;
        withdrawAndSwitch?: boolean;
        switch?: boolean;
    };
    isFork?: boolean;
    permissionComponent?: ReactNode;
    disableCharts?: boolean;
    subgraphUrl?: string;
    addresses: {
        LENDING_POOL_ADDRESS_PROVIDER: Address;
        LENDING_POOL: Address;
        REWARDS_CONTROLLER: Address;
        WETH_GATEWAY?: Address;
        SWAP_COLLATERAL_ADAPTER?: Address;
        REPAY_WITH_COLLATERAL_ADAPTER?: Address;
        DEBT_SWITCH_ADAPTER?: Address;
        WITHDRAW_SWITCH_ADAPTER?: Address;
        FAUCET?: Address;
        PERMISSION_MANAGER?: Address;
        WALLET_BALANCE_PROVIDER: Address;
        L2_ENCODER?: Address;
        UI_POOL_DATA_PROVIDER: Address;
        UI_INCENTIVE_DATA_PROVIDER?: Address;
        COLLECTOR?: Address;
        V3_MIGRATOR?: Address;
        GHO_TOKEN_ADDRESS?: Address;
        GHO_UI_DATA_PROVIDER?: Address;
    };
    /**
     * https://www.hal.xyz/ has integrated aave for healtfactor warning notification
     * the integration doesn't follow aave market naming & only supports a subset of markets.
     * When a halIntegration is specified a link to hal will be displayed on the ui.
     */
    halIntegration?: {
        URL: string;
        marketName: string;
    };
};

export const MarketData: MarketDataType = {
    marketTitle: 'Fuse',
    chainId: 122,
    v3: true,
    enabledFeatures: {
        governance: true,
        staking: false,
        liquiditySwap: false,
        collateralRepay: true,
        incentives: true,
        withdrawAndSwitch: false,
        debtSwitch: false,
        switch: false,
    },
    subgraphUrl: 'https://api.studio.thegraph.com/query/78455/aave-v3/version/latest',
    addresses: {
        LENDING_POOL_ADDRESS_PROVIDER: '0x72749C8543dD9Ad0A3f7661d09bc40b0315016a2',
        LENDING_POOL: '0xe3eda4b12ae4ACC031E4CF9Eae08ACe6250CED3E',
        WETH_GATEWAY: '0x31cfB6E1DB90379Eb1eACE5f34750a835d819250',
        // REPAY_WITH_COLLATERAL_ADAPTER: AaveV3Ethereum.REPAY_WITH_COLLATERAL_ADAPTER,
        // SWAP_COLLATERAL_ADAPTER: AaveV3Ethereum.SWAP_COLLATERAL_ADAPTER,
        WALLET_BALANCE_PROVIDER: '0xAA0da9b5970146284F6293FA87077E6721c4CaE3',
        UI_POOL_DATA_PROVIDER: '0x81820666713295494Ae33a260E677faA65dB2F53',
        UI_INCENTIVE_DATA_PROVIDER: '0x67902071b77C5E116D12F9C56f9D5E5000aFcC59',
        REWARDS_CONTROLLER: '0x882edA795bE0bdC1a0C3e14D6a6AE01D96843cC9',
        COLLECTOR: '0x0000000000000000000000000000000000000000',
    },
    halIntegration: {
        URL: 'https://app.hal.xyz/recipes/aave-v3-track-health-factor',
        marketName: 'aavev3',
    },
};
