import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation } from 'wouter';
import { 
  Play, Pause, Download, Copy, Trash, Settings, HelpCircle, 
  ChevronLeft, Save, Plus, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Music, RotateCcw
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
  const [isRecording, setIsRecording] = useState<boolean>(false);

  // Settings states
  const [playSpeed, setPlaySpeed] = useState<number>(1.0);
  const [quantize, setQuantize] = useState<number>(16); // 16th notes by default
  const [zoom, setZoom] = useState<number>(120); // pixels per second
  const [activeTool, setActiveTool] = useState<'select' | 'tap' | 'hold' | 'swipe' | 'slide'>('select');
  
  // Note creation configuration
  const [swipeDir, setSwipeDir] = useState<NonNullable<Note['swipeDirection']>>('up');
  const [slideTarget, setSlideTarget] = useState<number>(1);
  const [latencyOffset, setLatencyOffset] = useState<number>(0.0); // manual record offset calibration

  // Dev logger console
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Add logger function
  const log = useCallback((text: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString().split(' ')[0];
    setLogs(prev => [...prev.slice(-30), { text, type, time }]);
  }, []);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Load song catalog
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

  // Fetch song details including notes
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
      } else {
        log(`Song ID "${selectedSongId}" details not found.`, 'error');
      }
    });
  }, [selectedSongId, log]);

  // Audio setup and player hooks
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
        log('Audio track playback complete.');
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

  // Sync playhead auto-scrolling
  useEffect(() => {
    if (isPlaying && timelineContainerRef.current) {
      const container = timelineContainerRef.current;
      const playheadX = currentTime * zoom;
      const scrollLeft = container.scrollLeft;
      const width = container.clientWidth;

      if (playheadX > scrollLeft + width * 0.65 || playheadX < scrollLeft + width * 0.1) {
        container.scrollLeft = playheadX - width * 0.25;
      }
    }
  }, [currentTime, zoom, isPlaying]);

  // Toggle play state
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        log(`Audio play blocked: ${err.message}`, 'error');
      });
    }
  }, [isPlaying, log]);

  // Change playback speed
  const changeSpeed = (speed: number) => {
    setPlaySpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
    log(`Playback rate set to ${speed}x`);
  };

  // Seek time
  const seek = (time: number) => {
    const clamped = Math.max(0, Math.min(selectedSong?.duration || 0, time));
    setCurrentTime(clamped);
    if (audioRef.current) {
      audioRef.current.currentTime = clamped;
    }
  };

  // Quantization grid spacing helper
  const snapToGrid = useCallback((time: number, bpm: number, quantizeVal: number) => {
    if (quantizeVal === 0) return time;
    const beatDuration = 60 / bpm;
    const stepDuration = beatDuration * (4 / quantizeVal);
    return Math.round(time / stepDuration) * stepDuration;
  }, []);

  // Insert note logic
  const insertNote = useCallback((lane: number, timeVal: number) => {
    if (!selectedSong) return;
    const snappedTime = snapToGrid(timeVal, selectedSong.bpm, quantize);

    // Prevent duplicates
    const exists = notes.some(n => n.lane === lane && Math.abs(n.time - snappedTime) < 0.015);
    if (exists) {
      log(`Note already exists at Lane ${lane} / Time ${snappedTime.toFixed(3)}s`, 'warn');
      return;
    }

    const maxId = notes.reduce((max, n) => Math.max(max, n.id), -1);
    const newNote: Note = {
      id: maxId + 1,
      time: snappedTime,
      lane,
      type: activeTool === 'select' ? 'tap' : activeTool,
    };

    if (newNote.type === 'hold') {
      newNote.holdDuration = 60 / selectedSong.bpm; // Default to 1 beat duration
    }
    if (newNote.type === 'swipe') {
      newNote.swipeDirection = swipeDir;
    }

    setNotes(prev => [...prev, newNote].sort((a, b) => a.time - b.time));
    setSelectedNoteId(newNote.id);
    log(`Inserted ${newNote.type.toUpperCase()} note at Lane ${lane} / Time ${snappedTime.toFixed(3)}s`);
  }, [selectedSong, notes, activeTool, swipeDir, quantize, snapToGrid, log]);

  // Record key taps listener
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
        if (selectedSong && audioRef.current) {
          // Adjust for audio playback offset and calibration latency offset
          const recordTime = audioRef.current.currentTime - latencyOffset;
          insertNote(lane, recordTime);
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSong, togglePlay, insertNote, selectedNoteId, latencyOffset, log]);

  // Selected note detail update wrapper
  const updateSelectedNote = (updater: (n: Note) => Note) => {
    if (selectedNoteId === null) return;
    setNotes(prev => prev.map(n => n.id === selectedNoteId ? updater(n) : n).sort((a, b) => a.time - b.time));
  };

  // Timeline click seek or add notes
  const handleTimelineContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = timelineContainerRef.current;
    if (!container || !selectedSong) return;

    // Only scrub if clicked empty timeline background
    const target = e.target as HTMLElement;
    if (target !== container && !target.classList.contains('timeline-lane') && !target.classList.contains('timeline-lanes')) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left + container.scrollLeft;
    const timeVal = clickX / zoom;
    seek(timeVal);
  };

  // Click on a specific lane in a column to place note
  const handleLaneClick = (laneNum: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'select') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const timeVal = clickX / zoom;
    insertNote(laneNum, timeVal);
  };

  // Dragging note position
  const handleNoteDragStart = (noteId: number, startX: number, startTime: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedNoteId(noteId);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const timeChange = dx / zoom;
      let newTime = Math.max(0, startTime + timeChange);
      if (selectedSong) {
        newTime = Math.min(selectedSong.duration, newTime);
        newTime = snapToGrid(newTime, selectedSong.bpm, quantize);
      }
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, time: newTime } : n));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setNotes(prev => [...prev].sort((a, b) => a.time - b.time));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Resize hold duration handler
  const handleHoldResizeStart = (noteId: number, startX: number, startDuration: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const durationChange = dx / zoom;
      const newDuration = Math.max(0.05, startDuration + durationChange);
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, holdDuration: newDuration } : n));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Export JSON copy
  const handleCopyJson = () => {
    if (!selectedSong) return;
    const fullSong = {
      ...selectedSong,
      notes: notes,
    };
    navigator.clipboard.writeText(JSON.stringify(fullSong, null, 2));
    log('Copied chart JSON to clipboard!');
  };

  // Download JSON file
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

  // Clear all notes chart
  const handleClearChart = () => {
    if (window.confirm('Are you sure you want to clear the entire beatmap note chart for this song?')) {
      setNotes([]);
      setSelectedNoteId(null);
      log('Cleared all notes from beatmap.', 'warn');
    }
  };

  // Render Grid Lines calculation
  const gridLines = useMemo(() => {
    if (!selectedSong) return [];
    const linesArr = [];
    const beatDuration = 60 / selectedSong.bpm;
    const totalDuration = selectedSong.duration;
    
    // Increment at the minimum sub-beat spacing
    const spacingRatio = quantize > 0 ? (4 / quantize) : 1;
    const step = beatDuration * spacingRatio;
    
    for (let t = 0; t <= totalDuration; t += step) {
      const beatNum = t / beatDuration;
      const isMajor = Math.abs(beatNum - Math.round(beatNum)) < 0.001;
      const isBar = isMajor && (Math.round(beatNum) % 4 === 0);
      
      linesArr.push({
        time: t,
        x: t * zoom,
        isMajor,
        isBar,
        beatLabel: isBar ? `Bar ${Math.round(beatNum / 4) + 1}` : (isMajor ? `${Math.round(beatNum)}` : '')
      });
    }
    return linesArr;
  }, [selectedSong, quantize, zoom]);

  // Selected note model helper
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
          <span className="editor-badge">v2.1 PRE</span>
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
            <div className="editor-section-title">Timeline Zoom</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="range" 
                min={60} 
                max={280} 
                value={zoom} 
                onChange={(e) => setZoom(Number(e.target.value))} 
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: '9px', width: '32px', textAlign: 'right' }}>{zoom}px/s</span>
            </div>
          </div>

          <div className="editor-panel-section">
            <div className="editor-section-title">Grid Quantization</div>
            <select 
              className="editor-select" 
              value={quantize} 
              onChange={(e) => setQuantize(Number(e.target.value))}
            >
              <option value={0}>Free Placement (No Snap)</option>
              <option value={4}>1/4 Quarter Notes</option>
              <option value={8}>1/8 Eighth Notes</option>
              <option value={16}>1/16 Sixteenth Notes</option>
              <option value={32}>1/32 Thirty-Second Notes</option>
            </select>
          </div>

          <div className="editor-panel-section">
            <div className="editor-section-title">Editor Mode / Tools</div>
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
          </div>

          {activeTool === 'swipe' && (
            <div className="editor-panel-section">
              <div className="editor-section-title">Swipe Direction</div>
              <select 
                className="editor-select" 
                value={swipeDir} 
                onChange={(e) => setSwipeDir(e.target.value as any)}
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
            <div className="editor-panel-section">
              <div className="editor-section-title">Slide Lane Target</div>
              <select 
                className="editor-select" 
                value={slideTarget} 
                onChange={(e) => setSlideTarget(Number(e.target.value))}
              >
                <option value={0}>Lane 0 (Left)</option>
                <option value={1}>Lane 1 (Center)</option>
                <option value={2}>Lane 2 (Right)</option>
              </select>
            </div>
          )}

          <div className="editor-panel-section">
            <div className="editor-section-title">Record Options</div>
            <div className="editor-field" style={{ marginBottom: '10px' }}>
              <label>Tapper Latency Offset</label>
              <input 
                type="number" 
                step={0.01} 
                value={latencyOffset} 
                onChange={(e) => setLatencyOffset(Number(e.target.value))}
                className="editor-input"
              />
              <span style={{ fontSize: '7px', opacity: 0.4 }}>Seconds subtracted during tap recording (calibrates tap delay).</span>
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
            <button onClick={togglePlay} disabled={!selectedSong} className="editor-button primary" style={{ width: '80px' }}>
              {isPlaying ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Pause size={10} /> PAUSE</span> : <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Play size={10} /> PLAY</span>}
            </button>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', opacity: 0.6 }}>
              {currentTime.toFixed(3)}s / {(selectedSong?.duration || 0).toFixed(1)}s
            </span>
          </div>

          {/* Scrubber */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '320px' }}>
            <span style={{ fontSize: '9px', opacity: 0.5 }}>RATE</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[0.5, 0.75, 1.0, 1.25].map(speed => (
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

        {/* CENTER PANEL: Timeline Editor */}
        <div 
          ref={timelineContainerRef}
          className="editor-timeline-container"
          onClick={handleTimelineContainerClick}
        >
          {selectedSong ? (
            <div 
              className="timeline-grid" 
              style={{ width: `${selectedSong.duration * zoom}px` }}
            >
              {/* Quantization vertical lines */}
              <div className="timeline-grid-lines" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {gridLines.map((line, idx) => (
                  <div 
                    key={idx} 
                    className={`grid-line ${line.isBar ? 'bar' : (line.isMajor ? 'major' : '')}`}
                    style={{ left: `${line.x}px` }}
                  >
                    {line.beatLabel && (
                      <span className="grid-beat-number">
                        {line.beatLabel}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Playhead */}
              <div 
                className="timeline-playhead" 
                style={{ left: `${currentTime * zoom}px` }}
              >
                <div className="timeline-playhead-cap" />
              </div>

              {/* Lanes */}
              <div className="timeline-lanes">
                {[0, 1, 2].map(laneIndex => (
                  <div 
                    key={laneIndex} 
                    className="timeline-lane"
                    onClick={(e) => handleLaneClick(laneIndex, e)}
                  >
                    <span className="timeline-lane-label">Lane {laneIndex}</span>
                    
                    {/* Render notes for this lane */}
                    {notes.filter(n => n.lane === laneIndex).map(note => {
                      const noteWidth = note.type === 'hold' && note.holdDuration ? note.holdDuration * zoom : 38;
                      const isNoteSelected = selectedNoteId === note.id;
                      
                      let noteLabel = note.type.toUpperCase();
                      if (note.type === 'swipe' && note.swipeDirection) {
                        const arrowMap: Record<string, string> = { up: '↑', down: '↓', left: '←', right: '→', 'up-left': '↖', 'up-right': '↗', 'down-left': '↙', 'down-right': '↘' };
                        noteLabel = `SWIPE ${arrowMap[note.swipeDirection] || ''}`;
                      } else if (note.type === 'hold' && note.targetLane !== undefined) {
                        noteLabel = `SLIDE → L${note.targetLane}`;
                      }

                      return (
                        <div
                          key={note.id}
                          className={`timeline-note ${note.type} ${isNoteSelected ? 'selected' : ''}`}
                          style={{
                            left: `${note.type === 'hold' ? note.time * zoom : note.time * zoom - 19}px`,
                            width: `${noteWidth}px`
                          }}
                          onMouseDown={(e) => handleNoteDragStart(note.id, e.clientX, note.time, e)}
                        >
                          <span style={{ fontSize: '7px', whiteSpace: 'nowrap' }}>
                            {noteLabel}
                          </span>

                          {/* Slide target connectors */}
                          {note.type === 'hold' && note.targetLane !== undefined && (
                            <div 
                              className="slide-target-line"
                              style={{
                                width: `${(note.holdDuration || 0) * zoom}px`,
                                transform: `rotate(${(note.targetLane - note.lane) * 16}deg)`
                              }}
                            />
                          )}

                          {/* Resize handles */}
                          {note.type === 'hold' && isNoteSelected && (
                            <div 
                              className="hold-resize-handle"
                              onMouseDown={(e) => handleHoldResizeStart(note.id, e.clientX, note.holdDuration || 0.5, e)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3, fontSize: '12px' }}>
              SELECT A SONG TO INITIALIZE TIMELINE
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
            <div className="editor-section-title">Note Inspector</div>
            {selectedNote ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="editor-field">
                  <label>Selected ID</label>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>Note #{selectedNote.id}</div>
                </div>

                <div className="editor-field">
                  <label>Trigger Timestamp</label>
                  <input 
                    type="number" 
                    step={0.001} 
                    value={Number(selectedNote.time.toFixed(3))}
                    onChange={(e) => updateSelectedNote(n => ({ ...n, time: Number(e.target.value) }))}
                    className="editor-input"
                  />
                </div>

                <div className="editor-field">
                  <label>Active Lane</label>
                  <select 
                    className="editor-select" 
                    value={selectedNote.lane}
                    onChange={(e) => updateSelectedNote(n => ({ ...n, lane: Number(e.target.value) }))}
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
                  >
                    <option value="tap">TAP</option>
                    <option value="hold">HOLD (Slide)</option>
                    <option value="swipe">SWIPE</option>
                  </select>
                </div>

                {selectedNote.type === 'hold' && (
                  <>
                    <div className="editor-field">
                      <label>Hold Duration (sec)</label>
                      <input 
                        type="number" 
                        step={0.01} 
                        value={Number((selectedNote.holdDuration || 0.5).toFixed(2))}
                        onChange={(e) => updateSelectedNote(n => ({ ...n, holdDuration: Number(e.target.value) }))}
                        className="editor-input"
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
                      >
                        <option value="">Static Hold (No Target)</option>
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
              <div style={{ fontSize: '9px', opacity: 0.4, textAlign: 'center', padding: '16px border' }}>
                SELECT A NOTE MARKER TO INSPECT OR DRAG TO ADUST IT
              </div>
            )}
          </div>

          <div className="editor-panel-section">
            <div className="editor-section-title">Hotkeys Legend</div>
            <div className="help-grid">
              <span className="help-key">Space</span>
              <span className="help-desc">Play / Pause track</span>

              <span className="help-key">A / J</span>
              <span className="help-desc">Place note at Lane 0</span>

              <span className="help-key">S / K</span>
              <span className="help-desc">Place note at Lane 1</span>

              <span className="help-key">D / L</span>
              <span className="help-desc">Place note at Lane 2</span>

              <span className="help-key">Del / Backspace</span>
              <span className="help-desc">Delete selected note</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
