import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { colors, borderRadius } from '../../theme/colors';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { path: '/', icon: '🏠', label: 'Dashboard' },
    { path: '/canvas', icon: '🎨', label: 'Canvas' },
    { path: '/observe', icon: '👁️', label: 'Observe' },
    { path: '/deploy', icon: '🚀', label: 'Deploy' },
    { path: '/connections', icon: '🔌', label: 'Connections' },
    { path: '/glossary', icon: '📚', label: 'Glossary' },
    { path: '/settings', icon: '⚙️', label: 'Settings' },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div
        style={{
          width: isCollapsed ? '72px' : '240px',
          backgroundColor: colors.background.secondary,
          borderRight: `1px solid ${colors.border.main}`,
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.3s ease',
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: isCollapsed ? '24px 12px' : '24px 20px',
            borderBottom: `1px solid ${colors.border.main}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '88px',
          }}
        >
          {isCollapsed ? (
            <div
              style={{
                fontSize: '24px',
              }}
            >
              ⚡
            </div>
          ) : (
            <div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: colors.primary.main,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '24px' }}>⚡</span>
                <span>DataFlow UI</span>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: colors.text.muted,
                  marginTop: '4px',
                  marginLeft: '34px',
                }}
              >
                Zero-Touch Data Engineering
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              title={isCollapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                gap: '12px',
                padding: isCollapsed ? '12px 0' : '12px 16px',
                marginBottom: '4px',
                borderRadius: borderRadius.md,
                textDecoration: 'none',
                color: isActive(item.path)
                  ? colors.primary.main
                  : colors.text.primary,
                backgroundColor: isActive(item.path)
                  ? colors.primary.lighter
                  : 'transparent',
                fontWeight: isActive(item.path) ? '600' : '500',
                fontSize: '14px',
                transition: 'all 0.15s ease',
                border: isActive(item.path)
                  ? `1px solid ${colors.primary.main}`
                  : '1px solid transparent',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isActive(item.path)) {
                  e.currentTarget.style.backgroundColor = colors.background.hover;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive(item.path)) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Toggle Button */}
        <div
          style={{
            padding: '12px',
            borderTop: `1px solid ${colors.border.main}`,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              width: isCollapsed ? '40px' : '100%',
              padding: '8px',
              border: `1px solid ${colors.border.main}`,
              borderRadius: borderRadius.md,
              backgroundColor: colors.background.tertiary,
              color: colors.text.secondary,
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.background.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.background.tertiary;
            }}
          >
            <span style={{ fontSize: '16px' }}>{isCollapsed ? '→' : '←'}</span>
            {!isCollapsed && <span style={{ fontSize: '12px', fontWeight: '600' }}>Collapse</span>}
          </button>
        </div>

        {/* Footer */}
        {!isCollapsed && (
          <div
            style={{
              padding: '16px',
              borderTop: `1px solid ${colors.border.main}`,
              fontSize: '11px',
              color: colors.text.muted,
            }}
          >
            <div>v1.0.0</div>
            <div style={{ marginTop: '4px' }}>© 2024 DataFlow UI</div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default Layout;
