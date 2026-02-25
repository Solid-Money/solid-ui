import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { getAttributionChannel } from '@/lib/attribution';
import { EXPO_PUBLIC_PERSONA_SANDBOX_ENVIRONMENT_ID, isProduction } from '@/lib/config';
import { useAttributionStore } from '@/store/useAttributionStore';

import type { ClientOptions } from 'persona';

export type BridgeKycParams = {
  onSuccess?: () => void;
};

export default function BridgeKyc({ onSuccess }: BridgeKycParams = {}) {
  const router = useRouter();
  const { url, redirectUri: paramRedirectUri } = useLocalSearchParams<{
    url?: string;
    redirectUri?: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const parseKycUrlToOptions = (
    rawUrl: string,
  ): {
    options: ClientOptions;
    redirectUri?: string;
  } => {
    const parsedUrl = new URL(rawUrl);

    if (parsedUrl.pathname.includes('/verify')) {
      parsedUrl.pathname = parsedUrl.pathname.replace('/verify', '/widget');
    }

    if (typeof window !== 'undefined' && !parsedUrl.searchParams.has('iframe-origin')) {
      parsedUrl.searchParams.set('iframe-origin', window.location.origin);
    }

    const searchParams = parsedUrl.searchParams;

    const templateId = searchParams.get('inquiry-template-id') ?? undefined;
    const inquiryId = searchParams.get('inquiry-id') ?? undefined;
    const environmentId = searchParams.get('environment-id') ?? undefined;
    const referenceId = searchParams.get('reference-id') ?? undefined;
    const redirectUri = searchParams.get('redirect-uri') ?? undefined;

    const fields: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key.startsWith('fields[') && key.endsWith(']')) {
        const innerKey = key.slice('fields['.length, -1);
        if (innerKey) fields[innerKey] = value;
      }
    });

    const options: ClientOptions = {
      templateId,
      inquiryId,
      environmentId,
      referenceId,
      fields,
    };

    return { options, redirectUri };
  };

  useEffect(() => {
    let destroyed = false;

    track(TRACKING_EVENTS.KYC_LINK_PAGE_LOADED, {
      hasUrl: !!url,
      urlLength: url?.length,
      mode: 'bridge',
    });

    if (!url) {
      track(TRACKING_EVENTS.KYC_LINK_ERROR, {
        error: 'No KYC URL provided',
        stage: 'url_validation',
      });
      setError('No KYC URL provided');
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        const sandboxEnvId =
          !isProduction && EXPO_PUBLIC_PERSONA_SANDBOX_ENVIRONMENT_ID
            ? EXPO_PUBLIC_PERSONA_SANDBOX_ENVIRONMENT_ID
            : undefined;

        const { options: rawOptions, redirectUri } = parseKycUrlToOptions(url);

        const options: ClientOptions = {
          ...rawOptions,
          environmentId: sandboxEnvId ?? rawOptions.environmentId,
        };

        track(TRACKING_EVENTS.KYC_LINK_PARSED, {
          hasTemplateId: !!options.templateId,
          hasInquiryId: !!options.inquiryId,
          hasEnvironmentId: !!options.environmentId,
          hasReferenceId: !!options.referenceId,
          hasRedirectUri: !!redirectUri,
          redirectUri: redirectUri,
          fieldsCount: Object.keys(options.fields || {}).length,
          kycUrl: url,
        });

        if (typeof window === 'undefined') {
          track(TRACKING_EVENTS.KYC_LINK_ERROR, {
            error: 'Persona can only run in the browser',
            stage: 'browser_check',
          });
          setError('Persona can only run in the browser');
          setLoading(false);
          return;
        }

        if (!options.templateId && !options.inquiryId) {
          track(TRACKING_EVENTS.KYC_LINK_ERROR, {
            error: 'Missing templateId or inquiryId',
            stage: 'options_validation',
            rawUrl: url,
          });
          throw new Error('Missing templateId or inquiryId');
        }

        const { setupIframe, setupEvents } = await import('persona');

        const containerId = 'persona-inline-' + Math.random().toString(36).slice(2);

        unsubscribeRef.current = setupEvents(containerId, {
          templateId: options.templateId ?? null,
          templateVersionId: (options as any).templateVersionId ?? null,
          host: (options as any).host ?? null,
          onLoad: null,
          onEvent: (name: string, meta: any) => {
            if (name === 'start') {
              track(TRACKING_EVENTS.KYC_STEP_STARTED, {
                step_name: meta?.name || 'unknown',
                template_id: options.templateId,
                inquiry_id: options.inquiryId,
              });
            } else if (name === 'complete') {
              track(TRACKING_EVENTS.KYC_STEP_COMPLETED, {
                step_name: meta?.name || 'unknown',
                template_id: options.templateId,
                inquiry_id: options.inquiryId,
              });
            }
          },
          onReady: () => {
            track(TRACKING_EVENTS.KYC_LINK_SDK_READY, {
              templateId: options.templateId,
              inquiryId: options.inquiryId,
            });
            setLoading(false);
          },
          onComplete: ({ status }) => {
            const attributionData = useAttributionStore.getState().getAttributionForEvent();
            const attributionChannel = getAttributionChannel(attributionData);

            track(TRACKING_EVENTS.KYC_LINK_COMPLETED, {
              status,
              hasRedirectUri: !!redirectUri,
              redirectUri: redirectUri,
              kycUrl: url,
              isRainMode: false,
              ...attributionData,
              attribution_channel: attributionChannel,
            });
            onSuccess?.();

            const targetUri = redirectUri ?? paramRedirectUri;
            if (targetUri) {
              try {
                window.location.replace(targetUri);
              } catch (_e) {
                router.replace(targetUri as any);
              }
            }
          },
          onCancel: () => {
            track(TRACKING_EVENTS.KYC_LINK_CANCELLED, {
              templateId: options.templateId,
              inquiryId: options.inquiryId,
            });
            setLoading(false);
            try {
              router.back();
            } catch (_e) {}
          },
          onError: e => {
            track(TRACKING_EVENTS.KYC_LINK_ERROR, {
              error: e?.message || 'Persona initialization error',
              stage: 'sdk_error',
              templateId: options.templateId,
              inquiryId: options.inquiryId,
            });
            setError(e?.message || 'Persona initialization error');
            setLoading(false);
          },
        });

        if (iframeRef.current) {
          setupIframe(iframeRef.current, containerId, 'inline', {
            ...options,
            frameWidth: '80%',
            frameHeight: '650px',
            widgetPadding: { top: 16, bottom: 16, left: 16, right: 16 },
          });
        }
      } catch (e: any) {
        track(TRACKING_EVENTS.KYC_LINK_ERROR, {
          error: e?.message || 'Invalid URL format',
          stage: 'parsing',
        });
        setError(e?.message || 'Invalid URL format');
        setLoading(false);
      }
    };

    run();

    return () => {
      if (!destroyed) {
        destroyed = true;
        try {
          unsubscribeRef.current?.();
        } catch (_e) {}
        unsubscribeRef.current = null;
      }
    };
  }, [paramRedirectUri, url, onSuccess, router]);

  return (
    <PageLayout desktopOnly>
      <View className="mx-auto w-full max-w-lg flex-1 pt-8">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            className="web:hover:opacity-70"
          >
            <ArrowLeft color="white" />
          </Pressable>
          <Text className="text-center text-xl font-semibold text-white md:text-2xl">
            Verify identity
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.inlineContainer}>
          {loading && (
            <Text className="text-base" style={styles.loadingText}>
              Loading...
            </Text>
          )}
          {error && (
            <Text className="text-base" style={styles.errorText}>
              {error}
            </Text>
          )}
          <iframe ref={iframeRef} style={styles.inlineIframe as any} title="Persona KYC" />
        </View>
      </View>
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  loadingText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 20,
    color: 'red',
    fontSize: 16,
  },
  inlineContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineIframe: {
    width: '100%',
    maxWidth: 400,
    height: 650,
    borderWidth: 0,
    borderRadius: 4,
    marginTop: 40,
    marginBottom: 140,
  },
});
