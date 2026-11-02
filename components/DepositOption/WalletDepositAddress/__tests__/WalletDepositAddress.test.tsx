import React from 'react';

import WalletDepositAddress from '@/components/DepositOption/WalletDepositAddress';
import { DEPOSIT_MODAL } from '@/constants/modals';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('lucide-react-native', () => ({ ChevronRight: 'ChevronRight' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/CopyToClipboard', () => 'CopyToClipboard');
jest.mock('@/components/DepositOption/DepositFeeNotice', () => 'DepositFeeNotice');
jest.mock('@/components/Card/CardFund/DepositScanningIndicator', () => 'DepositScanningIndicator');
jest.mock('@/components/DepositOption/WalletDepositAddress/WalletDepositSelectors', () => ({
  __esModule: true,
  default: 'WalletDepositSelectors',
  WalletDepositNetworkList: 'WalletDepositNetworkList',
}));
jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));
jest.mock('@/lib/help/links', () => ({ openHelpLink: jest.fn() }));
jest.mock('@/lib/utils', () => ({ eclipseAddress: (address: string) => address }));
jest.mock('@/hooks/useCardProvider', () => ({
  useCardProvider: () => ({ provider: 'wirex' }),
}));
jest.mock('@/hooks/useDepositAssets', () => ({
  useDepositAssets: () => ({ data: undefined }),
}));
jest.mock('@/hooks/useEuroSpendEnablement', () => ({
  useEuroSpendEnablement: () => ({ shouldOffer: false }),
}));
jest.mock('@/hooks/useWalletDepositAddress', () => ({
  useWalletDepositAddress: () => ({ address: '0xabc', isError: false, isMinted: true }),
}));
jest.mock('@/components/DepositOption/WalletDepositAddress/useWalletDepositViewer', () => ({
  useWalletDepositViewer: () => ({ provider: 'wirex', hasNewTokens: true }),
}));
jest.mock('@/hooks/useDetectedDirectDeposit', () => ({
  useDetectedDirectDeposit: (params: any) => {
    mockDetected.params = params;
    return { isDetected: false };
  },
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
// No rhino.fi chain is selected in these cases: the screen is the Safe / minted address.
jest.mock('@/hooks/useRhinoDepositAssets', () => ({
  useOfferedRhinoDepositAssets: () => undefined,
}));
jest.mock('@/hooks/useRhinoDepositAddress', () => ({
  useRhinoDepositAddress: () => ({ address: undefined, isError: false, refetch: jest.fn() }),
}));
jest.mock('@/components/DepositOption/RhinoDeposit/useRhinoAddressAnalytics', () => ({
  useRhinoAddressAnalytics: () => jest.fn(),
}));
jest.mock('@/components/DepositOption/RhinoDeposit/RhinoDepositStatus', () => 'RhinoDepositStatus');
jest.mock(
  '@/components/DepositOption/RhinoDeposit/RhinoDepositDetails',
  () => 'RhinoDepositDetails',
);
jest.mock('@/components/DepositOption/RhinoDeposit/RhinoChainIcon', () => ({
  __esModule: true,
  default: 'RhinoChainIcon',
  getRhinoChainIcon: () => undefined,
}));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: (selector: (state: any) => unknown) => selector(mockDeposit),
}));

const mockRouter = { push: jest.fn() };
const mockDetected: { params?: any } = {};
const mockDeposit = {
  walletDeposit: { chainId: 8453, symbol: 'USDC' },
  setModal: jest.fn(),
  setWalletDeposit: jest.fn(),
};

const render = () => {
  act(() => {
    create(<WalletDepositAddress />);
  });
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockDetected.params = undefined;
});

describe('WalletDepositAddress', () => {
  it('watches the minted address for a deposit', () => {
    render();

    expect(mockDetected.params).toEqual(
      expect.objectContaining({ enabled: true, onDetected: expect.any(Function) }),
    );
  });

  it("closes the sheet and opens the deposit's progress once it is detected", () => {
    render();

    act(() => {
      mockDetected.params.onDetected({ detected: true, clientTxId: 'direct_deposit_123' });
    });

    expect(mockDeposit.setModal).toHaveBeenCalledWith(DEPOSIT_MODAL.CLOSE);
    expect(mockRouter.push).toHaveBeenCalledWith('/activity/direct_deposit_123');
  });

  it('stays put when the detected deposit has no activity to open', () => {
    render();

    act(() => {
      mockDetected.params.onDetected({ detected: true });
    });

    expect(mockDeposit.setModal).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
