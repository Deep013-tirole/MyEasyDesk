import React, { useState } from 'react';
import { 
  ArrowLeft, Calendar, Clock, Tag, MessageSquare, Send, 
  CheckCircle2, AlertTriangle, ShieldCheck, User as UserIcon, 
  FileText, Share2, Check, Bookmark, ChevronRight, Sparkles,
  HelpCircle, Info
} from 'lucide-react';
import { Blog, BlogCategory, BlogComment } from '../../types.js';
import { openGeneralWhatsApp } from '../../lib/whatsapp.js';
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
}

export default function BlogDetailView({
  blog,
  blogs,
  blogCategories,
  onBack,
  onSelectCategory,
  onSelectBlog,
  updateBlogs
}: BlogDetailViewProps) {
  if (!blog) {
    return (
      <ContentUnavailable
        id="blog-detail-not-found"
        statusCode={404}
        title="Article Unavailable"
        message="The requested filing guide or article could not be found or may have been updated."
        primaryActionText="Back to All Guides"
        onPrimaryAction={onBack}
      />
    );
  }

  const [imageError, setImageError] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Comment Form State
  const [newCommentName, setNewCommentName] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [commentSuccess, setCommentSuccess] = useState('');

  // Category resolution
  const matchedCat = blogCategories.find(
    c => c.id === blog.categoryId || c.name.toLowerCase() === (blog.category || '').toLowerCase()
  );
  const categoryName = matchedCat ? matchedCat.name : (blog.category || 'Government Services');
  const categoryId = matchedCat ? matchedCat.id : 'all';

  // Reading time
  const wordCount = (blog.content || '').trim().split(/\s+/).length;
  const readingTime = Math.max(2, Math.ceil(wordCount / 180));

  // Date
  const formattedDate = blog.date 
    ? new Date(blog.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : (blog.createdAt ? new Date(blog.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent Guide');

  // Related Guides: Same category first, excluding current article
  const sameCategoryBlogs = blogs.filter(
    b => b.id !== blog.id && (b.categoryId === blog.categoryId || (b.category || '').toLowerCase() === (blog.category || '').toLowerCase())
  );
  const otherRecentBlogs = blogs.filter(
    b => b.id !== blog.id && !sameCategoryBlogs.some(sc => sc.id === b.id)
  );
  const relatedBlogs = [...sameCategoryBlogs, ...otherRecentBlogs].slice(0, 3);

  // Handle Add Reader Comment
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
      ...blog,
      comments: [...(blog.comments || []), newComment]
    };

    if (updateBlogs) {
      const updatedBlogs = blogs.map(b => b.id === blog.id ? updatedBlog : b);
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
    } catch (e) {
      // Fallback
    }
  };

  // Helper to render formatted article content blocks
  const renderFormattedContent = (content: string) => {
    if (!content) return null;
    return renderRichText(content);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 font-sans text-slate-900 animate-in fade-in duration-150 w-full max-w-full overflow-x-hidden">
      
      {/* 1. Header Navigation & Breadcrumbs Bar */}
      <div className="bg-white border-b border-slate-200/80 sticky top-16 z-30 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 text-xs">
          
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-slate-500 font-medium truncate">
            <button
              onClick={onBack}
              className="hover:text-slate-900 transition flex items-center gap-1 shrink-0 font-bold text-slate-700"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> All Guides
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <button
              onClick={() => {
                onSelectCategory(categoryId);
                onBack();
              }}
              className="hover:text-[#0F4C81] transition font-semibold text-slate-600 truncate"
            >
              {categoryName}
            </button>
          </nav>

          {/* Share Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-slate-700 font-bold text-xs transition cursor-pointer"
              title="Copy Article Link"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Link Copied!</span>
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

      {/* 2. Article Hero & Metadata Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        
        <div className="space-y-4">
          {/* Category Badge & Metadata */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                onSelectCategory(categoryId);
                onBack();
              }}
              className="bg-blue-50 hover:bg-blue-100 text-[#0F4C81] font-black text-xs px-3 py-1 rounded-lg border border-blue-100 uppercase tracking-wider transition cursor-pointer"
            >
              {categoryName}
            </button>

            <span className="text-slate-300">•</span>

            <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> {formattedDate}
            </span>

            <span className="text-slate-300">•</span>

            <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> {readingTime} min read
            </span>
          </div>

          {/* Article Title */}
          <h1 className="text-2xl sm:text-4xl lg:text-4xl font-black text-slate-950 tracking-tight leading-tight">
            {blog.title}
          </h1>

          {/* Author Badge */}
          <div className="flex items-center gap-3 pt-2 pb-1 border-b border-slate-200/80">
            <div className="w-9 h-9 rounded-full bg-[#0F4C81] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
              {(blog.author || 'ED')[0]}
            </div>
            <div>
              <span className="font-bold text-xs sm:text-sm text-slate-900 block leading-none">
                {blog.author || 'Desk Verification Officer'}
              </span>
              <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
                Official EasyDesk E-Governance Knowledge Desk
              </span>
            </div>
          </div>
        </div>

        {/* Hero Cover Image */}
        <div className="w-full aspect-[16/9] max-h-[460px] rounded-3xl bg-slate-100 overflow-hidden border border-slate-200/80 shadow-xs relative">
          {blog.image && !imageError ? (
            <img
              src={blog.image}
              alt={blog.title}
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-[#0B2545] to-[#0F4C81] text-white p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-3">
                <FileText className="w-7 h-7 text-teal-300" />
              </div>
              <span className="text-sm font-mono tracking-widest uppercase text-teal-200">EASYDESK OFFICIAL FILING GUIDE</span>
            </div>
          )}
        </div>

        {/* 3. Core Article Content (Max-width 700-800px for comfortable reading) */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-10 space-y-6">
          
          <div className="prose prose-slate max-w-none space-y-5 text-slate-800">
            {renderFormattedContent(blog.content)}
          </div>

          {/* Highlighted Official Verification Notice Box */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 mt-8">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Document Pre-Audit & Filing Assistance
              </h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              EasyDesk assists citizens, entrepreneurs, and students with document audits, application corrections, and digital submission workflows. Always review the final submission acknowledgment copy for official transaction stamps.
            </p>
          </div>

          {/* Article Tags */}
          {blog.tags && blog.tags.length > 0 && (
            <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1 mr-1">
                <Tag className="w-3.5 h-3.5" /> Topic Tags:
              </span>
              {blog.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1 rounded-lg border border-slate-200/60"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* WhatsApp Direct Assistance Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0B2545] to-[#0F4C81] text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm mt-8">
            <div className="space-y-1 text-center sm:text-left">
              <h4 className="font-extrabold text-sm sm:text-base text-white">Need Help Filing This Service?</h4>
              <p className="text-xs text-blue-100">
                Connect directly with our desk officers on WhatsApp for personalized document assistance.
              </p>
            </div>
            <button
              onClick={() => openGeneralWhatsApp(`Hello EasyDesk, I need assistance regarding the guide: "${blog.title}"`)}
              className="bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-xs px-5 py-3 rounded-xl transition cursor-pointer flex items-center gap-2 shrink-0 shadow-md active:scale-95"
            >
              <MessageSquare className="w-4 h-4" /> Connect on WhatsApp
            </button>
          </div>

        </div>

        {/* 4. Related Guides Section */}
        {relatedBlogs.length > 0 && (
          <div className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-950">Related Guides & Articles</h3>
                <p className="text-xs text-slate-500">More practical digital service guidance in {categoryName}</p>
              </div>
              <button
                onClick={() => {
                  onSelectCategory(categoryId);
                  onBack();
                }}
                className="text-xs font-bold text-[#0F4C81] hover:underline"
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
          </div>
        )}

        {/* 5. Reader Questions & Comments Section */}
        <div className="space-y-6 pt-6">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <h3 className="text-lg font-black text-slate-950 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#0F4C81]" />
              Reader Questions & Discussion ({blog.comments?.length || 0})
            </h3>
          </div>

          {/* Comments List */}
          <div className="space-y-3">
            {(!blog.comments || blog.comments.length === 0) ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-xs text-slate-500">
                <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                No questions or comments yet. Have an inquiry about this service? Post below!
              </div>
            ) : (
              blog.comments.map((comment) => (
                <div key={comment.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-50 text-[#0F4C81] flex items-center justify-center font-bold text-xs border border-blue-100">
                        <UserIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-bold text-xs text-slate-900">{comment.userName}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">{comment.date}</span>
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
              <p className="text-xs text-slate-500 mt-0.5">Ask questions regarding document requirements or share your feedback.</p>
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
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:border-[#0F4C81] focus:ring-1 focus:ring-[#0F4C81] outline-none bg-slate-50/50"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Your Question or Feedback *</label>
                <textarea
                  rows={3}
                  required
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Type your question regarding required documents or processes..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:border-[#0F4C81] focus:ring-1 focus:ring-[#0F4C81] outline-none bg-slate-50/50"
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

        </div>

      </div>

    </div>
  );
}
