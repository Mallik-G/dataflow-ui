/**
 * Utility functions for presence features
 */

/**
 * Generate initials from a user's name
 * @param name - User's full name
 * @returns 2-character initials
 */
export const getInitials = (name: string): string => {
  if (!name) return '??';

  const parts = name.trim().split(' ').filter(Boolean);

  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();

  // First and last name initials
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Generate a consistent color for a user based on their ID
 * @param userId - Unique user identifier
 * @returns Hex color code
 */
export const getAvatarColor = (userId: string): string => {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
    '#6366f1', // indigo
    '#06b6d4', // cyan
  ];

  // Simple hash function to get consistent color per user
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

/**
 * Format time ago display
 * @param timestamp - ISO timestamp string
 * @returns Human-readable time ago string
 */
export const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const past = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
};
