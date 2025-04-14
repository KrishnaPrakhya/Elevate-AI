"use client";
import MDEditor from "@uiw/react-md-editor";
import { cn } from "@/lib/utils";

interface ResumePreviewProps {
  content: string;
  template: string;
}

export function ResumePreview({ content, template }: ResumePreviewProps) {
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
    case "modern":
      return "bg-white font-sans border-l-4 border-blue-500";
    case "classic":
      return "bg-white font-serif";
    case "minimal":
      return "bg-white font-sans";
    case "professional":
      return "bg-white font-sans border-t-4 border-slate-700";
    case "creative":
      return "bg-white font-sans bg-gradient-to-br from-purple-50 to-white";
    default:
      return "bg-white font-sans";
  }
}

function getTemplateFontFamily(template: string): string {
  switch (template) {
    case "modern":
      return "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    case "classic":
      return "'Georgia', 'Times New Roman', serif";
    case "minimal":
      return "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    case "professional":
      return "'Arial', 'Helvetica', sans-serif";
    case "creative":
      return "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    default:
      return "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  }
}
