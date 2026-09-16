export function colorWithAlpha(color: string, alpha: number): string {
  if (!color || typeof color !== 'string') return `rgba(255, 255, 255, ${alpha})`;
  const trimmed = color.trim();
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    const r = parseInt(hex.slice(0, 2), 16) || 0;
    const g = parseInt(hex.slice(2, 4), 16) || 0;
    const b = parseInt(hex.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (trimmed.startsWith('hsl')) {
    const match = trimmed.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/);
    if (match) {
      return `hsla(${match[1]}, ${match[2]}%, ${match[3]}%, ${alpha})`;
    }
    const matchHsla = trimmed.match(/hsla\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*,\s*[\d.]+\s*\)/);
    if (matchHsla) {
      return `hsla(${matchHsla[1]}, ${matchHsla[2]}%, ${matchHsla[3]}%, ${alpha})`;
    }
  }
  if (trimmed.startsWith('rgb')) {
    const match = trimmed.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (match) {
      return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
    }
    const matchRgba = trimmed.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)/);
    if (matchRgba) {
      return `rgba(${matchRgba[1]}, ${matchRgba[2]}, ${matchRgba[3]}, ${alpha})`;
    }
  }
  return trimmed;
}


export function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}


export function getDifficultyLaneColor(baseColor: string, _diffLevel: number, laneIndex?: number): string {
  try {
    const pathParts = window.location.pathname.split('/');
    const songId = pathParts[pathParts.length - 1];
    if (songId) {
      const activeMod = sessionStorage.getItem(`active_modifier_type_${songId}`);
      if (activeMod === 'bass_realm' && laneIndex === 0) {
        return "#a855f7"; // Glowing neon purple
      }
    }
  } catch (e) {
    // Fail silently
  }
  return baseColor;
}
