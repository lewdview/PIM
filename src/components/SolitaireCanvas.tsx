import { useEffect, useRef } from 'react';

interface SolitaireCanvasProps {
  onClose: () => void;
}

interface Bolt {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  va: number;
  elasticity: number;
  hue: number;
}

export default function SolitaireCanvas({ onClose }: SolitaireCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let bolts: Bolt[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.fillStyle = '#080604';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    window.addEventListener('resize', resize);
    resize();

    const spawnBolt = (x: number, y: number, stream = false) => {
      bolts.push({
        x,
        y,
        vx: stream ? (Math.random() * 8 - 4) : (Math.random() * 12 - 6),
        vy: stream ? (Math.random() * -6 - 2) : (Math.random() * -10 - 2),
        size: Math.random() * 15 + 15,
        angle: Math.random() * Math.PI * 2,
        va: Math.random() * 0.1 - 0.05,
        elasticity: Math.random() * 0.15 + 0.78,
        hue: 280 + (Math.random() * 20 - 10), // Electric purple ranges
      });
    };

    // Mouse and Touch Event Listeners
    let isMouseDown = false;
    let lastPos = { x: 0, y: 0 };

    const handleStart = (clientX: number, clientY: number) => {
      isMouseDown = true;
      lastPos = { x: clientX, y: clientY };
      spawnBolt(clientX, clientY);
    };

    const handleMove = (clientX: number, clientY: number) => {
      if (!isMouseDown) return;
      const dist = Math.hypot(clientX - lastPos.x, clientY - lastPos.y);
      if (dist > 15) {
        spawnBolt(clientX, clientY);
        lastPos = { x: clientX, y: clientY };
      }
    };

    const onMouseDown = (e: MouseEvent) => handleStart(e.clientX, e.clientY);
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onMouseUp = () => { isMouseDown = false; };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches[0]) handleStart(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onMouseUp);

    const drawLightning = (cCtx: CanvasRenderingContext2D, b: Bolt) => {
      cCtx.save();
      cCtx.translate(b.x, b.y);
      cCtx.rotate(b.angle);
      cCtx.beginPath();
      
      // Draw vector lightning bolt
      cCtx.moveTo(0, -b.size);
      cCtx.lineTo(b.size * 0.4, -b.size * 0.1);
      cCtx.lineTo(b.size * 0.1, -b.size * 0.1);
      cCtx.lineTo(b.size * 0.5, b.size * 0.9);
      cCtx.lineTo(-b.size * 0.1, b.size * 0.2);
      cCtx.lineTo(b.size * 0.15, b.size * 0.2);
      cCtx.closePath();

      cCtx.fillStyle = `hsla(${b.hue}, 100%, 65%, 1)`;
      cCtx.shadowColor = `hsla(${b.hue}, 100%, 60%, 0.8)`;
      cCtx.shadowBlur = b.size * 0.6;
      cCtx.fill();

      // White hot core highlight
      cCtx.beginPath();
      cCtx.moveTo(0, -b.size * 0.8);
      cCtx.lineTo(b.size * 0.25, -b.size * 0.1);
      cCtx.lineTo(-b.size * 0.05, b.size * 0.2);
      cCtx.strokeStyle = '#ffffff';
      cCtx.lineWidth = b.size * 0.1;
      cCtx.lineCap = 'round';
      cCtx.shadowBlur = 0;
      cCtx.stroke();

      cCtx.restore();
    };

    const gravity = 0.28;
    let frames = 0;

    const loop = () => {
      frames++;
      
      // Semi-transparent overlay to clear screen leaving trails
      ctx.fillStyle = 'rgba(8, 6, 4, 0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Auto spawn fountains from the top corners
      if (frames % 6 === 0) {
        spawnBolt(60, 50, true);
        spawnBolt(canvas.width - 60, 50, true);
      }

      bolts.forEach((b) => {
        b.vy += gravity;
        b.x += b.vx;
        b.y += b.vy;
        b.angle += b.va;

        // Bounce Floor
        if (b.y + b.size > canvas.height) {
          b.y = canvas.height - b.size;
          b.vy = -b.vy * b.elasticity;
          b.vx *= 0.96;
        }

        // Bounce Walls
        if (b.x + b.size > canvas.width) {
          b.x = canvas.width - b.size;
          b.vx = -b.vx * b.elasticity;
        } else if (b.x - b.size < 0) {
          b.x = b.size;
          b.vx = -b.vx * b.elasticity;
        }

        drawLightning(ctx, b);
      });

      // Filter out static particles
      bolts = bolts.filter((b) => Math.abs(b.vy) > 0.4 || b.y < canvas.height - b.size - 2);
      if (bolts.length > 250) {
        bolts.splice(0, bolts.length - 250);
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onMouseUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      pointerEvents: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          cursor: 'crosshair',
        }}
      />
      {/* Floating Retro HUD */}
      <div style={{
        position: 'absolute',
        top: '24px',
        left: '24px',
        zIndex: 10000,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '9px',
        color: 'rgba(255, 255, 255, 0.4)',
        textTransform: 'uppercase',
        pointerEvents: 'none',
        letterSpacing: '0.15em',
        lineHeight: '1.6',
      }}>
        [ SYSTEM // WATERFALL_OVERRIDE ]<br/>
        <span style={{ fontSize: '8px', color: '#ffb800' }}>Click/drag anywhere to launch more neon bolts</span>
      </div>

      {/* Retro close tag */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          zIndex: 10000,
          background: '#ff3800',
          border: '2px solid #000',
          boxShadow: '3px 3px 0 #000',
          color: '#fff',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '9px',
          fontWeight: 900,
          padding: '6px 16px',
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        Clear Overlay
      </button>
    </div>
  );
}
