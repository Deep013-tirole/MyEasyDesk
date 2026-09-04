import React, { useState } from 'react';
import { Mail, Lock, ShieldAlert, ShieldCheck, RefreshCw, Shield, KeyRound, ArrowRight, Sparkles } from 'lucide-react';
import { User } from '../types.js';
import { fetchCsrfToken, safeParseJsonResponse } from '../lib/apiClient.js';
import { authenticateAdminDirect } from '../lib/apiDataService.js';

interface AuthPortalProps {
  setView: (view: string) => void;
  setCurrentUser: (user: User | null) => void;
}

export default function AuthPortal({ 
  setView, 
  setCurrentUser
}: AuthPortalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Admin Login Handler
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const cleanEmail = email.trim();
    const cleanPassword = password;

    try {
      // 1. Try Primary Server REST API Login
      try {
        const csrfToken = await fetchCsrfToken();
        const res = await fetch('/api/auth/admin/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({ email: cleanEmail, password: cleanPassword })
        });

        const data = await safeParseJsonResponse<any>(res);

        if (res.ok && data && (data.accessToken || data.token)) {
          const tokenVal = data.accessToken || data.token;
          localStorage.setItem('easydesk_admin_token', tokenVal);
          if (data.refreshToken) {
            localStorage.setItem('easydesk_admin_refresh', data.refreshToken);
          }
          localStorage.setItem('easydesk_admin_user', JSON.stringify(data.user));

          setCurrentUser(data.user);
          setSuccess(`Welcome back, ${data.user.name || 'Admin'}! Redirecting to Admin Panel...`);
          
          setTimeout(() => {
            setView('admin');
          }, 500);
          return;
        }

        if (res.status === 400 || res.status === 401 || res.status === 403) {
          if (data && data.message) {
            throw new Error(data.message);
          }
        }
      } catch (apiErr: any) {
        if (apiErr.message && !apiErr.message.includes('fetch') && !apiErr.message.includes('network') && !apiErr.message.includes('Unexpected')) {
          throw apiErr;
        }
      }

      // 2. Direct Authoritative Authentication Fallback via API Service
      const directResult = await authenticateAdminDirect(cleanEmail, cleanPassword);
      if (directResult.success && directResult.user && directResult.token) {
        localStorage.setItem('easydesk_admin_token', directResult.token);
        localStorage.setItem('easydesk_admin_user', JSON.stringify(directResult.user));

        setCurrentUser(directResult.user);
        setSuccess(`Welcome back, ${directResult.user.name || 'Admin'}! Verified successfully. Redirecting...`);
        
        setTimeout(() => {
          setView('admin');
        }, 500);
        return;
      }

      // Display clear failure error
      throw new Error(directResult.error || 'Administrative Login Failed. Please verify your Login ID and password.');

    } catch (err: any) {
      console.warn('Admin login notice:', err);
      setError(err.message || 'Administrative Login Failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="notranslate max-w-7xl mx-auto px-4 py-12 md:py-16 font-sans flex items-center justify-center min-h-[75vh]" id="auth-portal-root" translate="no">
      <div className="w-full max-w-md">
        
        <div className="border border-slate-200/80 rounded-3xl shadow-xl hover-glow-blue overflow-hidden bg-white relative transition-all duration-300">
          
          {/* Top decorative gradient bar */}
          <div className="h-2 w-full bg-gradient-to-r from-[#0F4C81] via-blue-500 to-cyan-400" />
          
          {/* Subtle background accent blur */}
          <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full blur-3xl opacity-20 pointer-events-none bg-blue-600" />
          <div className="absolute -bottom-16 -left-16 w-36 h-36 rounded-full blur-3xl opacity-15 pointer-events-none bg-cyan-600" />

          <div className="p-6 sm:p-8 relative z-10">
            
            <div className="flex items-center gap-3.5 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0F4C81] to-[#0b3b64] text-white flex items-center justify-center shrink-0 shadow-md hover-scale floating-icon-bounce">
                <Shield className="w-6 h-6 text-cyan-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900 tracking-tight m-0">Admin Login</h2>
                  <span className="bg-blue-50 text-[#0F4C81] border border-blue-200 rounded-full text-[10px] font-bold px-2 py-0.5">Secure V2</span>
                </div>
                <p className="text-slate-500 text-xs mt-0.5 m-0 font-medium">EasyDesk Management Portal</p>
              </div>
            </div>

            {/* Status Messages */}
            {error && (
              <div className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-red-700 text-xs animate-in slide-in-from-top-1 duration-150">
                <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-semibold">{error}</span>
              </div>
            )}
            {success && (
              <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-emerald-800 text-xs animate-in slide-in-from-top-1 duration-150">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-bold">{success}</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4 mt-6">
              <div className="space-y-1.5">
                <label htmlFor="auth-email-input" className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">
                  Login ID / Email
                </label>
                <div className="relative group">
                  <Mail className="w-4 h-4 text-slate-400 group-focus-within:text-[#0F4C81] absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200" />
                  <input 
                    id="auth-email-input"
                    name="email"
                    type="text"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Enter Your Login Id"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 input-focus-glow transition focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="auth-password-input" className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-[#0F4C81] absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200" />
                  <input 
                    id="auth-password-input"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter Your Password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 input-focus-glow transition focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0F4C81] hover:bg-[#0b3b64] text-white font-bold py-3.5 rounded-xl text-xs transition-all duration-200 flex items-center justify-center gap-2 btn-glow-primary cursor-pointer disabled:opacity-50 mt-6 hover-scale-sm shadow-md"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Authenticating Credentials...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 text-cyan-300" />
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </form>

            {/* Security Badges Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> 256-Bit Encrypted
              </span>
              <span className="font-semibold text-slate-500">Authorized Personnel Only</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
