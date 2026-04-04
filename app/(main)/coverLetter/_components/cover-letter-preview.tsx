"use client";

import { cn } from "@/lib/utils";
import {
  DeSitterCoverLetter,
  VenkatCoverLetter,
  JacksonSharpCoverLetter,
  ExecutiveCoverLetter,
  CreativeCoverLetter,
  LATEX_COVER_LETTER_TEMPLATES,
} from "./latex-templates";

interface CoverLetterPreviewProps {
  content: string;
  template: string;
}

export function CoverLetterPreview({ content, template }: CoverLetterPreviewProps) {
  const TemplateComponent = getTemplateComponent(template);

  return (
    <div className={cn("transition-all duration-300")}>
      {TemplateComponent ? (
        <TemplateComponent content={content} />
      ) : (
        // Fallback to basic template
        <DeSitterCoverLetter content={content} />
      )}
    </div>
  );
}

function getTemplateComponent(template: string) {
  const templateConfig = LATEX_COVER_LETTER_TEMPLATES.find((t) => t.id === template);
  return templateConfig?.component || DeSitterCoverLetter;
}

// Export templates for selector
export { LATEX_COVER_LETTER_TEMPLATES };
