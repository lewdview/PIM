import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
  className?: string;
}

/**
 * 📡 TRANSMISSION INCOMING ICON
 * High-tech Satellite Antenna Vector with glowing pulse waves
 */
export const TransmissionIcon: React.FC<IconProps> = ({
  size = 24,
  color = 'currentColor',
  className = '',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Base Pedestal */}
    <path d="M12 18v3m-4 0h8" />
    {/* Antenna Dish */}
    <path d="M4.5 12.5a8 8 0 0 0 15 0L12 6.5l-7.5 6z" fill="rgba(0,229,255,0.15)" />
    {/* Emitter Tip */}
    <circle cx="12" cy="6.5" r="1.5" fill={color} />
    {/* Radio Wave Pulses */}
    <path d="M7 4.5a7 7 0 0 1 10 0" opacity="0.85" />
    <path d="M4 2a11 11 0 0 1 16 0" opacity="0.5" />
  </svg>
);

/**
 * ⚠ HAZARD WARNING OCTAGON ICON
 * Spiked Octagonal Danger Warning Emblem
 */
export const HazardWarningIcon: React.FC<IconProps> = ({
  size = 24,
  color = '#FF003C',
  className = '',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Spiked Octagon Outer Ring */}
    <polygon
      points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"
      fill="rgba(255,0,60,0.12)"
    />
    {/* Warning Exclamation Mark */}
    <line x1="12" y1="7" x2="12" y2="13" strokeWidth="2.5" />
    <circle cx="12" cy="17" r="1.25" fill={color} />
  </svg>
);

/**
 * 👻 GHOST NOTE PHANTOM ICON
 * Neon Phantom Spirit Outline
 */
export const GhostIcon: React.FC<IconProps> = ({
  size = 24,
  color = '#94A3B8',
  className = '',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path
      d="M9 10h.01M15 10h.01M12 2a7 7 0 0 0-7 7v11l3-2 4 2 4-2 3 2V9a7 7 0 0 0-7-7z"
      fill="rgba(148,163,184,0.15)"
    />
  </svg>
);

/**
 * 🎛 REMIX STEM EQUALIZER DIAL ICON
 */
export const RemixDialIcon: React.FC<IconProps> = ({
  size = 24,
  color = '#00F5D4',
  className = '',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <circle cx="12" cy="12" r="9" fill="rgba(0,245,212,0.1)" />
    <path d="M12 12L16 8" strokeWidth="2.5" />
    <path d="M8 12h.01M12 16h.01M16 12h.01" />
  </svg>
);

/**
 * ⚡ HIGH-VOLTAGE V⚡ TOKEN ICON
 */
export const VTokenCrestIcon: React.FC<IconProps> = ({
  size = 24,
  color = '#FFD700',
  className = '',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="rgba(255,215,0,0.2)" />
  </svg>
);

/**
 * ✦ STAGE BADGE CREST ICON
 */
export const StageCrestIcon: React.FC<IconProps> = ({
  size = 24,
  color = '#00E5FF',
  className = '',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="rgba(0,229,255,0.15)" />
  </svg>
);
