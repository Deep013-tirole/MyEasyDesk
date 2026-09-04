import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Check, 
  Save, 
  Trash2, 
  Plus, 
  ChevronUp, 
  ChevronDown, 
  MessageCircle, 
  Globe, 
  Clock, 
  FileText, 
  Sparkles, 
  AlertCircle, 
  Info, 
  ShieldCheck, 
  ExternalLink,
  HelpCircle,
  FolderOpen
} from 'lucide-react';
import { Service, ServiceCategory } from '../../types';
import { RichFormattingEditor } from './RichFormattingEditor';
import { ImageUploadCard } from './ImageUploadCard';
import { getWhatsAppNumber } from '../../lib/whatsapp';

interface ServiceEditorModuleProps {
  initialService?: Partial<Service> | null;
  categories: ServiceCategory[];
  onSave: (serviceData: any, isDraft: boolean) => Promise<boolean | void>;
  onCancel: () => void;
  onNavigateToCategories?: () => void;
}

const COMMON_DOCUMENTS = [
  'Aadhaar Card',
  'PAN Card',
  'Passport Size Photograph',
  'Signature Scan',
  'Bank Account Statement / Cancelled Cheque',
  'Address Proof / Electricity Bill',
  'Date of Birth Proof',
  'Voter ID Card'
];

const PRESET_HIGHLIGHTS = [
  '100% Online Document Assistance',
  'Pre-Verification of Documents by Experts',
  'Step-by-Step WhatsApp Guidance',
  'Govt Authorized Portal Filing',
  'Official Acknowledgement Receipt Provided',
  'End-to-End Status Tracking'
];

const TIME_PRESETS = [
  'Same Day (2-4 Hours)',
  '24-48 Hours',
  '2-3 Working Days',
  '3-5 Working Days',
  '7-10 Working Days',
  '10-15 Working Days'
];

export const ServiceEditorModule: React.FC<ServiceEditorModuleProps> = ({
  initialService,
  categories = [],
  onSave,
  onCancel,
  onNavigateToCategories
}) => {
  const isEditing = !!initialService?.id;

  // Form State
  const [title, setTitle] = useState(initialService?.title || '');
  const [categoryId, setCategoryId] = useState(
    initialService?.categoryId || (categories.find(c => (c.status || 'Active') === 'Active')?.id || categories[0]?.id || '')
  );
  const [subCategory, setSubCategory] = useState(initialService?.subCategory || '');
  const [shortDescription, setShortDescription] = useState(initialService?.shortDescription || initialService?.description?.slice(0, 160) || '');
  const [fullDescription, setFullDescription] = useState(initialService?.fullDescription || initialService?.description || '');
  const [imageUrl, setImageUrl] = useState(initialService?.imageUrl || initialService?.bannerImage || initialService?.image || 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400');
  
  // Pricing & Timeline
  const [govFees, setGovFees] = useState<number | string>(initialService?.govFees ?? 0);
  const [serviceCharge, setServiceCharge] = useState<number | string>(initialService?.serviceCharge ?? 0);
  const [processingTime, setProcessingTime] = useState(initialService?.processingTime || initialService?.estimatedTime || '3-5 Working Days');
  const [eligibility, setEligibility] = useState(initialService?.eligibility || 'All eligible Indian citizens and businesses');

  // Documents & Highlights
  const [documents, setDocuments] = useState<string[]>(
    Array.isArray(initialService?.requiredDocuments) 
      ? initialService.requiredDocuments 
      : (typeof initialService?.requiredDocuments === 'string' ? (initialService.requiredDocuments as string).split(',').map(d => d.trim()).filter(Boolean) : [])
  );
  const [docInput, setDocInput] = useState('');

  const [highlights, setHighlights] = useState<string[]>(
    Array.isArray(initialService?.highlights) && initialService.highlights.length > 0
      ? initialService.highlights
      : ['100% Online Document Assistance', 'Pre-Verification of Documents by Experts', 'Step-by-Step WhatsApp Guidance']
  );
  const [highlightInput, setHighlightInput] = useState('');

  // Order Settings (WhatsApp)
  const [whatsAppEnabled, setWhatsAppEnabled] = useState<boolean>(initialService?.whatsAppEnabled !== false);
  const [whatsAppNumber, setWhatsAppNumber] = useState<string>('919876543210');

  // SEO & Slug
  const [slug, setSlug] = useState(initialService?.slug || '');
  const [isCustomSlug, setIsCustomSlug] = useState(false);
  const [seoTitle, setSeoTitle] = useState(initialService?.seoTitle || '');
  const [seoDescription, setSeoDescription] = useState(initialService?.seoDescription || '');

  // Publishing & Status
  const [status, setStatus] = useState<string>(initialService?.status || 'active');
  const [featured, setFeatured] = useState<boolean>(!!initialService?.featured);
  const [popular, setPopular] = useState<boolean>(!!initialService?.popular);

  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Synchronize form when initialService or categories prop changes
  useEffect(() => {
    if (initialService) {
      setTitle(initialService.title || '');
      setCategoryId(initialService.categoryId || (categories.find(c => (c.status || 'Active') === 'Active')?.id || categories[0]?.id || ''));
      setSubCategory(initialService.subCategory || '');
      setShortDescription(initialService.shortDescription || initialService.description?.slice(0, 160) || '');
      setFullDescription(initialService.fullDescription || initialService.description || '');
      setImageUrl(initialService.imageUrl || initialService.bannerImage || initialService.image || 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400');
      setGovFees(initialService.govFees ?? 0);
      setServiceCharge(initialService.serviceCharge ?? 0);
      setProcessingTime(initialService.processingTime || initialService.estimatedTime || '3-5 Working Days');
      setEligibility(initialService.eligibility || 'All eligible Indian citizens and businesses');
      setDocuments(
        Array.isArray(initialService.requiredDocuments)
          ? initialService.requiredDocuments
          : (typeof initialService.requiredDocuments === 'string' ? (initialService.requiredDocuments as string).split(',').map(d => d.trim()).filter(Boolean) : [])
      );
      setHighlights(
        Array.isArray(initialService.highlights) && initialService.highlights.length > 0
          ? initialService.highlights
          : ['100% Online Document Assistance', 'Pre-Verification of Documents by Experts', 'Step-by-Step WhatsApp Guidance']
      );
      setWhatsAppEnabled(initialService.whatsAppEnabled !== false);
      setSlug(initialService.slug || '');
      setIsCustomSlug(!!initialService.slug);
      setSeoTitle(initialService.seoTitle || '');
      setSeoDescription(initialService.seoDescription || '');
      setStatus(initialService.status || 'active');
      setFeatured(!!initialService.featured);
      setPopular(!!initialService.popular);
    } else {
      // Clean slate for new service
      setTitle('');
      setCategoryId(categories.find(c => (c.status || 'Active') === 'Active')?.id || categories[0]?.id || '');
      setSubCategory('');
      setShortDescription('');
      setFullDescription('');
      setImageUrl('https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400');
      setGovFees(0);
      setServiceCharge(0);
      setProcessingTime('3-5 Working Days');
      setEligibility('All eligible Indian citizens and businesses');
      setDocuments(['Aadhaar Card', 'Photograph']);
      setHighlights(['100% Online Document Assistance', 'Pre-Verification of Documents by Experts', 'Step-by-Step WhatsApp Guidance']);
      setWhatsAppEnabled(true);
      setSlug('');
      setIsCustomSlug(false);
      setSeoTitle('');
      setSeoDescription('');
      setStatus('active');
      setFeatured(false);
      setPopular(false);
    }
    setIsDirty(false);
  }, [initialService, categories]);

  // Sync WhatsApp number
  useEffect(() => {
    setWhatsAppNumber(getWhatsAppNumber());
  }, []);

  // Auto-generate slug from title if not custom
  useEffect(() => {
    if (!isCustomSlug && title) {
      const generatedSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      setSlug(generatedSlug);
    }
  }, [title, isCustomSlug]);

  // Mark dirty on changes
  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };

  // Total fees calculation
  const totalPayable = useMemo(() => {
    const gov = parseFloat(String(govFees)) || 0;
    const srv = parseFloat(String(serviceCharge)) || 0;
    return gov + srv;
  }, [govFees, serviceCharge]);

  // Selected Category Object
  const selectedCategory = useMemo(() => {
    return categories.find(c => c.id === categoryId);
  }, [categories, categoryId]);

  // Document management
  const handleAddDocument = (doc: string) => {
    const trimmed = doc.trim();
    if (trimmed && !documents.includes(trimmed)) {
      setDocuments([...documents, trimmed]);
      setDocInput('');
      markDirty();
    }
  };

  const handleRemoveDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
    markDirty();
  };

  // Highlights management
  const handleAddHighlight = (item: string) => {
    const trimmed = item.trim();
    if (trimmed && !highlights.includes(trimmed)) {
      setHighlights([...highlights, trimmed]);
      setHighlightInput('');
      markDirty();
    }
  };

  const handleRemoveHighlight = (index: number) => {
    setHighlights(highlights.filter((_, i) => i !== index));
    markDirty();
  };

  const handleMoveHighlight = (index: number, direction: 'up' | 'down') => {
    const newHighlights = [...highlights];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newHighlights.length) return;
    
    const temp = newHighlights[index];
    newHighlights[index] = newHighlights[targetIndex];
    newHighlights[targetIndex] = temp;
    setHighlights(newHighlights);
    markDirty();
  };

  // Form Validation
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!title.trim()) {
      newErrors.title = 'Service title is required';
    } else if (title.trim().length < 3) {
      newErrors.title = 'Service title must be at least 3 characters';
    }

    if (!categoryId) {
      newErrors.categoryId = 'Please select a category';
    }

    if (!shortDescription.trim()) {
      newErrors.shortDescription = 'Short description is required for catalog previews';
    }

    if (documents.length === 0) {
      newErrors.documents = 'Please list at least one required document (e.g. Aadhaar Card)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save Submission
  const handleSubmit = async (e?: React.FormEvent, forceDraft: boolean = false) => {
    if (e) e.preventDefault();

    if (!forceDraft && !validateForm()) {
      setToast({ type: 'error', message: 'Please complete all required fields indicated in red.' });
      return;
    }

    setIsSubmitting(true);
    setToast(null);

    const finalStatus = forceDraft ? 'draft' : (status || 'active');

    const cleanSlug = slug.trim() || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const servicePayload: Partial<Service> = {
      id: initialService?.id || cleanSlug || `svc-${Date.now()}`,
      title: title.trim(),
      categoryId: categoryId || (categories[0]?.id || ''),
      subCategory: subCategory.trim() || undefined,
      description: shortDescription.trim() || fullDescription.trim(),
      shortDescription: shortDescription.trim() || fullDescription.trim().slice(0, 160),
      fullDescription: fullDescription.trim() || shortDescription.trim(),
      bannerImage: imageUrl,
      imageUrl: imageUrl,
      image: imageUrl,
      govFees: Number(govFees) || 0,
      serviceCharge: Number(serviceCharge) || 0,
      processingTime: processingTime.trim() || '3-5 Working Days',
      estimatedTime: processingTime.trim() || '3-5 Working Days',
      requiredDocuments: documents,
      highlights: highlights,
      eligibility: eligibility.trim() || 'All eligible Indian citizens and businesses',
      whatsAppEnabled,
      seoTitle: seoTitle.trim() || title.trim(),
      seoDescription: seoDescription.trim() || shortDescription.trim(),
      slug: cleanSlug || undefined,
      status: finalStatus,
      featured,
      popular
    };

    try {
      await onSave(servicePayload, forceDraft);
      setIsDirty(false);
      setToast({ type: 'success', message: `Service successfully ${isEditing ? 'updated' : 'created'}!` });
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to save service. Please try again.' });
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
          
          {/* Breadcrumbs & Title */}
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleCancelClick}
              className="hover:text-blue-700 transition flex items-center gap-1 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-xl cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Catalog
            </button>
            <span className="text-slate-300 font-bold">/</span>
            <span className="font-extrabold text-slate-900 truncate max-w-xs sm:max-w-md">
              {isEditing ? `Edit: ${initialService?.title || 'Service'}` : 'Create New Catalog Service'}
            </span>
          </div>

          {/* Header Action Badges */}
          <div className="flex items-center gap-2 text-xs">
            {isDirty && (
              <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Unsaved Changes
              </span>
            )}
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide border ${
              status === 'active' 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : status === 'draft'
                  ? 'bg-slate-100 text-slate-700 border-slate-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {status === 'active' ? 'Published' : status}
            </span>
          </div>

        </div>
      </div>

      {/* Toast Notification Alert */}
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

      {/* Main CMS Layout (2-Column Grid on Desktop, Single on Mobile) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <form onSubmit={(e) => handleSubmit(e, false)} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: Main Content & Core Configuration (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Card 1: Service Information */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#0F4C81] flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm text-slate-900">Service Information</h2>
                    <p className="text-[11px] text-slate-400">Core identifying details shown across catalog cards and headers</p>
                  </div>
                </div>
              </div>

              {/* Service Title */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  Service Name / Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    markDirty();
                  }}
                  placeholder="e.g. New PAN Card Online Application (Form 49A)"
                  className={`w-full bg-white border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold placeholder-slate-400 focus:outline-none transition ${
                    errors.title ? 'border-red-400 ring-2 ring-red-400/10' : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
                  }`}
                />
                {errors.title && (
                  <p className="text-[11px] font-bold text-red-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" /> {errors.title}
                  </p>
                )}
              </div>

              {/* Short Description */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                    Short Description <span className="text-red-500">*</span>
                  </label>
                  <span className={`text-[10px] font-bold ${shortDescription.length > 160 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {shortDescription.length}/160 characters
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={shortDescription}
                  onChange={(e) => {
                    setShortDescription(e.target.value);
                    markDirty();
                  }}
                  placeholder="Brief 1-2 sentence overview summarizing what this service achieves and how EasyDesk assists."
                  className={`w-full bg-white border rounded-xl p-3 text-xs text-slate-800 font-normal leading-relaxed placeholder-slate-400 focus:outline-none transition ${
                    errors.shortDescription ? 'border-red-400 ring-2 ring-red-400/10' : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
                  }`}
                />
                {errors.shortDescription && (
                  <p className="text-[11px] font-bold text-red-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" /> {errors.shortDescription}
                  </p>
                )}
              </div>

              {/* Full Description (Rich Text Formatting Editor) */}
              <div className="pt-2">
                <RichFormattingEditor
                  label="Full Service Description & Guidelines"
                  value={fullDescription}
                  onChange={(val) => {
                    setFullDescription(val);
                    markDirty();
                  }}
                  placeholder="Provide comprehensive details, eligibility steps, government portal procedures, and guidelines..."
                  helperText="Supports Markdown headings (##), bold text (**text**), bullet points (- ), and guidance notes (> [IMPORTANT])."
                  minHeight="min-h-[200px]"
                />
              </div>

            </div>

            {/* Card 2: Pricing & Processing Details */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm text-slate-900">Pricing & Processing Details</h2>
                    <p className="text-[11px] text-slate-400">Specify government challan fees and EasyDesk consultancy charges</p>
                  </div>
                </div>
              </div>

              {/* Fee Breakdown Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* Gov Fees */}
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                    Govt Statutory Fee (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={govFees}
                      onChange={(e) => {
                        setGovFees(e.target.value);
                        markDirty();
                      }}
                      className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                      placeholder="0"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">Official government portal fee</span>
                </div>

                {/* Service Charge */}
                <div className="space-y-1">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                    Advisory / Service Charge (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={serviceCharge}
                      onChange={(e) => {
                        setServiceCharge(e.target.value);
                        markDirty();
                      }}
                      className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                      placeholder="0"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">EasyDesk verification charge</span>
                </div>

                {/* Total Calculated Fee Card */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase">Total User Payable</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-extrabold text-[#0F4C81]">₹{totalPayable}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">(inclusive of all fees)</span>
                  </div>
                  <span className="text-[9px] text-emerald-600 font-bold">✓ 100% transparent fee structure</span>
                </div>

              </div>

              {/* Processing Time & Eligibility */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                
                {/* Processing Time Presets */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Estimated Processing Time
                  </label>
                  <input
                    type="text"
                    value={processingTime}
                    onChange={(e) => {
                      setProcessingTime(e.target.value);
                      markDirty();
                    }}
                    placeholder="e.g. 3-5 Working Days"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                  {/* Presets Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {TIME_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setProcessingTime(preset);
                          markDirty();
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-lg border font-semibold transition cursor-pointer ${
                          processingTime === preset 
                            ? 'bg-blue-50 text-[#0F4C81] border-blue-200' 
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Eligibility Criteria */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" /> Eligibility Criteria
                  </label>
                  <input
                    type="text"
                    value={eligibility}
                    onChange={(e) => {
                      setEligibility(e.target.value);
                      markDirty();
                    }}
                    placeholder="e.g. All Indian citizens with valid proof of identity"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-400">Specifies who can apply for this document assistance</span>
                </div>

              </div>

            </div>

            {/* Card 3: Required Documents & Service Highlights */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm text-slate-900">Required Documents & Service Highlights</h2>
                    <p className="text-[11px] text-slate-400">Items required from customer and key value propositions</p>
                  </div>
                </div>
              </div>

              {/* Required Documents Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-400" /> Required Documents Checklist <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-slate-400">{documents.length} documents added</span>
                </div>

                {/* Input with Add button */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={docInput}
                    onChange={(e) => setDocInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDocument(docInput);
                      }
                    }}
                    placeholder="Type document name (e.g. Aadhaar Card) and press Enter..."
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddDocument(docInput)}
                    className="bg-[#0F4C81] hover:bg-blue-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1 cursor-pointer transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>

                {/* Quick Add Presets */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Quick Add Suggestions:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_DOCUMENTS.map((doc) => (
                      <button
                        key={doc}
                        type="button"
                        onClick={() => handleAddDocument(doc)}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border font-semibold transition cursor-pointer flex items-center gap-1 ${
                          documents.includes(doc)
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-[#0F4C81]'
                        }`}
                        disabled={documents.includes(doc)}
                      >
                        <Plus className="w-3 h-3" /> {doc}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Document Chips */}
                {documents.length > 0 ? (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Active Documents List:</span>
                    <div className="flex flex-wrap gap-2">
                      {documents.map((doc, idx) => (
                        <div
                          key={idx}
                          className="bg-white border border-slate-200 text-slate-800 text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-2xs"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0F4C81]" />
                          <span>{doc}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDocument(idx)}
                            className="text-slate-400 hover:text-red-600 transition cursor-pointer ml-1"
                            title="Remove document"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-medium">
                    ⚠️ No documents listed yet. Customers need to know what to prepare before applying.
                  </div>
                )}

                {errors.documents && (
                  <p className="text-[11px] font-bold text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.documents}
                  </p>
                )}
              </div>

              {/* Service Highlights Manager */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Dynamic Service Highlights
                  </label>
                  <span className="text-[10px] font-bold text-slate-400">{highlights.length} highlights</span>
                </div>

                {/* Add Highlight Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={highlightInput}
                    onChange={(e) => setHighlightInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddHighlight(highlightInput);
                      }
                    }}
                    placeholder="e.g. 100% Online Document Verification..."
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddHighlight(highlightInput)}
                    className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1 cursor-pointer transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>

                {/* Highlight Suggestions */}
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_HIGHLIGHTS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAddHighlight(preset)}
                      disabled={highlights.includes(preset)}
                      className={`text-[10px] px-2 py-0.5 rounded-lg border font-semibold transition cursor-pointer flex items-center gap-1 ${
                        highlights.includes(preset)
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-purple-50/60 text-purple-800 border-purple-200 hover:bg-purple-100'
                      }`}
                    >
                      <Plus className="w-2.5 h-2.5" /> {preset}
                    </button>
                  ))}
                </div>

                {/* Reorderable Highlights List */}
                <div className="space-y-1.5">
                  {highlights.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-5 h-5 rounded-md bg-purple-100 text-purple-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-800">{item}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveHighlight(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                          title="Move up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveHighlight(idx, 'down')}
                          disabled={idx === highlights.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                          title="Move down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveHighlight(idx)}
                          className="p-1 text-red-500 hover:text-red-700 cursor-pointer ml-1"
                          title="Delete highlight"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

              </div>

            </div>

          </div>

          {/* RIGHT COLUMN: Sidebar (Metadata, Image, WhatsApp & SEO) (4 Cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Sidebar Card 1: Category & Publishing Status */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                Classification & Status
              </h3>

              {/* Category Selector */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                    Service Category <span className="text-red-500">*</span>
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

              {/* Sub-Category (Optional) */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  Sub-Category (Optional)
                </label>
                <input
                  type="text"
                  value={subCategory}
                  onChange={(e) => {
                    setSubCategory(e.target.value);
                    markDirty();
                  }}
                  placeholder="e.g. Individual / Business"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Service Status */}
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
                  <option value="active">Active (Visible to Public)</option>
                  <option value="draft">Draft (Hidden from Catalog)</option>
                  <option value="inactive">Inactive / Archived</option>
                </select>
              </div>

              {/* Visibility Badges */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
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
                  <span className="text-xs font-semibold text-slate-700">Mark as Featured Service</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={popular}
                    onChange={(e) => {
                      setPopular(e.target.checked);
                      markDirty();
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-700">Highlight in Trending List</span>
                </label>
              </div>

            </div>

            {/* Sidebar Card 2: Service Image */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                Media & Banner Image
              </h3>
              <ImageUploadCard
                label="Catalog Cover Banner"
                value={imageUrl}
                onChange={(url) => {
                  setImageUrl(url);
                  markDirty();
                }}
                recommendedSize="1200 × 630 px"
                aspectRatioText="16:9 Landscape"
              />
            </div>

            {/* Sidebar Card 3: WhatsApp Direct Channel & Preview */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                    WhatsApp Order Channel
                  </h3>
                </div>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold px-2 py-0.5 rounded-md">
                  PRIMARY
                </span>
              </div>

              {/* WhatsApp Toggle */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Show WhatsApp Order Button</span>
                  <span className="text-[10px] text-slate-400">Direct 1-click enquiry on service page</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whatsAppEnabled}
                    onChange={(e) => {
                      setWhatsAppEnabled(e.target.checked);
                      markDirty();
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Central WhatsApp Number Display */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[11px] space-y-1">
                <span className="text-slate-500 font-semibold block">Configured Desk Support WhatsApp:</span>
                <div className="flex items-center justify-between font-mono font-bold text-slate-900">
                  <span>+{whatsAppNumber}</span>
                  <span className="text-[9px] text-emerald-700 font-sans font-extrabold bg-emerald-100/80 px-2 py-0.5 rounded">
                    Central Synced
                  </span>
                </div>
              </div>

              {/* Live WhatsApp Message Preview */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Customer Message Live Preview:</span>
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-950 font-mono leading-relaxed space-y-2">
                  <p>Hello EasyDesk,</p>
                  <p>I would like to enquire about:</p>
                  <p className="font-bold text-emerald-900">Service: {title || '[Service Name]'}</p>
                  <p>Category: {selectedCategory?.name || '[Category]'}</p>
                  <p>Service Charge: ₹{totalPayable}</p>
                  <p className="text-emerald-800 text-[10px]">Please guide me regarding the required documents and process.</p>
                </div>
              </div>

            </div>

            {/* Sidebar Card 4: SEO & Google Search Preview */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Globe className="w-4 h-4 text-[#0F4C81]" />
                <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                  SEO & Search Snippet
                </h3>
              </div>

              {/* URL Slug */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">URL Slug</label>
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
                  placeholder="pan-card-application"
                  className="w-full bg-slate-50 font-mono text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
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
                  placeholder={title || 'Search title...'}
                  className="w-full bg-white text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* SEO Description */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Meta Description</label>
                  <span className="text-[9px] text-slate-400">{(seoDescription || shortDescription).length}/160</span>
                </div>
                <textarea
                  rows={2}
                  value={seoDescription}
                  onChange={(e) => {
                    setSeoDescription(e.target.value);
                    markDirty();
                  }}
                  placeholder={shortDescription || 'Search description...'}
                  className="w-full bg-white text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Google SERP Snippet Preview Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1 text-xs">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Google SERP Preview</span>
                <p className="text-[11px] text-[#1a0dab] font-bold truncate">
                  {seoTitle || title || 'Service Title'} | EasyDesk
                </p>
                <p className="text-[9px] text-emerald-800 font-mono truncate">
                  https://easydesk.in/services/{slug || 'service-name'}
                </p>
                <p className="text-[10px] text-slate-600 line-clamp-2 leading-tight">
                  {seoDescription || shortDescription || 'Apply online with expert verification, document assistance, and transparent government challan fees through EasyDesk.'}
                </p>
              </div>

            </div>

          </div>

        </form>
      </div>

      {/* 4. Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          
          {/* Left: Discard / Cancel */}
          <button
            type="button"
            onClick={handleCancelClick}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel & Exit
          </button>

          {/* Right: Save as Draft & Publish / Update */}
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
                  <span>Saving Service...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'Update Service' : 'Save & Publish Service'}</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* 5. Unsaved Changes Confirmation Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">Unsaved Changes</h3>
              <p className="text-xs text-slate-500 mt-1">
                You have unsaved edits to this service. Leaving will discard all changes made during this session.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUnsavedModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                Continue Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedModal(false);
                  onCancel();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
