import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

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
        <meta
          name="description"
          content="Solid is the savings super-app that combines DeFi yields with traditional banking. Earn competitive yields on your savings with institutional-grade security."
        />
        <link rel="canonical" href="https://app.solid.xyz" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Solid - The Savings Super-App" />
        <meta
          property="og:description"
          content="Solid is a yield-bearing account that works in the background—earning on your money while you live your life. No stress, no spreadsheets, no jargon."
        />
        <meta
          property="og:image"
          content="https://app.solid.xyz/assets/images/solid-open-graph.png"
        />
        <meta property="og:url" content="https://app.solid.xyz" />
        <meta property="og:site_name" content="Solid" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Solid - The Savings Super-App" />
        <meta
          name="twitter:description"
          content="Solid is a yield-bearing account that works in the background—earning on your money while you live your life. No stress, no spreadsheets, no jargon."
        />
        <meta
          name="twitter:image"
          content="https://app.solid.xyz/assets/images/solid-open-graph.png"
        />

        {/* Preconnect to critical origins for faster API calls */}
        {/* These start DNS resolution, TCP, and TLS handshake in parallel with JS loading */}
        <link rel="preconnect" href="https://gateway.thegraph.com" />
        <link rel="preconnect" href="https://api.turnkey.com" />

        {/* DNS-prefetch for secondary origins (lower priority than preconnect) */}
        <link rel="dns-prefetch" href="https://li.quest" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />

        {/* Ensure dark background and prevent viewport overscroll bounce on Safari */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body { height: 100%; background-color: #000; }
              #root { height: 100%; }
              body { overscroll-behavior-y: none; overscroll-behavior-x: none; }

              /* Loading spinner - shows instantly while JS loads */
              #initial-loader {
                position: fixed;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #000;
                z-index: 9999;
              }
              #initial-loader.hidden { display: none; }
              .spinner {
                width: 40px;
                height: 40px;
                border: 3px solid #333;
                border-top-color: #fff;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
              }
              @keyframes spin { to { transform: rotate(360deg); } }
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
        {/* Loading spinner - immediately visible, hidden when React mounts */}
        <div id="initial-loader">
          <div className="spinner" />
        </div>
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
