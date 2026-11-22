import {
  RUNNER_EMOTES, RUNNER_SKINS, runnerEmotes, type RunnerAppearance, type RunnerEmote, type RunnerSkin,
} from '../game/secret/runnerSprites';
import { t } from '@/i18n';

export default function RunnerLoadout({ value, onChange, controllerHint }: {
  value: RunnerAppearance;
  onChange: (next: RunnerAppearance) => void;
  controllerHint?: string;
}) {
  return (
    <div className="runner-loadout">
      <label>
        {t('Outfit')}
        <select value={value.skin} onChange={event => onChange({ skin: event.target.value as RunnerSkin, emote: 'taunt' })}>
          {Object.entries(RUNNER_SKINS).map(([skin, label]) => <option key={skin} value={skin}>{t(label)}</option>)}
        </select>
      </label>
      <label>
        {t('Taunt')}
        <select value={value.emote} onChange={event => onChange({ ...value, emote: event.target.value as RunnerEmote })}>
          {runnerEmotes(value.skin).map(emote => <option key={emote} value={emote}>{t(RUNNER_EMOTES[emote])}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => onChange(value)}>{t('Preview taunt')}</button>
      <p>{controllerHint ?? t('T cycles taunts during play.')}</p>
    </div>
  );
}
