// Run with: node --test scripts/invite-link-preview.test.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { INVITE_PREVIEW, patchInvitePreview, withInvitePreview } from './invite-link-preview.mjs';

// The head as app/+html.tsx and the root layout render it.
const SITE_HEAD = `<html><head><title data-rh="true"></title>
<meta name="description" content="Solid is the savings super-app"/>
<meta property="og:title" content="Solid - The Savings Super-App"/>
<meta property="og:description" content="Solid is a yield-bearing account"/>
<meta property="og:image" content="https://app.solid.xyz/assets/images/solid-open-graph.png"/>
<meta property="og:url" content="https://app.solid.xyz"/>
<meta name="twitter:title" content="Solid - The Savings Super-App"/>
<meta name="twitter:description" content="Solid is a yield-bearing account"/>
<meta name="twitter:image" content="https://app.solid.xyz/assets/images/solid-open-graph.png"/>
</head><body></body></html>`;

test('the invite page gets its own title, description and image', () => {
  const html = withInvitePreview(SITE_HEAD);
  assert.match(html, /<title data-rh="true">You're invited to Solid<\/title>/);
  assert.match(html, /property="og:title" content="You're invited to Solid"/);
  assert.match(html, /name="twitter:title" content="You're invited to Solid"/);
  for (const key of ['description', 'og:description', 'twitter:description']) {
    assert.ok(html.includes(`"${key}" content="${INVITE_PREVIEW.description}"`), key);
  }
  assert.equal(html.match(/invite-open-graph\.jpg/g).length, 2);
  assert.ok(!html.includes('Savings Super-App'));
  assert.ok(!html.includes('solid-open-graph.png'));
});

test('a missing tag fails the build instead of shipping the old preview', () => {
  assert.throws(() => withInvitePreview('<html><head></head></html>'), /no <title>/);
  const noTitle = SITE_HEAD.replace('<title data-rh="true"></title>', '');
  assert.throws(() => withInvitePreview(noTitle), /no <title>/);
  const noImage = SITE_HEAD.replace(/<meta property="og:image"[^>]*>/, '');
  assert.throws(() => withInvitePreview(noImage), /no <meta> for og:image/);
});

test('only the invite page is rewritten, and nothing happens without it', () => {
  const dist = mkdtempSync(join(tmpdir(), 'dist-'));
  assert.equal(patchInvitePreview(dist), false);
  mkdirSync(join(dist, 'invite'));
  writeFileSync(join(dist, 'invite', '[code].html'), SITE_HEAD);
  writeFileSync(join(dist, 'index.html'), SITE_HEAD);
  assert.equal(patchInvitePreview(dist), true);
  assert.match(readFileSync(join(dist, 'invite', '[code].html'), 'utf8'), /invited to Solid/);
  assert.equal(readFileSync(join(dist, 'index.html'), 'utf8'), SITE_HEAD);
});
