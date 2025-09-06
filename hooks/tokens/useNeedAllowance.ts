import useUser from '@/hooks/useUser';
import { Currency, CurrencyAmount } from '@cryptoalgebra/fuse-sdk';
import { Address, erc20Abi } from 'viem';
import { useReadContract } from 'wagmi';

export function useNeedAllowance(
  currency: Currency | null | undefined,
  amount: CurrencyAmount<Currency> | undefined,
  spender: Address | undefined,
) {
  const { user } = useUser();
  const account = user?.safeAddress;

  const { data: allowance } = useReadContract({
    address: currency?.wrapped.address as Address,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [account, spender] as [Address, Address],
  });

  if (!user) {
    return false;
  }

  return Boolean(
    !currency?.isNative &&
      typeof allowance === 'bigint' &&
      amount &&
      amount.greaterThan(allowance.toString()),
  );
}
