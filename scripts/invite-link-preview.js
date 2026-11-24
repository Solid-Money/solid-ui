/**
 * Gives the invite page (/invite/CODE) its own link preview.
 *
 * The static web export writes the same site-wide tags from app/+html.tsx into
 * every page, and link-preview crawlers (Telegram, WhatsApp) do not run
 * JavaScript, so the invite-specific tags have to be swapped into the exported
 * HTML itself. Run after `expo export -p web`.
 *
 * CommonJS so the pure helper can be unit-tested under jest-expo, which does
 * not transform ESM `.mjs` sources.
 */
const { existsSync, readFileSync, writeFileSync } = require('node:fs');

const INVITE_PREVIEW = {
  title: "You're invited to Solid",
  description: 'Sign up with this invite and get card credit to spend with your Solid card.',
  image: 'https://app.solid.xyz/assets/images/invite-open-graph.png',
};

const escapeAttr = value =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const TAGS = [
  ['property', 'og:title', 'title'],
  ['property', 'og:description', 'description'],
  ['property', 'og:image', 'image'],
  ['name', 'twitter:title', 'title'],
  ['name', 'twitter:description', 'description'],
  ['name', 'twitter:image', 'image'],
  ['name', 'description', 'description'],
];

/**
 * Returns the HTML with the invite preview tags applied; throws if a tag is missing.
 * The canonical link and og:url keep the site-wide value: the page is one static
 * file for every code and there is no bare /invite page to point at.
 */
function applyInvitePreview(html, preview = INVITE_PREVIEW) {
  let out = html;
  for (const [attr, key, field] of TAGS) {
    const tag = new RegExp(`<meta ${attr}="${key}" content="[^"]*"\\s*/?>`);
    if (!tag.test(out)) throw new Error(`[invite-preview] ${key} tag not found`);
    out = out.replace(tag, `<meta ${attr}="${key}" content="${escapeAttr(preview[field])}"/>`);
  }
  out = out.replace(
    /<title([^>]*)>[^<]*<\/title>/,
    `<title$1>${escapeAttr(preview.title)}</title>`,
  );
  return out;
}

module.exports = { applyInvitePreview, INVITE_PREVIEW };

if (require.main === module) {
  const file = process.argv[2] ?? 'dist/invite/[code].html';
  if (!existsSync(file)) {
    // Non-production builds export a single page and have no invite HTML.
    console.warn(`[invite-preview] ${file} not found, skipped`);
    process.exit(0);
  }
  writeFileSync(file, applyInvitePreview(readFileSync(file, 'utf8')));
  console.log(`[invite-preview] updated ${file}`);
}
