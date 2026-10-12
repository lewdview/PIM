import type { SyntheticEvent } from 'react';

/** Hide cover art that fails to load instead of showing a broken-image icon. */
export function hideBroken(e: SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.visibility = 'hidden';
}
