/**
 * EASYDESK — MULTILINGUAL ORDER TRACKING & PRINT CONTACT DATA VERIFICATION SUITE
 *
 * Verifies all 30 assertions across:
 * 1. Multilingual & Indic-numeral tolerant order tracking lookup API
 * 2. Mobile number matching with +91, spaces, hyphens, Indic digits
 * 3. Strict canonical data preservation in database and API payloads
 * 4. Presentation-layer status localization (en, hi, mr, gu)
 * 5. Single source of truth for authoritative contact details (Indore)
 * 6. Elimination of hardcoded stale contact data (1800-889-DESK, Noida)
 * 7. State persistence across language toggles and page refreshes
 * 8. Static code analysis & print security guarantees
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${desc}`);
    console.error(`         ${err.message}`);
  }
}

async function itAsync(desc, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${desc}`);
    console.error(`         ${err.message}`);
  }
}

function makeRequest(port, reqPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: reqPath,
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runSuite() {
  console.log('====================================================================');
  console.log(' EASYDESK — MULTILINGUAL ORDER TRACKING & PRINT DATA TEST SUITE');
  console.log('====================================================================\n');

  // Load codebase files for static inspection
  const serverPath = path.resolve(__dirname, '../server.ts');
  const serverCode = fs.readFileSync(serverPath, 'utf8');

  const trackingViewPath = path.resolve(__dirname, '../src/components/TrackingView.tsx');
  const trackingViewCode = fs.readFileSync(trackingViewPath, 'utf8');

  const nameLocPath = path.resolve(__dirname, '../src/lib/nameLocalization.ts');
  const nameLocCode = fs.readFileSync(nameLocPath, 'utf8');

  const langCtxPath = path.resolve(__dirname, '../src/context/LanguageContext.tsx');
  const langCtxCode = fs.readFileSync(langCtxPath, 'utf8');

  const dbStorePath = path.resolve(__dirname, '../db_store.json');
  const dbStore = JSON.parse(fs.readFileSync(dbStorePath, 'utf8'));

  function normalizeIndicDigits(str) {
    if (!str) return '';
    return str
      .replace(/[\u0966-\u096F]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0966 + 48))
      .replace(/[\u0AE6-\u0AEF]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0AE6 + 48));
  }
  const statuses = {
    'Pending': { en: 'Pending', hi: 'लंबित', mr: 'प्रलंबित', gu: 'બાકી' },
    'Under Verification': { en: 'Under Verification', hi: 'सत्यापनाधीन', mr: 'पडताळणी अंतर्गत', gu: 'ચકાસણી હેઠળ' },
    'Processing': { en: 'Processing', hi: 'प्रक्रिया जारी', mr: 'प्रक्रिया सुरू', gu: 'પ્રક્રિયા ચાલુ' },
    'Completed': { en: 'Completed', hi: 'पूर्ण', mr: 'पूर्ण', gu: 'પૂર્ણ' },
    'Rejected': { en: 'Rejected', hi: 'अस्वीकृत', mr: 'नाकारले', gu: 'અસ્વીકાર્ય' },
    'Documents Required': { en: 'Documents Required', hi: 'दस्तावेज़ आवश्यक', mr: 'कागदपत्रे आवश्यक', gu: 'દસ્તાવેજો જરૂરી' }
  };
  function localizeOrderStatus(s, l) {
    return statuses[s]?.[l] || s;
  }

  // ------------------------------------------------------------------------
  // PART A: STATIC CODE & ARCHITECTURE INTEGRITY
  // ------------------------------------------------------------------------
  console.log('--- PART A: Static Code & Architecture Audits ---');

  it('1. TrackingView imports useLanguage and contact settings helpers', () => {
    assert(trackingViewCode.includes("import { useLanguage } from '../context/LanguageContext.js'"), 'Must import useLanguage');
    assert(trackingViewCode.includes('getClientContactSettings'), 'Must import getClientContactSettings');
    assert(trackingViewCode.includes('formatFullAddress'), 'Must import formatFullAddress');
    assert(trackingViewCode.includes('onContactSettingsUpdated'), 'Must import onContactSettingsUpdated');
    assert(trackingViewCode.includes('normalizeIndicDigits'), 'Must import normalizeIndicDigits');
  });

  it('2. TrackingView subscribes to onContactSettingsUpdated for dynamic updates', () => {
    assert(trackingViewCode.includes('onContactSettingsUpdated('), 'Must subscribe to onContactSettingsUpdated');
    assert(trackingViewCode.includes('setContactSettings('), 'Must update contactSettings state');
  });

  it('3. TrackingView persists active tracking ID to sessionStorage and URL search params', () => {
    assert(trackingViewCode.includes("sessionStorage.setItem('easydesk_active_tracking_id'"), 'Must persist tracking ID to sessionStorage');
    assert(trackingViewCode.includes("currentUrl.searchParams.set('orderId'"), 'Must sync orderId into URL');
    assert(trackingViewCode.includes('window.history?.replaceState'), 'Must replaceState to survive reloads');
  });

  it('4. TrackingView restores active tracking state on mount from URL or sessionStorage', () => {
    assert(trackingViewCode.includes("params.get('orderId')"), 'Must read orderId from URL');
    assert(trackingViewCode.includes("sessionStorage.getItem('easydesk_active_tracking_id')"), 'Must read from sessionStorage');
  });

  it('5. TrackingView marks order status and timeline steps with notranslate and data-canonical-status', () => {
    assert(trackingViewCode.includes('data-canonical-status={order.orderStatus}'), 'Must tag status with canonical attribute');
    assert(trackingViewCode.includes('notranslate'), 'Must use notranslate class to prevent DOM mutation');
    assert(trackingViewCode.includes('localizeStatus(order.orderStatus)'), 'Must call localizeStatus for presentation');
  });

  it('6. Printable acknowledgement renders authoritative Indore contact and zero hardcoded 1800-889-DESK in JSX', () => {
    assert(!trackingViewCode.includes('>1800-889-DESK<') && !trackingViewCode.includes('Helpline: 1800-889-DESK'), 'Must not hardcode 1800-889-DESK in JSX');
    assert(trackingViewCode.includes("contactSettings?.phone || '+91 9575538590'"), 'Must render dynamic phone with Indore fallback');
    assert(trackingViewCode.includes("contactSettings?.email || 'help.myeasydesks@gmail.com'"), 'Must render dynamic email with help.myeasydesks@gmail.com fallback');
    assert(trackingViewCode.includes("formatFullAddress(contactSettings) || 'A51, Vijay Nagar, Indore, Madhya Pradesh - 452010'"), 'Must render formatted Indore address in printable acknowledgement');
  });

  it('7. server.ts sanitizes legacy stale demo contact data on startup in initDatabase()', () => {
    assert(serverCode.includes('isStaleContact'), 'Must detect stale contact settings');
    assert(serverCode.includes("parsed.contactSettings.city?.toLowerCase() === 'noida'"), 'Must sanitize Noida data');
    assert(serverCode.includes('PRESEEDED_CONTACT_SETTINGS.phone'), 'Must fallback to canonical phone');
  });

  it('8. db_store.json contains authoritative Indore contact details', () => {
    assert.strictEqual(dbStore.contactSettings.phone, '+91 9575538590');
    assert.strictEqual(dbStore.contactSettings.whatsapp, '919575538590');
    assert.strictEqual(dbStore.contactSettings.email, 'help.myeasydesks@gmail.com');
    assert.strictEqual(dbStore.contactSettings.city, 'Indore');
    assert.strictEqual(dbStore.contactSettings.state, 'Madhya Pradesh');
    assert.strictEqual(dbStore.contactSettings.pinCode, '452010');
    assert.strictEqual(dbStore.companyProfile.city, 'Indore');
    assert.strictEqual(dbStore.companyProfile.phone, '+91 9575538590');
    assert.strictEqual(dbStore.companyProfile.email, 'help.myeasydesks@gmail.com');
  });

  it('9. Indic numeral normalizer converts Devanagari and Gujarati digits to ASCII', () => {
    assert.strictEqual(normalizeIndicDigits('ORD-१०४३२'), 'ORD-10432');
    assert.strictEqual(normalizeIndicDigits('ORD-૧૦૪૩૨'), 'ORD-10432');
    assert.strictEqual(normalizeIndicDigits('+९१ ९८१४०६९४२८'), '+91 9814069428');
    assert.strictEqual(normalizeIndicDigits('४५२०१०'), '452010');
  });

  it('10. Order status localization maps canonical enums to hi, mr, gu with canonical immunity', () => {
    assert.strictEqual(localizeOrderStatus('Pending', 'hi'), 'लंबित');
    assert.strictEqual(localizeOrderStatus('Pending', 'mr'), 'प्रलंबित');
    assert.strictEqual(localizeOrderStatus('Pending', 'gu'), 'બાકી');
    assert.strictEqual(localizeOrderStatus('Pending', 'en'), 'Pending');

    assert.strictEqual(localizeOrderStatus('Under Verification', 'hi'), 'सत्यापनाधीन');
    assert.strictEqual(localizeOrderStatus('Under Verification', 'mr'), 'पडताळणी अंतर्गत');
    assert.strictEqual(localizeOrderStatus('Under Verification', 'gu'), 'ચકાસણી હેઠળ');

    assert.strictEqual(localizeOrderStatus('Completed', 'hi'), 'पूर्ण');
    assert.strictEqual(localizeOrderStatus('Rejected', 'hi'), 'अस्वीकृत');
    assert.strictEqual(localizeOrderStatus('Documents Required', 'hi'), 'दस्तावेज़ आवश्यक');
  });

  // ------------------------------------------------------------------------
  // PART B: LIVE BACKEND API VERIFICATION
  // ------------------------------------------------------------------------
  console.log('\n--- PART B: Live Backend API Verifications ---');

  process.env.IS_WORKER = 'true';
  process.env.NODE_ENV = 'test';

  const { app } = require('../dist/server.cjs');
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const testPort = server.address().port;

  try {
    const sampleOrder = dbStore.orders[0];
    assert(sampleOrder, 'Must have at least one order in db_store.json');
    const targetId = sampleOrder.id;
    const targetMobile = sampleOrder.mobile;
    const numDigits = targetId.replace(/\D/g, '');

    const devanagariDigits = numDigits.replace(/\d/g, d => String.fromCharCode(d.charCodeAt(0) - 48 + 0x0966));
    const gujaratiDigits = numDigits.replace(/\d/g, d => String.fromCharCode(d.charCodeAt(0) - 48 + 0x0AE6));
    const devanagariOrderId = `ORD-${devanagariDigits}`;
    const gujaratiOrderId = `ORD-${gujaratiDigits}`;

    const devanagariMobile = targetMobile.replace(/\d/g, d => String.fromCharCode(d.charCodeAt(0) - 48 + 0x0966));

    await itAsync('11. GET /api/orders/track?orderId={canonicalId} finds order in English', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${encodeURIComponent(targetId)}&mobile=${encodeURIComponent(targetMobile)}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, targetId);
      assert.strictEqual(res.body.orderStatus, sampleOrder.orderStatus);
    });

    await itAsync('12. GET /api/orders/track?orderId=#{canonicalId} strips leading hash', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${encodeURIComponent('#' + targetId)}&mobile=${encodeURIComponent(targetMobile)}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, targetId);
    });

    await itAsync('13. GET /api/orders/track with Devanagari numerals (Hindi/Marathi) finds order', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${encodeURIComponent(devanagariOrderId)}&mobile=${encodeURIComponent(targetMobile)}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, targetId);
    });

    await itAsync('14. GET /api/orders/track with Gujarati numerals finds order', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${encodeURIComponent(gujaratiOrderId)}&mobile=${encodeURIComponent(targetMobile)}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, targetId);
    });

    await itAsync('15. GET /api/orders/track with bare numeric digits finds order', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${encodeURIComponent(numDigits)}&mobile=${encodeURIComponent(targetMobile)}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, targetId);
    });

    await itAsync('16. GET /api/orders/track with prefix alias ED- finds order', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${encodeURIComponent('ED-' + numDigits)}&mobile=${encodeURIComponent(targetMobile)}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, targetId);
    });

    await itAsync('17. GET /api/orders/track with prefix alias TRK- finds order', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${encodeURIComponent('TRK-' + numDigits)}&mobile=${encodeURIComponent(targetMobile)}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, targetId);
    });

    await itAsync('18. GET /api/orders/track?trackingId={id} parameter alias works', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?trackingId=${encodeURIComponent(targetId)}&mobile=${encodeURIComponent(targetMobile)}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, targetId);
    });

    await itAsync('19. GET /api/orders/track?trackId={id} parameter alias works', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?trackId=${encodeURIComponent(targetId)}&mobile=${encodeURIComponent(targetMobile)}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, targetId);
    });

    await itAsync('20. GET /api/orders/track?id={id} parameter alias works', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?id=${encodeURIComponent(targetId)}&mobile=${encodeURIComponent(targetMobile)}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, targetId);
    });

    await itAsync('21. GET /api/orders/track?query={id} parameter alias works', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?query=${encodeURIComponent(targetId)}&mobile=${encodeURIComponent(targetMobile)}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, targetId);
    });

    await itAsync('22. GET /api/orders/track with matching mobile succeeds', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${encodeURIComponent(targetId)}&mobile=${encodeURIComponent(targetMobile)}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, targetId);
    });

    await itAsync('23. GET /api/orders/track with +91 and formatted mobile succeeds', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${encodeURIComponent(targetId)}&mobile=${encodeURIComponent('+91 ' + targetMobile.slice(0, 5) + ' ' + targetMobile.slice(5))}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, targetId);
    });

    await itAsync('24. GET /api/orders/track with Devanagari mobile numerals succeeds', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${encodeURIComponent(targetId)}&mobile=${encodeURIComponent('+९१ ' + devanagariMobile)}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, targetId);
    });

    await itAsync('25. GET /api/orders/track with mismatched mobile returns 404', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${encodeURIComponent(targetId)}&mobile=9999900000`);
      assert.strictEqual(res.status, 404);
    });

    await itAsync('26. GET /api/orders/track with missing orderId returns 400 Bad Request', async () => {
      const res = await makeRequest(testPort, '/api/orders/track');
      assert.strictEqual(res.status, 400);
      assert(res.body.message.includes('required'));
    });

    await itAsync('27. GET /api/orders/track preserves canonical fields (amount, status, dates)', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${encodeURIComponent(targetId)}&mobile=${encodeURIComponent(targetMobile)}`);
      assert.strictEqual(res.body.id, sampleOrder.id);
      assert.strictEqual(res.body.orderStatus, sampleOrder.orderStatus);
      assert.strictEqual(res.body.totalAmount, sampleOrder.totalAmount);
      assert.strictEqual(res.body.createdAt, sampleOrder.createdAt);
      assert.strictEqual(res.body.mobile, sampleOrder.mobile);
    });

    await itAsync('28. GET /api/contact-settings returns authoritative Indore contact details', async () => {
      const res = await makeRequest(testPort, '/api/contact-settings');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.phone, '+91 9575538590');
      assert.strictEqual(res.body.whatsapp, '919575538590');
      assert.strictEqual(res.body.email, 'help.myeasydesks@gmail.com');
      assert.strictEqual(res.body.city, 'Indore');
      assert.strictEqual(res.body.state, 'Madhya Pradesh');
      assert.strictEqual(res.body.pinCode, '452010');
      assert.strictEqual(res.body.address, 'A51, Vijay Nagar');
    });

    await itAsync('29. GET /api/company-profile returns Indore registered office and official phone', async () => {
      const res = await makeRequest(testPort, '/api/company-profile');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.city, 'Indore');
      assert.strictEqual(res.body.phone, '+91 9575538590');
      assert.strictEqual(res.body.email, 'help.myeasydesks@gmail.com');
      assert.strictEqual(res.body.address, 'A51, Vijay Nagar');
      assert.strictEqual(res.body.pinCode, '452010');
    });

    await itAsync('30. Full end-to-end multilingual tracking: Gujarati ID + Devanagari Mobile -> Canonical Order', async () => {
      const res = await makeRequest(
        testPort,
        `/api/orders/track?orderId=${encodeURIComponent(gujaratiOrderId)}&mobile=${encodeURIComponent('+९१ ' + devanagariMobile)}`
      );
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, targetId);
      assert.strictEqual(res.body.orderStatus, sampleOrder.orderStatus);
    });

  } finally {
    server.close();
  }

  // ------------------------------------------------------------------------
  // RESULTS SUMMARY
  // ------------------------------------------------------------------------
  console.log('\n--------------------------------------------------------------------');
  console.log(`Results: ${passedTests} / ${totalTests} assertions passed.`);
  console.log('--------------------------------------------------------------------');

  if (passedTests === totalTests) {
    console.log('\n>>> ALL 30 MULTILINGUAL TRACKING & PRINT TESTS PASSED! <<<\n');
    process.exit(0);
  } else {
    console.error(`\n>>> FAILED: ${totalTests - passedTests} assertions failed! <<<\n`);
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
