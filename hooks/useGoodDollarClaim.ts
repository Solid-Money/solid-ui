import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  ClaimCustodialSDK,
  ClaimSDK,
  IdentityCustodialSDK,
  IdentitySDK,
  SupportedChains,
  ubiSchemeV2ABI,
} from '@goodsdks/citizen-sdk';
import * as Sentry from '@sentry/react-native';
import { StamperType, useTurnkey } from '@turnkey/react-native-wallet-kit';
import { createAccount } from '@turnkey/viem';
import {
  Address,
  createWalletClient,
  erc20Abi,
  formatUnits,
  hashTypedData,
  http,
  PublicClient,
  WalletClient,
} from 'viem';
import { fuse } from 'wagmi/chains';

import {
  G_DOLLAR_DECIMALS,
  G_DOLLAR_SYMBOL,
  getGoodDollarExplorerTxUrl,
  GOODDOLLAR_CHAIN_ID,
  GOODDOLLAR_ENV,
  GOODDOLLAR_FUSE,
  GOODDOLLAR_GAS_FLOOR_WEI,
  GOODDOLLAR_REDIRECT_PATH,
} from '@/constants/gooddollar';
import { useActivityActions } from '@/hooks/useActivityActions';
import useUser from '@/hooks/useUser';
import { topUpGoodDollarGas } from '@/lib/api';
import { TransactionStatus, TransactionType } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { publicClient, rpcUrls } from '@/lib/wagmi';

type GoodDollarSdks = {
  account: Address;
  readClient: PublicClient;
  walletClient: WalletClient;
  identitySDK: IdentitySDK;
  claimSDK: ClaimSDK;
};

export type GoodDollarClaimState = {
  isLoading: boolean;
  isWhitelisted: boolean;
  /** Amount claimable in this period (base units, G$ has 2 decimals on Fuse). */
  entitlement: bigint;
  /** When the next claim becomes available (null if claimable now). */
  nextClaimTime: Date | null;
  /** G$ balance of the signer EOA on Fuse. */
  balance: bigint;
  error: string | null;
};

const INITIAL_STATE: GoodDollarClaimState = {
  isLoading: true,
  isWhitelisted: false,
  entitlement: 0n,
  nextClaimTime: null,
  balance: 0n,
  error: null,
};

const isUserCancelled = (error: unknown): boolean => {
  const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();
  return (
    message.includes('cancel') ||
    message.includes('denied') ||
    message.includes('rejected') ||
    message.includes('not allowed')
  );
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

const getRedirectUrl = () => Linking.createURL(GOODDOLLAR_REDIRECT_PATH);

/**
 * Drives the GoodDollar UBI flow on Fuse: identity (Face Verification),
 * eligibility, and daily claiming. The SDK is EOA-only, so everything runs
 * through the user's Turnkey signer EOA (`user.walletAddress`) rather than the
 * Safe smart account. See `constants/gooddollar.ts`.
 */
const useGoodDollarClaim = () => {
  const { user } = useUser();
  const { createHttpClient } = useTurnkey();
  const { createActivity, updateActivity } = useActivityActions();

  const sdksRef = useRef<Promise<GoodDollarSdks> | null>(null);
  const [state, setState] = useState<GoodDollarClaimState>(INITIAL_STATE);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);

  // Lazily build (and cache) the viem wallet client + GoodDollar SDKs backed by
  // the Turnkey signer EOA. Creating the account does not prompt for a passkey
  // — only signing (verify/claim) does — so this is safe to call for read-only
  // status too.
  const getSdks = useCallback((): Promise<GoodDollarSdks> => {
    if (!user?.walletAddress || !user?.suborgId) {
      return Promise.reject(new Error('Wallet is not ready yet'));
    }

    if (!sdksRef.current) {
      sdksRef.current = (async () => {
        const passkeyClient = createHttpClient({ defaultStamperType: StamperType.Passkey });

        const turnkeyAccount = await createAccount({
          client: passkeyClient,
          organizationId: user.suborgId,
          signWith: user.walletAddress as string,
        });

        // Same workaround as useUser.safeAA / useRescueToken: the Turnkey viem
        // adapter mis-sends typed data, so route it through the raw sign.
        if (turnkeyAccount.sign) {
          const originalSign = turnkeyAccount.sign.bind(turnkeyAccount);
          turnkeyAccount.signTypedData = async (typedData: any) =>
            originalSign({ hash: hashTypedData(typedData) });
        }

        const walletClient = createWalletClient({
          account: turnkeyAccount,
          chain: fuse,
          transport: http(rpcUrls[GOODDOLLAR_CHAIN_ID]),
        });

        const readClient = publicClient(GOODDOLLAR_CHAIN_ID) as PublicClient;

        // Use the *custodial* SDK variants: they sign the FV message and claim
        // transactions locally via the Turnkey account (account.signMessage /
        // account.signTransaction) instead of dispatching personal_sign /
        // eth_sendTransaction to the Fuse RPC, which rejects them. Constructed
        // directly (not via .init(), which hardcodes the non-custodial class).
        const identitySDK: IdentitySDK = new IdentityCustodialSDK({
          account: turnkeyAccount.address as Address,
          publicClient: readClient,
          walletClient,
          env: GOODDOLLAR_ENV,
        });

        const claimSDK: ClaimSDK = new ClaimCustodialSDK({
          publicClient: readClient,
          walletClient,
          identitySDK,
          env: GOODDOLLAR_ENV,
          rdu: getRedirectUrl(),
        });

        return {
          account: turnkeyAccount.address as Address,
          readClient,
          walletClient: walletClient as WalletClient,
          identitySDK,
          claimSDK,
        };
      })().catch(error => {
        // Don't cache a failed build — allow retry on the next call.
        sdksRef.current = null;
        throw error;
      });
    }

    return sdksRef.current;
  }, [createHttpClient, user?.suborgId, user?.walletAddress]);

  const refresh = useCallback(async () => {
    if (!user?.walletAddress) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { identitySDK, claimSDK, account, readClient } = await getSdks();

      const [{ isWhitelisted }, balance] = await Promise.all([
        identitySDK.getWhitelistedRoot(account),
        readClient.readContract({
          address: GOODDOLLAR_FUSE.gdToken,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account],
        }) as Promise<bigint>,
      ]);

      let entitlement = 0n;
      let nextClaimTime: Date | null = null;

      if (isWhitelisted) {
        try {
          const result = await claimSDK.checkEntitlement();
          entitlement = result?.amount ?? 0n;
        } catch (error) {
          Sentry.addBreadcrumb({
            category: 'gooddollar',
            level: 'warning',
            message: 'checkEntitlement failed',
            data: { error: getErrorMessage(error, 'unknown') },
          });
        }

        if (entitlement === 0n) {
          try {
            const next = await claimSDK.nextClaimTime();
            nextClaimTime = next && next.getTime() > Date.now() ? next : null;
          } catch {
            nextClaimTime = null;
          }
        }
      }

      setState({
        isLoading: false,
        isWhitelisted,
        entitlement,
        nextClaimTime,
        balance,
        error: null,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: getErrorMessage(error, 'Failed to load GoodDollar status'),
      }));
    }
  }, [getSdks, user?.walletAddress]);

  // After returning from Face Verification the on-chain whitelist can lag by a
  // few seconds, so poll a handful of times (stopping early) before settling.
  const pollForWhitelist = useCallback(async () => {
    if (!user?.walletAddress) return;
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const maxAttempts = 6;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const { identitySDK, account } = await getSdks();
        const { isWhitelisted } = await identitySDK.getWhitelistedRoot(account);
        if (isWhitelisted) break;
      } catch {
        // ignore and retry
      }
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    await refresh();
  }, [getSdks, refresh, user?.walletAddress]);

  useEffect(() => {
    if (!user?.walletAddress) return;

    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      /[?&](isVerified|verified)=/i.test(window.location.search)
    ) {
      // Returned from GoodDollar Face Verification (web redirect) — clean the
      // query string and poll until the on-chain whitelist reflects it.
      try {
        window.history.replaceState(null, '', window.location.pathname);
      } catch {
        // ignore
      }
      void pollForWhitelist();
    } else {
      void refresh();
    }
  }, [pollForWhitelist, refresh, user?.walletAddress]);

  // Opens GoodDollar's hosted Face Verification (FaceTec liveness) flow in an
  // in-app browser and re-checks whitelist status on-chain when it returns.
  const verify = useCallback(async () => {
    setIsVerifying(true);
    try {
      const { identitySDK } = await getSdks();
      const redirectUrl = getRedirectUrl();

      // Signs the FV identifier message with the EOA (triggers a passkey prompt)
      // and builds the hosted verification URL. popupMode=false → redirect mode
      // with a callback, which is GoodDollar's recommended flow.
      const link = await identitySDK.generateFVLink(false, redirectUrl, SupportedChains.FUSE);

      if (Platform.OS === 'web') {
        // Full-page redirect. window.open() would be blocked here because the
        // async signMessage above breaks out of the click's user-gesture
        // context. GoodDollar redirects back to redirectUrl when done, and the
        // hook re-checks whitelist status on mount.
        if (typeof window !== 'undefined') {
          window.location.href = link;
        }
        return;
      }

      // Open the hosted Face Verification (FaceTec) flow in an in-app browser.
      // Use openBrowserAsync (same call the app's KYC flow uses) rather than
      // openAuthSessionAsync: the latter needs an ASWebAuthenticationSession
      // callback scheme and was failing to launch the browser on native. If
      // GoodDollar redirects to the solid:// deep link it dismisses the browser
      // and foregrounds the app; otherwise the user closes it manually. Either
      // way the promise resolves when the browser is dismissed.
      await WebBrowser.openBrowserAsync(link, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        controlsColor: '#94F27F',
        showTitle: true,
        enableBarCollapsing: true,
      });

      // Browser dismissed — drop the "Opening…" state so the whitelist poll
      // shows the normal loading UI. On-chain status is the source of truth.
      setIsVerifying(false);
      await pollForWhitelist();
    } catch (error) {
      if (!isUserCancelled(error)) {
        Sentry.captureException(error, { tags: { type: 'gooddollar_verify_error' } });
      }
      Toast.show({
        type: 'error',
        text1: 'Verification failed',
        text2: isUserCancelled(error)
          ? 'Verification was cancelled'
          : getErrorMessage(error, 'Please try again'),
        props: { badgeText: 'Error' },
      });
    } finally {
      setIsVerifying(false);
    }
  }, [getSdks, pollForWhitelist]);

  // Make sure the signer EOA holds enough native FUSE for a transaction. Tops up
  // via GoodDollar's faucet (proxied by our backend — the faucet API is
  // CORS-blocked in the browser) and waits for the top-up to land. Best effort:
  // if it can't, the transaction below surfaces an insufficient-funds error.
  const ensureGas = useCallback(
    async (
      readClient: PublicClient,
      account: Address,
      needed: bigint,
      setMessage?: (message: string) => void,
    ) => {
      let balance = await readClient.getBalance({ address: account });
      if (balance >= needed) return;

      setMessage?.('Topping up gas…');
      try {
        await withRefreshToken(() => topUpGoodDollarGas(account, GOODDOLLAR_CHAIN_ID));
      } catch (error) {
        Sentry.addBreadcrumb({
          category: 'gooddollar',
          level: 'warning',
          message: 'gas top-up request failed',
          data: { error: getErrorMessage(error, 'unknown') },
        });
      }

      for (let attempt = 0; attempt < 12; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        balance = await readClient.getBalance({ address: account });
        if (balance >= needed) return;
      }
    },
    [],
  );

  const claim = useCallback(async () => {
    let clientTxId: string | null = null;
    setIsClaiming(true);
    setClaimMessage('Preparing your claim…');

    try {
      const { claimSDK, walletClient, readClient, account } = await getSdks();

      const entitlement = await claimSDK.checkEntitlement();
      if (!entitlement?.amount || entitlement.amount === 0n) {
        // Already claimed this period (or nothing available) — just resync the UI.
        await refresh();
        return;
      }

      const amount = formatUnits(entitlement.amount, G_DOLLAR_DECIMALS);

      clientTxId = await createActivity({
        type: TransactionType.GOODDOLLAR_CLAIM,
        title: `Claimed ${amount} G$`,
        shortTitle: 'G$ Claim',
        amount,
        symbol: G_DOLLAR_SYMBOL,
        chainId: GOODDOLLAR_CHAIN_ID,
        toAddress: account,
        status: TransactionStatus.PENDING,
        metadata: {
          source: 'gooddollar',
          description: 'GoodDollar UBI daily claim',
          tokenAddress: GOODDOLLAR_FUSE.gdToken,
        },
      });

      // Ensure the EOA has enough native FUSE for the claim (top up via backend).
      setClaimMessage('Preparing your wallet…');
      let neededGas = GOODDOLLAR_GAS_FLOOR_WEI;
      try {
        const gasUnits = await readClient.estimateContractGas({
          address: GOODDOLLAR_FUSE.ubiScheme,
          abi: ubiSchemeV2ABI,
          functionName: 'claim',
          account,
        });
        const gasPrice = await readClient.getGasPrice();
        neededGas = (gasUnits * gasPrice * 13n) / 10n; // +30% headroom
      } catch {
        // estimation unavailable (e.g. zero balance) — fall back to the floor
      }
      await ensureGas(readClient, account, neededGas, setClaimMessage);

      // Submit the claim via viem writeContract so the transaction is fully
      // prepared (nonce, gas) and signed locally by the Turnkey account. The
      // SDK's own claim() passes the address string to prepareTransactionRequest,
      // which skips nonce population and fails with a "Nonce error".
      setClaimMessage('Confirm in your wallet…');
      const txHash = await walletClient.writeContract({
        address: GOODDOLLAR_FUSE.ubiScheme,
        abi: ubiSchemeV2ABI,
        functionName: 'claim',
        account: walletClient.account ?? account,
        chain: fuse,
      });

      await updateActivity(clientTxId, {
        status: TransactionStatus.PROCESSING,
        hash: txHash,
        url: getGoodDollarExplorerTxUrl(txHash),
      });

      const receipt = await readClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== 'success') {
        await updateActivity(clientTxId, {
          status: TransactionStatus.FAILED,
          hash: txHash,
          url: getGoodDollarExplorerTxUrl(txHash),
          metadata: { error: 'Claim reverted on-chain' },
        });
        throw new Error('Claim transaction reverted on-chain');
      }

      await updateActivity(clientTxId, {
        status: TransactionStatus.SUCCESS,
        hash: txHash,
        url: getGoodDollarExplorerTxUrl(txHash),
      });

      Toast.show({
        type: 'success',
        text1: `Claimed ${amount} G$`,
        text2: 'Your GoodDollar UBI is on the way.',
        props: { badgeText: 'Success' },
      });

      await refresh();
    } catch (error) {
      if (clientTxId) {
        void updateActivity(clientTxId, {
          status: TransactionStatus.FAILED,
          metadata: { error: getErrorMessage(error, 'Claim failed') },
        });
      }
      if (!isUserCancelled(error)) {
        Sentry.captureException(error, { tags: { type: 'gooddollar_claim_error' } });
      }
      Toast.show({
        type: 'error',
        text1: 'Claim failed',
        text2: isUserCancelled(error)
          ? 'Passkey prompt was cancelled'
          : getErrorMessage(error, 'Please try again'),
        props: { badgeText: 'Error' },
      });
    } finally {
      setIsClaiming(false);
      setClaimMessage(null);
    }
  }, [createActivity, ensureGas, getSdks, refresh, updateActivity]);

  // Moves the claimed G$ from the signer EOA to the user's Solid Safe so it can
  // be used across the app (swap, send). Ensures the EOA has gas via GoodDollar's
  // Fuse faucet, then transfers the full G$ balance.
  const sweep = useCallback(async () => {
    if (!user?.safeAddress) {
      Toast.show({
        type: 'error',
        text1: 'Move failed',
        text2: 'Solid wallet not found',
        props: { badgeText: 'Error' },
      });
      return;
    }

    let clientTxId: string | null = null;
    setIsSweeping(true);

    try {
      const { walletClient, readClient, account } = await getSdks();
      const safeAddress = user.safeAddress as Address;

      const balanceWei = (await readClient.readContract({
        address: GOODDOLLAR_FUSE.gdToken,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account],
      })) as bigint;

      if (balanceWei === 0n) {
        await refresh();
        return;
      }

      const amount = formatUnits(balanceWei, G_DOLLAR_DECIMALS);

      // Ensure the EOA has enough native FUSE to pay for the transfer (top up
      // via backend). Best effort — a gas error is surfaced by the transfer below.
      let neededGas = GOODDOLLAR_GAS_FLOOR_WEI;
      try {
        const gasUnits = await readClient.estimateContractGas({
          address: GOODDOLLAR_FUSE.gdToken,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [safeAddress, balanceWei],
          account,
        });
        const gasPrice = await readClient.getGasPrice();
        neededGas = (gasUnits * gasPrice * 13n) / 10n; // +30% headroom
      } catch {
        // estimation unavailable — fall back to the floor
      }
      await ensureGas(readClient, account, neededGas);

      clientTxId = await createActivity({
        type: TransactionType.GOODDOLLAR_SWEEP,
        title: `Moved ${amount} G$ to wallet`,
        shortTitle: 'G$ to wallet',
        amount,
        symbol: G_DOLLAR_SYMBOL,
        chainId: GOODDOLLAR_CHAIN_ID,
        fromAddress: account,
        toAddress: safeAddress,
        status: TransactionStatus.PENDING,
        metadata: {
          source: 'gooddollar',
          description: 'Moved GoodDollar UBI to Solid wallet',
          tokenAddress: GOODDOLLAR_FUSE.gdToken,
        },
      });

      const txHash = await walletClient.writeContract({
        address: GOODDOLLAR_FUSE.gdToken,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [safeAddress, balanceWei],
        account: walletClient.account ?? account,
        chain: fuse,
      });

      await updateActivity(clientTxId, {
        status: TransactionStatus.PROCESSING,
        hash: txHash,
        url: getGoodDollarExplorerTxUrl(txHash),
      });

      const receipt = await readClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status !== 'success') {
        await updateActivity(clientTxId, {
          status: TransactionStatus.FAILED,
          hash: txHash,
          url: getGoodDollarExplorerTxUrl(txHash),
          metadata: { error: 'Transfer reverted on-chain' },
        });
        throw new Error('Sweep transaction reverted on-chain');
      }

      await updateActivity(clientTxId, {
        status: TransactionStatus.SUCCESS,
        hash: txHash,
        url: getGoodDollarExplorerTxUrl(txHash),
      });

      Toast.show({
        type: 'success',
        text1: `Moved ${amount} G$ to your wallet`,
        text2: 'It’s now available across Solid.',
        props: { badgeText: 'Success' },
      });

      await refresh();
    } catch (error) {
      if (clientTxId) {
        void updateActivity(clientTxId, {
          status: TransactionStatus.FAILED,
          metadata: { error: getErrorMessage(error, 'Sweep failed') },
        });
      }
      if (!isUserCancelled(error)) {
        Sentry.captureException(error, { tags: { type: 'gooddollar_sweep_error' } });
      }
      Toast.show({
        type: 'error',
        text1: 'Move failed',
        text2: isUserCancelled(error)
          ? 'Passkey prompt was cancelled'
          : getErrorMessage(error, 'Please try again'),
        props: { badgeText: 'Error' },
      });
    } finally {
      setIsSweeping(false);
    }
  }, [createActivity, ensureGas, getSdks, refresh, updateActivity, user?.safeAddress]);

  return {
    ...state,
    isVerifying,
    isClaiming,
    isSweeping,
    claimMessage,
    canClaim: state.isWhitelisted && state.entitlement > 0n,
    canSweep: state.balance > 0n && !!user?.safeAddress,
    formattedBalance: formatUnits(state.balance, G_DOLLAR_DECIMALS),
    formattedEntitlement: formatUnits(state.entitlement, G_DOLLAR_DECIMALS),
    verify,
    claim,
    sweep,
    refresh,
  };
};

export default useGoodDollarClaim;
