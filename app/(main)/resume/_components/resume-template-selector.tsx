"use client";
import { Card, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string;
}

interface ResumeTemplateSelectorProps {
  templates: Template[];
  selectedTemplate: string;
  onSelect: (templateId: string) => void;
}

export function ResumeTemplateSelector({
  templates,
  selectedTemplate,
  onSelect,
}: ResumeTemplateSelectorProps) {
  return (
    <>
      {templates.map((template) => (
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
            <div className="h-32 bg-muted/50 flex items-center justify-center">
              <div
                className={`w-20 h-28 border ${getTemplatePreviewStyle(
                  template.id
                )}`}
              ></div>
            </div>
          </div>
          <CardFooter className="p-3 flex flex-col items-start">
            <p className="font-medium text-sm">{template.name}</p>
            <p className="text-xs text-muted-foreground">
              {template.description}
            </p>
          </CardFooter>
        </Card>
      ))}
    </>
  );
}

function getTemplatePreviewStyle(templateId: string): string {
  switch (templateId) {
    case "modern":
      return "bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200";
    case "classic":
      return "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200";
    case "minimal":
      return "bg-white border-gray-100";
    case "professional":
      return "bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200";
    case "creative":
      return "bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200";
    default:
      return "bg-white border-gray-200";
  }
}
