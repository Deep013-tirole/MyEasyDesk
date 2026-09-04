import React, { useState, useMemo, useEffect } from 'react';
import { 
  Folder, Plus, Search, Filter, Edit, Trash2, CheckCircle2, 
  XCircle, ArrowUpDown, MoveUp, MoveDown, Layers, BookOpen, 
  FileText, Briefcase, GraduationCap, FileCheck, Laptop, User, 
  Zap, Shield, Bookmark, Landmark, Sparkles, Scale, HeartHandshake, 
  Globe, Award, Newspaper, Compass, AlertCircle, RefreshCw, Check,
  Power, PowerOff, LayoutGrid, List
} from 'lucide-react';
import { ServiceCategory, BlogCategory, Service, Blog } from '../../types.js';
import { invalidateAllCatalogsCache } from '../../services/catalogService.js';

interface CategoryManagementAdminModuleProps {
  categories: ServiceCategory[];
  blogCategories: BlogCategory[];
  services: Service[];
  blogs: Blog[];
  adminFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  triggerAlert: (msg: string) => void;
  onRefreshCatalogs?: () => void;
}

const AVAILABLE_ICONS = [
  { name: 'Folder', icon: Folder },
  { name: 'FileText', icon: FileText },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'GraduationCap', icon: GraduationCap },
  { name: 'FileCheck', icon: FileCheck },
  { name: 'Laptop', icon: Laptop },
  { name: 'User', icon: User },
  { name: 'Zap', icon: Zap },
  { name: 'Shield', icon: Shield },
  { name: 'Bookmark', icon: Bookmark },
  { name: 'Landmark', icon: Landmark },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Scale', icon: Scale },
  { name: 'HeartHandshake', icon: HeartHandshake },
  { name: 'Globe', icon: Globe },
  { name: 'Award', icon: Award },
  { name: 'Newspaper', icon: Newspaper },
  { name: 'Compass', icon: Compass },
  { name: 'BookOpen', icon: BookOpen },
  { name: 'Layers', icon: Layers },
];

const AVAILABLE_COLORS = [
  { name: 'Blue', value: 'blue', bgClass: 'bg-blue-500', borderClass: 'border-blue-500', textClass: 'text-blue-700', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  { name: 'Emerald', value: 'emerald', bgClass: 'bg-emerald-500', borderClass: 'border-emerald-500', textClass: 'text-emerald-700', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { name: 'Purple', value: 'purple', bgClass: 'bg-purple-500', borderClass: 'border-purple-500', textClass: 'text-purple-700', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
  { name: 'Amber', value: 'amber', bgClass: 'bg-amber-500', borderClass: 'border-amber-500', textClass: 'text-amber-700', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  { name: 'Cyan', value: 'cyan', bgClass: 'bg-cyan-500', borderClass: 'border-cyan-500', textClass: 'text-cyan-700', badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { name: 'Rose', value: 'rose', bgClass: 'bg-rose-500', borderClass: 'border-rose-500', textClass: 'text-rose-700', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
  { name: 'Indigo', value: 'indigo', bgClass: 'bg-indigo-500', borderClass: 'border-indigo-500', textClass: 'text-indigo-700', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { name: 'Teal', value: 'teal', bgClass: 'bg-teal-500', borderClass: 'border-teal-500', textClass: 'text-teal-700', badgeClass: 'bg-teal-50 text-teal-700 border-teal-200' },
  { name: 'Orange', value: 'orange', bgClass: 'bg-orange-500', borderClass: 'border-orange-500', textClass: 'text-orange-700', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' },
  { name: 'Slate', value: 'slate', bgClass: 'bg-slate-500', borderClass: 'border-slate-500', textClass: 'text-slate-700', badgeClass: 'bg-slate-50 text-slate-700 border-slate-200' },
];

export default function CategoryManagementAdminModule({
  categories = [],
  blogCategories = [],
  services = [],
  blogs = [],
  adminFetch,
  triggerAlert,
  onRefreshCatalogs
}: CategoryManagementAdminModuleProps) {
  const [activeSubTab, setActiveSubTab] = useState<'services' | 'blogs'>('services');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Inactive'>('ALL');
  const [sortBy, setSortBy] = useState<'order' | 'name-asc' | 'name-desc' | 'items-desc'>('order');
  const [viewMode, setViewMode] = useState<'auto' | 'cards' | 'table'>('auto');

  // Local synced state for instant UI responsiveness
  const [localCategories, setLocalCategories] = useState<ServiceCategory[]>(categories);
  const [localBlogCategories, setLocalBlogCategories] = useState<BlogCategory[]>(blogCategories);

  useEffect(() => {
    if (Array.isArray(categories) && categories.length > 0) {
      setLocalCategories(categories);
    }
  }, [categories]);

  useEffect(() => {
    if (Array.isArray(blogCategories) && blogCategories.length > 0) {
      setLocalBlogCategories(blogCategories);
    }
  }, [blogCategories]);

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form values
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    icon: 'Folder',
    color: 'blue',
    sortOrder: 1,
    status: 'Active' as 'Active' | 'Inactive'
  });

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    category: ServiceCategory | BlogCategory | null;
    type: 'services' | 'blogs';
    fallbackId: string;
    linkedCount: number;
  }>({
    isOpen: false,
    category: null,
    type: 'services',
    fallbackId: '',
    linkedCount: 0
  });

  // Helper icon renderer
  const renderIcon = (iconName?: string, className = 'w-4 h-4') => {
    const found = AVAILABLE_ICONS.find(i => i.name.toLowerCase() === (iconName || '').toLowerCase());
    if (found) {
      const IconComp = found.icon;
      return <IconComp className={className} />;
    }
    return <Folder className={className} />;
  };

  // Helper color badge class
  const getColorClass = (colorName?: string) => {
    const found = AVAILABLE_COLORS.find(c => c.value === colorName || c.name.toLowerCase() === colorName?.toLowerCase());
    return found ? found.badgeClass : 'bg-blue-50 text-blue-700 border-blue-200';
  };

  // Compute counts for services per category
  const serviceCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    services.forEach(s => {
      if (s.categoryId) {
        map[s.categoryId] = (map[s.categoryId] || 0) + 1;
      }
    });
    return map;
  }, [services]);

  // Compute counts for blogs per category
  const blogCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    blogs.forEach(b => {
      if (b.categoryId) {
        map[b.categoryId] = (map[b.categoryId] || 0) + 1;
      } else if (b.category) {
        // match by name if categoryId is missing
        const matched = blogCategories.find(bc => bc.name.toLowerCase() === b.category?.toLowerCase());
        if (matched) {
          map[matched.id] = (map[matched.id] || 0) + 1;
        }
      }
    });
    return map;
  }, [blogs, blogCategories]);

  // Process list based on active tab using local state for immediate responsiveness
  const currentList = activeSubTab === 'services' ? localCategories : localBlogCategories;
  const countMap = activeSubTab === 'services' ? serviceCountMap : blogCountMap;

  // Filter and Sort
  const processedCategories = useMemo(() => {
    return currentList
      .filter(item => {
        const matchesSearch = 
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.slug && item.slug.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
        
        const itemStatus = item.status || 'Active';
        const matchesStatus = statusFilter === 'ALL' || itemStatus === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'order') {
          return (a.sortOrder || 999) - (b.sortOrder || 999);
        }
        if (sortBy === 'name-asc') {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'name-desc') {
          return b.name.localeCompare(a.name);
        }
        if (sortBy === 'items-desc') {
          return (countMap[b.id] || 0) - (countMap[a.id] || 0);
        }
        return 0;
      });
  }, [currentList, searchQuery, statusFilter, sortBy, countMap]);

  // Summary Metrics
  const totalCategories = currentList.length;
  const activeCount = currentList.filter(c => (c.status || 'Active') === 'Active').length;
  const inactiveCount = totalCategories - activeCount;
  const totalLinkedItems = Object.values(countMap).reduce<number>((acc, val) => acc + (typeof val === 'number' ? val : 0), 0);

  // Open Create Form
  const handleOpenAdd = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      icon: activeSubTab === 'services' ? 'Briefcase' : 'Bookmark',
      color: 'blue',
      sortOrder: currentList.length + 1,
      status: 'Active'
    });
    setIsModalOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = (item: ServiceCategory | BlogCategory) => {
    setIsEditing(true);
    setEditingId(item.id);
    setFormData({
      name: item.name,
      slug: item.slug || item.id,
      description: item.description || '',
      icon: item.icon || 'Folder',
      color: item.color || 'blue',
      sortOrder: item.sortOrder || 1,
      status: item.status || 'Active'
    });
    setIsModalOpen(true);
  };

  // Auto-generate slug from name
  const handleNameChange = (newName: string) => {
    let generatedSlug = newName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!generatedSlug && newName.trim()) {
      generatedSlug = `${activeSubTab === 'services' ? 'cat' : 'bcat'}-${Date.now().toString().slice(-6)}`;
    }

    setFormData(prev => ({
      ...prev,
      name: newName,
      slug: isEditing ? prev.slug : generatedSlug
    }));
  };

  // Submit Create or Edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      alert('Please provide a valid category name.');
      return;
    }

    let slug = (formData.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!slug) {
      slug = trimmedName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    }
    if (!slug) {
      slug = `${activeSubTab === 'services' ? 'cat' : 'bcat'}-${Date.now().toString().slice(-6)}`;
    }

    setIsSubmitting(true);
    const endpoint = activeSubTab === 'services' ? '/api/admin/categories' : '/api/admin/blog-categories';
    const targetUrl = isEditing ? `${endpoint}/${editingId}` : endpoint;
    const method = isEditing ? 'PUT' : 'POST';

    const categoryPayload = {
      ...formData,
      id: isEditing ? (editingId || slug) : slug,
      name: trimmedName,
      slug,
      sortOrder: Number(formData.sortOrder) || (currentList.length + 1)
    };

    try {
      const res = await adminFetch(targetUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: categoryPayload
        })
      });

      const resData = await res.json().catch(() => ({}));
      if (res.ok) {
        const savedItem = { ...categoryPayload, ...(resData && typeof resData === 'object' ? resData : {}) };
        if (activeSubTab === 'services') {
          setLocalCategories(prev => {
            if (isEditing) {
              return prev.map(c => (c.id === editingId || c.slug === editingId) ? { ...c, ...savedItem } : c);
            }
            return [...prev.filter(c => c.id !== savedItem.id && c.slug !== savedItem.slug), savedItem as ServiceCategory];
          });
        } else {
          setLocalBlogCategories(prev => {
            if (isEditing) {
              return prev.map(c => (c.id === editingId || c.slug === editingId) ? { ...c, ...savedItem } : c);
            }
            return [...prev.filter(c => c.id !== savedItem.id && c.slug !== savedItem.slug), savedItem as BlogCategory];
          });
        }

        invalidateAllCatalogsCache();
        triggerAlert(isEditing ? `Category '${trimmedName}' updated successfully.` : `New category '${trimmedName}' created!`);
        setIsModalOpen(false);
        onRefreshCatalogs?.();
      } else {
        alert(resData.message || 'Failed to save category.');
      }
    } catch (err: any) {
      alert(err.message || 'Network error saving category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Status (1-click active/inactive)
  const handleToggleStatus = async (item: ServiceCategory | BlogCategory) => {
    const isCurrentlyInactive = item.status === 'Inactive';
    const newStatus: 'Active' | 'Inactive' = isCurrentlyInactive ? 'Active' : 'Inactive';
    const endpoint = activeSubTab === 'services' 
      ? `/api/admin/categories/${item.id}/status` 
      : `/api/admin/blog-categories/${item.id}/status`;

    // Immediate optimistic update
    if (activeSubTab === 'services') {
      setLocalCategories(prev => prev.map(c => c.id === item.id ? { ...c, status: newStatus } : c));
    } else {
      setLocalBlogCategories(prev => prev.map(c => c.id === item.id ? { ...c, status: newStatus } : c));
    }

    try {
      const res = await adminFetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus
        })
      });

      if (res.ok) {
        invalidateAllCatalogsCache();
        triggerAlert(newStatus === 'Active' 
          ? `Category '${item.name}' activated successfully.` 
          : `Category '${item.name}' deactivated successfully.`);
        onRefreshCatalogs?.();
      } else {
        // Rollback on failure
        if (activeSubTab === 'services') {
          setLocalCategories(prev => prev.map(c => c.id === item.id ? { ...c, status: item.status } : c));
        } else {
          setLocalBlogCategories(prev => prev.map(c => c.id === item.id ? { ...c, status: item.status } : c));
        }
        const err = await res.json().catch(() => ({}));
        alert(err.message || `Failed to ${newStatus === 'Active' ? 'activate' : 'deactivate'} category.`);
      }
    } catch (err: any) {
      if (activeSubTab === 'services') {
        setLocalCategories(prev => prev.map(c => c.id === item.id ? { ...c, status: item.status } : c));
      } else {
        setLocalBlogCategories(prev => prev.map(c => c.id === item.id ? { ...c, status: item.status } : c));
      }
      alert(err.message || 'Network error updating category status.');
    }
  };

  // Quick Move Up/Down Reorder
  const handleMoveOrder = async (item: ServiceCategory | BlogCategory, direction: 'up' | 'down') => {
    const sorted = [...currentList].sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));
    const currentIndex = sorted.findIndex(c => c.id === item.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const targetItem = sorted[targetIndex];
    const currentOrder = item.sortOrder || (currentIndex + 1);
    const targetOrder = targetItem.sortOrder || (targetIndex + 1);

    // Optimistic swap
    if (activeSubTab === 'services') {
      setLocalCategories(prev => prev.map(c => {
        if (c.id === item.id) return { ...c, sortOrder: targetOrder };
        if (c.id === targetItem.id) return { ...c, sortOrder: currentOrder };
        return c;
      }));
    } else {
      setLocalBlogCategories(prev => prev.map(c => {
        if (c.id === item.id) return { ...c, sortOrder: targetOrder };
        if (c.id === targetItem.id) return { ...c, sortOrder: currentOrder };
        return c;
      }));
    }

    const endpoint = activeSubTab === 'services' ? '/api/admin/categories' : '/api/admin/blog-categories';

    try {
      await Promise.all([
        adminFetch(`${endpoint}/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: { ...item, sortOrder: targetOrder } })
        }),
        adminFetch(`${endpoint}/${targetItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: { ...targetItem, sortOrder: currentOrder } })
        })
      ]);

      invalidateAllCatalogsCache();
      triggerAlert(`Reordered categories.`);
      onRefreshCatalogs?.();
    } catch (err: any) {
      alert('Error updating category sort orders.');
    }
  };

  // Open Delete Reassignment Modal
  const handleOpenDelete = (item: ServiceCategory | BlogCategory) => {
    if (currentList.length <= 1) {
      alert(`Cannot delete the last remaining ${activeSubTab === 'services' ? 'service' : 'blog'} category.`);
      return;
    }

    const linkedCount = countMap[item.id] || 0;
    const remaining = currentList.filter(c => c.id !== item.id);
    const defaultFallback = remaining[0]?.id || '';

    setDeleteModal({
      isOpen: true,
      category: item,
      type: activeSubTab,
      fallbackId: defaultFallback,
      linkedCount
    });
  };

  // Confirm and Execute Delete
  const handleConfirmDelete = async () => {
    if (!deleteModal.category) return;
    const cat = deleteModal.category;
    const endpoint = deleteModal.type === 'services' 
      ? `/api/admin/categories/${cat.id}` 
      : `/api/admin/blog-categories/${cat.id}`;

    try {
      const res = await adminFetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fallbackCategoryId: deleteModal.fallbackId
        })
      });

      const resData = await res.json().catch(() => ({}));
      if (res.ok) {
        if (deleteModal.type === 'services') {
          setLocalCategories(prev => prev.filter(c => c.id !== cat.id));
        } else {
          setLocalBlogCategories(prev => prev.filter(c => c.id !== cat.id));
        }
        invalidateAllCatalogsCache();
        triggerAlert(resData.message || `Category '${cat.name}' deleted successfully.`);
        setDeleteModal({ isOpen: false, category: null, type: 'services', fallbackId: '', linkedCount: 0 });
        onRefreshCatalogs?.();
      } else {
        alert(resData.message || 'Failed to delete category.');
      }
    } catch (err: any) {
      alert(err.message || 'Network error deleting category.');
    }
  };

  return (
    <div id="category-management-admin-module" className="space-y-6 animate-in fade-in duration-150 font-sans text-slate-800">
      
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Central Master Taxonomy
            </span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Live Synchronized
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
            Category Management System
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Centrally define, structure, sort, and activate/deactivate Service and Blog categories across EasyDesk without hardcoded duplicates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onRefreshCatalogs?.()}
            title="Refresh database catalogs"
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleOpenAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-2xl flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add {activeSubTab === 'services' ? 'Service' : 'Blog'} Category</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs: Service Categories vs Blog Categories */}
      <div className="grid grid-cols-2 sm:flex bg-slate-200/70 p-1 rounded-2xl w-full sm:w-fit gap-1">
        <button
          onClick={() => {
            setActiveSubTab('services');
            setSearchQuery('');
            setStatusFilter('ALL');
          }}
          className={`flex items-center justify-center gap-2 px-3 sm:px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubTab === 'services'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Briefcase className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="truncate">Service Categories</span>
          <span className="bg-blue-50 text-blue-700 text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-full border border-blue-200 shrink-0">
            {categories.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveSubTab('blogs');
            setSearchQuery('');
            setStatusFilter('ALL');
          }}
          className={`flex items-center justify-center gap-2 px-3 sm:px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeSubTab === 'blogs'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Bookmark className="w-4 h-4 text-purple-600 shrink-0" />
          <span className="truncate">Blog Categories</span>
          <span className="bg-purple-50 text-purple-700 text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-full border border-purple-200 shrink-0">
            {blogCategories.length}
          </span>
        </button>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white border border-slate-200/60 p-3 sm:p-4.5 rounded-2xl shadow-sm">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Total Categories</span>
          <p className="text-lg sm:text-xl font-black text-slate-900 mt-1">{totalCategories}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block truncate">{activeSubTab === 'services' ? 'Service classifications' : 'Editorial topics'}</span>
        </div>

        <div className="bg-white border border-slate-200/60 p-3 sm:p-4.5 rounded-2xl shadow-sm">
          <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider block">Active Status</span>
          <p className="text-lg sm:text-xl font-black text-emerald-600 mt-1">{activeCount}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block truncate">Visible to citizens</span>
        </div>

        <div className="bg-white border border-slate-200/60 p-3 sm:p-4.5 rounded-2xl shadow-sm">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Inactive / Draft</span>
          <p className="text-lg sm:text-xl font-black text-slate-600 mt-1">{inactiveCount}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block truncate">Hidden from catalog</span>
        </div>

        <div className="bg-white border border-slate-200/60 p-3 sm:p-4.5 rounded-2xl shadow-sm">
          <span className="text-[9px] text-blue-600 font-bold uppercase tracking-wider block truncate">
            {activeSubTab === 'services' ? 'Total Services' : 'Total Articles'}
          </span>
          <p className="text-lg sm:text-xl font-black text-blue-700 mt-1">{totalLinkedItems}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block truncate">Catalog items mapped</span>
        </div>
      </div>

      {/* Controls: Search, Filter, Sort, View Toggle */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row gap-3 sm:gap-4 items-stretch md:items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeSubTab === 'services' ? 'service' : 'blog'} categories by name, slug...`}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter, Sort, and View options */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto">
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-500 font-medium hidden sm:inline">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full sm:w-auto border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-500 font-bold"
              >
                <option value="ALL">All Status</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Inactive Only</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-500 font-medium hidden sm:inline">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full sm:w-auto border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-500 font-bold"
              >
                <option value="order">Sort Order</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="items-desc">Most Items</option>
              </select>
            </div>
          </div>

          {/* View Mode Toggle: Cards vs Table */}
          <div className="flex items-center justify-end gap-1 bg-slate-100 p-1 rounded-xl shrink-0 self-end sm:self-auto">
            <button
              onClick={() => setViewMode('cards')}
              title="Card View (Mobile Optimized)"
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                viewMode === 'cards' || (viewMode === 'auto' && true)
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden sm:inline">Cards</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Table View (Detailed)"
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                viewMode === 'table'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden sm:inline">Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category Board Container */}
      <div className="bg-white border border-slate-200/60 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden">
        
        {/* MOBILE CARD VIEW: Rendered on phones or when Cards mode is selected */}
        <div className={`${viewMode === 'table' ? 'hidden' : viewMode === 'cards' ? 'block' : 'block sm:hidden'} p-3 sm:p-4 space-y-3`}>
          {processedCategories.length === 0 ? (
            <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-slate-200/80">
              <Folder className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700 text-sm">No categories found</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your search or add a new category above.</p>
            </div>
          ) : (
            processedCategories.map((item, index) => {
              const linkedCount = countMap[item.id] || 0;
              const isInactive = item.status === 'Inactive';

              return (
                <div 
                  key={item.id} 
                  className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3 transition hover:border-slate-300"
                >
                  {/* Top row: Order, Icon, Title, Color, Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${getColorClass(item.color)}`}>
                        {renderIcon(item.icon, 'w-4 h-4')}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            #{item.sortOrder || index + 1}
                          </span>
                          <h4 className={`font-black text-sm break-words ${isInactive ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                            {item.name}
                          </h4>
                          {item.color && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase font-mono font-bold">
                              {item.color}
                            </span>
                          )}
                        </div>
                        {item.description ? (
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-300 italic mt-0.5">No description provided</p>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border shrink-0 ${
                        !isInactive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${!isInactive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {!isInactive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Middle row: Slug ID & Linked Services / Articles */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Slug:</span>
                      <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded-md text-slate-700 font-bold border border-slate-200 break-all">
                        {item.slug || item.id}
                      </span>
                    </div>

                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                      linkedCount > 0 
                        ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      <Layers className="w-3.5 h-3.5" />
                      <span>{linkedCount} {activeSubTab === 'services' ? 'services' : 'articles'}</span>
                    </span>
                  </div>

                  {/* Actions row: Reorder controls + 1-Click Activate/Deactivate + Edit + Delete */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap">
                    {/* Reorder Buttons */}
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                      <button
                        onClick={() => handleMoveOrder(item, 'up')}
                        disabled={index === 0}
                        title="Move Up"
                        className="p-1 rounded-lg hover:bg-white text-slate-600 hover:text-blue-600 disabled:opacity-20 cursor-pointer transition"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] font-mono font-bold text-slate-400 px-1">Pos</span>
                      <button
                        onClick={() => handleMoveOrder(item, 'down')}
                        disabled={index === processedCategories.length - 1}
                        title="Move Down"
                        className="p-1 rounded-lg hover:bg-white text-slate-600 hover:text-blue-600 disabled:opacity-20 cursor-pointer transition"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Action buttons with clear touch targets */}
                    <div className="flex items-center gap-1.5">
                      {/* Activate / Deactivate Toggle Button */}
                      {!isInactive ? (
                        <button
                          onClick={() => handleToggleStatus(item)}
                          title="Click to deactivate"
                          className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <PowerOff className="w-3.5 h-3.5 text-amber-600" />
                          <span>Deactivate</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus(item)}
                          title="Click to activate"
                          className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Power className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Activate</span>
                        </button>
                      )}

                      {/* Edit button */}
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-2 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 rounded-xl transition cursor-pointer border border-slate-200"
                        title="Edit Category"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={() => handleOpenDelete(item)}
                        className="p-2 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-xl transition cursor-pointer border border-slate-200"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP TABLE VIEW: Rendered on tablets/desktops or when Table mode is selected */}
        <div className={`${viewMode === 'cards' ? 'hidden' : viewMode === 'table' ? 'block' : 'hidden sm:block'} overflow-x-auto text-xs`}>
          <table className="w-full min-w-[720px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                <th className="p-3.5 w-14 text-center">Order</th>
                <th className="p-3.5">Category Details</th>
                <th className="p-3.5">Slug ID</th>
                <th className="p-3.5">Linked {activeSubTab === 'services' ? 'Services' : 'Articles'}</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {processedCategories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <Folder className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700 text-sm">No categories found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your search or add a new category above.</p>
                  </td>
                </tr>
              ) : (
                processedCategories.map((item, index) => {
                  const linkedCount = countMap[item.id] || 0;
                  const isInactive = item.status === 'Inactive';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition group">
                      
                      {/* Sort Order & Reorder arrows */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-mono font-bold text-slate-500 w-5">
                            {item.sortOrder || index + 1}
                          </span>
                          <div className="flex flex-col opacity-30 group-hover:opacity-100 transition">
                            <button
                              onClick={() => handleMoveOrder(item, 'up')}
                              disabled={index === 0}
                              title="Move Up"
                              className="hover:text-blue-600 disabled:opacity-20 cursor-pointer"
                            >
                              <MoveUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleMoveOrder(item, 'down')}
                              disabled={index === processedCategories.length - 1}
                              title="Move Down"
                              className="hover:text-blue-600 disabled:opacity-20 cursor-pointer"
                            >
                              <MoveDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Name & Icon & Description */}
                      <td className="p-3.5">
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${getColorClass(item.color)}`}>
                            {renderIcon(item.icon, 'w-4 h-4')}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`font-black text-sm ${isInactive ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                {item.name}
                              </span>
                              {item.color && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-500 uppercase font-mono font-bold">
                                  {item.color}
                                </span>
                              )}
                            </div>
                            {item.description ? (
                              <p className="text-[11px] text-slate-500 mt-0.5 max-w-md line-clamp-1">{item.description}</p>
                            ) : (
                              <p className="text-[10px] text-slate-300 italic">No description provided</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Slug ID */}
                      <td className="p-3.5">
                        <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded-md text-slate-600 font-bold border border-slate-200">
                          {item.slug || item.id}
                        </span>
                      </td>

                      {/* Linked Items Count */}
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold ${
                          linkedCount > 0 
                            ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          <Layers className="w-3.5 h-3.5" />
                          <span>{linkedCount} {activeSubTab === 'services' ? 'services' : 'articles'}</span>
                        </span>
                      </td>

                      {/* Status Column */}
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${
                            item.status !== 'Inactive'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {item.status !== 'Inactive' ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0"></span>
                              <span>Inactive</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Actions Column */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Dynamic 1-Click Activate / Deactivate Button */}
                          {item.status !== 'Inactive' ? (
                            <button
                              onClick={() => handleToggleStatus(item)}
                              title="Click to deactivate this category"
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <PowerOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Deactivate</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(item)}
                              title="Click to activate this category"
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <Power className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Activate</span>
                            </button>
                          )}

                          {/* Edit Button */}
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl transition cursor-pointer border border-slate-200"
                            title="Edit Category"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleOpenDelete(item)}
                            className="p-1.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-xl transition cursor-pointer border border-slate-200"
                            title="Delete Category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-blue-600 tracking-wider">
                  {activeSubTab === 'services' ? 'Service Taxonomy' : 'Blog Taxonomy'}
                </span>
                <h3 className="font-black text-lg text-slate-900 mt-0.5">
                  {isEditing ? 'Edit Category' : 'Create New Category'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium">
              
              {/* Category Name */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Government Documents, Legal Services"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 bg-slate-50/50 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Slug Identifier */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                  Slug / Unique ID *
                </label>
                <input
                  type="text"
                  required
                  disabled={isEditing}
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  placeholder="e.g. gov-docs, legal-services"
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 bg-slate-50/50 text-slate-800 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-60"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Used in database relations and URL routing.</span>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief summary of services or articles categorized under this group..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 bg-slate-50/50 text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Icon Selection */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1.5">
                  Select Visual Icon
                </label>
                <div className="grid grid-cols-5 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50/80 rounded-2xl border border-slate-200">
                  {AVAILABLE_ICONS.map(item => {
                    const IconC = item.icon;
                    const isSelected = formData.icon === item.name;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon: item.name })}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border text-[10px] transition cursor-pointer ${
                          isSelected 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <IconC className="w-4 h-4 mb-1" />
                        <span className="text-[8px] truncate max-w-full font-mono">{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1.5">
                  Badge Color Palette
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_COLORS.map(c => {
                    const isSelected = formData.color === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: c.value })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? `${c.badgeClass} ring-2 ring-blue-500/40 font-black`
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full ${c.bgClass}`} />
                        <span>{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sort Order & Status */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                    Display Sort Order
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 text-xs font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                    Catalog Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 text-xs font-bold focus:outline-none focus:border-blue-500"
                  >
                    <option value="Active">Active (Visible)</option>
                    <option value="Inactive">Inactive (Hidden)</option>
                  </select>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{isEditing ? 'Update Category' : 'Create Category'}</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Delete & Safe Reassignment Modal */}
      {deleteModal.isOpen && deleteModal.category && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-black text-lg text-slate-900">
                Delete Category '{deleteModal.category.name}'?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                This action will permanently remove this category from the database.
              </p>
            </div>

            {deleteModal.linkedCount > 0 ? (
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl space-y-2 text-xs">
                <p className="font-bold text-amber-900">
                  ⚠️ {deleteModal.linkedCount} {deleteModal.type === 'services' ? 'service(s)' : 'article(s)'} currently linked to this category!
                </p>
                <p className="text-amber-800 text-[11px]">
                  Select a fallback category below to automatically reassign those records so they are not orphaned:
                </p>
                <select
                  value={deleteModal.fallbackId}
                  onChange={(e) => setDeleteModal({ ...deleteModal, fallbackId: e.target.value })}
                  className="w-full border border-amber-300 rounded-xl px-3 py-2 bg-white text-xs font-bold text-slate-900"
                >
                  {currentList
                    .filter(c => c.id !== deleteModal.category?.id)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        Reassign to: {c.name} ({c.id})
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                No active services or articles are linked to this category. It can be removed cleanly.
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, category: null, type: 'services', fallbackId: '', linkedCount: 0 })}
                className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm transition cursor-pointer"
              >
                Confirm Delete & Reassign
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
