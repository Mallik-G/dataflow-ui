import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

export interface PresenceUser {
  userId: string;
  userName: string;
  userEmail: string;
  initials: string;
  avatarColor: string;
  joinedAt: string;
  lastSeen: string;
  status: 'viewing' | 'editing';
  currentSection?: string;
}

interface UsePresenceOptions {
  pollInterval?: number; // milliseconds, default 10000
  heartbeatInterval?: number; // milliseconds, default 30000
  enabled?: boolean; // default true
}

interface UsePresenceReturn {
  activeUsers: PresenceUser[];
  isLoading: boolean;
  error: string | null;
  updateStatus: (status: 'viewing' | 'editing', section?: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Custom hook to manage collaborative presence
 *
 * @param entityType - Type of entity (e.g., 'dataflow', 'job', 'pipeline')
 * @param entityId - Unique identifier for the entity
 * @param options - Configuration options
 * @returns Presence state and controls
 */
export const usePresence = (
  entityType: string,
  entityId: string,
  options: UsePresenceOptions = {}
): UsePresenceReturn => {
  const {
    pollInterval = 10000,
    heartbeatInterval = 30000,
    enabled = true,
  } = options;

  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasJoinedRef = useRef(false);

  const apiUrl = import.meta.env.VITE_API_URL || '/api';

  /**
   * Join presence session
   */
  const joinPresence = useCallback(async () => {
    if (!enabled || !entityType || !entityId) return;

    try {
      await axios.post(`${apiUrl}/presence/join`, {
        entityType,
        entityId,
        status: 'viewing',
      });
      hasJoinedRef.current = true;
    } catch (err) {
      console.error('Failed to join presence:', err);
      setError('Failed to join presence session');
    }
  }, [apiUrl, entityType, entityId, enabled]);

  /**
   * Leave presence session
   */
  const leavePresence = useCallback(async () => {
    if (!hasJoinedRef.current) return;

    try {
      await axios.post(`${apiUrl}/presence/leave`, {
        entityType,
        entityId,
      });
      hasJoinedRef.current = false;
    } catch (err) {
      console.error('Failed to leave presence:', err);
    }
  }, [apiUrl, entityType, entityId]);

  /**
   * Send heartbeat to keep session alive
   */
  const sendHeartbeat = useCallback(async () => {
    if (!hasJoinedRef.current) return;

    try {
      await axios.post(`${apiUrl}/presence/heartbeat`, {
        entityType,
        entityId,
      });
    } catch (err) {
      console.error('Failed to send heartbeat:', err);
      // Try to rejoin if heartbeat fails
      await joinPresence();
    }
  }, [apiUrl, entityType, entityId, joinPresence]);

  /**
   * Fetch active users
   */
  const fetchActiveUsers = useCallback(async () => {
    if (!enabled || !entityType || !entityId) return;

    try {
      setIsLoading(true);
      const response = await axios.get(
        `${apiUrl}/presence/${entityType}/${entityId}`
      );
      setActiveUsers(response.data.users || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch active users:', err);
      setError('Failed to fetch active users');
      setActiveUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, entityType, entityId, enabled]);

  /**
   * Update current user's status
   */
  const updateStatus = useCallback(
    async (status: 'viewing' | 'editing', section?: string) => {
      if (!hasJoinedRef.current) return;

      try {
        await axios.post(`${apiUrl}/presence/update`, {
          entityType,
          entityId,
          status,
          currentSection: section,
        });
      } catch (err) {
        console.error('Failed to update status:', err);
      }
    },
    [apiUrl, entityType, entityId]
  );

  // Initialize presence session
  useEffect(() => {
    if (!enabled) return;

    joinPresence();
    fetchActiveUsers();

    return () => {
      leavePresence();
    };
  }, [enabled, joinPresence, fetchActiveUsers, leavePresence]);

  // Set up polling for active users
  useEffect(() => {
    if (!enabled) return;

    pollTimerRef.current = setInterval(fetchActiveUsers, pollInterval);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [enabled, fetchActiveUsers, pollInterval]);

  // Set up heartbeat
  useEffect(() => {
    if (!enabled) return;

    heartbeatTimerRef.current = setInterval(sendHeartbeat, heartbeatInterval);

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
    };
  }, [enabled, sendHeartbeat, heartbeatInterval]);

  return {
    activeUsers,
    isLoading,
    error,
    updateStatus,
    refresh: fetchActiveUsers,
  };
};
