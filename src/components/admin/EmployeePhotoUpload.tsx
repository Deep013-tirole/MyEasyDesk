import React, { useState, useRef } from 'react';
import { Camera, Upload, Image as ImageIcon, Trash2, FolderOpen, Loader2, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { MediaPickerModal } from './MediaPickerModal.js';
import { apiFetch } from '../../lib/apiClient.js';
import { compressImageFile } from '../../lib/imageCompressor';

interface EmployeePhotoUploadProps {
  value: string;
  onChange: (photoUrl: string) => void;
  adminFetch?: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  label?: string;
}

export const EmployeePhotoUpload: React.FC<EmployeePhotoUploadProps> = ({
  value,
  onChange,
  adminFetch,
  label = 'Employee Profile Photo'
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Allowed formats
  const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
  const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

  const validateAndProcessFile = async (file: File) => {
    setErrorMessage('');

    if (!file) return;

    // 1. File Size Check (5MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(`File size is ${(file.size / (1024 * 1024)).toFixed(2)} MB. Maximum allowed limit is 5 MB.`);
      return;
    }

    // 2. File Extension Check
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setErrorMessage(`Invalid file extension (.${ext}). Only JPG, JPEG, PNG, and WEBP formats are permitted.`);
      return;
    }

    // 3. File MIME Type Check
    if (file.type && !ALLOWED_MIMES.includes(file.type.toLowerCase())) {
      setErrorMessage(`Invalid file type (${file.type}). Please select a valid JPG, PNG, or WEBP image.`);
      return;
    }

    // 4. Perform Upload to Server
    setUploading(true);

    try {
      // Compress/resize image assets automatically so they load fast and persist securely
      const { base64, mimeType, fileName } = await compressImageFile(file, 1200, 0.85);

      const payload = {
        fileData: base64,
        fileName: fileName || file.name,
        originalName: file.name,
        mimeType: mimeType || file.type || 'image/jpeg',
        folder: 'employee-photos',
        title: `Employee Photo - ${file.name}`
      };

      let res: Response;
      if (adminFetch) {
        res = await adminFetch('/api/admin/media/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await apiFetch('/api/admin/media/upload', {
          method: 'POST',
          body: payload,
          isAdmin: true
        });
      }

      if (res.ok) {
        const mediaData = await res.json();
        const uploadedUrl = mediaData.url || mediaData.path;
        onChange(uploadedUrl);
        setErrorMessage('');
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMessage(errData.message || 'Failed to upload photo to server.');
      }
      setUploading(false);
    } catch (err: any) {
      console.error('Error during photo upload:', err);
      setErrorMessage(err.message || 'Error processing image file.');
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
    // Reset file input value so re-selecting same file works
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemovePhoto = () => {
    onChange('');
    setErrorMessage('');
  };

  return (
    <div className="space-y-2 font-sans">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 block">
          {label}
        </label>
        {value && (
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Photo Attached
          </span>
        )}
      </div>

      {/* Main Upload Box */}
      <div 
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`bg-slate-50 border-2 ${
          dragOver ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200'
        } rounded-2xl p-3.5 transition-all flex flex-col sm:flex-row items-center gap-4`}
      >
        
        {/* Hidden Native File Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Photo Preview Box */}
        <div className="relative group shrink-0">
          <div className="w-24 h-28 rounded-2xl bg-white border-2 border-slate-200 overflow-hidden flex items-center justify-center shadow-xs relative">
            {value ? (
              <img
                src={value}
                alt="Employee Profile Photo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-300 p-2 text-center">
                <Camera className="w-8 h-8 text-slate-300 mb-1" />
                <span className="text-[9px] font-bold text-slate-400 uppercase">No Photo</span>
              </div>
            )}

            {uploading && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-2xs flex flex-col items-center justify-center text-white text-[10px] font-bold p-1">
                <Loader2 className="w-6 h-6 animate-spin text-white mb-1" />
                <span>Uploading...</span>
              </div>
            )}
          </div>

          {value && !uploading && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-md transition-transform hover:scale-110 cursor-pointer"
              title="Remove Profile Photo"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex-1 text-center sm:text-left space-y-2 w-full">
          <div>
            <p className="text-xs font-bold text-slate-800">
              {value ? 'Employee Photograph Attached' : 'Select or Upload Employee Photo'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Formats: JPG, PNG, WEBP • Max size: 5 MB
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {value ? <RefreshCw className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
              <span>{value ? 'Change Photo' : 'Upload Photo'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              disabled={uploading}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 active:scale-95 text-slate-700 font-extrabold text-xs rounded-xl border border-slate-200/90 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>Choose From Media Library</span>
            </button>

            {value && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="px-3 py-2 text-red-600 hover:bg-red-50 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Validation Error Banner */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setErrorMessage('')} 
            className="text-red-400 hover:text-red-700 font-bold ml-2 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Media Picker Modal */}
      <MediaPickerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedUrl={value}
        onSelectMedia={(url) => {
          onChange(url);
          setErrorMessage('');
          setIsModalOpen(false);
        }}
        allowedTypes={['image']}
        title="Choose Employee Photo from Media Library"
      />
    </div>
  );
};
