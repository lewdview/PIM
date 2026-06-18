import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../services/supabaseClient';
import {
  Fingerprint, RefreshCw, LogOut, Layers, ArrowUpRight,
  Shield, Zap, User, ExternalLink, Wallet,
} from 'lucide-react';

function shortenAddress(addr: string) {
  if (addr.startsWith('0x') && addr.length === 42) {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }
  return addr;
}

function providerLabel(p: string | undefined): string {
  if (!p) return 'Unknown';
  if (p === 'email') return 'Magic Link';
  if (p === 'github') return 'GitHub OAuth';
  if (p === 'anonymous') return 'Guest Wallet';
  return p.charAt(0).toUpperCase() + p.slice(1);
}

const ECOSYSTEM_NODES = [
  { label: 'th3scr1b3.art', desc: '365 Warp — Main Hub', url: 'https://th3scr1b3.art' },
  { label: 'user.th3scr1b3.art', desc: 'Identity Hub', url: 'https://user.th3scr1b3.art' },
  { label: 'video.th3scr1b3.art', desc: '365 Poster — Visual Archive', url: 'https://video.th3scr1b3.art' },
  { label: 'Mood Map', desc: 'Interactive mood map on th3scr1b3.art', url: 'https://th3scr1b3.art/mood-map' },
  { label: 'ce.th3scr1b3.art', desc: 'Song Analyzer — CE', url: 'https://ce.th3scr1b3.art' },
];

export default function ProfilePage() {
  const { user, isAnonymous, signOut } = useAuthStore();
  const [, navigate] = useLocation();
  const [displayName, setDisplayName] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!user) { setLoadingProfile(false); return; }
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
        setLoadingProfile(false);
      });
  }, [user]);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://pim.th3scr1b3.art';
  const syncHref = `https://user.th3scr1b3.art?redirect_uri=${encodeURIComponent(`${origin}/profile`)}`;

  const provider = user?.app_metadata?.provider as string | undefined;
  const walletAddr = user?.user_metadata?.wallet as string | undefined;
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const identityDisplay = displayName
    || (walletAddr ? shortenAddress(walletAddr) : '')
    || user?.email?.split('@')[0]
    || user?.id?.slice(0, 12)
    || 'ANONYMOUS';

  /* ── styles ── */
  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    border: '1.5px solid rgba(255,255,255,0.08)',
    padding: '24px',
    marginBottom: '16px',
  };
  const cardTitle: React.CSSProperties = {
    fontSize: '9px', fontWeight: 700, letterSpacing: '0.25em',
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)',
    marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px',
  };
  const stat: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
  };
  const statLabel: React.CSSProperties = {
    fontSize: '9px', color: 'rgba(255,255,255,0.4)',
    letterSpacing: '0.15em', textTransform: 'uppercase',
  };
  const statValue: React.CSSProperties = {
    fontSize: '11px', fontWeight: 700, color: '#fff',
    textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all',
  };
  const syncBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '10px',
    padding: '12px 22px',
    background: '#ff3800', border: '2px solid #000',
    boxShadow: '4px 4px 0 #000, 0 0 20px rgba(255,56,0,0.35)',
    color: '#fff',
    fontFamily: '"Impact","Arial Black",sans-serif', fontSize: '17px',
    fontWeight: 900, textTransform: 'uppercase', textDecoration: 'none',
    cursor: 'pointer', transform: 'rotate(-0.4deg)',
  };
  const ghostBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '10px 16px',
    background: 'transparent', border: '1.5px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.55)',
    fontFamily: '"JetBrains Mono",monospace', fontSize: '10px',
    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
    textDecoration: 'none', cursor: 'pointer',
  };
  const actionRow: React.CSSProperties = {
    display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '20px', alignItems: 'center',
  };

  /* ── no session ── */
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', padding: '80px 16px 48px', fontFamily: '"JetBrains Mono",monospace' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
            <Fingerprint size={40} style={{ color: '#ff3800', margin: '0 auto 16px', display: 'block' }} />
            <div style={{ fontFamily: '"Impact","Arial Black",sans-serif', fontSize: '32px', fontWeight: 900, color: '#fff', textTransform: 'uppercase', marginBottom: '8px' }}>
              No Session
            </div>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '24px' }}>
              Connect a wallet or sign in to view your profile
            </p>
            <a href={syncHref} style={{ ...syncBtn, transform: 'none' }}>
              <Wallet size={16} /> Connect Identity
            </a>
          </div>
        </div>
      </div>
    );
  }

  /* ── guest / anonymous ── */
  if (isAnonymous) {
    return (
      <div style={{ minHeight: '100vh', padding: '80px 16px 48px', fontFamily: '"JetBrains Mono",monospace' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
            <Fingerprint size={32} style={{ color: '#ffb800', flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: '"Impact","Arial Black",sans-serif', fontSize: '36px', fontWeight: 900, color: '#fff', textTransform: 'uppercase', lineHeight: 1 }}>Guest Wallet</div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.25em', textTransform: 'uppercase', marginTop: '4px' }}>Ephemeral session — not persisted</div>
            </div>
          </div>
          <div style={{ ...card, border: '2px solid rgba(255,184,0,0.25)' }}>
            <div style={cardTitle}><Shield size={12} /> Session Status</div>
            <div style={stat}><span style={statLabel}>Identity</span><span style={{ ...statValue, color: '#ffb800' }}>GUEST</span></div>
            <div style={stat}><span style={statLabel}>Session ID</span><span style={{ ...statValue, fontSize: '9px', opacity: 0.5 }}>{user.id.slice(0, 16)}…</span></div>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '16px', lineHeight: 1.7 }}>
              Your guest session lets you play and explore PIM. Connect a wallet, GitHub, or email to permanently save your scores, cards, and progress.
            </p>
            <div style={actionRow}>
              <a href={syncHref} style={syncBtn}><ArrowUpRight size={18} /> Upgrade to Full Identity</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── authenticated ── */
  return (
    <div style={{ minHeight: '100vh', padding: '80px 16px 48px', fontFamily: '"JetBrains Mono",monospace' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
          {avatarUrl
            ? <img src={avatarUrl} alt="avatar" style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid #ff3800', objectFit: 'cover' }} />
            : <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)', background: '#1a1610', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={24} style={{ color: 'rgba(255,255,255,0.3)' }} /></div>
          }
          <div>
            <div style={{ fontFamily: '"Impact","Arial Black",sans-serif', fontSize: 'clamp(26px,5vw,40px)', fontWeight: 900, color: '#fff', textTransform: 'uppercase', lineHeight: 1 }}>
              {loadingProfile ? '…' : identityDisplay}
            </div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.25em', textTransform: 'uppercase', marginTop: '4px' }}>
              Authenticated Scribe Identity
            </div>
          </div>
        </div>

        {/* Identity card */}
        <div style={card}>
          <div style={cardTitle}><Fingerprint size={12} /> Identity Matrix</div>
          {displayName && <div style={stat}><span style={statLabel}>Alias</span><span style={statValue}>{displayName}</span></div>}
          {user.email && <div style={stat}><span style={statLabel}>Email</span><span style={statValue}>{user.email}</span></div>}
          {walletAddr && <div style={stat}><span style={statLabel}>Wallet</span><span style={{ ...statValue, color: '#00e5ff', fontFamily: 'monospace' }}>{walletAddr}</span></div>}
          <div style={stat}><span style={statLabel}>Provider</span><span style={statValue}>{providerLabel(provider)}</span></div>
          <div style={{ ...stat, borderBottom: 'none' }}><span style={statLabel}>User ID</span><span style={{ ...statValue, fontSize: '9px', opacity: 0.5 }}>{user.id}</span></div>

          <div style={actionRow}>
            <a href={syncHref} style={syncBtn} title="Manage identity, link wallets, update alias on user hub">
              <RefreshCw size={15} /> Sync Identity <ExternalLink size={13} style={{ opacity: 0.7 }} />
            </a>
            <Link to={`/vault/${user.id}`} style={ghostBtn}><Layers size={12} /> My Collection</Link>
            <button onClick={() => { signOut(); navigate('/'); }} style={ghostBtn} title="Sign out">
              <LogOut size={12} /> Sign Out
            </button>
          </div>
        </div>

        {/* Ecosystem nodes */}
        <div style={card}>
          <div style={cardTitle}><Zap size={12} /> Ecosystem Nodes</div>
          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '16px', lineHeight: 1.7 }}>
            Your identity is synchronized across all th3scr1b3 subdomains — your session travels with you.
          </p>
          {ECOSYSTEM_NODES.map(({ label, desc, url }) => (
            <div key={url} style={stat}>
              <div>
                <div style={{ ...statLabel, marginBottom: '2px' }}>{label}</div>
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.25)' }}>{desc}</div>
              </div>
              <a href={url} style={{ fontSize: '9px', color: '#ff3800', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                Visit <ExternalLink size={10} />
              </a>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
