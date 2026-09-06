/**
 * API Data Service for EasyDesk
 * All data operations route directly through Cloudflare Worker API (/api/*) backed by Cloudflare D1 & R2.
 * Completely eliminates direct client-side Firestore access.
 */
import { Service, ServiceCategory, Blog, BlogCategory, Review, User } from '../types';
import { fetchCsrfToken } from './apiClient';

function isNetworkOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Loads all services via Cloudflare Worker API
 */
export async function getClientServices(): Promise<Service[] | null> {
  if (isNetworkOffline()) return null;
  try {
    const res = await fetch(`/api/services?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const list: Service[] = Array.isArray(data) ? data : (data.services || []);
    return list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  } catch (err) {
    console.warn('[DataClient] Error fetching services:', err);
    return null;
  }
}

/**
 * Loads all service categories via Cloudflare Worker API
 */
export async function getClientCategories(includeAll = false): Promise<ServiceCategory[] | null> {
  if (isNetworkOffline()) return null;
  try {
    const url = includeAll ? `/api/categories?includeAll=true&_t=${Date.now()}` : `/api/categories?_t=${Date.now()}`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const list: ServiceCategory[] = Array.isArray(data) ? data : (data.categories || []);
    const filtered = includeAll ? list : list.filter(c => c.status !== 'Inactive');
    return filtered.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  } catch (err) {
    console.warn('[DataClient] Error fetching categories:', err);
    return null;
  }
}

/**
 * Loads all blog categories via Cloudflare Worker API
 */
export async function getClientBlogCategories(includeAll = false): Promise<BlogCategory[] | null> {
  if (isNetworkOffline()) return null;
  try {
    const res = await fetch(`/api/blog-categories?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const list: BlogCategory[] = Array.isArray(data) ? data : (data.blogCategories || []);
    const filtered = includeAll ? list : list.filter(c => c.status !== 'Inactive');
    return filtered.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  } catch (err) {
    console.warn('[DataClient] Error fetching blog categories:', err);
    return null;
  }
}

/**
 * Loads all blogs via Cloudflare Worker API
 */
export async function getClientBlogs(): Promise<Blog[] | null> {
  if (isNetworkOffline()) return null;
  try {
    const res = await fetch(`/api/blogs?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const list: Blog[] = Array.isArray(data) ? data : (data.blogs || []);
    return list.sort((a, b) => new Date(b.publishedAt || b.date || 0).getTime() - new Date(a.publishedAt || a.date || 0).getTime());
  } catch (err) {
    console.warn('[DataClient] Error fetching blogs:', err);
    return null;
  }
}

/**
 * Loads all reviews via Cloudflare Worker API
 */
export async function getClientReviews(): Promise<Review[] | null> {
  if (isNetworkOffline()) return null;
  try {
    const res = await fetch(`/api/reviews?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const list: Review[] = Array.isArray(data) ? data : (data.reviews || []);
    return list.filter(r => r.status === 'Approved' || (r as any).status === undefined);
  } catch (err) {
    console.warn('[DataClient] Error fetching reviews:', err);
    return null;
  }
}

/**
 * Loads all FAQs via Cloudflare Worker API
 */
export async function getClientFaqs(): Promise<any[] | null> {
  if (isNetworkOffline()) return null;
  try {
    const res = await fetch(`/api/faqs?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const list: any[] = Array.isArray(data) ? data : (data.faqs || []);
    return list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  } catch (err) {
    console.warn('[DataClient] Error fetching faqs:', err);
    return null;
  }
}

/**
 * Loads a specific setting via Cloudflare Worker API
 */
export async function getClientSetting<T = any>(settingKey: string): Promise<T | null> {
  if (isNetworkOffline()) return null;
  try {
    const res = await fetch(`/api/settings/${settingKey}?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (res.ok) {
      const data = await res.json();
      return (data && (data[settingKey] !== undefined ? data[settingKey] : data)) as T;
    }
  } catch (err) {
    console.warn(`[DataClient] Error fetching setting ${settingKey}:`, err);
  }
  return null;
}

/**
 * Loads Privacy & Security settings via Cloudflare Worker API
 */
export async function getClientPrivacySecurity(): Promise<any> {
  if (isNetworkOffline()) return null;
  try {
    const res = await fetch(`/api/settings/privacy-security?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (res.ok) {
      const data = await res.json();
      return data.privacySecurity || data.privacySecuritySettings || data;
    }
  } catch (err) {
    console.warn('[DataClient] Error loading Privacy & Security:', err);
  }
  return null;
}

/**
 * Loads Payment Configuration via Cloudflare Worker API
 */
export async function getClientPaymentConfig(): Promise<any> {
  if (isNetworkOffline()) return null;
  try {
    const res = await fetch(`/api/settings/payment?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (res.ok) {
      const data = await res.json();
      return data.paymentConfig || data.paymentSettings || data;
    }
  } catch (err) {
    console.warn('[DataClient] Error loading Payment Config:', err);
  }
  return null;
}

/**
 * Safely and canonically formats structured contact address into a clean string,
 * avoiding duplicate city/state/pincode if already part of the street address,
 * and returning empty string when no address data is present (never injecting fake defaults).
 */
export function formatFullAddress(contact?: { address?: string; city?: string; state?: string; pinCode?: string } | null): string {
  if (!contact) return '';
  const addr = (contact.address || '').trim();
  const city = (contact.city || '').trim();
  const state = (contact.state || '').trim();
  const pin = (contact.pinCode || '').trim();

  const parts: string[] = [];
  if (addr) parts.push(addr);
  if (city && !addr.toLowerCase().includes(city.toLowerCase())) parts.push(city);
  if (state && !addr.toLowerCase().includes(state.toLowerCase())) parts.push(state);

  let formatted = parts.join(', ');
  if (pin && !formatted.includes(pin)) {
    formatted = formatted ? `${formatted} - ${pin}` : pin;
  }
  return formatted;
}

/**
 * Loads Contact Settings via Cloudflare Worker API
 */
export async function getClientContactSettings(): Promise<any> {
  if (isNetworkOffline()) return null;
  try {
    const res = await fetch(`/api/contact-settings?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (res.ok) {
      const data = await res.json();
      const settings = (data && data.contactSettings) ? data.contactSettings : data;
      if (settings && typeof settings === 'object' && (settings.phone || settings.email || settings.companyName || settings.address)) {
        try {
          localStorage.setItem('easydesk_cache_contact_settings', JSON.stringify(settings));
        } catch {}
      }
      return settings;
    }
  } catch (err) {
    console.warn('[DataClient] Error loading Contact Settings:', err);
  }
  return null;
}

/**
 * Loads About Us and Founder data via Cloudflare Worker API
 */
export async function getClientAboutUs(): Promise<{ aboutUs: any; founder: any }> {
  if (isNetworkOffline()) return { aboutUs: null, founder: null };
  try {
    const res = await fetch(`/api/about?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (res.ok) {
      const data = await res.json();
      return {
        aboutUs: data.aboutUs || null,
        founder: data.founder || null
      };
    }
  } catch (err) {
    console.warn('[DataClient] Error loading About Us:', err);
  }
  return { aboutUs: null, founder: null };
}

/**
 * Authenticates admin directly via server backend API to ensure credentials and hashes are verified securely on server
 */
export async function authenticateAdminDirect(
  loginId: string, 
  rawPassword: string
): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
  try {
    const cleanId = (loginId || '').trim();
    const cleanPass = (rawPassword || '').trim();

    if (!cleanId) {
      return { success: false, error: 'Login ID / Email is required.' };
    }

    const res = await fetch('/api/auth/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': 'easydesk_secure_csrf_token_2026_val'
      },
      body: JSON.stringify({ email: cleanId, password: cleanPass })
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}

    if (res.ok && data && (data.accessToken || data.token)) {
      return {
        success: true,
        user: data.user,
        token: data.accessToken || data.token
      };
    }

    if (data && data.message) {
      return { success: false, error: data.message };
    }

    return { success: false, error: `Authentication failed (${res.status} ${res.statusText}).` };
  } catch (err: any) {
    console.error('[AdminAuth] Error calling authentication endpoint:', err);
    return { success: false, error: err?.message || 'Server connection error during authentication.' };
  }
}

/**
 * Saves a document via Cloudflare Worker API
 */
export async function saveClientDoc(collectionName: string, docId: string, data: any): Promise<boolean> {
  try {
    const csrfToken = await fetchCsrfToken();
    const res = await fetch(`/api/admin/${collectionName}/${encodeURIComponent(docId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        'Authorization': `Bearer ${localStorage.getItem('easydesk_admin_token') || localStorage.getItem('token') || ''}`
      },
      body: JSON.stringify(data)
    });
    return res.ok;
  } catch (err) {
    console.error(`[DataClient] Error saving to ${collectionName}/${docId}:`, err);
    return false;
  }
}

/**
 * Deletes a document via Cloudflare Worker API
 */
export async function deleteClientDoc(collectionName: string, docId: string): Promise<boolean> {
  try {
    const csrfToken = await fetchCsrfToken();
    const res = await fetch(`/api/admin/${collectionName}/${encodeURIComponent(docId)}`, {
      method: 'DELETE',
      headers: {
        'x-csrf-token': csrfToken,
        'Authorization': `Bearer ${localStorage.getItem('easydesk_admin_token') || localStorage.getItem('token') || ''}`
      }
    });
    return res.ok;
  } catch (err) {
    console.error(`[DataClient] Error deleting from ${collectionName}/${docId}:`, err);
    return false;
  }
}

/**
 * Saves a setting document via Cloudflare Worker API
 */
export async function saveClientSetting(settingKey: string, data: any): Promise<boolean> {
  try {
    const csrfToken = await fetchCsrfToken();
    const res = await fetch(`/api/admin/settings/${settingKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        'Authorization': `Bearer ${localStorage.getItem('easydesk_admin_token') || localStorage.getItem('token') || ''}`
      },
      body: JSON.stringify(data)
    });
    return res.ok;
  } catch (err) {
    console.error(`[DataClient] Error saving setting ${settingKey}:`, err);
    return false;
  }
}
