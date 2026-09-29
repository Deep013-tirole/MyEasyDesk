import React, { useState, useMemo } from 'react';
import {
  Search, ShieldAlert, CheckSquare,
  MessageSquare, FileText, ArrowRight, Sparkles,
  ShieldCheck, Clock, CheckCircle2, Bot, Layers,
  HelpCircle, Zap, ArrowUpDown, X, ChevronDown,
  LayoutGrid, List as ListIcon, Shield
} from 'lucide-react';
import { Service, ServiceCategory } from '../types.js';
import { openWhatsAppForService, openGeneralWhatsApp } from '../lib/whatsapp.js';
import { useScrollToTopOnChange } from '../lib/scrollUtils.js';
import ContentUnavailable from './ContentUnavailable.js';
import PageHeader from './ui/PageHeader.js';
import SectionContainer from './ui/SectionContainer.js';
import CivicCard from './ui/CivicCard.js';
import StatusBadge from './ui/StatusBadge.js';
import EmptyState from './ui/EmptyState.js';
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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
      // Exclude inactive and hidden services from public view
      const st = (s.status || 'Active').toLowerCase();
      const isPublic = st !== 'inactive' && st !== 'draft' && st !== 'hidden' && s.active !== false;
      if (!isPublic) return false;

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
    <div id="easydesk-services-view" className="font-sans text-slate-900 bg-[#F8FAFC] min-h-screen pb-20 w-full max-w-full overflow-x-hidden">

      {/* ==================================================
          SECTION 1: PAGE HEADER WITH BREADCRUMBS & BADGES
          ================================================== */}
      <PageHeader
        breadcrumbs={[
          { label: 'Services', active: true }
        ]}
        badge={{
          text: 'Verified Catalog & Filing Directory',
          icon: <Shield className="w-3.5 h-3.5 text-[#0F4C81]" />
        }}
        title="Digital Services Directory"
        description="Transparent statutory filings, certificates, and registrations. Connect directly with My EasyDesk document officers on WhatsApp for expedited pre-audit processing."
        actions={
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5 bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl font-bold shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0F4C81]" />
              <span>Pre-Audit Guarantee</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl font-bold shadow-2xs">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Direct WhatsApp Desk</span>
            </span>
          </div>
        }
      />

      <div className="portal-container pt-8 sm:pt-10 space-y-8">

        {/* ==================================================
            SECTION 2: SEARCH & CATEGORY FILTER TOOLBAR
            ================================================== */}
        <section aria-label="Search and Category Filters">
          <CivicCard variant="default" className="p-4 sm:p-5 space-y-4 shadow-sm">
            {/* Top Row: Search Input + Sort Dropdown */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">

              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 shrink-0 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by service name, keyword, or document required..."
                  className="w-full bg-slate-50 border border-slate-200/90 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-[#0F4C81] focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400 font-medium transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-200 transition cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate-500 font-bold whitespace-nowrap flex items-center gap-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" /> Sort by:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200/90 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#0F4C81] cursor-pointer"
                >
                  <option value="recommended">Recommended</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="fastest">Fastest Turnaround</option>
                </select>
              </div>

            </div>

            {/* Bottom Row: Category Filter Pills */}
            <div className="pt-3 border-t border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 focus-civic ${
                  selectedCategory === 'all'
                    ? 'bg-[#0F4C81] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Services
              </button>
              {activeCategories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 focus-civic ${
                    selectedCategory === cat.id
                      ? 'bg-[#0F4C81] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </CivicCard>
        </section>

        {/* ==================================================
            SECTION 3: ACTIVE RESULTS CONTROLS
            ================================================== */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-medium px-1">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-slate-900 tabular-nums font-black">{filteredServices.length}</strong> of <span className="tabular-nums">{services.length}</span> services
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
                className="text-[#0F4C81] hover:underline font-bold cursor-pointer ml-2"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Grid vs List View Toggle */}
          <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === 'grid' ? 'bg-blue-50 text-[#0F4C81]' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Grid View"
              aria-label="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === 'list' ? 'bg-blue-50 text-[#0F4C81]' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="List View"
              aria-label="List View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ==================================================
            SECTION 4: MAIN SERVICES LISTING (GRID OR LIST)
            ================================================== */}
        <section aria-label="Services List">
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
              onSecondaryAction={() => openGeneralWhatsApp('Hello My EasyDesk, I need help with government certificate services.')}
            />
          ) : filteredServices.length === 0 ? (
            <EmptyState
              title="No Matching Services Found"
              description={`We couldn't find any services matching "${searchQuery}". Try modifying your search term or talk to our desk team for custom documentation assistance.`}
              actionText="Reset Filters"
              onAction={() => { setSelectedCategory('all'); setSearchQuery(''); setSortBy('recommended'); }}
              secondaryActionText="Ask Desk on WhatsApp"
              onSecondaryAction={() => openGeneralWhatsApp(`Inquiry regarding service search: ${searchQuery}`)}
            />
          ) : viewMode === 'grid' ? (
            /* GRID VIEW WITH DISTINCT VISUAL HIERARCHY */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredServices.map(service => {
                const catName = categories.find(c => c.id === service.categoryId)?.name || 'Service';
                const totalFee = (service.govFees || 0) + (service.serviceCharge || 0);
                const bannerImg = service.bannerImage || service.imageUrl || service.image;

                return (
                  <CivicCard
                    key={service.id}
                    variant="default"
                    hoverEffect
                    className="flex flex-col justify-between group"
                  >
                    <div>
                      {/* Banner Image with Clean Fallback */}
                      {bannerImg ? (
                        <div 
                          onClick={() => handleOpenDetails(service.id)}
                          className="relative w-full h-44 overflow-hidden bg-slate-100 cursor-pointer border-b border-slate-100"
                        >
                          <img
                            src={bannerImg}
                            alt={service.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                            {service.featured && (
                              <span className="bg-blue-600/95 backdrop-blur-xs text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md shadow-xs">
                                Featured
                              </span>
                            )}
                            {service.popular && (
                              <span className="bg-amber-500/95 backdrop-blur-xs text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md shadow-xs">
                                Popular
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div 
                          onClick={() => handleOpenDetails(service.id)}
                          className="w-full h-24 bg-gradient-to-r from-blue-900 via-[#0F4C81] to-slate-900 flex items-center justify-between px-4 text-white cursor-pointer border-b border-slate-100"
                        >
                          <div className="flex items-center gap-2">
                            <Layers className="w-5 h-5 text-cyan-300" />
                            <span className="text-[11px] font-bold text-slate-100">Official Desk Service</span>
                          </div>
                          {service.featured && (
                            <span className="bg-white/20 text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded">
                              Featured
                            </span>
                          )}
                        </div>
                      )}

                      <div className="p-5 sm:p-6 space-y-3">
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
                          className="font-black text-base text-slate-900 hover:text-[#0F4C81] cursor-pointer transition line-clamp-1 leading-snug m-0"
                          title={service.title}
                        >
                          {service.title}
                        </h3>

                        {/* Short Description */}
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed font-normal m-0">
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
                    </div>

                    {/* Pricing & Actions Footer */}
                    <div className="px-5 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-3">
                      <div>
                        <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-tight">
                          Starting Fee
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-base sm:text-lg font-black text-slate-900 tabular-nums notranslate" translate="no">
                            ₹{totalFee}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">all-incl.</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenDetails(service.id)}
                          className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer shadow-2xs focus-civic"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => openWhatsAppForService(service, catName)}
                          className="bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95 btn-glow-emerald focus-civic"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Apply
                        </button>
                      </div>
                    </div>

                  </CivicCard>
                );
              })}
            </div>
          ) : (
            /* LIST VIEW WITH HORIZONTAL RESPONSIVE ROWS */
            <div className="space-y-4">
              {filteredServices.map(service => {
                const catName = categories.find(c => c.id === service.categoryId)?.name || 'Service';
                const totalFee = (service.govFees || 0) + (service.serviceCharge || 0);
                const bannerImg = service.bannerImage || service.imageUrl || service.image;

                return (
                  <CivicCard
                    key={service.id}
                    variant="default"
                    hoverEffect
                    className="flex flex-col sm:flex-row group"
                  >
                    {/* Left Banner Thumbnail */}
                    {bannerImg ? (
                      <div
                        onClick={() => handleOpenDetails(service.id)}
                        className="sm:w-60 h-48 sm:h-auto min-h-[140px] relative overflow-hidden bg-slate-100 cursor-pointer shrink-0"
                      >
                        <img
                          src={bannerImg}
                          alt={service.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                          {service.featured && (
                            <span className="bg-blue-600/90 backdrop-blur-xs text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md shadow-xs">
                              Featured
                            </span>
                          )}
                          {service.popular && (
                            <span className="bg-amber-500/90 backdrop-blur-xs text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md shadow-xs">
                              Popular
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => handleOpenDetails(service.id)}
                        className="sm:w-48 h-32 sm:h-auto bg-gradient-to-br from-blue-900 via-[#0F4C81] to-slate-900 p-4 flex flex-col justify-between text-white shrink-0 cursor-pointer"
                      >
                        <Layers className="w-6 h-6 text-cyan-300" />
                        <span className="text-[10px] font-bold text-slate-200">Official Service Desk</span>
                      </div>
                    )}

                    {/* Middle Content */}
                    <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider bg-blue-50 text-[#0F4C81] px-2.5 py-0.5 rounded-full border border-blue-100/80">
                            {catName}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-md">
                            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{service.processingTime || '3–5 Working Days'}</span>
                          </span>
                        </div>

                        <h3
                          onClick={() => handleOpenDetails(service.id)}
                          className="font-black text-base sm:text-lg text-slate-900 hover:text-[#0F4C81] cursor-pointer transition line-clamp-1 leading-snug m-0"
                        >
                          {service.title}
                        </h3>

                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed m-0 font-normal">
                          {service.shortDescription || service.description || 'Assisted document processing and government filing support.'}
                        </p>

                        {/* Required Documents Checklist */}
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Docs:</span>
                          {(service.requiredDocuments || []).slice(0, 3).map((doc, dIdx) => (
                            <span key={dIdx} className="text-[10px] bg-slate-50 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200/60 font-medium">
                              ✓ {doc}
                            </span>
                          ))}
                          {(service.requiredDocuments || []).length > 3 && (
                            <span className="text-[10px] text-slate-500 font-bold">
                              +{(service.requiredDocuments || []).length - 3} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bottom Pricing & Actions */}
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Starting Fee</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black text-slate-900 tabular-nums">₹{totalFee}</span>
                            <span className="text-[10px] text-slate-400 font-normal">all-incl.</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(service.id)}
                            className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer shadow-2xs focus-civic"
                          >
                            View Details
                          </button>
                          <button
                            type="button"
                            onClick={() => openWhatsAppForService(service, catName)}
                            className="bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95 btn-glow-emerald focus-civic"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Apply on WhatsApp
                          </button>
                        </div>
                      </div>
                    </div>

                  </CivicCard>
                );
              })}
            </div>
          )}
        </section>

        {/* ==================================================
            SECTION 5: BOTTOM HELP & AI BANNER
            ================================================== */}
        <div className="mt-12 bg-gradient-to-br from-[#0A2540] via-[#0F4C81] to-[#0A2540] text-white rounded-3xl p-6 sm:p-8 shadow-md flex flex-col md:flex-row items-center justify-between gap-6 border border-blue-900/40">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 bg-white/10 text-cyan-300 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-white/15">
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" /> Custom Certificate Inquiry
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white m-0">Can't Find the Service You Need?</h3>
            <p className="text-xs sm:text-sm text-blue-100/90 max-w-xl m-0 font-normal leading-relaxed">
              Our officers handle hundreds of specialized municipal, state, and central government filings. Connect directly with our desk team for instant personalized guidance.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => openGeneralWhatsApp('Hello My EasyDesk, I need help with a custom digital service that is not in the catalog.')}
              className="bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2 shadow-xs active:scale-95 btn-glow-emerald focus-civic"
            >
              <MessageSquare className="w-4 h-4" /> WhatsApp Officer
            </button>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('easydesk-ai-contextual-help', {
                  detail: { customPrompt: "Hello! I need guidance on finding a specific certificate service.", autoSend: true }
                }));
              }}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2 focus-civic"
            >
              <Bot className="w-4 h-4 text-cyan-300" /> Consult AI Desk
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
