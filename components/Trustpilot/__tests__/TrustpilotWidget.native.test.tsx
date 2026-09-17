import React from 'react';
import { Platform } from 'react-native';

import TrustpilotReviewCard from '@/components/Trustpilot/TrustpilotReviewCard';
import TrustpilotWidget from '@/components/Trustpilot/TrustpilotWidget';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
// `cn` alone, because `@/lib/utils` is a barrel that reaches wagmi and viem —
// ESM that this jest config does not transform.
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

// Reported as fully configured on purpose. An unconfigured build returns null
// one branch earlier, so testing the default would prove nothing about the
// platform guard — which is the thing that actually protects native.
jest.mock('@/constants/trustpilot', () => ({
  ...jest.requireActual('@/constants/trustpilot'),
  TRUSTPILOT_BUSINESS_UNIT_ID: 'abc123',
  isTrustpilotConfigured: () => true,
}));

/**
 * The Trustpilot components live in plain `.tsx` files rather than `.web.tsx`
 * siblings, so Metro ships them in the native bundle too. That is only safe
 * because every web-only construct sits behind a `Platform.OS === 'web'` guard:
 * the raw `<div>`/`<a>` elements React Native has no renderer for, the
 * `document.createElement` that injects the widget script, and the
 * `window.open` behind the fallback link.
 *
 * A guard like that is easy to move above the code it protects during a later
 * edit, and the failure would only ever appear on a device — a red screen on
 * the settings screen, invisible to `tsc` and to any web build. So it is pinned
 * here rather than left to the comment that explains it.
 */
describe('Trustpilot on native', () => {
  it('is running on a native platform', () => {
    // Guards the test itself: under a web-flavoured preset every assertion
    // below would pass for entirely the wrong reason.
    expect(Platform.OS).not.toBe('web');
  });

  it('renders the widget as nothing, touching no DOM API', () => {
    let tree: any;
    expect(() => {
      act(() => {
        tree = create(<TrustpilotWidget analyticsContext="test" />);
      });
    }).not.toThrow();

    expect(tree.toJSON()).toBeNull();
  });

  it('renders the settings card as nothing', () => {
    let tree: any;
    expect(() => {
      act(() => {
        tree = create(<TrustpilotReviewCard />);
      });
    }).not.toThrow();

    expect(tree.toJSON()).toBeNull();
  });
});
