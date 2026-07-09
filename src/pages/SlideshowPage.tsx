import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { audioManager } from '../game/audio';
import { Play, Pause, ChevronRight, ChevronLeft, Upload, Grid, Brain, Layers, ArrowLeft } from 'lucide-react';

// Use Vite's eager glob to grab files in /public/data/slideshow/
const imageModules = import.meta.glob('/public/data/slideshow/*.{png,jpg,jpeg,gif,webp,svg}', { eager: true });
const staticImages = Object.keys(imageModules).map(key => key.replace('/public', ''));

const removeDarkBackground = (ctx: CanvasRenderingContext2D, w: number, h: number, threshold: number) => {
  try {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const fadeRange = 22;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      // Filter out dark background pixels based on custom threshold
      if (luminance < threshold) {
        data[i + 3] = 0; // Transparent
      } else if (luminance < threshold + fadeRange) {
        // Linear blending at the edges for smooth anti-aliasing
        data[i + 3] = Math.round(((luminance - threshold) / fadeRange) * 255);
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (err) {
    console.warn('Luminance extraction warning:', err);
  }
};

// Types for particles in the visualizer
interface DetectedObject {
  id: string;
  className: string;
  score: number;
  bbox: [number, number, number, number]; // [x, y, w, h]
  canvasDataUrl: string; // cropped object data URL
  cx: number; // center relative coordinates
  cy: number;
}

interface FloatingSubject {
  id: string;
  className: string;
  score: number;
  dataUrl: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;
  rotation: number;
  rotSpeed: number;
  glowColor: string;
  width: number;
  height: number;
  imgElement: HTMLImageElement;
}

export default function SlideshowPage() {
  const [, setLocation] = useLocation();

  // Slides State
  const [slides, setSlides] = useState<string[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  // TensorFlow / AI Model State
  const [modelLoading, setModelLoading] = useState(true);
  const [modelStatus, setModelStatus] = useState('Loading Neural Network (TF.js)...');
  const [modelError, setModelError] = useState<string | null>(null);

  // Extracted Objects State
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
  const [extractionMode, setExtractionMode] = useState<'coco' | 'contour'>('coco');
  const [showBrackets, setShowBrackets] = useState(false);
  const [hideSourceImage, setHideSourceImage] = useState(false);
  const [cutoutThreshold, setCutoutThreshold] = useState(38);

  const cocoModelRef = useRef<any>(null);

  // DOM Refs
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Animation System States
  const floatersRef = useRef<FloatingSubject[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // 1. Initial Slides Setup (local directory files)
  useEffect(() => {
    // Check if Express API returned any files, otherwise fall back to Vite static imports
    const fetchDirImages = async () => {
      try {
        const res = await fetch('http://localhost:3002/api/slideshow-images').catch(() => null);
        if (res && res.ok) {
          const apiImages = await res.json();
          if (Array.isArray(apiImages) && apiImages.length > 0) {
            setSlides(apiImages);
            return;
          }
        }
      } catch (e) {
        console.warn('[Slideshow] API directory check failed, falling back to Vite glob:', e);
      }
      setSlides(staticImages.length > 0 ? staticImages : ['/data/slideshow/cyber_dancer.jpg', '/data/slideshow/cyber_headphones.jpg']);
    };
    fetchDirImages();
  }, []);

  // 2. Dynamic TensorFlow.js Script Loader
  useEffect(() => {
    let active = true;

    const loadTF = async () => {
      try {
        if ((window as any).cocoSsd) {
          if (active) setModelLoading(false);
          return;
        }

        // Load TF.js
        setModelStatus('Initializing TensorFlow Engine...');
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
          s.onload = resolve;
          s.onerror = () => reject(new Error('Failed to load TensorFlow.js from CDN.'));
          document.head.appendChild(s);
        });

        // Load COCO-SSD
        if (!active) return;
        setModelStatus('Caching Object Recognition Weights (COCO-SSD)...');
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js';
          s.onload = resolve;
          s.onerror = () => reject(new Error('Failed to load COCO-SSD model.'));
          document.head.appendChild(s);
        });

        if (active) {
          setModelLoading(false);
          setModelStatus('Neural Network Online.');
        }
      } catch (err) {
        console.error('[Slideshow Model] Loading failed:', err);
        if (active) {
          setModelError('Offline/CDN Blocked. Falling back to edge detection extractor.');
          setModelLoading(false);
          setExtractionMode('contour');
        }
      }
    };

    loadTF();

    return () => {
      active = false;
    };
  }, []);

  // 3. Slideshow Playback Timer
  useEffect(() => {
    if (!isPlaying || slides.length <= 1) return;
    const interval = setInterval(() => {
      handleNext();
    }, 8000);
    return () => clearInterval(interval);
  }, [isPlaying, slides, currentSlideIndex]);

  // Reactive Re-extraction on threshold and mode updates
  useEffect(() => {
    runExtraction();
  }, [cutoutThreshold, extractionMode, currentSlideIndex]);

  const handleNext = () => {
    audioManager.playSfx('tap_nav', 0.1);
    setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
  };

  const handlePrev = () => {
    audioManager.playSfx('tap_nav', 0.1);
    setCurrentSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  // 4. Object Detection & Extraction Engine
  const runExtraction = async () => {
    const img = imgRef.current;
    if (!img) return;

    // Make sure image is fully loaded
    if (!img.complete || img.naturalWidth === 0) {
      img.onload = () => runExtraction();
      return;
    }

    try {
      if (extractionMode === 'coco' && (window as any).cocoSsd) {
        setModelStatus('Analyzing image subjects...');
        const coco = (window as any).cocoSsd;
        if (!cocoModelRef.current) {
          cocoModelRef.current = await coco.load();
        }
        const model = cocoModelRef.current;
        const predictions = await model.detect(img);

        if (predictions.length > 0) {
          const extracted: DetectedObject[] = [];
          
          predictions.forEach((pred: any, idx: number) => {
            const [bx, by, bw, bh] = pred.bbox;
            
            // Extract cropped object to offscreen canvas
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = bw;
            cropCanvas.height = bh;
            const cropCtx = cropCanvas.getContext('2d')!;
            
            cropCtx.drawImage(
              img,
              bx, by, bw, bh, // source coords
              0, 0, bw, bh // destination coords
            );

            removeDarkBackground(cropCtx, bw, bh, cutoutThreshold);

            extracted.push({
              id: `obj-${idx}-${Date.now()}`,
              className: pred.class,
              score: Math.round(pred.score * 100),
              bbox: [bx, by, bw, bh],
              canvasDataUrl: cropCanvas.toDataURL(),
              cx: bx + bw / 2,
              cy: by + bh / 2
            });
          });

          setDetectedObjects(extracted);
          initializeFloaters(extracted);
          setModelStatus(`Detected ${extracted.length} objects.`);
        } else {
          // Fall back to contour if coco SSD has no results
          runContourExtraction();
        }
      } else {
        runContourExtraction();
      }
    } catch (e) {
      console.error('[Slideshow Engine] Detection failed:', e);
      runContourExtraction();
    }
  };

  // Fallback High-Contrast Contour/Segment Extractor
  const runContourExtraction = () => {
    const img = imgRef.current;
    if (!img) return;

    setModelStatus('Running edge threshold extractor...');
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.naturalWidth;
    tempCanvas.height = img.naturalHeight;
    const ctx = tempCanvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imgData.data;

    // Simple luminance threshold segmentation
    const w = tempCanvas.width;
    const h = tempCanvas.height;
    
    // We isolate 2 segments: a high-contrast core object and high-brightness details
    const segs = [
      { name: 'Core Subject Shape', minL: cutoutThreshold, maxL: 200 },
      { name: 'Neon Detail Highlight', minL: 200, maxL: 255 }
    ];

    const extracted: DetectedObject[] = [];

    segs.forEach((seg, idx) => {
      // Create segmentation mask
      const segCanvas = document.createElement('canvas');
      segCanvas.width = w;
      segCanvas.height = h;
      const sCtx = segCanvas.getContext('2d')!;
      sCtx.drawImage(img, 0, 0);
      const sData = sCtx.getImageData(0, 0, w, h);
      const sPixels = sData.data;

      let minX = w, maxX = 0, minY = h, maxY = 0;
      let found = false;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const r = sPixels[i];
          const g = sPixels[i + 1];
          const b = sPixels[i + 2];
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

          if (luminance >= seg.minL && luminance <= seg.maxL) {
            // Keep pixel color, set other to alpha
            found = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          } else {
            sPixels[i + 3] = 0; // set transparent
          }
        }
      }

      if (found && maxX - minX > 20 && maxY - minY > 20) {
        const bw = maxX - minX;
        const bh = maxY - minY;
        
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = bw;
        cropCanvas.height = bh;
        const cropCtx = cropCanvas.getContext('2d')!;

        // Write masked pixels back
        sCtx.putImageData(sData, 0, 0);
        
        // Draw cropped bounding box
        cropCtx.drawImage(
          segCanvas,
          minX, minY, bw, bh,
          0, 0, bw, bh
        );

        extracted.push({
          id: `contour-${idx}-${Date.now()}`,
          className: seg.name,
          score: 85 - idx * 10,
          bbox: [minX, minY, bw, bh],
          canvasDataUrl: cropCanvas.toDataURL(),
          cx: minX + bw / 2,
          cy: minY + bh / 2
        });
      }
    });

    setDetectedObjects(extracted);
    initializeFloaters(extracted);
    setModelStatus(extracted.length > 0 ? `Isolated ${extracted.length} shapes.` : 'Contour scans completed.');
  };

  // Convert extracted objects to floaters inside the canvas container
  const initializeFloaters = (objects: DetectedObject[]) => {
    const colors = ['#00F0FF', '#39FF14', '#FF1493', '#FFD700', '#FF5500'];
    
    floatersRef.current = objects.map((obj, i) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 0.8;
      
      const imgElement = new Image();
      imgElement.src = obj.canvasDataUrl;
      
      return {
        id: obj.id,
        className: obj.className,
        score: obj.score,
        dataUrl: obj.canvasDataUrl,
        imgElement,
        x: Math.random() * 300 - 150, // relative coordinate offsets from center
        y: Math.random() * 200 - 100,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        scale: 0.7 + Math.random() * 0.4,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.015,
        glowColor: colors[i % colors.length],
        width: obj.bbox[2],
        height: obj.bbox[3]
      };
    });
  };

  // Trigger scanning whenever current slide changes or mode updates
  useEffect(() => {
    if (slides.length > 0) {
      runExtraction();
    }
  }, [currentSlideIndex, slides, extractionMode]);

  // 5. Canvas Floating Particles Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Draw particle trails behind objects
      floatersRef.current.forEach((floater) => {
        // Move
        floater.x += floater.vx;
        floater.y += floater.vy;
        floater.rotation += floater.rotSpeed;

        // Bounce within boundaries
        const boundX = w * 0.38;
        const boundY = h * 0.38;

        if (Math.abs(floater.x) > boundX) {
          floater.vx *= -1;
          floater.x = Math.sign(floater.x) * boundX;
        }
        if (Math.abs(floater.y) > boundY) {
          floater.vy *= -1;
          floater.y = Math.sign(floater.y) * boundY;
        }

        // Draw image element (read from cached imgElement to prevent recreations)
        const img = floater.imgElement;

        ctx.save();
        ctx.translate(cx + floater.x, cy + floater.y);
        ctx.rotate(floater.rotation);
        ctx.scale(floater.scale, floater.scale);

        // Highlight if hovered in sidebar list
        const isHovered = hoveredObjectId === floater.id;
        
        ctx.shadowBlur = isHovered ? 25 : 12;
        ctx.shadowColor = floater.glowColor;

        const pad = 10;
        const fw = floater.width;
        const fh = floater.height;

        // Render neon bracket boundary box around extracted floaters only if enabled or hovered
        if (showBrackets || isHovered) {
          ctx.strokeStyle = floater.glowColor;
          ctx.lineWidth = isHovered ? 2 : 1;

          ctx.beginPath();
          // Top Left corner
          ctx.moveTo(-fw / 2 - pad, -fh / 2 - pad + 15);
          ctx.lineTo(-fw / 2 - pad, -fh / 2 - pad);
          ctx.lineTo(-fw / 2 - pad + 15, -fh / 2 - pad);
          // Top Right
          ctx.moveTo(fw / 2 + pad - 15, -fh / 2 - pad);
          ctx.lineTo(fw / 2 + pad, -fh / 2 - pad);
          ctx.lineTo(fw / 2 + pad, -fh / 2 - pad + 15);
          // Bottom Right
          ctx.moveTo(fw / 2 + pad, fh / 2 + pad - 15);
          ctx.lineTo(fw / 2 + pad, fh / 2 + pad);
          ctx.lineTo(fw / 2 + pad - 15, fh / 2 + pad);
          // Bottom Left
          ctx.moveTo(-fw / 2 - pad + 15, fh / 2 + pad);
          ctx.lineTo(-fw / 2 - pad, fh / 2 + pad);
          ctx.lineTo(-fw / 2 - pad, fh / 2 + pad - 15);
          ctx.stroke();
        }

        if (img.complete) {
          ctx.drawImage(img, -fw / 2, -fh / 2, fw, fh);
        }

        // Render metadata text tag floating above object
        ctx.fillStyle = isHovered ? '#fff' : floater.glowColor;
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          `${floater.className.toUpperCase()} [${floater.score}%]`,
          0,
          -fh / 2 - pad - 5
        );

        ctx.restore();
      });

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', resize);
    };
  }, [hoveredObjectId, showBrackets]);

  // 6. Custom File Drops
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    handleFileImport(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileImport(Array.from(e.target.files));
    }
  };

  const handleFileImport = (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    audioManager.playSfx('hidden_secret_found', 0.3);

    const nextUrls = [...slides];
    imageFiles.forEach(file => {
      const url = URL.createObjectURL(file);
      nextUrls.push(url);
    });

    setSlides(nextUrls);
    setCurrentSlideIndex(nextUrls.length - imageFiles.length);
  };

  const handleExit = () => {
    audioManager.playSfx('back', 0.4);
    setLocation('/songs');
  };

  return (
    <div className="relative min-h-screen bg-[#070605] text-white overflow-hidden flex font-sans">
      {/* Dynamic Floating Canvas Overlay (extruded objects drifting) */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Cyber ambient scanlines */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-scanlines opacity-[0.02]" />

      {/* Sidebar Controls Area */}
      <div className="w-[360px] border-r border-white/10 bg-[#0c0a09]/80 backdrop-blur-[20px] p-6 z-20 flex flex-col gap-6 overflow-y-auto">
        
        {/* Header Exit Section */}
        <div className="flex items-center justify-between">
          <button 
            onClick={handleExit}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors uppercase font-mono text-[9px] tracking-wider text-white/70"
          >
            <ArrowLeft size={10} />
            BACK TO PLAY
          </button>
          
          <div className="flex items-center gap-1 text-[#39FF14] font-mono text-[9px] tracking-[0.2em] font-black uppercase">
            <Brain size={10} />
            NEURAL_SLIDESHOW
          </div>
        </div>

        {/* Neural Network Status Widget */}
        <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-2 relative overflow-hidden">
          <div className="absolute -top-1 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-[#39FF14]/50 to-transparent" />
          <h3 className="font-mono text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5">
            <Layers size={10} className="text-[#39FF14]" />
            COMPUTER VISION STATUS
          </h3>
          <p className="font-mono text-[10px] text-white/80 leading-relaxed uppercase">
            {modelStatus}
          </p>
          {modelError && (
            <p className="font-mono text-[8px] text-[#FF1493] uppercase">
              {modelError}
            </p>
          )}
        </div>

        {/* Extraction Engine Mode Selector */}
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[8px] tracking-wider text-white/40 uppercase">
            Extraction AI Pipeline
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                audioManager.playSfx('tap_nav', 0.1);
                setExtractionMode('coco');
              }}
              className={`py-2 rounded-lg font-mono text-[9px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                extractionMode === 'coco'
                  ? 'border-[#39FF14] bg-[#39FF14]/10 text-white'
                  : 'border-white/5 bg-black/40 text-white/40 hover:border-white/10'
              }`}
            >
              COCO-SSD Neural
            </button>
            <button
              onClick={() => {
                audioManager.playSfx('tap_nav', 0.1);
                setExtractionMode('contour');
              }}
              className={`py-2 rounded-lg font-mono text-[9px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                extractionMode === 'contour'
                  ? 'border-[#FF1493] bg-[#FF1493]/10 text-white'
                  : 'border-white/5 bg-black/40 text-white/40 hover:border-white/10'
              }`}
            >
              Contour Scan
            </button>
          </div>
        </div>

        {/* View Layout Controls */}
        <div className="flex flex-col gap-3">
          <h4 className="font-mono text-[9px] font-black text-white/40 uppercase tracking-widest border-b border-white/5 pb-1">
            VIEW OPTIONS
          </h4>
          <div className="flex flex-col gap-2.5">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideSourceImage}
                onChange={(e) => {
                  audioManager.playSfx('tap_nav', 0.1);
                  setHideSourceImage(e.target.checked);
                }}
                className="w-3.5 h-3.5 rounded border border-white/20 bg-black/40 text-[#39FF14] focus:ring-0 cursor-pointer accent-[#39FF14]"
              />
              <span className="font-mono text-[9px] uppercase tracking-wider text-white/70">
                Isolate Cut-outs (Pure Black)
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showBrackets}
                onChange={(e) => {
                  audioManager.playSfx('tap_nav', 0.1);
                  setShowBrackets(e.target.checked);
                }}
                className="w-3.5 h-3.5 rounded border border-white/20 bg-black/40 text-[#39FF14] focus:ring-0 cursor-pointer accent-[#39FF14]"
              />
              <span className="font-mono text-[9px] uppercase tracking-wider text-white/70">
                Show Bounding Brackets [ ]
              </span>
            </label>

            {/* Threshold Slider for tuning background transparency */}
            <div className="flex flex-col gap-1 mt-1">
              <div className="flex justify-between font-mono text-[8px] uppercase tracking-wider text-white/50">
                <span>Cutout Threshold</span>
                <span className="text-[#39FF14] font-bold">{cutoutThreshold}</span>
              </div>
              <input
                type="range"
                min="5"
                max="220"
                value={cutoutThreshold}
                onChange={(e) => {
                  setCutoutThreshold(Number(e.target.value));
                }}
                className="w-full accent-[#39FF14] bg-white/10 h-1 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Playlist / Upload Files Section */}
        <div className="flex flex-col gap-3">
          <h4 className="font-mono text-[9px] font-black text-white/40 uppercase tracking-widest border-b border-white/5 pb-1">
            SLIDES PLAYLIST ({slides.length})
          </h4>
          
          {/* Scrollable Slide List */}
          <div className="max-h-[160px] overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
            {slides.map((url, idx) => {
              const active = idx === currentSlideIndex;
              // Extract a clean name from URL
              const filename = url.split('/').pop()?.split('?')[0] || `Image_${idx + 1}`;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    audioManager.playSfx('tap_nav', 0.1);
                    setCurrentSlideIndex(idx);
                  }}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl text-left border transition-all ${
                    active
                      ? 'bg-[#39FF14]/10 border-[#39FF14]/30 text-white'
                      : 'bg-black/30 border-transparent text-white/50 hover:bg-white/5'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 bg-white/5">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </div>
                  <span className="font-mono text-[10px] truncate uppercase flex-1">
                    {filename.replace('.jpg', '').replace('.png', '')}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Interactive Drag & Drop Box */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border border-dashed border-white/20 hover:border-[#39FF14]/50 rounded-2xl p-5 text-center bg-black/25 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group"
          >
            <Upload size={18} className="text-white/40 group-hover:text-[#39FF14] transition-colors" />
            <span className="font-mono text-[9px] tracking-wide uppercase text-white/60">
              Drop files here or click to import
            </span>
            <span className="font-mono text-[7px] text-white/30 uppercase">
              Supports JPG, JPEG, PNG, WEBP
            </span>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/*"
              className="hidden"
            />
          </div>
        </div>

        {/* Detected Extracted Objects Metadata Sidebar List */}
        <div className="flex flex-col gap-3 mt-auto">
          <h4 className="font-mono text-[9px] font-black text-white/40 uppercase tracking-widest border-b border-white/5 pb-1">
            ISOLATED SUBJECTS ({detectedObjects.length})
          </h4>
          
          {detectedObjects.length === 0 ? (
            <div className="font-mono text-[8px] text-white/30 text-center py-4 uppercase">
              No isolations found in current frame
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
              {detectedObjects.map((obj) => {
                const hovered = hoveredObjectId === obj.id;
                return (
                  <div
                    key={obj.id}
                    onMouseEnter={() => setHoveredObjectId(obj.id)}
                    onMouseLeave={() => setHoveredObjectId(null)}
                    className={`flex items-center justify-between p-2 border rounded-xl font-mono text-[10px] transition-all cursor-crosshair ${
                      hovered
                        ? 'bg-white/10 border-white/20 text-[#39FF14]'
                        : 'bg-black/30 border-transparent text-white/70'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-8 h-8 rounded border border-white/10 bg-black/40 overflow-hidden flex-shrink-0 flex items-center justify-center p-0.5">
                        <img src={obj.canvasDataUrl} alt="" className="max-w-full max-h-full object-contain" />
                      </div>
                      <span className="uppercase truncate font-bold">{obj.className}</span>
                    </div>
                    <span className="opacity-55 text-[9px]">{obj.score}% conf</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Slide Presentation View */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#040303] relative">
        
        {/* Slideshow Presentation Canvas Frame */}
        <div className="w-full max-w-3xl aspect-video rounded-3xl border border-white/10 bg-black/50 shadow-2xl relative overflow-hidden flex items-center justify-center">
          
          {slides.length > 0 && (
            <img
              ref={imgRef}
              src={slides[currentSlideIndex]}
              alt="Slide presentation"
              onLoad={runExtraction}
              crossOrigin="anonymous"
              className="max-w-full max-h-full object-contain transition-opacity duration-300"
              style={{
                opacity: hideSourceImage ? 0 : 0.9,
                filter: detectedObjects.length > 0 ? 'brightness(0.35) blur(1px)' : 'none',
                visibility: hideSourceImage ? 'hidden' : 'visible'
              }}
            />
          )}

          {/* Glowing bottom grid wireframe */}
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-t from-[#39FF14]/15 to-transparent pointer-events-none" />
        </div>

        {/* Interactive Play/Pause & Navigate dashboard bar */}
        <div className="mt-6 flex items-center gap-8 px-6 py-3.5 bg-[#0e0c0b] border border-white/10 rounded-full z-20 shadow-lg">
          <button
            onClick={handlePrev}
            className="p-1.5 hover:bg-white/5 rounded-full transition-colors text-white/50 hover:text-white cursor-pointer"
            title="Previous Slide"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            onClick={() => {
              audioManager.playSfx('tap_nav', 0.15);
              setIsPlaying(!isPlaying);
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isPlaying
                ? 'bg-transparent border border-[#FF1493]/40 text-[#FF1493] hover:bg-[#FF1493]/10'
                : 'bg-[#39FF14] text-black hover:bg-[#39FF14]/90'
            }`}
            title={isPlaying ? 'Pause Loop' : 'Play Loop'}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
          </button>

          <button
            onClick={handleNext}
            className="p-1.5 hover:bg-white/5 rounded-full transition-colors text-white/50 hover:text-white cursor-pointer"
            title="Next Slide"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
