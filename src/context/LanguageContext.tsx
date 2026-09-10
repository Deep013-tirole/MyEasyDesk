import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  SupportedLanguage,
  APPROVED_LOCALIZED_NAMES,
  APPROVED_GEOGRAPHIC_NAMES,
  APPROVED_GOVERNMENT_TERMS,
  localizePersonName,
  localizeBrandName,
  localizePlaceName,
  localizeGovTerm,
  APPROVED_ORDER_STATUSES,
  APPROVED_TIMELINE_STEPS,
  localizeOrderStatus,
  localizeTimelineStep,
  normalizeIndicDigits,
  PROTECTED_BRAND_NAME,
  PROTECTED_CORPORATE_NAME,
  PROTECTED_COMMERCIAL_NAME,
  PROTECTED_PORTAL_NAME,
  isProtectedIdentifier,
  sanitizeProtectedNamesInText,
  FORBIDDEN_TRANSLITERATION_PATTERNS
} from '../lib/nameLocalization.js';

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
    'nav.track': 'Track',
    'nav.trackOrder': 'Track',
    'nav.desk': 'Desk',
    
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
    'common.isoCertified': 'ISO 27001 Certified Security',
    'common.phone': 'Phone',
    'common.email': 'Email',
    'common.address': 'Address',
    'common.back': 'Back',
    'common.submit': 'Submit',
    'common.close': 'Close',
    'common.loading': 'Loading...',
    'common.search': 'Search',
    'common.founder': 'Founder & CEO',
    'common.verifiedClient': 'Verified Client',

    'category.government': 'Government Services',
    'category.certificates': 'Certificates & Domicile',
    'category.financial': 'Tax & Financial Services',
    'category.business': 'Business & MSME Services'
  },
  hi: {
    'nav.portalSubtitle': 'डिजिटल सेवा पोर्टल',
    'nav.home': 'होम',
    'nav.services': 'सेवाएं',
    'nav.blogs': 'ब्लॉग',
    'nav.about': 'हमारे बारे में',
    'nav.contact': 'संपर्क',
    'nav.payment': 'भुगतान',
    'nav.privacy': 'गोपनीयता और सुरक्षा',
    'nav.admin': 'एडमिन पैनल',
    'nav.adminLogin': 'एडमिन लॉगिन',
    'nav.signOut': 'साइन आउट',
    'nav.orderWhatsApp': 'व्हाट्सएप पर ऑर्डर करें',
    'nav.selectLanguage': 'भाषा चुनें',
    'nav.language': 'भाषा',
    'nav.track': 'ट्रैक',
    'nav.trackOrder': 'ट्रैक',
    'nav.desk': 'डेस्क',

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
    'common.isoCertified': 'ISO 27001 प्रमाणित सुरक्षा',
    'common.phone': 'फ़ोन',
    'common.email': 'ईमेल',
    'common.address': 'पता',
    'common.back': 'वापस',
    'common.submit': 'जमा करें',
    'common.close': 'बंद करें',
    'common.loading': 'लोड हो रहा है...',
    'common.search': 'खोजें',
    'common.founder': 'संस्थापक एवं सीईओ',
    'common.verifiedClient': 'सत्यापित ग्राहक',

    'category.government': 'सरकारी सेवाएं',
    'category.certificates': 'प्रमाण पत्र एवं अधिवास',
    'category.financial': 'कर एवं वित्तीय सेवाएं',
    'category.business': 'व्यापार एवं एमएसएमई सेवाएं'
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
    'nav.track': 'तपासा',
    'nav.trackOrder': 'तपासा',
    'nav.desk': 'डेस्क',

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
    'common.isoCertified': 'ISO 27001 प्रमाणित सुरक्षा',
    'common.phone': 'फोन',
    'common.email': 'ईमेल',
    'common.address': 'पत्ता',
    'common.back': 'मागे',
    'common.submit': 'सबमिट करा',
    'common.close': 'बंद करा',
    'common.loading': 'लोड होत आहे...',
    'common.search': 'शोधा',
    'common.founder': 'संस्थापक आणि मुख्य कार्यकारी अधिकारी',
    'common.verifiedClient': 'सत्यापित ग्राहक',

    'category.government': 'सरकारी सेवा',
    'category.certificates': 'प्रमाणपत्रे आणि अधिवास',
    'category.financial': 'कर आणि आर्थिक सेवा',
    'category.business': 'व्यवसाय आणि एमएसएमई सेवा'
  },
  gu: {
    'nav.portalSubtitle': 'ડિજિટલ સેવા પોર્ટલ',
    'nav.home': 'મુખ્ય પૃષ્ઠ',
    'nav.services': 'સેવાઓ',
    'nav.blogs': 'બ્લોગ્સ',
    'nav.about': 'અમારા વિશે',
    'nav.contact': 'સંપર્ક',
    'nav.payment': 'ચુકવણી',
    'nav.privacy': 'ગોપનીયતા અને સુરક્ષા',
    'nav.admin': 'એડમિન પેનલ',
    'nav.adminLogin': 'એડમિન લૉગિન',
    'nav.signOut': 'સાઇન આઉટ',
    'nav.orderWhatsApp': 'વોટ્સએપ પર ઓર્ડર કરો',
    'nav.selectLanguage': 'ભાષા પસંદ કરો',
    'nav.language': 'ભાષા',
    'nav.track': 'ટ્રેક',
    'nav.trackOrder': 'ટ્રેક',
    'nav.desk': 'ડેસ્ક',

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
    'common.isoCertified': 'ISO 27001 પ્રમાણિત સુરક્ષા',
    'common.phone': 'ફોન',
    'common.email': 'ઇમેઇલ',
    'common.address': 'સરનામું',
    'common.back': 'પાછા',
    'common.submit': 'સબમિટ કરો',
    'common.close': 'બંધ કરો',
    'common.loading': 'લોડ થઈ રહ્યું છે...',
    'common.search': 'શોધો',
    'common.founder': 'સ્થાપક અને સીઇઓ',
    'common.verifiedClient': 'ચકાસાયેલ ગ્રાહક',

    'category.government': 'સરકારી સેવાઓ',
    'category.certificates': 'પ્રમાણપત્રો અને રહેઠાણ',
    'category.financial': 'કર અને નાણાકીય સેવાઓ',
    'category.business': 'વ્યવસાય અને એમએસએમઇ સેવાઓ'
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
  localizeName: (
    canonicalName: string | null | undefined,
    customMap?: Partial<Record<LanguageCode, string>> | null
  ) => string;
  localizePlace: (canonicalPlace: string | null | undefined) => string;
  localizeGov: (canonicalTerm: string | null | undefined) => string;
  localizeBrand: (canonicalBrand?: string | null | undefined) => string;
  localizeStatus: (canonicalStatus?: string | null | undefined) => string;
  localizeStep: (canonicalStep?: string | null | undefined) => string;
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
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=' + host + '; path=/;';
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=.' + host + '; path=/;';
      document.cookie = 'googtrans=/en/en; path=/;';
    } else {
      const cookieVal = '/en/' + lang;
      document.cookie = 'googtrans=' + cookieVal + '; path=/;';
      document.cookie = 'googtrans=' + cookieVal + '; domain=' + host + '; path=/;';
      document.cookie = 'googtrans=' + cookieVal + '; domain=.' + host + '; path=/;';
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

  // Safe DOM post-processor to prevent machine-translation corruption:
  // 1. Inputs/forms must NEVER be translated (avoids form pollution into DB)
  // 2. Protected brand 'EasyDesk' (never ईज़ीडेस्क or Easy Desk)
  // 3. Founder name: strictly 'दीप तिरोले' in Hindi (never दीप तिरोल or डीप टिरोले)
  // 4. Sensitive statutory codes and IDs (ORD-, TRK-, GSTIN, PAN, IFSC, etc.)
  // 5. Corporate entity & street names
  useEffect(() => {
    if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;

    let timeoutId: any = null;

    const sanitizeDOM = () => {
      try {
        // Step A: Protect all form controls to prevent client-side translation pollution into canonical data
        const formInputs = document.querySelectorAll('input, textarea, select');
        formInputs.forEach((el) => {
          if (!el.classList.contains('notranslate')) {
            el.classList.add('notranslate');
            el.setAttribute('translate', 'no');
          }
        });

        // Step B: Walk text nodes to sanitize proper names, brands, and statutory tokens
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null
        );

        let node: Text | null = walker.nextNode() as Text;
        while (node) {
          const currentText = node.nodeValue;
          if (currentText) {
            let updatedText = currentText;

            // Brand protection: EasyDesk must remain EasyDesk in every language
            if (/ईज़ीडेस्क|ईज़ी\s*डेस्क|इजी\s*डेस्क|इजीडेस्क/i.test(updatedText)) {
              updatedText = updatedText.replace(/ईज़ीडेस्क|ईज़ी\s*डेस्क|इजी\s*डेस्क|इजीडेस्क/gi, 'EasyDesk');
            }

            // Legal corporate identity
            if (/ईज़ीडेस्क\s*सॉल्यूशंस\s*प्राइवेट\s*लिमिटेड|सरल\s*डेस्क\s*समाधान\s*निजी\s*सीमित/gi.test(updatedText)) {
              updatedText = updatedText.replace(/ईज़ीडेस्क\s*सॉल्यूशंस\s*प्राइवेट\s*लिमिटेड|सरल\s*डेस्क\s*समाधान\s*निजी\s*सीमित/gi, 'EasyDesk Solutions Private Limited');
            }

            // Address preservation: Civil Lines / Court Road
            if (/नागरिक\s*रेखाएं/gi.test(updatedText)) {
              updatedText = updatedText.replace(/नागरिक\s*रेखाएं/gi, 'Civil Lines');
            }
            if (/न्यायालय\s*सड़क/gi.test(updatedText)) {
              updatedText = updatedText.replace(/न्यायालय\s*सड़क/gi, 'Court Road');
            }

            // Founder protection: In Hindi it MUST be दीप तिरोले; never दीप तिरोल or डीप टिरोले
            if (language === 'hi') {
              if (/दीप\s*तिरोल(?!े)|डीप\s*टिरोले|दीप\s*तिरोले́|गहरा\s*तिरोल/.test(updatedText)) {
                updatedText = updatedText
                  .replace(/दीप\s*तिरोल(?!े)/g, 'दीप तिरोले')
                  .replace(/डीप\s*टिरोले/g, 'दीप तिरोले')
                  .replace(/दीप\s*तिरोले́/g, 'दीप तिरोले')
                  .replace(/गहरा\s*तिरोल/g, 'दीप तिरोले');
              }
            } else {
              // In English / Marathi / Gujarati: preserve Deep Tirole if corrupted
              if (/दीप\s*तिरोल(?!े)|डीप\s*टिरोले|दीप\s*तिरोले́|गहरा\s*तिरोल/.test(updatedText)) {
                updatedText = updatedText.replace(
                  /दीप\s*तिरोल(?!े)|डीप\s*टिरोले|दीप\s*तिरोले́|गहरा\s*तिरोल/g,
                  'Deep Tirole'
                );
              }
            }

            // Category D: Check if the text matches a statutory identifier or currency
            if (isProtectedIdentifier(currentText)) {
              const parent = node.parentElement;
              if (parent && !parent.classList.contains('notranslate')) {
                parent.classList.add('notranslate');
                parent.setAttribute('translate', 'no');
              }
            }

            if (updatedText !== currentText) {
              node.nodeValue = updatedText;
              const parent = node.parentElement;
              if (parent && !parent.classList.contains('notranslate')) {
                parent.classList.add('notranslate');
                parent.setAttribute('translate', 'no');
              }
            }
          }
          node = walker.nextNode() as Text;
        }
      } catch (err) {
        // Defensive: ignore DOM inspection errors
      }
    };

    const observer = new MutationObserver(() => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(sanitizeDOM, 50);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // Run initial sanitize pass
    sanitizeDOM();

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [language]);

  const setLanguage = (lang: LanguageCode) => {
    // Presentation-layer state change ONLY.
    // Switching language NEVER rewrites database values, db_store.json, or server state.
    // Changing language NEVER changes the current route/URL.
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

  const localizeName = (
    canonicalName: string | null | undefined,
    customMap?: Partial<Record<LanguageCode, string>> | null
  ): string => {
    return localizePersonName(canonicalName, language, customMap);
  };

  const localizePlace = (canonicalPlace: string | null | undefined): string => {
    return localizePlaceName(canonicalPlace, language);
  };

  const localizeGov = (canonicalTerm: string | null | undefined): string => {
    return localizeGovTerm(canonicalTerm, language);
  };

  const localizeBrand = (canonicalBrand?: string | null | undefined): string => {
    return localizeBrandName(canonicalBrand || PROTECTED_BRAND_NAME, language);
  };

  const localizeStatus = (canonicalStatus?: string | null | undefined): string => {
    return localizeOrderStatus(canonicalStatus, language);
  };

  const localizeStep = (canonicalStep?: string | null | undefined): string => {
    return localizeTimelineStep(canonicalStep, language);
  };

  const currentLanguageOption = 
    SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];

  return (
    <LanguageContext.Provider 
      value={{ 
        language, 
        setLanguage, 
        t, 
        localizeName,
        localizePlace,
        localizeGov,
        localizeBrand,
        localizeStatus,
        localizeStep,
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

export {
  APPROVED_LOCALIZED_NAMES,
  APPROVED_GEOGRAPHIC_NAMES,
  APPROVED_GOVERNMENT_TERMS,
  APPROVED_ORDER_STATUSES,
  APPROVED_TIMELINE_STEPS,
  localizePersonName,
  localizeBrandName,
  localizePlaceName,
  localizeGovTerm,
  localizeOrderStatus,
  localizeTimelineStep,
  normalizeIndicDigits,
  PROTECTED_BRAND_NAME,
  PROTECTED_CORPORATE_NAME,
  PROTECTED_COMMERCIAL_NAME,
  PROTECTED_PORTAL_NAME,
  isProtectedIdentifier,
  sanitizeProtectedNamesInText,
  FORBIDDEN_TRANSLITERATION_PATTERNS
};
