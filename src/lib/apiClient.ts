/**
 * Centralized API Client for EasyDesk
 * Handles CSRF headers, Authorization Bearer tokens, JSON serialization, and safe error handling.
 */

let cachedCsrfToken: string | null = null;

export async function fetchCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    const res = await fetch('/api/security/csrf');
    if (res.ok) {
      const data = await safeParseJsonResponse<any>(res);
      if (data && data.csrfToken) {
        cachedCsrfToken = data.csrfToken;
        return data.csrfToken;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch CSRF token from server:', err);
  }
  return 'easydesk_secure_csrf_token_2026_val';
}

/**
 * Safely parses a fetch Response as JSON without throwing unexpected SyntaxErrors on HTML or empty responses.
 */
export async function safeParseJsonResponse<T = any>(res: Response): Promise<T | null> {
  try {
    const text = await res.text();
    if (!text || text.trim().length === 0) return null;
    // If response starts with HTML doctype or tag, it is a non-JSON fallback page
    const trimmed = text.trim();
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.startsWith('<head')) {
      return null;
    }
    return JSON.parse(text) as T;
  } catch (err) {
    return null;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  token?: string;
  isAdmin?: boolean;
  body?: any;
}

export async function apiFetch(endpoint: string, options: RequestOptions = {}): Promise<Response> {
  const { token, isAdmin, headers: customHeaders, body, method = 'GET', ...restOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  // Get Auth Token
  let authToken = token;
  if (!authToken) {
    authToken = localStorage.getItem('easydesk_admin_token') || undefined;
  }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // Include CSRF token for state-changing HTTP methods
  let csrfTokenUsed: string | undefined;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    csrfTokenUsed = await fetchCsrfToken();
    headers['x-csrf-token'] = csrfTokenUsed;
  }

  const config: RequestInit = {
    method,
    headers,
    body: body !== undefined && typeof body !== 'string' ? JSON.stringify(body) : body,
    ...restOptions,
  };

  try {
    const response = await fetch(endpoint, config);

    if (!response.ok) {
      const status = response.status;
      let backendError = response.statusText;
      try {
        const cloned = response.clone();
        const errJson = await safeParseJsonResponse<any>(cloned);
        if (errJson && errJson.message) backendError = errJson.message;
      } catch {}

      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        console.warn(`[EasyDesk API Notice] Endpoint: ${endpoint} | Method: ${method} | Status: ${status} | Reason: ${backendError}`);
      }
    }

    return response;
  } catch (netErr: any) {
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const isConnErr = netErr?.message?.includes('Failed to fetch') || netErr?.message?.includes('NetworkError') || netErr?.message?.includes('offline');

    if (!isOffline && !isConnErr) {
      console.warn(`[EasyDesk Network] ${method} ${endpoint} failed:`, netErr?.message || netErr);
    }

    // For GET requests, return a clean non-throwing 503 response with offline indicator
    if (method.toUpperCase() === 'GET') {
      return new Response(JSON.stringify({ 
        message: 'Network offline / connection unavailable', 
        offline: true 
      }), {
        status: 503,
        statusText: 'Service Unavailable (Offline)',
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // For write/mutation actions, throw a clear human-readable error
    throw new Error(isOffline 
      ? 'You are currently offline. Please reconnect to the internet and try again.' 
      : 'Network request failed. Please check your internet connection and try again.'
    );
  }
}

export async function adminFetch(endpoint: string, options: RequestOptions = {}): Promise<Response> {
  return apiFetch(endpoint, { ...options, isAdmin: true });
}

export class ApiError extends Error {
  status: number;
  isNotFound: boolean;
  isOffline: boolean;
  endpoint: string;

  constructor(message: string, status: number, endpoint: string, isOffline = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isNotFound = status === 404;
    this.isOffline = isOffline;
    this.endpoint = endpoint;
  }
}

export function isNotFoundError(err: any): boolean {
  if (!err) return false;
  return err.status === 404 || err.isNotFound === true || err?.message?.includes('404') || err?.message?.toLowerCase().includes('not found');
}

export async function apiClient<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const response = await apiFetch(endpoint, options);

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    if (response.status === 404) {
      errorMessage = 'Content Unavailable: The requested resource was not found.';
    }

    try {
      const cloned = response.clone();
      const errorData = await safeParseJsonResponse<any>(cloned);
      if (errorData && errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // Ignore JSON parse error on non-json error response
    }
    
    throw new ApiError(errorMessage, response.status, endpoint, response.status === 503);
  }

  // Handle empty or 204 response
  if (response.status === 204) {
    return {} as T;
  }

  const parsed = await safeParseJsonResponse<T>(response);
  if (parsed === null) {
    return {} as T;
  }
  return parsed;
}


