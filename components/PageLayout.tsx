import { ReactNode, useCallback, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Edge, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurTargetView } from 'expo-blur';

import { useDimension } from '@/hooks/useDimension';

import Loading from './Loading';
import Navbar from './Navbar';
import NavbarMobile from './Navbar/NavbarMobile';

const MOBILE_NAVBAR_DIVIDER_OFFSET = 1;

interface PageLayoutProps {
  children: ReactNode;

  // Loading state
  isLoading?: boolean;

  // Navbar options
  showNavbar?: boolean;
  desktopOnly?: boolean; // Only show navbar on desktop (isScreenMedium)
  useDesktopBreakpoint?: boolean; // Use isDesktop instead of isScreenMedium

  // Custom headers
  customMobileHeader?: ReactNode; // Custom header for mobile (replaces NavbarMobile)
  customDesktopHeader?: ReactNode; // Custom header for desktop (replaces Navbar)

  // Layout options
  scrollable?: boolean;
  edges?: readonly Edge[]; // SafeAreaView edges

  // Sticky header (sticks to top when scrolling)
  stickyHeader?: ReactNode;

  // Additional content (e.g., modals that need to be outside ScrollView)
  additionalContent?: ReactNode;

  // Styling
  className?: string;
  contentClassName?: string;
}

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
  customMobileHeader,
  customDesktopHeader,
  scrollable = true,
  edges = ['right', 'left', 'bottom', 'top'],
  stickyHeader,
  additionalContent,
  className = '',
  contentClassName = '',
}: PageLayoutProps) {
  const { isScreenMedium, isDesktop } = useDimension();
  const insets = useSafeAreaInsets();
  const mobileBlurTargetRef = useRef<View>(null);
  const [mobileNavbarOffset, setMobileNavbarOffset] = useState(0);
  const [isMobileNavbarScrolled, setIsMobileNavbarScrolled] = useState(false);

  // Determine which breakpoint to use
  const isLargeScreen = useDesktopBreakpoint ? isDesktop : isScreenMedium;

  // Determine what to show for navbar
  const shouldShowDesktopNavbar = showNavbar && (!desktopOnly || isLargeScreen);
  const shouldShowMobileNavbar = showNavbar && !desktopOnly && !isLargeScreen;
  const shouldOverlayMobileNavbar = shouldShowMobileNavbar && !customMobileHeader;
  const safeAreaEdges = shouldOverlayMobileNavbar ? edges.filter(edge => edge !== 'top') : edges;
  const mobileContentOffset = shouldOverlayMobileNavbar ? mobileNavbarOffset : 0;

  const handleMobileScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const isScrolled = event.nativeEvent.contentOffset.y > MOBILE_NAVBAR_DIVIDER_OFFSET;

    setIsMobileNavbarScrolled(current => (current === isScrolled ? current : isScrolled));
  }, []);

  // Render navbar/header content
  const renderNavbar = (isOverlay = false) => {
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
          topInset={isOverlay ? insets.top : 0}
        />
      ))
    );
  };

  // Show loading state with navbar
  if (isLoading) {
    return (
      <SafeAreaView className={`flex-1 bg-background text-foreground ${className}`} edges={edges}>
        {renderNavbar()}
        <Loading />
      </SafeAreaView>
    );
  }

  // Build the main content
  if (scrollable) {
    const scrollView = (
      <ScrollView
        className={`flex-1 ${contentClassName}`}
        contentContainerStyle={
          mobileContentOffset ? { paddingTop: mobileContentOffset } : undefined
        }
        contentInsetAdjustmentBehavior="automatic"
        onScroll={shouldOverlayMobileNavbar ? handleMobileScroll : undefined}
        scrollEventThrottle={shouldOverlayMobileNavbar ? 16 : undefined}
        stickyHeaderIndices={stickyHeader && !isScreenMedium ? [0] : undefined}
      >
        {stickyHeader && <View className="z-10 bg-background">{stickyHeader}</View>}
        {children}
      </ScrollView>
    );

    return (
      <SafeAreaView
        className={`flex-1 bg-background text-foreground ${className}`}
        edges={safeAreaEdges}
      >
        {shouldOverlayMobileNavbar ? (
          <BlurTargetView ref={mobileBlurTargetRef} style={styles.mobileBlurTarget}>
            {scrollView}
          </BlurTargetView>
        ) : (
          <>
            {renderNavbar()}
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
      {shouldOverlayMobileNavbar ? (
        <>
          <BlurTargetView ref={mobileBlurTargetRef} style={styles.mobileBlurTarget}>
            <View
              className={`flex-1 ${contentClassName}`}
              style={mobileContentOffset ? { paddingTop: mobileContentOffset } : undefined}
            >
              {stickyHeader}
              {children}
            </View>
          </BlurTargetView>
          <View style={styles.mobileNavbarOverlay}>{renderNavbar(true)}</View>
        </>
      ) : (
        <>
          {renderNavbar()}
          <View className={`flex-1 ${contentClassName}`}>
            {stickyHeader}
            {children}
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
