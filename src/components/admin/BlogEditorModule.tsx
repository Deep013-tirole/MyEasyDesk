import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Check, 
  Save, 
  Trash2, 
  Plus, 
  Globe, 
  Clock, 
  FileText, 
  AlertCircle, 
  MessageSquare, 
  Tag as TagIcon,
  User,
  Calendar,
  FolderOpen,
  Eye,
  Send
} from 'lucide-react';
import { Blog, BlogCategory } from '../../types';
import { RichFormattingEditor } from './RichFormattingEditor';
import { ImageUploadCard } from './ImageUploadCard';

interface BlogEditorModuleProps {
  initialBlog?: Partial<Blog> | null;
  categories: BlogCategory[];
  currentUserName?: string;
  onSave: (blogData: any, isDraft: boolean) => Promise<boolean | void>;
  onCancel: () => void;
  onNavigateToCategories?: () => void;
}

const SUGGESTED_TAGS = [
  'PAN Card',
  'Aadhaar Update',
  'Income Tax Filing',
  'Government Schemes',
  'Passport Services',
  'Voter ID',
  'Business Registration',
  'MSME Udyam'
];

export const BlogEditorModule: React.FC<BlogEditorModuleProps> = ({
  initialBlog,
  categories = [],
  currentUserName = 'Desk Editorial Team',
  onSave,
  onCancel,
  onNavigateToCategories
}) => {
  const isEditing = !!initialBlog?.id;

  // Form State
  const [title, setTitle] = useState(initialBlog?.title || '');
  const [categoryId, setCategoryId] = useState(
    initialBlog?.categoryId || 
    (categories.find(c => (c.status || 'Active') === 'Active')?.id || categories[0]?.id || '')
  );
  const [author, setAuthor] = useState(initialBlog?.author || currentUserName);
  const [excerpt, setExcerpt] = useState(initialBlog?.excerpt || initialBlog?.shortDescription || (initialBlog?.content ? initialBlog.content.slice(0, 160) : ''));
  const [content, setContent] = useState(initialBlog?.content || '');
  const [imageUrl, setImageUrl] = useState(initialBlog?.imageUrl || initialBlog?.image || 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=400');
  
  // Tags State
  const [tags, setTags] = useState<string[]>(
    Array.isArray(initialBlog?.tags) 
      ? initialBlog.tags 
      : (typeof initialBlog?.tags === 'string' ? (initialBlog.tags as string).split(',').map(t => t.trim()).filter(Boolean) : ['Government Schemes', 'Guide'])
  );
  const [tagInput, setTagInput] = useState('');

  // SEO State
  const [slug, setSlug] = useState(initialBlog?.slug || '');
  const [isCustomSlug, setIsCustomSlug] = useState(false);
  const [seoTitle, setSeoTitle] = useState(initialBlog?.seoTitle || '');
  const [seoDescription, setSeoDescription] = useState(initialBlog?.seoDescription || '');
  const [focusKeywords, setFocusKeywords] = useState(initialBlog?.focusKeywords || '');

  // Publishing & Timing
  const [status, setStatus] = useState<string>(initialBlog?.status || 'published');
  const [publishDate, setPublishDate] = useState(
    initialBlog?.date ? new Date(initialBlog.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [scheduledAt, setScheduledAt] = useState(initialBlog?.scheduledAt || '');
  const [commentsEnabled, setCommentsEnabled] = useState<boolean>(initialBlog?.commentsEnabled !== false);
  const [featured, setFeatured] = useState<boolean>(!!initialBlog?.featured);

  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Synchronize form state on initialBlog or categories prop change
  useEffect(() => {
    if (initialBlog) {
      setTitle(initialBlog.title || '');
      const matchedCat = categories.find(c => c.id === initialBlog.categoryId || c.name.toLowerCase() === (initialBlog.category || '').toLowerCase());
      setCategoryId(initialBlog.categoryId || matchedCat?.id || (categories.find(c => (c.status || 'Active') === 'Active')?.id || categories[0]?.id || ''));
      setAuthor(initialBlog.author || currentUserName);
      setExcerpt(initialBlog.excerpt || initialBlog.shortDescription || (initialBlog.content ? initialBlog.content.slice(0, 160) : ''));
      setContent(initialBlog.content || '');
      setImageUrl(initialBlog.imageUrl || initialBlog.image || 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=400');
      setTags(
        Array.isArray(initialBlog.tags) 
          ? initialBlog.tags 
          : (typeof initialBlog.tags === 'string' ? (initialBlog.tags as string).split(',').map(t => t.trim()).filter(Boolean) : ['Government Schemes', 'Guide'])
      );
      setSlug(initialBlog.slug || '');
      setIsCustomSlug(!!initialBlog.slug);
      setSeoTitle(initialBlog.seoTitle || '');
      setSeoDescription(initialBlog.seoDescription || '');
      setFocusKeywords(initialBlog.focusKeywords || '');
      setStatus(initialBlog.status || 'published');
      setPublishDate(initialBlog.date ? new Date(initialBlog.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
      setScheduledAt(initialBlog.scheduledAt || '');
      setCommentsEnabled(initialBlog.commentsEnabled !== false);
      setFeatured(!!initialBlog.featured);
    } else {
      // Clean slate for new blog post
      setTitle('');
      setCategoryId(categories.find(c => (c.status || 'Active') === 'Active')?.id || categories[0]?.id || '');
      setAuthor(currentUserName);
      setExcerpt('');
      setContent('');
      setImageUrl('https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=400');
      setTags(['Government Schemes', 'Guide']);
      setSlug('');
      setIsCustomSlug(false);
      setSeoTitle('');
      setSeoDescription('');
      setFocusKeywords('');
      setStatus('published');
      setPublishDate(new Date().toISOString().slice(0, 10));
      setScheduledAt('');
      setCommentsEnabled(true);
      setFeatured(false);
    }
    setIsDirty(false);
  }, [initialBlog, categories, currentUserName]);

  // Auto-generate slug from title
  useEffect(() => {
    if (!isCustomSlug && title) {
      const generated = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      setSlug(generated);
    }
  }, [title, isCustomSlug]);

  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };

  // Estimated Read Time Calculation
  const estimatedReadTime = useMemo(() => {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const minutes = Math.max(1, Math.ceil(words / 180));
    return `${minutes} min read`;
  }, [content]);

  // Selected Category
  const selectedCategory = useMemo(() => {
    return categories.find(c => c.id === categoryId || c.name.toLowerCase() === (initialBlog?.category || '').toLowerCase());
  }, [categories, categoryId, initialBlog?.category]);

  // Tags Handlers
  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
      markDirty();
    }
  };

  const handleRemoveTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
    markDirty();
  };

  // Validation
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!title.trim()) {
      newErrors.title = 'Article title is required';
    } else if (title.trim().length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
    }

    if (!categoryId) {
      newErrors.categoryId = 'Please select a blog category';
    }

    if (!content.trim()) {
      newErrors.content = 'Article body content is required';
    } else if (content.trim().length < 30) {
      newErrors.content = 'Article content is too short (min 30 characters)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e?: React.FormEvent, forceDraft: boolean = false) => {
    if (e) e.preventDefault();

    if (!forceDraft && !validateForm()) {
      setToast({ type: 'error', message: 'Please complete all required fields indicated in red.' });
      return;
    }

    setIsSubmitting(true);
    setToast(null);

    const finalStatus = forceDraft ? 'draft' : (status || 'published');
    const categoryObj = categories.find(c => c.id === categoryId);
    const categoryName = categoryObj ? categoryObj.name : (initialBlog?.category || 'Government Schemes');

    const blogPayload: Partial<Blog> = {
      id: initialBlog?.id || `blog-${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      excerpt: excerpt.trim() || content.trim().slice(0, 160),
      shortDescription: excerpt.trim() || content.trim().slice(0, 160),
      categoryId: categoryId || categoryObj?.id || 'blog-cat-gov',
      category: categoryName,
      tags: tags,
      image: imageUrl,
      imageUrl: imageUrl,
      author: author.trim() || 'EasyDesk Editorial Team',
      date: publishDate ? new Date(publishDate).toISOString() : new Date().toISOString(),
      readTime: estimatedReadTime,
      scheduledAt: status === 'scheduled' ? scheduledAt : undefined,
      seoTitle: seoTitle.trim() || title.trim(),
      seoDescription: seoDescription.trim() || excerpt.trim() || content.trim().slice(0, 160),
      slug: slug.trim() || undefined,
      focusKeywords: focusKeywords.trim() || undefined,
      commentsEnabled,
      status: finalStatus,
      featured
    };

    try {
      await onSave(blogPayload, forceDraft);
      setIsDirty(false);
      setToast({ type: 'success', message: `Article successfully ${isEditing ? 'updated' : 'published'}!` });
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to save article. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelClick = () => {
    if (isDirty) {
      setShowUnsavedModal(true);
    } else {
      onCancel();
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-24 font-sans text-slate-900 animate-in fade-in duration-150">
      
      {/* 1. Header & Navigation Bar */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleCancelClick}
              className="hover:text-blue-700 transition flex items-center gap-1 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-xl cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to News & Blogs
            </button>
            <span className="text-slate-300 font-bold">/</span>
            <span className="font-extrabold text-slate-900 truncate max-w-xs sm:max-w-md">
              {isEditing ? `Edit: ${initialBlog?.title || 'Article'}` : 'Compose New Article / Guide'}
            </span>
          </div>

          {/* Badges & Metrics */}
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-blue-50 text-[#0F4C81] border border-blue-100 px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1">
              <Clock className="w-3 h-3" /> {estimatedReadTime}
            </span>
            {isDirty && (
              <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Unsaved
              </span>
            )}
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide border ${
              status === 'published' || status === 'active'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : status === 'draft'
                  ? 'bg-slate-100 text-slate-700 border-slate-200'
                  : 'bg-purple-50 text-purple-700 border-purple-200'
            }`}>
              {status}
            </span>
          </div>

        </div>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold shadow-xs ${
            toast.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' : 'bg-red-50 border border-red-200 text-red-900'
          }`}>
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
              <span>{toast.message}</span>
            </div>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-700">✕</button>
          </div>
        </div>
      )}

      {/* 2. Main Content Editor Layout (2 Columns on Desktop) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <form onSubmit={(e) => handleSubmit(e, false)} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: Main Article Body & Content (8 Columns) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Card 1: Article Main Content */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
              
              {/* Article Title */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  Article Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    markDirty();
                  }}
                  placeholder="e.g. Complete Step-by-Step Guide for PAN-Aadhaar Linking Online"
                  className={`w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-bold placeholder-slate-400 focus:outline-none transition ${
                    errors.title ? 'border-red-400 ring-2 ring-red-400/10' : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
                  }`}
                />
                {errors.title && (
                  <p className="text-[11px] font-bold text-red-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" /> {errors.title}
                  </p>
                )}
              </div>

              {/* Excerpt / Summary */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                    Article Summary / Excerpt
                  </label>
                  <span className={`text-[10px] font-bold ${excerpt.length > 160 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {excerpt.length}/160 chars
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={excerpt}
                  onChange={(e) => {
                    setExcerpt(e.target.value);
                    markDirty();
                  }}
                  placeholder="A concise summary displayed on blog index cards and social share previews."
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 leading-relaxed placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Rich Body Content Editor */}
              <div className="pt-2">
                <RichFormattingEditor
                  label="Article Content Body"
                  required
                  value={content}
                  onChange={(val) => {
                    setContent(val);
                    markDirty();
                  }}
                  error={errors.content}
                  placeholder="Write informative guidance, step-by-step instructions, official links, and prerequisites..."
                  helperText="Format using ## Headings, - Bullet lists, 1. Numbered lists, and > [IMPORTANT] notes."
                  minHeight="min-h-[380px]"
                />
              </div>

            </div>

            {/* Card 2: Interactive Tags & Keywords */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#0F4C81] flex items-center justify-center font-bold text-xs">
                    <TagIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm text-slate-900">Tags & Keyword Topics</h2>
                    <p className="text-[11px] text-slate-400">Helps readers discover related articles and enhances internal linking</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-400">{tags.length} tags</span>
              </div>

              {/* Add Tag Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag(tagInput);
                    }
                  }}
                  placeholder="Type tag (e.g. Income Tax) and press Enter..."
                  className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddTag(tagInput)}
                  className="bg-[#0F4C81] hover:bg-blue-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1 cursor-pointer transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Tag
                </button>
              </div>

              {/* Suggestions */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Suggested Topics:</span>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleAddTag(tag)}
                      disabled={tags.includes(tag)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border font-semibold transition cursor-pointer flex items-center gap-1 ${
                        tags.includes(tag)
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-blue-50/50 text-[#0F4C81] border-blue-200 hover:bg-blue-100'
                      }`}
                    >
                      <Plus className="w-2.5 h-2.5" /> {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {tags.map((tag, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-100 text-slate-800 text-xs font-semibold px-3 py-1 rounded-xl flex items-center gap-2 border border-slate-200"
                    >
                      <span>#{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(idx)}
                        className="text-slate-400 hover:text-red-600 transition cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

            </div>

          </div>

          {/* RIGHT COLUMN: Sidebar (Metadata, Cover Image, SEO, Publishing) (4 Columns) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Sidebar Card 1: Category & Author Metadata */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                Article Category & Author
              </h3>

              {/* Category Dropdown */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                    Blog Category <span className="text-red-500">*</span>
                  </label>
                  {onNavigateToCategories && (
                    <button
                      type="button"
                      onClick={onNavigateToCategories}
                      className="text-[10px] font-bold text-[#0F4C81] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <FolderOpen className="w-3 h-3" /> Manage
                    </button>
                  )}
                </div>

                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    markDirty();
                  }}
                  className={`w-full bg-white border rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer ${
                    errors.categoryId ? 'border-red-400' : 'border-slate-200 focus:border-blue-500'
                  }`}
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} {cat.status === 'Inactive' ? '(Inactive)' : ''}
                    </option>
                  ))}
                </select>
                {selectedCategory && (
                  <span className="text-[10px] text-slate-400 block font-medium">
                    ID: <code className="font-mono text-slate-600">{selectedCategory.id}</code>
                  </span>
                )}
              </div>

              {/* Author */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" /> Author / Bylines
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => {
                    setAuthor(e.target.value);
                    markDirty();
                  }}
                  placeholder="e.g. EasyDesk Advisory Team"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Publishing Status & Date */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  Publishing Status
                </label>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    markDirty();
                  }}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="published">Published (Live to Public)</option>
                  <option value="draft">Draft (Private to Admin)</option>
                  <option value="scheduled">Scheduled for Future</option>
                </select>
              </div>

              {/* Date Pickers */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> Article Date
                </label>
                <input
                  type="date"
                  value={publishDate}
                  onChange={(e) => {
                    setPublishDate(e.target.value);
                    markDirty();
                  }}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Scheduled Date/Time if Scheduled */}
              {status === 'scheduled' && (
                <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-3 space-y-1.5 animate-in fade-in duration-150">
                  <label className="text-[10px] font-bold text-purple-900 uppercase block">Schedule Live Time</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => {
                      setScheduledAt(e.target.value);
                      markDirty();
                    }}
                    className="w-full bg-white border border-purple-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                  />
                  <span className="text-[9px] text-purple-700 block">Article will be published automatically at this time.</span>
                </div>
              )}

              {/* Toggles */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commentsEnabled}
                    onChange={(e) => {
                      setCommentsEnabled(e.target.checked);
                      markDirty();
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-700">Allow Reader Comments</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(e) => {
                      setFeatured(e.target.checked);
                      markDirty();
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-700">Feature as Top Guide</span>
                </label>
              </div>

            </div>

            {/* Sidebar Card 2: Cover Image */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                Featured Cover Image
              </h3>
              <ImageUploadCard
                label="Article Header Banner"
                value={imageUrl}
                onChange={(url) => {
                  setImageUrl(url);
                  markDirty();
                }}
                recommendedSize="1200 × 630 px"
                aspectRatioText="16:9 Landscape"
              />
            </div>

            {/* Sidebar Card 3: SEO & Google Search Preview */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Globe className="w-4 h-4 text-[#0F4C81]" />
                <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                  SEO & Search Engine Snippet
                </h3>
              </div>

              {/* URL Slug */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Article Slug</label>
                  <button
                    type="button"
                    onClick={() => setIsCustomSlug(!isCustomSlug)}
                    className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    {isCustomSlug ? 'Auto-generate' : 'Custom'}
                  </button>
                </div>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setIsCustomSlug(true);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                    markDirty();
                  }}
                  placeholder="pan-aadhaar-link-guide"
                  className="w-full bg-slate-50 font-mono text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Focus Keywords */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Focus Keywords</label>
                <input
                  type="text"
                  value={focusKeywords}
                  onChange={(e) => {
                    setFocusKeywords(e.target.value);
                    markDirty();
                  }}
                  placeholder="pan card, aadhaar link, uti, nsdl"
                  className="w-full bg-white text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* SEO Title */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Meta Title</label>
                  <span className="text-[9px] text-slate-400">{(seoTitle || title).length}/60</span>
                </div>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={(e) => {
                    setSeoTitle(e.target.value);
                    markDirty();
                  }}
                  placeholder={title || 'Article meta title...'}
                  className="w-full bg-white text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* SEO Description */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Meta Description</label>
                  <span className="text-[9px] text-slate-400">{(seoDescription || excerpt).length}/160</span>
                </div>
                <textarea
                  rows={2}
                  value={seoDescription}
                  onChange={(e) => {
                    setSeoDescription(e.target.value);
                    markDirty();
                  }}
                  placeholder={excerpt || 'Article meta description...'}
                  className="w-full bg-white text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Google SERP Snippet Preview */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1 text-xs">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Google Search Preview</span>
                <p className="text-[11px] text-[#1a0dab] font-bold truncate">
                  {seoTitle || title || 'Article Title'} | EasyDesk Guides
                </p>
                <p className="text-[9px] text-emerald-800 font-mono truncate">
                  https://easydesk.in/blogs/{slug || 'guide-article'}
                </p>
                <p className="text-[10px] text-slate-600 line-clamp-2 leading-tight">
                  {seoDescription || excerpt || 'Detailed step-by-step guidance, prerequisite documents, and official portal walkthrough by EasyDesk.'}
                </p>
              </div>

            </div>

          </div>

        </form>
      </div>

      {/* 3. Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          
          {/* Cancel */}
          <button
            type="button"
            onClick={handleCancelClick}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel & Exit
          </button>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={(e) => handleSubmit(e, true)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer border border-slate-200 disabled:opacity-50"
            >
              Save as Draft
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={(e) => handleSubmit(e, false)}
              className="px-6 py-2.5 rounded-xl text-xs font-extrabold text-white bg-[#0F4C81] hover:bg-blue-800 transition cursor-pointer shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving Article...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'Update Article' : 'Publish Article'}</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* 4. Unsaved Changes Confirmation Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">Unsaved Article Edits</h3>
              <p className="text-xs text-slate-500 mt-1">
                You have unsaved changes to this article. Leaving now will discard all content written in this session.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUnsavedModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                Continue Composing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedModal(false);
                  onCancel();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer"
              >
                Discard Edits
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
