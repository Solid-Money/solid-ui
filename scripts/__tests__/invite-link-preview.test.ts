import { applyInvitePreview, INVITE_PREVIEW } from '../invite-link-preview';

// A trimmed copy of the tags the static export writes into every page from
// app/+html.tsx, so the swap is tested against the real shape of the markup.
const EXPORTED_HEAD =
  `<!DOCTYPE html><html lang="en"><head>` +
  `<title></title>` +
  `<meta name="description" content="Solid is the savings super-app that combines DeFi yields with traditional banking. Earn competitive yields on your savings with institutional-grade security."/>` +
  `<link rel="canonical" href="https://app.solid.xyz"/>` +
  `<meta property="og:type" content="website"/>` +
  `<meta property="og:title" content="Solid - The Savings Super-App"/>` +
  `<meta property="og:description" content="Solid is a yield-bearing account that works in the background."/>` +
  `<meta property="og:image" content="https://app.solid.xyz/assets/images/solid-open-graph.png"/>` +
  `<meta property="og:url" content="https://app.solid.xyz"/>` +
  `<meta name="twitter:card" content="summary_large_image"/>` +
  `<meta name="twitter:title" content="Solid - The Savings Super-App"/>` +
  `<meta name="twitter:description" content="Solid is a yield-bearing account that works in the background."/>` +
  `<meta name="twitter:image" content="https://app.solid.xyz/assets/images/solid-open-graph.png"/>` +
  `</head><body></body></html>`;

describe('applyInvitePreview', () => {
  it('swaps title, description and image across og/twitter tags', () => {
    const out = applyInvitePreview(EXPORTED_HEAD);

    expect(out).toContain(`<title>You're invited to Solid</title>`);
    expect(out).toContain(`<meta property="og:title" content="You're invited to Solid"/>`);
    expect(out).toContain(
      `<meta property="og:description" content="${INVITE_PREVIEW.description}"/>`,
    );
    expect(out).toContain(`<meta property="og:image" content="${INVITE_PREVIEW.image}"/>`);
    expect(out).toContain(`<meta name="twitter:title" content="You're invited to Solid"/>`);
    expect(out).toContain(`<meta name="twitter:image" content="${INVITE_PREVIEW.image}"/>`);
    expect(out).toContain(`<meta name="description" content="${INVITE_PREVIEW.description}"/>`);
  });

  it('leaves the site-wide canonical link and og:url in place', () => {
    const out = applyInvitePreview(EXPORTED_HEAD);

    expect(out).toContain(`<link rel="canonical" href="https://app.solid.xyz"/>`);
    expect(out).toContain(`<meta property="og:url" content="https://app.solid.xyz"/>`);
  });

  it('removes the old site-wide branding from the invite page', () => {
    const out = applyInvitePreview(EXPORTED_HEAD);

    expect(out).not.toContain('Solid - The Savings Super-App');
    expect(out).not.toContain('solid-open-graph.png');
  });

  it('escapes characters that would break an attribute', () => {
    const out = applyInvitePreview(EXPORTED_HEAD, {
      title: 'Ampersand & "quote" <tag>',
      description: 'd',
      image: 'i',
    });

    expect(out).toContain(
      '<meta property="og:title" content="Ampersand &amp; &quot;quote&quot; &lt;tag>"/>',
    );
  });

  it('throws if an expected tag is missing', () => {
    expect(() => applyInvitePreview('<html><head></head></html>')).toThrow('og:title');
  });
});
