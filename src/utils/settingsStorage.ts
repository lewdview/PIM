import type { ProfileSettings } from '../store/useVaultStore';

const SETTINGS_KEY = 'pim_settings';

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  audioOffset: 0,
  laneKeys: ['a', 's', 'd'],
  laneColors: ['#FF1493', '#00E5FF', '#39FF14'],
  noteTheme: 'artwork',
  cardSkin: 'original',
  cardBack: 'classic',
  gameBackground: 'cover_blur',
  gameTrack: 'transparent',
  backgroundBlur: 10,
  hudMisses: true,
  comboDisplay: true,
  judgmentText: true,
  bgMusic: false,
  sfxEnabled: true,
  sfxVolume: 0.8,
  musicVolume: 0.5,
  haptics: true,
  missSystem: true,
  slideshowThreshold: 38,
  slideshowIsolate: false,
  slideshowBrackets: false,
  slideshowMode: 'coco',
  povMode: 'classic',
  stagePovSwitch: true,
  renderResolution: 'high',
  gfxLevel: 'high',
  fpsTarget: 'auto',
  particleDensity: 'full',
  bloomGlow: true,
  bgAnimation: true,
  legacyGraphics: false,
  packDesignStyle: 'cyber_cartridge',
  visualizerShape: 'flower_of_life',
  visualizerTheme: 'cyan_pink',
  visualizerPlaylistMode: 'all_catalog',
  visualizerRepeatMode: 'all',
  chartVariant: 'v1_gimmicks',
};

function readLegacyOpts(): Partial<ProfileSettings> {
  if (typeof localStorage === 'undefined') return {};
  const result: Partial<ProfileSettings> = {};

  const floatKeys: [keyof ProfileSettings, string][] = [
    ['audioOffset', 'opt_audioOffset'],
    ['backgroundBlur', 'opt_backgroundBlur'],
    ['sfxVolume', 'opt_sfxVolume'],
    ['musicVolume', 'opt_musicVolume'],
  ];
  for (const [key, lsKey] of floatKeys) {
    const raw = localStorage.getItem(lsKey);
    if (raw !== null) {
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) (result as any)[key] = parsed;
    }
  }

  const stringKeys: [keyof ProfileSettings, string][] = [
    ['noteTheme', 'opt_noteTheme'],
    ['cardSkin', 'opt_cardSkin'],
    ['cardBack', 'opt_cardBack'],
    ['gameBackground', 'opt_gameBackground'],
    ['gameTrack', 'opt_gameTrack'],
    ['slideshowMode', 'opt_slideshowMode'],
    ['povMode', 'opt_povMode'],
    ['renderResolution', 'opt_renderResolution'],
    ['gfxLevel', 'opt_gfxLevel'],
    ['fpsTarget', 'opt_fpsTarget'],
    ['particleDensity', 'opt_particleDensity'],
    ['visualizerShape', 'opt_visualizerShape'],
    ['visualizerTheme', 'opt_visualizerTheme'],
    ['visualizerPlaylistMode', 'opt_visualizerPlaylistMode'],
    ['visualizerRepeatMode', 'opt_visualizerRepeatMode'],
    ['chartVariant', 'opt_chartVariant'],
  ];
  for (const [key, lsKey] of stringKeys) {
    const val = localStorage.getItem(lsKey);
    if (val !== null) (result as any)[key] = val;
  }

  const k0 = localStorage.getItem('opt_laneKey_0');
  const k1 = localStorage.getItem('opt_laneKey_1');
  const k2 = localStorage.getItem('opt_laneKey_2');
  if (k0 || k1 || k2) {
    result.laneKeys = [k0 ?? 'a', k1 ?? 's', k2 ?? 'd'];
  }

  const c0 = localStorage.getItem('opt_laneColor_0');
  const c1 = localStorage.getItem('opt_laneColor_1');
  const c2 = localStorage.getItem('opt_laneColor_2');
  if (c0 || c1 || c2) {
    result.laneColors = [c0 ?? '#FF1493', c1 ?? '#00E5FF', c2 ?? '#39FF14'];
  }

  const boolTrueDefaults: (keyof ProfileSettings)[] = [
    'hudMisses', 'comboDisplay', 'judgmentText', 'sfxEnabled',
    'haptics', 'missSystem', 'stagePovSwitch', 'bloomGlow', 'bgAnimation',
  ];
  for (const key of boolTrueDefaults) {
    const val = localStorage.getItem(`opt_${String(key)}`);
    if (val !== null) (result as any)[key] = val !== 'false';
  }

  const boolFalseDefaults: (keyof ProfileSettings)[] = [
    'bgMusic', 'slideshowIsolate', 'slideshowBrackets', 'legacyGraphics',
  ];
  for (const key of boolFalseDefaults) {
    const val = localStorage.getItem(`opt_${String(key)}`);
    if (val !== null) (result as any)[key] = val === 'true';
  }

  const packStyle = localStorage.getItem('opt_packDesignStyle') || localStorage.getItem('pim_pack_design_style');
  if (packStyle) (result as any).packDesignStyle = packStyle;

  return result;
}

export function hydrateSettings(defaults: ProfileSettings = DEFAULT_PROFILE_SETTINGS): ProfileSettings {
  if (typeof localStorage === 'undefined') return { ...defaults };
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...defaults, ...JSON.parse(stored) };
    }
    // First run migration from legacy individual keys
    const legacy = readLegacyOpts();
    const migrated = { ...defaults, ...legacy };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return { ...defaults };
  }
}

export function persistSettings(settings: ProfileSettings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Gracefully handle storage quota errors
  }
}
