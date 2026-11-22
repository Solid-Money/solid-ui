import { useEffect, useRef } from 'react';
import { createWalletTopUpForm } from '@wirexapp/card-wallet-topup-web';

import {
  WALLET_CHECKOUT_APPEARANCE,
  WALLET_CHECKOUT_BRANDING,
  WALLET_CHECKOUT_BUTTONS,
} from '@/components/WalletTopUp/checkoutTheme';

import type { WalletCheckoutProps } from './WalletCheckout.types';
import type { WalletTopUpQuoteResponse } from '@/lib/types/wallet-topup';
import type { WalletTopUpForm, WalletTopUpFormConfig } from '@wirexapp/card-wallet-topup-web';

const toFrameQuote = (checkout: WalletTopUpQuoteResponse): WalletTopUpFormConfig['quote'] => ({
  estimationId: checkout.quote.estimationId,
  sourceAmount: checkout.quote.sourceAmount,
  destinationAmount: checkout.quote.destinationAmount,
  fee: checkout.quote.fee ?? undefined,
  rate: checkout.quote.rate ?? undefined,
  expiresAtMs: checkout.quote.expiresAtMs,
});

// Verbatim: the frame copies the provider's values into the Apple and Google
// payment requests unchanged.
const toFrameWalletConfig = (checkout: WalletTopUpQuoteResponse) =>
  checkout.walletConfig as WalletTopUpFormConfig['walletConfig'];

/**
 * Web: Wirex's checkout frame, in token mode and the compact layout — only the
 * total, the wallet button and the countdown, under our own summary.
 *
 * Apple binds its payment session to the top-level page's domain, and ours is
 * not registered with Apple, so the Apple Pay button runs the sheet in a small
 * popup on Wirex's domain. Desktop Chrome cannot pay with Google Pay at all; the
 * frame draws a QR that finishes the payment on an Android phone, and never
 * learns how it went — the review step polls the status instead.
 *
 * Mounted once per environment. A fresh quote is armed in place with `update()`,
 * and the frame is destroyed on unmount.
 */
export const WalletCheckout = ({ sdk, checkout, handlers }: WalletCheckoutProps) => {
  const { webEnvironment, clientId } = sdk;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<WalletTopUpForm | null>(null);
  // The frame's callbacks are bound once at mount; they read the latest through these.
  const handlersRef = useRef(handlers);
  const checkoutRef = useRef(checkout);
  const armedEstimationRef = useRef<string | null>(null);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!clientId) {
      handlersRef.current.onLoadFailed('no_client_id');
      return;
    }

    const initial = checkoutRef.current;
    const form = createWalletTopUpForm(
      { environment: webEnvironment, clientId },
      {
        quote: toFrameQuote(initial),
        walletConfig: toFrameWalletConfig(initial),
        provider: initial.provider,
        auth: { checkoutToken: initial.checkoutToken },
        layout: 'compact',
        applePayHandoff: 'popup',
        googlePayHandoff: 'qr',
        appearance: WALLET_CHECKOUT_APPEARANCE,
        buttons: WALLET_CHECKOUT_BUTTONS,
        branding: WALLET_CHECKOUT_BRANDING,
        onStateChange: state => {
          if (state === 'sheet-open') handlersRef.current.onSheetOpen();
          if (state === 'handoff-pending') handlersRef.current.onHandoffPending();
        },
        onCancel: () => handlersRef.current.onCancel(),
        onAttemptFailed: reason => handlersRef.current.onAttemptFailed(reason),
        onEstimationExpired: () => handlersRef.current.onEstimationExpired(),
        onExecuted: result =>
          handlersRef.current.onExecuted({ id: result.id, status: result.status }),
        onExecuteFailed: error =>
          handlersRef.current.onExecuteFailed({ reason: error.reason, status: error.status }),
      },
    );
    formRef.current = form;
    armedEstimationRef.current = initial.estimationId;

    let isMounted = true;
    form.mount(container).catch(() => {
      if (isMounted) handlersRef.current.onLoadFailed('mount_failed');
    });

    return () => {
      isMounted = false;
      form.destroy();
      formRef.current = null;
      armedEstimationRef.current = null;
    };
  }, [clientId, webEnvironment]);

  // A fresh quote, with the token minted for it: re-arm the mounted frame in place.
  useEffect(() => {
    checkoutRef.current = checkout;
    const form = formRef.current;
    if (!form || armedEstimationRef.current === checkout.estimationId) return;
    armedEstimationRef.current = checkout.estimationId;
    form
      .update(
        toFrameQuote(checkout),
        toFrameWalletConfig(checkout),
        { checkoutToken: checkout.checkoutToken },
        checkout.provider,
      )
      .catch(() => handlersRef.current.onLoadFailed('update_failed'));
  }, [checkout]);

  // The frame sizes itself; the container only needs the width.
  return <div ref={containerRef} style={{ width: '100%' }} />;
};

export default WalletCheckout;
