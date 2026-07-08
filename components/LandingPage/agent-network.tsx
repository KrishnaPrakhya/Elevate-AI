"use client";

import { useEffect, useRef } from "react";

interface AgentNodeSpec {
  id: string;
  label: string;
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
}

// Mirrors the real LangGraph supervisor/agent routing in server/app.py —
// this is a literal diagram of the product's own architecture, not a
// decorative "neural network" graphic.
const AGENTS: AgentNodeSpec[] = [
  { id: "career", label: "Career Advisor", x: 0.82, y: 0.04 },
  { id: "scheduler", label: "Calendar Agent", x: 0.98, y: 0.28 },
  { id: "interview", label: "Interview Prep", x: 0.98, y: 0.52 },
  { id: "jobs", label: "Job Search", x: 0.82, y: 0.76 },
  { id: "docs", label: "Document Improver", x: 0.58, y: 1 },
];

const SUPERVISOR = { x: 0.13, y: 0.5, label: "Supervisor" };

// Same rationale as topo-canvas.tsx: hardcode theme-aware RGB rather than
// parsing this app's oklch(...) CSS variables into canvas color strings.
const PALETTE = {
  light: {
    line: [44, 127, 150], // muted cyan — idle edges/nodes
    accent: [235, 143, 5], // signal amber — active dispatch
    ink: [22, 29, 44],
    panel: [255, 255, 255], // matches --card in light .landing-scope
  },
  dark: {
    line: [95, 194, 221],
    accent: [248, 175, 47],
    ink: [239, 243, 245],
    panel: [16, 20, 30], // matches --card in dark .landing-scope
  },
};

type Point = { x: number; y: number };

/** Quadratic Bezier evaluated at t — shared by the drawn curve and the
 *  traveling packet so the dot always sits exactly on the line. */
function bezierPoint(p0: Point, control: Point, p2: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * control.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * control.y + t * t * p2.y,
  };
}

export default function AgentNetwork() {
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
      width = parent ? parent.clientWidth : 480;
      height = parent ? parent.clientHeight : 320;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.max(1, width * dpr);
      canvas!.height = Math.max(1, height * dpr);
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);
    const settleTimers = [setTimeout(resize, 150), setTimeout(resize, 500)];

    let raf = 0;
    let activeIndex = 0;
    let travel = 0;
    const DISPATCH_DURATION = 130; // frames per leg

    // Inset the usable drawing area so nodes at x/y 0 or 1 still keep
    // breathing room from the panel border instead of sitting flush
    // against it.
    function pos(node: { x: number; y: number }): Point {
      const padX = width * 0.07;
      const padY = height * 0.12;
      return {
        x: padX + node.x * (width - padX * 2),
        y: padY + node.y * (height - padY * 2),
      };
    }

    // Gentle bend toward supervisor's height — enough to read as routed
    // "cables" fanning out, but not so much that a curve aimed at a distant
    // node sweeps across a label sitting between it and the supervisor.
    function controlPoint(sup: Point, target: Point): Point {
      const midX = (sup.x + target.x) / 2;
      const midY = (sup.y + target.y) / 2;
      const bend = 0.35;
      return { x: midX, y: midY + (sup.y - midY) * bend };
    }

    function drawLabelChip(
      text: string,
      x: number,
      y: number,
      align: CanvasTextAlign,
      panelRgb: number[]
    ) {
      const metrics = ctx!.measureText(text);
      const paddingX = 4;
      const boxWidth = metrics.width + paddingX * 2;
      const boxHeight = 14;
      const boxX = align === "right" ? x - boxWidth + paddingX : x - paddingX;
      ctx!.fillStyle = `rgba(${panelRgb[0]}, ${panelRgb[1]}, ${panelRgb[2]}, 0.92)`;
      ctx!.fillRect(boxX, y - boxHeight / 2, boxWidth, boxHeight);
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
      const [ir, ig, ib] = palette.ink;
      const panelRgb = palette.panel;

      const sup = pos(SUPERVISOR);
      const controls = AGENTS.map((agent) => controlPoint(sup, pos(agent)));

      // Edges
      AGENTS.forEach((agent, i) => {
        const p = pos(agent);
        const c = controls[i];
        const isActive = i === activeIndex && travel <= 1;
        ctx.beginPath();
        ctx.moveTo(sup.x, sup.y);
        ctx.quadraticCurveTo(c.x, c.y, p.x, p.y);
        ctx.strokeStyle = isActive
          ? `rgba(${ar}, ${ag}, ${ab}, 0.6)`
          : `rgba(${lr}, ${lg}, ${lb}, 0.28)`;
        ctx.lineWidth = isActive ? 1.75 : 1;
        ctx.stroke();
      });

      // Supervisor node + label (label painted on an opaque chip so no
      // edge line can show through the gaps between letters)
      ctx.beginPath();
      ctx.arc(sup.x, sup.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${ar}, ${ag}, ${ab}, 0.95)`;
      ctx.shadowColor = `rgba(${ar}, ${ag}, ${ab}, 0.5)`;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.font = "600 11px ui-monospace, monospace";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      drawLabelChip(
        SUPERVISOR.label.toUpperCase(),
        sup.x + 14,
        sup.y - 14,
        "left",
        panelRgb
      );
      ctx.fillStyle = `rgba(${ir}, ${ig}, ${ib}, 0.85)`;
      ctx.fillText(SUPERVISOR.label.toUpperCase(), sup.x + 14, sup.y - 14);

      // Agent nodes + labels
      AGENTS.forEach((agent, i) => {
        const p = pos(agent);
        const isActive = i === activeIndex && travel <= 1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, isActive ? 5 : 3.25, 0, Math.PI * 2);
        ctx.fillStyle = isActive
          ? `rgba(${ar}, ${ag}, ${ab}, 0.95)`
          : `rgba(${lr}, ${lg}, ${lb}, 0.7)`;
        if (isActive) {
          ctx.shadowColor = `rgba(${ar}, ${ag}, ${ab}, 0.5)`;
          ctx.shadowBlur = 10;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.font = isActive
          ? "600 10.5px ui-monospace, monospace"
          : "500 10.5px ui-monospace, monospace";
        const onRightEdge = p.x > width * 0.88;
        ctx.textAlign = onRightEdge ? "right" : "left";
        const labelX = onRightEdge ? p.x - 9 : p.x + 10;

        drawLabelChip(agent.label, labelX, p.y, ctx.textAlign, panelRgb);
        ctx.fillStyle = isActive
          ? `rgba(${ir}, ${ig}, ${ib}, 0.95)`
          : `rgba(${ir}, ${ig}, ${ib}, 0.7)`;
        ctx.fillText(agent.label, labelX, p.y);
      });

      // Traveling packet — walks the exact same Bezier curve as the active
      // edge, so it visibly rides the line instead of cutting a shortcut.
      const legProgress = travel <= 1 ? travel : 2 - travel;
      const t = legProgress * legProgress * (3 - 2 * legProgress); // smoothstep
      const target = pos(AGENTS[activeIndex]);
      const control = controls[activeIndex];
      const packet = bezierPoint(sup, control, target, t);

      ctx.beginPath();
      ctx.arc(packet.x, packet.y, 2.75, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${ar}, ${ag}, ${ab}, 1)`;
      ctx.shadowColor = `rgba(${ar}, ${ag}, ${ab}, 0.7)`;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (!prefersReducedMotion) {
        travel += 1 / DISPATCH_DURATION;
        if (travel >= 2) {
          travel = 0;
          activeIndex = (activeIndex + 1) % AGENTS.length;
        }
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
      className="h-full w-full"
      role="img"
      aria-label="Diagram of the supervisor agent dispatching requests to specialized agents: Career Advisor, Calendar Agent, Interview Prep, Job Search, and Document Improver"
    />
  );
}
