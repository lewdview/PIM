import { RUNNER_COURSES, RUNNER_STAGES, RUNNER_WHISTLES, type RunnerStage, type RunnerWhistleId } from './runnerCourses';
import { hasWarpWhistle, readSecretClears } from './warp';

type WhistleStatus = 'hidden' | 'found' | 'opened';
const sessionWhistles: Partial<Record<RunnerWhistleId, WhistleStatus>> = {};
const whistleKey = (id: RunnerWhistleId) => `beat-runner-whistle:${id}`;

function readWhistle(id: RunnerWhistleId): WhistleStatus {
  try {
    const status = localStorage.getItem(whistleKey(id));
    // An opened route stays open if another tab marks the same whistle as found.
    if (status === 'opened' || sessionWhistles[id] === 'opened') return 'opened';
    if (status === 'found') return 'found';
  } catch { /* Fall back to this session's progress. */ }
  return sessionWhistles[id] ?? 'hidden';
}

function saveWhistle(id: RunnerWhistleId, status: WhistleStatus) {
  sessionWhistles[id] = status;
  try {
    localStorage.setItem(whistleKey(id), status);
  } catch { /* Keep the progress for this session. */ }
}

export function findRunnerWhistle(id: RunnerWhistleId) {
  if (readWhistle(id) !== 'hidden') return false;
  saveWhistle(id, 'found');
  return true;
}

export function openRunnerShortcut(id: RunnerWhistleId) {
  if (!hasWarpWhistle() || readWhistle(id) !== 'found') return;
  saveWhistle(id, 'opened');
}

export function readRunnerProgress() {
  const hasEntry = hasWarpWhistle();
  const clears = readSecretClears();
  const whistles = { rooftop: readWhistle('rooftop'), prism: readWhistle('prism') };
  const cleared = RUNNER_STAGES.filter(stage => (clears[RUNNER_COURSES[stage].clearId]?.clears ?? 0) > 0);
  const available = hasEntry ? RUNNER_STAGES.filter((stage, i) =>
    i === 0
    || cleared.includes(stage)
    || cleared.includes(RUNNER_STAGES[i - 1])
    || (stage === RUNNER_WHISTLES.rooftop.to && whistles.rooftop === 'opened')
    || (stage === RUNNER_WHISTLES.prism.to && whistles.prism === 'opened'),
  ) : [];
  return { hasEntry, available, cleared, whistles, clears };
}

export function runnerArcadePath(stage: RunnerStage) {
  return `/secret/runner?via=arcade&stage=${stage}`;
}

export function runnerMapPath(stage?: RunnerStage) {
  return stage ? `/warp/runner?stage=${stage}` : '/warp/runner';
}
