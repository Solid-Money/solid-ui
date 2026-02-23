import { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useDimension } from '@/hooks/useDimension';

import Loading from './Loading';
import Navbar from './Navbar';
import NavbarMobile from './Navbar/NavbarMobile';

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
  additionalContent,
  className = '',
  contentClassName = '',
}: PageLayoutProps) {
  const { isScreenMedium, isDesktop } = useDimension();

  // Determine which breakpoint to use
  const isLargeScreen = useDesktopBreakpoint ? isDesktop : isScreenMedium;

  // Determine what to show for navbar
  const shouldShowDesktopNavbar = showNavbar && (!desktopOnly || isLargeScreen);
  const shouldShowMobileNavbar = showNavbar && !desktopOnly && !isLargeScreen;

  // Render navbar/header content
  const renderNavbar = () => {
    if (isLargeScreen) {
      // Desktop navbar/header
      return customDesktopHeader || (shouldShowDesktopNavbar && <Navbar />);
    }
    // Mobile navbar/header
    return customMobileHeader || (shouldShowMobileNavbar && <NavbarMobile />);
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
    return (
      <SafeAreaView className={`flex-1 bg-background text-foreground ${className}`} edges={edges}>
        <ScrollView
          className={`flex-1 ${contentClassName}`}
          contentInsetAdjustmentBehavior="automatic"
        >
          {renderNavbar()}
          {children}
        </ScrollView>
        {additionalContent}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 bg-background text-foreground ${className}`} edges={edges}>
      <View className={`flex-1 ${contentClassName}`}>
        {renderNavbar()}
        {children}
      </View>
      {additionalContent}
    </SafeAreaView>
  );
}
