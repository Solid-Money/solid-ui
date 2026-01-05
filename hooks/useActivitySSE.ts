import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

import { getActivityStreamUrl } from '@/lib/api';
import { ActivityEvent, SSEActivityData, SSEConnectionState } from '@/lib/types';
import { useActivityStore } from '@/store/useActivityStore';
import { useUserStore } from '@/store/useUserStore';

// SSE timing constants
const INITIAL_RECONNECT_DELAY_MS = 1000; // 1 second
const MAX_RECONNECT_DELAY_MS = 30000; // 30 seconds
const RECONNECT_MULTIPLIER = 2;
const MAX_CONSECUTIVE_ERRORS = 5; // Stop retrying after 5 consecutive errors

// =============================================================================
// SINGLETON SSE CONNECTION MANAGER
// =============================================================================
// This lives outside React's lifecycle to ensure only ONE connection exists
// per user, regardless of how many components use the hook.

interface SSEState {
  connectionState: SSEConnectionState;
  error: string | null;
  lastEventTime: number | null;
}

type SSEStateListener = (state: SSEState) => void;

class SSEConnectionManager {
  // Connection state
  private state: SSEState = {
    connectionState: 'disconnected',
    error: null,
    lastEventTime: null,
  };

  // Connection management
  private abortController: AbortController | null = null;
  private reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private consecutiveErrors = 0;
  private isConnecting = false;

  // User tracking
  private currentUserId: string | null = null;

  // Subscriber management (reference counting)
  private subscribers = new Set<SSEStateListener>();

  // App state tracking
  private appStateSubscription: { remove: () => void } | null = null;

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
   * Parse SSE line
   */
  private parseSSELine(line: string): { event?: string; data?: string } | null {
    if (!line || line.startsWith(':')) {
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

    if (!this.currentUserId) {
      return;
    }

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

      // Check for 401 first - don't retry auth errors
      if (response.status === 401) {
        this.setState({
          connectionState: 'error',
          error: 'Authentication failed',
        });
        this.isConnecting = false;
        return;
      }

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      // Connection successful - reset backoff
      this.setState({ connectionState: 'connected' });
      this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
      this.consecutiveErrors = 0;
      this.isConnecting = false;

      const decoder = new TextDecoder();
      let buffer = '';

      // Read stream
      while (true) {
        const { done, value } = await reader.read();

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
          if (parsed?.data) {
            try {
              const eventData = JSON.parse(parsed.data) as SSEActivityData;
              this.handleActivityEvent(eventData);
            } catch (parseError) {
              console.error('Failed to parse SSE data:', parseError);
            }
          }
        }
      }
    } catch (err: any) {
      // Don't handle abort errors (intentional disconnect)
      if (err.name === 'AbortError') {
        return;
      }

      console.error('SSE connection error:', err);
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

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.setState({ connectionState: 'disconnected' });
    this.isConnecting = false;
  }

  /**
   * Manual reconnect (resets backoff)
   */
  reconnect(): void {
    this.disconnect();
    this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    this.consecutiveErrors = 0;
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
 */
export function useActivitySSE(options: UseActivitySSEOptions = {}): UseActivitySSEReturn {
  const { enabled = true } = options;

  // Get userId from store directly to avoid unnecessary re-renders
  const userIdRef = useRef<string | null>(null);

  // Local state that syncs with singleton
  const [state, setState] = useState<SSEState>(() => sseManager.getState());

  // Track if this hook instance requested enablement
  const enabledByThisHookRef = useRef(false);

  // Subscribe to singleton state changes
  useEffect(() => {
    const unsubscribe = sseManager.subscribe(setState);
    return unsubscribe;
  }, []);

  // Get current userId
  useEffect(() => {
    const { users } = useUserStore.getState();
    const currentUser = users.find(user => user.selected);
    userIdRef.current = currentUser?.userId || null;

    // Also subscribe to user changes
    const unsubscribe = useUserStore.subscribe(storeState => {
      const user = storeState.users.find(u => u.selected);
      userIdRef.current = user?.userId || null;
    });

    return unsubscribe;
  }, []);

  // Enable/disable based on props
  useEffect(() => {
    const userId = userIdRef.current;

    if (enabled && userId) {
      enabledByThisHookRef.current = true;
      sseManager.enable(userId);
    } else if (enabledByThisHookRef.current) {
      enabledByThisHookRef.current = false;
      // Don't disable - other hook instances might still need it
      // The singleton handles this via subscriber count
    }
  }, [enabled]);

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
  };
}
