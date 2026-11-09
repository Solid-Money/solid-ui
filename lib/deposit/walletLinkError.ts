/**
 * Linking a connected wallet failed on the server's side: it refused the link
 * (a smart contract wallet, the wallet limit, an expired request) or couldn't
 * be reached. The message is the server's own, or a plain fallback, and is
 * written for the user, so the deposit sheet shows it as it is.
 */
export class WalletLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletLinkError';
  }
}

/** The server's message when it sent one as text, else `fallback`. */
export const toWalletLinkError = (error: unknown, fallback: string): WalletLinkError => {
  const message = (error as { message?: unknown } | null)?.message;
  return new WalletLinkError(typeof message === 'string' && message ? message : fallback);
};
