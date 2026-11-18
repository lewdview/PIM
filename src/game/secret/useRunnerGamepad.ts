import { useEffect, useRef, useState } from 'react';

const BUTTONS = {
  confirm: 0, back: 1, attack: 2, taunt: 3, block: 5, menu: 9,
  up: 12, down: 13, left: 14, right: 15,
} as const;

export type RunnerPadInput = keyof typeof BUTTONS;
export type RunnerDirection = 'up' | 'down' | 'left' | 'right';
const KEYS = Object.keys(BUTTONS) as RunnerPadInput[];
const DIRECTIONS: RunnerDirection[] = ['up', 'down', 'left', 'right'];

const LABELS = {
  xbox: { confirm: 'A', back: 'B', attack: 'X', taunt: 'Y', block: 'RB', menu: 'Menu' },
  playstation: { confirm: '✕', back: '○', attack: '□', taunt: '△', block: 'R1', menu: 'Options' },
  nintendo: { confirm: 'B', back: 'A', attack: 'Y', taunt: 'X', block: 'R', menu: '+' },
} as const;

type PadFamily = keyof typeof LABELS;

function family(id: string): PadFamily {
  if (/054c|dualsense|dualshock|playstation|wireless controller.*sony/i.test(id)) return 'playstation';
  if (/057e|nintendo|switch pro|joy-con/i.test(id)) return 'nintendo';
  return 'xbox';
}

function getPad() {
  try {
    return Array.from(navigator.getGamepads?.() ?? []).find(pad => pad?.connected && pad.mapping === 'standard') ?? null;
  } catch {
    return null;
  }
}

function readInputs(pad: Gamepad, priorStick?: RunnerDirection) {
  const [x = 0, y = 0] = pad.axes;
  const dominant: RunnerDirection = Math.abs(x) >= Math.abs(y) ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'up' : 'down');
  const strength = Math.max(Math.abs(x), Math.abs(y));
  const axes = { left: -x, right: x, up: -y, down: y };
  const stick = priorStick && axes[priorStick] >= 0.4 ? priorStick : strength >= 0.58 ? dominant : undefined;
  const hasDpad = DIRECTIONS.some(key => pad.buttons[BUTTONS[key]]?.pressed);
  const held = KEYS.filter(key => pad.buttons[BUTTONS[key]]?.pressed || (!hasDpad && key === stick));
  return { held, stick };
}

/** Only dispatch new presses. A held confirm must not carry from the map into a course. */
export function useRunnerGamepad(enabled: boolean, onPress: (pressed: readonly RunnerPadInput[]) => void) {
  const handler = useRef(onPress);
  handler.current = onPress;
  const [style, setStyle] = useState<PadFamily | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let gamepad = getPad();
    let previous: ReturnType<typeof readInputs> = gamepad ? readInputs(gamepad) : { held: [], stick: undefined };
    let rebase = false;
    let frame = 0;
    setStyle(gamepad ? family(gamepad.id) : null);

    const visibility = () => { rebase = true; };
    const poll = () => {
      const nextPad = getPad();
      const changed = nextPad?.id !== gamepad?.id || nextPad?.index !== gamepad?.index;
      if (changed) setStyle(nextPad ? family(nextPad.id) : null);

      if (nextPad) {
        const current = readInputs(nextPad, changed ? undefined : previous.stick);
        if (!document.hidden && !rebase && !(changed && gamepad)) {
          const pressed = current.held.filter(key => !previous.held.includes(key));
          if (pressed.length) handler.current(pressed);
        }
        previous = current;
      } else {
        previous = { held: [], stick: undefined };
      }
      rebase = document.hidden;
      gamepad = nextPad;
      frame = requestAnimationFrame(poll);
    };

    document.addEventListener('visibilitychange', visibility);
    frame = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [enabled]);

  return enabled && style ? LABELS[style] : null;
}
