export function perfectPlusWindow(diff: number, timingProfile?: string): number {
  const mult = timingProfile === 'elite' ? 0.85 : 1.0;
  return Math.max(0.024, (0.060 - (diff - 1) * 0.0033) * mult);
}


export function perfectWindow(diff: number, timingProfile?: string): number {
  const mult = timingProfile === 'elite' ? 0.85 : 1.0;
  return Math.max(0.045, (0.110 - (diff - 1) * 0.0061) * mult);
}


export function goodWindow(diff: number, timingProfile?: string): number {
  const mult = timingProfile === 'elite' ? 0.85 : 1.0;
  return Math.max(0.080, (0.190 - (diff - 1) * 0.010) * mult);
}


export function missWindow(diff: number, timingProfile?: string): number {
  const mult = timingProfile === 'elite' ? 0.85 : 1.0;
  return Math.max(0.150, (0.360 - (diff - 1) * 0.019) * mult);
}
