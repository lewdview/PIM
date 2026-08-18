import React from 'react';
import { useNotificationStore } from '../store/useNotificationStore';
import { useAuthStore } from '../store/useAuthStore';
import { useLocation } from 'wouter';
import { AlertCircle, X, ChevronRight, Zap } from 'lucide-react';

export const SystemAlertBanner: React.FC = () => {
  const { activeBanner, dismissBanner, markAsRead } = useNotificationStore();
  const user = useAuthStore((s) => s.user);
  const [, setLocation] = useLocation();

  if (!activeBanner) return null;

  const isUrgent = activeBanner.priority === 'urgent';
  const borderColor = isUrgent ? '#ff3800' : '#ff1493';
  const glowColor = isUrgent ? 'rgba(255, 56, 0, 0.4)' : 'rgba(255, 20, 147, 0.35)';

  const handleBannerClick = () => {
    markAsRead(activeBanner.id, user?.id);
    if (activeBanner.action_url) {
      if (activeBanner.action_url.startsWith('http')) {
        window.open(activeBanner.action_url, '_blank', 'noopener,noreferrer');
      } else {
        setLocation(activeBanner.action_url);
      }
    }
  };

  return (
    <aside
      aria-label="System broadcast alert"
      style={{
        position: 'relative',
        zIndex: 900,
        background: 'linear-gradient(90deg, #110408 0%, #1a0814 50%, #110408 100%)',
        borderBottom: `1px solid ${borderColor}`,
        boxShadow: `0 2px 14px ${glowColor}`,
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        animation: 'slideDown 0.25s ease-out',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flex: 1,
          cursor: activeBanner.action_url ? 'pointer' : 'default',
          overflow: 'hidden',
        }}
        onClick={handleBannerClick}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: borderColor,
            animation: isUrgent ? 'pulse 1.2s infinite ease-in-out' : 'none',
          }}
        >
          {isUrgent ? <AlertCircle size={16} /> : <Zap size={16} />}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <span
            style={{
              fontFamily: '"Outfit", sans-serif',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#fff',
              whiteSpace: 'nowrap',
            }}
          >
            {activeBanner.title}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>
          <span
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '10px',
              color: 'rgba(255, 255, 255, 0.8)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {activeBanner.message}
          </span>
        </div>

        {activeBanner.action_label && (
          <span
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '9px',
              fontWeight: 800,
              color: borderColor,
              background: `${borderColor}20`,
              border: `1px solid ${borderColor}50`,
              padding: '2px 8px',
              borderRadius: '2px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              whiteSpace: 'nowrap',
              marginLeft: '8px',
            }}
          >
            {activeBanner.action_label}
            <ChevronRight size={10} />
          </span>
        )}
      </div>

      <button
        onClick={() => dismissBanner(activeBanner.id)}
        aria-label="Dismiss transmission alert"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255, 255, 255, 0.4)',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.15s',
          marginLeft: '12px',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)')}
      >
        <X size={14} />
      </button>
    </aside>
  );
};
