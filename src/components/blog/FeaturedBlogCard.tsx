import React, { useState, memo } from 'react';
import { Sparkles, Calendar, Clock, ArrowRight, FileText, User } from 'lucide-react';
import { Blog, BlogCategory } from '../../types.js';

interface FeaturedBlogCardProps {
  key?: React.Key;
  blog: Blog;
  blogCategories?: BlogCategory[];
  onSelect: (blog: Blog) => void;
}

function FeaturedBlogCard({ blog, blogCategories = [], onSelect }: FeaturedBlogCardProps) {
  const [imageError, setImageError] = useState(false);

  // Resolve category name
  const matchedCat = blogCategories.find(
    c => c.id === blog.categoryId || c.name.toLowerCase() === (blog.category || '').toLowerCase()
  );
  const categoryName = matchedCat ? matchedCat.name : (blog.category || 'Government Services');

  // Reading time based on word count
  const wordCount = (blog.content || '').trim().split(/\s+/).length;
  const readingTime = Math.max(2, Math.ceil(wordCount / 180));

  // Date
  const formattedDate = blog.date 
    ? new Date(blog.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : (blog.createdAt ? new Date(blog.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent Guide');

  // Excerpt
  const rawExcerpt = blog.content ? blog.content.replace(/^[#>\s*-]+/gm, '').trim() : '';
  const excerpt = rawExcerpt.slice(0, 240) + (rawExcerpt.length > 240 ? '...' : '');

  return (
    <div
      onClick={() => onSelect(blog)}
      className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm hover-lift hover-glow-blue transition-all duration-300 overflow-hidden cursor-pointer group"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* LEFT: 16:9 / Responsive Thumbnail Area */}
        <div className="lg:col-span-5 relative bg-slate-100 overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-100 min-h-[220px]">
          {blog.image && !imageError ? (
            <img
              src={blog.image}
              alt={blog.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full min-h-[220px] flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-[#0B2545] to-[#0F4C81] text-white p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-2 shadow-xs floating-icon-bounce">
                <FileText className="w-6 h-6 text-cyan-300" />
              </div>
              <span className="text-xs font-mono tracking-widest uppercase text-cyan-200 font-bold">
                EASYDESK FEATURED GUIDE
              </span>
            </div>
          )}

          {/* Category Pill Tag Overlay */}
          <div className="absolute top-0 left-0 m-3 z-10">
            <span className="bg-slate-900/90 text-cyan-300 border border-white/20 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
              {categoryName}
            </span>
          </div>
        </div>

        {/* RIGHT: Content Column */}
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            {/* Eyebrow badge */}
            <div className="flex items-center gap-2">
              <span className="badge-soft-primary rounded-full text-[11px] font-black uppercase tracking-wider px-3 py-1 shadow-2xs inline-flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#0F4C81]" /> Featured Guide
              </span>
            </div>

            {/* Title */}
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-950 leading-tight tracking-tight group-hover:text-[#0F4C81] transition-colors m-0">
              {blog.title}
            </h2>

            {/* Excerpt */}
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal m-0">
              {excerpt}
            </p>
          </div>

          {/* Metadata & CTA Bar */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{formattedDate}</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{readingTime} min read</span>
              </span>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-2 bg-[#0F4C81] hover:bg-[#0b3b64] text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer btn-glow-primary hover-scale-sm"
            >
              <span>Read Guide</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(FeaturedBlogCard);
