import Accountant from "@/lib/abis/Accountant";
import { ADDRESSES } from "@/lib/config";
import { wagmi } from "@/lib/wagmi";
import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { readContractQueryOptions } from "wagmi/query";

export const usePreviewDeposit = (amount: string) => {
    const queryClient = useQueryClient();

    const { data: exchangeRate, isLoading } = useQuery({
        queryKey: [Accountant, "previewDeposit"],
        queryFn: () =>
            fetchExchangeRate(queryClient),
        refetchOnWindowFocus: false,
    });
    const amountOut = (Number(amount) * 10 ** 6) / Number(exchangeRate);
    return { amountOut, isLoading, exchangeRate };
};

export const fetchExchangeRate = async (
    queryClient: QueryClient,
) => {
    const exchangeRate = await queryClient.fetchQuery(
        readContractQueryOptions(wagmi.config, {
            abi: Accountant,
            address: ADDRESSES.ethereum.accountant,
            functionName: "getRate",
            chainId: 1,
        }),
    );
    return exchangeRate;
};