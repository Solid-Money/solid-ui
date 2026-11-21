import { useMemo } from 'react';

import { useWalletTopUpAvailability } from '@/hooks/useWalletTopUpAvailability';
import {
  canLoadWirexWallet,
  loadWirexMobileSdk,
  toWirexMobileConfig,
} from '@/lib/wirexMobileWallet';

/**
 * Native: runs Wirex's availability probe while the screen offering the top-up
 * row is up, so `useCanWalletTopUp` learns whether this phone can pay.
 *
 * Mounted only for a user the backend offers the top-up to, and only on a binary
 * that carries the SDK. It renders nothing; the probe is a hidden web view the
 * native SDK runs once per app session.
 */
export const WalletTopUpProbe = () => {
  const { availability } = useWalletTopUpAvailability();
  const environment = availability?.sdk?.mobileEnvironment;
  const clientId = availability?.sdk?.clientId ?? null;
  const walletConfig = availability?.walletConfig;

  const config = useMemo(
    () => (environment ? toWirexMobileConfig({ mobileEnvironment: environment, clientId }) : null),
    [clientId, environment],
  );
  const isLoadable = useMemo(() => !!config && canLoadWirexWallet(config.environment), [config]);

  // `isLoadable` implies the SDK loaded; read it again only to name the component.
  const Probe = loadWirexMobileSdk()?.WirexWalletAvailabilityProbe;
  if (!config || !walletConfig || !isLoadable || !Probe) return null;

  return <Probe config={config} providerConfig={walletConfig} />;
};

export default WalletTopUpProbe;
