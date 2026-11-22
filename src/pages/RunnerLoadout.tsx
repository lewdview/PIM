import {
  RUNNER_EMOTES, RUNNER_SKINS, runnerEmotes, type RunnerAppearance, type RunnerEmote, type RunnerSkin,
} from '../game/secret/runnerSprites';

export default function RunnerLoadout({ value, onChange, controllerHint }: {
  value: RunnerAppearance;
  onChange: (next: RunnerAppearance) => void;
  controllerHint?: string;
}) {
  return (
    <div className="runner-loadout">
      <label>
        Outfit
        <select value={value.skin} onChange={event => onChange({ skin: event.target.value as RunnerSkin, emote: 'taunt' })}>
          {Object.entries(RUNNER_SKINS).map(([skin, label]) => <option key={skin} value={skin}>{label}</option>)}
        </select>
      </label>
      <label>
        Taunt
        <select value={value.emote} onChange={event => onChange({ ...value, emote: event.target.value as RunnerEmote })}>
          {runnerEmotes(value.skin).map(emote => <option key={emote} value={emote}>{RUNNER_EMOTES[emote]}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => onChange(value)}>Preview taunt</button>
      <p>{controllerHint ?? 'T cycles taunts during play.'}</p>
    </div>
  );
}
