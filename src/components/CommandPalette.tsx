import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Layers, FileText, ArrowRight, Clock, MessageSquare, ShieldCheck, CreditCard } from 'lucide-react';
import { Service, Blog } from '../types.js';
import { openGeneralWhatsApp } from '../lib/whatsapp.js';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  services: Service[];
  blogs: Blog[];
  onSelectService: (id: string) => void;
  onSelectBlog: (slugOrId: string) => void;
  setView: (view: string) => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  services,
  blogs,
  onSelectService,
  onSelectBlog,
  setView
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          window.dispatchEvent(new CustomEvent('easydesk-open-command-palette'));
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services.slice(0, 5);
    return services.filter(s => 
      (s.title || '').toLowerCase().includes(q) || 
      (s.shortDescription || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q)
    ).slice(0, 5);
  }, [services, query]);

  const filteredBlogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return blogs.slice(0, 3);
    return blogs.filter(b => 
      (b.title || '').toLowerCase().includes(q) || 
      (b.excerpt || '').toLowerCase().includes(q)
    ).slice(0, 4);
  }, [blogs, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        id="command-palette-modal"
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[80vh] transition-all"
        role="dialog"
        aria-modal="true"
        aria-label="Universal Search"
      >
        {/* Search Header Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200/80 gap-3 bg-slate-50/50">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            id="command-palette-input"
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services (PAN, Passport, GST), guides, order tracking..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              type="button"
              className="text-xs text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            type="button"
            title="Close"
            className="text-xs text-slate-400 hover:text-slate-700 border border-slate-200 px-2 py-1 rounded-md font-mono bg-white cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Results Body */}
        <div className="p-3 overflow-y-auto space-y-4 divide-y divide-slate-100">
          
          {/* Quick Shortcuts */}
          <div className="pt-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 pb-1.5 block">
              Quick Shortcuts
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-1">
              <button
                type="button"
                onClick={() => { setView('track'); onClose(); }}
                className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200/70 text-left transition cursor-pointer group"
              >
                <Search className="w-3.5 h-3.5 text-[#0F4C81]" />
                <span className="text-xs font-bold text-slate-800 group-hover:text-[#0F4C81] truncate">Track Order</span>
              </button>
              <button
                type="button"
                onClick={() => { setView('services'); onClose(); }}
                className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200/70 text-left transition cursor-pointer group"
              >
                <Layers className="w-3.5 h-3.5 text-[#0F4C81]" />
                <span className="text-xs font-bold text-slate-800 group-hover:text-[#0F4C81] truncate">All Services</span>
              </button>
              <button
                type="button"
                onClick={() => { setView('payment'); onClose(); }}
                className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200/70 text-left transition cursor-pointer group"
              >
                <CreditCard className="w-3.5 h-3.5 text-[#0F4C81]" />
                <span className="text-xs font-bold text-slate-800 group-hover:text-[#0F4C81] truncate">Pay Online</span>
              </button>
              <button
                type="button"
                onClick={() => { 
                  openGeneralWhatsApp('Hello EasyDesk, I need help with an application.'); 
                  onClose(); 
                }}
                className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-left transition cursor-pointer group"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#10B981]" />
                <span className="text-xs font-bold text-emerald-800 truncate">WhatsApp Desk</span>
              </button>
            </div>
          </div>

          {/* Services Category */}
          {filteredServices.length > 0 && (
            <div className="pt-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 pb-1.5 block">
                Digital Services ({filteredServices.length})
              </span>
              <div className="space-y-1">
                {filteredServices.map(svc => (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => {
                      onSelectService(svc.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-blue-50/70 text-left transition cursor-pointer group"
                  >
                    <div className="min-w-0 pr-3">
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#0F4C81] truncate">
                        {svc.title}
                      </h4>
                      {svc.shortDescription && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {svc.shortDescription}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {((svc.govFees || 0) + (svc.serviceCharge || 0)) > 0 && (
                        <span className="text-xs font-extrabold text-slate-700 tabular-nums">
                          ₹{(svc.govFees || 0) + (svc.serviceCharge || 0)}
                        </span>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0F4C81] group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Blogs / Knowledge Hub Category */}
          {filteredBlogs.length > 0 && (
            <div className="pt-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 pb-1.5 block">
                Filing Guides & Knowledge Hub ({filteredBlogs.length})
              </span>
              <div className="space-y-1">
                {filteredBlogs.map(blog => (
                  <button
                    key={blog.id}
                    type="button"
                    onClick={() => {
                      onSelectBlog(blog.slug || blog.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-blue-50/70 text-left transition cursor-pointer group"
                  >
                    <div className="min-w-0 pr-3">
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#0F4C81] truncate">
                        {blog.title}
                      </h4>
                      {blog.excerpt && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {blog.excerpt}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                      <ArrowRight className="w-3.5 h-3.5 group-hover:text-[#0F4C81] group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredServices.length === 0 && filteredBlogs.length === 0 && query && (
            <div className="py-8 text-center text-slate-500 text-xs">
              No matching services or guides found for "{query}".
            </div>
          )}

        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Navigate with mouse or keyboard</span>
          <span>Press <kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-white font-mono">ESC</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
