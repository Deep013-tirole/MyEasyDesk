import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  FileText, 
  Search, 
  Trash2, 
  Copy, 
  Check, 
  Filter, 
  Info, 
  Edit2, 
  ExternalLink,
  HardDrive,
  Folder,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { MediaItem } from '../../types';
import { apiFetch } from '../../lib/apiClient.js';
import { compressImageFile } from '../../lib/imageCompressor';

export const MediaLibraryAdminModule: React.FC = () => {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterFolder, setFilterFolder] = useState<string>('all');
  const [msg, setMsg] = useState<string>('');
  const [errMsg, setErrMsg] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string>('');
  const [dragOver, setDragOver] = useState<boolean>(false);

  // Selected Item for Details Panel Modal
  const [activeItem, setActiveItem] = useState<MediaItem | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editAltText, setEditAltText] = useState<string>('');
  const [savingDetails, setSavingDetails] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMediaList();
  }, []);

  const fetchMediaList = async () => {
    setLoading(true);
    setErrMsg('');
    try {
      const res = await apiFetch('/api/admin/media', { isAdmin: true });
      if (res.ok) {
        const data = await res.json();
        setMediaList(data);
      } else {
        setErrMsg('Failed to load media library assets.');
      }
    } catch (err: any) {
      setErrMsg(err.message || 'Error fetching media files.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setErrMsg('File size exceeds maximum allowed 25 MB.');
      return;
    }

    setUploading(true);
    setMsg('');
    setErrMsg('');

    try {
      // Compress/resize image assets automatically so they load fast and persist securely
      const { base64, mimeType, fileName } = await compressImageFile(file);

      const payload = {
        fileData: base64,
        fileName: fileName || file.name,
        originalName: file.name,
        mimeType: mimeType || file.type || 'image/jpeg',
        title: file.name.split('.')[0].replace(/[-_]/g, ' '),
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
        setMsg(`Successfully uploaded file: "${newMedia.name}"`);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setErrMsg(errorData.message || 'Upload failed.');
      }
      setUploading(false);
    } catch (err: any) {
      setErrMsg(err.message || 'Failed uploading file.');
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

  const handleDeleteMedia = async (item: MediaItem) => {
    // Immediate optimistic update
    setMediaList(prev => prev.filter(m => m.id !== item.id));
    if (activeItem?.id === item.id) setActiveItem(null);

    try {
      const res = await apiFetch(`/api/admin/media/${item.id}`, {
        method: 'DELETE',
        isAdmin: true
      });

      if (res.ok) {
        setMsg(`Deleted asset "${item.name}"`);
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrMsg(errData.message || 'Failed deleting file.');
        fetchMediaList(); // Revert
      }
    } catch (err: any) {
      setErrMsg(err.message || 'Error deleting media item.');
      fetchMediaList(); // Revert
    }
  };

  const handleCopyUrl = (url: string, id: string) => {
    const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2500);
  };

  const handleOpenDetails = (item: MediaItem) => {
    setActiveItem(item);
    setEditTitle(item.title || item.name || '');
    setEditAltText(item.altText || '');
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;

    setSavingDetails(true);
    try {
      const res = await apiFetch(`/api/admin/media/${activeItem.id}`, {
        method: 'PUT',
        body: {
          title: editTitle,
          altText: editAltText
        },
        isAdmin: true
      });

      if (res.ok) {
        const updated: MediaItem = await res.json();
        setMediaList(prev => prev.map(m => m.id === updated.id ? updated : m));
        setActiveItem(updated);
        setMsg('Asset details updated successfully.');
      } else {
        setErrMsg('Failed to update asset details.');
      }
    } catch (err: any) {
      setErrMsg(err.message || 'Error updating asset.');
    } finally {
      setSavingDetails(false);
    }
  };

  const filteredMedia = mediaList.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
                          (item.title && item.title.toLowerCase().includes(search.toLowerCase())) ||
                          (item.originalName && item.originalName.toLowerCase().includes(search.toLowerCase()));

    let matchesType = true;
    if (filterType === 'image') matchesType = item.type === 'image';
    else if (filterType === 'document') matchesType = item.type === 'pdf' || item.type === 'word' || item.type === 'document';

    let matchesFolder = true;
    if (filterFolder !== 'all') matchesFolder = item.folder === filterFolder;

    return matchesSearch && matchesType && matchesFolder;
  });

  const totalBytes = mediaList.reduce((acc, curr) => acc + (curr.sizeBytes || 300000), 0);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
  const imageCount = mediaList.filter(m => m.type === 'image').length;
  const docCount = mediaList.length - imageCount;

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header & Stats Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-500/20 text-blue-400 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border border-blue-500/30">
              Central Repository
            </span>
            <span className="text-xs text-slate-400 font-mono">v2.0 Storage Engine</span>
          </div>
          <h2 className="text-xl font-extrabold mt-2 tracking-tight">EasyDesk Central Media Library</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Upload, inspect, and manage persistent image and document assets used across services, banners, employee records, and branding settings.
          </p>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3 text-center shrink-0 w-full md:w-auto">
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10">
            <p className="text-[10px] text-slate-300 font-bold uppercase">Total Files</p>
            <p className="text-lg font-black text-white">{mediaList.length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10">
            <p className="text-[10px] text-slate-300 font-bold uppercase">Images / Docs</p>
            <p className="text-lg font-black text-blue-300">{imageCount} / {docCount}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10">
            <p className="text-[10px] text-slate-300 font-bold uppercase">Storage Used</p>
            <p className="text-lg font-black text-emerald-400">{totalMB} MB</p>
          </div>
        </div>
      </div>

      {/* Alert Notices */}
      {msg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-2xl flex justify-between items-center animate-in fade-in">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="text-emerald-500 hover:text-emerald-800">×</button>
        </div>
      )}
      {errMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-2xl flex justify-between items-center animate-in fade-in">
          <span>{errMsg}</span>
          <button onClick={() => setErrMsg('')} className="text-red-500 hover:text-red-800">×</button>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all flex flex-col sm:flex-row items-center justify-between gap-4 ${
          dragOver 
            ? 'border-blue-500 bg-blue-50/60 scale-[1.005]' 
            : 'border-slate-300/80 bg-white hover:border-blue-400 hover:bg-slate-50/50 shadow-sm'
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

        <div className="flex items-center gap-4 text-left">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0 border border-blue-100">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-900 text-sm">Upload New Asset File</h4>
            <p className="text-xs text-slate-500">Drag & drop image or document here, or click to browse files from your machine.</p>
          </div>
        </div>

        <button
          type="button"
          disabled={uploading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-all shrink-0 flex items-center gap-2 active:scale-95"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-4 h-4" />
              <span>Select File</span>
            </>
          )}
        </button>
      </div>

      {/* Controls Bar: Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search media assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs bg-slate-50 font-bold text-slate-700 outline-none"
          >
            <option value="all">All File Types</option>
            <option value="image">Images Only</option>
            <option value="document">Documents / PDFs</option>
          </select>

          <button
            onClick={fetchMediaList}
            title="Refresh List"
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Media Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs font-bold">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <span>Syncing Media Storage Engine...</span>
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-400">
          <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-extrabold text-slate-800 text-sm">No media assets match search criteria</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Upload new assets using the dropzone above or clear active search filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredMedia.map(item => (
            <div
              key={item.id}
              className="group bg-white border border-slate-200/80 rounded-2xl p-3 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
            >
              {/* Image Preview Box */}
              <div 
                onClick={() => handleOpenDetails(item)}
                className="w-full h-32 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center border border-slate-100 relative cursor-pointer group-hover:opacity-95"
              >
                {item.type === 'pdf' || item.type === 'word' || item.type === 'document' ? (
                  <div className="flex flex-col items-center text-slate-500">
                    <FileText className="w-10 h-10 text-blue-600 mb-1" />
                    <span className="text-[9px] uppercase font-extrabold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
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

                {/* Inspect Overlay Badge */}
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white font-bold text-xs">
                  <Info className="w-4 h-4" /> Inspect Details
                </div>
              </div>

              {/* Title & Size */}
              <div className="mt-2.5">
                <p className="font-extrabold text-slate-800 text-xs truncate" title={item.name}>
                  {item.title || item.name}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                  <span>{item.size || '300 KB'}</span>
                  <span className="capitalize bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-bold">{item.folder || 'media'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-2">
                <button
                  onClick={() => handleCopyUrl(item.url, item.id)}
                  className="text-blue-600 hover:text-blue-800 text-[10px] font-bold flex items-center gap-1"
                >
                  {copiedId === item.id ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600 font-extrabold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy URL</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenDetails(item)}
                    title="Edit Metadata"
                    className="p-1 hover:bg-slate-100 rounded text-slate-500"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteMedia(item)}
                    title="Delete Asset"
                    className="p-1 hover:bg-red-50 rounded text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Asset Details Modal */}
      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-2xl overflow-hidden font-sans">
            
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">Media Asset Specification</h3>
              </div>
              <button onClick={() => setActiveItem(null)} className="p-1 text-slate-400 hover:text-slate-700">×</button>
            </div>

            <div className="p-6 grid sm:grid-cols-2 gap-6">
              {/* Left Column Preview */}
              <div className="space-y-3">
                <div className="w-full h-48 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center">
                  {activeItem.type === 'pdf' || activeItem.type === 'word' || activeItem.type === 'document' ? (
                    <FileText className="w-16 h-16 text-blue-600" />
                  ) : (
                    <img src={activeItem.url} alt={activeItem.name} className="max-h-full max-w-full object-contain" />
                  )}
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border text-[11px] space-y-1 font-mono text-slate-600">
                  <p><span className="font-bold text-slate-800">Media ID:</span> {activeItem.id}</p>
                  <p><span className="font-bold text-slate-800">Stored Name:</span> {activeItem.storedName || activeItem.name}</p>
                  <p><span className="font-bold text-slate-800">MIME Type:</span> {activeItem.mimeType || 'image/jpeg'}</p>
                  <p><span className="font-bold text-slate-800">File Size:</span> {activeItem.size}</p>
                  <p><span className="font-bold text-slate-800">Uploaded By:</span> {activeItem.uploadedBy || 'Admin'}</p>
                  <p><span className="font-bold text-slate-800">Upload Date:</span> {new Date(activeItem.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Right Column Edit Form */}
              <form onSubmit={handleSaveDetails} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-500 uppercase block mb-1">Display Title / Name</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-500 uppercase block mb-1">Alt Text Description</label>
                  <input
                    type="text"
                    value={editAltText}
                    onChange={(e) => setEditAltText(e.target.value)}
                    placeholder="e.g. Founder portrait image"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-500 uppercase block mb-1">Asset URL Reference</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={activeItem.url}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-mono text-slate-600 select-all"
                    />
                    <a
                      href={activeItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 border border-slate-200 rounded-xl hover:bg-slate-100 text-blue-600 shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                <div className="pt-4 border-t flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveItem(null)}
                    className="px-4 py-2 border rounded-xl text-slate-600 font-bold"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={savingDetails}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold shadow-sm"
                  >
                    {savingDetails ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
