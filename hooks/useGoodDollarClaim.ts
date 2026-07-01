import { useCallback, useEffect, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  ClaimCustodialSDK,
  ClaimSDK,
  IdentityCustodialSDK,
  IdentitySDK,
  SupportedChains,
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
  GOODDOLLAR_CHAIN_ID,
  GOODDOLLAR_ENV,
  GOODDOLLAR_FUSE,
  GOODDOLLAR_REDIRECT_PATH,
  getGoodDollarExplorerTxUrl,
} from '@/constants/gooddollar';
import { useActivityActions } from '@/hooks/useActivityActions';
import useUser from '@/hooks/useUser';
import { TransactionStatus, TransactionType } from '@/lib/types';
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

const extractTxHash = (receipt: any): string | undefined =>
  receipt?.transactionHash ?? receipt?.receipt?.transactionHash ?? undefined;

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

  useEffect(() => {
    if (user?.walletAddress) {
      void refresh();
    }
  }, [refresh, user?.walletAddress]);

  // Opens GoodDollar's hosted Face Verification (FaceTec liveness) flow in an
  // in-app browser and re-checks whitelist status on-chain when it returns.
  const verify = useCallback(async () => {
    setIsVerifying(true);
    try {
      const { identitySDK } = await getSdks();
      const redirectUrl = getRedirectUrl();

      // Signs the FV identifier message with the EOA (triggers a passkey prompt)
      // and builds the hosted verification URL. popupMode=false → redirect mode
      // with a deep-link callback, which is GoodDollar's recommended mobile flow.
      const link = await identitySDK.generateFVLink(false, redirectUrl, SupportedChains.FUSE);

      await WebBrowser.openAuthSessionAsync(link, redirectUrl);

      // Trust the chain, not the redirect params: re-read whitelist status.
      await refresh();
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
  }, [getSdks, refresh]);

  const claim = useCallback(async () => {
    let clientTxId: string | null = null;
    setIsClaiming(true);
    setClaimMessage('Preparing your claim…');

    try {
      const { claimSDK, account } = await getSdks();

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

      // claim() tops up gas via GoodDollar's Fuse faucet if needed, then calls
      // claim() on the UBI scheme. Both may prompt the passkey signer.
      const receipt = await claimSDK.claim((message: string) => setClaimMessage(message));
      const hash = extractTxHash(receipt);

      await updateActivity(clientTxId, {
        status: TransactionStatus.SUCCESS,
        hash,
        url: hash ? getGoodDollarExplorerTxUrl(hash) : undefined,
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
  }, [createActivity, getSdks, refresh, updateActivity]);

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
      const { claimSDK, walletClient, readClient, account } = await getSdks();
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

      // Ensure the EOA has enough native FUSE to pay for the transfer (tops up
      // via GoodDollar's faucet if needed). Best effort — a gas error on the
      // transfer itself is surfaced below.
      try {
        await claimSDK.checkBalanceWithRetry();
      } catch {
        // ignore — proceed to the transfer
      }

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
  }, [createActivity, getSdks, refresh, updateActivity, user?.safeAddress]);

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
