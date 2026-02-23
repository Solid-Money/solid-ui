import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { personaSimulateAction, submitPersonaKyc } from '@/lib/api';
import { getAttributionChannel } from '@/lib/attribution';
import { EXPO_PUBLIC_PERSONA_SANDBOX_ENVIRONMENT_ID, isProduction } from '@/lib/config';
import { KycStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useAttributionStore } from '@/store/useAttributionStore';
import { useKycStore } from '@/store/useKycStore';

import type { ClientOptions } from 'persona';

const PERSONA_SIMULATE_ACTIONS = [
  { value: 'approve_inquiry', label: 'Approve inquiry' },
  { value: 'complete_inquiry', label: 'Complete inquiry' },
  { value: 'fail_inquiry', label: 'Fail inquiry' },
  { value: 'decline_inquiry', label: 'Decline inquiry' },
  { value: 'mark_for_review_inquiry', label: 'Mark for review' },
  { value: 'create_passed_verification', label: 'Create passed verification' },
  { value: 'create_failed_verification', label: 'Create failed verification' },
] as const;

export type KycParams = {
  onSuccess?: () => void;
};

export default function Kyc({ onSuccess }: KycParams = {}) {
  const router = useRouter();
  const {
    url,
    mode,
    templateId: paramTemplateId,
    redirectUri: paramRedirectUri,
  } = useLocalSearchParams<{
    url?: string;
    mode?: string;
    templateId?: string;
    redirectUri?: string;
  }>();
  const setRainKycStatus = useKycStore(state => state.setRainKycStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentInquiryId, setCurrentInquiryId] = useState<string | null>(null);
  const [simulateInquiryId, setSimulateInquiryId] = useState('');
  const [simulateAction, setSimulateAction] = useState<string>(PERSONA_SIMULATE_ACTIONS[0].value);
  const [simulateLoading, setSimulateLoading] = useState(false);
  const [simulateError, setSimulateError] = useState<string | null>(null);
  const setInquiryIdRef = useRef<(id: string | null) => void>(() => {});
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isRainMode = mode === 'rain' && paramTemplateId; // route param string, not CardProvider

  setInquiryIdRef.current = setCurrentInquiryId;

  // Parse the provided KYC link into Persona Client options
  const parseKycUrlToOptions = (
    rawUrl: string,
  ): {
    options: ClientOptions;
    redirectUri?: string;
  } => {
    const parsedUrl = new URL(rawUrl);

    // Use /widget path instead of /verify when embedding (Bridge support recommendation)
    if (parsedUrl.pathname.includes('/verify')) {
      parsedUrl.pathname = parsedUrl.pathname.replace('/verify', '/widget');
    }

    // Add iframe-origin for proper embedding (Bridge support recommendation)
    if (typeof window !== 'undefined' && !parsedUrl.searchParams.has('iframe-origin')) {
      parsedUrl.searchParams.set('iframe-origin', window.location.origin);
    }

    const searchParams = parsedUrl.searchParams;

    const templateId = searchParams.get('inquiry-template-id') ?? undefined;
    const inquiryId = searchParams.get('inquiry-id') ?? undefined;
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
      inquiryId,
      environmentId,
      referenceId,
      fields,
    };

    return { options, redirectUri };
  };

  useEffect(() => {
    let destroyed = false;

    // Track page load
    track(TRACKING_EVENTS.KYC_LINK_PAGE_LOADED, {
      hasUrl: !!url,
      urlLength: url?.length,
      mode,
      isRainMode,
    });

    if (!url && !isRainMode) {
      track(TRACKING_EVENTS.KYC_LINK_ERROR, {
        error: 'No URL or Rain template provided',
        stage: 'url_validation',
      });
      setError('No URL or Rain template provided');
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        const sandboxEnvId =
          !isProduction && EXPO_PUBLIC_PERSONA_SANDBOX_ENVIRONMENT_ID
            ? EXPO_PUBLIC_PERSONA_SANDBOX_ENVIRONMENT_ID
            : undefined;

        const { options: rawOptions, redirectUri } = isRainMode
          ? {
              options: {
                templateId: paramTemplateId,
                inquiryId: undefined,
                environmentId: sandboxEnvId,
                referenceId: undefined,
                fields: {},
              } as ClientOptions,
              redirectUri: paramRedirectUri ?? undefined,
            }
          : parseKycUrlToOptions(url!);

        const options: ClientOptions = {
          ...rawOptions,
          environmentId: sandboxEnvId ?? rawOptions.environmentId,
        };

        // Track parsed URL details for debugging
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

        // Basic validation
        if (!options.templateId && !options.inquiryId) {
          track(TRACKING_EVENTS.KYC_LINK_ERROR, {
            error: 'Missing templateId or inquiryId',
            stage: 'options_validation',
            rawUrl: url,
          });
          throw new Error('Missing templateId or inquiryId');
        }

        const rainMode = isRainMode;

        const { setupIframe, setupEvents } = await import('persona');

        const containerId = 'persona-inline-' + Math.random().toString(36).slice(2);

        // Wire events with explicit nullables per SDK types
        unsubscribeRef.current = setupEvents(containerId, {
          templateId: options.templateId ?? null,
          templateVersionId: (options as any).templateVersionId ?? null,
          host: (options as any).host ?? null,
          onLoad: null,
          onEvent: (name: string, meta: any) => {
            if (meta?.inquiryId) setInquiryIdRef.current(meta.inquiryId);
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
          onComplete: async ({ inquiryId: completedInquiryId, status }) => {
            if (completedInquiryId) setInquiryIdRef.current(completedInquiryId);
            const attributionData = useAttributionStore.getState().getAttributionForEvent();
            const attributionChannel = getAttributionChannel(attributionData);

            track(TRACKING_EVENTS.KYC_LINK_COMPLETED, {
              inquiryId: completedInquiryId,
              status,
              hasRedirectUri: !!redirectUri,
              redirectUri: redirectUri,
              kycUrl: url,
              isRainMode: rainMode,
              ...attributionData,
              attribution_channel: attributionChannel,
            });
            onSuccess?.();

            if (rainMode && completedInquiryId) {
              try {
                const res = await withRefreshToken(() => submitPersonaKyc(completedInquiryId));
                if (res?.kycStatus) {
                  setRainKycStatus(res.kycStatus as KycStatus);
                }
              } catch (e) {
                console.error('Rain KYC submit failed:', e);
              }
            }

            const targetUri = redirectUri ?? (rainMode ? paramRedirectUri : undefined);
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
  }, [
    isRainMode,
    mode,
    onSuccess,
    paramRedirectUri,
    paramTemplateId,
    router,
    setRainKycStatus,
    url,
  ]);

  const handleSimulate = async () => {
    const inquiryId = simulateInquiryId.trim() || currentInquiryId;
    if (!inquiryId) {
      setSimulateError('Enter or paste an inquiry ID');
      return;
    }
    setSimulateError(null);
    setSimulateLoading(true);
    try {
      await personaSimulateAction(inquiryId, simulateAction);

      const completesFlow =
        simulateAction === 'approve_inquiry' || simulateAction === 'complete_inquiry';
      if (completesFlow && isRainMode) {
        try {
          const res = await withRefreshToken(() => submitPersonaKyc(inquiryId));
          if (res?.kycStatus) setRainKycStatus(res.kycStatus as KycStatus);
        } catch (e) {
          console.error('Submit Persona KYC after simulate failed:', e);
          setSimulateError('Simulate ok but submit to backend failed');
          setSimulateLoading(false);
          return;
        }
        const baseUrl = process.env.EXPO_PUBLIC_BASE_URL ?? '';
        const targetUri = paramRedirectUri ?? `${baseUrl}${path.CARD_ACTIVATE}`;
        try {
          window.location.replace(targetUri);
        } catch (_e) {
          router.replace(targetUri as any);
        }
        return;
      }

      setSimulateError(null);
    } catch (e: any) {
      setSimulateError(e?.message ?? 'Simulate failed');
    } finally {
      setSimulateLoading(false);
    }
  };

  const showSimulatePanel = !isProduction && Platform.OS === 'web';

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

        {showSimulatePanel && (
          <View style={styles.simulatePanel}>
            <Text style={styles.simulatePanelTitle}>Simulate (sandbox only)</Text>
            <Text style={styles.simulateLabel}>Inquiry ID</Text>
            <TextInput
              style={styles.simulateInput}
              value={simulateInquiryId}
              onChangeText={setSimulateInquiryId}
              placeholder={currentInquiryId ?? 'Paste from Persona dashboard'}
              placeholderTextColor="#888"
            />
            <Text style={styles.simulateLabel}>Action</Text>
            <View style={styles.simulateSelectRow}>
              {Platform.OS === 'web' && typeof document !== 'undefined' && (
                <select
                  value={simulateAction}
                  onChange={e => setSimulateAction((e.target as HTMLSelectElement).value)}
                  style={styles.simulateSelect as any}
                >
                  {PERSONA_SIMULATE_ACTIONS.map(a => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              )}
              <Pressable
                onPress={handleSimulate}
                disabled={simulateLoading}
                style={[styles.simulateButton, simulateLoading && styles.simulateButtonDisabled]}
              >
                <Text style={styles.simulateButtonText} className="text-black">
                  {simulateLoading ? 'Simulating…' : 'Simulate'}
                </Text>
              </Pressable>
            </View>
            {simulateError && <Text style={styles.simulateError}>{simulateError}</Text>}
          </View>
        )}

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
    marginBottom: 140,
  },
  simulatePanel: {
    marginTop: 16,
    marginHorizontal: 24,
    padding: 12,
    backgroundColor: 'rgba(68, 65, 65, 0.3)',
    borderRadius: 8,
  },
  simulatePanelTitle: {
    fontSize: 12,
    color: '#94F27F',
    marginBottom: 8,
    fontWeight: '600',
  },
  simulateLabel: {
    fontSize: 12,
    color: '#ACACAC',
    marginTop: 8,
    marginBottom: 4,
  },
  simulateInput: {
    backgroundColor: '#333',
    color: '#fff',
    padding: 8,
    borderRadius: 4,
    fontSize: 14,
  },
  simulateSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  simulateSelect: {
    flex: 1,
    backgroundColor: '#333',
    color: '#fff',
    padding: 8,
    borderRadius: 4,
    fontSize: 14,
    minHeight: 40,
  },
  simulateButton: {
    backgroundColor: '#94F27F',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  simulateButtonDisabled: {
    opacity: 0.6,
  },
  simulateButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  simulateError: {
    marginTop: 8,
    fontSize: 12,
    color: '#f87171',
  },
});
