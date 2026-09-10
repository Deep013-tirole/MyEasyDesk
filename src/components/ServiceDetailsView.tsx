import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft, CheckCircle2, Clock, Calendar, ShieldCheck, FileText,
  HelpCircle, MessageSquare, Bot, Star, ChevronDown,
  ChevronUp, Sparkles, Building2, Award, Zap, CheckSquare,
  Users, AlertCircle, ArrowRight, Share2, Copy, Check,
  Maximize2, X, ZoomIn
} from 'lucide-react';
import { Service, ServiceCategory, Review } from '../types.js';
import { openWhatsAppForService, openGeneralWhatsApp } from '../lib/whatsapp.js';
import { Helmet } from 'react-helmet-async';
import { getCanonicalOrigin, getServiceJsonLd, getFaqJsonLd, getBreadcrumbsJsonLd } from '../lib/seoConfig.js';
import ReviewSubmissionModal from './ReviewSubmissionModal.js';
import ContentUnavailable from './ContentUnavailable.js';
import ApplyOnlineModal from './ApplyOnlineModal.js';
import { renderRichText } from '../utils/richTextRenderer';

interface ServiceDetailsViewProps {
  serviceId: string;
  services: Service[];
  categories: ServiceCategory[];
  reviews: Review[];
  setView: (view: string) => void;
  setSelectedServiceId: (id: string | null) => void;
  onRefreshCatalogs?: () => void;
  isLoadingCatalogs?: boolean;
}

export default function ServiceDetailsView({
  serviceId,
  services,
  categories,
  reviews,
  setView,
  setSelectedServiceId,
  onRefreshCatalogs,
  isLoadingCatalogs
}: ServiceDetailsViewProps) {
  const [activeNavTab, setActiveNavTab] = useState<string>('overview');
  const [openFaqIndices, setOpenFaqIndices] = useState<number[]>([]);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(() => {
    try {
      const search = window.location.search;
      const hash = window.location.hash;
      return new URLSearchParams(search).get('apply') === 'true' || hash.includes('apply=true') || hash.includes('#apply');
    } catch {
      return false;
    }
  });
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Reset image error and modal state on service switch; check for deep link
  useEffect(() => {
    setImageError(false);
    setIsImageModalOpen(false);
    try {
      const search = window.location.search;
      const hash = window.location.hash;
      if (new URLSearchParams(search).get('apply') === 'true' || hash.includes('apply=true') || hash.includes('#apply')) {
        setIsApplyModalOpen(true);
      }
    } catch {}
  }, [serviceId]);

  // Scroll to top immediately when service changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [serviceId]);

  // Find active service by either exact ID or slug
  const service = useMemo(() => {
    if (!serviceId) return null;
    return services.find(
      s => s.id === serviceId || (s.slug && s.slug.toLowerCase() === serviceId.toLowerCase())
    ) || null;
  }, [services, serviceId]);

  // Find category
  const category = useMemo(() => {
    if (!service) return null;
    return categories.find(c => c.id === service.categoryId) || null;
  }, [categories, service]);

  const categoryName = category?.name || 'Digital Service';

  // Related services in same category (excluding current)
  const relatedServices = useMemo(() => {
    if (!service) return [];
    let rel = services.filter(s => s.id !== service.id && s.categoryId === service.categoryId);
    if (rel.length < 3) {
      const others = services.filter(s => s.id !== service.id && s.categoryId !== service.categoryId);
      rel = [...rel, ...others];
    }
    return rel.slice(0, 3);
  }, [services, service]);

  // Approved reviews for this service (with fallback to approved top reviews)
  const approvedReviews = useMemo(() => {
    const valid = reviews.filter(r => r.status === 'Approved' || (r.status !== 'Rejected' && r.status !== 'Pending' && r.status !== 'Hidden'));

    // Service-specific reviews
    const svcReviews = valid.filter(r => r.serviceId === serviceId || (r.serviceTitle && service && r.serviceTitle.toLowerCase() === service.title.toLowerCase()));

    if (svcReviews.length >= 2) {
      return svcReviews;
    }

    // Supplement with general approved reviews if fewer than 2
    const general = valid.filter(r => !svcReviews.some(sr => sr.id === r.id));
    return [...svcReviews, ...general].slice(0, 4);
  }, [reviews, serviceId, service]);

  // Calculate average rating strictly from real approved reviews (no fake defaults)
  const ratingSummary = useMemo(() => {
    if (approvedReviews.length === 0) {
      return { avg: null, count: 0 };
    }
    const sum = approvedReviews.reduce((acc, r) => acc + (r.rating || 5), 0);
    const avg = (sum / approvedReviews.length).toFixed(1);
    return { avg: parseFloat(avg), count: approvedReviews.length };
  }, [approvedReviews]);

  // Interactive Document Readiness Checklist state
  const [checkedDocs, setCheckedDocs] = useState<Record<number, boolean>>({});
  const toggleDocCheck = (idx: number) => {
    setCheckedDocs(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Toggle FAQ accordion item
  const toggleFaq = (idx: number) => {
    setOpenFaqIndices(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  // Trigger contextual AI Help
  const handleAskAI = () => {
    if (!service) return;
    window.dispatchEvent(new CustomEvent('easydesk-ai-contextual-help', {
      detail: { service, autoSend: true }
    }));
  };

  // Copy share link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Fallback if service not found (404 / content unavailable)
  if (!service) {
    if (isLoadingCatalogs) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-xs text-slate-400 font-sans">
          <div className="w-8 h-8 border-4 border-[#0F4C81] border-t-transparent rounded-full animate-spin" />
          <span>Loading service details...</span>
        </div>
      );
    }

    return (
      <ContentUnavailable
        id="service-details-not-found"
        statusCode={404}
        title="Service Unavailable"
        message="The requested service catalog item may have been updated, archived, or moved. Please explore our full directory of government services."
        primaryActionText="Browse All Services"
        onPrimaryAction={() => {
          setSelectedServiceId(null);
          setView('services');
        }}
        secondaryActionText="Return to Home"
        onSecondaryAction={() => {
          setSelectedServiceId(null);
          setView('home');
        }}
      />
    );
  }

  const totalFee = (service.govFees || 0) + (service.serviceCharge || 0);

  const hasTimeline = Boolean(service?.timeline?.enabled && service.timeline?.startDate && service.timeline?.endDate);

  const formatDateDisplay = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const getTimelineStatus = (startDateStr?: string | null, endDateStr?: string | null) => {
    if (!startDateStr || !endDateStr) return { label: 'Active Schedule', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' };
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(startDateStr);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDateStr);
      end.setHours(23, 59, 59, 999);
      if (today < start) {
        return { label: 'Upcoming', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' };
      } else if (today <= end) {
        return { label: 'Applications Open', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      } else {
        return { label: 'Application Closed', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' };
      }
    } catch {
      return { label: 'Active Schedule', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
  };

  // Available tabs determination
  const availableTabs = [
    { id: 'overview', label: 'Overview' },
    ...(hasTimeline ? [{ id: 'timeline', label: 'Timeline' }] : []),
    { id: 'documents', label: 'Required Documents' },
    { id: 'how-it-works', label: 'How It Works' },
    { id: 'fees', label: 'Fee & Charges' },
    ...(service.eligibility ? [{ id: 'eligibility', label: 'Eligibility' }] : []),
    ...(service.faqs && service.faqs.length > 0 ? [{ id: 'faqs', label: 'FAQs' }] : [])
  ];

  const origin = getCanonicalOrigin();
  const canonicalUrl = `${origin}/services/${service.slug || service.id}`;
  const rawTitle = service.seoTitle || `${service.title} Online Assistance`;
  const seoTitle = rawTitle.includes('EasyDesk') ? rawTitle : `${rawTitle} | EasyDesk`;
  const seoDesc = service.seoDescription || service.shortDescription || service.description || `Apply online for ${service.title} with verified desk assistance, full document verification, transparent fees, and real-time tracking on WhatsApp.`;

  return (
    <div id="easydesk-service-details-page" className="w-full max-w-full overflow-x-hidden min-h-screen bg-slate-50/60 font-sans text-slate-900 pb-20">
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDesc} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDesc} />
        <meta property="og:site_name" content="EasyDesk" />
        {(service.imageUrl || service.image) && (
          <meta property="og:image" content={service.imageUrl || service.image} />
        )}

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={canonicalUrl} />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDesc} />
        {(service.imageUrl || service.image) && (
          <meta name="twitter:image" content={service.imageUrl || service.image} />
        )}

        {/* Structured Data (Schema.org) */}
        <script type="application/ld+json">
          {JSON.stringify(getBreadcrumbsJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Services', path: '/services' },
            { name: service.title, path: `/services/${service.slug || service.id}` }
          ]))}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(getServiceJsonLd(service, category))}
        </script>
        {service.faqs && service.faqs.length > 0 && (
          <script type="application/ld+json">
            {JSON.stringify(getFaqJsonLd(service.faqs))}
          </script>
        )}
      </Helmet>

      {/* 1. BREADCRUMBS BAR */}
      <div className="bg-white border-b border-slate-200/80 sticky top-16 z-30 shadow-xs w-full max-w-full">
        <div className="portal-container py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-4 text-xs font-medium min-w-0">
            <nav className="flex items-center gap-1.5 text-slate-500 overflow-x-auto whitespace-nowrap scrollbar-none min-w-0 flex-1 py-0.5">
              <button
                onClick={() => setView('home')}
                className="hover:text-[#0F4C81] transition cursor-pointer shrink-0"
              >
                Home
              </button>
              <span className="text-slate-300 shrink-0">/</span>
              <button
                onClick={() => {
                  setSelectedServiceId(null);
                  setView('services');
                }}
                className="hover:text-[#0F4C81] transition cursor-pointer shrink-0"
              >
                Services
              </button>
              <span className="text-slate-300 shrink-0">/</span>
              <button
                onClick={() => {
                  setSelectedServiceId(null);
                  setView('services');
                }}
                className="hover:text-[#0F4C81] transition cursor-pointer shrink-0"
              >
                {categoryName}
              </button>
              <span className="text-slate-300 shrink-0">/</span>
              <span className="font-bold text-slate-900 truncate max-w-[120px] sm:max-w-[200px] md:max-w-md">
                {service.title}
              </span>
            </nav>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                onClick={handleCopyLink}
                className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
                title="Share link"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copied' : 'Share'}</span>
              </button>
              <button
                onClick={() => {
                  setSelectedServiceId(null);
                  setView('services');
                }}
                className="flex items-center gap-1 text-[11px] font-bold text-[#0F4C81] hover:bg-blue-50 px-2 sm:px-2.5 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Back to Catalog</span><span className="xs:hidden">Back</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SERVICE HERO SECTION */}
      <section className="bg-white border-b border-slate-200/80 pt-6 sm:pt-8 pb-8 sm:pb-10 w-full max-w-full">
        <div className="portal-container">
          <div className="grid lg:grid-cols-12 gap-6 sm:gap-8 items-start w-full min-w-0">

            {/* Left Hero Content */}
            <div className="lg:col-span-8 space-y-4 min-w-0 w-full">

              {/* Category & Badge Info Row */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-[10px] font-extrabold tracking-wider uppercase bg-blue-50 text-[#0F4C81] border border-blue-100 px-2.5 sm:px-3 py-1 rounded-full shadow-2xs">
                  {categoryName}
                </span>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200/60 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>Processing: {service.processingTime || '3–5 Working Days'}</span>
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full notranslate" translate="no">
                  ID: {service.id}
                </span>
                {hasTimeline && service.timeline?.startDate && service.timeline?.endDate && (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs">
                    <Calendar className="w-3 h-3 text-[#0F4C81]" />
                    <span>Timeline: {formatDateDisplay(service.timeline.startDate)} – {formatDateDisplay(service.timeline.endDate)}</span>
                  </span>
                )}
                {ratingSummary.count > 0 ? (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span>{ratingSummary.avg} ({ratingSummary.count} {ratingSummary.count === 1 ? 'review' : 'reviews'})</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>Verified Catalog Item</span>
                  </span>
                )}
              </div>

              {/* Service Title */}
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight break-words">
                {service.title}
              </h1>

              {/* Short Description */}
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal max-w-3xl">
                {service.shortDescription || service.description || 'Assisted citizen and business documentation support with guaranteed portal verification and zero rejection guidance.'}
              </p>

              {/* Quick Hero Value Chips */}
              <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-medium text-slate-700">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 sm:px-3 py-1.5 rounded-xl">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0F4C81]" />
                  <span>100% Verified Filing</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 sm:px-3 py-1.5 rounded-xl">
                  <Award className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Transparent Government Fees</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 sm:px-3 py-1.5 rounded-xl">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  <span>Fast WhatsApp Updates</span>
                </div>
              </div>

            </div>

            {/* Right Hero Image / Illustration Card */}
            <div className="lg:col-span-4 min-w-0 w-full">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 shadow-xs overflow-hidden w-full">
                {(service.image || service.imageUrl || service.bannerImage) && !imageError ? (
                  <div
                    onClick={() => setIsImageModalOpen(true)}
                    className="relative rounded-xl overflow-hidden bg-slate-900/5 border border-slate-200/80 min-h-[190px] sm:min-h-[220px] max-h-[340px] flex items-center justify-center group cursor-pointer"
                    title="Click to view full banner"
                  >
                    {/* Ambient background fill to prevent harsh letterbox voids without cropping */}
                    <img
                      src={service.image || service.imageUrl || service.bannerImage}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover blur-xl opacity-25 scale-125 select-none pointer-events-none"
                    />

                    {/* 100% Uncropped full banner image */}
                    <img
                      src={service.image || service.imageUrl || service.bannerImage}
                      alt={service.title}
                      onError={() => setImageError(true)}
                      className="relative z-10 w-full h-auto max-h-[280px] sm:max-h-[320px] object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                      referrerPolicy="no-referrer"
                    />

                    {/* Verified Badge */}
                    <div className="absolute top-2.5 left-2.5 z-20 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
                      <ShieldCheck className="w-3 h-3 text-cyan-300" /> EasyDesk Verified
                    </div>

                    {/* Expand/View Full Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsImageModalOpen(true);
                      }}
                      className="absolute bottom-2.5 right-2.5 z-20 bg-slate-900/80 hover:bg-slate-950 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-xs shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3 text-cyan-300" />
                      <span>View Full</span>
                    </button>
                  </div>
                ) : (
                  /* Elegant Graceful Illustration Fallback - NEVER Blank */
                  <div className="relative rounded-xl overflow-hidden min-h-[190px] sm:min-h-[220px] bg-gradient-to-br from-blue-900 via-[#0F4C81] to-slate-900 p-5 flex flex-col justify-between text-white border border-blue-800/40 shadow-inner">
                    <div className="flex justify-between items-start">
                      <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/10">
                        <Building2 className="w-6 h-6 text-cyan-300" />
                      </div>
                      <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        Govt Assistance
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-cyan-200 font-bold uppercase tracking-widest block">
                        Official Service Desk
                      </span>
                      <h3 className="text-sm font-black text-white mt-0.5 line-clamp-1">
                        {service.title}
                      </h3>
                      <p className="text-[10px] text-slate-300 mt-1 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-green-400" />
                        <span>Pre-verified by filing officers</span>
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-3 px-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Assistance Type: <strong className="text-slate-800">Online & WhatsApp</strong></span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Desk Active
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. MAIN SECTION WITH TWO-COLUMN CONTENT + STICKY SIDEBAR */}
      <div className="portal-container pt-6 sm:pt-8 w-full max-w-full">
        <div className="grid lg:grid-cols-12 gap-6 sm:gap-8 items-start w-full min-w-0">

          {/* LEFT COLUMN: NAVIGATION + CONTENT MODULES */}
          <div className="lg:col-span-8 space-y-5 sm:space-y-6 min-w-0 w-full">

            {/* HORIZONTAL SECTION TABS NAVIGATION */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-1.5 shadow-xs sticky top-28 z-20 overflow-x-auto scrollbar-none w-full max-w-full">
              <div className="flex items-center gap-1 min-w-max">
                {availableTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveNavTab(tab.id);
                      const el = document.getElementById(`section-${tab.id}`);
                      if (el) {
                        const yOffset = -140;
                        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
                        window.scrollTo({ top: y, behavior: 'smooth' });
                      }
                    }}
                    className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      activeNavTab === tab.id
                        ? 'bg-[#0F4C81] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SECTION 1: OVERVIEW */}
            <div id="section-overview" className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-7 shadow-xs space-y-4 w-full min-w-0">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <FileText className="w-4 h-4 text-[#0F4C81]" />
                <h2 className="text-sm sm:text-base font-bold text-slate-900">Service Overview & Scope</h2>
              </div>

              <div className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
                {service.description || service.fullDescription ? (
                  renderRichText(service.description || service.fullDescription)
                ) : (
                  <p className="text-slate-400 italic">
                    Service description is not available.
                  </p>
                )}
              </div>

              {/* Service Highlights if available */}
              {service.highlights && service.highlights.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5">Key Highlights</h3>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {service.highlights.map((h, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-200/60 p-2.5 rounded-xl">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* CONDITIONAL SECTION: APPLICATION TIMELINE */}
            {hasTimeline && service.timeline?.startDate && service.timeline?.endDate && (
              <div id="section-timeline" className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-7 shadow-xs space-y-4 w-full min-w-0">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#0F4C81]" />
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">Application Timeline</h2>
                  </div>
                  {(() => {
                    const status = getTimelineStatus(service.timeline.startDate, service.timeline.endDate);
                    return (
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${status.badgeClass}`}>
                        {status.label}
                      </span>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 sm:p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0F4C81] shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Application Start Date</span>
                      <span className="text-sm font-black text-slate-900 font-mono">
                        {formatDateDisplay(service.timeline.startDate)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 sm:p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Application Last Date</span>
                      <span className="text-sm font-black text-slate-900 font-mono">
                        {formatDateDisplay(service.timeline.endDate)}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 bg-blue-50/40 p-3 rounded-xl border border-blue-100">
                  📌 <strong>Application Deadline:</strong> Official portal filing closes on the specified last date. We advise submitting your application early to avoid last-minute portal congestions.
                </p>
              </div>
            )}

            {/* SECTION 2: REQUIRED DOCUMENTS */}
            <div id="section-documents" className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-[#0F4C81]" />
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">Document Readiness Checklist</h2>
                </div>
                {(service.requiredDocuments || []).length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">
                      Readiness: <strong className="text-[#0F4C81]">{Object.values(checkedDocs).filter(Boolean).length} of {(service.requiredDocuments || []).length}</strong> ({Math.round((Object.values(checkedDocs).filter(Boolean).length / (service.requiredDocuments || []).length) * 100)}%)
                    </span>
                  </div>
                )}
              </div>

              {(service.requiredDocuments || []).length > 0 && (
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#059669] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round((Object.values(checkedDocs).filter(Boolean).length / (service.requiredDocuments || []).length) * 100)}%` }}
                  />
                </div>
              )}

              {service.requiredDocuments && service.requiredDocuments.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {service.requiredDocuments.map((doc, idx) => {
                    const isChecked = Boolean(checkedDocs[idx]);
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleDocCheck(idx)}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${
                          isChecked
                            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                            : 'bg-slate-50 border-slate-200/80 hover:border-blue-200'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs shrink-0 mt-0.5 transition ${
                          isChecked ? 'bg-[#059669] text-white' : 'border border-slate-300 bg-white text-transparent'
                        }`}>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs font-bold block ${isChecked ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                            {doc}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {isChecked ? 'Ready for filing' : 'Click to mark as ready'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-blue-50/60 border border-blue-100 p-4 rounded-xl text-xs text-blue-900 flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#0F4C81] shrink-0" />
                  <span>No specific documents listed. Our support team will guide you based on your case.</span>
                </div>
              )}

              <p className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200/60 flex items-center gap-2">
                <span>💡</span>
                <span><strong>Fast Processing Tip:</strong> You can directly share clear smartphone photos of these documents via WhatsApp when our desk officer contacts you.</span>
              </p>
            </div>

            {/* SECTION 3: HOW IT WORKS */}
            <div id="section-how-it-works" className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Clock className="w-4 h-4 text-[#0F4C81]" />
                <h2 className="text-sm sm:text-base font-bold text-slate-900">How It Works (Assisted Process)</h2>
              </div>

              <p className="text-xs text-slate-500">
                EasyDesk handles the complete application filing through dedicated WhatsApp desk assistance. No complicated online forms to fill by yourself.
              </p>

              {/* 5-Step Visual Connected Timeline */}
              <div className="space-y-3 pt-2">
                {[
                  {
                    num: '01',
                    title: 'Place Request on WhatsApp',
                    desc: 'Click "Order on WhatsApp" to connect directly with our assigned document officer.'
                  },
                  {
                    num: '02',
                    title: 'Share Required Documents',
                    desc: 'Send soft copies or clear smartphone photos of your prerequisites securely on WhatsApp.'
                  },
                  {
                    num: '03',
                    title: 'Expert Verification & Audit',
                    desc: 'Our filing officer reviews all document details to prevent government portal rejections.'
                  },
                  {
                    num: '04',
                    title: 'Portal Processing & Submission',
                    desc: 'We submit your application on the official government portal and pay official fees.'
                  },
                  {
                    num: '05',
                    title: 'Completion & Delivery',
                    desc: 'Receive your verified acknowledgement receipt and completed certificate directly on WhatsApp.'
                  }
                ].map((step, sIdx) => (
                  <div key={sIdx} className="flex items-start gap-3.5 bg-slate-50/70 border border-slate-200/70 p-3.5 rounded-xl hover:bg-slate-50 transition">
                    <div className="w-7 h-7 rounded-lg bg-[#0F4C81] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                      {step.num}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{step.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 4: FEE & CHARGES BREAKDOWN */}
            <div id="section-fees" className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#0F4C81]" />
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">Fee & Charges Breakdown</h2>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  100% Transparent
                </span>
              </div>

              <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3.5 text-slate-600">Official Government Department Fee</td>
                      <td className="p-3.5 text-right font-bold text-slate-900 notranslate" translate="no">₹{service.govFees || 0}</td>
                    </tr>
                    <tr className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3.5 text-slate-600">EasyDesk Documentation & Advisory Charge</td>
                      <td className="p-3.5 text-right font-bold text-slate-900 notranslate" translate="no">₹{service.serviceCharge || 0}</td>
                    </tr>
                    <tr className="bg-blue-50/50 font-bold">
                      <td className="p-3.5 text-slate-900 font-extrabold">Total All-Inclusive Service Fee</td>
                      <td className="p-3.5 text-right text-sm font-black text-[#0F4C81] notranslate" translate="no">₹{totalFee}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-[11px] text-slate-500">
                * Price includes document verification, online submission, and status updates. Official government receipt will be provided upon filing.
              </p>
            </div>

            {/* SECTION 5: ELIGIBILITY (Conditional) */}
            {service.eligibility && (
              <div id="section-eligibility" className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-7 shadow-xs space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Users className="w-4 h-4 text-[#0F4C81]" />
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">Who is Eligible?</h2>
                </div>
                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl text-xs text-slate-700 leading-relaxed">
                  {service.eligibility}
                </div>
              </div>
            )}

            {/* SECTION 6: FAQS (Conditional) */}
            {service.faqs && service.faqs.length > 0 && (
              <div id="section-faqs" className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <HelpCircle className="w-4 h-4 text-[#0F4C81]" />
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">Frequently Asked Questions</h2>
                </div>

                <div className="space-y-2.5">
                  {service.faqs.map((faq, idx) => {
                    const isOpen = openFaqIndices.includes(idx);
                    return (
                      <div key={idx} className="border border-slate-200/80 rounded-xl overflow-hidden transition">
                        <button
                          onClick={() => toggleFaq(idx)}
                          className="w-full p-3.5 text-left text-xs font-bold text-slate-900 bg-slate-50/60 hover:bg-slate-50 flex items-center justify-between gap-3 transition cursor-pointer"
                        >
                          <span>{faq.question}</span>
                          {isOpen ? (
                            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                        </button>
                        {isOpen && (
                          <div className="p-3.5 text-xs text-slate-600 bg-white border-t border-slate-100 leading-relaxed">
                            {faq.answer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECTION 7: NEED HELP / NATURAL AI SUPPORT CARD */}
            <div className="bg-gradient-to-br from-slate-900 via-[#0F4C81] to-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-md flex flex-col sm:flex-row items-center justify-between gap-5 border border-blue-900/40">
              <div className="space-y-1.5 text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 bg-cyan-400/20 text-cyan-200 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                  <Bot className="w-3 h-3 text-cyan-300" />
                  <span>Instant Assistance</span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white">Need Guidance on this Service?</h3>
                <p className="text-xs text-slate-300 max-w-md">
                  Ask our smart AI Assistant for document pre-checks, eligibility verification, or step-by-step instructions.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto shrink-0">
                <button
                  id="btn-service-details-ask-ai"
                  onClick={handleAskAI}
                  className="w-full sm:w-auto bg-white hover:bg-slate-100 text-[#0F4C81] font-bold text-xs px-5 py-3 rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Bot className="w-4 h-4 text-[#0F4C81]" />
                  <span>Ask EasyDesk AI Assistant</span>
                </button>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: STICKY SERVICE ACTION CARD */}
          <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-28 min-w-0 w-full">

            {/* Primary Action Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 w-full min-w-0">

              {/* Pricing Header */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  All-Inclusive Service Fee
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 notranslate" translate="no">₹{totalFee}</span>
                  <span className="text-xs text-slate-400">Total payable</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Price includes all official fees and filing assistance charges.
                </p>
              </div>

              {/* Primary Apply Online CTA */}
              <button
                id="btn-apply-online-primary"
                onClick={() => setIsApplyModalOpen(true)}
                className="w-full bg-[#0F4C81] hover:bg-[#0c3e69] text-white font-black text-sm py-3.5 px-4 rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <FileText className="w-4 h-4" />
                <span>Apply Online Now</span>
              </button>

              {/* Secondary WhatsApp Order CTA */}
              <button
                id="btn-order-on-whatsapp-primary"
                onClick={() => openWhatsAppForService(service, categoryName)}
                className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>Or Order via WhatsApp Desk</span>
              </button>

              {/* 3 Trust Indicators */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                <div className="p-2 bg-slate-50/80 rounded-xl border border-slate-100">
                  <ShieldCheck className="w-4 h-4 text-[#0F4C81] mx-auto mb-1" />
                  <span className="text-[9px] font-bold text-slate-700 block leading-tight">Secure & Reliable</span>
                </div>
                <div className="p-2 bg-slate-50/80 rounded-xl border border-slate-100">
                  <Users className="w-4 h-4 text-[#10B981] mx-auto mb-1" />
                  <span className="text-[9px] font-bold text-slate-700 block leading-tight">Expert Support</span>
                </div>
                <div className="p-2 bg-slate-50/80 rounded-xl border border-slate-100">
                  <Zap className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                  <span className="text-[9px] font-bold text-slate-700 block leading-tight">Fast Processing</span>
                </div>
              </div>

              {/* Service Fast Specs */}
              <div className="space-y-2 pt-1 border-t border-slate-100 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Service Turnaround:</span>
                  <span className="font-bold text-slate-800">{service.processingTime || '3–5 Working Days'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Service Category:</span>
                  <span className="font-bold text-slate-800">{categoryName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Filing Method:</span>
                  <span className="font-bold text-emerald-700">Official Portal</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Order Channel:</span>
                  <span className="font-bold text-slate-800">WhatsApp Desk</span>
                </div>
              </div>

            </div>

            {/* Service Highlights Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3 w-full min-w-0">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[#0F4C81]" />
                <span>Service Guarantee</span>
              </h4>

              <ul className="space-y-2 text-xs text-slate-600">
                {(service.highlights && service.highlights.length > 0 ? service.highlights : [
                  'Secure & Trusted document handling',
                  'Pre-submission error verification',
                  'Expert support on WhatsApp',
                  '100% transparent pricing'
                ]).map((hl, hIdx) => (
                  <li key={hIdx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
                    <span>{hl}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Helpline Assistance Box */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs text-slate-600 flex items-center justify-between gap-3 w-full min-w-0">
              <div>
                <span className="font-bold text-slate-800 block">Need custom help?</span>
                <span className="text-[10px] text-slate-500">Talk to our lead desk coordinator</span>
              </div>
              <button
                onClick={() => openGeneralWhatsApp(`Hello EasyDesk, I need help with ${service.title} (ID: ${service.id}).`)}
                className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 font-bold text-[10px] px-3 py-1.5 rounded-lg transition cursor-pointer shadow-2xs shrink-0"
              >
                Chat Now
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* 4. RELATED SERVICES SECTION */}
      <section className="portal-container pt-12 sm:pt-16 w-full max-w-full">
        <div className="flex items-center justify-between mb-6 gap-2">
          <div>
            <h2 className="text-base sm:text-lg md:text-xl font-black text-slate-900">Related Services in {categoryName}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Explore popular document assistance options in this category</p>
          </div>
          <button
            onClick={() => {
              setSelectedServiceId(null);
              setView('services');
            }}
            className="text-xs font-bold text-[#0F4C81] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full min-w-0">
          {relatedServices.map(rel => {
            const relPrice = (rel.govFees || 0) + (rel.serviceCharge || 0);
            return (
              <div
                key={rel.id}
                className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[9px] font-bold text-[#0F4C81] bg-blue-50 px-2 py-0.5 rounded-md">
                      ⏱️ {rel.processingTime || '3–5 Days'}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">{rel.id}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{rel.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {rel.shortDescription || rel.description}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[9px] text-slate-400 block leading-none">Starting from</span>
                    <span className="text-sm font-black text-slate-900">₹{relPrice}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedServiceId(rel.id);
                        window.scrollTo({ top: 0, behavior: 'instant' });
                      }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[10px] px-3 py-1.5 rounded-lg transition cursor-pointer"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => openWhatsAppForService(rel, categoryName)}
                      className="bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3" /> WhatsApp
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. CUSTOMER REVIEWS SECTION */}
      <section className="portal-container pt-16">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xs">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <h2 className="text-lg sm:text-xl font-black text-slate-900">Customer Feedback & Reviews</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Verified experiences from citizens and business owners who used our assistance
              </p>
            </div>

            <div className="flex items-center gap-3">
              {ratingSummary.count > 0 ? (
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-xl font-black text-slate-900 tabular-nums">{ratingSummary.avg}</span>
                    <div className="flex text-amber-400">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                      ))}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium tabular-nums">{ratingSummary.count} verified {ratingSummary.count === 1 ? 'rating' : 'ratings'}</span>
                </div>
              ) : (
                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-600 block">Verified Filing Desk</span>
                  <span className="text-[10px] text-slate-400">No public reviews yet</span>
                </div>
              )}

              <button
                id="btn-open-review-modal"
                onClick={() => setIsReviewModalOpen(true)}
                className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>Rate & Review</span>
              </button>
            </div>
          </div>

          {/* Review Cards Grid */}
          {approvedReviews.length === 0 ? (
            <div className="text-center py-10 px-4 bg-slate-50/80 rounded-2xl border border-dashed border-slate-200">
              <Star className="w-8 h-8 text-amber-300 fill-amber-100 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">Be the First to Review</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Completed applications can be reviewed by verified customers. Place your application today and share your experience with fellow citizens.
              </p>
              <button
                onClick={() => setIsApplyModalOpen(true)}
                className="mt-4 px-4 py-2 bg-[#0F4C81] hover:bg-[#0c3e69] text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs inline-flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" /> Apply for This Service
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {approvedReviews.map((rev, rIdx) => {
                const stars = Math.min(Math.max(rev.rating || 5, 1), 5);
                const author = rev.customerName || rev.userName || 'Verified Citizen';
                return (
                  <div key={rev.id || rIdx} className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[10px]">
                            {author.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-bold text-slate-800 truncate max-w-[110px]">{author}</span>
                        </div>
                        <div className="flex text-amber-400">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 ${i < stars ? 'fill-amber-400 text-amber-400' : 'text-slate-200 fill-slate-100'}`}
                            />
                          ))}
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed font-normal">
                        "{rev.reviewText || rev.comment || 'Smooth process with fast WhatsApp support. Got my documents verified quickly without any hassle!'}"
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/40 text-[10px] text-slate-400 flex justify-between items-center">
                      <span>{rev.date || 'Recent customer'}</span>
                      <span>Assisted by EasyDesk</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </section>

      {/* 6. TRUST / SUPPORT FINAL CTA BAR */}
      <section className="portal-container pt-12">
        <div className="bg-gradient-to-r from-[#0F4C81] via-blue-900 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6 border border-blue-800/40">
          <div className="space-y-1 text-center md:text-left">
            <h2 className="text-lg sm:text-xl font-black text-white">Need help with this service?</h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Our team is ready to assist you. Connect on WhatsApp for instant guidance and document verification.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-center">
            <button
              onClick={() => openWhatsAppForService(service, categoryName)}
              className="bg-[#10B981] hover:bg-[#0e9f6e] text-white font-black text-xs sm:text-sm px-6 py-3.5 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <MessageSquare className="w-4 h-4 fill-white" />
              <span>Order on WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Organic Service Cross-Links & Navigation */}
        <div className="mt-4 pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-slate-500 font-medium">
          <span className="text-slate-400">Quick Assistance:</span>
          <button
            onClick={() => setView('track')}
            className="hover:text-[#0F4C81] hover:underline transition cursor-pointer"
          >
            Track Existing Application →
          </button>
          <span className="text-slate-300">•</span>
          <button
            onClick={() => setView('contact')}
            className="hover:text-[#0F4C81] hover:underline transition cursor-pointer"
          >
            Contact Help Desk Officers →
          </button>
          <span className="text-slate-300">•</span>
          <button
            onClick={() => {
              setSelectedServiceId(null);
              setView('services');
            }}
            className="hover:text-[#0F4C81] hover:underline transition cursor-pointer"
          >
            Browse All Services Directory →
          </button>
        </div>
      </section>

      {/* Review Submission Popup Modal */}
      <ReviewSubmissionModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        initialServiceId={service.id}
        onSuccess={() => {
          setIsReviewModalOpen(false);
          if (onRefreshCatalogs) {
            onRefreshCatalogs();
          }
        }}
      />

      {/* Full Banner Image Lightbox Modal */}
      {isImageModalOpen && (service.image || service.imageUrl || service.bannerImage) && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div
            className="relative bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header */}
            <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-extrabold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-md">
                  {categoryName}
                </span>
                <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                  {service.title} - Official Service Banner
                </h3>
              </div>
              <button
                onClick={() => setIsImageModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Lightbox Body with 100% Uncut Image */}
            <div className="p-3 sm:p-6 flex-1 flex items-center justify-center overflow-auto bg-slate-950/60">
              <img
                src={service.image || service.imageUrl || service.bannerImage}
                alt={service.title}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl shadow-lg border border-slate-800"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Lightbox Footer */}
            <div className="px-4 py-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Pre-verified by EasyDesk Officers
              </span>
              <button
                onClick={() => openWhatsAppForService(service, categoryName)}
                className="bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Order on WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply Online Customer Order Modal */}
      {isApplyModalOpen && service && (
        <ApplyOnlineModal
          isOpen={isApplyModalOpen}
          onClose={() => setIsApplyModalOpen(false)}
          service={service}
          categoryName={categoryName}
          setView={setView}
        />
      )}

    </div>
  );
}
