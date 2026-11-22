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
import { PLAYGAMA_MONTH } from '@/platform/playgama/month';
import './RunnerWorldMap.css';
import { t } from '@/i18n';

// The monthly portal build has no Warp Zone page: the map leads back to the chapter.
const BACK = PLAYGAMA_MONTH > 0
  ? { href: `/chapter/${PLAYGAMA_MONTH}`, label: 'Chapter' }
  : { href: '/warp', label: 'Warp Zone' };

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
    let frame = 0;
    let previousDraw = 0;
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
      drawRunnerMap(ctx, width, height, narrow, progress, selected, Math.floor(performance.now() / 80) % 16);
    };
    const animate = (now: number) => {
      if (now - previousDraw >= 80) {
        draw();
        previousDraw = now;
      }
      frame = requestAnimationFrame(animate);
    };
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    void prepareRunnerSprites().then(draw, draw);
    draw();
    frame = requestAnimationFrame(animate);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
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
      setLocation(BACK.href);
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
        <p>{t('Hit a warp note during a song to earn the first Warp Whistle.')}</p>
        <Link href={BACK.href} className="runner-map-action"><ArrowLeft size={17} aria-hidden /> {t(BACK.label)} {pad && <kbd>{pad.back}</kbd>}</Link>
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
          <Link href={BACK.href} className="runner-world-back"><ArrowLeft size={16} aria-hidden /> {t(BACK.label)}</Link>
          <div className="runner-world-inventory" aria-label={t('{n} of 3 Warp Whistles found', { n: foundCount })}>
            <AudioLines size={18} aria-hidden />
            <span>{t('Warp Whistles')}</span>
            <strong>{foundCount}/3</strong>
          </div>
        </div>

        <header className="runner-world-header">
          <div>
            <p>{t('World Map')}</p>
            <h1>Beat Runner</h1>
          </div>
          <span className="runner-world-progress"><Check size={16} aria-hidden /> {t('{n}/{of} courses cleared', { n: progress.cleared.length, of: RUNNER_STAGES.length })}</span>
        </header>

        <div className="runner-world-grid">
          <section className="runner-map-frame" aria-label={t('Beat Runner course map')}>
            <div className="runner-map-surface">
              <canvas ref={canvasRef} aria-hidden="true" />
              {MAP_REGIONS.map(({ name, ink, label }) => {
                const [x, y] = label[compact ? 1 : 0];
                return <span key={name} className="runner-map-region" style={{ left: `${x}%`, top: `${y}%`, color: ink }}>{t(name)}</span>;
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
                    aria-label={`${t('Level {n}', { n: stage })} ${t(RUNNER_COURSES[stage].title)}, ${t(done ? 'cleared' : open ? 'available' : 'locked')}`}
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
                    <span className="runner-map-node-label">{t(RUNNER_COURSES[stage].title)}</span>
                  </button>
                );
              })}
            </div>
            <div className="runner-map-legend">
              <span><i className="runner-map-key runner-map-key--open" /> {t('Open route')}</span>
              <span><i className="runner-map-key" /> {t('Locked route')}</span>
              <span><i className="runner-map-key runner-map-key--warp" /> {t('Warp shortcut')}</span>
              {pad && <span className="runner-map-pad"><Gamepad2 size={16} aria-hidden /> {t('D-pad select')} · {pad.confirm} {t('confirm')} · {pad.back} {t('back')}</span>}
            </div>
          </section>

          <aside className="runner-map-detail" aria-label={t('Selected course')}>
            <div className="runner-map-course-header" style={{ borderTopColor: region.ink }}>
              <p className="runner-map-course-region" style={{ color: region.ink }}>{t(region.name)} / {t('Level {n}', { n: String(selected).padStart(2, '0') })}</p>
              <h2>{t(course.title)}</h2>
              <p className="runner-map-brief">{t(course.brief)}</p>
            </div>
            <div className="runner-map-course-body">
              {cleared && <p className="runner-map-best"><Check size={16} aria-hidden /> {t('Best score')} <strong>{best?.toLocaleString()}</strong></p>}
              {available ? (
                <Link href={runnerArcadePath(selected)} className="runner-map-action">
                  <Play size={17} fill="currentColor" aria-hidden /> {t(cleared ? 'Replay course' : 'Play course')}
                </Link>
              ) : (
                <p className="runner-map-locked"><LockKeyhole size={16} aria-hidden /> {t('Clear {title} to unlock.', { title: t(RUNNER_COURSES[RUNNER_STAGES[RUNNER_STAGES.indexOf(selected) - 1]].title) })}</p>
              )}

              {canOpenShortcut && (
                <button type="button" className="runner-map-whistle-action" onClick={openShortcut}>
                  <AudioLines size={18} aria-hidden /> {t('Use {name}', { name: t(RUNNER_WHISTLES[canOpenShortcut].name) })} <ArrowRight size={16} aria-hidden />
                </button>
              )}
              {whistleToCourse && progress.whistles[whistleToCourse] === 'opened' && (
                <p className="runner-map-secret" role="status"><AudioLines size={17} aria-hidden /> {t('Warp shortcut open')}</p>
              )}
              {whistleAtCourse && available && (
                <p className="runner-map-secret">
                  <AudioLines size={17} aria-hidden />
                  {progress.whistles[whistleAtCourse] === 'hidden'
                    ? t(RUNNER_WHISTLES[whistleAtCourse].hint)
                    : t('{name} found', { name: t(RUNNER_WHISTLES[whistleAtCourse].name) })}
                </p>
              )}
              {readyWhistle && (
                <button type="button" className="runner-map-shortcut" onClick={() => setSelected(RUNNER_WHISTLES[readyWhistle].to)}>
                  {t('View {name} shortcut', { name: t(RUNNER_WHISTLES[readyWhistle].name) })} <ArrowRight size={15} aria-hidden />
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
