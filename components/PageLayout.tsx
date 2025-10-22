import { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { useDimension } from '@/hooks/useDimension';
import Navbar from './Navbar';
import NavbarMobile from './Navbar/NavbarMobile';

interface PageLayoutProps {
  children: ReactNode;

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
export const PageLayout = ({
  children,
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
}: PageLayoutProps) => {
  const { isScreenMedium, isDesktop } = useDimension();

  // Determine which breakpoint to use
  const isLargeScreen = useDesktopBreakpoint ? isDesktop : isScreenMedium;

  // Determine what to show for navbar
  const shouldShowDesktopNavbar = showNavbar && (!desktopOnly || isLargeScreen);
  const shouldShowMobileNavbar = showNavbar && !desktopOnly && !isLargeScreen;

  // Render navbar/header content
  const navbarContent = (
    <>
      {/* Desktop navbar/header */}
      {isLargeScreen && (customDesktopHeader || (shouldShowDesktopNavbar && <Navbar />))}

      {/* Mobile navbar/header */}
      {!isLargeScreen && (customMobileHeader || (shouldShowMobileNavbar && <NavbarMobile />))}
    </>
  );

  // Build the main content
  const mainContent = scrollable ? (
    <ScrollView className={`flex-1 ${contentClassName}`}>
      {navbarContent}
      {children}
    </ScrollView>
  ) : (
    <View className={`flex-1 ${contentClassName}`}>
      {navbarContent}
      {children}
    </View>
  );

  return (
    <SafeAreaView className={`bg-background text-foreground flex-1 ${className}`} edges={edges}>
      {mainContent}
      {additionalContent}
    </SafeAreaView>
  );
};
