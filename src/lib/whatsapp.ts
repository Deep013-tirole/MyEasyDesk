import { Service } from '../types.js';

let lastFetchTime = 0;

export function normalizeWhatsAppNumber(raw?: string | null): string {
  if (!raw) return '919876543210';
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
  return '919876543210';
}

export function updateCachedContactSettings(data: any) {
  if (data) {
    if (data.whatsapp) {
      const norm = normalizeWhatsAppNumber(data.whatsapp);
      localStorage.setItem('easydesk_whatsapp_number', norm);
    }
    if (data.phone) {
      localStorage.setItem('easydesk_contact_phone', data.phone);
    }
    if (data.email) {
      localStorage.setItem('easydesk_contact_email', data.email);
    }
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

  fetch('/api/contact-settings')
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data) {
        updateCachedContactSettings(data);
      }
    })
    .catch(() => {});
}

export function getWhatsAppNumber(): string {
  // Always trigger non-blocking sync from server if stale
  syncContactSettingsFromServer();

  const storedNumber = typeof localStorage !== 'undefined' ? localStorage.getItem('easydesk_whatsapp_number') : null;
  if (storedNumber) {
    return normalizeWhatsAppNumber(storedNumber);
  }

  return '919876543210';
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

