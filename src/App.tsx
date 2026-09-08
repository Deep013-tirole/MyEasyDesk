import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Helmet } from 'react-helmet-async';
import Header from './components/Header.js';
import HomeView from './components/HomeView.js';
import ServicesView from './components/ServicesView.js';
import Footer from './components/Footer.js';

// Lazy load heavy administrative, secondary, and portal routes for minimal initial bundle size
const ServiceDetailsView = lazy(() => import('./components/ServiceDetailsView.js'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard.js'));
const BlogsView = lazy(() => import('./components/BlogsView.js'));
const TrackingView = lazy(() => import('./components/TrackingView.js'));
const AIChatAssistant = lazy(() => import('./components/AIChatAssistant.js'));
const AuthPortal = lazy(() => import('./components/AuthPortal.js'));
const AboutUsView = lazy(() => import('./components/AboutUsView.js'));
const ContactView = lazy(() => import('./components/ContactView.js'));
const PaymentView = lazy(() => import('./components/PaymentView.js'));
const PrivacySecurityView = lazy(() => import('./components/PrivacySecurityView.js'));
const ReviewSubmissionForm = lazy(() => import('./components/ReviewSubmissionForm.js'));

import { User, Service } from './types.js';
import { useCatalog } from './hooks/useCatalog.js';
import { useScrollToTopOnChange } from './lib/scrollUtils.js';
import { auth, onAuthStateChanged } from './lib/firebaseClient.js';
import { LanguageProvider } from './context/LanguageContext.js';
import { syncContactSettingsFromServer } from './lib/whatsapp.js';
import { WifiOff, RefreshCw } from 'lucide-react';
import MobileBottomNav from './components/MobileBottomNav.js';
import CommandPalette from './components/CommandPalette.js';
import { GridSkeleton } from './components/ui/SkeletonCard.js';

function ViewLoadingFallback() {
  return (
    <div className="portal-container py-12 space-y-4">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <div className="w-4 h-4 border-2 border-[#0F4C81] border-t-transparent rounded-full animate-spin" />
        <span>Loading service modules...</span>
      </div>
      <GridSkeleton count={3} type="service" />
    </div>
  );
}

export interface ParsedRoute {
  view: string;
  serviceId: string | null;
  blogId: string | null;
  adminTab: string;
}

/**
 * Universal canonical route parser for EasyDesk.
 * Safely handles trailing slashes, duplicate slashes, deep links, aliases, and query parameters.
 */
export function parseRouteFromLocation(
  customPath?: string,
  customHash?: string,
  customSearch?: string
): ParsedRoute {
  if (typeof window === 'undefined' && customPath === undefined) {
    return { view: 'home', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  const rawPath = customPath !== undefined ? customPath : window.location.pathname;
  const rawHash = customHash !== undefined ? customHash : window.location.hash;
  const rawSearch = customSearch !== undefined ? customSearch : window.location.search;

  // Normalize path: collapse multiple slashes, strip trailing slash (preserve root '/')
  let pathname = (rawPath || '/').trim().replace(/\/+/g, '/');
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  const hash = (rawHash || '').trim();
  const searchParams = new URLSearchParams(rawSearch || '');

  // 1. Service Details matching:
  // Canonical path: /services/:serviceId (supports id and slug)
  const servicePathMatch = pathname.match(/^\/services\/([a-zA-Z0-9_.-]+)/);
  if (servicePathMatch && servicePathMatch[1]) {
    return { view: 'service-details', serviceId: servicePathMatch[1], blogId: null, adminTab: 'analytics' };
  }

  // Hash-based service detail matching: #services/:id or #service/:id
  const serviceHashMatch = hash.match(/^#(?:services|service)\/([a-zA-Z0-9_.-]+)/);
  if (serviceHashMatch && serviceHashMatch[1]) {
    return { view: 'service-details', serviceId: serviceHashMatch[1], blogId: null, adminTab: 'analytics' };
  }

  // Query parameter-based service detail matching (?service= or ?serviceId= or ?id=)
  const queryService = searchParams.get('service') || searchParams.get('serviceId') || searchParams.get('id');
  if (queryService && (pathname === '/services' || pathname === '/service-details' || hash.startsWith('#service'))) {
    return { view: 'service-details', serviceId: queryService, blogId: null, adminTab: 'analytics' };
  }

  // 2. Blog Details matching:
  // Canonical path: /blogs/:slug or /blogs/:id
  const blogPathMatch = pathname.match(/^\/blogs\/([a-zA-Z0-9_.-]+)/);
  if (blogPathMatch && blogPathMatch[1]) {
    return { view: 'blogs', serviceId: null, blogId: blogPathMatch[1], adminTab: 'analytics' };
  }

  // Hash-based blog detail matching: #blogs/:id or #blog/:id
  const blogHashMatch = hash.match(/^#(?:blogs|blog)\/([a-zA-Z0-9_.-]+)/);
  if (blogHashMatch && blogHashMatch[1]) {
    return { view: 'blogs', serviceId: null, blogId: blogHashMatch[1], adminTab: 'analytics' };
  }

  // Query parameter-based blog detail matching (?blog= or ?blogId=)
  const queryBlog = searchParams.get('blog') || searchParams.get('blogId');
  if (queryBlog && (pathname === '/blogs' || hash.startsWith('#blog'))) {
    return { view: 'blogs', serviceId: null, blogId: queryBlog, adminTab: 'analytics' };
  }

  // 3. Exact Core Route and Alias matching (trailing slash immune):
  if (pathname === '/services' || hash === '#services') {
    return { view: 'services', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  if (pathname === '/blogs' || hash === '#blogs') {
    return { view: 'blogs', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  if (pathname === '/about' || pathname === '/terms' || hash === '#about' || hash === '#terms') {
    return { view: 'about', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  if (pathname === '/contact' || hash === '#contact') {
    return { view: 'contact', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  if (pathname === '/payment' || hash === '#payment') {
    return { view: 'payment', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  if (
    pathname === '/privacy-security' ||
    pathname === '/privacy-policy' ||
    pathname === '/privacy' ||
    hash === '#privacy-security' ||
    hash === '#privacy'
  ) {
    return { view: 'privacy-security', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  if (
    pathname === '/track' ||
    pathname === '/track-order' ||
    hash === '#track' ||
    hash === '#track-order'
  ) {
    return { view: 'track', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  if (
    pathname === '/submit-review' ||
    pathname === '/review' ||
    hash === '#submit-review' ||
    hash === '#review'
  ) {
    return { view: 'submit-review', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  if (pathname === '/admin-login' || hash === '#admin-login') {
    return { view: 'admin-login', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  // 4. Admin routes with subpath support (/admin, /admin/orders, /admin/services, etc.)
  if (pathname === '/admin' || pathname.startsWith('/admin/') || hash === '#admin' || hash.startsWith('#admin/')) {
    let subTab = '';
    if (pathname.startsWith('/admin/')) {
      subTab = pathname.replace(/^\/admin\//, '').split('/')[0];
    } else if (hash.startsWith('#admin/')) {
      subTab = hash.replace(/^#admin\//, '').split('/')[0];
    }
    const queryTab = searchParams.get('tab');
    const resolvedTab = subTab || queryTab || 'analytics';
    return { view: 'admin', serviceId: null, blogId: null, adminTab: resolvedTab };
  }

  // Root view
  if (pathname === '' || pathname === '/') {
    return { view: 'home', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  // Fallback for genuinely unknown URLs
  return { view: 'home', serviceId: null, blogId: null, adminTab: 'analytics' };
}

export default function App() {

  // Synchronous route initialization directly from current URL
  const initialRoute = parseRouteFromLocation();
  const [view, setView] = useState<string>(() => initialRoute.view);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(() => initialRoute.serviceId);
  const [selectedBlogId, setSelectedBlogId] = useState<string | null>(() => initialRoute.blogId);
  const [adminTab, setAdminTab] = useState<string>(() => initialRoute.adminTab || 'analytics');
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Global scroll-to-top on route / main view transition
  useScrollToTopOnChange([view, selectedServiceId, selectedBlogId, adminTab]);

  // Admin user state
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedAdmin = localStorage.getItem('easydesk_admin_user');
      return savedAdmin ? JSON.parse(savedAdmin) : null;
    } catch {
      return null;
    }
  });

  // Universal Command Palette state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsCommandPaletteOpen(true);
    window.addEventListener('easydesk-open-command-palette', handleOpen);
    window.addEventListener('easydesk:open-command-palette', handleOpen);
    return () => {
      window.removeEventListener('easydesk-open-command-palette', handleOpen);
      window.removeEventListener('easydesk:open-command-palette', handleOpen);
    };
  }, []);

  // App Catalog database with automatic localStorage cache fallback
  const {
    categories,
    blogCategories,
    services,
    blogs,
    updateBlogs,
    reviews,
    setReviews,
    loading,
    refetchAll: fetchPlatformCatalogs
  } = useCatalog();

  // Network connectivity status listener & auto-resync
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      fetchPlatformCatalogs();
      syncContactSettingsFromServer(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchPlatformCatalogs]);

  // Custom navigation wrapper with history sync
  const handleSetView = useCallback((nextView: string) => {
    setView(nextView);
    if (nextView !== 'service-details') {
      setSelectedServiceId(null);
    }
    if (nextView !== 'blogs') {
      setSelectedBlogId(null);
    }

    let targetPath = nextView === 'home' ? '/' : `/${nextView}`;
    if (nextView === 'admin') {
      targetPath = adminTab && adminTab !== 'analytics' ? `/admin/${adminTab}` : '/admin';
    } else if (nextView === 'service-details' && selectedServiceId) {
      targetPath = `/services/${selectedServiceId}`;
    } else if (nextView === 'service-details') {
      targetPath = '/services';
    }

    if (window.location.pathname !== targetPath) {
      window.history.pushState({ view: nextView, serviceId: selectedServiceId, blogId: null, adminTab }, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [adminTab, selectedServiceId]);

  // Atomic service selection with history sync to /services/:serviceId
  const handleSelectService = useCallback((sId: string | null) => {
    setSelectedServiceId(sId);
    if (sId) {
      setView('service-details');
      const targetPath = `/services/${sId}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ view: 'service-details', serviceId: sId, blogId: null, adminTab }, '', targetPath);
      }
    } else {
      setView('services');
      if (window.location.pathname !== '/services') {
        window.history.pushState({ view: 'services', serviceId: null, blogId: null, adminTab }, '', '/services');
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [adminTab]);

  // Atomic blog selection with history sync to /blogs/:slugOrId
  const handleSelectBlog = useCallback((bId: string | null) => {
    setSelectedBlogId(bId);
    setView('blogs');
    if (bId) {
      const targetPath = `/blogs/${bId}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ view: 'blogs', serviceId: null, blogId: bId, adminTab }, '', targetPath);
      }
    } else {
      if (window.location.pathname !== '/blogs') {
        window.history.pushState({ view: 'blogs', serviceId: null, blogId: null, adminTab }, '', '/blogs');
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [adminTab]);

  const handleCloseBlog = useCallback(() => {
    setSelectedBlogId(null);
    if (window.location.pathname !== '/blogs') {
      window.history.pushState({ view: 'blogs', serviceId: null, blogId: null, adminTab }, '', '/blogs');
    }
  }, [adminTab]);

  // Atomic admin tab change with URL reflection (/admin/:tab)
  const handleAdminTabChange = useCallback((tab: string) => {
    setAdminTab(tab);
    const targetPath = tab === 'analytics' ? '/admin' : `/admin/${tab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ view: 'admin', serviceId: null, blogId: null, adminTab: tab }, '', targetPath);
    }
  }, []);

  // PopState listener for full browser Back/Forward synchronization
  useEffect(() => {
    const handlePopState = () => {
      const r = parseRouteFromLocation();
      setView(r.view);
      setSelectedServiceId(r.serviceId);
      setSelectedBlogId(r.blogId);
      if (r.adminTab) {
        setAdminTab(r.adminTab);
      }
      window.scrollTo({ top: 0, behavior: 'instant' });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    // Purge obsolete customer keys from localStorage if present
    localStorage.removeItem('easydesk_user');
    localStorage.removeItem('easydesk_token');

    // Restore saved admin user session
    const savedAdminToken = localStorage.getItem('easydesk_admin_token');
    const savedAdminUser = localStorage.getItem('easydesk_admin_user');

    if (savedAdminUser) {
      try {
        const parsedAdmin = JSON.parse(savedAdminUser);
        const isAdminRole = ['ADMIN', 'SUPER_ADMIN', 'STAFF', 'OPERATOR'].includes(parsedAdmin?.role);
        if (parsedAdmin && isAdminRole) {
          setCurrentUser(parsedAdmin);
        }
      } catch (e) {
        localStorage.removeItem('easydesk_admin_user');
      }
    }

    // Verify token with backend if present
    if (savedAdminToken) {
      fetch('/api/auth/admin/me', {
        headers: { 'Authorization': `Bearer ${savedAdminToken}` }
      })
      .then(async res => {
        if (res.ok) {
          const data = await res.json();
          if (data && data.user) {
            setCurrentUser(data.user);
            localStorage.setItem('easydesk_admin_user', JSON.stringify(data.user));
            return;
          }
        }
        // Try refresh token if access token expired
        const refreshToken = localStorage.getItem('easydesk_admin_refresh') || localStorage.getItem('easydesk_admin_refresh_token');
        if (refreshToken) {
          try {
            const refRes = await fetch('/api/auth/admin/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
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
                  if (meData && meData.user) {
                    setCurrentUser(meData.user);
                    localStorage.setItem('easydesk_admin_user', JSON.stringify(meData.user));
                    return;
                  }
                }
              }
            }
          } catch (e) {
            // refresh error
          }
        }
        // Clean up invalid session
        localStorage.removeItem('easydesk_admin_token');
        localStorage.removeItem('easydesk_admin_user');
        localStorage.removeItem('easydesk_admin_refresh');
        localStorage.removeItem('easydesk_admin_refresh_token');
        setCurrentUser(null);
      })
      .catch(err => console.error('[Admin Session Verification Error]', err));
    }

    // Attach Firebase Auth SDK state listener for Admin session
    const unsubscribe = onAuthStateChanged(
      auth,
      async (fbUser) => {
        if (fbUser) {
          try {
            const idToken = await fbUser.getIdToken();
            const res = await fetch('/api/auth/firebase-verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken, expectedRole: 'ADMIN' })
            });
            if (res.ok) {
              const data = await res.json();
              if (data.user && (data.user.role === 'ADMIN' || data.user.role === 'SUPER_ADMIN')) {
                setCurrentUser(data.user);
                localStorage.setItem('easydesk_admin_token', data.accessToken);
                localStorage.setItem('easydesk_admin_user', JSON.stringify(data.user));
              }
            }
          } catch (err) {
            console.error('[Firebase Auth Verify Listener Error]', err);
          }
        } else {
          const savedAdm = localStorage.getItem('easydesk_admin_user');
          if (!savedAdm) {
            setCurrentUser(null);
          }
        }
      },
      (error) => {
        const errorMsg = (error as any)?.message || String(error || '');
        if (errorMsg.includes('Database is closing/hidden')) {
          // Benign IndexedDB lifecycle event during tab background/closing
          return;
        }
        console.warn('[Firebase Auth State Observer Error]', error);
      }
    );

    fetchPlatformCatalogs();
    syncContactSettingsFromServer(true);

    return () => unsubscribe();
  }, []);

  // Dynamic SEO & Document Metadata resolution
  const activeService = selectedServiceId ? services.find(s => s.id === selectedServiceId) : null;

  const seoConfig = React.useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://easydesk.portal';

    if (view === 'service-details' && activeService) {
      const catName = categories.find(c => c.id === activeService.categoryId)?.name || 'Government & Citizen Services';
      const title = activeService.seoTitle || `${activeService.title} - Apply Online & Track Status | EasyDesk`;
      const desc = activeService.seoDescription || activeService.shortDescription || activeService.description || `Apply online for ${activeService.title} with verified desk assistance, full document verification, transparent government fees, and real-time status updates on WhatsApp.`;
      const url = `${origin}/services/${activeService.id}`;
      return {
        title,
        description: desc,
        keywords: `${activeService.title}, ${catName}, apply online, online application, government fees, document checklist, track status, EasyDesk`,
        url,
        type: 'article',
        robots: 'index, follow'
      };
    }

    if (view === 'blogs' && selectedBlogId) {
      const activeBlog = blogs.find(b => (b.slug && b.slug.toLowerCase() === selectedBlogId.toLowerCase()) || b.id === selectedBlogId);
      if (activeBlog) {
        return {
          title: activeBlog.seoTitle || `${activeBlog.title} | EasyDesk Knowledge Hub`,
          description: activeBlog.seoDescription || activeBlog.shortDescription || activeBlog.excerpt || activeBlog.title,
          keywords: activeBlog.tags?.join(', ') || 'easydesk blogs, government documentation guide',
          url: `${origin}/blogs/${activeBlog.slug || activeBlog.id}`,
          type: 'article',
          robots: 'index, follow'
        };
      }
    }

    switch (view) {
      case 'services':
        return {
          title: 'All Digital & Government Services Catalog | EasyDesk',
          description: 'Browse all official government, educational, utility, and citizen documentation services. Verified submissions with zero rejection guarantee.',
          keywords: 'government services list, pan card, certificates, online voter card, utility bills, business registration, digital seva',
          url: `${origin}/services`,
          type: 'website',
          robots: 'index, follow'
        };
      case 'blogs':
        return {
          title: 'Knowledge Hub, Guides & Government Updates | EasyDesk Blog',
          description: 'Explore step-by-step documentation guides, eligibility requirements, government notification circulars, and digital assistance tips.',
          keywords: 'easydesk blogs, government portal guides, pan card rules, voter id online application, documentation assistance',
          url: `${origin}/blogs`,
          type: 'blog',
          robots: 'index, follow'
        };
      case 'track':
        return {
          title: 'Track Application Status in Real-Time | EasyDesk',
          description: 'Check the real-time processing status of your government and digital service applications using your Application ID or Phone Number.',
          keywords: 'track application, application status check, pan card status, track government file, easydesk tracker',
          url: `${origin}/track`,
          type: 'website',
          robots: 'index, follow'
        };
      case 'about':
        return {
          title: 'About Us - Trusted Citizen Service Portal | EasyDesk',
          description: 'EasyDesk simplifies government and digital citizen services across India with transparent processing, dedicated desk coordinators, and AI document checking.',
          keywords: 'about easydesk, digital seva portal, citizen assistance platform, certified digital desk',
          url: `${origin}/about`,
          type: 'website',
          robots: 'index, follow'
        };
      case 'contact':
        return {
          title: 'Contact Support & Help Desk Officers | EasyDesk',
          description: 'Need help with your application? Get in touch with our desk support officers via WhatsApp, phone, email, or instant online ticketing.',
          keywords: 'contact easydesk, customer support, digital seva helpdesk, whatsapp assistance',
          url: `${origin}/contact`,
          type: 'website',
          robots: 'index, follow'
        };
      case 'privacy-security':
        return {
          title: 'Privacy Policy & Data Protection Guarantee | EasyDesk',
          description: 'Learn how EasyDesk safeguards citizen records with 256-bit AES encryption, strictly zero third-party data selling, and secure document vaults.',
          keywords: 'privacy policy, data security, document safety, citizen data protection',
          url: `${origin}/privacy-security`,
          type: 'website',
          robots: 'index, follow'
        };
      case 'payment':
        return {
          title: 'Secure Payment Portal | EasyDesk',
          description: 'Make secure, instant payments for your digital service filings via UPI, Net Banking, and Debit/Credit cards with official tax invoices.',
          keywords: 'easydesk payment, secure upi payment, government fees payment',
          url: `${origin}/payment`,
          type: 'website',
          robots: 'noindex, follow'
        };
      case 'submit-review':
      case 'review':
        return {
          title: 'Submit Customer Feedback & Review | EasyDesk',
          description: 'Share your service experience and rating to help us continually enhance EasyDesk citizen support.',
          keywords: 'easydesk reviews, rate service, customer feedback',
          url: `${origin}/submit-review`,
          type: 'website',
          robots: 'index, follow'
        };
      case 'admin':
      case 'admin-login':
        return {
          title: 'Officer & Administrative Portal | EasyDesk',
          description: 'EasyDesk secure administration desk for authorized operators and service coordinators.',
          keywords: 'easydesk admin, officer login',
          url: `${origin}/admin`,
          type: 'website',
          robots: 'noindex, nofollow'
        };
      case 'home':
      default:
        return {
          title: 'EasyDesk | Premium Digital Services Portal',
          description: 'Apply online for Government, Educational, Utility, and Business documents with verified assistance, real-time WhatsApp updates, and zero processing rejections.',
          keywords: 'easydesk, digital seva, government services, pan card, certificates, online application, digital service portal',
          url: origin,
          type: 'website',
          robots: 'index, follow'
        };
    }
  }, [view, activeService, selectedBlogId, blogs]);

  return (
    <LanguageProvider>
      <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50/50 flex flex-col font-sans select-none antialiased">

        {/* Dynamic SEO Meta Tags via React Helmet */}
        <Helmet>
          <title>{seoConfig.title}</title>
          <meta name="description" content={seoConfig.description} />
          <meta name="keywords" content={seoConfig.keywords} />
          <meta name="robots" content={seoConfig.robots} />

          {/* Open Graph / Facebook */}
          <meta property="og:type" content={seoConfig.type} />
          <meta property="og:url" content={seoConfig.url} />
          <meta property="og:title" content={seoConfig.title} />
          <meta property="og:description" content={seoConfig.description} />
          <meta property="og:site_name" content="EasyDesk" />

          {/* Twitter Meta */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:url" content={seoConfig.url} />
          <meta name="twitter:title" content={seoConfig.title} />
          <meta name="twitter:description" content={seoConfig.description} />

          {/* Canonical Link */}
          <link rel="canonical" href={seoConfig.url} />
        </Helmet>

        {!isOnline && (
          <div className="bg-amber-600 text-white text-[11px] font-semibold py-1.5 px-4 flex items-center justify-center gap-2 shadow-xs z-50 animate-in fade-in w-full">
            <WifiOff className="w-3.5 h-3.5" />
            <span>You are currently offline. Displaying cached data. Reconnecting automatically when internet is available...</span>
          </div>
        )}

        {/* Universal header with navigation */}
        <Header
          currentView={view}
          setView={handleSetView}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          allUsers={[]}
          onOpenSearch={() => setIsCommandPaletteOpen(true)}
        />

        <main className="flex-1 w-full max-w-full min-w-0 pb-20 md:pb-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-xs text-slate-400 font-sans">
              <div className="w-8 h-8 border-4 border-[#0F4C81] border-t-transparent rounded-full animate-spin" />
              <span>Establishing EasyDesk Digital Services...</span>
            </div>
          ) : (
            <Suspense fallback={<ViewLoadingFallback />}>
              {view === 'home' && (
                <HomeView
                  services={services}
                  blogs={blogs}
                  blogCategories={blogCategories}
                  reviews={reviews}
                  setView={handleSetView}
                  setSelectedServiceId={handleSelectService}
                />
              )}

              {view === 'services' && (
                <ServicesView
                  categories={categories}
                  services={services}
                  setView={handleSetView}
                  setSelectedServiceId={handleSelectService}
                  selectedServiceId={selectedServiceId}
                />
              )}

              {view === 'service-details' && selectedServiceId && (
                <ServiceDetailsView
                  serviceId={selectedServiceId}
                  services={services}
                  categories={categories}
                  reviews={reviews}
                  setView={handleSetView}
                  setSelectedServiceId={handleSelectService}
                  onRefreshCatalogs={fetchPlatformCatalogs}
                  isLoadingCatalogs={loading}
                />
              )}

              {view === 'track' && (
                <TrackingView />
              )}

              {view === 'admin-login' && (
                <div className="notranslate" translate="no">
                  <AuthPortal
                    setView={handleSetView}
                    setCurrentUser={setCurrentUser}
                  />
                </div>
              )}

              {view === 'admin' && (
                <div className="notranslate" translate="no">
                  {currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'STAFF' || currentUser?.role === 'OPERATOR' ? (
                    <AdminDashboard
                      onRefreshCatalogs={fetchPlatformCatalogs}
                      initialTab={adminTab}
                      onTabChange={handleAdminTabChange}
                    />
                  ) : (
                    <AuthPortal
                      setView={handleSetView}
                      setCurrentUser={setCurrentUser}
                    />
                  )}
                </div>
              )}

              {/* About Us View */}
              {view === 'about' && (
                <AboutUsView setView={handleSetView} />
              )}

              {/* Contact Us View */}
              {view === 'contact' && (
                <ContactView />
              )}

              {/* Privacy & Security View */}
              {view === 'privacy-security' && (
                <PrivacySecurityView setView={handleSetView} />
              )}

              {/* Payment Portal View */}
              {view === 'payment' && (
                <PaymentView currentUser={currentUser} setView={handleSetView} />
              )}

              {/* SEO Blogs list and detail view */}
              {view === 'blogs' && (
                <BlogsView
                  blogs={blogs}
                  blogCategories={blogCategories}
                  updateBlogs={updateBlogs}
                  selectedBlogId={selectedBlogId}
                  onSelectBlogId={handleSelectBlog}
                  onCloseBlog={handleCloseBlog}
                />
              )}

              {/* Standalone Customer Review Submission Form */}
              {(view === 'submit-review' || view === 'review') && (
                <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                  <ReviewSubmissionForm
                    onSuccess={() => {
                      fetchPlatformCatalogs();
                    }}
                    onCancel={() => handleSetView('home')}
                  />
                </div>
              )}
            </Suspense>
          )}
        </main>

        {/* Universal Footer */}
        <Footer setView={handleSetView} />

        {/* Persistent AI Doc Auditor & Floating Chat Assistant widget on all screens */}
        <Suspense fallback={null}>
          <AIChatAssistant activeService={services.find(s => s.id === selectedServiceId) || null} />
        </Suspense>

        {/* Mobile Sticky Bottom Navigation (Screens < 768px) */}
        <MobileBottomNav
          currentView={view}
          setView={handleSetView}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        />

        {/* Universal Quick Search Command Palette (Ctrl+K / Cmd+K) */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          services={services}
          blogs={blogs}
          onSelectService={handleSelectService}
          onSelectBlog={handleSelectBlog}
          setView={handleSetView}
        />

      </div>
    </LanguageProvider>
  );
}
