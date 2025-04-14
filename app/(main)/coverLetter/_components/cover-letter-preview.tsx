"use client";

import MDEditor from "@uiw/react-md-editor";
import { cn } from "@/lib/utils";

interface CoverLetterPreviewProps {
  content: string;
  template: string;
}

export function CoverLetterPreview({
  content,
  template,
}: CoverLetterPreviewProps) {
  return (
    <div className={cn("p-8", getTemplateStyles(template))}>
      <MDEditor.Markdown
        source={content}
        style={{
          background: "transparent",
          fontFamily: getTemplateFontFamily(template),
        }}
      />
    </div>
  );
}

function getTemplateStyles(template: string): string {
  switch (template) {
    case "professional":
      return "bg-white font-serif border-t-4 border-slate-700";
    case "modern":
      return "bg-white font-sans border-l-4 border-blue-500";
    case "creative":
      return "bg-white font-sans bg-gradient-to-br from-purple-50 to-white";
    case "executive":
      return "bg-white font-serif border-2 border-slate-300";
    case "technical":
      return "bg-white font-mono border-t-4 border-cyan-600";
    case "entry-level":
      return "bg-white font-sans border-l-4 border-green-500";
    default:
      return "bg-white font-sans";
  }
}

function getTemplateFontFamily(template: string): string {
  switch (template) {
    case "professional":
    case "executive":
      return "'Georgia', 'Times New Roman', serif";
    case "modern":
    case "creative":
    case "entry-level":
      return "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    case "technical":
      return "'Courier New', monospace";
    default:
      return "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  }
}

export default CoverLetterPreview;
