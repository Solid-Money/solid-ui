/**
 * Where the support service is when a build doesn't say
 * (`EXPO_PUBLIC_SUPPORT_API_BASE_URL` unset), from the accounts API the build
 * talks to: accounts-qa.solid.xyz → support-api-qa.solid.xyz, and
 * accounts.solid.xyz → support-api.solid.xyz. Anything else (local, preview)
 * gets '' (chat unavailable, Intercom stays). Who sees the chat is still the
 * server's `supportChat` feature whitelist.
 */
export const QA_SUPPORT_API_URL = 'https://support-api-qa.solid.xyz';
export const PROD_SUPPORT_API_URL = 'https://support-api.solid.xyz';

export function supportApiUrlFor(accountsApiUrl: string): string {
  const url = accountsApiUrl.trim();
  if (/^https:\/\/accounts-qa\.solid\.xyz\/?$/i.test(url)) return QA_SUPPORT_API_URL;
  if (/^https:\/\/accounts\.solid\.xyz\/?$/i.test(url)) return PROD_SUPPORT_API_URL;
  return '';
}
