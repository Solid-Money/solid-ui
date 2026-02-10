import * as Sentry from '@sentry/react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

import { getActivityStreamUrl, refreshToken } from '@/lib/api';
import {
  ActivityEvent,
  SSEActivityData,
  SSEBalanceUpdateData,
  SSEConnectionState,
  SSEEventData,
  SSEPingData,
} from '@/lib/types';
import { queryClient } from '@/app/_layout';
import { useActivityStore } from '@/store/useActivityStore';
import { useUserStore } from '@/store/useUserStore';

// SSE timing constants
const INITIAL_RECONNECT_DELAY_MS = 1000; // 1 second
const MAX_RECONNECT_DELAY_MS = 30000; // 30 seconds
const RECONNECT_MULTIPLIER = 2;
const MAX_CONSECUTIVE_ERRORS = 5; // Stop retrying after 5 consecutive errors
const MAX_CONSECUTIVE_PARSE_ERRORS = 3; // Reconnect after 3 consecutive parse errors

// Heartbeat detection constants
const HEARTBEAT_TIMEOUT_MS = 60000; // 60 seconds - if no heartbeat, assume stale
const HEARTBEAT_CHECK_INTERVAL_MS = 30000; // Check every 30 seconds

// =============================================================================
// SINGLETON SSE CONNECTION MANAGER
// =============================================================================
// This lives outside React's lifecycle to ensure only ONE connection exists
// per user, regardless of how many components use the hook.

// UI-visible state that triggers re-renders when changed
interface SSEState {
  connectionState: SSEConnectionState;
  error: string | null;
}

// Internal state that does NOT trigger re-renders (used for health monitoring)
interface SSEInternalState {
  lastEventTime: number | null;
  lastHeartbeat: number | null;
}

type SSEStateListener = (state: SSEState) => void;

class SSEConnectionManager {
  // UI-visible state (changes trigger re-renders)
  private state: SSEState = {
    connectionState: 'disconnected',
    error: null,
  };

  // Internal state (changes do NOT trigger re-renders)
  private internalState: SSEInternalState = {
    lastEventTime: null,
    lastHeartbeat: null,
  };

  // Connection management
  private abortController: AbortController | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private consecutiveErrors = 0;
  private consecutiveParseErrors = 0;
  private isConnecting = false;
  private refreshPromise: Promise<boolean> | null = null;

  // Heartbeat monitoring
  private heartbeatCheckInterval: ReturnType<typeof setInterval> | null = null;

  // User tracking
  private currentUserId: string | null = null;

  // User store subscription (singleton - one subscription for all hook instances)
  private userStoreUnsubscribe: (() => void) | null = null;

  // Subscriber management (reference counting)
  private subscribers = new Set<SSEStateListener>();

  // App state tracking
  private appStateSubscription: { remove: () => void } | null = null;

  // User store subscription is set up lazily when first subscriber is added
  // and cleaned up when last subscriber is removed (no constructor needed)

  /**
   * Set up user store subscription to track user changes
   * Called when first subscriber is added or when enable() is called
   */
  private setupUserStoreSubscription(): void {
    if (this.userStoreUnsubscribe) return; // Already set up

    this.userStoreUnsubscribe = useUserStore.subscribe(storeState => {
      const user = storeState.users.find(u => u.selected);
      const newUserId = user?.userId || null;

      // User changed - update connection
      if (newUserId !== this.currentUserId) {
        this.currentUserId = newUserId;
        // Connect/disconnect if we have active subscribers OR an active connection
        // (supports subscribe: false where enable() was called directly)
        const hasActiveConnection =
          this.state.connectionState === 'connected' || this.state.connectionState === 'connecting';
        if (this.subscribers.size > 0 || hasActiveConnection) {
          if (newUserId) {
            this.connect();
          } else {
            this.disconnect();
          }
        }
      }
    });
  }

  /**
   * Clean up user store subscription
   * Called when last subscriber is removed
   */
  private cleanupUserStoreSubscription(): void {
    if (this.userStoreUnsubscribe) {
      this.userStoreUnsubscribe();
      this.userStoreUnsubscribe = null;
    }
  }

  /**
   * Clean up app state listener
   * Called when last subscriber is removed
   */
  private cleanupAppStateListener(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  /**
   * Subscribe to state changes. Returns unsubscribe function.
   */
  subscribe(listener: SSEStateListener): () => void {
    // Set up user store subscription when first subscriber is added
    if (this.subscribers.size === 0) {
      this.setupUserStoreSubscription();
    }

    this.subscribers.add(listener);
    // Immediately notify with current state
    listener(this.state);

    return () => {
      this.subscribers.delete(listener);
      // If no more subscribers, disconnect and clean up
      if (this.subscribers.size === 0) {
        this.disconnect();
        this.cleanupUserStoreSubscription();
        this.cleanupAppStateListener();
      }
    };
  }

  /**
   * Get current state (for initial render)
   */
  getState(): SSEState {
    return this.state;
  }

  /**
   * Get internal state (for health monitoring - not for React state)
   */
  getInternalState(): SSEInternalState {
    return this.internalState;
  }

  /**
   * Notify all subscribers of state change
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(listener => listener(this.state));
  }

  /**
   * Update UI-visible state and notify subscribers (triggers re-renders)
   */
  private setState(partial: Partial<SSEState>): void {
    this.state = { ...this.state, ...partial };
    this.notifySubscribers();
  }

  /**
   * Update internal state without notifying subscribers (no re-renders)
   * Used for heartbeat tracking and last event time
   */
  private setInternalState(partial: Partial<SSEInternalState>): void {
    this.internalState = { ...this.internalState, ...partial };
  }

  /**
   * Enable SSE for a user. Only connects if not already connected for this user.
   */
  enable(userId: string): void {
    // Already connected or connecting for this user - prevent duplicate connection attempts
    if (
      this.currentUserId === userId &&
      (this.state.connectionState === 'connected' || this.state.connectionState === 'connecting')
    ) {
      return;
    }

    // Different user - disconnect first
    if (this.currentUserId && this.currentUserId !== userId) {
      this.disconnect();
    }

    this.currentUserId = userId;
    // Set up user store subscription to handle user switching (even when subscribe: false)
    this.setupUserStoreSubscription();
    this.setupAppStateListener();
    this.connect();
  }

  /**
   * Disable SSE (called when all subscribers unsubscribe)
   */
  disable(): void {
    this.disconnect();
    this.currentUserId = null;
  }

  /**
   * Get JWT token from store
   */
  private getJWTToken(): string | null {
    const { users } = useUserStore.getState();
    const currentUser = users.find(user => user.selected);
    return currentUser?.tokens?.accessToken || null;
  }

  /**
   * Parse SSE line - handles data, events, and heartbeat comments
   */
  private parseSSELine(
    line: string,
  ): { event?: string; data?: string; heartbeat?: boolean } | null {
    if (!line) {
      return null;
    }

    // SSE comments starting with ':' - check for heartbeat
    if (line.startsWith(':')) {
      if (line.includes('heartbeat') || line.includes('ping')) {
        return { heartbeat: true };
      }
      return null;
    }

    if (line.startsWith('event:')) {
      return { event: line.slice(6).trim() };
    }
    if (line.startsWith('data:')) {
      return { data: line.slice(5).trim() };
    }
    return null;
  }

  /**
   * Try to refresh the JWT token and reconnect.
   * Returns true if refresh succeeded and reconnection was initiated.
   */
  private async tryRefreshTokenAndReconnect(): Promise<boolean> {
    // If already refreshing, wait for the existing refresh to complete
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Create a new refresh promise to prevent race conditions
    this.refreshPromise = (async () => {
      try {
        const { users, updateUser } = useUserStore.getState();
        const currentUser = users.find(user => user.selected);

        if (!currentUser?.tokens?.refreshToken) {
          return false;
        }

        // refreshToken() gets the refresh token internally and returns a Response
        const response = await refreshToken();
        const data = (await response.json()) as {
          tokens: { accessToken: string; refreshToken: string };
        };

        if (data?.tokens?.accessToken && data?.tokens?.refreshToken) {
          // Update tokens in store
          updateUser({
            ...currentUser,
            tokens: {
              accessToken: data.tokens.accessToken,
              refreshToken: data.tokens.refreshToken,
            },
          });

          // Properly disconnect and reconnect with new token
          // This ensures clean state and prevents race conditions
          this.reconnect();
          return true;
        }

        return false;
      } catch (error) {
        Sentry.captureException(error, {
          tags: { type: 'sse_token_refresh_error' },
          level: 'error',
        });
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Start heartbeat monitoring interval.
   * Detects stale connections where the server stops sending heartbeats.
   */
  private startHeartbeatMonitor(): void {
    this.stopHeartbeatMonitor();

    // Initialize lastHeartbeat to now (internal state - no re-render)
    this.setInternalState({ lastHeartbeat: Date.now() });

    this.heartbeatCheckInterval = setInterval(() => {
      const { connectionState } = this.state;
      const { lastHeartbeat } = this.internalState;

      // Stop monitoring if no longer connected
      if (connectionState !== 'connected') {
        this.stopHeartbeatMonitor();
        return;
      }

      if (lastHeartbeat && Date.now() - lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
        // Heartbeat timeout detected - reconnect to restore connection
        this.reconnect();
      }
    }, HEARTBEAT_CHECK_INTERVAL_MS);
  }

  /**
   * Stop heartbeat monitoring interval.
   */
  private stopHeartbeatMonitor(): void {
    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval);
      this.heartbeatCheckInterval = null;
    }
  }

  /**
   * Handle incoming ping event (heartbeat)
   * Updates internal state only - does NOT trigger re-renders
   */
  private handlePing(data: SSEPingData): void {
    this.setInternalState({ lastHeartbeat: Date.now() });

    // Guard against null/malformed ping data
    if (!data || typeof data !== 'object') {
      return;
    }

    // Optional: track server time drift
    if (data.timestamp && typeof data.timestamp === 'number') {
      const drift = Date.now() - data.timestamp;
      if (Math.abs(drift) > 5000) {
        console.warn('Server time drift detected:', drift, 'ms');
      }
    }
  }

  /**
   * Handle incoming activity event with validation
   */
  private handleActivityEvent(data: SSEActivityData): void {
    if (!this.currentUserId) return;

    // Validate required fields before processing
    if (!data || typeof data !== 'object') {
      console.warn('Received malformed SSE activity data:', data);
      Sentry.captureMessage('Received malformed SSE activity data', {
        level: 'warning',
        tags: { type: 'sse_malformed_activity' },
        extra: { data },
      });
      return;
    }

    if (!data.event || !['created', 'updated', 'deleted'].includes(data.event)) {
      console.warn('Received SSE event with invalid event type:', data.event);
      Sentry.captureMessage('Invalid SSE event type', {
        level: 'warning',
        tags: { type: 'sse_invalid_event_type' },
        extra: { event: data.event, data },
      });
      return;
    }

    if (!data.activity || typeof data.activity !== 'object') {
      console.warn('Received SSE event with invalid activity:', data);
      Sentry.captureMessage('Invalid SSE activity object', {
        level: 'warning',
        tags: { type: 'sse_invalid_activity' },
        extra: { data, hasActivity: !!data.activity, activityType: typeof data.activity },
      });
      return;
    }

    if (!data.activity.clientTxId || typeof data.activity.clientTxId !== 'string') {
      Sentry.captureMessage('SSE activity missing clientTxId', {
        level: 'warning',
        tags: { type: 'sse_missing_client_tx_id' },
        extra: { data },
      });
      return;
    }

    // Validate type field exists (critical for rendering)
    if (!data.activity.type || typeof data.activity.type !== 'string') {
      Sentry.captureMessage('SSE activity missing type', {
        level: 'warning',
        tags: { type: 'sse_missing_activity_type' },
        extra: { data },
      });
      return;
    }

    // Validate status field exists (critical for rendering)
    if (!data.activity.status || typeof data.activity.status !== 'string') {
      Sentry.captureMessage('SSE activity missing status', {
        level: 'warning',
        tags: { type: 'sse_missing_activity_status' },
        extra: { data },
      });
      return;
    }

    const { event, activity, timestamp } = data;
    const { upsertEvent } = useActivityStore.getState();

    // Process based on event type - wrap in try-catch to prevent SSE crashes
    try {
      switch (event) {
        case 'created':
        case 'updated':
          upsertEvent(this.currentUserId, activity);
          break;

        case 'deleted':
          // Deleted events have minimal activity payload
          // { clientTxId, deleted: true, deletedAt: Date }
          const deletedActivity: ActivityEvent = {
            ...activity,
            deleted: true,
            deletedAt: activity.deletedAt || new Date(timestamp).toISOString(),
          };
          upsertEvent(this.currentUserId, deletedActivity);
          break;
      }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { type: 'sse_upsert_error' },
        extra: { activity, event, userId: this.currentUserId },
      });
    }

    // Update internal state only - activity updates go to the store, not SSE state
    this.setInternalState({ lastEventTime: timestamp });
  }

  /**
   * Handle incoming balance update event
   * Invalidates balance-related queries to trigger refetch
   */
  private handleBalanceUpdateEvent(data: SSEBalanceUpdateData): void {
    if (!this.currentUserId) return;

    // Validate required fields before processing
    if (!data || typeof data !== 'object') {
      console.warn('Received malformed SSE balance update data:', data);
      Sentry.captureMessage('Received malformed SSE balance update data', {
        level: 'warning',
        tags: { type: 'sse_malformed_balance_update' },
        extra: { data },
      });
      return;
    }

    if (!data.balance || typeof data.balance !== 'object') {
      console.warn('Received SSE balance update with invalid balance payload:', data);
      Sentry.captureMessage('Invalid SSE balance update payload', {
        level: 'warning',
        tags: { type: 'sse_invalid_balance_update' },
        extra: { data },
      });
      return;
    }

    try {
      // Invalidate token balance queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['tokenBalances'] });

      // Invalidate vault balance queries to trigger refetch
      // Using partial match to invalidate all vault balance variants
      queryClient.invalidateQueries({ queryKey: ['vault'] });

      // Log for debugging
      console.debug(`[SSE] Balance update received: ${data.balance.changeType}`);
    } catch (err) {
      Sentry.captureException(err, {
        tags: { type: 'sse_balance_update_error' },
        extra: { data, userId: this.currentUserId },
      });
    }

    // Update internal state
    this.setInternalState({ lastEventTime: data.timestamp });
  }

  /**
   * Connect to SSE stream
   */
  private async connect(): Promise<void> {
    // Prevent multiple simultaneous connections
    if (this.isConnecting) {
      return;
    }

    if (!this.currentUserId) return;

    // Abort any existing connection
    if (this.abortController) {
      this.abortController.abort();
    }

    const jwt = this.getJWTToken();
    if (!jwt) {
      this.setState({
        connectionState: 'error',
        error: 'No authentication token available',
      });
      return;
    }

    this.isConnecting = true;
    this.setState({ connectionState: 'connecting', error: null });

    const abortController = new AbortController();
    this.abortController = abortController;

    try {
      const url = getActivityStreamUrl();
      const headers: Record<string, string> = {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        Authorization: `Bearer ${jwt}`,
      };

      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        headers['X-Platform'] = 'mobile';
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: abortController.signal,
        credentials: 'include',
      });

      // Check for 401 - try token refresh before failing
      if (response.status === 401) {
        const refreshed = await this.tryRefreshTokenAndReconnect();
        if (refreshed) {
          return; // Reconnection initiated with new token
        }
        this.setState({
          connectionState: 'error',
          error: 'Authentication failed',
        });
        return;
      }

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
      }

      this.reader = response.body?.getReader() ?? null;
      if (!this.reader) {
        throw new Error('Response body is not readable');
      }

      // Connection successful - reset backoff and start heartbeat monitoring
      this.setState({ connectionState: 'connected' });
      this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
      this.consecutiveErrors = 0;
      this.consecutiveParseErrors = 0;
      this.isConnecting = false;
      this.startHeartbeatMonitor();

      const decoder = new TextDecoder();
      let buffer = '';

      // Read stream
      while (true) {
        const { done, value } = await this.reader.read();

        if (done) {
          // Stream ended - schedule reconnect
          this.setState({ connectionState: 'reconnecting' });
          this.scheduleReconnect();
          return;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const parsed = this.parseSSELine(line);

          // Track heartbeats to detect stale connections (internal state - no re-render)
          if (parsed?.heartbeat) {
            this.setInternalState({ lastHeartbeat: Date.now() });
            continue;
          }

          // Also detect ping events from backend (event: ping)
          if (parsed?.event === 'ping') {
            this.setInternalState({ lastHeartbeat: Date.now() });
            continue;
          }

          if (parsed?.data) {
            // Data events also count as proof of live connection (internal state - no re-render)
            this.setInternalState({ lastHeartbeat: Date.now() });
            try {
              const rawData = JSON.parse(parsed.data);

              // Check if this is the new format with 'type' field or old format
              if (rawData && typeof rawData === 'object' && 'type' in rawData) {
                // New format: { type: 'ping' | 'activity', data: {...} }
                const eventData = rawData as SSEEventData;

                switch (eventData.type) {
                  case 'ping':
                    this.handlePing(eventData.data);
                    break;

                  case 'activity':
                    this.handleActivityEvent(eventData.data);
                    break;

                  case 'balance_update':
                    this.handleBalanceUpdateEvent(eventData.data);
                    break;

                  default:
                    console.warn('Unknown SSE event type:', eventData);
                    Sentry.captureMessage('Unknown SSE event type', {
                      level: 'warning',
                      tags: { type: 'sse_unknown_event_type' },
                      extra: { eventData },
                    });
                }
              } else if (rawData && typeof rawData === 'object') {
                // Old format - backward compatibility
                // Check if it's a ping (has only timestamp) or activity (has event, activity fields)
                if ('timestamp' in rawData && Object.keys(rawData).length === 1) {
                  // Old ping format: { timestamp: number }
                  this.handlePing(rawData as SSEPingData);
                } else if ('event' in rawData && 'activity' in rawData) {
                  // Old activity format: { event: ..., activity: ..., timestamp: ... }
                  this.handleActivityEvent(rawData as SSEActivityData);
                } else if (
                  'event' in rawData &&
                  rawData.event === 'balance_update' &&
                  'balance' in rawData
                ) {
                  // Old balance_update format: { event: 'balance_update', balance: {...}, ... }
                  this.handleBalanceUpdateEvent(rawData as SSEBalanceUpdateData);
                } else {
                  console.warn('Unknown SSE event format:', rawData);
                }
              }

              // Reset parse error counter on successful parse
              this.consecutiveParseErrors = 0;
            } catch (parseError) {
              // Log parse errors to Sentry for monitoring
              Sentry.captureException(parseError, {
                tags: {
                  type: 'sse_parse_error',
                  consecutiveErrors: this.consecutiveParseErrors + 1,
                },
                level: 'warning',
                extra: { rawData: parsed.data },
              });
              this.consecutiveParseErrors++;

              // If we've had too many consecutive parse errors, reconnect
              if (this.consecutiveParseErrors >= MAX_CONSECUTIVE_PARSE_ERRORS) {
                Sentry.captureMessage('SSE: Too many consecutive parse errors, reconnecting', {
                  level: 'error',
                  tags: { type: 'sse_parse_error_threshold' },
                  extra: { consecutiveErrors: this.consecutiveParseErrors },
                });
                this.reconnect();
                // Exit the read loop - the finally block will handle cleanup
                // including releasing the reader lock before reconnecting
                return;
              }
            }
          }
        }
      }
    } catch (err: any) {
      // Don't handle abort errors (intentional disconnect)
      if (err.name === 'AbortError') {
        return;
      }

      // Log connection errors to Sentry
      Sentry.captureException(err, {
        tags: {
          type: 'sse_connection_error',
          consecutiveErrors: this.consecutiveErrors + 1,
        },
        level: this.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS - 1 ? 'error' : 'warning',
      });
      this.consecutiveErrors++;

      if (this.consecutiveErrors < MAX_CONSECUTIVE_ERRORS) {
        this.setState({
          connectionState: 'reconnecting',
          error: err.message || 'Connection failed',
        });
        this.scheduleReconnect();
      } else {
        this.setState({
          connectionState: 'error',
          error: err.message || 'Connection failed',
        });
      }
    } finally {
      // Release the reader lock to allow proper cleanup
      if (this.reader) {
        try {
          this.reader.releaseLock();
        } catch (_e) {
          // Reader may already be released or closed, ignore
        }
        this.reader = null;
      }
      this.isConnecting = false;
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = this.reconnectDelay;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectDelay = Math.min(
        this.reconnectDelay * RECONNECT_MULTIPLIER,
        MAX_RECONNECT_DELAY_MS,
      );
      this.connect();
    }, delay);
  }

  /**
   * Disconnect from SSE stream
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // Release the reader lock if it exists
    if (this.reader) {
      try {
        this.reader.releaseLock();
      } catch (_e) {
        // Reader may already be released or closed, ignore
      }
      this.reader = null;
    }

    // NOTE: Don't remove appStateSubscription here - it needs to persist
    // to detect when app comes back to foreground

    this.stopHeartbeatMonitor();
    this.setState({ connectionState: 'disconnected' });
    this.setInternalState({ lastHeartbeat: null });
    this.isConnecting = false;
  }

  /**
   * Manual reconnect (resets backoff)
   */
  reconnect(): void {
    this.disconnect();
    this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    this.consecutiveErrors = 0;
    this.consecutiveParseErrors = 0;
    if (this.currentUserId) {
      this.setupAppStateListener();
      this.connect();
    }
  }

  /**
   * Setup app state listener for background/foreground handling
   */
  private setupAppStateListener(): void {
    if (this.appStateSubscription) {
      return; // Already set up
    }

    let lastAppState = AppState.currentState;

    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        // App becoming active from background
        if (lastAppState.match(/inactive|background/) && nextAppState === 'active') {
          if (
            this.state.connectionState === 'disconnected' ||
            this.state.connectionState === 'error'
          ) {
            this.reconnect();
          }
        }

        // App going to background - disconnect
        if (nextAppState.match(/inactive|background/) && lastAppState === 'active') {
          this.disconnect();
        }

        lastAppState = nextAppState;
      },
    );
  }
}

// Global singleton instance
const sseManager = new SSEConnectionManager();

// =============================================================================
// REACT HOOK
// =============================================================================

interface UseActivitySSEOptions {
  /** Whether SSE connection should be enabled */
  enabled?: boolean;
  /**
   * Whether to subscribe to SSE state changes (connectionState, error)
   * Set to false if you just want to enable SSE without subscribing to state updates
   * This prevents unnecessary re-renders in components that don't use the return values
   * @default true
   */
  subscribe?: boolean;
}

interface UseActivitySSEReturn {
  /** Current connection state */
  connectionState: SSEConnectionState;
  /** Last error message if any */
  error: string | null;
  /** Manually disconnect from SSE */
  disconnect: () => void;
  /** Manually reconnect to SSE */
  reconnect: () => void;
}

/**
 * Hook for real-time activity updates via Server-Sent Events.
 *
 * SINGLETON PATTERN: All hook instances share a single SSE connection.
 * This prevents multiple connections when useActivity is called by many components.
 *
 * Features:
 * - Automatic reconnection with exponential backoff (1s → 30s)
 * - App state handling (reconnect when app becomes active)
 * - Store integration (updates activity store on events)
 * - Proper cleanup via AbortController
 * - JWT token refresh on 401 errors
 * - Heartbeat detection for stale connection monitoring
 */
export function useActivitySSE(options: UseActivitySSEOptions = {}): UseActivitySSEReturn {
  const { enabled = true, subscribe = true } = options;

  // Only create local state if we need to subscribe to updates
  // This prevents re-renders when used just to enable SSE (like in _layout)
  const [state, setState] = useState<SSEState | null>(() =>
    subscribe ? sseManager.getState() : null,
  );

  // Track if we've already subscribed to prevent duplicate subscriptions
  const subscriptionRef = useRef<(() => void) | null>(null);
  const isSubscribedRef = useRef(false);

  // Subscribe to singleton state changes and handle connection lifecycle
  // Note: User tracking is handled by the singleton's constructor subscription,
  // which fixes the race condition where userId wasn't available on mount.
  useEffect(() => {
    // Prevent duplicate subscriptions if effect runs multiple times
    if (isSubscribedRef.current) {
      return;
    }

    isSubscribedRef.current = true;

    // Only subscribe to state changes if needed (for components that use the return values)
    let unsubscribe: (() => void) | undefined;
    if (subscribe) {
      const stateListener = (newState: SSEState) => {
        setState(newState);
      };
      unsubscribe = sseManager.subscribe(stateListener);
      subscriptionRef.current = unsubscribe;
    }

    // If enabled, trigger connection check
    // The singleton will use its own user tracking to get the userId
    if (enabled) {
      const { users } = useUserStore.getState();
      const currentUser = users.find(user => user.selected);
      if (currentUser?.userId) {
        sseManager.enable(currentUser.userId);
      }
    }

    return () => {
      isSubscribedRef.current = false;
      if (subscriptionRef.current) {
        subscriptionRef.current();
        subscriptionRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, subscribe]);

  // Memoized callbacks that delegate to singleton
  const disconnect = useCallback(() => {
    sseManager.disconnect();
  }, []);

  const reconnect = useCallback(() => {
    sseManager.reconnect();
  }, []);

  return {
    connectionState: state?.connectionState ?? 'disconnected',
    error: state?.error ?? null,
    disconnect,
    reconnect,
  };
}
