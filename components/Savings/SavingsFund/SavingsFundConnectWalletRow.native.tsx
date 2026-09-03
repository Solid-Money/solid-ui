/**
 * Native stub for the desktop-only "Send from your crypto wallet" row.
 *
 * External-wallet connect is thirdweb, and the ThirdwebProvider is mounted on
 * desktop web only — `useDimension().isDesktop` is always false off web, so the
 * caller never renders this. It exists so Metro resolves the specifier here on
 * native and keeps the thirdweb bundle (and `useActiveAccount`, which throws
 * without its provider) off the native render path entirely.
 */
const SavingsFundConnectWalletRow = () => null;

export default SavingsFundConnectWalletRow;
