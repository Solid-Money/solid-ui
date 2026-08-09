import { createContext, type ReactNode, useContext } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { Href, router, usePathname } from 'expo-router';

import { AnimatedTabIcon, type AnimatedTabIconName } from '@/components/tabBar/AnimatedTabIcon';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useDimension } from '@/hooks/useDimension';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';
import { cn } from '@/lib/utils';

/** Figma 901:1180 — the sidebar is 18rem wide, inset 15px from the page edges. */
const SIDEBAR_WIDTH = 288;
const SIDEBAR_GUTTER = 15;
/** How much of the window the sidebar takes: itself plus its gutters. */
export const SIDEBAR_COLUMN_WIDTH = SIDEBAR_WIDTH + SIDEBAR_GUTTER * 2;

/** Figma 901:1180 — the body column beside the sidebar. */
export const SIDEBAR_BODY_MAX_WIDTH = 640;
export const SIDEBAR_BODY_WIDTH = 'mx-auto w-full max-w-[40rem]';
/** The body starts level with the design's "Wallet Balance" label, 65px down. */
export const SIDEBAR_BODY_TOP_GUTTER = 64;

type SidebarItem = {
  label: string;
  href: Href;
  animatedIcon: AnimatedTabIconName;
  /**
   * Route prefixes that keep this item highlighted. `/` only ever matches itself;
   * everything else also matches its nested routes.
   */
  match: string[];
};

/**
 * Wallet, Savings, Rewards and Activity — the mobile tab bar's three tabs plus the
 * mobile header's bell, which has nowhere else to live on desktop.
 */
const NAV_ITEMS: SidebarItem[] = [
  {
    label: 'Wallet',
    href: path.HOME,
    animatedIcon: 'wallet',
    // The card lives on the wallet screen now (it opens as a pane), so its routes
    // keep Wallet selected.
    match: ['/', '/card', '/card-onboard'],
  },
  {
    label: 'Savings',
    href: path.SAVINGS,
    animatedIcon: 'savings',
    match: ['/savings'],
  },
  {
    label: 'Rewards',
    href: path.REWARDS,
    animatedIcon: 'rewards',
    match: ['/rewards'],
  },
  {
    label: 'Activity',
    href: path.ACTIVITY,
    animatedIcon: 'activity',
    match: ['/activity'],
  },
];

/** The mobile header's profile button, moved to the foot of the sidebar. */
const PROFILE_ITEM: SidebarItem = {
  label: 'Profile',
  href: path.SETTINGS,
  animatedIcon: 'profile',
  match: ['/settings'],
};

const isItemActive = (pathname: string, match: string[]) =>
  match.some(prefix =>
    prefix === '/' ? pathname === '/' : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

type SidebarLinkProps = {
  item: SidebarItem;
  isActive: boolean;
};

const SidebarLink = ({ item, isActive }: SidebarLinkProps) => (
  <Pressable
    accessibilityLabel={item.label}
    accessibilityRole="link"
    accessibilityState={{ selected: isActive }}
    onPress={() => router.navigate(item.href)}
    className={cn(
      'h-[60px] flex-row items-center gap-[10px] rounded-full pl-[21px] transition-all',
      isActive ? 'bg-[#2B2B2B]' : 'web:hover:bg-white/5',
    )}
  >
    <View className="w-6 items-center">
      <AnimatedTabIcon name={item.animatedIcon} focused={isActive} />
    </View>
    <Text className="text-[20px] font-medium leading-[22px] text-white">{item.label}</Text>
  </Pressable>
);

/**
 * Desktop sidebar (Figma 901:1180) — the `isScreenMedium` replacement for
 * `<Navbar />` and for the mobile header's profile/activity buttons.
 *
 * `SidebarShell` mounts it once, above the navigator, so it lays out a single time
 * and stays put while the body beside it navigates or reloads. It reads nothing
 * asynchronous, so it has no loading state of its own.
 */
const Sidebar = () => {
  const pathname = usePathname();

  return (
    <View style={{ width: SIDEBAR_COLUMN_WIDTH, padding: SIDEBAR_GUTTER }}>
      <View className="flex-1 overflow-hidden rounded-[20px] bg-[#161616]">
        <Pressable
          accessibilityLabel="Solid"
          accessibilityRole="link"
          className="flex-row items-start gap-[7px] pl-[41px] pt-[50px]"
          onPress={() => {
            track(TRACKING_EVENTS.NAVBAR_LOGO_CLICKED, { source: 'sidebar' });
            router.navigate(path.HOME);
          }}
        >
          <Image
            source={getAsset('images/solid-logo.png')}
            alt="Solid logo"
            contentFit="contain"
            style={{ width: 22, height: 24, marginTop: 3 }}
          />
          <Image
            source={getAsset('images/solid-4x.png')}
            alt="Solid"
            contentFit="contain"
            style={{ width: 64, height: 25 }}
          />
        </Pressable>

        <View className="mt-[54px] gap-[7px] px-[14px]">
          {NAV_ITEMS.map(item => (
            <SidebarLink
              key={item.label}
              item={item}
              isActive={isItemActive(pathname, item.match)}
            />
          ))}
        </View>

        <View className="mt-auto px-[14px] pb-[32px]">
          <SidebarLink item={PROFILE_ITEM} isActive={isItemActive(pathname, PROFILE_ITEM.match)} />
        </View>
      </View>
    </View>
  );
};

const SidebarShellContext = createContext(false);

/**
 * True while rendering inside the desktop sidebar shell. `PageLayout` uses it to
 * drop the page's own navbar (the sidebar carries navigation) and to lay the body
 * out as a centred 40rem column.
 */
export const useIsSidebarShell = () => useContext(SidebarShellContext);

/**
 * Left edge of the page column in window coordinates — 0 on mobile, past the
 * sidebar on desktop. For geometry that has to be in window coordinates, such as
 * the card hero flight.
 */
export const usePageLeft = () => {
  const isSidebarShell = useIsSidebarShell();

  return isSidebarShell ? SIDEBAR_COLUMN_WIDTH : 0;
};

/**
 * Width of the column a page actually gets: the window on mobile, the 40rem body
 * column on desktop. Full-bleed layouts that size themselves off the window
 * (pagers, carousels) need this rather than `useWindowDimensions`.
 */
export const usePageWidth = () => {
  const { width } = useWindowDimensions();
  const pageLeft = usePageLeft();

  return pageLeft ? Math.min(width - pageLeft, SIDEBAR_BODY_MAX_WIDTH) : width;
};

type SidebarShellProps = {
  children: ReactNode;
};

/**
 * Wraps the protected navigator so the sidebar sits beside it rather than inside
 * it. `children` keeps its position in the tree at every width, so crossing the
 * breakpoint never remounts the navigator.
 */
export const SidebarShell = ({ children }: SidebarShellProps) => {
  const { isScreenMedium } = useDimension();

  return (
    <SidebarShellContext.Provider value={isScreenMedium}>
      <View className="flex-1 flex-row bg-background">
        {isScreenMedium && <Sidebar />}
        <View className="flex-1">{children}</View>
      </View>
    </SidebarShellContext.Provider>
  );
};

export default Sidebar;
