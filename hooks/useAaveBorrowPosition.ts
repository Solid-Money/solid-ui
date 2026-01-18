import { useMemo } from 'react';
import { Address, formatUnits } from 'viem';
import { useReadContract } from 'wagmi';

import { USDC_STARGATE } from '@/constants/addresses';
import { MarketData } from '@/constants/lend';
import { UiPoolDataProviderV3_ABI } from '@/lib/abis/UiPoolDataProviderV3';
import { useMaxAPY } from '@/hooks/useAnalytics';
import { fuseConfig } from '@/lib/wagmi';
import useUser from '@/hooks/useUser';
import { ADDRESSES } from '@/lib/config';

interface AaveBorrowPositionData {
    totalBorrowed: number;
    totalSupplied: number;
    borrowAPY: number;
    savingsAPY: number;
    cashbackAPY: number;
    netAPY: number;
    isLoading: boolean;
    error: Error | null;
}

export function useAaveBorrowPosition(): AaveBorrowPositionData {
    const { user } = useUser();
    const { maxAPY: savingsAPY, isAPYsLoading: isSavingsAPYLoading } = useMaxAPY();
    const userAddress = user?.safeAddress as Address | undefined;

    // getUserReservesData returns [UserReserveData[], uint8]
    const { data: userReservesResult, isLoading: isLoadingUserReserves, error: userReservesError } =
        useReadContract({
            address: MarketData.addresses.UI_POOL_DATA_PROVIDER,
            abi: UiPoolDataProviderV3_ABI,
            functionName: 'getUserReservesData',
            args: [MarketData.addresses.LENDING_POOL_ADDRESS_PROVIDER, userAddress!],
            config: fuseConfig,
            query: {
                enabled: !!userAddress,
            },
        });

    // getReservesData returns [AggregatedReserveData[], BaseCurrencyInfo]
    const { data: reservesResult, isLoading: isLoadingReserves, error: reservesError } =
        useReadContract({
            address: MarketData.addresses.UI_POOL_DATA_PROVIDER,
            abi: UiPoolDataProviderV3_ABI,
            functionName: 'getReservesData',
            args: [MarketData.addresses.LENDING_POOL_ADDRESS_PROVIDER],
            config: fuseConfig,
            query: {
                enabled: !!userAddress,
            },
        });

    const isLoading = isLoadingUserReserves || isLoadingReserves || isSavingsAPYLoading;
    const error = userReservesError || reservesError;

    const positionData = useMemo(() => {
        if (!userReservesResult || !reservesResult || isLoading) {
            return {
                totalBorrowed: 0,
                totalSupplied: 0,
                borrowAPY: 0,
                savingsAPY: savingsAPY || 0,
                cashbackAPY: 0,
                netAPY: 0,
                isLoading: true,
                error: null,
            };
        }

        // getUserReservesData returns [UserReserveData[], uint8]
        // Extract the first element which is the array
        const userReserves = Array.isArray(userReservesResult) ? userReservesResult[0] : [];
        // getReservesData returns [AggregatedReserveData[], BaseCurrencyInfo]
        // Extract the first element which is the array
        const reserves = Array.isArray(reservesResult) ? reservesResult[0] : [];

        // Find USDC user reserve data
        const usdcUserReserve = userReserves.find(
            (reserve: any) =>
                reserve.underlyingAsset?.toLowerCase() === USDC_STARGATE.toLowerCase(),
        );

        // Find USDC reserve data (for rates and indices)
        const usdcReserve = reserves.find(
            (reserve: any) =>
                reserve.underlyingAsset?.toLowerCase() === USDC_STARGATE.toLowerCase(),
        );

        // Find soUSD user reserve data
        const soUsdUserReserve = userReserves.find(
            (reserve: any) =>
                reserve.underlyingAsset?.toLowerCase() === ADDRESSES.fuse.vault.toLowerCase(),
        );

        // Find soUSD reserve data (for liquidity index)
        const soUsdReserve = reserves.find(
            (reserve: any) =>
                reserve.underlyingAsset?.toLowerCase() === ADDRESSES.fuse.vault.toLowerCase(),
        );

        // Calculate total supplied (soUSD)
        let totalSupplied = 0;
        if (soUsdUserReserve && soUsdReserve) {
            const scaledATokenBalance = BigInt(soUsdUserReserve.scaledATokenBalance || 0);
            const liquidityIndex = BigInt(soUsdReserve.liquidityIndex || 0);

            if (scaledATokenBalance > 0n && liquidityIndex > 0n) {
                // Calculate actual supply: scaledATokenBalance * liquidityIndex / 1e27
                // liquidityIndex is scaled by 1e27
                const actualSupply = (scaledATokenBalance * liquidityIndex) / BigInt(1e27);
                totalSupplied = Number(formatUnits(actualSupply, 6)); // soUSD has 6 decimals
            }
        }

        if (!usdcUserReserve || !usdcReserve) {
            return {
                totalBorrowed: 0,
                totalSupplied,
                borrowAPY: 0,
                savingsAPY: savingsAPY || 0,
                cashbackAPY: 0,
                netAPY: -(savingsAPY || 0),
                isLoading: false,
                error: null,
            };
        }

        // Check if user has variable debt
        const scaledVariableDebt = BigInt(usdcUserReserve.scaledVariableDebt || 0);

        if (scaledVariableDebt === 0n) {
            return {
                totalBorrowed: 0,
                totalSupplied,
                borrowAPY: 0,
                savingsAPY: savingsAPY || 0,
                cashbackAPY: 0,
                netAPY: -(savingsAPY || 0),
                isLoading: false,
                error: null,
            };
        }

        // Get variableBorrowIndex from reserve data
        const variableBorrowIndex = BigInt(usdcReserve.variableBorrowIndex || 0);

        if (variableBorrowIndex === 0n) {
            return {
                totalBorrowed: 0,
                totalSupplied,
                borrowAPY: 0,
                savingsAPY: savingsAPY || 0,
                cashbackAPY: 0,
                netAPY: -(savingsAPY || 0),
                isLoading: false,
                error: null,
            };
        }

        // Calculate actual debt: scaledVariableDebt * variableBorrowIndex / 1e27
        // variableBorrowIndex is scaled by 1e27
        const actualDebt = (scaledVariableDebt * variableBorrowIndex) / BigInt(1e27);
        const totalBorrowed = Number(formatUnits(actualDebt, 6)); // USDC has 6 decimals

        // Get borrow APY from variableBorrowRate (already in ray)
        const variableBorrowRate = BigInt(usdcReserve.variableBorrowRate || 0);

        const borrowAPY = (Number(variableBorrowRate) / 1e27) * 100;

        // Cashback APY is hardcoded to 0
        const cashbackAPY = 0;

        // Calculate net APY: Borrow APY - Savings APY - Cashback APY
        const netAPY = (savingsAPY || 0) - borrowAPY;

        return {
            totalBorrowed,
            totalSupplied,
            borrowAPY,
            savingsAPY: savingsAPY || 0,
            cashbackAPY,
            netAPY,
            isLoading: false,
            error: null,
        };
    }, [userReservesResult, reservesResult, isLoading, savingsAPY]);

    return {
        ...positionData,
        isLoading,
        error: error as Error | null,
    };
}
