import React, { useState, memo } from 'react';
import { Calendar, Clock, ArrowRight, FileText, User } from 'lucide-react';
import { Blog, BlogCategory } from '../../types.js';

interface BlogCardProps {
  key?: React.Key;
  blog: Blog;
  blogCategories?: BlogCategory[];
  onSelect: (blog: Blog) => void;
  compact?: boolean;
}

function BlogCard({ blog, blogCategories = [], onSelect, compact = false }: BlogCardProps) {
  const [imageError, setImageError] = useState(false);

  // Resolve category name
  const matchedCat = blogCategories.find(
    c => c.id === blog.categoryId || c.name.toLowerCase() === (blog.category || '').toLowerCase()
  );
  const categoryName = matchedCat ? matchedCat.name : (blog.category || 'Government Services');

  // Calculate reading time based on word count
  const wordCount = (blog.content || '').trim().split(/\s+/).length;
  const readingTime = Math.max(2, Math.ceil(wordCount / 180));

  // Format date consistently
  const formattedDate = blog.date 
    ? new Date(blog.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : (blog.createdAt ? new Date(blog.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent Guide');

  // Clean excerpt
  const rawExcerpt = blog.content ? blog.content.replace(/^[#>\s*-]+/gm, '').trim() : '';
  const excerpt = rawExcerpt.slice(0, 135) + (rawExcerpt.length > 135 ? '...' : '');

  return (
    <article
      onClick={() => onSelect(blog)}
      className="h-full bg-white rounded-2xl border border-[#E5E7EB] shadow-xs hover-lift hover-glow-blue transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-pointer group"
    >
      <div>
        {/* 16:9 Thumbnail Area with Subtle Overflow & Fallback */}
        <div className="relative w-full aspect-video bg-slate-100 overflow-hidden border-b border-slate-100 shrink-0">
          {blog.image && !imageError ? (
            <img
              src={blog.image}
              alt={blog.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-[#0B2545] to-[#0F4C81] text-white p-5 text-center">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center mb-2 shadow-xs floating-icon-bounce">
                <FileText className="w-5 h-5 text-cyan-300" />
              </div>
              <span className="text-[10px] font-mono tracking-widest uppercase text-cyan-200/90 font-bold">
                EASYDESK GUIDE
              </span>
            </div>
          )}

          {/* Category Pill Tag Overlay */}
          <div className="absolute top-3 left-3 z-10">
            <span className="bg-slate-900/90 text-cyan-300 border border-white/20 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
              {categoryName}
            </span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 space-y-2.5">
          {/* Metadata Row: Date & Reading Time */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{formattedDate}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{readingTime} min read</span>
            </span>
          </div>

          {/* Title */}
          <h3 className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug line-clamp-2 group-hover:text-[#0F4C81] transition-colors m-0">
            {blog.title}
          </h3>

          {/* Short Excerpt */}
          {!compact && (
            <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 font-normal m-0">
              {excerpt}
            </p>
          )}
        </div>
      </div>

      {/* Card Footer CTA Bar */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between mt-auto">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium truncate max-w-[140px]">
          <User className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate">{blog.author || 'Desk Officer'}</span>
        </div>

        <span className="inline-flex items-center gap-1 text-xs font-black text-[#0F4C81] group-hover:text-blue-700 transition-all">
          <span>Read Guide</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </span>
      </div>
    </article>
  );
}

export default memo(BlogCard);
