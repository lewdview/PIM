// Public marketing launch-pad routes. These skip the arcade splash, the
// tutorial gate, onboarding and the app chrome so ad traffic lands directly.
export const LAUNCH_PATHS = ['/launch', '/launchpad', '/play-pim'] as const;

export function isLaunchPath(path: string): boolean {
  const clean = path.replace(/\/+$/, '') || '/';
  return (LAUNCH_PATHS as readonly string[]).includes(clean);
}
