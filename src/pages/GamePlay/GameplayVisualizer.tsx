import React, { useEffect, useRef, useState } from 'react';

export interface GameplayVisualizerProps {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  dataArrayRef: React.MutableRefObject<Uint8Array | null>;
  isPlaying: boolean;
}

export const GameplayVisualizer: React.FC<GameplayVisualizerProps> = ({ analyserRef, dataArrayRef, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeShape, setActiveShape] = useState<'flower_of_life' | 'sri_yantra' | 'metatrons_cube' | 'bipolar_torus' | 'lakshmi_star'>('flower_of_life');
  const activeShapeRef = useRef(activeShape);

  useEffect(() => {
    activeShapeRef.current = activeShape;
  }, [activeShape]);

  useEffect(() => {
    if (!isPlaying) return;
    const shapes: ('flower_of_life' | 'sri_yantra' | 'metatrons_cube' | 'bipolar_torus' | 'lakshmi_star')[] = [
      'flower_of_life', 'sri_yantra', 'metatrons_cube', 'bipolar_torus', 'lakshmi_star'
    ];
    const interval = setInterval(() => {
      setActiveShape(current => {
        const idx = shapes.indexOf(current);
        const next = shapes[(idx + 1) % shapes.length];
        activeShapeRef.current = next;
        return next;
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let animationFrameId: number;
    let rotationAngle = 0;

    const resize = () => {
      if (!canvas || !canvas.parentElement) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = canvas.parentElement.clientWidth || window.innerWidth;
      const h = canvas.parentElement.clientHeight || window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      const parentW = canvas.parentElement?.clientWidth || window.innerWidth;
      const parentH = canvas.parentElement?.clientHeight || window.innerHeight;
      const cx = parentW / 2;
      const cy = parentH / 2;
      const size = Math.min(parentW, parentH) * 0.35;

      ctx.fillStyle = 'rgba(5, 4, 3, 0.15)';
      ctx.fillRect(0, 0, parentW, parentH);

      let bass = 0;
      let mid = 0;
      let high = 0;

      if (isPlaying && analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        const data = dataArrayRef.current;
        let bVal = 0;
        let mVal = 0;
        let hVal = 0;
        for (let i = 0; i < data.length; i++) {
          if (i < 10) bVal += data[i];
          else if (i < 50) mVal += data[i];
          else hVal += data[i];
        }
        bass = bVal / 10;
        mid = mVal / 40;
        high = hVal / (data.length - 50);
      } else if (isPlaying) {
        const t = Date.now() / 1000;
        bass = 50 + Math.sin(t * 8) * 25;
        mid = 45 + Math.cos(t * 5) * 15;
        high = 30 + Math.sin(t * 12) * 10;
      }

      const bassN = Math.min(1, bass / 255);
      const midN = Math.min(1, mid / 255);
      const highN = Math.min(1, high / 255);

      const bassScale = 1.0 + bassN * 0.12;
      rotationAngle += 0.002 + midN * 0.005;

      const baseHue = (Date.now() / 80) % 360;
      const getColor = (offset: number, alphaOverride?: number) => {
        return `hsla(${(baseHue + offset) % 360}, 95%, 62%, ${alphaOverride ?? 0.25})`;
      };

      const glowGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, size * 1.5);
      glowGrad.addColorStop(0, getColor(0, 0.04));
      glowGrad.addColorStop(0.6, getColor(120, 0.015));
      glowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, parentW, parentH);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(bassScale, bassScale);
      ctx.rotate(rotationAngle);
      ctx.shadowBlur = 8 + midN * 12;

      const opacityVal = 0.16 + highN * 0.10;

      const curShape = activeShapeRef.current;
      if (curShape === 'flower_of_life') {
        const radius = size * 0.22;
        ctx.lineWidth = 1.0;
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const ox = Math.cos(angle) * radius;
          const oy = Math.sin(angle) * radius;
          ctx.strokeStyle = getColor(i * 30, opacityVal);
          ctx.shadowColor = getColor(i * 30, opacityVal);
          ctx.beginPath();
          ctx.arc(ox, oy, radius, 0, Math.PI * 2);
          ctx.stroke();

          const outerAngle = angle + Math.PI / 6;
          const oox = Math.cos(outerAngle) * radius * Math.sqrt(3);
          const ooy = Math.sin(outerAngle) * radius * Math.sqrt(3);
          ctx.strokeStyle = getColor(i * 30 + 60, opacityVal);
          ctx.shadowColor = getColor(i * 30 + 60, opacityVal);
          ctx.beginPath();
          ctx.arc(oox, ooy, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.strokeStyle = getColor(0, opacityVal);
        ctx.shadowColor = getColor(0, opacityVal);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

      } else if (curShape === 'sri_yantra') {
        const scaleFact = size * 0.85;
        ctx.lineWidth = 0.9;
        const drawYantraTriangle = (yCenter: number, r: number, pointingUp: boolean, hueOffset: number) => {
          ctx.strokeStyle = getColor(hueOffset, opacityVal);
          ctx.shadowColor = getColor(hueOffset, opacityVal);
          ctx.beginPath();
          const yTip = pointingUp ? yCenter - r : yCenter + r;
          const yBase = pointingUp ? yCenter + r * 0.5 : yCenter - r * 0.5;
          const xOffset = r * Math.sqrt(3) * 0.5;
          ctx.moveTo(0, yTip);
          ctx.lineTo(xOffset, yBase);
          ctx.lineTo(-xOffset, yBase);
          ctx.closePath();
          ctx.stroke();
        };

        drawYantraTriangle(0, scaleFact * 0.5, true, 0);
        drawYantraTriangle(0, scaleFact * 0.5, false, 40);
        drawYantraTriangle(-scaleFact * 0.05, scaleFact * 0.4, true, 80);
        drawYantraTriangle(scaleFact * 0.05, scaleFact * 0.4, false, 120);
        drawYantraTriangle(scaleFact * 0.03, scaleFact * 0.3, true, 160);
        drawYantraTriangle(-scaleFact * 0.03, scaleFact * 0.3, false, 200);

        ctx.strokeStyle = getColor(180, opacityVal);
        ctx.shadowColor = getColor(180, opacityVal);
        ctx.beginPath();
        ctx.arc(0, 0, scaleFact * 0.58, 0, Math.PI * 2);
        ctx.stroke();

      } else if (curShape === 'metatrons_cube') {
        const rad = size * 0.22;
        const nodes: {x: number, y: number, color: string}[] = [];
        ctx.lineWidth = 0.7;

        nodes.push({ x: 0, y: 0, color: getColor(0, opacityVal) });
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          nodes.push({ x: Math.cos(angle) * rad, y: Math.sin(angle) * rad, color: getColor(i * 30, opacityVal) });
          nodes.push({ x: Math.cos(angle) * rad * 2, y: Math.sin(angle) * rad * 2, color: getColor(i * 30 + 60, opacityVal) });
        }

        // Batch all 78 interconnecting lines into a single path and single stroke
        ctx.strokeStyle = getColor(0, opacityVal * 0.25);
        ctx.beginPath();
        for (let a = 0; a < nodes.length; a++) {
          for (let b = a + 1; b < nodes.length; b++) {
            ctx.moveTo(nodes[a].x, nodes[a].y);
            ctx.lineTo(nodes[b].x, nodes[b].y);
          }
        }
        ctx.stroke();

        nodes.forEach((n) => {
          ctx.strokeStyle = n.color;
          ctx.shadowColor = n.color;
          ctx.beginPath();
          ctx.arc(n.x, n.y, rad * 0.4, 0, Math.PI * 2);
          ctx.stroke();
        });

      } else if (curShape === 'bipolar_torus') {
        const rad = size * 0.88;
        ctx.lineWidth = 0.9;
        const circlesCount = 8;
        for (let i = 1; i <= circlesCount; i++) {
          const ratio = i / circlesCount;
          const cyOffset = rad * (1 - ratio);
          const currentRad = rad * ratio;

          ctx.strokeStyle = getColor(i * 30, opacityVal);
          ctx.shadowColor = getColor(i * 30, opacityVal);

          ctx.beginPath();
          ctx.arc(0, -cyOffset, currentRad, 0, Math.PI * 2);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, cyOffset, currentRad, 0, Math.PI * 2);
          ctx.stroke();
        }

      } else if (curShape === 'lakshmi_star') {
        const rad = size * 0.68;
        ctx.lineWidth = 1.0;
        const drawSquare = (angle: number, colorIdx: number) => {
          ctx.save();
          ctx.rotate(angle);
          ctx.strokeStyle = getColor(colorIdx, opacityVal);
          ctx.shadowColor = getColor(colorIdx, opacityVal);
          ctx.beginPath();
          ctx.rect(-rad * 0.5, -rad * 0.5, rad, rad);
          ctx.stroke();
          ctx.restore();
        };

        drawSquare(0, 0);
        drawSquare(Math.PI / 4, 80);

        ctx.strokeStyle = getColor(160, opacityVal);
        ctx.shadowColor = getColor(160, opacityVal);
        ctx.beginPath();
        ctx.arc(0, 0, rad * 0.3, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    };
  }, [isPlaying]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />;
};

export default GameplayVisualizer;
