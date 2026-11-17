import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, AudioLines, Check, Gamepad2, LockKeyhole, Play } from 'lucide-react';
import { Link, useLocation, useSearch } from 'wouter';
import {
  RUNNER_COURSES, RUNNER_STAGES, RUNNER_WHISTLES, parseRunnerStage, type RunnerStage,
} from '../game/secret/runnerCourses';
import { drawRunnerMap, MAP_REGIONS, runnerMapLayout } from '../game/secret/runnerMapArt';
import { openRunnerShortcut, readRunnerProgress, runnerArcadePath } from '../game/secret/runnerProgress';
import { prepareRunnerSprites } from '../game/secret/runnerSprites';
import { useRunnerGamepad, type RunnerDirection } from '../game/secret/useRunnerGamepad';
import './RunnerWorldMap.css';

const WHISTLES = ['rooftop', 'prism'] as const;
const ARROWS: Record<string, RunnerDirection> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
const STEPS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] } as const;

export default function RunnerWorldMap() {
  const query = new URLSearchParams(useSearch());
  const [, setLocation] = useLocation();
  const [progress, setProgress] = useState(readRunnerProgress);
  const [selected, setSelected] = useState<RunnerStage>(() =>
    parseRunnerStage(query.get('stage'))
    ?? progress.available.find(stage => !progress.cleared.includes(stage))
    ?? progress.available.at(-1)
    ?? 1,
  );
  const [compact, setCompact] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageButtons = useRef<Partial<Record<RunnerStage, HTMLButtonElement | null>>>({});

  useEffect(() => {
    const refresh = () => setProgress(readRunnerProgress());
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  useEffect(() => {
    if (!progress.hasEntry) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let active = true;
    const draw = () => {
      if (!active) return;
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      const narrow = width < 570;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const pixelsWide = Math.round(width * dpr);
      const pixelsHigh = Math.round(height * dpr);
      setCompact(narrow);
      if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
        canvas.width = pixelsWide;
        canvas.height = pixelsHigh;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRunnerMap(ctx, width, height, narrow, progress, selected);
    };
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    void prepareRunnerSprites().then(draw, draw);
    draw();
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [progress, selected]);

  const layout = runnerMapLayout(compact);
  const navigateMap = (direction: RunnerDirection, from: RunnerStage) => {
    const [x, y] = layout[from];
    const [dx, dy] = STEPS[direction];
    let nearest: RunnerStage | null = null;
    let bestDistance = Infinity;
    for (const stage of RUNNER_STAGES) {
      const [nx, ny] = layout[stage];
      const forward = (nx - x) * dx + (ny - y) * dy;
      if (forward <= 0) continue;
      const cross = Math.abs((nx - x) * dy - (ny - y) * dx);
      if (cross > forward * 1.5) continue;
      const distance = Math.hypot(forward, cross) + cross * 0.25;
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = stage;
      }
    }
    if (nearest) {
      setSelected(nearest);
      stageButtons.current[nearest]?.focus();
    }
  };

  const available = progress.available.includes(selected);
  const whistleToCourse = WHISTLES.find(id => RUNNER_WHISTLES[id].to === selected);
  const canOpenShortcut = whistleToCourse && progress.whistles[whistleToCourse] === 'found' ? whistleToCourse : null;
  const readyWhistle = WHISTLES.find(id => progress.whistles[id] === 'found' && id !== whistleToCourse);
  const openShortcut = () => {
    if (!canOpenShortcut) return;
    openRunnerShortcut(canOpenShortcut);
    setProgress(readRunnerProgress());
  };
  const pad = useRunnerGamepad(true, pressed => {
    if (pressed.includes('back') || (!progress.hasEntry && pressed.includes('confirm'))) {
      setLocation('/warp');
    } else if (progress.hasEntry && (pressed.includes('confirm') || pressed.includes('menu'))) {
      if (available) setLocation(runnerArcadePath(selected));
      else openShortcut();
    } else if (progress.hasEntry && pressed.includes('taunt')) {
      if (canOpenShortcut) openShortcut();
      else if (readyWhistle) setSelected(RUNNER_WHISTLES[readyWhistle].to);
    } else if (progress.hasEntry) {
      const direction = pressed.find((key): key is RunnerDirection => key in STEPS);
      if (direction) navigateMap(direction, selected);
    }
  });

  if (!progress.hasEntry) {
    return (
      <div className="runner-world runner-world--locked">
        <LockKeyhole size={26} aria-hidden />
        <h1>Beat Runner</h1>
        <p>Hit a warp note during a song to earn the first Warp Whistle.</p>
        <Link href="/warp" className="runner-map-action"><ArrowLeft size={17} aria-hidden /> Warp Zone {pad && <kbd>{pad.back}</kbd>}</Link>
      </div>
    );
  }

  const course = RUNNER_COURSES[selected];
  const region = MAP_REGIONS[Math.floor((selected - 1) / 2)];
  const cleared = progress.cleared.includes(selected);
  const best = progress.clears[course.clearId]?.best;
  const whistleAtCourse = WHISTLES.find(id => RUNNER_WHISTLES[id].from === selected);
  const foundCount = 1 + WHISTLES.filter(id => progress.whistles[id] !== 'hidden').length;

  return (
    <div className="runner-world">
      <div className="runner-world-shell">
        <div className="runner-world-top">
          <Link href="/warp" className="runner-world-back"><ArrowLeft size={16} aria-hidden /> Warp Zone</Link>
          <div className="runner-world-inventory" aria-label={`${foundCount} of 3 Warp Whistles found`}>
            <AudioLines size={18} aria-hidden />
            <span>Warp Whistles</span>
            <strong>{foundCount}/3</strong>
          </div>
        </div>

        <header className="runner-world-header">
          <div>
            <p>World Map</p>
            <h1>Beat Runner</h1>
          </div>
          <span className="runner-world-progress"><Check size={16} aria-hidden /> {progress.cleared.length}/{RUNNER_STAGES.length} courses cleared</span>
        </header>

        <div className="runner-world-grid">
          <section className="runner-map-frame" aria-label="Beat Runner course map">
            <div className="runner-map-surface">
              <canvas ref={canvasRef} aria-hidden="true" />
              {MAP_REGIONS.map(({ name, ink, label }) => {
                const [x, y] = label[compact ? 1 : 0];
                return <span key={name} className="runner-map-region" style={{ left: `${x}%`, top: `${y}%`, color: ink }}>{name}</span>;
              })}
              {RUNNER_STAGES.map((stage) => {
                const [x, y] = layout[stage];
                const open = progress.available.includes(stage);
                const done = progress.cleared.includes(stage);
                const isSelected = selected === stage;
                return (
                  <button
                    key={stage}
                    type="button"
                    ref={(node) => { stageButtons.current[stage] = node; }}
                    className="runner-map-node"
                    style={{ left: `${x}%`, top: `${y}%` }}
                    data-state={done ? 'clear' : open ? 'open' : 'locked'}
                    aria-label={`Level ${stage} ${RUNNER_COURSES[stage].title}, ${done ? 'cleared' : open ? 'available' : 'locked'}`}
                    aria-pressed={isSelected}
                    onKeyDown={(event) => {
                      const direction = ARROWS[event.key];
                      if (!direction) return;
                      event.preventDefault();
                      navigateMap(direction, stage);
                    }}
                    onClick={() => setSelected(stage)}
                  >
                    <span className="runner-map-node-marker">
                      {done ? <Check size={17} strokeWidth={3} aria-hidden /> : open ? String(stage).padStart(2, '0') : <LockKeyhole size={15} aria-hidden />}
                    </span>
                    <span className="runner-map-node-label">{RUNNER_COURSES[stage].title}</span>
                  </button>
                );
              })}
            </div>
            <div className="runner-map-legend">
              <span><i className="runner-map-key runner-map-key--open" /> Open route</span>
              <span><i className="runner-map-key" /> Locked route</span>
              <span><i className="runner-map-key runner-map-key--warp" /> Warp shortcut</span>
              {pad && <span className="runner-map-pad"><Gamepad2 size={16} aria-hidden /> D-pad select · {pad.confirm} confirm · {pad.back} back</span>}
            </div>
          </section>

          <aside className="runner-map-detail" aria-label="Selected course">
            <div className="runner-map-course-header" style={{ borderTopColor: region.ink }}>
              <p className="runner-map-course-region" style={{ color: region.ink }}>{region.name} / Level {String(selected).padStart(2, '0')}</p>
              <h2>{course.title}</h2>
              <p className="runner-map-brief">{course.brief}</p>
            </div>
            <div className="runner-map-course-body">
              {cleared && <p className="runner-map-best"><Check size={16} aria-hidden /> Best score <strong>{best?.toLocaleString()}</strong></p>}
              {available ? (
                <Link href={runnerArcadePath(selected)} className="runner-map-action">
                  <Play size={17} fill="currentColor" aria-hidden /> {cleared ? 'Replay course' : 'Play course'}
                </Link>
              ) : (
                <p className="runner-map-locked"><LockKeyhole size={16} aria-hidden /> Clear {RUNNER_COURSES[RUNNER_STAGES[RUNNER_STAGES.indexOf(selected) - 1]].title} to unlock.</p>
              )}

              {canOpenShortcut && (
                <button type="button" className="runner-map-whistle-action" onClick={openShortcut}>
                  <AudioLines size={18} aria-hidden /> Use {RUNNER_WHISTLES[canOpenShortcut].name} <ArrowRight size={16} aria-hidden />
                </button>
              )}
              {whistleToCourse && progress.whistles[whistleToCourse] === 'opened' && (
                <p className="runner-map-secret" role="status"><AudioLines size={17} aria-hidden /> Warp shortcut open</p>
              )}
              {whistleAtCourse && available && (
                <p className="runner-map-secret">
                  <AudioLines size={17} aria-hidden />
                  {progress.whistles[whistleAtCourse] === 'hidden'
                    ? RUNNER_WHISTLES[whistleAtCourse].hint
                    : `${RUNNER_WHISTLES[whistleAtCourse].name} found`}
                </p>
              )}
              {readyWhistle && (
                <button type="button" className="runner-map-shortcut" onClick={() => setSelected(RUNNER_WHISTLES[readyWhistle].to)}>
                  View {RUNNER_WHISTLES[readyWhistle].name} shortcut <ArrowRight size={15} aria-hidden />
                  {pad && <kbd>{pad.taunt}</kbd>}
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
