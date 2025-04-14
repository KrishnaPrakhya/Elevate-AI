"use client";

import { useEffect, useRef } from "react";

export default function AnimatedGradient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight * 0.8;

    if (canvas) {
      canvas.width = width;
      canvas.height = height;
    }

    // Get primary color from CSS variables
    const computedStyle = getComputedStyle(document.documentElement);
    const primaryHsl = computedStyle.getPropertyValue("--primary").trim();
    const primaryRgb = hslToRgb(primaryHsl);

    // Create gradient circles
    const circles = [
      {
        x: width * 0.2,
        y: height * 0.3,
        radius: width * 0.3,
        color: `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.05)`,
      },
      {
        x: width * 0.8,
        y: height * 0.7,
        radius: width * 0.4,
        color: `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.07)`,
      },
      {
        x: width * 0.5,
        y: height * 0.2,
        radius: width * 0.2,
        color: `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.03)`,
      },
      {
        x: width * 0.3,
        y: height * 0.8,
        radius: width * 0.25,
        color: `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.04)`,
      },
      {
        x: width * 0.7,
        y: height * 0.4,
        radius: width * 0.15,
        color: `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.06)`,
      },
    ];

    function draw() {
      ctx?.clearRect(0, 0, width, height);

      // Check if we're in dark mode
      const isDarkMode = document.documentElement.classList.contains("dark");

      // Draw each circle
      circles.forEach((circle) => {
        // Adjust opacity for dark mode
        const color = circle.color;
        const darkModeColor = color.replace(
          /rgba$$(\d+), (\d+), (\d+), ([\d.]+)$$/,
          (_, r, g, b, a) =>
            `rgba(${r}, ${g}, ${b}, ${Number.parseFloat(a) * 1.5})`
        );

        const gradient = ctx?.createRadialGradient(
          circle.x,
          circle.y,
          0,
          circle.x,
          circle.y,
          circle.radius
        );

        if (gradient) {
          gradient.addColorStop(0, isDarkMode ? darkModeColor : color);
          gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        }

        if (ctx && gradient) {
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Animate circles
      circles.forEach((circle, index) => {
        const time = Date.now() / 2000;

        circle.x += Math.sin(time + index) * 0.5;
        circle.y += Math.cos(time + index * 0.7) * 0.5;

        // Keep circles within bounds
        if (circle.x < 0) circle.x = 0;
        if (circle.x > width) circle.x = width;
        if (circle.y < 0) circle.y = 0;
        if (circle.y > height) circle.y = height;
      });

      requestAnimationFrame(draw);
    }

    // Handle resize
    function handleResize() {
      width = window.innerWidth;
      height = window.innerHeight * 0.8;
      if (canvas) {
        canvas.width = width;
        canvas.height = height;
      }

      // Adjust circle positions
      circles[0].x = width * 0.2;
      circles[0].y = height * 0.3;
      circles[0].radius = width * 0.3;

      circles[1].x = width * 0.8;
      circles[1].y = height * 0.7;
      circles[1].radius = width * 0.4;

      circles[2].x = width * 0.5;
      circles[2].y = height * 0.2;
      circles[2].radius = width * 0.2;

      circles[3].x = width * 0.3;
      circles[3].y = height * 0.8;
      circles[3].radius = width * 0.25;

      circles[4].x = width * 0.7;
      circles[4].y = height * 0.4;
      circles[4].radius = width * 0.15;
    }

    window.addEventListener("resize", handleResize);
    draw();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Helper function to convert HSL to RGB
  function hslToRgb(hslString: string) {
    // Default to a purple color if parsing fails
    let h = 270,
      s = 80,
      l = 50;

    // Try to parse the HSL string
    const match = hslString.match(/(\d+)deg\s+(\d+)%\s+(\d+)%/);
    if (match) {
      h = Number.parseInt(match[1], 10);
      s = Number.parseInt(match[2], 10);
      l = Number.parseInt(match[3], 10);
    }

    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0,
      g = 0,
      b = 0;

    if (h >= 0 && h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (h >= 60 && h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (h >= 180 && h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (h >= 240 && h < 300) {
      r = x;
      g = 0;
      b = c;
    } else {
      r = c;
      g = 0;
      b = x;
    }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return { r, g, b };
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full opacity-70"
      aria-hidden="true"
    />
  );
}
