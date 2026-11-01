import React from 'react';

import HomeIncidentNotice, {
  IncidentNoticeSheet,
} from '@/components/Home/NewHome/HomeIncidentNotice';
import { useIncidentNoticeStore } from '@/store/useIncidentNoticeStore';

import type { KnownIncident } from '@/lib/api/incidents';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

let mockIncidents: KnownIncident[] = [];
const mockOpenSupport = jest.fn();
const mockTrack = jest.fn();

jest.mock('@/hooks/useKnownIncidents', () => ({
  useKnownIncidents: () => ({ data: mockIncidents }),
}));
jest.mock('lucide-react-native', () => ({
  CircleCheck: 'CircleCheck',
  Layers: 'Layers',
  TriangleAlert: 'TriangleAlert',
  X: 'X',
}));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/button', () => {
  const React = jest.requireActual('react');
  return {
    Button: ({ children, ...props }: any) => React.createElement('Button', props, children),
  };
});
jest.mock('@/components/Card/NewCardDetails/SpendMode/CardBottomSheet', () => ({
  __esModule: true,
  default: ({ isOpen, children }: any) => (isOpen ? children({ session: 1, topPadding: 0 }) : null),
}));
jest.mock('@/components/Card/NewCardDetails/SpendMode/SheetIconButton', () => 'SheetIconButton');
jest.mock('@/components/Card/NewCardDetails/heroMotion', () => ({
  HERO_EXIT: { balance: {} },
  HeroExit: ({ children }: any) => children,
}));
jest.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));
jest.mock('@/store/useSupportDrawerStore', () => ({
  openSupportDrawer: () => mockOpenSupport(),
}));
jest.mock('@/lib/mmvkStorage', () => () => {
  const memory = new Map<string, string>();
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  };
});

const POSTED = new Date(Date.now() - 30 * 60 * 1000).toISOString();

const incident = (changes: Partial<KnownIncident> = {}): KnownIncident => ({
  id: 'inc_0123456789ab',
  title: 'Card payments are delayed',
  message: 'Some card payments are slower. Your money is safe.',
  active: true,
  startedAt: POSTED,
  updatedAt: POSTED,
  resolvedAt: null,
  ...changes,
});

const mounted: any[] = [];

const render = () => {
  let tree: any;
  act(() => {
    tree = create(
      <>
        <HomeIncidentNotice />
        <IncidentNoticeSheet />
      </>,
    );
  });
  mounted.push(tree);
  return tree;
};

const texts = (tree: any): string[] =>
  tree.root
    .findAll((node: any) => node.type === 'Text')
    .map((node: any) => [node.props.children].flat().join(''));

const pressable = (tree: any, label: string) =>
  tree.root.find(
    (node: any) =>
      node.props?.accessibilityLabel === label && typeof node.props?.onPress === 'function',
  );

describe('HomeIncidentNotice', () => {
  afterEach(() => {
    act(() => mounted.splice(0).forEach(tree => tree.unmount()));
  });

  beforeEach(() => {
    mockIncidents = [];
    mockOpenSupport.mockReset();
    mockTrack.mockReset();
    useIncidentNoticeStore.setState({
      dismissed: [],
      seen: [],
      sheetNotice: null,
      isSheetOpen: false,
    });
  });

  it('renders nothing when there is no incident', () => {
    expect(render().toJSON()).toBeNull();
  });

  it('shows the incident, remembers it was seen, and × hides it until the next update', () => {
    mockIncidents = [incident()];
    const tree = render();
    expect(texts(tree)).toEqual(
      expect.arrayContaining([
        'Card payments are delayed',
        'Some card payments are slower. Your money is safe.',
      ]),
    );
    expect(texts(tree)).not.toContain('Update');
    expect(useIncidentNoticeStore.getState().seen).toEqual(['inc_0123456789ab']);

    act(() => pressable(tree, 'Close notice').props.onPress());
    expect(tree.toJSON()).toBeNull();
    expect(mockTrack).toHaveBeenCalledWith('incident_notice_dismissed', {
      keys: [`inc_0123456789ab@${POSTED}`],
    });

    mockIncidents = [incident({ updatedAt: new Date().toISOString() })];
    act(() =>
      tree.update(
        <>
          <HomeIncidentNotice />
          <IncidentNoticeSheet />
        </>,
      ),
    );
    expect(texts(tree)).toContain('Update');
  });

  it('opens the full notice, where Chat with us hands over to support', () => {
    jest.useFakeTimers();
    mockIncidents = [incident()];
    const tree = render();
    act(() =>
      tree.root
        .find((node: any) => node.props?.accessibilityHint === 'Opens the full notice')
        .props.onPress(),
    );
    expect(texts(tree)).toEqual(expect.arrayContaining(['Chat with us', 'Got it']));

    act(() => pressable(tree, 'Chat with us').props.onPress());
    expect(useIncidentNoticeStore.getState().isSheetOpen).toBe(false);
    act(() => jest.runAllTimers());
    expect(mockOpenSupport).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('“Got it” closes the sheet and the card', () => {
    mockIncidents = [incident()];
    const tree = render();
    act(() =>
      tree.root
        .find((node: any) => node.props?.accessibilityHint === 'Opens the full notice')
        .props.onPress(),
    );
    act(() => pressable(tree, 'Got it').props.onPress());
    expect(useIncidentNoticeStore.getState().isSheetOpen).toBe(false);
    expect(useIncidentNoticeStore.getState().dismissed).toEqual([`inc_0123456789ab@${POSTED}`]);
  });

  it('says a fixed incident is back to normal to someone who saw it', () => {
    const resolvedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    mockIncidents = [incident({ active: false, resolvedAt, updatedAt: resolvedAt })];
    expect(render().toJSON()).toBeNull();

    act(() => useIncidentNoticeStore.setState({ seen: ['inc_0123456789ab'] }));
    const tree = render();
    expect(texts(tree)).toContain('Fixed');
    expect(texts(tree).some(text => text.startsWith('Fixed at '))).toBe(true);
  });
});
