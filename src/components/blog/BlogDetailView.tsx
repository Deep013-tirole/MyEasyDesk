import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { 
  ArrowLeft, Calendar, Clock, Tag, MessageSquare, Send, 
  CheckCircle2, ShieldCheck, User as UserIcon, 
  FileText, Share2, Check, ChevronRight, Sparkles,
  HelpCircle, Eye, RefreshCw
} from 'lucide-react';
import { Blog, BlogCategory, BlogComment, Service } from '../../types.js';
import { openGeneralWhatsApp } from '../../lib/whatsapp.js';
import { getCanonicalOrigin, getBlogPostingJsonLd, getBreadcrumbsJsonLd } from '../../lib/seoConfig.js';
import BlogCard from './BlogCard.js';
import ContentUnavailable from '../ContentUnavailable.js';
import { renderRichText } from '../../utils/richTextRenderer';

interface BlogDetailViewProps {
  blog: Blog;
  blogs: Blog[];
  blogCategories: BlogCategory[];
  onBack: () => void;
  onSelectCategory: (categoryId: string) => void;
  onSelectBlog: (blog: Blog) => void;
  updateBlogs?: (blogs: Blog[]) => void;
  services?: Service[];
  onSelectService?: (serviceId: string) => void;
}

export default function BlogDetailView({
  blog,
  blogs,
  blogCategories,
  onBack,
  onSelectCategory,
  onSelectBlog,
  updateBlogs,
  services = [],
  onSelectService
}: BlogDetailViewProps) {
  const [currentBlog, setCurrentBlog] = useState<Blog>(blog);
  const [isDeletedOrUnavailable, setIsDeletedOrUnavailable] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Comment Form State
  const [newCommentName, setNewCommentName] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [commentSuccess, setCommentSuccess] = useState('');

  // Synchronize if prop blog changes
  useEffect(() => {
    setCurrentBlog(blog);
    setImageError(false);
    setIsDeletedOrUnavailable(false);
  }, [blog]);

  // Authoritative API live verification on mount / change to prevent displaying stale deleted articles
  useEffect(() => {
    let isMounted = true;
    const identifier = blog.slug || blog.id;
    if (!identifier) return;

    fetch(`/api/blogs/${encodeURIComponent(identifier)}?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store' }
    })
      .then(res => {
        if (!isMounted) return null;
        if (res.status === 404) {
          setIsDeletedOrUnavailable(true);
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then(liveData => {
        if (!isMounted || !liveData) return;
        const st = String(liveData.status || 'published').toLowerCase().trim();
        if (st === 'published' || st === 'active') {
          setCurrentBlog(liveData);
          if (updateBlogs) {
            updateBlogs(blogs.map(b => b.id === liveData.id ? liveData : b));
          }
        } else {
          setIsDeletedOrUnavailable(true);
        }
      })
      .catch(() => {
        // Network offline or error, maintain current state
      });

    return () => {
      isMounted = false;
    };
  }, [blog.id, blog.slug, updateBlogs, blogs]);

  // Category resolution
  const matchedCat = blogCategories.find(
    c => c.id === currentBlog.categoryId || c.name.toLowerCase() === (currentBlog.category || '').toLowerCase()
  );
  const categoryName = matchedCat ? matchedCat.name : (currentBlog.category || 'Government Services');
  const categoryId = matchedCat ? matchedCat.id : 'all';

  // Reading time calculation
  const wordCount = (currentBlog.content || '').trim().split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(2, Math.ceil(wordCount / 200));

  // Canonical Origin & URL
  const origin = getCanonicalOrigin();
  const canonicalUrl = `${origin}/blogs/${currentBlog.slug || currentBlog.id}`;

  // Formatted publication date
  const formattedDate = currentBlog.date 
    ? new Date(currentBlog.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : (currentBlog.createdAt ? new Date(currentBlog.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent Guide');

  // Formatted update date if available
  const formattedUpdateDate = (currentBlog as any).updatedAt
    ? new Date((currentBlog as any).updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  // Contextual matching service (genuine assistance mapping)
  const matchedService = useMemo(() => {
    if (!services || services.length === 0) return null;
    const activeServices = services.filter(s => {
      const st = (s.status || 'Active').toLowerCase();
      return st !== 'inactive' && st !== 'deleted';
    });
    if (activeServices.length === 0) return null;

    const titleLower = (currentBlog.title || '').toLowerCase();
    const tagsLower = (currentBlog.tags || []).map(t => t.toLowerCase());
    const catLower = (categoryName || '').toLowerCase();

    const matches = (keywords: string[]) => {
      return keywords.some(kw => 
        titleLower.includes(kw) || 
        tagsLower.some(t => t.includes(kw)) ||
        catLower.includes(kw)
      );
    };

    if (matches(['pan card', 'pan correction', 'nsdl', 'utiitsl', 'instant pan'])) {
      const panService = activeServices.find(s => s.title.toLowerCase().includes('pan'));
      if (panService) return panService;
    }

    if (matches(['aadhaar', 'uidai', 'eaadhaar', 'aadhaar address', 'demographic update'])) {
      const aadhaarService = activeServices.find(s => s.title.toLowerCase().includes('aadhaar'));
      if (aadhaarService) return aadhaarService;
    }

    if (matches(['passport', 'tatkaal passport', 'passport seva', 're-issue passport'])) {
      const passportService = activeServices.find(s => s.title.toLowerCase().includes('passport'));
      if (passportService) return passportService;
    }

    if (matches(['msme', 'udyam', 'enterprise registration', 'udyam certificate'])) {
      const msmeService = activeServices.find(s => s.title.toLowerCase().includes('msme') || s.title.toLowerCase().includes('udyam'));
      if (msmeService) return msmeService;
    }

    if (matches(['gst', 'gstin', 'goods and services tax', 'gst return'])) {
      const gstService = activeServices.find(s => s.title.toLowerCase().includes('gst'));
      if (gstService) return gstService;
    }

    if (matches(['scholarship', 'nsp', 'post matric', 'pre matric', 'scholarship portal'])) {
      const scholarshipService = activeServices.find(s => s.title.toLowerCase().includes('scholarship'));
      if (scholarshipService) return scholarshipService;
    }

    for (const s of activeServices) {
      const sTitleLower = s.title.toLowerCase();
      if (titleLower.includes(sTitleLower) || tagsLower.some(t => t.includes(sTitleLower))) {
        return s;
      }
    }

    return null;
  }, [currentBlog, services, categoryName]);

  // Related Guides: Same category first, excluding current article
  const sameCategoryBlogs = blogs.filter(
    b => b.id !== currentBlog.id && (b.categoryId === currentBlog.categoryId || (b.category || '').toLowerCase() === (currentBlog.category || '').toLowerCase())
  );
  const otherRecentBlogs = blogs.filter(
    b => b.id !== currentBlog.id && !sameCategoryBlogs.some(sc => sc.id === b.id)
  );
  const relatedBlogs = [...sameCategoryBlogs, ...otherRecentBlogs].slice(0, 3);

  // Add Reader Comment Handler
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentName.trim() || !newCommentText.trim()) return;

    const newComment: BlogComment = {
      id: `comment-${Date.now()}`,
      userName: newCommentName.trim(),
      comment: newCommentText.trim(),
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    };

    const updatedBlog: Blog = {
      ...currentBlog,
      comments: [...(currentBlog.comments || []), newComment]
    };

    setCurrentBlog(updatedBlog);

    if (updateBlogs) {
      const updatedBlogs = blogs.map(b => b.id === currentBlog.id ? updatedBlog : b);
      updateBlogs(updatedBlogs);
    }

    setNewCommentName('');
    setNewCommentText('');
    setCommentSuccess('Your inquiry or feedback has been submitted successfully.');
    setTimeout(() => setCommentSuccess(''), 4000);
  };

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`*${currentBlog.title}*\nRead this comprehensive filing guide on My EasyDesk:\n${window.location.href}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  if (!blog || isDeletedOrUnavailable) {
    return (
      <ContentUnavailable
        id="blog-detail-not-found"
        statusCode={404}
        title="Article Unavailable"
        message="The requested filing guide or article has been removed, unpublished, or is no longer available."
        primaryActionText="Back to Knowledge Hub"
        onPrimaryAction={onBack}
      />
    );
  }

  const rawBlogTitle = currentBlog.seoTitle || currentBlog.title;
  const seoTitle = rawBlogTitle.includes('My EasyDesk') ? rawBlogTitle : (rawBlogTitle.includes('EasyDesk') ? rawBlogTitle.replace('EasyDesk', 'My EasyDesk') : `${rawBlogTitle} | My EasyDesk`);
  const seoDesc = currentBlog.seoDescription || currentBlog.shortDescription || currentBlog.excerpt || currentBlog.title;

  return (
    <article id="blog-detail-view" className="min-h-screen bg-[#F8FAFC] pb-24 font-sans text-slate-900 animate-in fade-in duration-150 w-full max-w-full overflow-x-hidden selection:bg-blue-100 selection:text-[#0F4C81]">
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDesc} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />

        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDesc} />
        <meta property="og:site_name" content="My EasyDesk" />
        {currentBlog.image && <meta property="og:image" content={currentBlog.image} />}

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={canonicalUrl} />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDesc} />
        {currentBlog.image && <meta name="twitter:image" content={currentBlog.image} />}

        {/* JSON-LD Schemas */}
        <script type="application/ld+json">
          {JSON.stringify(getBlogPostingJsonLd(currentBlog))}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(getBreadcrumbsJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Knowledge Hub', path: '/blogs' },
            { name: categoryName, path: '/blogs' },
            { name: currentBlog.title, path: `/blogs/${currentBlog.slug || currentBlog.id}` }
          ]))}
        </script>
      </Helmet>
      
      {/* 1. Header Navigation & Breadcrumbs Bar (Clean Blogger Header) */}
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-16 z-30 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3 text-xs">
          
          {/* Breadcrumbs Navigation */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-slate-500 font-medium truncate min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="hover:text-slate-900 transition flex items-center gap-1 shrink-0 font-bold text-slate-700 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>All Guides</span>
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <button
              type="button"
              onClick={() => {
                onSelectCategory(categoryId);
                onBack();
              }}
              className="hover:text-[#0F4C81] transition font-semibold text-slate-600 truncate cursor-pointer hidden xs:inline"
            >
              {categoryName}
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0 hidden xs:inline" />
            <span className="text-slate-400 truncate max-w-[140px] sm:max-w-[240px] md:max-w-[340px]">
              {currentBlog.title}
            </span>
          </nav>

          {/* Social Share & Copy Link Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-800 font-bold text-xs transition cursor-pointer active:scale-95"
              title="Share on WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-slate-700 font-bold text-xs transition cursor-pointer active:scale-95 shadow-2xs"
              title="Copy Article Link"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Share</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* 2. Main Article Editorial Column (Optimal 720-780px Readable Width) */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 space-y-8">
        
        {/* Article Metadata & Header */}
        <header className="space-y-4">
          
          {/* Category Pill */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onSelectCategory(categoryId);
                onBack();
              }}
              className="bg-blue-50 hover:bg-blue-100 text-[#0F4C81] font-bold text-xs px-3.5 py-1 rounded-full border border-blue-200/80 uppercase tracking-wider transition cursor-pointer"
            >
              {categoryName}
            </button>

            {currentBlog.featured && (
              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 font-bold text-xs px-3 py-0.5 rounded-full uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-amber-600" /> Featured Guide
              </span>
            )}
          </div>

          {/* Large Article Title */}
          <h1 className="text-2xl sm:text-4xl lg:text-[42px] font-black text-slate-950 tracking-tight leading-[1.25] text-balance">
            {currentBlog.title}
          </h1>

          {/* Short Excerpt / Lead Paragraph */}
          {currentBlog.excerpt && (
            <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed border-l-2 border-blue-200 pl-3 italic">
              {currentBlog.excerpt}
            </p>
          )}

          {/* Author Byline & Publishing Metadata Strip */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 pb-4 border-y border-slate-200/80 text-xs text-slate-600">
            
            {/* Author Identification */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0F4C81] to-[#0B2545] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                {(currentBlog.author || 'ED')[0]}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 notranslate" translate="no">
                    {currentBlog.author || 'Desk Verification Officer'}
                  </span>
                  <span className="inline-flex items-center text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded font-semibold border border-blue-100">
                    Verified
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium block">
                  My EasyDesk E-Governance Knowledge Desk
                </span>
              </div>
            </div>

            {/* Publication / Timing Details */}
            <div className="flex flex-wrap items-center gap-3 text-slate-500 font-medium">
              <span className="flex items-center gap-1 notranslate" translate="no" title="Published Date">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{formattedDate}</span>
              </span>

              {formattedUpdateDate && formattedUpdateDate !== formattedDate && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1 notranslate" translate="no" title="Last Updated">
                    <RefreshCw className="w-3 h-3 text-emerald-600" />
                    <span>Updated {formattedUpdateDate}</span>
                  </span>
                </>
              )}

              <span className="text-slate-300">•</span>

              <span className="flex items-center gap-1" title="Estimated Reading Time">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{readingTime} min read</span>
              </span>

              {typeof currentBlog.views === 'number' && currentBlog.views > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1" title="Reader Views">
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span>{currentBlog.views} views</span>
                  </span>
                </>
              )}
            </div>

          </div>

        </header>

        {/* 3. Featured Hero Image & Caption */}
        <figure className="space-y-2">
          <div className="w-full aspect-[16/9] sm:aspect-[21/9] max-h-[460px] rounded-2xl sm:rounded-3xl bg-slate-100 overflow-hidden border border-slate-200/80 shadow-xs relative">
            {currentBlog.image && !imageError ? (
              <img
                src={currentBlog.image}
                alt={currentBlog.title}
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
                className="w-full h-full object-cover transition-opacity duration-300"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-[#0B2545] to-[#0F4C81] text-white p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-3">
                  <FileText className="w-7 h-7 text-teal-300" />
                </div>
                <span className="text-xs sm:text-sm font-mono tracking-widest uppercase text-teal-200 font-bold">
                  MY EASYDESK OFFICIAL FILING GUIDE
                </span>
                <span className="text-xs text-slate-300 mt-1 max-w-sm">
                  {currentBlog.title}
                </span>
              </div>
            )}
          </div>
          <figcaption className="text-center text-[11px] sm:text-xs text-slate-400 italic font-medium">
            Official procedural guidance and verified compliance roadmap curated by My EasyDesk.
          </figcaption>
        </figure>

        {/* 4. Article Body — Clean, Distraction-Free Reading Container */}
        <section className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-10 md:p-12 space-y-8">
          
          {/* Formatted Article Content */}
          <div className="easydesk-blog-article-body text-slate-800 text-[15px] sm:text-[17px] leading-[1.8] sm:leading-[1.85] font-normal">
            {renderRichText(currentBlog.content, { className: 'space-y-6' })}
          </div>

          {/* Official Verification Stamp Card */}
          <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Document Pre-Audit & Error Verification
              </h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              My EasyDesk provides assistance with document verification, application corrections, and digital submission workflows. Always keep your official acknowledgment receipt and tracking code safely stored for verification.
            </p>
          </div>

          {/* Topic Tags */}
          {currentBlog.tags && currentBlog.tags.length > 0 && (
            <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1 mr-1">
                <Tag className="w-3.5 h-3.5" /> Topics:
              </span>
              {currentBlog.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold px-3 py-1 rounded-lg border border-slate-200/60 transition cursor-default"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Author Bio Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200 flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#0F4C81] text-white flex items-center justify-center font-black text-lg shrink-0 shadow-2xs">
              {(currentBlog.author || 'ED')[0]}
            </div>
            <div className="space-y-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h4 className="font-bold text-sm text-slate-900 notranslate" translate="no">
                  {currentBlog.author || 'Desk Verification Officer'}
                </h4>
                <span className="text-[10px] bg-blue-100 text-[#0F4C81] px-2 py-0.5 rounded-full font-bold">
                  Editorial Team
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Part of the official My EasyDesk research desk. Focused on simplifying Indian government schemes, e-governance documentation, MSME registrations, and digital citizen services.
              </p>
            </div>
          </div>

          {/* Direct WhatsApp Guidance Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0B2545] to-[#0F4C81] text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="space-y-1 text-center sm:text-left">
              <h4 className="font-extrabold text-sm sm:text-base text-white">Have Questions About This Process?</h4>
              <p className="text-xs text-blue-100">
                Connect directly with our desk officers on WhatsApp for personalized document verification and submission guidance.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openGeneralWhatsApp(`Hello My EasyDesk, I need assistance regarding the guide: "${currentBlog.title}"`)}
              className="bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-xs px-5 py-3 rounded-xl transition cursor-pointer flex items-center gap-2 shrink-0 shadow-md active:scale-95"
            >
              <MessageSquare className="w-4 h-4" /> Connect on WhatsApp
            </button>
          </div>

        </section>

        {/* 5. Contextual Service Recommendation (If Genuine Match Exists) */}
        {matchedService && (
          <aside id="blog-related-service-card" className="bg-gradient-to-br from-blue-50/90 via-white to-slate-50 rounded-3xl border border-blue-200/90 p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-[#0F4C81] text-white shadow-2xs">
                  <Sparkles className="w-3 h-3" /> Related EasyDesk Service
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Verified Application Assistance
                </span>
              </div>
              {((matchedService.govFees || 0) + (matchedService.serviceCharge || 0) > 0) && (
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">Total Service Fee</span>
                  <span className="text-lg font-black text-slate-900">
                    ₹{(matchedService.govFees || 0) + (matchedService.serviceCharge || 0)}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg sm:text-xl font-black text-slate-900">
                {matchedService.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                {matchedService.shortDescription || matchedService.description || `Get end-to-end filing support, document audits, and error checks for ${matchedService.title} through My EasyDesk.`}
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-blue-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Pre-submission verification & zero rejection support</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onSelectService) {
                    onSelectService(matchedService.slug || matchedService.id);
                  } else {
                    window.location.href = `/services/${matchedService.slug || matchedService.id}`;
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-[#0F4C81] hover:bg-[#0b3b64] text-white text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>Apply with EasyDesk Assistance</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </aside>
        )}

        {/* 6. Related Articles Grid */}
        {relatedBlogs.length > 0 && (
          <section className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-950">Related Guides & Articles</h3>
                <p className="text-xs text-slate-500">More practical digital service guidance in {categoryName}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectCategory(categoryId);
                  onBack();
                }}
                className="text-xs font-bold text-[#0F4C81] hover:underline cursor-pointer"
              >
                View all in {categoryName} →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {relatedBlogs.map((relBlog) => (
                <BlogCard
                  key={relBlog.id}
                  blog={relBlog}
                  blogCategories={blogCategories}
                  onSelect={(b) => {
                    onSelectBlog(b);
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                  }}
                  compact={true}
                />
              ))}
            </div>
          </section>
        )}

        {/* 7. Reader Questions & Comments Section */}
        <section className="space-y-6 pt-4">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <h3 className="text-lg font-black text-slate-950 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#0F4C81]" />
              Reader Inquiries & Discussion ({currentBlog.comments?.length || 0})
            </h3>
          </div>

          {/* Comments List */}
          <div className="space-y-3">
            {(!currentBlog.comments || currentBlog.comments.length === 0) ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-xs text-slate-500">
                <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                No questions yet. Have an inquiry about this service or document requirements? Post below!
              </div>
            ) : (
              currentBlog.comments.map((comment) => (
                <div key={comment.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-50 text-[#0F4C81] flex items-center justify-center font-bold text-xs border border-blue-100">
                        <UserIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-xs text-slate-900 notranslate" translate="no">{comment.userName}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium notranslate" translate="no">{comment.date}</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed pl-9">
                    {comment.comment}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Submit Comment / Question Form */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-4">
            <div>
              <h4 className="text-sm font-black text-slate-900">Post an Inquiry / Feedback</h4>
              <p className="text-xs text-slate-500 mt-0.5">Ask questions regarding eligibility or document requirements.</p>
            </div>

            {commentSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{commentSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAddComment} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Your Full Name *</label>
                <input
                  type="text"
                  required
                  value={newCommentName}
                  onChange={(e) => setNewCommentName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:border-[#0F4C81] focus:ring-1 focus:ring-[#0F4C81] outline-none bg-slate-50/50 notranslate"
                  translate="no"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Your Question or Feedback *</label>
                <textarea
                  rows={3}
                  required
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Type your question regarding required documents or application steps..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:border-[#0F4C81] focus:ring-1 focus:ring-[#0F4C81] outline-none bg-slate-50/50 notranslate"
                  translate="no"
                />
              </div>

              <button
                type="submit"
                className="bg-[#0F4C81] hover:bg-[#0b3b64] text-white font-bold px-5 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2 shadow-xs active:scale-95"
              >
                <Send className="w-3.5 h-3.5" /> Submit Inquiry
              </button>
            </form>
          </div>

        </section>

      </main>

    </article>
  );
}
