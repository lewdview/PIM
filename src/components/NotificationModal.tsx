import React, { useState } from 'react';
import { useNotificationStore, type AnnouncementCategory, type SystemAnnouncement } from '../store/useNotificationStore';
import { useAuthStore } from '../store/useAuthStore';
import { useLocation } from 'wouter';
import {
  Bell,
  X,
  CheckCheck,
  ExternalLink,
  Flame,
  Radio,
  Gift,
  Wrench,
  Sparkles,
  Info,
  Trash2,
  Calendar,
} from 'lucide-react';

const CATEGORY_META: Record<AnnouncementCategory, { label: string; color: string; icon: React.ComponentType<{ size: number; color?: string }> }> = {
  drop: { label: 'DAILY DROP', color: '#ff1493', icon: Flame },
  event: { label: 'LIVE EVENT', color: '#00e5ff', icon: Radio },
  reward: { label: 'REWARD', color: '#e5b800', icon: Gift },
  maintenance: { label: 'MAINTENANCE', color: '#ff5500', icon: Wrench },
  update: { label: 'SYSTEM UPDATE', color: '#39ff14', icon: Sparkles },
  general: { label: 'ANNOUNCEMENT', color: '#a855f7', icon: Info },
};

const PRIORITY_BADGES: Record<string, { label: string; color: string; border: string; bg: string }> = {
  urgent: { label: 'URGENT', color: '#ff3800', border: 'rgba(255, 56, 0, 0.6)', bg: 'rgba(255, 56, 0, 0.15)' },
  high: { label: 'PRIORITY', color: '#ffb800', border: 'rgba(255, 184, 0, 0.5)', bg: 'rgba(255, 184, 0, 0.12)' },
  normal: { label: 'STANDARD', color: '#00e5ff', border: 'rgba(0, 229, 255, 0.3)', bg: 'rgba(0, 229, 255, 0.08)' },
  low: { label: 'INFO', color: '#7a8090', border: 'rgba(255, 255, 255, 0.15)', bg: 'rgba(255, 255, 255, 0.04)' },
};

export const NotificationModal: React.FC = () => {
  const {
    isOpen,
    setIsOpen,
    announcements,
    readIds,
    markAsRead,
    markAllAsRead,
    dismissAnnouncement,
    unreadCount,
  } = useNotificationStore();

  const user = useAuthStore((s) => s.user);
  const [, setLocation] = useLocation();
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'drops' | 'rewards'>('all');

  if (!isOpen) return null;

  const filteredAnnouncements = announcements.filter((a) => {
    if (activeFilter === 'unread') return !readIds.has(a.id);
    if (activeFilter === 'drops') return a.category === 'drop' || a.category === 'event';
    if (activeFilter === 'rewards') return a.category === 'reward' || a.category === 'update';
    return true;
  });

  const handleActionClick = (announcement: SystemAnnouncement) => {
    markAsRead(announcement.id, user?.id);
    if (announcement.action_url) {
      if (announcement.action_url.startsWith('http')) {
        window.open(announcement.action_url, '_blank', 'noopener,noreferrer');
      } else {
        setIsOpen(false);
        setLocation(announcement.action_url);
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(16px)',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={() => setIsOpen(false)}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '85vh',
          background: '#0c0c14',
          border: '1px solid rgba(255, 20, 147, 0.35)',
          boxShadow: '0 0 40px rgba(0, 0, 0, 0.9), 0 0 20px rgba(255, 20, 147, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: '4px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(255, 20, 147, 0.08) 0%, transparent 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '2px',
                background: 'rgba(255, 20, 147, 0.15)',
                border: '1px solid #ff1493',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 12px rgba(255, 20, 147, 0.3)',
              }}
            >
              <Bell size={18} color="#ff1493" />
            </div>
            <div>
              <div
                style={{
                  fontFamily: '"Outfit", sans-serif',
                  fontSize: '16px',
                  fontWeight: 800,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                SYSTEM TRANSMISSIONS
                {unreadCount > 0 && (
                  <span
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '10px',
                      background: '#ff1493',
                      color: '#000',
                      padding: '2px 6px',
                      fontWeight: 800,
                      borderRadius: '2px',
                    }}
                  >
                    {unreadCount} NEW
                  </span>
                )}
              </div>
              <div
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '10px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  letterSpacing: '0.05em',
                  marginTop: '2px',
                }}
              >
                PIM BROADCAST NETWORK // DISPATCH LOG
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead(user?.id)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(0, 229, 255, 0.3)',
                  color: '#00e5ff',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 229, 255, 0.12)';
                  e.currentTarget.style.borderColor = '#00e5ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.3)';
                }}
              >
                <CheckCheck size={12} />
                MARK ALL READ
              </button>
            )}

            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.6)',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)')}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filter Navigation */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            gap: '8px',
            background: '#08080c',
          }}
        >
          {([
            { key: 'all', label: `ALL (${announcements.length})` },
            { key: 'unread', label: `UNREAD (${unreadCount})` },
            { key: 'drops', label: 'DROPS & EVENTS' },
            { key: 'rewards', label: 'REWARDS & UPDATES' },
          ] as const).map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              style={{
                background: activeFilter === filter.key ? 'rgba(255, 20, 147, 0.15)' : 'transparent',
                border: `1px solid ${activeFilter === filter.key ? '#ff1493' : 'rgba(255, 255, 255, 0.08)'}`,
                color: activeFilter === filter.key ? '#ff1493' : 'rgba(255, 255, 255, 0.6)',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                padding: '6px 12px',
                cursor: 'pointer',
                borderRadius: '2px',
                transition: 'all 0.15s',
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Transmission Feed */}
        <div
          style={{
            padding: '16px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {filteredAnnouncements.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 24px',
                color: 'rgba(255, 255, 255, 0.4)',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '12px',
              }}
            >
              <Bell size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              NO TRANSMISSIONS LOGGED IN THIS FREQUENCY
            </div>
          ) : (
            filteredAnnouncements.map((a) => {
              const isRead = readIds.has(a.id);
              const catMeta = CATEGORY_META[a.category] || CATEGORY_META.general;
              const IconComp = catMeta.icon;
              const prioBadge = PRIORITY_BADGES[a.priority] || PRIORITY_BADGES.normal;
              const dateStr = new Date(a.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={a.id}
                  style={{
                    background: isRead ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 20, 147, 0.04)',
                    border: `1px solid ${isRead ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 20, 147, 0.35)'}`,
                    borderLeft: `4px solid ${isRead ? 'rgba(255, 255, 255, 0.2)' : catMeta.color}`,
                    padding: '16px 18px',
                    borderRadius: '2px',
                    position: 'relative',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => !isRead && markAsRead(a.id, user?.id)}
                >
                  {/* Top line: Category + Priority + Date */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '9px',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          color: catMeta.color,
                          background: `${catMeta.color}15`,
                          padding: '2px 6px',
                          borderRadius: '2px',
                          border: `1px solid ${catMeta.color}35`,
                        }}
                      >
                        <IconComp size={10} />
                        {catMeta.label}
                      </span>

                      {a.priority !== 'normal' && (
                        <span
                          style={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '9px',
                            fontWeight: 800,
                            letterSpacing: '0.08em',
                            color: prioBadge.color,
                            background: prioBadge.bg,
                            border: `1px solid ${prioBadge.border}`,
                            padding: '2px 6px',
                            borderRadius: '2px',
                          }}
                        >
                          {prioBadge.label}
                        </span>
                      )}

                      {!isRead && (
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#ff1493',
                            boxShadow: '0 0 6px #ff1493',
                            display: 'inline-block',
                          }}
                        />
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '9px',
                        color: 'rgba(255, 255, 255, 0.4)',
                      }}
                    >
                      <Calendar size={10} />
                      {dateStr}
                    </div>
                  </div>

                  {/* Title */}
                  <h3
                    style={{
                      fontFamily: '"Outfit", sans-serif',
                      fontSize: '15px',
                      fontWeight: 800,
                      letterSpacing: '0.05em',
                      color: isRead ? 'rgba(255, 255, 255, 0.9)' : '#fff',
                      margin: '0 0 6px 0',
                    }}
                  >
                    {a.title}
                  </h3>

                  {/* Body message */}
                  <p
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '11px',
                      lineHeight: '1.6',
                      color: isRead ? 'rgba(255, 255, 255, 0.65)' : 'rgba(255, 255, 255, 0.85)',
                      margin: '0 0 14px 0',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {a.message}
                  </p>

                  {/* Action & Dismiss Footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                      paddingTop: '12px',
                    }}
                  >
                    {a.action_url ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleActionClick(a);
                        }}
                        style={{
                          background: '#ff1493',
                          border: 'none',
                          color: '#000',
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '10px',
                          fontWeight: 800,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          padding: '8px 16px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)',
                          boxShadow: '0 0 10px rgba(255, 20, 147, 0.3)',
                          transition: 'transform 0.1s, box-shadow 0.1s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 0 16px rgba(255, 20, 147, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 0 10px rgba(255, 20, 147, 0.3)';
                        }}
                      >
                        {a.action_label || 'OPEN'}
                        <ExternalLink size={11} />
                      </button>
                    ) : <div />}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissAnnouncement(a.id, user?.id);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.35)',
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '9px',
                        letterSpacing: '0.05em',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ff3800')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.35)')}
                    >
                      <Trash2 size={10} />
                      DISMISS
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
