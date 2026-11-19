import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  WALLET_CHECKOUT_APPEARANCE,
  WALLET_CHECKOUT_BRANDING,
  WALLET_CHECKOUT_BUTTONS,
} from '@/components/WalletTopUp/checkoutTheme';
import {
  canLoadWirexWallet,
  loadWirexMobileSdk,
  toWirexMobileConfig,
} from '@/lib/wirexMobileWallet';

import type { WalletCheckoutProps } from './WalletCheckout.types';
import type { WirexWalletCheckoutEvent, WirexWalletQuote } from '@wirexapp/mobile-sdk';

/**
 * Native: Wirex's checkout view, in token mode — it runs the Apple Pay or Google
 * Pay sheet and executes the top-up itself, so the wallet's payment token never
 * reaches the app.
 *
 * The native SDK has no compact layout: its card shows the top-up amount, the fee
 * and the rate, which is why our summary above it does not.
 *
 * There is no imperative API. A fresh quote with its own token, passed as props,
 * re-arms the view in place.
 */
export const WalletCheckout = ({ sdk, checkout, handlers }: WalletCheckoutProps) => {
  const { mobileEnvironment, clientId } = sdk;
  const config = useMemo(
    () => toWirexMobileConfig({ mobileEnvironment, clientId }),
    [clientId, mobileEnvironment],
  );
  const isLoadable = useMemo(() => canLoadWirexWallet(config.environment), [config]);
  const [height, setHeight] = useState<number | undefined>(undefined);

  const quote = useMemo<WirexWalletQuote>(
    () => ({
      estimationId: checkout.quote.estimationId,
      sourceAmount: checkout.quote.sourceAmount,
      destinationAmount: checkout.quote.destinationAmount,
      fee: checkout.quote.fee ?? undefined,
      rate: checkout.quote.rate ?? undefined,
      expiresAtMs: checkout.quote.expiresAtMs,
    }),
    [checkout.quote],
  );
  // One checkout token per armed quote: it travels with the quote it was minted for.
  const auth = useMemo(() => ({ checkoutToken: checkout.checkoutToken }), [checkout.checkoutToken]);

  const onEvent = useCallback(
    (event: WirexWalletCheckoutEvent) => {
      switch (event.type) {
        case 'naturalHeight':
          setHeight(event.height);
          return;
        case 'sheetOpen':
          handlers.onSheetOpen();
          return;
        case 'cancelled':
          handlers.onCancel();
          return;
        case 'attemptFailed':
          handlers.onAttemptFailed(event.reason);
          return;
        case 'estimationExpired':
          handlers.onEstimationExpired();
          return;
        case 'executed':
          handlers.onExecuted({ id: event.result.id, status: event.result.status });
          return;
        case 'executeFailed':
          handlers.onExecuteFailed({ reason: event.error.reason, status: event.error.statusCode });
          return;
        case 'failed':
          handlers.onLoadFailed(event.error.kind);
          return;
        // `ready` and `executing` need nothing from us — the view draws its own
        // states — and `token` is legacy mode only.
        default:
          return;
      }
    },
    [handlers],
  );

  // A binary without the SDK cannot draw the checkout: say so rather than crash.
  useEffect(() => {
    if (!isLoadable) handlers.onLoadFailed('not_loadable');
  }, [handlers, isLoadable]);

  // `isLoadable` implies the SDK loaded; read it again only to name the component.
  const WirexWalletCheckoutView = loadWirexMobileSdk()?.WirexWalletCheckoutView;
  if (!isLoadable || !WirexWalletCheckoutView) return null;

  return (
    <WirexWalletCheckoutView
      config={config}
      quote={quote}
      providerConfig={checkout.walletConfig}
      provider={checkout.provider}
      auth={auth}
      appearance={WALLET_CHECKOUT_APPEARANCE}
      buttons={WALLET_CHECKOUT_BUTTONS}
      branding={WALLET_CHECKOUT_BRANDING}
      onEvent={onEvent}
      // The height the page reports for itself. Until it does, the view keeps its
      // own room for the loading skeleton, which an explicit undefined would clear.
      style={height ? { width: '100%', height } : { width: '100%' }}
    />
  );
};

export default WalletCheckout;
