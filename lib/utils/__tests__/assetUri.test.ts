import { Asset } from 'expo-asset';

import { resolveAssetUri } from '@/lib/utils/assetUri';

describe('resolveAssetUri', () => {
  afterEach(() => jest.restoreAllMocks());

  it('resolves a bundled asset module to its URL', () => {
    jest
      .spyOn(Asset, 'fromModule')
      .mockImplementation(source => ({ uri: `bundled-${source}.webp` }) as unknown as Asset);
    expect(resolveAssetUri(42)).toBe('bundled-42.webp');
  });

  it('passes through remote and already-resolved sources without touching the registry', () => {
    const fromModule = jest.spyOn(Asset, 'fromModule');
    expect(resolveAssetUri('https://cdn.example/star.webp')).toBe('https://cdn.example/star.webp');
    expect(resolveAssetUri({ uri: 'https://cdn.example/wheel.png' })).toBe(
      'https://cdn.example/wheel.png',
    );
    expect(resolveAssetUri([{ uri: 'https://cdn.example/first.png' }])).toBe(
      'https://cdn.example/first.png',
    );
    expect(fromModule).not.toHaveBeenCalled();
  });

  it('returns undefined instead of throwing for empty or unregistered assets', () => {
    jest.spyOn(Asset, 'fromModule').mockImplementation(() => {
      throw new Error('Module "7" is missing from the asset registry');
    });
    expect(resolveAssetUri(7)).toBeUndefined();
    expect(resolveAssetUri(null)).toBeUndefined();
    expect(resolveAssetUri(undefined)).toBeUndefined();
    expect(resolveAssetUri({})).toBeUndefined();
  });
});
