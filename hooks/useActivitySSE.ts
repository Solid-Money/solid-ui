import * as Sentry from '@sentry/react-native';
import { useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

import { getActivityStreamUrl, refreshToken } from '@/lib/api';
import { ActivityEvent, SSEActivityData, SSEConnectionState } from '@/lib/types';
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

interface SSEState {
  connectionState: SSEConnectionState;
  error: string | null;
  lastEventTime: number | null;
  lastHeartbeat: number | null;
}

type SSEStateListener = (state: SSEState) => void;

class SSEConnectionManager {
  // Connection state
  private state: SSEState = {
    connectionState: 'disconnected',
    error: null,
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
  private isRefreshingToken = false;

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

  constructor() {
    // Subscribe to user changes in the singleton
    // This fixes the race condition where userId isn't available when enable() is called
    this.userStoreUnsubscribe = useUserStore.subscribe(storeState => {
      const user = storeState.users.find(u => u.selected);
      const newUserId = user?.userId || null;

      // User changed - update connection
      // Note: We track user changes regardless of subscriber count.
      // The cleanup in subscribe() will disconnect if there are no subscribers.
      if (newUserId !== this.currentUserId) {
        this.currentUserId = newUserId;
        // Only connect/disconnect if we have active subscribers
        if (this.subscribers.size > 0) {
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
   * Subscribe to state changes. Returns unsubscribe function.
   */
  subscribe(listener: SSEStateListener): () => void {
    this.subscribers.add(listener);
    // Immediately notify with current state
    listener(this.state);

    return () => {
      this.subscribers.delete(listener);
      // If no more subscribers, disconnect
      if (this.subscribers.size === 0) {
        this.disconnect();
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
   * Notify all subscribers of state change
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(listener => listener(this.state));
  }

  /**
   * Update state and notify subscribers
   */
  private setState(partial: Partial<SSEState>): void {
    this.state = { ...this.state, ...partial };
    this.notifySubscribers();
  }

  /**
   * Enable SSE for a user. Only connects if not already connected for this user.
   */
  enable(userId: string): void {
    // Already connected for this user
    if (this.currentUserId === userId && this.state.connectionState === 'connected') {
      return;
    }

    // Different user - disconnect first
    if (this.currentUserId && this.currentUserId !== userId) {
      this.disconnect();
    }

    this.currentUserId = userId;
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
    if (this.isRefreshingToken) {
      return false;
    }

    this.isRefreshingToken = true;

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
      this.isRefreshingToken = false;
    }
  }

  /**
   * Start heartbeat monitoring interval.
   * Detects stale connections where the server stops sending heartbeats.
   */
  private startHeartbeatMonitor(): void {
    this.stopHeartbeatMonitor();

    // Initialize lastHeartbeat to now
    this.setState({ lastHeartbeat: Date.now() });

    this.heartbeatCheckInterval = setInterval(() => {
      const { lastHeartbeat, connectionState } = this.state;

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
   * Handle incoming activity event
   */
  private handleActivityEvent(data: SSEActivityData): void {
    if (!this.currentUserId) return;

    const { event, activity, timestamp } = data;
    const { upsertEvent } = useActivityStore.getState();

    if (event === 'deleted') {
      const deletedActivity: ActivityEvent = {
        ...activity,
        deleted: true,
        deletedAt: new Date(timestamp).toISOString(),
      };
      upsertEvent(this.currentUserId, deletedActivity);
    } else {
      upsertEvent(this.currentUserId, activity);
    }

    this.setState({ lastEventTime: timestamp });
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

          // Track heartbeats to detect stale connections
          if (parsed?.heartbeat) {
            this.setState({ lastHeartbeat: Date.now() });
            continue;
          }

          if (parsed?.data) {
            // Data events also count as proof of live connection
            this.setState({ lastHeartbeat: Date.now() });
            try {
              const eventData = JSON.parse(parsed.data) as SSEActivityData;
              this.handleActivityEvent(eventData);
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
                return; // Exit the read loop
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
        } catch (e) {
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
      } catch (e) {
        // Reader may already be released or closed, ignore
      }
      this.reader = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.stopHeartbeatMonitor();
    this.setState({ connectionState: 'disconnected', lastHeartbeat: null });
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
  /** Timestamp of last received event */
  lastEventTime: number | null;
  /** Timestamp of last heartbeat (for connection health monitoring) */
  lastHeartbeat: number | null;
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
  const { enabled = true } = options;

  // Local state that syncs with singleton
  const [state, setState] = useState<SSEState>(() => sseManager.getState());

  // Stable callback for state updates to avoid subscription churn
  const handleStateUpdate = useCallback((newState: SSEState) => {
    setState(newState);
  }, []);

  // Subscribe to singleton state changes and handle connection lifecycle
  // Note: User tracking is handled by the singleton's constructor subscription,
  // which fixes the race condition where userId wasn't available on mount.
  useEffect(() => {
    const unsubscribe = sseManager.subscribe(handleStateUpdate);

    // If enabled, trigger connection check
    // The singleton will use its own user tracking to get the userId
    if (enabled) {
      const { users } = useUserStore.getState();
      const currentUser = users.find(user => user.selected);
      if (currentUser?.userId) {
        sseManager.enable(currentUser.userId);
      }
    }

    return unsubscribe;
  }, [enabled, handleStateUpdate]);

  // Memoized callbacks that delegate to singleton
  const disconnect = useCallback(() => {
    sseManager.disconnect();
  }, []);

  const reconnect = useCallback(() => {
    sseManager.reconnect();
  }, []);

  return {
    connectionState: state.connectionState,
    error: state.error,
    disconnect,
    reconnect,
    lastEventTime: state.lastEventTime,
    lastHeartbeat: state.lastHeartbeat,
  };
}
