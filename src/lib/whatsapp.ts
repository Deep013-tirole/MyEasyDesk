import { Service } from '../types.js';

let lastFetchTime = 0;

export function normalizeWhatsAppNumber(raw?: string | null): string {
  if (!raw) return '919575538590';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  if (digits.startsWith('91') && digits.length === 12) {
    return digits;
  }
  if (digits.length > 0) {
    return digits;
  }
  return '919575538590';
}

export function updateCachedContactSettings(data: any) {
  if (data && typeof data === 'object') {
    if (data.whatsapp) {
      const norm = normalizeWhatsAppNumber(data.whatsapp);
      try {
        localStorage.setItem('easydesk_whatsapp_number', norm);
      } catch {}
    }
    if (data.phone) {
      try {
        localStorage.setItem('easydesk_contact_phone', data.phone);
      } catch {}
    }
    if (data.email) {
      try {
        localStorage.setItem('easydesk_contact_email', data.email);
      } catch {}
    }
    try {
      localStorage.setItem('easydesk_cache_contact_settings', JSON.stringify(data));
    } catch {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easydesk_contact_updated', { detail: data }));
    }
  }
}

export function syncContactSettingsFromServer(force = false) {
  const now = Date.now();
  if (!force && now - lastFetchTime < 10000) {
    return;
  }
  lastFetchTime = now;

  fetch(`/api/contact-settings?_t=${now}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
  })
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data && typeof data === 'object') {
        const contactData = data.contactSettings || data;
        updateCachedContactSettings(contactData);
      }
    })
    .catch(() => {});
}

export function getWhatsAppNumber(): string {
  // Always trigger non-blocking sync from server if stale
  syncContactSettingsFromServer();

  if (typeof localStorage !== 'undefined') {
    const storedNumber = localStorage.getItem('easydesk_whatsapp_number');
    if (storedNumber) {
      return normalizeWhatsAppNumber(storedNumber);
    }
    try {
      const cached = localStorage.getItem('easydesk_cache_contact_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.whatsapp) return normalizeWhatsAppNumber(parsed.whatsapp);
        if (parsed && parsed.phone) return normalizeWhatsAppNumber(parsed.phone);
      }
    } catch {}
  }

  return '919575538590';
}

export function onContactSettingsUpdated(callback: (data: any) => void) {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: any) => callback(e.detail);
  window.addEventListener('easydesk_contact_updated', handler);
  return () => window.removeEventListener('easydesk_contact_updated', handler);
}

export function openWhatsAppForService(
  service: Service, 
  categoryName?: string,
  customInquiry?: string
) {
  const number = getWhatsAppNumber();
  const cat = categoryName || 'Digital Document Assistance';
  const price = (service.govFees || 0) + (service.serviceCharge || 0);

  const text = `Hello EasyDesk,

I want to inquire / order the following service:

• Service: ${service.title}
• Service ID: ${service.id}
• Category: ${cat}
• Total Fee: ₹${price}

${customInquiry || 'Please guide me with the required documents, verification process, and next steps.'}

Thank you!`;

  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/${number}?text=${encoded}`, '_blank');
}

export function openGeneralWhatsApp(customText?: string) {
  const number = getWhatsAppNumber();
  const defaultText = `Hello EasyDesk, I would like to inquire about your digital document assistance services. Please guide me with the process. Thank you.`;
  const text = customText || defaultText;
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, '_blank');
}

export function openWhatsAppForSubmittedOrder(order: {
  id: string;
  serviceTitle: string;
  name: string;
  createdAt?: string;
}) {
  const number = getWhatsAppNumber();
  const dateStr = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const text = `Hello EasyDesk Team,

I have submitted an online service request on your website:

• Order ID: ${order.id}
• Service: ${order.serviceTitle}
• Applicant Name: ${order.name}
• Submitted On: ${dateStr}

Please verify my details and advise on the next steps and payment instructions. Thank you!`;

  window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, '_blank');
}

