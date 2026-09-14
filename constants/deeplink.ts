/**
 * Hosts that serve Universal Links (iOS) and App Links (Android) for the app —
 * the ones declared in `app.config.ts` under `associatedDomains` and the
 * autoVerify intent filter.
 *
 * Shared rather than declared per call site, because it is the allowlist two
 * separate entry points check before they let an outside URL choose an in-app
 * screen: `redirectSystemPath` (`app/+native-intent.tsx`), for links the OS
 * hands us, and `routeForLink` (`hooks/usePushNotifications.ts`), for the deep
 * link a push carries. Two copies of an allowlist drift, and the copy that
 * falls behind is the one that stops trusting a host we do serve.
 *
 * Adding a host here — a staging domain, say — admits it to both. A backend
 * whose `APP_DEEP_LINK_BASE_URL` points somewhere absent from this list will
 * have its push links ignored for routing (the tap falls back to the `type`
 * switch), which is the safe direction but worth knowing.
 *
 * Deliberately free of imports: `+native-intent` is resolved during native
 * startup, before the router exists.
 */
export const KNOWN_HOSTS = ['app.solid.xyz', 'solid.xyz'];
