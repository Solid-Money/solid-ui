import { getRealtimeEndpoint } from '@/lib/realtime/endpoint';

jest.mock('@/lib/config', () => ({ EXPO_PUBLIC_FLASH_API_BASE_URL: 'https://accounts.solid.xyz' }));

describe('getRealtimeEndpoint', () => {
  it('connects to the API host, on the path the gateway serves', () => {
    expect(getRealtimeEndpoint('https://accounts.solid.xyz')).toEqual({
      url: 'https://accounts.solid.xyz',
      path: '/accounts/v1/socket.io',
    });
  });

  it('defaults to the base URL the rest of the app uses', () => {
    expect(getRealtimeEndpoint()?.url).toBe('https://accounts.solid.xyz');
  });

  it('keeps a path the API is mounted under out of the namespace', () => {
    // Socket.IO would read a path in the URL as a namespace.
    expect(getRealtimeEndpoint('https://api.example.com/backend/')).toEqual({
      url: 'https://api.example.com',
      path: '/backend/accounts/v1/socket.io',
    });
  });

  it('works against a local backend', () => {
    expect(getRealtimeEndpoint('http://localhost:5001')).toEqual({
      url: 'http://localhost:5001',
      path: '/accounts/v1/socket.io',
    });
  });

  it.each(['', 'not a url', 'ftp://files.example.com'])(
    'has no endpoint for %j, so the app runs without live updates',
    baseUrl => {
      expect(getRealtimeEndpoint(baseUrl)).toBeNull();
    },
  );
});
