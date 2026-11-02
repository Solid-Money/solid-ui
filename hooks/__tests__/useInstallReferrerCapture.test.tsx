import React from 'react';
import { Platform } from 'react-native';

import { useInstallReferrerCapture } from '@/hooks/useInstallReferrerCapture';

const { act, create } = jest.requireActual('react-test-renderer');

const mockGetInstallReferrer = jest.fn();
jest.mock('expo-application', () => ({
  getInstallReferrerAsync: () => mockGetInstallReferrer(),
}));

const mockLookup = jest.fn();
jest.mock('@/lib/api', () => ({
  fetchReferralInvite: (code: string) => mockLookup(code),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

let mockReferral: any;
jest.mock('@/store/useReferralStore', () => {
  const useReferralStore = (select: (state: any) => any) => select(mockReferral);
  useReferralStore.getState = () => mockReferral;
  return { useReferralStore };
});

let mockUsers: any;
jest.mock('@/store/useUserStore', () => {
  const useUserStore = (select: (state: any) => any) => select(mockUsers);
  useUserStore.getState = () => mockUsers;
  return { useUserStore };
});

const originalOS = Platform.OS;

const Probe = () => {
  useInstallReferrerCapture();
  return null;
};

/** Let the hook's promise chain run to the end. */
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('useInstallReferrerCapture', () => {
  let root: any;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetInstallReferrer.mockReset();
    mockLookup.mockReset();
    mockReferral = {
      _hasHydrated: true,
      installReferrerChecked: false,
      referralCode: null,
      setInstallReferrerChecked: jest.fn((checked = true) => {
        mockReferral.installReferrerChecked = checked;
      }),
      setReferralCode: jest.fn((code: string | null) => {
        mockReferral.referralCode = code;
      }),
    };
    mockUsers = { _hasHydrated: true, users: [] };
  });

  afterEach(() => {
    act(() => root?.unmount());
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    jest.restoreAllMocks();
  });

  const mount = async () => {
    await act(async () => {
      root = create(<Probe />);
      await flush();
    });
  };

  it('asks again next launch when Play cannot answer, instead of losing the invite', async () => {
    mockGetInstallReferrer.mockRejectedValue(new Error('SERVICE_UNAVAILABLE'));

    await mount();

    expect(mockGetInstallReferrer).toHaveBeenCalledTimes(1);
    expect(mockReferral.installReferrerChecked).toBe(false);
    expect(mockReferral.setReferralCode).not.toHaveBeenCalled();
  });

  it('keeps the code and never asks again after a successful read', async () => {
    mockGetInstallReferrer.mockResolvedValue('ref=DANA42');
    mockLookup.mockResolvedValue({ valid: true, code: 'Dana42' });

    await mount();

    expect(mockReferral.installReferrerChecked).toBe(true);
    expect(mockReferral.setReferralCode).toHaveBeenCalledWith('Dana42', 'install_referrer');
  });

  it('marks the referrer read even when the lookup is down', async () => {
    mockGetInstallReferrer.mockResolvedValue('ref=DANA42');
    mockLookup.mockRejectedValue(new Error('offline'));

    await mount();

    expect(mockReferral.installReferrerChecked).toBe(true);
    expect(mockReferral.setReferralCode).toHaveBeenCalledWith('DANA42', 'install_referrer');
  });

  it('does not read the referrer once someone is signed in', async () => {
    mockUsers = { _hasHydrated: true, users: [{ id: 'u1' }] };

    await mount();

    expect(mockGetInstallReferrer).not.toHaveBeenCalled();
    expect(mockReferral.installReferrerChecked).toBe(true);
  });
});
