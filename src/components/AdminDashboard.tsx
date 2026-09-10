import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import {
  ShieldAlert, Settings, Users, FileText, IndianRupee, Clock, CheckCircle,
  Trash2, Plus, MessageSquare, Ticket, Send, Eye, RefreshCw, UserCheck,
  Layers, Image, HelpCircle, Star, Edit, Shield, Activity, BellRing,
  Lock, LogOut, Check, Info, FileCode, CheckCircle2, AlertCircle,
  Copy, FolderOpen, Search, Filter, UploadCloud, CopyCheck, ArrowUpDown,
  Building2, Phone, CreditCard, Sliders, Key, ShieldCheck, Globe, Loader2,
  UserPlus, Menu, X, ChevronDown, ChevronRight, LayoutGrid, List, Sparkles, Share2
} from 'lucide-react';
import { Order, SupportTicket, Coupon, Review, User, OrderStatus, PaymentStatus, UserRole, Service, Blog, CalendarEvent, MasterData, ServiceCategory, BlogCategory } from '../types.js';
import { fetchCsrfToken, adminFetch, safeParseJsonResponse } from '../lib/apiClient.js';
import { hasUserPermission, TAB_PERMISSIONS_MAP } from '../lib/permissions.js';
import { authenticateAdminDirect, getClientPaymentConfig } from '../lib/apiDataService.js';

// Lazy loaded heavy admin submodules
const AboutUsAdminModule = lazy(() => import('./admin/AboutUsAdminModule.js'));
const ContactUsAdminModule = lazy(() => import('./admin/ContactUsAdminModule.js'));
const PaymentAdminModule = lazy(() => import('./admin/PaymentAdminModule.js'));
const AdminSettingsModule = lazy(() => import('./admin/AdminSettingsModule.js'));
const SocialMediaAdminModule = lazy(() => import('./admin/SocialMediaAdminModule.js'));
const PrivacySecurityAdminModule = lazy(() => import('./admin/PrivacySecurityAdminModule.js'));
const EmployeeManagementModule = lazy(() => import('./admin/EmployeeManagementModule.js'));
const CustomerManagementModule = lazy(() => import('./admin/CustomerManagementModule.js'));
const MasterDataAdminModule = lazy(() => import('./admin/MasterDataAdminModule.js'));
const RecordIntegrityAdminModule = lazy(() => import('./admin/RecordIntegrityAdminModule.js'));
const CategoryManagementAdminModule = lazy(() => import('./admin/CategoryManagementAdminModule.js'));
const AnalyticsDashboardModule = lazy(() => import('./admin/AnalyticsDashboardModule.js'));
const OrderStatusChart = lazy(() => import('./admin/OrderStatusChart.js'));
const MediaLibraryAdminModule = lazy(() => import('./admin/MediaLibraryAdminModule.js').then(m => ({ default: m.MediaLibraryAdminModule })));
const ReviewsAdminModule = lazy(() => import('./admin/ReviewsAdminModule.js'));
const CreateManualOrderModal = lazy(() => import('./admin/CreateManualOrderModal.js'));
const EditOrderModal = lazy(() => import('./admin/EditOrderModal.js'));

import { ServiceEditorModule } from './admin/ServiceEditorModule.js';
import { BlogEditorModule } from './admin/BlogEditorModule.js';
import { MediaInput } from './admin/MediaInput.js';
import { fetchServicesWithCache, fetchCategoriesWithCache, fetchBlogCategoriesWithCache, fetchBlogsWithCache, setCachedCatalog, invalidateAllCatalogsCache, CATALOG_CACHE_KEYS } from '../services/catalogService.js';
import { useScrollToTopOnChange } from '../lib/scrollUtils.js';

export type AdminTabType = 'analytics' | 'orders' | 'services' | 'category_management' | 'blogs' | 'reviews' | 'faqs' | 'banners' | 'pages' | 'media' | 'users' | 'notifications' | 'audit' | 'settings' | 'about_us' | 'contact_us' | 'payment_settings' | 'admin_settings' | 'social_media' | 'employee_records' | 'customer_records' | 'master_data' | 'record_integrity' | 'roles_management' | 'privacy_security' | 'calendar';

export function normalizeAdminTab(rawTab?: string): AdminTabType {
  if (!rawTab) return 'analytics';
  const clean = rawTab.toLowerCase().trim().replace(/-/g, '_');

  if (clean === 'customers' || clean === 'customer') return 'customer_records';
  if (clean === 'employees' || clean === 'employee') return 'employee_records';
  if (clean === 'categories' || clean === 'category') return 'category_management';
  if (clean === 'admin' || clean === 'admin_config') return 'admin_settings';
  if (clean === 'payment' || clean === 'payments') return 'payment_settings';
  if (clean === 'about') return 'about_us';
  if (clean === 'contact') return 'contact_us';
  if (clean === 'roles' || clean === 'role') return 'roles_management';
  if (clean === 'privacy' || clean === 'security') return 'privacy_security';
  if (clean === 'social') return 'social_media';
  if (clean === 'events') return 'calendar';

  const validTabs: AdminTabType[] = [
    'analytics', 'orders', 'services', 'category_management', 'blogs', 'reviews',
    'faqs', 'banners', 'pages', 'media', 'users', 'notifications', 'audit',
    'settings', 'about_us', 'contact_us', 'payment_settings', 'admin_settings',
    'social_media', 'employee_records', 'customer_records', 'master_data',
    'record_integrity', 'roles_management', 'privacy_security', 'calendar'
  ];

  if (validTabs.includes(clean as AdminTabType)) {
    return clean as AdminTabType;
  }
  return 'analytics';
}

function AdminModuleFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-8 gap-3 bg-white rounded-2xl border border-slate-200/80 text-xs text-slate-400 font-sans shadow-xs">
      <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <span>Loading administrative module...</span>
    </div>
  );
}

interface AdminDashboardProps {
  onRefreshCatalogs?: () => void;
  initialTab?: string;
  onTabChange?: (tab: string) => void;
}

export default function AdminDashboard({ onRefreshCatalogs, initialTab, onTabChange }: AdminDashboardProps = {}) {
  // Session & Authentication
  const [adminUser, setAdminUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('easydesk_admin_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Permission Verification Helper
  const hasPermission = (permKey: string | string[]): boolean => {
    return hasUserPermission(adminUser, permKey);
  };

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');

  // Loaded database states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [summary, setSummary] = useState({
    totalUsers: 0,
    totalOrders: 0,
    completedOrders: 0,
    pendingOrders: 0,
    revenue: 0
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [blogCategories, setBlogCategories] = useState<BlogCategory[]>([]);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [allUsersList, setAllUsersList] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [globalSettings, setGlobalSettings] = useState<any>({});
  const [paymentConfig, setPaymentConfig] = useState<any>({
    upiId: '',
    upiName: '',
    qrCodeUrl: '',
    bankAccountName: '',
    bankName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankBranch: '',
    instructions: ''
  });

  // Navigation tab with URL state awareness
  const [activeTab, setActiveTabState] = useState<AdminTabType>(() => {
    return normalizeAdminTab(initialTab);
  });

  // Synchronize when initialTab changes from external navigation (popstate / browser Back/Forward)
  useEffect(() => {
    if (initialTab) {
      const normalized = normalizeAdminTab(initialTab);
      setActiveTabState(prev => prev !== normalized ? normalized : prev);
    }
  }, [initialTab]);

  const setActiveTab = useCallback((tab: AdminTabType) => {
    setActiveTabState(tab);
    if (onTabChange) {
      onTabChange(tab);
    } else if (typeof window !== 'undefined') {
      const targetPath = tab === 'analytics' ? '/admin' : `/admin/${tab}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }
  }, [onTabChange]);

  // Reset scroll to top on admin module/tab change
  useScrollToTopOnChange([activeTab]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Mobile Navigation Drawer State
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [mobileNavSearch, setMobileNavSearch] = useState('');

  // Interactive controls / form overlays
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formType, setFormType] = useState<'service' | 'blog' | 'faq' | 'banner' | 'page' | 'user' | 'notification' | 'category'>('service');
  const [editId, setEditId] = useState<string | null>(null);

  // Reusable multi-purpose form state
  const [formData, setFormData] = useState<any>({
    title: '', name: '', question: '', answer: '', content: '', categoryId: '',
    govFees: 0, serviceCharge: 0, processingTime: '', requiredDocuments: '',
    status: 'active', imageUrl: '', linkUrl: '', tags: '', author: '', role: 'USER',
    email: '', mobile: '', message: '', icon: '', color: ''
  });

  // Blogs CMS filter and search state
  const [blogSearchQuery, setBlogSearchQuery] = useState('');
  const [blogCategoryFilter, setBlogCategoryFilter] = useState('ALL');

  // Simple Action Notification Banner
  const [actionNotif, setActionNotif] = useState<string | null>(null);

  // Security Access & Users Filter state
  const [userTabFilter, setUserTabFilter] = useState<'staff' | 'customers' | 'all'>('staff');
  const [userTabSearch, setUserTabSearch] = useState('');
  const [isPurgingTests, setIsPurgingTests] = useState(false);

  // Modern Service & Blog CMS Editor state
  const [isServiceEditorOpen, setIsServiceEditorOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const [isBlogEditorOpen, setIsBlogEditorOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState<Blog | null>(null);

  // Non-blocking Delete Confirmation Modal State
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    type: string;
    id: string;
  }>({ isOpen: false, type: '', id: '' });

  // Order Details Action Drawer
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderStatusUpdate, setOrderStatusUpdate] = useState<OrderStatus>(OrderStatus.PROCESSING);
  const [orderCommentUpdate, setOrderCommentUpdate] = useState('');
  const [orderStaffAssignment, setOrderStaffAssignment] = useState('');

  // Manual Order Creation & Edit Order Modal states
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [orderSourceFilter, setOrderSourceFilter] = useState<string>('ALL');
  const [orderStatusTabFilter, setOrderStatusTabFilter] = useState<string>('ALL');

  // Assignable Employees state
  const [assignableEmployees, setAssignableEmployees] = useState<any[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [masterData, setMasterData] = useState<MasterData | undefined>(undefined);

  useEffect(() => {
    fetch('/api/master-data')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setMasterData(data); })
      .catch(err => console.error('Failed to load master data:', err));
  }, []);

  const triggerAlert = (msg: string) => {
    setActionNotif(msg);
    setTimeout(() => setActionNotif(null), 4000);
  };

  const handleLogout = (message?: string) => {
    setAdminUser(null);
    localStorage.removeItem('easydesk_admin_user');
    localStorage.removeItem('easydesk_admin_token');
    localStorage.removeItem('easydesk_admin_refresh');
    localStorage.removeItem('easydesk_admin_refresh_token');
    if (message) {
      setAuthError(message);
    } else {
      triggerAlert('Logged out successfully.');
    }
  };

  // Secure authenticated fetch wrapper with automatic token refresh
  const adminFetch = async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    let token = localStorage.getItem('easydesk_admin_token');
    const method = (init?.method || 'GET').toUpperCase();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrfToken = await fetchCsrfToken();
      headers['x-csrf-token'] = csrfToken;
    }

    let response: Response;
    try {
      response = await fetch(input, {
        ...init,
        headers
      });
    } catch (netErr: any) {
      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      if (!isOffline) {
        console.warn('[AdminDashboard] Fetch error for', input, netErr?.message || netErr);
      }
      return new Response(JSON.stringify({
        message: 'Network offline / connection unavailable',
        offline: true
      }), {
        status: 503,
        statusText: 'Service Unavailable (Offline)',
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (response.status === 401 || response.status === 403) {
      const clone = response.clone();
      const data = await clone.json().catch(() => ({}));
      const isAuthIssue = data.message && (
        data.message.includes('token') ||
        data.message.includes('Authorization') ||
        data.message.includes('expired') ||
        data.message.includes('denied')
      );

      if (isAuthIssue) {
        // Attempt automatic session token refresh
        const refreshToken = localStorage.getItem('easydesk_admin_refresh') || localStorage.getItem('easydesk_admin_refresh_token');
        if (refreshToken) {
          try {
            const csrfToken = await fetchCsrfToken();
            const refRes = await fetch('/api/auth/admin/refresh', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken
              },
              body: JSON.stringify({ refreshToken })
            });
            if (refRes.ok) {
              const refData = await refRes.json();
              if (refData.accessToken) {
                token = refData.accessToken;
                localStorage.setItem('easydesk_admin_token', token);
                headers['Authorization'] = `Bearer ${token}`;

                // Retry request with fresh token
                const retryRes = await fetch(input, {
                  ...init,
                  headers
                });
                if (retryRes.ok) {
                  return retryRes;
                }
              }
            }
          } catch (e) {
            // refresh failed
          }
        }

        handleLogout('Your administrative session has expired. Please sign in again.');
      }
    }

    return response;
  };

  // 1. Role preset helper logins for friction-free verification
  const handleQuickLogin = async (email: string, passwordPassed?: string) => {
    setAuthError('');
    setAuthSuccess('');
    const password = passwordPassed || 'password123';
    const cleanEmail = email.trim();

    try {
      // 1. Try Primary Server REST API
      try {
        const csrfToken = await fetchCsrfToken();
        const res = await fetch('/api/auth/admin/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
          },
          body: JSON.stringify({ email: cleanEmail, password })
        });
        const data = await safeParseJsonResponse<any>(res);
        if (res.ok && data && (data.accessToken || data.token)) {
          const tokenVal = data.accessToken || data.token;
          setAdminUser(data.user);
          localStorage.setItem('easydesk_admin_user', JSON.stringify(data.user));
          localStorage.setItem('easydesk_admin_token', tokenVal);
          if (data.refreshToken) {
            localStorage.setItem('easydesk_admin_refresh', data.refreshToken);
            localStorage.setItem('easydesk_admin_refresh_token', data.refreshToken);
          }
          triggerAlert(`Welcome back, ${data.user.name}! Authenticated as ${data.user.role}`);
          fetchTabData();
          onRefreshCatalogs?.();
          return;
        }

        if (res.status === 400 || res.status === 401 || res.status === 403) {
          if (data && data.message) {
            setAuthError(data.message);
            return;
          }
        }
      } catch (apiErr: any) {
        if (apiErr.message && !apiErr.message.includes('fetch') && !apiErr.message.includes('network') && !apiErr.message.includes('Unexpected')) {
          setAuthError(apiErr.message);
          return;
        }
      }

      // 2. Direct Authoritative Authentication Fallback via API Service
      const directResult = await authenticateAdminDirect(cleanEmail, password);
      if (directResult.success && directResult.user && directResult.token) {
        setAdminUser(directResult.user);
        localStorage.setItem('easydesk_admin_user', JSON.stringify(directResult.user));
        localStorage.setItem('easydesk_admin_token', directResult.token);
        triggerAlert(`Welcome back, ${directResult.user.name}! Authenticated as ${directResult.user.role} (Cloud DB)`);
        fetchTabData();
        onRefreshCatalogs?.();
        return;
      }

      setAuthError(directResult.error || 'Administrative login failed. Please verify credentials.');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication error.');
    }
  };


  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail) {
      setAuthError('Please enter email');
      return;
    }
    handleQuickLogin(loginEmail, loginPassword || 'password123');
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail) return;
    try {
      const res = await fetch('/api/auth/admin/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setAuthSuccess(`OTP Code Sent: ${data.otp}. check system audit logs!`);
        setTimeout(() => {
          setForgotMode(false);
          setLoginEmail(recoveryEmail);
          setAuthSuccess('');
        }, 5000);
      } else {
        setAuthError(data.message);
      }
    } catch (err) {
      setAuthError('Connection error.');
    }
  };

  // 2. Fetch Tab Specific Data (Parallelized with Promise.allSettled)
  const fetchTabData = async () => {
    const token = localStorage.getItem('easydesk_admin_token');
    if (!adminUser || !token) return;
    setIsRefreshing(true);

    try {
      const fetchTasks: Promise<void>[] = [];

      // Analytics (Requires dashboard.view)
      if (hasPermission('dashboard.view')) {
        fetchTasks.push(
          adminFetch('/api/admin/analytics')
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data?.summary) setSummary(data.summary); })
            .catch(() => {})
        );
      }

      // Orders Fetch (Requires orders.view or orders.view_assigned)
      if (hasPermission(['orders.view', 'orders.view_assigned'])) {
        const orderUrl = hasPermission('orders.view')
          ? `/api/orders?userId=${adminUser.id}&role=${adminUser.role}`
          : '/api/admin/orders/assigned';
        fetchTasks.push(
          adminFetch(orderUrl)
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data && Array.isArray(data)) setOrders(data); })
            .catch(() => {})
        );
      }

      // Assignable Employees Fetch
      if (hasPermission(['orders.assign', 'employees.view', 'employees.manage'])) {
        fetchTasks.push(
          adminFetch('/api/admin/assignable-employees')
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data && Array.isArray(data)) setAssignableEmployees(data); })
            .catch(() => {})
        );
      }

      // Services CMS (with automatic localStorage cache fallback)
      fetchTasks.push(
        fetchServicesWithCache()
          .then(res => { if (res.data) setServices(res.data); })
          .catch(() => {})
      );

      // Categories (Fetch live from admin endpoint with cache fallback)
      fetchTasks.push(
        adminFetch('/api/admin/categories')
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data) && data.length > 0) {
              setCategories(data);
              setCachedCatalog(CATALOG_CACHE_KEYS.CATEGORIES_ALL, data);
            } else {
              fetchCategoriesWithCache([], true).then(res => { if (res.data) setCategories(res.data); });
            }
          })
          .catch(() => {
            fetchCategoriesWithCache([], true).then(res => { if (res.data) setCategories(res.data); });
          })
      );

      // Blog Categories (Fetch live from admin endpoint with cache fallback)
      fetchTasks.push(
        adminFetch('/api/admin/blog-categories')
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data) && data.length > 0) {
              setBlogCategories(data);
              setCachedCatalog(CATALOG_CACHE_KEYS.BLOG_CATEGORIES_ALL, data);
            } else {
              fetchBlogCategoriesWithCache([], true).then(res => { if (res.data) setBlogCategories(res.data); });
            }
          })
          .catch(() => {
            fetchBlogCategoriesWithCache([], true).then(res => { if (res.data) setBlogCategories(res.data); });
          })
      );

      // Blogs (with automatic localStorage cache fallback)
      fetchTasks.push(
        fetchBlogsWithCache()
          .then(res => { if (res.data) setBlogs(res.data); })
          .catch(() => {})
      );

      // Payment settings
      fetchTasks.push(
        fetch('/api/payment-settings')
          .then(res => safeParseJsonResponse<any>(res))
          .then(async data => {
            if (data && (data.upiId || data.bankName)) {
              setPaymentConfig(data);
            } else {
              const directConfig = await getClientPaymentConfig();
              if (directConfig) setPaymentConfig(directConfig);
            }
          })
          .catch(async () => {
            const directConfig = await getClientPaymentConfig();
            if (directConfig) setPaymentConfig(directConfig);
          })
      );


      // Conditional restricted tables
      if (hasPermission('pages.manage')) {
        fetchTasks.push(
          adminFetch('/api/admin/faqs')
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data) setFaqs(data); })
            .catch(() => {})
        );
        fetchTasks.push(
          adminFetch('/api/admin/pages')
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data) setPages(data); })
            .catch(() => {})
        );
      }

      if (hasPermission('banners.manage')) {
        fetchTasks.push(
          adminFetch('/api/admin/banners')
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data) setBanners(data); })
            .catch(() => {})
        );
      }

      if (hasPermission(['reviews.manage', 'blogs.manage', 'pages.manage'])) {
        fetchTasks.push(
          adminFetch('/api/admin/reviews')
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data) setReviews(data); })
            .catch(() => {})
        );
      }

      if (hasPermission('media.manage')) {
        fetchTasks.push(
          adminFetch('/api/admin/media')
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data) setMedia(data); })
            .catch(() => {})
        );
      }

      if (hasPermission(['staff_accounts.view', 'staff_accounts.manage', 'customers.view', 'customers.manage']) || isSuper || adminUser?.role === 'SUPER_ADMIN' || adminUser?.role === 'ADMIN') {
        fetchTasks.push(
          adminFetch('/api/admin/users')
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data) setAllUsersList(data); })
            .catch(() => {})
        );
      }

      if (hasPermission(['system_settings.view', 'system_settings.manage'])) {
        fetchTasks.push(
          adminFetch('/api/admin/settings')
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data) setGlobalSettings(data); })
            .catch(() => {})
        );
      }

      if (hasPermission('audit_logs.view')) {
        fetchTasks.push(
          adminFetch('/api/admin/audit-logs')
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data) setAuditLogs(data); })
            .catch(() => {})
        );
      }

      fetchTasks.push(
        fetch('/api/calendar')
          .then(res => res.ok ? res.json() : null)
          .then(data => { if (data) setCalendarEvents(data); })
          .catch(() => {})
      );

      await Promise.allSettled(fetchTasks);
    } catch (e) {
      console.warn('Tabular data fetch issue handled:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // On tab switch, enforce permissions without re-fetching all databases
  useEffect(() => {
    if (adminUser) {
      const currentReq = TAB_PERMISSIONS_MAP[activeTab];
      if (currentReq && !hasPermission(currentReq)) {
        const availableTab = Object.keys(TAB_PERMISSIONS_MAP).find(tab => hasPermission(TAB_PERMISSIONS_MAP[tab]));
        if (availableTab) {
          setActiveTab(availableTab as any);
        }
      }
    }
  }, [activeTab]);

  // Initial load & session validation runs once on mount
  useEffect(() => {
    const verifyAndLoad = async () => {
      const token = localStorage.getItem('easydesk_admin_token');
      if (token) {
        try {
          const res = await fetch('/api/auth/admin/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            setAdminUser(data.user);
            localStorage.setItem('easydesk_admin_user', JSON.stringify(data.user));
            await fetchTabData();
            return;
          } else {
            // Attempt token refresh
            const refreshToken = localStorage.getItem('easydesk_admin_refresh') || localStorage.getItem('easydesk_admin_refresh_token');
            if (refreshToken) {
              try {
                const csrfToken = await fetchCsrfToken();
                const refRes = await fetch('/api/auth/admin/refresh', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken
                  },
                  body: JSON.stringify({ refreshToken })
                });
                if (refRes.ok) {
                  const refData = await refRes.json();
                  if (refData.accessToken) {
                    localStorage.setItem('easydesk_admin_token', refData.accessToken);
                    const meRes = await fetch('/api/auth/admin/me', {
                      headers: { 'Authorization': `Bearer ${refData.accessToken}` }
                    });
                    if (meRes.ok) {
                      const meData = await meRes.json();
                      setAdminUser(meData.user);
                      localStorage.setItem('easydesk_admin_user', JSON.stringify(meData.user));
                      await fetchTabData();
                      return;
                    }
                  }
                }
              } catch (e) {
                // Refresh error
              }
            }
            handleLogout('Your administrative session has expired. Please sign in again.');
            return;
          }
        } catch (err) {
          // Keep local state in case of offline/network hiccups
        }
      } else {
        setAdminUser(null);
        localStorage.removeItem('easydesk_admin_user');
      }
    };

    verifyAndLoad();
  }, []);

  // 3. Status Badge Styling
  const getRoleBadgeStyle = (role: UserRole | string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-300 font-bold';
      case UserRole.ADMIN:
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-300 font-semibold';
      case 'OPERATOR':
        return 'bg-amber-100 text-amber-800 border-amber-300 font-semibold';
      case 'STAFF':
        return 'bg-cyan-100 text-cyan-800 border-cyan-300 font-semibold';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 font-medium';
    }
  };

  // 4. CRUD API Form Handlers
  const openAddForm = (type: typeof formType) => {
    if (type === 'service') {
      setEditingService(null);
      setIsServiceEditorOpen(true);
      return;
    }
    if (type === 'blog') {
      setEditingBlog(null);
      setIsBlogEditorOpen(true);
      return;
    }
    setFormType(type);
    setEditId(null);
    const activeCats = categories.filter(c => (c.status || 'Active') === 'Active');
    const activeBlogCats = blogCategories.filter(c => (c.status || 'Active') === 'Active');
    setFormData({
      title: '', name: '', question: '', answer: '', content: '', description: '',
      categoryId: type === 'blog'
        ? (activeBlogCats[0]?.id || activeBlogCats[0]?.name || 'blog-cat-gov')
        : (activeCats[0]?.id || categories[0]?.id || 'gov'),
      govFees: 200, serviceCharge: 150, processingTime: '3 Working Days', requiredDocuments: 'Aadhaar Card, Photo',
      status: 'active', imageUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400', linkUrl: '/services', tags: 'PAN, Aadhaar', author: adminUser?.name || 'Admin', role: 'USER',
      walletBalance: 0, email: '', mobile: '', message: '', icon: 'FileText', color: 'blue'
    });
    setIsFormOpen(true);
  };

  const openEditForm = (type: typeof formType, item: any) => {
    if (type === 'service') {
      setEditingService(item);
      setIsServiceEditorOpen(true);
      return;
    }
    if (type === 'blog') {
      setEditingBlog(item);
      setIsBlogEditorOpen(true);
      return;
    }
    setFormType(type);
    setEditId(item.id || item.code || null);

    // Map existing structure
    setFormData({
      title: item.title || '',
      name: item.name || '',
      description: item.description || '',
      question: item.question || '',
      answer: item.answer || '',
      content: item.content || '',
      categoryId: type === 'blog'
        ? (item.categoryId || (blogCategories.find(c => c.name.toLowerCase() === (item.category || '').toLowerCase())?.id) || item.category || '')
        : (item.categoryId || ''),
      govFees: item.govFees || 0,
      serviceCharge: item.serviceCharge || 0,
      processingTime: item.processingTime || item.estimatedTime || '',
      requiredDocuments: Array.isArray(item.requiredDocuments) ? item.requiredDocuments.join(', ') : item.requiredDocuments || '',
      status: item.isSuspended ? 'suspended' : (item.status ? String(item.status).toLowerCase() : 'active'),
      imageUrl: item.imageUrl || item.image || '',
      linkUrl: item.linkUrl || '',
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : item.tags || '',
      author: item.author || '',
      role: item.role || 'USER',
      email: item.email || '',
      mobile: item.mobile || '',
      message: item.message || '',
      icon: item.icon || '',
      color: item.color || ''
    });
    setIsFormOpen(true);
  };

  const handleSaveService = async (serviceData: any, isDraft: boolean) => {
    const isEditing = !!editingService?.id;
    const url = isEditing ? `/api/admin/services/${editingService.id}` : '/api/admin/services';
    const method = isEditing ? 'PUT' : 'POST';

    const payload = {
      updaterId: adminUser?.id,
      updaterName: adminUser?.name,
      updaterRole: adminUser?.role,
      service: {
        ...serviceData,
        status: isDraft ? 'draft' : (serviceData.status || 'active')
      }
    };

    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to save service');
    }

    triggerAlert(`Service "${serviceData.title}" ${isEditing ? 'updated' : 'created'} successfully!`);
    setIsServiceEditorOpen(false);
    setEditingService(null);
    invalidateAllCatalogsCache();
    onRefreshCatalogs?.();
    fetchTabData();
  };

  const handleSaveBlog = async (blogData: any, isDraft: boolean) => {
    const isEditing = !!editingBlog?.id;
    const url = isEditing ? `/api/admin/blogs/${editingBlog.id}` : '/api/admin/blogs';
    const method = isEditing ? 'PUT' : 'POST';

    const payload = {
      updaterId: adminUser?.id,
      updaterName: adminUser?.name,
      updaterRole: adminUser?.role,
      blog: {
        ...blogData,
        status: isDraft ? 'draft' : (blogData.status || 'published')
      }
    };

    const res = await adminFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to save blog article');
    }

    triggerAlert(`Article "${blogData.title}" ${isEditing ? 'updated' : 'published'} successfully!`);
    setIsBlogEditorOpen(false);
    setEditingBlog(null);
    invalidateAllCatalogsCache();
    onRefreshCatalogs?.();
    fetchTabData();
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updaterInfo = {
      updaterId: adminUser?.id,
      updaterName: adminUser?.name,
      updaterRole: adminUser?.role
    };

    let url = '';
    let method = editId ? 'PUT' : 'POST';
    let bodyPayload: any = {};

    switch (formType) {
      case 'service':
        url = editId ? `/api/admin/services/${editId}` : '/api/admin/services';
        bodyPayload = {
          ...updaterInfo,
          service: {
            title: formData.title,
            categoryId: formData.categoryId,
            govFees: Number(formData.govFees),
            serviceCharge: Number(formData.serviceCharge),
            description: formData.description || formData.fullDescription || '',
            shortDescription: formData.shortDescription || (formData.description && formData.description.length <= 160 ? formData.description : formData.description?.slice(0, 160)) || '',
            fullDescription: formData.fullDescription || formData.description || '',
            timeline: formData.timeline,
            estimatedTime: formData.processingTime,
            processingTime: formData.processingTime,
            requiredDocuments: typeof formData.requiredDocuments === 'string'
              ? formData.requiredDocuments.split(',').map((x: string) => x.trim()).filter(Boolean)
              : (formData.requiredDocuments || []),
            status: formData.status
          }
        };
        break;

      case 'category':
        url = editId ? `/api/admin/categories/${editId}` : '/api/admin/categories';
        bodyPayload = {
          ...updaterInfo,
          category: {
            name: formData.name,
            icon: formData.icon,
            color: formData.color,
            description: formData.description || formData.name
          }
        };
        break;

      case 'blog':
        url = editId ? `/api/admin/blogs/${editId}` : '/api/admin/blogs';
        const selectedBlogCat = blogCategories.find(c => c.id === formData.categoryId || c.name.toLowerCase() === (formData.categoryId || '').toLowerCase());
        bodyPayload = {
          ...updaterInfo,
          blog: {
            title: formData.title,
            content: formData.content,
            categoryId: selectedBlogCat ? selectedBlogCat.id : (formData.categoryId || 'blog-cat-gov'),
            category: selectedBlogCat ? selectedBlogCat.name : (formData.categoryId || 'Government Schemes'),
            tags: typeof formData.tags === 'string' ? formData.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : (formData.tags || []),
            image: formData.imageUrl,
            status: formData.status
          }
        };
        break;

      case 'faq':
        url = editId ? `/api/admin/faqs/${editId}` : '/api/admin/faqs';
        bodyPayload = {
          ...updaterInfo,
          faq: {
            question: formData.question,
            answer: formData.answer,
            category: formData.categoryId
          }
        };
        break;

      case 'banner':
        url = editId ? `/api/admin/banners/${editId}` : '/api/admin/banners';
        bodyPayload = {
          ...updaterInfo,
          banner: {
            title: formData.title,
            imageUrl: formData.imageUrl,
            linkUrl: formData.linkUrl,
            isActive: formData.status === 'active'
          }
        };
        break;

      case 'page':
        url = editId ? `/api/admin/pages/${editId}` : '/api/admin/pages';
        bodyPayload = {
          ...updaterInfo,
          page: {
            title: formData.title,
            content: formData.content,
            isActive: formData.status === 'active'
          }
        };
        break;

      case 'user':
        url = editId ? `/api/admin/users/${editId}` : '/api/admin/users';
        bodyPayload = {
          ...updaterInfo,
          user: {
            name: formData.name,
            email: formData.email,
            mobile: formData.mobile,
            role: formData.role,
            isSuspended: formData.status === 'suspended'
          }
        };
        break;

      case 'notification':
        url = '/api/admin/notifications';
        method = 'POST';
        bodyPayload = {
          ...updaterInfo,
          notification: {
            userId: formData.userId || 'all',
            type: formData.type || 'sms',
            message: formData.message
          }
        };
        break;
    }

    try {
      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      const resData = await res.json().catch(() => ({}));
      if (res.ok) {
        setIsFormOpen(false);
        triggerAlert(`Success: ${formType} table entry committed!`);
        if (['service', 'category', 'blog', 'faq', 'banner', 'page'].includes(formType)) {
          invalidateAllCatalogsCache();
          onRefreshCatalogs?.();
        }
        fetchTabData();
      } else {
        alert(`Error: ${resData.message || 'Server error saving entry'}`);
      }
    } catch (err: any) {
      alert(err.message || 'Network transmission failed.');
    }
  };

  const handleDeleteItem = (type: typeof formType, id: string) => {
    setConfirmDeleteModal({ isOpen: true, type, id });
  };

  const executeDeleteItem = async (type: typeof formType, id: string) => {
    setConfirmDeleteModal({ isOpen: false, type: '', id: '' });
    const url = `/api/admin/${type === 'user' ? 'users' : type === 'service' ? 'services' : type === 'category' ? 'categories' : type === 'blog' ? 'blogs' : type === 'faq' ? 'faqs' : type === 'banner' ? 'banners' : type === 'page' ? 'pages' : type === 'media' ? 'media' : ''}/${id}`;
    try {
      const res = await adminFetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updaterId: adminUser?.id,
          updaterName: adminUser?.name,
          updaterRole: adminUser?.role
        })
      });
      if (res.ok) {
        triggerAlert(`Deleted ${type} record successfully.`);
        if (['service', 'category', 'blog', 'faq', 'banner', 'page'].includes(type)) {
          invalidateAllCatalogsCache();
          onRefreshCatalogs?.();
        }
        fetchTabData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        triggerAlert(`Deletion halted: ${errorData.message || 'Deletion failed'}`);
      }
    } catch (err: any) {
      triggerAlert(err.message || 'Delete request failed.');
    }
  };

  const handlePurgeTestAccounts = async () => {
    if (!window.confirm('Are you sure you want to clean up automated test/dummy accounts? The primary Super Admin (Deepak: tideepak8@gmail.com) and all verified administrative staff will be preserved.')) {
      return;
    }
    setIsPurgingTests(true);
    try {
      const res = await adminFetch('/api/admin/users/cleanup-test-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updaterId: adminUser?.id,
          updaterName: adminUser?.name,
          updaterRole: adminUser?.role
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        triggerAlert(data.message || 'Purged test accounts successfully.');
        fetchTabData();
      } else {
        alert(data.message || 'Failed to clean test accounts.');
      }
    } catch (err: any) {
      alert(err.message || 'Network error.');
    } finally {
      setIsPurgingTests(false);
    }
  };

  // Duplicate service instantly
  const handleDuplicateService = async (service: Service) => {
    try {
      const res = await adminFetch('/api/admin/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updaterId: adminUser?.id,
          updaterName: adminUser?.name,
          updaterRole: adminUser?.role,
          service: {
            ...service,
            id: `${service.id}-copy-${Math.floor(Math.random() * 900)}`,
            title: `${service.title} (Duplicate)`,
            displayOrder: (service.displayOrder || 1) + 1
          }
        })
      });
      if (res.ok) {
        triggerAlert('Service duplicated successfully!');
        invalidateAllCatalogsCache();
        onRefreshCatalogs?.();
        fetchTabData();
      }
    } catch (err) {
      alert('Duplication failed.');
    }
  };

  // Simulate uploading a file in the media library
  const handleUploadMediaSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    try {
      const res = await adminFetch('/api/admin/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updaterId: adminUser?.id,
          updaterName: adminUser?.name,
          updaterRole: adminUser?.role,
          file: {
            name: formData.name,
            type: formData.imageUrl.endsWith('.pdf') ? 'pdf' : 'image',
            size: '1.4 MB',
            url: formData.imageUrl || 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400',
            folder: 'uploads'
          }
        })
      });
      if (res.ok) {
        setIsFormOpen(false);
        triggerAlert('Media resource linked.');
        fetchTabData();
      }
    } catch (e) {
      alert('Media error.');
    }
  };

  // 5. Update individual Orders status/assignment
  const handleCommitOrderUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      const res = await adminFetch(`/api/orders/${selectedOrder.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: orderStatusUpdate,
          comment: orderCommentUpdate || `Transited application phase to ${orderStatusUpdate}.`,
          staffId: orderStaffAssignment || undefined
        })
      });
      if (res.ok) {
        setSelectedOrder(null);
        setOrderCommentUpdate('');
        triggerAlert('Order successfully progressed and logged.');
        fetchTabData();
      }
    } catch (err) {
      alert('Failed order progression.');
    }
  };

  // Assign Employee to Order Handler
  const handleAssignEmployeeToOrder = async (orderId: string, employeeId: string) => {
    try {
      const res = await adminFetch(`/api/admin/orders/${orderId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedEmployeeId: employeeId })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        triggerAlert(data.message || 'Order assignment updated successfully.');
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(data.order);
        }
        fetchTabData();
      } else {
        alert(data.message || 'Failed to assign employee to order.');
      }
    } catch (err: any) {
      alert(err.message || 'Network error assigning employee.');
    }
  };

  // Payment Verification Handler
  const handleVerifyPayment = async (orderId: string, status: 'Verified' | 'Rejected', rejectionReason?: string) => {
    try {
      const res = await adminFetch(`/api/admin/payments/${orderId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: status === 'Verified' ? 'approve' : 'reject',
          status,
          rejectionReason
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        triggerAlert(`Payment ${status.toLowerCase()} successfully.`);
        setSelectedOrder(null);
        fetchTabData();
        onRefreshCatalogs?.();
      } else {
        alert(data.message || 'Failed to verify payment.');
      }
    } catch (err: any) {
      alert(err.message || 'Error verifying payment.');
    }
  };

  // Save Payment Settings Handler
  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await adminFetch('/api/admin/payment-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentConfig })
      });

      if (res.ok) {
        const resData = await res.json().catch(() => ({}));
        const saved = resData.paymentConfig || resData.paymentSettings || paymentConfig;
        setPaymentConfig(saved);
        try {
          localStorage.setItem('easydesk_cache_payment_config', JSON.stringify(saved));
        } catch {}
        window.dispatchEvent(new CustomEvent('easydesk_payment_config_updated', { detail: saved }));
        triggerAlert('Payment details and bank instructions updated successfully!');
        fetchTabData();
        onRefreshCatalogs?.();
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.message || 'Failed to update payment settings.');
      }
    } catch (err: any) {
      alert(err.message || 'Network error updating payment settings.');
    }
  };

  // Filtering lists dynamically
  const filteredServices = services.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = statusFilter === 'all' || s.categoryId === statusFilter;
    return matchesSearch && matchesFilter;
  });

  const filteredOrders = orders.filter(o => {
    const term = searchQuery.toLowerCase().trim();
    const matchesSearch = !term ||
      (o.id && o.id.toLowerCase().includes(term)) ||
      (o.name && o.name.toLowerCase().includes(term)) ||
      (o.mobile && o.mobile.includes(term)) ||
      (o.email && o.email.toLowerCase().includes(term)) ||
      (o.sourceReference && o.sourceReference.toLowerCase().includes(term)) ||
      (o.serviceTitle && o.serviceTitle.toLowerCase().includes(term));

    const matchesSource =
      orderSourceFilter === 'ALL' ||
      (orderSourceFilter === 'Website' ? (!o.orderSource || o.orderSource === 'Website') : o.orderSource === orderSourceFilter);

    const matchesStatus =
      orderStatusTabFilter === 'ALL' ||
      o.orderStatus === orderStatusTabFilter;

    return matchesSearch && matchesSource && matchesStatus;
  });

  // Render Login wall if user is not authorized
  if (!adminUser || (!['ADMIN', 'SUPER_ADMIN', 'STAFF', 'OPERATOR'].includes(adminUser.role as string) && adminUser.role !== UserRole.ADMIN)) {
    return (
      <div id="easydesk-admin-login" className="min-h-[85vh] flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-blue-50/50">
        <div className="w-full max-w-md bg-white/70 backdrop-blur-xl border border-slate-200/60 p-8 rounded-3xl shadow-2xl relative overflow-hidden font-sans">

          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 to-cyan-400" />

          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-md">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-slate-800 mt-4 leading-none">Security Control Portal</h2>
            <p className="text-[10px] text-slate-400 mt-2 font-mono uppercase tracking-widest">EasyDesk Authorized Access Only</p>
          </div>

          {authError && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-xs p-3 rounded-xl mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccess && (
            <div className="bg-green-50 border border-green-100 text-green-700 text-xs p-3 rounded-xl mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{authSuccess}</span>
            </div>
          )}

          {!forgotMode ? (
            <form onSubmit={handleManualLogin} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Administrator Login ID / Email</label>
                <input
                  type="text"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Enter Your Login Id"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-600 bg-white"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Security Key / Password</label>
                  <button
                    type="button"
                    onClick={() => setForgotMode(true)}
                    className="text-[10px] text-blue-600 hover:underline font-bold"
                  >
                    Forgot Key?
                  </button>
                </div>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter Your Password"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-600 bg-white"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-200 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <label htmlFor="remember" className="text-[11px] text-slate-500 ml-2 font-medium cursor-pointer">
                  Maintain Secure Active Session (Remember Me)
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-850 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer shadow-md"
              >
                Sign In to Admin Panel
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div className="text-xs text-slate-500 leading-relaxed mb-1">
                Enter your registered administrator email address. The system will dispatch a secure validation OTP code.
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Registered Email</label>
                <input
                  type="email"
                  required
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="tideepak8@gmail.com"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-600 bg-white"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForgotMode(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2 px-3 rounded-xl text-xs transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-xl text-xs transition"
                >
                  Dispatch Security Code
                </button>
              </div>
            </form>
          )}

          {/* Friction-free verification role quick presets panel */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase block mb-2 text-center">Super Admin Access</span>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => handleQuickLogin('tideepak8@gmail.com')}
                className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-[10px] font-bold text-indigo-950 p-2.5 rounded-xl text-left flex items-center justify-between transition cursor-pointer"
              >
                <div>
                  <p className="font-extrabold text-xs">Deepak (Super Admin)</p>
                  <span className="text-[9px] font-mono text-indigo-600 block mt-0.5">tideepak8@gmail.com</span>
                </div>
                <span className="bg-indigo-600 text-white text-[9px] font-bold px-2.5 py-1 rounded-lg">Instant Sign In</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // Single Admin role definition
  const isSuper = true;
  const isAdmin = true;
  const isOperator = true;

  return (
    <div className="notranslate portal-container py-8 font-sans text-slate-800" translate="no">

      {/* Toast Notification Banner */}
      {actionNotif && (
        <div className="fixed top-4 right-4 bg-slate-900 text-white font-bold text-xs px-4 py-3 rounded-2xl border border-slate-700/50 shadow-2xl z-50 flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{actionNotif}</span>
        </div>
      )}

      {/* Title block with current profile role metadata */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-0.5 border rounded-full text-[10px] font-black uppercase tracking-widest ${getRoleBadgeStyle(adminUser.role)}`}>
              {adminUser.role} Console
            </span>
            <span className="text-slate-400 text-xs">• Workspace Sandboxed</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-2">EasyDesk Control Operations Center</h1>
        </div>

        <div className="flex items-center gap-2 bg-white border border-slate-200/60 p-2.5 rounded-2xl shadow-sm">
          <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
            {adminUser.name[0]}
          </div>
          <div className="text-left text-xs">
            <p className="font-bold leading-none">{adminUser.name}</p>
            <p className="text-[9px] text-slate-400 mt-1 font-mono">{adminUser.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="ml-4 bg-slate-50 hover:bg-slate-100 p-2 rounded-xl border border-slate-200/50 text-slate-500 hover:text-red-600 transition"
            title="Log Out Securely"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Sticky Module Selector & Quick Navigation Bar */}
      <div className="md:hidden mb-6 space-y-3 print:hidden">
        {/* Module Header Bar with Switch Button */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
              {activeTab === 'analytics' && <Activity className="w-4 h-4" />}
              {activeTab === 'orders' && <Clock className="w-4 h-4" />}
              {activeTab === 'services' && <Layers className="w-4 h-4" />}
              {activeTab === 'category_management' && <FolderOpen className="w-4 h-4 text-purple-600" />}
              {activeTab === 'blogs' && <FileText className="w-4 h-4 text-emerald-600" />}
              {activeTab === 'reviews' && <Star className="w-4 h-4 text-amber-500" />}
              {activeTab === 'faqs' && <HelpCircle className="w-4 h-4" />}
              {activeTab === 'banners' && <Image className="w-4 h-4" />}
              {activeTab === 'pages' && <FileCode className="w-4 h-4" />}
              {activeTab === 'media' && <UploadCloud className="w-4 h-4" />}
              {activeTab === 'about_us' && <Building2 className="w-4 h-4" />}
              {activeTab === 'contact_us' && <Phone className="w-4 h-4" />}
              {activeTab === 'payment_settings' && <CreditCard className="w-4 h-4" />}
              {activeTab === 'admin_settings' && <Sliders className="w-4 h-4" />}
              {activeTab === 'social_media' && <Share2 className="w-4 h-4 text-pink-500" />}
              {activeTab === 'privacy_security' && <ShieldCheck className="w-4 h-4" />}
              {activeTab === 'employee_records' && <Users className="w-4 h-4" />}
              {activeTab === 'customer_records' && <UserCheck className="w-4 h-4" />}
              {activeTab === 'master_data' && <FolderOpen className="w-4 h-4" />}
              {activeTab === 'record_integrity' && <ShieldCheck className="w-4 h-4" />}
              {activeTab === 'calendar' && <Clock className="w-4 h-4" />}
              {activeTab === 'notifications' && <BellRing className="w-4 h-4" />}
              {activeTab === 'users' && <Users className="w-4 h-4" />}
              {activeTab === 'audit' && <ShieldAlert className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Active Admin Console</span>
              <h3 className="font-black text-sm text-slate-900 truncate capitalize">
                {activeTab.replace(/_/g, ' ')}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition shrink-0 cursor-pointer active:scale-95"
          >
            <Menu className="w-4 h-4" />
            <span>Modules (25)</span>
          </button>
        </div>

        {/* Quick Horizontal Scroll Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold scrollbar-thin print:hidden">
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'analytics' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> Analytics
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'orders' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Orders ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('services')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'services' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Services ({services.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('category_management')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'category_management' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5 text-purple-500" /> Categories ({categories.length + blogCategories.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('blogs')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'blogs' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-500" /> Blogs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reviews')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'reviews' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Star className="w-3.5 h-3.5 text-amber-500" /> Reviews
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('customer_records')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'customer_records' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> Customers
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('employee_records')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'employee_records' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-blue-600" /> Employees
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('admin_settings')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'admin_settings' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-purple-600" /> Settings
          </button>
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            className="px-3 py-1.5 rounded-xl whitespace-nowrap bg-slate-100 text-slate-700 font-extrabold hover:bg-slate-200 transition cursor-pointer flex items-center gap-1 shrink-0"
          >
            All 25 Modules... <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mobile Slide-Over Modules Navigation Drawer */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex justify-end animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-black text-sm text-slate-900">Admin Modules Hub</h3>
                <p className="text-[10px] text-slate-400">Switch between 25 management consoles</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="p-2 rounded-xl bg-slate-200/70 hover:bg-slate-300 text-slate-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Filter */}
            <div className="p-3 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter 25 modules..."
                  value={mobileNavSearch}
                  onChange={(e) => setMobileNavSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>
            </div>

            {/* Modules List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-semibold">
              {/* Group 1: Operational Hub */}
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Operational Hub</span>
                <div className="space-y-1">
                  {hasPermission('dashboard.view') && (!mobileNavSearch || 'analytics desk'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('analytics'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between ${activeTab === 'analytics' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <span className="flex items-center gap-2"><Activity className="w-4 h-4" /> Analytics Desk</span>
                    </button>
                  )}
                  {hasPermission(['orders.view', 'orders.view_assigned']) && (!mobileNavSearch || 'orders queue'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('orders'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between ${activeTab === 'orders' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Orders Queue</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${activeTab === 'orders' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{orders.length}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Group 2: Content & Services */}
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Content & Services</span>
                <div className="space-y-1">
                  {hasPermission(['services.view', 'services.manage']) && (!mobileNavSearch || 'services catalog cms'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('services'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between ${activeTab === 'services' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <span className="flex items-center gap-2"><Layers className="w-4 h-4 text-blue-500" /> Services CMS</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${activeTab === 'services' ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-700'}`}>{services.length}</span>
                    </button>
                  )}
                  {hasPermission(['categories.manage', 'services.manage', 'blogs.manage']) && (!mobileNavSearch || 'category management'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('category_management'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between ${activeTab === 'category_management' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <span className="flex items-center gap-2"><FolderOpen className="w-4 h-4 text-purple-600" /> Category Management</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${activeTab === 'category_management' ? 'bg-blue-700 text-white' : 'bg-purple-100 text-purple-800'}`}>{categories.length + blogCategories.length}</span>
                    </button>
                  )}
                  {hasPermission(['blogs.view', 'blogs.manage']) && (!mobileNavSearch || 'news blogs articles'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('blogs'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between ${activeTab === 'blogs' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-emerald-600" /> News & Blogs</span>
                    </button>
                  )}
                  {hasPermission(['reviews.manage', 'blogs.manage', 'pages.manage']) && (!mobileNavSearch || 'customer reviews testimonials'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('reviews'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between ${activeTab === 'reviews' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <span className="flex items-center gap-2"><Star className="w-4 h-4 text-amber-500" /> Customer Reviews</span>
                      {reviews.filter(r => (r.status || 'Pending').toLowerCase() === 'pending').length > 0 && (
                        <span className="text-[10px] bg-amber-500 text-white font-extrabold px-1.5 py-0.5 rounded-full">
                          {reviews.filter(r => (r.status || 'Pending').toLowerCase() === 'pending').length}
                        </span>
                      )}
                    </button>
                  )}
                  {hasPermission('pages.manage') && (!mobileNavSearch || 'faqs help doubts'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('faqs'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'faqs' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <HelpCircle className="w-4 h-4" /> FAQs Help
                    </button>
                  )}
                  {hasPermission('banners.manage') && (!mobileNavSearch || 'banners promos ads'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('banners'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'banners' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <Image className="w-4 h-4" /> Banner Promos
                    </button>
                  )}
                  {hasPermission('pages.manage') && (!mobileNavSearch || 'custom pages cms'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('pages'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'pages' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <FileCode className="w-4 h-4" /> Custom Pages
                    </button>
                  )}
                  {hasPermission('media.manage') && (!mobileNavSearch || 'media library uploads'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('media'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'media' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <UploadCloud className="w-4 h-4" /> Media Library
                    </button>
                  )}
                </div>
              </div>

              {/* Group 3: Core Modules */}
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Core Modules</span>
                <div className="space-y-1">
                  {hasPermission(['about.view', 'about.manage']) && (!mobileNavSearch || 'about us module'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('about_us'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'about_us' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <Building2 className="w-4 h-4 text-blue-500" /> About Us Module
                    </button>
                  )}
                  {hasPermission('contact_settings.manage') && (!mobileNavSearch || 'contact us module'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('contact_us'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'contact_us' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <Phone className="w-4 h-4 text-emerald-600" /> Contact Us Module
                    </button>
                  )}
                  {hasPermission(['payment_settings.manage', 'payments.view']) && (!mobileNavSearch || 'payment module gateways upi'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('payment_settings'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'payment_settings' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <CreditCard className="w-4 h-4 text-amber-500" /> Payment Module
                    </button>
                  )}
                  {hasPermission(['system_settings.view', 'system_settings.manage']) && (!mobileNavSearch || 'admin settings configurations'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('admin_settings'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'admin_settings' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <Sliders className="w-4 h-4 text-purple-600" /> Admin Settings
                    </button>
                  )}
                  {hasPermission(['system_settings.view', 'system_settings.manage']) && (!mobileNavSearch || 'social media links profiles'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('social_media'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'social_media' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <Share2 className="w-4 h-4 text-pink-500" /> Social Media Links
                    </button>
                  )}
                  {(!mobileNavSearch || 'privacy security cms terms'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('privacy_security'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'privacy_security' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <ShieldCheck className="w-4 h-4 text-blue-500" /> Privacy & Security CMS
                    </button>
                  )}
                </div>
              </div>

              {/* Group 4: Record Management */}
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Record Management</span>
                <div className="space-y-1">
                  {(!mobileNavSearch || 'employee records staff'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('employee_records'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'employee_records' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <Users className="w-4 h-4 text-blue-500" /> Employee Records
                    </button>
                  )}
                  {(!mobileNavSearch || 'customer records clients'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('customer_records'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'customer_records' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <UserCheck className="w-4 h-4 text-emerald-600" /> Customer Records
                    </button>
                  )}
                  {(!mobileNavSearch || 'master data lookup'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('master_data'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'master_data' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <FolderOpen className="w-4 h-4 text-purple-600" /> Master Data
                    </button>
                  )}
                  {(!mobileNavSearch || 'record integrity backup audit'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('record_integrity'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'record_integrity' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <ShieldCheck className="w-4 h-4 text-indigo-600" /> Record Integrity
                    </button>
                  )}
                </div>
              </div>

              {/* Group 5: System & Security */}
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">System & Security</span>
                <div className="space-y-1">
                  {(!mobileNavSearch || 'calendar events holidays'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('calendar'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'calendar' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <Clock className="w-4 h-4 text-cyan-600" /> Calendar Events
                    </button>
                  )}
                  {(!mobileNavSearch || 'notifications alert dispatcher broadcast'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('notifications'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'notifications' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <BellRing className="w-4 h-4 text-amber-500" /> Alert Dispatcher
                    </button>
                  )}
                  {(!mobileNavSearch || 'security users role access permissions'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('users'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'users' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <Users className="w-4 h-4 text-blue-600" /> Security & Role Access
                    </button>
                  )}
                  {(!mobileNavSearch || 'audit logs security history'.includes(mobileNavSearch.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('audit'); setIsMobileNavOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'audit' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <ShieldAlert className="w-4 h-4 text-red-500" /> Audit Logs
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono text-[10px]">{adminUser.role} Console</span>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Close Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Control Panel Dashboard Layout */}
      <div className="grid md:grid-cols-5 gap-8">

        {/* Left Side Control Panel Navigation Menu (Desktop Only) */}
        <div className="hidden md:block md:col-span-1 space-y-2">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Operational Hub</span>
            <div className="flex flex-col gap-1 text-xs font-semibold">
              {hasPermission('dashboard.view') && (
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'analytics' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Activity className="w-4 h-4" /> Analytics Desk
                </button>
              )}
              {hasPermission(['orders.view', 'orders.view_assigned']) && (
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between ${activeTab === 'orders' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Orders Queue</span>
                  <span className="bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded text-[9px]">{orders.length}</span>
                </button>
              )}
            </div>

            {hasPermission(['services.view', 'services.manage', 'categories.manage', 'blogs.view', 'blogs.manage', 'pages.manage', 'banners.manage', 'media.manage']) && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Content & Services</span>
                <div className="flex flex-col gap-1 text-xs font-semibold">
                  {hasPermission(['services.view', 'services.manage']) && (
                    <button
                      onClick={() => setActiveTab('services')}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'services' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <Layers className="w-4 h-4 text-blue-600" /> Services CMS
                    </button>
                  )}
                  {hasPermission(['categories.manage', 'services.manage', 'blogs.manage']) && (
                    <button
                      onClick={() => setActiveTab('category_management')}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between ${activeTab === 'category_management' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <span className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-purple-600" /> Category Management
                      </span>
                      <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                        {categories.length + blogCategories.length}
                      </span>
                    </button>
                  )}
                  {hasPermission(['blogs.view', 'blogs.manage']) && (
                    <button
                      onClick={() => setActiveTab('blogs')}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'blogs' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <FileText className="w-4 h-4 text-emerald-600" /> News & Blogs
                    </button>
                  )}
                  {hasPermission(['reviews.manage', 'blogs.manage', 'pages.manage']) && (
                    <button
                      onClick={() => setActiveTab('reviews')}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between ${activeTab === 'reviews' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <span className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-500" /> Customer Reviews
                      </span>
                      {reviews.filter(r => (r.status || 'Pending').toLowerCase() === 'pending').length > 0 && (
                        <span className="text-[10px] bg-amber-500 text-white font-extrabold px-1.5 py-0.5 rounded-full">
                          {reviews.filter(r => (r.status || 'Pending').toLowerCase() === 'pending').length}
                        </span>
                      )}
                    </button>
                  )}
                  {hasPermission('pages.manage') && (
                    <button
                      onClick={() => setActiveTab('faqs')}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'faqs' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <HelpCircle className="w-4 h-4" /> FAQs Help
                    </button>
                  )}
                  {hasPermission('banners.manage') && (
                    <button
                      onClick={() => setActiveTab('banners')}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'banners' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <Image className="w-4 h-4" /> Banner Promos
                    </button>
                  )}
                  {hasPermission('pages.manage') && (
                    <button
                      onClick={() => setActiveTab('pages')}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'pages' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <FileCode className="w-4 h-4" /> Custom Pages
                    </button>
                  )}
                  {hasPermission('media.manage') && (
                    <button
                      onClick={() => setActiveTab('media')}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'media' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <UploadCloud className="w-4 h-4" /> Media Library
                    </button>
                  )}
                </div>
              </div>
            )}

            {hasPermission(['about.view', 'about.manage', 'contact_settings.manage', 'payment_settings.manage', 'payments.view', 'system_settings.view', 'system_settings.manage']) && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Core Modules</span>
                <div className="flex flex-col gap-1 text-xs font-semibold">
                  {hasPermission(['about.view', 'about.manage']) && (
                    <button
                      onClick={() => setActiveTab('about_us')}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'about_us' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <Building2 className="w-4 h-4 text-blue-600" /> About Us Module
                    </button>
                  )}
                  {hasPermission('contact_settings.manage') && (
                    <button
                      onClick={() => setActiveTab('contact_us')}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'contact_us' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <Phone className="w-4 h-4 text-emerald-600" /> Contact Us Module
                    </button>
                  )}
                  {hasPermission(['payment_settings.manage', 'payments.view']) && (
                    <button
                      onClick={() => setActiveTab('payment_settings')}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'payment_settings' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <CreditCard className="w-4 h-4 text-amber-600" /> Payment Module
                    </button>
                  )}
                  {hasPermission(['system_settings.view', 'system_settings.manage']) && (
                    <button
                      onClick={() => setActiveTab('admin_settings')}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'admin_settings' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <Sliders className="w-4 h-4 text-purple-600" /> Admin Settings
                    </button>
                  )}
                  {hasPermission(['system_settings.view', 'system_settings.manage']) && (
                    <button
                      onClick={() => setActiveTab('social_media')}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'social_media' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <Share2 className="w-4 h-4 text-pink-500" /> Social Media Links
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('privacy_security')}
                    className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'privacy_security' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <ShieldCheck className="w-4 h-4 text-blue-600" /> Privacy & Security CMS
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 border-t border-slate-100 pt-4">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Record Management</span>
              <div className="flex flex-col gap-1 text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('employee_records')}
                  className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'employee_records' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Users className="w-4 h-4 text-blue-600" /> Employee Records
                </button>
                <button
                  onClick={() => setActiveTab('customer_records')}
                  className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'customer_records' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <UserCheck className="w-4 h-4 text-emerald-600" /> Customer Records
                </button>
                <button
                  onClick={() => setActiveTab('master_data')}
                  className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'master_data' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <FolderOpen className="w-4 h-4 text-purple-600" /> Master Data
                </button>
                <button
                  onClick={() => setActiveTab('record_integrity')}
                  className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'record_integrity' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <ShieldCheck className="w-4 h-4 text-indigo-600" /> Record Integrity
                </button>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-3">System & Security</span>
              <div className="flex flex-col gap-1 text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('calendar')}
                  className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'calendar' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Clock className="w-4 h-4 text-cyan-600" /> Calendar Events
                </button>
                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'notifications' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <BellRing className="w-4 h-4" /> Alert Dispatcher
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'users' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Users className="w-4 h-4" /> Security & Role Access
                </button>
                <button
                  onClick={() => setActiveTab('audit')}
                  className={`w-full text-left p-2.5 rounded-xl transition flex items-center gap-2 ${activeTab === 'audit' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <ShieldAlert className="w-4 h-4" /> Audit Logs
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Right Side Main Work Board */}
        <div className="md:col-span-4 space-y-6">
          <Suspense fallback={<AdminModuleFallback />}>
            {/* Active Tab 1: Analytics Dashboard */}
            {activeTab === 'analytics' && (
              <AnalyticsDashboardModule
                orders={orders}
                services={services}
                customersCount={summary.totalUsers}
                onRefresh={() => { fetchTabData(); }}
                isLoading={isRefreshing}
              />
            )}

          {/* Active Tab 2: Orders Queue Dashboard */}
          {activeTab === 'orders' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Order Status Distribution Chart */}
              <OrderStatusChart orders={orders} />

              <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 leading-none">Operations Orders Board</h3>
                  <p className="text-[11px] text-slate-400 mt-1">Review, create, edit, and fulfill all customer service applications</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsCreateOrderModalOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Create Order</span>
                  </button>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search ID, customer, mobile..."
                      className="border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs w-48 sm:w-56 focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Channel & Source Filter Pills */}
              <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Source:</span>
                  {[
                    { id: 'ALL', label: 'All Sources', count: orders.length },
                    { id: 'WhatsApp', label: 'WhatsApp', count: orders.filter(o => o.orderSource === 'WhatsApp').length },
                    { id: 'Website', label: 'Website', count: orders.filter(o => !o.orderSource || o.orderSource === 'Website').length },
                    { id: 'Phone', label: 'Phone', count: orders.filter(o => o.orderSource === 'Phone').length },
                    { id: 'In-Person', label: 'In-Person', count: orders.filter(o => o.orderSource === 'In-Person').length },
                    { id: 'Other', label: 'Other', count: orders.filter(o => o.orderSource === 'Other').length }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setOrderSourceFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border ${
                        orderSourceFilter === tab.id
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {tab.label}
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        orderSourceFilter === tab.id ? 'bg-slate-700 text-slate-100' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status:</span>
                  <select
                    value={orderStatusTabFilter}
                    onChange={e => setOrderStatusTabFilter(e.target.value)}
                    className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white font-medium"
                  >
                    <option value="ALL">All Statuses ({orders.length})</option>
                    <option value="Pending">Pending</option>
                    <option value="Processing">Processing</option>
                    <option value="Documents Required">Documents Required</option>
                    <option value="Under Verification">Under Verification</option>
                    <option value="Completed">Completed</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {/* Mobile View: Cards Layout */}
              <div className="sm:hidden p-3 space-y-3">
                {filteredOrders.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
                    No active matching orders in database queue.
                  </div>
                ) : (
                  filteredOrders.map(order => {
                    const isWhatsApp = order.orderSource === 'WhatsApp';
                    const sourceBadge = isWhatsApp ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                        <MessageSquare className="w-2.5 h-2.5 text-emerald-600" /> WhatsApp
                      </span>
                    ) : order.orderSource === 'Phone' ? (
                      <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                        <Phone className="w-2.5 h-2.5 text-indigo-600" /> Phone
                      </span>
                    ) : order.orderSource === 'In-Person' ? (
                      <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                        <Users className="w-2.5 h-2.5 text-purple-600" /> In-Person
                      </span>
                    ) : order.orderSource === 'Other' ? (
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                        Other
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                        <Globe className="w-2.5 h-2.5 text-blue-600" /> Website
                      </span>
                    );

                    const formattedDate = order.createdAt
                      ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—';

                    return (
                      <div key={order.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                        {/* Top row: Order ID, Date & Source */}
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div>
                            <span className="font-mono font-black text-slate-900 text-xs">#{order.id}</span>
                            <span className="text-[10px] text-slate-400 block">{formattedDate}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {sourceBadge}
                          </div>
                        </div>

                        {/* Customer & Service info */}
                        <div className="space-y-1 text-xs">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-bold text-slate-900 text-sm">{order.name}</span>
                            <span className="font-mono font-black text-slate-950 text-sm">
                              ₹{typeof order.totalAmount === 'number' ? order.totalAmount.toLocaleString() : order.totalAmount}
                            </span>
                          </div>
                          <p className="text-blue-700 font-semibold text-xs">{order.serviceTitle}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 font-mono pt-1">
                            {order.mobile && (
                              <a href={`tel:${order.mobile}`} className="text-slate-600 hover:text-blue-600 flex items-center gap-1">
                                📞 {order.mobile}
                              </a>
                            )}
                            {order.email && (
                              <a href={`mailto:${order.email}`} className="text-slate-600 hover:text-blue-600 flex items-center gap-1 truncate max-w-[200px]">
                                ✉️ {order.email}
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Status Badges */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-lg border font-bold text-[10px] ${
                              order.orderStatus === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              order.orderStatus === 'Processing' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              order.orderStatus === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {order.orderStatus}
                            </span>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                              order.paymentStatus === 'Verified' ? 'bg-emerald-100 text-emerald-800' :
                              order.paymentStatus === 'Rejected' ? 'bg-red-100 text-red-800' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              Pay: {order.paymentStatus || 'Pending'}
                            </span>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOrder(order);
                                setOrderStatusUpdate(order.orderStatus);
                                setOrderStaffAssignment(order.assignedStaffId || '');
                              }}
                              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] px-3 py-1.5 rounded-xl tracking-wide transition cursor-pointer"
                            >
                              Manage
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOrderToEdit(order);
                                setIsEditOrderModalOpen(true);
                              }}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-[11px] px-2.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1"
                            >
                              <Edit className="w-3 h-3" /> Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop View: Table Layout with horizontal scroll */}
              <div className="hidden sm:block overflow-x-auto text-xs">
                <table className="w-full min-w-[800px] text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                      <th className="p-3">Order ID & Date</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Target Service</th>
                      <th className="p-3">Source</th>
                      <th className="p-3">Total Amount</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Payment</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          No active matching orders in database queue.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map(order => {
                        const isWhatsApp = order.orderSource === 'WhatsApp';
                        const sourceBadge = isWhatsApp ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            <MessageSquare className="w-2.5 h-2.5 text-emerald-600" /> WhatsApp
                          </span>
                        ) : order.orderSource === 'Phone' ? (
                          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            <Phone className="w-2.5 h-2.5 text-indigo-600" /> Phone
                          </span>
                        ) : order.orderSource === 'In-Person' ? (
                          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            <Users className="w-2.5 h-2.5 text-purple-600" /> In-Person
                          </span>
                        ) : order.orderSource === 'Other' ? (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            Other
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            <Globe className="w-2.5 h-2.5 text-blue-600" /> Website
                          </span>
                        );

                        const formattedDate = order.createdAt
                          ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—';

                        return (
                          <tr key={order.id} className="hover:bg-slate-50/60 transition">
                            <td className="p-3">
                              <p className="font-mono font-bold text-slate-950">{order.id}</p>
                              <span className="text-[10px] text-slate-400 block">{formattedDate}</span>
                            </td>
                            <td className="p-3">
                              <p className="font-bold text-slate-900">{order.name}</p>
                              <div className="flex flex-col text-[10px] text-slate-400 font-mono">
                                {order.mobile && <span>📞 {order.mobile}</span>}
                                {order.email && <span>✉️ {order.email}</span>}
                              </div>
                            </td>
                            <td className="p-3 text-slate-700 font-medium">
                              {order.serviceTitle}
                            </td>
                            <td className="p-3">
                              {sourceBadge}
                            </td>
                            <td className="p-3 font-bold text-slate-950 font-mono">
                              ₹{typeof order.totalAmount === 'number' ? order.totalAmount.toLocaleString() : order.totalAmount}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-lg border font-bold text-[10px] ${
                                order.orderStatus === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                order.orderStatus === 'Processing' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                order.orderStatus === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                                'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {order.orderStatus}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                order.paymentStatus === 'Verified' ? 'bg-emerald-100 text-emerald-800' :
                                order.paymentStatus === 'Rejected' ? 'bg-red-100 text-red-800' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {order.paymentStatus || 'Pending'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedOrder(order);
                                    setOrderStatusUpdate(order.orderStatus);
                                    setOrderStaffAssignment(order.assignedStaffId || '');
                                  }}
                                  className="bg-slate-900 hover:bg-slate-800 text-white font-black text-[9px] px-2.5 py-1.5 rounded-lg tracking-wide transition cursor-pointer"
                                  title="View Order Details & Status Drawer"
                                >
                                  Drawer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOrderToEdit(order);
                                    setIsEditOrderModalOpen(true);
                                  }}
                                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-[9px] px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                                  title="Edit Order Parameters"
                                >
                                  <Edit className="w-2.5 h-2.5" /> Edit
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

              {/* Progress Order sliding overlay drawer */}
              {selectedOrder && (
                <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-w-md w-full space-y-4 animate-in zoom-in-95 duration-100 text-xs text-left max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">Manage Order {selectedOrder.id}</h4>
                        <span className="text-[10px] text-slate-400">Customer: {selectedOrder.name}</span>
                      </div>
                      <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
                    </div>

                    {/* Order Channel & WhatsApp Context Callout */}
                    {selectedOrder.orderSource === 'WhatsApp' ? (
                      <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                              <MessageSquare className="w-3.5 h-3.5" />
                            </span>
                            <div>
                              <strong className="text-emerald-950 font-bold text-xs block">WhatsApp Order</strong>
                              <span className="text-[10px] text-emerald-700">Created from verified WhatsApp discussion</span>
                            </div>
                          </div>
                          {selectedOrder.mobile && (
                            <a
                              href={`https://wa.me/91${selectedOrder.mobile.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-xl transition flex items-center gap-1 shadow-2xs"
                            >
                              Open Chat ↗
                            </a>
                          )}
                        </div>
                        {selectedOrder.sourceReference && (
                          <div className="bg-white/80 rounded-xl p-2 text-[10px] text-emerald-900 border border-emerald-100">
                            <strong>WhatsApp Note / Reference:</strong> {selectedOrder.sourceReference}
                          </div>
                        )}
                      </div>
                    ) : selectedOrder.orderSource ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-500 font-medium">
                          Source Channel: <strong className="text-slate-900 font-bold">{selectedOrder.orderSource}</strong>
                        </span>
                        {selectedOrder.sourceReference && (
                          <span className="text-[10px] text-slate-500 italic max-w-[200px] truncate">{selectedOrder.sourceReference}</span>
                        )}
                      </div>
                    ) : null}

                    {/* Quick Edit Parameters Action */}
                    <button
                      type="button"
                      onClick={() => {
                        setOrderToEdit(selectedOrder);
                        setIsEditOrderModalOpen(true);
                      }}
                      className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2 rounded-xl border border-blue-200 transition text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Edit Order Details & Customer Info
                    </button>

                    {/* Customer Contact & Summary */}
                    <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Customer Contact</span>
                        {selectedOrder.customerId && (
                          <span className="text-[9px] font-mono bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded border border-purple-200">
                            ID: {selectedOrder.customerId.slice(0, 10)}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-slate-900">{selectedOrder.name}</p>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 font-mono pt-1">
                        <div>📞 {selectedOrder.mobile || 'No mobile recorded'}</div>
                        <div>✉️ {selectedOrder.email || 'No email recorded'}</div>
                      </div>
                    </div>

                    {/* Payment Proof Verification Panel */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">Payment Proof Verification</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          selectedOrder.paymentStatus === 'Verified' ? 'bg-green-100 text-green-700' :
                          selectedOrder.paymentStatus === 'Rejected' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {selectedOrder.paymentStatus || 'Pending Verification'}
                        </span>
                      </div>

                      <div className="space-y-1 text-slate-600">
                        <p><strong>UTR / Ref No:</strong> <span className="font-mono text-blue-600 font-bold">{selectedOrder.utr || 'Not submitted'}</span></p>
                        {selectedOrder.paymentDate && <p><strong>Payment Date:</strong> {selectedOrder.paymentDate}</p>}
                        {selectedOrder.paymentScreenshot && (
                          <p><strong>Screenshot:</strong> <a href={selectedOrder.paymentScreenshot} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-bold ml-1">View Image Link</a></p>
                        )}
                        {selectedOrder.rejectionReason && (
                          <p className="text-red-600"><strong>Rejection Reason:</strong> {selectedOrder.rejectionReason}</p>
                        )}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleVerifyPayment(selectedOrder.id, 'Verified')}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 rounded-xl transition cursor-pointer text-center"
                        >
                          ✓ Approve Payment
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const reason = prompt('Enter rejection reason:');
                            if (reason !== null) {
                              handleVerifyPayment(selectedOrder.id, 'Rejected', reason);
                            }
                          }}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 rounded-xl transition cursor-pointer text-center"
                        >
                          ✕ Reject Payment
                        </button>
                      </div>
                    </div>

                    {/* Final Completed Document & WhatsApp Delivery Actions */}
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Final Completed Document URL</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g. https://.../Certificate.pdf"
                            defaultValue={selectedOrder.finalDocumentUrl || ''}
                            id="admin-final-doc-url"
                            className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-xs bg-white"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const inputEl = document.getElementById('admin-final-doc-url') as HTMLInputElement;
                              const docUrl = inputEl?.value?.trim();
                              if (!docUrl) { alert('Please enter a document URL'); return; }
                              try {
                                const res = await adminFetch(`/api/admin/orders/${selectedOrder.id}/final-document`, {
                                  method: 'POST',
                                  body: JSON.stringify({ finalDocumentUrl: docUrl, finalDocumentName: `${selectedOrder.serviceTitle}_Final.pdf` })
                                });
                                if (res.ok) {
                                  triggerAlert('Final document attached & order set to Ready!');
                                  setSelectedOrder(null);
                                  fetchTabData();
                                  onRefreshCatalogs?.();
                                } else {
                                  const err = await res.json().catch(() => ({}));
                                  alert(err.message || 'Failed to attach final document.');
                                }
                              } catch (e: any) {
                                alert(e.message || 'Error attaching final document.');
                              }
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer transition"
                          >
                            Attach Doc
                          </button>
                        </div>
                        {selectedOrder.finalDocumentUrl && (
                          <p className="text-[10px] text-emerald-600 mt-1">
                            Current Doc: <a href={selectedOrder.finalDocumentUrl} target="_blank" rel="noreferrer" className="underline font-bold">{selectedOrder.finalDocumentName || 'View Document'}</a>
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">WhatsApp Dispatch</span>
                          <span className="text-[10px] text-slate-600 font-mono">
                            {selectedOrder.documentDeliveryStatus === 'SENT_VIA_WHATSAPP' ? '✓ Sent via WhatsApp' : 'Not sent yet'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const notes = prompt('Enter WhatsApp dispatch notes:', 'Sent completed document via WhatsApp');
                            if (notes !== null) {
                              try {
                                const res = await adminFetch(`/api/admin/orders/${selectedOrder.id}/whatsapp-delivery`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ whatsAppDeliveryNotes: notes })
                                });
                                if (res.ok) {
                                  triggerAlert('Marked as Sent via WhatsApp!');
                                  setSelectedOrder(null);
                                  fetchTabData();
                                  onRefreshCatalogs?.();
                                } else {
                                  const err = await res.json().catch(() => ({}));
                                  alert(err.message || 'Failed to update WhatsApp delivery status.');
                                }
                              } catch (e: any) {
                                alert(e.message || 'Error updating WhatsApp delivery.');
                              }
                            }
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer transition"
                        >
                          Mark Sent via WhatsApp
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleCommitOrderUpdate} className="space-y-4 pt-2 border-t border-slate-100">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Update Status Phase</label>
                        <select
                          value={orderStatusUpdate}
                          onChange={(e) => setOrderStatusUpdate(e.target.value as OrderStatus)}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Documents Required">Documents Required</option>
                          <option value="Under Verification">Under Verification</option>
                          <option value="Processing">Processing</option>
                          <option value="Completed">Completed</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>

                      {/* Employee Order Assignment Dropdown Panel */}
                      <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold text-indigo-900 uppercase tracking-wider">Employee Assignment</span>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${selectedOrder.assignedEmployeeId ? 'bg-indigo-600 text-white' : 'bg-amber-100 text-amber-800'}`}>
                            {selectedOrder.assignmentStatus || (selectedOrder.assignedEmployeeId ? 'Assigned' : 'Unassigned')}
                          </span>
                        </div>

                        {selectedOrder.assignedEmployeeName ? (
                          <div className="bg-white p-2.5 rounded-xl border border-indigo-100 flex items-center justify-between">
                            <div>
                              <p className="font-bold text-slate-900 text-xs">{selectedOrder.assignedEmployeeName}</p>
                              <p className="text-[10px] text-slate-500 font-mono">
                                {selectedOrder.assignedEmployeeCode} • {selectedOrder.assignedEmployeeDesignation} ({selectedOrder.assignedEmployeeDepartment})
                              </p>
                              {selectedOrder.assignedAt && (
                                <p className="text-[9px] text-slate-400 mt-0.5">Assigned: {new Date(selectedOrder.assignedAt).toLocaleString()}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAssignEmployeeToOrder(selectedOrder.id, 'unassigned')}
                              className="text-[9px] bg-red-50 text-red-700 hover:bg-red-100 font-bold px-2 py-1 rounded-lg transition"
                            >
                              Unassign
                            </button>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 italic">No employee assigned to process this order.</p>
                        )}

                        <div className="space-y-1.5 pt-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase block">Select Active Employee to Assign / Reassign</label>
                          <input
                            type="text"
                            placeholder="Filter by name, code, dept, designation..."
                            value={assigneeSearch}
                            onChange={(e) => setAssigneeSearch(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-2.5 py-1 text-xs bg-white mb-1 focus:outline-none"
                          />
                          <select
                            value={selectedOrder.assignedEmployeeId || 'unassigned'}
                            onChange={(e) => {
                              handleAssignEmployeeToOrder(selectedOrder.id, e.target.value);
                            }}
                            className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs bg-white font-bold text-slate-900 cursor-pointer shadow-sm"
                          >
                            <option value="unassigned">-- Select Employee --</option>
                            {assignableEmployees
                              .filter(emp => {
                                if (!assigneeSearch) return true;
                                const term = assigneeSearch.toLowerCase();
                                return (
                                  emp.fullName?.toLowerCase().includes(term) ||
                                  emp.employeeCode?.toLowerCase().includes(term) ||
                                  emp.department?.toLowerCase().includes(term) ||
                                  emp.designation?.toLowerCase().includes(term)
                                );
                              })
                              .map(emp => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.fullName} ({emp.employeeCode}) — {emp.designation} [{emp.department}]
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Advisory Status Log Note</label>
                        <textarea
                          rows={2}
                          required
                          value={orderCommentUpdate}
                          onChange={(e) => setOrderCommentUpdate(e.target.value)}
                          placeholder="e.g. Identity verified. File dispatched to central agency portal."
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl transition"
                      >
                        Commit Phase Progress Log
                      </button>
                    </form>
                  </div>
                </div>
              )}

              </div>
            </div>
          )}

          {/* Active Tab 3: Services CMS */}
          {activeTab === 'services' && (
            isServiceEditorOpen ? (
              <ServiceEditorModule
                initialService={editingService}
                categories={categories}
                onSave={handleSaveService}
                onCancel={() => {
                  setIsServiceEditorOpen(false);
                  setEditingService(null);
                }}
                onNavigateToCategories={() => {
                  setIsServiceEditorOpen(false);
                  setEditingService(null);
                  setActiveTab('category_management');
                }}
              />
            ) : (
              <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-150">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-xs text-slate-900 leading-none">Catalog Services CMS Manager</h3>
                    <p className="text-[9px] text-slate-400 mt-1">Add, update details, or hide available services immediately</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openAddForm('service')}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Service
                    </button>
                    <button
                      onClick={() => setActiveTab('category_management')}
                      className="bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition border border-purple-200"
                    >
                      <FolderOpen className="w-3.5 h-3.5" /> Manage Categories
                    </button>
                  </div>
                </div>

                {/* Filtering Controls */}
                <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-wrap gap-4 text-xs font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Category Filter:</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="border border-slate-200 rounded-lg px-2 py-1 bg-white"
                    >
                      <option value="all">All Categories</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search services by title..."
                      className="border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 w-full bg-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Mobile View: Service Cards */}
                <div className="sm:hidden p-3 space-y-3">
                  {filteredServices.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
                      No services found matching search or category filter.
                    </div>
                  ) : (
                    filteredServices.map(svc => {
                      const catName = categories.find(c => c.id === svc.categoryId)?.name || svc.categoryId;
                      return (
                        <div key={svc.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                          <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">{svc.id}</span>
                                <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-bold truncate max-w-[150px]">{catName}</span>
                              </div>
                              <h4 className="font-bold text-slate-900 text-sm mt-1">{svc.title}</h4>
                            </div>
                          </div>

                          {svc.description && (
                            <p className="text-xs text-slate-500 line-clamp-2">{svc.description}</p>
                          )}

                          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl text-center text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 block">Gov Fees</span>
                              <span className="font-mono font-bold text-slate-800">₹{svc.govFees}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Service Charge</span>
                              <span className="font-mono font-bold text-blue-700">₹{svc.serviceCharge}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Processing</span>
                              <span className="font-mono text-[11px] text-slate-600 truncate block">{svc.processingTime || 'Standard'}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => handleDuplicateService(svc)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-xl font-bold transition cursor-pointer"
                            >
                              Duplicate
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditForm('service', svc)}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs px-3 py-1.5 rounded-xl font-bold transition cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem('service', svc.id)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 text-xs px-3 py-1.5 rounded-xl font-bold transition cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Desktop View: Table */}
                <div className="hidden sm:block overflow-x-auto text-xs">
                  <table className="w-full min-w-[740px] text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                        <th className="p-3">Service Code</th>
                        <th className="p-3">Title</th>
                        <th className="p-3">Category ID</th>
                        <th className="p-3">Gov Fees</th>
                        <th className="p-3">Service Charge</th>
                        <th className="p-3">Processing Time</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium">
                      {filteredServices.map(svc => (
                        <tr key={svc.id} className="hover:bg-slate-50/40 transition">
                          <td className="p-3 font-mono font-bold text-slate-900">{svc.id}</td>
                          <td className="p-3">
                            <p className="font-bold">{svc.title}</p>
                            <span className="text-[9px] text-slate-400 block max-w-[200px] truncate">{svc.description}</span>
                          </td>
                          <td className="p-3 font-mono text-slate-500">{svc.categoryId}</td>
                          <td className="p-3 text-slate-700">₹{svc.govFees}</td>
                          <td className="p-3 text-slate-700 font-bold">₹{svc.serviceCharge}</td>
                          <td className="p-3 text-slate-500 font-mono">{svc.processingTime}</td>
                          <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => handleDuplicateService(svc)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] px-2 py-1 rounded-lg font-bold"
                            >
                              Duplicate
                            </button>
                            <button
                              onClick={() => openEditForm('service', svc)}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] px-2 py-1 rounded-lg font-bold"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteItem('service', svc.id)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 text-[10px] px-2 py-1 rounded-lg font-bold"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* Active Tab: Category Management System */}
          {activeTab === 'category_management' && (
            <CategoryManagementAdminModule
              categories={categories}
              blogCategories={blogCategories}
              services={services}
              blogs={blogs}
              adminFetch={adminFetch}
              triggerAlert={triggerAlert}
              onRefreshCatalogs={() => {
                onRefreshCatalogs?.();
                fetchTabData();
              }}
            />
          )}

          {/* Active Tab 4: Blogs & Articles CMS */}
          {activeTab === 'blogs' && (
            isBlogEditorOpen ? (
              <BlogEditorModule
                initialBlog={editingBlog}
                categories={blogCategories}
                currentUserName={adminUser?.name || 'Desk Officer'}
                onSave={handleSaveBlog}
                onCancel={() => {
                  setIsBlogEditorOpen(false);
                  setEditingBlog(null);
                }}
                onNavigateToCategories={() => {
                  setIsBlogEditorOpen(false);
                  setEditingBlog(null);
                  setActiveTab('category_management');
                }}
              />
            ) : (
              <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-150">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-xs text-slate-900 leading-none">News & Blogs Guides CMS</h3>
                    <p className="text-[9px] text-slate-400 mt-1">Publish search-engine friendly guides organized category-wise</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openAddForm('blog')}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Publish Blog
                    </button>
                  </div>
                </div>

                {/* Search & Category Filter Bar */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search articles by title, content, tags..."
                        value={blogSearchQuery}
                        onChange={(e) => setBlogSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Category:</label>
                      <select
                        value={blogCategoryFilter}
                        onChange={(e) => setBlogCategoryFilter(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                      >
                        <option value="ALL">All Categories ({blogs.length})</option>
                        {blogCategories.map(cat => {
                          const count = blogs.filter(b => b.categoryId === cat.id || b.category === cat.name).length;
                          return (
                            <option key={cat.id} value={cat.id}>
                              {cat.name} ({count}) {cat.status === 'Inactive' ? '(Inactive)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div className="text-[10px] font-bold text-slate-400">
                    Showing {
                      blogs.filter(blog => {
                        const matchesCategory = blogCategoryFilter === 'ALL' || blog.categoryId === blogCategoryFilter || blog.category === blogCategoryFilter;
                        const matchesSearch = !blogSearchQuery ||
                          blog.title.toLowerCase().includes(blogSearchQuery.toLowerCase()) ||
                          blog.content.toLowerCase().includes(blogSearchQuery.toLowerCase()) ||
                          (blog.category && blog.category.toLowerCase().includes(blogSearchQuery.toLowerCase())) ||
                          (blog.tags && blog.tags.some(t => t.toLowerCase().includes(blogSearchQuery.toLowerCase())));
                        return matchesCategory && matchesSearch;
                      }).length
                    } of {blogs.length} articles
                  </div>
                </div>

                {/* Blogs Grid */}
                <div className="grid sm:grid-cols-2 gap-4 p-4 text-xs font-semibold">
                  {blogs
                    .filter(blog => {
                      const matchesCategory = blogCategoryFilter === 'ALL' || blog.categoryId === blogCategoryFilter || blog.category === blogCategoryFilter;
                      const matchesSearch = !blogSearchQuery ||
                        blog.title.toLowerCase().includes(blogSearchQuery.toLowerCase()) ||
                        blog.content.toLowerCase().includes(blogSearchQuery.toLowerCase()) ||
                        (blog.category && blog.category.toLowerCase().includes(blogSearchQuery.toLowerCase())) ||
                        (blog.tags && blog.tags.some(t => t.toLowerCase().includes(blogSearchQuery.toLowerCase())));
                      return matchesCategory && matchesSearch;
                    })
                    .map(blog => {
                      const resolvedCat = blogCategories.find(c => c.id === blog.categoryId || c.name.toLowerCase() === (blog.category || '').toLowerCase());
                      const categoryDisplayName = resolvedCat ? resolvedCat.name : (blog.category || 'Uncategorized');

                      return (
                        <div key={blog.id} className="bg-slate-50/50 border border-slate-200/60 rounded-2xl p-4 flex gap-4 hover:border-slate-300 transition">
                          <img
                            src={blog.image || 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=400'}
                            alt={blog.title}
                            className="w-20 h-20 object-cover rounded-xl shrink-0 border border-slate-200/60"
                          />
                          <div className="flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-100 font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                                  {categoryDisplayName}
                                </span>
                                <span className="text-[9px] text-slate-400">
                                  👁️ {blog.views || 0} views
                                </span>
                              </div>
                              <h4 className="font-bold text-xs text-slate-900 mt-1.5 line-clamp-1">{blog.title}</h4>
                              <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed mt-1 font-normal">{blog.content}</p>
                            </div>
                            <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-2.5">
                              <span className="text-[9px] text-slate-400 font-medium">
                                By {blog.author || 'Desk Officer'}
                              </span>
                              <div className="space-x-3">
                                <button onClick={() => openEditForm('blog', blog)} className="text-blue-600 font-bold hover:underline cursor-pointer">Edit</button>
                                <button onClick={() => handleDeleteItem('blog', blog.id)} className="text-red-500 font-bold hover:underline cursor-pointer">Delete</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )
          )}

          {/* Active Tab 4.5: Customer Reviews Moderation */}
          {activeTab === 'reviews' && (
            <ReviewsAdminModule initialReviews={reviews} onReviewsChange={setReviews} onRefreshCatalogs={onRefreshCatalogs} />
          )}

          {/* Active Tab 5: FAQs Help */}
          {activeTab === 'faqs' && (
            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-150">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-xs text-slate-900 leading-none">Frequently Asked Questions CMS</h3>
                  <p className="text-[9px] text-slate-400 mt-1">Define immediate responses to citizens doubts</p>
                </div>
                <button
                  onClick={() => openAddForm('faq')}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer transition"
                >
                  Create FAQ Item
                </button>
              </div>

              <div className="p-4 divide-y divide-slate-100 text-xs">
                {faqs.map(item => (
                  <div key={item.id} className="py-3 flex justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-800">Q: {item.question}</p>
                      <p className="text-slate-500 mt-1 font-medium">A: {item.answer}</p>
                      <span className="text-[9px] bg-slate-50 border text-slate-400 font-mono px-1.5 py-0.5 rounded mt-1.5 inline-block">{item.category}</span>
                    </div>
                    <div className="shrink-0 space-x-2">
                      <button onClick={() => openEditForm('faq', item)} className="text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => handleDeleteItem('faq', item.id)} className="text-red-500 hover:underline">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Tab 6: Banners Campaigns */}
          {activeTab === 'banners' && (
            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-150">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-xs text-slate-900 leading-none">Campaign Marketing Banners</h3>
                  <p className="text-[9px] text-slate-400 mt-1">Feature slideshow promotions or festival discount events</p>
                </div>
                <button
                  onClick={() => openAddForm('banner')}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer transition"
                >
                  Add Banner Slide
                </button>
              </div>

              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 p-4 text-xs font-semibold">
                {banners.map(banner => (
                  <div key={banner.id} className="border border-slate-200/50 rounded-2xl overflow-hidden bg-slate-50/50 flex flex-col justify-between">
                    <img src={banner.imageUrl} alt={banner.title} className="h-28 w-full object-cover border-b" />
                    <div className="p-3 space-y-2">
                      <h4 className="font-bold text-slate-900 line-clamp-1">{banner.title}</h4>
                      <p className="text-[10px] text-slate-400 font-mono truncate">Link: {banner.linkUrl}</p>
                      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${banner.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                          {banner.isActive ? 'Active Campaign' : 'Suspended'}
                        </span>
                        <div className="space-x-2">
                          <button onClick={() => openEditForm('banner', banner)} className="text-blue-600 hover:underline">Edit</button>
                          <button onClick={() => handleDeleteItem('banner', banner.id)} className="text-red-500 hover:underline">Delete</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Tab 7: Custom Pages builder */}
          {activeTab === 'pages' && (
            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-150">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-xs text-slate-900 leading-none">CMS Custom Pages Builder</h3>
                  <p className="text-[9px] text-slate-400 mt-1">Re-compile core platform informational documents immediately</p>
                </div>
                <button
                  onClick={() => openAddForm('page')}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer transition"
                >
                  Build Custom Page
                </button>
              </div>

              <div className="p-4 space-y-3 text-xs">
                {pages.map(page => (
                  <div key={page.id} className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900">{page.title}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Slug: /{page.slug} | Status: {page.isActive ? 'Active' : 'Draft'}</p>
                      <p className="text-slate-500 line-clamp-1 max-w-lg font-medium mt-1.5">{page.content}</p>
                    </div>
                    <div className="shrink-0 space-x-2.5">
                      <button onClick={() => openEditForm('page', page)} className="text-blue-600 hover:underline font-bold">Edit</button>
                      <button onClick={() => handleDeleteItem('page', page.id)} className="text-red-500 hover:underline font-bold">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Tab 8: Media Library */}
          {activeTab === 'media' && (
            <div className="animate-in fade-in duration-150">
              <MediaLibraryAdminModule />
            </div>
          )}

          {/* Active Tab 9: Security Access Role Manager */}
          {activeTab === 'users' && (() => {
            const superAdminUser = allUsersList.find(u => (u.email || '').toLowerCase().trim() === 'tideepak8@gmail.com' || u.role === 'SUPER_ADMIN') || {
              name: 'Deepak',
              email: 'tideepak8@gmail.com',
              role: 'SUPER_ADMIN',
              mobile: '+91 99999 99999',
              createdAt: '2023-01-01T00:00:00.000Z'
            };

            const staffList = allUsersList.filter(u => ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'STAFF'].includes(String(u.role).toUpperCase()) || (u.role as any) === UserRole.ADMIN);
            const customerList = allUsersList.filter(u => !['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'STAFF'].includes(String(u.role).toUpperCase()) && (u.role as any) !== UserRole.ADMIN);

            const filteredList = allUsersList.filter(u => {
              const isStaff = ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'STAFF'].includes(String(u.role).toUpperCase()) || (u.role as any) === UserRole.ADMIN;
              if (userTabFilter === 'staff' && !isStaff) return false;
              if (userTabFilter === 'customers' && isStaff) return false;

              if (userTabSearch) {
                const query = userTabSearch.toLowerCase().trim();
                const match = (u.name && u.name.toLowerCase().includes(query)) ||
                  (u.email && u.email.toLowerCase().includes(query)) ||
                  (u.mobile && u.mobile.toLowerCase().includes(query)) ||
                  (u.role && String(u.role).toLowerCase().includes(query));
                if (!match) return false;
              }
              return true;
            });

            return (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Platform Root Super Admin Authority Card */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center shrink-0 shadow-inner">
                      <ShieldCheck className="w-6 h-6 text-purple-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-300 bg-purple-900/60 px-2 py-0.5 rounded border border-purple-500/40">
                          Sole Super Admin (Root)
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Protected
                        </span>
                      </div>
                      <h3 className="font-bold text-base text-white mt-1 leading-tight">{superAdminUser.name || 'Deepak'}</h3>
                      <p className="text-xs text-slate-300 font-mono mt-0.5 flex items-center gap-2">
                        <span>{superAdminUser.email}</span>
                        {superAdminUser.mobile && <span className="text-slate-400">• {superAdminUser.mobile}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isSuper && (
                      <button
                        onClick={handlePurgeTestAccounts}
                        disabled={isPurgingTests}
                        className="bg-slate-800/80 hover:bg-slate-700/90 text-slate-200 border border-slate-700 text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer transition flex items-center gap-1.5"
                        title="Remove automated test/mock accounts"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                        {isPurgingTests ? 'Purging...' : 'Clean Test Accounts'}
                      </button>
                    )}
                    <button
                      onClick={() => openAddForm('user')}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition shadow-sm flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Create Security User
                    </button>
                  </div>
                </div>

                {/* Account Category Tabs & Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => setUserTabFilter('staff')}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${userTabFilter === 'staff' ? 'bg-blue-50/80 border-blue-200 shadow-xs' : 'bg-white border-slate-200/80 hover:bg-slate-50'}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Staff & Administrators</span>
                      <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{staffList.length}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 mt-1">Authorized Team Members</p>
                  </button>

                  <button
                    onClick={() => setUserTabFilter('customers')}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${userTabFilter === 'customers' ? 'bg-blue-50/80 border-blue-200 shadow-xs' : 'bg-white border-slate-200/80 hover:bg-slate-50'}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Customer Accounts</span>
                      <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{customerList.length}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 mt-1">Registered Platform Clients</p>
                  </button>

                  <button
                    onClick={() => setUserTabFilter('all')}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${userTabFilter === 'all' ? 'bg-blue-50/80 border-blue-200 shadow-xs' : 'bg-white border-slate-200/80 hover:bg-slate-50'}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">All System Accounts</span>
                      <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{allUsersList.length}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 mt-1">Complete User Directory</p>
                  </button>
                </div>

                {/* Table Container */}
                <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-3.5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-xs text-slate-900 leading-none">
                        {userTabFilter === 'staff' ? 'Staff & Administrative Personnel' : userTabFilter === 'customers' ? 'Customer Accounts Directory' : 'All Platform Accounts'}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-medium">({filteredList.length} total)</span>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search by name, email, role..."
                        value={userTabSearch}
                        onChange={(e) => setUserTabSearch(e.target.value)}
                        className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Mobile View: User Cards */}
                  <div className="sm:hidden p-3 space-y-3">
                    {filteredList.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
                        No user records found matching the current criteria.
                      </div>
                    ) : (
                      filteredList.map(user => {
                        const isDeepakRoot = (user.email || '').toLowerCase().trim() === 'tideepak8@gmail.com' || user.id === 'super-admin-deepak';
                        return (
                          <div key={user.id} className={`bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3 ${isDeepakRoot ? 'border-purple-300 bg-purple-50/10' : ''}`}>
                            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-900 text-sm">{user.name}</span>
                                  {isDeepakRoot && (
                                    <span className="text-[9px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded border border-purple-200">
                                      ROOT
                                    </span>
                                  )}
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider inline-block mt-1 ${getRoleBadgeStyle(user.role)}`}>
                                  {user.role}
                                </span>
                              </div>
                              <div>
                                {user.isSuspended ? (
                                  <span className="text-red-600 bg-red-50 px-2 py-0.5 border border-red-100 rounded text-[9px] font-bold">Suspended</span>
                                ) : (
                                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-100 rounded text-[9px] font-bold">Active</span>
                                )}
                              </div>
                            </div>

                            <div className="text-xs space-y-1 font-mono text-slate-600">
                              <p className="truncate">✉️ {user.email}</p>
                              {user.mobile && <p>📞 {user.mobile}</p>}
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => openEditForm('user', user)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs px-3 py-1.5 rounded-xl font-bold transition cursor-pointer"
                              >
                                Edit Role / Details
                              </button>
                              {isSuper && !isDeepakRoot && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem('user', user.id)}
                                  className="bg-red-50 hover:bg-red-100 text-red-600 text-xs px-3 py-1.5 rounded-xl font-bold transition cursor-pointer"
                                >
                                  Delete
                                </button>
                              )}
                              {isDeepakRoot && (
                                <span className="text-[10px] text-slate-400 italic px-2">Protected</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Desktop View: Table */}
                  <div className="hidden sm:block overflow-x-auto text-xs">
                    <table className="w-full min-w-[650px] text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                          <th className="p-3">User Name</th>
                          <th className="p-3">Email Address</th>
                          <th className="p-3">Contact Mobile</th>
                          <th className="p-3">Authorization Role</th>
                          <th className="p-3">Account Status</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-medium">
                        {filteredList.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                              No user records found matching the current criteria.
                            </td>
                          </tr>
                        ) : (
                          filteredList.map(user => {
                            const isDeepakRoot = (user.email || '').toLowerCase().trim() === 'tideepak8@gmail.com' || user.id === 'super-admin-deepak';
                            return (
                              <tr key={user.id} className={`hover:bg-slate-50/60 transition ${isDeepakRoot ? 'bg-purple-50/20' : ''}`}>
                                <td className="p-3 font-bold text-slate-900">
                                  <div className="flex items-center gap-2">
                                    <span>{user.name}</span>
                                    {isDeepakRoot && (
                                      <span className="text-[9px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded border border-purple-200">
                                        ROOT
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 font-mono text-slate-600">{user.email}</td>
                                <td className="p-3 font-mono text-slate-500">{user.mobile || '—'}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${getRoleBadgeStyle(user.role)}`}>
                                    {user.role}
                                  </span>
                                </td>
                                <td className="p-3">
                                  {user.isSuspended ? (
                                    <span className="text-red-600 bg-red-50 px-2 py-0.5 border border-red-100 rounded text-[9px] font-bold">Suspended</span>
                                  ) : (
                                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-100 rounded text-[9px] font-bold">Active</span>
                                  )}
                                </td>
                                <td className="p-3 text-right space-x-2">
                                  <button onClick={() => openEditForm('user', user)} className="text-blue-600 hover:underline font-semibold">
                                    Edit
                                  </button>
                                  {isSuper && !isDeepakRoot && (
                                    <button onClick={() => handleDeleteItem('user', user.id)} className="text-red-500 hover:underline font-semibold">
                                      Delete
                                    </button>
                                  )}
                                  {isDeepakRoot && (
                                    <span className="text-[10px] text-slate-400 italic">Protected</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Active Tab 10: Alert Dispatcher */}
          {activeTab === 'notifications' && (
            <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm space-y-6 animate-in fade-in duration-150">
              <div>
                <h3 className="font-bold text-xs text-slate-900 leading-none">Broadcasting alert Dispatcher</h3>
                <span className="text-[9px] text-slate-400 block mt-1">Dispatches SMS, WhatsApp, and SMTP Email alerts instantly</span>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4 text-xs font-semibold">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Target Channel</label>
                    <select
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white font-bold"
                    >
                      <option value="sms">SMS Network Gateway</option>
                      <option value="whatsapp">WhatsApp Business API</option>
                      <option value="email">SMTP Mail Server</option>
                      <option value="push">In-App Push Alert</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Target User ID</label>
                    <input
                      type="text"
                      placeholder="e.g. user-1 (or 'all')"
                      onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-1">Composed Notification Alert Message</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Enter alert text (e.g. Your passport document review is approved. Booking Speedpost delivery...)"
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" /> Broadcast Alert Signal
                </button>
              </form>
            </div>
          )}

          {/* Active Tab 11: Audit Logs (Super Admin restricted) */}
          {activeTab === 'audit' && isSuper && (
            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-150">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-xs text-slate-900 leading-none">Security System Audit Records</h3>
                  <p className="text-[9px] text-slate-400 mt-1">Track administrator activity, configurations shifts, and secret dispatches</p>
                </div>
                <button
                  onClick={fetchTabData}
                  className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold px-3 py-1.5 rounded-xl text-[10px] flex items-center gap-1 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reload logs
                </button>
              </div>

              {/* Mobile View: Audit Log Cards */}
              <div className="sm:hidden p-3 space-y-2.5">
                {auditLogs.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
                    No system audit logs found.
                  </div>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-800">{log.userName}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-sans border uppercase ${getRoleBadgeStyle(log.userRole)}`}>
                            {log.userRole}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div>
                        <span className="font-mono font-bold text-blue-600 block text-[11px]">{log.action}</span>
                        <p className="text-slate-600 font-sans mt-0.5 leading-relaxed">{log.details}</p>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop View: Table */}
              <div className="hidden sm:block overflow-x-auto text-[11px] font-mono text-slate-600">
                <table className="w-full min-w-[650px] text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[9px]">
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Executor</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Action Signature</th>
                      <th className="p-3">Detailed Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition">
                        <td className="p-3 text-slate-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="p-3 font-bold text-slate-800">{log.userName}</td>
                        <td className="p-3">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-sans border uppercase ${getRoleBadgeStyle(log.userRole)}`}>
                            {log.userRole}
                          </span>
                        </td>
                        <td className="p-3 font-black text-blue-600">{log.action}</td>
                        <td className="p-3 text-slate-700 font-medium leading-relaxed">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Active Tab: About Us Module */}
          {activeTab === 'about_us' && (
            <div className="animate-in fade-in duration-150">
              <AboutUsAdminModule />
            </div>
          )}

          {/* Active Tab: Privacy & Security CMS Module */}
          {activeTab === 'privacy_security' && (
            <div className="animate-in fade-in duration-150">
              <PrivacySecurityAdminModule />
            </div>
          )}

          {/* Active Tab: Calendar Events Manager */}
          {activeTab === 'calendar' && (
            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-150 p-5 font-sans">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 leading-none flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-600" /> Government & Service Deadline Calendar
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Manage important dates, NSP scholarship deadlines, exam forms, and Aadhaar updates shown on the home page.</p>
                </div>
                <button
                  onClick={() => openAddForm('calendar' as any)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Calendar Event
                </button>
              </div>

              <div className="space-y-3">
                {calendarEvents && calendarEvents.length > 0 ? (
                  calendarEvents.map((evt) => (
                    <div key={evt.id} className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="bg-cyan-100 text-cyan-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">{evt.category}</span>
                          <span className="text-xs font-bold text-slate-700">📅 {evt.date}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${evt.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{evt.status}</span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm mt-1">{evt.title}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{evt.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => openEditForm('calendar' as any, evt)} className="text-xs font-bold text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => handleDeleteItem('calendar', evt.id)} className="text-xs font-bold text-red-500 hover:underline">Delete</button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-6 text-center">No calendar events found. Click "Add Calendar Event" to create one.</p>
                )}
              </div>
            </div>
          )}

          {/* Active Tab: Contact Us Module */}
          {activeTab === 'contact_us' && (
            <div className="animate-in fade-in duration-150">
              <ContactUsAdminModule />
            </div>
          )}

          {/* Active Tab: Payment Settings Module */}
          {activeTab === 'payment_settings' && (
            <div className="animate-in fade-in duration-150">
              <PaymentAdminModule />
            </div>
          )}

          {/* Active Tab: Admin Settings Module */}
          {(activeTab === 'admin_settings' || activeTab === 'settings') && (
            <div className="animate-in fade-in duration-150">
              <AdminSettingsModule />
            </div>
          )}

          {/* Active Tab: Social Media Links CMS */}
          {activeTab === 'social_media' && (
            <div className="animate-in fade-in duration-150">
              <SocialMediaAdminModule />
            </div>
          )}

          {/* Active Tab: Employee Record Management Module */}
          {activeTab === 'employee_records' && (
            <div className="animate-in fade-in duration-150">
              <EmployeeManagementModule adminFetch={adminFetch} triggerAlert={triggerAlert} masterData={masterData} />
            </div>
          )}

          {/* Active Tab: Customer Record Management Module */}
          {activeTab === 'customer_records' && (
            <div className="animate-in fade-in duration-150">
              <CustomerManagementModule
                adminFetch={adminFetch}
                triggerAlert={triggerAlert}
                onViewOrder={(order) => setSelectedOrder(order)}
                services={services}
              />
            </div>
          )}

          {/* Active Tab: Master Data Module */}
          {activeTab === 'master_data' && (
            <div className="animate-in fade-in duration-150">
              <MasterDataAdminModule adminFetch={adminFetch} triggerAlert={triggerAlert} />
            </div>
          )}

          {/* Active Tab: Record Integrity & Relationship Validation Module */}
          {activeTab === 'record_integrity' && (
            <div className="animate-in fade-in duration-150">
              <RecordIntegrityAdminModule
                adminUser={adminUser}
                onRefreshData={() => {
                  fetchTabData();
                  onRefreshCatalogs?.();
                }}
              />
            </div>
          )}

          </Suspense>
        </div>

      </div>

      {/* Dynamic CRUD Sliding Form Drawer Overlay */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-w-md w-full space-y-4 text-xs text-left overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b pb-3 mb-1">
              <h4 className="font-bold text-sm text-slate-900 capitalize">
                {editId ? 'Modify' : 'Create New'} {formType} Entry
              </h4>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-3.5 font-semibold">

              {formType === 'service' && (
                <>
                  <div>
                    <label htmlFor="admin-modal-service-title" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Service Title *</label>
                    <input
                      id="admin-modal-service-title"
                      name="serviceTitle"
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g. New PAN Card Application (Form 49A)"
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="admin-modal-service-category" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Category *</label>
                      <select
                        id="admin-modal-service-category"
                        name="categoryId"
                        value={formData.categoryId}
                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-bold text-xs"
                      >
                        {categories
                          .filter(c => editId ? ((c.status || 'Active') === 'Active' || c.id === formData.categoryId) : (c.status || 'Active') === 'Active')
                          .map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.status === 'Inactive' ? '(Inactive)' : ''}
                            </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="admin-modal-service-processing-time" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Estimated Processing Time</label>
                      <input
                        id="admin-modal-service-processing-time"
                        name="processingTime"
                        type="text"
                        value={formData.processingTime}
                        onChange={(e) => setFormData({ ...formData, processingTime: e.target.value })}
                        placeholder="e.g. 3-5 Working Days"
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="admin-modal-service-description" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Description</label>
                    <textarea
                      id="admin-modal-service-description"
                      name="description"
                      rows={3}
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Briefly describe this service, what assistance EasyDesk provides, and what the customer can expect."
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-xs font-normal leading-relaxed placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="admin-modal-service-gov-fees" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Gov Fees (INR)</label>
                      <input
                        id="admin-modal-service-gov-fees"
                        name="govFees"
                        type="number"
                        value={formData.govFees}
                        onChange={(e) => setFormData({ ...formData, govFees: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label htmlFor="admin-modal-service-advisory-charge" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Advisory Charge (INR)</label>
                      <input
                        id="admin-modal-service-advisory-charge"
                        name="serviceCharge"
                        type="number"
                        value={formData.serviceCharge}
                        onChange={(e) => setFormData({ ...formData, serviceCharge: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="admin-modal-service-documents" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Required Documents (Comma Separated)</label>
                    <input
                      id="admin-modal-service-documents"
                      name="requiredDocuments"
                      type="text"
                      value={formData.requiredDocuments}
                      onChange={(e) => setFormData({ ...formData, requiredDocuments: e.target.value })}
                      placeholder="Aadhaar Card, Photograph, Signature Scan"
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-xs"
                    />
                  </div>
                </>
              )}

              {formType === 'category' && (
                <>
                  <div>
                    <label htmlFor="admin-modal-category-name" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Category Name *</label>
                    <input
                      id="admin-modal-category-name"
                      name="categoryName"
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="admin-modal-category-icon" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Lucide Icon Name</label>
                      <input
                        id="admin-modal-category-icon"
                        name="icon"
                        type="text"
                        value={formData.icon}
                        onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="admin-modal-category-color" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Color Theme</label>
                      <input
                        id="admin-modal-category-color"
                        name="color"
                        type="text"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                      />
                    </div>
                  </div>
                </>
              )}

              {formType === 'blog' && (
                <>
                  <div>
                    <label htmlFor="admin-modal-blog-title" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Article Title *</label>
                    <input
                      id="admin-modal-blog-title"
                      name="blogTitle"
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                    />
                  </div>
                  <MediaInput
                    label="Banner Image"
                    value={formData.imageUrl || ''}
                    onChange={(url) => setFormData({ ...formData, imageUrl: url })}
                    placeholder="Select or upload article cover image..."
                    allowedTypes={['image']}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="admin-modal-blog-category" className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Category *</label>
                      {blogCategories && blogCategories.length > 0 ? (
                        <select
                          id="admin-modal-blog-category"
                          name="blogCategory"
                          value={formData.categoryId}
                          onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-bold text-xs"
                          required
                        >
                          {blogCategories
                            .filter(c => editId ? ((c.status || 'Active') === 'Active' || c.id === formData.categoryId || c.name === formData.categoryId) : (c.status || 'Active') === 'Active')
                            .map(c => (
                              <option key={c.id} value={c.id}>
                                {c.name} {c.status === 'Inactive' ? '(Inactive)' : ''}
                              </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id="admin-modal-blog-category"
                          name="blogCategory"
                          type="text"
                          value={formData.categoryId}
                          onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                          placeholder="Category ID..."
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-xs"
                          required
                        />
                      )}
                    </div>
                    <div>
                      <label htmlFor="admin-modal-blog-tags" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Tags (Comma split)</label>
                      <input
                        id="admin-modal-blog-tags"
                        name="tags"
                        type="text"
                        value={formData.tags}
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                        placeholder="e.g. pan, filing, updates"
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="admin-modal-blog-content" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Content Body</label>
                    <textarea
                      id="admin-modal-blog-content"
                      name="content"
                      rows={4}
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                    />
                  </div>
                </>
              )}

              {formType === 'faq' && (
                <>
                  <div>
                    <label htmlFor="admin-modal-faq-question" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">User Question *</label>
                    <input
                      id="admin-modal-faq-question"
                      name="question"
                      type="text"
                      required
                      value={formData.question}
                      onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="admin-modal-faq-answer" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Immediate Answer *</label>
                    <textarea
                      id="admin-modal-faq-answer"
                      name="answer"
                      rows={3}
                      required
                      value={formData.answer}
                      onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                    />
                  </div>
                </>
              )}

              {formType === 'banner' && (
                <>
                  <div>
                    <label htmlFor="admin-modal-banner-title" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Banner Slide Title *</label>
                    <input
                      id="admin-modal-banner-title"
                      name="bannerTitle"
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="admin-modal-banner-image-url" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Image URL Address *</label>
                    <input
                      id="admin-modal-banner-image-url"
                      name="imageUrl"
                      type="text"
                      required
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                    />
                  </div>
                </>
              )}

              {formType === 'page' && (
                <>
                  <div>
                    <label htmlFor="admin-modal-page-title" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Page Document Title *</label>
                    <input
                      id="admin-modal-page-title"
                      name="pageTitle"
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="admin-modal-page-content" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Page Content Markdown Text</label>
                    <textarea
                      id="admin-modal-page-content"
                      name="pageContent"
                      rows={5}
                      required
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                    />
                  </div>
                </>
              )}

              {formType === 'user' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="admin-modal-user-name" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Full Profile Name *</label>
                      <input
                        id="admin-modal-user-name"
                        name="userName"
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="admin-modal-user-mobile" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Contact Mobile</label>
                      <input
                        id="admin-modal-user-mobile"
                        name="userMobile"
                        type="text"
                        value={formData.mobile}
                        onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="admin-modal-user-email" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Login Email *</label>
                    <input
                      id="admin-modal-user-email"
                      name="userEmail"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="admin-modal-user-role" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Account Role</label>
                      <select
                        id="admin-modal-user-role"
                        name="userRole"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        disabled={formData.email?.toLowerCase().trim() === 'tideepak8@gmail.com'}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-bold"
                      >
                        {formData.email?.toLowerCase().trim() === 'tideepak8@gmail.com' ? (
                          <option value="SUPER_ADMIN">Sole Super Admin (Root)</option>
                        ) : (
                          <>
                            <option value="ADMIN">Administrator</option>
                            <option value="OPERATOR">Operator</option>
                            <option value="STAFF">Support Staff</option>
                            <option value="USER">Customer / User</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label htmlFor="admin-modal-status-setting" className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Status Setting</label>
                <select
                  id="admin-modal-status-setting"
                  name="statusSetting"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-bold"
                >
                  <option value="active">Active / Verified</option>
                  <option value="inactive">Draft / Hidden</option>
                  <option value="suspended">Suspended / Paused</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl transition mt-2 cursor-pointer shadow-md"
              >
                Save configurations changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* GLOBAL DELETE CONFIRMATION MODAL */}
      {confirmDeleteModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-100 text-red-600 rounded-full shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Confirm Deletion</h3>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to permanently delete this <strong className="text-slate-900 uppercase">{confirmDeleteModal.type}</strong> item? This action will purge the record from the database.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDeleteModal({ isOpen: false, type: '', id: '' })}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeDeleteItem(confirmDeleteModal.type as any, confirmDeleteModal.id)}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition cursor-pointer"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL ORDER CREATION MODAL */}
      {isCreateOrderModalOpen && (
        <Suspense fallback={null}>
          <CreateManualOrderModal
            isOpen={isCreateOrderModalOpen}
            onClose={() => setIsCreateOrderModalOpen(false)}
            services={services}
            categories={categories}
            adminFetch={adminFetch}
            onSuccess={(newOrder) => {
              triggerAlert(`Order ${newOrder.id} successfully created!`);
              fetchTabData();
              onRefreshCatalogs?.();
              setIsCreateOrderModalOpen(false);
            }}
          />
        </Suspense>
      )}

      {/* EDIT ORDER PARAMETERS MODAL */}
      {isEditOrderModalOpen && orderToEdit && (
        <Suspense fallback={null}>
          <EditOrderModal
            isOpen={isEditOrderModalOpen}
            onClose={() => {
              setIsEditOrderModalOpen(false);
              setOrderToEdit(null);
            }}
            order={orderToEdit}
            services={services}
            categories={categories}
            adminFetch={adminFetch}
            onSuccess={(updatedOrder) => {
              triggerAlert(`Order ${updatedOrder.id} parameters updated!`);
              fetchTabData();
              onRefreshCatalogs?.();
              if (selectedOrder && selectedOrder.id === updatedOrder.id) {
                setSelectedOrder(updatedOrder);
              }
              setIsEditOrderModalOpen(false);
              setOrderToEdit(null);
            }}
          />
        </Suspense>
      )}

    </div>
  );
}
