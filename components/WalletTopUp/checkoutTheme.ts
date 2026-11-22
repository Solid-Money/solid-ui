/**
 * How Wirex's checkout is dressed, shared by the native view and the web frame.
 *
 * Every colour is one the app already uses for the same job, so the block Wirex
 * draws reads as part of our sheet. The page ground (`surfaceColor`) is left
 * unset: it defaults to transparent, so the modal's own background shows through.
 * The frame validates each token itself and ignores what it does not accept.
 */
export const WALLET_CHECKOUT_APPEARANCE = {
  theme: 'dark' as const,
  variables: {
    // `text-white`, and the `text-white/70` our row titles and subtitles use.
    colorText: '#FFFFFF',
    colorLabel: 'rgba(255,255,255,0.7)',
    colorEmphasis: '#FFFFFF',
    // `bg-card`, with no visible border: our grouped rows have none.
    colorBackground: '#1C1C1C',
    colorBorder: '#1C1C1C',
    // The hairline between rows of a `CardFundGroup`.
    colorDivider: 'rgba(255,255,255,0.06)',
    // `--brand`, and the error tone of the app toast.
    colorFocus: '#94F27F',
    colorError: '#FF6566',
    // `rounded-[15px]`, the radius of our grouped cards.
    borderRadius: '15px',
  },
};

/** The wallets' own presets, in white for a dark sheet. Their text cannot be changed. */
export const WALLET_CHECKOUT_BUTTONS = {
  applePay: { style: 'white' as const, type: 'top-up' as const },
  googlePay: { color: 'white' as const, type: 'pay' as const },
};

/** No Wirex logo over our own screen; the disclosure line names us as the partner. */
export const WALLET_CHECKOUT_BRANDING = {
  logo: 'hidden' as const,
  processingDisclosure: { partnerName: 'Solid' },
};
