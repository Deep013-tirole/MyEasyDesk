import React, { useState, useEffect } from 'react';
import { 
  Star, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  FileText, 
  User, 
  Package, 
  ShieldCheck, 
  Sparkles,
  Clock,
  RotateCcw
} from 'lucide-react';
import { Service, Review } from '../types.js';
import { apiFetch, safeParseJsonResponse } from '../lib/apiClient.js';
import { getClientServices } from '../lib/apiDataService.js';

interface ReviewSubmissionFormProps {
  initialCustomerId?: string;
  initialCustomerName?: string;
  initialOrderId?: string;
  initialServiceId?: string;
  onSuccess?: (review: Review) => void;
  onCancel?: () => void;
  isModal?: boolean;
}

export default function ReviewSubmissionForm({
  initialCustomerId = '',
  initialCustomerName = '',
  initialOrderId = '',
  initialServiceId = '',
  onSuccess,
  onCancel,
  isModal = false
}: ReviewSubmissionFormProps) {
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [orderId, setOrderId] = useState(initialOrderId);
  const [serviceId, setServiceId] = useState(initialServiceId);
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState('');
  
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedReview, setSubmittedReview] = useState<Review | null>(null);

  // Fetch available services for the dropdown
  useEffect(() => {
    let isMounted = true;
    async function loadServices() {
      setLoadingServices(true);
      try {
        const res = await fetch(`/api/services?_t=${Date.now()}`);
        if (res.ok) {
          const data = await safeParseJsonResponse<any[]>(res);
          if (Array.isArray(data) && data.length > 0 && isMounted) {
            setServices(data);
            if (!serviceId && !initialServiceId) {
              setServiceId(data[0].id);
            }
            return;
          }
        }
      } catch {}

      // Direct API service fallback on 404 or network failure
      try {
        if (typeof navigator === 'undefined' || navigator.onLine !== false) {
          const fsServices = await getClientServices();
          if (Array.isArray(fsServices) && fsServices.length > 0 && isMounted) {
            setServices(fsServices);
            if (!serviceId && !initialServiceId) {
              setServiceId(fsServices[0].id);
            }
          }
        }
      } catch {} finally {
        if (isMounted) setLoadingServices(false);
      }
    }
    loadServices();
    return () => { isMounted = false; };
  }, []);

  // Update fields if initial props change
  useEffect(() => {
    if (initialCustomerId) setCustomerId(initialCustomerId);
    if (initialCustomerName) setCustomerName(initialCustomerName);
    if (initialOrderId) setOrderId(initialOrderId);
    if (initialServiceId) setServiceId(initialServiceId);
  }, [initialCustomerId, initialCustomerName, initialOrderId, initialServiceId]);

  const ratingDescriptions: Record<number, string> = {
    1: '1 Star - Poor Experience',
    2: '2 Stars - Fair / Needs Improvement',
    3: '3 Stars - Satisfactory',
    4: '4 Stars - Very Good Experience',
    5: '5 Stars - Excellent & Highly Recommended'
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Field Validations
    if (!customerId.trim()) {
      setErrorMsg('Customer ID is required. Please provide your customer identifier.');
      return;
    }

    if (!orderId.trim()) {
      setErrorMsg('Order ID is required. Please provide your associated order tracking ID (e.g., ORD-10023).');
      return;
    }

    if (!serviceId.trim()) {
      setErrorMsg('Please select or specify the service you are reviewing.');
      return;
    }

    if (!reviewText.trim()) {
      setErrorMsg('Please share a few words describing your experience with our desk service.');
      return;
    }

    if (reviewText.trim().length < 5) {
      setErrorMsg('Review text must be at least 5 characters long.');
      return;
    }

    setSubmitting(true);

    try {
      const selectedService = services.find(s => s.id === serviceId);
      const payload = {
        customerId: customerId.trim(),
        customerName: customerName.trim() || undefined,
        orderId: orderId.trim(),
        serviceId: serviceId.trim(),
        serviceTitle: selectedService?.title,
        serviceName: selectedService?.title,
        rating: Number(rating),
        reviewText: reviewText.trim(),
        comment: reviewText.trim()
      };

      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save review to database.');
      }

      setSubmittedReview(data.review);
      if (onSuccess) {
        onSuccess(data.review);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while submitting your review.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmittedReview(null);
    setReviewText('');
    setRating(5);
    setErrorMsg('');
  };

  if (submittedReview) {
    const selectedService = services.find(s => s.id === submittedReview.serviceId);
    const serviceNameDisplay = submittedReview.serviceTitle || submittedReview.serviceName || selectedService?.title || submittedReview.serviceId;

    return (
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-lg text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 shadow-sm">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-xs font-bold uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Status: {submittedReview.status || 'Pending'}
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
            Review Submitted!
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            Your review has been securely attached and saved with a <span className="font-semibold text-amber-700">Pending</span> moderation status.
          </p>
        </div>

        {/* Details Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2.5 text-xs text-slate-700">
          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Review ID
            </span>
            <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
              {submittedReview.id || submittedReview.reviewId}
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-600" /> Customer ID
            </span>
            <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
              {submittedReview.customerId}
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-emerald-600" /> Order ID
            </span>
            <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
              {submittedReview.orderId}
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-purple-600" /> Service ID
            </span>
            <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
              {submittedReview.serviceId}
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium">Service Name</span>
            <span className="font-semibold text-slate-900 text-right line-clamp-1 max-w-[200px]">
              {serviceNameDisplay}
            </span>
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500 font-medium">Rating</span>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-3.5 h-3.5 ${
                    i < submittedReview.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                  }`}
                />
              ))}
              <span className="font-bold text-slate-900 ml-1">({submittedReview.rating}/5)</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/60">
            <span className="text-slate-500 font-medium block mb-1">Feedback:</span>
            <p className="italic text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200">
              "{submittedReview.reviewText || submittedReview.comment}"
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> Submit Another Review
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 text-xs font-bold text-white bg-[#0F4C81] hover:bg-[#0c3e69] rounded-xl transition cursor-pointer"
            >
              Done / Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-3xl ${isModal ? '' : 'p-6 sm:p-8 border border-slate-200/80 shadow-md'}`}>
      <div className="mb-6 space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 text-[#0F4C81] rounded-full text-xs font-bold uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0F4C81]" />
          Customer Review Form
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          Share Your Service Experience
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          Submit verified feedback attached to your specific customer and order records. Reviews are stored in the database with a <span className="font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Pending</span> status.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <div className="leading-snug">{errorMsg}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Row 1: Customer ID & Customer Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="review-customer-id" className="block text-xs font-bold text-slate-700 mb-1.5">
              Customer ID <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="review-customer-id"
                name="customerId"
                type="text"
                required
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="e.g. CUST-1001 or cust-1"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#0F4C81] focus:ring-2 focus:ring-blue-100 rounded-xl text-xs text-slate-900 font-medium transition"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Your unique customer registration identifier.</p>
          </div>

          <div>
            <label htmlFor="review-customer-name" className="block text-xs font-bold text-slate-700 mb-1.5">
              Customer Name <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              id="review-customer-name"
              name="customerName"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Jane Doe"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#0F4C81] focus:ring-2 focus:ring-blue-100 rounded-xl text-xs text-slate-900 font-medium transition"
            />
            <p className="text-[10px] text-slate-500 mt-1">Name to display on the review card.</p>
          </div>
        </div>

        {/* Row 2: Order ID & Service ID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="review-order-id" className="block text-xs font-bold text-slate-700 mb-1.5">
              Order ID <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Package className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="review-order-id"
                name="orderId"
                type="text"
                required
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="e.g. ORD-10023 or ORD-10024"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#0F4C81] focus:ring-2 focus:ring-blue-100 rounded-xl text-xs text-slate-900 font-mono font-medium transition"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Tracking ID of your service request.</p>
          </div>

          <div>
            <label htmlFor="review-service-select" className="block text-xs font-bold text-slate-700 mb-1.5">
              Service ID & Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <select
                id="review-service-select"
                name="serviceId"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#0F4C81] focus:ring-2 focus:ring-blue-100 rounded-xl text-xs text-slate-900 font-medium transition cursor-pointer appearance-none"
              >
                <option value="" disabled>Select the service</option>
                {services.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.title} ({svc.id})
                  </option>
                ))}
                {/* Fallback option if custom serviceId entered */}
                {serviceId && !services.some(s => s.id === serviceId) && (
                  <option value={serviceId}>{serviceId}</option>
                )}
              </select>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {loadingServices ? 'Loading catalog services...' : 'The specific service you utilized.'}
            </p>
          </div>
        </div>

        {/* Row 3: Star Rating */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Your Rating <span className="text-red-500">*</span>
          </label>
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const isActive = (hoverRating || rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 rounded-lg hover:scale-110 transition cursor-pointer focus:outline-none"
                  >
                    <Star
                      className={`w-7 h-7 transition-colors ${
                        isActive
                          ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <span className="text-xs font-bold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto">
              {ratingDescriptions[hoverRating || rating]}
            </span>
          </div>
        </div>

        {/* Row 4: Review Text */}
        <div>
          <label htmlFor="review-feedback-content" className="block text-xs font-bold text-slate-700 mb-1.5">
            Review Feedback & Comments <span className="text-red-500">*</span>
          </label>
          <textarea
            id="review-feedback-content"
            name="feedback"
            required
            rows={4}
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Share details about turnaround time, document verification accuracy, officer communication, or overall experience..."
            className="w-full p-3.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#0F4C81] focus:ring-2 focus:ring-blue-100 rounded-2xl text-xs text-slate-900 leading-relaxed transition"
          />
          <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
            <span>Minimum 5 characters.</span>
            <span>{reviewText.length} characters</span>
          </div>
        </div>

        {/* Summary of Metadata Attachment */}
        <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3.5 text-xs text-blue-900 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-xs text-[#0F4C81]">
            <ShieldCheck className="w-4 h-4 text-[#0F4C81]" /> D1 Database Direct Persistence Notice
          </div>
          <p className="text-[11px] text-slate-600 leading-snug">
            This submission automatically binds <span className="font-semibold text-slate-900">{customerId || '[customerId]'}</span>, order <span className="font-semibold text-slate-900">{orderId || '[orderId]'}</span>, and service <span className="font-semibold text-slate-900">{serviceId || '[serviceId]'}</span> together in Cloudflare D1 with initial status <span className="font-bold text-amber-700">"Pending"</span>.
          </p>
        </div>

        {/* Form Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-3 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="px-7 py-3 text-xs font-bold text-white bg-[#0F4C81] hover:bg-[#0c3e69] disabled:bg-slate-400 rounded-xl transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving to Database...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Submit Review (Pending)
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
