import { type PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

/**
 * SEO Constants for meta tags.
 * Defined here because +html.tsx runs in Node.js during static rendering
 * and cannot import from files with React Native dependencies.
 */
const SEO = {
  OG_IMAGE_URL: 'https://app.solid.xyz/assets/images/solid-open-graph.png',
  SITE_URL: 'https://app.solid.xyz',
  SITE_NAME: 'Solid',
  TITLE: 'Solid - The Savings Super-App',
  DESCRIPTION:
    'Solid is a yield-bearing account that works in the background—earning on your money while you live your life. No stress, no spreadsheets, no jargon.',
  SHORT_DESCRIPTION:
    'Solid is the savings super-app that combines DeFi yields with traditional banking. Earn competitive yields on your savings with institutional-grade security.',
} as const;

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="viewport-fit=cover, width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* SEO Meta Tags */}
        <meta name="description" content={SEO.SHORT_DESCRIPTION} />
        <link rel="canonical" href={SEO.SITE_URL} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={SEO.TITLE} />
        <meta property="og:description" content={SEO.DESCRIPTION} />
        <meta property="og:image" content={SEO.OG_IMAGE_URL} />
        <meta property="og:url" content={SEO.SITE_URL} />
        <meta property="og:site_name" content={SEO.SITE_NAME} />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={SEO.TITLE} />
        <meta name="twitter:description" content={SEO.DESCRIPTION} />
        <meta name="twitter:image" content={SEO.OG_IMAGE_URL} />

        {/* Preconnect to critical origins for faster API calls */}
        {/* These start DNS resolution, TCP, and TLS handshake in parallel with JS loading */}
        <link rel="preconnect" href="https://gateway.thegraph.com" />
        <link rel="preconnect" href="https://api.turnkey.com" />

        {/* DNS-prefetch for secondary origins (lower priority than preconnect) */}
        <link rel="dns-prefetch" href="https://li.quest" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />

        {/* Preload critical onboarding images - starts loading immediately, parallel to JS */}
        <link
          rel="preload"
          href="/assets/images/purple_onboarding_bg.png"
          as="image"
          type="image/png"
        />
        <link
          rel="preload"
          href="/assets/images/green_onboarding_bg.png"
          as="image"
          type="image/png"
        />
        <link
          rel="preload"
          href="/assets/images/yellow_onboarding_bg.png"
          as="image"
          type="image/png"
        />

        {/* Preload Lottie animations used in onboarding */}
        <link
          rel="preload"
          href="/assets/animations/rocket.json"
          as="fetch"
          type="application/json"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/assets/animations/card.json"
          as="fetch"
          type="application/json"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/assets/animations/vault.json"
          as="fetch"
          type="application/json"
          crossOrigin="anonymous"
        />

        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body { height: 100%; background-color: #000; }
              #root { height: 100%; }
              body { overscroll-behavior-y: none; overscroll-behavior-x: none; }
            `,
          }}
        />

        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Add any additional <head> elements that you want globally available on web... */}

        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','GTM-M9T6M4T6');
            `,
          }}
        />
      </head>
      <body>
        {children}

        {/* Google Tag Manager */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-M9T6M4T6"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
      </body>
    </html>
  );
}
