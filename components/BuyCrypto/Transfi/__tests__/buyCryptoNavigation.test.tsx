import type { ReactNode } from 'react';
import fs from 'fs';
import path from 'path';

import {
  BuyCryptoNavigationProvider,
  useBuyCryptoNavigation,
} from '@/components/BuyCrypto/Transfi/BuyCryptoNavigation';

// The project does not include react-dom declarations; keep this test helper typed locally.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToStaticMarkup } = require('react-dom/server') as {
  renderToStaticMarkup: (children: ReactNode) => string;
};

const mockGlobalNavigate = jest.fn();

jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: (selector: (state: { setModal: typeof mockGlobalNavigate }) => unknown) =>
    selector({ setModal: mockGlobalNavigate }),
}));

describe('BuyCryptoNavigationProvider', () => {
  it('keeps TransFi transitions in an embedded funding modal', () => {
    const embeddedNavigate = jest.fn();
    const Probe = () => (
      <span>{useBuyCryptoNavigation() === embeddedNavigate ? 'embedded' : 'global'}</span>
    );

    const rendered = renderToStaticMarkup(
      <BuyCryptoNavigationProvider navigate={embeddedNavigate}>
        <Probe />
      </BuyCryptoNavigationProvider>,
    );

    expect(rendered).toContain('embedded');
  });

  it('preserves the global deposit modal for wallet-originated purchases', () => {
    const Probe = () => (
      <span>{useBuyCryptoNavigation() === mockGlobalNavigate ? 'global' : 'embedded'}</span>
    );

    const rendered = renderToStaticMarkup(<Probe />);

    expect(rendered).toContain('global');
  });
});

describe('TransFi screens', () => {
  it('route through the active Buy crypto host instead of opening another modal', () => {
    const directory = path.join(__dirname, '..');
    const navigationScreens = [
      'TransfiAmount.tsx',
      'TransfiCurrencySelector.tsx',
      'TransfiError.tsx',
      'TransfiKycConsent.tsx',
      'TransfiKycPending.tsx',
      'TransfiOrderStatus.tsx',
      'TransfiPayment.native.tsx',
      'TransfiPaymentHandoff.tsx',
      'TransfiPaymentMethodSelector.tsx',
      'TransfiProfileForm.tsx',
    ];

    for (const file of navigationScreens) {
      const source = fs.readFileSync(path.join(directory, file), 'utf8');
      expect(source).toContain('useBuyCryptoNavigation()');
      expect(source).not.toContain("from '@/store/useDepositStore'");
    }
  });
});
