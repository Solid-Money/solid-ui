import { useCallback, useEffect, useMemo } from 'react';
import * as Sentry from '@sentry/react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StamperType, useTurnkey } from '@turnkey/react-native-wallet-kit';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { getPasskeys, PasskeyList, PasskeySummary, renamePasskey } from '@/lib/api';
import {
  buildPasskeyAccountName,
  buildSettingsPasskeyName,
  isPasskeyPromptError,
  isSameCredentialSet,
  withRefreshToken,
} from '@/lib/utils';
import { getPasskeyDeviceLabel } from '@/lib/utils/passkeyDevice';
import { selectSelectedCredentialIds, useUserStore } from '@/store/useUserStore';

export const PASSKEYS_QUERY_KEY = 'passkeys';

/** Matches the backend's limit on a passkey name. */
export const PASSKEY_NAME_MAX_LENGTH = 40;

/**
 * How a passkey action ended. `cancelled` is the user closing the system
 * prompt, which needs no message; `failed` carries one that can be shown as is.
 */
export type PasskeyActionResult =
  | { status: 'done' }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string };

const done: PasskeyActionResult = { status: 'done' };
const cancelled: PasskeyActionResult = { status: 'cancelled' };
const failed = (message: string): PasskeyActionResult => ({ status: 'failed', message });

/**
 * Created on the device, then refused by Turnkey (or the approval was
 * dismissed): the passkey may now sit in the user's password manager without
 * being on the account, and nothing we can call removes it from there.
 */
const NOT_ADDED_MESSAGE =
  "The new passkey wasn't added to your account. If your device saved it anyway, you can delete it from your password manager.";

/** The message from a Nest error body, if the failure is one. */
const readApiMessage = async (error: unknown): Promise<string | null> => {
  if (!(error instanceof Response)) return null;
  try {
    const body = (await error.clone().json()) as { message?: unknown };
    const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
    return typeof message === 'string' ? message : null;
  } catch {
    return null;
  }
};

/**
 * The passkeys on the signed-in account, and the three things Settings does
 * with them.
 *
 * Adding and removing are Turnkey activities signed on this device by one of
 * the user's existing passkeys — the same way every other change to the
 * account is approved — so neither needs a session and the backend never holds
 * the authority to do either. Afterwards the backend re-reads the list from
 * Turnkey, which re-syncs the account's stored credentials, and the result is
 * fed back into this device's prompt filter.
 */
export const usePasskeyManager = () => {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { createPasskey, createHttpClient } = useTurnkey();
  const replaceUserCredentialIds = useUserStore(state => state.replaceUserCredentialIds);

  const userId = user?.userId;
  const queryKey = useMemo(() => [PASSKEYS_QUERY_KEY, userId], [userId]);

  const query = useQuery({
    queryKey,
    queryFn: () => withRefreshToken(() => getPasskeys()),
    enabled: !!userId,
    staleTime: 30 * 1000,
    retry: 1,
  });

  const passkeys = useMemo(() => query.data?.passkeys ?? [], [query.data]);

  // Keep this device's passkey prompts filtered to what Turnkey holds now.
  //
  // `TurnkeyProvider` re-mounts the app below it whenever this set changes,
  // which is why it is only written when the set actually differs (not merely
  // its order), and only once an action has finished: a re-mount mid-flow
  // would drop the screen that is waiting on it.
  useEffect(() => {
    const live = query.data?.passkeys.map(passkey => passkey.credentialId) ?? [];
    if (!userId || !live.length) return;

    const local = selectSelectedCredentialIds(useUserStore.getState());
    if (!isSameCredentialSet(live, local)) replaceUserCredentialIds(userId, live);
  }, [query.data, userId, replaceUserCredentialIds]);

  const applyList = useCallback(
    (list: PasskeyList) => queryClient.setQueryData(queryKey, list),
    [queryClient, queryKey],
  );

  /** Everything a Turnkey activity on the user's own account needs. */
  const turnkeyAccount = useMemo(() => {
    const turnkeyUserId = user?.turnkeyUserId ?? query.data?.turnkeyUserId ?? undefined;
    return user?.suborgId && turnkeyUserId
      ? { organizationId: user.suborgId, userId: turnkeyUserId }
      : null;
  }, [user?.suborgId, user?.turnkeyUserId, query.data?.turnkeyUserId]);

  const addPasskey = useCallback(async (): Promise<PasskeyActionResult> => {
    if (!user || !turnkeyAccount) {
      return failed("We couldn't find your account details. Sign in again and retry.");
    }

    let step: 'create' | 'approve' | 'save' = 'create';
    try {
      // The system sheet creates the passkey and lets the user choose where it
      // is saved: this device's keychain, a password manager, a security key,
      // or a phone over QR. Nothing is on the account yet.
      const { encodedChallenge, attestation } = await createPasskey({
        name: buildPasskeyAccountName(user),
      });

      // One of the user's existing passkeys approves adding it. Built on the
      // SDK's own `createAuthenticators` rather than `addPasskey` so the name
      // in the password manager (the account) and the name Turnkey requires to
      // be unique (a timestamp) can differ.
      step = 'approve';
      const passkeyClient = createHttpClient({ defaultStamperType: StamperType.Passkey });
      const result = await passkeyClient.createAuthenticators(
        {
          ...turnkeyAccount,
          authenticators: [
            {
              authenticatorName: buildSettingsPasskeyName(),
              challenge: encodedChallenge,
              attestation,
            },
          ],
        },
        StamperType.Passkey,
      );

      // Named after this device until the user says otherwise. Renaming
      // re-syncs the account's credentials too, so it doubles as the refresh.
      step = 'save';
      const authenticatorId = result?.authenticatorIds?.[0];
      const label = getPasskeyDeviceLabel().slice(0, PASSKEY_NAME_MAX_LENGTH);
      const list = await withRefreshToken(() =>
        authenticatorId ? renamePasskey(authenticatorId, label) : getPasskeys(),
      ).catch(() => withRefreshToken(() => getPasskeys()));
      applyList(list);

      track(TRACKING_EVENTS.PASSKEY_ADDED, {
        context: 'settings',
        passkey_count: list.passkeys.length,
      });
      return done;
    } catch (error) {
      // The passkey is on the account; only naming it or reading the list back
      // failed. A refetch catches the list up, and the name can be set later.
      if (step === 'save') {
        void query.refetch();
        track(TRACKING_EVENTS.PASSKEY_ADDED, { context: 'settings' });
        return done;
      }

      if (isPasskeyPromptError(error)) {
        return step === 'create' ? cancelled : failed(NOT_ADDED_MESSAGE);
      }

      const message = error instanceof Error ? error.message : String(error);
      track(TRACKING_EVENTS.PASSKEY_CREATION_FAILED, { context: 'settings', step, error: message });
      Sentry.captureException(error, {
        tags: { type: 'settings_passkey_add_error', step },
        extra: { turnkeyUserId: turnkeyAccount.userId },
      });
      return failed(
        step === 'create' ? "Couldn't create a passkey. Try again." : NOT_ADDED_MESSAGE,
      );
    }
  }, [user, turnkeyAccount, createPasskey, createHttpClient, applyList, query]);

  const removePasskey = useCallback(
    async (passkey: PasskeySummary): Promise<PasskeyActionResult> => {
      // Also enforced by the UI. Turnkey would allow it, and an account with no
      // passkey can only come back through email recovery — if it has an email.
      if (passkeys.length <= 1) return failed("You can't remove your only passkey.");
      if (!turnkeyAccount) {
        return failed("We couldn't find your account details. Sign in again and retry.");
      }

      try {
        const passkeyClient = createHttpClient({ defaultStamperType: StamperType.Passkey });
        await passkeyClient.deleteAuthenticators(
          { ...turnkeyAccount, authenticatorIds: [passkey.authenticatorId] },
          StamperType.Passkey,
        );
      } catch (error) {
        if (isPasskeyPromptError(error)) return cancelled;

        Sentry.captureException(error, {
          tags: { type: 'settings_passkey_remove_error' },
          extra: { turnkeyUserId: turnkeyAccount.userId },
        });
        return failed("Couldn't remove the passkey. Try again.");
      }

      try {
        applyList(await withRefreshToken(() => getPasskeys()));
      } catch {
        // Turnkey has already removed it, so show that even though the list
        // could not be read back. The next read re-syncs the rest.
        queryClient.setQueryData<PasskeyList>(queryKey, current =>
          current
            ? {
                ...current,
                passkeys: current.passkeys.filter(
                  item => item.authenticatorId !== passkey.authenticatorId,
                ),
              }
            : current,
        );
      }

      track(TRACKING_EVENTS.PASSKEY_REMOVED, {
        context: 'settings',
        passkey_count: passkeys.length - 1,
        was_this_device: passkey.credentialId === user?.credentialId,
      });
      return done;
    },
    [
      passkeys,
      turnkeyAccount,
      createHttpClient,
      applyList,
      queryClient,
      queryKey,
      user?.credentialId,
    ],
  );

  const renamePasskeyTo = useCallback(
    async (passkey: PasskeySummary, name: string): Promise<PasskeyActionResult> => {
      try {
        applyList(await withRefreshToken(() => renamePasskey(passkey.authenticatorId, name)));
        track(TRACKING_EVENTS.PASSKEY_RENAMED, { context: 'settings' });
        return done;
      } catch (error) {
        return failed((await readApiMessage(error)) ?? "Couldn't rename the passkey. Try again.");
      }
    },
    [applyList],
  );

  return {
    passkeys,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    /**
     * The passkey this device last signed in with, read from the login stamp.
     * On the web after a QR sign-in it is the phone's passkey, not the
     * browser's — the closest thing to "this device" WebAuthn will tell us.
     */
    thisDeviceCredentialId: user?.credentialId,
    addPasskey,
    removePasskey,
    renamePasskey: renamePasskeyTo,
  };
};
