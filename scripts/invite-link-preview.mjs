/**
 * The link preview of the invite page (app.solid.xyz/invite/CODE).
 *
 * Every web page gets the site-wide preview from app/+html.tsx ("Solid - The
 * Savings Super-App" and the old image). Telegram, WhatsApp, X and the rest
 * read those tags from the HTML without running the app, so the invite page
 * needs its own in the exported file itself: this rewrites them in
 * dist/invite/[code].html after `expo export`. In the `single` output (dev
 * builds) there is no such file and nothing changes.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const INVITE_PREVIEW = {
  title: "You're invited to Solid",
  description: 'Sign up with this invite and get a bonus to spend with your Solid card.',
  image: 'https://app.solid.xyz/assets/images/invite-open-graph.jpg',
  url: 'https://app.solid.xyz/invite',
};

const escape = value =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Sets the content of one <meta> tag, found by its property or name. */
function setMeta(html, key, value) {
  const tag = new RegExp(`(<meta\\s+(?:property|name)="${key}"\\s+content=")[^"]*(")`, 'g');
  if (!tag.test(html)) throw new Error(`invite link preview: no <meta> for ${key}`);
  return html.replace(tag, `$1${escape(value)}$2`);
}

/** The invite page's HTML with its own title, description and image. */
export function withInvitePreview(html, preview = INVITE_PREVIEW) {
  let out = html.replace(/<title>[^<]*<\/title>/g, `<title>${escape(preview.title)}</title>`);
  out = setMeta(out, 'description', preview.description);
  for (const key of ['og:title', 'twitter:title']) out = setMeta(out, key, preview.title);
  for (const key of ['og:description', 'twitter:description']) {
    out = setMeta(out, key, preview.description);
  }
  for (const key of ['og:image', 'twitter:image']) out = setMeta(out, key, preview.image);
  return setMeta(out, 'og:url', preview.url);
}

/** Rewrites dist/invite/[code].html in place; true when it did. */
export function patchInvitePreview(dist = 'dist') {
  const file = join(dist, 'invite', '[code].html');
  if (!existsSync(file)) {
    console.log(`[invite-link-preview] ${file} not found (single output): left as is`);
    return false;
  }
  writeFileSync(file, withInvitePreview(readFileSync(file, 'utf8')));
  console.log(`[invite-link-preview] set the invite page's link preview in ${file}`);
  return true;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  patchInvitePreview(process.argv[2] ?? 'dist');
}
