import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation } from 'wouter';
import { 
  Play, Pause, Download, Copy, Trash, ChevronLeft, 
  RotateCcw, Sliders, Info, HelpCircle, Layers, Eye
} from 'lucide-react';
import { loadCatalog, getSongById, type GameSong } from '../game/api';
import type { Note } from '../game/types';
import '../styles/BeatmapEditorStyles.css';

// ===== ADMIN GATE PASSPHRASE CONFIG =====
const ADMIN_PASSPHRASE = 'th3scr1b3';
const ADMIN_AUTH_KEY = 'th3vault_admin_auth';

function AdminGate({ onAuthenticate }: { onAuthenticate: () => void }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.toLowerCase() === ADMIN_PASSPHRASE) {
      sessionStorage.setItem(ADMIN_AUTH_KEY, 'true');
      onAuthenticate();
    } else {
      setError(true);
      setTimeout(() => setError(false), 800);
    }
  };

  return (
    <div className="admin-gate-wrapper">
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '320px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: '48px',
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            color: '#ff3800',
            textShadow: '0 0 20px rgba(255, 56, 0, 0.3)',
          }}>
            BEATMAP EDITOR
          </div>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '9px',
            textTransform: 'uppercase',
            letterSpacing: '0.3em',
            opacity: 0.4,
            marginTop: '4px',
          }}>
            th3v4ult rhythm engine
          </div>
        </div>

        <div className="admin-gate-box" style={{
          transition: 'transform 0.1s',
          transform: error ? 'translateX(8px)' : 'none',
          background: '#0d0c0a',
          border: '2px solid #ff3800',
          boxShadow: '4px 4px 0 #000',
          padding: '20px',
        }}>
          <label style={{
            display: 'block',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '9px',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            opacity: 0.5,
            marginBottom: '8px',
          }}>
            Developer Passphrase
          </label>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter developer key"
            autoFocus
            className="editor-input"
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: '16px' }}
          />
          <button className="editor-button primary" type="submit" style={{ width: '100%' }}>
            Establish Uplink
          </button>
          {error && (
            <div style={{
              marginTop: '12px',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '10px',
              color: '#ff3800',
              textAlign: 'center',
            }}>
              LINK REJECTED: INVALID KEY
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

interface LogEntry {
  text: string;
  type: 'info' | 'error' | 'warn';
  time: string;
}

// Perspective constants
const LANE_COUNT = 3;
const HW_TOP = 0.54;
const HW_BOT = 0.95;
const HIT_RATIO = 0.72;

export default function BeatmapEditor() {
  const [, setLocation] = useLocation();
  const [authenticated, setAuthenticated] = useState(() =>
    sessionStorage.getItem(ADMIN_AUTH_KEY) === 'true'
  );

  // Song catalog states
  const [songList, setSongList] = useState<GameSong[]>([]);
  const [selectedSongId, setSelectedSongId] = useState<string>('');
  const [selectedSong, setSelectedSong] = useState<GameSong | null>(null);

  // Editor states
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [pressedLanes, setPressedLanes] = useState<boolean[]>([false, false, false]);

  // Settings states
  const [playSpeed, setPlaySpeed] = useState<number>(1.0);
  const [quantize, setQuantize] = useState<number>(16); // 16th notes snap by default
  const [zoom, setZoom] = useState<number>(140); // translates to approach time
  const [activeTool, setActiveTool] = useState<'select' | 'tap' | 'hold' | 'swipe' | 'slide'>('select');
  
  // Note configuration
  const [swipeDir, setSwipeDir] = useState<NonNullable<Note['swipeDirection']>>('up');
  const [slideTarget, setSlideTarget] = useState<number>(2);
  const [latencyOffset, setLatencyOffset] = useState<number>(0.02);

  // Dragging tracking states
  const [draggedNoteId, setDraggedNoteId] = useState<number | null>(null);
  const [resizeHoldId, setResizeHoldId] = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [hoverPosition, setHoverPosition] = useState<{ lane: number; time: number } | null>(null);

  // Dev logger console
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Latency-compensated note tapper helper
  const snapToGrid = useCallback((time: number, bpm: number, quantizeVal: number) => {
    if (quantizeVal === 0) return time;
    const beatDuration = 60 / bpm;
    const stepDuration = beatDuration * (4 / quantizeVal);
    return Math.round(time / stepDuration) * stepDuration;
  }, []);

  // Logger
  const log = useCallback((text: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString().split(' ')[0];
    setLogs(prev => [...prev.slice(-40), { text, type, time }]);
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Fetch song catalog
  useEffect(() => {
    loadCatalog()
      .then(list => {
        setSongList(list.sort((a, b) => a.day - b.day));
        log('Fetched song catalog successfully.');
      })
      .catch(err => {
        log(`Failed to load song catalog: ${err.message}`, 'error');
      });
  }, [log]);

  // Fetch song details
  useEffect(() => {
    if (!selectedSongId) {
      setSelectedSong(null);
      setNotes([]);
      setSelectedNoteId(null);
      return;
    }

    getSongById(selectedSongId).then(song => {
      if (song) {
        setSelectedSong(song);
        const sortedNotes = Array.isArray(song.notes) ? [...song.notes].sort((a, b) => a.time - b.time) : [];
        setNotes(sortedNotes);
        setSelectedNoteId(null);
        log(`Loaded song chart: "${song.title}" (${sortedNotes.length} notes, BPM: ${song.bpm})`);
      }
    });
  }, [selectedSongId, log]);

  // Audio setup
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }

    if (selectedSong?.audioUrl) {
      const audio = new Audio(selectedSong.audioUrl);
      audio.crossOrigin = "anonymous";
      audioRef.current = audio;

      const handleTimeUpdate = () => {
        setCurrentTime(audio.currentTime);
      };
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleEnded = () => {
        setIsPlaying(false);
        log('Playback complete.');
      };

      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('ended', handleEnded);

      audio.playbackRate = playSpeed;

      return () => {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('ended', handleEnded);
        audio.pause();
      };
    }
  }, [selectedSong, playSpeed, log]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        log(`Playback blocked: ${err.message}`, 'error');
      });
    }
  }, [isPlaying, log]);

  // Seek helper
  const seek = (time: number) => {
    const clamped = Math.max(0, Math.min(selectedSong?.duration || 0, time));
    setCurrentTime(clamped);
    if (audioRef.current) {
      audioRef.current.currentTime = clamped;
    }
  };

  // Speed controls
  const changeSpeed = (speed: number) => {
    setPlaySpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
    log(`Playback rate set to ${speed}x`);
  };

  // Approach time computation (derived from zoom slider)
  // Zoom 60 (low zoom, slow speed, large view time = 4.0s)
  // Zoom 280 (high zoom, fast speed, small view time = 1.0s)
  const AT = useMemo(() => {
    return 4.0 - ((zoom - 60) / 220) * 3.0;
  }, [zoom]);

  // Geometry projection functions
  const lerp = (a: number, b: number, t: number) => {
    return a + (b - a) * Math.max(0, Math.min(1, t));
  };

  const hwAtProgress = useCallback((p: number, W: number) => {
    const w = W * lerp(HW_TOP, HW_BOT, p);
    const l = (W - w) / 2;
    return { left: l, right: l + w, width: w };
  }, []);

  const laneAt = useCallback((lane: number, progress: number, W: number) => {
    const { left, width } = hwAtProgress(progress, W);
    const lw = width / LANE_COUNT;
    return { x: left + lane * lw, w: lw };
  }, [hwAtProgress]);

  // Insert a note
  const insertNote = useCallback((lane: number, timeVal: number, typeOverride?: Note['type']) => {
    if (!selectedSong) return;
    const snappedTime = snapToGrid(timeVal, selectedSong.bpm, quantize);

    if (snappedTime < 0) return;

    // Dupe check
    const exists = notes.some(n => n.lane === lane && Math.abs(n.time - snappedTime) < 0.01);
    if (exists) return;

    const maxId = notes.reduce((max, n) => Math.max(max, n.id), -1);
    const type = typeOverride || (activeTool === 'select' ? 'tap' : activeTool);

    const newNote: Note = {
      id: maxId + 1,
      time: snappedTime,
      lane,
      type,
    };

    if (type === 'hold' || type === 'slide') {
      newNote.type = 'hold';
      newNote.holdDuration = 60 / selectedSong.bpm; // default 1 beat duration
      if (type === 'slide') {
        newNote.targetLane = slideTarget;
      }
    } else if (type === 'swipe') {
      newNote.swipeDirection = swipeDir;
    }

    setNotes(prev => [...prev, newNote].sort((a, b) => a.time - b.time));
    setSelectedNoteId(newNote.id);
    log(`Note added: ${type.toUpperCase()} at Lane ${lane} / Time ${snappedTime.toFixed(3)}s`);
  }, [selectedSong, notes, activeTool, swipeDir, slideTarget, quantize, snapToGrid, log]);

  // Live recording hotkey listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      const key = e.key.toLowerCase();
      let lane = -1;

      if (key === 'a' || key === 'j') lane = 0;
      else if (key === 's' || key === 'k') lane = 1;
      else if (key === 'd' || key === 'l') lane = 2;

      if (lane !== -1) {
        e.preventDefault();
        setPressedLanes(prev => {
          const updated = [...prev];
          updated[lane] = true;
          return updated;
        });

        if (selectedSong && audioRef.current) {
          const tapTime = audioRef.current.currentTime - latencyOffset;
          insertNote(lane, tapTime);
        }
      } else if (key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (key === 'delete' || key === 'backspace') {
        if (selectedNoteId !== null) {
          e.preventDefault();
          setNotes(prev => prev.filter(n => n.id !== selectedNoteId));
          setSelectedNoteId(null);
          log(`Deleted note ID ${selectedNoteId}`);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      let lane = -1;
      if (key === 'a' || key === 'j') lane = 0;
      else if (key === 's' || key === 'k') lane = 1;
      else if (key === 'd' || key === 'l') lane = 2;

      if (lane !== -1) {
        setPressedLanes(prev => {
          const updated = [...prev];
          updated[lane] = false;
          return updated;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedSong, selectedNoteId, latencyOffset, insertNote, togglePlay, log]);

  // Selected note updates
  const updateSelectedNote = (updater: (n: Note) => Note) => {
    if (selectedNoteId === null) return;
    setNotes(prev => prev.map(n => n.id === selectedNoteId ? updater(n) : n).sort((a, b) => a.time - b.time));
  };

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedSong) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      const hitY = H * HIT_RATIO;

      ctx.clearRect(0, 0, W, H);

      // Deep Space background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#040306');
      bgGrad.addColorStop(0.5, '#07060f');
      bgGrad.addColorStop(1, '#0b0a16');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Draw the perspective grid highway
      const hwTop = hwAtProgress(0, W);
      const hwBot = hwAtProgress(1, W);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(hwTop.left, 0);
      ctx.lineTo(hwTop.right, 0);
      ctx.lineTo(hwBot.right, hitY);
      ctx.lineTo(hwBot.left, hitY);
      ctx.closePath();
      ctx.clip();

      // Draw highway track base
      ctx.fillStyle = '#080814';
      ctx.fillRect(0, 0, W, hitY);

      // Draw subtle background scan lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
      ctx.lineWidth = 1;
      for (let y = 0; y < hitY; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Draw lane dividers
      for (let l = 1; l < LANE_COUNT; l++) {
        const topPos = laneAt(l, 0, W);
        const botPos = laneAt(l, 1, W);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(topPos.x, 0);
        ctx.lineTo(botPos.x, hitY);
        ctx.stroke();
      }

      // Draw quantized grid lines representing beats
      const beatDuration = 60 / selectedSong.bpm;
      const spacingRatio = quantize > 0 ? (4 / quantize) : 1;
      const step = beatDuration * spacingRatio;

      // Find visible range of grid lines
      const minVisibleTime = currentTime - 0.2;
      const maxVisibleTime = currentTime + AT * 1.5;
      const firstGridTime = Math.floor(minVisibleTime / step) * step;

      for (let tLine = Math.max(0, firstGridTime); tLine <= maxVisibleTime; tLine += step) {
        const pLine = 1.0 - (tLine - currentTime) / AT;
        if (pLine < -0.2 || pLine > 1.3) continue;

        const { left, right } = hwAtProgress(pLine, W);
        const yLine = pLine * hitY;

        const beatNum = tLine / beatDuration;
        const isBar = Math.abs(beatNum % 4) < 0.001;
        const isBeat = Math.abs(beatNum % 1) < 0.001;

        if (isBar) {
          ctx.strokeStyle = 'rgba(255, 56, 0, 0.35)';
          ctx.lineWidth = 2;
        } else if (isBeat) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 1;
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.lineWidth = 1;
        }

        ctx.beginPath();
        ctx.moveTo(left, yLine);
        ctx.lineTo(right, yLine);
        ctx.stroke();

        // Render bar / beat labels on the left edge of the highway
        if (isBar || isBeat) {
          ctx.fillStyle = isBar ? 'rgba(255, 56, 0, 0.5)' : 'rgba(255, 255, 255, 0.3)';
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.textAlign = 'right';
          ctx.fillText(
            isBar ? `BAR ${Math.round(beatNum / 4) + 1}` : `B ${Math.round(beatNum)}`,
            left - 8,
            yLine + 3
          );
        }
      }

      ctx.restore(); // Restore from clipping path

      // Draw the hit line (baseline running across bottom)
      ctx.strokeStyle = '#ff3800';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hwBot.left, hitY);
      ctx.lineTo(hwBot.right, hitY);
      ctx.stroke();
      
      // Draw outer rails
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hwTop.left, 0);
      ctx.lineTo(hwBot.left, hitY);
      ctx.moveTo(hwTop.right, 0);
      ctx.lineTo(hwBot.right, hitY);
      ctx.stroke();

      // Draw lane buttons below the hit line (acting as inputs)
      const btnH = H - hitY;
      for (let i = 0; i < LANE_COUNT; i++) {
        const { x, w } = laneAt(i, 1, W);
        const pressed = pressedLanes[i];
        const bx = x + 3;
        const bw = w - 6;

        const colorMap = ['#ff007f', '#00f0ff', '#39ff14'];
        const activeColor = colorMap[i];

        ctx.fillStyle = pressed ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.05)';
        ctx.strokeStyle = pressed ? activeColor : 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.roundRect(bx, hitY + 4, bw, btnH - 12, 6);
        ctx.fill();
        ctx.stroke();

        // Highlight stripe
        ctx.fillStyle = pressed ? activeColor : 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.roundRect(bx + bw / 2 - 12, hitY + 8, 24, 3, 1.5);
        ctx.fill();

        // Keyboard Label mapping helper
        const labels = ['A / J', 'S / K', 'D / L'];
        ctx.fillStyle = pressed ? '#fff' : 'rgba(255,255,255,0.4)';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(labels[i], x + w / 2, hitY + btnH / 2 + 2);
      }

      // Draw notes flowing down highway
      notes.forEach(note => {
        const pNote = 1.0 - (note.time - currentTime) / AT;
        if (pNote < -0.3 || pNote > 1.4) return; // culling

        const isSelected = selectedNoteId === note.id;

        if (note.type === 'hold') {
          // Draw HOLD / SLIDE note body
          const dur = note.holdDuration || 0.5;
          const pEnd = 1.0 - (note.time + dur - currentTime) / AT;

          const startLane = note.lane;
          const endLane = note.targetLane !== undefined ? note.targetLane : note.lane;

          const { x: sx, w: sw } = laneAt(startLane, pNote, W);
          const startX = sx + sw / 2;
          const startY = pNote * hitY;

          const { x: ex, w: ew } = laneAt(endLane, pEnd, W);
          const endX = ex + ew / 2;
          const endY = pEnd * hitY;

          // Draw the scrolling ribbon body
          ctx.save();
          const ribbonGrad = ctx.createLinearGradient(0, startY, 0, endY);
          ribbonGrad.addColorStop(0, isSelected ? 'rgba(168, 85, 247, 0.5)' : 'rgba(168, 85, 247, 0.35)');
          ribbonGrad.addColorStop(1, 'rgba(168, 85, 247, 0.08)');
          ctx.fillStyle = ribbonGrad;

          ctx.beginPath();
          ctx.moveTo(startX - sw * 0.22, startY);
          ctx.lineTo(startX + sw * 0.22, startY);
          ctx.lineTo(endX + ew * 0.15, endY);
          ctx.lineTo(endX - ew * 0.15, endY);
          ctx.closePath();
          ctx.fill();

          // Connective center line
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = isSelected ? 3 : 1.5;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          ctx.restore();

          // Draw start note cap
          drawNoteMarker(ctx, startX, startY, sw * 0.7, 'hold', isSelected);

          // Draw end release handle note cap
          drawNoteMarker(ctx, endX, endY, ew * 0.5, 'hold-end', isSelected);

        } else {
          // Normal TAP / SWIPE notes
          const { x, w } = laneAt(note.lane, pNote, W);
          const cx = x + w / 2;
          const cy = pNote * hitY;

          drawNoteMarker(ctx, cx, cy, w * 0.7, note.type, isSelected, note.swipeDirection);
        }
      });

      // Draw drag/drop placement preview if hovering
      if (activeTool !== 'select' && hoverPosition) {
        const pPreview = 1.0 - (hoverPosition.time - currentTime) / AT;
        if (pPreview >= -0.2 && pPreview <= 1.3) {
          const { x, w } = laneAt(hoverPosition.lane, pPreview, W);
          const cx = x + w / 2;
          const cy = pPreview * hitY;

          ctx.save();
          ctx.globalAlpha = 0.5;
          drawNoteMarker(ctx, cx, cy, w * 0.7, activeTool === 'slide' ? 'hold' : activeTool, false, swipeDir);
          ctx.restore();
        }
      }

      animFrame = requestAnimationFrame(render);
    };

    // Render helper function for notes
    const drawNoteMarker = (
      c: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      size: number,
      type: string,
      selected: boolean,
      dir?: Note['swipeDirection']
    ) => {
      c.save();
      
      if (selected) {
        c.shadowColor = '#ffffff';
        c.shadowBlur = 12;
      }

      if (type === 'tap') {
        // Glowing Cyan circle tapper
        c.strokeStyle = '#00f0ff';
        c.lineWidth = selected ? 3.5 : 2;
        const rad = size * 0.38;
        
        c.fillStyle = 'rgba(0, 240, 255, 0.15)';
        c.beginPath();
        c.arc(cx, cy, rad, 0, Math.PI * 2);
        c.fill();
        c.stroke();

        // Inner core
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(cx, cy, rad * 0.45, 0, Math.PI * 2);
        c.fill();

      } else if (type === 'swipe') {
        // Hot Pink diamond swipe
        c.strokeStyle = '#ff007f';
        c.lineWidth = selected ? 3.5 : 2;
        c.fillStyle = 'rgba(255, 0, 127, 0.2)';
        
        const side = size * 0.38;
        c.beginPath();
        c.moveTo(cx, cy - side);
        c.lineTo(cx + side, cy);
        c.lineTo(cx, cy + side);
        c.lineTo(cx - side, cy);
        c.closePath();
        c.fill();
        c.stroke();

        // Draw arrow indicator
        c.strokeStyle = '#ffffff';
        c.lineWidth = 2.5;
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.beginPath();
        
        const arrowLen = side * 0.45;
        if (dir === 'up') {
          c.moveTo(cx, cy + arrowLen); c.lineTo(cx, cy - arrowLen);
          c.moveTo(cx - arrowLen * 0.6, cy - arrowLen * 0.3); c.lineTo(cx, cy - arrowLen); c.lineTo(cx + arrowLen * 0.6, cy - arrowLen * 0.3);
        } else if (dir === 'down') {
          c.moveTo(cx, cy - arrowLen); c.lineTo(cx, cy + arrowLen);
          c.moveTo(cx - arrowLen * 0.6, cy + arrowLen * 0.3); c.lineTo(cx, cy + arrowLen); c.lineTo(cx + arrowLen * 0.6, cy + arrowLen * 0.3);
        } else if (dir === 'left') {
          c.moveTo(cx + arrowLen, cy); c.lineTo(cx - arrowLen, cy);
          c.moveTo(cx - arrowLen * 0.3, cy - arrowLen * 0.6); c.lineTo(cx - arrowLen, cy); c.lineTo(cx - arrowLen * 0.3, cy + arrowLen * 0.6);
        } else if (dir === 'right') {
          c.moveTo(cx - arrowLen, cy); c.lineTo(cx + arrowLen, cy);
          c.moveTo(cx + arrowLen * 0.3, cy - arrowLen * 0.6); c.lineTo(cx + arrowLen, cy); c.lineTo(cx + arrowLen * 0.3, cy + arrowLen * 0.6);
        } else {
          // fallback circle center
          c.fillStyle = '#ffffff';
          c.arc(cx, cy, 3, 0, Math.PI*2);
          c.fill();
        }
        c.stroke();

      } else if (type === 'hold') {
        // Purple capsule hold start
        c.strokeStyle = '#a855f7';
        c.lineWidth = selected ? 3.5 : 2;
        c.fillStyle = 'rgba(168, 85, 247, 0.28)';
        
        const rWidth = size * 0.7;
        const rHeight = size * 0.28;
        
        c.beginPath();
        c.roundRect(cx - rWidth / 2, cy - rHeight / 2, rWidth, rHeight, rHeight / 2);
        c.fill();
        c.stroke();

        // Core line
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(cx, cy, 3, 0, Math.PI * 2);
        c.fill();

      } else if (type === 'hold-end') {
        // Smaller light release node
        c.strokeStyle = '#c084fc';
        c.lineWidth = 1.5;
        c.fillStyle = 'rgba(168, 85, 247, 0.8)';
        
        c.beginPath();
        c.arc(cx, cy, size * 0.28, 0, Math.PI * 2);
        c.fill();
        c.stroke();

        // Inner core
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(cx, cy, 2, 0, Math.PI*2);
        c.fill();
      }

      c.restore();
    };

    render();

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [selectedSong, notes, currentTime, AT, quantize, selectedNoteId, hoverPosition, swipeDir, pressedLanes, activeTool, hwAtProgress, laneAt]);

  // Coordinate conversion helper (mouse events to lane + snapped seconds)
  const getPositionFromEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedSong) return null;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = canvas.width / dpr;
    const canvasHeight = canvas.height / dpr;
    const hitY = canvasHeight * HIT_RATIO;

    // Solve for progress p: my = p * hitY => p = my / hitY
    const p = my / hitY;

    // Time calculation: p = 1.0 - (time - currentTime) / AT => (time - currentTime)/AT = 1 - p => time = currentTime + AT * (1 - p)
    const rawTime = currentTime + AT * (1.0 - p);
    const timeVal = Math.max(0, Math.min(selectedSong.duration, rawTime));

    // Lane calculation
    const { left, width } = hwAtProgress(p, canvasWidth);
    const lw = width / LANE_COUNT;
    const relativeX = mx - left;
    const laneVal = Math.max(0, Math.min(LANE_COUNT - 1, Math.floor(relativeX / lw)));

    return { lane: laneVal, time: timeVal, mx, my };
  };

  // Canvas Mouse Listeners
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPositionFromEvent(e);
    if (!pos || !selectedSong) return;

    // Click threshold to select note
    const dpr = window.devicePixelRatio || 1;
    const W = canvasRef.current!.width / dpr;
    const H = canvasRef.current!.height / dpr;
    const hitY = H * HIT_RATIO;

    let clickedNoteId: number | null = null;
    let clickedResizeId: number | null = null;

    // Check hit intersections (in reverse order to select top/closest notes)
    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i];
      const pNote = 1.0 - (note.time - currentTime) / AT;
      if (pNote < -0.3 || pNote > 1.3) continue;

      const { x: sx, w: sw } = laneAt(note.lane, pNote, W);
      const cx = sx + sw / 2;
      const cy = pNote * hitY;

      // Tap or Swipe hit validation
      if (note.type !== 'hold') {
        const dist = Math.hypot(pos.mx - cx, pos.my - cy);
        if (dist < 20) {
          clickedNoteId = note.id;
          break;
        }
      } else {
        // Hold/Slide validation: Check start note and end release note
        const dur = note.holdDuration || 0.5;
        const pEnd = 1.0 - (note.time + dur - currentTime) / AT;
        const endLane = note.targetLane !== undefined ? note.targetLane : note.lane;
        const { x: ex, w: ew } = laneAt(endLane, pEnd, W);
        const endX = ex + ew / 2;
        const endY = pEnd * hitY;

        // Check end release handle first (for resizing)
        const distEnd = Math.hypot(pos.mx - endX, pos.my - endY);
        if (distEnd < 16 && selectedNoteId === note.id) {
          clickedResizeId = note.id;
          break;
        }

        // Check start handle
        const distStart = Math.hypot(pos.mx - cx, pos.my - cy);
        if (distStart < 20) {
          clickedNoteId = note.id;
          break;
        }

        // Check along the holding tail ribbon
        if (pos.my >= Math.min(startY_calc(note), endY_calc(note)) && pos.my <= Math.max(startY_calc(note), endY_calc(note))) {
          // Solve target lane alignment
          const segmentProg = pos.my / hitY;
          const currentHoldLane = lerp(note.lane, endLane, (segmentProg - pNote) / (pEnd - pNote));
          const { x: segX, w: segW } = laneAt(currentHoldLane, segmentProg, W);
          const segCenterX = segX + segW / 2;
          if (Math.abs(pos.mx - segCenterX) < segW * 0.35) {
            clickedNoteId = note.id;
            break;
          }
        }
      }
    }

    // Helper functions for hold positioning
    function startY_calc(n: Note) {
      const pNote = 1.0 - (n.time - currentTime) / AT;
      return pNote * hitY;
    }
    function endY_calc(n: Note) {
      const dur = n.holdDuration || 0.5;
      const pEnd = 1.0 - (n.time + dur - currentTime) / AT;
      return pEnd * hitY;
    }

    if (clickedResizeId !== null) {
      setResizeHoldId(clickedResizeId);
      setSelectedNoteId(clickedResizeId);
    } else if (clickedNoteId !== null) {
      setDraggedNoteId(clickedNoteId);
      setSelectedNoteId(clickedNoteId);
    } else {
      // Clicked empty lane area:
      if (activeTool !== 'select') {
        // Place a new note
        const rawTime = pos.time;
        insertNote(pos.lane, rawTime);
      } else {
        // Enter timeline scrubbing mode
        setIsScrubbing(true);
        seek(pos.time);
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPositionFromEvent(e);
    if (!pos || !selectedSong) return;

    // Hover preview update
    const snappedTime = snapToGrid(pos.time, selectedSong.bpm, quantize);
    setHoverPosition({ lane: pos.lane, time: snappedTime });

    if (draggedNoteId !== null) {
      // Dragging a note to edit time/lane coordinates
      const snappedT = snapToGrid(pos.time, selectedSong.bpm, quantize);
      setNotes(prev => prev.map(n => {
        if (n.id === draggedNoteId) {
          return { ...n, lane: pos.lane, time: snappedT };
        }
        return n;
      }));
    } else if (resizeHoldId !== null) {
      // Resizing a hold note duration
      const note = notes.find(n => n.id === resizeHoldId);
      if (note) {
        const snappedEnd = snapToGrid(pos.time, selectedSong.bpm, quantize);
        const newDur = Math.max(0.02, snappedEnd - note.time);
        setNotes(prev => prev.map(n => n.id === resizeHoldId ? { ...n, holdDuration: newDur } : n));
      }
    } else if (isScrubbing) {
      // Scrubbing playhead time
      seek(pos.time);
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggedNoteId(null);
    setResizeHoldId(null);
    setIsScrubbing(false);
    // Sort notes chronologically to clean array structure
    setNotes(prev => [...prev].sort((a, b) => a.time - b.time));
  };

  // Mouse wheel scrubbing
  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!selectedSong) return;
    const delta = e.deltaY > 0 ? 0.2 : -0.2;
    seek(currentTime + delta);
  };

  // Clipboard copy full chart
  const handleCopyJson = () => {
    if (!selectedSong) return;
    const fullSong = {
      ...selectedSong,
      notes: notes,
    };
    navigator.clipboard.writeText(JSON.stringify(fullSong, null, 2));
    log('Copied full beatmap JSON to clipboard!');
  };

  // Download chart file
  const handleDownloadJson = () => {
    if (!selectedSong) return;
    const fullSong = {
      ...selectedSong,
      notes: notes,
    };
    const jsonStr = JSON.stringify(fullSong, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileId = selectedSong.id.startsWith('day-') ? selectedSong.id : `day-${String(selectedSong.day).padStart(3, '0')}`;
    a.download = `${fileId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    log(`Downloaded ${fileId}.json successfully!`);
  };

  const handleClearChart = () => {
    if (window.confirm('Clear the entire note chart for this song?')) {
      setNotes([]);
      setSelectedNoteId(null);
      log('Cleared all notes from chart.', 'warn');
    }
  };

  const selectedNote = useMemo(() => {
    return notes.find(n => n.id === selectedNoteId) || null;
  }, [notes, selectedNoteId]);

  if (!authenticated) {
    return (
      <div className="editor-wrapper">
        <AdminGate onAuthenticate={() => setAuthenticated(true)} />
      </div>
    );
  }

  return (
    <div className="editor-wrapper">
      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header className="editor-header">
        <div className="editor-title-box">
          <button 
            onClick={() => setLocation('/admin')}
            className="editor-button" 
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
          >
            <ChevronLeft size={14} /> Back
          </button>
          <span style={{ fontFamily: '"Impact", sans-serif', fontSize: '20px', letterSpacing: '0.02em', color: '#ff3800' }}>
            BEATMAP STUDIO
          </span>
          <span className="editor-badge">v3.0 PERSPECTIVE</span>
        </div>

        <div className="editor-header-controls">
          <select 
            className="editor-select" 
            value={selectedSongId}
            onChange={(e) => setSelectedSongId(e.target.value)}
            style={{ width: '220px' }}
          >
            <option value="">-- Select Release Song --</option>
            {songList.map(s => (
              <option key={s.id} value={s.id}>
                Day {String(s.day).padStart(3, '0')}: {s.title}
              </option>
            ))}
          </select>

          <button 
            onClick={handleCopyJson} 
            disabled={!selectedSong} 
            className="editor-button"
            title="Copy full chart JSON to clipboard"
          >
            <Copy size={12} style={{ marginRight: '4px' }} /> Copy JSON
          </button>
          
          <button 
            onClick={handleDownloadJson} 
            disabled={!selectedSong} 
            className="editor-button primary"
            title="Download song file"
          >
            <Download size={12} style={{ marginRight: '4px' }} /> Download JSON
          </button>
        </div>
      </header>

      {/* ══ WORKSPACE ══════════════════════════════════════════════════════ */}
      <div className="editor-workspace">
        {/* LEFT PANEL: Setup & Controls */}
        <aside className="editor-panel-left">
          <div className="editor-panel-section">
            <div className="editor-section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sliders size={14} /> Controls
            </div>
            
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '8px', opacity: 0.5 }}>Perspective View Speed</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input 
                  type="range" 
                  min={60} 
                  max={280} 
                  value={zoom} 
                  onChange={(e) => setZoom(Number(e.target.value))} 
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: '9px', width: '38px', textAlign: 'right' }}>AT: {AT.toFixed(1)}s</span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '8px', opacity: 0.5 }}>Quantize grid snap</label>
              <select 
                className="editor-select" 
                value={quantize} 
                onChange={(e) => setQuantize(Number(e.target.value))}
                style={{ marginTop: '4px' }}
              >
                <option value={0}>Free Placement (No Snap)</option>
                <option value={4}>1/4 Quarter Notes</option>
                <option value={8}>1/8 Eighth Notes</option>
                <option value={16}>1/16 Sixteenth Notes</option>
                <option value={32}>1/32 Thirty-Second Notes</option>
              </select>
            </div>
          </div>

          <div className="editor-panel-section">
            <div className="editor-section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={14} /> Tool Palette
            </div>
            
            <div className="editor-tool-grid">
              {(['select', 'tap', 'hold', 'swipe', 'slide'] as const).map(tool => (
                <button
                  key={tool}
                  onClick={() => setActiveTool(tool)}
                  className={`editor-tool-btn ${activeTool === tool ? 'active' : ''}`}
                >
                  <span style={{ fontSize: '10px', fontWeight: 900 }}>{tool.toUpperCase()}</span>
                </button>
              ))}
            </div>

            {activeTool === 'swipe' && (
              <div style={{ marginTop: '12px' }}>
                <label style={{ fontSize: '8px', opacity: 0.5 }}>Swipe Direction</label>
                <select 
                  className="editor-select" 
                  value={swipeDir} 
                  onChange={(e) => setSwipeDir(e.target.value as any)}
                  style={{ marginTop: '4px' }}
                >
                  <option value="up">Up (↑)</option>
                  <option value="down">Down (↓)</option>
                  <option value="left">Left (←)</option>
                  <option value="right">Right (→)</option>
                  <option value="up-left">Up-Left (↖)</option>
                  <option value="up-right">Up-Right (↗)</option>
                  <option value="down-left">Down-Left (↙)</option>
                  <option value="down-right">Down-Right (↘)</option>
                </select>
              </div>
            )}

            {activeTool === 'slide' && (
              <div style={{ marginTop: '12px' }}>
                <label style={{ fontSize: '8px', opacity: 0.5 }}>Slide Target Lane</label>
                <select 
                  className="editor-select" 
                  value={slideTarget} 
                  onChange={(e) => setSlideTarget(Number(e.target.value))}
                  style={{ marginTop: '4px' }}
                >
                  <option value={0}>Lane 0 (Left)</option>
                  <option value={1}>Lane 1 (Center)</option>
                  <option value={2}>Lane 2 (Right)</option>
                </select>
              </div>
            )}
          </div>

          <div className="editor-panel-section">
            <div className="editor-section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Info size={14} /> Latency
            </div>
            <div className="editor-field">
              <label>Tap Recording Latency Offset</label>
              <input 
                type="number" 
                step={0.01} 
                value={latencyOffset} 
                onChange={(e) => setLatencyOffset(Number(e.target.value))}
                className="editor-input"
                style={{ marginTop: '4px' }}
              />
              <span style={{ fontSize: '7.5px', opacity: 0.4, marginTop: '2px', lineHeight: 1.3 }}>
                Subtracts seconds from real tapper key recordings to align with audio.
              </span>
            </div>
          </div>

          <div className="editor-panel-section" style={{ marginTop: 'auto' }}>
            <button onClick={handleClearChart} disabled={!selectedSong} className="editor-button" style={{ width: '100%', borderColor: '#ff3800', color: '#ff3800' }}>
              Clear Entire Chart
            </button>
          </div>
        </aside>

        {/* TOP PANEL: Playback Speed & Scrubber */}
        <div className="editor-panel-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={togglePlay} disabled={!selectedSong} className="editor-button primary" style={{ width: '90px' }}>
              {isPlaying ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}><Pause size={12} /> PAUSE</span> : <span style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}><Play size={12} /> PLAY</span>}
            </button>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', opacity: 0.7 }}>
              {currentTime.toFixed(3)}s / {(selectedSong?.duration || 0).toFixed(1)}s
            </span>
          </div>

          {/* Scrubber / Speed settings */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '9px', opacity: 0.5 }}>PLAYBACK SPEED</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[0.25, 0.5, 0.75, 1.0].map(speed => (
                <button
                  key={speed}
                  onClick={() => changeSpeed(speed)}
                  className={`editor-button ${playSpeed === speed ? 'accent' : ''}`}
                  style={{ padding: '4px 8px', fontSize: '9px' }}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER PANEL: Perspective Track Canvas */}
        <div className="editor-timeline-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          {selectedSong ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              {/* Canvas viewport */}
              <div className="canvas-perspective-frame" style={{
                position: 'relative',
                background: '#040306',
                border: '3px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 0 40px rgba(0,0,0,0.8), inset 0 0 20px rgba(255,255,255,0.02)',
                borderRadius: '8px',
                width: '420px',
                height: '560px',
                overflow: 'hidden'
              }}>
                <canvas
                  ref={canvasRef}
                  width={420 * (window.devicePixelRatio || 1)}
                  height={560 * (window.devicePixelRatio || 1)}
                  style={{ width: '420px', height: '560px', display: 'block', cursor: activeTool === 'select' ? 'default' : 'crosshair' }}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  onWheel={handleCanvasWheel}
                />
              </div>

              {/* Bottom Scrubber Bar */}
              <div className="editor-scrubber" 
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  seek(pct * selectedSong.duration);
                }}
                style={{ width: '420px' }}
              >
                <div 
                  className="editor-scrubber-progress" 
                  style={{ width: `${(currentTime / selectedSong.duration) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', opacity: 0.3 }}>
              <Eye size={32} />
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                Select a release song to load beatmap studio
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM PANEL: Code Output & Logging Console */}
        <div className="editor-panel-bottom">
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ fontSize: '8px', textTransform: 'uppercase', opacity: 0.5, marginBottom: '4px' }}>
              Chart Output Stream (JSON Preview)
            </div>
            <div className="json-preview">
              {selectedSong ? JSON.stringify({ ...selectedSong, notes }, null, 2) : 'No song loaded.'}
            </div>
          </div>

          <div style={{ width: '300px', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ fontSize: '8px', textTransform: 'uppercase', opacity: 0.5, marginBottom: '4px' }}>
              System Logging Console
            </div>
            <div className="editor-log-console">
              {logs.map((logItem, idx) => (
                <div key={idx} className={`editor-log-entry ${logItem.type}`}>
                  [{logItem.time}] {logItem.text}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Note Inspector & Guides */}
        <aside className="editor-panel-right">
          <div className="editor-panel-section">
            <div className="editor-section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sliders size={14} /> Inspector
            </div>
            {selectedNote ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="editor-field">
                  <label>Selected Note ID</label>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>Note #{selectedNote.id}</div>
                </div>

                <div className="editor-field">
                  <label>Time Position (Seconds)</label>
                  <input 
                    type="number" 
                    step={0.001} 
                    value={Number(selectedNote.time.toFixed(3))}
                    onChange={(e) => updateSelectedNote(n => ({ ...n, time: Number(e.target.value) }))}
                    className="editor-input"
                    style={{ marginTop: '4px' }}
                  />
                </div>

                <div className="editor-field">
                  <label>Primary Lane</label>
                  <select 
                    className="editor-select" 
                    value={selectedNote.lane}
                    onChange={(e) => updateSelectedNote(n => ({ ...n, lane: Number(e.target.value) }))}
                    style={{ marginTop: '4px' }}
                  >
                    <option value={0}>Lane 0 (Left)</option>
                    <option value={1}>Lane 1 (Center)</option>
                    <option value={2}>Lane 2 (Right)</option>
                  </select>
                </div>

                <div className="editor-field">
                  <label>Note Type</label>
                  <select 
                    className="editor-select" 
                    value={selectedNote.type}
                    onChange={(e) => updateSelectedNote(n => {
                      const updated = { ...n, type: e.target.value as any };
                      if (updated.type === 'hold' && !updated.holdDuration) {
                        updated.holdDuration = 0.5;
                      }
                      return updated;
                    })}
                    style={{ marginTop: '4px' }}
                  >
                    <option value="tap">TAP</option>
                    <option value="hold">HOLD (Slide)</option>
                    <option value="swipe">SWIPE</option>
                  </select>
                </div>

                {selectedNote.type === 'hold' && (
                  <>
                    <div className="editor-field">
                      <label>Hold Duration (seconds)</label>
                      <input 
                        type="number" 
                        step={0.01} 
                        value={Number((selectedNote.holdDuration || 0.5).toFixed(2))}
                        onChange={(e) => updateSelectedNote(n => ({ ...n, holdDuration: Number(e.target.value) }))}
                        className="editor-input"
                        style={{ marginTop: '4px' }}
                      />
                    </div>
                    
                    <div className="editor-field">
                      <label>Slide Target Lane</label>
                      <select 
                        className="editor-select" 
                        value={selectedNote.targetLane ?? ''}
                        onChange={(e) => updateSelectedNote(n => {
                          const val = e.target.value;
                          return { ...n, targetLane: val === '' ? undefined : Number(val) };
                        })}
                        style={{ marginTop: '4px' }}
                      >
                        <option value="">Static Hold (No Slide)</option>
                        <option value={0}>Lane 0 (Left)</option>
                        <option value={1}>Lane 1 (Center)</option>
                        <option value={2}>Lane 2 (Right)</option>
                      </select>
                    </div>
                  </>
                )}

                {selectedNote.type === 'swipe' && (
                  <div className="editor-field">
                    <label>Swipe Direction</label>
                    <select 
                      className="editor-select" 
                      value={selectedNote.swipeDirection || 'up'}
                      onChange={(e) => updateSelectedNote(n => ({ ...n, swipeDirection: e.target.value as any }))}
                      style={{ marginTop: '4px' }}
                    >
                      <option value="up">Up (↑)</option>
                      <option value="down">Down (↓)</option>
                      <option value="left">Left (←)</option>
                      <option value="right">Right (→)</option>
                      <option value="up-left">Up-Left (↖)</option>
                      <option value="up-right">Up-Right (↗)</option>
                      <option value="down-left">Down-Left (↙)</option>
                      <option value="down-right">Down-Right (↘)</option>
                    </select>
                  </div>
                )}

                <button 
                  onClick={() => {
                    setNotes(prev => prev.filter(n => n.id !== selectedNoteId));
                    setSelectedNoteId(null);
                    log(`Deleted note ID ${selectedNoteId}`);
                  }} 
                  className="editor-button" 
                  style={{ width: '100%', borderColor: '#ff3800', color: '#ff3800', marginTop: '10px' }}
                >
                  <Trash size={10} style={{ marginRight: '4px' }} /> Delete Note
                </button>
              </div>
            ) : (
              <div style={{ fontSize: '9px', opacity: 0.4, textAlign: 'center', padding: '16px 0', border: '1px dashed rgba(255,255,255,0.06)' }}>
                Select a note on the highway or place one to inspect properties.
              </div>
            )}
          </div>

          <div className="editor-panel-section">
            <div className="editor-section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HelpCircle size={14} /> Hotkeys
            </div>
            <div className="help-grid">
              <span className="help-key">Space</span>
              <span className="help-desc">Play / Pause</span>

              <span className="help-key">A / J</span>
              <span className="help-desc">Lane 0 Tap</span>

              <span className="help-key">S / K</span>
              <span className="help-desc">Lane 1 Tap</span>

              <span className="help-key">D / L</span>
              <span className="help-desc">Lane 2 Tap</span>

              <span className="help-key">Del / Backspace</span>
              <span className="help-desc">Delete Note</span>

              <span className="help-key">Wheel</span>
              <span className="help-desc">Scrub Time</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
