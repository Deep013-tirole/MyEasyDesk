import React, { Suspense, lazy } from 'react';
import { X, Loader2 } from 'lucide-react';
const ReviewSubmissionForm = lazy(() => import('./ReviewSubmissionForm.js'));
import { Review } from '../types.js';

interface ReviewSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCustomerId?: string;
  initialCustomerName?: string;
  initialOrderId?: string;
  initialServiceId?: string;
  onSuccess?: (review: Review) => void;
}

export default function ReviewSubmissionModal({
  isOpen,
  onClose,
  initialCustomerId,
  initialCustomerName,
  initialOrderId,
  initialServiceId,
  onSuccess
}: ReviewSubmissionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <Suspense fallback={
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400 text-xs font-sans">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span>Loading review submission form...</span>
          </div>
        }>
          <ReviewSubmissionForm
            isModal={true}
            initialCustomerId={initialCustomerId}
            initialCustomerName={initialCustomerName}
            initialOrderId={initialOrderId}
            initialServiceId={initialServiceId}
            onSuccess={(rev) => {
              if (onSuccess) onSuccess(rev);
            }}
            onCancel={onClose}
          />
        </Suspense>
      </div>
    </div>
  );
}
