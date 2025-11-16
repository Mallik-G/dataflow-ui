import React from 'react';
import { Alert, Button } from 'react-bootstrap';
import { BiInfoCircle, BiRefresh, BiLock } from 'react-icons/bi';

/**
 * Banner to warn users about collaborative editing conflicts
 */
const CollaborationBanner = ({
  activeUsers = [],
  currentUserId,
  lastSavedBy,
  lastSavedAt,
  onRefresh,
  onContactUser,
  variant = 'warning',
  style = {},
}) => {
  // Filter out current user
  const otherUsers = activeUsers.filter(u => u.userId !== currentUserId);
  const editingUsers = otherUsers.filter(u => u.status === 'editing');

  // Don't show if no other users or only viewers
  if (editingUsers.length === 0) {
    return null;
  }

  const userNames = editingUsers.map(u => u.userName).join(', ');
  const multipleUsers = editingUsers.length > 1;

  return (
    <Alert
      variant={variant}
      style={{
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...style,
      }}
      className="d-flex align-items-center"
    >
      <div className="d-flex align-items-start flex-grow-1">
        <BiInfoCircle size={20} style={{ marginRight: '12px', marginTop: '2px', flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: '600', marginBottom: '4px' }}>
            {multipleUsers ? 'Multiple users are' : `${userNames} is`} editing this flow
          </div>
          <div style={{ fontSize: '13px' }}>
            {multipleUsers
              ? `${userNames} are currently making changes. Your edits may conflict with theirs.`
              : `${userNames} is currently making changes. Your edits may conflict.`}
            {lastSavedBy && lastSavedAt && (
              <span className="ms-2">
                Last saved by {lastSavedBy} at {new Date(lastSavedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="d-flex gap-2 ms-3" style={{ flexShrink: 0 }}>
        {onRefresh && (
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={onRefresh}
            className="d-flex align-items-center gap-1"
          >
            <BiRefresh size={16} />
            Refresh
          </Button>
        )}
        {onContactUser && editingUsers.length === 1 && (
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => onContactUser(editingUsers[0])}
            className="d-flex align-items-center gap-1"
          >
            Contact {editingUsers[0].userName.split(' ')[0]}
          </Button>
        )}
      </div>
    </Alert>
  );
};

export default CollaborationBanner;
