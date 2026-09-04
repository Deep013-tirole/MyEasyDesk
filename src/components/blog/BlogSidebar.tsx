import React, { useState } from 'react';
import { Tag, Mail, CheckCircle2, MessageSquare, ShieldCheck, ArrowRight, BookOpen } from 'lucide-react';
import { BlogCategory } from '../../types.js';
import { openGeneralWhatsApp } from '../../lib/whatsapp.js';

interface BlogSidebarProps {
  categories: BlogCategory[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
}

export default function BlogSidebar({
  categories,
  selectedCategory,
  onSelectCategory
}: BlogSidebarProps) {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 5000);
    }, 600);
  };

  return (
    <aside className="space-y-6">
      {/* 1. POPULAR TOPICS */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 sm:p-6 shadow-xs space-y-4 hover-lift hover-glow-blue transition-all duration-300">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0F4C81] flex items-center justify-center shrink-0">
            <Tag className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 m-0">Popular Topics</h3>
            <p className="text-[11px] text-slate-500 font-medium m-0">Browse guides by subject</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onSelectCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer hover-scale-sm ${
              selectedCategory === 'all'
                ? 'bg-[#0F4C81] text-white shadow-sm btn-glow-primary'
                : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            All Guides
          </button>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer hover-scale-sm ${
                  isSelected
                    ? 'bg-[#0F4C81] text-white shadow-sm btn-glow-primary'
                    : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. STAY UPDATED NEWSLETTER */}
      <div className="bg-gradient-to-br from-slate-900 via-[#0B2545] to-[#0F4C81] text-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-800 space-y-4 hover-lift hover-glow-blue transition-all duration-300">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 bg-white/10 text-cyan-300 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-white/15">
            <Mail className="w-3.5 h-3.5" />
            <span>Stay Updated</span>
          </div>
          <h3 className="text-base font-black text-white leading-tight m-0">
            Government & Filing Bulletins
          </h3>
          <p className="text-xs text-blue-100/90 leading-relaxed font-normal m-0">
            Get practical compliance updates, scheme deadlines, and filing guidelines delivered straight to your inbox.
          </p>
        </div>

        {subscribed ? (
          <div className="bg-teal-500/20 border border-teal-500/30 text-teal-200 rounded-xl p-3.5 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
            <span>Thank you for subscribing to EasyDesk guides.</span>
          </div>
        ) : (
          <form onSubmit={handleSubscribe} className="space-y-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address..."
              className="w-full bg-white/10 border border-white/20 text-white placeholder:text-blue-200/60 rounded-xl px-3.5 py-2 text-xs focus:outline-none input-focus-glow"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs py-2.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 hover-scale-sm"
            >
              {submitting ? 'Subscribing...' : 'Subscribe to Bulletins'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <p className="text-[10px] text-blue-200/70 text-center font-normal pt-1 m-0">
              Zero spam. Unsubscribe anytime.
            </p>
          </form>
        )}
      </div>

      {/* 3. VERIFIED DESK SUPPORT / WHATSAPP ASSISTANCE */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 sm:p-6 shadow-xs space-y-3.5 hover-lift hover-glow-emerald transition-all duration-300">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 m-0">Need Service Filing Help?</h3>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block mt-0.5">Verified Desk Officers</span>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed font-normal m-0">
          Not sure which documents or eligibility criteria apply to you? Our desk specialists audit your paperwork and guide your online submissions.
        </p>

        <button
          onClick={() => openGeneralWhatsApp('Hello EasyDesk, I was reading your knowledge hub and need help with a government/digital service.')}
          className="w-full bg-[#10B981] hover:bg-[#0e9f6e] text-white font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] btn-glow-emerald hover-scale-sm"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Chat on WhatsApp</span>
        </button>
      </div>
    </aside>
  );
}
