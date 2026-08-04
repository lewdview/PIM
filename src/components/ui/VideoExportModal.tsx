import React, { useState } from 'react';
import { Download, Film, X, RefreshCw, Upload, CheckCircle2, AlertCircle, Cloud, Copy, Check } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';

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
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'uploaded' | 'error'>('idle');
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const fileSizeMb = videoBlob ? (videoBlob.size / (1024 * 1024)).toFixed(2) : '0.00';
  const isMp4 = mimeType.includes('mp4');
  const extension = isMp4 ? 'mp4' : 'webm';
  const cleanTitle = songTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const fileName = `${cleanTitle}_perfect_run.${extension}`;

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleUploadSupabase = async () => {
    if (!videoBlob) return;
    try {
      setUploadStatus('uploading');
      setUploadErr(null);

      const storagePath = `museum_videos/${cleanTitle}_perfect_run.${extension}`;

      const { data, error } = await supabase.storage
        .from('releaseready')
        .upload(storagePath, videoBlob, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) throw error;

      const { data: pubData } = supabase.storage
        .from('releaseready')
        .getPublicUrl(storagePath);

      const pubUrl = pubData.publicUrl;
      setPublicUrl(pubUrl);

      // Save database record & local storage key for museum landing pages
      try {
        await supabase.from('museum_videos').upsert(
          {
            song_title: songTitle,
            artist: artistName,
            video_url: pubUrl,
            mime_type: mimeType,
            score: 100000,
            judgment: 'PERFECT+',
            created_at: new Date().toISOString(),
          },
          { onConflict: 'song_title' }
        );
      } catch (e) {
        console.warn('Optional DB insert note:', e);
      }

      localStorage.setItem(`museum_video_${cleanTitle}`, pubUrl);
      setUploadStatus('uploaded');
    } catch (err: any) {
      console.error('Failed to upload video replay to Supabase:', err);
      setUploadErr(err?.message || 'Storage upload failed');
      setUploadStatus('error');
    }
  };

  const copyToClipboard = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
                CAPTURING CANVAS FRAMES & FULL HUD ({frameCount} FRAMES)
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
                <div className="text-xs font-black text-[#39FF14]">CANVAS + HUD (60 FPS)</div>
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

            {/* Supabase Upload Status Notification Banner */}
            {uploadStatus === 'uploaded' && publicUrl && (
              <div className="border border-[#39FF14]/40 bg-[#39FF14]/10 p-4 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-[#39FF14] text-xs font-bold uppercase tracking-wider">
                  <CheckCircle2 size={16} />
                  <span>PUBLISHED TO SUPABASE MUSEUM VAULT!</span>
                </div>
                <div className="flex items-center gap-2 bg-black/60 p-2.5 rounded-xl border border-white/10 text-[10px] text-white/80 font-mono">
                  <span className="flex-1 truncate">{publicUrl}</span>
                  <button
                    onClick={copyToClipboard}
                    className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copied ? <Check size={12} className="text-[#39FF14]" /> : <Copy size={12} />}
                    <span>{copied ? 'COPIED' : 'COPY'}</span>
                  </button>
                </div>
              </div>
            )}

            {uploadStatus === 'error' && uploadErr && (
              <div className="border border-red-500/40 bg-red-500/10 p-4 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold uppercase">
                <AlertCircle size={18} />
                <span>UPLOAD ERROR: {uploadErr}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={handleDownload}
                disabled={!videoUrl}
                className="w-full sm:flex-1 py-4 px-5 rounded-2xl bg-[#39FF14] text-black font-black text-xs tracking-[0.2em] uppercase hover:bg-[#39FF14]/90 transition-all shadow-[0_0_20px_rgba(57,255,20,0.4)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download size={18} />
                <span>SAVE {extension.toUpperCase()}</span>
              </button>

              <button
                onClick={handleUploadSupabase}
                disabled={!videoBlob || uploadStatus === 'uploading' || uploadStatus === 'uploaded'}
                className={`w-full sm:flex-1 py-4 px-5 rounded-2xl font-black text-xs tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                  uploadStatus === 'uploaded'
                    ? 'border-[#39FF14] bg-[#39FF14]/20 text-[#39FF14]'
                    : uploadStatus === 'uploading'
                    ? 'border-sky-400 bg-sky-400/20 text-sky-300 animate-pulse'
                    : 'border-sky-400 bg-sky-500/20 text-sky-300 hover:bg-sky-500/35 shadow-[0_0_20px_rgba(56,189,248,0.3)]'
                }`}
              >
                {uploadStatus === 'uploading' ? (
                  <>
                    <Cloud className="animate-spin" size={18} />
                    <span>UPLOADING...</span>
                  </>
                ) : uploadStatus === 'uploaded' ? (
                  <>
                    <CheckCircle2 size={18} />
                    <span>PUBLISHED TO VAULT</span>
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    <span>PUBLISH TO MUSEUM</span>
                  </>
                )}
              </button>

              {onReplay && (
                <button
                  onClick={onReplay}
                  className="w-full sm:w-auto py-4 px-4 rounded-2xl border border-white/20 bg-white/10 text-white font-bold text-xs tracking-wider uppercase hover:bg-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
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
