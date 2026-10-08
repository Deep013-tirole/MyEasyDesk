import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, BookOpen, Layers, MessageSquare, ArrowRight,
  ShieldCheck, HelpCircle, X, Sparkles, Filter, Newspaper,
  ChevronRight, CheckCircle2, Lock, Headphones, Zap, CheckCircle,
  ArrowUpDown, SlidersHorizontal, FileText, Bot,
  Calendar, Clock, LayoutGrid, List
} from 'lucide-react';
import { motion } from 'motion/react';
import { Blog, BlogCategory, Service } from '../types.js';
import { useScrollToTopOnChange } from '../lib/scrollUtils.js';
import { openGeneralWhatsApp } from '../lib/whatsapp.js';
import BlogCard from './blog/BlogCard.js';
import FeaturedBlogCard from './blog/FeaturedBlogCard.js';
import BlogDetailView from './blog/BlogDetailView.js';
import BlogSidebar from './blog/BlogSidebar.js';
import ContentUnavailable from './ContentUnavailable.js';
import Breadcrumbs from './ui/Breadcrumbs.js';
import TrustBadge from './ui/TrustBadge.js';

interface BlogsViewProps {
  blogs: Blog[];
  blogCategories?: BlogCategory[];
  updateBlogs?: (blogs: Blog[]) => void;
  refetchBlogs?: () => Promise<Blog[]>;
  selectedBlogId?: string | null;
  onSelectBlogId?: (id: string | null) => void;
  onCloseBlog?: () => void;
  services?: Service[];
  onSelectService?: (serviceId: string) => void;
  setView?: (view: string) => void;
}

export default function BlogsView({
  blogs,
  blogCategories = [],
  updateBlogs,
  refetchBlogs,
  selectedBlogId,
  onSelectBlogId,
  onCloseBlog,
  services = [],
  onSelectService,
  setView
}: BlogsViewProps) {
  const [selectedBlog, setSelectedBlog] = useState<Blog | null>(() => {
    if (!selectedBlogId) return null;
    return blogs.find(b => (b.slug && b.slug.toLowerCase() === selectedBlogId.toLowerCase()) || b.id === selectedBlogId) || null;
  });

  // Revalidate authoritative blogs on mount
  useEffect(() => {
    refetchBlogs?.();
  }, [refetchBlogs]);

  // Real-time synchronization for blog updates / deletions
  useEffect(() => {
    const handleUpdate = (e: any) => {
      refetchBlogs?.();
      if (e.detail?.action === 'delete' && selectedBlog) {
        if (selectedBlog.id === e.detail.id || selectedBlog.slug === e.detail.id) {
          setSelectedBlog(null);
          onCloseBlog?.();
        }
      }
    };
    window.addEventListener('easydesk_blogs_updated', handleUpdate);
    return () => window.removeEventListener('easydesk_blogs_updated', handleUpdate);
  }, [selectedBlog, onCloseBlog, refetchBlogs]);

  // Re-sync if selectedBlogId changes from outside (e.g. popstate / Back button or initial async load)
  useEffect(() => {
    if (!selectedBlogId) {
      setSelectedBlog(null);
      return;
    }

    const localMatch = blogs.find(
      b => (b.slug && b.slug.toLowerCase() === selectedBlogId.toLowerCase()) || b.id === selectedBlogId
    );

    if (localMatch) {
      const st = String(localMatch.status || 'published').toLowerCase().trim();
      if (st === 'published' || st === 'active') {
        setSelectedBlog(localMatch);
      } else {
        setSelectedBlog(null);
      }
    } else {
      // If not yet in local blogs, query live API to ensure fresh routing
      let isMounted = true;
      fetch(`/api/blogs/${encodeURIComponent(selectedBlogId)}?_t=${Date.now()}`)
        .then(res => res.ok ? res.json() : null)
        .then(liveBlog => {
          if (!isMounted) return;
          if (liveBlog && liveBlog.id) {
            const st = String(liveBlog.status || 'published').toLowerCase().trim();
            if (st === 'published' || st === 'active') {
              setSelectedBlog(liveBlog);
              if (updateBlogs) {
                updateBlogs([liveBlog, ...blogs.filter(b => b.id !== liveBlog.id)]);
              }
            } else {
              setSelectedBlog(null);
            }
          } else {
            setSelectedBlog(null);
          }
        })
        .catch(() => {
          if (isMounted) setSelectedBlog(null);
        });
      return () => { isMounted = false; };
    }
  }, [selectedBlogId, blogs, updateBlogs]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest'>('latest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Reset scroll on selecting/deselecting blog or changing category
  useScrollToTopOnChange([selectedBlog, selectedCategory]);

  // Only display active categories on the public page
  const activeBlogCategories = useMemo(() => {
    return blogCategories.filter(c => (c.status || 'Active') === 'Active');
  }, [blogCategories]);

  // Filter only published/active blogs for the public view
  const publicBlogs = useMemo(() => {
    return blogs.filter(b => {
      const st = String(b.status || 'published').toLowerCase().trim();
      return st === 'published' || st === 'active';
    });
  }, [blogs]);

  // Helper to resolve category information
  const resolveBlogCategory = (blog: Blog) => {
    const matched = blogCategories.find(
      c => c.id === blog.categoryId || c.name.toLowerCase() === (blog.category || '').toLowerCase()
    );
    return {
      id: matched ? matched.id : (blog.categoryId || 'other'),
      name: matched ? matched.name : (blog.category || 'Government Services')
    };
  };

  // Dynamic category list (WITHOUT NUMBERS / COUNTS)
  const categoryFilters = useMemo(() => {
    const list: { id: string; name: string }[] = [
      { id: 'all', name: 'All' }
    ];

    if (activeBlogCategories.length > 0) {
      activeBlogCategories.forEach(cat => {
        list.push({
          id: cat.id,
          name: cat.name
        });
      });
    } else {
      // Fallback to distinct category names in public blogs
      const names: string[] = Array.from(new Set(publicBlogs.map(b => resolveBlogCategory(b).name)));
      names.forEach((name: string) => {
        list.push({
          id: name,
          name
        });
      });
    }

    return list;
  }, [activeBlogCategories, publicBlogs, blogCategories]);

  // Filtered & Sorted Blogs based on Category, Search & Sort
  const filteredAndSortedBlogs = useMemo(() => {
    let result = publicBlogs.filter(blog => {
      const res = resolveBlogCategory(blog);
      const matchesCategory =
        selectedCategory === 'all' ||
        blog.categoryId === selectedCategory ||
        res.id === selectedCategory ||
        res.name.toLowerCase() === selectedCategory.toLowerCase();

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        blog.title.toLowerCase().includes(q) ||
        (blog.content && blog.content.toLowerCase().includes(q)) ||
        (blog.excerpt && blog.excerpt.toLowerCase().includes(q)) ||
        (blog.shortDescription && blog.shortDescription.toLowerCase().includes(q)) ||
        res.name.toLowerCase().includes(q) ||
        (blog.author && blog.author.toLowerCase().includes(q)) ||
        (blog.tags && blog.tags.some(t => t.toLowerCase().includes(q)));

      return matchesCategory && matchesSearch;
    });

    // Apply sorting
    result.sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0).getTime();
      const dateB = new Date(b.date || b.createdAt || 0).getTime();
      return sortBy === 'latest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [publicBlogs, selectedCategory, searchQuery, sortBy, blogCategories]);

  // Determine Featured Article (prefer blog marked featured, or fallback to first blog when browsing all with no search)
  const featuredBlog = useMemo(() => {
    if (selectedCategory !== 'all' || searchQuery.trim() !== '') {
      return null;
    }
    const explicitlyFeatured = publicBlogs.find(b => b.featured === true);
    if (explicitlyFeatured) return explicitlyFeatured;
    return publicBlogs.length > 0 ? publicBlogs[0] : null;
  }, [publicBlogs, selectedCategory, searchQuery]);

  // Grid blogs (omit featured article from grid if featured is visible)
  const gridBlogs = useMemo(() => {
    if (featuredBlog && filteredAndSortedBlogs.length > 0 && filteredAndSortedBlogs.some(b => b.id === featuredBlog.id)) {
      return filteredAndSortedBlogs.filter(b => b.id !== featuredBlog.id);
    }
    return filteredAndSortedBlogs;
  }, [filteredAndSortedBlogs, featuredBlog]);

  const handleSelectBlog = (blog: Blog) => {
    // Increment view count locally
    const updatedBlog = { ...blog, views: (blog.views || 0) + 1 };
    setSelectedBlog(updatedBlog);
    const identifier = blog.slug || blog.id;
    if (onSelectBlogId) {
      onSelectBlogId(identifier);
    }

    if (updateBlogs) {
      const updatedBlogs = blogs.map(b => b.id === blog.id ? updatedBlog : b);
      updateBlogs(updatedBlogs);
    }
  };

  // -----------------------------------------------------------------
  // DETAIL VIEW
  // -----------------------------------------------------------------
  if (selectedBlog) {
    return (
      <BlogDetailView
        blog={selectedBlog}
        blogs={publicBlogs}
        blogCategories={blogCategories}
        onBack={() => {
          setSelectedBlog(null);
          if (onCloseBlog) {
            onCloseBlog();
          } else if (onSelectBlogId) {
            onSelectBlogId(null);
          }
        }}
        onSelectCategory={(catId) => {
          setSelectedCategory(catId);
          setSelectedBlog(null);
          if (onCloseBlog) {
            onCloseBlog();
          } else if (onSelectBlogId) {
            onSelectBlogId(null);
          }
        }}
        onSelectBlog={handleSelectBlog}
        updateBlogs={updateBlogs}
        services={services}
        onSelectService={onSelectService}
      />
    );
  }

  // If a specific blog ID was requested but not found in published blogs
  if (selectedBlogId && !selectedBlog) {
    return (
      <div id="easydesk-blog-not-found" className="min-h-[70vh] bg-[#F8FAFC] py-20 px-4 font-sans text-slate-900 flex items-center justify-center">
        <div className="max-w-md w-full bg-white border border-slate-200/80 rounded-3xl p-8 text-center shadow-xs space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200/70 flex items-center justify-center text-amber-600">
            <FileText className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-black text-slate-900">Article Not Found</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              This blog article or guide has been removed, unpublished, or is no longer available.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onCloseBlog) {
                onCloseBlog();
              } else if (onSelectBlogId) {
                onSelectBlogId(null);
              }
            }}
            className="w-full bg-[#0F4C81] hover:bg-[#0b3b64] text-white font-bold text-xs py-3 px-4 rounded-xl transition cursor-pointer shadow-xs"
          >
            Browse All Knowledge Hub Guides
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------
  // MAIN BLOGS & KNOWLEDGE HUB DIRECTORY
  // -----------------------------------------------------------------
  return (
    <div id="easydesk-blogs-view" className="min-h-screen bg-[#F8FAFC] pb-24 font-sans text-slate-900 w-full max-w-full overflow-x-hidden">

      {/* 1. HERO SECTION (Matching AboutUs Gradient Banner & Micro Metrics) */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/70 via-slate-50 to-white py-12 sm:py-16 border-b border-slate-200/60">

        {/* Subtle Decorative Background Blur */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full portal-container h-full pointer-events-none overflow-hidden opacity-60">
          <div className="absolute -top-24 -left-20 w-80 h-80 bg-blue-200/40 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -right-20 w-72 h-72 bg-emerald-200/30 rounded-full blur-3xl" />
        </div>

        <div className="portal-container relative z-10 space-y-6">
          <Breadcrumbs items={[{ label: 'Knowledge Hub', active: true }]} />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-3xl space-y-4"
          >

            {/* Top Badge */}
            <div>
              <TrustBadge title="E-Governance & Knowledge Hub" variant="pill" />
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
              My EasyDesk <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0F4C81] via-blue-600 to-teal-600">Knowledge Hub</span> & Guides
            </h1>

            {/* Description */}
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal max-w-2xl">
              Your trusted source for government schemes, document prerequisites, filing procedures, and important compliance deadline updates.
            </p>

            {/* Search Article Input */}
            <div className="pt-2 max-w-xl">
              <div className="relative bg-white rounded-2xl shadow-md border border-slate-200/80 p-1.5 flex items-center hover-glow-blue transition-all duration-300">
                <Search className="w-4 h-4 text-slate-400 ml-3 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search filing guides, PAN, GST, Passport rules..."
                  className="w-full text-xs sm:text-sm text-slate-900 bg-transparent pl-3 pr-8 py-2 outline-none font-medium placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3.5 text-xs text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

          </motion.div>

          {/* 4 Trust Highlights Cards (Matching AboutUs Trust Cards) */}
          <div className="pt-4 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3.5 shadow-xs hover-lift-sm hover-glow-blue transition-all">
              <div className="w-9 h-9 rounded-2xl bg-blue-50 text-[#0F4C81] border border-blue-100 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <Lock className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-black text-slate-900 m-0">Verified Information</h4>
                <p className="text-[11px] text-slate-500 leading-snug m-0 font-normal">Fact-checked against official department circulars.</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3.5 shadow-xs hover-lift-sm hover-glow-blue transition-all">
              <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <Headphones className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-black text-slate-900 m-0">Desk Support</h4>
                <p className="text-[11px] text-slate-500 leading-snug m-0 font-normal">Get practical assistance when filing documents.</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3.5 shadow-xs hover-lift-sm hover-glow-blue transition-all">
              <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <Zap className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-black text-slate-900 m-0">Simplified Steps</h4>
                <p className="text-[11px] text-slate-500 leading-snug m-0 font-normal">Step-by-step checklist with zero confusing jargon.</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3.5 shadow-xs hover-lift-sm hover-glow-blue transition-all">
              <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-black text-slate-900 m-0">Zero Queue</h4>
                <p className="text-[11px] text-slate-500 leading-snug m-0 font-normal">Fast-track processing directly on WhatsApp.</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 2. DYNAMIC CATEGORY NAVIGATION BAR (STICKY, WITHOUT COUNTS) */}
      <section className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-16 z-30 shadow-2xs">
        <div className="portal-container py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Category Pills Bar (No Numbers) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0 flex-1">
            {categoryFilters.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 hover-scale-sm ${
                    isSelected
                      ? 'bg-[#0F4C81] text-white shadow-sm btn-glow-primary'
                      : 'bg-slate-100/80 text-slate-700 hover:bg-blue-50/70 hover:text-[#0F4C81]'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>

          {/* Controls: View Mode Switch & Sort Dropdown */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-[#0F4C81] shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Grid View"
                aria-label="Switch to Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  viewMode === 'list' ? 'bg-white text-[#0F4C81] shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="List View"
                aria-label="Switch to List View"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">List</span>
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'latest' | 'oldest')}
                aria-label="Sort guides by date"
                className="bg-slate-100/80 hover:bg-slate-200/80 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-xl outline-none cursor-pointer border border-transparent focus:border-slate-300"
              >
                <option value="latest">Latest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* 3. MAIN CONTENT CONTAINER */}
      <main className="portal-container pt-8 space-y-8">

        {/* Active Filter Indicator & Results Info */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2 flex-wrap">
            <span>Showing <strong className="text-slate-900">{filteredAndSortedBlogs.length}</strong> {filteredAndSortedBlogs.length === 1 ? 'guide' : 'guides'}</span>
            {selectedCategory !== 'all' && (
              <span className="badge-soft-primary font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
                {categoryFilters.find(c => c.id === selectedCategory)?.name || selectedCategory}
              </span>
            )}
            {searchQuery && (
              <span className="badge-soft-warning font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
                Matching "{searchQuery}"
              </span>
            )}
          </div>

          {(selectedCategory !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="text-xs font-black text-[#0F4C81] hover:underline cursor-pointer"
            >
              Reset All Filters
            </button>
          )}
        </div>

        {/* 4. FEATURED ARTICLE SECTION (When on All without active search query) */}
        {featuredBlog && (
          <section className="space-y-3">
            <FeaturedBlogCard
              blog={featuredBlog}
              blogCategories={blogCategories}
              onSelect={handleSelectBlog}
            />
          </section>
        )}

        {/* 5. ARTICLES & SIDEBAR LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* LEFT/CENTER: Article Cards Grid (8 of 12 cols on desktop) */}
          <div className="lg:col-span-8 space-y-6">
            {publicBlogs.length === 0 && !searchQuery ? (
              <ContentUnavailable
                id="blogs-unavailable-state"
                statusCode={404}
                title="Knowledge Hub Articles Unavailable"
                message="Filing guides and articles are currently being synchronized or updated. Please check back shortly or connect with our desk on WhatsApp."
                primaryActionText="Reset Category Filter"
                onPrimaryAction={() => setSelectedCategory('all')}
              />
            ) : filteredAndSortedBlogs.length === 0 ? (
              /* Professional Empty State */
              <div className="bg-white border border-slate-200/90 rounded-3xl p-12 text-center shadow-xs space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#0F4C81] border border-blue-100 flex items-center justify-center mx-auto shadow-2xs">
                  <BookOpen className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">No Guides Found</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-md mx-auto font-normal">
                    We couldn't find any guides matching your search criteria. Try different keywords or browse our categories.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
                  }}
                  className="bg-[#0F4C81] hover:bg-[#0b3b64] text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition cursor-pointer btn-glow-primary hover-scale-sm"
                >
                  Browse All Guides
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    {selectedCategory === 'all' && !searchQuery ? 'All Filing Guides & Articles' : 'Matching Guides'}
                  </h2>
                  <span className="text-xs text-slate-400 font-medium">
                    Showing in {viewMode === 'grid' ? 'Grid' : 'List'} mode
                  </span>
                </div>

                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {gridBlogs.map((blog) => (
                      <BlogCard
                        key={blog.id}
                        blog={blog}
                        blogCategories={blogCategories}
                        onSelect={handleSelectBlog}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {gridBlogs.map((blog) => {
                      const matchedCat = blogCategories.find(
                        c => c.id === blog.categoryId || c.name.toLowerCase() === (blog.category || '').toLowerCase()
                      );
                      const catName = matchedCat ? matchedCat.name : (blog.category || 'Government Services');
                      const wordCount = (blog.content || '').trim().split(/\s+/).length;
                      const readTime = Math.max(2, Math.ceil(wordCount / 180));
                      const fmtDate = blog.date 
                        ? new Date(blog.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : (blog.createdAt ? new Date(blog.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent Guide');
                      const rawExcerpt = blog.content ? blog.content.replace(/^[#>\s*-]+/gm, '').trim() : '';
                      const excerpt = rawExcerpt.slice(0, 160) + (rawExcerpt.length > 160 ? '...' : '');

                      return (
                        <article
                          key={blog.id}
                          onClick={() => handleSelectBlog(blog)}
                          className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs hover-lift hover-glow-blue transition-all duration-300 flex flex-col sm:flex-row items-start gap-4 sm:gap-5 cursor-pointer group"
                        >
                          {/* Left: Thumbnail Image with Category Badge */}
                          <div className="relative w-full sm:w-48 h-36 sm:h-32 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                            {blog.image ? (
                              <img
                                src={blog.image}
                                alt={blog.title}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-[#0B2545] to-[#0F4C81] text-white p-3 text-center">
                                <FileText className="w-6 h-6 text-cyan-300 mb-1" />
                                <span className="text-[9px] font-mono tracking-wider uppercase text-cyan-200 font-bold">
                                  EASYDESK GUIDE
                                </span>
                              </div>
                            )}
                            <div className="absolute top-2 left-2">
                              <span className="bg-slate-900/90 text-cyan-300 border border-white/20 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs">
                                {catName}
                              </span>
                            </div>
                          </div>

                          {/* Right: Content & Metadata */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between h-full space-y-2">
                            <div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{fmtDate}</span>
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{readTime} min read</span>
                                </span>
                                {blog.author && (
                                  <>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-slate-600 truncate">{blog.author}</span>
                                  </>
                                )}
                              </div>

                              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug group-hover:text-[#0F4C81] transition-colors mt-1 line-clamp-2">
                                {blog.title}
                              </h3>

                              <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mt-1 font-normal">
                                {excerpt}
                              </p>
                            </div>

                            <div className="pt-2 flex items-center justify-between border-t border-slate-100/80">
                              <span className="text-[11px] font-mono text-slate-400">
                                {blog.views ? `${blog.views.toLocaleString()} reads` : 'Official Guide'}
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs font-black text-[#0F4C81] group-hover:text-blue-700 transition-all">
                                <span>Read Full Guide</span>
                                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                              </span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Blog Sidebar (4 of 12 cols on desktop) */}
          <div className="lg:col-span-4">
            <BlogSidebar
              categories={activeBlogCategories}
              selectedCategory={selectedCategory}
              onSelectCategory={(catId) => {
                setSelectedCategory(catId);
                setSearchQuery('');
              }}
            />
          </div>

        </div>

        {/* 6. WHATSAPP ASSISTANCE FOOTER BANNER (Matching AboutUs Aesthetic) */}
        <section className="bg-gradient-to-br from-[#0F4C81] to-[#0A3258] text-white rounded-3xl p-8 sm:p-10 shadow-xl border border-blue-900/40 flex flex-col md:flex-row items-center justify-between gap-6 hover-glow-blue transition-all duration-300">
          <div className="space-y-2 text-center md:text-left max-w-xl">
            <div className="inline-flex items-center gap-1.5 bg-white/10 text-cyan-300 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-white/15">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-300" />
              Verified Desk Support
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight m-0">
              Need personalized document filing guidance?
            </h3>
            <p className="text-xs text-blue-100/90 leading-relaxed font-normal m-0">
              Our verified filing officers review your documents, clarify prerequisites, and coordinate your official submissions directly on WhatsApp.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              onClick={() => openGeneralWhatsApp('Hello EasyDesk, I was reading your blog and need assistance with a service.')}
              className="bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-xs px-6 py-3.5 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 active:scale-95 btn-glow-emerald hover-scale-sm"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat on WhatsApp</span>
            </button>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('easydesk-ai-contextual-help', {
                  detail: { customPrompt: "Hello! Please summarize the latest government certificate filing updates.", autoSend: true }
                }));
              }}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs px-5 py-3.5 rounded-xl transition cursor-pointer flex items-center gap-2 hover-scale-sm"
            >
              <Bot className="w-4 h-4 text-cyan-300" /> Consult AI
            </button>
          </div>
        </section>

      </main>

    </div>
  );
}

