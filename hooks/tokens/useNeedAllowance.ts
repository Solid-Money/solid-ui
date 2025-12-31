import useUser from '@/hooks/useUser';
import { Currency, CurrencyAmount } from '@cryptoalgebra/fuse-sdk';
import { Address, erc20Abi } from 'viem';
import { fuse } from 'viem/chains';
import { useReadContract } from 'wagmi';

export function useNeedAllowance(
  currency: Currency | null | undefined,
  amount: CurrencyAmount<Currency> | undefined,
  spender: Address | undefined,
) {
  const { user } = useUser();
  const account = user?.safeAddress;

  const { data: allowance, isError } = useReadContract({
    address: currency?.wrapped.address as Address,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [account, spender] as [Address, Address],
    chainId: fuse.id,
    query: {
      enabled: Boolean(currency?.wrapped.address && account && spender && !currency?.isNative),
    },
  });

  if (!user) {
    return false;
  }

  // If the currency is native, no allowance is needed
  if (currency?.isNative) {
    return false;
  }

  // If we have an error reading allowance or no allowance data,
  // assume we need allowance for safety (better to approve unnecessarily than fail)
  if (isError || allowance === undefined) {
    return Boolean(currency && !currency.isNative && amount && amount.greaterThan(0));
  }

  // Check if current allowance is less than the amount needed
  return Boolean(
    amount &&
    typeof allowance === 'bigint' &&
    amount.greaterThan(allowance.toString()),
  );
}
