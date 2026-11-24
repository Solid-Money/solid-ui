import { SupportMessageRenderer } from '@/components/Support/SupportMessageRenderer';

describe('SupportMessageRenderer', () => {
  const props = (node: unknown) => (node as { props: Record<string, unknown> }).props;

  it('makes a Solid AI link to our domain tappable', () => {
    const node = new SupportMessageRenderer('solid').link(
      'the article',
      'https://support.solid.xyz/articles/kyc',
    );
    expect(props(node).accessibilityRole).toBe('link');
    expect(typeof props(node).onPress).toBe('function');
  });

  it('keeps a Solid AI link anywhere else as plain words, not tappable', () => {
    const node = new SupportMessageRenderer('solid').link(
      'Verify your card',
      'https://solid-verify.example/card',
    );
    expect(props(node).onPress).toBeUndefined();
    expect(props(node).accessibilityRole).toBeUndefined();
    expect(props(node).children).toBe('Verify your card');
  });

  it('lets a teammate link to any web page, never a script', () => {
    const renderer = new SupportMessageRenderer('web');
    expect(
      typeof props(renderer.link('MoonPay help', 'https://www.moonpay.com/help')).onPress,
    ).toBe('function');
    expect(props(renderer.link('x', 'javascript:alert(1)')).onPress).toBeUndefined();
  });

  it('shows no images', () => {
    const renderer = new SupportMessageRenderer('web');
    expect(renderer.image()).toBeNull();
    expect(renderer.linkImage()).toBeNull();
  });
});
