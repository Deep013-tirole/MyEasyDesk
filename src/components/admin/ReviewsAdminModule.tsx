import React, { useState, useEffect } from 'react';
import { 
  Star, CheckCircle2, XCircle, EyeOff, Trash2, MessageSquare, 
  Search, Filter, ShieldCheck, Clock, AlertCircle, Plus, RefreshCw, X, Edit3, Sparkles, User, Tag
} from 'lucide-react';
import { Review } from '../../types';
import { apiFetch } from '../../lib/apiClient.js';
import { invalidateReviewsCache, getCachedCatalog, CATALOG_CACHE_KEYS } from '../../services/catalogService.js';

interface ReviewsAdminModuleProps {
  initialReviews?: Review[];
  onReviewsChange?: (reviews: Review[]) => void;
  onRefreshCatalogs?: () => void;
}

export default function ReviewsAdminModule({ initialReviews, onReviewsChange, onRefreshCatalogs }: ReviewsAdminModuleProps = {}) {
  const [reviews, setReviews] = useState<Review[]>(() => 
    initialReviews || getCachedCatalog<Review[]>(CATALOG_CACHE_KEYS.REVIEWS, [])
  );
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Approved' | 'Rejected' | 'Hidden' | 'Demo' | 'Customer'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number>(0); // 0 = all
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Reject Modal state
  const [rejectModalReview, setRejectModalReview] = useState<Review | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState('');

  // Edit Review Modal state
  const [editModalReview, setEditModalReview] = useState<Review | null>(null);
  const [editReviewForm, setEditReviewForm] = useState({
    customerName: '',
    serviceTitle: '',
    rating: 5,
    reviewText: '',
    status: 'Approved' as 'Pending' | 'Approved' | 'Rejected' | 'Hidden',
    isVerifiedOrder: true,
    isDemo: false,
    adminNote: '',
    orderId: ''
  });

  // Add New Manual Review Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newReviewForm, setNewReviewForm] = useState({
    customerName: '',
    serviceName: '',
    rating: 5,
    reviewText: '',
    status: 'Approved' as 'Pending' | 'Approved' | 'Rejected' | 'Hidden',
    isVerifiedOrder: true,
    isDemo: false,
    orderId: ''
  });

  const fetchReviews = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/admin/reviews');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setReviews(data);
          if (onReviewsChange) onReviewsChange(data);
          return;
        }
      }
      
      // Fallback to initialReviews if offline
      if (initialReviews && initialReviews.length > 0) {
        setReviews(initialReviews);
      }
    } catch (err: any) {
      if (initialReviews && initialReviews.length > 0) {
        setReviews(initialReviews);
      } else {
        const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
        if (!isOffline) {
          setErrorMsg(err?.message || 'Error fetching reviews.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: 'Pending' | 'Approved' | 'Rejected' | 'Hidden', note?: string) => {
    setStatusMsg('');
    setErrorMsg('');
    try {
      const res = await apiFetch(`/api/admin/reviews/${id}/status`, {
        method: 'PATCH',
        body: {
          status: newStatus,
          adminNote: note
        }
      });

      if (res.ok) {
        invalidateReviewsCache();
        setStatusMsg(`Review status updated to "${newStatus}". Changes will reflect immediately across all customer views.`);
        await fetchReviews();
        onRefreshCatalogs?.();
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(errData.message || 'Failed to update review status.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error updating status.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this customer review?')) return;
    setStatusMsg('');
    setErrorMsg('');
    try {
      const res = await apiFetch(`/api/admin/reviews/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        invalidateReviewsCache();
        setStatusMsg('Review deleted successfully.');
        await fetchReviews();
        onRefreshCatalogs?.();
      } else {
        setErrorMsg('Failed to delete review.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error deleting review.');
    }
  };

  const openEditModal = (review: Review) => {
    setEditModalReview(review);
    setEditReviewForm({
      customerName: review.customerName || review.userName || '',
      serviceTitle: review.serviceTitle || review.serviceName || 'General Document Service',
      rating: review.rating || 5,
      reviewText: review.reviewText || review.comment || '',
      status: (review.status || 'Approved') as any,
      isVerifiedOrder: review.isVerifiedOrder ?? review.isVerified ?? false,
      isDemo: Boolean(review.isDemo),
      adminNote: review.adminNote || '',
      orderId: review.orderId || ''
    });
  };

  const handleEditReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalReview) return;

    if (!editReviewForm.customerName.trim() || !editReviewForm.reviewText.trim()) {
      setErrorMsg('Customer name and feedback review text cannot be empty.');
      return;
    }

    try {
      const res = await apiFetch(`/api/admin/reviews/${editModalReview.id}`, {
        method: 'PUT',
        body: {
          customerName: editReviewForm.customerName.trim(),
          userName: editReviewForm.customerName.trim(),
          serviceTitle: editReviewForm.serviceTitle.trim(),
          serviceName: editReviewForm.serviceTitle.trim(),
          rating: Number(editReviewForm.rating),
          reviewText: editReviewForm.reviewText.trim(),
          comment: editReviewForm.reviewText.trim(),
          status: editReviewForm.status,
          isVerifiedOrder: editReviewForm.isVerifiedOrder,
          isVerified: editReviewForm.isVerifiedOrder,
          isDemo: editReviewForm.isDemo,
          adminNote: editReviewForm.adminNote.trim(),
          orderId: editReviewForm.orderId.trim() || undefined
        }
      });

      if (res.ok) {
        invalidateReviewsCache();
        setStatusMsg(`Review "${editReviewForm.customerName}" updated successfully! Changes are synchronized live to the public website.`);
        setEditModalReview(null);
        await fetchReviews();
        onRefreshCatalogs?.();
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(errData.message || 'Failed to update review details.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error saving review modifications.');
    }
  };

  const handleAddReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewForm.customerName.trim() || !newReviewForm.reviewText.trim()) {
      setErrorMsg('Customer name and review text are required.');
      return;
    }

    try {
      const res = await apiFetch('/api/admin/reviews', {
        method: 'POST',
        body: {
          ...newReviewForm,
          serviceTitle: newReviewForm.serviceName,
          comment: newReviewForm.reviewText
        }
      });

      if (res.ok) {
        invalidateReviewsCache();
        setStatusMsg('New review created successfully and synchronized live.');
        setShowAddModal(false);
        setNewReviewForm({
          customerName: '',
          serviceName: '',
          rating: 5,
          reviewText: '',
          status: 'Approved',
          isVerifiedOrder: true,
          isDemo: false,
          orderId: ''
        });
        await fetchReviews();
        onRefreshCatalogs?.();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.message || 'Failed to create review.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error creating review.');
    }
  };

  // Filtered reviews calculation
  const filteredReviews = reviews.filter(r => {
    const rStatus = r.status || (r.isVerified ? 'Approved' : 'Pending');
    
    // Status / Type filter
    if (filterStatus === 'Demo' && !r.isDemo) return false;
    if (filterStatus === 'Customer' && r.isDemo) return false;
    if (!['All', 'Demo', 'Customer'].includes(filterStatus) && rStatus.toLowerCase() !== filterStatus.toLowerCase()) {
      return false;
    }

    // Rating filter
    if (ratingFilter > 0 && Math.round(r.rating) !== ratingFilter) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const id = (r.id || r.reviewId || '').toLowerCase();
      const name = (r.customerName || r.userName || '').toLowerCase();
      const text = (r.reviewText || r.comment || '').toLowerCase();
      const service = (r.serviceName || r.serviceTitle || '').toLowerCase();
      const order = (r.orderId || '').toLowerCase();
      return id.includes(q) || name.includes(q) || text.includes(q) || service.includes(q) || order.includes(q);
    }

    return true;
  });

  // Count badges
  const pendingCount = reviews.filter(r => (r.status || 'Pending').toLowerCase() === 'pending').length;
  const approvedCount = reviews.filter(r => (r.status || '').toLowerCase() === 'approved' || (!r.status && r.isVerified)).length;
  const rejectedCount = reviews.filter(r => (r.status || '').toLowerCase() === 'rejected').length;
  const hiddenCount = reviews.filter(r => (r.status || '').toLowerCase() === 'hidden').length;
  const demoCount = reviews.filter(r => Boolean(r.isDemo)).length;
  const customerCount = reviews.filter(r => !r.isDemo).length;

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Customer Reviews & Testimonials Moderation</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Review, edit demo testimonials, approve customer feedback, and manage live published reviews with instant data synchronization.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              invalidateReviewsCache();
              fetchReviews();
              onRefreshCatalogs?.();
            }}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition cursor-pointer border border-slate-200 flex items-center gap-1.5 text-xs font-semibold"
            title="Refresh List & Clear Cache"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Live</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-2 shadow-sm shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" /> Add Review / Testimonial
          </button>
        </div>
      </div>

      {/* Notifications */}
      {statusMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterStatus('All')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                filterStatus === 'All'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({reviews.length})
            </button>

            <button
              onClick={() => setFilterStatus('Pending')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                filterStatus === 'Pending'
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Pending ({pendingCount})
              {pendingCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setFilterStatus('Approved')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                filterStatus === 'Approved'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approved ({approvedCount})
            </button>

            <button
              onClick={() => setFilterStatus('Demo')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                filterStatus === 'Demo'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Demo Reviews ({demoCount})
            </button>

            <button
              onClick={() => setFilterStatus('Customer')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                filterStatus === 'Customer'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Real Customer ({customerCount})
            </button>

            <button
              onClick={() => setFilterStatus('Rejected')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                filterStatus === 'Rejected'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              Rejected ({rejectedCount})
            </button>

            <button
              onClick={() => setFilterStatus('Hidden')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                filterStatus === 'Hidden'
                  ? 'bg-slate-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              Hidden ({hiddenCount})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Rating:
            </label>
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(Number(e.target.value))}
              className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value={0}>All Stars</option>
              <option value={5}>5 Stars ★★★★★</option>
              <option value={4}>4 Stars ★★★★</option>
              <option value={3}>3 Stars ★★★</option>
              <option value={2}>2 Stars ★★</option>
              <option value={1}>1 Star ★</option>
            </select>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by review ID, customer name, review feedback text, service name or order ID..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Reviews List Grid / Cards */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-xs font-medium text-slate-500">Loading customer reviews...</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-2">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No Reviews Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery || filterStatus !== 'All' || ratingFilter > 0
              ? 'No customer reviews match your filter parameters. Try clearing your search filters.'
              : 'No reviews have been submitted yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredReviews.map((review) => {
            const currentStatus = review.status || (review.isVerified ? 'Approved' : 'Pending');
            const name = review.customerName || review.userName || 'Anonymous Customer';
            const commentText = review.reviewText || review.comment || '';
            const serviceName = review.serviceName || review.serviceTitle || 'General Service';
            const isVerified = review.isVerifiedOrder ?? review.isVerified ?? false;

            return (
              <div
                key={review.id}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-sm transition space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border ${
                      review.isDemo ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-blue-100 text-blue-800 border-blue-200'
                    }`}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{name}</span>
                        
                        {review.isDemo && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                            <Sparkles className="w-3 h-3 text-purple-600" /> Demo Review
                          </span>
                        )}

                        {isVerified && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" /> Verified Order
                          </span>
                        )}

                        {review.orderId && (
                          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
                            Order #{review.orderId}
                          </span>
                        )}

                        <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                          ID: {review.id}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Service: <span className="font-semibold text-slate-700">{serviceName}</span> • Submitted: {new Date(review.createdAt || review.date || Date.now()).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0 flex items-center gap-2">
                    {currentStatus === 'Pending' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Approval
                      </span>
                    )}
                    {currentStatus === 'Approved' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Approved & Public
                      </span>
                    )}
                    {currentStatus === 'Rejected' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" /> Rejected
                      </span>
                    )}
                    {currentStatus === 'Hidden' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-slate-200 text-slate-800 border border-slate-300">
                        <EyeOff className="w-3.5 h-3.5 text-slate-600" /> Hidden
                      </span>
                    )}
                  </div>
                </div>

                {/* Rating & Review Comment */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= review.rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-200 fill-slate-100'
                        }`}
                      />
                    ))}
                    <span className="text-xs font-extrabold text-slate-700 ml-1.5">
                      {review.rating}.0 / 5.0
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/60 p-3 rounded-xl border border-slate-100 font-serif italic">
                    "{commentText}"
                  </p>

                  {review.adminNote && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Admin Moderation Note:</span> {review.adminNote}
                      </div>
                    </div>
                  )}
                </div>

                {/* Moderation Controls */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[10px] text-slate-400">
                    {review.approvedAt && (
                      <span>Approved by {review.approvedBy || 'Admin'} on {new Date(review.approvedAt).toLocaleDateString()}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => openEditModal(review)}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit Review
                    </button>

                    {currentStatus !== 'Approved' && (
                      <button
                        onClick={() => handleUpdateStatus(review.id, 'Approved')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm shadow-emerald-500/10"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Publish
                      </button>
                    )}

                    {currentStatus !== 'Rejected' && (
                      <button
                        onClick={() => {
                          setRejectModalReview(review);
                          setAdminNoteInput(review.adminNote || '');
                        }}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    )}

                    {currentStatus !== 'Hidden' && currentStatus === 'Approved' && (
                      <button
                        onClick={() => handleUpdateStatus(review.id, 'Hidden')}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                      >
                        <EyeOff className="w-3.5 h-3.5" /> Hide
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(review.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                      title="Delete Review"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Review Modal */}
      {editModalReview && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-600" /> Edit Review ({editModalReview.id})
              </h3>
              <button
                onClick={() => setEditModalReview(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditReviewSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editReviewForm.customerName}
                    onChange={(e) => setEditReviewForm({ ...editReviewForm, customerName: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Service Name
                  </label>
                  <input
                    type="text"
                    value={editReviewForm.serviceTitle}
                    onChange={(e) => setEditReviewForm({ ...editReviewForm, serviceTitle: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Linked Order ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={editReviewForm.orderId}
                    onChange={(e) => setEditReviewForm({ ...editReviewForm, orderId: e.target.value })}
                    placeholder="e.g. ORD-10021"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Publication Status
                  </label>
                  <select
                    value={editReviewForm.status}
                    onChange={(e) => setEditReviewForm({ ...editReviewForm, status: e.target.value as any })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="Approved">Approved (Live on Website)</option>
                    <option value="Pending">Pending Approval</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Hidden">Hidden</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Star Rating (1–5)
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setEditReviewForm({ ...editReviewForm, rating: star })}
                      className="text-amber-400 hover:scale-110 transition cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= editReviewForm.rating ? 'fill-amber-400' : 'text-slate-200'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-slate-600 ml-2">
                    {editReviewForm.rating} Stars
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Review / Feedback *
                </label>
                <textarea
                  required
                  rows={4}
                  value={editReviewForm.reviewText}
                  onChange={(e) => setEditReviewForm({ ...editReviewForm, reviewText: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Admin Moderation Note (Internal)
                </label>
                <input
                  type="text"
                  value={editReviewForm.adminNote}
                  onChange={(e) => setEditReviewForm({ ...editReviewForm, adminNote: e.target.value })}
                  placeholder="Optional internal comment or verification notes..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editReviewForm.isVerifiedOrder}
                    onChange={(e) => setEditReviewForm({ ...editReviewForm, isVerifiedOrder: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  Mark as Verified Order
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editReviewForm.isDemo}
                    onChange={(e) => setEditReviewForm({ ...editReviewForm, isDemo: e.target.checked })}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                  />
                  Mark as Demo / Preseeded Review
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalReview(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2 rounded-xl transition cursor-pointer shadow-sm shadow-blue-500/20"
                >
                  Save & Publish Live Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalReview && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" /> Reject Customer Review
              </h3>
              <button
                onClick={() => setRejectModalReview(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              You are rejecting the review from <span className="font-bold text-slate-800">{rejectModalReview.customerName || rejectModalReview.userName}</span>. You can optionally add an internal moderation note explaining why.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Moderation Note (Optional)
              </label>
              <textarea
                rows={3}
                value={adminNoteInput}
                onChange={(e) => setAdminNoteInput(e.target.value)}
                placeholder="E.g., Contains inappropriate language, inaccurate service claims, or duplicate entry..."
                className="w-full border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectModalReview(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleUpdateStatus(rejectModalReview.id, 'Rejected', adminNoteInput);
                  setRejectModalReview(null);
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer shadow-sm shadow-rose-500/20"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Testimonial / Review Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" /> Add Testimonial / Review
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddReviewSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newReviewForm.customerName}
                    onChange={(e) => setNewReviewForm({ ...newReviewForm, customerName: e.target.value })}
                    placeholder="E.g., Ramesh Kumar"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Service Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={newReviewForm.serviceName}
                    onChange={(e) => setNewReviewForm({ ...newReviewForm, serviceName: e.target.value })}
                    placeholder="E.g., New PAN Card Assistance"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Star Rating (1–5)
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setNewReviewForm({ ...newReviewForm, rating: star })}
                      className="text-amber-400 hover:scale-110 transition cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= newReviewForm.rating ? 'fill-amber-400' : 'text-slate-200'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-slate-600 ml-2">
                    {newReviewForm.rating} Stars
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Review Content / Feedback *
                </label>
                <textarea
                  required
                  rows={3}
                  value={newReviewForm.reviewText}
                  onChange={(e) => setNewReviewForm({ ...newReviewForm, reviewText: e.target.value })}
                  placeholder="Customer feedback details..."
                  className="w-full border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Initial Status
                  </label>
                  <select
                    value={newReviewForm.status}
                    onChange={(e) => setNewReviewForm({ ...newReviewForm, status: e.target.value as any })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="Approved">Approved (Public)</option>
                    <option value="Pending">Pending</option>
                    <option value="Hidden">Hidden</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={newReviewForm.isVerifiedOrder}
                      onChange={(e) => setNewReviewForm({ ...newReviewForm, isVerifiedOrder: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    Mark as Verified Order
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2 rounded-xl transition cursor-pointer shadow-sm shadow-blue-500/20"
                >
                  Save Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
