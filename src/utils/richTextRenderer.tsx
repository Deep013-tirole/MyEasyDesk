import React from 'react';
import { Info, Check } from 'lucide-react';

/**
 * Parses inline formatting like **bold**, *italic*, and [link](url)
 */
export function formatInlineText(text: string): React.ReactNode {
  if (!text) return text;

  // Split by bold (**...**), italic (*...*), and links ([...](...))
  const tokenRegex = /(\*\*.*?\*\*|\*.*?\*|\[.*?\]\(.*?\))/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={index} className="font-bold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2 && !part.startsWith('**')) {
      return (
        <em key={index} className="italic text-slate-800">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const match = part.match(/^\[(.*?)\]\((.*?)\)$/);
      if (match) {
        const [, label, url] = match;
        return (
          <a
            key={index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0F4C81] hover:underline font-semibold"
          >
            {label}
          </a>
        );
      }
    }
    return part;
  });
}

/**
 * Renders full markdown/rich-text blocks into styled JSX elements
 */
export function renderRichText(content: string, options: { isDark?: boolean; compact?: boolean } = {}): React.ReactNode {
  if (!content || !content.trim()) return null;

  const paragraphs = content.split(/\n\s*\n/);

  return (
    <div className="space-y-4 text-slate-700 font-sans leading-relaxed">
      {paragraphs.map((para, idx) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        // Heading 1: # Title
        if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
          return (
            <h1 key={idx} className="text-xl sm:text-2xl font-black text-slate-950 mt-6 mb-3 tracking-tight">
              {formatInlineText(trimmed.replace(/^#\s+/, ''))}
            </h1>
          );
        }

        // Heading 2: ## Section Title
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={idx} className="text-base sm:text-lg font-black text-slate-900 mt-5 mb-2 pb-1.5 border-b border-slate-200/80 tracking-tight">
              {formatInlineText(trimmed.replace(/^##\s+/, ''))}
            </h2>
          );
        }

        // Heading 3: ### Sub-section Title
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-sm sm:text-base font-extrabold text-[#0F4C81] mt-4 mb-1.5">
              {formatInlineText(trimmed.replace(/^###\s+/, ''))}
            </h3>
          );
        }

        // Heading 4: #### Minor Heading
        if (trimmed.startsWith('#### ')) {
          return (
            <h4 key={idx} className="text-xs sm:text-sm font-bold text-slate-900 mt-3 mb-1 uppercase tracking-wide">
              {formatInlineText(trimmed.replace(/^####\s+/, ''))}
            </h4>
          );
        }

        // Important Guidance / Note Callout: > [IMPORTANT] or > NOTE or IMPORTANT:
        if (
          trimmed.startsWith('> IMPORTANT') ||
          trimmed.startsWith('> [IMPORTANT]') ||
          trimmed.startsWith('IMPORTANT:') ||
          trimmed.startsWith('NOTE:') ||
          trimmed.startsWith('> NOTE') ||
          trimmed.startsWith('> [NOTE]') ||
          trimmed.startsWith('> ')
        ) {
          const cleanText = trimmed
            .replace(/^>\s*(\[IMPORTANT\]|IMPORTANT:?|\[NOTE\]|NOTE:?)/i, '')
            .replace(/^(IMPORTANT:|NOTE:)/i, '')
            .replace(/^>\s*/, '')
            .trim();

          return (
            <div key={idx} className="my-4 p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 text-xs sm:text-sm leading-relaxed shadow-2xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 uppercase tracking-wider text-[11px] mb-1">
                <Info className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Important Guidance Note</span>
              </div>
              <div className="pl-5 text-amber-900/90 font-medium">
                {formatInlineText(cleanText)}
              </div>
            </div>
          );
        }

        // Bulleted List Block (- item or * item)
        const lines = trimmed.split('\n');
        if (lines.every(line => line.trim().startsWith('- ') || line.trim().startsWith('* '))) {
          const items = lines.map(line => line.trim().replace(/^[-*]\s+/, ''));
          return (
            <ul key={idx} className="my-3 space-y-2 text-xs sm:text-sm text-slate-700 list-none pl-1">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0F4C81] mt-2 shrink-0" />
                  <span className="leading-relaxed">{formatInlineText(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        // Numbered List Block (1. item)
        if (lines.every(line => /^\d+\.\s+/.test(line.trim()))) {
          const items = lines.map(line => line.trim().replace(/^\d+\.\s+/, ''));
          return (
            <ol key={idx} className="my-3 space-y-2 text-xs sm:text-sm text-slate-700 list-none pl-1">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-md bg-blue-50 text-[#0F4C81] font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-blue-100">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed pt-0.5">{formatInlineText(item)}</span>
                </li>
              ))}
            </ol>
          );
        }

        // Mixed paragraphs with newlines
        return (
          <p key={idx} className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
            {lines.map((line, lineIdx) => (
              <React.Fragment key={lineIdx}>
                {lineIdx > 0 && <br />}
                {formatInlineText(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
