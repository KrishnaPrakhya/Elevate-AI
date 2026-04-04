"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { LATEX_TEMPLATES } from "./latex-templates";

interface ResumeTemplateSelectorProps {
  templates?: Array<{ id: string; name: string; description: string }>;
  selectedTemplate: string;
  onSelect: (templateId: string) => void;
}

export function ResumeTemplateSelector({
  templates,
  selectedTemplate,
  onSelect,
}: ResumeTemplateSelectorProps) {
  // Use LaTeX templates if no templates provided
  const templateList = templates || LATEX_TEMPLATES;

  return (
    <>
      {templateList.map((template) => (
        <Card
          key={template.id}
          className={cn(
            "cursor-pointer transition-all hover:shadow-md overflow-hidden",
            selectedTemplate === template.id
              ? "border-primary ring-2 ring-primary/20"
              : "border-border hover:border-primary/50"
          )}
          onClick={() => onSelect(template.id)}
        >
          <div className="relative">
            <div className="absolute top-2 right-2 z-10">
              {selectedTemplate === template.id && (
                <div className="bg-primary text-primary-foreground rounded-full p-1">
                  <Check className="h-4 w-4" />
                </div>
              )}
            </div>
            <div className="h-32 bg-muted/50 flex items-center justify-center p-2">
              <TemplatePreview templateId={template.id} />
            </div>
          </div>
          <div className="p-3">
            <p className="font-medium text-sm">{template.name}</p>
            <p className="text-xs text-muted-foreground">
              {template.description}
            </p>
          </div>
        </Card>
      ))}
    </>
  );
}

function TemplatePreview({ templateId }: { templateId: string }) {
  switch (templateId) {
    case "de-sitter":
      return (
        <div className="w-full h-full bg-white border border-gray-200 p-2">
          <div className="text-center border-b border-black pb-1 mb-2">
            <div className="h-2 bg-black w-2/3 mx-auto mb-1" />
            <div className="h-1 bg-gray-400 w-1/2 mx-auto" />
          </div>
          <div className="space-y-2">
            <div className="h-1 bg-black w-1/3" />
            <div className="h-0.5 bg-gray-300 w-full" />
            <div className="space-y-1">
              <div className="h-0.5 bg-gray-200 w-full" />
              <div className="h-0.5 bg-gray-200 w-full" />
            </div>
          </div>
        </div>
      );
    case "venkat":
      return (
        <div className="w-full h-full bg-white border border-gray-200 p-2">
          <div className="text-center mb-2">
            <div className="h-2 bg-blue-500 w-2/3 mx-auto mb-1" />
            <div className="h-0.5 bg-gray-400 w-1/2 mx-auto" />
          </div>
          <div className="space-y-2">
            <div className="h-1 bg-blue-500 w-1/3" />
            <div className="h-0.5 bg-blue-500 w-full" />
            <div className="space-y-1">
              <div className="h-0.5 bg-gray-200 w-full" />
              <div className="h-0.5 bg-gray-200 w-full" />
            </div>
          </div>
        </div>
      );
    case "jackson-sharp":
      return (
        <div className="w-full h-full bg-white border border-gray-200 p-2">
          <div className="text-center border-b-2 border-black pb-1 mb-2">
            <div className="h-2 bg-black w-2/3 mx-auto mb-1" />
            <div className="h-0.5 bg-gray-400 w-1/2 mx-auto" />
          </div>
          <div className="space-y-2">
            <div className="h-0.5 bg-black w-full" />
            <div className="space-y-1">
              <div className="h-0.5 bg-gray-200 w-full" />
              <div className="h-0.5 bg-gray-200 w-full" />
            </div>
          </div>
        </div>
      );
    case "clark":
      return (
        <div className="w-full h-full bg-white border border-gray-200 p-2">
          <div className="flex justify-between items-end border-b-2 border-black pb-1 mb-2">
            <div className="h-3 bg-black w-1/2" />
            <div className="space-y-0.5">
              <div className="h-0.5 bg-gray-400 w-16" />
              <div className="h-0.5 bg-gray-400 w-12" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <div className="h-0.5 bg-black flex-1" />
            </div>
            <div className="space-y-1">
              <div className="h-0.5 bg-gray-200 w-full" />
              <div className="h-0.5 bg-gray-200 w-full" />
            </div>
          </div>
        </div>
      );
    case "racine":
      return (
        <div className="w-full h-full bg-white border border-gray-200 p-2">
          <div className="text-center mb-3">
            <div className="h-2 bg-gray-300 w-2/3 mx-auto mb-1" />
            <div className="h-0.5 bg-gray-300 w-1/2 mx-auto" />
          </div>
          <div className="space-y-2">
            <div className="text-center">
              <div className="h-0.5 bg-gray-300 w-1/3 mx-auto" />
            </div>
            <div className="space-y-1">
              <div className="h-0.5 bg-gray-100 w-full" />
              <div className="h-0.5 bg-gray-100 w-full" />
            </div>
          </div>
        </div>
      );
    default:
      return (
        <div className="w-20 h-28 border border-gray-200 bg-white" />
      );
  }
}
