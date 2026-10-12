/**
 * Where the support service is when a build doesn't say
 * (`EXPO_PUBLIC_SUPPORT_API_BASE_URL` unset): qa builds, which talk to
 * accounts-qa.solid.xyz, use support-api-qa.solid.xyz. Every other build
 * gets '' (chat unavailable, Intercom stays) until it sets the variable, so
 * production only switches when someone means it to.
 */
export const QA_SUPPORT_API_URL = 'https://support-api-qa.solid.xyz';

export function supportApiUrlFor(accountsApiUrl: string): string {
  return /^https:\/\/accounts-qa\.solid\.xyz\/?$/i.test(accountsApiUrl.trim())
    ? QA_SUPPORT_API_URL
    : '';
}
