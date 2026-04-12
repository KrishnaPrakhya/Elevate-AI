"use client";

import { cn } from "@/lib/utils";

export interface LatexCoverLetterTemplateProps {
  content: string;
  template?: string;
}

/**
 * LaTeX-Inspired Cover Letter Templates
 * Professional templates similar to Overleaf's cover letter templates
 */

// ============================================
// DE SITTER COVER LETTER - Classic Academic
// ============================================
export function DeSitterCoverLetter({ content }: { content: string }) {
  return (
    <div className="latex-cl-de-sitter max-w-[210mm] mx-auto p-[20mm] bg-white text-sm leading-relaxed">
      <style>{`
        .latex-cl-de-sitter {
          font-family: 'Latin Modern Roman', 'Times New Roman', serif;
          color: #1a1a1a;
          line-height: 1.6;
        }
        .latex-cl-de-sitter .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .latex-cl-de-sitter h1 {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 8px;
          letter-spacing: 1px;
        }
        .latex-cl-de-sitter .contact-info {
          font-size: 10px;
          color: #444;
        }
        .latex-cl-de-sitter .date {
          font-size: 11px;
          margin-bottom: 20px;
        }
        .latex-cl-de-sitter .recipient {
          font-size: 11px;
          margin-bottom: 20px;
          line-height: 1.5;
        }
        .latex-cl-de-sitter .salutation {
          font-size: 11px;
          margin-bottom: 16px;
        }
        .latex-cl-de-sitter .body {
          font-size: 11px;
          text-align: justify;
          text-indent: 0;
          margin-bottom: 12px;
        }
        .latex-cl-de-sitter .body:first-letter {
          font-weight: 600;
        }
        .latex-cl-de-sitter .closing {
          font-size: 11px;
          margin-top: 20px;
        }
        .latex-cl-de-sitter .signature {
          margin-top: 4px;
          font-size: 11px;
        }
      `}</style>

      <div dangerouslySetInnerHTML={{ __html: parseCoverLetterContent(content) }} />
    </div>
  );
}

// ============================================
// VENKAT COVER LETTER - Modern Professional
// ============================================
export function VenkatCoverLetter({ content }: { content: string }) {
  return (
    <div className="latex-cl-venkat max-w-[210mm] mx-auto p-[20mm] bg-white text-sm leading-relaxed">
      <style>{`
        .latex-cl-venkat {
          font-family: 'Latin Modern Sans', 'Segoe UI', 'Roboto', sans-serif;
          color: #222;
          line-height: 1.6;
        }
        .latex-cl-venkat .header {
          border-left: 4px solid #2563eb;
          padding-left: 16px;
          margin-bottom: 30px;
        }
        .latex-cl-venkat h1 {
          font-size: 22px;
          font-weight: 700;
          color: #2563eb;
          margin-bottom: 6px;
        }
        .latex-cl-venkat .contact-info {
          font-size: 10px;
          color: #555;
        }
        .latex-cl-venkat .date {
          font-size: 11px;
          color: #666;
          margin-bottom: 20px;
        }
        .latex-cl-venkat .recipient {
          font-size: 11px;
          margin-bottom: 20px;
          line-height: 1.5;
        }
        .latex-cl-venkat .salutation {
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 16px;
        }
        .latex-cl-venkat .body {
          font-size: 11px;
          text-align: justify;
          margin-bottom: 14px;
          line-height: 1.7;
        }
        .latex-cl-venkat .closing {
          font-size: 11px;
          margin-top: 20px;
        }
        .latex-cl-venkat .signature {
          margin-top: 4px;
          font-size: 11px;
          font-weight: 600;
        }
      `}</style>

      <div dangerouslySetInnerHTML={{ __html: parseCoverLetterContent(content) }} />
    </div>
  );
}

// ============================================
// JACKSON SHARP COVER LETTER - Traditional
// ============================================
export function JacksonSharpCoverLetter({ content }: { content: string }) {
  return (
    <div className="latex-cl-jackson-sharp max-w-[210mm] mx-auto p-[20mm] bg-white text-sm leading-relaxed">
      <style>{`
        .latex-cl-jackson-sharp {
          font-family: 'Latin Modern Roman', 'Times New Roman', serif;
          color: #000;
          line-height: 1.5;
        }
        .latex-cl-jackson-sharp .header {
          text-align: left;
          margin-bottom: 30px;
          border-bottom: 1px solid #000;
          padding-bottom: 12px;
        }
        .latex-cl-jackson-sharp h1 {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .latex-cl-jackson-sharp .contact-info {
          font-size: 9px;
          color: #333;
        }
        .latex-cl-jackson-sharp .date {
          font-size: 10px;
          margin-bottom: 20px;
        }
        .latex-cl-jackson-sharp .recipient {
          font-size: 10px;
          margin-bottom: 20px;
          line-height: 1.4;
        }
        .latex-cl-jackson-sharp .salutation {
          font-size: 10px;
          margin-bottom: 16px;
        }
        .latex-cl-jackson-sharp .body {
          font-size: 10px;
          text-align: justify;
          margin-bottom: 12px;
          line-height: 1.6;
        }
        .latex-cl-jackson-sharp .closing {
          font-size: 10px;
          margin-top: 20px;
        }
        .latex-cl-jackson-sharp .signature {
          margin-top: 4px;
          font-size: 10px;
        }
      `}</style>

      <div dangerouslySetInnerHTML={{ __html: parseCoverLetterContent(content) }} />
    </div>
  );
}

// ============================================
// EXECUTIVE COVER LETTER - Formal Business
// ============================================
export function ExecutiveCoverLetter({ content }: { content: string }) {
  return (
    <div className="latex-cl-executive max-w-[210mm] mx-auto p-[20mm] bg-white text-sm leading-relaxed">
      <style>{`
        .latex-cl-executive {
          font-family: 'Georgia', 'Times New Roman', serif;
          color: #1a1a1a;
          line-height: 1.7;
        }
        .latex-cl-executive .header {
          text-align: center;
          margin-bottom: 40px;
          background: linear-gradient(to right, #1e293b, #334155);
          padding: 20px;
          color: white;
        }
        .latex-cl-executive h1 {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 8px;
          letter-spacing: 2px;
        }
        .latex-cl-executive .contact-info {
          font-size: 10px;
          color: #cbd5e1;
        }
        .latex-cl-executive .date {
          font-size: 11px;
          margin-bottom: 20px;
        }
        .latex-cl-executive .recipient {
          font-size: 11px;
          margin-bottom: 20px;
          line-height: 1.5;
        }
        .latex-cl-executive .salutation {
          font-size: 11px;
          margin-bottom: 16px;
        }
        .latex-cl-executive .body {
          font-size: 11px;
          text-align: justify;
          margin-bottom: 14px;
          line-height: 1.8;
        }
        .latex-cl-executive .closing {
          font-size: 11px;
          margin-top: 20px;
        }
        .latex-cl-executive .signature {
          margin-top: 4px;
          font-size: 11px;
          font-style: italic;
        }
      `}</style>

      <div dangerouslySetInnerHTML={{ __html: parseCoverLetterContent(content) }} />
    </div>
  );
}

// ============================================
// CREATIVE COVER LETTER - Modern Design
// ============================================
export function CreativeCoverLetter({ content }: { content: string }) {
  return (
    <div className="latex-cl-creative max-w-[210mm] mx-auto p-[20mm] bg-gradient-to-br from-purple-50 to-white text-sm leading-relaxed">
      <style>{`
        .latex-cl-creative {
          font-family: 'Poppins', 'Segoe UI', 'Roboto', sans-serif;
          color: #222;
          line-height: 1.6;
        }
        .latex-cl-creative .header {
          text-align: center;
          margin-bottom: 30px;
          background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
          padding: 24px;
          border-radius: 8px;
          color: white;
        }
        .latex-cl-creative h1 {
          font-size: 26px;
          font-weight: 700;
          margin-bottom: 8px;
          letter-spacing: 1px;
        }
        .latex-cl-creative .contact-info {
          font-size: 10px;
          color: #e9d5ff;
        }
        .latex-cl-creative .date {
          font-size: 11px;
          color: #666;
          margin-bottom: 20px;
        }
        .latex-cl-creative .recipient {
          font-size: 11px;
          margin-bottom: 20px;
          line-height: 1.5;
        }
        .latex-cl-creative .salutation {
          font-size: 11px;
          font-weight: 600;
          color: #7c3aed;
          margin-bottom: 16px;
        }
        .latex-cl-creative .body {
          font-size: 11px;
          text-align: justify;
          margin-bottom: 14px;
          line-height: 1.7;
          background: white;
          padding: 12px;
          border-radius: 6px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .latex-cl-creative .closing {
          font-size: 11px;
          margin-top: 20px;
        }
        .latex-cl-creative .signature {
          margin-top: 4px;
          font-size: 11px;
          font-weight: 600;
          color: #7c3aed;
        }
      `}</style>

      <div dangerouslySetInnerHTML={{ __html: parseCoverLetterContent(content) }} />
    </div>
  );
}

// ============================================
// Parse cover letter content from markdown
// ============================================
function parseCoverLetterContent(content: string): string {
  // Extract header info
  const nameMatch = content.match(/## <div align="center">(.*?)<\/div>/);
  const name = nameMatch?.[1] || 'Your Name';

  // Extract contact info
  const contactLines = content.split('\n').filter(line =>
    line.includes('📧') || line.includes('📱') ||
    line.includes('LinkedIn') || line.includes('Twitter')
  );
  const contactInfo = contactLines.join(' | ');

  // Extract body paragraphs (everything after header sections)
  let bodyContent = content;
  bodyContent = bodyContent.replace(/## <div align="center">[\s\S]*?<\/div>\s*\n\n<div align="center">[\s\S]*?<\/div>\s*\n\n?/, '');
  bodyContent = bodyContent.replace(/## [\s\S]*?\n\n/g, ''); // Remove section headers

  // Convert markdown paragraphs to HTML
  const paragraphs = bodyContent.split('\n\n').filter(p => p.trim());
  const bodyHtml = paragraphs.map((p, i) => {
    const text = p.replace(/^[*-] /gm, '').replace(/\*\*/g, '').trim();
    if (i === 0) return `<div class="salutation">${text}</div>`;
    if (i === paragraphs.length - 1 && (text.includes('Sincerely') || text.includes('Best') || text.includes('Regards'))) {
      return `<div class="closing">${text}</div><div class="signature">${name}</div>`;
    }
    return `<div class="body">${text.replace(/\n/g, '<br/>')}</div>`;
  }).join('');

  return `
    <div class="header">
      <h1>${name}</h1>
      <div class="contact-info">${contactInfo}</div>
    </div>
    <div class="date">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    <div class="recipient">
      <strong>Hiring Manager</strong><br/>
      Company Name<br/>
      Company Address
    </div>
    ${bodyHtml}
  `;
}

// ============================================
// Template exports
// ============================================
export const LATEX_COVER_LETTER_TEMPLATES = [
  {
    id: "de-sitter",
    name: "De Sitter",
    description: "Classic academic with centered header",
    component: DeSitterCoverLetter,
  },
  {
    id: "venkat",
    name: "Venkat",
    description: "Modern professional with blue accent",
    component: VenkatCoverLetter,
  },
  {
    id: "jackson-sharp",
    name: "Jackson Sharp",
    description: "Traditional business format",
    component: JacksonSharpCoverLetter,
  },
  {
    id: "executive",
    name: "Executive",
    description: "Formal with dark header band",
    component: ExecutiveCoverLetter,
  },
  {
    id: "creative",
    name: "Creative",
    description: "Modern gradient design",
    component: CreativeCoverLetter,
  },
];
