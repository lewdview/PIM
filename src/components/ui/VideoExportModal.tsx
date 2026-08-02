import React from 'react';
import { Download, Film, X, RefreshCw } from 'lucide-react';

interface VideoExportModalProps {
  isOpen: boolean;
  isRecording: boolean;
  recordingProgress: number; // 0 to 100
  frameCount: number;
  songTitle: string;
  artistName: string;
  videoUrl: string | null;
  videoBlob: Blob | null;
  mimeType: string;
  onClose: () => void;
  onReplay?: () => void;
}

export default function VideoExportModal({
  isOpen,
  isRecording,
  recordingProgress,
  frameCount,
  songTitle,
  artistName,
  videoUrl,
  videoBlob,
  mimeType,
  onClose,
  onReplay,
}: VideoExportModalProps) {
  if (!isOpen) return null;

  const fileSizeMb = videoBlob ? (videoBlob.size / (1024 * 1024)).toFixed(2) : '0.00';
  const isMp4 = mimeType.includes('mp4');
  const extension = isMp4 ? 'mp4' : 'webm';
  const fileName = `${songTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_perfect_run.${extension}`;

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl animate-in fade-in duration-300">
      <div className="relative w-full max-w-2xl bg-[#09090b] border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden font-mono text-white">
        {/* Glow ambient accent */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#39FF14]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#FF1493]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl border border-[#39FF14]/40 bg-[#39FF14]/10 flex items-center justify-center text-[#39FF14]">
              <Film size={20} />
            </div>
            <div>
              <div className="text-[9px] text-[#39FF14] font-bold tracking-[0.25em] uppercase">
                FRAME-PERFECT VIDEO RENDER
              </div>
              <h3 className="text-lg font-black tracking-tight text-white uppercase">
                {songTitle}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        {isRecording ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-[#39FF14]/20 border-t-[#39FF14] animate-spin" />
              <Film size={32} className="text-[#39FF14] animate-pulse" />
            </div>

            <div className="space-y-2">
              <div className="text-2xl font-black tracking-widest text-[#39FF14]">
                {Math.round(recordingProgress)}%
              </div>
              <div className="text-xs text-white/50 tracking-wider uppercase font-bold">
                CAPTURING CANVAS FRAMES ({frameCount} FRAMES)
              </div>
              <div className="text-[10px] text-white/30 tracking-widest uppercase">
                AUTOMATED PERFECT SOLVER ACTIVE // 60 FPS RECORDING
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-md h-3 bg-white/10 rounded-full overflow-hidden border border-white/10 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-[#00E5FF] via-[#39FF14] to-[#FF1493] rounded-full transition-all duration-150"
                style={{ width: `${recordingProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Video Player Preview */}
            {videoUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-black shadow-xl aspect-video flex items-center justify-center group">
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="py-12 text-center text-white/40">
                Failed to generate video preview.
              </div>
            )}

            {/* Video Telemetry Meta */}
            <div className="grid grid-cols-3 gap-3 bg-white/[0.03] border border-white/10 p-4 rounded-xl text-center">
              <div>
                <div className="text-[9px] text-white/40 uppercase font-bold mb-0.5">RESOLUTION</div>
                <div className="text-xs font-black text-[#39FF14]">CANVAS (60 FPS)</div>
              </div>
              <div>
                <div className="text-[9px] text-white/40 uppercase font-bold mb-0.5">FILE SIZE</div>
                <div className="text-xs font-black text-[#00E5FF]">{fileSizeMb} MB</div>
              </div>
              <div>
                <div className="text-[9px] text-white/40 uppercase font-bold mb-0.5">CONTAINER</div>
                <div className="text-xs font-black text-[#FF1493]">{extension.toUpperCase()}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={handleDownload}
                disabled={!videoUrl}
                className="w-full sm:flex-1 py-4 px-6 rounded-2xl bg-[#39FF14] text-black font-black text-xs tracking-[0.25em] uppercase hover:bg-[#39FF14]/90 transition-all shadow-[0_0_20px_rgba(57,255,20,0.4)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download size={18} />
                <span>SAVE {extension.toUpperCase()} VIDEO</span>
              </button>

              {onReplay && (
                <button
                  onClick={onReplay}
                  className="w-full sm:w-auto py-4 px-6 rounded-2xl border border-white/20 bg-white/10 text-white font-bold text-xs tracking-wider uppercase hover:bg-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw size={16} />
                  <span>RE-RENDER</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
