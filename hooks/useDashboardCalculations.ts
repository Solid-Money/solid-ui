import {
    calculateOriginalDepositAmount,
    getEarliestDepositTimestamp
} from "@/lib/utils/financial";
import { useMemo } from "react";


export const useDashboardCalculations = (
    userDepositTransactions: any,
    balance?: number,
    lastTimestamp?: number
) => {
    const originalDepositAmount = useMemo(() => {
        try {
            if (balance === 0) {
                console.log("Dashboard Calculations: Balance is 0, returning 0 for principal");
                return 0;
            }

            const calculated = calculateOriginalDepositAmount(userDepositTransactions);
            // Only fallback to balance if we have valid balance and no deposits found
            if (calculated === 0 && balance && isFinite(balance) && balance > 0) {
                return balance;
            }
            return Math.max(0, calculated); // Ensure non-negative
        } catch (error) {
            console.error('Error calculating original deposit amount:', error);
            return balance && isFinite(balance) && balance > 0 ? balance : 0;
        }
    }, [userDepositTransactions, balance]);

    const firstDepositTimestamp = useMemo(() => {
        try {
            if (balance === 0) {
                console.log("Dashboard Calculations: Balance is 0, returning undefined for timestamp");
                return undefined;
            }

            const timestamp = getEarliestDepositTimestamp(userDepositTransactions, lastTimestamp);
            // Validate timestamp is reasonable (not in future, not too old)
            if (timestamp && timestamp > 0 && timestamp <= Math.floor(Date.now() / 1000)) {
                return timestamp;
            }
            return lastTimestamp && lastTimestamp > 0 ? lastTimestamp : undefined;
        } catch (error) {
            console.error('Error getting earliest deposit timestamp:', error);
            return lastTimestamp && lastTimestamp > 0 ? lastTimestamp : undefined;
        }
    }, [userDepositTransactions, lastTimestamp, balance]);

    return {
        originalDepositAmount,
        firstDepositTimestamp,
    };
}; 