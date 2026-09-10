import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FileQuestion, Home, Layers, BookOpen, Search, MessageSquare, ArrowLeft, HelpCircle } from 'lucide-react';
import { getCanonicalOrigin } from '../lib/seoConfig.js';

interface NotFoundViewProps {
  setView: (view: string) => void;
  onOpenSearch?: () => void;
}

export default function NotFoundView({ setView, onOpenSearch }: NotFoundViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const origin = getCanonicalOrigin();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setView('services');
      // Dispatch custom search event if needed
      window.dispatchEvent(new CustomEvent('easydesk-filter-services', { detail: searchQuery.trim() }));
    } else if (onOpenSearch) {
      onOpenSearch();
    }
  };

  return (
    <div id="not-found-view" className="portal-container py-16 sm:py-24 max-w-3xl mx-auto text-center font-sans">
      <Helmet>
        <title>Page Not Found (404) | EasyDesk</title>
        <meta name="description" content="The page you requested does not exist on EasyDesk. Browse our digital services catalog or contact our desk officers for guidance." />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href={`${origin}/404`} />
      </Helmet>

      <div className="space-y-6">
        {/* Visual Badge & Icon */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-3xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0F4C81] shadow-xs">
          <FileQuestion className="w-10 h-10 sm:w-12 sm:h-12 stroke-[1.75]" />
        </div>

        <div className="space-y-2 max-w-xl mx-auto">
          <span className="inline-block text-xs font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            Error 404 • Page Not Found
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            We Couldn't Find That Page
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            The page, service filing guide, or document URL you requested may have moved, been updated, or does not exist. Use the search bar below or explore our public directory.
          </p>
        </div>

        {/* Quick Search */}
        <form onSubmit={handleSearch} className="max-w-md mx-auto flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services (e.g. PAN, Passport, MSME)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm focus:outline-hidden focus:border-[#0F4C81] shadow-2xs"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-[#0F4C81] hover:bg-[#0b3b64] text-white text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
          >
            Search
          </button>
        </form>

        {/* Action Grid */}
        <div className="pt-4 border-t border-slate-100 max-w-lg mx-auto">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
            Popular Destinations
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <a
              href="/"
              onClick={(e) => { e.preventDefault(); setView('home'); }}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-200/80 bg-white hover:border-[#0F4C81] hover:bg-blue-50/40 text-slate-700 transition cursor-pointer"
            >
              <Home className="w-4 h-4 text-[#0F4C81]" />
              <span className="text-xs font-bold">Home</span>
            </a>
            <a
              href="/services"
              onClick={(e) => { e.preventDefault(); setView('services'); }}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-200/80 bg-white hover:border-[#0F4C81] hover:bg-blue-50/40 text-slate-700 transition cursor-pointer"
            >
              <Layers className="w-4 h-4 text-[#0F4C81]" />
              <span className="text-xs font-bold">Services</span>
            </a>
            <a
              href="/blogs"
              onClick={(e) => { e.preventDefault(); setView('blogs'); }}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-200/80 bg-white hover:border-[#0F4C81] hover:bg-blue-50/40 text-slate-700 transition cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-[#0F4C81]" />
              <span className="text-xs font-bold">Knowledge</span>
            </a>
            <a
              href="/contact"
              onClick={(e) => { e.preventDefault(); setView('contact'); }}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-slate-200/80 bg-white hover:border-[#0F4C81] hover:bg-blue-50/40 text-slate-700 transition cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-[#0F4C81]" />
              <span className="text-xs font-bold">Support</span>
            </a>
          </div>
        </div>

        {/* Back Link */}
        <div className="pt-2">
          <button
            onClick={() => window.history.length > 1 ? window.history.back() : setView('home')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Previous Page
          </button>
        </div>
      </div>
    </div>
  );
}
