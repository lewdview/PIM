// Options for a monthly Playgama build: the settings from the main game's
// options menu that make sense for a portal player, on tabs so the panel never
// scrolls. Everything lives in the same opt_* localStorage keys loadOpts() reads,
// so the Playgama save (bridge.ts) carries them across devices.

import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { DEFAULT_OPTS, loadOpts, type GameOpts, type GfxLevel, type ParticleDensity, type PovMode } from '@/lib/options';
import { audioManager } from '@/game/audio';
import '@/styles/monthPanels.css';

type Tab = 'audio' | 'timing' | 'display' | 'play';
const TABS: { id: Tab; label: string }[] = [
  { id: 'audio', label: 'Audio' },
  { id: 'timing', label: 'Timing' },
  { id: 'display', label: 'Display' },
  { id: 'play', label: 'Gameplay' },
];

const VIEWS: { id: PovMode; name: string }[] = [
  { id: 'classic', name: 'Classic' },
  { id: 'flat_2d', name: 'Flat 2D' },
  { id: 'horizontal_drift', name: 'Side-scroller' },
  { id: 'dynamic_stage', name: 'Dynamic stage' },
  { id: 'canyon_run', name: 'Canyon Run' },
  { id: 'aurora_bridge', name: 'Aurora Bridge' },
  { id: 'cyber_tunnel', name: 'Cyber tunnel' },
  { id: 'corkscrew', name: 'Corkscrew' },
  { id: 'rollercoaster', name: 'Wave coaster' },
  { id: 'matrix_split', name: 'Split lanes' },
  { id: 'cockpit_hud', name: 'Cockpit' },
  { id: 'hyper_prism', name: 'Prism' },
  { id: 'dna_helix', name: 'Double helix' },
  { id: 'vertigo_drop', name: 'Vertigo drop' },
  { id: 'singularity_void', name: 'Black hole' },
  { id: 'ground_zero', name: 'Bumper cam' },
  { id: 'orbital_halo', name: 'Halo' },
  { id: 'mobius_loop', name: 'Möbius loop' },
];
const GFX: { id: GfxLevel; name: string }[] = [
  { id: 'low', name: 'Low' }, { id: 'medium', name: 'Medium' }, { id: 'high', name: 'High' }, { id: 'ultra', name: 'Ultra' },
];
const PARTICLES: { id: ParticleDensity; name: string }[] = [
  { id: 'minimal', name: 'Minimal' }, { id: 'half', name: 'Half' }, { id: 'full', name: 'Full' },
];

type BoolKey = 'sfxEnabled' | 'bgMusic' | 'autoLatencyAdjust' | 'trackLyrics' | 'bgAnimation' | 'bloomGlow'
  | 'stagePovSwitch' | 'judgmentText' | 'comboDisplay' | 'haptics';

function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mo-row">
      <span className="mo-label">{label}{hint && <small>{hint}</small>}</span>
      <button type="button" role="switch" aria-checked={on} className="mo-switch" onClick={() => onChange(!on)}>
        <span />
      </button>
    </label>
  );
}

function Slider({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <label className="mo-row">
      <span className="mo-label">{label}<small>{format(value)}</small></span>
      <input className="mo-range" type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

function Cycle<T extends string>({ label, value, items, onChange }: {
  label: string; value: T; items: { id: T; name: string }[]; onChange: (v: T) => void;
}) {
  const i = Math.max(0, items.findIndex((it) => it.id === value));
  const step = (d: number) => onChange(items[(i + d + items.length) % items.length].id);
  return (
    <div className="mo-row">
      <span className="mo-label">{label}</span>
      <span className="mo-cycle">
        <button type="button" aria-label={`Previous ${label.toLowerCase()}`} onClick={() => step(-1)}><ChevronLeft size={16} /></button>
        <b>{items[i].name}</b>
        <button type="button" aria-label={`Next ${label.toLowerCase()}`} onClick={() => step(1)}><ChevronRight size={16} /></button>
      </span>
    </div>
  );
}

export default function MonthOptions({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('audio');
  const [opts, setOpts] = useState<GameOpts>(() => loadOpts());

  const save = <K extends keyof GameOpts>(key: K, value: GameOpts[K]) => {
    try {
      localStorage.setItem(`opt_${key}`, String(value));
    } catch { /* storage blocked */ }
    setOpts((o) => ({ ...o, [key]: value }));
    if (key === 'bgMusic') window.dispatchEvent(new Event('bgmusic_toggle'));
    if (key === 'musicVolume') window.dispatchEvent(new Event('bgmusic_volume_change'));
  };
  const bool = (key: BoolKey) => ({ on: opts[key], onChange: (v: boolean) => { save(key, v); audioManager.playSfx('tap_nav', 0.3); } });

  const reset = () => {
    (Object.keys(DEFAULT_OPTS) as (keyof GameOpts)[]).forEach((k) => {
      try { localStorage.removeItem(`opt_${k}`); } catch { /* storage blocked */ }
    });
    window.dispatchEvent(new Event('bgmusic_toggle'));
    setOpts(loadOpts());
  };

  return (
    <div className="mb-lb" role="dialog" aria-modal="true" aria-label="Options" onClick={onClose}>
      <div className="mb-lb-card mo-card" onClick={(e) => e.stopPropagation()}>
        <div className="mb-lb-head">
          <h2 className="cs-display">Options</h2>
          <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={onClose} aria-label="Close options"><X size={16} /></button>
        </div>
        <div className="mo-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="mo-body" role="tabpanel">
          {tab === 'audio' && <>
            <Toggle label="Sound effects" hint="Taps and hit sounds" {...bool('sfxEnabled')} />
            <Slider label="Effects volume" value={opts.sfxVolume} min={0} max={1} step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => { save('sfxVolume', v); audioManager.playSfx('tap_nav', 0.3); }} />
            <Toggle label="Menu music" hint="Ambient sound on the chapter screen" {...bool('bgMusic')} />
            <Slider label="Menu music volume" value={opts.musicVolume} min={0} max={1} step={0.05}
              format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => save('musicVolume', v)} />
          </>}
          {tab === 'timing' && <>
            <Slider label="Audio offset" value={opts.audioOffset} min={-150} max={150} step={5}
              format={(v) => `${v > 0 ? '+' : ''}${v} ms`} onChange={(v) => save('audioOffset', v)} />
            <p className="mo-hint">Move it left if notes reach the bar before you hear the beat, right if the beat comes first.</p>
            <Toggle label="Auto timing fix" hint="Adjusts the offset while you play" {...bool('autoLatencyAdjust')} />
          </>}
          {tab === 'display' && <>
            <Cycle label="View" value={opts.povMode} items={VIEWS} onChange={(v) => save('povMode', v)} />
            <Toggle label="Change view each stage" {...bool('stagePovSwitch')} />
            <Cycle label="Graphics" value={opts.gfxLevel} items={GFX} onChange={(v) => save('gfxLevel', v)} />
            <Cycle label="Particles" value={opts.particleDensity} items={PARTICLES} onChange={(v) => save('particleDensity', v)} />
            <Toggle label="Glow" {...bool('bloomGlow')} />
            <Toggle label="Moving background" {...bool('bgAnimation')} />
            <Toggle label="Lyrics on the road" {...bool('trackLyrics')} />
          </>}
          {tab === 'play' && <>
            <Toggle label="Hit text" hint="Perfect, great and miss" {...bool('judgmentText')} />
            <Toggle label="Combo counter" {...bool('comboDisplay')} />
            <Toggle label="Vibration" hint="On phones that support it" {...bool('haptics')} />
            <p className="mo-hint">Lane keys are {opts.laneKeys.map((k) => k.toUpperCase()).join(' · ')}, and the arrow keys steer slide notes. On touch screens, tap the lanes.</p>
          </>}
        </div>
        <div className="mo-foot">
          <button type="button" className="btn-3d" data-size="sm" data-tone="quiet" onClick={reset}>Reset to defaults</button>
        </div>
      </div>
    </div>
  );
}
