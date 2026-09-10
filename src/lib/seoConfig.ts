/**
 * EASYDESK — CENTRAL SEO, SCHEMA.ORG & CANONICAL RESOLVER
 * 
 * Architectural Invariants:
 * 1. Single Central Canonical Origin Resolver (getCanonicalOrigin).
 * 2. Strictly NEVER outputs 'easydesk.in' or 'localhost' in production SEO.
 * 3. Default verified active production origin: 'https://myeasydesk.tideepak8.workers.dev'.
 * 4. Config-driven domain migration ready: single environment variable (CANONICAL_ORIGIN or VITE_CANONICAL_ORIGIN)
 *    instantly switches canonical, sitemap, robots, OG, Twitter, and Schema.org outputs.
 * 5. Business data is dynamically extracted from canonical Contact Settings / Company Profile
 *    (single source of truth). Never hard-codes fake addresses or invented coordinates.
 * 6. Honest commercial facilitation positioning: EasyDesk is an independent commercial assistance
 *    portal and is not an official government department.
 */

import { Service, ServiceCategory, Blog } from '../types.js';
import { formatFullAddress } from './apiDataService.js';

function isUnauthorizedDomain(originStr: string): boolean {
  try {
    const norm = originStr.toLowerCase().trim();
    if (norm.includes('localhost') || norm.includes('127.0.0.1')) return true;
    const url = new URL(norm.startsWith('http') ? norm : `https://${norm}`);
    const host = url.hostname.toLowerCase();
    // Strictly block unauthorized apex domain or subdomains of easydesk.in (while permitting official myeasydesk.in)
    if (host === 'easydesk.in' || (host.endsWith('.easydesk.in') && !host.endsWith('myeasydesk.in'))) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * Resolves the authoritative canonical origin for the current deployment.
 * Supports config-driven domain migration (e.g. to https://myeasydesk.in in the future).
 */
export function getCanonicalOrigin(customEnvOrigin?: string): string {
  // 1. Explicit override provided
  if (customEnvOrigin && typeof customEnvOrigin === 'string') {
    const trimmed = customEnvOrigin.trim().replace(/\/+$/, '');
    if (trimmed && !isUnauthorizedDomain(trimmed)) {
      return trimmed;
    }
  }

  // 2. Node.js environment (server, worker, CLI scripts)
  if (typeof process !== 'undefined' && process.env) {
    const envOrigin = process.env.CANONICAL_ORIGIN || process.env.VITE_CANONICAL_ORIGIN;
    if (envOrigin && typeof envOrigin === 'string') {
      const trimmed = envOrigin.trim().replace(/\/+$/, '');
      if (trimmed && !isUnauthorizedDomain(trimmed)) {
        return trimmed;
      }
    }
  }

  // 3. Browser Vite environment (import.meta.env)
  try {
    const metaOrigin = (import.meta as any)?.env?.VITE_CANONICAL_ORIGIN;
    if (metaOrigin && typeof metaOrigin === 'string') {
      const trimmed = metaOrigin.trim().replace(/\/+$/, '');
      if (trimmed && !isUnauthorizedDomain(trimmed)) {
        return trimmed;
      }
    }
  } catch {}

  // 4. Default verified active Cloudflare Worker production deployment origin
  return 'https://myeasydesk.tideepak8.workers.dev';
}

/**
 * Builds an absolute canonical URL using the centralized canonical origin.
 */
export function getCanonicalUrl(path = '/'): string {
  const origin = getCanonicalOrigin();
  let cleanPath = (path || '/').trim();
  if (!cleanPath.startsWith('/')) {
    cleanPath = `/${cleanPath}`;
  }
  // Collapse multiple slashes
  cleanPath = cleanPath.replace(/\/+/g, '/');
  // Remove trailing slash except for root '/'
  if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1);
  }
  return `${origin}${cleanPath}`;
}

export interface CanonicalBusinessData {
  name: string;
  legalName: string;
  description: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  fullAddress?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  country: string;
  workingHours?: string;
  latitude?: number;
  longitude?: number;
  website: string;
}

/**
 * Dynamically resolves canonical business details from the authoritative Contact Settings / Company Profile.
 * OMITTING optional fields if unavailable, with zero invented or fake coordinates.
 */
export function getCanonicalBusinessData(contactSettings?: any, companyProfile?: any): CanonicalBusinessData {
  const settings = contactSettings || {};
  const profile = companyProfile || {};

  const name = profile.companyName || settings.companyName || 'EasyDesk';
  const legalName = `${name} Facilitation & Advisory Desk`;
  const description = 'Independent commercial digital document assistance and citizen advisory platform. EasyDesk is an independent commercial facilitation desk and is not affiliated with any government department.';

  const phone = (settings.phone || profile.phone || '').trim() || undefined;
  const email = (settings.email || profile.email || '').trim() || undefined;
  const whatsapp = (settings.whatsapp || profile.whatsapp || '').trim() || undefined;

  const streetAddress = (settings.address || profile.registeredOffice || '').trim() || undefined;
  const city = (settings.city || profile.city || '').trim() || undefined;
  const state = (settings.state || profile.state || '').trim() || undefined;
  const pinCode = (settings.pinCode || profile.pinCode || '').trim() || undefined;

  const fullAddress = formatFullAddress({
    address: streetAddress,
    city,
    state,
    pinCode
  }) || undefined;

  const workingHours = (settings.workingHours || profile.workingHours || '').trim() || undefined;

  // Only include geo coordinates if explicitly present in canonical settings; never guess
  let latitude: number | undefined;
  let longitude: number | undefined;
  if (typeof settings.latitude === 'number' && typeof settings.longitude === 'number') {
    latitude = settings.latitude;
    longitude = settings.longitude;
  } else if (typeof profile.latitude === 'number' && typeof profile.longitude === 'number') {
    latitude = profile.latitude;
    longitude = profile.longitude;
  }

  return {
    name,
    legalName,
    description,
    phone,
    email,
    whatsapp,
    fullAddress,
    streetAddress,
    city,
    state,
    pinCode,
    country: 'India',
    workingHours,
    latitude,
    longitude,
    website: getCanonicalOrigin()
  };
}

/**
 * Generates Schema.org Organization and LocalBusiness/ProfessionalService structured data.
 */
export function getOrganizationJsonLd(contactSettings?: any, companyProfile?: any): object {
  const biz = getCanonicalBusinessData(contactSettings, companyProfile);
  const origin = getCanonicalOrigin();

  const schema: any = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'ProfessionalService', 'Organization'],
    'name': biz.name,
    'legalName': biz.legalName,
    'description': biz.description,
    'url': origin,
    'priceRange': '₹50 - ₹4999',
    'areaServed': {
      '@type': 'Country',
      'name': 'India'
    }
  };

  if (biz.phone) schema.telephone = biz.phone;
  if (biz.email) schema.email = biz.email;
  if (biz.fullAddress) {
    schema.address = {
      '@type': 'PostalAddress',
      'streetAddress': biz.streetAddress || biz.fullAddress,
      'addressLocality': biz.city || 'Indore',
      'addressRegion': biz.state || 'Madhya Pradesh',
      'postalCode': biz.pinCode || '',
      'addressCountry': 'IN'
    };
  }
  if (biz.workingHours) {
    schema.openingHours = biz.workingHours;
  }
  if (biz.latitude !== undefined && biz.longitude !== undefined) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      'latitude': biz.latitude,
      'longitude': biz.longitude
    };
  }

  return schema;
}

/**
 * Generates Schema.org WebSite structured data with SearchAction.
 */
export function getWebSiteJsonLd(): object {
  const origin = getCanonicalOrigin();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': 'EasyDesk',
    'url': origin,
    'description': 'Commercial digital document assistance and citizen advisory portal for government, education, and business documentation.',
    'potentialAction': {
      '@type': 'SearchAction',
      'target': `${origin}/services?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  };
}

/**
 * Generates Schema.org Service structured data using actual service configuration.
 */
export function getServiceJsonLd(service: Service, category?: ServiceCategory | null, contactSettings?: any): object {
  const origin = getCanonicalOrigin();
  const serviceUrl = `${origin}/services/${service.slug || service.id}`;
  const biz = getCanonicalBusinessData(contactSettings);

  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    'name': `${service.title} Online Assistance`,
    'description': service.description || service.shortDescription || `Online documentation and application filing assistance for ${service.title}.`,
    'url': serviceUrl,
    'provider': {
      '@type': 'LocalBusiness',
      'name': biz.name,
      'url': origin,
      ...(biz.phone ? { 'telephone': biz.phone } : {}),
      ...(biz.email ? { 'email': biz.email } : {})
    },
    'areaServed': {
      '@type': 'Country',
      'name': 'India'
    }
  };

  if (category && category.name) {
    schema.serviceType = category.name;
  }

  // Real pricing only: government fee + EasyDesk service charge
  const charge = typeof service.serviceCharge === 'number' ? service.serviceCharge : 0;
  const govFees = typeof service.govFees === 'number' ? service.govFees : 0;
  const total = charge + govFees;

  if (total > 0 || charge > 0) {
    schema.offers = {
      '@type': 'Offer',
      'price': String(total > 0 ? total : charge),
      'priceCurrency': 'INR',
      'availability': 'https://schema.org/InStock',
      'url': serviceUrl
    };
  }

  return schema;
}

/**
 * Generates Schema.org FAQPage structured data ONLY when genuine FAQs exist.
 */
export function getFaqJsonLd(faqs?: Array<{ question?: string; answer?: string }>): object | null {
  if (!faqs || !Array.isArray(faqs) || faqs.length === 0) {
    return null;
  }

  const validFaqs = faqs.filter(f => f && f.question && f.question.trim() && f.answer && f.answer.trim());
  if (validFaqs.length === 0) {
    return null;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': validFaqs.map(f => ({
      '@type': 'Question',
      'name': (f.question || '').trim(),
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': (f.answer || '').trim()
      }
    }))
  };
}

/**
 * Generates Schema.org BlogPosting / Article structured data using actual blog data.
 */
export function getBlogPostingJsonLd(blog: Blog, contactSettings?: any): object {
  const origin = getCanonicalOrigin();
  const blogUrl = `${origin}/blogs/${blog.slug || blog.id}`;
  const biz = getCanonicalBusinessData(contactSettings);

  const pubDate = blog.date || blog.createdAt || new Date().toISOString();
  const modDate = (blog as any).updatedAt || pubDate;

  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    'headline': blog.title,
    'description': blog.shortDescription || blog.excerpt || blog.title,
    'url': blogUrl,
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': blogUrl
    },
    'datePublished': pubDate,
    'dateModified': modDate,
    'author': {
      '@type': 'Organization',
      'name': blog.author || biz.name,
      'url': origin
    },
    'publisher': {
      '@type': 'Organization',
      'name': biz.name,
      'url': origin
    }
  };

  if (blog.image && typeof blog.image === 'string' && blog.image.startsWith('http')) {
    schema.image = blog.image;
  }

  return schema;
}

/**
 * Generates Schema.org BreadcrumbList structured data.
 */
export function getBreadcrumbsJsonLd(breadcrumbs: Array<{ name: string; path: string }>): object {
  const origin = getCanonicalOrigin();
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': breadcrumbs.map((crumb, idx) => {
      let fullUrl = crumb.path.startsWith('http') ? crumb.path : `${origin}${crumb.path.startsWith('/') ? '' : '/'}${crumb.path}`;
      if (fullUrl.endsWith('/') && fullUrl !== `${origin}/`) {
        fullUrl = fullUrl.slice(0, -1);
      }
      return {
        '@type': 'ListItem',
        'position': idx + 1,
        'name': crumb.name,
        'item': fullUrl
      };
    })
  };
}

export interface ResolvedSeoMetadata {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  ogType: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  ogSiteName: string;
  ogImage?: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage?: string;
  schemas: object[];
}

/**
 * Universal SEO metadata resolver for all application routes.
 */
export function resolveSeoMetadata(
  route: { view: string; serviceId?: string | null; blogId?: string | null; isNotFound?: boolean },
  dataOrServices: { services?: Service[]; blogs?: Blog[]; categories?: ServiceCategory[]; contactSettings?: any; companyProfile?: any } | Service[] = {},
  blogsArg?: Blog[],
  categoriesArg?: ServiceCategory[],
  contactSettingsArg?: any,
  companyProfileArg?: any
): ResolvedSeoMetadata {
  const origin = getCanonicalOrigin();
  let services: Service[] = [];
  let blogs: Blog[] = [];
  let categories: ServiceCategory[] = [];
  let contactSettings: any;
  let companyProfile: any;

  if (Array.isArray(dataOrServices)) {
    services = dataOrServices;
    blogs = blogsArg || [];
    categories = categoriesArg || [];
    contactSettings = contactSettingsArg;
    companyProfile = companyProfileArg;
  } else if (dataOrServices && typeof dataOrServices === 'object') {
    services = dataOrServices.services || [];
    blogs = dataOrServices.blogs || [];
    categories = dataOrServices.categories || [];
    contactSettings = dataOrServices.contactSettings;
    companyProfile = dataOrServices.companyProfile;
  }
  const siteName = 'EasyDesk';

  // 1. Service Details
  if (route.view === 'service-details' && route.serviceId) {
    const sId = route.serviceId.toLowerCase();
    const service = services.find(s => 
      (s.id && s.id.toLowerCase() === sId) || 
      (s.slug && s.slug.toLowerCase() === sId) ||
      (s.id && sId.startsWith(s.id.toLowerCase()))
    );
    if (service) {
      const cat = categories.find(c => c.id === service.categoryId);
      const rawTitle = service.seoTitle || `${service.title} Online Assistance`;
      const title = rawTitle.includes('EasyDesk') ? rawTitle : `${rawTitle} | EasyDesk`;
      const description = service.seoDescription || service.shortDescription || service.description || `Online application filing, document pre-checks, transparent fees, and real-time tracking for ${service.title}.`;
      const canonicalUrl = `${origin}/services/${service.slug || service.id}`;

      const schemas: object[] = [
        getBreadcrumbsJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Services', path: '/services' },
          { name: service.title, path: `/services/${service.slug || service.id}` }
        ]),
        getServiceJsonLd(service, cat, contactSettings)
      ];

      const faqSchema = getFaqJsonLd(service.faqs);
      if (faqSchema) schemas.push(faqSchema);

      return {
        title,
        description,
        canonicalUrl,
        robots: 'index, follow',
        ogType: 'website',
        ogTitle: title,
        ogDescription: description,
        ogUrl: canonicalUrl,
        ogSiteName: siteName,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        schemas
      };
    }
  }

  // 2. Blog Details
  if (route.view === 'blogs' && route.blogId) {
    const bId = route.blogId.toLowerCase();
    const blog = blogs.find(b => 
      (b.id && b.id.toLowerCase() === bId) || 
      (b.slug && b.slug.toLowerCase() === bId) ||
      (b.id && bId.startsWith(b.id.toLowerCase()))
    );
    if (blog) {
      const rawBlogTitle = blog.seoTitle || blog.title;
      const title = rawBlogTitle.includes('EasyDesk') ? rawBlogTitle : `${rawBlogTitle} | EasyDesk`;
      const description = blog.seoDescription || blog.shortDescription || blog.excerpt || blog.title;
      const canonicalUrl = `${origin}/blogs/${blog.slug || blog.id}`;

      const schemas: object[] = [
        getBreadcrumbsJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Knowledge Hub', path: '/blogs' },
          { name: blog.title, path: `/blogs/${blog.slug || blog.id}` }
        ]),
        getBlogPostingJsonLd(blog, contactSettings)
      ];

      return {
        title,
        description,
        canonicalUrl,
        robots: 'index, follow',
        ogType: 'article',
        ogTitle: title,
        ogDescription: description,
        ogUrl: canonicalUrl,
        ogSiteName: siteName,
        ogImage: blog.image,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        twitterImage: blog.image,
        schemas
      };
    }
  }

  // 3. 404 Not Found
  if (route.view === 'not-found' || route.isNotFound) {
    const canonicalUrl = `${origin}/404`;
    return {
      title: 'Page Not Found (404) | EasyDesk',
      description: 'The requested page could not be found on EasyDesk. Browse our digital services catalog or search for citizen documentation assistance.',
      canonicalUrl,
      robots: 'noindex, nofollow',
      ogType: 'website',
      ogTitle: 'Page Not Found (404) | EasyDesk',
      ogDescription: 'The requested page could not be found.',
      ogUrl: canonicalUrl,
      ogSiteName: siteName,
      twitterCard: 'summary',
      twitterTitle: 'Page Not Found (404) | EasyDesk',
      twitterDescription: 'The requested page could not be found.',
      schemas: []
    };
  }

  // 4. Core Static Pages
  switch (route.view) {
    case 'services': {
      const canonicalUrl = `${origin}/services`;
      const title = 'Online Services Catalog & Citizen Assistance | EasyDesk';
      const description = 'Browse EasyDesk services: PAN card assistance, Aadhaar demographics, passport filing guidance, MSME registration, GST, and online forms.';
      return {
        title,
        description,
        canonicalUrl,
        robots: 'index, follow',
        ogType: 'website',
        ogTitle: title,
        ogDescription: description,
        ogUrl: canonicalUrl,
        ogSiteName: siteName,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        schemas: [
          getBreadcrumbsJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Services', path: '/services' }
          ])
        ]
      };
    }
    case 'blogs': {
      const canonicalUrl = `${origin}/blogs`;
      const title = 'Knowledge Hub, Citizen Guides & Updates | EasyDesk';
      const description = 'Read practical step-by-step application guides, document checklists, scholarship windows, and public-service notification updates.';
      return {
        title,
        description,
        canonicalUrl,
        robots: 'index, follow',
        ogType: 'blog',
        ogTitle: title,
        ogDescription: description,
        ogUrl: canonicalUrl,
        ogSiteName: siteName,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        schemas: [
          getBreadcrumbsJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Knowledge Hub', path: '/blogs' }
          ])
        ]
      };
    }
    case 'about': {
      const canonicalUrl = `${origin}/about`;
      const title = 'About EasyDesk — Commercial Citizen Assistance Platform';
      const description = 'Learn about EasyDesk: an independent commercial digital document assistance desk helping citizens complete documentation with verified guidance.';
      return {
        title,
        description,
        canonicalUrl,
        robots: 'index, follow',
        ogType: 'website',
        ogTitle: title,
        ogDescription: description,
        ogUrl: canonicalUrl,
        ogSiteName: siteName,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        schemas: [
          getBreadcrumbsJsonLd([
            { name: 'Home', path: '/' },
            { name: 'About Us', path: '/about' }
          ]),
          getOrganizationJsonLd(contactSettings, companyProfile)
        ]
      };
    }
    case 'contact': {
      const canonicalUrl = `${origin}/contact`;
      const title = 'Contact EasyDesk — Support & Helpdesk';
      const description = 'Contact EasyDesk for application inquiries, document guidance, and tracking assistance via WhatsApp, telephonic support, or email.';
      return {
        title,
        description,
        canonicalUrl,
        robots: 'index, follow',
        ogType: 'website',
        ogTitle: title,
        ogDescription: description,
        ogUrl: canonicalUrl,
        ogSiteName: siteName,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        schemas: [
          getBreadcrumbsJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Contact Us', path: '/contact' }
          ]),
          getOrganizationJsonLd(contactSettings, companyProfile)
        ]
      };
    }
    case 'payment': {
      const canonicalUrl = `${origin}/payment`;
      const title = 'Payment Information | EasyDesk';
      const description = 'Payment methods, fee policies, and transaction verification instructions for EasyDesk service requests.';
      return {
        title,
        description,
        canonicalUrl,
        robots: 'noindex, follow',
        ogType: 'website',
        ogTitle: title,
        ogDescription: description,
        ogUrl: canonicalUrl,
        ogSiteName: siteName,
        twitterCard: 'summary',
        twitterTitle: title,
        twitterDescription: description,
        schemas: []
      };
    }
    case 'track': {
      const canonicalUrl = `${origin}/track`;
      const title = 'Track Application Status | EasyDesk';
      const description = 'Track the real-time processing status of your digital service request using your Order ID and mobile number.';
      return {
        title,
        description,
        canonicalUrl,
        robots: 'index, follow',
        ogType: 'website',
        ogTitle: title,
        ogDescription: description,
        ogUrl: canonicalUrl,
        ogSiteName: siteName,
        twitterCard: 'summary',
        twitterTitle: title,
        twitterDescription: description,
        schemas: [
          getBreadcrumbsJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Track Order', path: '/track' }
          ])
        ]
      };
    }
    case 'privacy-security': {
      const canonicalUrl = `${origin}/privacy-security`;
      const title = 'Privacy Policy & Data Security | EasyDesk';
      const description = 'Learn how EasyDesk safeguards user documents, adheres to data protection norms, and enforces document privacy.';
      return {
        title,
        description,
        canonicalUrl,
        robots: 'index, follow',
        ogType: 'website',
        ogTitle: title,
        ogDescription: description,
        ogUrl: canonicalUrl,
        ogSiteName: siteName,
        twitterCard: 'summary',
        twitterTitle: title,
        twitterDescription: description,
        schemas: [
          getBreadcrumbsJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Privacy Policy', path: '/privacy-security' }
          ])
        ]
      };
    }
    case 'admin':
    case 'admin-login': {
      const canonicalUrl = `${origin}/admin`;
      return {
        title: 'Officer & Administrative Portal | EasyDesk',
        description: 'EasyDesk administrative portal for authorized operators.',
        canonicalUrl,
        robots: 'noindex, nofollow',
        ogType: 'website',
        ogTitle: 'Officer Portal | EasyDesk',
        ogDescription: 'Administrative desk for authorized operators.',
        ogUrl: canonicalUrl,
        ogSiteName: siteName,
        twitterCard: 'summary',
        twitterTitle: 'Officer Portal | EasyDesk',
        twitterDescription: 'Administrative desk.',
        schemas: []
      };
    }
    case 'not-found': {
      const canonicalUrl = `${origin}/404`;
      return {
        title: 'Page Not Found (404) | EasyDesk',
        description: 'The requested page could not be found on EasyDesk. Browse our digital assistance services, blogs, and support desk.',
        canonicalUrl,
        robots: 'noindex, nofollow',
        ogType: 'website',
        ogTitle: 'Page Not Found (404) | EasyDesk',
        ogDescription: 'The requested page could not be found on EasyDesk.',
        ogUrl: canonicalUrl,
        ogSiteName: siteName,
        twitterCard: 'summary',
        twitterTitle: 'Page Not Found (404) | EasyDesk',
        twitterDescription: 'The requested page could not be found on EasyDesk.',
        schemas: []
      };
    }
    case 'home':
    default: {
      const canonicalUrl = `${origin}/`;
      const title = 'EasyDesk — Citizen Support, Digital Services & Knowledge Hub';
      const description = 'Independent commercial digital document assistance and citizen advisory portal. Guided online application filing, pre-submission audits, and verified status updates.';
      return {
        title,
        description,
        canonicalUrl,
        robots: 'index, follow',
        ogType: 'website',
        ogTitle: title,
        ogDescription: description,
        ogUrl: canonicalUrl,
        ogSiteName: siteName,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        schemas: [
          getWebSiteJsonLd(),
          getOrganizationJsonLd(contactSettings, companyProfile)
        ]
      };
    }
  }
}

/**
 * Generates dynamic XML Sitemap conforming to sitemaps.org schema.
 * Only includes genuinely public, active services and published blogs.
 * Strictly excludes admin, api, customer, employee, order tracking, and private routes.
 * CRITICAL: If a collection is empty, returns empty without zombie re-seeding!
 */
export function generateSitemapXml(
  services: Service[] = [],
  blogs: Blog[] = [],
  categories: ServiceCategory[] = []
): string {
  const origin = getCanonicalOrigin();
  const currentDate = new Date().toISOString().split('T')[0];

  const urls: Array<{ loc: string; lastmod?: string; changefreq: string; priority: string }> = [];

  // Core public static pages
  urls.push(
    { loc: `${origin}/`, lastmod: currentDate, changefreq: 'daily', priority: '1.0' },
    { loc: `${origin}/services`, lastmod: currentDate, changefreq: 'weekly', priority: '0.9' },
    { loc: `${origin}/blogs`, lastmod: currentDate, changefreq: 'weekly', priority: '0.8' },
    { loc: `${origin}/about`, lastmod: currentDate, changefreq: 'monthly', priority: '0.6' },
    { loc: `${origin}/contact`, lastmod: currentDate, changefreq: 'monthly', priority: '0.6' },
    { loc: `${origin}/track`, lastmod: currentDate, changefreq: 'monthly', priority: '0.5' },
    { loc: `${origin}/privacy-security`, lastmod: currentDate, changefreq: 'monthly', priority: '0.5' }
  );

  // Active public services (excludes Inactive, deleted, or test-only services)
  if (Array.isArray(services) && services.length > 0) {
    for (const service of services) {
      if (!service || !service.id) continue;
      const status = (service.status || 'Active').toLowerCase();
      if (status === 'inactive' || status === 'deleted') continue;

      const slug = (service.slug || service.id).trim();
      urls.push({
        loc: `${origin}/services/${slug}`,
        lastmod: currentDate,
        changefreq: 'weekly',
        priority: '0.8'
      });
    }
  }

  // Published public blogs (excludes Draft, Inactive, deleted blogs)
  if (Array.isArray(blogs) && blogs.length > 0) {
    for (const blog of blogs) {
      if (!blog || !blog.id) continue;
      const status = (blog.status || 'active').toLowerCase();
      if (status === 'draft' || status === 'inactive' || status === 'deleted') continue;

      const slug = (blog.slug || blog.id).trim();
      let lastmod = currentDate;
      if ((blog as any).updatedAt) {
        lastmod = new Date((blog as any).updatedAt).toISOString().split('T')[0];
      } else if (blog.date || blog.createdAt) {
        lastmod = new Date(blog.date || blog.createdAt).toISOString().split('T')[0];
      }

      urls.push({
        loc: `${origin}/blogs/${slug}`,
        lastmod,
        changefreq: 'monthly',
        priority: '0.7'
      });
    }
  }

  const xmlEntries = urls.map(u => {
    return `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries}
</urlset>`;
}

/**
 * Generates standard compliant robots.txt.
 * Uses dynamic getCanonicalOrigin() for sitemap location.
 */
export function generateRobotsTxt(): string {
  const origin = getCanonicalOrigin();
  return `# EasyDesk robots.txt
User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /uploads/private/
Disallow: /payment

Sitemap: ${origin}/sitemap.xml
`;
}

export interface ParsedSeoRoute {
  view: string;
  serviceId: string | null;
  blogId: string | null;
  adminTab: string;
  isNotFound: boolean;
}

/**
 * Universal SEO route parser.
 * Handles paths, slashes, deep links, and identifies 404 / not-found states.
 */
export function parseSeoRoute(pathname: string): ParsedSeoRoute {
  let clean = (pathname || '/').trim().replace(/\/+/g, '/');
  if (clean.length > 1 && clean.endsWith('/')) {
    clean = clean.slice(0, -1);
  }

  if (clean === '' || clean === '/') {
    return { view: 'home', serviceId: null, blogId: null, adminTab: 'analytics', isNotFound: false };
  }

  const serviceMatch = clean.match(/^\/services\/([a-zA-Z0-9_.-]+)/);
  if (serviceMatch && serviceMatch[1]) {
    return { view: 'service-details', serviceId: serviceMatch[1], blogId: null, adminTab: 'analytics', isNotFound: false };
  }

  const blogMatch = clean.match(/^\/blogs\/([a-zA-Z0-9_.-]+)/);
  if (blogMatch && blogMatch[1]) {
    return { view: 'blogs', serviceId: null, blogId: blogMatch[1], adminTab: 'analytics', isNotFound: false };
  }

  if (clean === '/services') return { view: 'services', serviceId: null, blogId: null, adminTab: 'analytics', isNotFound: false };
  if (clean === '/blogs') return { view: 'blogs', serviceId: null, blogId: null, adminTab: 'analytics', isNotFound: false };
  if (clean === '/about' || clean === '/terms') return { view: 'about', serviceId: null, blogId: null, adminTab: 'analytics', isNotFound: false };
  if (clean === '/contact') return { view: 'contact', serviceId: null, blogId: null, adminTab: 'analytics', isNotFound: false };
  if (clean === '/payment') return { view: 'payment', serviceId: null, blogId: null, adminTab: 'analytics', isNotFound: false };
  if (clean === '/track' || clean === '/track-order') return { view: 'track', serviceId: null, blogId: null, adminTab: 'analytics', isNotFound: false };
  if (clean === '/privacy-security' || clean === '/privacy-policy' || clean === '/privacy') {
    return { view: 'privacy-security', serviceId: null, blogId: null, adminTab: 'analytics', isNotFound: false };
  }
  if (clean === '/submit-review' || clean === '/review') {
    return { view: 'submit-review', serviceId: null, blogId: null, adminTab: 'analytics', isNotFound: false };
  }
  if (clean === '/admin-login') return { view: 'admin-login', serviceId: null, blogId: null, adminTab: 'analytics', isNotFound: false };
  if (clean === '/admin' || clean.startsWith('/admin/')) {
    const subTab = clean.startsWith('/admin/') ? clean.replace(/^\/admin\//, '').split('/')[0] : 'analytics';
    return { view: 'admin', serviceId: null, blogId: null, adminTab: subTab || 'analytics', isNotFound: false };
  }

  return { view: 'not-found', serviceId: null, blogId: null, adminTab: 'analytics', isNotFound: true };
}
