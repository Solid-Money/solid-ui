import { Linking } from 'react-native';
import { type Href, router } from 'expo-router';

/** Hosts the help center is served from (and Intercom served before it). */
const HELP_HOSTS = new Set(['support.solid.xyz', 'support-qa.solid.xyz']);

export type HelpTarget =
  | { kind: 'home' }
  | { kind: 'article'; slug: string; anchor: string | null }
  | { kind: 'collection'; slug: string };

const URL_PARTS = /^https?:\/\/([^/?#:]+)(?::\d+)?([^?#]*)(\?[^#]*)?(#.*)?$/i;
const REF = '([a-z0-9][a-z0-9-]{0,159})';
const ARTICLE = new RegExp(`^(?:/en)?/articles/${REF}$`, 'i');
const COLLECTION = new RegExp(`^(?:/en)?/collections/${REF}$`, 'i');

/**
 * What a help center link points at: our URLs (`/articles/<slug>`) and
 * Intercom's (`/en/articles/<id>-<slug>`), which the server resolves. Null
 * for anything else. Regex rather than URL: React Native's URL is partial.
 */
export function parseHelpUrl(url: string): HelpTarget | null {
  const parts = URL_PARTS.exec(url.trim());
  if (!parts || !HELP_HOSTS.has(parts[1].toLowerCase())) return null;
  const path = parts[2].replace(/\/+$/, '') || '/';
  const article = ARTICLE.exec(path);
  if (article) {
    const anchor = parts[4]?.slice(1) || null;
    return { kind: 'article', slug: article[1].toLowerCase(), anchor };
  }
  const collection = COLLECTION.exec(path);
  if (collection) return { kind: 'collection', slug: collection[1].toLowerCase() };
  if (path === '/' || path.toLowerCase() === '/en') return { kind: 'home' };
  return null;
}

export const helpHref = (target: HelpTarget): Href =>
  (target.kind === 'home'
    ? '/help'
    : target.kind === 'article'
      ? `/help/articles/${target.slug}`
      : `/help/collections/${target.slug}`) as Href;

let nativeHelp = false;

/** Set by useSyncNativeHelp: whether this user reads the help center in the app. */
export const setNativeHelpEnabled = (enabled: boolean) => {
  nativeHelp = enabled;
};

export const isNativeHelpEnabled = () => nativeHelp;

/** Opens a help center link in the app when it can, in the browser otherwise. */
export function openHelpLink(url: string): void {
  const target = nativeHelp ? parseHelpUrl(url) : null;
  if (target) {
    router.push(helpHref(target));
    return;
  }
  Linking.openURL(url).catch(() => undefined);
}
