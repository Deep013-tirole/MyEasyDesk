import React, { useState, useMemo } from 'react';
import {
  Search, ShieldAlert, CheckSquare,
  MessageSquare, FileText, ArrowRight, Sparkles,
  ShieldCheck, Clock, CheckCircle2, Bot, Layers,
  HelpCircle, Zap, ArrowUpDown, X, ChevronDown
} from 'lucide-react';
import { motion } from 'motion/react';
import { Service, ServiceCategory } from '../types.js';
import { openWhatsAppForService, openGeneralWhatsApp } from '../lib/whatsapp.js';
import { useScrollToTopOnChange } from '../lib/scrollUtils.js';
import ContentUnavailable from './ContentUnavailable.js';
import Breadcrumbs from './ui/Breadcrumbs.js';
import TrustBadge from './ui/TrustBadge.js';
import { GridSkeleton } from './ui/SkeletonCard.js';

interface ServicesViewProps {
  categories: ServiceCategory[];
  services: Service[];
  setView: (view: string) => void;
  setSelectedServiceId: (id: string | null) => void;
  selectedServiceId?: string | null;
  setOrderService?: (service: Service | null) => void;
  isLoading?: boolean;
}

export default function ServicesView({
  categories,
  services,
  setView,
  setSelectedServiceId,
  isLoading = false
}: ServicesViewProps) {

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recommended' | 'price-asc' | 'price-desc' | 'fastest'>('recommended');

  // Reset scroll to top when category tab changes
  useScrollToTopOnChange([selectedCategory]);

  // Filter active categories for public view tabs
  const activeCategories = useMemo(() => {
    return categories.filter(c => (c.status || 'Active') === 'Active');
  }, [categories]);

  // Filter and sort services
  const filteredServices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let list = services.filter(s => {
      const matchesCategory = selectedCategory === 'all' || s.categoryId === selectedCategory;
      const matchesSearch = !q ||
        (s.title || '').toLowerCase().includes(q) ||
        (s.shortDescription || '').toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q) ||
        (s.requiredDocuments || []).some(d => d.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });

    // Apply sorting
    if (sortBy === 'price-asc') {
      list.sort((a, b) => ((a.govFees || 0) + (a.serviceCharge || 0)) - ((b.govFees || 0) + (b.serviceCharge || 0)));
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => ((b.govFees || 0) + (b.serviceCharge || 0)) - ((a.govFees || 0) + (a.serviceCharge || 0)));
    } else if (sortBy === 'fastest') {
      list.sort((a, b) => {
        const getDays = (str?: string) => {
          const m = (str || '').match(/\d+/);
          return m ? parseInt(m[0], 10) : 99;
        };
        return getDays(a.processingTime) - getDays(b.processingTime);
      });
    }

    return list;
  }, [services, selectedCategory, searchQuery, sortBy]);

  const handleOpenDetails = (id: string) => {
    setSelectedServiceId(id);
  };

  return (
    <div id="easydesk-services-view" className="font-sans text-slate-900 bg-slate-50 min-h-screen pb-20 w-full max-w-full overflow-x-hidden">

      {/* 1. HEADER SECTION WITH CIVIC ACCENT */}
      <section className="bg-white border-b border-slate-200/80 pt-6 pb-8 sm:pb-10">
        <div className="portal-container space-y-4">

          {/* Breadcrumbs */}
          <Breadcrumbs
            items={[
              { label: 'Services', active: true }
            ]}
          />

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pt-1">
            <div className="max-w-2xl space-y-2">
              <div className="flex items-center gap-2">
                <TrustBadge title="Verified Catalog & Assistance Directory" variant="pill" />
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                Digital Services Directory
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                Transparent statutory filings, certificates, and registrations. Connect directly with EasyDesk document officers on WhatsApp for expedited pre-audit processing.
              </p>
            </div>

            {/* Quick Micro Value Badges */}
            <div className="flex flex-wrap gap-2 text-xs text-slate-600 shrink-0">
              <span className="inline-flex items-center gap-1.5 bg-slate-100/80 border border-slate-200/60 px-3 py-1.5 rounded-xl font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0F4C81]" />
                <span>Pre-Audit Verification</span>
              </span>
              <span className="inline-flex items-center gap-1.5 bg-slate-100/80 border border-slate-200/60 px-3 py-1.5 rounded-xl font-medium">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Direct WhatsApp Filing</span>
              </span>
            </div>
          </div>

        </div>
      </section>

      <div className="portal-container pt-8 space-y-6">

        {/* 2. SEARCH & FILTER CONTROLS BAR */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs p-4 space-y-4">

          {/* Top Row: Search input + Sort Dropdown */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">

            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 shrink-0 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by service name, keyword, or document required..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-[#0F4C81] focus:ring-1 focus:ring-[#0F4C81] placeholder:text-slate-400 font-medium transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded-md hover:bg-slate-200 transition"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-500 font-semibold whitespace-nowrap flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-slate-400" /> Sort by:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0F4C81] cursor-pointer"
              >
                <option value="recommended">Recommended</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="fastest">Fastest Turnaround</option>
              </select>
            </div>

          </div>

          {/* Bottom Row: Category Pills */}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-[#0F4C81] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Services ({services.length})
            </button>
            {activeCategories.map(cat => {
              const count = services.filter(s => s.categoryId === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedCategory === cat.id
                      ? 'bg-[#0F4C81] text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat.name} {count > 0 && <span className="opacity-75 font-normal ml-1">({count})</span>}
                </button>
              );
            })}
          </div>

        </div>

        {/* 3. ACTIVE RESULTS METRICS */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
          <span>
            Showing <strong className="text-slate-900 tabular-nums">{filteredServices.length}</strong> of <span className="tabular-nums">{services.length}</span> services
            {selectedCategory !== 'all' && (
              <span> in <strong className="text-[#0F4C81]">{categories.find(c => c.id === selectedCategory)?.name}</strong></span>
            )}
          </span>
          {(searchQuery || selectedCategory !== 'all' || sortBy !== 'recommended') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSortBy('recommended');
              }}
              className="text-[#0F4C81] hover:underline font-bold cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* 4. SERVICES GRID / SKELETON / EMPTY STATE */}
        {isLoading ? (
          <GridSkeleton count={6} type="service" />
        ) : services.length === 0 && !searchQuery ? (
          <ContentUnavailable
            id="services-catalog-unavailable"
            statusCode={404}
            title="Services Directory Unavailable"
            message="We were unable to load the services catalog at this moment. You can still reach our team directly on WhatsApp for filing assistance."
            primaryActionText="Return to Home"
            onPrimaryAction={() => setView('home')}
            secondaryActionText="Chat on WhatsApp"
            onSecondaryAction={() => openGeneralWhatsApp('Hello EasyDesk, I need help with government certificate services.')}
          />
        ) : filteredServices.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-2xs space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#0F4C81] border border-blue-100 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h3 className="font-black text-base text-slate-900 m-0">No Matching Services Found</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto font-normal">
              We couldn't find any services matching "{searchQuery}". Try modifying your search term or talk to our desk team for custom documentation assistance.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => { setSelectedCategory('all'); setSearchQuery(''); setSortBy('recommended'); }}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Clear Search & Filters
              </button>
              <button
                onClick={() => openGeneralWhatsApp(`Inquiry regarding service search: ${searchQuery}`)}
                className="px-5 py-2.5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <MessageSquare className="w-4 h-4" /> Ask Desk on WhatsApp
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map(service => {
              const catName = categories.find(c => c.id === service.categoryId)?.name || 'Service';
              const totalFee = (service.govFees || 0) + (service.serviceCharge || 0);

              return (
                <div
                  key={service.id}
                  className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs hover:shadow-md hover:border-blue-200 transition-all duration-200 flex flex-col justify-between group"
                >
                  <div className="p-5 flex-1 space-y-3">
                    {/* Badge Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-blue-50 text-[#0F4C81] px-2.5 py-0.5 rounded-full border border-blue-100/80">
                        {catName}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-md">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{service.processingTime || '3–5 Working Days'}</span>
                      </span>
                    </div>

                    {/* Title */}
                    <h3
                      onClick={() => handleOpenDetails(service.id)}
                      className="font-bold text-base text-slate-900 hover:text-[#0F4C81] cursor-pointer transition line-clamp-1 leading-snug"
                      title={service.title}
                    >
                      {service.title}
                    </h3>

                    {/* Short Description (STRICT: only shortDescription, fallback only if missing) */}
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed font-normal">
                      {service.shortDescription || service.description || 'Assisted document processing and government filing support.'}
                    </p>

                    {/* Document Checklist Preview */}
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Required Documents:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(service.requiredDocuments || []).slice(0, 2).map((doc, dIdx) => (
                          <span key={dIdx} className="text-[10px] bg-slate-50 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200/60 font-medium">
                            ✓ {doc}
                          </span>
                        ))}
                        {(service.requiredDocuments || []).length > 2 && (
                          <span className="text-[10px] text-slate-500 px-1 py-0.5 font-bold">
                            +{(service.requiredDocuments || []).length - 2} more
                          </span>
                        )}
                        {(!service.requiredDocuments || service.requiredDocuments.length === 0) && (
                          <span className="text-[10px] text-slate-400 italic">Pre-requisites guided on desk</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pricing & Actions Footer */}
                  <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div>
                      <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-tight">
                        Starting Fee
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-black text-slate-900 tabular-nums notranslate" translate="no">
                          ₹{totalFee}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">all-incl.</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenDetails(service.id)}
                        className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer shadow-2xs"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => openWhatsAppForService(service, catName)}
                        className="bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Apply
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* 5. BOTTOM HELP & AI BANNER */}
        <div className="mt-12 bg-gradient-to-br from-[#0A2540] via-[#0F4C81] to-[#0A2540] text-white rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 border border-blue-900/40">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 bg-white/10 text-cyan-300 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-white/15">
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" /> Custom Certificate Inquiry
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white m-0">Can't Find the Service You Need?</h3>
            <p className="text-xs text-blue-100/90 max-w-xl m-0 font-normal">
              Our officers handle hundreds of specialized municipal, state, and central government filings. Connect directly with our desk team for instant personalized guidance.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              onClick={() => openGeneralWhatsApp('Hello EasyDesk, I need help with a custom digital service that is not in the catalog.')}
              className="bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2 shadow-sm"
            >
              <MessageSquare className="w-4 h-4" /> WhatsApp Officer
            </button>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('easydesk-ai-contextual-help', {
                  detail: { customPrompt: "Hello! I need guidance on finding a specific certificate service.", autoSend: true }
                }));
              }}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2"
            >
              <Bot className="w-4 h-4 text-cyan-300" /> Consult AI Desk
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
