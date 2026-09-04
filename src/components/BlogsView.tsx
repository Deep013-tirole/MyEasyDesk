import React, { useState, useMemo } from 'react';
import { 
  Search, BookOpen, Layers, MessageSquare, ArrowRight, 
  ShieldCheck, HelpCircle, X, Sparkles, Filter, Newspaper,
  ChevronRight, CheckCircle2, Lock, Headphones, Zap, CheckCircle,
  ArrowUpDown, SlidersHorizontal, FileText, Bot
} from 'lucide-react';
import { motion } from 'motion/react';
import { Blog, BlogCategory } from '../types.js';
import { useScrollToTopOnChange } from '../lib/scrollUtils.js';
import { openGeneralWhatsApp } from '../lib/whatsapp.js';
import BlogCard from './blog/BlogCard.js';
import FeaturedBlogCard from './blog/FeaturedBlogCard.js';
import BlogDetailView from './blog/BlogDetailView.js';
import BlogSidebar from './blog/BlogSidebar.js';
import ContentUnavailable from './ContentUnavailable.js';

interface BlogsViewProps {
  blogs: Blog[];
  blogCategories?: BlogCategory[];
  updateBlogs?: (blogs: Blog[]) => void;
}

export default function BlogsView({ blogs, blogCategories = [], updateBlogs }: BlogsViewProps) {
  const [selectedBlog, setSelectedBlog] = useState<Blog | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest'>('latest');

  // Reset scroll on selecting/deselecting blog or changing category
  useScrollToTopOnChange([selectedBlog, selectedCategory]);

  // Only display active categories on the public page
  const activeBlogCategories = useMemo(() => {
    return blogCategories.filter(c => (c.status || 'Active') === 'Active');
  }, [blogCategories]);

  // Filter only published/active blogs for the public view
  const publicBlogs = useMemo(() => {
    return blogs.filter(b => {
      const st = (b.status || 'active').toLowerCase();
      return st !== 'inactive' && st !== 'draft' && st !== 'deleted';
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
        onBack={() => setSelectedBlog(null)}
        onSelectCategory={(catId) => {
          setSelectedCategory(catId);
          setSelectedBlog(null);
        }}
        onSelectBlog={handleSelectBlog}
        updateBlogs={updateBlogs}
      />
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

        <div className="portal-container relative z-10 space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-3xl space-y-4"
          >
            
            {/* Top Pulse Badge */}
            <div className="inline-flex items-center gap-2 bg-blue-100/90 border border-blue-200/70 px-4 py-1.5 rounded-full text-xs font-black text-[#0F4C81] shadow-2xs pulse-badge">
              <Sparkles className="w-3.5 h-3.5 text-[#0F4C81]" />
              <span>E-Governance & Knowledge Hub</span>
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
              EasyDesk <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0F4C81] via-blue-600 to-teal-600">Knowledge Hub</span> & Guides
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

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 shrink-0 text-xs font-medium text-slate-500">
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
                </div>

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

