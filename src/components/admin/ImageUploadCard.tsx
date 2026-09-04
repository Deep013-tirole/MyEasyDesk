import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  Trash2, 
  RefreshCw, 
  FolderOpen, 
  Link as LinkIcon, 
  Check, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { MediaPickerModal } from './MediaPickerModal';
import { apiFetch } from '../../lib/apiClient';
import { compressImageFile } from '../../lib/imageCompressor';

interface ImageUploadCardProps {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  recommendedSize?: string;
  aspectRatioText?: string;
  helperText?: string;
  error?: string;
}

export const ImageUploadCard: React.FC<ImageUploadCardProps> = ({
  label = 'Featured Image / Banner',
  value = '',
  onChange,
  recommendedSize = '1200 × 630 px',
  aspectRatioText = '16:9 Landscape',
  helperText = 'Supported formats: PNG, JPG, WebP (Max 5MB)',
  error
}) => {
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [isUrlInputOpen, setIsUrlInputOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setUploadError(null);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (JPG, PNG, WebP)');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setUploadError('Image size exceeds 25MB limit. Please choose a smaller image.');
      return;
    }

    setIsUploading(true);
    try {
      const { base64, mimeType, fileName } = await compressImageFile(file, 1600, 0.85);

      const payload = {
        fileData: base64,
        fileName: fileName || file.name,
        originalName: file.name,
        mimeType: mimeType || file.type || 'image/jpeg',
        folder: 'uploads',
        title: file.name.replace(/\.[^/.]+$/, '')
      };

      const res = await apiFetch('/api/admin/media/upload', {
        method: 'POST',
        body: payload,
        isAdmin: true
      });

      if (res.ok) {
        const mediaData = await res.json();
        onChange(mediaData.url || base64);
        setUploadError(null);
      } else {
        // Fallback to local DataURL if server upload had an issue
        onChange(base64);
      }
    } catch (err: any) {
      console.warn('Network issue during media upload, fallback to local DataURL:', err);
      setUploadError(err.message || 'Failed to upload image.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleApplyUrl = () => {
    if (urlDraft.trim()) {
      onChange(urlDraft.trim());
      setIsUrlInputOpen(false);
      setUrlDraft('');
    }
  };

  const handleRemove = () => {
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2 font-sans">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
          {label}
        </label>
        <span className="text-[10px] text-slate-400 font-semibold">{aspectRatioText}</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp, image/svg+xml"
        onChange={handleFileSelect}
        className="hidden"
      />

      {isUploading ? (
        <div className="border-2 border-dashed border-blue-400 bg-blue-50/60 rounded-2xl p-6 text-center flex flex-col items-center justify-center min-h-[140px]">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
          <p className="text-xs font-extrabold text-blue-800">Uploading image to media library...</p>
          <p className="text-[10px] text-blue-600 mt-0.5">Optimizing and storing asset</p>
        </div>
      ) : value ? (
        /* Image Preview Box */
        <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-3 shadow-2xs">
          <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 group">
            <img
              src={value}
              alt="Preview"
              className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400';
              }}
            />
            
            {/* Hover Actions Overlay */}
            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-3 backdrop-blur-2xs">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-white/90 hover:bg-white text-slate-900 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Replace
              </button>
              <button
                type="button"
                onClick={() => setIsMediaModalOpen(true)}
                className="bg-white/90 hover:bg-white text-blue-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-sm"
              >
                <FolderOpen className="w-3.5 h-3.5" /> Library
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="bg-red-500/90 hover:bg-red-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            </div>
          </div>

          {/* Quick Action Button Bar */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => setIsMediaModalOpen(true)}
              className="text-[#0F4C81] hover:text-blue-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" /> Browse Media Library
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="text-red-500 hover:text-red-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove Image
            </button>
          </div>
        </div>
      ) : (
        /* Drag & Drop Upload Zone */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all bg-white cursor-pointer ${
            isDragOver 
              ? 'border-blue-500 bg-blue-50/50 scale-[1.01]' 
              : error 
                ? 'border-red-300 hover:border-red-400 bg-red-50/20' 
                : 'border-slate-300/80 hover:border-[#0F4C81] hover:bg-slate-50/60'
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 text-[#0F4C81] flex items-center justify-center mb-3 shadow-2xs">
            <UploadCloud className="w-6 h-6" />
          </div>

          <p className="text-xs font-bold text-slate-800">
            <span className="text-[#0F4C81] underline">Click to upload</span> or drag and drop
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            {recommendedSize} • {helperText}
          </p>

          <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t border-slate-100 text-xs">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMediaModalOpen(true);
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#0F4C81]" /> Media Library
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsUrlInputOpen(!isUrlInputOpen);
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer"
            >
              <LinkIcon className="w-3.5 h-3.5 text-slate-500" /> Enter URL
            </button>
          </div>
        </div>
      )}

      {/* URL Input Box Drawer */}
      {isUrlInputOpen && !value && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 animate-in fade-in duration-150">
          <label className="text-[10px] font-bold text-slate-600 uppercase block">Paste Image Web URL</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={handleApplyUrl}
              className="bg-[#0F4C81] hover:bg-blue-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" /> Apply
            </button>
          </div>
        </div>
      )}

      {/* Upload Error / Validation Error */}
      {(uploadError || error) && (
        <div className="text-[11px] font-bold text-red-600 flex items-center gap-1.5 mt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{uploadError || error}</span>
        </div>
      )}

      {/* Media Picker Modal */}
      <MediaPickerModal
        isOpen={isMediaModalOpen}
        onClose={() => setIsMediaModalOpen(false)}
        onSelectMedia={(url) => {
          onChange(url);
          setIsMediaModalOpen(false);
        }}
        allowedTypes={['image']}
        title="Select Media for Featured Banner"
        selectedUrl={value}
      />
    </div>
  );
};
