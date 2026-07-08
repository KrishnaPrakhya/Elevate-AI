"use client";

import { useEffect, useRef } from "react";

/**
 * Generative elevation-contour background for the hero.
 * Draws drifting topographic lines (literal "elevation" — the product's
 * namesake) with a single climbing marker that rises toward a summit tick
 * on the right edge, looping slowly.
 *
 * Colors are hardcoded RGB (not read from CSS custom properties): this
 * app's active theme tokens are oklch(...) values, which canvas cannot
 * safely splice into an hsla()/rgba() string, so instead we mirror the
 * .landing-scope palette (see globals.css) directly in JS and pick
 * light/dark by checking the .dark class, same as animated-gradient.tsx.
 */
const PALETTE = {
  light: { line: [216, 222, 228], accent: [235, 143, 5] },
  dark: { line: [38, 45, 59], accent: [248, 175, 47] },
};

export default function TopoCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let width = 0;
    let height = 0;
    let dpr = 1;

    function resize() {
      const parent = canvas!.parentElement;
      width = parent ? parent.clientWidth : window.innerWidth;
      height = parent ? parent.clientHeight : window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.max(1, width * dpr);
      canvas!.height = Math.max(1, height * dpr);
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);
    // Layout can settle after fonts/images load without firing a window
    // resize event — recheck a couple of times shortly after mount.
    const settleTimers = [setTimeout(resize, 150), setTimeout(resize, 500)];

    let raf = 0;
    let t = 0;

    // Fewer bands, spread wider, gentle amplitude — reads as quiet texture
    // rather than lines competing with the headline for attention.
    const bands = Array.from({ length: 6 }, (_, i) => ({
      baseY: 0.08 + i * 0.16,
      amp: 10 + (i % 3) * 5,
      freq: 3 + (i % 4) * 0.8, // full cycles across the width
      speed: 0.05 + (i % 5) * 0.012,
      phase: i * 1.7,
    }));

    function contourY(band: (typeof bands)[number], x: number, time: number) {
      const nx = x / width;
      return (
        band.baseY * height +
        Math.sin(nx * Math.PI * 2 * band.freq + time * band.speed + band.phase) *
          band.amp +
        Math.sin(
          nx * Math.PI * 2 * band.freq * 1.7 + time * band.speed * 1.3
        ) *
          (band.amp * 0.25)
      );
    }

    function draw() {
      if (!ctx || width === 0 || height === 0) {
        raf = requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, width, height);

      const isDark = document.documentElement.classList.contains("dark");
      const palette = isDark ? PALETTE.dark : PALETTE.light;
      const [lr, lg, lb] = palette.line;
      const [ar, ag, ab] = palette.accent;

      bands.forEach((band, i) => {
        ctx.beginPath();
        for (let x = 0; x <= width; x += 8) {
          const y = contourY(band, x, t);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        const fade = 0.14 + (i / bands.length) * 0.16;
        ctx.strokeStyle = `rgba(${lr}, ${lg}, ${lb}, ${fade})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Climbing marker: rides the topmost band, looping left-to-right.
      const cycle = (t * 0.05) % 1;
      const markerX = cycle * width;
      const markerBand = bands[0];
      const markerY = contourY(markerBand, markerX, t);

      ctx.beginPath();
      ctx.arc(markerX, markerY, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${ar}, ${ag}, ${ab}, 0.85)`;
      ctx.shadowColor = `rgba(${ar}, ${ag}, ${ab}, 0.5)`;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Faint trailing tail.
      ctx.beginPath();
      for (let i = 0; i <= 36; i++) {
        const px = markerX - i * 3;
        if (px < 0) break;
        const py = contourY(markerBand, px, t);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, 0.3)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (!prefersReducedMotion) {
        t += 0.02;
      }
      raf = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      settleTimers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
