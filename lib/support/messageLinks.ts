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

/** The scheme of an absolute URL. */
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

/**
 * An authority that is only a host name and, at most, a numeric port.
 * Parsed by hand: React Native's `URL` does not implement `protocol` or
 * `hostname` on every platform. Anything else is refused rather than read:
 * a link to our domain never carries a username, and a browser takes the
 * host after the LAST "@" (`https://a@solid.xyz:443@other.example` opens
 * other.example), so an authority with "@", a percent-escape, brackets or a
 * second ":" has no host this check will vouch for.
 */
const PLAIN_AUTHORITY = /^((?:[a-z0-9-]+\.)*[a-z0-9-]+)\.?(?::(\d{1,5}))?$/i;

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
  const scheme = SCHEME.exec(href)?.[1].toLowerCase();
  if (!scheme) return false;
  if (policy === 'web') {
    return scheme === 'https' || scheme === 'http' || scheme === 'mailto';
  }
  if (scheme !== 'https' && scheme !== 'http') return false;
  const rest = href.slice(scheme.length + 1);
  if (!rest.startsWith('//')) return false;
  // The authority runs to the first "/", "?" or "#" (backslashes were refused above).
  const authority = rest.slice(2).split(/[/?#]/, 1)[0];
  const plain = PLAIN_AUTHORITY.exec(authority);
  // No empty labels (".solid.xyz") and a real port: anything else doesn't open.
  if (!plain || (plain[2] !== undefined && Number(plain[2]) > 65535)) return false;
  const host = plain[1].toLowerCase();
  return host === OWN_DOMAIN || host.endsWith(`.${OWN_DOMAIN}`);
}
