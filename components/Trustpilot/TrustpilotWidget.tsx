import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import {
  isTrustpilotConfigured,
  TRUSTPILOT_BOOTSTRAP_SRC,
  TRUSTPILOT_BUSINESS_UNIT_ID,
  TRUSTPILOT_DOMAIN,
  TRUSTPILOT_LOCALE,
  TRUSTPILOT_REVIEW_URL,
  TRUSTPILOT_TEMPLATE_ID,
} from '@/constants/trustpilot';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    Trustpilot?: {
      /** Mounts a widget into one already-rendered `.trustpilot-widget` node. */
      loadFromElement?: (element: HTMLElement | null, forceReload?: boolean) => void;
    };
  }
}

/** How long the bootstrap script gets before we fall back to a plain link. */
const SCRIPT_TIMEOUT_MS = 8000;

/** Rendered height of the Review Collector template, per Trustpilot's embed code. */
const DEFAULT_HEIGHT = 52;

type ScriptState = 'loading' | 'ready' | 'failed';

interface TrustpilotWidgetProps {
  /** Context string for analytics, e.g. where in the app this instance sits. */
  analyticsContext?: string;
  /** Widget height in px; the Review Collector template wants 52. */
  height?: number;
  className?: string;
}

/**
 * Loads Trustpilot's widget bootstrap exactly once per page.
 *
 * The script registers `window.Trustpilot` globally and is shared by every widget on
 * the page, so a second `<script>` tag would re-run the same registration for nothing.
 * Mounting is per-element (`loadFromElement`), which is what lets one script serve
 * however many widgets end up on screen.
 */
const loadBootstrapScript = (): Promise<void> => {
  if (typeof document === 'undefined') return Promise.reject(new Error('No document'));
  if (window.Trustpilot?.loadFromElement) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${TRUSTPILOT_BOOTSTRAP_SRC}"]`,
  );

  const script = existing ?? document.createElement('script');
  const promise = new Promise<void>((resolve, reject) => {
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Trustpilot script failed')), {
      once: true,
    });
  });

  if (!existing) {
    script.src = TRUSTPILOT_BOOTSTRAP_SRC;
    script.async = true;
    document.head.appendChild(script);
  }

  return promise;
};

/**
 * Trustpilot's free **Review Collector** widget: stars plus a button that opens Solid's
 * review form on trustpilot.com.
 *
 * Web only. The widget is a DOM script with no React Native build, and the native apps
 * have the OS review sheet instead — which is also the only in-app rating prompt the
 * App Store guidelines permit. On native this renders nothing at all.
 *
 * Renders nothing, too, when {@link isTrustpilotConfigured} is false, so a build without
 * `EXPO_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID` shows no empty frame where a widget should
 * be. When the id *is* set but the script cannot load — an ad blocker, a corporate
 * proxy, an offline first paint — the fallback below keeps the call to action working,
 * because a blocked script should cost us the branding, not the review.
 */
export default function TrustpilotWidget({
  analyticsContext,
  height = DEFAULT_HEIGHT,
  className,
}: TrustpilotWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scriptState, setScriptState] = useState<ScriptState>('loading');

  const configured = isTrustpilotConfigured();
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    if (!isWeb || !configured) return;

    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setScriptState('failed');
    }, SCRIPT_TIMEOUT_MS);

    loadBootstrapScript()
      .then(() => {
        if (cancelled) return;
        // The node has to exist before `loadFromElement` is called — the script
        // reads its `data-*` attributes to know which widget to render.
        window.Trustpilot?.loadFromElement?.(containerRef.current, true);
        setScriptState('ready');
        track(TRACKING_EVENTS.TRUSTPILOT_WIDGET_SHOWN, { context: analyticsContext });
      })
      .catch(() => {
        if (cancelled) return;
        setScriptState('failed');
        track(TRACKING_EVENTS.TRUSTPILOT_WIDGET_UNAVAILABLE, { context: analyticsContext });
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [isWeb, configured, analyticsContext]);

  // Only reachable on web — everything below the `isWeb` guard is.
  const openReviewForm = useCallback(() => {
    track(TRACKING_EVENTS.TRUSTPILOT_REVIEW_LINK_OPENED, { context: analyticsContext });
    window.open(TRUSTPILOT_REVIEW_URL, '_blank', 'noopener,noreferrer');
  }, [analyticsContext]);

  if (!isWeb || !configured) return null;

  if (scriptState === 'failed') {
    return (
      <Pressable
        onPress={openReviewForm}
        className={cn('items-center justify-center py-2 active:opacity-70', className)}
        accessibilityRole="link"
        accessibilityLabel="Review Solid on Trustpilot"
      >
        <Text className="text-base font-medium text-white">Review us on Trustpilot</Text>
      </Pressable>
    );
  }

  return (
    <View className={className}>
      {/*
        Trustpilot's own embed markup, verbatim: the script finds this node by class
        and reads every `data-*` attribute off it, so the shape is theirs rather than
        ours. The inner anchor is the no-JS fallback Trustpilot ships with the embed —
        it is replaced by the rendered widget the moment the script mounts.
      */}
      <div
        ref={containerRef}
        className="trustpilot-widget"
        data-locale={TRUSTPILOT_LOCALE}
        data-template-id={TRUSTPILOT_TEMPLATE_ID}
        data-businessunit-id={TRUSTPILOT_BUSINESS_UNIT_ID}
        data-style-height={`${height}px`}
        data-style-width="100%"
        data-theme="dark"
        style={{ minHeight: height }}
      >
        <a
          href={`https://www.trustpilot.com/review/${TRUSTPILOT_DOMAIN}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            track(TRACKING_EVENTS.TRUSTPILOT_REVIEW_LINK_OPENED, {
              context: analyticsContext,
            })
          }
        >
          Trustpilot
        </a>
      </div>
    </View>
  );
}
