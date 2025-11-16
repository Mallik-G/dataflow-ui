/**
 * Presence API Routes
 * Handles collaborative editing presence tracking
 */

const express = require('express');
const router = express.Router();

// In-memory store for presence data
// In production, use Redis for better performance and persistence
const presenceStore = new Map();

// Cleanup interval - remove stale presence entries
const CLEANUP_INTERVAL = 60000; // 1 minute
const PRESENCE_TTL = 120000; // 2 minutes

// Helper function to get presence key
const getPresenceKey = (entityType, entityId) => `${entityType}:${entityId}`;

// Helper function to get user from request (placeholder - integrate with your auth)
const getCurrentUser = (req) => {
  // TODO: Replace with actual auth user extraction
  // This is a placeholder that uses session or header data
  return {
    userId: req.user?.id || req.headers['x-user-id'] || 'anonymous',
    userName: req.user?.name || req.headers['x-user-name'] || 'Anonymous User',
    userEmail: req.user?.email || req.headers['x-user-email'] || 'anonymous@example.com',
  };
};

// Cleanup stale presence entries
setInterval(() => {
  const now = Date.now();
  for (const [key, users] of presenceStore.entries()) {
    const activeUsers = Array.from(users.values()).filter(
      user => now - new Date(user.lastSeen).getTime() < PRESENCE_TTL
    );

    if (activeUsers.length === 0) {
      presenceStore.delete(key);
    } else {
      presenceStore.set(key, new Map(activeUsers.map(u => [u.userId, u])));
    }
  }
}, CLEANUP_INTERVAL);

/**
 * POST /api/presence/join
 * Join a presence session
 */
router.post('/join', (req, res) => {
  try {
    const { entityType, entityId, status = 'viewing', currentSection } = req.body;

    if (!entityType || !entityId) {
      return res.status(400).json({
        success: false,
        error: 'entityType and entityId are required',
      });
    }

    const user = getCurrentUser(req);
    const key = getPresenceKey(entityType, entityId);

    // Get or create presence map for this entity
    if (!presenceStore.has(key)) {
      presenceStore.set(key, new Map());
    }

    const presenceMap = presenceStore.get(key);
    const now = new Date().toISOString();

    // Check if user is already in the session
    const existingUser = presenceMap.get(user.userId);
    const joinedAt = existingUser?.joinedAt || now;

    // Add or update user presence
    presenceMap.set(user.userId, {
      userId: user.userId,
      userName: user.userName,
      userEmail: user.userEmail,
      initials: getInitials(user.userName),
      avatarColor: getAvatarColor(user.userId),
      joinedAt,
      lastSeen: now,
      status,
      currentSection,
    });

    res.json({
      success: true,
      message: 'Joined presence session',
    });
  } catch (error) {
    console.error('Error joining presence:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/presence/leave
 * Leave a presence session
 */
router.post('/leave', (req, res) => {
  try {
    const { entityType, entityId } = req.body;

    if (!entityType || !entityId) {
      return res.status(400).json({
        success: false,
        error: 'entityType and entityId are required',
      });
    }

    const user = getCurrentUser(req);
    const key = getPresenceKey(entityType, entityId);

    if (presenceStore.has(key)) {
      const presenceMap = presenceStore.get(key);
      presenceMap.delete(user.userId);

      // Clean up empty maps
      if (presenceMap.size === 0) {
        presenceStore.delete(key);
      }
    }

    res.json({
      success: true,
      message: 'Left presence session',
    });
  } catch (error) {
    console.error('Error leaving presence:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/presence/heartbeat
 * Update last seen timestamp (keep session alive)
 */
router.post('/heartbeat', (req, res) => {
  try {
    const { entityType, entityId } = req.body;

    if (!entityType || !entityId) {
      return res.status(400).json({
        success: false,
        error: 'entityType and entityId are required',
      });
    }

    const user = getCurrentUser(req);
    const key = getPresenceKey(entityType, entityId);

    if (presenceStore.has(key)) {
      const presenceMap = presenceStore.get(key);
      const existingUser = presenceMap.get(user.userId);

      if (existingUser) {
        existingUser.lastSeen = new Date().toISOString();
        presenceMap.set(user.userId, existingUser);
      }
    }

    res.json({
      success: true,
      message: 'Heartbeat received',
    });
  } catch (error) {
    console.error('Error updating heartbeat:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/presence/update
 * Update user's presence status (viewing/editing, current section)
 */
router.post('/update', (req, res) => {
  try {
    const { entityType, entityId, status, currentSection } = req.body;

    if (!entityType || !entityId) {
      return res.status(400).json({
        success: false,
        error: 'entityType and entityId are required',
      });
    }

    const user = getCurrentUser(req);
    const key = getPresenceKey(entityType, entityId);

    if (presenceStore.has(key)) {
      const presenceMap = presenceStore.get(key);
      const existingUser = presenceMap.get(user.userId);

      if (existingUser) {
        existingUser.status = status || existingUser.status;
        existingUser.currentSection = currentSection;
        existingUser.lastSeen = new Date().toISOString();
        presenceMap.set(user.userId, existingUser);
      }
    }

    res.json({
      success: true,
      message: 'Presence updated',
    });
  } catch (error) {
    console.error('Error updating presence:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/presence/:entityType/:entityId
 * Get active users for an entity
 */
router.get('/:entityType/:entityId', (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const key = getPresenceKey(entityType, entityId);

    const users = presenceStore.has(key)
      ? Array.from(presenceStore.get(key).values())
      : [];

    // Filter out stale entries
    const now = Date.now();
    const activeUsers = users.filter(
      user => now - new Date(user.lastSeen).getTime() < PRESENCE_TTL
    );

    res.json({
      success: true,
      users: activeUsers,
      count: activeUsers.length,
    });
  } catch (error) {
    console.error('Error fetching presence:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      users: [],
      count: 0,
    });
  }
});

// Helper functions
function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(userId) {
  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#06b6d4',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

module.exports = router;
