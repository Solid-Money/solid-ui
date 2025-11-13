import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ClientOptions } from 'persona';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

export type KycParams = {
  onSuccess?: () => void;
};

export default function Kyc({ onSuccess }: KycParams = {}) {
  const router = useRouter();
  const { url } = useLocalSearchParams<{ url: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Parse the provided KYC link into Persona Client options
  const parseKycUrlToOptions = (
    rawUrl: string,
  ): {
    options: ClientOptions;
    redirectUri?: string;
  } => {
    const parsedUrl = new URL(rawUrl);
    const searchParams = parsedUrl.searchParams;

    const templateId = searchParams.get('inquiry-template-id') ?? undefined;
    const environmentId = searchParams.get('environment-id') ?? undefined;
    const referenceId = searchParams.get('reference-id') ?? undefined;
    const redirectUri = searchParams.get('redirect-uri') ?? undefined;

    // Collect fields[xxx]=value into a flat map
    const fields: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key.startsWith('fields[') && key.endsWith(']')) {
        const innerKey = key.slice('fields['.length, -1);
        if (innerKey) fields[innerKey] = value;
      }
    });

    const options: ClientOptions = {
      templateId,
      environmentId,
      referenceId,
      fields,
    };

    return { options, redirectUri };
  };

  useEffect(() => {
    let destroyed = false;

    if (!url) {
      setError('No URL provided');
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        const { options, redirectUri } = parseKycUrlToOptions(url);

        if (typeof window === 'undefined') {
          setError('Persona can only run in the browser');
          setLoading(false);
          return;
        }

        // Basic validation
        if (!options.templateId && !options.inquiryId) {
          throw new Error('Missing templateId or inquiryId');
        }

        const { setupIframe, setupEvents } = await import('persona');

        const containerId = 'persona-inline-' + Math.random().toString(36).slice(2);

        // Wire events with explicit nullables per SDK types
        unsubscribeRef.current = setupEvents(containerId, {
          templateId: options.templateId ?? null,
          templateVersionId: (options as any).templateVersionId ?? null,
          host: (options as any).host ?? null,
          onLoad: null,
          onEvent: null,
          onReady: () => setLoading(false),
          onComplete: ({ inquiryId: _inquiryId, status: _status }) => {
            onSuccess?.();
            if (redirectUri) {
              try {
                window.location.replace(redirectUri);
              } catch (_e) {
                router.replace(redirectUri as any);
              }
            }
          },
          onCancel: () => {
            setLoading(false);
            try {
              router.back();
            } catch (_e) {}
          },
          onError: e => {
            setError(e?.message || 'Persona initialization error');
            setLoading(false);
          },
        });

        // Mount inline
        if (iframeRef.current) {
          setupIframe(iframeRef.current, containerId, 'inline', {
            ...options,
            frameWidth: '80%',
            frameHeight: '650px',
            widgetPadding: { top: 16, bottom: 16, left: 16, right: 16 },
          });
        }
      } catch (e: any) {
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
  }, [onSuccess, router, url]);

  return (
    <PageLayout desktopOnly>
      <View className="flex-1 max-w-lg mx-auto pt-8 w-full">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            className="web:hover:opacity-70"
          >
            <ArrowLeft color="white" />
          </Pressable>
          <Text className="text-white text-xl md:text-2xl font-semibold text-center">
            Verify identity
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.inlineContainer}>
          {loading && <Text style={styles.loadingText}>Loading...</Text>}
          {error && <Text style={styles.errorText}>{error}</Text>}
          <iframe ref={iframeRef} style={styles.inlineIframe as any} title="Persona KYC" />
        </View>
      </View>
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
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
  },
});
