import React, { useState, useRef } from 'react';
import { 
  Bold, 
  Italic, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  Quote, 
  Link as LinkIcon, 
  Eye, 
  Edit3, 
  Code, 
  Info,
  Check,
  HelpCircle
} from 'lucide-react';
import { renderRichText } from '../../utils/richTextRenderer';

interface RichFormattingEditorProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
  minHeight?: string;
  error?: string;
  helperText?: string;
}

export const RichFormattingEditor: React.FC<RichFormattingEditorProps> = ({
  label,
  value = '',
  onChange,
  placeholder = 'Write comprehensive, well-formatted content here...',
  required = false,
  minHeight = 'min-h-[220px]',
  error,
  helperText
}) => {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [showTips, setShowTips] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const charCount = value.length;

  const insertFormatting = (prefix: string, suffix: string = '', defaultText: string = 'text') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const selectedText = value.substring(start, end) || defaultText;

    const before = value.substring(0, start);
    const after = value.substring(end);

    const newText = `${before}${prefix}${selectedText}${suffix}${after}`;
    onChange(newText);

    // Restore focus and select the inserted text for instant editing
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const selectionStart = start + prefix.length;
        const selectionEnd = selectionStart + selectedText.length;
        textareaRef.current.setSelectionRange(selectionStart, selectionEnd);
      }
    }, 20);
  };

  const insertLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? value.length;
    const before = value.substring(0, start);
    const after = value.substring(start);

    // If not at beginning of a new line, insert newline before prefix
    const needsNewline = before.length > 0 && !before.endsWith('\n');
    const insertString = (needsNewline ? '\n' : '') + prefix + ' ';

    const newText = `${before}${insertString}${after}`;
    onChange(newText);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = start + insertString.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 20);
  };

  const handleInsertLink = () => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? 0;
    const end = textarea?.selectionEnd ?? 0;
    const selectedText = textarea ? value.substring(start, end) : '';

    const defaultUrl = 'https://';
    const url = window.prompt('Enter destination URL:', defaultUrl);
    if (!url || url === 'https://') return;

    const linkText = selectedText || window.prompt('Enter link display text:', 'Official Portal') || 'Link';
    insertFormatting(`[${linkText}](`, `${url})`, '');
  };

  // Preview Markdown Parser
  const renderPreview = (content: string) => {
    if (!content.trim()) {
      return (
        <div className="text-slate-400 text-xs italic py-8 text-center">
          No content written yet. Switch to "Write" tab to begin composing.
        </div>
      );
    }

    return renderRichText(content);
  };

  return (
    <div className="space-y-1.5 font-sans">
      {/* Label and Mode Switcher */}
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTips(!showTips)}
            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
            title="Formatting shortcuts"
          >
            <HelpCircle className="w-3 h-3" /> Shortcuts
          </button>

          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveTab('write')}
              className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                activeTab === 'write'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3 h-3" /> Write
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                activeTab === 'preview'
                  ? 'bg-white text-[#0F4C81] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3 h-3" /> Live Preview
            </button>
          </div>
        </div>
      </div>

      {/* Shortcuts helper drawer */}
      {showTips && (
        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-900 grid grid-cols-2 sm:grid-cols-4 gap-2 animate-in fade-in duration-150">
          <div><span className="font-mono font-bold">**Bold Text**</span> → <strong>Bold</strong></div>
          <div><span className="font-mono font-bold">*Italic Text*</span> → <em>Italic</em></div>
          <div><span className="font-mono font-bold">## Heading</span> → H2 Title</div>
          <div><span className="font-mono font-bold">- Bullet Item</span> → List</div>
        </div>
      )}

      {/* Editor Box */}
      <div className={`border rounded-2xl overflow-hidden bg-white transition-all ${
        error ? 'border-red-400 ring-2 ring-red-400/10' : 'border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 shadow-2xs'
      }`}>
        
        {/* Formatting Toolbar */}
        {activeTab === 'write' && (
          <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex flex-wrap items-center gap-1 text-slate-600">
            <button
              type="button"
              onClick={() => insertFormatting('**', '**', 'bold text')}
              className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition text-xs font-bold"
              title="Bold (**text**)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('*', '*', 'italic text')}
              className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition text-xs"
              title="Italic (*text*)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-300 mx-1" />

            <button
              type="button"
              onClick={() => insertLinePrefix('##')}
              className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition text-xs"
              title="Heading 2 (## Title)"
            >
              <Heading2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertLinePrefix('###')}
              className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition text-xs"
              title="Heading 3 (### Subtitle)"
            >
              <Heading3 className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-300 mx-1" />

            <button
              type="button"
              onClick={() => insertLinePrefix('-')}
              className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition text-xs"
              title="Bullet List (- item)"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertLinePrefix('1.')}
              className="p-1.5 hover:bg-white hover:text-slate-900 rounded-lg transition text-xs"
              title="Numbered List (1. item)"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertLinePrefix('> [IMPORTANT]')}
              className="p-1.5 hover:bg-white hover:text-amber-700 rounded-lg transition text-xs"
              title="Important Notice Box (> [IMPORTANT])"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-300 mx-1" />

            <button
              type="button"
              onClick={handleInsertLink}
              className="p-1.5 hover:bg-white hover:text-blue-700 rounded-lg transition text-xs"
              title="Insert Link [Text](url)"
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Write or Preview Body */}
        {activeTab === 'write' ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full p-3.5 text-xs text-slate-800 font-sans leading-relaxed focus:outline-none resize-y ${minHeight} bg-white`}
          />
        ) : (
          <div className={`p-4 bg-slate-50/50 ${minHeight} overflow-y-auto`}>
            {renderPreview(value)}
          </div>
        )}

        {/* Footer Metrics */}
        <div className="bg-slate-50/80 border-t border-slate-200/80 px-3 py-1.5 flex items-center justify-between text-[10px] text-slate-400 font-medium">
          <div>
            {helperText && <span>{helperText}</span>}
          </div>
          <div className="flex items-center gap-3">
            <span><strong>{wordCount}</strong> words</span>
            <span><strong>{charCount}</strong> characters</span>
          </div>
        </div>

      </div>

      {error && (
        <p className="text-[11px] font-bold text-red-500 mt-1 flex items-center gap-1">
          <span>⚠️ {error}</span>
        </p>
      )}
    </div>
  );
};
