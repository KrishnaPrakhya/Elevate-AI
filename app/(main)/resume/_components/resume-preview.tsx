"use client";

import { cn } from "@/lib/utils";
import {
  DeSitterTemplate,
  VenkatTemplate,
  JacksonSharpTemplate,
  ClarkTemplate,
  RacineTemplate,
  LATEX_TEMPLATES,
} from "./latex-templates";

interface ResumePreviewProps {
  content: string;
  template: string;
}

export function ResumePreview({ content, template }: ResumePreviewProps) {
  const TemplateComponent = getTemplateComponent(template);

  return (
    <div className={cn("transition-all duration-300")}>
      {TemplateComponent ? (
        <TemplateComponent content={content} />
      ) : (
        // Fallback to basic template
        <DeSitterTemplate content={content} />
      )}
    </div>
  );
}

function getTemplateComponent(template: string) {
  const templateConfig = LATEX_TEMPLATES.find((t) => t.id === template);
  return templateConfig?.component || DeSitterTemplate;
}

// Export templates for selector
export { LATEX_TEMPLATES };
