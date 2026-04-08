"use client";

import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
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
  const baseClasses = cn("max-w-none", className);

  const markdownComponents: Components = {
    h1: ({ children }) => (
      <h1 className="mt-5 mb-3 text-2xl font-bold tracking-tight">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-4 mb-2 text-xl font-semibold tracking-tight">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-4 mb-2 text-lg font-semibold tracking-tight">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="mt-3 mb-2 text-base font-semibold">{children}</h4>
    ),
    p: ({ children }) => (
      <p className="my-2 whitespace-pre-wrap text-sm leading-6 text-foreground/95">
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul className="my-2 list-disc pl-5 text-sm leading-6">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="my-2 list-decimal pl-5 text-sm leading-6">{children}</ol>
    ),
    li: ({ children }) => <li className="my-1">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="my-3 border-l-4 border-primary/60 bg-muted/40 px-3 py-2 text-sm italic text-muted-foreground">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-4 border-border" />,
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-primary underline underline-offset-2 hover:opacity-80"
      >
        {children}
      </a>
    ),
    table: ({ children }) => (
      <div className="my-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-muted/80">{children}</thead>,
    th: ({ children }) => (
      <th className="border border-border px-3 py-2 text-left font-semibold text-foreground">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-border px-3 py-2 align-top text-foreground/95">
        {children}
      </td>
    ),
    code: ({ className: codeClassName, children, ...props }) => {
      const languageMatch = /language-(\w+)/.exec(codeClassName || "");
      const contentValue = String(children ?? "");
      const isBlock = Boolean(languageMatch) || contentValue.includes("\n");

      if (isBlock) {
        return (
          <pre className="my-3 overflow-x-auto rounded-lg border border-border bg-muted p-3 text-xs leading-6">
            <code className={codeClassName} {...props}>
              {children}
            </code>
          </pre>
        );
      }

      return (
        <code
          className="rounded bg-muted px-1.5 py-0.5 text-[0.85em] font-medium"
          {...props}
        >
          {children}
        </code>
      );
    },
  };

  return (
    <div
      className={cn(
        baseClasses,
        variant === "compact" &&
          "text-sm [&_table]:text-xs [&_th]:px-2 [&_th]:py-1.5 [&_td]:px-2 [&_td]:py-1.5",
        variant === "chat" &&
          "text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={markdownComponents}
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

  const normalizeOutsideCodeBlocks = (
    text: string,
    normalize: (segment: string) => string,
  ): string => {
    const fencedSegments = text.split(/(```[\s\S]*?```)/g);
    return fencedSegments
      .map((segment) =>
        segment.startsWith("```") ? segment : normalize(segment),
      )
      .join("");
  };

  const isTableSeparatorRow = (line: string): boolean =>
    /^\|\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(line.trim());

  const isPotentialTableRow = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed || isTableSeparatorRow(trimmed)) return false;
    const pipeCount = (trimmed.match(/\|/g) || []).length;
    return pipeCount >= 2;
  };

  const normalizeTableRow = (line: string): string => {
    const trimmed = line.trim();
    if (!isPotentialTableRow(trimmed)) return line;

    let row = trimmed;
    if (!row.startsWith("|")) row = `| ${row}`;
    if (!row.endsWith("|")) row = `${row} |`;
    row = row.replace(/\|\|+/g, "| |");
    row = row.replace(/\s*\|\s*/g, " | ");
    row = row.replace(/\s{2,}/g, " ").trim();

    return row;
  };

  const insertMissingTableSeparators = (text: string): string => {
    const lines = text.split("\n");
    const output: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const current = normalizeTableRow(lines[i]);
      const next = i + 1 < lines.length ? lines[i + 1].trim() : "";

      output.push(current);

      if (
        !isPotentialTableRow(current) ||
        isTableSeparatorRow(next) ||
        !isPotentialTableRow(next)
      ) {
        continue;
      }

      const cellCount = current
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean).length;

      if (cellCount >= 2) {
        output.push(`| ${new Array(cellCount).fill("---").join(" | ")} |`);
      }
    }

    return output.join("\n");
  };

  let formatted = content.replace(/\r\n/g, "\n").trim();

  const wrappedMarkdown = formatted.match(
    /^```(?:md|markdown|text)?\n([\s\S]*?)\n```$/i,
  );
  if (wrappedMarkdown?.[1]) {
    formatted = wrappedMarkdown[1].trim();
  }

  formatted = formatted.replace(/<br\s*\/?\s*>/gi, "\n");

  formatted = normalizeOutsideCodeBlocks(formatted, (segment) => {
    let next = segment;

    // Move markdown headings onto clean boundaries.
    next = next.replace(/([^\n])\s*(#{1,6}\s+)/g, "$1\n\n$2");
    next = next.replace(/([^\n])\n(#{1,6}\s)/g, "$1\n\n$2");

    // Some model outputs compact table rows with double pipes between rows.
    next = next.replace(/\|\|\s*(?=\|)/g, "\n");

    // Ensure horizontal rules are isolated lines.
    next = next.replace(/\s*(---+)\s*/g, "\n$1\n");

    next = insertMissingTableSeparators(next);

    // Normalize spacing to avoid giant gaps but preserve paragraph breaks.
    next = next.replace(/\n{3,}/g, "\n\n");

    return next;
  });

  return formatted.trim();
}

export default AIResponseFormatter;
