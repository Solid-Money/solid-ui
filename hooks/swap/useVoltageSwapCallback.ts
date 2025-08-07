import { useCallback, useMemo, useState } from 'react';

import { SwapCallbackState } from '@/lib/types/swap-state';
// import { ApprovalStateType } from '@/types/approve-state';
// import { formatBalance } from '@/utils/common/formatBalance';
// import { useTransactionAwait } from '../common/useTransactionAwait';
import { executeTransactions } from '@/lib/execute';
import { Address } from 'abitype';
import { fuse } from 'viem/chains';
import { useTransactionAwait } from '../useTransactionAwait';
import useUser from '../useUser';
import { VoltageTrade } from './useVoltageRouter';

export function useVoltageSwapCallback(trade: VoltageTrade | undefined) {
    const { user, safeAA } = useUser();
    const account = user?.safeAddress;
    const [swapData, setSwapData] = useState<any>(null);
    const [isSendingSwap, setIsSendingSwap] = useState(false);

    // const { sendTransactionAsync, data } = useSendTransaction();

    const swapCallback = useCallback(async () => {
        if (!trade || !account || !user?.suborgId || !user?.signWith) return;

        try {
            setIsSendingSwap(true);
            const smartAccountClient = await safeAA(
                fuse,
                user.suborgId,
                user.signWith
            );

            const transactions = [
                {
                    to: trade?.to as Address,
                    data: trade?.data as `0x${string}`,
                    value: BigInt(trade?.value?.quotient.toString() || '0'),
                },
            ];

            const result = await executeTransactions(
                smartAccountClient,
                transactions,
                "Send failed",
                fuse
            );


            setSwapData(result);
            return result;
        } finally {
            setIsSendingSwap(false);
        }
    }, [trade, account, safeAA, user]);

    const { isLoading, isSuccess } = useTransactionAwait(swapData?.transactionHash);

    return useMemo(() => {
        if (!trade)
            return {
                state: SwapCallbackState.INVALID,
                callback: null,
                error: 'No trade was found',
                isLoading: false,
                isSuccess: false,
            };

        return {
            state: SwapCallbackState.VALID,
            callback: swapCallback,
            error: null,
            isLoading: isSendingSwap || isLoading,
            isSuccess,
        };
    }, [trade, swapCallback, isLoading, isSuccess, isSendingSwap]);
}
