/**
 * identicon.ts — Deterministic avatar fallback for PIM
 * Generates initials + a stable HSL background color from userId.
 */

export function getIdenticon(userId: string, displayName?: string | null): {
  initials: string;
  bgColor: string;
} {
  // Extract initials from displayName, or fallback to first 2 chars of userId
  let initials = '??';
  if (displayName && displayName.trim().length > 0) {
    const parts = displayName.trim().split(/[\s_\-\.]+/).filter(Boolean);
    if (parts.length >= 2) {
      initials = (parts[0][0] + parts[1][0]).toUpperCase();
    } else if (parts[0].length >= 2) {
      initials = parts[0].slice(0, 2).toUpperCase();
    } else {
      initials = parts[0][0].toUpperCase();
    }
  } else if (userId) {
    initials = userId.replace(/-/g, '').slice(0, 2).toUpperCase();
  }

  // Deterministic hue from userId hash
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  const bgColor = `hsl(${hue}, 55%, 35%)`;

  return { initials, bgColor };
}
