export function getSwapFundingError({
  balance,
  requiredInput,
  hasAmount,
  symbol,
}: {
  balance?: bigint;
  requiredInput?: bigint;
  hasAmount: boolean;
  symbol: string;
}): string | undefined {
  if (!hasAmount || balance === undefined) return undefined;

  if (balance === 0n || (requiredInput !== undefined && balance < requiredInput)) {
    return `Not enough ${symbol} on Fuse. Add funds to continue.`;
  }

  return undefined;
}
