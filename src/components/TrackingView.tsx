import React, { useState, useEffect } from 'react';
import { 
  Search, ShieldAlert, CheckCircle2, Clock, RotateCcw, 
  ArrowRight, FileText, UploadCloud, Printer, AlertCircle, RefreshCw,
  Star, MessageSquare, Sparkles, ShieldCheck, X
} from 'lucide-react';
import { Order, OrderStatus } from '../types.js';
import { apiFetch, safeParseJsonResponse } from '../lib/apiClient.js';
import { printElement } from '../lib/printUtils.js';
import ContentUnavailable from './ContentUnavailable.js';

export default function TrackingView() {
  const [orderId, setOrderId] = useState('');
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<Order | null>(null);

  // File upload state for correction request
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [fileError, setFileError] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Customer Review / Rating Submission State
  const [rating, setRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string>('');
  const [reviewErrorMsg, setReviewErrorMsg] = useState<string>('');

  const executeTrack = async (targetId: string, targetMobile: string = '') => {
    if (!targetId.trim()) return;

    setLoading(true);
    setError('');
    setOrder(null);
    setUploadSuccess(false);
    setReviewSuccessMsg('');
    setReviewErrorMsg('');

    try {
      const url = `/api/orders/track?orderId=${encodeURIComponent(targetId.trim())}${targetMobile ? `&mobile=${encodeURIComponent(targetMobile.trim())}` : ''}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await safeParseJsonResponse<Order>(response);
        if (data) {
          setOrder(data);
        } else {
          setError('Invalid tracking record received. Please check with customer support.');
        }
      } else if (response.status === 404) {
        setError('404: No active order found with this identifier. Please verify your Order ID (e.g., ORD-10024) or contact our desk.');
      } else {
        const data = await safeParseJsonResponse<any>(response);
        setError(data?.message || 'Unable to retrieve order status at this time. Please try again.');
      }
    } catch (err) {
      setError('Network connection error. Please verify your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeTrack(orderId, mobile);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryOrderId = params.get('orderId') || params.get('id');
    const queryMobile = params.get('mobile') || '';
    if (queryOrderId) {
      setOrderId(queryOrderId);
      if (queryMobile) setMobile(queryMobile);
      executeTrack(queryOrderId, queryMobile);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setFileBase64('');
      return;
    }

    // 10MB limit enforcement
    const MAX_SIZE_MB = 10;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setFileError(`File exceeds the ${MAX_SIZE_MB}MB maximum upload limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please choose a smaller file.`);
      setSelectedFile(null);
      setFileBase64('');
      return;
    }

    // Safe allowed types: PDF, JPG, JPEG, PNG, WEBP
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/jpg'
    ];
    const isAllowed = allowedTypes.includes(file.type.toLowerCase()) || 
      /\.(pdf|jpe?g|png|webp)$/i.test(file.name);

    if (!isAllowed) {
      setFileError('Invalid file format. Supported file types: PDF, JPG, PNG, WEBP.');
      setSelectedFile(null);
      setFileBase64('');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setFileBase64(reader.result as string);
    };
    reader.onerror = () => {
      setFileError('Failed to read file from device.');
      setSelectedFile(null);
      setFileBase64('');
    };
    reader.readAsDataURL(file);
  };

  const handleCorrectionUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    if (!selectedFile || !fileBase64) {
      setFileError('Please select a document file to upload.');
      return;
    }

    setUploading(true);
    setFileError('');

    try {
      const response = await apiFetch(`/api/orders/${order.id}/upload`, {
        method: 'POST',
        body: {
          docName: selectedFile.name,
          fileData: fileBase64,
          mimeType: selectedFile.type || 'application/pdf',
          mobile: mobile || order.mobile
        }
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setOrder(data);
        setUploadSuccess(true);
        setSelectedFile(null);
        setFileBase64('');
      } else {
        setFileError(data.message || 'Upload correction failed.');
      }
    } catch (err: any) {
      setFileError(err.message || 'Error connecting to verification servers.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    if (!reviewText.trim()) {
      setReviewErrorMsg('Please write a brief feedback sentence about your service experience.');
      return;
    }

    setSubmittingReview(true);
    setReviewErrorMsg('');
    setReviewSuccessMsg('');

    try {
      const response = await apiFetch('/api/reviews', {
        method: 'POST',
        body: {
          orderId: order.id,
          customerId: order.customerId || order.userId,
          customerName: order.name,
          serviceId: order.serviceId,
          serviceTitle: order.serviceTitle,
          serviceName: order.serviceTitle,
          rating: Number(rating),
          reviewText: reviewText.trim(),
          comment: reviewText.trim()
        }
      });

      const data = await safeParseJsonResponse<any>(response);

      if (response.ok) {
        setReviewSuccessMsg('Thank you for rating your experience! Your review has been saved and is currently pending administrator verification.');
        setReviewText('');
        // Update local order state with the newly submitted review
        setOrder({
          ...order,
          submittedReview: {
            id: data?.review?.id || `rev-${Date.now()}`,
            reviewId: data?.review?.id,
            rating: Number(rating),
            reviewText: reviewText.trim(),
            status: 'Pending',
            createdAt: new Date().toISOString()
          }
        });
      } else {
        setReviewErrorMsg(data?.message || 'Failed to submit review. Please try again.');
      }
    } catch (err: any) {
      setReviewErrorMsg('Failed to submit review due to a network connection error.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.COMPLETED: return 'bg-green-100 text-green-800 border-green-200';
      case OrderStatus.PENDING: return 'bg-blue-100 text-blue-800 border-blue-200';
      case OrderStatus.DOCUMENTS_REQUIRED: return 'bg-amber-100 text-amber-800 border-amber-200';
      case OrderStatus.UNDER_VERIFICATION: return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case OrderStatus.PROCESSING: return 'bg-purple-100 text-purple-800 border-purple-200';
      case OrderStatus.REJECTED: return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const timelineSteps = [
    OrderStatus.PENDING,
    OrderStatus.UNDER_VERIFICATION,
    OrderStatus.PROCESSING,
    OrderStatus.COMPLETED
  ];

  const getStepIndex = (current: OrderStatus) => {
    if (current === OrderStatus.DOCUMENTS_REQUIRED) return 1; // Treat as verification pause
    if (current === OrderStatus.REJECTED) return -1;
    return timelineSteps.indexOf(current);
  };

  const handlePrint = () => {
    const trackEl = document.getElementById('easydesk-tracking');
    printElement(trackEl, `EasyDesk-Tracking-Receipt-${order?.id || orderId || 'Receipt'}`);
  };

  const isOrderCompleted = order && (
    order.orderStatus === OrderStatus.COMPLETED || 
    String(order.orderStatus).toLowerCase() === 'completed'
  );

  const getRatingLabel = (stars: number) => {
    switch (stars) {
      case 5: return '⭐⭐⭐⭐⭐ 5.0 - Excellent & Fast Service';
      case 4: return '⭐⭐⭐⭐ 4.0 - Very Good Experience';
      case 3: return '⭐⭐⭐ 3.0 - Good / Satisfactory';
      case 2: return '⭐⭐ 2.0 - Needs Improvement';
      case 1: return '⭐ 1.0 - Poor / Unsatisfactory';
      default: return '';
    }
  };

  return (
    <div id="easydesk-tracking" className="portal-container max-w-5xl py-10 font-sans text-slate-800 print:bg-white print:p-0 w-full max-w-full overflow-x-hidden">
      
      {/* Title */}
      <div className="mb-8 print:hidden">
        <span className="text-[10px] bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-extrabold tracking-widest uppercase">Live Tracking</span>
        <h1 className="text-2xl sm:text-3xl font-black mt-3 text-slate-900">Track Digital Certificate File Status</h1>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-xl">
          Enter your unique Order Reference ID (e.g. ORD-10021) and registered phone number to verify document verification logs, government clearance schedules, rate completed services, and download receipts.
        </p>
      </div>

      {/* Tracking Form card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm mb-8 print:hidden">
        <form onSubmit={handleTrack} className="grid sm:grid-cols-3 gap-4 items-end">
          <div>
            <label htmlFor="track-order-id" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order ID *</label>
            <input
              id="track-order-id"
              name="orderId"
              type="text"
              required
              placeholder="e.g. ORD-10021"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="mt-1.5 w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-600 bg-slate-50/50 font-mono"
            />
          </div>

          <div>
            <label htmlFor="track-mobile-number" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mobile Number (Optional)</label>
            <input
              id="track-mobile-number"
              name="mobile"
              type="tel"
              placeholder="10-digit mobile number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="mt-1.5 w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-600 bg-slate-50/50"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-2xl transition cursor-pointer shadow-md shadow-blue-500/10 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying Records...
                </span>
              ) : (
                <>
                  <Search className="w-4 h-4" /> Fetch Application Status
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          error.includes('404') ? (
            <div className="mt-5">
              <ContentUnavailable
                compact
                id="tracking-not-found-state"
                statusCode={404}
                title="Order Record Unavailable"
                message={error.replace(/^404:\s*/, '')}
                retryText="Try Another ID"
                onRetry={() => {
                  setError('');
                  setOrderId('');
                }}
              />
            </div>
          ) : (
            <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )
        )}
      </div>

      {/* Order Status Display Section (Screen View + Printable Slip) */}
      {order && (
        <>
          <div className="space-y-6 print:hidden">
          
          {/* Header Summary Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900">{order.serviceTitle}</h2>
                  <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border font-semibold">
                    #{order.id}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Applicant: <strong className="text-slate-700">{order.name}</strong> • Lodged on {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-3.5 py-1.5 rounded-full border border-blue-200 flex items-center gap-1.5 transition cursor-pointer"
                  title="Print / Download Official Acknowledgement Receipt"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase border tracking-wider ${getStatusColor(order.orderStatus)}`}>
                  {order.orderStatus === OrderStatus.COMPLETED ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  {order.orderStatus}
                </span>
              </div>
            </div>

            {/* Rejection Notification if rejected */}
            {order.orderStatus === OrderStatus.REJECTED && (
              <div className="mt-4 bg-red-50 border border-red-200 p-4 rounded-2xl flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <h4 className="font-bold text-red-900">Application Not Approved / Rejected</h4>
                  <p className="text-red-700 mt-0.5">{order.rejectionReason || 'The application was rejected due to portal discrepancy.'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Progress Timeline (Steps) */}
          {order.orderStatus !== OrderStatus.REJECTED && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm print:hidden">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Milestone Progress</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                
                {timelineSteps.map((step, idx) => {
                  const currentIdx = getStepIndex(order.orderStatus);
                  const isCompleted = idx <= currentIdx;
                  const isActive = idx === currentIdx;

                  return (
                    <div key={idx} className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border transition-all ${
                        isCompleted 
                          ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/15' 
                          : 'bg-white border-slate-200 text-slate-400'
                      } ${isActive ? 'ring-4 ring-blue-100 scale-105' : ''}`}>
                        {isCompleted ? '✓' : idx + 1}
                      </div>
                      <div>
                        <span className={`block text-[11px] font-bold ${isCompleted ? 'text-blue-700' : 'text-slate-400'}`}>
                          {step}
                        </span>
                        <span className="block text-[9px] text-slate-400">
                          {idx === 0 && 'File Checked'}
                          {idx === 1 && 'Audit Completed'}
                          {idx === 2 && 'Submitted to Govt'}
                          {idx === 3 && 'Dispatched Certificate'}
                        </span>
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* CUSTOMER REVIEW FLOW ZONE (When Order is COMPLETED) */}
          {/* ========================================================================= */}
          {isOrderCompleted && (
            <div className="bg-gradient-to-br from-amber-50/70 via-white to-blue-50/50 border border-amber-200/80 rounded-3xl p-6 shadow-sm print:hidden space-y-4">
              <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                    <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      Rate Your Experience for {order.serviceTitle}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Your service has been delivered! Help future citizens by rating our speed, transparency, and officer support.
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-mono bg-amber-100/70 text-amber-900 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                  Verified Order
                </span>
              </div>

              {/* If customer already has a submitted review for this order */}
              {order.submittedReview ? (
                <div className="bg-white border border-amber-200/60 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-5 h-5 ${
                            s <= order.submittedReview!.rating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-200'
                          }`}
                        />
                      ))}
                      <span className="text-xs font-bold text-slate-700 ml-1.5">
                        {order.submittedReview.rating}.0 / 5.0 Rating Submitted
                      </span>
                    </div>

                    <div>
                      {order.submittedReview.status === 'Approved' ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approved & Live on Website
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-xs font-bold px-3 py-1 rounded-full border border-amber-200">
                          <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Admin Approval
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-100 italic leading-relaxed">
                    "{order.submittedReview.reviewText}"
                  </p>

                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                    <span>Submitted on: {new Date(order.submittedReview.createdAt || Date.now()).toLocaleDateString()}</span>
                    <span>EasyDesk Verified Customer Feedback</span>
                  </div>
                </div>
              ) : (
                /* Interactive Rate & Review Form */
                <form onSubmit={handleSubmitReview} className="space-y-4">
                  {reviewSuccessMsg && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{reviewSuccessMsg}</span>
                    </div>
                  )}

                  {reviewErrorMsg && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{reviewErrorMsg}</span>
                    </div>
                  )}

                  {/* 1-5 Star Picker */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Select Rating (1 to 5 Stars) *
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 bg-white border border-slate-200 px-3 py-2 rounded-2xl shadow-xs">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            type="button"
                            key={s}
                            onClick={() => setRating(s)}
                            className="p-1 text-amber-400 hover:scale-125 transition-transform cursor-pointer focus:outline-none"
                            title={`${s} Star${s > 1 ? 's' : ''}`}
                          >
                            <Star
                              className={`w-7 h-7 ${
                                s <= rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-200 fill-slate-50'
                              }`}
                            />
                          </button>
                        ))}
                      </div>

                      <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-xl">
                        {getRatingLabel(rating)}
                      </span>
                    </div>
                  </div>

                  {/* Feedback Text Area */}
                  <div>
                    <label htmlFor="tracking-review-feedback" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Write Review / Feedback *
                    </label>
                    <textarea
                      id="tracking-review-feedback"
                      name="feedback"
                      required
                      rows={3}
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Share your experience (e.g., Fast certificate delivery, helpful officer communication, smooth Aadhaar verification)..."
                      className="w-full border border-slate-200 rounded-2xl p-3.5 text-xs bg-white focus:outline-none focus:border-amber-500 leading-relaxed shadow-xs"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[10px] text-slate-500">
                      🔒 Verified Order Review: Submitted feedback enters moderation and appears publicly once approved by administrators.
                    </p>

                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition cursor-pointer shadow-sm shadow-amber-500/20 flex items-center gap-2 shrink-0"
                    >
                      {submittingReview ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Submitting...
                        </>
                      ) : (
                        <>
                          <Star className="w-3.5 h-3.5 fill-white" /> Submit Feedback
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Interactive Document Correction Zone (If Documents Required) */}
          {order.orderStatus === OrderStatus.DOCUMENTS_REQUIRED && (
            <div className="bg-amber-50/50 border border-amber-200/60 rounded-3xl p-6 print:hidden">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Documents Correction Required</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Our verification executive रमेश (Ramesh) noted: <strong className="text-slate-800">"{order.logs[order.logs.length - 1]?.comment}"</strong>. Please re-upload the correct scanned document below to proceed with verification.
                  </p>

                  {uploadSuccess ? (
                    <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>Correction uploaded successfully! Status updated to "Under Verification". Our officer will re-audit your documents shortly.</span>
                    </div>
                  ) : (
                    <form onSubmit={handleCorrectionUpload} className="mt-4 space-y-3">
                      {fileError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>{fileError}</span>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <label 
                          htmlFor="correction-file-input"
                          className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 cursor-pointer shadow-xs transition active:scale-95 shrink-0"
                        >
                          <UploadCloud className="w-4 h-4 text-[#0F4C81]" />
                          <span>{selectedFile ? 'Change File' : 'Choose Document / Take Photo'}</span>
                          <input
                            id="correction-file-input"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf"
                            onChange={handleFileChange}
                            className="sr-only"
                          />
                        </label>

                        {selectedFile && (
                          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 min-w-0 max-w-full">
                            <FileText className="w-4 h-4 text-[#0F4C81] shrink-0" />
                            <span className="truncate max-w-[180px] sm:max-w-[240px] font-medium">{selectedFile.name}</span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                            </span>
                            <button
                              type="button"
                              onClick={() => { setSelectedFile(null); setFileBase64(''); setFileError(''); }}
                              className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                              title="Remove selected file"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={uploading || !selectedFile}
                          className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition cursor-pointer shrink-0 shadow-xs flex items-center justify-center gap-2 ml-auto"
                        >
                          {uploading ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Uploading...</span>
                            </>
                          ) : (
                            <span>Upload & Re-Submit</span>
                          )}
                        </button>
                      </div>

                      <p className="text-[10px] text-slate-500">
                        Accepted formats: PDF, JPG, JPEG, PNG, WEBP (Max 10MB). On mobile, camera capture is supported.
                      </p>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Log / History logs list */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Detailed Application Logs</span>
            <div className="space-y-4 relative pl-4 border-l border-slate-100">
              {order.logs.map((log, lIdx) => (
                <div key={lIdx} className="relative">
                  {/* Timeline dot */}
                  <span className="absolute -left-[20.5px] top-1 w-2.5 h-2.5 bg-blue-500 rounded-full border border-white" />
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-xs text-slate-800">{log.status}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{log.comment}</p>
                    </div>
                    <span className="text-[9px] text-slate-400 shrink-0 ml-4 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Checkout Profile / Receipts block (Printable Receipt block) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 print:border print:border-slate-300 print:rounded-2xl print:p-6 print:m-0 print:shadow-none break-inside-avoid">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-900">Application Receipt & Invoice</span>
              <button
                onClick={handlePrint}
                className="text-blue-600 hover:text-blue-700 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer print:hidden"
              >
                <Printer className="w-4 h-4" /> Print / Download Receipt
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Customer Details</span>
                <p className="font-semibold text-slate-800">{order.name}</p>
                <p className="text-slate-400">{order.email}</p>
                <p className="text-slate-400">+91 {order.mobile}</p>
              </div>
              <div className="space-y-1">
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Delivery Address</span>
                <p className="text-slate-800 leading-normal">{order.address}</p>
                <p className="text-slate-400">{order.city}, {order.state} - {order.pinCode}</p>
              </div>
              <div className="space-y-1">
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Payment Mode</span>
                <p className="font-semibold text-slate-800">{order.paymentMethod}</p>
                <p className="text-slate-400">Status: <strong className="text-slate-800">{order.paymentStatus}</strong></p>
              </div>
              <div className="space-y-1">
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Uploaded Documents</span>
                {order.uploadedDocuments.length === 0 ? (
                  <p className="text-red-500 font-medium">No documents attached.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {order.uploadedDocuments.map((doc, idx) => (
                      <li key={idx} className="text-slate-400 truncate">✓ {doc.name}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold leading-none">Total consultancy bill paid</span>
                <span className="text-base font-black text-slate-900 mt-1 block">₹{order.totalAmount}</span>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 text-right">EasyDesk Digital Services India</span>
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* DEDICATED OFFICIAL PRINTABLE ACKNOWLEDGEMENT & TRACKING RECEIPT (PRINT-ONLY) */}
        {/* ========================================================================= */}
        <div className="print-only printable-tracking-document w-full bg-white text-slate-900 font-sans p-0 m-0 text-xs">

          {/* 1. Official Letterhead / Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#0F4C81] text-white rounded-xl flex items-center justify-center font-black text-xl tracking-tighter">
                  ED
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                    EasyDesk Solutions Private Limited
                  </h1>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    Government Services Citizen Advisory & Digital Documentation Facilitation Portal
                  </p>
                  <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                    CIN: U72900MH2024PTC123456 • ISO 9001:2015 Certified Citizen Desk
                  </p>
                </div>
              </div>
              <div className="text-right text-[10px] text-slate-600">
                <p className="font-bold text-slate-900 uppercase tracking-wider">Official Acknowledgement Slip</p>
                <p className="font-mono">Printed on: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                <p className="font-mono text-[9px] text-slate-400">Time: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          </div>

          {/* 2. Document Title Banner */}
          <div className="bg-slate-100 border border-slate-300 rounded-lg p-3 mb-4 flex items-center justify-between">
            <div>
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 block">Citizen Copy</span>
              <h2 className="text-sm font-black text-slate-900 tracking-wide uppercase">
                Application Acknowledgement & Service Status Record
              </h2>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block">Current Status</span>
              <span className="font-black text-xs uppercase px-3 py-1 rounded border border-slate-400 bg-white inline-block">
                {order.orderStatus}
              </span>
            </div>
          </div>

          {/* 3. Four-Box Metadata Bar */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50/50">
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Application ID</span>
              <span className="font-mono font-black text-sm text-blue-900 block mt-0.5">#{order.id}</span>
            </div>
            <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50/50">
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Submission Date</span>
              <span className="font-medium text-xs text-slate-800 block mt-0.5">
                {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50/50">
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Payment Status</span>
              <span className="font-bold text-xs text-emerald-700 block mt-0.5 uppercase">
                {order.paymentStatus || 'Verified / Paid'}
              </span>
            </div>
            <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50/50">
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Service Category</span>
              <span className="font-medium text-xs text-slate-800 block mt-0.5 truncate">
                {order.category || 'Citizen Advisory'}
              </span>
            </div>
          </div>

          {/* 4. Applicant & Service Information (2 Columns) */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Left Column: Applicant Profile */}
            <div className="border border-slate-300 rounded-lg p-3.5 space-y-2">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                Applicant & Communication Details
              </h3>
              <div className="space-y-1 text-xs">
                <p><span className="text-slate-500 font-semibold inline-block w-24">Full Name:</span> <strong className="text-slate-900">{order.name}</strong></p>
                <p><span className="text-slate-500 font-semibold inline-block w-24">Mobile:</span> <strong className="font-mono text-slate-900">+91 {order.mobile}</strong></p>
                <p><span className="text-slate-500 font-semibold inline-block w-24">Email:</span> <span className="font-mono text-slate-800">{order.email}</span></p>
                <div className="pt-1">
                  <span className="text-slate-500 font-semibold block text-[10px] uppercase">Registered Address:</span>
                  <p className="text-slate-800 leading-snug mt-0.5 font-medium">
                    {order.addressLine1 || order.address}
                    {order.addressLine2 ? `, ${order.addressLine2}` : ''}
                    {order.landmark ? `, Near ${order.landmark}` : ''}
                    <br />
                    {order.district && order.district.toLowerCase() !== (order.city || '').toLowerCase() ? `${order.district}, ` : ''}
                    {order.city}, {order.state} - <strong className="font-mono">{order.pinCode || order.pincode}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Service Specifications */}
            <div className="border border-slate-300 rounded-lg p-3.5 space-y-2">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                Service & Fulfillment Specifications
              </h3>
              <div className="space-y-1 text-xs">
                <p><span className="text-slate-500 font-semibold inline-block w-28">Service Applied:</span> <strong className="text-slate-900">{order.serviceTitle}</strong></p>
                <p><span className="text-slate-500 font-semibold inline-block w-28">Fulfillment Mode:</span> <span className="text-slate-800">{order.documentDeliveryStatus || 'Digital Clearance & Physical Dispatch'}</span></p>
                <p><span className="text-slate-500 font-semibold inline-block w-28">Application Channel:</span> <span className="text-slate-800">EasyDesk Assisted Online Portal</span></p>
                <p><span className="text-slate-500 font-semibold inline-block w-28">Assigned Desk:</span> <span className="text-slate-800">{order.assignedEmployeeName ? `${order.assignedEmployeeName} (${order.assignedEmployeeCode || 'Desk'})` : 'Citizen Services Central Desk'}</span></p>
                <div className="pt-1">
                  <span className="text-slate-500 font-semibold block text-[10px] uppercase">Enclosed Documents ({order.uploadedDocuments?.length || 0}):</span>
                  {(!order.uploadedDocuments || order.uploadedDocuments.length === 0) ? (
                    <p className="text-slate-400 italic text-[10px] mt-0.5">No digital copies attached during submission</p>
                  ) : (
                    <ul className="text-[10px] text-slate-700 list-disc list-inside mt-0.5 space-y-0.5 font-mono">
                      {order.uploadedDocuments.map((doc, idx) => (
                        <li key={idx} className="truncate">{doc.name}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 5. Payment & Transaction Summary Table */}
          <div className="border border-slate-300 rounded-lg overflow-hidden mb-4 print-avoid-break">
            <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-900">
                Payment & Consultancy Billing Summary
              </h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] text-slate-600 font-bold uppercase border-b border-slate-300">
                  <th className="py-2 px-3 text-left">Description</th>
                  <th className="py-2 px-3 text-left">Payment Mode</th>
                  <th className="py-2 px-3 text-left">Transaction / UTR Ref</th>
                  <th className="py-2 px-3 text-left">Payment Status</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-2 px-3 font-semibold text-slate-900">{order.serviceTitle} — Citizen Advisory & Filing Fee</td>
                  <td className="py-2 px-3 uppercase font-medium">{order.paymentMethod || 'Online'}</td>
                  <td className="py-2 px-3 font-mono text-[10px] text-slate-600">{order.utr || `TXN-ED-${order.id}`}</td>
                  <td className="py-2 px-3">
                    <span className="font-bold text-emerald-700 uppercase text-[10px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                      {order.paymentStatus || 'Verified'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-black text-slate-900">₹{order.totalAmount}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td colSpan={4} className="py-2 px-3 text-right text-slate-700 text-xs uppercase tracking-wider">
                    Total Amount Paid (Inclusive of Taxes & Platform Charges):
                  </td>
                  <td className="py-2 px-3 text-right font-black text-sm text-slate-900">
                    ₹{order.totalAmount}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 6. Milestone Verification Logs Table */}
          {order.logs && order.logs.length > 0 && (
            <div className="border border-slate-300 rounded-lg overflow-hidden mb-4 print-avoid-break">
              <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-900">
                  Application Verification & Action Logs
                </h3>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] text-slate-600 font-bold uppercase border-b border-slate-300">
                    <th className="py-1.5 px-3 text-left w-36">Stage / Milestone</th>
                    <th className="py-1.5 px-3 text-left">Officer Remarks / Audit Details</th>
                    <th className="py-1.5 px-3 text-right w-44">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {order.logs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-1.5 px-3 font-bold text-slate-900 text-[11px]">{log.status}</td>
                      <td className="py-1.5 px-3 text-slate-700 text-[11px]">{log.comment}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-[10px] text-slate-500">
                        {new Date(log.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 7. Important Citizen Guidelines */}
          <div className="border border-slate-300 rounded-lg p-3 mb-4 bg-slate-50/70 text-[10px] text-slate-600 print-avoid-break">
            <span className="font-black text-slate-800 uppercase tracking-wider block mb-1">
              Important Instructions for the Applicant:
            </span>
            <ol className="list-decimal list-inside space-y-0.5 leading-relaxed">
              <li>Please preserve this Application Acknowledgement & Reference ID <strong>#{order.id}</strong> for future correspondence and verification.</li>
              <li>SMS alerts and WhatsApp status notifications will be transmitted to registered mobile <strong>+91 {order.mobile}</strong>.</li>
              <li>In the event of "Documents Required" notification, promptly upload the requested credentials via the Live Tracking portal.</li>
              <li>Final government-attested certificates/clearance records will be made available for secure digital download upon department sign-off.</li>
            </ol>
          </div>

          {/* 8. Electronic Verification Seal & Footer */}
          <div className="border-t-2 border-slate-900 pt-3 flex items-center justify-between text-[9px] text-slate-500 print-avoid-break">
            <div className="space-y-0.5">
              <p className="font-bold text-slate-800">
                🔒 Electronically Generated Official Document
              </p>
              <p>
                Generated under the Information Technology Act, 2000. Valid without physical handwritten signature.
              </p>
              <p className="font-mono text-slate-400">
                Verification Security ID: AUTH-ED-{order.id.replace(/[^a-zA-Z0-9]/g, '')}-{order.createdAt.replace(/[^0-9]/g, '').slice(0, 8)}
              </p>
            </div>
            <div className="text-right space-y-0.5">
              <p className="font-bold text-slate-800">EasyDesk Citizen Helpdesk</p>
              <p>Email: support@easydesk.in • Web: www.easydesk.in</p>
              <p className="font-mono text-slate-400">National Helpline: 1800-889-DESK (Mon–Sat 9AM–7PM)</p>
            </div>
          </div>

        </div>
      </>
    )}

    </div>
  );
}
