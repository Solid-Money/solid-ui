import { configureObserve, markAppInteractive, withObserve } from '@/lib/observe';

// lib/observe must never throw, even when the expo-observe native module is
// missing from the binary (e.g. an OTA update reaching an older build).
describe('lib/observe', () => {
  it('configureObserve does not throw without the native module', () => {
    expect(() => configureObserve()).not.toThrow();
  });

  it('markAppInteractive does not throw without the native module', () => {
    expect(() => markAppInteractive()).not.toThrow();
  });

  it('withObserve returns a renderable component', () => {
    const Component = () => null;
    const Wrapped = withObserve(Component);
    expect(typeof Wrapped).toBe('function');
  });
});
