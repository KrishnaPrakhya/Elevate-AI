"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { cn } from "@/lib/utils";

interface AIResponseFormatterProps {
  content: string;
  className?: string;
  variant?: "default" | "compact" | "chat";
}

/**
 * Centralized AI Response Formatter
 *
 * Provides consistent markdown rendering across all AI-powered features:
 * - Properly styled tables with borders and padding
 * - Syntax highlighting for code blocks
 * - Consistent heading, list, and blockquote styling
 * - Support for HTML tables (for legacy content)
 */
export function AIResponseFormatter({
  content,
  className,
  variant = "default",
}: AIResponseFormatterProps) {
  const baseClasses = cn(
    "prose prose-sm max-w-none dark:prose-invert",
    variant === "compact" && "prose-xs",
    variant === "chat" &&
      "prose-xs leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
    className,
  );

  return (
    <div className={baseClasses}>
      <style jsx global>{`
        /* Table styling - the core fix for garbled tables */
        .prose table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          font-size: 0.875rem;
        }

        .prose th,
        .prose td {
          border: 1px solid hsl(var(--border));
          padding: 0.75rem 1rem;
          text-align: left;
        }

        .prose th {
          background-color: hsl(var(--muted));
          font-weight: 600;
          color: hsl(var(--foreground));
        }

        .prose tr:nth-child(even) {
          background-color: hsl(var(--muted) / 0.3);
        }

        .prose tr:hover {
          background-color: hsl(var(--muted) / 0.5);
        }

        /* Code block styling */
        .prose pre {
          background-color: hsl(var(--muted));
          border: 1px solid hsl(var(--border));
          border-radius: 0.5rem;
          padding: 1rem;
          overflow-x: auto;
          font-size: 0.8rem;
          margin: 1rem 0;
        }

        .prose code {
          background-color: hsl(var(--muted));
          padding: 0.2rem 0.4rem;
          border-radius: 0.25rem;
          font-size: 0.85em;
        }

        .prose pre code {
          background-color: transparent;
          padding: 0;
        }

        /* Heading styling */
        .prose h1,
        .prose h2,
        .prose h3,
        .prose h4,
        .prose h5,
        .prose h6 {
          color: hsl(var(--foreground));
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }

        .prose h1 {
          font-size: 1.5rem;
        }
        .prose h2 {
          font-size: 1.25rem;
        }
        .prose h3 {
          font-size: 1.1rem;
        }
        .prose h4 {
          font-size: 1rem;
        }

        /* List styling */
        .prose ul,
        .prose ol {
          padding-left: 1.5rem;
          margin: 0.75rem 0;
        }

        .prose li {
          margin: 0.35rem 0;
        }

        /* Blockquote styling */
        .prose blockquote {
          border-left: 3px solid hsl(var(--primary));
          padding-left: 1rem;
          color: hsl(var(--muted-foreground));
          font-style: italic;
          margin: 1rem 0;
        }

        /* Link styling */
        .prose a {
          color: hsl(var(--primary));
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .prose a:hover {
          opacity: 0.8;
        }

        /* Horizontal rule */
        .prose hr {
          border-color: hsl(var(--border));
          margin: 1.5rem 0;
        }

        /* Paragraph spacing */
        .prose p {
          margin: 0.75rem 0;
          line-height: 1.6;
        }

        /* Strong/Bold text */
        .prose strong {
          font-weight: 600;
          color: hsl(var(--foreground));
        }

        /* Compact variant adjustments */
        .prose-xs table {
          font-size: 0.75rem;
        }

        .prose-xs th,
        .prose-xs td {
          padding: 0.5rem 0.75rem;
        }

        .prose-xs pre {
          padding: 0.75rem;
          font-size: 0.7rem;
        }
      `}</style>

      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Custom table renderer
          table: ({ node, children, ...props }) => (
            <div className="overflow-x-auto">
              <table {...props}>{children}</table>
            </div>
          ),
          // Custom code block renderer
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            return match ? (
              <pre className={className}>
                <code {...props}>{children}</code>
              </pre>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Pre-formats AI response content for better display
 * - Fixes common markdown table issues
 * - Normalizes whitespace
 * - Ensures proper line breaks
 */
export function formatAIResponse(content: string): string {
  if (!content) return "";

  let formatted = content;

  const normalizeBrokenPipeTables = (text: string): string => {
    // Some model outputs compact full table rows into one line separated by "||".
    // Expand those separators first so row-level normalization can work reliably.
    const expanded = text.includes("||")
      ? text.replace(/\s*\|\|\s*/g, "\n")
      : text;

    const lines = expanded.split(/\r?\n/);
    const likelyBrokenTable = lines.some((line) => {
      const t = line.trim();
      return (
        t.includes("||") ||
        /^-+\|/.test(t) ||
        /^\|\s*\|/.test(t) ||
        /^-\|$/.test(t)
      );
    });

    if (!likelyBrokenTable) return text;

    const normalized: string[] = [];
    for (const line of lines) {
      const t = line.trim();

      if (!t) {
        normalized.push("");
        continue;
      }

      // Drop table separator-only rows from malformed markdown.
      if (/^[-:|\s]+$/.test(t)) {
        continue;
      }

      if (t.includes("|")) {
        const cells = t
          .split("|")
          .map((cell) => cell.trim())
          .map((cell) => cell.replace(/^[-*]+\s*/, "").trim())
          .filter(Boolean);

        if (cells.length === 0) {
          continue;
        }

        const isHeaderRow =
          cells.length >= 2 &&
          /observation|area|strength|recommendation|example/i.test(cells[0]) &&
          /why|evidence|detail|rationale|example/i.test(
            cells.slice(1).join(" "),
          );

        if (isHeaderRow) {
          continue;
        }

        if (cells.length === 1) {
          normalized.push(cells[0]);
        } else if (cells.length === 2) {
          normalized.push(`- ${cells[0]}: ${cells[1]}`);
        } else {
          normalized.push(`- ${cells[0]}: ${cells.slice(1).join(" | ")}`);
        }
        continue;
      }

      normalized.push(line);
    }

    return normalized.join("\n");
  };

  formatted = normalizeBrokenPipeTables(formatted);

  // Normalize HTML line breaks that frequently appear in model output.
  formatted = formatted.replace(/<br\s*\/?\s*>/gi, "\n");

  // Ensure markdown horizontal rules are on their own lines.
  formatted = formatted.replace(/(^|\n)\s*---\s*(?=\n|$)/g, "$1---");

  // Ensure markdown headings start on a new line.
  formatted = formatted.replace(/([^\n])\s*(#{1,6}\s+)/g, "$1\n\n$2");

  // Ensure numbered section labels begin on a new line.
  formatted = formatted.replace(/([^\n])\s+(\d+\.\s+\*\*)/g, "$1\n\n$2");

  // Fix tables without proper spacing
  formatted = formatted.replace(/(\|[^|]+\|)\n(\|[-| ]+\|)\n/g, "$1\n$2\n");

  // Break table separator rows onto their own line if they are inline.
  formatted = formatted.replace(/\s+(\|\s*[-:]{2,}[-|:\s]*\|)/g, "\n$1");

  // Ensure each table row starts on a new line when multiple rows are compacted.
  formatted = formatted.replace(/\|\s+(?=\|)/g, "|\n|");

  // Ensure blank lines before headings
  formatted = formatted.replace(/([^\n])\n(#{1,6}\s)/g, "$1\n\n$2");

  // Ensure blank lines before code blocks
  formatted = formatted.replace(/([^\n])\n(```)/g, "$1\n\n$2");

  // Normalize multiple blank lines to single blank line
  formatted = formatted.replace(/\n{3,}/g, "\n\n");

  return formatted.trim();
}

export default AIResponseFormatter;
