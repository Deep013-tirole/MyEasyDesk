import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  FileText, 
  Search, 
  X, 
  Check, 
  Folder, 
  Link as LinkIcon,
  Trash2,
  Info,
  Loader2,
  Filter
} from 'lucide-react';
import { MediaItem } from '../../types';
import { apiFetch } from '../../lib/apiClient.js';
import { compressImageFile } from '../../lib/imageCompressor';

interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedia: (url: string, item?: MediaItem) => void;
  allowedTypes?: ('image' | 'document' | 'video' | 'all')[];
  title?: string;
  selectedUrl?: string;
}

export const MediaPickerModal: React.FC<MediaPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectMedia,
  allowedTypes = ['all'],
  title = 'Select or Upload Media Asset',
  selectedUrl = ''
}) => {
  const [activeTab, setActiveTab] = useState<'library' | 'upload' | 'url'>('library');
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [customUrl, setCustomUrl] = useState<string>(selectedUrl);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [fileTitle, setFileTitle] = useState<string>('');
  const [fileAltText, setFileAltText] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchMediaItems();
      setCustomUrl(selectedUrl);
      setErrorMsg('');
    }
  }, [isOpen]);

  const fetchMediaItems = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/media', { isAdmin: true });
      if (res.ok) {
        const data = await res.json();
        setMediaList(data);
        // Pre-select item matching selectedUrl if found
        if (selectedUrl) {
          const matched = data.find((m: MediaItem) => m.url === selectedUrl);
          if (matched) setSelectedItem(matched);
        }
      }
    } catch (err) {
      console.error('Error loading media items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate size (limit 25MB)
    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg('File size exceeds maximum limit of 25 MB.');
      return;
    }

    setUploading(true);
    setErrorMsg('');

    try {
      // Compress/resize image assets automatically so they load fast and persist securely
      const { base64, mimeType, fileName } = await compressImageFile(file);
      
      const payload = {
        fileData: base64,
        fileName: fileName || file.name,
        originalName: file.name,
        mimeType: mimeType || file.type || 'image/jpeg',
        title: fileTitle || file.name,
        altText: fileAltText || file.name,
        folder: 'uploads'
      };

      const res = await apiFetch('/api/admin/media/upload', {
        method: 'POST',
        body: payload,
        isAdmin: true
      });

      if (res.ok) {
        const newMedia: MediaItem = await res.json();
        setMediaList(prev => [newMedia, ...prev]);
        setSelectedItem(newMedia);
        // Auto select and close or switch to library
        onSelectMedia(newMedia.url, newMedia);
        onClose();
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(errData.message || 'Failed to upload media file.');
      }
      setUploading(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error uploading file.');
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmSelect = () => {
    if (activeTab === 'url') {
      if (!customUrl.trim()) {
        setErrorMsg('Please enter a valid image/file URL.');
        return;
      }
      onSelectMedia(customUrl.trim());
      onClose();
      return;
    }

    if (selectedItem) {
      onSelectMedia(selectedItem.url, selectedItem);
      onClose();
    } else {
      setErrorMsg('Please select a file from the library first.');
    }
  };

  if (!isOpen) return null;

  const filteredMedia = mediaList.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                          (item.title && item.title.toLowerCase().includes(search.toLowerCase()));
    
    let matchesType = true;
    if (filterType === 'image') matchesType = item.type === 'image';
    else if (filterType === 'document') matchesType = item.type === 'pdf' || item.type === 'word' || item.type === 'document';

    return matchesSearch && matchesType;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-4xl h-[85vh] max-h-[700px] flex flex-col overflow-hidden font-sans">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Select an asset from Media Library or upload a new file directly.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation & Search */}
        <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white shrink-0">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'library' ? 'bg-white text-blue-600 shadow-sm' : 'hover:text-slate-900'}`}
            >
              Media Library
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'upload' ? 'bg-white text-blue-600 shadow-sm' : 'hover:text-slate-900'}`}
            >
              Upload New
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'url' ? 'bg-white text-blue-600 shadow-sm' : 'hover:text-slate-900'}`}
            >
              Direct Link
            </button>
          </div>

          {activeTab === 'library' && (
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search media files..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs bg-slate-50/50 font-bold text-slate-700 outline-none"
              >
                <option value="all">All Types</option>
                <option value="image">Images Only</option>
                <option value="document">Documents Only</option>
              </select>
            </div>
          )}
        </div>

        {/* Error Notice */}
        {errorMsg && (
          <div className="px-6 py-2 bg-red-50 border-b border-red-100 text-red-600 text-xs font-semibold flex items-center justify-between shrink-0">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-700 font-bold">×</button>
          </div>
        )}

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          
          {/* TAB 1: Media Library Grid */}
          {activeTab === 'library' && (
            <div>
              {loading ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                  <span>Loading Media Assets...</span>
                </div>
              ) : filteredMedia.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl p-6">
                  <ImageIcon className="w-10 h-10 text-slate-300 mb-2" />
                  <p className="font-bold text-slate-700 text-sm">No media files found</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">Upload new images or documents to populate your central repository.</p>
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm"
                  >
                    Upload File Now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredMedia.map(item => {
                    const isSelected = selectedItem?.id === item.id || selectedUrl === item.url;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={`group relative border rounded-2xl p-2.5 cursor-pointer transition-all bg-white flex flex-col justify-between ${
                          isSelected
                            ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                            : 'border-slate-200/80 hover:border-slate-300 hover:shadow-sm'
                        }`}
                      >
                        {/* Selected Check Badge */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-blue-600 text-white p-1 rounded-full shadow-md z-10">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}

                        {/* Thumbnail View */}
                        <div className="w-full h-28 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center border border-slate-100 relative">
                          {item.type === 'pdf' || item.type === 'word' || item.type === 'document' ? (
                            <div className="flex flex-col items-center text-slate-500">
                              <FileText className="w-8 h-8 text-blue-500 mb-1" />
                              <span className="text-[9px] uppercase font-extrabold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                {item.mimeType?.split('/')[1] || item.type}
                              </span>
                            </div>
                          ) : (
                            <img
                              src={item.url}
                              alt={item.title || item.name}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400';
                              }}
                            />
                          )}
                        </div>

                        {/* Metadata Details */}
                        <div className="mt-2 text-xs">
                          <p className="font-extrabold text-slate-800 truncate" title={item.name}>
                            {item.title || item.name}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                            <span>{item.size || '300 KB'}</span>
                            <span className="capitalize">{item.folder || 'media'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Upload New Drag & Drop Zone */}
          {activeTab === 'upload' && (
            <div className="max-w-xl mx-auto space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[220px] ${
                  dragOver
                    ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
                    : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50/50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                  }}
                />

                {uploading ? (
                  <div className="flex flex-col items-center text-blue-600 font-bold text-xs space-y-2">
                    <Loader2 className="w-10 h-10 animate-spin" />
                    <span>Uploading and processing media file...</span>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-3">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="font-extrabold text-slate-800 text-sm">
                      Click to choose or Drag & Drop file here
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Supports PNG, JPG, WEBP, GIF, PDF, DOCX (Max size: 15 MB)
                    </p>
                  </>
                )}
              </div>

              {/* Optional Fields */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-slate-700 text-xs">Asset Metadata (Optional)</h4>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Asset Title / Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Official Header Logo 2026"
                    value={fileTitle}
                    onChange={(e) => setFileTitle(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Alt Text Description</label>
                  <input
                    type="text"
                    placeholder="e.g. EasyDesk company primary logo"
                    value={fileAltText}
                    onChange={(e) => setFileAltText(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Direct Link Fallback */}
          {activeTab === 'url' && (
            <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-blue-600" />
                <h4 className="font-extrabold text-slate-800 text-sm">Direct Image or File URL</h4>
              </div>
              <p className="text-xs text-slate-500">
                You can enter an external CDN image address or file link if you don't wish to store a local copy.
              </p>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Image / Resource URL</label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {customUrl && (
                <div className="w-full h-36 border border-slate-200 rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center">
                  <img
                    src={customUrl}
                    alt="Preview"
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="text-xs text-slate-500 truncate max-w-md">
            {selectedItem ? (
              <span className="font-semibold text-slate-700">Selected: <span className="text-blue-600 font-bold">{selectedItem.title || selectedItem.name}</span> ({selectedItem.size})</span>
            ) : customUrl ? (
              <span className="truncate block font-mono text-[11px] text-slate-600">URL: {customUrl}</span>
            ) : (
              <span>No asset selected yet.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSelect}
              disabled={activeTab === 'library' && !selectedItem}
              className={`px-5 py-2 rounded-xl text-xs font-extrabold text-white transition-all shadow-sm flex items-center gap-1.5 ${
                activeTab === 'library' && !selectedItem
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
              }`}
            >
              <Check className="w-4 h-4" />
              Use Selected File
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
