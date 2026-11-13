import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Keyboard, Platform, Pressable, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Fuel, Wallet } from 'lucide-react-native';
import { Address, formatUnits } from 'viem';
import { base, fuse, mainnet } from 'viem/chains';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';

import { CheckConnectionWrapper } from '@/components/CheckConnectionWrapper';
import ConnectedWalletDropdown from '@/components/ConnectedWalletDropdown';
import EmptyDepositTokens from '@/components/DepositToVault/EmptyDepositTokens';
import VaultSelectorDropdown from '@/components/DepositToVault/VaultSelectorDropdown';
import Max from '@/components/Max';
import TokenDetails from '@/components/TokenCard/TokenDetails';
import TooltipPopover from '@/components/Tooltip';
import { Button } from '@/components/ui/button';
import Skeleton from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { WalletTokenButton } from '@/components/WalletTokenSelector';
import { getBridgeTokenDecimals } from '@/constants/bridge';
import { explorerUrls, layerzero } from '@/constants/explorers';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { isStablecoinSymbol } from '@/constants/stablecoins';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useMaxAPY } from '@/hooks/useAnalytics';
import useDepositFromEOA from '@/hooks/useDepositFromEOA';
import useDepositFromEOABtc from '@/hooks/useDepositFromEOABtc';
import useDepositFromEOAEth from '@/hooks/useDepositFromEOAEth';
import useDepositFromEOAEur from '@/hooks/useDepositFromEOAEur';
import useDepositFromEOAFuse from '@/hooks/useDepositFromEOAFuse';
import useDepositFromSolidBtc from '@/hooks/useDepositFromSolidBtc';
import useDepositFromSolidEth from '@/hooks/useDepositFromSolidEth';
import useDepositFromSolidEur from '@/hooks/useDepositFromSolidEur';
import useDepositFromSolidFuse from '@/hooks/useDepositFromSolidFuse';
import useDepositFromSolidUsdc from '@/hooks/useDepositFromSolidUsdc';
import { useDimension } from '@/hooks/useDimension';
import { usePreviewDeposit } from '@/hooks/usePreviewDeposit';
import useUser from '@/hooks/useUser';
import useVaultDepositConfig from '@/hooks/useVaultDepositConfig';
import { useVaultExchangeRate } from '@/hooks/useVaultExchangeRate';
import { useWalletTokens } from '@/hooks/useWalletTokens';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { getAttributionChannel } from '@/lib/attribution';
import { EXPO_PUBLIC_FUSE_GAS_RESERVE } from '@/lib/config';
import getTokenIcon from '@/lib/getTokenIcon';
import { formatBtcAmount } from '@/lib/soBtc';
import { Status, TokenBalance, TokenType, VaultType } from '@/lib/types';
import { compactNumberFormat, eclipseAddress, formatNumber } from '@/lib/utils';
import { showTextInputFromStart } from '@/lib/utils/textInput';
import { formatVaultAmount, getVaultCurrencySymbol } from '@/lib/vaultCurrency';
import {
  getAllowedTokensForChain,
  getDefaultDepositSelection,
  getLargestDepositSelection,
  getVaultDepositToken,
} from '@/lib/vaults';
import { useAttributionStore } from '@/store/useAttributionStore';
import { useDepositStore } from '@/store/useDepositStore';
import { selectedRewardsUserId, useRewardsUpgradeStore } from '@/store/useRewardsUpgradeStore';

function getGaslessText(
  minAmount: string,
  tokenSymbol: string | undefined,
  isSponsor: boolean,
): string {
  if (isSponsor) return 'Gasless deposit';
  // EURC is a euro stablecoin: its minimum reads in euros, never dollars.
  const amountLabel =
    tokenSymbol?.toUpperCase() === 'EURC'
      ? formatVaultAmount(Number(minAmount), VaultType.EUR, 2, 0)
      : isStablecoinSymbol(tokenSymbol)
        ? `$${minAmount}`
        : `${minAmount} ${tokenSymbol ?? 'token'}`;
  return `Gasless deposit - Please deposit above ${amountLabel} so we can cover your fees`;
}

/**
 * soBTC's note under the form. Either input ends as soBTC on Base; a WBTC deposit gets there over
 * LayerZero, whose fee is paid in ETH on Ethereum (from the Safe or the connected wallet).
 */
function getSoBtcDepositNote(chainId: number | undefined): string {
  if (chainId === mainnet.id) {
    return 'You get soBTC on Base. Your WBTC stays on Ethereum; a small bridge fee in ETH applies and soBTC arrives in a few minutes.';
  }
  return 'You get soBTC on Base right away. Your cbBTC stays on Base.';
}

function DepositToVaultForm() {
  const {
    setModal,
    setTransaction,
    srcChainId,
    principalToken,
    depositFromSolid,
    depositSourceChosen,
    externalWalletAddress,
    setPrincipalToken,
    setSrcChainId,
    setDepositSourceChosen,
  } = useDepositStore(
    useShallow(state => ({
      setModal: state.setModal,
      setTransaction: state.setTransaction,
      srcChainId: state.srcChainId,
      principalToken: state.principalToken,
      depositFromSolid: state.depositFromSolid,
      depositSourceChosen: state.depositSourceChosen,
      externalWalletAddress: state.externalWallet.address,
      setPrincipalToken: state.setPrincipalToken,
      setSrcChainId: state.setSrcChainId,
      setDepositSourceChosen: state.setDepositSourceChosen,
    })),
  );
  const { user } = useUser();
  const { isScreenMedium } = useDimension();
  const { vault, depositConfig } = useVaultDepositConfig();
  const { data: vaultExchangeRate } = useVaultExchangeRate(vault.name);
  const {
    ethereumTokens,
    fuseTokens,
    polygonTokens,
    baseTokens,
    arbitrumTokens,
    bscTokens,
    isLoading: isLoadingWalletTokens,
  } = useWalletTokens();

  // Sum across all (chain, token) pairs the selected vault accepts. If nothing
  // depositable is held in the user's wallet, show the empty state.
  const hasDepositableBalance = useMemo(() => {
    const allTokens = [
      ...ethereumTokens,
      ...fuseTokens,
      ...polygonTokens,
      ...baseTokens,
      ...arbitrumTokens,
      ...bscTokens,
    ];

    const supportedSet = new Set<string>();
    const config = vault.depositConfig;
    if (config) {
      for (const chainId of config.supportedChains) {
        for (const symbol of config.supportedTokens) {
          supportedSet.add(`${chainId}:${symbol.toUpperCase()}`);
        }
      }
    }

    return allTokens.some(token => {
      const symbol = token.contractTickerSymbol?.toUpperCase();
      if (!supportedSet.has(`${token.chainId}:${symbol}`)) return false;
      return BigInt(token.balance || '0') > 0n;
    });
  }, [ethereumTokens, fuseTokens, polygonTokens, baseTokens, arbitrumTokens, bscTokens, vault]);

  // Balances start empty, so "no depositable balance" only means something once
  // they have loaded. A balance already in hand is enough to show the form even
  // while a refresh is in flight.
  const isBalanceUnknown = isLoadingWalletTokens && !hasDepositableBalance;

  const vaultToken = vault.vaultToken ?? 'soUSD';
  // What the deposit becomes: the share token's mark (soUSD / soETH / soFUSE).
  const vaultTokenIcon = getTokenIcon({ tokenSymbol: vaultToken }).source ?? getAsset(vault.icon);

  const normalizedSelection = useMemo(() => {
    const defaultSelection = getDefaultDepositSelection(vault);
    const nextChainId =
      srcChainId && depositConfig.supportedChains.includes(srcChainId)
        ? srcChainId
        : defaultSelection.chainId;
    const allowedTokens = nextChainId ? getAllowedTokensForChain(nextChainId, vault) : [];
    const nextPrincipalToken = allowedTokens.includes(principalToken)
      ? principalToken
      : defaultSelection.principalToken;

    return {
      chainId: nextChainId ?? srcChainId,
      principalToken: nextPrincipalToken,
    };
  }, [depositConfig.supportedChains, principalToken, srcChainId, vault]);

  useEffect(() => {
    if (normalizedSelection.chainId && normalizedSelection.chainId !== srcChainId) {
      setSrcChainId(normalizedSelection.chainId);
    }
    if (normalizedSelection.principalToken !== principalToken) {
      setPrincipalToken(normalizedSelection.principalToken);
    }
  }, [
    normalizedSelection.chainId,
    normalizedSelection.principalToken,
    principalToken,
    setPrincipalToken,
    setSrcChainId,
    srcChainId,
  ]);

  // Open on the chain and token the Solid wallet holds the most of, rather than
  // whichever chain was used last. Once per open of the flow: a token picked in
  // the selector afterwards stays put. The balances here are the Solid wallet's,
  // so a deposit from a connected wallet keeps its own selection.
  useEffect(() => {
    if (!depositFromSolid || depositSourceChosen) return;

    const largest = getLargestDepositSelection(
      [
        ...ethereumTokens,
        ...fuseTokens,
        ...polygonTokens,
        ...baseTokens,
        ...arbitrumTokens,
        ...bscTokens,
      ],
      vault,
    );
    // Nothing yet: balances are still loading, or there is nothing to deposit
    // and the empty state shows instead.
    if (!largest) return;

    setSrcChainId(largest.chainId);
    setPrincipalToken(largest.principalToken);
    setDepositSourceChosen(true);
  }, [
    depositFromSolid,
    depositSourceChosen,
    ethereumTokens,
    fuseTokens,
    polygonTokens,
    baseTokens,
    arbitrumTokens,
    bscTokens,
    vault,
    setSrcChainId,
    setPrincipalToken,
    setDepositSourceChosen,
  ]);

  const selectedTokenInfo = useMemo(() => {
    // BRIDGE_TOKENS, or EURC_TOKENS for the soEURC vault's EURC.
    const tokenData = getVaultDepositToken(
      normalizedSelection.chainId,
      normalizedSelection.principalToken,
    );

    return {
      address: tokenData?.address,
      name: tokenData?.name || normalizedSelection.principalToken,
      image: tokenData?.icon || getAsset('images/usdc.png'),
      fullName: tokenData?.fullName,
      version: tokenData?.version,
      decimals: tokenData?.decimals,
    };
  }, [normalizedSelection.chainId, normalizedSelection.principalToken]);

  const { balance, deposit, depositStatus, hash, isEthereum, error } = useDepositFromEOA(
    (selectedTokenInfo?.address as Address) || '',
    selectedTokenInfo?.name || '',
    selectedTokenInfo?.version,
    vault.minimumAmount,
  );

  const {
    balance: balanceFuse,
    deposit: depositFuse,
    depositStatus: depositStatusFuse,
    hash: hashFuse,
    error: errorFuse,
  } = useDepositFromEOAFuse(
    (selectedTokenInfo?.address as Address) || '',
    selectedTokenInfo?.name || '',
    vault.minimumAmount,
  );

  const {
    balance: balanceSolidFuse,
    deposit: depositSolidFuse,
    depositStatus: depositStatusSolidFuse,
    hash: hashSolidFuse,
    error: errorSolidFuse,
  } = useDepositFromSolidFuse(
    (selectedTokenInfo?.address as Address) || '',
    selectedTokenInfo?.name || '',
    vault.minimumAmount,
  );

  const {
    balance: balanceEth,
    deposit: depositEth,
    depositStatus: depositStatusEth,
    hash: hashEth,
    error: errorEth,
  } = useDepositFromEOAEth(
    (selectedTokenInfo?.address as Address) || '',
    selectedTokenInfo?.name || '',
    vault.minimumAmount,
  );

  const {
    balance: balanceSolidEth,
    deposit: depositSolidEth,
    depositStatus: depositStatusSolidEth,
    hash: hashSolidEth,
    error: errorSolidEth,
  } = useDepositFromSolidEth(
    (selectedTokenInfo?.address as Address) || '',
    selectedTokenInfo?.name || '',
    vault.minimumAmount,
  );

  const {
    balance: balanceSolidUsdc,
    deposit: depositSolidUsdc,
    depositStatus: depositStatusSolidUsdc,
    hash: hashSolidUsdc,
    error: errorSolidUsdc,
  } = useDepositFromSolidUsdc(
    (selectedTokenInfo?.address as Address) || '',
    selectedTokenInfo?.name || '',
    vault.minimumAmount,
  );

  const {
    balance: balanceEur,
    deposit: depositEur,
    depositStatus: depositStatusEur,
    hash: hashEur,
    error: errorEur,
  } = useDepositFromEOAEur(
    (selectedTokenInfo?.address as Address) || '',
    selectedTokenInfo?.name || '',
    vault.minimumAmount,
  );

  const {
    balance: balanceSolidEur,
    deposit: depositSolidEur,
    depositStatus: depositStatusSolidEur,
    hash: hashSolidEur,
    error: errorSolidEur,
  } = useDepositFromSolidEur(
    (selectedTokenInfo?.address as Address) || '',
    selectedTokenInfo?.name || '',
    vault.minimumAmount,
  );

  const {
    balance: balanceBtc,
    deposit: depositBtc,
    depositStatus: depositStatusBtc,
    hash: hashBtc,
    error: errorBtc,
  } = useDepositFromEOABtc(
    (selectedTokenInfo?.address as Address) || '',
    selectedTokenInfo?.name || '',
    vault.minimumAmount,
  );

  const {
    balance: balanceSolidBtc,
    deposit: depositSolidBtc,
    depositStatus: depositStatusSolidBtc,
    hash: hashSolidBtc,
    error: errorSolidBtc,
  } = useDepositFromSolidBtc(
    (selectedTokenInfo?.address as Address) || '',
    selectedTokenInfo?.name || '',
    vault.minimumAmount,
  );

  const isFuseVault = vault.type === VaultType.FUSE;
  const isEthVault = vault.type === VaultType.ETH;
  const isEurVault = vault.type === VaultType.EUR;
  // soBTC: WBTC on Ethereum or cbBTC on Base, both 8 decimals (lib/soBtc.ts).
  const isBtcVault = vault.type === VaultType.BTC;
  const useSolidForBtc = isBtcVault && depositFromSolid;
  /** One hook's value for the soBTC vault, from the Solid wallet or the external one. */
  const btcPick = <T,>(solid: T, eoa: T) => (useSolidForBtc ? solid : eoa);
  const isNativeFuse = isFuseVault && normalizedSelection.principalToken === 'FUSE';
  const useSolidForFuse = isFuseVault && depositFromSolid;
  const useSolidForEth = isEthVault && depositFromSolid;
  const useSolidForEur = isEurVault && depositFromSolid;
  // The USD vault is the explicit case now rather than "anything else": an
  // unrecognised vault used to be deposited as USDC.
  const isUsdVault = vault.type === VaultType.USDC;
  const useSolidForUsdc = isUsdVault && depositFromSolid;
  // Exactly one of these holds whenever the deposit comes from the Solid
  // balance, which is also when the form has no external wallet to name.
  const isDepositFromSolid =
    useSolidForFuse || useSolidForEth || useSolidForEur || useSolidForUsdc || useSolidForBtc;

  // Synthesize a TokenBalance for the WalletTokenButton when depositFromSolid
  const selectedWalletToken: TokenBalance | null = useMemo(() => {
    if (!depositFromSolid || !normalizedSelection.chainId || !selectedTokenInfo.address)
      return null;
    return {
      contractTickerSymbol: selectedTokenInfo.name,
      contractName: selectedTokenInfo.fullName || selectedTokenInfo.name,
      contractAddress: selectedTokenInfo.address,
      balance: '0',
      contractDecimals: selectedTokenInfo.decimals ?? (isFuseVault || isEthVault ? 18 : 6),
      type: TokenType.ERC20,
      chainId: normalizedSelection.chainId,
      logoUrl: undefined,
    };
  }, [depositFromSolid, normalizedSelection.chainId, selectedTokenInfo, isFuseVault, isEthVault]);

  // Auto-switch to WFUSE if native FUSE is selected but not depositing from Solid
  useEffect(() => {
    if (isNativeFuse && !useSolidForFuse) {
      setPrincipalToken('WFUSE');
    }
  }, [isNativeFuse, useSolidForFuse, setPrincipalToken]);

  const balanceForVault = isBtcVault
    ? btcPick(balanceSolidBtc, balanceBtc)
    : isEurVault
      ? useSolidForEur
        ? balanceSolidEur
        : balanceEur
      : isEthVault
        ? useSolidForEth
          ? balanceSolidEth
          : balanceEth
        : isFuseVault
          ? useSolidForFuse
            ? balanceSolidFuse
            : balanceFuse
          : useSolidForUsdc
            ? balanceSolidUsdc
            : balance;
  const balanceDecimals = selectedTokenInfo.decimals ?? (isFuseVault || isEthVault ? 18 : 6);
  const depositFn = isBtcVault
    ? btcPick(depositSolidBtc, depositBtc)
    : isEurVault
      ? useSolidForEur
        ? depositSolidEur
        : depositEur
      : isEthVault
        ? useSolidForEth
          ? depositSolidEth
          : depositEth
        : isFuseVault
          ? useSolidForFuse
            ? depositSolidFuse
            : depositFuse
          : useSolidForUsdc
            ? depositSolidUsdc
            : deposit;
  const depositStatusForVault = isBtcVault
    ? btcPick(depositStatusSolidBtc, depositStatusBtc)
    : isEurVault
      ? useSolidForEur
        ? depositStatusSolidEur
        : depositStatusEur
      : isEthVault
        ? useSolidForEth
          ? depositStatusSolidEth
          : depositStatusEth
        : isFuseVault
          ? useSolidForFuse
            ? depositStatusSolidFuse
            : depositStatusFuse
          : useSolidForUsdc
            ? depositStatusSolidUsdc
            : depositStatus;
  const hashForVault = isBtcVault
    ? btcPick(hashSolidBtc, hashBtc)
    : isEurVault
      ? useSolidForEur
        ? hashSolidEur
        : hashEur
      : isEthVault
        ? useSolidForEth
          ? hashSolidEth
          : hashEth
        : isFuseVault
          ? useSolidForFuse
            ? hashSolidFuse
            : hashFuse
          : useSolidForUsdc
            ? hashSolidUsdc
            : hash;
  const errorForVault = isBtcVault
    ? btcPick(errorSolidBtc, errorBtc)
    : isEurVault
      ? useSolidForEur
        ? errorSolidEur
        : errorEur
      : isEthVault
        ? useSolidForEth
          ? errorSolidEth
          : errorEth
        : isFuseVault
          ? useSolidForFuse
            ? errorSolidFuse
            : errorFuse
          : useSolidForUsdc
            ? errorSolidUsdc
            : error;

  const isLoading = depositStatusForVault.status === Status.PENDING;
  const { maxAPY, isAPYsLoading } = useMaxAPY(vault.type);

  const formattedBalance = balanceForVault ? formatUnits(balanceForVault, balanceDecimals) : '0';

  // Create dynamic schema based on balance
  const depositSchema = useMemo(() => {
    const balanceAmount = balanceForVault
      ? Number(formatUnits(balanceForVault, balanceDecimals))
      : 0;
    const tokenLabel = isBtcVault
      ? (selectedTokenInfo?.name ?? 'WBTC')
      : isFuseVault
        ? (selectedTokenInfo?.name ?? 'WFUSE')
        : isEthVault
          ? (selectedTokenInfo?.name ?? 'WETH')
          : isEurVault
            ? 'EURC'
            : 'USDC';
    const maxAmount = balanceAmount;
    // BTC balances need their decimals: formatNumber's default rounds 0.00049 BTC to 0.
    const formatLimit = (value: number) =>
      isBtcVault ? formatBtcAmount(value, '').trim() : formatNumber(value);

    return z.object({
      amount: z
        .string()
        .refine(val => val !== '' && !isNaN(Number(val)), {
          error: 'Please enter a valid amount',
        })
        .refine(val => Number(val) > 0, { error: 'Amount must be greater than 0' })
        .refine(val => Number(val) >= Number(vault.minimumAmount), {
          error: `Minimum ${vault.minimumAmount} ${tokenLabel}`,
        })
        .refine(val => !isNativeFuse || Number(val) >= Number(EXPO_PUBLIC_FUSE_GAS_RESERVE), {
          error: 'Amount too low',
        })
        .refine(val => Number(val) <= maxAmount, {
          error: `Available balance is ${formatLimit(maxAmount)} ${tokenLabel}`,
        }),
    });
  }, [
    balanceForVault,
    balanceDecimals,
    isBtcVault,
    isFuseVault,
    isEthVault,
    isEurVault,
    isNativeFuse,
    selectedTokenInfo?.name,
    vault.minimumAmount,
  ]);

  type DepositFormData = { amount: string };

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    reset,
    setValue,
    trigger,
  } = useForm<DepositFormData>({
    resolver: zodResolver(depositSchema) as any,
    mode: 'onChange',
    defaultValues: {
      amount: '',
    },
  });

  const watchedAmount = watch('amount');
  const isSponsor = Number(watchedAmount) >= Number(vault.minimumAmount);

  const amountInputRef = useRef<TextInput>(null);

  // "Max" fills the field with the full-precision balance, which overflows the
  // input on small screens; keep the leading digits in view.
  const showAmountFromStart = useCallback(() => {
    requestAnimationFrame(() => showTextInputFromStart(amountInputRef.current));
  }, []);

  // Track form viewed (once per mount)
  const hasTrackedFormView = useRef(false);

  useEffect(() => {
    if (!hasTrackedFormView.current) {
      track(TRACKING_EVENTS.DEPOSIT_WALLET_FORM_VIEWED, {
        deposit_method: 'wallet',
        chain_id: srcChainId,
        token: selectedTokenInfo.name,
        balance: formattedBalance,
      });
      hasTrackedFormView.current = true;
    }
  }, [srcChainId, selectedTokenInfo.name, formattedBalance]);

  // Track amount entry start (once per form session)
  const hasTrackedAmountEntry = useRef(false);

  useEffect(() => {
    if (watchedAmount && !hasTrackedAmountEntry.current) {
      hasTrackedAmountEntry.current = true;
      track(TRACKING_EVENTS.DEPOSIT_AMOUNT_ENTRY_STARTED, {
        chain_id: srcChainId,
        token: selectedTokenInfo.name,
        balance: formattedBalance,
      });
    }
  }, [watchedAmount, srcChainId, selectedTokenInfo.name, formattedBalance]);

  // Track validation errors
  useEffect(() => {
    if (errors.amount) {
      track(TRACKING_EVENTS.DEPOSIT_VALIDATION_ERROR, {
        error_message: errors.amount.message,
        attempted_amount: watchedAmount,
        chain_id: srcChainId,
        token: selectedTokenInfo.name,
        balance: formattedBalance,
      });
    }
  }, [errors.amount, watchedAmount, srcChainId, selectedTokenInfo.name, formattedBalance]);

  const {
    amountOut: previewAmountOut,
    isLoading: isPreviewDepositLoading,
    isQuoteUnavailable,
    routingFee,
  } = usePreviewDeposit(
    // The preview quotes a route into USDC, which a EURC deposit never takes:
    // a zero amount keeps it from asking LI.FI for one.
    isEurVault ? '0' : watchedAmount || '0',
    selectedTokenInfo?.address,
    normalizedSelection.chainId,
    // LI.FI simulates the route from the wallet the deposit comes from.
    depositFromSolid ? user?.safeAddress : externalWalletAddress,
    normalizedSelection.chainId
      ? getBridgeTokenDecimals(normalizedSelection.chainId, selectedTokenInfo.name)
      : undefined,
  );

  // Use vault's accountant rate for display; amountOut from preview (USDC + LiFi) or vault rate (e.g. FUSE)
  const amountOut =
    vault.name === 'USDC'
      ? previewAmountOut
      : Number(watchedAmount || 0) / (vaultExchangeRate ?? 1);
  const isAmountOutLoading =
    vault.name === 'USDC' ? isPreviewDepositLoading : vaultExchangeRate === undefined;
  const displayRate = vault.name === 'USDC' ? vaultExchangeRate : vaultExchangeRate;
  // With no route quoted there is no amount to show, and 0 reads as a real one.
  const showNoQuote = vault.name === 'USDC' && isQuoteUnavailable;

  const getButtonText = () => {
    if (errors.amount) return errors.amount.message;
    if (!isValid || !watchedAmount) return 'Enter an amount';
    if (depositStatusForVault.status === Status.PENDING) return depositStatusForVault.message;
    if (depositStatusForVault.status === Status.SUCCESS) return 'Successfully deposited!';
    if (depositStatusForVault.status === Status.ERROR)
      return errorForVault || 'Error while depositing';
    return 'Deposit';
  };

  const handleSuccess = () => {
    // Note: DEPOSIT_COMPLETED tracking is handled by useDepositFromEOA / useDepositFromEOAFuse
    // which have complete deposit details (amount, transaction hash, user info, etc.)

    reset(); // Reset form after successful transaction
    setModal(DEPOSIT_MODAL.OPEN_TRANSACTION_STATUS);
    if (!hashForVault) return;

    // A cbBTC deposit lands on Base in its own transaction; a WBTC one bridges, like soUSD.
    const isBtcOnBase = isBtcVault && normalizedSelection.chainId === base.id;
    const explorerUrl = isFuseVault
      ? explorerUrls[fuse.id]?.blockscout
      : isEurVault || isBtcOnBase
        ? base.blockExplorers.default.url
        : explorerUrls[layerzero.id]?.layerzeroscan;

    const toastToken = isBtcVault
      ? (selectedTokenInfo?.name ?? 'BTC')
      : isFuseVault
        ? 'FUSE'
        : isEthVault
          ? 'ETH'
          : isEurVault
            ? 'EURC'
            : 'USDC';
    const toastIcon = isBtcVault
      ? isBtcOnBase
        ? 'images/cbbtc.png'
        : 'images/wbtc.png'
      : isFuseVault
        ? 'images/fuse-4x.png'
        : isEthVault
          ? 'images/eth.png'
          : isEurVault
            ? 'images/eurc.png'
            : 'images/usdc.png';

    Toast.show({
      type: 'success',
      text1: `Depositing ${toastToken}`,
      text2: `Staking ${toastToken} to the protocol`,
      props: {
        badgeText: 'Onchain',
        link: `${explorerUrl}/tx/${hashForVault}`,
        linkText: eclipseAddress(hashForVault),
        image: getAsset(toastIcon),
      },
    });
  };

  const onSubmit = async (data: DepositFormData) => {
    const depositUserId = selectedRewardsUserId();
    const depositSession = useRewardsUpgradeStore.getState().session;
    // Capture attribution for conversion funnel tracking
    const attributionData = useAttributionStore.getState().getAttributionForEvent();
    const attributionChannel = getAttributionChannel(attributionData);

    try {
      // Track wallet form submission specifically
      track(TRACKING_EVENTS.DEPOSIT_WALLET_FORM_SUBMITTED, {
        deposit_method: 'wallet',
        chain_id: srcChainId,
        token: selectedTokenInfo.name,
        amount: data.amount,
        balance: formattedBalance,
        is_sponsor: isSponsor,
      });

      track(TRACKING_EVENTS.DEPOSIT_INITIATED, {
        amount: data.amount,
        chain_id: srcChainId,
        is_ethereum: !isFuseVault && !isEurVault && isEthereum,
        is_sponsor: isSponsor,
        exchange_rate: vaultExchangeRate,
        ...attributionData,
        attribution_channel: attributionChannel,
      });

      const trackingId = await depositFn(data.amount);
      if (
        !trackingId ||
        selectedRewardsUserId() !== depositUserId ||
        useRewardsUpgradeStore.getState().session !== depositSession
      )
        return;
      setTransaction({
        amount: Number(data.amount),
        trackingId,
      });
      handleSuccess();
    } catch (error) {
      track(TRACKING_EVENTS.DEPOSIT_FAILED, {
        amount: data.amount,
        chain_id: srcChainId,
        is_ethereum: !isFuseVault && !isEurVault && isEthereum,
        error: String(error),
        ...attributionData,
        attribution_channel: attributionChannel,
      });
      // handled by hook
    }
  };

  const isFormDisabled = () => {
    return isLoading || !isValid || !watchedAmount;
  };

  return (
    <Pressable onPress={Platform.OS === 'web' ? undefined : Keyboard.dismiss}>
      <View className="gap-1">
        {!isDepositFromSolid && (
          <View className="gap-2">
            <Text className="text-muted-foreground">From wallet</Text>
            <ConnectedWalletDropdown />
          </View>
        )}
        <View className="gap-1" style={{ zIndex: 50 }}>
          <Text className="text-base text-muted-foreground">Destination</Text>
          <VaultSelectorDropdown />
        </View>
        <View className="gap-2">
          {isBalanceUnknown ? (
            // This form is the savings deposit entry point, so balances are
            // usually still in flight on first open. Waiting here keeps the user
            // off an empty state that a loaded balance is about to contradict.
            <View className="mt-12 items-center">
              <ActivityIndicator size="small" color="white" />
            </View>
          ) : !hasDepositableBalance ? (
            <EmptyDepositTokens vault={vault} />
          ) : (
            <>
              <View className="mt-6 flex-row items-center justify-between">
                <Text className="text-base text-muted-foreground">Amount</Text>
                <View className="flex-row items-center gap-2">
                  <Wallet color="#A1A1A1" size={16} />
                  <Text className="text-base text-muted-foreground">
                    {isBtcVault
                      ? formatBtcAmount(Number(formattedBalance), selectedTokenInfo.name)
                      : `${formatNumber(Number(formattedBalance))} ${selectedTokenInfo.name}`}
                  </Text>
                  <Max
                    onPress={() => {
                      track(TRACKING_EVENTS.DEPOSIT_MAX_BUTTON_CLICKED, {
                        chain_id: srcChainId,
                        token: selectedTokenInfo.name,
                        max_amount: formattedBalance,
                      });
                      setValue('amount', formattedBalance);
                      trigger('amount');
                      showAmountFromStart();
                    }}
                  />
                </View>
              </View>
              <View className="w-full flex-row items-center justify-between gap-2 rounded-2xl bg-card px-5 py-4">
                <Controller
                  control={control}
                  name="amount"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      ref={amountInputRef}
                      keyboardType="decimal-pad"
                      className="min-w-0 flex-1 text-2xl font-semibold text-white web:focus:outline-none"
                      value={value.toString()}
                      placeholder="0.0"
                      placeholderTextColor="#666"
                      onChangeText={onChange}
                      onBlur={onBlur}
                      returnKeyType="done"
                      onSubmitEditing={Platform.OS === 'web' ? undefined : () => Keyboard.dismiss()}
                    />
                  )}
                />
                {depositFromSolid ? (
                  <WalletTokenButton
                    selectedToken={selectedWalletToken}
                    onPress={() => setModal(DEPOSIT_MODAL.OPEN_TOKEN_SELECTOR)}
                  />
                ) : (
                  <View className="shrink-0 flex-row items-center gap-2">
                    <Pressable
                      onPress={() => setModal(DEPOSIT_MODAL.OPEN_TOKEN_SELECTOR)}
                      className="flex-row items-center gap-2"
                    >
                      <Image
                        source={selectedTokenInfo.image}
                        alt={selectedTokenInfo.name}
                        style={{ width: 32, height: 32 }}
                      />
                      <Text className="text-lg font-semibold text-white">
                        {selectedTokenInfo.name}
                      </Text>
                      {selectedTokenInfo.fullName && (
                        <TooltipPopover text={selectedTokenInfo.fullName} />
                      )}
                      <ChevronDown size={16} color="#A1A1A1" />
                    </Pressable>
                  </View>
                )}
              </View>

              <TokenDetails className="mt-6">
                <View className="flex-row items-center justify-between gap-2 px-5 py-6 md:gap-10 md:p-5">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-lg text-muted-foreground">You will receive</Text>
                  </View>
                  <View className="ml-auto shrink-0 flex-row items-center gap-2">
                    <Image
                      source={vaultTokenIcon}
                      style={{ width: 24, height: 24 }}
                      contentFit="contain"
                    />
                    <View className="flex-row items-baseline gap-1">
                      <Text className="text-lg font-semibold">
                        {isAmountOutLoading ? (
                          <Skeleton className="h-7 w-20 bg-white/20" />
                        ) : showNoQuote ? (
                          '—'
                        ) : isBtcVault ? (
                          formatBtcAmount(amountOut || 0, '')
                        ) : isScreenMedium ? (
                          compactNumberFormat(amountOut || 0)
                        ) : (
                          parseFloat((amountOut || 0).toFixed(3)) || 0
                        )}
                      </Text>
                      <Text className="text-lg">{vaultToken}</Text>
                    </View>
                  </View>
                </View>
                <View className="flex-row items-center justify-between gap-2 px-5 py-6 md:gap-10 md:p-5">
                  <Text className="text-base text-muted-foreground">Price</Text>
                  <View className="ml-auto shrink-0 flex-row items-baseline gap-2">
                    <Text className="text-lg font-semibold">
                      {`1 ${vaultToken} = `}
                      {vault.name === 'USDC'
                        ? `$${formatNumber(displayRate ?? 0)}`
                        : isBtcVault
                          ? `${(displayRate ?? 0).toFixed(8)} BTC`
                          : `${formatNumber(displayRate ?? 0)} ${selectedTokenInfo.name}`}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center justify-between gap-2 px-5 py-6 md:gap-10 md:p-5">
                  <Text className="text-base text-muted-foreground">Routing Fee</Text>
                  <View className="ml-auto shrink-0 flex-row items-baseline gap-2">
                    {vault.name === 'USDC' && isPreviewDepositLoading ? (
                      <Skeleton className="h-7 w-20 bg-white/20" />
                    ) : (
                      <Text className="text-lg font-semibold">
                        {showNoQuote
                          ? '—'
                          : vault.name === 'USDC'
                            ? `$${formatNumber(routingFee)}`
                            : `${getVaultCurrencySymbol(vault.type)}0`}
                      </Text>
                    )}
                  </View>
                </View>
                <View className="flex-row items-center justify-between gap-2 px-5 py-6 md:gap-10 md:p-5">
                  <Text className="text-base text-muted-foreground">APY</Text>
                  <View className="ml-auto shrink-0 flex-row items-baseline gap-2">
                    <Text className="text-lg font-semibold text-[#94F27F]">
                      {maxAPY ? (
                        `${maxAPY.toFixed(2)}%`
                      ) : isEurVault && !isAPYsLoading ? (
                        // EUR Yield's rate is 0% for now: shown, not a skeleton that never resolves.
                        '0.00%'
                      ) : isBtcVault && !isAPYsLoading ? (
                        // No soBTC rate reported yet: a dash, never an invented one.
                        '—'
                      ) : (
                        <Skeleton className="h-7 w-20 bg-white/20" />
                      )}
                    </Text>
                    {/* <Text className="text-base opacity-40">
                  {totalAPY ? (
                    `Earn ~${compactNumberFormat(
                      Number(watchedAmount) * (totalAPY / 100)
                    )} USDC/year`
                  ) : (
                    <Skeleton className="w-20 h-6" />
                  )}
                </Text> */}
                  </View>
                </View>
              </TokenDetails>
              <View className="mt-2 flex-row items-start justify-between">
                <View className="flex-row items-start gap-2">
                  <Fuel color="#A1A1A1" size={16} className="mt-0.5" />
                  <Text className="max-w-xs text-sm text-muted-foreground">
                    {isBtcVault
                      ? getSoBtcDepositNote(normalizedSelection.chainId)
                      : getGaslessText(vault.minimumAmount, selectedTokenInfo?.name, isSponsor)}
                  </Text>
                </View>
              </View>
              <CheckConnectionWrapper props={{ size: 'xl' }}>
                <Button
                  variant="brand"
                  className="mt-2 h-12 rounded-2xl"
                  onPress={handleSubmit(onSubmit)}
                  disabled={isFormDisabled()}
                >
                  <Text className="text-base font-bold">{getButtonText()?.slice(0, 30)}</Text>
                  {isLoading && <ActivityIndicator color="gray" />}
                </Button>
              </CheckConnectionWrapper>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default DepositToVaultForm;
