"use client";

import { cn } from "@/lib/utils";

export interface LatexTemplateProps {
  content: string;
  template?: string;
}

/**
 * LaTeX-Inspired Resume Templates
 * Professional templates similar to Overleaf's popular resume templates
 */

// ============================================
// DE SITTER TEMPLATE - Clean, Academic Style
// ============================================
export function DeSitterTemplate({ content }: { content: string }) {
  return (
    <div className="latex-de-sitter max-w-[210mm] mx-auto p-[15mm] bg-white text-sm leading-relaxed">
      <style>{`
        .latex-de-sitter {
          font-family: 'Computer Modern', 'Latin Modern Roman', 'Times New Roman', serif;
          color: #1a1a1a;
        }
        .latex-de-sitter h1 {
          font-size: 24px;
          font-weight: 600;
          text-align: center;
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .latex-de-sitter .contact-info {
          text-align: center;
          font-size: 11px;
          color: #444;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid #000;
        }
        .latex-de-sitter .section {
          margin-top: 14px;
        }
        .latex-de-sitter .section-title {
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          border-bottom: 1px solid #000;
          padding-bottom: 2px;
          margin-bottom: 8px;
        }
        .latex-de-sitter .entry {
          margin-bottom: 10px;
        }
        .latex-de-sitter .entry-header {
          display: flex;
          justify-content: space-between;
          font-weight: 600;
          font-size: 12px;
        }
        .latex-de-sitter .entry-title {
          font-style: italic;
        }
        .latex-de-sitter .entry-description {
          margin-top: 4px;
          text-align: justify;
        }
        .latex-de-sitter ul {
          margin: 4px 0 0 0;
          padding-left: 16px;
          font-size: 11px;
        }
        .latex-de-sitter li {
          margin: 2px 0;
        }
      `}</style>

      <div className="contact-info" dangerouslySetInnerHTML={{
        __html: content.split('\n').filter(line =>
          line.includes('📧') || line.includes('📱') ||
          line.includes('LinkedIn') || line.includes('Twitter')
        ).join(' | ')
      }} />

      <div dangerouslySetInnerHTML={{ __html: renderMarkdownToLatex(content) }} />
    </div>
  );
}

// ============================================
// VENKAT TEMPLATE - Modern Professional
// ============================================
export function VenkatTemplate({ content }: { content: string }) {
  return (
    <div className="latex-venkat max-w-[210mm] mx-auto p-[15mm] bg-white text-sm leading-relaxed">
      <style>{`
        .latex-venkat {
          font-family: 'Latin Modern Sans', 'Segoe UI', 'Roboto', sans-serif;
          color: #222;
        }
        .latex-venkat .header {
          text-align: center;
          margin-bottom: 20px;
        }
        .latex-venkat h1 {
          font-size: 28px;
          font-weight: 700;
          color: #2563eb;
          margin-bottom: 8px;
          letter-spacing: 1px;
        }
        .latex-venkat .contact-info {
          font-size: 11px;
          color: #555;
        }
        .latex-venkat .section {
          margin-top: 16px;
        }
        .latex-venkat .section-title {
          font-size: 14px;
          font-weight: 700;
          color: #2563eb;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          border-bottom: 2px solid #2563eb;
          padding-bottom: 4px;
          margin-bottom: 10px;
        }
        .latex-venkat .entry {
          margin-bottom: 12px;
        }
        .latex-venkat .entry-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }
        .latex-venkat .entry-title {
          font-weight: 600;
          font-size: 12px;
        }
        .latex-venkat .entry-company {
          font-weight: 500;
          color: #333;
        }
        .latex-venkat .entry-date {
          font-size: 11px;
          color: #666;
          font-weight: 500;
        }
        .latex-venkat .entry-description {
          margin-top: 6px;
          text-align: justify;
          font-size: 11px;
        }
        .latex-venkat ul {
          margin: 6px 0 0 0;
          padding-left: 16px;
        }
        .latex-venkat li {
          margin: 3px 0;
          color: #333;
        }
      `}</style>

      <div className="header">
        <h1 dangerouslySetInnerHTML={{
          __html: content.match(/## <div align="center">(.*?)<\/div>/)?.[1] || 'Your Name'
        }} />
        <div className="contact-info" dangerouslySetInnerHTML={{
          __html: content.split('\n').filter(line =>
            line.includes('📧') || line.includes('📱') ||
            line.includes('LinkedIn') || line.includes('Twitter')
          ).join(' • ')
        }} />
      </div>

      <div dangerouslySetInnerHTML={{ __html: renderMarkdownToLatex(content) }} />
    </div>
  );
}

// ============================================
// JACKSON SHARP TEMPLATE - Classic Academic
// ============================================
export function JacksonSharpTemplate({ content }: { content: string }) {
  return (
    <div className="latex-jackson-sharp max-w-[210mm] mx-auto p-[15mm] bg-white text-sm leading-relaxed">
      <style>{`
        .latex-jackson-sharp {
          font-family: 'Latin Modern Roman', 'Times New Roman', serif;
          color: #000;
        }
        .latex-jackson-sharp .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .latex-jackson-sharp h1 {
          font-size: 26px;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .latex-jackson-sharp .contact-info {
          font-size: 10px;
          color: #333;
        }
        .latex-jackson-sharp .section {
          margin-top: 14px;
        }
        .latex-jackson-sharp .section-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: #000;
          margin-bottom: 8px;
        }
        .latex-jackson-sharp .entry {
          margin-bottom: 10px;
        }
        .latex-jackson-sharp .entry-header {
          display: flex;
          justify-content: space-between;
          font-weight: 600;
          font-size: 11px;
        }
        .latex-jackson-sharp .entry-details {
          font-style: italic;
          font-weight: 400;
        }
        .latex-jackson-sharp .entry-description {
          margin-top: 4px;
          text-align: justify;
          font-size: 11px;
        }
        .latex-jackson-sharp ul {
          margin: 4px 0 0 0;
          padding-left: 14px;
        }
        .latex-jackson-sharp li {
          margin: 2px 0;
        }
      `}</style>

      <div className="header">
        <h1 dangerouslySetInnerHTML={{
          __html: content.match(/## <div align="center">(.*?)<\/div>/)?.[1] || 'Your Name'
        }} />
        <div className="contact-info" dangerouslySetInnerHTML={{
          __html: content.split('\n').filter(line =>
            line.includes('📧') || line.includes('📱') ||
            line.includes('LinkedIn') || line.includes('Twitter')
          ).join(' | ')
        }} />
      </div>

      <div dangerouslySetInnerHTML={{ __html: renderMarkdownToLatex(content) }} />
    </div>
  );
}

// ============================================
// CLARK TEMPLATE - Modern Tech Style
// ============================================
export function ClarkTemplate({ content }: { content: string }) {
  return (
    <div className="latex-clark max-w-[210mm] mx-auto p-[15mm] bg-white text-sm leading-relaxed">
      <style>{`
        .latex-clark {
          font-family: 'Latin Modern Sans', 'Inter', 'Segoe UI', sans-serif;
          color: #1a1a1a;
        }
        .latex-clark .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 3px solid #1a1a1a;
        }
        .latex-clark h1 {
          font-size: 32px;
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.5px;
        }
        .latex-clark .contact-info {
          text-align: right;
          font-size: 10px;
          color: #555;
          line-height: 1.6;
        }
        .latex-clark .section {
          margin-top: 18px;
        }
        .latex-clark .section-title {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #1a1a1a;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .latex-clark .section-title::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #ddd;
        }
        .latex-clark .entry {
          margin-top: 10px;
        }
        .latex-clark .entry-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }
        .latex-clark .entry-title {
          font-weight: 600;
          font-size: 12px;
        }
        .latex-clark .entry-company {
          font-weight: 500;
        }
        .latex-clark .entry-date {
          font-size: 11px;
          color: #666;
          font-variant-numeric: tabular-nums;
        }
        .latex-clark .entry-description {
          margin-top: 6px;
          font-size: 11px;
          line-height: 1.5;
        }
        .latex-clark ul {
          margin: 6px 0 0 0;
          padding-left: 16px;
        }
        .latex-clark li {
          margin: 3px 0;
          color: #333;
        }
      `}</style>

      <div className="header">
        <h1>{content.match(/## <div align="center">(.*?)<\/div>/)?.[1] || 'Your Name'}</h1>
        <div className="contact-info" dangerouslySetInnerHTML={{
          __html: content.split('\n').filter(line =>
            line.includes('📧') || line.includes('📱') ||
            line.includes('LinkedIn') || line.includes('Twitter')
          ).join('<br/>')
        }} />
      </div>

      <div dangerouslySetInnerHTML={{ __html: renderMarkdownToLatex(content) }} />
    </div>
  );
}

// ============================================
// RACINE TEMPLATE - Minimalist Clean
// ============================================
export function RacineTemplate({ content }: { content: string }) {
  return (
    <div className="latex-racine max-w-[210mm] mx-auto p-[15mm] bg-white text-sm leading-relaxed">
      <style>{`
        .latex-racine {
          font-family: 'Latin Modern Sans Light', 'Inter', 'Segoe UI', sans-serif;
          color: #222;
        }
        .latex-racine .header {
          text-align: center;
          margin-bottom: 24px;
        }
        .latex-racine h1 {
          font-size: 36px;
          font-weight: 300;
          margin-bottom: 12px;
          letter-spacing: 4px;
          text-transform: uppercase;
        }
        .latex-racine .contact-info {
          font-size: 10px;
          color: #666;
          letter-spacing: 0.5px;
        }
        .latex-racine .section {
          margin-top: 20px;
        }
        .latex-racine .section-title {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: #888;
          margin-bottom: 10px;
          text-align: center;
        }
        .latex-racine .entry {
          margin-bottom: 12px;
        }
        .latex-racine .entry-header {
          display: flex;
          justify-content: space-between;
          font-weight: 500;
          font-size: 11px;
        }
        .latex-racine .entry-title {
          font-weight: 500;
        }
        .latex-racine .entry-description {
          margin-top: 6px;
          text-align: justify;
          font-size: 11px;
          line-height: 1.6;
          color: #444;
        }
        .latex-racine ul {
          margin: 6px 0 0 0;
          padding-left: 16px;
        }
        .latex-racine li {
          margin: 3px 0;
          color: #555;
        }
      `}</style>

      <div className="header">
        <h1>{content.match(/## <div align="center">(.*?)<\/div>/)?.[1] || 'Your Name'}</h1>
        <div className="contact-info" dangerouslySetInnerHTML={{
          __html: content.split('\n').filter(line =>
            line.includes('📧') || line.includes('📱') ||
            line.includes('LinkedIn') || line.includes('Twitter')
          ).join(' • ')
        }} />
      </div>

      <div dangerouslySetInnerHTML={{ __html: renderMarkdownToLatex(content) }} />
    </div>
  );
}

// ============================================
// Helper function to convert markdown to styled HTML
// ============================================
function renderMarkdownToLatex(content: string): string {
  let html = content;

  // Remove the header section (already rendered)
  html = html.replace(/## <div align="center">[\s\S]*?<\/div>\s*\n\n<div align="center">[\s\S]*?<\/div>\s*\n\n?/, '');

  // Convert section headers
  html = html.replace(/## (Professional Summary|Skills|Work Experience|Education|Projects)\s*\n\n/g,
    '<div class="section"><div class="section-title">$1</div>');

  // Close previous section and open new one
  html = html.replace(/(?<!^)(## )/g, '</div><div class="section"><div class="section-title">$2');

  // Convert entries (### Title at Company)
  html = html.replace(/### (.*?) at (.*?)\s*\n\n\*\*(.*?)\*\*\s*\n\n/g,
    '<div class="entry"><div class="entry-header"><span class="entry-title">$1</span><span class="entry-date">$3</span></div><div class="entry-company">$2</div>');

  // Convert bullet points
  html = html.replace(/^- (.*?)(?=\n- |\n\n|$)/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Convert paragraphs (double newlines)
  html = html.replace(/\n\n/g, '</div>');
  html = html.replace(/\n/g, '<br/>');

  // Clean up
  html = html.replace(/<\/div><div class="section">/g, '</div></div><div class="section">');

  return html;
}

// ============================================
// Template selector component
// ============================================
export const LATEX_TEMPLATES = [
  {
    id: "de-sitter",
    name: "De Sitter",
    description: "Clean academic style with centered header",
    component: DeSitterTemplate,
  },
  {
    id: "venkat",
    name: "Venkat",
    description: "Modern professional with blue accents",
    component: VenkatTemplate,
  },
  {
    id: "jackson-sharp",
    name: "Jackson Sharp",
    description: "Classic academic with traditional styling",
    component: JacksonSharpTemplate,
  },
  {
    id: "clark",
    name: "Clark",
    description: "Modern tech style with bold header",
    component: ClarkTemplate,
  },
  {
    id: "racine",
    name: "Racine",
    description: "Minimalist with generous whitespace",
    component: RacineTemplate,
  },
];
