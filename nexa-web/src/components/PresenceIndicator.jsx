import React, { useState } from 'react';
import { OverlayTrigger, Tooltip, Badge } from 'react-bootstrap';
import { BiUser, BiCircle } from 'react-icons/bi';
import { getInitials, getAvatarColor, formatTimeAgo } from '../utils/presenceUtils';

/**
 * Single user avatar component
 */
const UserAvatar = ({ user, onClick }) => {
  const initials = user.initials || getInitials(user.userName);
  const avatarColor = user.avatarColor || getAvatarColor(user.userId);
  const isEditing = user.status === 'editing';

  const tooltip = (
    <Tooltip>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
          {user.userName}
        </div>
        <div style={{ fontSize: '12px', marginBottom: '4px' }}>
          {user.userEmail}
        </div>
        <div style={{ fontSize: '11px', color: '#ccc', marginBottom: '8px' }}>
          {user.status === 'viewing' ? 'Viewing' : 'Editing'}
          {user.currentSection && ` • ${user.currentSection}`}
        </div>
        <div style={{ fontSize: '11px', color: '#999' }}>
          Joined {formatTimeAgo(user.joinedAt)}
        </div>
      </div>
    </Tooltip>
  );

  return (
    <OverlayTrigger placement="bottom" overlay={tooltip}>
      <div
        onClick={() => onClick && onClick(user)}
        style={{
          position: 'relative',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: avatarColor,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '600',
          fontSize: '13px',
          cursor: onClick ? 'pointer' : 'default',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'transform 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (onClick) e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          if (onClick) e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {initials}
        {isEditing && (
          <div
            style={{
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              border: '2px solid white',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
        )}
      </div>
    </OverlayTrigger>
  );
};

/**
 * Presence indicator component showing active users
 */
const PresenceIndicator = ({
  activeUsers = [],
  currentUserId,
  maxVisible = 5,
  onUserClick,
  showCount = true,
  style = {},
}) => {
  // Filter out current user
  const otherUsers = activeUsers.filter(u => u.userId !== currentUserId);

  if (otherUsers.length === 0) {
    return null;
  }

  const visibleUsers = otherUsers.slice(0, maxVisible);
  const hiddenCount = Math.max(0, otherUsers.length - maxVisible);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        ...style,
      }}
    >
      {showCount && otherUsers.length > 0 && (
        <div style={{ fontSize: '13px', color: '#666', fontWeight: '500' }}>
          <BiUser style={{ marginRight: '4px', marginBottom: '2px' }} />
          {otherUsers.length} {otherUsers.length === 1 ? 'person' : 'people'} viewing
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '-8px' }}>
        {visibleUsers.map((user, index) => (
          <div
            key={user.userId}
            style={{
              marginLeft: index > 0 ? '-8px' : '0',
              zIndex: visibleUsers.length - index,
            }}
          >
            <UserAvatar user={user} onClick={onUserClick} />
          </div>
        ))}

        {hiddenCount > 0 && (
          <OverlayTrigger
            placement="bottom"
            overlay={
              <Tooltip>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {hiddenCount} more {hiddenCount === 1 ? 'person' : 'people'}
                  </div>
                  {otherUsers.slice(maxVisible).map(user => (
                    <div key={user.userId} style={{ fontSize: '12px', marginBottom: '2px' }}>
                      {user.userName}
                    </div>
                  ))}
                </div>
              </Tooltip>
            }
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#6b7280',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600',
                fontSize: '12px',
                border: '2px solid white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                marginLeft: '-8px',
                cursor: 'default',
              }}
            >
              +{hiddenCount}
            </div>
          </OverlayTrigger>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
};

export default PresenceIndicator;
