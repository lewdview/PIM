import { useEffect } from 'react';

// Hides the floating chrome (phone dock, global player bar, 365 ecosystem pill) while a
// full-screen sequence runs, so nothing sits on top of its buttons. Ref-counted: several
// screens can hold at once and the chrome returns when the last one lets go.
// Styles: body.pim-chrome-hold in stageShell.css.
let holds = 0;

export function useChromeHold(active: boolean) {
  useEffect(() => {
    if (!active) return;
    holds++;
    document.body.classList.add('pim-chrome-hold');
    return () => {
      holds = Math.max(0, holds - 1);
      if (holds === 0) document.body.classList.remove('pim-chrome-hold');
    };
  }, [active]);
}
