import React, { useState } from 'react';
import { Image as ImageIcon, Upload, X, ExternalLink, FileText } from 'lucide-react';
import { MediaPickerModal } from './MediaPickerModal';
import { MediaItem } from '../../types';

interface MediaInputProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  allowedTypes?: ('image' | 'document' | 'video' | 'all')[];
}

export const MediaInput: React.FC<MediaInputProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Select or upload file...',
  required = false,
  helpText,
  allowedTypes = ['all']
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isImage = value && (
    value.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) ||
    value.startsWith('/uploads/') ||
    value.includes('images.unsplash.com') ||
    value.includes('data:image/')
  );

  return (
    <div className="space-y-1.5 font-sans">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-extrabold text-slate-500 uppercase block tracking-wider">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[10px] font-bold text-red-500 hover:underline flex items-center gap-0.5"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-2.5 transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10">
        
        {/* Preview Box */}
        <div className="w-12 h-12 rounded-xl border border-slate-200 bg-white overflow-hidden shrink-0 flex items-center justify-center relative shadow-xs">
          {value ? (
            isImage ? (
              <img
                src={value}
                alt={label}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400';
                }}
              />
            ) : (
              <FileText className="w-6 h-6 text-blue-500" />
            )
          ) : (
            <ImageIcon className="w-5 h-5 text-slate-300" />
          )}
        </div>

        {/* Input Text / Display */}
        <div className="flex-1 min-w-0 space-y-1">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            className="w-full text-xs font-mono text-slate-800 bg-transparent outline-none border-none p-0 truncate"
          />
          <p className="text-[10px] text-slate-400 truncate">
            {value ? (value.startsWith('/uploads/') ? 'Stored in Media Library' : 'External Link') : 'No file chosen'}
          </p>
        </div>

        {/* Media Library Choose / Upload Button */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="shrink-0 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-xs px-3 py-2 rounded-xl border border-blue-200/60 transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs"
        >
          <Upload className="w-3.5 h-3.5 text-blue-600" />
          <span>Choose / Upload</span>
        </button>

      </div>

      {helpText && (
        <p className="text-[10px] text-slate-400 mt-0.5">{helpText}</p>
      )}

      {/* Modal Picker */}
      <MediaPickerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedUrl={value}
        onSelectMedia={(url) => {
          onChange(url);
          setIsModalOpen(false);
        }}
        allowedTypes={allowedTypes}
        title={`Select Asset for ${label}`}
      />
    </div>
  );
};
