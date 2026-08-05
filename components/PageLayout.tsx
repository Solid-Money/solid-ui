import { type ReactNode, type RefObject, useCallback, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Edge, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurTargetView } from 'expo-blur';
import { usePathname } from 'expo-router';

import { useDimension } from '@/hooks/useDimension';

import Loading from './Loading';
import Navbar from './Navbar';
import NavbarMobile from './Navbar/NavbarMobile';
import { SIDEBAR_BODY_TOP_GUTTER, SIDEBAR_BODY_WIDTH, useIsSidebarShell } from './Navbar/Sidebar';
import { useRegisterTabBarBlurTarget } from './tabBar/TabBarBlurContext';

const MOBILE_NAVBAR_DIVIDER_OFFSET = 1;
const MOBILE_NAVBAR_TITLE_REVEAL_OFFSET = 28;

const MOBILE_NAVBAR_TITLES: Record<string, string> = {
  '/': 'Home',
  '/activity': 'Activity',
  '/agent': 'Agent',
  '/bank-transfer': 'Bank Transfer',
  '/gooddollar': 'GoodDollar',
  '/card': 'Card',
  '/card-onboard': 'Card',
  '/card/details': 'Card',
  '/card/details/transactions': 'Transactions',
  '/overview': 'Overview',
  '/points': 'Points',
  '/points/leaderboard': 'Leaderboard',
  '/rewards': 'Rewards',
  '/rewards/benefits': 'Rewards benefits',
  '/savings': 'Savings',
  '/savings-old': 'Savings',
};

const MOBILE_NAVBAR_TITLE_PREFIXES: [string, string][] = [
  ['/activity/', 'Activity'],
  ['/card-onboard/', 'Card'],
  ['/card/', 'Card'],
  ['/points/', 'Points'],
  ['/rewards/', 'Rewards'],
];

interface PageLayoutProps {
  children: ReactNode;

  // Loading state
  isLoading?: boolean;

  // Navbar options
  showNavbar?: boolean;
  desktopOnly?: boolean; // Only show navbar on desktop (isScreenMedium)
  useDesktopBreakpoint?: boolean; // Use isDesktop instead of isScreenMedium
  mobileTitle?: string | null; // Overrides the route-derived mobile navbar title. Use null to hide it.

  // Custom headers
  customMobileHeader?: ReactNode; // Custom header for mobile (replaces NavbarMobile)
  customDesktopHeader?: ReactNode; // Custom header for desktop (replaces Navbar)

  // Mobile navbar right-side action override (e.g. Savings screen's "?" help button)
  mobileHeaderLeftAction?: 'profile' | 'back';
  onMobileHeaderBackPress?: () => void;
  mobileHeaderRightAction?: 'default' | 'help' | 'none';
  onMobileHeaderHelpPress?: () => void;

  // Animate the mobile navbar buttons out while a card hero transition runs
  // (home screen only — it's the screen the card flies away from).
  animateCardHeroExit?: boolean;

  // Layout options
  scrollable?: boolean;
  // Lets a child temporarily suspend scrolling (e.g. while it's running its own
  // horizontal swipe gesture, so the two don't fight over the same touch).
  scrollEnabled?: boolean;
  edges?: readonly Edge[]; // SafeAreaView edges

  // Sticky header (sticks to top when scrolling)
  stickyHeader?: ReactNode;

  // Additional content (e.g., modals that need to be outside ScrollView)
  additionalContent?: ReactNode;
  // Lets an overlay outside this layout blur the scrolling content on Android.
  blurTargetRef?: RefObject<View | null>;

  // Styling
  className?: string;
  contentClassName?: string;
}

const toTitleCase = (value: string) =>
  value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
    .trim();

const getDefaultMobileNavbarTitle = (pathname: string) => {
  const normalizedPathname = pathname.replace(/\/+$/, '') || '/';
  const configuredTitle = MOBILE_NAVBAR_TITLES[normalizedPathname];

  if (configuredTitle) return configuredTitle;

  const prefixTitle = MOBILE_NAVBAR_TITLE_PREFIXES.find(([prefix]) =>
    normalizedPathname.startsWith(prefix),
  )?.[1];

  if (prefixTitle) return prefixTitle;

  const lastSegment = normalizedPathname.split('/').filter(Boolean).at(-1);

  return lastSegment ? toTitleCase(lastSegment) : undefined;
};

/**
 * PageLayout - Flexible wrapper component for all pages
 *
 * Benefits:
 * - Navbar renders immediately, even during page loading
 * - Consistent layout across all pages
 * - Single place to modify navbar behavior
 * - Supports all edge cases (custom headers, modals, different breakpoints)
 *
 * Examples:
 *
 * Simple page with responsive navbar:
 * <PageLayout>
 *   <View>Content</View>
 * </PageLayout>
 *
 * Desktop-only navbar:
 * <PageLayout desktopOnly>
 *   <View>Content</View>
 * </PageLayout>
 *
 * Custom mobile header (like Settings):
 * <PageLayout
 *   customMobileHeader={<CustomHeader />}
 *   useDesktopBreakpoint
 * >
 *   <View>Content</View>
 * </PageLayout>
 *
 * Modal outside ScrollView (like Swap):
 * <PageLayout
 *   scrollable={false}
 *   additionalContent={<SwapModal />}
 * >
 *   <ScrollView>Content</ScrollView>
 * </PageLayout>
 */
export default function PageLayout({
  children,
  isLoading = false,
  showNavbar = true,
  desktopOnly = false,
  useDesktopBreakpoint = false,
  mobileTitle,
  customMobileHeader,
  customDesktopHeader,
  mobileHeaderLeftAction = 'profile',
  onMobileHeaderBackPress,
  mobileHeaderRightAction = 'default',
  onMobileHeaderHelpPress,
  animateCardHeroExit = false,
  scrollable = true,
  scrollEnabled = true,
  edges = ['right', 'left', 'bottom', 'top'],
  stickyHeader,
  additionalContent,
  blurTargetRef,
  className = '',
  contentClassName = '',
}: PageLayoutProps) {
  const { isScreenMedium, isDesktop } = useDimension();
  const isSidebarShell = useIsSidebarShell();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const mobileBlurTargetRef = useRef<View>(null);
  const [mobileNavbarOffset, setMobileNavbarOffset] = useState(0);
  const [isMobileNavbarScrolled, setIsMobileNavbarScrolled] = useState(false);
  const [isMobileTitleVisible, setIsMobileTitleVisible] = useState(false);
  const defaultMobileTitle = useMemo(() => getDefaultMobileNavbarTitle(pathname), [pathname]);
  const resolvedMobileTitle =
    mobileTitle === undefined ? defaultMobileTitle : mobileTitle || undefined;

  // Determine which breakpoint to use
  const isLargeScreen = useDesktopBreakpoint ? isDesktop : isScreenMedium;

  // Determine what to show for navbar
  const shouldShowDesktopNavbar = showNavbar && (!desktopOnly || isLargeScreen);
  // Inside the desktop sidebar shell the sidebar carries navigation — including the
  // profile and activity buttons that sit in the mobile header — so no page renders
  // a navbar of its own there.
  const shouldShowMobileNavbar = showNavbar && !desktopOnly && !isLargeScreen && !isSidebarShell;
  const shouldOverlayMobileNavbar = shouldShowMobileNavbar && !customMobileHeader;
  const shouldWrapBlurTarget = shouldOverlayMobileNavbar || !!blurTargetRef;
  const resolvedBlurTargetRef = blurTargetRef ?? mobileBlurTargetRef;
  const safeAreaEdges = shouldOverlayMobileNavbar ? edges.filter(edge => edge !== 'top') : edges;
  const mobileContentOffset = shouldOverlayMobileNavbar ? mobileNavbarOffset : 0;
  // Headerless pages in the sidebar shell get the design's top gutter here, so the
  // content clears the top of the window the way the mobile navbar's offset does.
  const contentTopOffset =
    mobileContentOffset || (isSidebarShell && !customMobileHeader ? SIDEBAR_BODY_TOP_GUTTER : 0);

  useRegisterTabBarBlurTarget(mobileBlurTargetRef, shouldOverlayMobileNavbar && !isLoading);

  const handleMobileScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const scrollOffsetY = event.nativeEvent.contentOffset.y;
      const isScrolled = scrollOffsetY > MOBILE_NAVBAR_DIVIDER_OFFSET;
      const isTitleVisible =
        !!resolvedMobileTitle && scrollOffsetY > MOBILE_NAVBAR_TITLE_REVEAL_OFFSET;

      setIsMobileNavbarScrolled(current => (current === isScrolled ? current : isScrolled));
      setIsMobileTitleVisible(current => (current === isTitleVisible ? current : isTitleVisible));
    },
    [resolvedMobileTitle],
  );

  // Render navbar/header content
  const renderNavbar = (isOverlay = false) => {
    // Desktop sidebar shell: the sidebar stands in for the navbar. Screens that
    // bring their own header (settings and friends) keep it.
    if (isSidebarShell) return customMobileHeader ?? null;

    if (isLargeScreen) {
      // Desktop navbar/header
      return customDesktopHeader || (shouldShowDesktopNavbar && <Navbar />);
    }
    // Mobile navbar/header
    return (
      customMobileHeader ||
      (shouldShowMobileNavbar && (
        <NavbarMobile
          blurTarget={isOverlay ? mobileBlurTargetRef : undefined}
          onContentOffsetChange={isOverlay ? setMobileNavbarOffset : undefined}
          showDivider={isOverlay && isMobileNavbarScrolled}
          showTitle={isOverlay && isMobileTitleVisible}
          title={resolvedMobileTitle}
          topInset={isOverlay ? insets.top : 0}
          leftAction={mobileHeaderLeftAction}
          onBackPress={onMobileHeaderBackPress}
          rightAction={mobileHeaderRightAction}
          onHelpPress={onMobileHeaderHelpPress}
          animateCardHeroExit={animateCardHeroExit}
        />
      ))
    );
  };

  // In the sidebar shell the page is a centred 40rem column beside the sidebar. The
  // top gutter goes on the header when there is one, and on the content otherwise
  // (see contentTopOffset above).
  const renderHeader = () => {
    const header = renderNavbar();
    if (!isSidebarShell || !header) return header;

    return (
      <View className={SIDEBAR_BODY_WIDTH} style={{ paddingTop: SIDEBAR_BODY_TOP_GUTTER }}>
        {header}
      </View>
    );
  };

  const renderBody = (content: ReactNode, fill = false) =>
    isSidebarShell ? (
      <View className={`${SIDEBAR_BODY_WIDTH} ${fill ? 'flex-1' : ''}`}>{content}</View>
    ) : (
      content
    );

  // Show loading state with navbar
  if (isLoading) {
    return (
      <SafeAreaView className={`flex-1 bg-background text-foreground ${className}`} edges={edges}>
        {renderHeader()}
        <Loading />
      </SafeAreaView>
    );
  }

  // Build the main content
  if (scrollable) {
    const scrollView = (
      <ScrollView
        className={`flex-1 ${contentClassName}`}
        contentContainerStyle={contentTopOffset ? { paddingTop: contentTopOffset } : undefined}
        scrollEnabled={scrollEnabled}
        contentInsetAdjustmentBehavior={shouldOverlayMobileNavbar ? 'never' : 'automatic'}
        onScroll={shouldOverlayMobileNavbar ? handleMobileScroll : undefined}
        scrollEventThrottle={shouldOverlayMobileNavbar ? 16 : undefined}
        stickyHeaderIndices={stickyHeader && !isScreenMedium ? [0] : undefined}
      >
        {stickyHeader && (
          <View className={`z-10 bg-background ${isSidebarShell ? SIDEBAR_BODY_WIDTH : ''}`}>
            {stickyHeader}
          </View>
        )}
        {renderBody(children)}
      </ScrollView>
    );

    return (
      <SafeAreaView
        className={`flex-1 bg-background text-foreground ${className}`}
        edges={safeAreaEdges}
      >
        {shouldWrapBlurTarget ? (
          <BlurTargetView ref={resolvedBlurTargetRef} style={styles.mobileBlurTarget}>
            {scrollView}
          </BlurTargetView>
        ) : (
          <>
            {renderHeader()}
            {scrollView}
          </>
        )}
        {shouldOverlayMobileNavbar && (
          <View style={styles.mobileNavbarOverlay}>{renderNavbar(true)}</View>
        )}
        {additionalContent}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className={`flex-1 bg-background text-foreground ${className}`}
      edges={safeAreaEdges}
    >
      {shouldWrapBlurTarget ? (
        <>
          <BlurTargetView ref={resolvedBlurTargetRef} style={styles.mobileBlurTarget}>
            <View
              className={`flex-1 ${contentClassName}`}
              style={contentTopOffset ? { paddingTop: contentTopOffset } : undefined}
            >
              {renderBody(
                <>
                  {stickyHeader}
                  {children}
                </>,
                true,
              )}
            </View>
          </BlurTargetView>
          {shouldOverlayMobileNavbar && (
            <View style={styles.mobileNavbarOverlay}>{renderNavbar(true)}</View>
          )}
        </>
      ) : (
        <>
          {renderHeader()}
          <View
            className={`flex-1 ${contentClassName}`}
            style={contentTopOffset ? { paddingTop: contentTopOffset } : undefined}
          >
            {renderBody(
              <>
                {stickyHeader}
                {children}
              </>,
              true,
            )}
          </View>
        </>
      )}
      {additionalContent}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mobileBlurTarget: {
    flex: 1,
  },
  mobileNavbarOverlay: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 50,
  },
});
