import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type LanguageCode = 'en' | 'hi' | 'mr' | 'gu';

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  nativeName: string;
  shortLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', shortLabel: 'EN' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', shortLabel: 'HI' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', shortLabel: 'MR' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', shortLabel: 'GU' },
];

export const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  en: {
    'nav.portalSubtitle': 'Digital Service Portal',
    'nav.home': 'Home',
    'nav.services': 'Services',
    'nav.blogs': 'Blogs',
    'nav.about': 'About Us',
    'nav.contact': 'Contact',
    'nav.payment': 'Payment',
    'nav.privacy': 'Privacy & Security',
    'nav.admin': 'Admin Panel',
    'nav.adminLogin': 'Admin Login',
    'nav.signOut': 'Sign Out',
    'nav.orderWhatsApp': 'Order on WhatsApp',
    'nav.selectLanguage': 'Select Language',
    'nav.language': 'Language',
    'nav.trackOrder': 'Track Order',
    
    'common.allServices': 'All Services',
    'common.searchPlaceholder': 'Search services, certificates, licenses...',
    'common.viewDetails': 'View Details',
    'common.applyNow': 'Apply Now',
    'common.trackStatus': 'Track Status',
    'common.support': '24/7 Support',
    'common.fastProcessing': 'Fast Processing',
    'common.governmentFees': 'Govt Fees',
    'common.serviceCharges': 'Service Fee',
    'common.totalAmount': 'Total Fee',
    'common.readMore': 'Read More',
    'common.share': 'Share',
    'common.needHelp': 'Need Help with Documents?',
    'common.chatWithUs': 'Chat with Us',
    'common.secureVerified': '100% Secure & Verified',
    'common.isoCertified': 'ISO 27001 Certified Security'
  },
  hi: {
    'nav.portalSubtitle': 'डिजिटल सेवा पोर्टल',
    'nav.home': 'होम',
    'nav.services': 'सेवाएं',
    'nav.blogs': 'ब्लॉग',
    'nav.about': 'हमारे बारे में',
    'nav.contact': 'संपर्क करें',
    'nav.payment': 'भुगतान',
    'nav.privacy': 'गोपनीयता और सुरक्षा',
    'nav.admin': 'एडमिन पैनल',
    'nav.adminLogin': 'एडमिन लॉगिन',
    'nav.signOut': 'साइन आउट',
    'nav.orderWhatsApp': 'व्हाट्सएप पर ऑर्डर करें',
    'nav.selectLanguage': 'भाषा चुनें',
    'nav.language': 'भाषा',
    'nav.trackOrder': 'ऑर्डर ट्रैक करें',

    'common.allServices': 'सभी सेवाएं',
    'common.searchPlaceholder': 'सेवाएं, प्रमाण पत्र, लाइसेंस खोजें...',
    'common.viewDetails': 'विवरण देखें',
    'common.applyNow': 'अभी आवेदन करें',
    'common.trackStatus': 'स्थिति ट्रैक करें',
    'common.support': '24/7 सहायता',
    'common.fastProcessing': 'त्वरित प्रक्रिया',
    'common.governmentFees': 'सरकारी शुल्क',
    'common.serviceCharges': 'सेवा शुल्क',
    'common.totalAmount': 'कुल शुल्क',
    'common.readMore': 'और पढ़ें',
    'common.share': 'शेयर करें',
    'common.needHelp': 'दस्तावेजों में सहायता चाहिए?',
    'common.chatWithUs': 'हमसे बात करें',
    'common.secureVerified': '100% सुरक्षित एवं प्रमाणित',
    'common.isoCertified': 'ISO 27001 प्रमाणित सुरक्षा'
  },
  mr: {
    'nav.portalSubtitle': 'डिजिटल सेवा पोर्टल',
    'nav.home': 'मुख्यपृष्ठ',
    'nav.services': 'सेवा',
    'nav.blogs': 'ब्लॉग',
    'nav.about': 'आमच्याबद्दल',
    'nav.contact': 'संपर्क',
    'nav.payment': 'पेमेंट',
    'nav.privacy': 'गोपनीयता आणि सुरक्षा',
    'nav.admin': 'प्रशासक पॅनेल',
    'nav.adminLogin': 'प्रशासक लॉगिन',
    'nav.signOut': 'बाहेर पडा',
    'nav.orderWhatsApp': 'व्हॉट्सअॅपवर ऑर्डर करा',
    'nav.selectLanguage': 'भाषा निवडा',
    'nav.language': 'भाषा',
    'nav.trackOrder': 'अर्ज तपासा',

    'common.allServices': 'सर्व सेवा',
    'common.searchPlaceholder': 'सेवा, प्रमाणपत्रे, परवाने शोधा...',
    'common.viewDetails': 'तपशील पहा',
    'common.applyNow': 'आता अर्ज करा',
    'common.trackStatus': 'स्थिती तपासा',
    'common.support': '24/7 मदत',
    'common.fastProcessing': 'जलद प्रक्रिया',
    'common.governmentFees': 'सरकारी शुल्क',
    'common.serviceCharges': 'सेवा शुल्क',
    'common.totalAmount': 'एकूण शुल्क',
    'common.readMore': 'अधिक वाचा',
    'common.share': 'शेअर करा',
    'common.needHelp': 'कागदपत्रांसाठी मदत हवी आहे?',
    'common.chatWithUs': 'आमच्याशी संपर्क साधा',
    'common.secureVerified': '१००% सुरक्षित आणि प्रमाणित',
    'common.isoCertified': 'ISO 27001 प्रमाणित सुरक्षा'
  },
  gu: {
    'nav.portalSubtitle': 'ડિજિટલ સેવા પોર્ટલ',
    'nav.home': 'મુખ્ય પૃષ્ઠ',
    'nav.services': 'સેવાઓ',
    'nav.blogs': 'બ્લોગ્સ',
    'nav.about': 'અમારા વિશે',
    'nav.contact': 'સંપર્ક કરો',
    'nav.payment': 'ચુકવણી',
    'nav.privacy': 'ગોપનીયતા અને સુરક્ષા',
    'nav.admin': 'એડમિન પેનલ',
    'nav.adminLogin': 'એડમિન લૉગિન',
    'nav.signOut': 'સાઇન આઉટ',
    'nav.orderWhatsApp': 'વોટ્સએપ પર ઓર્ડર કરો',
    'nav.selectLanguage': 'ભાષા પસંદ કરો',
    'nav.language': 'ભાષા',
    'nav.trackOrder': 'ઓર્ડર ટ્રેક કરો',

    'common.allServices': 'બધી સેવાઓ',
    'common.searchPlaceholder': 'સેવાઓ, પ્રમાણપત્રો, લાઇસન્સ શોધો...',
    'common.viewDetails': 'વિગતો જુઓ',
    'common.applyNow': 'હમણાં અરજી કરો',
    'common.trackStatus': 'સ્થિતિ તપાસો',
    'common.support': '24/7 સહાય',
    'common.fastProcessing': 'ઝડપી પ્રક્રિયા',
    'common.governmentFees': 'સરકારી ફી',
    'common.serviceCharges': 'સેવા શુલ્ક',
    'common.totalAmount': 'કુલ ફી',
    'common.readMore': 'વધુ વાંચો',
    'common.share': 'શેર કરો',
    'common.needHelp': 'દસ્તાવેજોમાં મદદ જોઈએ છે?',
    'common.chatWithUs': 'અમારી સાથે વાત કરો',
    'common.secureVerified': '100% સુરક્ષિત અને ચકાસાયેલ',
    'common.isoCertified': 'ISO 27001 પ્રમાણિત સુરક્ષા'
  }
};

declare global {
  interface Window {
    google?: any;
    googleTranslateElementInit?: () => void;
  }
}

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, fallback?: string) => string;
  languages: LanguageOption[];
  currentLanguageOption: LanguageOption;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'easydesk_selected_language';

// Helper to trigger Google Translate on the entire website
function triggerGoogleTranslate(lang: LanguageCode) {
  try {
    const host = window.location.hostname;
    
    if (lang === 'en') {
      // Clear translation cookie for English
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=${host}; path=/;`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=.${host}; path=/;`;
      document.cookie = `googtrans=/en/en; path=/;`;
    } else {
      const cookieVal = `/en/${lang}`;
      document.cookie = `googtrans=${cookieVal}; path=/;`;
      document.cookie = `googtrans=${cookieVal}; domain=${host}; path=/;`;
      document.cookie = `googtrans=${cookieVal}; domain=.${host}; path=/;`;
    }

    // Try finding the Google Translate combo box if rendered
    const select = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
    if (select) {
      select.value = lang;
      select.dispatchEvent(new Event('change'));
    } else {
      // If combo box is not yet rendered, retry in short intervals
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        const combo = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
        if (combo) {
          combo.value = lang;
          combo.dispatchEvent(new Event('change'));
          clearInterval(interval);
        } else if (attempts >= 10) {
          clearInterval(interval);
        }
      }, 300);
    }
  } catch (err) {
    console.warn('[LanguageContext] Error applying Google Translate:', err);
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as LanguageCode;
      if (saved && SUPPORTED_LANGUAGES.some(l => l.code === saved)) {
        return saved;
      }
    } catch {
      // Ignore localStorage errors
    }
    return 'en';
  });

  // Load and initialize Google Translate Script once on mount
  useEffect(() => {
    if (!window.googleTranslateElementInit) {
      window.googleTranslateElementInit = () => {
        if (window.google && window.google.translate && window.google.translate.TranslateElement) {
          new window.google.translate.TranslateElement(
            {
              pageLanguage: 'en',
              includedLanguages: 'en,hi,mr,gu',
              autoDisplay: false,
            },
            'google_translate_element'
          );

          // Apply currently selected language if not English
          const initialLang = localStorage.getItem(LANGUAGE_STORAGE_KEY) as LanguageCode;
          if (initialLang && initialLang !== 'en') {
            setTimeout(() => {
              triggerGoogleTranslate(initialLang);
            }, 300);
          }
        }
      };
    }

    // Append script if not already added
    if (!document.getElementById('google-translate-script')) {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.type = 'text/javascript';
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    } else if (window.google?.translate) {
      // If already loaded, trigger initial language
      if (language !== 'en') {
        setTimeout(() => {
          triggerGoogleTranslate(language);
        }, 300);
      }
    }
  }, []);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {
      // Ignore localStorage errors
    }

    // Trigger full-website translation
    triggerGoogleTranslate(lang);
  };

  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch {
      // Ignore
    }
  }, [language]);

  const t = (key: string, fallback?: string): string => {
    const langDict = TRANSLATIONS[language];
    if (langDict && langDict[key]) {
      return langDict[key];
    }
    const enDict = TRANSLATIONS['en'];
    if (enDict && enDict[key]) {
      return enDict[key];
    }
    return fallback || key;
  };

  const currentLanguageOption = 
    SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];

  return (
    <LanguageContext.Provider 
      value={{ 
        language, 
        setLanguage, 
        t, 
        languages: SUPPORTED_LANGUAGES,
        currentLanguageOption 
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
