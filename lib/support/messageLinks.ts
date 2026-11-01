/**
 * Which links in a support reply may open when tapped.
 *
 * Replies render as Markdown, and Markdown turns every URL into a link that
 * opens through `Linking.openURL`, whatever its scheme. Solid AI's text comes
 * from a model, and a model answer can be steered (or, through a bad route to
 * the model, written by someone else), so its links are held to our own
 * domain. Teammates write their replies themselves; theirs may open any web
 * page or email address, never a script, an app or a wallet scheme.
 */
export type SupportLinkPolicy = 'solid' | 'web';

const OWN_DOMAIN = 'solid.xyz';

/**
 * Scheme and host of an absolute URL. Parsed by hand: React Native's `URL`
 * does not implement `protocol` or `hostname` on every platform. A userinfo
 * part (`https://solid.xyz@other.example`) is skipped, so the host is the one
 * the browser would open.
 */
const URL_PARTS = /^([a-z][a-z0-9+.-]*):(?:\/\/(?:[^@/?#]*@)?([^/?#:]*))?/i;

/**
 * Whitespace, control characters and backslashes are how hosts get disguised
 * (a browser reads `\` as `/`); a real link has none of them.
 */
function hasHiddenCharacters(href: string): boolean {
  if (/[\s\\]/.test(href)) return true;
  for (let i = 0; i < href.length; i++) {
    const code = href.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function canOpenSupportLink(href: string, policy: SupportLinkPolicy): boolean {
  if (!href || hasHiddenCharacters(href)) return false;
  const parts = URL_PARTS.exec(href);
  if (!parts) return false;
  const scheme = parts[1].toLowerCase();
  if (policy === 'web') {
    return scheme === 'https' || scheme === 'http' || scheme === 'mailto';
  }
  if (scheme !== 'https' && scheme !== 'http') return false;
  const host = (parts[2] ?? '').toLowerCase().replace(/\.$/, '');
  return host === OWN_DOMAIN || host.endsWith(`.${OWN_DOMAIN}`);
}
